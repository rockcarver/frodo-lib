/**
 * Guard test: a configuration type that has a module of its own is handled by
 * that module alone.
 *
 * Run with:
 *
 *        npm run test:only ConfigOps.ownModules
 *
 * Some agent types have an api module and an ops module of their own (OAuth2
 * clients, CIMD profiles). The generic agent code reads every agent type that a
 * realm lists, so it has to be told to skip them: `AGENT_TYPES_WITH_OWN_MODULE`
 * in `AgentOps.ts`. A type that has a module and is not on that list is read by
 * both, and a full export holds every object of it twice, under `agent` and under
 * the key of its module; a full import writes it twice. That is what happened
 * to trusted JWT issuers from 4.0.0 on (lib PR #580) and went unnoticed because
 * each copy is correct on its own.
 *
 * What fails here:
 *
 *  - a new api module that names an agent type in its URL
 *    (`realm-config/agents/<Type>`) and is not in `OWN_KEY` below: the types
 *    that have a module are derived from the api layer, not typed in again;
 *  - an entry of `OWN_KEY` that is not on `AGENT_TYPES_WITH_OWN_MODULE`, or the
 *    other way round;
 *  - a full export that holds an object under two keys of a realm, or under
 *    none, whatever the type.
 *
 * To add a type with a module of its own: add it to `AGENT_TYPES_WITH_OWN_MODULE`,
 * give it a key in `ConfigOps.ts` (`FullRealmExportInterface`, the export and the
 * import) and a row in `OWN_KEY`. `KNOWN_DOUBLE_HANDLED` is for a type that is
 * known to be handled twice and has a tracking issue; the list only shrinks.
 *
 * The HTTP layer (`BaseApi`) is replaced by a fake tenant that serves a type
 * list with every known agent type and one object of each. No recording, no
 * tenant.
 */
import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';

const empty = {
  result: [],
  resultCount: 0,
  pagedResultsCookie: null,
  totalPagedResults: 0,
  remainingPagedResults: 0,
};

// --- the types ------------------------------------------------------------

const API_DIRECTORY = path.resolve(process.cwd(), 'src/api');

/** Every agent type that the library knows by name: the literal types of `AgentApi.ts`. */
function knownAgentTypes(): string[] {
  const source = fs.readFileSync(
    path.join(API_DIRECTORY, 'AgentApi.ts'),
    'utf8'
  );
  return [...source.matchAll(/^export type \w+Type = '([^']+)';$/gm)].map(
    (match) => match[1]
  );
}

/**
 * The agent types that have an api module of their own: every api module other
 * than the generic `AgentApi.ts` that puts a type name in the URL of an agent
 * request. This is what "has its own module" means for the guard; it is read
 * from the sources so that a new module cannot be forgotten here.
 */
function typesWithApiModule(): string[] {
  const types = new Set<string>();
  for (const file of fs.readdirSync(API_DIRECTORY)) {
    if (
      !file.endsWith('.ts') ||
      file.endsWith('.test.ts') ||
      file === 'AgentApi.ts'
    ) {
      continue;
    }
    const source = fs.readFileSync(path.join(API_DIRECTORY, file), 'utf8');
    for (const match of source.matchAll(
      /realm-config\/agents\/([A-Za-z][A-Za-z0-9_.]*)/g
    )) {
      if (match[1] !== 'groups') types.add(match[1]);
    }
  }
  return [...types];
}

/**
 * The key under `realm.<realm>` of a full export where each type that has a
 * module of its own is exported. Every other agent type is under `agent`.
 */
const OWN_KEY: Record<string, string> = {
  OAuth2Client: 'application',
  TrustedJwtIssuer: 'trustedJwtIssuer',
  CIMDProfile: 'cimdProfile',
};

/**
 * Types that have a module of their own, are not yet on the list of
 * `AgentOps.ts` and so are exported under `agent` as well as under their key.
 * A tracking issue is needed for an entry; the list only shrinks. It is empty:
 * trusted JWT issuers were the one entry (exported twice from 4.0.0 on) until
 * they joined the list.
 */
const KNOWN_DOUBLE_HANDLED: string[] = [];

// --- the fake tenant -------------------------------------------------------

const types = knownAgentTypes();
/** one object per type; the id names the type so that a failure says which one */
const objectId = (type: string) => `matrix-${type}`;
const objectOf = (type: string) => ({
  _id: objectId(type),
  _rev: '-1',
  _type: { _id: type, name: `${type} Agents`, collection: true },
});

/** the `GET .../realm-config/agents/<Type>` requests of the tenant, by type */
const listRequests: string[] = [];

