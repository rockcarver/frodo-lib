import { gzipSync } from 'zlib';
import { jest } from '@jest/globals';
import StateImpl from '../shared/State';

const CDN = {
  production:
    'https://cdn.forgerock.com/platform/app-templates/appTemplates.json.gz',
  development:
    'https://cdn.forgerock.com/platform/app-templates-development/appTemplates.json.gz',
};

const getCatalogFile = jest.fn(async (_args?: any): Promise<any> => ({}));
const getOverrides = jest.fn(async (_args?: any): Promise<any> => []);

jest.unstable_mockModule('../api/ApplicationTemplateApi', () => ({
  APP_TEMPLATE_CATALOG_URLS: CDN,
  APP_TEMPLATE_OVERRIDE_TYPE: 'appTemplate',
  getApplicationTemplateCatalogFile: getCatalogFile,
  getApplicationTemplateOverrides: getOverrides,
}));

const {
  default: ApplicationTemplateOps,
  getTemplateId,
  readCatalog,
  readOverrides,
  listTemplates,
  readTemplate,
} = await import('./ApplicationTemplateOps');
const { FrodoError } = await import('./FrodoError');

/** A small synthetic catalog; the real one is not committed. */
function syntheticCatalog() {
  return {
    AppTemplates: {
      consumer: {
        Saml: {
          '1_2-saml': {
            id: 'saml',
            templateVersion: '1.2',
            displayName: 'Sample SAML',
            templateType: 'SAML',
            dateUpdated: '1-1-2025',
            schema: { big: 'form definition' },
          },
          '1_3-saml': {
            id: 'saml',
            templateVersion: '1.3',
            displayName: 'Sample SAML',
            templateType: 'SAML',
            dateUpdated: '2-2-2025',
            schema: { big: 'form definition' },
          },
        },
        Web: {
          '1_0-web': {
            id: 'web',
            templateVersion: '1.0',
            displayName: 'Sample Web',
            templateType: 'Consumer',
          },
        },
      },
      enterprise: {
        SampleDirectory: {
          '2_9-sample-directory': {
            id: 'sample.directory',
            templateVersion: '2.9',
            displayName: 'Sample Directory',
            templateType: 'Enterprise',
          },
          '2_10-sample-directory': {
            id: 'sample.directory',
            templateVersion: '2.10',
            displayName: 'Sample Directory',
            templateType: 'Enterprise',
          },
        },
      },
    },
    SamlTemplates: { default_sp_xml: '<xml/>' },
  };
}

const overrideEntities = () => [
  {
    _id: 'appTemplate/myTemplate',
    _rev: '1',
    id: 'myTemplate',
    templateVersion: '1.0',
    displayName: 'My Template',
    templateType: 'Enterprise',
  },
  {
    _id: 'appTemplate/sample-directory-2-10',
    id: 'sample.directory',
    templateVersion: '2.10',
    displayName: 'Sample Directory (tenant)',
    templateType: 'Enterprise',
  },
];

const fileOf = (catalog: unknown, extra: object = {}) => ({
  data: gzipSync(Buffer.from(JSON.stringify(catalog))),
  etag: '"etag-1"',
  lastModified: 'Thu, 12 Nov 2026 23:34:04 GMT',
  ...extra,
});

const newState = () => StateImpl({});

beforeEach(() => {
  getCatalogFile.mockReset();
  getOverrides.mockReset();
  getCatalogFile.mockImplementation(async () => fileOf(syntheticCatalog()));
  getOverrides.mockImplementation(async () => []);
});

describe('getTemplateId', () => {
  test.each([
    ['azure.ad', '3.3', '3_3-azure-ad'],
    ['csv.multifile', '1.0', '1_0-csv-multifile'],
    ['saml', '1.2', '1_2-saml'],
    ['web', '1.0', '1_0-web'],
    ['sample.directory', '2.10', '2_10-sample-directory'],
  ])('1: %s %s is %s', (templateName, templateVersion, expected) => {
    expect(getTemplateId({ templateName, templateVersion })).toBe(expected);
  });

  test('2: reads nothing', () => {
    getTemplateId({ templateName: 'saml', templateVersion: '1.3' });
    expect(getCatalogFile).not.toHaveBeenCalled();
    expect(getOverrides).not.toHaveBeenCalled();
  });
});

