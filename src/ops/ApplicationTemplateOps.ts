import fs from 'fs';
import { gunzipSync } from 'zlib';
import {
  APP_TEMPLATE_CATALOG_MAX_DOWNLOAD_BYTES,
  APP_TEMPLATE_CATALOG_URLS,
  getApplicationTemplateCatalogFile,
  getApplicationTemplateOverrides,
  type ApplicationTemplateCatalogChannel,
} from '../api/ApplicationTemplateApi';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { FrodoError } from './FrodoError';
import {
  getCatalogCacheDirectory,
  getCatalogCacheFiles,
  readCatalogCacheMeta,
  readLimitedFile,
  tryRemoveCacheFile,
  tryWriteCacheFile,
  type CatalogCacheMeta,
} from './internal/ApplicationTemplateCatalogCache';

/**
 * An application template: the form definition of the Admin UI plus, for a
 * provisioning template, the connector defaults. Only the fields the library
 * reads are typed; the rest (`schema`, `capabilities`, `connectorTemplate`, ...)
 * is kept as it is.
 *
 * @remarks
 * In the catalog the `id` of a template is its **name**, the value an
 * application record keeps in `templateName` (`azure.ad`, `saml`, `web`), and
 * the same for every version of the template. The key under which the catalog
 * keeps the template is the unique **template id** (`3_3-azure-ad`), see
 * {@link getTemplateId}.
 */
export type ApplicationTemplateSkeleton = {
  /** The template name, for example `azure.ad`. */
  id: string;
  /** The version of the template, for example `3.3`. */
  templateVersion: string;
  displayName?: string;
  /** `Enterprise`, `Consumer`, `SAML`, `wsfed` or `Bookmark`. */
  templateType?: string;
  dateUpdated?: string;
  [key: string]: unknown;
};

/** A template the tenant defines itself: the IDM configuration entity `appTemplate/<id>`. */
export type ApplicationTemplateOverrideSkeleton =
  ApplicationTemplateSkeleton & {
    /** The id of the configuration entity, for example `appTemplate/myTemplate`. */
    _id: string;
    _rev?: string;
  };

/** Templates of one tier, by group (a product such as `AzureAD`), then by template id. */
export type ApplicationTemplateGroups = Record<
  string,
  Record<string, ApplicationTemplateSkeleton>
>;

/** The application template catalog, as the Admin UI reads it. */
export type ApplicationTemplateCatalog = {
  AppTemplates: {
    /** Templates of applications that use the tenant as their identity provider: web, native, service, SAML, WS-Federation, bookmark and custom. */
    consumer: ApplicationTemplateGroups;
    /** Templates of applications that the tenant provisions to: connectors and their defaults. */
    enterprise: ApplicationTemplateGroups;
  };
  /** SAML service provider metadata templates. Not read by the library. */
  SamlTemplates?: Record<string, unknown>;
};

/** Where a catalog came from. */
export type ApplicationTemplateCatalogSource = {
  /**
   * `explicit` is a catalog the caller handed over, `url` a URL the caller
   * named, `cdn` the default source (the public catalog of the Admin UI).
   */
  kind: 'explicit' | 'url' | 'cdn';
  /** The URL, or `explicit catalog`. It is what an error message names. */
  location: string;
  /** The catalog of the CDN that was read; only for `cdn`. */
  channel?: ApplicationTemplateCatalogChannel;
};

/**
 * What the cache of the catalog (see `State.setUseTemplateCatalogCache`) did
 * for a read:
 *
 * - `disabled`: not used, because it is off or the catalog was not read from the
 *   public source;
 * - `miss`: there was no usable copy; the catalog was downloaded and kept;
 * - `fresh`: the kept copy is younger than `maxAgeMs`; the source was not asked;
 * - `revalidated`: the source confirmed (304) that the kept copy is current;
 * - `refreshed`: the source sent a newer catalog (200) and the copy was replaced;
 * - `stale-after-error`: the source could not be reached or answered with a
 *   server error, so the kept copy was used (`cacheError` says why);
 * - `offline`: air-gapped mode is on, so the kept copy was used without a
 *   request, whatever its age.
 */
export type ApplicationTemplateCacheOutcome =
  | 'disabled'
  | 'miss'
  | 'fresh'
  | 'revalidated'
  | 'refreshed'
  | 'stale-after-error'
  | 'offline';

/** What is known about a catalog besides its content. */
export type ApplicationTemplateCatalogMetadata = {
  source: ApplicationTemplateCatalogSource;
  /** The `ETag` of the download, if the server sent one. */
  etag?: string;
  /** The `Last-Modified` of the download, if the server sent one. */
  lastModified?: string;
  /** When the catalog was downloaded (ISO 8601); not set for an explicit catalog. */
  fetchedAt?: string;
  /** True if the catalog was kept from an earlier read of the same state. */
  cached: boolean;
  /** What the cache of the catalog did for this read. */
  cache: ApplicationTemplateCacheOutcome;
  /** The file of the cached catalog, if the cache was used. It is the decoded catalog and can be handed to the library as an explicit catalog on another machine. */
  cachePath?: string;
  /** Why the source was not used, when `cache` is `stale-after-error`. */
  cacheError?: string;
};

/** A catalog together with its metadata. */
export type ApplicationTemplateCatalogResult = {
  catalog: ApplicationTemplateCatalog;
  metadata: ApplicationTemplateCatalogMetadata;
};

