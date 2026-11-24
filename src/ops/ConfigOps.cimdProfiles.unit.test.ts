/**
 * Unit tests for CIMD profiles in a full configuration export and import.
 *
 * Run with:
 *
 *        npm run test:only ConfigOps.cimdProfiles
 *
 * CIMD profiles (agent type `CIMDProfile`) have a module of their own and an
 * export key of their own, `cimdProfile`. A full export holds each profile once,
 * under that key, and leaves the key out when the realm has no profile or does
 * not offer the type. A full import writes the profiles through the module as
 * the last step of a realm, whether the file holds them under `cimdProfile` or,
 * in an export made before the module existed, under `agent`.
 *
 * The HTTP layer (`BaseApi`) is replaced by a fake tenant that serves a type
 * list and the profiles per realm and records every request. A classic
 * deployment with the realms `/`, `alpha` and `bravo` keeps it small; the realm
 * decides what the module sees: alpha offers the type with two profiles, the
 * root realm offers it with none, bravo does not offer it. No recording, no
 * tenant.
 */
import { jest } from '@jest/globals';

type Request = { method: string; path: string; query: string; body?: any };
const requests: Request[] = [];
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

function typeItem(id: string, name = `${id} Agents`) {
  return { _id: id, name, collection: true };
}
function profile(id: string, pattern = `https://${id}.matrix.example.com/*`) {
  return {
    _id: id,
    _rev: '-1122334455',
    cimdConfig: {
      cimdClientIdUrlPatterns: [pattern],
      cimdMetadataDenyList: [],
      cimdSsrfProtectionEnabled: true,
    },
    coreOAuth2ClientConfig: { status: 'Active' },
    _type: {
      _id: 'CIMDProfile',
      name: 'CIMD Profile Agents',
      collection: true,
    },
  };
}
function webAgent(id: string) {
  return {
    _id: id,
    _rev: '-99',
    _type: { _id: 'WebAgent', name: 'Web Agents', collection: true },
  };
}

/** What the fake tenant serves, by realm name in the URL (`root` for the root realm). */
type Realm = { types: unknown[]; agents: Record<string, unknown[]> };
const tenant: Record<string, Realm> = {};
/** profile ids whose PUT fails with 400 */
let failingProfiles: string[] = [];

function resetTenant() {
  tenant.root = {
    types: [typeItem('WebAgent'), typeItem('CIMDProfile')],
    agents: { WebAgent: [], CIMDProfile: [] },
  };
  tenant.alpha = {
    types: [typeItem('WebAgent'), typeItem('CIMDProfile')],
    agents: {
      WebAgent: [webAgent('matrix-web')],
      CIMDProfile: [profile('zion-clients'), profile('matrix-clients')],
    },
  };
  tenant.bravo = {
    types: [typeItem('WebAgent')],
    agents: { WebAgent: [webAgent('zion-web')] },
  };
  failingProfiles = [];
}

function answer(method: string, url: string, body?: any) {
  const queryAt = url.indexOf('?');
  const query = queryAt < 0 ? '' : url.slice(queryAt);
  const path = (queryAt < 0 ? url : url.slice(0, queryAt)).replace(
    /^https:\/\/[^/]+\/am/,
    ''
  );
  requests.push({ method, path, query, body });
  if (path === '/json/global-config/realms/') {
    return { data: { ...empty, result: realms, resultCount: realms.length } };
  }
  const agents = path.match(
    /^\/json\/realms\/root(?:\/realms\/([^/]+))?\/realm-config\/agents(?:\/([^/]+)(?:\/([^/]+))?)?$/
  );
  if (agents) {
    const [, realm = 'root', type, id] = agents;
    const served = tenant[realm];
    if (method === 'POST' && !type && query.includes('_action=getAllTypes')) {
      return { data: { ...empty, result: served?.types ?? [] } };
    }
    if (method === 'GET' && type && !id && type !== 'groups') {
      const result = served?.agents[type] ?? [];
      return { data: { ...empty, result, resultCount: result.length } };
    }
    if (method === 'PUT' && type === 'CIMDProfile' && id) {
      if (failingProfiles.includes(id)) {
        throw {
          response: {
            status: 400,
            data: { code: 400, message: 'Data validation failed' },
          },
        };
      }
      return { status: 200, data: body };
    }
  }
  return { data: method === 'PUT' ? (body ?? {}) : { ...empty } };
}

