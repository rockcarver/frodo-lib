import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JwkRsa } from '../ops/JoseOps';
import { FeatureInterface } from '../api/cloud/FeatureApi';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
);

export interface StateInterface {
  // connection settings
  host?: string;
  username?: string;
  password?: string;
  realm?: string;
  deploymentType?: string;
  allowInsecureConnection?: boolean;
  // customize authentication
  authenticationHeaderOverrides?: Record<string, string>;
  authenticationService?: string;
  // cookie settings
  cookieName?: string;
  cookieValue?: string;
  // feature settings
  features?: FeatureInterface[];
  // service account settings
  serviceAccountId?: string;
  serviceAccountJwk?: JwkRsa;
  // bearer token settings
  useBearerTokenForAmApis?: boolean;
  bearerToken?: string;
  // log api settings
  logApiKey?: string;
  logApiSecret?: string;
  // versions
  amVersion?: string;
  frodoVersion?: string;
  // miscellaneous settings
  connectionProfilesPath?: string;
  masterKeyPath?: string;
  outputFile?: string;
  directory?: string;
  // output handler settings
  printHandler?: (
    message: string | object,
    type?: string,
    newline?: boolean
  ) => void;
  verboseHandler?: (message: string | object) => void;
  verbose?: boolean;
  debugHandler?: (message: string | object) => void;
  debug?: boolean;
  curlirizeHandler?: (message: string) => void;
  curlirize?: boolean;
  createProgressHandler?: (
    type: string,
    total?: number,
    message?: string
  ) => void;
  updateProgressHandler?: (message: string) => void;
  stopProgressHandler?: (message: string, status?: string) => void;
}

const globalState: StateInterface = {
  authenticationHeaderOverrides: {},
  printHandler: (message: string | object) => {
    if (!message) return;
    if (typeof message === 'object') {
      console.dir(message, { depth: 3 });
    } else {
      console.log(message);
    }
  },
  verboseHandler: (message: string | object) => {
    if (!message) return;
    if (getVerbose()) {
      if (typeof message === 'object') {
        console.dir(message, { depth: 3 });
      } else {
        console.log(message);
      }
    }
  },
  debugHandler: (message: string | object) => {
    if (!message) return;
    if (getDebug()) {
      if (typeof message === 'object') {
        console.dir(message, { depth: 6 });
      } else {
        console.log(message);
      }
    }
  },
  curlirizeHandler: (message: string) => {
    if (!message) return;
    if (getDebug()) {
      console.log(message);
    }
  },
};

export default class State {
  state: StateInterface = { ...globalState };

  constructor(initialState: StateInterface) {
    this.state = { ...this.state, ...initialState };
  }

  setHost(host: string) {
    this.state.host = host;
  }
  getHost() {
    return this.state.host || process.env.FRODO_HOST;
  }

  /**
   * @deprecated since v0.17.0 use `setHost(host: string)` instead
   */
  setTenant(tenant: string) {
    this.setHost(tenant);
  }
  /**
   * @deprecated since v0.17.0 use `getHost` instead
   */
  getTenant() {
    return this.getHost();
  }

  setUsername(username: string) {
    this.state.username = username;
  }
  getUsername() {
    return this.state.username || process.env.FRODO_USERNAME;
  }

  setPassword(password: string) {
    this.state.password = password;
  }
  getPassword() {
    return this.state.password || process.env.FRODO_PASSWORD;
  }

  setRealm(realm: string) {
    this.state.realm = realm;
  }
  getRealm() {
    return this.state.realm || process.env.FRODO_REALM;
  }

  setDeploymentType(type: string) {
    this.state.deploymentType = type;
  }
  getDeploymentType() {
    return this.state.deploymentType;
  }

  setAllowInsecureConnection(allowInsecureConnection: boolean) {
    this.state.allowInsecureConnection = allowInsecureConnection;
  }
  getAllowInsecureConnection() {
    return this.state.allowInsecureConnection;
  }

  setCookieName(name: string) {
    this.state.cookieName = name;
  }
  getCookieName() {
    return this.state.cookieName;
  }
  setCookieValue(value: string) {
    this.state.cookieValue = value;
  }
  getCookieValue() {
    return this.state.cookieValue;
  }

  setFeatures(features: FeatureInterface[]) {
    this.state.features = features;
  }
  getFeatures() {
    return this.state.features;
  }