describe('readCatalog: what the caller hands over', () => {
  test('1: an object is used as it is and nothing is requested', async () => {
    const catalog = syntheticCatalog();
    const result = await readCatalog({
      options: { catalog },
      state: newState(),
    });
    expect(result.catalog).toBe(catalog);
    expect(result.metadata).toEqual({
      source: { kind: 'explicit', location: 'explicit catalog' },
      cached: false,
    });
    expect(getCatalogFile).not.toHaveBeenCalled();
  });

  test.each([
    ['JSON text', () => JSON.stringify(syntheticCatalog())],
    ['plain bytes', () => Buffer.from(JSON.stringify(syntheticCatalog()))],
    [
      'gzip bytes',
      () => gzipSync(Buffer.from(JSON.stringify(syntheticCatalog()))),
    ],
    [
      'gzip bytes that are gzip again',
      () => gzipSync(gzipSync(Buffer.from(JSON.stringify(syntheticCatalog())))),
    ],
    [
      'a Uint8Array',
      () => new Uint8Array(Buffer.from(JSON.stringify(syntheticCatalog()))),
    ],
  ])('2: %s is parsed', async (_name, make) => {
    const result = await readCatalog({
      options: { catalog: make() as any },
      state: newState(),
    });
    expect(Object.keys(result.catalog.AppTemplates.consumer)).toEqual([
      'Saml',
      'Web',
    ]);
    expect(result.metadata.source.kind).toBe('explicit');
    expect(getCatalogFile).not.toHaveBeenCalled();
  });

  test('3: text that is not JSON throws and names the explicit catalog', async () => {
    const error = await readCatalog({
      options: { catalog: 'not json' },
      state: newState(),
    }).catch((e) => e);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(
      'The application template catalog from explicit catalog could not be read as JSON'
    );
    expect(error.originalErrors).toHaveLength(1);
  });

  test.each([
    ['no AppTemplates', {}, 'AppTemplates is missing'],
    [
      'no enterprise tier',
      { AppTemplates: { consumer: {} } },
      'AppTemplates.enterprise is missing',
    ],
    [
      'no consumer tier',
      { AppTemplates: { enterprise: {} } },
      'AppTemplates.consumer is missing',
    ],
    [
      'a group that is not a list of templates',
      { AppTemplates: { consumer: { Web: 'x' }, enterprise: {} } },
      'AppTemplates.consumer.Web is not a list of templates',
    ],
    ['an array', [], 'AppTemplates is missing'],
  ])('4: %s throws and names the source', async (_name, catalog, reason) => {
    const error = await readCatalog({
      options: { catalog: catalog as any },
      state: newState(),
    }).catch((e) => e);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(
      `The application template catalog from explicit catalog is not in the expected format: ${reason}`
    );
  });

  test('5: an explicit catalog wins over a url, and a url wins over the CDN', async () => {
    await readCatalog({
      options: {
        catalog: syntheticCatalog(),
        url: 'https://mirror.example.com/c.gz',
      },
      state: newState(),
    });
    expect(getCatalogFile).not.toHaveBeenCalled();
    const result = await readCatalog({
      options: {
        url: 'https://mirror.example.com/c.gz',
        channel: 'development',
      },
      state: newState(),
    });
    expect(getCatalogFile).toHaveBeenCalledTimes(1);
    expect(getCatalogFile.mock.calls[0][0]).toMatchObject({
      url: 'https://mirror.example.com/c.gz',
    });
    expect(result.metadata.source).toEqual({
      kind: 'url',
      location: 'https://mirror.example.com/c.gz',
    });
  });
});

