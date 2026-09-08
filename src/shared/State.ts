/* eslint-disable no-console */
import {
  exponentialDelay,
  IAxiosRetryConfig,
  isNetworkOrIdempotentRequestError,
} from 'axios-retry';

import { RetryStrategy } from '../api/BaseApi';
import { FeatureInterface } from '../api/cloud/FeatureApi';
import { UserSessionMetaType } from '../ops/AuthenticateOps';
import { CallerTrustTierResolver } from '../ops/CallerTrustTierOps';
import { FrodoError } from '../ops/FrodoError';
import { JwkRsa } from '../ops/JoseOps';
import { AccessTokenMetaType } from '../ops/OAuth2OidcOps';
import Constants from '../shared/Constants';
import { resolveThemeModeFromSetting, themeForMode } from '../utils/ColorTheme';
import {
  ProgressIndicatorStatusType,
  ProgressIndicatorType,
} from '../utils/Console';
import { dedupeAsync } from '../utils/AsyncUtils';
import { convertPrivateKeyToPem } from '../utils/CryptoUtils';
import { cloneDeep, mergeDeep } from '../utils/JsonUtils';
import { getPackageVersion } from './Version';

/**
 * A credential to inject into an outgoing AM request, resolved at actual
 * send time (see `api/BaseApi.ts`'s request interceptors) rather than baked
 * in when the axios instance was constructed.
 */
export type AmCredentialOverride = {
  header: 'Authorization' | 'Cookie';
  value: string;
};

/**
 * Browser-mode's per-call AM credential source: cloud browser-login mints a
 * fresh, short-lived, mint-and-discard RFC 8693-exchanged token immediately
 * before every AM-domain call (see `ops/BrowserAuthenticateOps.ts`'s
 * `exchangeTokenForScope`) instead of reusing a cached one. Set on `state`
 * by `getTokensInteractive()` so `api/BaseApi.ts` — which must never import
 * from `ops/` — can invoke it without knowing anything about token exchange.
 * Unset for every non-browser auth mode.
 */
export type AmCredentialProvider = (
  requiredScopes?: string[]
) => Promise<AmCredentialOverride | null>;

/**
 * On-demand, de-duplicated "make my cached token(s) fresh again" callback
 * for non-browser auth modes, invoked by `api/BaseApi.ts`'s request
 * interceptors when a cached token is found to be stale at actual send
 * time — not just at the one point in time `getTokens()` originally checked
 * it. Set by `AuthenticateOps.ts` right after a successful login, alongside
 * `scheduleAutoRefresh`'s timer (this is the same underlying mechanism,
 * just invocable on demand instead of only when the timer fires). Browser
 * login mode deliberately leaves this unset — cloud's primary token has no
 * refresh token, so there is no silent way to redo an interactive login;
 * going stale must surface a clear re-authentication error instead.
 */
export type TokenRefreshHandler = () => Promise<void>;