  setAuthenticationHeaderOverrides(overrides: Record<string, string>) {
    this.state.authenticationHeaderOverrides = overrides;
  }
  getAuthenticationHeaderOverrides() {
    return this.state.authenticationHeaderOverrides;
  }
  setAuthenticationService(service: string) {
    this.state.authenticationService = service;
  }
  getAuthenticationService() {
    return (
      this.state.authenticationService ||
      process.env.FRODO_AUTHENTICATION_SERVICE
    );
  }

  setServiceAccountId(uuid: string) {
    this.state.serviceAccountId = uuid;
  }
  getServiceAccountId(): string {
    return this.state.serviceAccountId || process.env.FRODO_SA_ID;
  }
  setServiceAccountJwk(jwk: JwkRsa) {
    this.state.serviceAccountJwk = { ...jwk };
  }
  getServiceAccountJwk(): JwkRsa {
    return (
      this.state.serviceAccountJwk ||
      (process.env.FRODO_SA_JWK
        ? JSON.parse(process.env.FRODO_SA_JWK)
        : undefined)
    );
  }

  setUseBearerTokenForAmApis(useBearerTokenForAmApis: boolean) {
    this.state.useBearerTokenForAmApis = useBearerTokenForAmApis;
  }
  getUseBearerTokenForAmApis() {
    return this.state.useBearerTokenForAmApis;
  }
  setBearerToken(token: string) {
    this.state.bearerToken = token;
  }
  getBearerToken() {
    return this.state.bearerToken;
  }

  setLogApiKey(key: string) {
    this.state.logApiKey = key;
  }
  getLogApiKey() {
    return this.state.logApiKey || process.env.FRODO_LOG_KEY;
  }
  setLogApiSecret(secret: string) {
    this.state.logApiSecret = secret;
  }
  getLogApiSecret() {
    return this.state.logApiSecret || process.env.FRODO_LOG_SECRET;
  }

  setAmVersion(version: string) {
    this.state.amVersion = version;
  }
  getAmVersion() {
    return this.state.amVersion;
  }

  setFrodoVersion(version: string) {
    this.state.frodoVersion = version;
  }
  getFrodoVersion() {
    return this.state.frodoVersion || `v${pkg.version} [${process.version}]`;
  }

  setConnectionProfilesPath(path: string) {
    this.state.connectionProfilesPath = path;
  }
  getConnectionProfilesPath() {
    return this.state.connectionProfilesPath;
  }

  setMasterKeyPath(path: string) {
    this.state.masterKeyPath = path;
  }
  getMasterKeyPath() {
    return this.state.masterKeyPath;
  }

  setOutputFile(file: string) {
    this.state.outputFile = file;
  }
  getOutputFile() {
    return this.state.outputFile;
  }

  setDirectory(directory: string) {
    this.state.directory = directory;
  }
  getDirectory() {
    return this.state.directory;
  }

  setCurlirizeHandler(handler: (message: string) => void) {
    this.state.curlirizeHandler = handler;
  }
  getCurlirizeHandler() {
    return this.state.curlirizeHandler;
  }
  setCurlirize(curlirize: boolean) {
    this.state.curlirize = curlirize;
  }
  getCurlirize(): boolean {
    return this.state.curlirize;
  }

  setCreateProgressHandler(
    handler: (type: string, total?: number, message?: string) => void
  ) {
    this.state.createProgressHandler = handler;
  }
  getCreateProgressHandler() {
    return this.state.createProgressHandler;
  }
  setUpdateProgressHandler(handler: (message: string) => void) {
    this.state.updateProgressHandler = handler;
  }
  getUpdateProgressHandler() {
    return this.state.updateProgressHandler;
  }
  setStopProgressHandler(handler: (message: string, status?: string) => void) {
    this.state.stopProgressHandler = handler;
  }
  getStopProgressHandler() {
    return this.state.stopProgressHandler;
  }

  // global state

  setPrintHandler(
    handler: (
      message: string | object,
      type?: string,
      newline?: boolean
    ) => void
  ) {
    globalState.printHandler = handler;
  }
  getPrintHandler() {
    return globalState.printHandler;
  }

  setVerboseHandler(handler: (message: string | object) => void) {
    globalState.verboseHandler = handler;
  }
  getVerboseHandler() {
    return globalState.verboseHandler;
  }
  setVerbose(verbose: boolean) {
    globalState.verbose = verbose;
  }
  getVerbose(): boolean {
    return globalState.verbose;
  }