/** Which catalog to read. The first one that is given wins: `catalog`, then `url`, then the CDN. */
export type ApplicationTemplateCatalogOptions = {
  /**
   * A catalog the caller already has: the parsed object, its JSON text, or the
   * bytes of the file (gzip or plain JSON). Nothing is requested.
   */
  catalog?: ApplicationTemplateCatalog | string | Uint8Array;
  /**
   * An http(s) URL the caller names, for example a mirror of the catalog. Any
   * host is accepted, on purpose: it is meant for a location the caller
   * chooses, such as a mirror on a private network. Redirects are followed. It
   * is requested without any credential of the tenant, and it is allowed in
   * air-gapped mode, because the caller named it. A tool that passes arguments
   * on behalf of someone else (the MCP tools of the library do not offer
   * `url`, `catalog` or `refresh`) must not let that party choose it.
   */
  url?: string;
  /** Which catalog of the CDN to read when neither `catalog` nor `url` is given. Default: `production`. */
  channel?: ApplicationTemplateCatalogChannel;
  /**
   * Check the source now, whatever the age of the copy the cache holds: the
   * request is still conditional, so a copy that is current costs no download.
   * Without the cache, read again instead of using the catalog kept from an
   * earlier read of this state. Default: false.
   */
  refresh?: boolean;
  /**
   * Download the catalog without validators and keep the result, whatever the
   * cache holds; a failed download is an error, the old copy is not used.
   * Only for the public source with the cache on. Default: false.
   */
  ignoreCache?: boolean;
  /**
   * How old a copy in the cache may be, in milliseconds, before the source is
   * asked about it again. Default: 3,600,000 (one hour), the time the source
   * allows a copy to be kept. Zero asks every time.
   */
  maxAgeMs?: number;
};

/** Options of {@link ApplicationTemplate.listTemplates}. */
export type ApplicationTemplateListOptions =
  ApplicationTemplateCatalogOptions & {
    /** Merge the templates of the tenant over the catalog. Needs a connection to the tenant. Default: true. */
    includeOverrides?: boolean;
  };

/** One template version of the merged list. */
export type ApplicationTemplateListItem = {
  /** The unique id of this version, for example `3_3-azure-ad`. */
  templateId: string;
  /** The template name an application record keeps in `templateName`, for example `azure.ad`. */
  name: string;
  /** The product group of the catalog (for example `AzureAD`); not set for a template of the tenant that has no counterpart in the catalog. */
  group?: string;
  /** `enterprise` for provisioning templates, `consumer` for the others. */
  tier: 'consumer' | 'enterprise';
  templateVersion: string;
  displayName?: string;
  templateType?: string;
  dateUpdated?: string;
  /** True if the tenant defines this version itself (it replaces a catalog entry of the same id). */
  isOverride: boolean;
  /** True if no other version of this template has a higher version. */
  newestInGroup: boolean;
};

/** What an application record says about its template. An {@link ApplicationSkeleton} fits. */
export type ApplicationTemplateReference = {
  templateName: string;
  templateVersion: string;
};

/** Options of {@link ApplicationTemplate.readTemplate}. */
export type ApplicationTemplateReadOptions = ApplicationTemplateListOptions;

/** The template an application record was made from. */
export type ApplicationTemplateResolution = {
  /**
   * The unique id of the version the record names, built from its
   * `templateName` and `templateVersion` (a trailing `-override` of the name is
   * left out). It is set whether or not the template exists.
   */
  templateId: string;
  /** True if a template of that name exists in the catalog or the tenant's templates, in any version. */
  found: boolean;
  /** True if that exact version exists. */
  versionExists: boolean;
  /** True if that exact version exists and no other version of the template is newer. */
  newestInGroup: boolean;
  /** The newest version of the template; not set if no template of that name exists. */
  newestVersion?: string;
  /** True if the exact version is a template the tenant defines itself. */
  isOverride: boolean;
  /** Where the exact version was found; not set if it does not exist. */
  source?: 'catalog' | 'override';
  /** The exact version; not set if it does not exist. */
  template?: ApplicationTemplateSkeleton;
  /** The catalog that was used. */
  catalog: ApplicationTemplateCatalogMetadata;
};

/** What the name of a template ends with when the Admin UI marks a template of the tenant. */
const OVERRIDE_SUFFIX = '-override';

/** The source name of a catalog that the caller handed over. */
const EXPLICIT_LOCATION = 'explicit catalog';

/** The most a catalog may be once decompressed. The real catalog is about 1.5 MB. */
const MAX_CATALOG_BYTES = 32 * 1024 * 1024;

/** The most gzip layers a catalog file may be wrapped in. The real file has two: the stored file and the transport. */
const MAX_GZIP_LAYERS = 2;

/**
 * The deepest a catalog may be nested, counting the object of the catalog
 * itself as level 1. The real catalog has 17 levels. A deeper value cannot be
 * copied without overflowing the stack, and a result that deep is not usable
 * by anything that serialises it.
 */
const MAX_NESTING_LEVELS = 100;

/** How long a copy in the cache is used without asking the source: the `max-age` that the source sends. */
const DEFAULT_CACHE_MAX_AGE_MS = 3_600_000;

const megabytes = (bytes: number): string => `${bytes / (1024 * 1024)} MB`;

