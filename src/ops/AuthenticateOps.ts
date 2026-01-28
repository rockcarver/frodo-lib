import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { createHash, randomBytes } from 'crypto';
import jose from 'node-jose';
import sshpk from 'sshpk';
import url from 'url';
import { v4 } from 'uuid';

import {
  AuthenticateStep,
  AuthenticateSuccessResponse,
  step,
} from '../api/AuthenticateApi';
import { getServerInfo, getServerVersionInfo } from '../api/ServerInfoApi';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { encodeBase64Url } from '../utils/Base64Utils';
import { debugMessage, verboseMessage } from '../utils/Console';
import { isValidUrl, parseUrl } from '../utils/ExportImportUtils';
import {
  CallbackHandler,
  fillCallbacks,
  getCallbackValue,
} from './CallbackOps';
import { readServiceAccountScopes } from './cloud/EnvServiceAccountScopesOps';
import {
  getServiceAccount,
  SERVICE_ACCOUNT_DEFAULT_SCOPES,
} from './cloud/ServiceAccountOps';
import {
  getConnectionProfile,
  loadConnectionProfile,
  saveConnectionProfile,
} from './ConnectionProfileOps';
import { FrodoError } from './FrodoError';
import { createSignedJwtToken, JwkRsa } from './JoseOps';
import {
  accessToken,
  type AccessTokenMetaType,
  authorize,
} from './OAuth2OidcOps';
import { getSessionInfo } from './SessionOps';
import {
  hasSaBearerToken,
  hasUserBearerToken,
  hasUserSessionToken,
  readSaBearerToken,
  readUserBearerToken,
  readUserSessionToken,
  saveSaBearerToken,
  saveUserBearerToken,
  saveUserSessionToken,
} from './TokenCacheOps';

export type Authenticate = {
  /**
   * Get tokens and store them in State
   * @param {boolean} forceLoginAsUser true to force login as user even if a service account or Amster account is available (default: false)
   * @param {boolean} autoRefresh true to automatically refresh tokens before they expire (default: true)
   * @param {string[]} types Array of supported deployment types. The function will throw an error if an unsupported type is detected (default: ['classic', 'cloud', 'forgeops'])
   * @param {CallbackHandler} callbackHandler function allowing the library to collect responses from the user through callbacks
   * @returns {Promise<Tokens>} object containing the tokens
   */
  getTokens(
    forceLoginAsUser?: boolean,
    autoRefresh?: boolean,
    types?: string[],
    callbackHandler?: CallbackHandler
  ): Promise<Tokens>;

  // Deprecated
  /**
   * Get access token for service account
   * @param {string} saId optional service account id
   * @param {JwkRsa} saJwk optional service account JWK
   * @returns {string | null} Access token or null
   * @deprecated since v2.0.0 use {@link Authenticate.getTokens | getTokens} instead
   * ```javascript
   * getTokens(): Promise<boolean>
   * ```
   * @group Deprecated
   */
  getAccessTokenForServiceAccount(
    saId?: string,
    saJwk?: JwkRsa
  ): Promise<string | null>;
};

export default (state: State): Authenticate => {
  return {
    async getTokens(
      forceLoginAsUser = false,
      autoRefresh = true,
      types = Constants.DEPLOYMENT_TYPES,
      callbackHandler = null
    ) {
      return getTokens({
        forceLoginAsUser,
        autoRefresh,
        types,
        callbackHandler,
        state,
      });
    },

    // Deprecated
    async getAccessTokenForServiceAccount(
      saId: string = undefined,
      saJwk: JwkRsa = undefined
    ): Promise<string | null> {
      const { access_token } = await getFreshSaBearerToken({
        saId,
        saJwk,
        state,
      });
      return access_token;
    },
  };
};

const adminClientPassword = 'doesnotmatter';
const redirectUrlTemplate = '/platform/appAuthHelperRedirect.html';

const s = Constants.AVAILABLE_SCOPES;
const CLOUD_ADMIN_MINIMAL_SCOPES: string[] = [
  s.AnalyticsFullScope,
  s.CertificateFullScope,
  s.ContentSecurityPolicyFullScope,
  s.CookieDomainsFullScope,
  s.CustomDomainFullScope,
  s.ESVFullScope,
  s.AdminFederationFullScope,
  s.IdmFullScope,
  s.OpenIdScope,
  s.PromotionScope,
  s.ReleaseFullScope,
  s.SSOCookieFullScope,
];
const CLOUD_ADMIN_DEFAULT_SCOPES: string[] = [
  s.AnalyticsFullScope,
  s.AutoAccessFullScope,
  s.CertificateFullScope,
  s.ContentSecurityPolicyFullScope,
  s.CookieDomainsFullScope,
  s.CustomDomainFullScope,
  s.ESVFullScope,
  s.AdminFederationFullScope,
  s.IdmFullScope,
  s.IGAFullScope,
  s.OpenIdScope,
  s.PromotionScope,
  s.ReleaseFullScope,
  s.SSOCookieFullScope,
  s.ProxyConnectFullScope,
];
const FORGEOPS_ADMIN_DEFAULT_SCOPES: string[] = [s.IdmFullScope, s.OpenIdScope];
const forgeopsAdminScopes = FORGEOPS_ADMIN_DEFAULT_SCOPES.join(' ');
const serviceAccountDefaultScopes = SERVICE_ACCOUNT_DEFAULT_SCOPES.join(' ');