  setDebugHandler(handler: (message: string | object) => void) {
    globalState.debugHandler = handler;
  }
  getDebugHandler() {
    return globalState.debugHandler;
  }
  setDebug(debug: boolean) {
    globalState.debug = debug;
  }
  getDebug(): boolean {
    return globalState.debug || process.env.FRODO_DEBUG !== undefined;
  }
}

// export const setHost = (host: string) => (globalState.host = host);
// export const getHost = () => globalState.host || process.env.FRODO_HOST;

// /**
//  * @deprecated since v0.17.0 use `setHost(host: string)` instead
//  */
// export const setTenant = setHost;
// /**
//  * @deprecated since v0.17.0 use `getHost` instead
//  */
// export const getTenant = getHost;

// export const setUsername = (username: string) =>
//   (globalState.username = username);
// export const getUsername = () =>
//   globalState.username || process.env.FRODO_USERNAME;

// export const setPassword = (password: string) =>
//   (globalState.password = password);
// export const getPassword = () =>
//   globalState.password || process.env.FRODO_PASSWORD;

// export const setRealm = (realm: string) => (globalState.realm = realm);
// export const getRealm = () => globalState.realm || process.env.FRODO_REALM;

// export const setDeploymentType = (type: string) =>
//   (globalState.deploymentType = type);
// export const getDeploymentType = () => globalState.deploymentType;

// export const setAllowInsecureConnection = (allowInsecureConnection: boolean) =>
//   (globalState.allowInsecureConnection = allowInsecureConnection);
// export const getAllowInsecureConnection = () =>
//   globalState['allowInsecureConnection'];

// export const setCookieName = (name: string) => (globalState.cookieName = name);
// export const getCookieName = () => globalState.cookieName;
// export const setCookieValue = (value: string) =>
//   (globalState.cookieValue = value);
// export const getCookieValue = () => globalState.cookieValue;

// export const setAuthenticationHeaderOverrides = (
//   overrides: Record<string, string>
// ) => (globalState.authenticationHeaderOverrides = overrides);
// export const getAuthenticationHeaderOverrides = () =>
//   globalState.authenticationHeaderOverrides;
// export const setAuthenticationService = (service: string) =>
//   (globalState.authenticationService = service);
// export const getAuthenticationService = () =>
//   globalState.authenticationService || process.env.FRODO_AUTHENTICATION_SERVICE;

// export const setServiceAccountId = (uuid: string) =>
//   (globalState.serviceAccountId = uuid);
// export const getServiceAccountId = (): string =>
//   globalState.serviceAccountId || process.env.FRODO_SA_ID;
// export const setServiceAccountJwk = (jwk: JwkRsa) =>
//   (globalState.serviceAccountJwk = { ...jwk });
// export const getServiceAccountJwk = (): JwkRsa =>
//   globalState.serviceAccountJwk ||
//   (process.env.FRODO_SA_JWK ? JSON.parse(process.env.FRODO_SA_JWK) : undefined);

// export const setUseBearerTokenForAmApis = (useBearerTokenForAmApis: boolean) =>
//   (globalState.useBearerTokenForAmApis = useBearerTokenForAmApis);
// export const getUseBearerTokenForAmApis = () =>
//   globalState.useBearerTokenForAmApis;
// export const setBearerToken = (token: string) =>
//   (globalState.bearerToken = token);
// export const getBearerToken = () => globalState.bearerToken;

// export const setLogApiKey = (key: string) => (globalState.logApiKey = key);
// export const getLogApiKey = () =>
//   globalState.logApiKey || process.env.FRODO_LOG_KEY;
// export const setLogApiSecret = (secret: string) =>
//   (globalState.logApiSecret = secret);
// export const getLogApiSecret = () =>
//   globalState.logApiSecret || process.env.FRODO_LOG_SECRET;

// export const setAmVersion = (version: string) =>
//   (globalState.amVersion = version);
// export const getAmVersion = () => globalState.amVersion;

// export const setFrodoVersion = (version: string) =>
//   (globalState.frodoVersion = version);
// export const getFrodoVersion = () =>
//   globalState.frodoVersion || `v${pkg.version} [${process.version}]`;

// export const setConnectionProfilesPath = (path: string) =>
//   (globalState.connectionProfilesPath = path);
// export const getConnectionProfilesPath = () =>
//   globalState.connectionProfilesPath;

