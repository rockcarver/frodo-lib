import { type PagedResult } from '../../api/ApiTypes';
import {
  createLogApiKey as _createLogApiKey,
  deleteLogApiKey as _deleteLogApiKey,
  fetch as _fetch,
  getLogApiKey as _getLogApiKey,
  getLogApiKeys as _getLogApiKeys,
  getSources as _getSources,
  isLogApiKeyValid as _isLogApiKeyValid,
  type LogApiKey,
  type LogEventPayloadSkeleton,
  type LogEventSkeleton,
  tail as _tail,
} from '../../api/cloud/LogApi';
import { FrodoError } from '../FrodoError';
import { State } from '../../shared/State';

export type Log = {
  /**
   * Get default noise filter
   * @returns {string[]} array of default event types and loggers to be filtered out
   */
  getDefaultNoiseFilter(): string[];
  /**
   * Resolve log level to an array of effective log levels
   * @param level string or numeric log level: 'FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'ALL', 0, 1, 2, 3, 4
   * @returns {string[]} array of effective log levels
   */
  resolveLevel(level: string | number): string[];
  /**
   * Resolve a log event's level
   * @param {object} log log event
   * @returns {string} log level
   */
  resolvePayloadLevel(log: LogEventSkeleton): string;
  /**
   * Get available log sources
   * @returns {Promise<string[]>} promise resolving to an array of available log sources
   */
  getLogSources(): Promise<string[]>;
  /**
   * Get log api key
   * @param {string} keyId key id
   * @returns {Promise<LogApiKey>} promise resolving to a LogApiKey objects
   */
  getLogApiKey(keyId: string): Promise<LogApiKey>;
  /**
   * Validate log api key and secret
   * @param {string} keyId log api key id
   * @param {string} secret log api secret
   * @returns {Promise<boolean>} a promise resolving to true if the key is valid, false otherwise
   */
  isLogApiKeyValid(keyId: string, secret: string): Promise<boolean>;
  /**
   * Get log api keys
   * @returns {Promise<LogApiKey[]>} promise resolving to an array of LogApiKey objects
   */
  getLogApiKeys(): Promise<LogApiKey[]>;
  /**
   * Create log api key
   * @param {string} keyName human-readable key name
   * @returns {Promise<LogApiKey>} a promise resolving to an object containing the log api key and secret
   */
  createLogApiKey(keyName: string): Promise<LogApiKey>;
  /**
   * Delete log api key
   * @param {string} keyId key id
   * @returns {Promise<LogApiKey>} a promise resolving to an object containing the log api key
   */
  deleteLogApiKey(keyId: string): Promise<LogApiKey>;
  /**
   * Delete all log api keys
   * @returns {Promise<LogApiKey>} a promise resolving to an array of log api key objects
   */
  deleteLogApiKeys(): Promise<LogApiKey[]>;
  /**
   * Tail logs
   * @param {string} source log source(s) to tail
   * @param {string} cookie paged results cookie
   * @returns {Promise<PagedResult<LogEventSkeleton>>} promise resolving to paged log event result
   */
  tail(source: string, cookie: string): Promise<PagedResult<LogEventSkeleton>>;
  /**
   * Fetch logs
   * @param {string} source log source(s) to tail
   * @param {string} startTs start timestamp
   * @param {string} endTs end timestamp
   * @param {string} cookie paged results cookie
   * @returns {Promise<PagedResult<LogEventSkeleton>>} promise resolving to paged log event result
   */
  fetch(
    source: string,
    startTs: string,
    endTs: string,
    cookie: string
  ): Promise<PagedResult<LogEventSkeleton>>;
};

