import { getOAuth2Provider } from '../api/OAuth2ProviderApi';
import State from '../shared/State';

export default class OAuth2ProviderOps {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  async getOAuth2Provider() {
    return getOAuth2Provider({ state: this.state });
  }
}

export { getOAuth2Provider };