export type ApplicationTemplate = {
  /**
   * Read the application template catalog. The default source is the public
   * catalog that the Admin UI uses on Ping's CDN; it is requested without any
   * credential of the tenant, and through the proxy settings of the library.
   * The paths of the CDN are what the Admin UI happens to use, not a documented
   * interface. A catalog that the caller has (`catalog`) or a URL that the
   * caller names (`url`) is used instead. A catalog that was downloaded is kept
   * for the state until `refresh` is set. Unless the cache is on, the library
   * writes no file: the result holds the catalog and what identifies the
   * download (`etag`, `lastModified`, `fetchedAt`), so that a caller can save it.
   *
   * With the cache on (`state.setUseTemplateCatalogCache(true)`), the catalog
   * of the default source is kept in a directory
   * (`state.setTemplateCatalogCachePath`, default `~/.frodo/AppTemplates`) as
   * `<channel>.json` (the decoded catalog, which can be copied to a machine
   * that cannot reach the source and given there as `catalog`) and
   * `<channel>.meta.json`. A copy younger than `maxAgeMs` (default one hour) is
   * used with no request. An older one is asked about with its `ETag` and
   * `Last-Modified`, so a copy that is current costs no download (304). If the
   * source cannot be reached or fails on its side, the old copy is used and the
   * result says so (`cache: 'stale-after-error'`). `refresh` asks the source now
   * but still conditionally; `ignoreCache` downloads without validators. A
   * catalog the caller hands over and a URL the caller names are never kept.
   * The files are not trusted: they go through the same limits and checks as a
   * download, and one that fails them is replaced. A write that fails never
   * fails the read.
   *
   * When air-gapped mode is on (`state.setAirGapped`), no request is made: the
   * copy in the cache is used, whatever its age, and without one the call fails
   * with the error code `AIR_GAPPED`; an explicit catalog and a URL the caller
   * names still work. `metadata.cache` says what the cache did.
   * @param {ApplicationTemplateCatalogOptions} options which catalog to read
   * @returns {Promise<ApplicationTemplateCatalogResult>} a promise that resolves to the catalog and its metadata
   */
  readCatalog(
    options?: ApplicationTemplateCatalogOptions
  ): Promise<ApplicationTemplateCatalogResult>;
  /**
   * Read the application templates that the tenant defines itself (the IDM
   * configuration entities `appTemplate/<id>`). The Admin UI merges them over
   * the catalog and marks them as overrides.
   * @returns {Promise<ApplicationTemplateOverrideSkeleton[]>} a promise that resolves to the templates of the tenant, each with its `_id`
   */
  readOverrides(): Promise<ApplicationTemplateOverrideSkeleton[]>;
  /**
   * List the template versions of the catalog with the templates of the tenant
   * merged over them (a template of the tenant with the id of a catalog
   * template replaces it), sorted by name and version. A summary of each
   * version is returned, without the form definition. Set `includeOverrides`
   * to false to list the catalog alone, which needs no connection to a tenant.
   * @param {ApplicationTemplateListOptions} options which catalog to read, and whether to merge the templates of the tenant
   * @returns {Promise<ApplicationTemplateListItem[]>} a promise that resolves to the template versions
   */
  listTemplates(
    options?: ApplicationTemplateListOptions
  ): Promise<ApplicationTemplateListItem[]>;
  /**
   * Read the template that an application record was made from, and say
   * whether that version exists, whether it is the newest one and whether the
   * tenant defines it itself. Nothing is thrown for a template that does not
   * exist: `found` and `versionExists` say so. Because it is not known whether
   * a record made from a template of the tenant keeps the name with the suffix
   * `-override` that the Admin UI shows, both forms are matched. A template that
   * cannot be read at all (the catalog is unreachable or not a catalog) throws,
   * with the source named in the message.
   * @param {ApplicationTemplateReference} application the application record, or its `templateName` and `templateVersion`
   * @param {ApplicationTemplateReadOptions} options which catalog to read, and whether to merge the templates of the tenant
   * @returns {Promise<ApplicationTemplateResolution>} a promise that resolves to the resolution
   */
  readTemplate(
    application: ApplicationTemplateReference,
    options?: ApplicationTemplateReadOptions
  ): Promise<ApplicationTemplateResolution>;
};

export default (state: State): ApplicationTemplate => {
  return {
    async readCatalog(
      options?: ApplicationTemplateCatalogOptions
    ): Promise<ApplicationTemplateCatalogResult> {
      return readCatalog({ options, state });
    },
    async readOverrides(): Promise<ApplicationTemplateOverrideSkeleton[]> {
      return readOverrides({ state });
    },
    async listTemplates(
      options?: ApplicationTemplateListOptions
    ): Promise<ApplicationTemplateListItem[]> {
      return listTemplates({ options, state });
    },
    async readTemplate(
      application: ApplicationTemplateReference,
      options?: ApplicationTemplateReadOptions
    ): Promise<ApplicationTemplateResolution> {
      return readTemplate({ application, options, state });
    },
  };
};