export default (state: State): Log => {
  return {
    getDefaultNoiseFilter(): string[] {
      return getDefaultNoiseFilter();
    },
    resolveLevel(level: string | number): string[] {
      return resolveLevel(level);
    },
    resolvePayloadLevel(log: LogEventSkeleton): string {
      return resolvePayloadLevel(log);
    },
    async getLogSources() {
      return getLogSources({ state });
    },
    async getLogApiKey(keyId: string): Promise<LogApiKey> {
      return getLogApiKey({ keyId, state });
    },
    async isLogApiKeyValid(keyId: string, secret: string): Promise<boolean> {
      return isLogApiKeyValid({ keyId, secret, state });
    },
    async getLogApiKeys(): Promise<LogApiKey[]> {
      return getLogApiKeys({ state });
    },
    async createLogApiKey(keyName: string): Promise<LogApiKey> {
      return createLogApiKey({ keyName, state });
    },
    async deleteLogApiKey(keyId: string): Promise<LogApiKey> {
      return deleteLogApiKey({ keyId, state });
    },
    async deleteLogApiKeys(): Promise<LogApiKey[]> {
      return deleteLogApiKeys({ state });
    },
    tail(
      source: string,
      cookie: string
    ): Promise<PagedResult<LogEventSkeleton>> {
      return tail({ source, cookie, state });
    },
    async fetch(
      source: string,
      startTs: string,
      endTs: string,
      cookie: string
    ): Promise<PagedResult<LogEventSkeleton>> {
      return fetch({ source, startTs, endTs, cookie, state });
    },
  };
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const unfilterableNoise = [
  'text/plain', // Unfortunately, it is impossible to filter out those without excluding IDM script logging as well
];

const miscNoise = [
  'com.iplanet.dpro.session.operations.ServerSessionOperationStrategy',
  'com.iplanet.dpro.session.SessionIDFactory',
  'com.iplanet.dpro.session.share.SessionEncodeURL',
  'com.iplanet.services.naming.WebtopNaming',
  'com.iplanet.sso.providers.dpro.SSOProviderImpl',
  'com.sun.identity.authentication.AuthContext',
  'com.sun.identity.authentication.client.AuthClientUtils',
  'com.sun.identity.authentication.config.AMAuthConfigType',
  'com.sun.identity.authentication.config.AMAuthenticationManager',
  'com.sun.identity.authentication.config.AMAuthLevelManager',
  'com.sun.identity.authentication.config.AMConfiguration',
  'com.sun.identity.authentication.jaas.LoginContext',
  'com.sun.identity.authentication.modules.application.Application',
  'com.sun.identity.authentication.server.AuthContextLocal',
  'com.sun.identity.authentication.service.AMLoginContext',
  'com.sun.identity.authentication.service.AuthContextLookup',
  'com.sun.identity.authentication.service.AuthD',
  'com.sun.identity.authentication.service.AuthUtils',
  'com.sun.identity.authentication.service.DSAMECallbackHandler',
  'com.sun.identity.authentication.service.LoginState',
  'com.sun.identity.authentication.spi.AMLoginModule',
  'com.sun.identity.delegation.DelegationEvaluatorImpl',
  'com.sun.identity.idm.plugins.internal.AgentsRepo',
  'com.sun.identity.idm.server.IdCachedServicesImpl',
  'com.sun.identity.idm.server.IdRepoPluginsCache',
  'com.sun.identity.idm.server.IdServicesImpl',
  'com.sun.identity.log.spi.ISDebug',
  'com.sun.identity.shared.encode.CookieUtils',
  'com.sun.identity.sm.ldap.SMSLdapObject',
  'com.sun.identity.sm.CachedSMSEntry',
  'com.sun.identity.sm.CachedSubEntries',
  'com.sun.identity.sm.DNMapper',
  'com.sun.identity.sm.ServiceConfigImpl',
  'com.sun.identity.sm.ServiceConfigManagerImpl',
  'com.sun.identity.sm.SMSEntry',
  'com.sun.identity.sm.SMSUtils',
  'com.sun.identity.sm.SmsWrapperObject',
  'oauth2',
  'org.apache.http.client.protocol.RequestAuthCache',
  'org.apache.http.impl.conn.PoolingHttpClientConnectionManager',
  'org.apache.http.impl.nio.client.InternalHttpAsyncClient',
  'org.apache.http.impl.nio.client.InternalIODispatch',
  'org.apache.http.impl.nio.client.MainClientExec',
  'org.apache.http.impl.nio.conn.ManagedNHttpClientConnectionImpl',
  'org.apache.http.impl.nio.conn.PoolingNHttpClientConnectionManager',
  'org.forgerock.audit.AuditServiceImpl',
  'org.forgerock.oauth2.core.RealmOAuth2ProviderSettings',
  'org.forgerock.openam.authentication.service.JAASModuleDetector',
  'org.forgerock.openam.authentication.service.LoginContextFactory',
  'org.forgerock.openam.blacklist.BloomFilterBlacklist',
  'org.forgerock.openam.blacklist.CTSBlacklist',
  'org.forgerock.openam.core.realms.impl.CachingRealmLookup',
  'org.forgerock.openam.core.rest.authn.RestAuthCallbackHandlerManager',
  'org.forgerock.openam.core.rest.authn.trees.AuthTrees',
  'org.forgerock.openam.cors.CorsFilter',
  'org.forgerock.openam.cts.CTSPersistentStoreImpl',
  'org.forgerock.openam.cts.impl.CoreTokenAdapter',
  'org.forgerock.openam.cts.impl.queue.AsyncResultHandler',
  'org.forgerock.openam.cts.reaper.ReaperDeleteOnQueryResultHandler',
  'org.forgerock.openam.headers.DisableSameSiteCookiesFilter',
  'org.forgerock.openam.idrepo.ldap.DJLDAPv3Repo',
  'org.forgerock.openam.rest.CsrfFilter',
  'org.forgerock.openam.rest.restAuthenticationFilter',
  'org.forgerock.openam.rest.fluent.CrestLoggingFilter',
  'org.forgerock.openam.session.cts.CtsOperations',
  'org.forgerock.openam.session.stateless.StatelessSessionManager',
  'org.forgerock.openam.sm.datalayer.impl.ldap.ExternalLdapConfig',
  'org.forgerock.openam.sm.datalayer.impl.ldap.LdapQueryBuilder',
  'org.forgerock.openam.sm.datalayer.impl.SeriesTaskExecutor',
  'org.forgerock.openam.sm.datalayer.impl.SeriesTaskExecutorThread',
  'org.forgerock.openam.sm.datalayer.providers.LdapConnectionFactoryProvider',
  'org.forgerock.openam.sm.file.ConfigFileSystemHandler',
  'org.forgerock.openam.social.idp.SocialIdentityProviders',
  'org.forgerock.openam.utils.ClientUtils',
  'org.forgerock.opendj.ldap.CachedConnectionPool',
  'org.forgerock.opendj.ldap.LoadBalancer',
  'org.forgerock.secrets.keystore.KeyStoreSecretStore',
  'org.forgerock.secrets.propertyresolver.PropertyResolverSecretStore',
  'org.forgerock.secrets.SecretsProvider',
];

const journeysNoise = [
  'org.forgerock.openam.auth.trees.engine.AuthTreeExecutor',
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const journeys = [
  'org.forgerock.openam.auth.nodes.SelectIdPNode',
  'org.forgerock.openam.auth.nodes.ValidatedPasswordNode',
  'org.forgerock.openam.auth.nodes.ValidatedUsernameNode',
  'org.forgerock.openam.auth.trees.engine.AuthTreeExecutor',
];

const samlNoise = [
  'com.sun.identity.cot.COTCache',
  'com.sun.identity.plugin.configuration.impl.ConfigurationInstanceImpl',
  'com.sun.identity.saml2.meta.SAML2MetaCache',
  'com.sun.identity.saml2.profile.CacheCleanUpRunnable',
  'org.apache.xml.security.keys.KeyInfo',
  'org.apache.xml.security.signature.XMLSignature',
  'org.apache.xml.security.utils.SignerOutputStream',
  'org.apache.xml.security.utils.resolver.ResourceResolver',
  'org.apache.xml.security.utils.resolver.implementations.ResolverFragment',
  'org.apache.xml.security.algorithms.JCEMapper',
  'org.apache.xml.security.algorithms.implementations.SignatureBaseRSA',
  'org.apache.xml.security.algorithms.SignatureAlgorithm',
  'org.apache.xml.security.utils.ElementProxy',
  'org.apache.xml.security.transforms.Transforms',
  'org.apache.xml.security.utils.DigesterOutputStream',
  'org.apache.xml.security.signature.Reference',
  'org.apache.xml.security.signature.Manifest',
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const saml = [
  'jsp.saml2.spAssertionConsumer',
  'com.sun.identity.saml.common.SAMLUtils',
  'com.sun.identity.saml2.common.SAML2Utils',
  'com.sun.identity.saml2.meta.SAML2MetaManager',
  'com.sun.identity.saml2.xmlsig.FMSigProvider',
];

const noise = miscNoise.concat(samlNoise).concat(journeysNoise);

const numLogLevelMap = {
  0: ['SEVERE', 'ERROR', 'FATAL'],
  1: ['WARNING', 'WARN', 'CONFIG'],
  2: ['INFO', 'INFORMATION'],
  3: ['DEBUG', 'FINE', 'FINER', 'FINEST'],
  4: ['ALL'],
};

const logLevelMap = {
  SEVERE: ['SEVERE', 'ERROR', 'FATAL'],
  ERROR: ['SEVERE', 'ERROR', 'FATAL'],
  FATAL: ['SEVERE', 'ERROR', 'FATAL'],
  WARN: ['SEVERE', 'ERROR', 'FATAL', 'WARNING', 'WARN', 'CONFIG'],
  WARNING: ['SEVERE', 'ERROR', 'FATAL', 'WARNING', 'WARN', 'CONFIG'],
  CONFIG: ['SEVERE', 'ERROR', 'FATAL', 'WARNING', 'WARN', 'CONFIG'],
  INFO: [
    'SEVERE',
    'ERROR',
    'FATAL',
    'WARNING',
    'WARN',
    'CONFIG',
    'INFO',
    'INFORMATION',
  ],
  INFORMATION: [
    'SEVERE',
    'ERROR',
    'FATAL',
    'WARNING',
    'WARN',
    'CONFIG',
    'INFO',
    'INFORMATION',
  ],
  DEBUG: [
    'SEVERE',
    'ERROR',
    'FATAL',
    'WARNING',
    'WARN',
    'CONFIG',
    'INFO',
    'INFORMATION',
    'DEBUG',
    'FINE',
    'FINER',
    'FINEST',
  ],
  FINE: [
    'SEVERE',
    'ERROR',
    'FATAL',
    'WARNING',
    'WARN',
    'CONFIG',
    'INFO',
    'INFORMATION',
    'DEBUG',
    'FINE',
    'FINER',
    'FINEST',
  ],
  FINER: [
    'SEVERE',
    'ERROR',
    'FATAL',
    'WARNING',
    'WARN',
    'CONFIG',
    'INFO',
    'INFORMATION',
    'DEBUG',
    'FINE',
    'FINER',
    'FINEST',
  ],
  FINEST: [
    'SEVERE',
    'ERROR',
    'FATAL',
    'WARNING',
    'WARN',
    'CONFIG',
    'INFO',
    'INFORMATION',
    'DEBUG',
    'FINE',
    'FINER',
    'FINEST',
  ],
  ALL: ['ALL'],
};

/**
 * Get default noise filter
 * @returns {string[]} array of default event types and loggers to be filtered out
 */
export function getDefaultNoiseFilter(): string[] {
  return noise;
}

/**
 * Resolve log level to an array of effective log levels
 * @param level string or numeric log level: 'FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'ALL', 0, 1, 2, 3, 4
 * @returns {string[]} array of effective log levels
 */
export function resolveLevel(level: string | number): string[] {
  if (Number.isNaN(parseInt(level as string, 10))) {
    return logLevelMap[level];
  }
  return logLevelMap[numLogLevelMap[level as number][0]];
}

/**
 * Resolve a log event's level
 * @param {object} log log event
 * @returns {string} log level
 */
export function resolvePayloadLevel(log: LogEventSkeleton): string {
  // It seems that the undesirable 'text/plain' logs start with a date, not a LEVEL
  // Therefore, for those, this function returns null, and thus filters out the undesirable
  try {
    return log.type !== 'text/plain'
      ? (log.payload as LogEventPayloadSkeleton).level
      : (log.payload as string).match(/^([^:]*):/)[1];
  } catch (e) {
    // Fail-safe for no group match
    return null;
  }
}

/**
 * Get available log sources
 * @returns {Promise<string[]>} promise resolving to an array of available log sources
 */
export async function getLogSources({ state }: { state: State }) {
  try {
    const { result } = await _getSources({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error getting log sources`, error);
  }
}

/**
 * Get log API key
 * @returns {Promise<PagedResult<LogApiKey>>} a promise resolving to a log api key object
 */
export async function getLogApiKey({
  keyId,
  state,
}: {
  keyId: string;
  state: State;
}): Promise<LogApiKey> {
  try {
    return _getLogApiKey({ keyId, state });
  } catch (error) {
    throw new FrodoError(`Error getting log api key ${keyId}`, error);
  }
}

/**
 * Validate log API key
 * @param {string} keyId log api key id
 * @param {string} secret log api secret
 * @returns {Promise<boolean>} a promise resolving to true if the key is valid, false otherwise
 */
export async function isLogApiKeyValid({
  keyId,
  secret,
  state,
}: {
  keyId: string;
  secret: string;
  state: State;
}): Promise<boolean> {
  try {
    return _isLogApiKeyValid({ keyId, secret, state });
  } catch (error) {
    throw new FrodoError(`Error validating log api key ${keyId}`, error);
  }
}

/**
 * Get log api keys
 * @returns {Promise<LogApiKey[]>} promise resolving to an array of LogApiKey objects
 */
export async function getLogApiKeys({
  state,
}: {
  state: State;
}): Promise<LogApiKey[]> {
  try {
    const { result } = await _getLogApiKeys({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error getting log api keys`, error);
  }
}

/**
 * Create API key
 * @param {keyName: string, state: State} params keyName, state
 * @returns {Promise<LogApiKey>} new API key and secret
 */
export async function createLogApiKey({
  keyName,
  state,
}: {
  keyName: string;
  state: State;
}): Promise<LogApiKey> {
  try {
    return _createLogApiKey({ keyName, state });
  } catch (error) {
    throw new FrodoError(`Error creating log api key ${keyName}`, error);
  }
}

/**
 * Delete key
 */
export async function deleteLogApiKey({
  keyId,
  state,
}: {
  keyId: string;
  state: State;
}): Promise<LogApiKey> {
  try {
    const key = await getLogApiKey({ keyId, state });
    await _deleteLogApiKey({ keyId, state });
    return key;
  } catch (error) {
    throw new FrodoError(`Error deleting log api key ${keyId}`, error);
  }
}

/**
 * Delete all keys
 */
export async function deleteLogApiKeys({
  state,
}: {
  state: State;
}): Promise<LogApiKey[]> {
  const responses = [];
  const errors = [];
  try {
    const keys = await getLogApiKeys({ state });
    for (const key of keys) {
      try {
        await deleteLogApiKey({
          keyId: key.api_key_id,
          state,
        });
        responses.push(key);
      } catch (error) {
        errors.push(error);
      }
    }
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    throw new FrodoError(`Error deleting log api keys`, errors);
  }
  return responses;
}

/**
 * Tail logs
 * @param {string} source log source(s) to tail
 * @param {string} cookie paged results cookie
 * @returns {Promise<PagedResult<LogEventSkeleton>>} promise resolving to paged log event result
 */
export async function tail({
  source,
  cookie,
  state,
}: {
  source: string;
  cookie: string;
  state: State;
}): Promise<PagedResult<LogEventSkeleton>> {
  try {
    return _tail({ source, cookie, state });
  } catch (error) {
    throw new FrodoError(`Error tailing logs`, error);
  }
}

/**
 * Fetch logs
 * @param {string} source log source(s) to tail
 * @param {string} startTs start timestamp
 * @param {string} endTs end timestamp
 * @param {string} cookie paged results cookie
 * @returns {Promise<PagedResult<LogEventSkeleton>>} promise resolving to paged log event result
 */
export async function fetch({
  source,
  startTs,
  endTs,
  cookie,
  state,
}: {
  source: string;
  startTs: string;
  endTs: string;
  cookie: string;
  state: State;
}): Promise<PagedResult<LogEventSkeleton>> {
  try {
    return _fetch({ source, startTs, endTs, cookie, state });
  } catch (error) {
    throw new FrodoError(`Error fetching logs`, error);
  }
}