describe('readCatalog: the default source', () => {
  test('1: is the production catalog of the CDN', async () => {
    const result = await readCatalog({ state: newState() });
    expect(getCatalogFile).toHaveBeenCalledTimes(1);
    expect(getCatalogFile.mock.calls[0][0]).toMatchObject({
      url: CDN.production,
    });
    expect(result.metadata).toMatchObject({
      source: { kind: 'cdn', location: CDN.production, channel: 'production' },
      etag: '"etag-1"',
      lastModified: 'Thu, 12 Nov 2026 23:34:04 GMT',
      cached: false,
    });
    expect(new Date(result.metadata.fetchedAt).toISOString()).toBe(
      result.metadata.fetchedAt
    );
    expect(
      result.catalog.AppTemplates.enterprise.SampleDirectory
    ).toBeDefined();
  });

  test('2: the development channel reads the development catalog', async () => {
    const result = await readCatalog({
      options: { channel: 'development' },
      state: newState(),
    });
    expect(getCatalogFile.mock.calls[0][0]).toMatchObject({
      url: CDN.development,
    });
    expect(result.metadata.source.channel).toBe('development');
  });

  test('3: an unknown channel throws before anything is requested', async () => {
    await expect(
      readCatalog({ options: { channel: 'staging' as any }, state: newState() })
    ).rejects.toThrow('Unknown application template catalog channel staging');
    expect(getCatalogFile).not.toHaveBeenCalled();
  });

  test.each(['file:///etc/passwd', 'ftp://example.com/c.gz'])(
    '4: %s is not a url the library reads',
    async (url) => {
      await expect(
        readCatalog({ options: { url }, state: newState() })
      ).rejects.toThrow('only http and https URLs are supported');
      expect(getCatalogFile).not.toHaveBeenCalled();
    }
  );

  test('5: a text that is no url throws', async () => {
    await expect(
      readCatalog({ options: { url: 'not a url' }, state: newState() })
    ).rejects.toThrow(
      'The application template catalog cannot be read from not a url: not a valid URL'
    );
  });

  test('6: a failed download names the source and keeps the cause', async () => {
    const cause = Object.assign(new Error('getaddrinfo ENOTFOUND'), {
      name: 'AxiosError',
    });
    getCatalogFile.mockRejectedValue(cause);
    const error = await readCatalog({ state: newState() }).catch((e) => e);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(
      `Error reading the application template catalog from ${CDN.production}`
    );
    expect(error.originalErrors[0]).toBe(cause);
  });

  test('7: a download that is not a catalog names the source', async () => {
    getCatalogFile.mockResolvedValue(fileOf({ hello: 'world' }));
    await expect(readCatalog({ state: newState() })).rejects.toThrow(
      `The application template catalog from ${CDN.production} is not in the expected format: AppTemplates is missing`
    );
  });

  test('8: a download that is no JSON names the source', async () => {
    getCatalogFile.mockResolvedValue({ data: Buffer.from('<html>') });
    await expect(
      readCatalog({
        options: { url: 'https://mirror.example.com/c.gz' },
        state: newState(),
      })
    ).rejects.toThrow(
      'The application template catalog from https://mirror.example.com/c.gz could not be read as JSON'
    );
  });
});