const fidcClientId = 'idmAdminClient';
const forgeopsClientId = 'idm-admin-ui';

export type UserSessionMetaType = AuthenticateSuccessResponse & {
  expires: number;
  from_cache?: boolean;
};
type StepHandler = (step: AuthenticateStep) => Promise<AuthenticateStep>;
type MFAResult = {
  factor: string;
  supported: boolean;
};

let adminClientId = fidcClientId;

/**
 * Helper function to get cookie name
 * @param {State} state library state
 * @returns {string} cookie name
 */
async function determineCookieName(state: State): Promise<string> {
  const data = await getServerInfo({ state });
  debugMessage({
    message: `AuthenticateOps.determineCookieName: cookieName=${data.cookieName}`,
    state,
  });
  return data.cookieName;
}

/**
 * Helper function to determine if this is a setup mfa prompt in the ID Cloud tenant admin login journey
 * @param {AuthenticateStep} payload response from the previous authentication journey step
 * @param {State} state library state
 * @returns {MFAResult} an object indicating if 2fa is required
 */
function checkAndHandle2FA({
  payload,
  otpCallbackHandler,
  state,
}: {
  payload: AuthenticateStep;
  otpCallbackHandler: CallbackHandler;
  state: State;
}): MFAResult {
  debugMessage({ message: `AuthenticateOps.checkAndHandle2FA: start`, state });
  for (let callback of payload.callbacks) {
    // select localAuthentication if Admin Federation is enabled
    if (callback.type === 'SelectIdPCallback') {
      debugMessage({
        message: `AuthenticateOps.checkAndHandle2FA: Admin federation enabled. Allowed providers:`,
        state,
      });
      let localAuth = false;
      for (const value of callback.output[0].value) {
        debugMessage({ message: `${value.provider}`, state });
        if (value.provider === 'localAuthentication') {
          localAuth = true;
        }
      }
      if (localAuth) {
        debugMessage({ message: `local auth allowed`, state });
        callback.input[0].value = 'localAuthentication';
      } else {
        debugMessage({ message: `local auth NOT allowed`, state });
      }
    }
    if (callback.type === 'HiddenValueCallback') {
      if (callback.input[0].value.includes('skip')) {
        // skippable = true;
        callback.input[0].value = 'Skip';
        // debugMessage(
        //   `AuthenticateOps.checkAndHandle2FA: end [need2fa=true, skippable=true]`
        // );
        // return {
        //   factor: 'None',
        //   supported: true,
        // };
      }
      if (callback.input[0].value.includes('webAuthnOutcome')) {
        // webauthn!!!
        debugMessage({
          message: `AuthenticateOps.checkAndHandle2FA: end [need2fa=true, unsupported factor: webauthn]`,
          state,
        });
        return {
          factor: 'WebAuthN',
          supported: false,
        };
      }
    }
    if (callback.type === 'NameCallback') {
      if (callback.output[0].value.includes('code')) {
        // skippable = false;
        debugMessage({
          message: `AuthenticateOps.checkAndHandle2FA: need2fa=true, skippable=false`,
          state,
        });
        if (!otpCallbackHandler)
          throw new FrodoError(
            `2fa required but no otpCallback function provided.`
          );
        callback = otpCallbackHandler(callback);
        debugMessage({
          message: `AuthenticateOps.checkAndHandle2FA: end [need2fa=true, skippable=false, factor=Code]`,
          state,
        });
        return {
          factor: 'Code',
          supported: true,
        };
      } else {
        // answer callback
        callback.input[0].value = state.getUsername();
      }
    }
    if (callback.type === 'PasswordCallback') {
      // answer callback
      callback.input[0].value = state.getPassword();
    }
  }
  debugMessage({
    message: `AuthenticateOps.checkAndHandle2FA: end [need2fa=false]`,
    state,
  });
  // debugMessage(payload);
  return {
    factor: 'None',
    supported: true,
  };
}

/**
 * Helper function to set the default realm by deployment type
 * @param {State} state library state
 */
function determineDefaultRealm(state: State) {
  if (!state.getRealm() || state.getRealm() === Constants.DEFAULT_REALM_KEY) {
    state.setRealm(
      Constants.DEPLOYMENT_TYPE_REALM_MAP[state.getDeploymentType()]
    );
  }
}

/**
 * Helper function to determine the deployment type
 * @param {State} state library state
 * @returns {Promise<string>} deployment type
 */
