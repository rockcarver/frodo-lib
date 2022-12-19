import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JwkRsa } from '../ops/JoseOps';

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

const _state: StateInterface = {
  authenticationHeaderOverrides: {},
};

export const setHost = (host: string) => (_state.host = host);
export const getHost = () => _state.host || process.env.FRODO_HOST;

/**
 * @deprecated since v0.17.0 use `setHost(host: string)` instead
 */
export const setTenant = setHost;
/**
 * @deprecated since v0.17.0 use `getHost` instead
 */
export const getTenant = getHost;

export const setUsername = (username: string) => (_state.username = username);
export const getUsername = () => _state.username || process.env.FRODO_USERNAME;

export const setPassword = (password: string) => (_state.password = password);
export const getPassword = () => _state.password || process.env.FRODO_PASSWORD;

export const setRealm = (realm: string) => (_state.realm = realm);
export const getRealm = () => _state.realm || process.env.FRODO_REALM;

export const setDeploymentType = (type: string) =>
  (_state.deploymentType = type);
export const getDeploymentType = () => _state.deploymentType;

export const setAllowInsecureConnection = (allowInsecureConnection: boolean) =>
  (_state.allowInsecureConnection = allowInsecureConnection);
export const getAllowInsecureConnection = () =>
  _state['allowInsecureConnection'];

export const setCookieName = (name: string) => (_state.cookieName = name);
export const getCookieName = () => _state.cookieName;
export const setCookieValue = (value: string) => (_state.cookieValue = value);
export const getCookieValue = () => _state.cookieValue;

export const setAuthenticationHeaderOverrides = (
  overrides: Record<string, string>
) => (_state.authenticationHeaderOverrides = overrides);
export const getAuthenticationHeaderOverrides = () =>
  _state.authenticationHeaderOverrides;
export const setAuthenticationService = (service: string) =>
  (_state.authenticationService = service);
export const getAuthenticationService = () => _state.authenticationService;

export const setServiceAccountId = (uuid: string) =>
  (_state.serviceAccountId = uuid);
export const getServiceAccountId = (): string =>
  _state.serviceAccountId || process.env.FRODO_SA_ID;
export const setServiceAccountJwk = (jwk: JwkRsa) =>
  (_state.serviceAccountJwk = { ...jwk });
export const getServiceAccountJwk = (): JwkRsa =>
  _state.serviceAccountJwk ||
  (process.env.FRODO_SA_JWK ? JSON.parse(process.env.FRODO_SA_JWK) : undefined);

export const setUseBearerTokenForAmApis = (useBearerTokenForAmApis: boolean) =>
  (_state.useBearerTokenForAmApis = useBearerTokenForAmApis);
export const getUseBearerTokenForAmApis = () => _state.useBearerTokenForAmApis;
export const setBearerToken = (token: string) => (_state.bearerToken = token);
export const getBearerToken = () => _state.bearerToken;

export const setLogApiKey = (key: string) => (_state.logApiKey = key);
export const getLogApiKey = () => _state.logApiKey || process.env.FRODO_LOG_KEY;
export const setLogApiSecret = (secret: string) =>
  (_state.logApiSecret = secret);
export const getLogApiSecret = () =>
  _state.logApiSecret || process.env.FRODO_LOG_SECRET;

export const setAmVersion = (version: string) => (_state.amVersion = version);
export const getAmVersion = () => _state.amVersion;

export const setFrodoVersion = (version: string) =>
  (_state.frodoVersion = version);
export const getFrodoVersion = () =>
  _state.frodoVersion || `v${pkg.version} [${process.version}]`;

export const setConnectionProfilesPath = (path: string) =>
  (_state.connectionProfilesPath = path);
export const getConnectionProfilesPath = () => _state.connectionProfilesPath;

export const setMasterKeyPath = (path: string) => (_state.masterKeyPath = path);
export const getMasterKeyPath = () => _state.masterKeyPath;

