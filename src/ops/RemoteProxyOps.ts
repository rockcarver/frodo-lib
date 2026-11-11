import { randomBytes } from 'crypto';
import {
  IdObjectSkeletonInterface,
  NoIdObjectSkeletonInterface,
} from '../api/ApiTypes';
import {
  deleteConfigEntity,
  getConfigEntity,
  putConfigEntity,
} from '../api/IdmConfigApi';
import { getIdmLoginInfo } from '../api/ServerInfoApi';
import { deriveState, State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { getHostOnlyUrl } from '../utils/ForgeRockUtils';
import { FrodoError, isNotFoundError } from './FrodoError';
import { readConfigEntitiesByType } from './IdmConfigOps';
import { ExportMetaData, ResultCallback } from './OpsTypes';

export type RemoteProxy = {
  /**
   * Remote proxy type key used to build the IDM id: 'external.idm/<id>'
   */
  REMOTE_PROXY_TYPE: string;
  /**
   * Get the IDM base URL that routes IDM REST calls through a remote proxy to
   * the receiving tenant: `<host>/openidm/external/idm/<proxyId>`. Every IDM
   * REST call (managed objects, config, ...) addressed below it is made on the
   * receiving tenant by the mapped user of the proxy.
   * @param {string} proxyId id/name of the remote proxy without the type prefix
   * @returns {string} the IDM base URL of the remote proxy
   */
  getRemoteProxyBaseUrl(proxyId: string): string;
  /**
   * Check the name of a remote proxy. The name becomes part of the IDM entity
   * id `external.idm/<name>` and of a REST path, so it is restricted: 1 to 100
   * characters, starting with a letter or a digit, containing only letters,
   * digits, `.`, `_` and `-`. Every operation of this module refuses any other
   * name before it makes a request.
   * @param {string} proxyId name of the remote proxy without the type prefix
   * @returns {boolean} true if the name is allowed
   */
  isValidRemoteProxyName(proxyId: string): boolean;
  /**
   * Get the properties of a remote proxy that hold a secret encrypted by the
   * tenant it was read from. IDM encrypts a plain text `password` or
   * `clientSecret` on write and returns it as an encrypted `$crypto` object. That
   * value belongs to one tenant: another tenant accepts it unchecked, and it
   * fails only when the proxy is used. An ESV placeholder (`&{esv.name}`) is not
   * encrypted and is the portable way to configure a secret.
   * @param {RemoteProxySkeleton} proxyData remote proxy object
   * @returns {string[]} names of the properties that hold a tenant-bound secret
   */
  getTenantBoundSecrets(proxyData: RemoteProxySkeleton): string[];
  /**
   * Get the URL properties (`instanceUrl`, `tokenEndpoint`) of a remote proxy
   * whose host is written out. Such a URL names one receiving tenant, so a
   * promotion carries that address to the next environment unchanged. A URL
   * whose host is an ESV placeholder (`&{esv.name}`, `https://&{esv.name}/openidm/`)
   * is resolved by each environment from its own ESV and is portable.
   * @param {RemoteProxySkeleton} proxyData remote proxy object
   * @returns {string[]} names of the URL properties that have a fixed host
   */
  getFixedHostUrls(proxyData: RemoteProxySkeleton): string[];
  /**
   * Build the OAuth2 client a remote proxy needs on the receiving tenant: client
   * credentials grant, `client_secret_post`, scope `fr:idm:*` and nothing
   * broader. The result is data, ready for `frodo.oauth2oidc.client.createOAuth2Client`;
   * it holds the secret in plain text, so hand it on and do not print or log it.
   * @param {object} params parameters
   * @param {string} params.clientId id of the client
   * @param {string} params.clientSecret secret of the client (at least 16 characters, see {@link RemoteProxy.generateRemoteProxySecret})
   * @param {string} params.description optional description of the client
   * @returns {NoIdObjectSkeletonInterface} the OAuth2 client
   */
  buildRemoteProxyClient(params: {
    clientId: string;
    clientSecret: string;
    description?: string;
  }): NoIdObjectSkeletonInterface;
  /**
   * Build the configuration of a remote proxy with bearer authentication to a
   * receiving tenant: the instance URL (with a trailing slash), the token
   * endpoint of the realm, client secret post, scope `fr:idm:*`, and the secret
   * as an ESV placeholder (`&{esv.name}`, derived from the id of the ESV secret
   * that holds it). It is the portable form: the secret never appears in the
   * configuration. The URLs name the receiving tenant, so a promotion would
   * carry them to the next environment unchanged; with `hostVariableId` they
   * hold an ESV placeholder instead of the host (`https://&{esv.name}/openidm/`)
   * and each environment resolves its own receiver.
   * @param {object} params parameters
   * @param {string} params.receiverHost host URL of the receiving tenant, e.g. 'https://openam-my-tenant.forgeblocks.com/am' (https only)
   * @param {string} params.clientId id of the OAuth2 client on the receiving tenant
   * @param {string} params.secretId id of the ESV secret on the sending tenant that holds the client secret, e.g. 'esv-remote-proxy-my-tenant'
   * @param {string} params.realm realm of the client on the receiving tenant (default: 'alpha')
   * @param {string} params.hostVariableId optional id of the ESV variable on the sending tenant that holds the host name of the receiving tenant (no scheme and no path, e.g. 'openam-my-tenant.forgeblocks.com'), e.g. 'esv-remote-proxy-my-tenant-host'. Without it the URLs carry the host of `receiverHost`. The variable is not created here.
   * @returns {RemoteProxySkeleton} the remote proxy configuration
   */
  buildRemoteProxyConfiguration(params: {
    receiverHost: string;
    clientId: string;
    secretId: string;
    realm?: string;
    hostVariableId?: string;
  }): RemoteProxySkeleton;
  /**
   * Generate a random secret for the OAuth2 client of a remote proxy: URL-safe
   * characters from a cryptographically secure random source.
   * @param {number} length number of characters, 32 to 256 (default: 48)
   * @returns {string} the secret
   */
  generateRemoteProxySecret(length?: number): string;
  /**
   * Check that a remote proxy works: make one read through it
   * (`GET /openidm/info/login` on the receiving tenant) and classify the answer.
   * A working proxy answers with the identity and roles the proxy is mapped to,
   * which shows at once that the token request, the static user mapping and the
   * routing work. It makes no change and returns no secret.
   * @param {string} proxyId name of the remote proxy without the type prefix
   * @returns {Promise<RemoteProxyTestResult>} a promise that resolves to the result of the check
   */
  testRemoteProxy(proxyId: string): Promise<RemoteProxyTestResult>;
  /**
   * Create an empty remote proxy export template
   * @returns {RemoteProxyExportInterface} an empty remote proxy export template
   */
  createRemoteProxyExportTemplate(): RemoteProxyExportInterface;
  /**
   * Read all remote proxies
   * @returns {Promise<RemoteProxySkeleton[]>} a promise that resolves to an array of remote proxy objects
   */
  readRemoteProxies(): Promise<RemoteProxySkeleton[]>;
  /**
   * Read remote proxy
   * @param {string} proxyId id/name of the remote proxy (the name of the receiving tenant) without the type prefix
   * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to a remote proxy object
   */
  readRemoteProxy(proxyId: string): Promise<RemoteProxySkeleton>;
  /**
   * Export remote proxy. The response can be saved to file as is.
   * @param {string} proxyId id/name of the remote proxy without the type prefix
   * @returns {Promise<RemoteProxyExportInterface>} a promise that resolves to a RemoteProxyExportInterface object
   */
  exportRemoteProxy(proxyId: string): Promise<RemoteProxyExportInterface>;
  /**
   * Export all remote proxies. The response can be saved to file as is.
   * @returns {Promise<RemoteProxyExportInterface>} a promise that resolves to a RemoteProxyExportInterface object
   */
  exportRemoteProxies(): Promise<RemoteProxyExportInterface>;
  /**
   * Create remote proxy. Fails if it already exists.
   * @param {string} proxyId id/name of the remote proxy without the type prefix
   * @param {RemoteProxySkeleton} proxyData remote proxy object
   * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to a remote proxy object
   */
  createRemoteProxy(
    proxyId: string,
    proxyData: RemoteProxySkeleton
  ): Promise<RemoteProxySkeleton>;
  /**
   * Update or create remote proxy
   * @param {string} proxyId id/name of the remote proxy without the type prefix
   * @param {RemoteProxySkeleton} proxyData remote proxy object
   * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to a remote proxy object
   */
  updateRemoteProxy(
    proxyId: string,
    proxyData: RemoteProxySkeleton
  ): Promise<RemoteProxySkeleton>;
  /**
   * Import remote proxies. The name and the configuration of every remote proxy are checked before it is written, and a refused remote proxy is never sent to the tenant. Without a result callback every remote proxy is checked before the first one is written: if any of them is refused, nothing is imported.
   * @param {RemoteProxyExportInterface} importData import data
   * @param {ResultCallback<RemoteProxySkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every remote proxy is passed to it as it happens (a refused or failed remote proxy as an error that names it) and a refused or failed remote proxy does not stop the others and does not throw: the remote proxies that were imported are returned. The refused remote proxies are reported first, then the outcome of each write. Import data without a remoteProxy object always throws.
   * @returns {Promise<RemoteProxySkeleton[]>} a promise that resolves to an array of remote proxy objects
   * @throws {FrodoError} If the import data has no remoteProxy object (always), or, without a result callback, if any remote proxy is refused (nothing is imported) or cannot be written (after every remote proxy was tried). The error carries one nested error per remote proxy.
   */
  importRemoteProxies(
    importData: RemoteProxyExportInterface,
    resultCallback?: ResultCallback<RemoteProxySkeleton>
  ): Promise<RemoteProxySkeleton[]>;
  /**
   * Delete all remote proxies
   * @returns {Promise<RemoteProxySkeleton[]>} a promise that resolves to an array of the deleted remote proxy objects
   */
  deleteRemoteProxies(): Promise<RemoteProxySkeleton[]>;
  /**
   * Delete remote proxy
   * @param {string} proxyId id/name of the remote proxy without the type prefix
   * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to the deleted remote proxy object
   */
  deleteRemoteProxy(proxyId: string): Promise<RemoteProxySkeleton>;
};

export default (state: State): RemoteProxy => {
  return {
    REMOTE_PROXY_TYPE,
    getRemoteProxyBaseUrl(proxyId: string): string {
      return getRemoteProxyBaseUrl({ proxyId, state });
    },
    isValidRemoteProxyName(proxyId: string): boolean {
      return isValidRemoteProxyName(proxyId);
    },
    getTenantBoundSecrets(proxyData: RemoteProxySkeleton): string[] {
      return getTenantBoundSecrets(proxyData);
    },
    getFixedHostUrls(proxyData: RemoteProxySkeleton): string[] {
      return getFixedHostUrls(proxyData);
    },
    buildRemoteProxyClient(params): NoIdObjectSkeletonInterface {
      return buildRemoteProxyClient(params);
    },
    buildRemoteProxyConfiguration(params): RemoteProxySkeleton {
      return buildRemoteProxyConfiguration(params);
    },
    generateRemoteProxySecret(length?: number): string {
      return generateRemoteProxySecret(length);
    },
    async testRemoteProxy(proxyId: string): Promise<RemoteProxyTestResult> {
      return testRemoteProxy({ proxyId, state });
    },
    createRemoteProxyExportTemplate(): RemoteProxyExportInterface {
      return createRemoteProxyExportTemplate({ state });
    },
    async readRemoteProxies(): Promise<RemoteProxySkeleton[]> {
      return readRemoteProxies({ state });
    },
    async readRemoteProxy(proxyId: string): Promise<RemoteProxySkeleton> {
      return readRemoteProxy({ proxyId, state });
    },
    async exportRemoteProxy(
      proxyId: string
    ): Promise<RemoteProxyExportInterface> {
      return exportRemoteProxy({ proxyId, state });
    },
    async exportRemoteProxies(): Promise<RemoteProxyExportInterface> {
      return exportRemoteProxies({ state });
    },
    async createRemoteProxy(
      proxyId: string,
      proxyData: RemoteProxySkeleton
    ): Promise<RemoteProxySkeleton> {
      return createRemoteProxy({ proxyId, proxyData, state });
    },
    async updateRemoteProxy(
      proxyId: string,
      proxyData: RemoteProxySkeleton
    ): Promise<RemoteProxySkeleton> {
      return updateRemoteProxy({ proxyId, proxyData, state });
    },
    async importRemoteProxies(
      importData: RemoteProxyExportInterface,
      resultCallback: ResultCallback<RemoteProxySkeleton> = undefined
    ): Promise<RemoteProxySkeleton[]> {
      return importRemoteProxies({ importData, resultCallback, state });
    },
    async deleteRemoteProxies(): Promise<RemoteProxySkeleton[]> {
      return deleteRemoteProxies({ state });
    },
    async deleteRemoteProxy(proxyId: string): Promise<RemoteProxySkeleton> {
      return deleteRemoteProxy({ proxyId, state });
    },
  };
};

/**
 * Remote proxy type key used to build the IDM id: 'external.idm/<id>'
 */
export const REMOTE_PROXY_TYPE = 'external.idm';

/**
 * What a remote proxy name may look like: 1 to 100 characters, starting with a
 * letter or a digit, containing only letters, digits, `.`, `_` and `-`.
 *
 * The name is spliced into an IDM entity id and into a REST path. IDM accepts
 * a `/` in an id on write, answers 400, and then cannot read or delete the
 * entity any more; `%`, `?`, `#` and path segments such as `..` would change
 * the request. Tenant names are host name labels, which this covers.
 */
const REMOTE_PROXY_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/**
 * Check the name of a remote proxy, see {@link RemoteProxy.isValidRemoteProxyName}
 * @param {string} proxyId name of the remote proxy without the type prefix
 * @returns {boolean} true if the name is allowed
 */
export function isValidRemoteProxyName(proxyId: unknown): proxyId is string {
  return typeof proxyId === 'string' && REMOTE_PROXY_NAME_PATTERN.test(proxyId);
}

/**
 * A name as it is shown in a message about a refused name: quoted, and cut after
 * 40 characters.
 * @param {unknown} proxyId the name
 * @returns {string} the text to show
 */
function showRemoteProxyName(proxyId: unknown): string {
  return typeof proxyId === 'string' && proxyId.length > 40
    ? `${JSON.stringify(proxyId.slice(0, 40))}...`
    : JSON.stringify(proxyId);
}

/**
 * Refuse a remote proxy name that is not allowed, before any request is made.
 * The error names the reason and the offending characters.
 * @param {string} proxyId name of the remote proxy without the type prefix
 */
export function validateRemoteProxyName(
  proxyId: unknown
): asserts proxyId is string {
  if (isValidRemoteProxyName(proxyId)) return;
  let reason: string;
  if (typeof proxyId !== 'string') {
    reason = 'it is not a string';
  } else if (proxyId.length === 0) {
    reason = 'it is empty';
  } else if (proxyId.length > 100) {
    reason = 'it is longer than 100 characters';
  } else {
    const offending = [
      ...new Set(
        [...proxyId].filter((character) => !/[A-Za-z0-9._-]/.test(character))
      ),
    ];
    reason =
      offending.length > 0
        ? `it contains ${offending.map((c) => JSON.stringify(c)).join(', ')}`
        : 'it does not start with a letter or a digit';
  }
  throw new FrodoError(
    `Remote proxy name ${showRemoteProxyName(proxyId)} is not allowed: ${reason}. A name has 1 to 100 characters, starts with a letter or a digit and contains only letters, digits, '.', '_' and '-'.`
  );
}

/**
 * A secret of a remote proxy. IDM encrypts a plain text value on write and
 * returns an encrypted `$crypto` object; an ESV placeholder (`&{esv.name}`) is
 * kept as it is.
 */
export type RemoteProxySecret = string | { $crypto: Record<string, unknown> };

/**
 * Get the properties of a remote proxy that hold a secret encrypted by the
 * tenant it was read from, see {@link RemoteProxy.getTenantBoundSecrets}
 * @param {RemoteProxySkeleton} proxyData remote proxy object
 * @returns {string[]} names of the properties that hold a tenant-bound secret
 */
export function getTenantBoundSecrets(
  proxyData: RemoteProxySkeleton
): string[] {
  return Object.entries(proxyData ?? {})
    .filter(
      ([, value]) =>
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        '$crypto' in value
    )
    .map(([property]) => property);
}

/**
 * A placeholder IDM resolves from a variable when it loads the configuration,
 * e.g. `&{esv.receiver.url}`
 */
const PLACEHOLDER = /&\{[^{}]+\}/g;

/**
 * The properties of a remote proxy that hold the address of the receiving tenant
 */
const URL_PROPERTIES = ['instanceUrl', 'tokenEndpoint'] as const;

/**
 * Check if the host of a URL is a placeholder, so each environment supplies its
 * own: the whole value (`&{esv.url}`), or the host part (`https://&{esv.host}/x`)
 * @param {string} url the URL
 * @returns {boolean} true if the host part contains a placeholder
 */
function hostIsPlaceholder(url: string): boolean {
  const marker = '\u0000';
  const authority = url
    .replace(PLACEHOLDER, marker)
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .split('/')[0];
  return authority.includes(marker);
}

/**
 * Get the URL properties of a remote proxy whose host is written out, see
 * {@link RemoteProxy.getFixedHostUrls}
 * @param {RemoteProxySkeleton} proxyData remote proxy object
 * @returns {string[]} names of the URL properties that have a fixed host
 */
export function getFixedHostUrls(proxyData: RemoteProxySkeleton): string[] {
  return URL_PROPERTIES.filter((property) => {
    const value = proxyData?.[property];
    return (
      typeof value === 'string' && value !== '' && !hostIsPlaceholder(value)
    );
  });
}

/**
 * A remote proxy configuration: the connection from this tenant to a
 * receiving tenant. The id is the name of the receiving tenant.
 */
export type RemoteProxySkeleton = IdObjectSkeletonInterface & {
  enabled?: boolean;
  authType: 'basic' | 'bearer';
  /**
   * URL of the receiving tenant's IDM, with a trailing slash. It may end with
   * an ESV placeholder (`&{esv.name}`), whose value then supplies the slash.
   */
  instanceUrl: string;
  // authType 'basic'
  userName?: string;
  password?: RemoteProxySecret;
  // authType 'bearer'
  clientId?: string;
  clientSecret?: RemoteProxySecret;
  tokenEndpoint?: string;
  tokenEndpointAuthMethod?: string;
  scope?: string[];
  scopeDelimiter?: string;
};

export interface RemoteProxyExportInterface {
  meta?: ExportMetaData;
  remoteProxy: Record<string, RemoteProxySkeleton>;
}

/**
 * The scope a remote proxy needs on the receiving tenant: IDM, nothing broader
 */
const REMOTE_PROXY_SCOPE = 'fr:idm:*';

const OAUTH2_CLIENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const REALM_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const ESV_SECRET_ID_PATTERN = /^esv(-[a-z0-9]+)+$/;
const MIN_CLIENT_SECRET_LENGTH = 16;

/**
 * The placeholder that refers to an ESV by its id: `esv-a-b` is `&{esv.a.b}`
 */
function esvPlaceholder(esvId: string): string {
  return `&{${esvId.replaceAll('-', '.')}}`;
}

/**
 * Build the OAuth2 client a remote proxy needs on the receiving tenant, see
 * {@link RemoteProxy.buildRemoteProxyClient}
 */
export function buildRemoteProxyClient({
  clientId,
  clientSecret,
  description = 'Created by Frodo for an IDM remote proxy',
}: {
  clientId: string;
  clientSecret: string;
  description?: string;
}): NoIdObjectSkeletonInterface {
  if (
    typeof clientId !== 'string' ||
    !OAUTH2_CLIENT_ID_PATTERN.test(clientId)
  ) {
    throw new FrodoError(
      `Client id ${JSON.stringify(clientId)} is not allowed: use 1 to 100 characters, starting with a letter or a digit, containing only letters, digits, '.', '_' and '-'`
    );
  }
  if (
    typeof clientSecret !== 'string' ||
    clientSecret.length < MIN_CLIENT_SECRET_LENGTH
  ) {
    throw new FrodoError(
      `The client secret must have at least ${MIN_CLIENT_SECRET_LENGTH} characters`
    );
  }
  return {
    coreOAuth2ClientConfig: {
      userpassword: clientSecret,
      clientName: { inherited: false, value: [clientId] },
      clientType: { inherited: false, value: 'Confidential' },
      status: { inherited: false, value: 'Active' },
      scopes: { inherited: false, value: [REMOTE_PROXY_SCOPE] },
      defaultScopes: { inherited: false, value: [REMOTE_PROXY_SCOPE] },
    },
    advancedOAuth2ClientConfig: {
      descriptions: { inherited: false, value: [description] },
      grantTypes: { inherited: false, value: ['client_credentials'] },
      tokenEndpointAuthMethod: {
        inherited: false,
        value: 'client_secret_post',
      },
      responseTypes: { inherited: false, value: ['token'] },
    },
  } as NoIdObjectSkeletonInterface;
}

/**
 * Build the bearer configuration of a remote proxy, see
 * {@link RemoteProxy.buildRemoteProxyConfiguration}
 */
export function buildRemoteProxyConfiguration({
  receiverHost,
  clientId,
  secretId,
  realm = 'alpha',
  hostVariableId,
}: {
  receiverHost: string;
  clientId: string;
  secretId: string;
  realm?: string;
  hostVariableId?: string;
}): RemoteProxySkeleton {
  let host: URL;
  try {
    host = new URL(receiverHost);
  } catch (error) {
    throw new FrodoError(
      `The host of the receiving tenant is not a URL: ${JSON.stringify(receiverHost)}`,
      error
    );
  }
  if (host.protocol !== 'https:') {
    throw new FrodoError(
      `The host of the receiving tenant must use https: the client secret is sent to it`
    );
  }
  if (
    typeof clientId !== 'string' ||
    !OAUTH2_CLIENT_ID_PATTERN.test(clientId)
  ) {
    throw new FrodoError(
      `Client id ${JSON.stringify(clientId)} is not allowed: use 1 to 100 characters, starting with a letter or a digit, containing only letters, digits, '.', '_' and '-'`
    );
  }
  if (typeof secretId !== 'string' || !ESV_SECRET_ID_PATTERN.test(secretId)) {
    throw new FrodoError(
      `The ESV secret id ${JSON.stringify(secretId)} is not allowed: it starts with 'esv' and continues with lowercase letters and digits separated by '-'`
    );
  }
  if (typeof realm !== 'string' || !REALM_NAME_PATTERN.test(realm)) {
    throw new FrodoError(
      `The realm ${JSON.stringify(realm)} is not allowed: use letters, digits, '_' and '-'`
    );
  }
  if (
    hostVariableId !== undefined &&
    (typeof hostVariableId !== 'string' ||
      !ESV_SECRET_ID_PATTERN.test(hostVariableId))
  ) {
    throw new FrodoError(
      `The ESV variable id ${JSON.stringify(hostVariableId)} is not allowed: it starts with 'esv' and continues with lowercase letters and digits separated by '-'`
    );
  }
  if (hostVariableId === secretId) {
    throw new FrodoError(
      `The ESV secret and the ESV variable for the host cannot have the same id (${secretId})`
    );
  }
  const origin =
    hostVariableId === undefined
      ? getHostOnlyUrl(receiverHost)
      : `https://${esvPlaceholder(hostVariableId)}`;
  const proxyData: RemoteProxySkeleton = {
    enabled: true,
    authType: 'bearer',
    instanceUrl: `${origin}/openidm/`,
    clientId,
    clientSecret: esvPlaceholder(secretId),
    scope: [REMOTE_PROXY_SCOPE],
    tokenEndpoint: `${origin}/am/oauth2/realms/root/realms/${realm}/access_token`,
    tokenEndpointAuthMethod: 'client_secret_post',
    scopeDelimiter: ' ',
  };
  validateRemoteProxy('configuration', proxyData);
  return proxyData;
}

/**
 * Generate a random secret for the OAuth2 client of a remote proxy, see
 * {@link RemoteProxy.generateRemoteProxySecret}
 */
export function generateRemoteProxySecret(length = 48): string {
  if (!Number.isInteger(length) || length < 32 || length > 256) {
    throw new FrodoError(
      `The length of a remote proxy secret is a whole number from 32 to 256`
    );
  }
  return randomBytes(Math.ceil((length * 3) / 4))
    .toString('base64url')
    .slice(0, length);
}

/**
 * The result of {@link RemoteProxy.testRemoteProxy}
 */
export type RemoteProxyTestResult = {
  ok: boolean;
  /**
   * `ok`: the receiving tenant answered. `not-found`: this tenant has no
   * working proxy of that name: it does not exist, or its configuration cannot
   * be loaded (IDM does not load a proxy whose ESV placeholder cannot be
   * resolved, so a proxy that refers to an ESV secret that does not exist or
   * was not applied yet answers 404). `unavailable`: the proxy is disabled or
   * not ready. `token-request-failed`: the proxy could not get a token from the
   * receiving tenant (unknown client, wrong secret or token endpoint).
   * `not-authorized`: the token was issued but the receiving tenant refused the
   * request, typically because the client has no static user mapping (HTTP 500
   * 'Access Denied' through the proxy, also 401 and 403). `unreachable`: no
   * answer. `error`: anything else.
   */
  status:
    | 'ok'
    | 'not-found'
    | 'unavailable'
    | 'token-request-failed'
    | 'not-authorized'
    | 'unreachable'
    | 'error';
  httpStatus?: number;
  /**
   * The identity the proxy acts as on the receiving tenant (status `ok`)
   */
  authenticationId?: string;
  /**
   * The roles of that identity (status `ok`)
   */
  roles?: string[];
  message: string;
};

/**
 * Check that a remote proxy works, see {@link RemoteProxy.testRemoteProxy}
 */
export async function testRemoteProxy({
  proxyId,
  state,
}: {
  proxyId: string;
  state: State;
}): Promise<RemoteProxyTestResult> {
  validateRemoteProxyName(proxyId);
  debugMessage({
    message: `RemoteProxyOps.testRemoteProxy: start [proxyId=${proxyId}]`,
    state,
  });
  const viewState = deriveState(state, {
    getIdmHost: () => getRemoteProxyBaseUrl({ proxyId, state }),
  });
  try {
    const info = await getIdmLoginInfo({ state: viewState });
    const roles: string[] | undefined = info?.authorization?.roles;
    return {
      ok: true,
      status: 'ok',
      httpStatus: 200,
      authenticationId: info?.authenticationId,
      roles,
      message: `Remote proxy ${proxyId} works: the receiving tenant answers as '${info?.authenticationId}'`,
    };
  } catch (error) {
    const httpStatus: number | undefined = error?.response?.status;
    const text = String(error?.response?.data?.message ?? error?.message ?? '');
    if (httpStatus === 404) {
      return {
        ok: false,
        status: 'not-found',
        httpStatus,
        message: `This tenant has no working remote proxy named ${proxyId} (404): there is no such proxy, or its configuration cannot be loaded, typically because an ESV secret it refers to does not exist or has not been applied yet`,
      };
    }
    if (httpStatus === 503) {
      return {
        ok: false,
        status: 'unavailable',
        httpStatus,
        message: `Remote proxy ${proxyId} is disabled or not ready (503)`,
      };
    }
    if (httpStatus === 500 && /application\/json/i.test(text)) {
      return {
        ok: false,
        status: 'token-request-failed',
        httpStatus,
        message: `Remote proxy ${proxyId} could not get a token from the receiving tenant (500): the client or its secret is wrong, the token endpoint is wrong, or the ESV secret is not loaded yet (an ESV change needs an apply)`,
      };
    }
    if (
      httpStatus === 401 ||
      httpStatus === 403 ||
      (httpStatus === 500 && /access denied/i.test(text))
    ) {
      return {
        ok: false,
        status: 'not-authorized',
        httpStatus,
        message: `The receiving tenant refused the request of remote proxy ${proxyId} (${httpStatus}): the token was issued, but the client is not allowed, typically because it has no static user mapping`,
      };
    }
    if (httpStatus === undefined) {
      return {
        ok: false,
        status: 'unreachable',
        message: `No answer for remote proxy ${proxyId}: ${text}`,
      };
    }
    return {
      ok: false,
      status: 'error',
      httpStatus,
      message: `Remote proxy ${proxyId} failed (${httpStatus}): ${text}`,
    };
  }
}

/**
 * Properties each authentication type needs
 */
const REQUIRED_PROPERTIES: Record<string, string[]> = {
  basic: ['userName', 'password'],
  bearer: ['clientId', 'clientSecret', 'tokenEndpoint'],
};

/**
 * Check a remote proxy before it is sent to the tenant
 * @param {string} proxyId id/name of the remote proxy without the type prefix
 * @param {RemoteProxySkeleton} proxyData remote proxy object
 */
function validateRemoteProxy(
  proxyId: string,
  proxyData: RemoteProxySkeleton
): void {
  const entityId = `${REMOTE_PROXY_TYPE}/${proxyId}`;
  if (proxyData?._id !== undefined && proxyData._id !== entityId) {
    throw new FrodoError(
      `Remote proxy ${proxyId} has the id '${proxyData._id}'; expected '${entityId}'`
    );
  }
  const authType = proxyData?.authType;
  if (!Object.keys(REQUIRED_PROPERTIES).includes(authType)) {
    throw new FrodoError(
      `Remote proxy ${proxyId} has authType '${authType}'; expected 'basic' or 'bearer'`
    );
  }
  if (
    typeof proxyData.instanceUrl !== 'string' ||
    !(
      proxyData.instanceUrl.endsWith('/') ||
      /&\{[^{}]+\}$/.test(proxyData.instanceUrl)
    )
  ) {
    throw new FrodoError(
      `Remote proxy ${proxyId} needs an instanceUrl that ends with a trailing slash (or with an ESV placeholder whose value does)`
    );
  }
  const missing = REQUIRED_PROPERTIES[authType].filter(
    (property) => !proxyData[property]
  );
  if (missing.length > 0) {
    throw new FrodoError(
      `Remote proxy ${proxyId} with authType '${authType}' is missing ${missing.join(', ')}`
    );
  }
}

/**
 * Get the IDM base URL that routes IDM REST calls through a remote proxy to
 * the receiving tenant: `<host>/openidm/external/idm/<proxyId>`. Refuses a
 * name that is not allowed (see {@link RemoteProxy.isValidRemoteProxyName}).
 * @param {string} proxyId id/name of the remote proxy without the type prefix
 * @returns {string} the IDM base URL of the remote proxy
 */
export function getRemoteProxyBaseUrl({
  proxyId,
  state,
}: {
  proxyId: string;
  state: State;
}): string {
  validateRemoteProxyName(proxyId);
  return `${getHostOnlyUrl(state.getHost())}/openidm/external/idm/${proxyId}`;
}

export function createRemoteProxyExportTemplate({
  state,
}: {
  state: State;
}): RemoteProxyExportInterface {
  return {
    meta: getMetadata({ state }),
    remoteProxy: {},
  } as RemoteProxyExportInterface;
}

/**
 * Read all remote proxies
 * @returns {Promise<RemoteProxySkeleton[]>} a promise that resolves to an array of remote proxy objects
 */
export async function readRemoteProxies({
  state,
}: {
  state: State;
}): Promise<RemoteProxySkeleton[]> {
  try {
    const proxies = await readConfigEntitiesByType({
      type: `${REMOTE_PROXY_TYPE}/`,
      state,
    });
    return proxies as RemoteProxySkeleton[];
  } catch (error) {
    throw new FrodoError(`Error reading remote proxies`, error);
  }
}

/**
 * Read remote proxy
 * @param {string} proxyId id/name of the remote proxy without the type prefix
 * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to a remote proxy object
 */
export async function readRemoteProxy({
  proxyId,
  state,
}: {
  proxyId: string;
  state: State;
}): Promise<RemoteProxySkeleton> {
  validateRemoteProxyName(proxyId);
  try {
    return (await getConfigEntity({
      entityId: `${REMOTE_PROXY_TYPE}/${proxyId}`,
      state,
    })) as RemoteProxySkeleton;
  } catch (error) {
    throw new FrodoError(`Error reading remote proxy ${proxyId}`, error);
  }
}

/**
 * Export remote proxy. The response can be saved to file as is.
 * @param {string} proxyId id/name of the remote proxy without the type prefix
 * @returns {Promise<RemoteProxyExportInterface>} a promise that resolves to a RemoteProxyExportInterface object
 */
export async function exportRemoteProxy({
  proxyId,
  state,
}: {
  proxyId: string;
  state: State;
}): Promise<RemoteProxyExportInterface> {
  validateRemoteProxyName(proxyId);
  try {
    debugMessage({
      message: `RemoteProxyOps.exportRemoteProxy: start [proxyId=${proxyId}]`,
      state,
    });
    const exportData = createRemoteProxyExportTemplate({ state });
    exportData.remoteProxy[proxyId] = await readRemoteProxy({
      proxyId,
      state,
    });
    debugMessage({
      message: `RemoteProxyOps.exportRemoteProxy: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting remote proxy ${proxyId}`, error);
  }
}

/**
 * Export all remote proxies. The response can be saved to file as is.
 * @returns {Promise<RemoteProxyExportInterface>} a promise that resolves to a RemoteProxyExportInterface object
 */
export async function exportRemoteProxies({
  state,
}: {
  state: State;
}): Promise<RemoteProxyExportInterface> {
  try {
    debugMessage({
      message: `RemoteProxyOps.exportRemoteProxies: start`,
      state,
    });
    const exportData = createRemoteProxyExportTemplate({ state });
    const remoteProxies = await readRemoteProxies({ state });
    const indicatorId = createProgressIndicator({
      total: remoteProxies.length,
      message: 'Exporting remote proxies...',
      state,
    });
    for (const remoteProxy of remoteProxies) {
      const proxyId = remoteProxy._id.replace(`${REMOTE_PROXY_TYPE}/`, '');
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting remote proxy ${proxyId}`,
        state,
      });
      exportData.remoteProxy[proxyId] = remoteProxy;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${remoteProxies.length} remote proxies.`,
      state,
    });
    debugMessage({
      message: `RemoteProxyOps.exportRemoteProxies: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting remote proxies`, error);
  }
}

/**
 * Create remote proxy. Fails if it already exists.
 * @param {string} proxyId id/name of the remote proxy without the type prefix
 * @param {RemoteProxySkeleton} proxyData remote proxy object
 * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to a remote proxy object
 */
export async function createRemoteProxy({
  proxyId,
  proxyData,
  state,
}: {
  proxyId: string;
  proxyData: RemoteProxySkeleton;
  state: State;
}): Promise<RemoteProxySkeleton> {
  debugMessage({
    message: `RemoteProxyOps.createRemoteProxy: start`,
    state,
  });
  validateRemoteProxyName(proxyId);
  validateRemoteProxy(proxyId, proxyData);
  try {
    await readRemoteProxy({ proxyId, state });
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw new FrodoError(
        `Error checking if remote proxy ${proxyId} already exists`,
        error
      );
    }
    try {
      const result = await putConfigEntity({
        entityId: `${REMOTE_PROXY_TYPE}/${proxyId}`,
        entityData: proxyData,
        state,
      });
      debugMessage({
        message: `RemoteProxyOps.createRemoteProxy: end`,
        state,
      });
      return result as RemoteProxySkeleton;
    } catch (error) {
      throw new FrodoError(`Error creating remote proxy ${proxyId}`, error);
    }
  }
  throw new FrodoError(`Remote proxy ${proxyId} already exists!`);
}

/**
 * Update or create remote proxy
 * @param {string} proxyId id/name of the remote proxy without the type prefix
 * @param {RemoteProxySkeleton} proxyData remote proxy object
 * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to a remote proxy object
 */
export async function updateRemoteProxy({
  proxyId,
  proxyData,
  state,
}: {
  proxyId: string;
  proxyData: RemoteProxySkeleton;
  state: State;
}): Promise<RemoteProxySkeleton> {
  validateRemoteProxyName(proxyId);
  validateRemoteProxy(proxyId, proxyData);
  try {
    const remoteProxy = await putConfigEntity({
      entityId: `${REMOTE_PROXY_TYPE}/${proxyId}`,
      entityData: proxyData,
      state,
    });
    return remoteProxy as RemoteProxySkeleton;
  } catch (error) {
    throw new FrodoError(`Error updating remote proxy ${proxyId}`, error);
  }
}

/**
 * Import remote proxies. The name and the configuration of every remote proxy are checked before it is written, and a refused remote proxy is never sent to the tenant. Without a result callback every remote proxy is checked before the first one is written: if any of them is refused, nothing is imported.
 * @param {RemoteProxyExportInterface} importData import data
 * @param {ResultCallback<RemoteProxySkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every remote proxy is passed to it as it happens (a refused or failed remote proxy as an error that names it) and a refused or failed remote proxy does not stop the others and does not throw: the remote proxies that were imported are returned. The refused remote proxies are reported first, then the outcome of each write. Import data without a remoteProxy object always throws.
 * @returns {Promise<RemoteProxySkeleton[]>} a promise that resolves to an array of remote proxy objects
 * @throws {FrodoError} If the import data has no remoteProxy object (always), or, without a result callback, if any remote proxy is refused (nothing is imported) or cannot be written (after every remote proxy was tried). The error carries one nested error per remote proxy.
 */
export async function importRemoteProxies({
  importData,
  resultCallback = undefined,
  state,
}: {
  importData: RemoteProxyExportInterface;
  resultCallback?: ResultCallback<RemoteProxySkeleton>;
  state: State;
}): Promise<RemoteProxySkeleton[]> {
  debugMessage({
    message: `RemoteProxyOps.importRemoteProxies: start`,
    state,
  });
  const proxies = importData?.remoteProxy;
  if (proxies === null || typeof proxies !== 'object') {
    throw new FrodoError(
      `Error importing remote proxies: the import data has no remoteProxy object`
    );
  }
  const refused: Error[] = [];
  const accepted: string[] = [];
  for (const proxyId of Object.keys(proxies)) {
    try {
      validateRemoteProxyName(proxyId);
      validateRemoteProxy(proxyId, proxies[proxyId]);
      accepted.push(proxyId);
    } catch (error) {
      if (resultCallback) {
        // a refused remote proxy is reported and left out, the others go on
        resultCallback(
          new FrodoError(
            `Error importing remote proxy ${
              isValidRemoteProxyName(proxyId)
                ? proxyId
                : showRemoteProxyName(proxyId)
            }`,
            error
          ),
          undefined
        );
      } else {
        refused.push(error);
      }
    }
  }
  if (refused.length > 0) {
    throw new FrodoError(
      `Error importing remote proxies: nothing was imported`,
      refused
    );
  }
  const response: RemoteProxySkeleton[] = [];
  const errors = [];
  for (const proxyId of accepted) {
    let imported: RemoteProxySkeleton;
    let failed = false;
    let failure: unknown;
    try {
      debugMessage({
        message: `RemoteProxyOps.importRemoteProxies: ${proxyId}`,
        state,
      });
      imported = await updateRemoteProxy({
        proxyId,
        proxyData: proxies[proxyId],
        state,
      });
    } catch (error) {
      failed = true;
      failure = error;
    }
    // the callback is called outside the try: an exception of the callback must
    // not be taken for a failed import and reported a second time
    if (!failed) {
      response.push(imported);
      if (resultCallback) resultCallback(undefined, imported);
    } else if (resultCallback) {
      resultCallback(
        new FrodoError(
          `Error importing remote proxy ${proxyId}`,
          failure as Error
        ),
        undefined
      );
    } else {
      errors.push(failure);
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing remote proxies`, errors);
  }
  debugMessage({
    message: `RemoteProxyOps.importRemoteProxies: end`,
    state,
  });
  return response;
}

/**
 * Delete all remote proxies
 * @returns {Promise<RemoteProxySkeleton[]>} a promise that resolves to an array of the deleted remote proxy objects
 */
export async function deleteRemoteProxies({
  state,
}: {
  state: State;
}): Promise<RemoteProxySkeleton[]> {
  const errors: Error[] = [];
  try {
    debugMessage({
      message: `RemoteProxyOps.deleteRemoteProxies: start`,
      state,
    });
    const result: RemoteProxySkeleton[] = [];
    const remoteProxies = await readRemoteProxies({ state });
    for (const remoteProxy of remoteProxies) {
      try {
        debugMessage({
          message: `RemoteProxyOps.deleteRemoteProxies: '${remoteProxy._id}'`,
          state,
        });
        // an entity whose name is not allowed (created outside this module)
        // cannot be addressed through the REST API: report it, do not try
        validateRemoteProxyName(
          remoteProxy._id.replace(`${REMOTE_PROXY_TYPE}/`, '')
        );
        result.push(
          (await deleteConfigEntity({
            entityId: remoteProxy._id,
            state,
          })) as RemoteProxySkeleton
        );
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error deleting remote proxies`, errors);
    }
    debugMessage({
      message: `RemoteProxyOps.deleteRemoteProxies: end`,
      state,
    });
    return result;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error deleting remote proxies`, error);
  }
}

/**
 * Delete remote proxy
 * @param {string} proxyId id/name of the remote proxy without the type prefix
 * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to the deleted remote proxy object
 */
export async function deleteRemoteProxy({
  proxyId,
  state,
}: {
  proxyId: string;
  state: State;
}): Promise<RemoteProxySkeleton> {
  validateRemoteProxyName(proxyId);
  try {
    const remoteProxy = await deleteConfigEntity({
      entityId: `${REMOTE_PROXY_TYPE}/${proxyId}`,
      state,
    });
    return remoteProxy as RemoteProxySkeleton;
  } catch (error) {
    throw new FrodoError(`Error deleting remote proxy ${proxyId}`, error);
  }
}
