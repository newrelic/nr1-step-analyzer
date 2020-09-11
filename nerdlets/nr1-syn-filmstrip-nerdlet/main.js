import React from 'react';
import { EntityByGuidQuery, navigation, NerdGraphQuery, PlatformStateContext, Spinner, Toast } from 'nr1';
import { Button, Icon, Table } from 'semantic-ui-react';
import { Timeline, TimelineEvent } from 'react-event-timeline';
import moment from 'moment';
import _ from 'lodash';
var AWS = require('aws-sdk')

/** Configure one of the authentication blocks below **/

/******************** Option 1 ******************/
// const bucket = '<bucket>';
// const personalCreds = {
//   accessKeyId: '<access_key>',
//   secretAccessKey: '<secret>'
// };
// AWS.config.update(personalCreds)
/******************** Option 1 ******************/

/******************** Option 2 ******************/
// const bucket = '<bucket>';
// const cognitoCreds = new AWS.CognitoIdentityCredentials({
//   IdentityPoolId: '<pool_id>' //Identity pool ID
// });
// AWS.config.update({region: '<region>', credentials: cognitoCreds})
/******************** Option 2 ******************/

export default class Main extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      accountId: null,
      loading: false,
      tableData: null,
      selectedRun: '',
      drillRun: '',
      runImages: [],
      imagesLoading: false,
      finalTimeline: [],
      noContent: false,
      showDrill: false,
      col: null,
      direction: null
    }
  }

  async componentDidMount() {
    const { entityGuid } = this.props
    this.setState({
      loading: true
    })

    await this.getAccountId(entityGuid);
    await this.getTableData();

    this.setState({
      loading: false
    })
  }

  componentDidUpdate(prevProps) {
    if (prevProps.time !== this.props.time) {
      this.getTableData();
    }
  }

  async getAccountId(entity){
    let res = await EntityByGuidQuery.query({ entityGuid: entity });

    if (res.errors) {
      console.debug("Failed to obtain accountId");
      console.debug(res.errors);
    }

    if (res.data.count == 1) {
      this.setState({
        accountId: res.data.entities[0].accountId
      })
    } else {
      console.debug("Failed to obtain accountId");
      console.debug(res);
    }
  }

  openChartBuilder() {
    let { time } = this.props;
    let { accountId, drillRun } = this.state;

    const nerdlet = {
      id: 'wanda-data-exploration.data-explorer',
      urlState: {
        initialActiveInterface: 'nrqlEditor',
        initialAccountId: accountId,
        initialNrqlValue: `FROM SyntheticRequest SELECT max(firstContentfulPaint), max(domInteractive), max(longRunningTasksMaxTime), max(domComplete) where jobId = '${drillRun}' and domComplete is not null facet URL ${time}` ,
        isViewingQuery: true
      }
    };

    navigation.openStackedNerdlet(nerdlet);
  }

  async getTableData(){
    const { accountId } = this.state;
    const q = `
    {
      actor {
        account(id: ${accountId}) {
          nrql(query: "FROM SyntheticCheck SELECT * where entityGuid = '${this.props.entityGuid}' ${this.props.time}") {
            results
          }
        }
      }
    }
    `
    let res = await NerdGraphQuery.query({query: q});

    if (res.errors) {
      console.debug(res.errors);
    }

    if (res.data) {
      if (res.data.actor.account.nrql.results.length > 0) {
        this.setState({
          tableData: res.data.actor.account.nrql.results
        })
      }
    }
  }

  handleRowClick = (e) => {
    const { tableData } = this.state;

    for (var z=0; z < tableData.length; z++) {
      if (e.currentTarget.id == tableData[z].id) {
        this.getRun(tableData[z]['custom.S3URL']);
        break;
      }
    }
  }

  handleJobDrill = (e) => {
    this.setState({ drillRun: e.currentTarget.id }, () => {
      this.openChartBuilder();
    })
  }

  handleSort = (clickedColumn) => () => {
   const { col, tableData, direction } = this.state
   let tableMatch = null;

   switch (clickedColumn) {
     case 'Timestamp':
       tableMatch = 'timestamp'
       break;
     case 'Run ID':
       tableMatch = 'id'
       break;
     case 'Result':
       tableMatch = 'result'
       break;
     case 'Duration (ms)':
       tableMatch = 'duration'
       break;
     case 'Location':
       tableMatch = 'locationLabel'
       break;
   }

   if (col !== clickedColumn) {
     this.setState({
       col: clickedColumn,
       tableData: _.sortBy(tableData, [tableMatch]),
       direction: 'ascending',
     })

     return
   }

   this.setState({
     tableData: tableData.reverse(),
     direction: direction === 'ascending' ? 'descending' : 'ascending',
   })
 }

  renderRunTable() {
    let { col, direction, tableData } = this.state;

    let tableHeaders = ['Timestamp', 'Run ID', 'Result', 'Duration (ms)', 'Location'];

    return (
      <>
      <div
      style={{
        overflowY: 'scroll',
        height: '800px',
        width: '48%',
        marginLeft: '0.4%',
        marginTop: '0.4%',
        display: tableData.length === 0 ? 'none' : 'inline',
        float: 'left'
      }}
      >
      <Table sortable celled>
        <Table.Header>
          <Table.Row>
          <Table.HeaderCell></Table.HeaderCell>
            {
              tableHeaders.map((header, k) => {
                return <Table.HeaderCell sorted={col === header ? direction : null} onClick={this.handleSort(header)} key={k}>{header}</Table.HeaderCell>
              })
            }
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {
            tableData.map((row, p) => {
              return (
                <Table.Row style={{color: row.result == 'FAILED' ? 'red' : 'black'}} key={p}>
                  <Table.Cell><Button id={row.id} size='tiny' icon='crosshairs' onClick={this.handleJobDrill} primary/></Table.Cell>
                  <Table.Cell>{moment(row['timestamp']).format('MM/DD/YYYY, h:mm a')}</Table.Cell>
                  <Table.Cell verticalAlign='top'>
                    <a id={row.id} onClick={this.handleRowClick} style={{color: row.result == 'FAILED' ? 'red' : 'black'}}>{row.id}</a>
                  </Table.Cell>
                  <Table.Cell>{row.result}</Table.Cell>
                  <Table.Cell>{Math.ceil(row.duration)}</Table.Cell>
                  <Table.Cell>{row.locationLabel}</Table.Cell>
                </Table.Row>
              )
            })
          }
        </Table.Body>
      </Table>
      </div>
      </>
    )
  }

  renderPhotos() {
    let { runImages } = this.state;

    return (
      <div style={{display: runImages.length === 0 ? 'none' : 'inline'}}>
      <Timeline style={{width: '50%', display: 'inline', float: 'right'}}>
      {
        runImages.map((img, idx) => {
          idx = idx+1
          return (
            <TimelineEvent
              title={"Step " + idx}
              titleStyle={{fontWeight: 'bold', fontSize: '20px'}}
              subtitle={img.result == 'Failed' ? 'Failed - ' + img.message : "Duration (ms) - " + img.result}
              subtitleStyle={{color: img.result == 'Failed' ? 'red' : 'green', fontSize: '16px'}}
              style={{width: '600px'}}
              icon={img.result == 'Failed' ? <Icon fitted size='large' name='attention'/> : <Icon fitted size='large' name='check'/>}
              iconColor={img.result == 'Failed' ? 'red' : 'green'}
            >
              <img src={img.imageUri} style={{width: '600px'}}/>
            </TimelineEvent>
          )
        })
      }
      </Timeline>
      </div>
    )
  }

  getRun(endpoint) {
    let { tableData } = this.state;
    this.setState({ imagesLoading: true, noContent: false })
    let s3 = new AWS.S3({apiVersion: '2006-03-01'});

    if (endpoint == undefined || endpoint == null) {
      this.setState({ imagesLoading: false, noContent: true })
    } else {
      let folder = endpoint.split('/');
      var b = {
        Bucket: bucket,
        Prefix: folder[3]
      }

      s3.listObjects(b, function(err, data) {
        if (err) {
          console.debug(err);
          Toast.showToast({title: "Error retrieving screenshots!", type: Toast.TYPE.CRITICAL})
          this.setState({ imagesLoading: false })
        } else {
          let images = [];
          if (data.Contents.length > 0) {
            for (var y=0; y < data.Contents.length; y++) {
              let imagePath = 'https://' + bucket + '.s3.amazonaws.com/' + data.Contents[y].Key
              let imageName = data.Contents[y].Key.split('/');
              let stepResult = null;
              let errMsg = null;
              for (let t of tableData) {
                if (imagePath.includes(t.id)) {
                  let imgN = imageName[1].slice(0, -4)
                  if (t.error !== "") {
                    errMsg = t.error;
                  }
                  for (var k in t) { //find key
                    if (k.includes(imgN)) {
                      stepResult = t[k] //pluck value
                      break;
                    }
                  }
                }
              }
              images.push({imageUri: imagePath, result: stepResult, message: errMsg });
            }

            this.setState({
              runImages: images
            }, () => {
              this.setState({ imagesLoading: false })
            })
          } else {
            this.setState({ imagesLoading: false, noContent: true })
          }
        }
      }.bind(this))
    }
  }

  render() {
    let { accountId, drillRun, imagesLoading, loading, noContent, showDrill, tableData } = this.state;
    const { entityGuid } = this.props

    if (loading) {
       return <Spinner />
     } else {
       if (tableData == null) {
         return <p>Could not load results for entity: {entityGuid}.</p>
       } else {
         return (
           <>
             {this.renderRunTable()}
             {imagesLoading == true ? <Spinner /> : this.renderPhotos()}
             {noContent == true ? <h2 style={{display: 'inline'}}>No screenshots found for selected run.</h2> : null}
           </>
         )
       }
    }
  }
}
