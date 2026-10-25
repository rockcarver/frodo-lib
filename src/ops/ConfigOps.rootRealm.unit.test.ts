/**
 * Unit tests for which realms a full configuration export asks Identity Cloud for.
 *
 * Run with:
 *
 *        npm run test:only ConfigOps.rootRealm
 *
 * Origin: frodo-cli#518. A full export asks for every realm the tenant lists,
 * the root realm included. Identity Cloud manages the root realm itself and
 * answers 403 to nearly everything in it: in the recordings of cloud tenants
 * (3,594 files in frodo-lib and frodo-cli) every `/realm-config/...` entity and
 * the scripts of the root realm were answered 403, none was ever answered 200,
 * and a default export writes nothing for the root realm. Only its
 * authorization config (policies, policy sets, resource types and, with
 * `includeReadOnly`, their definitions) can be read.
 *
 * What is tested is what goes over the wire, so the tests replace the HTTP
 * layer (`BaseApi`) with a fake tenant and record every request. The fake
 * answers like Identity Cloud does: 403 for the root realm's `/realm-config/...`
 * and `/scripts`, 200 with an empty result for everything else. No recording
 * and no tenant is needed. The root realm must still be requested on every
 * other deployment type, and on Identity Cloud when the caller names it (the
 * `onlyRealm` option with the active realm `/`); the other realms must be
 * requested exactly as before.
 */
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';

type Request = { method: string; url: string };
const requests: Request[] = [];
// what the export reports through its result callback, as frodo-cli's callback receives it
const reported: string[] = [];

// What Identity Cloud says in the body of a 403. The library treats the first as "known, not an error" and
// reports the second, which is what a recorded cloud export shows for the social identity providers request.
const NOT_AVAILABLE =
  'This operation is not available in PingOne Advanced Identity Cloud.';

function forbidden(url: string): AxiosError {
  return new AxiosError(
    'Request failed with status code 403',
    'ERR_BAD_REQUEST',
    { url } as never,
    undefined,
    {
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: {} as never,
      data: {
        code: 403,
        reason: 'Forbidden',
        message: url.includes('/services/SocialIdentityProviders')
          ? 'Forbidden'
          : NOT_AVAILABLE,
      },
    }
  );
}

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

/** The fake tenant: what Identity Cloud answers, whichever way the library asks. */
function answer(method: string, url: string) {
  requests.push({ method, url });
  if (url.includes('/json/global-config/realms/?_queryFilter=true')) {
    return { data: { ...empty, result: realms, resultCount: realms.length } };
  }
  if (
    fakeTenantIsCloud &&
    /\/json\/realms\/root\/(realm-config\/|scripts)/.test(url)
  ) {
    throw forbidden(url);
  }
  return { data: { ...empty } };
}
let fakeTenantIsCloud = true;

function fakeAxios() {
  return {
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
  };
}
const generate = () => fakeAxios();
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
const { exportFullConfiguration } = await import('./ConfigOps');
const { exportAmConfigEntities } = await import('./AmConfigOps');

const HOST = 'https://tenant.example.com/am';
// a path below a realm, e.g. '/realm-config/agents' or '/scripts'
const realmPath = (url: string) =>
  url
    .replace(/\?.*$/, '')
    .replace(/^.*\/json\/realms\/root(\/realms\/[^/]+)?/, '');
const inRealm = (realm: string) =>
  requests
    .filter((r) =>
      realm === 'root'
        ? /\/json\/realms\/root\/(?!realms\/)/.test(r.url)
        : r.url.includes(`/json/realms/root/realms/${realm}/`)
    )
    .map((r) => `${r.method} ${realmPath(r.url)}`);

