import { State } from '../shared/State';
import { type NoIdObjectSkeletonInterface } from './ApiTypes';
import { generateReleaseApi } from './BaseApi';
import { getConfigEntitiesByType } from './IdmConfigApi';

/**
 * The out-of-the-box application templates are a public catalog on Ping's CDN,
 * the one the Admin UI loads in the app catalog. It needs no credentials. This
 * is not a documented interface of the platform: the paths are what the Admin
 * UI happens to use, so they are kept here, in one place, and a caller can name
 * another location (a mirror, a file) instead.
 */
export const APP_TEMPLATE_CATALOG_URLS = {
  /** The catalog of released templates. */
  production:
    'https://cdn.forgerock.com/platform/app-templates/appTemplates.json.gz',
  /** The catalog the Admin UI uses when a development build flag is on: a few more template versions. */
  development:
    'https://cdn.forgerock.com/platform/app-templates-development/appTemplates.json.gz',
} as const;

/** The two catalogs of the CDN. */
export type ApplicationTemplateCatalogChannel =
  keyof typeof APP_TEMPLATE_CATALOG_URLS;

/** The IDM configuration entity type of the templates a tenant defines itself. */
export const APP_TEMPLATE_OVERRIDE_TYPE = 'appTemplate';

/**
 * The answer to a request for the catalog file: the bytes as the server sent
 * them after the transport decoding (the file itself is stored compressed, so
 * these are normally still gzip), and the headers that identify the version.
 */
export interface ApplicationTemplateCatalogFile {
  /** The body. */
  data: Buffer;
  /** The `ETag` header, if there was one. */
  etag?: string;
  /** The `Last-Modified` header, if there was one. */
  lastModified?: string;
}

/**
 * Get the application template catalog file from a URL. The request carries no
 * credential of the tenant: it is made with the same proxy and agent settings
 * as every request of the library, but without a bearer token, a cookie or any
 * header override of the connection, because the host is not the tenant.
 * @param {string} url absolute http(s) URL of the catalog file
 * @returns {Promise<ApplicationTemplateCatalogFile>} a promise that resolves to the body and the version headers
 */
export async function getApplicationTemplateCatalogFile({
  url,
  state,
}: {
  url: string;
  state: State;
}): Promise<ApplicationTemplateCatalogFile> {
  const parsed = new URL(url);
  const response = await generateReleaseApi({
    baseUrl: parsed.origin,
    requestOverride: { responseType: 'arraybuffer' },
    state,
  }).get(`${parsed.pathname}${parsed.search}`, {
    // the file is not JSON from the transport's point of view: it is a gzip
    // stream (stored compressed), so no parsing must happen here
    transformResponse: [(data) => data],
    headers: { Accept: '*/*' },
  });
  const header = (name: string): string | undefined => {
    const value = response.headers?.[name];
    return typeof value === 'string' && value ? value : undefined;
  };
  return {
    data: Buffer.from(response.data),
    etag: header('etag'),
    lastModified: header('last-modified'),
  };
}

/**
 * Get the application templates a tenant defines itself (the IDM configuration
 * entities `appTemplate/<id>`). The Admin UI shows them merged over the
 * catalog.
 * @returns {Promise<NoIdObjectSkeletonInterface[]>} a promise that resolves to the entities, each with its `_id`
 */
export async function getApplicationTemplateOverrides({
  state,
}: {
  state: State;
}): Promise<NoIdObjectSkeletonInterface[]> {
  const { result } = await getConfigEntitiesByType({
    type: APP_TEMPLATE_OVERRIDE_TYPE,
    state,
  });
  return result.filter(
    (entity) =>
      typeof entity._id === 'string' &&
      (entity._id as string).startsWith(`${APP_TEMPLATE_OVERRIDE_TYPE}/`)
  );
}
