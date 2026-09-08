import { URL } from 'url';

import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import jose from 'node-jose';
import sshpk from 'sshpk';
import { v4 } from 'uuid';

import {
  AuthenticateStep,
  AuthenticateSuccessResponse,
  step,
} from '../api/AuthenticateApi';
import { getAuthenticationSettings } from '../api/AuthenticationSettingsApi';
import { ServiceAccountScope } from '../api/cloud/EnvServiceAccountScopesApi';
import { getServerInfo, getServerVersionInfo } from '../api/ServerInfoApi';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { theme } from '../utils/ColorTheme';
import { debugMessage, printMessage, verboseMessage } from '../utils/Console';
import { isValidUrl, parseUrl } from '../utils/ExportImportUtils';
import { decodeJwtPayload } from '../utils/JwtUtils';
import { createPkcePair } from '../utils/PkceUtils';
import {
  BrowserLoginPromptHandler,
  exchangeTokenForScope,
  refreshBrowserBearerToken,
  runInteractiveAuthorizationCodeFlow,
  startDeviceAuthorizationFlow,
} from './BrowserAuthenticateOps';
import {
  CallbackHandler,
  fillCallbacks,
  getCallbackValue,
} from './CallbackOps';
import {
  readServiceAccountScopes,
  flattenScopes,
} from './cloud/EnvServiceAccountScopesOps';
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
import { resolveIdentity } from './ManagedObjectOps';
import {
  accessToken,
  type AccessTokenMetaType,
  authorize,
  getTokenInfo,
} from './OAuth2OidcOps';
import { resolveAvailableScope } from './RequiredScopesOps';
import { getSessionInfo } from './SessionOps';
import {
  getRecordedSubject,
  hasToken,
  readToken,
  saveToken,
  hasSaBearerToken,
  hasUserBearerToken,
  hasUserSessionToken,
  readSaBearerToken,
  readUserBearerToken,
  readUserSessionToken,
  saveSaBearerToken,
  saveToken as saveCachedToken,
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
   * @param {boolean} useDeviceFlow only consulted when a loaded connection profile has `authMode: 'interactive'` — see `getTokensInteractive()` (default: false)
   * @param {BrowserLoginPromptHandler} promptHandler required only when a loaded connection profile has `authMode: 'interactive'`; every other auth mode ignores it
   * @returns {Promise<Tokens>} object containing the tokens
   */
  getTokens(
    forceLoginAsUser?: boolean,
    autoRefresh?: boolean,
    types?: string[],
    callbackHandler?: CallbackHandler,
    useDeviceFlow?: boolean,
    promptHandler?: BrowserLoginPromptHandler
  ): Promise<Tokens>;
  /**
   * Get tokens via a real interactive browser login (loopback-redirect or
   * device-authorization grant) instead of a CLI-driven password/service-
   * account/Amster login. Alongside `getTokens()`, not a replacement for it.
   * @param {BrowserLoginOptions} options browser-login options
   * @returns {Promise<Tokens>} object containing the tokens
   */
  getTokensInteractive(options: BrowserLoginOptions): Promise<Tokens>;
};

export default (state: State): Authenticate => {
  return {
    async getTokens(
      forceLoginAsUser = false,
      autoRefresh = true,
      types = Constants.DEPLOYMENT_TYPES,
      callbackHandler = null,
      useDeviceFlow = false,
      promptHandler = undefined
    ) {
      return getTokens({
        forceLoginAsUser,
        autoRefresh,
        types,
        callbackHandler,
        useDeviceFlow,
        promptHandler,
        state,
      });
    },
    async getTokensInteractive(options: BrowserLoginOptions) {
      return getTokensInteractive({ ...options, state });
    },
  };
};

const adminClientPassword = 'doesnotmatter';
const redirectUrlTemplate = '/platform/appAuthHelperRedirect.html';

const s = Constants.AVAILABLE_SCOPES;
const CLOUD_ADMIN_MINIMAL_SCOPES: string[] = [
  s.AnalyticsFullScope,
  s.DirectConfigurationSessionFullScope,
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
  s.TelemetryReadScope,
];
const CLOUD_ADMIN_DEFAULT_SCOPES: string[] = [
  s.AnalyticsFullScope,
  s.DirectConfigurationSessionFullScope,
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
  s.WSFedAdminScope,
  s.TelemetryReadScope,
];
const FORGEOPS_ADMIN_DEFAULT_SCOPES: string[] = [s.IdmFullScope, s.OpenIdScope];
const forgeopsAdminScopes = FORGEOPS_ADMIN_DEFAULT_SCOPES.join(' ');
const serviceAccountDefaultScopes = SERVICE_ACCOUNT_DEFAULT_SCOPES.join(' ');

const fidcClientId = 'idmAdminClient';
const forgeopsClientId = 'idm-admin-ui';

/**
 * The only OAuth2 client confirmed (2026-09-05, against a real AIC tenant)
 * to support a real interactive loopback-redirect browser login on cloud —
 * `idmAdminClient`'s registered redirect URIs are limited to
 * `/platform/appAuthHelperRedirect.html` and reject a loopback `redirect_uri`
 * with `redirect_uri_mismatch`. This is Ping's own client for `aic-mcp-server`;
 * see the plan doc for the full evidence trail and the known Ping-branded
 * consent-screen limitation that comes with it.
 */
const CLOUD_BROWSER_LOGIN_CLIENT_ID = 'AICMCPClient';
/**
 * Confirmed scope for `CLOUD_BROWSER_LOGIN_CLIENT_ID`'s interactive login —
 * `openid` is rejected with `invalid_scope` by this client, so it must be
 * omitted (unlike every other admin scope list in this file).
 */
const CLOUD_BROWSER_ADMIN_SCOPES: string[] = [s.AmFullScope, s.IdmFullScope];
const cloudBrowserAdminScopes = CLOUD_BROWSER_ADMIN_SCOPES.join(' ');
/**
 * `CLOUD_BROWSER_LOGIN_CLIENT_ID`'s one registered redirect URI, confirmed
 * (2026-09-07, empirically against a real AIC tenant by probing
 * `/oauth2/authorize` directly) to require an EXACT literal match on all
 * three of host, port, and path — `http://127.0.0.1:3000` (wrong host),
 * `http://localhost:54321` (wrong port), and `http://localhost:3000/callback`
 * (any path at all) each fail with `redirect_uri_mismatch`; only the bare
 * `http://localhost:3000` succeeds. Frodo has no control over this
 * registration (it's Ping's own client, shared with `aic-mcp-server`), so
 * cloud's default browser login must reproduce this exact value rather than
 * relying on the general-purpose loopback listener's own defaults
 * (`127.0.0.1`, an OS-assigned ephemeral port, and a `/callback` path) —
 * those are fine for a customer-supplied `--login-client-id`, whose
 * registration the customer controls, but not for this one.
 */
const CLOUD_BROWSER_LOGIN_REDIRECT_URI = 'http://localhost:3000';

