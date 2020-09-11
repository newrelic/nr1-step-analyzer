import React from 'react';
import { NerdletStateContext, PlatformStateContext } from 'nr1';
import Main from './main';

export default class Nr1SynFilmstripNerdletNerdlet extends React.Component {

  render() {
    return (
      <>
      <PlatformStateContext.Consumer>
      {(platformUrlState) => {
        const { duration } = platformUrlState.timeRange;
        const since = ` SINCE ${duration/60/1000} MINUTES AGO`;
        return (
          <NerdletStateContext.Consumer>
          {nerdletState => (
            <Main entityGuid={nerdletState.entityGuid} time={since}/>
          )}
          </NerdletStateContext.Consumer>
        )
      }}
      </PlatformStateContext.Consumer>
      </>
    );
  }
}