describe('readCatalog: the catalog kept for a state', () => {
  test('1: the second read of a state is not requested again and says so', async () => {
    const state = newState();
    const first = await readCatalog({ state });
    const second = await readCatalog({ state });
    expect(getCatalogFile).toHaveBeenCalledTimes(1);
    expect(first.metadata.cached).toBe(false);
    expect(second.metadata.cached).toBe(true);
    expect(second.metadata.fetchedAt).toBe(first.metadata.fetchedAt);
    expect(second.catalog).toBe(first.catalog);
  });

  test('2: refresh reads again and replaces what was kept', async () => {
    const state = newState();
    await readCatalog({ state });
    getCatalogFile.mockResolvedValue(
      fileOf(syntheticCatalog(), { etag: '"etag-2"' })
    );
    const refreshed = await readCatalog({ options: { refresh: true }, state });
    expect(getCatalogFile).toHaveBeenCalledTimes(2);
    expect(refreshed.metadata.etag).toBe('"etag-2"');
    const after = await readCatalog({ state });
    expect(getCatalogFile).toHaveBeenCalledTimes(2);
    expect(after.metadata.etag).toBe('"etag-2"');
  });

  test('3: each source is kept on its own', async () => {
    const state = newState();
    await readCatalog({ state });
    await readCatalog({ options: { channel: 'development' }, state });
    await readCatalog({
      options: { url: 'https://mirror.example.com/c.gz' },
      state,
    });
    expect(getCatalogFile).toHaveBeenCalledTimes(3);
    await readCatalog({ state });
    await readCatalog({ options: { channel: 'development' }, state });
    expect(getCatalogFile).toHaveBeenCalledTimes(3);
  });

  test('4: another state starts without a catalog', async () => {
    await readCatalog({ state: newState() });
    await readCatalog({ state: newState() });
    expect(getCatalogFile).toHaveBeenCalledTimes(2);
  });

  test('5: a failed read is not kept', async () => {
    const state = newState();
    getCatalogFile.mockRejectedValueOnce(new Error('boom'));
    await expect(readCatalog({ state })).rejects.toThrow();
    await readCatalog({ state });
    expect(getCatalogFile).toHaveBeenCalledTimes(2);
  });

  test('6: an explicit catalog is never kept', async () => {
    const state = newState();
    const first = syntheticCatalog();
    const second = syntheticCatalog();
    expect(
      (await readCatalog({ options: { catalog: first }, state })).catalog
    ).toBe(first);
    expect(
      (await readCatalog({ options: { catalog: second }, state })).catalog
    ).toBe(second);
  });
});

describe('readCatalog: air-gapped mode', () => {
  test('1: refuses the default source with a code, a message that names the source, and sends nothing', async () => {
    const state = newState();
    state.setAirGapped(true);
    const error = await readCatalog({ state }).catch((e) => e);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.code).toBe('AIR_GAPPED');
    expect(error.message).toBe(
      `Air-gapped mode is on: the application template catalog is not downloaded from ${CDN.production}. Give the catalog explicitly`
    );
    expect(getCatalogFile).not.toHaveBeenCalled();
  });

  test('2: refuses the development catalog too', async () => {
    const state = newState();
    state.setAirGapped(true);
    const error = await readCatalog({
      options: { channel: 'development' },
      state,
    }).catch((e) => e);
    expect(error.code).toBe('AIR_GAPPED');
    expect(error.message).toContain(CDN.development);
    expect(getCatalogFile).not.toHaveBeenCalled();
  });

  test('3: the message names no option, variable or command of a caller', async () => {
    const state = newState();
    state.setAirGapped(true);
    const error = await readCatalog({ state }).catch((e) => e);
    expect(error.message).not.toMatch(
      /--|FRODO_|frodo |setting|environment variable/i
    );
  });

  test('4: an explicit catalog still works', async () => {
    const state = newState();
    state.setAirGapped(true);
    const result = await readCatalog({
      options: { catalog: syntheticCatalog() },
      state,
    });
    expect(result.metadata.source.kind).toBe('explicit');
  });

  test('5: a url the caller names still works', async () => {
    const state = newState();
    state.setAirGapped(true);
    const result = await readCatalog({
      options: { url: 'https://mirror.example.com/c.gz' },
      state,
    });
    expect(result.metadata.source.kind).toBe('url');
    expect(getCatalogFile).toHaveBeenCalledTimes(1);
  });

  test('6: the mode of one state does not reach another', async () => {
    const airGapped = newState();
    airGapped.setAirGapped(true);
    const open = newState();
    await expect(readCatalog({ state: airGapped })).rejects.toMatchObject({
      code: 'AIR_GAPPED',
    });
    await expect(readCatalog({ state: open })).resolves.toBeDefined();
    expect(getCatalogFile).toHaveBeenCalledTimes(1);
  });

  test('7: the tenant is not affected: its templates are read', async () => {
    const state = newState();
    state.setAirGapped(true);
    getOverrides.mockResolvedValue(overrideEntities());
    const overrides = await readOverrides({ state });
    expect(overrides).toHaveLength(2);
    const items = await listTemplates({
      options: { catalog: syntheticCatalog() },
      state,
    });
    expect(items.some((item) => item.isOverride)).toBe(true);
  });

  test('8: a catalog that was kept does not let the default source through when the mode is turned on', async () => {
    const state = newState();
    await readCatalog({ state });
    state.setAirGapped(true);
    await expect(readCatalog({ state })).rejects.toMatchObject({
      code: 'AIR_GAPPED',
    });
  });
});

