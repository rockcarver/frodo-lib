import url from 'url';
import { createHash, randomBytes } from 'crypto';
import readlineSync from 'readline-sync';
import { encodeBase64Url } from '../api/utils/Base64';
import * as state from '../shared/State';
import * as globalConfig from '../storage/StaticStorage';
import { debugMessage, printMessage, verboseMessage } from './utils/Console';
import { getServerInfo, getServerVersionInfo } from '../api/ServerInfoApi';
import { step } from '../api/AuthenticateApi';
import { accessToken, authorize } from '../api/OAuth2OIDCApi';
import { getConnectionProfile } from './ConnectionProfileOps';
import { v4 } from 'uuid';
import { parseUrl } from '../api/utils/ApiUtils';
import { JwkRsa, createSignedJwtToken } from './JoseOps';
import { getServiceAccount } from './cloud/ServiceAccountOps';
import { isValidUrl } from './utils/OpsUtils';

const adminClientPassword = 'doesnotmatter';
const redirectUrlTemplate = '/platform/appAuthHelperRedirect.html';

const cloudIdmAdminScopes = 'openid fr:idm:* fr:idc:esv:*';
const forgeopsIdmAdminScopes = 'openid fr:idm:*';
const serviceAccountScopes = 'fr:am:* fr:idm:* fr:idc:esv:* fr:idc:promotion:*';

let adminClientId = 'idmAdminClient';

/**
 * Helper function to get cookie name
 * @returns {String} cookie name
 */
async function determineCookieName() {
  try {
    const data = await getServerInfo();
    debugMessage(
      `AuthenticateOps.getCookieName: cookieName=${data.cookieName}`
    );
    return data.cookieName;
  } catch (error) {
    printMessage(`Error getting cookie name: ${error}`, 'error');
    debugMessage(error.stack);
    return null;
  }
}

/**
 * Helper function to determine if this is a setup mfa prompt in the ID Cloud tenant admin login journey
 * @param {Object} payload response from the previous authentication journey step
 * @returns {Object} an object indicating if 2fa is required and the original payload
 */
