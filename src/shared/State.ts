/* eslint-disable no-console */
import {
  exponentialDelay,
  IAxiosRetryConfig,
  isNetworkOrIdempotentRequestError,
} from 'axios-retry';

import { RetryStrategy } from '../api/BaseApi';
import { FeatureInterface } from '../api/cloud/FeatureApi';
import { UserSessionMetaType } from '../ops/AuthenticateOps';
import { FrodoError } from '../ops/FrodoError';
import { JwkRsa } from '../ops/JoseOps';
import { AccessTokenMetaType } from '../ops/OAuth2OidcOps';
import Constants from '../shared/Constants';
import {
  ProgressIndicatorStatusType,
  ProgressIndicatorType,
} from '../utils/Console';
import { convertPrivateKeyToPem } from '../utils/CryptoUtils';
import { cloneDeep } from '../utils/JsonUtils';
import { getPackageVersion } from './Version';

export type State = {
  /**
   * Get a clone of the full state as an object
   * @returns a clone of the state
   */
  getState(): StateInterface;
  /**
   * Set the AM host base URL
   * @param host Access Management base URL, e.g.: https://cdk.iam.example.com/am. To use a connection profile, just specify a unique substring.
   */
  setHost(host: string): void;
  /**
   * Get the AM host base URL
   * @returns the AM host base URL
   */
  getHost(): string;
  /**
   * Set the IDM host base URL
   * @param host Identity Management base URL, e.g.: https://cdk.iam.example.com/openidm. To use a connection profile, just specify a unique substring.
   */
  setIdmHost(host: string): void;
  /**
   * Get the IDM host base URL
   * @returns the IDM host base URL
   */
  getIdmHost(): string;
  setUsername(username: string): void;
  getUsername(): string;
  setPassword(password: string): void;
  getPassword(): string;
  setRealm(realm: string): void;
  getRealm(): string;
  setUseRealmPrefixOnManagedObjects(
    useRealmPrefixOnManagedObjects: boolean
  ): void;
  getUseRealmPrefixOnManagedObjects(): boolean;
  setDeploymentType(type: string): void;
  getDeploymentType(): string;
  setAdminClientId(type: string): void;
  getAdminClientId(): string;
  setAdminClientRedirectUri(type: string): void;
  getAdminClientRedirectUri(): string;
  setAllowInsecureConnection(allowInsecureConnection: boolean): void;
  getAllowInsecureConnection(): boolean;
  setCookieName(name: string): void;
  getCookieName(): string;
  setUserSessionTokenMeta(value: UserSessionMetaType): void;
  getCookieValue(): string;
  getUserSessionTokenMeta(): UserSessionMetaType;
  setFeatures(features: FeatureInterface[]): void;
  getFeatures(): FeatureInterface[];
  setAuthenticationHeaderOverrides(overrides: Record<string, string>): void;
  getAuthenticationHeaderOverrides(): Record<string, string>;
  setAuthenticationService(service: string): void;
  getAuthenticationService(): string;
  setServiceAccountId(uuid: string): void;
  getServiceAccountId(): string;
  setServiceAccountJwk(jwk: JwkRsa): void;
  getServiceAccountJwk(): JwkRsa;
  setServiceAccountScope(scope: string): void;
  getServiceAccountScope(): string;
  setAmsterPrivateKey(key: string): void;
  getAmsterPrivateKey(): string;
  setUseBearerTokenForAmApis(useBearerTokenForAmApis: boolean): void;
  getUseBearerTokenForAmApis(): boolean;
  setBearerTokenMeta(token: AccessTokenMetaType): void;
  getBearerToken(): string;
  getBearerTokenMeta(): AccessTokenMetaType;
  setLogApiKey(key: string): void;
  getLogApiKey(): string;
  setLogApiSecret(secret: string): void;
  getLogApiSecret(): string;
  setAmVersion(version: string): void;
  getAmVersion(): string;
  setFrodoVersion(version: string): void;
  getFrodoVersion(): string;
  setConnectionProfilesPath(path: string): void;
  getConnectionProfilesPath(): string;
  setUseTokenCache(useTokenCache: boolean): void;
  getUseTokenCache(): boolean;
  setTokenCachePath(path: string): void;
  getTokenCachePath(): string;
  setMasterKeyPath(path: string): void;
  getMasterKeyPath(): string;
  setOutputFile(file: string): void;
  getOutputFile(): string;
  setDirectory(directory: string): void;
  getDirectory(): string;
  setAutoRefreshTimer(timer: NodeJS.Timeout): void;
  getAutoRefreshTimer(): NodeJS.Timeout;
  setCurlirizeHandler(handler: (message: string) => void): void;
  getCurlirizeHandler(): (message: string) => void;
  setCurlirize(curlirize: boolean): void;
  getCurlirize(): boolean;
  setCreateProgressHandler(
    handler: (
      type: ProgressIndicatorType,
      total?: number,
      message?: string
    ) => string
  ): void;
  getCreateProgressHandler(): (
    type: ProgressIndicatorType,
    total?: number,
    message?: string
  ) => string;
  setUpdateProgressHandler(
    handler: (id: string, message: string) => void
  ): void;
  getUpdateProgressHandler(): (id: string, message: string) => void;
  setStopProgressHandler(
    handler: (
      id: string,
      message: string,
      status?: ProgressIndicatorStatusType
    ) => void
  ): void;
  getStopProgressHandler(): (
    id: string,
    message: string,
    status?: ProgressIndicatorStatusType
  ) => void;
  setPrintHandler(
    handler: (
      message: string | object,
      type?: string,
      newline?: boolean
    ) => void
  ): void;
  getPrintHandler(): (
    message: string | object,
    type?: string,
    newline?: boolean
  ) => void;
  setErrorHandler(handler: (error: Error, message?: string) => void): void;
  getErrorHandler(): (error: Error, message?: string) => void;
  setVerboseHandler(handler: (message: string | object) => void): void;
  getVerboseHandler(): (message: string | object) => void;
  setVerbose(verbose: boolean): void;
  getVerbose(): boolean;
  setDebugHandler(handler: (message: string | object) => void): void;
  getDebugHandler(): (message: string | object) => void;
  setDebug(debug: boolean): void;
  getDebug(): boolean;
  getAxiosRetryConfig(): IAxiosRetryConfig;
  setAxiosRetryConfig(axiosRetryConfig: IAxiosRetryConfig): void;
  setAxiosRetryStrategy(strategy: RetryStrategy): void;
  /**
   * Reset the state to default values
   */
  reset(): void;

  // Deprecated

  /**
   * @deprecated since v0.17.0 use `setHost(host: string)` instead
   */
  setTenant(tenant: string): void;
  /**
   * @deprecated since v0.17.0 use `getHost` instead
   */
  getTenant(): string;
};