describe('readOverrides', () => {
  test('1: returns the entities of the tenant', async () => {
    getOverrides.mockResolvedValue(overrideEntities());
    const overrides = await readOverrides({ state: newState() });
    expect(overrides.map((o) => o._id)).toEqual([
      'appTemplate/myTemplate',
      'appTemplate/sample-directory-2-10',
    ]);
    expect(overrides[0]).toMatchObject({
      id: 'myTemplate',
      templateVersion: '1.0',
    });
  });

  test('2: takes the name from the id of the entity when the entity has none, and an empty version when it has none', async () => {
    getOverrides.mockResolvedValue([
      { _id: 'appTemplate/plain', displayName: 'Plain' },
    ]);
    const [override] = await readOverrides({ state: newState() });
    expect(override.id).toBe('plain');
    expect(override.templateVersion).toBe('');
  });

  test('3: is not kept: every call reads the tenant', async () => {
    const state = newState();
    await readOverrides({ state });
    await readOverrides({ state });
    expect(getOverrides).toHaveBeenCalledTimes(2);
  });

  test('4: wraps a failure and keeps the cause', async () => {
    const cause = new Error('403');
    getOverrides.mockRejectedValue(cause);
    const error = await readOverrides({ state: newState() }).catch((e) => e);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(
      'Error reading the application templates of the tenant'
    );
    expect(error.originalErrors[0]).toBe(cause);
  });
});

describe('listTemplates', () => {
  test('1: lists every version of the catalog, sorted by name and version, without the form definition', async () => {
    const items = await listTemplates({
      options: { includeOverrides: false },
      state: newState(),
    });
    // by name (saml, sample-directory, web), then by version as numbers
    expect(items.map((i) => i.templateId)).toEqual([
      '1_2-saml',
      '1_3-saml',
      '2_9-sample-directory',
      '2_10-sample-directory',
      '1_0-web',
    ]);
    expect(items[0]).toEqual({
      templateId: '1_2-saml',
      name: 'saml',
      group: 'Saml',
      tier: 'consumer',
      templateVersion: '1.2',
      displayName: 'Sample SAML',
      templateType: 'SAML',
      dateUpdated: '1-1-2025',
      isOverride: false,
      newestInGroup: false,
    });
    expect(JSON.stringify(items)).not.toContain('form definition');
  });

  test('2: marks the newest version of each template, comparing numbers and not text', async () => {
    const items = await listTemplates({
      options: { includeOverrides: false },
      state: newState(),
    });
    const newest = Object.fromEntries(
      items.map((i) => [i.templateId, i.newestInGroup])
    );
    expect(newest).toEqual({
      '1_0-web': true,
      '1_2-saml': false,
      '1_3-saml': true,
      '2_9-sample-directory': false,
      // 2.10 is newer than 2.9
      '2_10-sample-directory': true,
    });
  });

  test('3: without the templates of the tenant, the tenant is not read', async () => {
    await listTemplates({
      options: { includeOverrides: false },
      state: newState(),
    });
    expect(getOverrides).not.toHaveBeenCalled();
  });

  test('4: merges the templates of the tenant over the catalog', async () => {
    getOverrides.mockResolvedValue(overrideEntities());
    const items = await listTemplates({ state: newState() });
    expect(getOverrides).toHaveBeenCalledTimes(1);
    const byId = Object.fromEntries(items.map((i) => [i.templateId, i]));
    // a new template of the tenant, with no group of the catalog
    expect(byId['1_0-myTemplate']).toMatchObject({
      name: 'myTemplate',
      tier: 'enterprise',
      isOverride: true,
      newestInGroup: true,
      group: undefined,
      displayName: 'My Template',
    });
    // a template of the tenant with the id of a catalog template replaces it
    expect(byId['2_10-sample-directory']).toMatchObject({
      isOverride: true,
      displayName: 'Sample Directory (tenant)',
      group: 'SampleDirectory',
      newestInGroup: true,
    });
    expect(byId['2_9-sample-directory'].isOverride).toBe(false);
    expect(
      items.filter((i) => i.templateId === '2_10-sample-directory')
    ).toHaveLength(1);
    expect(items).toHaveLength(6);
  });

  test('5: a template of the tenant that is not Enterprise is a consumer template', async () => {
    getOverrides.mockResolvedValue([
      {
        _id: 'appTemplate/mine',
        id: 'mine',
        templateVersion: '1.0',
        templateType: 'Consumer',
      },
    ]);
    const items = await listTemplates({ state: newState() });
    expect(items.find((i) => i.name === 'mine').tier).toBe('consumer');
  });

  test('6: the catalog comes from the explicit option when it is given', async () => {
    const items = await listTemplates({
      options: { catalog: syntheticCatalog(), includeOverrides: false },
      state: newState(),
    });
    expect(items).toHaveLength(5);
    expect(getCatalogFile).not.toHaveBeenCalled();
  });
});

