import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
);

const _sessionStorage = {
  authenticationHeaderOverrides: {},
};

export default {
  session: {
    setItem: (key, value) => (_sessionStorage[key] = value),
    getItem: (key) => _sessionStorage[key],
    removeItem: (key) => delete _sessionStorage[key],
    raw: _sessionStorage,

    setUsername: (value) => (_sessionStorage['username'] = value),
    getUsername: () => _sessionStorage['username'],

    setPassword: (value) => (_sessionStorage['password'] = value),
    getPassword: () => _sessionStorage['password'],

    setTenant: (value) => (_sessionStorage['tenant'] = value),
    getTenant: () => _sessionStorage['tenant'],

    setDeploymentType: (value) => (_sessionStorage['deploymentType'] = value),
    getDeploymentType: () => _sessionStorage['deploymentType'],

    setRealm: (value) => (_sessionStorage['realm'] = value),
    getRealm: () => _sessionStorage['realm'],

    setCookieName: (value) => (_sessionStorage['cookieName'] = value),
    getCookieName: () => _sessionStorage['cookieName'],
    setCookieValue: (value) => (_sessionStorage['cookieValue'] = value),
    getCookieValue: () => _sessionStorage['cookieValue'],

    setAuthenticationService: (value) =>
      (_sessionStorage['authenticationService'] = value),
    getAuthenticationService: () => _sessionStorage['authenticationService'],
    setAuthenticationHeaderOverrides: (value) =>
      (_sessionStorage['authenticationHeaderOverrides'] = value),
    getAuthenticationHeaderOverrides: () =>
      _sessionStorage['authenticationHeaderOverrides'],

    setBearerToken: (value) => (_sessionStorage['bearerToken'] = value),
    getBearerToken: () => _sessionStorage['bearerToken'],

    setLogApiKey: (value) => (_sessionStorage['logApiKey'] = value),
    getLogApiKey: () => _sessionStorage['logApiKey'],
    setLogApiSecret: (value) => (_sessionStorage['logApiSecret'] = value),
    getLogApiSecret: () => _sessionStorage['logApiSecret'],

    setAmVersion: (value) => (_sessionStorage['amVersion'] = value),
    getAmVersion: () => _sessionStorage['amVersion'],

    setFrodoVersion: (value) => (_sessionStorage['frodoVersion'] = value),
    getFrodoVersion: () =>
      _sessionStorage['frodoVersion'] || `v${pkg.version} [${process.version}]`,

    setAllowInsecureConnection: (value) =>
      (_sessionStorage['insecure'] = value),
    getAllowInsecureConnection: () => _sessionStorage['insecure'],

    setConnectionProfilesPath: (value) =>
      (_sessionStorage['connectionProfilesPath'] = value),
    getConnectionProfilesPath: () => _sessionStorage['connectionProfilesPath'],

    setMasterKeyPath: (value) => (_sessionStorage['masterKeyPath'] = value),
    getMasterKeyPath: () => _sessionStorage['masterKeyPath'],

    setOutputFile: (value) => (_sessionStorage['outputFile'] = value),
    getOutputFile: () => _sessionStorage['outputFile'],

    setDirectory: (value) => (_sessionStorage['directory'] = value),
    getDirectory: () => _sessionStorage['directory'],

    setPrintHandler: (printHandler) =>
      (_sessionStorage['printHandler'] = printHandler),
    getPrintHandler: () => _sessionStorage['printHandler'],

    setErrorHandler: (errorHandler) =>
      (_sessionStorage['errorHandler'] = errorHandler),
    getErrorHandler: () => _sessionStorage['errorHandler'],

    setVerboseHandler: (verboseHandler) =>
      (_sessionStorage['verboseHandler'] = verboseHandler),
    getVerboseHandler: () => _sessionStorage['verboseHandler'],
    setVerbose: (verbose: boolean) => (_sessionStorage['verbose'] = verbose),
    getVerbose: (): boolean => _sessionStorage['verbose'],

    setDebugHandler: (debugHandler) =>
      (_sessionStorage['debugHandler'] = debugHandler),
    getDebugHandler: () => _sessionStorage['debugHandler'],
    setDebug: (debug: boolean) => (_sessionStorage['debug'] = debug),
    getDebug: (): boolean => _sessionStorage['debug'],

    setCurlirizeHandler: (debugHandler) =>
      (_sessionStorage['curlirizeHandler'] = debugHandler),
    getCurlirizeHandler: () => _sessionStorage['curlirizeHandler'],
    setCurlirize: (debug: boolean) => (_sessionStorage['curlirize'] = debug),
    getCurlirize: (): boolean => _sessionStorage['curlirize'],

    setCreateProgressHandler: (handler) =>
      (_sessionStorage['createProgressHandler'] = handler),
    getCreateProgressHandler: () => _sessionStorage['createProgressHandler'],
    setUpdateProgressHandler: (handler) =>
      (_sessionStorage['updateProgressHandler'] = handler),
    getUpdateProgressHandler: () => _sessionStorage['updateProgressHandler'],
    setStopProgressHandler: (handler) =>
      (_sessionStorage['stopProgressHandler'] = handler),
    getStopProgressHandler: () => _sessionStorage['stopProgressHandler'],
  },
};