/**
 * Get the unique id of a template version from the name and version an
 * application record keeps: the version with the dots replaced by underscores,
 * a hyphen, then the name with the dots replaced by hyphens (`azure.ad` 3.3 is
 * `3_3-azure-ad`, `saml` 1.2 is `1_2-saml`). It is the key under which the
 * catalog keeps the template, and the `templateId` that
 * {@link ApplicationTemplate.readTemplate} returns. It reads nothing, and it is
 * not a method of the facade.
 * @param {ApplicationTemplateReference} reference the `templateName` and `templateVersion` of an application record
 * @returns {string} the template id, for example `3_3-azure-ad`
 */
export function getTemplateId({
  templateName,
  templateVersion,
}: ApplicationTemplateReference): string {
  return `${String(templateVersion).replace(/\./g, '_')}-${String(
    templateName
  ).replace(/\./g, '-')}`;
}

// the catalogs that were downloaded, for each state, by URL, with the time
// (ms since the epoch) at which the source last confirmed the copy or, after a
// failed attempt, was last asked. With the cache in files on, the copy in memory
// is only used while it is younger than maxAgeMs; without it, for the life of
// the state.
const downloaded = new WeakMap<
  State,
  Map<string, { result: ApplicationTemplateCatalogResult; checkedAt: number }>
>();

function isGzip(bytes: Buffer): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function catalogTooLarge(location: string, what: string): FrodoError {
  return new FrodoError(
    `The application template catalog from ${location} is larger than ${megabytes(MAX_CATALOG_BYTES)}${what}`
  );
}

/**
 * Turn the bytes of a catalog file into text. The file is stored compressed on
 * the CDN, and the transport compresses it again, so the body can be gzip
 * twice; a body that is already plain is taken as it is. The size of the text
 * and the number of layers are limited, so that a small file cannot expand
 * into memory without bound.
 */
function decodeBytes(bytes: Uint8Array, location: string): string {
  if (bytes.length > MAX_CATALOG_BYTES) {
    throw catalogTooLarge(location, '');
  }
  let buffer = Buffer.from(bytes);
  let layers = 0;
  while (isGzip(buffer)) {
    if (layers === MAX_GZIP_LAYERS) {
      throw new FrodoError(
        `The application template catalog from ${location} is compressed more than ${MAX_GZIP_LAYERS} times`
      );
    }
    try {
      buffer = gunzipSync(buffer, { maxOutputLength: MAX_CATALOG_BYTES });
    } catch (error) {
      if ((error as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') {
        throw catalogTooLarge(location, ' when decompressed');
      }
      throw new FrodoError(
        `The application template catalog from ${location} could not be decompressed`,
        error as Error
      );
    }
    layers++;
  }
  return buffer.toString('utf8');
}

/**
 * True if a value has more than MAX_NESTING_LEVELS levels of objects and lists.
 * It walks the value with a list of its own instead of calling itself, so the
 * check cannot overflow the stack on the value it is meant to refuse.
 */
function isNestedTooDeep(value: unknown): boolean {
  const pending: [unknown, number][] = [[value, 1]];
  while (pending.length > 0) {
    const [current, level] = pending.pop();
    if (current === null || typeof current !== 'object') continue;
    if (level > MAX_NESTING_LEVELS) return true;
    for (const child of Object.values(current)) {
      pending.push([child, level + 1]);
    }
  }
  return false;
}

/** A cosmetic field of a template that is not text and is dropped. */
type DroppedField = {
  tier: string;
  group: string;
  key: string;
  field: string;
};

function validateGroups(
  tier: string,
  groups: unknown,
  location: string,
  dropped: DroppedField[]
): ApplicationTemplateGroups {
  const notExpected = (reason: string): FrodoError =>
    new FrodoError(
      `The application template catalog from ${location} is not in the expected format: ${reason}`
    );
  if (!isObject(groups)) {
    throw notExpected(`AppTemplates.${tier} is missing`);
  }
  for (const [group, templates] of Object.entries(groups)) {
    if (!isObject(templates)) {
      throw notExpected(
        `AppTemplates.${tier}.${group} is not a list of templates`
      );
    }
    for (const [key, template] of Object.entries(templates)) {
      const at = `AppTemplates.${tier}.${group}.${key}`;
      if (!isObject(template)) {
        throw notExpected(`${at} is not a template`);
      }
      if (typeof template.id !== 'string' || template.id === '') {
        throw notExpected(`${at} has no id`);
      }
      if (
        (typeof template.templateVersion !== 'string' &&
          typeof template.templateVersion !== 'number') ||
        String(template.templateVersion) === ''
      ) {
        throw notExpected(`${at} has no templateVersion`);
      }
      // the fields a list item copies from the template are text, so an item
      // never shares an object with the catalog that the state keeps. They are
      // for display only, so a value that is not text is dropped, not a reason
      // to refuse the whole catalog (see validateCatalog)
      for (const field of ['displayName', 'templateType', 'dateUpdated']) {
        if (
          template[field] !== undefined &&
          typeof template[field] !== 'string'
        ) {
          dropped.push({ tier, group, key, field });
        }
      }
    }
  }
  return groups as ApplicationTemplateGroups;
}

/**
 * Check that a value is a catalog and say which source it came from if it is
 * not. The value is not changed: if a display field has to be dropped, the
 * result is a copy.
 */
function validateCatalog(
  value: unknown,
  location: string,
  state?: State
): ApplicationTemplateCatalog {
  if (isNestedTooDeep(value)) {
    throw new FrodoError(
      `The application template catalog from ${location} is nested deeper than ${MAX_NESTING_LEVELS} levels`
    );
  }
  if (!isObject(value) || !isObject(value.AppTemplates)) {
    throw new FrodoError(
      `The application template catalog from ${location} is not in the expected format: AppTemplates is missing`
    );
  }
  const dropped: DroppedField[] = [];
  validateGroups('consumer', value.AppTemplates.consumer, location, dropped);
  validateGroups(
    'enterprise',
    value.AppTemplates.enterprise,
    location,
    dropped
  );
  if (dropped.length === 0) {
    return value as ApplicationTemplateCatalog;
  }
  // a value that is not text in a display field is dropped from a copy: the
  // value given by the caller is not changed, and the copy is safe (the depth
  // was checked above)
  const copy = structuredClone(value) as ApplicationTemplateCatalog;
  for (const { tier, group, key, field } of dropped) {
    delete copy.AppTemplates[tier as 'consumer' | 'enterprise'][group][key][
      field
    ];
  }
  if (state) {
    debugMessage({
      message: `ApplicationTemplateOps.validateCatalog: dropped ${dropped.length} display field(s) that are not text from the catalog from ${location}`,
      state,
    });
  }
  return copy;
}

/**
 * Parse and validate a catalog. When the input is text or bytes, the decoded
 * JSON text is returned as well, so that it can be kept as it was delivered.
 */
function parseCatalogWithText(
  input: ApplicationTemplateCatalog | string | Uint8Array,
  location: string,
  state?: State
): { catalog: ApplicationTemplateCatalog; text?: string } {
  if (typeof input === 'string' || input instanceof Uint8Array) {
    if (typeof input === 'string' && input.length > MAX_CATALOG_BYTES) {
      throw catalogTooLarge(location, '');
    }
    const text =
      typeof input === 'string' ? input : decodeBytes(input, location);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new FrodoError(
        `The application template catalog from ${location} could not be read as JSON`,
        error
      );
    }
    return { catalog: validateCatalog(parsed, location, state), text };
  }
  return { catalog: validateCatalog(input, location, state) };
}