export default (initialState: StateInterface): State => {
  const state: StateInterface = { ...globalState, ...initialState };
  return {
    getState(): StateInterface {
      return cloneDeep(state);
    },

    setHost(host: string) {
      state.host = host;
    },
    getHost() {
      return state.host || process.env.FRODO_HOST;
    },
    setIdmHost(host: string) {
      state.idmHost = host;
    },
    getIdmHost() {
      return state.idmHost || process.env.FRODO_IDM_HOST;
    },

    setUsername(username: string) {
      state.username = username;
    },
    getUsername() {
      return state.username || process.env.FRODO_USERNAME;
    },

    setPassword(password: string) {
      state.password = password;
    },
    getPassword() {
      return state.password || process.env.FRODO_PASSWORD;
    },

    setRealm(realm: string) {
      state.realm = realm;
    },
    getRealm() {
      return state.realm || process.env.FRODO_REALM;
    },

    setUseRealmPrefixOnManagedObjects(useRealmPrefixOnManagedObjects: boolean) {
      state.useRealmPrefixOnManagedObjects = useRealmPrefixOnManagedObjects;
    },
    getUseRealmPrefixOnManagedObjects() {
      return state.useRealmPrefixOnManagedObjects || false;
    },

    setDeploymentType(type: string) {
      state.deploymentType = type;
    },
    getDeploymentType() {
      return state.deploymentType;
    },

    setAdminClientId(clientId: string) {
      state.adminClientId = clientId;
    },
    getAdminClientId() {
      return state.adminClientId || process.env.FRODO_LOGIN_CLIENT_ID;
    },
    setAdminClientRedirectUri(redirectUri: string) {
      state.adminClientRedirectUri = redirectUri;
    },
    getAdminClientRedirectUri() {
      return (
        state.adminClientRedirectUri || process.env.FRODO_LOGIN_REDIRECT_URI
      );
    },

    setAllowInsecureConnection(allowInsecureConnection: boolean) {
      state.allowInsecureConnection = allowInsecureConnection;
    },
    getAllowInsecureConnection() {
      return state.allowInsecureConnection;
    },

    setCookieName(name: string) {
      state.cookieName = name;
    },
    getCookieName() {
      return state.cookieName;
    },
    setUserSessionTokenMeta(token: UserSessionMetaType): void {
      state.userSessionToken = token;
    },
    getCookieValue() {
      return state.userSessionToken?.tokenId;
    },
    getUserSessionTokenMeta(): UserSessionMetaType {
      return state.userSessionToken;
    },

    setFeatures(features: FeatureInterface[]) {
      state.features = features;
    },
    getFeatures() {
      return state.features;
    },

    setAuthenticationHeaderOverrides(overrides: Record<string, string>) {
      state.authenticationHeaderOverrides = overrides;
    },
    getAuthenticationHeaderOverrides() {
      return state.authenticationHeaderOverrides;
    },
    setAuthenticationService(service: string) {
      state.authenticationService = service;
    },
    getAuthenticationService() {
      return (
        state.authenticationService || process.env.FRODO_AUTHENTICATION_SERVICE
      );
    },

    setServiceAccountId(uuid: string) {
      state.serviceAccountId = uuid;
    },
    getServiceAccountId(): string {
      return state.serviceAccountId || process.env.FRODO_SA_ID;
    },
    setServiceAccountJwk(jwk: JwkRsa) {
      state.serviceAccountJwk = { ...jwk };
    },
    getServiceAccountJwk(): JwkRsa {
      return (
        state.serviceAccountJwk ||
        (process.env.FRODO_SA_JWK
          ? JSON.parse(process.env.FRODO_SA_JWK)
          : undefined)
      );
    },
    setServiceAccountScope(scope: string): void {
      state.serviceAccountScope = scope;
    },
    getServiceAccountScope(): string {
      return state.serviceAccountScope;
    },

    setAmsterPrivateKey(key: string) {
      state.amsterPrivateKey = key;
    },
    getAmsterPrivateKey(): string {
      if (!state.amsterPrivateKey && process.env.FRODO_AMSTER_PRIVATE_KEY) {
        state.amsterPrivateKey = convertPrivateKeyToPem({
          key: process.env.FRODO_AMSTER_PRIVATE_KEY,
          passphrase: process.env.FRODO_AMSTER_PASSPHRASE || undefined,
        });
      }
      return state.amsterPrivateKey || undefined;
    },

    setUseBearerTokenForAmApis(useBearerTokenForAmApis: boolean) {
      state.useBearerTokenForAmApis = useBearerTokenForAmApis;
    },
    getUseBearerTokenForAmApis() {
      return state.useBearerTokenForAmApis;
    },
    setBearerTokenMeta(token: AccessTokenMetaType) {
      state.bearerToken = token;
    },
    getBearerToken(): string {
      return state.bearerToken?.access_token;
    },
    getBearerTokenMeta(): AccessTokenMetaType {
      return state.bearerToken;
    },

    setLogApiKey(key: string) {
      state.logApiKey = key;
    },
    getLogApiKey() {
      return state.logApiKey || process.env.FRODO_LOG_KEY;
    },
    setLogApiSecret(secret: string) {
      state.logApiSecret = secret;
    },
    getLogApiSecret() {
      return state.logApiSecret || process.env.FRODO_LOG_SECRET;
    },

    setAmVersion(version: string) {
      state.amVersion = version;
    },
    getAmVersion() {
      return state.amVersion;
    },

    setFrodoVersion(version: string) {
      state.frodoVersion = version;
    },
    getFrodoVersion() {
      return state.frodoVersion || getPackageVersion();
    },

    setConnectionProfilesPath(path: string) {
      state.connectionProfilesPath = path;
    },
    getConnectionProfilesPath() {
      return state.connectionProfilesPath;
    },

    setUseTokenCache(useTokenCache: boolean) {
      state.useTokenCache = useTokenCache;
    },
    getUseTokenCache() {
      return process.env.FRODO_NO_CACHE ? false : state.useTokenCache;
    },
    setTokenCachePath(path: string) {
      state.tokenCachePath = path;
    },
    getTokenCachePath() {
      return state.tokenCachePath;
    },

    setMasterKeyPath(path: string) {
      state.masterKeyPath = path;
    },
    getMasterKeyPath() {
      return state.masterKeyPath;
    },

    setOutputFile(file: string) {
      state.outputFile = file;
    },
    getOutputFile() {
      return state.outputFile;
    },

    setDirectory(directory: string) {
      state.directory = directory;
    },
    getDirectory() {
      return state.directory;
    },

    setAutoRefreshTimer(timer: NodeJS.Timeout): void {
      state.autoRefreshTimer = timer;
    },
    getAutoRefreshTimer(): NodeJS.Timeout {
      return state.autoRefreshTimer;
    },

    setCurlirizeHandler(handler: (message: string) => void) {
      state.curlirizeHandler = handler;
    },
    getCurlirizeHandler() {
      return state.curlirizeHandler;
    },
    setCurlirize(curlirize: boolean) {
      state.curlirize = curlirize;
    },
    getCurlirize(): boolean {
      return state.curlirize;
    },

    setCreateProgressHandler(
      handler: (
        type: ProgressIndicatorType,
        total?: number,
        message?: string
      ) => string
    ) {
      state.createProgressHandler = handler;
    },
    getCreateProgressHandler() {
      return state.createProgressHandler;
    },
    setUpdateProgressHandler(handler: (id: string, message: string) => void) {
      state.updateProgressHandler = handler;
    },
    getUpdateProgressHandler() {
      return state.updateProgressHandler;
    },
    setStopProgressHandler(
      handler: (message: string, status?: string) => void
    ) {
      state.stopProgressHandler = handler;
    },
    getStopProgressHandler() {
      return state.stopProgressHandler;
    },

    // global state

    setPrintHandler(
      handler: (
        message: string | object,
        type?: string,
        newline?: boolean
      ) => void
    ) {
      globalState.printHandler = handler;
    },
    getPrintHandler() {
      return globalState.printHandler;
    },

    setErrorHandler(handler: (error: Error, message?: string) => void) {
      globalState.errorHandler = handler;
    },
    getErrorHandler() {
      return globalState.errorHandler;
    },

    setVerboseHandler(handler: (message: string | object) => void) {
      globalState.verboseHandler = handler;
    },
    getVerboseHandler() {
      return globalState.verboseHandler;
    },
    setVerbose(verbose: boolean) {
      globalState.verbose = verbose;
    },
    getVerbose(): boolean {
      return globalState.verbose;
    },

    setDebugHandler(handler: (message: string | object) => void) {
      globalState.debugHandler = handler;
    },
    getDebugHandler() {
      return globalState.debugHandler;
    },
    setDebug(debug: boolean) {
      globalState.debug = debug;
    },
    getDebug(): boolean {
      return globalState.debug || process.env.FRODO_DEBUG !== undefined;
    },
    getAxiosRetryConfig(): IAxiosRetryConfig {
      return globalState.axiosRetryConfig;
    },
    setAxiosRetryConfig(axiosRetryConfig: IAxiosRetryConfig) {
      globalState.axiosRetryConfig = axiosRetryConfig;
    },
    setAxiosRetryStrategy(strategy: RetryStrategy): void {
      let axiosRetryConfig = {};
      switch (strategy) {
        case Constants.RETRY_EVERYTHING_KEY:
          axiosRetryConfig = {
            retries: 3, // Number of retry attempts
            retryDelay: exponentialDelay, // Use exponential backoff for delay
            retryCondition: (error) => {
              // Retry on all errors except 429 Too Many Requests
              return error.response.status !== 429;
            },
          };
          break;

        case Constants.RETRY_NETWORK_KEY:
          axiosRetryConfig = {
            retries: 3, // Number of retry attempts
            retryDelay: exponentialDelay, // Use exponential backoff for delay
            retryCondition: (error) => {
              // Custom condition: retry on network errors or specific status codes
              return isNetworkOrIdempotentRequestError(error);
            },
          };
          break;

        default:
          axiosRetryConfig = {
            retries: 0, // Number of retry attempts
            retryCondition: () => false,
          };
          break;
      }
      globalState.axiosRetryConfig = axiosRetryConfig;
    },
    reset(): void {
      for (const key of Object.keys(state)) {
        state[key] = globalState[key];
      }
    },

    // Deprecated

    setTenant(tenant: string) {
      this.setHost(tenant);
    },
    getTenant() {
      return this.getHost();
    },
  };
};