function answer(method: string, url: string, body?: unknown) {
  const queryAt = url.indexOf('?');
  const query = queryAt < 0 ? '' : url.slice(queryAt);
  const route = (queryAt < 0 ? url : url.slice(0, queryAt)).replace(
    /^https:\/\/[^/]+\/am/,
    ''
  );
  if (route === '/json/global-config/realms/') {
    const realms = [
      { _id: 'YWxwaGE', name: 'alpha', parentPath: '/', active: true },
    ];
    return { data: { ...empty, result: realms, resultCount: 1 } };
  }
  const agents = route.match(
    /^\/json\/realms\/root\/realms\/alpha\/realm-config\/agents(?:\/([^/]+))?$/
  );
  if (agents) {
    const [, type] = agents;
    if (method === 'POST' && !type && query.includes('_action=getAllTypes')) {
      return {
        data: {
          ...empty,
          result: types.map((_id) => ({
            _id,
            name: `${_id} Agents`,
            collection: true,
          })),
        },
      };
    }
    if (method === 'GET' && type && type !== 'groups') {
      listRequests.push(type);
      return { data: { ...empty, result: [objectOf(type)], resultCount: 1 } };
    }
  }
  return { data: method === 'PUT' ? (body ?? {}) : { ...empty } };
}

const generate = () => ({
  get: async (url: string) => answer('GET', url),
  post: async (url: string, body?: unknown) => answer('POST', url, body),
  put: async (url: string, body?: unknown) => answer('PUT', url, body),
  patch: async (url: string, body?: unknown) => answer('PATCH', url, body),
  delete: async (url: string) => answer('DELETE', url),
  request: async (config: { method?: string; url: string; data?: unknown }) =>
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
const { AGENT_TYPES_WITH_OWN_MODULE } = await import('./AgentOps');
const { exportFullConfiguration } = await import('./ConfigOps');

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

async function exportRealm(): Promise<Record<string, any>> {
  const state = State({});
  state.setHost('https://tenant.example.com/am');
  state.setDeploymentType('classic');
  state.setRealm('/alpha');
  const errors: string[] = [];
  const exported = await exportFullConfiguration({
    options: exportOptions as never,
    resultCallback: (error) => {
      if (error) errors.push(error.message);
    },
    state,
  });
  expect(errors).toEqual([]);
  return exported.realm['root-alpha'];
}

/** The keys of a realm of a full export that hold an object with this id. */
function keysHolding(realm: Record<string, any>, id: string): string[] {
  return Object.keys(realm)
    .filter(
      (key) =>
        realm[key] &&
        typeof realm[key] === 'object' &&
        Object.prototype.hasOwnProperty.call(realm[key], id)
    )
    .sort();
}

// --- tests -----------------------------------------------------------------

describe('the types that have a module of their own', () => {
  test('the sources name the agent types the fake tenant serves', () => {
    expect(types).toEqual(
      expect.arrayContaining(['WebAgent', 'OAuth2Client', 'CIMDProfile'])
    );
    expect(new Set(types).size).toBe(types.length);
  });

  test('every api module that names an agent type in its URL names a known type', () => {
    for (const type of typesWithApiModule()) {
      expect(types).toContain(type);
    }
  });

  test('the types with an api module are exactly the rows of OWN_KEY: a new module needs a row, and a row needs a module', () => {
    expect(typesWithApiModule().sort()).toEqual(Object.keys(OWN_KEY).sort());
  });

  test('the rows of OWN_KEY are exactly AGENT_TYPES_WITH_OWN_MODULE and the types known to be handled twice', () => {
    expect(
      Object.keys(OWN_KEY)
        .filter((type) => !KNOWN_DOUBLE_HANDLED.includes(type))
        .sort()
    ).toEqual([...AGENT_TYPES_WITH_OWN_MODULE].sort());
  });

  test('a type known to be handled twice has a row and is not on the list yet', () => {
    for (const type of KNOWN_DOUBLE_HANDLED) {
      expect(Object.keys(OWN_KEY)).toContain(type);
      expect(AGENT_TYPES_WITH_OWN_MODULE).not.toContain(type);
    }
  });

  test('every type on the list is an agent type the library knows', () => {
    for (const type of AGENT_TYPES_WITH_OWN_MODULE) {
      expect(types).toContain(type);
    }
  });
});

describe('a full export of a realm that lists every known agent type', () => {
  let realm: Record<string, any>;
  beforeAll(async () => {
    realm = await exportRealm();
  });

  test('every object is under exactly one key, the key of its owner', () => {
    const wrong: Record<string, string[]> = {};
    for (const type of types) {
      const owner = OWN_KEY[type] ?? 'agent';
      const expected = KNOWN_DOUBLE_HANDLED.includes(type)
        ? ['agent', owner].sort()
        : [owner];
      const actual = keysHolding(realm, objectId(type));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        wrong[type] = actual;
      }
    }
    // an object that is under two keys, or none, is named with the keys it is under
    expect(wrong).toEqual({});
  });

  test('every type is read once: by its module, or by the generic agent code, never by both', () => {
    expect([...listRequests].sort()).toEqual([...types].sort());
  });

  test('the generic agent section holds the generic types only', () => {
    const generic = types
      .filter(
        (type) =>
          !AGENT_TYPES_WITH_OWN_MODULE.includes(type as never) ||
          KNOWN_DOUBLE_HANDLED.includes(type)
      )
      .map(objectId)
      .sort();
    expect(Object.keys(realm.agent).sort()).toEqual(generic);
  });
});