// export const setMasterKeyPath = (path: string) =>
//   (globalState.masterKeyPath = path);
// export const getMasterKeyPath = () => globalState.masterKeyPath;

// export const setOutputFile = (file: string) => (globalState.outputFile = file);
// export const getOutputFile = () => globalState.outputFile;

// export const setDirectory = (directory: string) =>
//   (globalState.directory = directory);
// export const getDirectory = () => globalState.directory;

// export const setPrintHandler = (
//   handler: (message: string | object, type?: string, newline?: boolean) => void
// ) => (globalState.printHandler = handler);
// export const getPrintHandler = () => globalState.printHandler;

// export const setVerboseHandler = (
//   handler: (message: string | object) => void
// ) => (globalState.verboseHandler = handler);
// export const getVerboseHandler = () => globalState.verboseHandler;
// export const setVerbose = (verbose: boolean) => (globalState.verbose = verbose);
export const getVerbose = (): boolean => globalState.verbose;

// export const setDebugHandler = (handler: (message: string | object) => void) =>
//   (globalState.debugHandler = handler);
// export const getDebugHandler = () => globalState.debugHandler;
// export const setDebug = (debug: boolean) => (globalState.debug = debug);
export const getDebug = (): boolean =>
  globalState.debug || process.env.FRODO_DEBUG !== undefined;

// export const setCurlirizeHandler = (handler: (message: string) => void) =>
//   (globalState.curlirizeHandler = handler);
// export const getCurlirizeHandler = () => globalState.curlirizeHandler;
// export const setCurlirize = (curlirize: boolean) =>
//   (globalState.curlirize = curlirize);
// export const getCurlirize = (): boolean => globalState.curlirize;

// export const setCreateProgressHandler = (
//   handler: (type: string, total?: number, message?: string) => void
// ) => (globalState.createProgressHandler = handler);
// export const getCreateProgressHandler = () => globalState.createProgressHandler;
// export const setUpdateProgressHandler = (handler: (message: string) => void) =>
//   (globalState.updateProgressHandler = handler);
// export const getUpdateProgressHandler = () => globalState.updateProgressHandler;
// export const setStopProgressHandler = (
//   handler: (message: string, status?: string) => void
// ) => (globalState.stopProgressHandler = handler);
// export const getStopProgressHandler = () => globalState.stopProgressHandler;

/**
 * @deprecated since version v0.17.0. Import state:
 *
 * ```import { state } from '@rockcarver/frodo-lib';```
 *
 * then call functions:
 *
 * ```const username = state.getUsername();```
 */
// export default {
//   session: {
//     setHost,
//     getHost,

//     setTenant,
//     getTenant,

//     setUsername,
//     getUsername,

//     setPassword,
//     getPassword,

//     setRealm,
//     getRealm,

//     setDeploymentType,
//     getDeploymentType,

//     setAllowInsecureConnection,
//     getAllowInsecureConnection,

//     setCookieName,
//     getCookieName,
//     setCookieValue,
//     getCookieValue,

//     setAuthenticationHeaderOverrides,
//     getAuthenticationHeaderOverrides,
//     setAuthenticationService,
//     getAuthenticationService,

//     setServiceAccountId,
//     getServiceAccountId,
//     setServiceAccountJwk,
//     getServiceAccountJwk,

//     setUseBearerTokenForAmApis,
//     getUseBearerTokenForAmApis,
//     setBearerToken,
//     getBearerToken,

//     setLogApiKey,
//     getLogApiKey,
//     setLogApiSecret,
//     getLogApiSecret,

//     setAmVersion,
//     getAmVersion,

//     setFrodoVersion,
//     getFrodoVersion,

//     setConnectionProfilesPath,
//     getConnectionProfilesPath,

//     setMasterKeyPath,
//     getMasterKeyPath,

//     setOutputFile,
//     getOutputFile,

//     setDirectory,
//     getDirectory,

//     setPrintHandler,
//     getPrintHandler,

//     setVerboseHandler,
//     getVerboseHandler,
//     setVerbose,
//     getVerbose,

//     setDebugHandler,
//     getDebugHandler,
//     setDebug,
//     getDebug,

//     setCurlirizeHandler,
//     getCurlirizeHandler,
//     setCurlirize,
//     getCurlirize,

//     setCreateProgressHandler,
//     getCreateProgressHandler,
//     setUpdateProgressHandler,
//     getUpdateProgressHandler,
//     setStopProgressHandler,
//     getStopProgressHandler,
//   },
// };
