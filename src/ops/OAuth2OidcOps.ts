import { AxiosRequestConfig, AxiosResponse } from 'axios';

import {
  accessToken as _accessToken,
  type AccessTokenResponseType,
  authorize as _authorize,
  clientCredentialsGrant as _clientCredentialsGrant,
  getTokenInfo as _getTokenInfo,
} from '../api/OAuth2OIDCApi';
import { TokenInfoResponseType } from '../api/OAuth2OIDCApi';
import { State } from '../shared/State';
import { mergeDeep } from '../utils/JsonUtils';
import { FrodoError } from './FrodoError';

export type AccessTokenMetaType = AccessTokenResponseType & {
  expires: number;
  from_cache?: boolean;
};

export type OAuth2Oidc = {
  authorize(
    amBaseUrl: string,
    data: string,
    config: AxiosRequestConfig
  ): Promise<AxiosResponse<any, any>>;
  accessToken(
    amBaseUrl: string,
    data: any,
    config: AxiosRequestConfig
  ): Promise<AccessTokenMetaType>;
  accessTokenRfc7523AuthZGrant(
    clientId: string,
    jwt: string,
    scope: string[],
    config?: AxiosRequestConfig
  ): Promise<AccessTokenMetaType>;
  getTokenInfo(
    amBaseUrl: string,
    config: AxiosRequestConfig
  ): Promise<TokenInfoResponseType>;
  clientCredentialsGrant(
    amBaseUrl: string,
    clientId: string,
    clientSecret: string,
    scope: string
  ): Promise<AccessTokenMetaType>;
};

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
    ): Promise<AccessTokenMetaType> {
      return accessToken({ amBaseUrl, config, data, state });
    },
    async accessTokenRfc7523AuthZGrant(
      clientId: string,
      jwt: string,
      scope: string[],
      config?: AxiosRequestConfig
    ): Promise<AccessTokenMetaType> {
      return accessTokenRfc7523AuthZGrant({
        clientId,
        jwt,
        scope,
        config,
        state,
      });
    },
    async getTokenInfo(
      amBaseUrl: string,
      config: AxiosRequestConfig
    ): Promise<TokenInfoResponseType> {
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

export async function authorize({
  amBaseUrl,
  data,
  config,
  state,
}: {
  amBaseUrl: string;
  data: string;
  config: AxiosRequestConfig;
  state: State;
}): Promise<AxiosResponse<any, any>> {
  try {
    return _authorize({ amBaseUrl, data, config, state });
  } catch (error) {
    throw new FrodoError(`Error authorizing oauth2 client`, error);
  }
}

export async function accessToken({
  amBaseUrl,
  data,
  config,
  realm = false,
  state,
}: {
  amBaseUrl: string;
  data: any;
  config: AxiosRequestConfig;
  realm?: boolean;
  state: State;
}): Promise<AccessTokenMetaType> {
  try {
    const response = await _accessToken({
      amBaseUrl,
      config,
      postData: data,
      realm,
      state,
    });
    response['expires'] = Date.now() + response.expires_in * 1000;
    return response as AccessTokenMetaType;
  } catch (error) {
    throw new FrodoError(`Error getting oauth2 access token`, error);
  }
}

export async function accessTokenRfc7523AuthZGrant({
  clientId,
  jwt,
  scope,
  config = {},
  state,
}: {
  clientId: string;
  jwt: string;
  scope: string[];
  config?: AxiosRequestConfig;
  state: State;
}): Promise<AccessTokenMetaType> {
  try {
    config = mergeDeep(config, {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    });
    const data = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
      scope: scope.join(' '),
      client_id: clientId,
    }).toString();
    return accessToken({
      amBaseUrl: state.getHost(),
      config,
      data,
      realm: true,
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error getting oauth2 access token (RFC7523 AuthZ Grant)`,
      error
    );
  }
}

export async function getTokenInfo({
  amBaseUrl,
  config,
  state,
}: {
  amBaseUrl: string;
  config: AxiosRequestConfig;
  state: State;
}): Promise<TokenInfoResponseType> {
  try {
    return _getTokenInfo({ amBaseUrl, config, state });
  } catch (error) {
    throw new FrodoError(`Error getting oauth2 token info`, error);
  }
}

export async function clientCredentialsGrant({
  amBaseUrl,
  clientId,
  clientSecret,
  scope,
  state,
}: {
  amBaseUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  state: State;
}): Promise<AccessTokenMetaType> {
  try {
    const response = await _clientCredentialsGrant({
      amBaseUrl,
      clientId,
      clientSecret,
      scope,
      state,
    });
    response['expires'] = new Date().getTime() + response.expires_in;
    return response as AccessTokenMetaType;
  } catch (error) {
    throw new FrodoError(
      `Error getting access token using client credentials grant`,
      error
    );
  }
}