function parseCatalog(
  input: ApplicationTemplateCatalog | string | Uint8Array,
  location: string,
  state?: State
): ApplicationTemplateCatalog {
  return parseCatalogWithText(input, location, state).catalog;
}

/**
 * Read the application template catalog
 * @param {ApplicationTemplateCatalogOptions} options which catalog to read
 * @returns {Promise<ApplicationTemplateCatalogResult>} a promise that resolves to the catalog and its metadata
 */
export async function readCatalog({
  options = {},
  state,
}: {
  options?: ApplicationTemplateCatalogOptions;
  state: State;
}): Promise<ApplicationTemplateCatalogResult> {
  const { result, shared } = await loadCatalog({ options, state });
  // a catalog the state keeps is never handed out: the caller may change what
  // it gets, and the next read must not see that
  return shared ? structuredClone(result) : result;
}

/**
 * Load the catalog. `shared` is true when the result is the object the state
 * keeps, which the caller must not change or hand out.
 */
async function loadCatalog({
  options = {},
  state,
}: {
  options?: ApplicationTemplateCatalogOptions;
  state: State;
}): Promise<{ result: ApplicationTemplateCatalogResult; shared: boolean }> {
  const {
    catalog,
    url,
    channel = 'production',
    refresh = false,
    ignoreCache = false,
    maxAgeMs = DEFAULT_CACHE_MAX_AGE_MS,
  } = options;
  if (catalog !== undefined && catalog !== null) {
    return {
      result: {
        catalog: parseCatalog(catalog, EXPLICIT_LOCATION, state),
        metadata: {
          source: { kind: 'explicit', location: EXPLICIT_LOCATION },
          cached: false,
          cache: 'disabled',
        },
      },
      shared: false,
    };
  }
  if (typeof maxAgeMs !== 'number' || !(maxAgeMs >= 0)) {
    throw new FrodoError(
      'maxAgeMs must be a number of milliseconds, zero or more'
    );
  }
  let source: ApplicationTemplateCatalogSource;
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (error) {
      throw new FrodoError(
        `The application template catalog cannot be read from ${url}: not a valid URL`,
        error
      );
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new FrodoError(
        `The application template catalog cannot be read from ${url}: only http and https URLs are supported`
      );
    }
    source = { kind: 'url', location: url };
  } else {
    if (!Object.hasOwn(APP_TEMPLATE_CATALOG_URLS, channel)) {
      throw new FrodoError(
        `Unknown application template catalog channel ${JSON.stringify(String(channel))}: expected ${Object.keys(APP_TEMPLATE_CATALOG_URLS).join(' or ')}`
      );
    }
    source = {
      kind: 'cdn',
      location: APP_TEMPLATE_CATALOG_URLS[channel],
      channel,
    };
  }

  // only the public source is cached in files: a URL the caller names is not
  const files =
    source.kind === 'cdn' && state.getUseTemplateCatalogCache()
      ? getCatalogCacheFiles(getCatalogCacheDirectory({ state }), channel)
      : undefined;

  if (source.kind === 'cdn' && state.getAirGapped()) {
    // no request: the kept copy is used, whatever its age, if there is one
    const entry = files
      ? readCachedCatalog({ files, source, state })
      : undefined;
    if (entry) {
      return {
        result: cachedResult({
          entry,
          source,
          files,
          outcome: 'offline',
          fetchedAt: entry.meta?.fetchedAt ?? entry.modified,
        }),
        shared: true,
      };
    }
    throw new FrodoError(
      `Air-gapped mode is on: the application template catalog is not downloaded from ${source.location}. Give the catalog explicitly`,
      null,
      'AIR_GAPPED'
    );
  }

  let kept = downloaded.get(state);
  if (!kept) {
    kept = new Map();
    downloaded.set(state, kept);
  }
  const earlier = kept.get(source.location);
  if (
    earlier &&
    !refresh &&
    !ignoreCache &&
    // a state that lives long (a server) asks the source again once the copy is
    // older than maxAgeMs, like a read that finds the copy in the files
    (!files ||
      (Date.now() - earlier.checkedAt >= 0 &&
        Date.now() - earlier.checkedAt < maxAgeMs))
  ) {
    return {
      result: {
        catalog: earlier.result.catalog,
        metadata: { ...earlier.result.metadata, cached: true },
      },
      shared: true,
    };
  }

  const entry = files ? readCachedCatalog({ files, source, state }) : undefined;
  if (entry?.meta && files && !refresh && !ignoreCache) {
    const age = Date.now() - Date.parse(entry.meta.fetchedAt);
    if (age >= 0 && age < maxAgeMs) {
      const result = cachedResult({
        entry,
        source,
        files,
        outcome: 'fresh',
        fetchedAt: entry.meta.fetchedAt,
      });
      kept.set(source.location, {
        result,
        checkedAt: Date.parse(entry.meta.fetchedAt),
      });
      return { result, shared: true };
    }
  }

  // ask the source, with the validators of the kept copy when there are any
  const validators =
    entry?.meta && !ignoreCache
      ? {
          ifNoneMatch: entry.meta.etag,
          ifModifiedSince: entry.meta.lastModified,
        }
      : {};
  let file: Awaited<ReturnType<typeof getApplicationTemplateCatalogFile>>;
  try {
    file = await getApplicationTemplateCatalogFile({
      url: source.location,
      ...validators,
      state,
    });
  } catch (error) {
    if (entry && files && !ignoreCache && isTransientFailure(error)) {
      const reason = (error as Error)?.message ?? String(error);
      debugMessage({
        message: `ApplicationTemplateOps.readCatalog: ${source.location} did not answer (${reason}), using the copy in ${files.catalog}`,
        state,
      });
      const result = cachedResult({
        entry,
        source,
        files,
        outcome: 'stale-after-error',
        fetchedAt: entry.meta?.fetchedAt ?? entry.modified,
        cacheError: reason,
      });
      kept.set(source.location, { result, checkedAt: Date.now() });
      return { result, shared: true };
    }
    // axios names the option that it enforced
    if (
      /maxContentLength|maxBodyLength/.test((error as Error)?.message ?? '')
    ) {
      throw new FrodoError(
        `The application template catalog from ${source.location} is larger than ${megabytes(APP_TEMPLATE_CATALOG_MAX_DOWNLOAD_BYTES)}`,
        error as Error
      );
    }
    throw new FrodoError(
      `Error reading the application template catalog from ${source.location}`,
      error
    );
  }

  const fetchedAt = new Date(Date.now()).toISOString();
  if (file.notModified) {
    if (!entry || !files) {
      throw new FrodoError(
        `The application template catalog from ${source.location} was not modified, but there is no copy to use`
      );
    }
    // the copy is current: only the time of the confirmation changes
    writeCacheMeta({
      files,
      meta: {
        etag: file.etag ?? entry.meta?.etag,
        lastModified: file.lastModified ?? entry.meta?.lastModified,
        fetchedAt,
        url: source.location,
      },
      state,
    });
    const result = cachedResult({
      entry,
      source,
      files,
      outcome: 'revalidated',
      fetchedAt,
      etag: file.etag,
      lastModified: file.lastModified,
    });
    kept.set(source.location, { result, checkedAt: Date.now() });
    return { result, shared: true };
  }

  const parsed = parseCatalogWithText(file.data, source.location, state);
  const result: ApplicationTemplateCatalogResult = {
    catalog: parsed.catalog,
    metadata: {
      source,
      etag: file.etag,
      lastModified: file.lastModified,
      fetchedAt,
      cached: false,
      cache: files ? (entry ? 'refreshed' : 'miss') : 'disabled',
      ...(files && { cachePath: files.catalog }),
    },
  };
  if (files) {
    // The old validators go first, then the copy, then the new validators. A
    // meta file beside a catalog it does not describe could make a later 304
    // confirm the wrong catalog (the source returns to the version the old
    // validators belong to); a catalog without validators is only asked about
    // again. If the old validators cannot be removed, the old pair stays as it is.
    if (
      tryRemoveCacheFile({ file: files.meta, state }) &&
      tryWriteCacheFile({ file: files.catalog, data: parsed.text, state })
    ) {
      writeCacheMeta({
        files,
        meta: {
          etag: file.etag,
          lastModified: file.lastModified,
          fetchedAt,
          url: source.location,
        },
        state,
      });
    }
  }
  kept.set(source.location, { result, checkedAt: Date.now() });
  return { result, shared: true };
}