export type UserSessionMetaType = AuthenticateSuccessResponse & {
  expires: number;
  from_cache?: boolean;
  // Captured from getSessionInfo() at the point it's already being called
  // (session-capture-script logins call it on every fresh login AND cache
  // resume, to validate the session and resolve the real username) — see
  // applySessionCaptureToken(). Optional: only present for session-capture
  // (ForgeOps/classic) entries, and only once a live session has actually
  // been captured.
  universalId?: string;
  latestAccessTime?: string;
  amCtxId?: string;
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

      const { challenge, method: challengeMethod } = createPkcePair();
      const redirectUri = new URL(
        redirectUrlTemplate,
        state.getHost()
      ).toString();

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
            message:
              theme(state).emphasis(`ForgeRock Identity Cloud`) + ` detected.`,
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
                message:
                  theme(state).emphasis(`ForgeOps deployment`) + ` detected.`,
                state,
              });
              deploymentType = Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY;
            } else {
              verboseMessage({
                message:
                  theme(state).emphasis(`Classic deployment`) + ` detected.`,
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

const UNKNOWN_AM_VERSION = '0.0.0';

/**
 * Helper function to extract the semantic version string from a version info object
 * @param {Object} versionInfo version info object
 * @returns {String} semantic version
 */
export function getSemanticVersion(versionInfo) {
  const versionFields = [versionInfo?.version, versionInfo?.fullVersion];
  const semanticVersionRegex = /(\d+\.\d+\.\d+(?:\.\d+)*)/;

  for (const versionField of versionFields) {
    if (typeof versionField !== 'string') {
      continue;
    }
    const version = versionField.match(semanticVersionRegex);
    if (version) {
      return version[0];
    }
  }

  return UNKNOWN_AM_VERSION;
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

    while (true) {
      const response = await step({
        body: currentStep || {},
        config: currentStep ? {} : config,
        state,
      });
      // Handle success response
      if ('tokenId' in response) {
        // Get session expiration. AM reports two independent caps: the idle
        // timeout (maxIdleExpirationTime) and the absolute session lifetime
        // (maxSessionExpirationTime) — either can be the one that actually
        // ends the session first, so the effective expiry is whichever comes
        // sooner, not idle time alone.
        const { maxIdleExpirationTime, maxSessionExpirationTime } =
          await getSessionInfo({
            tokenId: response.tokenId,
            state,
          });
        const expires = Math.min(
          Date.parse(maxIdleExpirationTime),
          Date.parse(maxSessionExpirationTime)
        );
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    await saveUserSessionToken({ token, subject: state.getUsername(), state });
  }
  debugMessage({
    message: `AuthenticateOps.getUserSessionToken: end`,
    state,
  });
  return token;
}

/**
 * Cache available service account scopes to avoid multiple calls to the API, which is especially relevant for cloud where the list of scopes can be quite long and deeply nested.
 */
let availableServiceAccountScopesCache: ServiceAccountScope[] = null;

/**
 * Get available service account scopes, optionally flattened, and cache the result to avoid multiple API calls
 * @param param0 Object containing flatten flag and state
 * @returns Promise resolving to an array of ServiceAccountScope objects or a flattened array of scope strings
 */
async function getAvailableServiceAccountScopes({
  flatten = false,
  state,
}: {
  flatten: boolean;
  state: State;
}): Promise<ServiceAccountScope[] | string[]> {
  debugMessage({
    message: `AuthenticateOps.getAvailableServiceAccountScopes: start`,
    state,
  });
  try {
    if (availableServiceAccountScopesCache === null) {
      availableServiceAccountScopesCache = (await readServiceAccountScopes({
        flatten: false,
        state,
      })) as ServiceAccountScope[];
    }
    if (flatten) {
      return flattenScopes(availableServiceAccountScopesCache) as string[];
    }
    return availableServiceAccountScopesCache as ServiceAccountScope[];
  } catch (error) {
    debugMessage({
      message: `AuthenticateOps.getAvailableServiceAccountScopes: error reading service account scopes: ${error}`,
      state,
    });
    return [] as ServiceAccountScope[];
  }
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
      const availableScopes = (await getAvailableServiceAccountScopes({
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
 * @param {string} scope oauth2 scope
 * @param {string} redirectUri oauth2 redirect uri
 * @param {string} codeChallenge PKCE code challenge
 * @param {string} codeChallengeMethod PKCE code challenge method
 * @param {State} state library state
 * @returns {string} oauth2 authorization code or null
 */
async function getAuthCode(
  scope: string,
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
    const bodyFormData = `redirect_uri=${redirectUri}&scope=${scope}&response_type=code&client_id=${adminClientId}&csrf=${state.getCookieValue()}&decision=allow&code_challenge=${codeChallenge}&code_challenge_method=${codeChallengeMethod}`;
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
    const parsedUrl = new URL(redirectLocationURL, state.getHost());
    const code = parsedUrl.searchParams.get('code');
    if (code) {
      debugMessage({
        message: `AuthenticateOps.getAuthCode: end with code`,
        state,
      });
      return code;
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
    const { verifier, challenge, method: challengeMethod } = createPkcePair();
    const redirectUri = new URL(
      state.getAdminClientRedirectUri() || redirectUrlTemplate,
      state.getHost()
    ).toString();
    const scope = await getAdminUserScopes({ state });
    const authCode = await getAuthCode(
      scope,
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
async function getFreshPfUserBearerToken({
  state,
}: {
  state: State;
}): Promise<AccessTokenMetaType> {
  debugMessage({
    message: `AuthenticateOps.getFreshPfUserBearerToken: start`,
    state,
  });
  try {
    const { verifier, challenge, method: challengeMethod } = createPkcePair();
    const redirectUri = new URL(
      state.getAdminClientRedirectUri() || redirectUrlTemplate,
      state.getHost()
    ).toString();
    const scope = Constants.AVAILABLE_SCOPES.WSFedAdminScope;
    const authCode = await getAuthCode(
      scope,
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
        message: `AuthenticateOps.getFreshPfUserBearerToken: end with token`,
        state,
      });
      return response;
    }
    throw new FrodoError(`No access token in response`);
  } catch (error) {
    throw new FrodoError(`Error getting fresh pf user bearer token`, error);
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    await saveUserBearerToken({ token, subject: state.getUsername(), state });
  }
  return token;
}

/**
 * Helper function to obtain oauth2 access token
 * @param {State} state library state
 * @returns {Promise<AccessTokenMetaType>} access token or null
 */
async function getPfUserBearerToken(
  state: State
): Promise<AccessTokenMetaType> {
  debugMessage({
    message: `AuthenticateOps.getPfUserBearerToken: start`,
    state,
  });
  let token: AccessTokenMetaType = null;
  if (
    state.getUseTokenCache() &&
    (await hasToken({ tokenType: 'pfUserBearer', state }))
  ) {
    try {
      token = (await readToken({
        tokenType: 'pfUserBearer',
        state,
      })) as AccessTokenMetaType;
      token.from_cache = true;
      debugMessage({
        message: `AuthenticateOps.getPfUserBearerToken: end [cached]`,
        state,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      debugMessage({
        message: `AuthenticateOps.getPfUserBearerToken: end [failed cache read]`,
        state,
      });
    }
  }
  if (!token) {
    token = await getFreshPfUserBearerToken({ state });
    token.from_cache = false;
    debugMessage({
      message: `AuthenticateOps.getPfUserBearerToken: end [fresh]`,
      state,
    });
  }
  if (state.getUseTokenCache()) {
    await saveToken({ tokenType: 'pfUserBearer', token, state });
  }
  return token;
}

export function createPayload(serviceAccountId: string, host: string) {
  const u = parseUrl(host);
  const aud = `${u.origin}${
    u.port ? '' : `:${u.protocol === 'https' ? '443' : '80'}`
  }${u.pathname.replace(/\/$/, '')}/oauth2/access_token`;

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
    } else {
      // Re-throw non-invalid_scope errors instead of silently failing
      throw error;
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
 * Get fresh PingFed access token for service account
 * @param {State} state library state
 * @returns {Promise<AccessTokenResponseType>} response object containg token, scope, type, and expiration in seconds
 */
export async function getFreshPfSaBearerToken({
  saId = undefined,
  saJwk = undefined,
  state,
}: {
  saId?: string;
  saJwk?: JwkRsa;
  state: State;
}): Promise<AccessTokenMetaType> {
  debugMessage({
    message: `AuthenticateOps.getFreshPfSaBearerToken: start`,
    state,
  });
  saId = saId ? saId : state.getServiceAccountId();
  saJwk = saJwk ? saJwk : state.getServiceAccountJwk();
  const payload = createPayload(saId, state.getHost());
  const jwt = await createSignedJwtToken(payload, saJwk);
  const scope = Constants.AVAILABLE_SCOPES.WSFedAdminScope;
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
    } else {
      // Re-throw non-invalid_scope errors instead of silently failing
      throw error;
    }
  }
  if ('access_token' in response) {
    debugMessage({
      message: `AuthenticateOps.getFreshPfSaBearerToken: end`,
      state,
    });
    return response;
  }
  debugMessage({
    message: `AuthenticateOps.getFreshPfSaBearerToken: end [No access token in response]`,
    state,
  });
  return null;
}

/**
 * Real service-account name for the token cache's subject index, resolved
 * via IDM (mirrors `getLoggedInSubject()`'s own resolution, kept separate
 * since that one formats a full "service account X [id]" display string
 * for the login success message, not a bare name for the index). Only
 * attempted for a freshly-acquired token — `getSaBearerToken()` re-saves
 * on every cache hit too, and re-resolving on every one of those would add
 * a network call to a path that's supposed to stay cheap on repeat;
 * `undefined` leaves whatever's already indexed for this host untouched,
 * the same convention `resolveBrowserLoginSubject()` uses.
 */
async function resolveServiceAccountSubject(
  token: AccessTokenMetaType,
  state: State
): Promise<string | undefined> {
  if (token.from_cache) {
    return undefined;
  }
  try {
    // getServiceAccount()'s IDM call authenticates with state's bearer
    // token — normally installed by getSaBearerToken()'s own caller, but
    // only *after* it returns. Install it here too so this lookup (which
    // runs before that point) isn't unauthenticated; harmless to set
    // early, since the caller's own subsequent call just re-sets the same
    // value.
    state.setBearerTokenMeta(token);
    const { name } = await getServiceAccount({
      serviceAccountId: state.getServiceAccountId(),
      state,
    });
    return name;
  } catch {
    return state.getServiceAccountId();
  }
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      await saveSaBearerToken({
        token,
        subject: await resolveServiceAccountSubject(token, state),
        state,
      });
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
 * Get cached or fresh PingFed access token for service account
 * @param {State} state library state
 * @returns {Promise<AccessTokenResponseType>} response object containg token, scope, type, and expiration in seconds
 */
export async function getPfSaBearerToken({
  state,
}: {
  state: State;
}): Promise<AccessTokenMetaType> {
  try {
    debugMessage({
      message: `AuthenticateOps.getPfSaBearerToken: start`,
      state,
    });
    let token: AccessTokenMetaType = null;
    if (
      state.getUseTokenCache() &&
      (await hasToken({ tokenType: 'pfSaBearer', state }))
    ) {
      try {
        token = (await readToken({
          tokenType: 'pfSaBearer',
          state,
        })) as AccessTokenMetaType;
        token.from_cache = true;
        debugMessage({
          message: `AuthenticateOps.getPfSaBearerToken: end [cached]`,
          state,
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        debugMessage({
          message: `AuthenticateOps.getPfSaBearerToken: end [failed cache read]`,
          state,
        });
      }
    }
    if (!token) {
      token = await getFreshPfSaBearerToken({ state });
      token.from_cache = false;
      debugMessage({
        message: `AuthenticateOps.getPfSaBearerToken: end [fresh]`,
        state,
      });
    }
    if (state.getUseTokenCache()) {
      await saveToken({ tokenType: 'pfSaBearer', token, state });
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
 * Helper function to determine whether the deployment is an iga cloud tenant or not, and set the state accordingly
 * @param state library state
 */
async function determineIsIGATenant(state: State): Promise<void> {
  if (state.getIsIGA() !== undefined) return;
  // Check if the IGA scope is part of the possible scopes since non IGA tenants do not have this scope as a possible scope
  state.setIsIGA(
    (
      (await getAvailableServiceAccountScopes({
        flatten: false,
        state,
      })) as ServiceAccountScope[]
    ).some((s) => s.scope === Constants.AVAILABLE_SCOPES.IGAFullScope)
  );
}

/**
 * Helper function to determine whether the deployment is a PingFed cloud tenant or not, and set the state accordingly
 * @param state library state
 */
async function determineIsPingFedTenant(state: State): Promise<void> {
  if (state.getIsPingFed() !== undefined) return;
  // Check if the PingFed scope is part of the possible scopes since non PingFed tenants do not have this scope as a possible scope
  state.setIsPingFed(
    (
      (await getAvailableServiceAccountScopes({
        flatten: false,
        state,
      })) as ServiceAccountScope[]
    ).some((s) => s.scope === Constants.AVAILABLE_SCOPES.WSFedAdminScope)
  );
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

  // IDM version is deliberately NOT probed here. It is only ever consumed by
  // MCP's forgeops docs routing (see mcp/DocsContext.ts), which fetches and
  // caches it lazily on first use instead of paying for an extra IDM round
  // trip on every login regardless of whether anything needs it.

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  await determineIsIGATenant(state);

  await determineIsPingFedTenant(state);

  if (
    state.getCookieValue() &&
    // !state.getBearerToken() &&
    (state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY ||
      state.getDeploymentType() === Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY)
  ) {
    const accessToken = await getUserBearerToken(state);
    if (accessToken) state.setBearerTokenMeta(accessToken);

    if (state.getIsPingFed()) {
      const pfAccessToken = await getPfUserBearerToken(state);
      if (pfAccessToken) state.setPfBearerTokenMeta(pfAccessToken);
    }
  }
}

export type Tokens = {
  bearerToken?: AccessTokenMetaType;
  userSessionToken?: UserSessionMetaType;
  pfBearerToken?: AccessTokenMetaType;
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
  useDeviceFlow = false,
  promptHandler,
  state,
}: {
  forceLoginAsUser?: boolean;
  autoRefresh?: boolean;
  types?: string[];
  callbackHandler?: CallbackHandler;
  /** Only consulted when a loaded connection profile has `authMode: 'interactive'` — see below. */
  useDeviceFlow?: boolean;
  /** Required only when a loaded connection profile has `authMode: 'interactive'`; every other auth mode ignores it. */
  promptHandler?: BrowserLoginPromptHandler;
  state: State;
}): Promise<Tokens> {
  debugMessage({
    message: `AuthenticateOps.getTokens: start, types: ${types}`,
    state,
  });
  let usingConnectionProfile: boolean = false;
  // Browser login — either explicitly requested by the caller (`state`
  // already carries `authMode: 'interactive'` before `getTokens()` was even
  // called, e.g. a CLI's `--browser`/`--device` flag) or discovered from a
  // saved connection profile once one is loaded below. `getTokens()` has no
  // browser-launching context of its own, so this only fires when the
  // caller supplies a promptHandler. Every other existing getTokens() caller
  // is unaffected, since they never set/load this authMode.
  async function tryBrowserLogin(): Promise<Tokens | undefined> {
    if (state.getAuthMode() !== 'interactive') {
      return undefined;
    }
    // Unlike every other auth mode's own cache check (see e.g.
    // getUserSessionToken()), getTokensInteractive() never checks the cache
    // itself — deliberately, since an explicit `frodo login` must always
    // perform a real login. This is the only place that shortcut belongs:
    // getTokens()'s implicit/silent path, used by every other command.
    const reused = await tryReuseCachedBrowserSession({ state });
    if (reused) {
      return reused;
    }
    if (!promptHandler) {
      throw new FrodoError(
        `This connection profile uses browser login (authMode: 'interactive'), which requires a promptHandler to present the login step. Pass one to getTokens(), or call getTokensInteractive() directly instead.`
      );
    }
    const tokens = await getTokensInteractive({
      loginClientId: state.getBrowserLoginClientId(),
      loginScope: state.getBrowserLoginScope(),
      // No loginRedirectUri here: getTokensInteractive() already falls back
      // to state.getAdminClientRedirectUri() internally when omitted — the
      // same shared field --login-redirect-uri populates and
      // ConnectionProfileOps.ts already persists — so there's nothing
      // browser-login-specific to remember and re-supply here, unlike
      // loginClientId (whose browser-resolved value, e.g. cloud's built-in
      // default, has no equivalent in state.getAdminClientId()).
      useDeviceFlow,
      promptHandler,
      state,
    });
    if (usingConnectionProfile) {
      saveConnectionProfile({ host: state.getHost(), state });
    }
    return tokens;
  }
  try {
    if (!state.getHost()) {
      throw new FrodoError(`No host specified`);
    }

    // Explicitly requested browser login bypasses all password/connection-
    // profile credential resolution below entirely — a brand-new host with
    // no saved profile yet is the common case (e.g. `frodo login --browser`
    // on a host never seen before), and attempting profile lookup first
    // would needlessly fail for it.
    {
      const tokens = await tryBrowserLogin();
      if (tokens) return tokens;
    }

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
    } else if (
      // a username was given without a password: never require the password
      // to be passed or embedded anywhere in the invoking command/config —
      // pull it from the connection profile stored for this host instead,
      // but only when that profile's own username matches the one given, so
      // a typo'd or wrong username fails loudly rather than silently
      // switching identities.
      state.getUsername() != null &&
      state.getPassword() == null &&
      !state.getServiceAccountId() &&
      !state.getServiceAccountJwk() &&
      !state.getAmsterPrivateKey()
    ) {
      const conn = await getConnectionProfile({ state });
      if (
        conn.username &&
        conn.password &&
        conn.username === state.getUsername()
      ) {
        state.setPassword(conn.password);
        usingConnectionProfile = true;
        debugMessage({
          message: `AuthenticateOps.getTokens: resolved password for username '${state.getUsername()}' from the connection profile for '${state.getHost()}'.`,
          state,
        });
      } else {
        throw new FrodoError(
          `No stored password found for username '${state.getUsername()}' in the connection profile for '${state.getHost()}'. Provide --password explicitly, or omit --username to use the full stored connection profile.`
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

    // Catches the case where authMode became 'interactive' as a result of
    // loading a saved connection profile above — an explicit pre-existing
    // request (checked immediately after the host check, above) already
    // returned before reaching here. Checked before determineCookieName()
    // below: browser mode gets a bearer token, not a session cookie, for
    // its primary AM-domain access, so there's no need to pay for that
    // lookup's network call before launching an interactive flow.
    {
      const tokens = await tryBrowserLogin();
      if (tokens) return tokens;
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

        if (state.getIsPingFed()) {
          const pfToken = await getPfSaBearerToken({ state });
          if (pfToken) state.setPfBearerTokenMeta(pfToken);
        }

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

        await determineIsIGATenant(state);

        await determineIsPingFedTenant(state);
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
      // On-demand counterpart to the timer above: api/BaseApi.ts's request
      // interceptors call this when a cached token is found stale at actual
      // send time, rather than relying solely on the timer (which never
      // gets a chance to fire in a short-lived CLI process, and can still
      // race a burst of concurrent calls in a long-running one). Only wired
      // when autoRefresh is on, mirroring the timer's own condition — with
      // it off, a stale token should surface a clear error, not a silent
      // background re-login the caller didn't ask for. De-duplication of
      // concurrent callers is handled centrally by `state.setTokenRefreshHandler`.
      state.setTokenRefreshHandler(
        autoRefresh
          ? async () => {
              await getTokens({
                forceLoginAsUser,
                autoRefresh,
                types,
                callbackHandler,
                state,
              });
            }
          : undefined
      );
      const tokens: Tokens = {
        bearerToken: state.getBearerTokenMeta(),
        userSessionToken: state.getUserSessionTokenMeta(),
        pfBearerToken: state.getPfBearerTokenMeta(),
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
    debugMessage({
      message: `AuthenticateOps.getTokens: Error getting tokens: ${error} Stack: ${error.stack}`,
      state,
    });
    throw new FrodoError(`Error getting tokens`, error);
  }
}

export type BrowserLoginOptions = {
  /**
   * Deployment type to authenticate against. Required — unlike `getTokens()`,
   * there is no AM session yet at the start of a browser login for
   * `determineDeploymentType()` to probe with, so it can't be auto-detected.
   */
  deploymentType?: string;
  /** Use the OAuth2 Device Authorization Grant instead of a loopback redirect. */
  useDeviceFlow?: boolean;
  /** Override the built-in OAuth2 client id for the target deployment type. */
  loginClientId?: string;
  /** Override the default scope requested for the target deployment type. */
  loginScope?: string;
  /**
   * Full, absolute redirect URI to use for browser login, for a client
   * registered with an exact-match redirect URI. Shared with the
   * non-interactive synthetic login flow's own `--login-redirect-uri` (see
   * `state.getAdminClientRedirectUri()`) — when omitted here, that value is
   * used as the fallback, exactly like `loginClientId` already falls back
   * to `state.getAdminClientId()`. When both are absent, falls through to
   * an auto-generated loopback redirect on an OS-assigned ephemeral port
   * (or, for cloud's built-in client specifically, its one confirmed-fixed
   * redirect URI — see `CLOUD_BROWSER_LOGIN_REDIRECT_URI`).
   */
  loginRedirectUri?: string;
  /** Presents the login step (a URL, or a device code) to the human completing it. */
  promptHandler: BrowserLoginPromptHandler;
  /** How long to wait for the human to complete the login step. */
  timeoutMs?: number;
};

/**
 * Checks whether AM's REST API accepts a bearer token directly for this
 * session, performing one cheap authenticated read call. This is ForgeOps
 * browser-login's Tier B fallback (see the plan doc's Phase C): AM's REST
 * API is not a resource server by default, so whether a plain bearer token
 * works at all is genuinely undecided until probed — the *recommended* path
 * (a session-capture script on the OAuth2 client) never needs this at all,
 * since it gets a real session cookie instead. Cached on `state` for the
 * life of the session so the probe only ever runs once.
 * @param {State} state library state
 * @returns {Promise<boolean>} whether AM accepted the bearer token
 */
export async function probeAmBearerTokenAcceptance({
  state,
}: {
  state: State;
}): Promise<boolean> {
  const cached = state.getAmBearerTokenAcceptanceProbed();
  if (cached !== undefined) {
    return cached;
  }
  let accepted = false;
  try {
    await getAuthenticationSettings({ state, globalConfig: true });
    accepted = true;
  } catch {
    accepted = false;
  }
  state.setAmBearerTokenAcceptanceProbed(accepted);
  return accepted;
}

/**
 * Applies a ForgeOps browser-login token response to `state`, choosing
 * between the two AM-access mechanisms documented in the plan doc's Phase C:
 * the recommended session-capture script (a real AM session id embedded via
 * `sessionId`, using today's existing, unchanged session-cookie AM code
 * path) when present, or the Tier A/B bearer-token fallback otherwise.
 * Shared between the initial interactive login and every subsequent
 * on-demand token refresh, since a customer's OAuth2 access-token-
 * modification script fires on refresh-issued tokens too.
 */
/**
 * Validates a session-capture-script-issued AM session id and wires it into
 * `state.setUserSessionTokenMeta()`, so today's existing, unchanged
 * session-cookie AM code path runs from here. Shared by ForgeOps and
 * classic browser login (see the plan doc's Phase A/C/D) — the two
 * deployment types differ only in what happens when no `sessionId` is
 * present on the token response, which each caller decides for itself.
 */
/**
 * @returns the session's real username, straight from AM's own session
 * info — the caller threads this up to getTokensInteractive()'s final
 * subject resolution, since it's a better answer than the bearer token's
 * JWT sub claim (a UUID for cloud) could ever give, and costs nothing extra
 * to obtain here since getSessionInfo() is already being called.
 */
async function applySessionCaptureToken({
  sessionId,
  state,
}: {
  sessionId: string;
  state: State;
}): Promise<string | undefined> {
  if (!state.getCookieName()) {
    state.setCookieName(await determineCookieName(state));
  }
  const sessionInfo = await getSessionInfo({ tokenId: sessionId, state });
  const userSessionMeta: UserSessionMetaType = {
    tokenId: sessionId,
    successUrl: '',
    realm: sessionInfo.realm,
    expires: Math.min(
      Date.parse(sessionInfo.maxIdleExpirationTime),
      Date.parse(sessionInfo.maxSessionExpirationTime)
    ),
    from_cache: false,
    // Free: getSessionInfo() already returned these, previously discarded
    // after extracting realm/expiry/username. Persisted for `frodo session
    // describe` to surface locally, without ever calling the network again.
    universalId: sessionInfo.universalId,
    latestAccessTime: sessionInfo.latestAccessTime,
    amCtxId: sessionInfo.properties?.AMCtxId,
  };
  state.setUserSessionTokenMeta(userSessionMeta);
  // Never persisted before: a session-capture-script AM session id is just
  // as reusable across CLI invocations as the primary bearer token is, and
  // restoring only the bearer token on a cache hit would leave AM-domain
  // calls (which use this session, not the bearer token) unauthenticated.
  if (state.getUseTokenCache()) {
    await saveCachedToken({
      tokenType: 'browserUserSession',
      token: userSessionMeta,
      subject: sessionInfo.username,
      state,
    });
  }
  return sessionInfo.username;
}

async function applyForgeopsInteractiveToken({
  token,
  state,
}: {
  token: AccessTokenMetaType;
  state: State;
}): Promise<string | undefined> {
  state.setBearerTokenMeta(token);
  if (token.sessionId) {
    return applySessionCaptureToken({ sessionId: token.sessionId, state });
  }
  state.setUseBearerTokenForAmApis(true);
  const accepted = await probeAmBearerTokenAcceptance({ state });
  if (!accepted) {
    printMessage({
      message: `Warning: this OAuth2 client has no session-capture script configured, and AM did not accept its bearer token directly. AM-domain operations will likely fail; IDM-domain operations still work. See BROWSER_LOGIN.md for the recommended session-capture script setup.`,
      type: 'warn',
      state,
    });
  }
  return undefined;
}

/**
 * Applies a classic browser-login token response to `state`. Unlike
 * ForgeOps, classic has no IDM and no supported bearer-token fallback for
 * AM-domain access (see the plan doc's Phase D) — a session-capture script
 * is the *only* supported mechanism here, so a token response with no
 * `sessionId` fails clearly rather than silently falling back to an
 * unusable bearer-token mode. A direct consequence: this always returns a
 * real username (never undefined) — classic never needs the IDM-based
 * subject resolver in resolveBrowserLoginSubject(), since it can't reach
 * that fallback branch in the first place.
 */
async function applyClassicInteractiveToken({
  token,
  state,
}: {
  token: AccessTokenMetaType;
  state: State;
}): Promise<string | undefined> {
  state.setBearerTokenMeta(token);
  if (!token.sessionId) {
    throw new FrodoError(
      `Browser login on classic requires a session-capture script configured on this OAuth2 client — classic has no IDM and no supported bearer-token fallback for AM-domain access. See BROWSER_LOGIN.md's classic section for the required AM OAuth2 Provider and script setup.`
    );
  }
  return applySessionCaptureToken({ sessionId: token.sessionId, state });
}

/**
 * Applies a cloud browser-login token response to `state`: wires the
 * primary (IDM-only) bearer token, and installs the on-demand AM credential
 * provider that mints a fresh, short-lived RFC 8693-exchanged token
 * immediately before each AM-domain call (see the plan doc's Phase B).
 * Shared between a fresh interactive login and a cache-hit session-reuse
 * resume in a brand-new process — the provider closure is process-local and
 * never persisted, so it must be reinstalled either way.
 */
async function applyCloudInteractiveToken({
  token,
  state,
}: {
  token: AccessTokenMetaType;
  state: State;
}): Promise<string | undefined> {
  // Deliberately not `state.setUseBearerTokenForAmApis(true)`: unlike
  // the service-account path, this primary token is only accepted by
  // IDM. AM-domain calls need a fresh RFC 8693 exchange
  // (`exchangeTokenForScope`) immediately before each call — see the
  // plan doc's Phase B for the full evidence trail. Setting the flag
  // here would make every AM call fail with 401 using the wrong token.
  state.setBearerTokenMeta(token);
  state.setAmCredentialProvider(async (requiredScopes) => {
    const scope = resolveAvailableScope({
      requiredScopes:
        requiredScopes && requiredScopes.length > 0
          ? requiredScopes
          : [s.AmFullScope],
      state,
    });
    const exchanged = await exchangeTokenForScope({
      subjectToken: state.getBearerToken(),
      scope,
      state,
    });
    return {
      header: 'Authorization',
      value: `Bearer ${exchanged.access_token}`,
    };
  });
  // Cloud never runs a session-capture step — there's no already-known
  // real username to hand back here. resolveBrowserLoginSubject() falls
  // back to an IDM lookup for cloud specifically because of this.
  return undefined;
}

/**
 * Dispatches to the deployment-type-specific token-application helper
 * above. The single place that decides "how does this deployment type wire
 * a browser-login token onto state", reused by `getTokensInteractive()`'s
 * fresh-login switch, `tryReuseCachedBrowserSession()`'s cache-hit resume,
 * and `buildBrowserTokenRefreshHandler()`'s on-demand refresh — so the three
 * places a token can enter `state` all apply it identically.
 * @returns the real username already known from a session-capture step
 * (ForgeOps/classic), or undefined (cloud, or ForgeOps's no-session-capture
 * Tier-B bearer-token fallback) — see resolveBrowserLoginSubject().
 */
function applyInteractiveToken({
  deploymentType,
  token,
  state,
}: {
  deploymentType: string;
  token: AccessTokenMetaType;
  state: State;
}): Promise<string | undefined> {
  switch (deploymentType) {
    case Constants.CLOUD_DEPLOYMENT_TYPE_KEY:
      return applyCloudInteractiveToken({ token, state });
    case Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY:
      return applyForgeopsInteractiveToken({ token, state });
    case Constants.CLASSIC_DEPLOYMENT_TYPE_KEY:
      return applyClassicInteractiveToken({ token, state });
    default:
      throw new FrodoError(
        `Browser login is not yet implemented for deployment type '${deploymentType}'. Supported: ${Constants.CLOUD_DEPLOYMENT_TYPE_KEY}, ${Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY}, ${Constants.CLASSIC_DEPLOYMENT_TYPE_KEY}.`
      );
  }
}

/**
 * Builds the on-demand refresh handler for a browser-login session, shared
 * between a fresh interactive login and a cache-hit resume so both wire the
 * exact same on-refresh behavior. Returns `undefined` when the primary
 * token came with no refresh token to redeem — unlike every other auth
 * mode, browser-mode must never fall back to silently re-running a full
 * interactive login on expiry, since there is no unattended way to redo a
 * real browser round trip; a stale token then surfaces a clear
 * re-authentication error instead (see api/BaseApi.ts's credential
 * resolvers).
 */
function buildBrowserTokenRefreshHandler({
  deploymentType,
  initialToken,
  state,
}: {
  deploymentType: string;
  initialToken: AccessTokenMetaType;
  state: State;
}): (() => Promise<void>) | undefined {
  if (!initialToken.refresh_token) {
    return undefined;
  }
  return async () => {
    const refreshed = await refreshBrowserBearerToken({ state });
    state.setRefreshToken(refreshed.refresh_token);
    if (refreshed.id_token) {
      state.setIdToken(refreshed.id_token);
    }
    // A customer's access-token-modification script (ForgeOps/classic)
    // fires on refresh-issued tokens too, so re-derive the session (or
    // re-probe Tier B) rather than assuming the prior choice still holds;
    // cloud just re-wires the primary bearer token.
    await applyInteractiveToken({ deploymentType, token: refreshed, state });
    if (state.getUseTokenCache()) {
      await saveCachedToken({
        tokenType: 'browserUserBearer',
        token: refreshed,
        subject: browserLoginJwtSubjectOrUndefined(refreshed),
        state,
      });
    }
  };
}

/**
 * On a cache hit, restores a previously-obtained browser-login session onto
 * `state` — re-running the exact same derived-state wiring
 * (`applyInteractiveToken`/`buildBrowserTokenRefreshHandler`) that a fresh
 * interactive login runs, so every side effect (AM credential provider,
 * session-capture cookie, Tier A/B bearer-token fallback, refresh handler)
 * ends up identical either way. This can still make one network call (e.g.
 * re-validating a session-capture-script AM session via `getSessionInfo`),
 * but never a real interactive round trip.
 *
 * Returns `undefined` on a miss — nothing cached, the cached bearer token
 * itself is stale (`readToken()` already enforces
 * `Constants.TOKEN_FRESHNESS_BUFFER_MS`), the deployment type isn't known
 * yet, or applying the restored token fails for any reason (e.g. a
 * session-capture AM session that's since been invalidated server-side) —
 * so the caller falls through to a real interactive login. Deliberately
 * never called from `getTokensInteractive()` itself: an explicit
 * `frodo login` must always perform a real login, never silently no-op
 * because a still-valid cached session exists.
 */
async function tryReuseCachedBrowserSession({
  state,
}: {
  state: State;
}): Promise<Tokens | undefined> {
  if (!state.getUseTokenCache()) {
    return undefined;
  }
  const deploymentType = state.getDeploymentType();
  if (!deploymentType) {
    return undefined;
  }
  let token: AccessTokenMetaType;
  try {
    token = (await readToken({
      tokenType: 'browserUserBearer',
      state,
    })) as AccessTokenMetaType;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return undefined;
  }
  try {
    state.setRefreshToken(token.refresh_token);
    state.setIdToken(token.id_token);
    await applyInteractiveToken({ deploymentType, token, state });
    state.setTokenRefreshHandler(
      buildBrowserTokenRefreshHandler({
        deploymentType,
        initialToken: token,
        state,
      })
    );
    debugMessage({
      message: `AuthenticateOps.tryReuseCachedBrowserSession: reused cached browser-login session, no interactive round trip`,
      state,
    });
    // Reads the subject already resolved (and indexed) at the original
    // login, rather than re-resolving — this path runs on nearly every
    // implicit command, unlike a fresh login, so it must stay a cheap
    // local read, never a network call.
    const resolvedSubject =
      getRecordedSubject({ tokenType: 'browserUserBearer', state }) ??
      getBrowserLoginSubject(token);
    // Same reasoning as the fresh-login branch above: keeps
    // determineCallerTrustTier() working uniformly on a cache-hit resume,
    // not just a fresh interactive login.
    state.setUsername(resolvedSubject);
    return {
      bearerToken: state.getBearerTokenMeta(),
      userSessionToken: state.getUserSessionTokenMeta(),
      pfBearerToken: state.getPfBearerTokenMeta(),
      subject: resolvedSubject,
      host: state.getHost(),
      realm: state.getRealm() ? state.getRealm() : 'root',
    };
  } catch (error) {
    debugMessage({
      message: `AuthenticateOps.tryReuseCachedBrowserSession: cached session failed validation, falling back to a fresh login: ${error}`,
      state,
    });
    return undefined;
  }
}

/**
 * Get tokens via a real interactive browser login.
 * @param {BrowserLoginOptions} options browser-login options
 * @param {State} state library state
 * @returns {Promise<Tokens>} object containing the tokens
 */
export async function getTokensInteractive({
  deploymentType,
  useDeviceFlow = false,
  loginClientId,
  loginScope,
  loginRedirectUri,
  promptHandler,
  timeoutMs,
  state,
}: BrowserLoginOptions & { state: State }): Promise<Tokens> {
  debugMessage({
    message: `AuthenticateOps.getTokensInteractive: start`,
    state,
  });
  try {
    if (!state.getHost()) {
      throw new FrodoError(`No host specified`);
    }

    // Resolve an alias/unique-substring host (e.g. `frodo login myhost
    // --browser`) to its full URL the same way getTokens()'s implicit path
    // already does — but scoped to the host only. Unlike getTokens(),
    // getTokensInteractive() is deliberately the "always do a real
    // interactive login, ignore what's cached/configured" entry point, so
    // this must not also adopt the profile's other saved fields (deployment
    // type, credential type, etc.) the way getTokens() does.
    if (!isValidUrl(state.getHost())) {
      const conn = await getConnectionProfile({ state });
      state.setHost(conn.tenant);
    }

    const resolvedDeploymentType = deploymentType || state.getDeploymentType();
    if (!resolvedDeploymentType) {
      throw new FrodoError(
        `Browser login requires a known deployment type. Call state.setDeploymentType() first.`
      );
    }

    let token: AccessTokenMetaType;
    // The real username already resolved during token application, if any
    // (from a session-capture step) — see resolveBrowserLoginSubject().
    let knownUsername: string | undefined;
    switch (resolvedDeploymentType) {
      case Constants.CLOUD_DEPLOYMENT_TYPE_KEY: {
        const clientId = loginClientId || CLOUD_BROWSER_LOGIN_CLIENT_ID;
        const scope = loginScope || cloudBrowserAdminScopes;
        // Shared with the non-interactive synthetic flow's own
        // --login-redirect-uri (state.getAdminClientRedirectUri()) — same
        // fallback pattern loginClientId already uses against
        // state.getAdminClientId().
        const resolvedRedirectUri =
          loginRedirectUri || state.getAdminClientRedirectUri();
        // The built-in client's one registered redirect URI is an exact
        // literal string (see CLOUD_BROWSER_LOGIN_REDIRECT_URI's own
        // comment) — the general-purpose loopback listener's own defaults
        // (127.0.0.1, an OS-assigned ephemeral port, a /callback path) never
        // match it, so this must override them rather than rely on them.
        // Only applies when actually using the built-in client; a
        // customer-supplied --login-client-id's registration is theirs to
        // control, same as forgeops/classic.
        const usingBuiltInClient = clientId === CLOUD_BROWSER_LOGIN_CLIENT_ID;
        if (
          usingBuiltInClient &&
          resolvedRedirectUri &&
          resolvedRedirectUri !== CLOUD_BROWSER_LOGIN_REDIRECT_URI
        ) {
          throw new FrodoError(
            `--login-redirect-uri is not supported with cloud's built-in OAuth2 client (${CLOUD_BROWSER_LOGIN_CLIENT_ID}): AM only accepts the exact redirect URI "${CLOUD_BROWSER_LOGIN_REDIRECT_URI}" for it. Pass --login-client-id with your own registered OAuth2 client if you need a different redirect URI.`
          );
        }
        const effectiveRedirectUri = usingBuiltInClient
          ? CLOUD_BROWSER_LOGIN_REDIRECT_URI
          : resolvedRedirectUri;
        token = useDeviceFlow
          ? await startDeviceAuthorizationFlow({
              clientId,
              scope,
              promptHandler,
              timeoutMs,
              state,
            })
          : await runInteractiveAuthorizationCodeFlow({
              clientId,
              scope,
              redirectUri: effectiveRedirectUri,
              promptHandler,
              timeoutMs,
              state,
            });
        state.setAuthMode('interactive');
        state.setBrowserLoginClientId(clientId);
        state.setBrowserLoginScope(scope);
        // Only ever persisted when the caller actually supplied one this
        // invocation — never for the cloud auto-literal, and never a
        // redundant rewrite of an already-stored value.
        if (loginRedirectUri) {
          state.setAdminClientRedirectUri(loginRedirectUri);
        }
        state.setNeedsReauthentication(false);
        // Opportunistic: capture whatever the token response actually
        // returned. Cloud's AICMCPClient/AICMCPExchangeClient are confirmed
        // to never return a refresh token today, so this is commonly a
        // no-op there — but the mechanism must not assume that's universal
        // (see the plan doc's Phase E).
        state.setRefreshToken(token.refresh_token);
        state.setIdToken(token.id_token);
        // Opportunistic, one-time enrichment: only at fresh-login time
        // (never on a cache-hit resume or refresh — those never re-enter
        // this switch case), so this never adds a network call to either
        // of those paths. Cloud has no AM SSO session to capture the way
        // ForgeOps/classic's session-capture path does, so this is the
        // closest cloud equivalent — best-effort, must not fail the login.
        try {
          const info = await getTokenInfo({
            amBaseUrl: state.getHost(),
            config: {
              headers: { Authorization: `Bearer ${token.access_token}` },
            },
            state,
          });
          token.tokenInfo = {
            sub: info.sub,
            tokenName: info.tokenName,
            realm: info.realm,
            auditTrackingId: info.auditTrackingId,
          };
        } catch (error) {
          debugMessage({
            message: `AuthenticateOps.getTokensInteractive: opportunistic getTokenInfo() enrichment failed, continuing without it: ${error}`,
            state,
          });
        }
        // Wires the primary bearer token and the on-demand AM credential
        // provider (see applyCloudInteractiveToken's own comment).
        knownUsername = await applyCloudInteractiveToken({ token, state });
        state.setTokenRefreshHandler(
          buildBrowserTokenRefreshHandler({
            deploymentType: resolvedDeploymentType,
            initialToken: token,
            state,
          })
        );
        break;
      }
      case Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY: {
        // Fully customer-controlled, so unlike cloud there is no built-in
        // client id to fall back to — this is mandatory here (see the plan
        // doc's Phase C).
        const clientId = loginClientId || state.getAdminClientId();
        if (!clientId) {
          throw new FrodoError(
            `Browser login on ForgeOps requires an OAuth2 client id. Pass --login-client-id (or set FRODO_LOGIN_CLIENT_ID), pointing at a public client registered in your realm's own OAuth2 provider. See BROWSER_LOGIN.md for the recommended client and session-capture-script setup.`
          );
        }
        // Mirrors FORGEOPS_ADMIN_DEFAULT_SCOPES (same permission set as
        // today's synthetic admin login, just via a different mechanism).
        const scope = loginScope || forgeopsAdminScopes;
        // Shared with the non-interactive synthetic flow's own
        // --login-redirect-uri (state.getAdminClientRedirectUri()) — same
        // fallback pattern loginClientId already uses above.
        const redirectUri =
          loginRedirectUri || state.getAdminClientRedirectUri();
        token = useDeviceFlow
          ? await startDeviceAuthorizationFlow({
              clientId,
              scope,
              promptHandler,
              timeoutMs,
              state,
            })
          : await runInteractiveAuthorizationCodeFlow({
              clientId,
              scope,
              redirectUri,
              promptHandler,
              timeoutMs,
              state,
            });
        state.setAuthMode('interactive');
        state.setBrowserLoginClientId(clientId);
        state.setBrowserLoginScope(scope);
        // Only ever persisted when the caller actually supplied one this
        // invocation — never a redundant rewrite of an already-stored value.
        if (loginRedirectUri) {
          state.setAdminClientRedirectUri(loginRedirectUri);
        }
        state.setNeedsReauthentication(false);
        state.setRefreshToken(token.refresh_token);
        state.setIdToken(token.id_token);
        // Chooses between the session-capture script (recommended) and the
        // Tier A/B bearer-token fallback — see applyForgeopsInteractiveToken.
        knownUsername = await applyForgeopsInteractiveToken({ token, state });
        state.setTokenRefreshHandler(
          buildBrowserTokenRefreshHandler({
            deploymentType: resolvedDeploymentType,
            initialToken: token,
            state,
          })
        );
        break;
      }
      case Constants.CLASSIC_DEPLOYMENT_TYPE_KEY: {
        // Fully customer-controlled, same as ForgeOps — no built-in client.
        const clientId = loginClientId || state.getAdminClientId();
        if (!clientId) {
          throw new FrodoError(
            `Browser login on classic requires an OAuth2 client id. Pass --login-client-id (or set FRODO_LOGIN_CLIENT_ID), pointing at a public client registered in your realm's own OAuth2 provider (classic doesn't ship one enabled by default — see BROWSER_LOGIN.md's classic section). Your client must also have a session-capture script configured; classic has no bearer-token fallback.`
          );
        }
        // Classic has no IDM-domain scope concept at all — an identity-only
        // scope is all a session-capture-script login needs.
        const scope = loginScope || s.OpenIdScope;
        // Shared with the non-interactive synthetic flow's own
        // --login-redirect-uri (state.getAdminClientRedirectUri()) — same
        // fallback pattern loginClientId already uses above.
        const redirectUri =
          loginRedirectUri || state.getAdminClientRedirectUri();
        token = useDeviceFlow
          ? await startDeviceAuthorizationFlow({
              clientId,
              scope,
              promptHandler,
              timeoutMs,
              state,
            })
          : await runInteractiveAuthorizationCodeFlow({
              clientId,
              scope,
              redirectUri,
              promptHandler,
              timeoutMs,
              state,
            });
        state.setAuthMode('interactive');
        state.setBrowserLoginClientId(clientId);
        state.setBrowserLoginScope(scope);
        // Only ever persisted when the caller actually supplied one this
        // invocation — never a redundant rewrite of an already-stored value.
        if (loginRedirectUri) {
          state.setAdminClientRedirectUri(loginRedirectUri);
        }
        state.setNeedsReauthentication(false);
        state.setRefreshToken(token.refresh_token);
        state.setIdToken(token.id_token);
        knownUsername = await applyClassicInteractiveToken({ token, state });
        state.setTokenRefreshHandler(
          buildBrowserTokenRefreshHandler({
            deploymentType: resolvedDeploymentType,
            initialToken: token,
            state,
          })
        );
        break;
      }
      default:
        throw new FrodoError(
          `Browser login is not yet implemented for deployment type '${resolvedDeploymentType}'. Supported: ${Constants.CLOUD_DEPLOYMENT_TYPE_KEY}, ${Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY}, ${Constants.CLASSIC_DEPLOYMENT_TYPE_KEY}.`
        );
    }

    // One resolution, shared by both the cache's subject index and the
    // returned Tokens.subject, so `frodo login`'s success message and
    // `frodo session list` always agree on who's actually logged in.
    const resolvedSubject = await resolveBrowserLoginSubject({
      rawSubject: getBrowserLoginSubject(token),
      knownUsername,
      deploymentType: resolvedDeploymentType,
      state,
    });
    // Mirrors getTokens()'s own non-interactive username/password branch,
    // which already calls state.setUsername() — extended here so a browser
    // login leaves the same trail, giving determineCallerTrustTier()
    // (CallerTrustTierOps.ts) a uniform way to look up "who is the current
    // caller" via frodo.user.readUser() regardless of auth mode.
    state.setUsername(resolvedSubject);
    // Cacheable like any other AccessTokenMetaType, regardless of whether a
    // refresh token came back — see TokenCacheOps.ts's generateSessionKey(),
    // which falls back to a master-key-only cache-entry encryption key when
    // there's no refresh token to bind to instead, so a browser-login
    // session stays reusable across CLI invocations either way.
    if (state.getUseTokenCache()) {
      await saveCachedToken({
        tokenType: 'browserUserBearer',
        token,
        subject: resolvedSubject,
        state,
      });
    }

    const tokens: Tokens = {
      bearerToken: state.getBearerTokenMeta(),
      userSessionToken: state.getUserSessionTokenMeta(),
      pfBearerToken: state.getPfBearerTokenMeta(),
      subject: resolvedSubject,
      host: state.getHost(),
      realm: state.getRealm() ? state.getRealm() : 'root',
    };
    debugMessage({
      message: `AuthenticateOps.getTokensInteractive: end with tokens`,
      state,
    });
    return tokens;
  } catch (error) {
    debugMessage({
      message: `AuthenticateOps.getTokensInteractive: Error getting tokens: ${error} Stack: ${error.stack}`,
      state,
    });
    throw new FrodoError(`Error getting tokens interactively`, error);
  }
}

/** Best-effort subject string for an interactively-obtained token: the JWT `sub` claim, or a generic fallback if the token isn't a decodable JWT. */
function getBrowserLoginSubject(token: AccessTokenMetaType): string {
  try {
    const payload = decodeJwtPayload(token.access_token);
    if (typeof payload.sub === 'string') {
      return payload.sub;
    }
  } catch {
    // fall through to the generic fallback below
  }
  return 'browser login';
}

/**
 * The JWT `sub` claim to record in TokenCacheOps.ts's subject side-index
 * for a token *refresh* (not a fresh login — see resolveBrowserLoginSubject
 * for that), or `undefined` when there's nothing worth recording.
 * Deliberately never does an IDM lookup: a refresh happens far more often
 * than a login, and the identity it represents was already resolved (to a
 * real username, wherever one was available) at login time — that value is
 * still sitting in the index. Returning `undefined` here (rather than the
 * generic 'browser login' fallback) is how the caller says "leave the
 * existing, better value alone" — see recordSubjectIndexEntry()'s comment.
 */
function browserLoginJwtSubjectOrUndefined(
  token: AccessTokenMetaType
): string | undefined {
  const subject = getBrowserLoginSubject(token);
  return subject === 'browser login' ? undefined : subject;
}

/**
 * Resolves the real, human-readable subject for a fresh browser login —
 * used for both the returned `Tokens.subject` and the cache's subject
 * side-index, so `frodo login`'s success message and `frodo session list`
 * always agree.
 * @param rawSubject the JWT `sub` claim decoded from the bearer token (see getBrowserLoginSubject), or its generic 'browser login' fallback
 * @param knownUsername a real username already resolved during this login by applyCloudInteractiveToken()/applyForgeopsInteractiveToken()/applyClassicInteractiveToken() (from a session-capture step), if any — always used as-is when present, since it's free and guaranteed accurate
 * @param deploymentType the resolved deployment type for this login
 */
async function resolveBrowserLoginSubject({
  rawSubject,
  knownUsername,
  deploymentType,
  state,
}: {
  rawSubject: string;
  knownUsername: string | undefined;
  deploymentType: string;
  state: State;
}): Promise<string> {
  if (knownUsername) {
    return knownUsername;
  }
  // Classic has no IDM, but it also never reaches this branch in practice:
  // applyClassicInteractiveToken() always resolves knownUsername via its
  // mandatory session-capture step (no bearer-token fallback exists for
  // classic at all — see that function's own comment), so there is nothing
  // more to try here for it.
  if (deploymentType === Constants.CLASSIC_DEPLOYMENT_TYPE_KEY) {
    return rawSubject;
  }
  // Cloud (always — it never runs a session-capture step) and ForgeOps
  // (only its unrecommended, no-session-capture Tier-B bearer-token
  // fallback) both have IDM available, so resolve the raw subject against
  // it. Best-effort: never let a failed lookup break an otherwise
  // successful login.
  try {
    const identity = await resolveIdentity({ idOrDn: rawSubject, state });
    if (identity.username) {
      return identity.username;
    }
  } catch {
    // fall through to the raw subject below
  }
  return rawSubject;
}