export interface StateInterface {
  // connection settings
  host?: string;
  idmHost?: string;
  username?: string;
  password?: string;
  realm?: string;
  useRealmPrefixOnManagedObjects?: boolean;
  deploymentType?: string;
  adminClientId?: string;
  adminClientRedirectUri?: string;
  allowInsecureConnection?: boolean;
  // customize authentication
  authenticationHeaderOverrides?: Record<string, string>;
  authenticationService?: string;
  // cookie name
  cookieName?: string;
  userSessionToken?: UserSessionMetaType;
  // feature settings
  features?: FeatureInterface[];
  // service account settings
  serviceAccountId?: string;
  serviceAccountJwk?: JwkRsa;
  serviceAccountScope?: string;
  // Amster settings
  amsterPrivateKey?: string;
  // bearer token settings
  useBearerTokenForAmApis?: boolean;
  bearerToken?: AccessTokenMetaType;
  // log api settings
  logApiKey?: string;
  logApiSecret?: string;
  // versions
  amVersion?: string;
  frodoVersion?: string;
  // miscellaneous settings
  connectionProfilesPath?: string;
  useTokenCache?: boolean;
  tokenCachePath?: string;
  masterKeyPath?: string;
  outputFile?: string;
  directory?: string;
  autoRefreshTimer?: NodeJS.Timeout;
  // output handler settings
  printHandler?: (
    message: string | object,
    type?: string,
    newline?: boolean
  ) => void;
  errorHandler?: (error: Error, message: string) => void;
  verboseHandler?: (message: string | object) => void;
  verbose?: boolean;
  debugHandler?: (message: string | object) => void;
  debug?: boolean;
  curlirizeHandler?: (message: string) => void;
  curlirize?: boolean;
  createProgressHandler?: (
    type: ProgressIndicatorType,
    total?: number,
    message?: string
  ) => string;
  updateProgressHandler?: (id: string, message: string) => void;
  stopProgressHandler?: (id: string, message: string, status?: string) => void;
  axiosRetryConfig?: IAxiosRetryConfig;
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
  errorHandler: (error: Error, message?: string) => {
    if (message) process.stderr.write('' + message['brightRed']);
    switch (error.name) {
      case 'FrodoError':
        process.stderr.write(
          '' + (error as FrodoError).getCombinedMessage()['brightRed']
        );
        break;

      case 'AxiosError': {
        const code = error['code'];
        const status = error['response'] ? error['response'].status : null;
        const message = error['response']
          ? error['response'].data
            ? error['response'].data.message
            : null
          : null;
        const detail = error['response']
          ? error['response'].data
            ? error['response'].data.detail
            : null
          : null;
        let errorMessage = 'Network error';
        errorMessage += code ? `\n  Code: ${code}` : '';
        errorMessage += status ? `\n  Status: ${status}` : '';
        errorMessage += message ? `\n  Message: ${message}` : '';
        errorMessage += detail ? `\n  Detail: ${detail}` : '';
        process.stderr.write(errorMessage['brightRed']);
        break;
      }

      default:
        process.stderr.write(error.message['brightRed']);
        break;
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

export const getVerbose = (): boolean => globalState.verbose;

export const getDebug = (): boolean =>
  globalState.debug || process.env.FRODO_DEBUG !== undefined;