/** A copy of the catalog that the cache holds. */
type CachedCatalog = {
  catalog: ApplicationTemplateCatalog;
  meta?: CatalogCacheMeta;
  /** When the file was last changed (ISO 8601), for a copy without meta data. */
  modified: string;
};

/**
 * Read the copy in the cache. The files are not trusted: the catalog goes
 * through the same limits, depth check and shape validation as a download, and
 * anything wrong with it is a miss.
 */
function readCachedCatalog({
  files,
  source,
  state,
}: {
  files: { catalog: string; meta: string };
  source: ApplicationTemplateCatalogSource;
  state: State;
}): CachedCatalog | undefined {
  const bytes = readLimitedFile({
    file: files.catalog,
    maxBytes: MAX_CATALOG_BYTES,
    state,
  });
  if (!bytes) return undefined;
  let catalog: ApplicationTemplateCatalog;
  try {
    catalog = parseCatalog(bytes, files.catalog, state);
  } catch (error) {
    debugMessage({
      message: `ApplicationTemplateOps.readCatalog: the copy in ${files.catalog} is not usable and will be replaced: ${(error as Error).message}`,
      state,
    });
    return undefined;
  }
  let modified: string;
  try {
    modified = fs.statSync(files.catalog).mtime.toISOString();
  } catch {
    modified = new Date(0).toISOString();
  }
  return {
    catalog,
    meta: readCatalogCacheMeta({
      file: files.meta,
      url: source.location,
      state,
    }),
    modified,
  };
}

