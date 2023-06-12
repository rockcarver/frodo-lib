import State from '../shared/State';
import {
  accessToken,
  authorize,
  clientCredentialsGrant,
  getTokenInfo,
} from '../api/OAuth2OIDCApi';
import { AxiosRequestConfig } from 'axios';

export {
  accessToken,
  authorize,
  clientCredentialsGrant,
  getTokenInfo,
} from '../api/OAuth2OIDCApi';

export default class OAuth2OidcOps {
  state: State;
  constructor(state: State) {
    this.state = state;
  }
  async authorize(amBaseUrl: string, data: string, config: AxiosRequestConfig) {
    return authorize({
      amBaseUrl,
      data,
      config,
      state: this.state,
    });
  }

  async accessToken(amBaseUrl: string, data: any, config: AxiosRequestConfig) {
    return accessToken({ amBaseUrl, config, data, state: this.state });
  }

  async getTokenInfo(amBaseUrl: string, config: AxiosRequestConfig) {
    return getTokenInfo({
      amBaseUrl,
      config,
      state: this.state,
    });
  }

  async clientCredentialsGrant(
    amBaseUrl: string,
    clientId: string,
    clientSecret: string,
    scope: string
  ) {
    return clientCredentialsGrant({
      amBaseUrl,
      clientId,
      clientSecret,
      scope,
      state: this.state,
    });
  }
}