async function determineDeploymentType(state: State): Promise<string> {
  debugMessage({
    message: `AuthenticateOps.determineDeploymentType: start`,
    state,
  });
  const cookieValue = state.getCookieValue();
  let deploymentType = state.getDeploymentType();

  switch (deploymentType) {
    case Constants.CLOUD_DEPLOYMENT_TYPE_KEY:
      adminClientId = state.getAdminClientId() || fidcClientId;
      debugMessage({
        message: `AuthenticateOps.determineDeploymentType: end [type=${deploymentType}]`,
        state,
      });
      return deploymentType;

    case Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY:
      adminClientId = state.getAdminClientId() || forgeopsClientId;
      debugMessage({
        message: `AuthenticateOps.determineDeploymentType: end [type=${deploymentType}]`,
        state,
      });
      return deploymentType;

    case Constants.CLASSIC_DEPLOYMENT_TYPE_KEY:
      debugMessage({
        message: `AuthenticateOps.determineDeploymentType: end [type=${deploymentType}]`,
        state,
      });
      return deploymentType;

    // detect deployment type
    default: {
      // if we are using a service account, we know it's cloud
      if (state.getUseBearerTokenForAmApis()) {
        debugMessage({
          message: `AuthenticateOps.determineDeploymentType: end [type=${Constants.CLOUD_DEPLOYMENT_TYPE_KEY}]`,
          state,
        });
        return Constants.CLOUD_DEPLOYMENT_TYPE_KEY;
      }

      const verifier = encodeBase64Url(randomBytes(32));
      const challenge = encodeBase64Url(
        createHash('sha256').update(verifier).digest()
      );
      const challengeMethod = 'S256';
      const redirectUri = url.resolve(state.getHost(), redirectUrlTemplate);

      const config = {
        maxRedirects: 0,
        headers: {
          [state.getCookieName()]: state.getCookieValue(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      };
      let bodyFormData = `redirect_uri=${redirectUri}&scope=${s.OpenIdScope}&response_type=code&client_id=${fidcClientId}&csrf=${cookieValue}&decision=allow&code_challenge=${challenge}&code_challenge_method=${challengeMethod}`;

      deploymentType = Constants.CLASSIC_DEPLOYMENT_TYPE_KEY;
      try {
        await authorize({
          amBaseUrl: state.getHost(),
          data: bodyFormData,
          config,
          state,
        });
      } catch (e) {
        // debugMessage(e.response);
        if (
          e.response?.status === 302 &&
          e.response.headers?.location?.indexOf('code=') > -1
        ) {
          verboseMessage({
            message: `ForgeRock Identity Cloud`['brightCyan'] + ` detected.`,
            state,
          });
          deploymentType = Constants.CLOUD_DEPLOYMENT_TYPE_KEY;
        } else {
          try {
            bodyFormData = `redirect_uri=${redirectUri}&scope=${s.OpenIdScope}&response_type=code&client_id=${forgeopsClientId}&csrf=${state.getCookieValue()}&decision=allow&code_challenge=${challenge}&code_challenge_method=${challengeMethod}`;
            await authorize({
              amBaseUrl: state.getHost(),
              data: bodyFormData,
              config,
              state,
            });
          } catch (ex) {
            if (
              ex.response?.status === 302 &&
              ex.response.headers?.location?.indexOf('code=') > -1
            ) {
              // maybe we don't want to run through the auto-detect code if we get a custom admin client id?
              adminClientId = state.getAdminClientId() || forgeopsClientId;
              verboseMessage({
                message: `ForgeOps deployment`['brightCyan'] + ` detected.`,
                state,
              });
              deploymentType = Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY;
            } else {
              verboseMessage({
                message: `Classic deployment`['brightCyan'] + ` detected.`,
                state,
              });
            }
          }
        }
      }
      debugMessage({
        message: `AuthenticateOps.determineDeploymentType: end [type=${deploymentType}]`,
        state,
      });
      return deploymentType;
    }
  }
}

/**
 * Helper function to extract the semantic version string from a version info object
 * @param {Object} versionInfo version info object
 * @returns {String} semantic version
 */
function getSemanticVersion(versionInfo) {
  if ('version' in versionInfo) {
    const versionString = versionInfo.version;
    const rx = /([\d]\.[\d]\.[\d](\.[\d])*)/g;
    const version = versionString.match(rx);
    return version[0];
  }
  throw new Error('Cannot extract semantic version from version info object.');
}

/**
 * Helper function to authenticate and obtain and store session cookie
 * @param {StepHandler} stepHandler function to handle any intermediate authentication step
 * @param {State} state library state
 * @returns {string} Session token or null
 */
async function getFreshUserSessionToken({
  stepHandler,
  state,
}: {
  stepHandler: StepHandler;
  state: State;
}): Promise<UserSessionMetaType> {
  debugMessage({
    message: `AuthenticateOps.getFreshUserSessionToken: start`,
    state,
  });
  // Username and password headers are only sent in the first request, assuming they both exist in the state
  const config: AxiosRequestConfig<object> = {};
  if (state.getUsername() && state.getPassword()) {
    config.headers = {
      'X-OpenAM-Username': state.getUsername(),
      'X-OpenAM-Password': state.getPassword(),
    };
  }
  try {
    let currentStep = null;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const response = await step({
        body: currentStep || {},
        config: currentStep ? {} : config,
        state,
      });
      // Handle success response
      if ('tokenId' in response) {
        // get session expiration
        const { maxIdleExpirationTime } = await getSessionInfo({
          tokenId: response.tokenId,
          state,
        });
        const expires = Date.parse(maxIdleExpirationTime);
        debugMessage({
          message: `AuthenticateOps.getFreshUserSessionToken: end [tokenId=${response.tokenId}]`,
          state,
        });
        debugMessage({
          message: response,
          state,
        });
        return {
          ...response,
          from_cache: false,
          expires,
        };
      }
      // Handle error response (error responses should be thrown and caught already, but just in case they aren't)
      if ('code' in response) {
        throw new AxiosError(
          response.message,
          response.code,
          undefined,
          undefined,
          { data: response } as AxiosResponse
        );
      }
      // Handle step response
      if (!stepHandler) {
        throw new FrodoError(
          `No step handler function provided for user authentication.`
        );
      }
      currentStep = await stepHandler(response);
    }
  } catch (e) {
    debugMessage({
      message: `AuthenticateOps.getFreshUserSessionToken: end [no session]`,
      state,
    });
    throw new FrodoError('Error authenticating user', e);
  }
}

/**
 * Helper function to obtain user session token
 * @param {StepHandler} stepHandler function to handle any intermediate authentication step
 * @param {State} state library state
 * @returns {Promise<UserSessionMetaType>} session token or null
 */
async function getUserSessionToken(
  stepHandler: StepHandler,
  state: State
): Promise<UserSessionMetaType> {
  debugMessage({
    message: `AuthenticateOps.getUserSessionToken: start`,
    state,
  });
  let token: UserSessionMetaType = null;
  if (state.getUseTokenCache() && (await hasUserSessionToken({ state }))) {
    try {
      token = await readUserSessionToken({ state });
      token.from_cache = true;
      debugMessage({
        message: `AuthenticateOps.getUserSessionToken: cached`,
        state,
      });
    } catch (error) {
      debugMessage({
        message: `AuthenticateOps.getUserSessionToken: failed cache read`,
        state,
      });
    }
  }
  if (!token) {
    token = await getFreshUserSessionToken({
      stepHandler,
      state,
    });
    token.from_cache = false;
    debugMessage({
      message: `AuthenticateOps.getUserSessionToken: fresh`,
      state,
    });
  }
  if (state.getUseTokenCache()) {
    await saveUserSessionToken({ token, state });
  }
  debugMessage({
    message: `AuthenticateOps.getUserSessionToken: end`,
    state,
  });
  return token;
}

async function getAdminUserScopes({ state }: { state: State }) {
  debugMessage({
    message: `AuthenticateOps.getAdminUserScopes: start`,
    state,
  });
  if (state.getDeploymentType() === Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY) {
    debugMessage({
      message: `AuthenticateOps.getAdminUserScopes: end with forgeops scopes ${forgeopsAdminScopes}`,
      state,
    });
    return forgeopsAdminScopes;
  } else if (
    state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY
  ) {
    try {
      const availableScopes = (await readServiceAccountScopes({
        flatten: true,
        state,
      })) as string[];
      availableScopes.push(s.OpenIdScope);
      const cloudAdminScopes = CLOUD_ADMIN_DEFAULT_SCOPES.filter((scope) =>
        availableScopes.includes(scope)
      );
      debugMessage({
        message: `AuthenticateOps.getAdminUserScopes: end with cloud scopes ${cloudAdminScopes.join(' ')}`,
        state,
      });
      return cloudAdminScopes.join(' ');
    } catch (error) {
      debugMessage({
        message: `AuthenticateOps.getAdminUserScopes: end with minimal cloud scopes ${CLOUD_ADMIN_MINIMAL_SCOPES.join(' ')}`,
        state,
      });
      return CLOUD_ADMIN_MINIMAL_SCOPES.join(' ');
    }
  }
  debugMessage({
    message: `AuthenticateOps.getAdminUserScopes: end without scopes: Unsupported deployment type: ${state.getDeploymentType()}, expected ${Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY} or ${Constants.CLOUD_DEPLOYMENT_TYPE_KEY}`,
    state,
  });
  throw new FrodoError(
    `Unsupported deployment type: ${state.getDeploymentType()}, expected ${Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY} or ${Constants.CLOUD_DEPLOYMENT_TYPE_KEY}`
  );
}

/**
 * Helper function to obtain an oauth2 authorization code
 * @param {string} redirectUri oauth2 redirect uri
 * @param {string} codeChallenge PKCE code challenge
 * @param {string} codeChallengeMethod PKCE code challenge method
 * @param {State} state library state
 * @returns {string} oauth2 authorization code or null
 */
async function getAuthCode(
  redirectUri: string,
  codeChallenge: string,
  codeChallengeMethod: string,
  state: State
): Promise<string> {
  debugMessage({
    message: `AuthenticateOps.getAuthCode: start`,
    state,
  });
  try {
    const bodyFormData = `redirect_uri=${redirectUri}&scope=${await getAdminUserScopes(
      { state }
    )}&response_type=code&client_id=${adminClientId}&csrf=${state.getCookieValue()}&decision=allow&code_challenge=${codeChallenge}&code_challenge_method=${codeChallengeMethod}`;
    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      maxRedirects: 0,
    };
    let response = undefined;
    try {
      response = await authorize({
        amBaseUrl: state.getHost(),
        data: bodyFormData,
        config,
        state,
      });
    } catch (error) {
      response = error.response;
      if (response.status < 200 || response.status > 399) {
        throw error;
      }
    }
    const redirectLocationURL = response.headers?.location;
    const queryObject = url.parse(redirectLocationURL, true).query;
    if ('code' in queryObject) {
      debugMessage({
        message: `AuthenticateOps.getAuthCode: end with code`,
        state,
      });
      return queryObject.code as string;
    }
    debugMessage({
      message: `AuthenticateOps.getAuthCode: end without code`,
      state,
    });
    throw new FrodoError(`Authz code not found`);
  } catch (error) {
    debugMessage({
      message: `AuthenticateOps.getAuthCode: end without code`,
      state,
    });
    throw new FrodoError(`Error getting authz code`, error);
  }
}

