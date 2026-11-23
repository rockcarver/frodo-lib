import { AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  accessToken as _accessToken,
  authorize as _authorize,
  clientCredentialsGrant as _clientCredentialsGrant,
  deviceAuthorizationRequest as _deviceAuthorizationRequest,
  getTokenInfo as _getTokenInfo,
  DeviceAuthorizationResponseType,
  TokenInfoResponseType,
  type AccessTokenResponseType,
} from '../api/OAuth2OIDCApi';
import { State } from '../shared/State';
import { mergeDeep } from '../utils/JsonUtils';
import { type LoginInfo } from './AccessProfileOps';
import { FrodoError } from './FrodoError';

export type AccessTokenMetaType = AccessTokenResponseType & {
  expires: number;
  from_cache?: boolean;
  // Captured via a one-time getTokenInfo() call at fresh interactive-login
  // time only (see AuthenticateOps.ts's getTokensInteractive() cloud case)
  // — never on a cache-hit resume or token refresh, so this never adds a
  // network call to either of those paths. Optional: only present for
  // cloud browser-login entries where the opportunistic call succeeded.
  tokenInfo?: {
    sub?: string;
    tokenName?: string;
    realm?: string;
    auditTrackingId?: string;
  };
  // Captured the same way and at the same time as tokenInfo above (fresh
  // browser login only, never a resume or refresh) — the logged-in
  // identity's own AM-native privilege markers, via
  // CallerTrustTierOps.ts's lookupCallerPrivilegeGroups(). ForgeOps/classic
  // populate `roles`, cloud populates `isMemberOf`; never both. Lets
  // `frodo session describe` show the admin role alongside the granted
  // scope — together, the full privilege picture a scope-only view misses.
  roles?: string[];
  isMemberOf?: string[];
  // What the library remembers of how this token was obtained (the kind of
  // login, the scope it requested, the adaptations it made). Set at fresh
  // interactive-login time and carried over on refresh; stored with the
  // token in the session cache. Optional: a token without it (an entry of an
  // earlier version, or a token from elsewhere) is an interactive login of
  // unknown kind. See ops/AccessProfileOps.ts.
  login?: LoginInfo;
};

export type OAuth2Oidc = {
  /**
   * Send an authorization request to the OAuth2 authorize endpoint
   * @param {string} amBaseUrl access management base URL
   * @param {string} data body form data
   * @param {AxiosRequestConfig} config axios request config object
   * @returns {Promise<AxiosResponse<any, any>>} a promise resolving to the response of the authorization server
   */
  authorize(
    amBaseUrl: string,
    data: string,
    config: AxiosRequestConfig
  ): Promise<AxiosResponse<any, any>>;
  /**
   * Request an access token from the OAuth2 access token endpoint
   * @param {string} amBaseUrl access management base URL
   * @param {any} data body form data
   * @param {AxiosRequestConfig} config axios request config object
   * @returns {Promise<AccessTokenMetaType>} a promise resolving to the access token response, with the time at which the token expires
   */
  accessToken(
    amBaseUrl: string,
    data: any,
    config: AxiosRequestConfig
  ): Promise<AccessTokenMetaType>;
  /**
   * Request an access token with an RFC 7523 JWT-bearer authorization grant
   * @param {string} clientId client id of the OAuth2 client
   * @param {string} jwt signed JWT assertion
   * @param {string[]} scope scopes to request
   * @param {AxiosRequestConfig} config optional axios request config object
   * @returns {Promise<AccessTokenMetaType>} a promise resolving to the access token response, with the time at which the token expires
   */
  accessTokenRfc7523AuthZGrant(
    clientId: string,
    jwt: string,
    scope: string[],
    config?: AxiosRequestConfig
  ): Promise<AccessTokenMetaType>;
  /**
   * Get token information from the OAuth2 token info endpoint. The request is a GET that carries the credential of the current session; the request config can add or override headers.
   * @param {string} amBaseUrl access management base URL
   * @param {AxiosRequestConfig} config axios request config object
   * @returns {Promise<TokenInfoResponseType>} a promise resolving to the token information
   */
  getTokenInfo(
    amBaseUrl: string,
    config: AxiosRequestConfig
  ): Promise<TokenInfoResponseType>;
  /**
   * Start an OAuth2 device authorization (RFC 8628)
   * @param {string} amBaseUrl access management base URL
   * @param {string} data body form data
   * @param {AxiosRequestConfig} config axios request config object
   * @returns {Promise<DeviceAuthorizationResponseType>} a promise resolving to the device code and user code pair
   */
  deviceAuthorizationRequest(
    amBaseUrl: string,
    data: string,
    config: AxiosRequestConfig
  ): Promise<DeviceAuthorizationResponseType>;
  /**
   * Request an access token with the client credentials grant
   * @param {string} amBaseUrl access management base URL
   * @param {string} clientId client id
   * @param {string} clientSecret client secret
   * @param {string} scope space-delimited scope list
   * @returns {Promise<AccessTokenMetaType>} a promise resolving to the access token response, with the time at which the token expires
   */
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
    async deviceAuthorizationRequest(
      amBaseUrl: string,
      data: string,
      config: AxiosRequestConfig
    ): Promise<DeviceAuthorizationResponseType> {
      return deviceAuthorizationRequest({ amBaseUrl, data, config, state });
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
    return await _authorize({ amBaseUrl, data, config, state });
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

/**
 * Set the content type of a form post on the headers of a request config. The headers may be an AxiosHeaders instance
 * (or any object with a set method): a merge would replace such an instance by the plain headers it merges into, and
 * with it every header the caller put there, so the content type is set through the set method of the instance.
 * @param {AxiosRequestConfig} config request config of the caller, changed and returned
 * @returns {AxiosRequestConfig} the config with the content type of a form post
 */
function setFormContentType(config: AxiosRequestConfig): AxiosRequestConfig {
  const contentType = 'application/x-www-form-urlencoded';
  const headers: any = config.headers;
  if (headers && typeof headers.set === 'function') {
    headers.set('content-type', contentType);
    return config;
  }
  return mergeDeep(config, { headers: { 'content-type': contentType } });
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
    config = setFormContentType(config);
    const data = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
      scope: scope.join(' '),
      client_id: clientId,
    }).toString();
    return await accessToken({
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

export async function deviceAuthorizationRequest({
  amBaseUrl,
  data,
  config,
  state,
}: {
  amBaseUrl: string;
  data: string;
  config: AxiosRequestConfig;
  state: State;
}): Promise<DeviceAuthorizationResponseType> {
  try {
    return await _deviceAuthorizationRequest({
      amBaseUrl,
      data,
      config,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error starting oauth2 device authorization`, error);
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
    return await _getTokenInfo({ amBaseUrl, config, state });
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
    response['expires'] = Date.now() + response.expires_in * 1000;
    return response as AccessTokenMetaType;
  } catch (error) {
    throw new FrodoError(
      `Error getting access token using client credentials grant`,
      error
    );
  }
}