function cachedResult({
  entry,
  source,
  files,
  outcome,
  fetchedAt,
  etag,
  lastModified,
  cacheError,
}: {
  entry: CachedCatalog;
  source: ApplicationTemplateCatalogSource;
  files: { catalog: string; meta: string };
  outcome: ApplicationTemplateCacheOutcome;
  fetchedAt: string;
  etag?: string;
  lastModified?: string;
  cacheError?: string;
}): ApplicationTemplateCatalogResult {
  return {
    catalog: entry.catalog,
    metadata: {
      source,
      etag: etag ?? entry.meta?.etag,
      lastModified: lastModified ?? entry.meta?.lastModified,
      fetchedAt,
      cached: false,
      cache: outcome,
      cachePath: files.catalog,
      ...(cacheError !== undefined && { cacheError }),
    },
  };
}

function writeCacheMeta({
  files,
  meta,
  state,
}: {
  files: { catalog: string; meta: string };
  meta: CatalogCacheMeta;
  state: State;
}): void {
  tryWriteCacheFile({
    file: files.meta,
    data: JSON.stringify(meta, null, 2),
    state,
  });
}

/**
 * Whether a failed request says nothing about the copy in the cache: the
 * source could not be reached, or it failed on its side (5xx). A 4xx answer, a
 * body over the limit and anything that is not a request error are not.
 */
function isTransientFailure(error: unknown): boolean {
  const e = error as {
    name?: string;
    isAxiosError?: boolean;
    message?: string;
    response?: { status?: number };
  };
  if (!e || (e.name !== 'AxiosError' && !e.isAxiosError)) return false;
  if (/maxContentLength|maxBodyLength/.test(e.message ?? '')) return false;
  return !e.response || (e.response.status ?? 0) >= 500;
}

/**
 * Read the application templates that the tenant defines itself
 * @returns {Promise<ApplicationTemplateOverrideSkeleton[]>} a promise that resolves to the templates of the tenant
 */
export async function readOverrides({
  state,
}: {
  state: State;
}): Promise<ApplicationTemplateOverrideSkeleton[]> {
  try {
    const entities = await getApplicationTemplateOverrides({ state });
    return entities.map((entity) => {
      const configId = entity._id as string;
      if (isNestedTooDeep(entity)) {
        throw new FrodoError(
          `The application template ${configId} of the tenant is nested deeper than ${MAX_NESTING_LEVELS} levels`
        );
      }
      return {
        ...entity,
        // the name of a template of the tenant is the id of its entity when the entity says nothing else
        id:
          typeof entity.id === 'string' && entity.id
            ? entity.id
            : configId.substring(configId.indexOf('/') + 1),
        templateVersion:
          entity.templateVersion === undefined ||
          entity.templateVersion === null
            ? ''
            : String(entity.templateVersion),
      } as ApplicationTemplateOverrideSkeleton;
    });
  } catch (error) {
    throw new FrodoError(
      'Error reading the application templates of the tenant',
      error
    );
  }
}

/**
 * Compare two template versions (`3.3`, `2.10`) number by number, so that
 * `2.10` is newer than `2.9`.
 */
function compareVersions(a: string, b: string): number {
  const left = String(a).split('.');
  const right = String(b).split('.');
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const l = left[i] ?? '0';
    const r = right[i] ?? '0';
    const ln = Number(l);
    const rn = Number(r);
    if (Number.isFinite(ln) && Number.isFinite(rn)) {
      if (ln !== rn) return ln < rn ? -1 : 1;
    } else if (l !== r) {
      return l < r ? -1 : 1;
    }
  }
  return 0;
}

/** The name of a template in the form that the template id uses, so `azure.ad` and `azure-ad` are one name. */
function nameKey(name: string): string {
  return String(name).replace(/\./g, '-');
}

/** The value if it is text. The fields of a template of the tenant are not checked, so a list item only takes them when they are text. */
function textOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