export const setOutputFile = (file: string) => (_state.outputFile = file);
export const getOutputFile = () => _state.outputFile;

export const setDirectory = (directory: string) =>
  (_state.directory = directory);
export const getDirectory = () => _state.directory;

export const setPrintHandler = (
  handler: (message: string | object, type?: string, newline?: boolean) => void
) => (_state.printHandler = handler);
export const getPrintHandler = () => _state.printHandler;

export const setVerboseHandler = (
  handler: (message: string | object) => void
) => (_state.verboseHandler = handler);
export const getVerboseHandler = () => _state.verboseHandler;
export const setVerbose = (verbose: boolean) => (_state.verbose = verbose);
export const getVerbose = (): boolean => _state.verbose;

export const setDebugHandler = (handler: (message: string | object) => void) =>
  (_state.debugHandler = handler);
export const getDebugHandler = () => _state.debugHandler;
export const setDebug = (debug: boolean) => (_state.debug = debug);
export const getDebug = (): boolean =>
  _state.debug || process.env.FRODO_DEBUG !== undefined;

export const setCurlirizeHandler = (handler: (message: string) => void) =>
  (_state.curlirizeHandler = handler);
export const getCurlirizeHandler = () => _state.curlirizeHandler;
export const setCurlirize = (curlirize: boolean) =>
  (_state.curlirize = curlirize);
export const getCurlirize = (): boolean => _state.curlirize;

export const setCreateProgressHandler = (
  handler: (type: string, total?: number, message?: string) => void
) => (_state.createProgressHandler = handler);
export const getCreateProgressHandler = () => _state.createProgressHandler;
export const setUpdateProgressHandler = (handler: (message: string) => void) =>
  (_state.updateProgressHandler = handler);
export const getUpdateProgressHandler = () => _state.updateProgressHandler;
export const setStopProgressHandler = (
  handler: (message: string, status?: string) => void
) => (_state.stopProgressHandler = handler);
export const getStopProgressHandler = () => _state.stopProgressHandler;

/**
 * @deprecated since version v0.17.0. Import state:
 *
 * ```import { state } from '@rockcarver/frodo-lib';```
 *
 * then call functions:
 *
 * ```const username = state.getUsername();```
 */
export default {
  session: {
    setHost,
    getHost,

    setTenant,
    getTenant,

    setUsername,
    getUsername,

    setPassword,
    getPassword,

    setRealm,
    getRealm,

    setDeploymentType,
    getDeploymentType,

    setAllowInsecureConnection,
    getAllowInsecureConnection,

    setCookieName,
    getCookieName,
    setCookieValue,
    getCookieValue,

    setAuthenticationHeaderOverrides,
    getAuthenticationHeaderOverrides,
    setAuthenticationService,
    getAuthenticationService,

    setServiceAccountId,
    getServiceAccountId,
    setServiceAccountJwk,
    getServiceAccountJwk,

    setUseBearerTokenForAmApis,
    getUseBearerTokenForAmApis,
    setBearerToken,
    getBearerToken,

    setLogApiKey,
    getLogApiKey,
    setLogApiSecret,
    getLogApiSecret,

    setAmVersion,
    getAmVersion,

    setFrodoVersion,
    getFrodoVersion,

    setConnectionProfilesPath,
    getConnectionProfilesPath,

    setMasterKeyPath,
    getMasterKeyPath,

    setOutputFile,
    getOutputFile,

    setDirectory,
    getDirectory,

    setPrintHandler,
    getPrintHandler,

    setVerboseHandler,
    getVerboseHandler,
    setVerbose,
    getVerbose,

    setDebugHandler,
    getDebugHandler,
    setDebug,
    getDebug,

    setCurlirizeHandler,
    getCurlirizeHandler,
    setCurlirize,
    getCurlirize,

    setCreateProgressHandler,
    getCreateProgressHandler,
    setUpdateProgressHandler,
    getUpdateProgressHandler,
    setStopProgressHandler,
    getStopProgressHandler,
  },
};