/**
 * Helper function to obtain oauth2 access token
 * @param {State} state library state
 * @returns {Promise<AccessTokenMetaType>} access token or null
 */
async function getFreshUserBearerToken({
  state,
}: {
  state: State;
}): Promise<AccessTokenMetaType> {
  debugMessage({
    message: `AuthenticateOps.getAccessTokenForUser: start`,
    state,
  });
  try {
    const verifier = encodeBase64Url(randomBytes(32));
    const challenge = encodeBase64Url(
      createHash('sha256').update(verifier).digest()
    );
    const challengeMethod = 'S256';
    const redirectUri = url.resolve(
      state.getHost(),
      state.getAdminClientRedirectUri() || redirectUrlTemplate
    );
    const authCode = await getAuthCode(
      redirectUri,
      challenge,
      challengeMethod,
      state
    );
    let response: AccessTokenMetaType = null;
    if (state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY) {
      const config = {
        auth: {
          username: adminClientId,
          password: adminClientPassword,
        },
      };
      const bodyFormData = `redirect_uri=${redirectUri}&grant_type=authorization_code&code=${authCode}&code_verifier=${verifier}`;
      response = await accessToken({
        amBaseUrl: state.getHost(),
        data: bodyFormData,
        config,
        state,
      });
    } else {
      const bodyFormData = `client_id=${adminClientId}&redirect_uri=${redirectUri}&grant_type=authorization_code&code=${authCode}&code_verifier=${verifier}`;
      response = await accessToken({
        amBaseUrl: state.getHost(),
        data: bodyFormData,
        config: {},
        state,
      });
    }
    if ('access_token' in response) {
      debugMessage({
        message: `AuthenticateOps.getAccessTokenForUser: end with token`,
        state,
      });
      return response;
    }
    throw new FrodoError(`No access token in response`);
  } catch (error) {
    throw new FrodoError(`Error getting access token for user`, error);
  }
}