function newState(deployment: string, activeRealm: string) {
  const state = State({});
  state.setHost(HOST);
  state.setDeploymentType(deployment);
  state.setRealm(activeRealm);
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

async function exportFull(
  deployment: string,
  activeRealm: string,
  options: Partial<typeof exportOptions> = {}
) {
  requests.length = 0;
  reported.length = 0;
  const state = newState(deployment, activeRealm);
  await exportFullConfiguration({
    options: { ...exportOptions, ...options },
    resultCallback: (error) => {
      if (error) reported.push(String(error.getCombinedMessage()));
    },
    state,
  });
  return state;
}

// Everything the root realm of Identity Cloud denies, as the fake tenant sees it.
const denied = (path: string) => /^\/(realm-config\/|scripts)/.test(path);
const rootRequestsDenied = () =>
  inRealm('root').filter((r) => denied(r.split(' ')[1]));

beforeEach(() => {
  fakeTenantIsCloud = true;
});

describe('a full export on Identity Cloud', () => {
  test('requests no root realm config that Identity Cloud denies', async () => {
    await exportFull('cloud', '/alpha');
    expect(rootRequestsDenied()).toEqual([]);
  });

  test('still requests the authorization config of the root realm', async () => {
    await exportFull('cloud', '/alpha');
    expect(inRealm('root').sort()).toEqual([
      'GET /applications',
      'GET /policies',
      'GET /resourcetypes',
    ]);
  });

  test('also requests the authorization definitions of the root realm with includeReadOnly', async () => {
    await exportFull('cloud', '/alpha', { includeReadOnly: true });
    expect(rootRequestsDenied()).toEqual([]);
    expect(inRealm('root').sort()).toEqual([
      'GET /applications',
      'GET /applicationtypes',
      'GET /conditiontypes',
      'GET /decisioncombiners',
      'GET /policies',
      'GET /resourcetypes',
      'GET /subjectattributes',
      'GET /subjecttypes',
    ]);
  });

  test.each([
    ['default', {}],
    ['includeReadOnly', { includeReadOnly: true }],
    ['onlyGlobal', { onlyGlobal: true }],
  ])(
    'requests the same for the other realms as for each other (%s)',
    async (_name, options) => {
      await exportFull('cloud', '/alpha', options);
      const alpha = inRealm('alpha');
      const bravo = inRealm('bravo');
      expect(bravo).toEqual(alpha);
      if (!('onlyGlobal' in options)) {
        // every denied kind of entity is still asked for in a realm that is not the root realm
        const asked = new Set(alpha.map((r) => r.split(' ')[1].split('/')[1]));
        expect(asked).toContain('scripts');
        expect(asked).toContain('realm-config');
        const configs = alpha.map((r) => r.split(' ')[1]);
        for (const path of [
          '/realm-config/agents/OAuth2Client',
          '/realm-config/agents/TrustedJwtIssuer',
          '/realm-config/authentication',
          '/realm-config/authentication/authenticationtrees/trees',
          '/realm-config/authentication/chains',
          '/realm-config/federation/circlesoftrust',
          '/realm-config/federation/entityproviders/ws',
          '/realm-config/saml2',
          '/realm-config/services',
          '/realm-config/services/SocialIdentityProviders',
          '/realm-config/webhooks',
          '/scripts',
          '/policies',
          '/applications',
          '/resourcetypes',
        ]) {
          expect(configs).toContain(path);
        }
      }
    }
  );

  test('requests the root realm as before when the caller names it', async () => {
    await exportFull('cloud', '/', { onlyRealm: true });
    const asked = inRealm('root').map((r) => r.split(' ')[1]);
    expect(asked).toEqual(
      expect.arrayContaining([
        '/scripts',
        '/realm-config/authentication',
        '/realm-config/authentication/chains',
        '/realm-config/webhooks',
        '/policies',
      ])
    );
    expect(inRealm('alpha')).toEqual([]);
    expect(inRealm('bravo')).toEqual([]);
  });

  test('requests only the active realm with onlyRealm, and nothing from the root realm', async () => {
    await exportFull('cloud', '/alpha', { onlyRealm: true });
    expect(inRealm('root')).toEqual([]);
    expect(inRealm('bravo')).toEqual([]);
    expect(inRealm('alpha').length).toBeGreaterThan(0);
  });

  test('reports no error for the root realm', async () => {
    await exportFull('cloud', '/alpha', { includeReadOnly: true });
    expect(reported.filter((m) => m.includes('/json/realms/root/'))).toEqual(
      []
    );
  });

  test('reports the denied requests of the root realm when the caller names it', async () => {
    await exportFull('cloud', '/', { onlyRealm: true });
    expect(
      reported.filter((m) =>
        m.includes(
          '/json/realms/root/realm-config/services/SocialIdentityProviders'
        )
      ).length
    ).toBe(1);
  });
});

describe.each(['classic', 'forgeops'])(
  'a full export on a %s deployment',
  (deployment) => {
    test('requests the root realm config as before, whatever it answers', async () => {
      fakeTenantIsCloud = false;
      await exportFull(deployment, '/');
      const asked = inRealm('root').map((r) => r.split(' ')[1]);
      expect(asked).toEqual(
        expect.arrayContaining([
          '/scripts',
          '/realm-config/authentication',
          '/realm-config/authentication/chains',
          '/realm-config/webhooks',
          '/realm-config/federation/entityproviders/ws',
          '/policies',
          '/applications',
          '/resourcetypes',
        ])
      );
    });
  }
);

describe('exporting the AM config entities', () => {
  async function exportEntities(
    deployment: string,
    options: {
      includeReadOnly?: boolean;
      onlyRealm?: boolean;
      onlyGlobal?: boolean;
    } = {},
    activeRealm = '/alpha'
  ) {
    requests.length = 0;
    await exportAmConfigEntities({
      includeReadOnly: false,
      onlyRealm: false,
      onlyGlobal: false,
      ...options,
      state: newState(deployment, activeRealm),
    });
  }

  test('on Identity Cloud, skips the entities that are denied in the root realm', async () => {
    await exportEntities('cloud');
    expect(inRealm('root')).toEqual([]);
    expect(inRealm('alpha').sort()).toEqual([
      'GET /realm-config/authentication/chains',
      'GET /realm-config/federation/entityproviders/ws',
      'GET /realm-config/webhooks',
    ]);
  });

  test('on Identity Cloud with includeReadOnly, asks the root realm for the authorization definitions only', async () => {
    await exportEntities('cloud', { includeReadOnly: true });
    expect(inRealm('root').sort()).toEqual([
      'GET /applicationtypes',
      'GET /conditiontypes',
      'GET /decisioncombiners',
      'GET /subjectattributes',
      'GET /subjecttypes',
    ]);
    // the realms that are not the root realm get every entity, the denied ones included
    expect(inRealm('alpha')).toEqual(
      expect.arrayContaining([
        'POST /realm-config/authentication/modules',
        'POST /realm-config/secrets',
        'GET /realm-config/webhooks',
      ])
    );
    expect(inRealm('bravo')).toEqual(inRealm('alpha'));
  });

  test('on Identity Cloud, asks for the root realm when the caller names it', async () => {
    await exportEntities('cloud', { onlyRealm: true }, '/');
    expect(inRealm('root').sort()).toEqual([
      'GET /realm-config/authentication/chains',
      'GET /realm-config/federation/entityproviders/ws',
      'GET /realm-config/webhooks',
    ]);
  });

  test.each(['classic', 'forgeops'])(
    'on a %s deployment, asks the root realm for every entity',
    async (deployment) => {
      fakeTenantIsCloud = false;
      await exportEntities(deployment, { includeReadOnly: true }, '/');
      expect(inRealm('root').sort()).toEqual([
        'GET /applicationtypes',
        'GET /conditiontypes',
        'GET /decisioncombiners',
        'GET /realm-config/authentication/chains',
        'GET /realm-config/federation/entityproviders/ws',
        'GET /realm-config/webhooks',
        'GET /subjectattributes',
        'GET /subjecttypes',
        'POST /realm-config/authentication/modules',
        'POST /realm-config/secrets',
      ]);
    }
  );
});
