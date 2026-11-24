/**
 * Unit tests for the static and dynamic parts of a full configuration export
 * and import.
 *
 * Run with:
 *
 *        npm run test:only ConfigOps.staticDynamic
 *
 * Static configuration is what an environment promotion carries (journeys,
 * scripts, themes, ...); dynamic configuration is what changes at run time
 * (OAuth2 clients, agents, policies, SAML providers, ...). `includeStatic` and
 * `includeDynamic` choose which of the two a full export or import handles,
 * and both default to true, so an options object written before the flags
 * existed still handles everything.
 *
 * The tests replace the HTTP layer (`BaseApi`) with a fake tenant that answers
 * 200 with an empty result and records the request, so what each combination
 * of the flags asks the tenant for can be checked without a recording. A
 * classic deployment with the realms `/`, `alpha` and `bravo` keeps it small.
 */
import { jest } from '@jest/globals';

const requests: string[] = [];
const realms = [
  { _id: 'L3Jvb3Q', name: '/', parentPath: null, active: true },
  { _id: 'YWxwaGE', name: 'alpha', parentPath: '/', active: true },
  { _id: 'YnJhdm8', name: 'bravo', parentPath: '/', active: true },
];
const empty = {
  result: [],
  resultCount: 0,
  pagedResultsCookie: null,
  totalPagedResults: 0,
  remainingPagedResults: 0,
};

function answer(method: string, url: string) {
  requests.push(`${method} ${url}`);
  if (url.includes('/json/global-config/realms/?_queryFilter=true')) {
    return { data: { ...empty, result: realms, resultCount: realms.length } };
  }
  return { data: { ...empty } };
}

const generate = () => ({
  get: async (url: string) => answer('GET', url),
  post: async (url: string) => answer('POST', url),
  put: async (url: string) => answer('PUT', url),
  patch: async (url: string) => answer('PATCH', url),
  delete: async (url: string) => answer('DELETE', url),
  request: async (config: { method?: string; url: string }) =>
    answer((config.method ?? 'GET').toUpperCase(), config.url),
  defaults: { headers: { common: {} } },
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
});
jest.unstable_mockModule('../api/BaseApi', () => ({
  generateAmApi: generate,
  generateAmAuthApi: generate,
  generateOauth2Api: generate,
  generateIdmApi: generate,
  generateIdmSystemApi: generate,
  generateLogKeysApi: generate,
  generateLogApi: generate,
  generateEnvApi: generate,
  generateGovernanceApi: generate,
  generateWSFedApi: generate,
  generateReleaseApi: generate,
}));

const { default: State } = await import('../shared/State');
const { exportFullConfiguration, importFullConfiguration } =
  await import('./ConfigOps');

const HOST = 'https://tenant.example.com/am';
const CALLER_REALM = '/bravo';

function newState() {
  const state = State({});
  state.setHost(HOST);
  state.setDeploymentType('classic');
  state.setRealm(CALLER_REALM);
  return state;
}

const exportOptions = {
  useStringArrays: false,
  noDecode: false,
  coords: true,
  includeDefault: false,
  includeActiveValues: false,
  target: undefined as string,
  includeReadOnly: false,
  onlyRealm: false,
  onlyGlobal: false,
  onlyCustom: false,
};

const importOptions = {
  reUuidJourneys: false,
  reUuidScripts: false,
  reUuidCustomNodes: false,
  cleanServices: false,
  includeDefault: false,
  includeActiveValues: true,
  source: '',
  onlyCustom: false,
};

// one entity of each kind to import, in the global config and in the alpha realm
const importData = {
  meta: {},
  global: {
    site: { s1: { _id: 's1' } }, // dynamic
    scripttype: { t1: { _id: 't1' } }, // static
    authentication: { _id: 'global-authentication' }, // static
  },
  realm: {
    'root-alpha': {
      script: {
        example: {
          _id: 'example',
          name: 'example',
          script: '',
          context: 'AUTHENTICATION_TREE_DECISION_NODE',
          language: 'JAVASCRIPT',
          createdBy: 'test',
          creationDate: 1,
          lastModifiedBy: 'test',
          lastModifiedDate: 1,
          default: false,
          evaluatorVersion: '1.0',
        }, // static
      },
      authentication: { _id: 'authentication' }, // static
      agent: { a1: { _id: 'a1', _type: { _id: 'WebAgent' } } }, // dynamic
      application: { c1: { _id: 'c1', coreOAuth2ClientConfig: {} } }, // dynamic
      policy: {
        p1: {
          name: 'p1',
          applicationName: 'x',
          _id: 'p1',
          resourceTypeUuid: 'r',
        },
      }, // dynamic
    },
  },
};

/** What a full export asks the tenant for, by kind (the alpha realm and the global config). */
const EXPORT_STATIC = [
  '/json/global-config/services/scripting/contexts', // script types
  '/json/realms/root/realms/alpha/scripts',
  '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/trees', // journeys
  '/json/realms/root/realms/alpha/realm-config/authentication',
];
const EXPORT_DYNAMIC = [
  '/json/global-config/sites',
  '/json/global-config/servers',
  '/json/realms/root/realms/alpha/policies',
  '/json/realms/root/realms/alpha/applications', // policy sets
  '/json/realms/root/realms/alpha/resourcetypes',
  '/json/realms/root/realms/alpha/realm-config/agents/OAuth2Client',
  '/json/realms/root/realms/alpha/realm-config/saml2',
  '/json/realms/root/realms/alpha/realm-config/federation/circlesoftrust',
  '/json/realms/root/realms/alpha/realm-config/agents/TrustedJwtIssuer',
];
/** What a full import writes, by kind. */
const IMPORT_STATIC = [
  'PUT /json/global-config/services/scripting/contexts/t1',
  'PUT /json/global-config/authentication',
  'PUT /json/realms/root/realms/alpha/scripts/example',
  'PUT /json/realms/root/realms/alpha/realm-config/authentication',
];
const IMPORT_DYNAMIC = [
  'PUT /json/global-config/sites/s1',
  'PUT /json/realms/root/realms/alpha/realm-config/agents/WebAgent/a1',
  'PUT /json/realms/root/realms/alpha/realm-config/agents/OAuth2Client/c1',
  'PUT /json/realms/root/realms/alpha/policies/p1',
];