type MergedTemplate = ApplicationTemplateListItem & {
  template: ApplicationTemplateSkeleton;
};

function mergeTemplates(
  catalog: ApplicationTemplateCatalog,
  overrides: ApplicationTemplateOverrideSkeleton[]
): MergedTemplate[] {
  const byId = new Map<string, MergedTemplate>();
  for (const tier of ['consumer', 'enterprise'] as const) {
    for (const [group, templates] of Object.entries(
      catalog.AppTemplates[tier]
    )) {
      for (const [templateId, template] of Object.entries(templates)) {
        byId.set(templateId, {
          templateId,
          name: template.id,
          group,
          tier,
          templateVersion: String(template.templateVersion),
          displayName: template.displayName,
          templateType: template.templateType,
          dateUpdated: template.dateUpdated,
          isOverride: false,
          newestInGroup: false,
          template,
        });
      }
    }
  }
  for (const override of overrides) {
    const templateId = getTemplateId({
      templateName: override.id,
      templateVersion: override.templateVersion,
    });
    const sameName = [...byId.values()].find(
      (item) => nameKey(item.name) === nameKey(override.id)
    );
    byId.set(templateId, {
      templateId,
      name: override.id,
      group: sameName?.group,
      tier: override.templateType === 'Enterprise' ? 'enterprise' : 'consumer',
      templateVersion: override.templateVersion,
      displayName: textOrUndefined(override.displayName),
      templateType: textOrUndefined(override.templateType),
      dateUpdated: textOrUndefined(override.dateUpdated),
      isOverride: true,
      newestInGroup: false,
      template: override,
    });
  }
  const items = [...byId.values()];
  const newest = new Map<string, string>();
  for (const item of items) {
    const key = nameKey(item.name);
    const current = newest.get(key);
    if (
      current === undefined ||
      compareVersions(item.templateVersion, current) > 0
    ) {
      newest.set(key, item.templateVersion);
    }
  }
  for (const item of items) {
    item.newestInGroup =
      compareVersions(item.templateVersion, newest.get(nameKey(item.name))) ===
      0;
  }
  return items.sort(
    (a, b) =>
      nameKey(a.name).localeCompare(nameKey(b.name)) ||
      compareVersions(a.templateVersion, b.templateVersion)
  );
}

async function readMerged({
  options = {},
  state,
}: {
  options?: ApplicationTemplateListOptions;
  state: State;
}): Promise<{
  items: MergedTemplate[];
  metadata: ApplicationTemplateCatalogMetadata;
}> {
  const { includeOverrides = true } = options;
  const {
    result: { catalog, metadata },
  } = await loadCatalog({ options, state });
  const overrides = includeOverrides ? await readOverrides({ state }) : [];
  return { items: mergeTemplates(catalog, overrides), metadata };
}

/**
 * List the template versions of the catalog with the templates of the tenant merged over them
 * @param {ApplicationTemplateListOptions} options which catalog to read, and whether to merge the templates of the tenant
 * @returns {Promise<ApplicationTemplateListItem[]>} a promise that resolves to the template versions
 */
export async function listTemplates({
  options,
  state,
}: {
  options?: ApplicationTemplateListOptions;
  state: State;
}): Promise<ApplicationTemplateListItem[]> {
  const { items } = await readMerged({ options, state });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return items.map(({ template, ...item }) => item);
}

/**
 * Read the template that an application record was made from
 * @param {ApplicationTemplateReference} application the application record, or its `templateName` and `templateVersion`
 * @param {ApplicationTemplateReadOptions} options which catalog to read, and whether to merge the templates of the tenant
 * @returns {Promise<ApplicationTemplateResolution>} a promise that resolves to the resolution
 */
export async function readTemplate({
  application,
  options,
  state,
}: {
  application: ApplicationTemplateReference;
  options?: ApplicationTemplateReadOptions;
  state: State;
}): Promise<ApplicationTemplateResolution> {
  const { items, metadata } = await readMerged({ options, state });
  const templateVersion = String(application.templateVersion);
  let templateName = String(application.templateName);
  let sameName = items.filter(
    (item) => nameKey(item.name) === nameKey(templateName)
  );
  if (sameName.length === 0 && templateName.endsWith(OVERRIDE_SUFFIX)) {
    templateName = templateName.substring(
      0,
      templateName.length - OVERRIDE_SUFFIX.length
    );
    sameName = items.filter(
      (item) => nameKey(item.name) === nameKey(templateName)
    );
  }
  const templateId = getTemplateId({ templateName, templateVersion });
  const exact = sameName.find(
    (item) =>
      item.templateId === templateId ||
      compareVersions(item.templateVersion, templateVersion) === 0
  );
  const newest = sameName.reduce<string | undefined>(
    (best, item) =>
      best === undefined || compareVersions(item.templateVersion, best) > 0
        ? item.templateVersion
        : best,
    undefined
  );
  return {
    templateId,
    found: sameName.length > 0,
    versionExists: !!exact,
    newestInGroup: !!exact && exact.newestInGroup,
    newestVersion: newest,
    isOverride: !!exact && exact.isOverride,
    source: exact ? (exact.isOverride ? 'override' : 'catalog') : undefined,
    // copies: the template belongs to the catalog that the state keeps
    template: exact ? structuredClone(exact.template) : undefined,
    catalog: structuredClone(metadata),
  };
}