const generate = () => ({
  get: async (url: string) => answer('GET', url),
  post: async (url: string, body?: any) => answer('POST', url, body),
  put: async (url: string, body?: any) => answer('PUT', url, body),
  patch: async (url: string, body?: any) => answer('PATCH', url, body),
  delete: async (url: string) => answer('DELETE', url),
  request: async (config: { method?: string; url: string; data?: any }) =>
    answer((config.method ?? 'GET').toUpperCase(), config.url, config.data),
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

// The type list is cached per host, realm and deployment type for the life of
// the process: every state has a host of its own.
let hostCounter = 0;
type Output = {
  prints: { message: unknown; type: string }[];
  created: { id: string; total: number }[];
  updates: { id: string; message: string }[];
};
function newState() {
  hostCounter += 1;
  const state = State({});
  state.setHost(`https://tenant-${hostCounter}.example.com/am`);
  state.setDeploymentType('classic');
  state.setRealm('/bravo');
  const output: Output = { prints: [], created: [], updates: [] };
  state.setPrintHandler((message, type) => {
    output.prints.push({ message, type });
  });
  state.setCreateProgressHandler((_type, total) => {
    const id = `indicator-${output.created.length + 1}`;
    output.created.push({ id, total });
    return id;
  });
  state.setUpdateProgressHandler((id, message) => {
    output.updates.push({ id, message });
  });
  state.setStopProgressHandler(() => undefined);
  return { state, output };
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

const script = {
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
  },
};

const ALPHA = '/json/realms/root/realms/alpha/realm-config';
const BRAVO = '/json/realms/root/realms/bravo/realm-config';
const ROOT = '/json/realms/root/realm-config';

const requestsFor = (method: string, path: string) =>
  requests.filter((r) => r.method === method && r.path === path);
const profilePuts = () =>
  requests.filter(
    (r) => r.method === 'PUT' && r.path.includes('/agents/CIMDProfile/')
  );
const typeListRequests = () =>
  requests.filter((r) => r.query.includes('_action=getAllTypes'));

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

beforeEach(() => {
  requests.length = 0;
  resetTenant();
});

describe('exportFullConfiguration', () => {
  async function runExport(flags: object = {}) {
    const errors: string[] = [];
    const { state } = newState();
    const exported = await exportFullConfiguration({
      options: { ...exportOptions, ...flags } as never,
      resultCallback: (error) => {
        if (error) errors.push(error.message);
      },
      state,
    });
    expect(errors).toEqual([]);
    return exported;
  }

  test('1: holds each profile once, under cimdProfile, keyed by id; agent holds none of them', async () => {
    const exported = await runExport();

    const alpha = exported.realm['root-alpha'];
    expect(Object.keys(alpha.cimdProfile).sort()).toEqual([
      'matrix-clients',
      'zion-clients',
    ]);
    expect(alpha.cimdProfile['zion-clients']).toEqual(profile('zion-clients'));
    expect(alpha.cimdProfile['matrix-clients']).toEqual(
      profile('matrix-clients')
    );
    // the other agents are where they were; no profile is among them
    expect(Object.keys(alpha.agent)).toEqual(['matrix-web']);
    // the generic agent code did not ask for the type at all: one request, the module's
    expect(requestsFor('GET', `${ALPHA}/agents/CIMDProfile`)).toHaveLength(1);
  });

  test('2: a realm that offers the type with no profile has no cimdProfile key, and was asked once', async () => {
    const exported = await runExport();

    expect('cimdProfile' in exported.realm.root).toBe(false);
    expect(requestsFor('GET', `${ROOT}/agents/CIMDProfile`)).toHaveLength(1);
  });

  test('3: a realm that does not offer the type has no cimdProfile key and no request for the type', async () => {
    const exported = await runExport();

    expect('cimdProfile' in exported['realm']['root-bravo']).toBe(false);
    expect(Object.keys(exported.realm['root-bravo'].agent)).toEqual([
      'zion-web',
    ]);
    expect(
      requests.filter((r) => r.path.startsWith(`${BRAVO}/agents/CIMDProfile`))
    ).toEqual([]);
  });

  test('4: the type list of a realm is asked once for the agents and the profiles together', async () => {
    await runExport();

    for (const realm of [ROOT, ALPHA, BRAVO]) {
      expect(
        typeListRequests().filter((r) => r.path === `${realm}/agents`)
      ).toHaveLength(1);
    }
  });

  test('5: a realm without the type exports exactly the keys it exported before', async () => {
    const exported = await runExport();

    // the keys of bravo with the type absent from the list are the keys of every
    // realm; the alpha realm has one more, which only a profile creates
    const bravoKeys = Object.keys(exported.realm['root-bravo']);
    const alphaKeys = Object.keys(exported.realm['root-alpha']);
    expect(alphaKeys.filter((key) => !bravoKeys.includes(key))).toEqual([
      'cimdProfile',
    ]);
    expect(bravoKeys.filter((key) => !alphaKeys.includes(key))).toEqual([]);
  });

  test('6: static only: the profiles are not asked for', async () => {
    const exported = await runExport({
      includeStatic: true,
      includeDynamic: false,
    });

    expect(
      requests.filter((r) => r.path.includes('/agents/CIMDProfile'))
    ).toEqual([]);
    expect('cimdProfile' in (exported.realm['root-alpha'] ?? {})).toBe(false);
  });

  test('7: dynamic only: the profiles are exported, in every realm that offers the type', async () => {
    const exported = await runExport({
      includeStatic: false,
      includeDynamic: true,
    });

    expect(Object.keys(exported.realm['root-alpha'].cimdProfile)).toHaveLength(
      2
    );
    expect(requestsFor('GET', `${ALPHA}/agents/CIMDProfile`)).toHaveLength(1);
    expect(requestsFor('GET', `${ROOT}/agents/CIMDProfile`)).toHaveLength(1);
  });

  test('8: neither static nor dynamic: nothing is asked', async () => {
    await runExport({ includeStatic: false, includeDynamic: false });
    expect(requests).toEqual([]);
  });
});

describe('importFullConfiguration', () => {
  async function runImport(
    realmData: Record<string, unknown>,
    {
      flags = {},
      withCallback = true,
    }: { flags?: object; withCallback?: boolean } = {}
  ) {
    const errors: string[] = [];
    const results: unknown[] = [];
    const { state, output } = newState();
    const importData = {
      meta: {},
      global: {},
      realm: { 'root-alpha': realmData },
    };
    await importFullConfiguration({
      importData: importData as never,
      options: { ...importOptions, ...flags } as never,
      ...(withCallback
        ? {
            resultCallback: (error, result) => {
              if (error) errors.push(error.message);
              else results.push(result);
            },
          }
        : {}),
      state,
    });
    return { errors, results, output };
  }

  const cimdProfile = () => ({
    'zion-clients': profile('zion-clients'),
    'matrix-clients': profile('matrix-clients'),
  });
  const putPaths = () => profilePuts().map((r) => r.path);

  test('1: a file with the cimdProfile key: one PUT per profile, through the module, the generic section untouched', async () => {
    const { errors } = await runImport({
      cimdProfile: cimdProfile(),
      agent: { 'matrix-web': webAgent('matrix-web') },
    });

    expect(errors).toEqual([]);
    expect(putPaths().sort()).toEqual([
      `${ALPHA}/agents/CIMDProfile/matrix-clients`,
      `${ALPHA}/agents/CIMDProfile/zion-clients`,
    ]);
    // the module asked whether the realm offers the type before it wrote
    const firstPut = requests.indexOf(profilePuts()[0]);
    expect(
      requests
        .slice(0, firstPut)
        .some((r) => r.path === `${ALPHA}/agents` && r.method === 'POST')
    ).toBe(true);
    // the web agent was written by the generic agent import, once
    expect(
      requests.filter(
        (r) =>
          r.method === 'PUT' && r.path === `${ALPHA}/agents/WebAgent/matrix-web`
      )
    ).toHaveLength(1);
    // the body is the profile as exported, without the revision
    const { _rev, ...body } = profile('zion-clients');
    void _rev;
    expect(
      profilePuts().find((r) => r.path.endsWith('zion-clients')).body
    ).toEqual(body);
  });

  test('2: the profiles are written last in the realm: after the scripts and the authentication settings, and the step is the last one of the progress bar', async () => {
    const { output } = await runImport({
      script,
      authentication: { _id: 'authentication' },
      cimdProfile: cimdProfile(),
    });

    const written = requests
      .filter((r) => r.method === 'PUT')
      .map((r) => r.path);
    const scriptAt = written.indexOf(
      '/json/realms/root/realms/alpha/scripts/example'
    );
    const authAt = written.indexOf(`${ALPHA}/authentication`);
    const firstProfileAt = written.findIndex((p) =>
      p.includes('/agents/CIMDProfile/')
    );
    expect(scriptAt).toBeGreaterThanOrEqual(0);
    expect(authAt).toBeGreaterThan(scriptAt);
    expect(firstProfileAt).toBeGreaterThan(authAt);

    // the realm's progress bar: one update per step, the profiles last, and the
    // bar was created with as many steps as there are updates
    const realmBar = output.created.find((c) => c.total > 1 && c.total !== 22);
    expect(realmBar).toBeDefined();
    const steps = output.updates
      .filter((u) => u.id === realmBar.id)
      .map((u) =>
        u.message.replace(/^(Importing|Skipping) /, '').replace(/\.\.\.$/, '')
      );
    expect(steps).toHaveLength(realmBar.total);
    expect(steps.slice(-4)).toEqual([
      'Journeys',
      'Services',
      'Authentication Settings',
      'CIMD Profiles',
    ]);
  });

  test('3: an export made before the module existed, with the profiles under agent, writes each once, through the module', async () => {
    const { errors } = await runImport({
      agent: { ...cimdProfile(), 'matrix-web': webAgent('matrix-web') },
    });

    expect(errors).toEqual([]);
    expect(putPaths().sort()).toEqual([
      `${ALPHA}/agents/CIMDProfile/matrix-clients`,
      `${ALPHA}/agents/CIMDProfile/zion-clients`,
    ]);
    // written by the module: the type list was asked first, and after the other
    // agents (the generic step comes before the last step of the realm)
    const generic = requests.findIndex(
      (r) =>
        r.method === 'PUT' && r.path === `${ALPHA}/agents/WebAgent/matrix-web`
    );
    const firstPut = requests.indexOf(profilePuts()[0]);
    expect(generic).toBeGreaterThanOrEqual(0);
    expect(firstPut).toBeGreaterThan(generic);
    expect(
      requests
        .slice(generic, firstPut)
        .some((r) => r.path === `${ALPHA}/agents` && r.method === 'POST')
    ).toBe(true);
  });

  test('4: a file that holds the same profile in both places writes it once, from cimdProfile', async () => {
    const edited = profile(
      'zion-clients',
      'https://edited.matrix.example.com/*'
    );
    const { errors } = await runImport({
      agent: { 'zion-clients': edited },
      cimdProfile: { 'zion-clients': profile('zion-clients') },
    });

    expect(errors).toEqual([]);
    expect(profilePuts()).toHaveLength(1);
    expect(profilePuts()[0].body.cimdConfig.cimdClientIdUrlPatterns).toEqual([
      'https://zion-clients.matrix.example.com/*',
    ]);
  });

  test('5: the file is not changed', async () => {
    // (the generic agent import takes the revision out of the agents it writes,
    // as it always did; the profiles are what is checked here)
    const realmData = {
      agent: cimdProfile(),
      cimdProfile: { 'zion-clients': profile('zion-clients') },
    };
    const before = copy(realmData);
    await runImport(realmData);
    expect(realmData).toEqual(before);
  });

  test('6: importing the file twice sends the same requests', async () => {
    const realmData = { cimdProfile: cimdProfile() };
    await runImport(realmData);
    const first = copy(profilePuts());
    requests.length = 0;
    await runImport(realmData);
    expect(profilePuts()).toEqual(first);
  });

  test.each([
    ['dynamic is off', { includeStatic: true, includeDynamic: false }],
    ['both are off', { includeStatic: false, includeDynamic: false }],
  ])('7: nothing is written for the profiles when %s', async (_name, flags) => {
    await runImport(
      {
        cimdProfile: cimdProfile(),
        agent: { 'zion-clients': profile('zion-clients') },
      },
      { flags }
    );
    expect(profilePuts()).toEqual([]);
    expect(typeListRequests()).toEqual([]);
  });

  test('8: static only: the profiles are written when only static is off', async () => {
    await runImport(
      { cimdProfile: cimdProfile() },
      { flags: { includeStatic: false, includeDynamic: true } }
    );
    expect(profilePuts()).toHaveLength(2);
  });

  test('9: a file without profiles asks for nothing about them: not even the type list', async () => {
    const { errors } = await runImport({
      agent: { 'matrix-web': webAgent('matrix-web') },
    });

    expect(errors).toEqual([]);
    expect(profilePuts()).toEqual([]);
    expect(typeListRequests()).toEqual([]);
  });

  describe('a realm that does not offer the type', () => {
    beforeEach(() => {
      tenant.alpha.types = [typeItem('WebAgent')];
    });

    test.each([
      ['the cimdProfile key', () => ({ cimdProfile: cimdProfile() })],
      [
        'the agent section (an export made before the module existed)',
        () => ({ agent: cimdProfile() }),
      ],
    ])(
      '10: a file with the profiles under %s: nothing is written, one warning, no failure and no callback call',
      async (_name, build) => {
        const { errors, results, output } = await runImport(build());

        expect(errors).toEqual([]);
        expect(profilePuts()).toEqual([]);
        const warnings = output.prints.filter((p) => p.type === 'warn');
        expect(warnings).toHaveLength(1);
        expect(String(warnings[0].message)).toContain('2 CIMD profiles');
        // the step reported nothing of its own: a result callback only gets
        // the results of the other steps
        expect(results.filter((r) => Array.isArray(r) && r.length > 0)).toEqual(
          []
        );
      }
    );

    test('11: without a result callback the import does not fail either', async () => {
      const { output } = await runImport(
        { cimdProfile: cimdProfile() },
        { withCallback: false }
      );
      expect(profilePuts()).toEqual([]);
      expect(output.prints.filter((p) => p.type === 'warn')).toHaveLength(1);
    });
  });

  describe('a profile that the server refuses', () => {
    beforeEach(() => {
      failingProfiles = ['zion-clients'];
    });

    test('12: a result callback gets it as an item of its own and the rest of the configuration is still imported', async () => {
      const { errors } = await runImport({
        script,
        authentication: { _id: 'authentication' },
        cimdProfile: cimdProfile(),
      });

      expect(errors).toEqual([
        'Error importing alpha realm CIMD profile zion-clients',
      ]);
      // the other profile and the rest of the realm were written
      expect(putPaths()).toContain(
        `${ALPHA}/agents/CIMDProfile/matrix-clients`
      );
      expect(
        requests.some(
          (r) => r.method === 'PUT' && r.path === `${ALPHA}/authentication`
        )
      ).toBe(true);
    });

    test('13: without a result callback the step fails with one error, after every profile was tried', async () => {
      await expect(
        runImport({ cimdProfile: cimdProfile() }, { withCallback: false })
      ).rejects.toThrow('Error Importing CIMD Profiles');
      expect(putPaths().sort()).toEqual([
        `${ALPHA}/agents/CIMDProfile/matrix-clients`,
        `${ALPHA}/agents/CIMDProfile/zion-clients`,
      ]);
    });
  });
});
