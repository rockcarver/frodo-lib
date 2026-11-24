/**
 * Unit tests for the import of trusted JWT issuers: each issuer is written
 * once, whichever section of the file holds it, and every layout of an export
 * that was ever written still imports completely.
 *
 * Run with:
 *
 *        npm run test:only ConfigOps.issuerImportOnce
 *
 * The issuers in the files below are the real objects of two committed
 * recordings, read as data (the tests replay no traffic): the list of a Cloud
 * realm (4.x and 5.0 exports hold each issuer under `agent` and under
 * `trustedJwtIssuer`) and the list of the root realm of a classic deployment
 * (recorded before lib 4.0.0, when the issuers were only under
 * `trustedJwtIssuer`; one of its ids has a space). From them the tests build
 * every layout a file can have. The HTTP layer (`BaseApi`) is replaced by a
 * fake tenant that records the requests; no tenant.
 */
import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';

type Request = {
  method: string;
  path: string;
  apiVersion?: string;
  body?: any;
};
const requests: Request[] = [];
const HOST = 'https://tenant.example.com/am';
let failingIssuer: string | undefined;
const empty = {
  result: [],
  resultCount: 0,
  pagedResultsCookie: null,
  totalPagedResults: 0,
  remainingPagedResults: 0,
};

const generate = (config: { resource?: { apiVersion?: string } } = {}) => {
  const answer = (method: string, url: string, body?: any) => {
    requests.push({
      method,
      path: url.replace(HOST, '').replace(/\?.*/, ''),
      apiVersion: config.resource?.apiVersion,
      body,
    });
    if (
      method === 'PUT' &&
      failingIssuer &&
      url.includes(`/TrustedJwtIssuer/${failingIssuer}`)
    ) {
      throw { response: { status: 500, data: { message: 'Server Error' } } };
    }
    return { data: method === 'PUT' ? (body ?? {}) : { ...empty } };
  };
  return {
    get: async (url: string) => answer('GET', url),
    post: async (url: string, body?: any) => answer('POST', url, body),
    put: async (url: string, body?: any) => answer('PUT', url, body),
    patch: async (url: string, body?: any) => answer('PATCH', url, body),
    delete: async (url: string) => answer('DELETE', url),
    request: async (c: { method?: string; url: string; data?: any }) =>
      answer((c.method ?? 'GET').toUpperCase(), c.url, c.data),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
};
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
const { importFullConfiguration } = await import('./ConfigOps');
const { default: OAuth2TrustedJwtIssuerOps } =
  await import('./OAuth2TrustedJwtIssuerOps');

// --- fixtures: real issuers from committed recordings ----------------------

const RECORDINGS = path.resolve(
  process.cwd(),
  'src/test/mock-recordings/ConfigOps_2138586609'
);
const CLOUD_RECORDING = path.join(
  RECORDINGS,
  'Cloud-Tests_2178067211/exportFullConfiguration_221463303/7-Export-only-dynamic-configurations_1963192752/recording.har'
);
const CLASSIC_DIRECTORY = path.join(
  RECORDINGS,
  'Classic-Tests_743483830/exportFullConfiguration_221463303'
);

/** The first non-empty answer for the list of trusted JWT issuers in a recording. */
function issuersIn(recording: string): Record<string, any>[] {
  const har = JSON.parse(fs.readFileSync(recording, 'utf8'));
  for (const entry of har.log.entries) {
    if (
      entry.request.method === 'GET' &&
      entry.request.url.includes('/agents/TrustedJwtIssuer?')
    ) {
      const { result } = JSON.parse(entry.response.content.text);
      if (result?.length > 0) return result;
    }
  }
  throw new Error(`no trusted JWT issuers in ${recording}`);
}

const classicRecording = path.join(
  CLASSIC_DIRECTORY,
  fs
    .readdirSync(CLASSIC_DIRECTORY)
    .find((name) => name.startsWith('6-Export-everything'))!,
  'recording.har'
);

type Source = {
  name: string;
  issuers: Record<string, any>[];
  /** the key of the realm in a full export, the realm path and the realm in the URL */
  realmKey: string;
  realm: string;
  realmPath: string;
  deployment: string;
};
const SOURCES: Source[] = [
  {
    name: 'a Cloud realm (alpha)',
    issuers: issuersIn(CLOUD_RECORDING),
    realmKey: 'root-alpha',
    realm: '/alpha',
    realmPath: '/realms/root/realms/alpha',
    deployment: 'classic',
  },
  {
    name: 'the root realm of a classic deployment',
    issuers: issuersIn(classicRecording),
    realmKey: 'root',
    realm: '/',
    realmPath: '/realms/root',
    deployment: 'classic',
  },
];

const byId = (issuers: Record<string, any>[]) =>
  Object.fromEntries(issuers.map((issuer) => [issuer._id, issuer]));

/** Every layout a file can hold the issuers in. */
const LAYOUTS: [string, (i: Record<string, any>[]) => Record<string, any>][] = [
  [
    'under agent and trustedJwtIssuer (every export since 4.0.0)',
    (issuers) => ({
      agent: byId(issuers),
      trustedJwtIssuer: byId(issuers),
    }),
  ],
  [
    'under agent only (an agent export of the 4.x line)',
    (issuers) => ({ agent: byId(issuers) }),
  ],
  [
    'under trustedJwtIssuer only (an export before 4.0.0, and the layout of 3.x)',
    (issuers) => ({ trustedJwtIssuer: byId(issuers) }),
  ],
];

// --- helpers ---------------------------------------------------------------

function newState(source: Source) {
  const state = State({});
  state.setHost(HOST);
  state.setDeploymentType(source.deployment);
  state.setRealm(source.realm);
  return state;
}

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

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

const issuerPuts = () =>
  requests.filter(
    (r) => r.method === 'PUT' && r.path.includes('/agents/TrustedJwtIssuer/')
  );

async function runFullImport(
  source: Source,
  realmData: Record<string, any>,
  options: object = {}
) {
  const errors: string[] = [];
  const results: unknown[] = [];
  await importFullConfiguration({
    importData: {
      meta: {},
      global: {},
      realm: { [source.realmKey]: realmData },
    } as never,
    options: { ...importOptions, ...options } as never,
    resultCallback: (error, result) => {
      if (error) errors.push(error.message);
      else results.push(result);
    },
    state: newState(source),
  });
  return { errors, results };
}

/** What the tenant should receive for an issuer: the fixture without the revision. */
function expectedBody(issuer: Record<string, any>) {
  const { _rev, ...body } = issuer;
  void _rev;
  return body;
}

beforeEach(() => {
  requests.length = 0;
  failingIssuer = undefined;
});

// --- tests -----------------------------------------------------------------

describe.each(SOURCES)('issuers of $name', (source) => {
  const urlOf = (id: string) =>
    `${source.realmPath}/realm-config/agents/TrustedJwtIssuer/${id}`;

  test('the fixture holds issuers', () => {
    expect(source.issuers.length).toBeGreaterThanOrEqual(2);
    for (const issuer of source.issuers) {
      expect(issuer._type._id).toBe('TrustedJwtIssuer');
    }
  });

  describe.each(LAYOUTS)('a file with the issuers %s', (_layout, build) => {
    test('a full import writes each issuer once, complete, with the issuer module', async () => {
      const realmData = build(source.issuers);
      const before = copy(realmData);

      const { errors } = await runFullImport(source, realmData);

      expect(errors).toEqual([]);
      const puts = issuerPuts();
      expect(puts.map((r) => r.path).sort()).toEqual(
        source.issuers.map((issuer) => `/json${urlOf(issuer._id)}`).sort()
      );
      for (const put of puts) {
        // the issuer module writes (protocol 2.0), not the generic agent code (2.1)
        expect(put.apiVersion).toBe('protocol=2.0,resource=1.0');
        const issuer = source.issuers.find((i) =>
          put.path.endsWith(`/${i._id}`)
        );
        expect(put.body).toEqual(expectedBody(issuer));
      }
      // the file is as it was
      expect(realmData).toEqual(before);
    });

    test('importing the file again sends the same requests and leaves the file as it was', async () => {
      const realmData = build(source.issuers);

      await runFullImport(source, realmData);
      const first = copy(issuerPuts());
      requests.length = 0;
      await runFullImport(source, realmData);

      expect(issuerPuts()).toEqual(first);
      expect(realmData).toEqual(build(source.issuers));
    });

    test('a failing issuer is reported once', async () => {
      failingIssuer = source.issuers[0]._id;
      const realmData = build(source.issuers);

      const { errors } = await runFullImport(source, realmData);

      expect(errors).toEqual([
        `Error importing ${source.realm === '/' ? '/' : 'alpha'} realm trusted issuer ${failingIssuer}`,
      ]);
      // the others were written
      expect(
        issuerPuts().filter((r) => !r.path.endsWith(`/${failingIssuer}`))
      ).toHaveLength(source.issuers.length - 1);
    });

    test('nothing is written when dynamic configuration is off', async () => {
      await runFullImport(source, build(source.issuers), {
        includeDynamic: false,
      });
      expect(requests).toEqual([]);
    });

    test('the issuer module imports the same file, each issuer once', async () => {
      const importData = build(source.issuers);
      const before = copy(importData);
      const ops = OAuth2TrustedJwtIssuerOps(newState(source));

      const imported = await ops.importOAuth2TrustedJwtIssuers(
        importData as never
      );

      expect(imported).toHaveLength(source.issuers.length);
      expect(issuerPuts()).toHaveLength(source.issuers.length);
      expect(importData).toEqual(before);
      // one at a time, too
      requests.length = 0;
      await ops.importOAuth2TrustedJwtIssuer(
        source.issuers[1]._id,
        importData as never
      );
      expect(issuerPuts().map((r) => r.path)).toEqual([
        `/json${urlOf(source.issuers[1]._id)}`,
      ]);
      requests.length = 0;
      await ops.importFirstOAuth2TrustedJwtIssuer(importData as never);
      expect(issuerPuts()).toHaveLength(1);
      expect(importData).toEqual(before);
    });
  });
});

describe('a file whose two copies of an issuer differ', () => {
  const source = SOURCES[0];
  const [first] = source.issuers;
  const edited = {
    ...copy(first),
    issuer: 'https://edited.matrix.example.com',
  };

  test('the full import writes the trustedJwtIssuer copy', async () => {
    await runFullImport(source, {
      agent: { [first._id]: edited },
      trustedJwtIssuer: { [first._id]: first },
    });
    const puts = issuerPuts();
    expect(puts).toHaveLength(1);
    expect(puts[0].body.issuer).toBe(first.issuer);
  });

  test('the issuer module does the same', async () => {
    const ops = OAuth2TrustedJwtIssuerOps(newState(source));
    await ops.importOAuth2TrustedJwtIssuers({
      agent: { [first._id]: edited },
      trustedJwtIssuer: { [first._id]: first },
    } as never);
    const puts = issuerPuts();
    expect(puts).toHaveLength(1);
    expect(puts[0].body.issuer).toBe(first.issuer);
  });

  test('an id that neither section has is "not found in import data!"', async () => {
    const ops = OAuth2TrustedJwtIssuerOps(newState(source));
    await expect(
      ops.importOAuth2TrustedJwtIssuer('zion-issuer', {
        agent: { [first._id]: edited },
        trustedJwtIssuer: { [first._id]: first },
      } as never)
    ).rejects.toThrow('Trusted issuer zion-issuer not found in import data!');
    expect(issuerPuts()).toEqual([]);
  });
});

describe('other agents in the same file', () => {
  const source = SOURCES[0];
  const webAgent = {
    _id: 'zion-web',
    _type: { _id: 'WebAgent', name: 'Web Agent', collection: true },
  };

  test('a web agent in the agent section is still written by the agent import', async () => {
    const { errors } = await runFullImport(source, {
      agent: { 'zion-web': webAgent, ...byId(source.issuers) },
      trustedJwtIssuer: byId(source.issuers),
    });

    expect(errors).toEqual([]);
    const agentPuts = requests.filter(
      (r) => r.method === 'PUT' && r.path.includes('/agents/WebAgent/')
    );
    expect(agentPuts.map((r) => r.path)).toEqual([
      '/json/realms/root/realms/alpha/realm-config/agents/WebAgent/zion-web',
    ]);
    expect(agentPuts[0].apiVersion).toBe('protocol=2.1,resource=1.0');
    expect(issuerPuts()).toHaveLength(source.issuers.length);
  });

  test('the agents step is skipped when the agent section held nothing but issuers', async () => {
    // The step reports its result to the callback when it runs (also an empty
    // one), so the file with issuers only under agent must report as many
    // results as the file with the same issuers only under trustedJwtIssuer.
    const agentOnly = await runFullImport(source, {
      agent: byId(source.issuers),
    });
    const moduleOnly = await runFullImport(source, {
      trustedJwtIssuer: byId(source.issuers),
    });
    expect(agentOnly.results).toHaveLength(moduleOnly.results.length);
  });

  test('an empty agent section still runs the agents step, as before', async () => {
    const withEmpty = await runFullImport(source, { agent: {} });
    const without = await runFullImport(source, {});
    expect(withEmpty.results).toHaveLength(without.results.length + 1);
  });
});