/**
 * Helper function to obtain oauth2 access token
 * @param {State} state library state
 * @returns {Promise<AccessTokenMetaType>} access token or null
 */
async function getUserBearerToken(state: State): Promise<AccessTokenMetaType> {
  debugMessage({
    message: `AuthenticateOps.getUserBearerToken: start`,
    state,
  });
  let token: AccessTokenMetaType = null;
  if (state.getUseTokenCache() && (await hasUserBearerToken({ state }))) {
    try {
      token = await readUserBearerToken({ state });
      token.from_cache = true;
      debugMessage({
        message: `AuthenticateOps.getUserBearerToken: end [cached]`,
        state,
      });
    } catch (error) {
      debugMessage({
        message: `AuthenticateOps.getUserBearerToken: end [failed cache read]`,
        state,
      });
    }
  }
  if (!token) {
    token = await getFreshUserBearerToken({ state });
    token.from_cache = false;
    debugMessage({
      message: `AuthenticateOps.getUserBearerToken: end [fresh]`,
      state,
    });
  }
  if (state.getUseTokenCache()) {
    await saveUserBearerToken({ token, state });
  }
  return token;
}

function createPayload(serviceAccountId: string, host: string) {
  const u = parseUrl(host);
  const aud = `${u.origin}:${
    u.port ? u.port : u.protocol === 'https' ? '443' : '80'
  }${u.pathname}/oauth2/access_token`;

  // Cross platform way of setting JWT expiry time 3 minutes in the future, expressed as number of seconds since EPOCH
  const exp = Math.floor(new Date().getTime() / 1000 + 180);

  // A unique ID for the JWT which is required when requesting the openid scope
  const jti = v4();

  const iss = serviceAccountId;
  const sub = serviceAccountId;

  // Create the payload for our bearer token
  const payload = { iss, sub, aud, exp, jti };

  return payload;
}

/**
 * Get fresh access token for service account
 * @param {State} state library state
 * @returns {Promise<AccessTokenResponseType>} response object containg token, scope, type, and expiration in seconds
 */