export type State = {
  /**
   * Get a clone of the full state as an object
   * @returns a clone of the state
   */
  getState(): StateInterface;
  /**
   * Set the AM host base URL
   * @param host Access Management base URL, e.g.: https://cdk.iam.example.com/am. To use a connection profile, just specify a unique substring or alias.
   */
  setHost(host: string): void;
  /**
   * Get the AM host base URL
   * @returns the AM host base URL
   */
  getHost(): string;
  /**
   * Set the IDM host base URL
   * @param host Identity Management base URL, e.g.: https://cdk.iam.example.com/openidm. To use a connection profile, just specify a unique substring or alias.
   */
  setIdmHost(host: string): void;
  /**
   * Get the IDM host base URL
   * @returns the IDM host base URL
   */
  getIdmHost(): string;
  setAlias(alias: string): void;
  getAlias(): string | undefined;
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
  setIsIGA(isIGA: boolean): void;
  getIsIGA(): boolean | undefined;
  setIsPingFed(isPingFed: boolean): void;
  getIsPingFed(): boolean | undefined;
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
  setConfigurationHeaderOverrides(overrides: Record<string, string>): void;
  getConfigurationHeaderOverrides(): Record<string, string>;
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
  setAuthMode(authMode: 'noninteractive' | 'interactive'): void;
  getAuthMode(): 'noninteractive' | 'interactive';
  /**
   * Explicit, persisted preference for which non-interactive credential
   * type a profile with more than one configured should use — an
   * `undefined` value means "no preference set," not "none of the above."
   * Unlike authMode, never mirrors ambient session state on save; only
   * ever written when the caller explicitly requests it (e.g. via
   * `--default-credential`), so an unrelated save never silently
   * overwrites a previously-configured preference. See
   * `AuthenticateOps.ts`'s `tryBrowserLogin()`/`getTokens()` for how this
   * is consulted.
   */
  setDefaultCredential(
    defaultCredential: 'user' | 'svcacct' | 'amster'
  ): void;
  getDefaultCredential(): 'user' | 'svcacct' | 'amster' | undefined;
  setTokenRefreshHandler(handler: TokenRefreshHandler | undefined): void;
  getTokenRefreshHandler(): TokenRefreshHandler | undefined;
  setBrowserLoginClientId(clientId: string): void;
  getBrowserLoginClientId(): string;
  setBrowserLoginScope(scope: string): void;
  getBrowserLoginScope(): string;
  setAmBearerTokenAcceptanceProbed(probed: boolean): void;
  getAmBearerTokenAcceptanceProbed(): boolean | undefined;
  setRefreshToken(token: string): void;
  getRefreshToken(): string;
  setIdToken(token: string): void;
  getIdToken(): string;
  setNeedsReauthentication(needsReauthentication: boolean): void;
  getNeedsReauthentication(): boolean;
  setAmCredentialProvider(provider: AmCredentialProvider): void;
  getAmCredentialProvider(): AmCredentialProvider | undefined;
  /** Cached for the life of the session by `determineCallerTrustTier()` (`ops/CallerTrustTierOps.ts`). */
  setCallerTrustTier(tier: 'full-trust' | 'delegated'): void;
  getCallerTrustTier(): 'full-trust' | 'delegated' | undefined;
  /** Extension point letting a customer plug in their own privilege model for browser-login sessions — see `ops/CallerTrustTierOps.ts`. */
  setCallerTrustTierResolver(
    resolver: CallerTrustTierResolver | undefined
  ): void;
  getCallerTrustTierResolver(): CallerTrustTierResolver | undefined;
  setBearerTokenMeta(token: AccessTokenMetaType): void;
  getBearerToken(): string;
  getBearerTokenMeta(): AccessTokenMetaType;
  /**
   * Which credential type is currently active for this session — set once,
   * wherever `getTokens()`'s non-interactive branches (or a browser login)
   * actually activate a credential. Used by `ops/PrivilegeEscalationOps.ts`
   * to know where on the escalation ladder the current session sits.
   */
  setActiveCredentialSource(
    source: 'user' | 'svcacct' | 'amster' | 'browser'
  ): void;
  getActiveCredentialSource(): 'user' | 'svcacct' | 'amster' | 'browser' | undefined;
  /**
   * Extension point letting `api/BaseApi.ts` trigger a credential-privilege
   * escalation without importing `ops/AuthenticateOps.ts` directly (would be
   * circular — `AuthenticateOps.ts` already depends on `BaseApi.ts`
   * transitively). Installed once by `getTokens()` after the initial
   * credential activates; called by `attachCredentialInterceptor()` when a
   * pre-flight scope check fails. Resolves `true` if a higher-tier
   * credential was found and activated (the failed request should be
   * retried), `false` if there is nothing left to escalate to.
   */
  setPrivilegeEscalationHandler(
    handler: (() => Promise<boolean>) | undefined
  ): void;
  getPrivilegeEscalationHandler(): (() => Promise<boolean>) | undefined;
  setPfBearerTokenMeta(token: AccessTokenMetaType): void;
  getPfBearerToken(): string;
  getPfBearerTokenMeta(): AccessTokenMetaType;
  setLogApiKey(key: string): void;
  getLogApiKey(): string;
  setLogApiSecret(secret: string): void;
  getLogApiSecret(): string;
  setAmVersion(version: string): void;
  getAmVersion(): string;
  setIdmVersion(version: string): void;
  getIdmVersion(): string;
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
  setEnv(key: string, value: string): void;
  setEnvs(env: Record<string, string>, clear?: boolean): void;
  getEnv(key: string): string | undefined;
  getEnvs(): Record<string, string>;
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
  setColorTheme(theme: 'dark' | 'light'): void;
  getColorTheme(): 'dark' | 'light' | undefined;
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

    setAlias(alias: string) {
      state.alias = alias;
    },
    getAlias() {
      return state.alias;
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

    setIsIGA(isIGA: boolean) {
      state.isIGA = isIGA;
    },
    getIsIGA(): boolean | undefined {
      if (this.getDeploymentType() !== Constants.CLOUD_DEPLOYMENT_TYPE_KEY)
        return false;
      return process.env.FRODO_IGA === 'true'
        ? true
        : process.env.FRODO_IGA === 'false'
          ? false
          : state.isIGA;
    },

    setIsPingFed(isPingFed: boolean) {
      state.isPingFed = isPingFed;
    },
    getIsPingFed(): boolean | undefined {
      if (this.getDeploymentType() !== Constants.CLOUD_DEPLOYMENT_TYPE_KEY)
        return false;
      return process.env.FRODO_PINGFED === 'true'
        ? true
        : process.env.FRODO_PINGFED === 'false'
          ? false
          : state.isPingFed;
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
      return mergeDeep(
        state.authenticationHeaderOverrides,
        process.env.FRODO_AUTHENTICATION_HEADER_OVERRIDES
          ? JSON.parse(process.env.FRODO_AUTHENTICATION_HEADER_OVERRIDES)
          : {}
      );
    },
    setAuthenticationService(service: string) {
      state.authenticationService = service;
    },
    getAuthenticationService() {
      return (
        state.authenticationService || process.env.FRODO_AUTHENTICATION_SERVICE
      );
    },

    setConfigurationHeaderOverrides(overrides: Record<string, string>) {
      state.configurationHeaderOverrides = overrides;
    },
    getConfigurationHeaderOverrides() {
      return mergeDeep(
        state.configurationHeaderOverrides,
        process.env.FRODO_CONFIGURATION_HEADER_OVERRIDES
          ? JSON.parse(process.env.FRODO_CONFIGURATION_HEADER_OVERRIDES)
          : {}
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
    setAuthMode(authMode: 'noninteractive' | 'interactive') {
      state.authMode = authMode;
    },
    getAuthMode() {
      return (
        state.authMode ??
        (process.env.FRODO_BROWSER_LOGIN === 'true'
          ? 'interactive'
          : 'noninteractive')
      );
    },
    setDefaultCredential(defaultCredential: 'user' | 'svcacct' | 'amster') {
      state.defaultCredential = defaultCredential;
    },
    getDefaultCredential() {
      return state.defaultCredential;
    },
    setTokenRefreshHandler(handler: TokenRefreshHandler | undefined) {
      // De-duplicated here, structurally, rather than trusting every caller
      // to wrap their own handler: several API calls can discover a stale
      // token at once (see api/BaseApi.ts's request interceptors), and only
      // one actual refresh should ever run, with every caller awaiting that
      // same result.
      state.tokenRefreshHandler = handler ? dedupeAsync(handler) : undefined;
    },
    getTokenRefreshHandler() {
      return state.tokenRefreshHandler;
    },
    setBrowserLoginClientId(clientId: string) {
      state.browserLoginClientId = clientId;
    },
    getBrowserLoginClientId() {
      return state.browserLoginClientId;
    },
    setBrowserLoginScope(scope: string) {
      state.browserLoginScope = scope;
    },
    getBrowserLoginScope() {
      return state.browserLoginScope;
    },
    setAmBearerTokenAcceptanceProbed(probed: boolean) {
      state.amBearerTokenAcceptanceProbed = probed;
    },
    getAmBearerTokenAcceptanceProbed() {
      return state.amBearerTokenAcceptanceProbed;
    },
    setRefreshToken(token: string) {
      state.refreshToken = token;
    },
    getRefreshToken() {
      return state.refreshToken;
    },
    setIdToken(token: string) {
      state.idToken = token;
    },
    getIdToken() {
      return state.idToken;
    },
    setNeedsReauthentication(needsReauthentication: boolean) {
      state.needsReauthentication = needsReauthentication;
    },
    getNeedsReauthentication() {
      return state.needsReauthentication ?? false;
    },
    setAmCredentialProvider(provider: AmCredentialProvider) {
      state.amCredentialProvider = provider;
    },
    getAmCredentialProvider() {
      return state.amCredentialProvider;
    },
    setCallerTrustTier(tier: 'full-trust' | 'delegated') {
      state.callerTrustTier = tier;
    },
    getCallerTrustTier() {
      return state.callerTrustTier;
    },
    setCallerTrustTierResolver(resolver: CallerTrustTierResolver | undefined) {
      state.callerTrustTierResolver = resolver;
    },
    getCallerTrustTierResolver() {
      return state.callerTrustTierResolver;
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
    setActiveCredentialSource(
      source: 'user' | 'svcacct' | 'amster' | 'browser'
    ) {
      state.activeCredentialSource = source;
    },
    getActiveCredentialSource() {
      return state.activeCredentialSource;
    },
    setPrivilegeEscalationHandler(handler: (() => Promise<boolean>) | undefined) {
      state.privilegeEscalationHandler = handler;
    },
    getPrivilegeEscalationHandler() {
      return state.privilegeEscalationHandler;
    },
    setPfBearerTokenMeta(token: AccessTokenMetaType) {
      state.pfBearerToken = token;
    },
    getPfBearerToken(): string {
      return state.pfBearerToken?.access_token;
    },
    getPfBearerTokenMeta(): AccessTokenMetaType {
      return state.pfBearerToken;
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

    setIdmVersion(version: string) {
      state.idmVersion = version;
    },
    getIdmVersion() {
      return state.idmVersion;
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
    setEnv(key: string, value: string) {
      state.env[key] = value;
    },
    setEnvs(env: Record<string, string>, clear: boolean = false) {
      state.env = mergeDeep(clear ? {} : state.env, env);
    },
    getEnv(key: string): string | undefined {
      return state.env[key];
    },
    getEnvs() {
      return { ...state.env };
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
    setColorTheme(theme: 'dark' | 'light') {
      globalState.colorTheme = theme;
    },
    getColorTheme(): 'dark' | 'light' | undefined {
      return globalState.colorTheme;
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
  alias?: string;
  username?: string;
  password?: string;
  realm?: string;
  useRealmPrefixOnManagedObjects?: boolean;
  deploymentType?: string;
  isIGA?: boolean;
  isPingFed?: boolean;
  adminClientId?: string;
  adminClientRedirectUri?: string;
  allowInsecureConnection?: boolean;
  // customize authentication
  authenticationHeaderOverrides?: Record<string, string>;
  authenticationService?: string;
  // customize configuration headers
  configurationHeaderOverrides?: Record<string, string>;
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
  // browser-login settings
  authMode?: 'noninteractive' | 'interactive';
  defaultCredential?: 'user' | 'svcacct' | 'amster';
  activeCredentialSource?: 'user' | 'svcacct' | 'amster' | 'browser';
  privilegeEscalationHandler?: () => Promise<boolean>;
  tokenRefreshHandler?: TokenRefreshHandler;
  amCredentialProvider?: AmCredentialProvider;
  browserLoginClientId?: string;
  browserLoginScope?: string;
  // cached result of a one-shot probe (Phase C/ForgeOps): does this tenant's
  // AM accept a bearer token for AM-domain calls at all, absent the
  // session-capture-script mechanism? undefined means "not probed yet".
  amBearerTokenAcceptanceProbed?: boolean;
  refreshToken?: string;
  idToken?: string;
  // set when a browser-login session's token has expired with no refresh
  // token to silently renew it — the caller must complete a fresh
  // interactive login; there is no unattended way to recover.
  needsReauthentication?: boolean;
  // cached result of determineCallerTrustTier() (mcp/ — see
  // ops/CallerTrustTierOps.ts), for the life of the session.
  callerTrustTier?: 'full-trust' | 'delegated';
  callerTrustTierResolver?: CallerTrustTierResolver;
  // bearer token settings
  useBearerTokenForAmApis?: boolean;
  bearerToken?: AccessTokenMetaType;
  pfBearerToken?: AccessTokenMetaType;
  // log api settings
  logApiKey?: string;
  logApiSecret?: string;
  // versions
  amVersion?: string;
  idmVersion?: string;
  frodoVersion?: string;
  // miscellaneous settings
  connectionProfilesPath?: string;
  useTokenCache?: boolean;
  tokenCachePath?: string;
  masterKeyPath?: string;
  outputFile?: string;
  directory?: string;
  autoRefreshTimer?: NodeJS.Timeout;
  env?: Record<string, string>;
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
  colorTheme?: 'dark' | 'light';
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
  configurationHeaderOverrides: {},
  env: {},
  printHandler: (message: string | object) => {
    if (!message) return;
    if (typeof message === 'object') {
      console.dir(message, { depth: 3 });
    } else {
      console.log(message);
    }
  },
  errorHandler: (error: Error, message?: string) => {
    // No `State` instance is available this early (this object is the seed
    // every instance is created from), so the theme mode is resolved from
    // the shared `colorTheme` setting directly rather than through
    // `theme(state)` -- see ColorTheme.ts's `resolveThemeModeFromSetting`.
    const themeColors = themeForMode(
      resolveThemeModeFromSetting(globalState.colorTheme)
    );
    if (message) process.stderr.write('' + themeColors.error(message));
    switch (error.name) {
      case 'FrodoError':
        process.stderr.write(
          '' + themeColors.error((error as FrodoError).getCombinedMessage())
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
        process.stderr.write(themeColors.error(errorMessage));
        break;
      }

      default:
        process.stderr.write(themeColors.error(error.message));
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
  debugHandler: () => undefined,
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