function checkAndHandle2FA(payload) {
  debugMessage(`AuthenticateOps.checkAndHandle2FA: start`);
  // let skippable = false;
  if ('callbacks' in payload) {
    for (const callback of payload.callbacks) {
      // select localAuthentication if Admin Federation is enabled
      if (callback.type === 'SelectIdPCallback') {
        debugMessage(
          `AuthenticateOps.checkAndHandle2FA: Admin federation enabled. Allowed providers:`
        );
        let localAuth = false;
        for (const value of callback.output[0].value) {
          debugMessage(`${value.provider}`);
          if (value.provider === 'localAuthentication') {
            localAuth = true;
          }
        }
        if (localAuth) {
          debugMessage(`local auth allowed`);
          callback.input[0].value = 'localAuthentication';
        } else {
          debugMessage(`local auth NOT allowed`);
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
          //   nextStep: true,
          //   need2fa: true,
          //   factor: 'None',
          //   supported: true,
          //   payload,
          // };
        }
        if (callback.input[0].value.includes('webAuthnOutcome')) {
          // webauthn!!!
          debugMessage(
            `AuthenticateOps.checkAndHandle2FA: end [need2fa=true, unsupported factor: webauthn]`
          );
          return {
            nextStep: false,
            need2fa: true,
            factor: 'WebAuthN',
            supported: false,
            payload,
          };
        }
      }
      if (callback.type === 'NameCallback') {
        if (callback.output[0].value.includes('code')) {
          // skippable = false;
          debugMessage(
            `AuthenticateOps.checkAndHandle2FA: need2fa=true, skippable=false`
          );
          printMessage('2FA is enabled and required for this user...');
          const code = readlineSync.question(`${callback.output[0].value}: `);
          callback.input[0].value = code;
          debugMessage(
            `AuthenticateOps.checkAndHandle2FA: end [need2fa=true, skippable=false, factor=Code]`
          );
          return {
            nextStep: true,
            need2fa: true,
            factor: 'Code',
            supported: true,
            payload,
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
    debugMessage(`AuthenticateOps.checkAndHandle2FA: end [need2fa=false]`);
    // debugMessage(payload);
    return {
      nextStep: true,
      need2fa: false,
      factor: 'None',
      supported: true,
      payload,
    };
  }
  debugMessage(`AuthenticateOps.checkAndHandle2FA: end [need2fa=false]`);
  // debugMessage(payload);
  return {
    nextStep: false,
    need2fa: false,
    factor: 'None',
    supported: true,
    payload,
  };
}

/**
 * Helper function to set the default realm by deployment type
 * @param {string} deploymentType deployment type
 */
function determineDefaultRealm(deploymentType: string) {
  if (
    !state.getRealm() ||
    state.getRealm() === globalConfig.DEFAULT_REALM_KEY
  ) {
    state.setRealm(globalConfig.DEPLOYMENT_TYPE_REALM_MAP[deploymentType]);
  }
}

/**
 * Helper function to determine the deployment type
 * @returns {Promise<string>} deployment type
 */
async function determineDeploymentType(): Promise<string> {
  const cookieValue = state.getCookieValue();
  // https://bugster.forgerock.org/jira/browse/FRAAS-13018
  // There is a chance that this will be blocked due to security concerns and thus is probably best not to keep active
  // if (!cookieValue && getUseBearerTokenForAmApis()) {
  //   const token = await getTokenInfo();
  //   cookieValue = token.sessionToken;
  //   setCookieValue(cookieValue);
  // }

  // if we are using a service account, we know it's cloud
  if (state.getUseBearerTokenForAmApis())
    return globalConfig.CLOUD_DEPLOYMENT_TYPE_KEY;

  const fidcClientId = 'idmAdminClient';
  const forgeopsClientId = 'idm-admin-ui';

  const verifier = encodeBase64Url(randomBytes(32));
  const challenge = encodeBase64Url(
    createHash('sha256').update(verifier).digest()
  );
  const challengeMethod = 'S256';
  const redirectURL = url.resolve(state.getHost(), redirectUrlTemplate);

  const config = {
    maxRedirects: 0,
    headers: {
      [state.getCookieName()]: state.getCookieValue(),
    },
  };
  let bodyFormData = `redirect_uri=${redirectURL}&scope=${cloudIdmAdminScopes}&response_type=code&client_id=${fidcClientId}&csrf=${cookieValue}&decision=allow&code_challenge=${challenge}&code_challenge_method=${challengeMethod}`;

  let deploymentType = globalConfig.CLASSIC_DEPLOYMENT_TYPE_KEY;
  try {
    await authorize(bodyFormData, config);
  } catch (e) {
    // debugMessage(e.response);
    if (
      e.response?.status === 302 &&
      e.response.headers?.location?.indexOf('code=') > -1
    ) {
      verboseMessage(`ForgeRock Identity Cloud`['brightCyan'] + ` detected.`);
      deploymentType = globalConfig.CLOUD_DEPLOYMENT_TYPE_KEY;
    } else {
      try {
        bodyFormData = `redirect_uri=${redirectURL}&scope=${forgeopsIdmAdminScopes}&response_type=code&client_id=${forgeopsClientId}&csrf=${state.getCookieValue()}&decision=allow&code_challenge=${challenge}&code_challenge_method=${challengeMethod}`;
        await authorize(bodyFormData, config);
      } catch (ex) {
        if (
          ex.response?.status === 302 &&
          ex.response.headers?.location?.indexOf('code=') > -1
        ) {
          adminClientId = forgeopsClientId;
          verboseMessage(`ForgeOps deployment`['brightCyan'] + ` detected.`);
          deploymentType = globalConfig.FORGEOPS_DEPLOYMENT_TYPE_KEY;
        } else {
          verboseMessage(`Classic deployment`['brightCyan'] + ` detected.`);
        }
      }
    }
  }
  return deploymentType;
}

/**
 * Helper function to extract the semantic version string from a version info object
 * @param {Object} versionInfo version info object
 * @returns {String} semantic version
 */
async function getSemanticVersion(versionInfo) {
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
 * @returns {string} Session token or null
 */
async function authenticate(
  username: string,
  password: string
): Promise<string> {
  debugMessage(`AuthenticateOps.authenticate: start`);
  const config = {
    headers: {
      'X-OpenAM-Username': username,
      'X-OpenAM-Password': password,
    },
  };
  let response = await step({}, config);

  let skip2FA = null;
  let steps = 0;
  const maxSteps = 3;
  do {
    skip2FA = checkAndHandle2FA(response);

    // throw exception if 2fa required but factor not supported by frodo (e.g. WebAuthN)
    if (!skip2FA.supported) {
      throw new Error(`Unsupported 2FA factor: ${skip2FA.factor}`);
    }

    if (skip2FA.nextStep) {
      steps++;
      response = await step(skip2FA.payload);
    }

    if ('tokenId' in response) {
      debugMessage(
        `AuthenticateOps.authenticate: end [tokenId=${response['tokenId']}]`
      );
      return response['tokenId'] as string;
    }
  } while (skip2FA.nextStep && steps < maxSteps);
  debugMessage(`AuthenticateOps.authenticate: end [no session]`);
  return null;
}

/**
 * Helper function to obtain an oauth2 authorization code
 * @param {string} redirectURL oauth2 redirect uri
 * @param {string} codeChallenge PKCE code challenge
 * @param {string} codeChallengeMethod PKCE code challenge method
 * @returns {string} oauth2 authorization code or null
 */
async function getAuthCode(redirectURL, codeChallenge, codeChallengeMethod) {
  try {
    const bodyFormData = `redirect_uri=${redirectURL}&scope=${
      state.getDeploymentType() === globalConfig.CLOUD_DEPLOYMENT_TYPE_KEY
        ? cloudIdmAdminScopes
        : forgeopsIdmAdminScopes
    }&response_type=code&client_id=${adminClientId}&csrf=${state.getCookieValue()}&decision=allow&code_challenge=${codeChallenge}&code_challenge_method=${codeChallengeMethod}`;
    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      maxRedirects: 0,
    };
    let response = undefined;
    try {
      response = await authorize(bodyFormData, config);
    } catch (error) {
      response = error.response;
    }
    if (response.status < 200 || response.status > 399) {
      printMessage('error getting auth code', 'error');
      printMessage(
        'likely cause: mismatched parameters with OAuth client config',
        'error'
      );
      return null;
    }
    const redirectLocationURL = response.headers?.location;
    const queryObject = url.parse(redirectLocationURL, true).query;
    if ('code' in queryObject) {
      return queryObject.code;
    }
    printMessage('auth code not found', 'error');
    return null;
  } catch (error) {
    printMessage(`error getting auth code - ${error.message}`, 'error');
    printMessage(error.response?.data, 'error');
    debugMessage(error.stack);
    return null;
  }
}

/**
 * Helper function to obtain oauth2 access token
 * @returns {Promise<string | null>} access token or null
 */
async function getAccessTokenForUser(): Promise<string | null> {
  debugMessage(`AuthenticateOps.getAccessTokenForUser: start`);
  try {
    const verifier = encodeBase64Url(randomBytes(32));
    const challenge = encodeBase64Url(
      createHash('sha256').update(verifier).digest()
    );
    const challengeMethod = 'S256';
    const redirectURL = url.resolve(state.getHost(), redirectUrlTemplate);
    const authCode = await getAuthCode(redirectURL, challenge, challengeMethod);
    if (authCode == null) {
      printMessage('error getting auth code', 'error');
      return null;
    }
    let response = null;
    if (state.getDeploymentType() === globalConfig.CLOUD_DEPLOYMENT_TYPE_KEY) {
      const config = {
        auth: {
          username: adminClientId,
          password: adminClientPassword,
        },
      };
      const bodyFormData = `redirect_uri=${redirectURL}&grant_type=authorization_code&code=${authCode}&code_verifier=${verifier}`;
      response = await accessToken(bodyFormData, config);
    } else {
      const bodyFormData = `client_id=${adminClientId}&redirect_uri=${redirectURL}&grant_type=authorization_code&code=${authCode}&code_verifier=${verifier}`;
      response = await accessToken(bodyFormData);
    }
    if ('access_token' in response.data) {
      debugMessage(`AuthenticateOps.getAccessTokenForUser: end with token`);
      return response.data.access_token;
    }
    printMessage('No access token in response.', 'error');
  } catch (error) {
    debugMessage(`Error getting access token for user: ${error}`);
    debugMessage(error.response?.data);
  }
  debugMessage(`AuthenticateOps.getAccessTokenForUser: end without token`);
  return null;
}

function createPayload(serviceAccountId: string) {
  const u = parseUrl(state.getHost());
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
 * Get access token for service account
 * @param {string} serviceAccountId UUID of service account
 * @param {JwkRsa} jwk Java Wek Key
 * @returns {string | null} Access token or null
 */
export async function getAccessTokenForServiceAccount(
  serviceAccountId: string,
  jwk: JwkRsa
): Promise<string | null> {
  debugMessage(`AuthenticateOps.getAccessTokenForServiceAccount: start`);
  const payload = createPayload(serviceAccountId);
  debugMessage(`AuthenticateOps.getAccessTokenForServiceAccount: payload:`);
  debugMessage(payload);
  const jwt = await createSignedJwtToken(payload, jwk);
  debugMessage(`AuthenticateOps.getAccessTokenForServiceAccount: jwt:`);
  debugMessage(jwt);
  const bodyFormData = `assertion=${jwt}&client_id=service-account&grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&scope=${serviceAccountScopes}`;
  const response = await accessToken(bodyFormData);
  if ('access_token' in response.data) {
    debugMessage(`AuthenticateOps.getAccessTokenForServiceAccount: token:`);
    debugMessage(response.data.access_token);
    debugMessage(`AuthenticateOps.getAccessTokenForServiceAccount: end`);
    return response.data.access_token;
  }
  debugMessage(
    `AuthenticateOps.getAccessTokenForServiceAccount: No access token in response.`
  );
  debugMessage(`AuthenticateOps.getAccessTokenForServiceAccount: end`);
  return null;
}

async function determineDeploymentTypeAndDefaultRealmAndVersion() {
  debugMessage(
    `AuthenticateOps.determineDeploymentTypeAndDefaultRealmAndVersion: start`
  );
  if (!state.getDeploymentType()) {
    state.setDeploymentType(await determineDeploymentType());
  }
  determineDefaultRealm(state.getDeploymentType());
  debugMessage(
    `AuthenticateOps.determineDeploymentTypeAndDefaultRealmAndVersion: realm=${state.getRealm()}, type=${state.getDeploymentType()}`
  );

  const versionInfo = await getServerVersionInfo();

  // https://github.com/rockcarver/frodo-cli/issues/109
  debugMessage(`Full version: ${versionInfo.fullVersion}`);

  const version = await getSemanticVersion(versionInfo);
  state.setAmVersion(version);
  debugMessage(
    `AuthenticateOps.determineDeploymentTypeAndDefaultRealmAndVersion: end`
  );
}

async function getLoggedInSubject(): Promise<string> {
  let subjectString = `user ${state.getUsername()}`;
  if (state.getUseBearerTokenForAmApis()) {
    const name = (await getServiceAccount(state.getServiceAccountId())).name;
    subjectString = `service account ${name} [${state.getServiceAccountId()}]`;
  }
  return subjectString;
}

/**
 * Get tokens
 * @param {boolean} forceLoginAsUser true to force login as user even if a service account is available (default: false)
 * @returns {Promise<boolean>} true if tokens were successfully obtained, false otherwise
 */
export async function getTokens(forceLoginAsUser = false): Promise<boolean> {
  debugMessage(`AuthenticateOps.getTokens: start`);
  if (!state.getHost()) {
    printMessage(
      `No host specified and FRODO_HOST env variable not set!`,
      'error'
    );
    return false;
  }
  try {
    // if username/password on cli are empty, try to read from connections.json
    if (
      state.getUsername() == null &&
      state.getPassword() == null &&
      !state.getServiceAccountId() &&
      !state.getServiceAccountJwk()
    ) {
      const conn = await getConnectionProfile();
      if (conn) {
        state.setHost(conn.tenant);
        state.setUsername(conn.username);
        state.setPassword(conn.password);
        state.setAuthenticationService(conn.authenticationService);
        state.setAuthenticationHeaderOverrides(
          conn.authenticationHeaderOverrides
        );
        state.setServiceAccountId(conn.svcacctId);
        state.setServiceAccountJwk(conn.svcacctJwk);
      } else {
        return false;
      }
    }

    // if host is not a valid URL, try to locate a valid URL from connections.json
    if (!isValidUrl(state.getHost())) {
      const conn = await getConnectionProfile();
      if (conn) {
        state.setHost(conn.tenant);
      } else {
        return false;
      }
    }

    // now that we have the full tenant URL we can lookup the cookie name
    state.setCookieName(await determineCookieName());

    // use service account to login?
    if (
      !forceLoginAsUser &&
      state.getServiceAccountId() &&
      state.getServiceAccountJwk()
    ) {
      debugMessage(
        `AuthenticateOps.getTokens: Authenticating with service account ${state.getServiceAccountId()}`
      );
      try {
        const token = await getAccessTokenForServiceAccount(
          state.getServiceAccountId(),
          state.getServiceAccountJwk()
        );
        state.setBearerToken(token);
        state.setUseBearerTokenForAmApis(true);
        await determineDeploymentTypeAndDefaultRealmAndVersion();
      } catch (saErr) {
        debugMessage(saErr.response?.data || saErr);
        throw new Error(
          `Service account login error: ${
            saErr.response?.data?.error_description ||
            saErr.response?.data?.message ||
            saErr
          }`
        );
      }
    }
    // use user account to login
    else if (state.getUsername() && state.getPassword()) {
      debugMessage(
        `AuthenticateOps.getTokens: Authenticating with user account ${state.getUsername()}`
      );
      const token = await authenticate(
        state.getUsername(),
        state.getPassword()
      );
      if (token) state.setCookieValue(token);
      await determineDeploymentTypeAndDefaultRealmAndVersion();
      if (
        state.getCookieValue() &&
        !state.getBearerToken() &&
        (state.getDeploymentType() === globalConfig.CLOUD_DEPLOYMENT_TYPE_KEY ||
          state.getDeploymentType() ===
            globalConfig.FORGEOPS_DEPLOYMENT_TYPE_KEY)
      ) {
        const accessToken = await getAccessTokenForUser();
        if (accessToken) state.setBearerToken(accessToken);
      }
    }
    // incomplete or no credentials
    else {
      printMessage(`Incomplete or no credentials!`, 'error');
      return false;
    }
    if (
      state.getCookieValue() ||
      (state.getUseBearerTokenForAmApis() && state.getBearerToken())
    ) {
      // https://github.com/rockcarver/frodo-cli/issues/102
      printMessage(
        `Connected to ${state.getHost()} [${
          state.getRealm() ? state.getRealm() : 'root'
        }] as ${await getLoggedInSubject()}`,
        'info'
      );
      debugMessage(`AuthenticateOps.getTokens: end with tokens`);
      return true;
    }
  } catch (error) {
    // regular error
    printMessage(error.message, 'error');
    // axios error am api
    printMessage(error.response?.data?.message, 'error');
    // axios error am oauth2 api
    printMessage(error.response?.data?.error_description, 'error');
    // axios error data
    debugMessage(error.response?.data);
    // stack trace
    debugMessage(error.stack || new Error().stack);
  }
  debugMessage(`AuthenticateOps.getTokens: end without tokens`);
  return false;
}
