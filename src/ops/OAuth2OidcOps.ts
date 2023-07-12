import { State } from '../shared/State';
import {
  accessToken,
  authorize,
  clientCredentialsGrant,
  getTokenInfo,
} from '../api/OAuth2OIDCApi';
import { AxiosRequestConfig } from 'axios';

export type OAuth2Oidc = {
  authorize(
    amBaseUrl: string,
    data: string,
    config: AxiosRequestConfig
  ): Promise<import('axios').AxiosResponse<any, any>>;
  accessToken(
    amBaseUrl: string,
    data: any,
    config: AxiosRequestConfig
  ): Promise<import('axios').AxiosResponse<any, any>>;
  getTokenInfo(amBaseUrl: string, config: AxiosRequestConfig): Promise<any>;
  clientCredentialsGrant(
    amBaseUrl: string,
    clientId: string,
    clientSecret: string,
    scope: string
  ): Promise<any>;
};

export {
  accessToken,
  authorize,
  clientCredentialsGrant,
  getTokenInfo,
} from '../api/OAuth2OIDCApi';

export default (state: State): OAuth2Oidc => {
  return {
    async authorize(
      amBaseUrl: string,
      data: string,
      config: AxiosRequestConfig
    ) {
      return authorize({
        amBaseUrl,
        data,
        config,
        state,
      });
    },

    async accessToken(
      amBaseUrl: string,
      data: any,
      config: AxiosRequestConfig
    ) {
      return accessToken({ amBaseUrl, config, data, state });
    },

    async getTokenInfo(amBaseUrl: string, config: AxiosRequestConfig) {
      return getTokenInfo({
        amBaseUrl,
        config,
        state,
      });
    },

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
        state,
      });
    },
  };
};