describe('readTemplate', () => {
  const app = (templateName: string, templateVersion: string) => ({
    _id: 'app-1',
    name: 'Sample app',
    templateName,
    templateVersion,
  });

  test('1: finds the exact version in the catalog', async () => {
    const result = await readTemplate({
      application: app('saml', '1.2'),
      options: { includeOverrides: false },
      state: newState(),
    });
    expect(result).toMatchObject({
      templateId: '1_2-saml',
      found: true,
      versionExists: true,
      newestInGroup: false,
      newestVersion: '1.3',
      isOverride: false,
      source: 'catalog',
    });
    expect(result.template).toMatchObject({
      id: 'saml',
      templateVersion: '1.2',
    });
    expect(result.catalog.source.kind).toBe('cdn');
  });

  test('2: the newest version says so', async () => {
    const result = await readTemplate({
      application: app('sample.directory', '2.10'),
      options: { includeOverrides: false },
      state: newState(),
    });
    expect(result).toMatchObject({
      versionExists: true,
      newestInGroup: true,
      newestVersion: '2.10',
    });
  });

  test('3: a version that does not exist is found by name, with the newest version', async () => {
    const result = await readTemplate({
      application: app('sample.directory', '2.8'),
      options: { includeOverrides: false },
      state: newState(),
    });
    expect(result).toMatchObject({
      templateId: '2_8-sample-directory',
      found: true,
      versionExists: false,
      newestInGroup: false,
      newestVersion: '2.10',
      isOverride: false,
      source: undefined,
      template: undefined,
    });
  });

  test('4: a template that does not exist is not an error', async () => {
    const result = await readTemplate({
      application: app('no.such', '1.0'),
      options: { includeOverrides: false },
      state: newState(),
    });
    expect(result).toMatchObject({
      templateId: '1_0-no-such',
      found: false,
      versionExists: false,
      newestInGroup: false,
      newestVersion: undefined,
      isOverride: false,
      source: undefined,
    });
  });

  test('5: finds a template of the tenant by its name', async () => {
    getOverrides.mockResolvedValue(overrideEntities());
    const result = await readTemplate({
      application: app('myTemplate', '1.0'),
      state: newState(),
    });
    expect(result).toMatchObject({
      templateId: '1_0-myTemplate',
      found: true,
      versionExists: true,
      isOverride: true,
      source: 'override',
      newestInGroup: true,
    });
  });

  test('6: finds a template of the tenant by a name with the suffix -override', async () => {
    getOverrides.mockResolvedValue(overrideEntities());
    const result = await readTemplate({
      application: app('myTemplate-override', '1.0'),
      state: newState(),
    });
    expect(result).toMatchObject({
      templateId: '1_0-myTemplate',
      found: true,
      versionExists: true,
      isOverride: true,
      source: 'override',
    });
  });

  test('7: a template of the tenant that replaces a catalog version is the one that is found', async () => {
    getOverrides.mockResolvedValue(overrideEntities());
    const result = await readTemplate({
      application: app('sample.directory', '2.10'),
      state: newState(),
    });
    expect(result).toMatchObject({ isOverride: true, source: 'override' });
    expect(result.template.displayName).toBe('Sample Directory (tenant)');
  });

  test('8: the hyphen form of a name is the same name', async () => {
    const result = await readTemplate({
      application: app('sample-directory', '2.9'),
      options: { includeOverrides: false },
      state: newState(),
    });
    expect(result).toMatchObject({ found: true, versionExists: true });
  });

  test('9: a name that ends in -override but matches nothing is not found', async () => {
    getOverrides.mockResolvedValue(overrideEntities());
    const result = await readTemplate({
      application: app('ghost-override', '1.0'),
      state: newState(),
    });
    expect(result).toMatchObject({ found: false, versionExists: false });
  });

  test('10: a name with the suffix is taken as it is when a template of that name exists', async () => {
    getOverrides.mockResolvedValue([
      {
        _id: 'appTemplate/odd-override',
        id: 'odd-override',
        templateVersion: '1.0',
      },
      { _id: 'appTemplate/odd', id: 'odd', templateVersion: '2.0' },
    ]);
    const result = await readTemplate({
      application: app('odd-override', '1.0'),
      state: newState(),
    });
    expect(result).toMatchObject({
      found: true,
      versionExists: true,
      newestVersion: '1.0',
    });
  });

  test('11: the tenant is not read when the caller leaves its templates out', async () => {
    await readTemplate({
      application: app('web', '1.0'),
      options: { includeOverrides: false },
      state: newState(),
    });
    expect(getOverrides).not.toHaveBeenCalled();
  });

  test('12: an unreachable catalog throws and names the source', async () => {
    getCatalogFile.mockRejectedValue(new Error('timeout'));
    await expect(
      readTemplate({ application: app('web', '1.0'), state: newState() })
    ).rejects.toThrow(
      `Error reading the application template catalog from ${CDN.production}`
    );
  });

  test('13: asks the CDN once for several applications of one state', async () => {
    const state = newState();
    await readTemplate({
      application: app('web', '1.0'),
      options: { includeOverrides: false },
      state,
    });
    await readTemplate({
      application: app('saml', '1.2'),
      options: { includeOverrides: false },
      state,
    });
    expect(getCatalogFile).toHaveBeenCalledTimes(1);
  });
});

describe('the facade', () => {
  test('1: frodo.app.template has the template functions and frodo.app keeps its own', async () => {
    const { frodo } = await import('../index');
    for (const name of [
      'readCatalog',
      'readOverrides',
      'listTemplates',
      'readTemplate',
    ]) {
      expect(typeof (frodo.app.template as any)[name]).toBe('function');
    }
    expect(typeof frodo.app.createApplicationExportTemplate).toBe('function');
    expect(typeof frodo.app.getRealmManagedApplication).toBe('function');
  });

  test('2: the functions use the state of their module', async () => {
    const state = newState();
    state.setAirGapped(true);
    const template = ApplicationTemplateOps(state);
    await expect(template.readCatalog()).rejects.toMatchObject({
      code: 'AIR_GAPPED',
    });
    await expect(
      template.readTemplate({ templateName: 'web', templateVersion: '1.0' })
    ).rejects.toMatchObject({ code: 'AIR_GAPPED' });
    await expect(template.listTemplates()).rejects.toMatchObject({
      code: 'AIR_GAPPED',
    });
  });
});