export async function getFreshSaBearerToken({
  saId = undefined,
  saJwk = undefined,
  state,
}: {
  saId?: string;
  saJwk?: JwkRsa;
  state: State;
}): Promise<AccessTokenMetaType> {
  debugMessage({
    message: `AuthenticateOps.getFreshSaBearerToken: start`,
    state,
  });
  saId = saId ? saId : state.getServiceAccountId();
  saJwk = saJwk ? saJwk : state.getServiceAccountJwk();
  const payload = createPayload(saId, state.getHost());
  const jwt = await createSignedJwtToken(payload, saJwk);
  const scope = state.getServiceAccountScope() || serviceAccountDefaultScopes;
  const bodyFormData = `assertion=${jwt}&client_id=service-account&grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&scope=${scope}`;
  let response: AccessTokenMetaType;
  try {
    response = await accessToken({
      amBaseUrl: state.getHost(),
      data: bodyFormData,
      config: {},
      state,
    });
  } catch (error) {
    const err: FrodoError = error as FrodoError;
    if (
      err.isHttpError &&
      err.httpErrorText === 'invalid_scope' &&
      err.httpDescription?.startsWith('Unsupported scope for service account: ')
    ) {
      const invalidScopes: string[] = err.httpDescription
        .substring(39)
        .split(',');
      const finalScopes: string[] = scope.split(' ').filter((el) => {
        return !invalidScopes.includes(el);
      });
      const bodyFormData = `assertion=${jwt}&client_id=service-account&grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&scope=${finalScopes.join(
        ' '
      )}`;
      response = await accessToken({
        amBaseUrl: state.getHost(),
        data: bodyFormData,
        config: {},
        state,
      });
    }
  }
  if ('access_token' in response) {
    debugMessage({
      message: `AuthenticateOps.getFreshSaBearerToken: end`,
      state,
    });
    return response;
  }
  debugMessage({
    message: `AuthenticateOps.getFreshSaBearerToken: end [No access token in response]`,
    state,
  });
  return null;
}

/**
 * Get cached or fresh access token for service account
 * @param {State} state library state
 * @returns {Promise<AccessTokenResponseType>} response object containg token, scope, type, and expiration in seconds
 */
export async function getSaBearerToken({
  state,
}: {
  state: State;
}): Promise<AccessTokenMetaType> {
  try {
    debugMessage({
      message: `AuthenticateOps.getSaBearerToken: start`,
      state,
    });
    let token: AccessTokenMetaType = null;
    if (state.getUseTokenCache() && (await hasSaBearerToken({ state }))) {
      try {
        token = await readSaBearerToken({ state });
        token.from_cache = true;
        debugMessage({
          message: `AuthenticateOps.getSaBearerToken: end [cached]`,
          state,
        });
      } catch (error) {
        debugMessage({
          message: `AuthenticateOps.getSaBearerToken: end [failed cache read]`,
          state,
        });
      }
    }
    if (!token) {
      token = await getFreshSaBearerToken({ state });
      token.from_cache = false;
      debugMessage({
        message: `AuthenticateOps.getSaBearerToken: end [fresh]`,
        state,
      });
    }
    if (state.getUseTokenCache()) {
      await saveSaBearerToken({ token, state });
    }
    return token;
  } catch (error) {
    throw new FrodoError(
      `Error getting access token for service account`,
      error
    );
  }
}

/**
 * Helper function to determine deployment type, default realm, and version and update library state
 * @param state library state
 */
async function determineDeploymentTypeAndDefaultRealmAndVersion(
  state: State
): Promise<void> {
  debugMessage({
    message: `AuthenticateOps.determineDeploymentTypeAndDefaultRealmAndVersion: start`,
    state,
  });
  state.setDeploymentType(await determineDeploymentType(state));
  determineDefaultRealm(state);
  debugMessage({
    message: `AuthenticateOps.determineDeploymentTypeAndDefaultRealmAndVersion: realm=${state.getRealm()}, type=${state.getDeploymentType()}`,
    state,
  });

  const versionInfo = await getServerVersionInfo({ state });

  // https://github.com/rockcarver/frodo-cli/issues/109
  debugMessage({ message: `Full version: ${versionInfo.fullVersion}`, state });

  const version = await getSemanticVersion(versionInfo);
  state.setAmVersion(version);
  debugMessage({
    message: `AuthenticateOps.determineDeploymentTypeAndDefaultRealmAndVersion: end`,
    state,
  });
}

/**
 * Get logged-in subject
 * @param {State} state library state
 * @returns {string} a string identifying subject type and id
 */
async function getLoggedInSubject(state: State): Promise<string> {
  let subjectString = `user ${state.getUsername()}`;
  if (state.getUseBearerTokenForAmApis()) {
    try {
      const name = (
        await getServiceAccount({
          serviceAccountId: state.getServiceAccountId(),
          state,
        })
      ).name;
      subjectString = `service account ${name} [${state.getServiceAccountId()}]`;
    } catch (error) {
      subjectString = `service account ${state.getServiceAccountId()}`;
    }
  }
  return subjectString;
}

/**
 * Helper method to set, reset, or cancel timer to auto refresh tokens
 * @param {boolean} forceLoginAsUser true to force login as user even if a service account or Amster account is available (default: false)
 * @param {boolean} autoRefresh true to automatically refresh tokens before they expire (default: true)
 * @param {State} state library state
 */