/** The requests as `METHOD /path`, without the host and the query. */
const paths = () =>
  requests.map((r) => r.replace(HOST, '').replace(/\?.*/, ''));

const asked = (markers: string[]) =>
  markers.filter((marker) => paths().some((r) => r.includes(marker)));

beforeEach(() => {
  requests.length = 0;
});

describe('exportFullConfiguration', () => {
  async function runExport(flags: object) {
    const errors: string[] = [];
    await exportFullConfiguration({
      options: { ...exportOptions, ...flags } as never,
      resultCallback: (error) => {
        if (error) errors.push(error.message);
      },
      state: newState(),
    });
    expect(errors).toEqual([]);
  }

  test('1: Asks for static and dynamic configuration when both are on', async () => {
    await runExport({ includeStatic: true, includeDynamic: true });
    expect(asked(EXPORT_STATIC)).toEqual(EXPORT_STATIC);
    expect(asked(EXPORT_DYNAMIC)).toEqual(EXPORT_DYNAMIC);
  });

  test('2: Asks for both when the options do not mention the flags (options written before they existed)', async () => {
    await runExport({});
    expect(asked(EXPORT_STATIC)).toEqual(EXPORT_STATIC);
    expect(asked(EXPORT_DYNAMIC)).toEqual(EXPORT_DYNAMIC);
  });

  test('3: Asks only for static configuration when dynamic is off', async () => {
    await runExport({ includeStatic: true, includeDynamic: false });
    expect(asked(EXPORT_STATIC)).toEqual(EXPORT_STATIC);
    expect(asked(EXPORT_DYNAMIC)).toEqual([]);
  });

  test('4: Asks only for dynamic configuration when static is off, in every realm', async () => {
    await runExport({ includeStatic: false, includeDynamic: true });
    expect(asked(EXPORT_STATIC)).toEqual([]);
    expect(asked(EXPORT_DYNAMIC)).toEqual(EXPORT_DYNAMIC);
    // the realm-level configuration of the realms that do not come from the
    // static AM config entities export
    for (const realm of ['alpha', 'bravo']) {
      expect(
        requests.some((r) => r.includes(`/realms/${realm}/policies`))
      ).toBe(true);
    }
    expect(requests.some((r) => r.includes('/json/realms/root/policies'))).toBe(
      true
    );
  });

  test('5: Asks for nothing when both are off', async () => {
    await runExport({ includeStatic: false, includeDynamic: false });
    expect(requests).toEqual([]);
  });
});

describe('importFullConfiguration', () => {
  async function runImport(flags: object) {
    const errors: string[] = [];
    await importFullConfiguration({
      importData: importData as never,
      options: { ...importOptions, ...flags } as never,
      resultCallback: (error) => {
        if (error) errors.push(error.message);
      },
      state: newState(),
    });
    expect(errors).toEqual([]);
  }
  const wrote = (markers: string[]) =>
    markers.filter((marker) => paths().includes(marker));

  test('1: Writes static and dynamic configuration when both are on', async () => {
    await runImport({ includeStatic: true, includeDynamic: true });
    expect(wrote(IMPORT_STATIC)).toEqual(IMPORT_STATIC);
    expect(wrote(IMPORT_DYNAMIC)).toEqual(IMPORT_DYNAMIC);
  });

  test('2: Writes both when the options do not mention the flags, and tries nothing the file does not hold', async () => {
    await runImport({});
    expect(wrote(IMPORT_STATIC)).toEqual(IMPORT_STATIC);
    expect(wrote(IMPORT_DYNAMIC)).toEqual(IMPORT_DYNAMIC);
    // every request is one of the entities in the file, plus the reads that
    // come with updating a script or a policy
    const known = [...IMPORT_STATIC, ...IMPORT_DYNAMIC];
    for (const request of paths()) {
      expect(
        known.includes(request) ||
          request.startsWith('GET ') ||
          request.startsWith('POST ')
      ).toBe(true);
    }
  });

  test('3: Writes only static configuration when dynamic is off', async () => {
    await runImport({ includeStatic: true, includeDynamic: false });
    expect(wrote(IMPORT_STATIC)).toEqual(IMPORT_STATIC);
    expect(wrote(IMPORT_DYNAMIC)).toEqual([]);
  });

  test('4: Writes only dynamic configuration when static is off', async () => {
    await runImport({ includeStatic: false, includeDynamic: true });
    expect(wrote(IMPORT_STATIC)).toEqual([]);
    expect(wrote(IMPORT_DYNAMIC)).toEqual(IMPORT_DYNAMIC);
  });

  test('5: Writes nothing when both are off', async () => {
    await runImport({ includeStatic: false, includeDynamic: false });
    expect(requests).toEqual([]);
  });
});