function scheduleAutoRefresh(
  forceLoginAsUser: boolean,
  autoRefresh: boolean,
  state: State
) {
  let timer = state.getAutoRefreshTimer();
  // clear existing timer
  if (timer) {
    debugMessage({
      message: `AuthenticateOps.scheduleAutoRefresh: cancel existing timer`,
      state,
    });
    clearTimeout(timer);
  }
  // new timer
  if (autoRefresh) {
    const expires =
      state.getDeploymentType() === Constants.CLASSIC_DEPLOYMENT_TYPE_KEY
        ? state.getUserSessionTokenMeta()?.expires
        : state.getUseBearerTokenForAmApis()
          ? state.getBearerTokenMeta()?.expires
          : Math.min(
              state.getBearerTokenMeta()?.expires,
              state.getUserSessionTokenMeta()?.expires
            );
    let timeout = expires - Date.now() - 1000 * 25;
    if (timeout < 1000 * 30) {
      debugMessage({
        message: `Timeout below threshold of 30 seconds (${Math.ceil(
          timeout / 1000
        )}), resetting timeout to 10ms.`,
        state,
      });
      if (timeout < 10) timeout = 10;
    }
    debugMessage({
      message: `AuthenticateOps.scheduleAutoRefresh: set new timer [${Math.floor(
        timeout / 1000
      )}s (${new Date(timeout).getMinutes()}m ${new Date(
        timeout
      ).getSeconds()}s)]`,
      state,
    });
    timer = setTimeout(getTokens, timeout, {
      forceLoginAsUser,
      autoRefresh,
      state,
      // Volker's Visual Studio Code doesn't want to have it any other way.
    }) as unknown as NodeJS.Timeout;
    state.setAutoRefreshTimer(timer);
    timer.unref();
  }
}

/**
 * Helper to authenticate a user
 * @param usingConnectionProfile True if using connection profiles
 * @param {string[]} types Array of supported deployment types. The function will throw an error if an unsupported type is detected (default: ['classic', 'cloud', 'forgeops'])
 * @param stepHandler function to handle any authentication steps
 * @param state library state
 */
async function authenticateUser(
  usingConnectionProfile: boolean,
  types: string[],
  stepHandler: StepHandler,
  state: State
) {
  const token = await getUserSessionToken(stepHandler, state);
  if (token) state.setUserSessionTokenMeta(token);
  if (usingConnectionProfile && !token.from_cache) {
    saveConnectionProfile({ host: state.getHost(), state });
  }
  await determineDeploymentTypeAndDefaultRealmAndVersion(state);

  // fail if deployment type not applicable
  if (state.getDeploymentType() && !types.includes(state.getDeploymentType())) {
    throw new FrodoError(
      `Unsupported deployment type '${state.getDeploymentType()}'`
    );
  }

  if (
    state.getCookieValue() &&
    // !state.getBearerToken() &&
    (state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY ||
      state.getDeploymentType() === Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY)
  ) {
    const accessToken = await getUserBearerToken(state);
    if (accessToken) state.setBearerTokenMeta(accessToken);
  }
}

export type Tokens = {
  bearerToken?: AccessTokenMetaType;
  userSessionToken?: UserSessionMetaType;
  subject?: string;
  host?: string;
  realm?: string;
};

/**
 * Get tokens
 * @param {boolean} forceLoginAsUser true to force login as user even if a service account or Amster account is available (default: false)
 * @param {boolean} autoRefresh true to automatically refresh tokens before they expire (default: true)
 * @param {string[]} types Array of supported deployment types. The function will throw an error if an unsupported type is detected (default: ['classic', 'cloud', 'forgeops'])
 * @param {CallbackHandler} callbackHandler function allowing the library to collect responses from the user through callbacks
 * @param {State} state library state
 * @returns {Promise<Tokens>} object containing the tokens
 */
export async function getTokens({
  forceLoginAsUser = process.env.FRODO_FORCE_LOGIN_AS_USER ? true : false,
  autoRefresh = true,
  types = Constants.DEPLOYMENT_TYPES,
  callbackHandler = null,
  state,
}: {
  forceLoginAsUser?: boolean;
  autoRefresh?: boolean;
  types?: string[];
  callbackHandler?: CallbackHandler;
  state: State;
}): Promise<Tokens> {
  debugMessage({
    message: `AuthenticateOps.getTokens: start, types: ${types}`,
    state,
  });
  if (!state.getHost()) {
    throw new FrodoError(`No host specified`);
  }
  let usingConnectionProfile: boolean = false;
  try {
    // if username/password on cli are empty, try to read from connections.json
    if (
      state.getUsername() == null &&
      state.getPassword() == null &&
      !state.getServiceAccountId() &&
      !state.getServiceAccountJwk() &&
      !state.getAmsterPrivateKey()
    ) {
      usingConnectionProfile = await loadConnectionProfile({ state });

      // fail fast if deployment type not applicable
      if (
        state.getDeploymentType() &&
        !types.includes(state.getDeploymentType())
      ) {
        throw new FrodoError(
          `Unsupported deployment type '${state.getDeploymentType()}'`
        );
      }
    }

    // if host is not a valid URL, try to locate a valid URL and deployment type from connections.json
    if (!isValidUrl(state.getHost())) {
      const conn = await getConnectionProfile({ state });
      state.setHost(conn.tenant);
      state.setAllowInsecureConnection(conn.allowInsecureConnection);
      state.setDeploymentType(conn.deploymentType);

      // fail fast if deployment type not applicable
      if (
        state.getDeploymentType() &&
        !types.includes(state.getDeploymentType())
      ) {
        throw new FrodoError(
          `Unsupported deployment type '${state.getDeploymentType()}'`
        );
      }
    }

    // now that we have the full tenant URL we can lookup the cookie name
    state.setCookieName(await determineCookieName(state));

    // use service account to login?
    if (
      !forceLoginAsUser &&
      (state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY ||
        state.getDeploymentType() === undefined) &&
      state.getServiceAccountId() &&
      state.getServiceAccountJwk()
    ) {
      debugMessage({
        message: `AuthenticateOps.getTokens: Authenticating with service account ${state.getServiceAccountId()}`,
        state,
      });
      try {
        const token = await getSaBearerToken({ state });
        if (token) state.setBearerTokenMeta(token);
        if (usingConnectionProfile && !token.from_cache) {
          saveConnectionProfile({ host: state.getHost(), state });
        }
        state.setUseBearerTokenForAmApis(true);
        await determineDeploymentTypeAndDefaultRealmAndVersion(state);

        // fail if deployment type not applicable
        if (
          state.getDeploymentType() &&
          !types.includes(state.getDeploymentType())
        ) {
          throw new FrodoError(
            `Unsupported deployment type: '${state.getDeploymentType()}' not in ${types}`
          );
        }
      } catch (saErr) {
        throw new FrodoError(`Service account login error`, saErr);
      }
    }
    // use Amster credentials to login?
    else if (
      !forceLoginAsUser &&
      (state.getDeploymentType() === Constants.CLASSIC_DEPLOYMENT_TYPE_KEY ||
        state.getDeploymentType() === undefined) &&
      state.getAmsterPrivateKey()
    ) {
      if (!state.getAuthenticationService()) {
        state.setAuthenticationService(Constants.DEFAULT_AMSTER_SERVICE);
      }
      if (!state.getUsername()) {
        state.setUsername(Constants.DEFAULT_CLASSIC_USERNAME);
      }
      debugMessage({
        message: `AuthenticateOps.getTokens: Authenticating with Amster credentials using the ${state.getAuthenticationService()} authentication service`,
        state,
      });
      await authenticateUser(
        usingConnectionProfile,
        types,
        async (currentStep: AuthenticateStep) => {
          if (currentStep.callbacks.length !== 1) {
            throw new FrodoError(
              `Expected a single HiddenValueCallback for Amster authentication, but got ${currentStep.callbacks.length} callbacks`
            );
          }
          const callback = currentStep.callbacks[0];
          if (callback.type !== 'HiddenValueCallback') {
            throw new FrodoError(
              `Expected a single HiddenValueCallback for Amster authentication, but got a ${callback.type}`
            );
          }
          const key = await jose.JWK.asKey(state.getAmsterPrivateKey(), 'pem');
          const payload = {
            sub: state.getUsername(),
            nonce: getCallbackValue('value', callback.output),
          };
          const header = {
            typ: 'jwt',
            kid: sshpk
              .parsePrivateKey(state.getAmsterPrivateKey())
              .toPublic()
              .toString('ssh')
              .split(' ')[1],
          };
          const jwt = await createSignedJwtToken(payload, key, header);
          return fillCallbacks({
            step: currentStep,
            map: {
              IDToken1: jwt.toString(),
            },
          });
        },
        state
      );
    }
    // use user account to login?
    else if (state.getUsername() && state.getPassword()) {
      debugMessage({
        message: `AuthenticateOps.getTokens: Authenticating with user account ${state.getUsername()}`,
        state,
      });
      const maxSteps = 3;
      let steps = 0;
      await authenticateUser(
        usingConnectionProfile,
        types,
        async (currentStep: AuthenticateStep) => {
          // if max steps is reached, throw an error
          if (++steps > maxSteps) {
            throw new FrodoError('Too many 2FA attempts');
          }
          const skip2FA = checkAndHandle2FA({
            payload: currentStep,
            otpCallbackHandler: callbackHandler,
            state,
          });

          // throw exception if 2fa required but factor not supported by frodo (e.g. WebAuthN)
          if (!skip2FA.supported) {
            throw new Error(`Unsupported 2FA factor: ${skip2FA.factor}`);
          }
          return currentStep;
        },
        state
      );
    }
    // incomplete or no credentials
    else {
      throw new FrodoError(`Incomplete or no credentials`);
    }
    if (
      state.getCookieValue() ||
      (state.getUseBearerTokenForAmApis() && state.getBearerToken())
    ) {
      if (state.getBearerTokenMeta()?.from_cache) {
        verboseMessage({ message: `Using cached bearer token.`, state });
      }
      if (
        !state.getUseBearerTokenForAmApis() &&
        state.getUserSessionTokenMeta()?.from_cache
      ) {
        verboseMessage({ message: `Using cached session token.`, state });
      }
      scheduleAutoRefresh(forceLoginAsUser, autoRefresh, state);
      const tokens: Tokens = {
        bearerToken: state.getBearerTokenMeta(),
        userSessionToken: state.getUserSessionTokenMeta(),
        subject: await getLoggedInSubject(state),
        host: state.getHost(),
        realm: state.getRealm() ? state.getRealm() : 'root',
      };
      debugMessage({
        message: `AuthenticateOps.getTokens: end with tokens`,
        state,
      });
      return tokens;
    }
  } catch (error) {
    throw new FrodoError(`Error getting tokens`, error);
  }
}
