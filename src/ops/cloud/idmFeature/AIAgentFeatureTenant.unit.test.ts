/**
 * Unit tests for the reads of the diagnosis of the IDM feature `aiagent` against a tenant.
 *
 * Run with:
 *
 *        npm run test:only AIAgentFeatureTenant.unit
 *
 * Origin: frodo-lib#1060. The diagnosis reads the realms alpha and bravo one after the other on one state. Each read of
 * a realm switches the realm of the state; the caller's realm has to be the same afterwards, also when a request
 * fails. The tests replace the HTTP layer (`BaseApi`) with a fake tenant that answers by URL and records the realm the
 * state was on when each request went out. No recording and no tenant is needed.
 */
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';

type Request = { method: string; url: string; realm: string; body?: any };
const requests: Request[] = [];
/** URL part -> status or error: the fake answers this instead of the normal answer */
const refuse: Record<string, number | Error> = {};
let currentState: { getRealm(): string };

const empty = {
  result: [],
  resultCount: 0,
  pagedResultsCookie: null,
  totalPagedResultsPolicy: 'NONE',
  totalPagedResults: 0,
  remainingPagedResults: 0,
};

function httpError(url: string, status: number): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    { url } as never,
    undefined,
    {
      status,
      statusText: '',
      headers: {},
      config: {} as never,
      data: { code: status, message: 'x' },
    }
  );
}

function answer(method: string, url: string, body?: any) {
  requests.push({ method, url, realm: currentState.getRealm(), body });
  for (const [part, how] of Object.entries(refuse)) {
    if (url.includes(part)) {
      if (how instanceof Error) throw how;
      throw httpError(url, how);
    }
  }
  // the writes of the repair
  if (method === 'PUT' && /\/openidm\/config\/(managed|repo\.ds)$/.test(url))
    return { data: body };
  if (url.includes('/services/oauth-oidc?_action=template'))
    return {
      data: {
        _id: '',
        _rev: '-1',
        advancedOAuth2Config: { supportedScopes: [] },
      },
    };
  if (method === 'PUT' && url.includes('/services/oauth-oidc'))
    return { data: body };
  if (method === 'DELETE' && url.includes('/mappings/'))
    return { data: { _id: url.split('/').pop() } };
  if (url.endsWith('/environment/aiagent?_action=enable')) return { data: {} };
  if (url.endsWith('/openidm/feature/aiagent'))
    return {
      data: { _id: 'aiagent', installedVersion: '1', availableVersions: ['1'] },
    };
  if (url.includes('/openidm/feature/aiagent?_action=validate'))
    return {
      data: {
        status: 200,
        success: false,
        message: 'Validate complete. 26 failure(s).',
        failures: ['a', 'b'],
      },
    };
  if (url.endsWith('/openidm/config/managed'))
    return { data: { _id: 'managed', objects: [{ name: 'alpha_user' }] } };
  if (url.endsWith('/openidm/config/repo.ds'))
    return { data: { _id: 'repo.ds', resourceMapping: {} } };
  if (url.includes('/services/oauth-oidc'))
    return {
      data: {
        _id: '',
        advancedOAuth2Config: { passwordGrantAuthService: 'Login' },
      },
    };
  if (url.includes('/authenticationtrees/trees/'))
    return { data: { _id: url.split('/').pop() } };
  if (url.includes('agents?_action=getAllTypes'))
    return {
      data: { ...empty, result: [{ _id: 'WebAgent' }, { _id: 'AIAgent' }] },
    };
  if (url.includes('/agents/AIAgent?_queryFilter=true'))
    return {
      data: { ...empty, result: [{ _id: 'a' }, { _id: 'b' }], resultCount: 2 },
    };
  if (url.includes('/secrets/stores?_action=nextdescendents'))
    return {
      data: {
        ...empty,
        result: [
          {
            _id: 'ESV',
            _type: { _id: 'GoogleSecretManagerSecretStoreProvider' },
          },
          { _id: 'default-keystore', _type: { _id: 'KeyStoreSecretStore' } },
        ],
      },
    };
  if (
    url.includes(
      '/secrets/stores/GoogleSecretManagerSecretStoreProvider/ESV/mappings'
    )
  )
    return {
      data: {
        ...empty,
        result: [
          { _id: 'am.x', secretId: 'am.x', aliases: ['esv-x'] },
          { _id: 'am.y', secretId: 'am.y' },
        ],
      },
    };
  if (url.endsWith('/environment/secrets'))
    return { data: { ...empty, result: [{ _id: 'esv-x' }, { _id: 'esv-y' }] } };
  if (url.includes('/openidm/managed/alpha_aiagent?')) {
    return url.includes('_pagedResultsCookie=next')
      ? { data: { ...empty, result: [{ _id: '3' }] } }
      : {
          data: {
            ...empty,
            result: [{ _id: '1' }, { _id: '2' }],
            pagedResultsCookie: 'next',
          },
        };
  }
  return { data: { ...empty } };
}

const generate = () => ({
  get: async (url: string) => answer('GET', url),
  post: async (url: string, body?: unknown) => answer('POST', url, body),
  put: async (url: string, body?: unknown) => answer('PUT', url, body),
  patch: async (url: string, body?: unknown) => answer('PATCH', url, body),
  delete: async (url: string) => answer('DELETE', url),
  request: async (config: { method?: string; url: string }) =>
    answer((config.method ?? 'GET').toUpperCase(), config.url),
  defaults: { headers: { common: {} } },
  interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
});
jest.unstable_mockModule('../../../api/BaseApi', () => ({
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

const { default: State } = await import('../../../shared/State');
const { createAIAgentFeatureRepairTenant, createAIAgentFeatureTenant } =
  await import('./AIAgentFeatureTenant');

const HOST = 'https://tenant.example.com/am';
const CALLER_REALM = '/';

function newTenant() {
  const state = State({});
  state.setHost(HOST);
  state.setDeploymentType('cloud');
  state.setRealm(CALLER_REALM);
  currentState = state;
  return { state, tenant: createAIAgentFeatureTenant(state) };
}

beforeEach(() => {
  requests.length = 0;
  for (const key of Object.keys(refuse)) delete refuse[key];
});

describe('the reads that belong to the tenant', () => {
  test('the registry, the dry-run validate and the two configuration objects', async () => {
    const { tenant } = newTenant();
    expect(await tenant.readFeature()).toMatchObject({ installedVersion: '1' });
    expect(await tenant.validateFeature()).toMatchObject({
      failures: ['a', 'b'],
    });
    expect(await tenant.readManagedConfig()).toMatchObject({ _id: 'managed' });
    expect(await tenant.readRepoDs()).toMatchObject({ _id: 'repo.ds' });
    expect(
      requests.map(
        (request) =>
          `${request.method} ${request.url.replace(/^.*\/openidm/, '')}`
      )
    ).toEqual([
      'GET /feature/aiagent',
      'POST /feature/aiagent?_action=validate',
      'GET /config/managed',
      'GET /config/repo.ds',
    ]);
  });

  test('the ESV secret ids', async () => {
    const { tenant } = newTenant();
    expect(await tenant.readEsvSecretIds()).toEqual(['esv-x', 'esv-y']);
  });
});

describe('the reads that belong to a realm', () => {
  test('each runs on its realm, and the caller realm is back afterwards', async () => {
    const { state, tenant } = newTenant();
    await tenant.readProvider('alpha');
    await tenant.authServiceExists('bravo', 'Login');
    await tenant.readGate('alpha');
    await tenant.readSecretStoreMappings('bravo');
    await tenant.countIdmAgents('alpha');
    const byUrl = (part: string) =>
      requests.filter((request) => request.url.includes(part));
    expect(byUrl('/services/oauth-oidc')[0].url).toContain(
      '/realms/root/realms/alpha/'
    );
    expect(byUrl('/authenticationtrees/trees/Login')[0].url).toContain(
      '/realms/root/realms/bravo/'
    );
    expect(byUrl('getAllTypes')[0].url).toContain('/realms/root/realms/alpha/');
    expect(byUrl('/secrets/stores')[0].url).toContain(
      '/realms/root/realms/bravo/'
    );
    // the state was on the requested realm while the request went out
    expect(byUrl('/services/oauth-oidc')[0].realm).toBe('alpha');
    expect(byUrl('/authenticationtrees/trees/Login')[0].realm).toBe('bravo');
    expect(state.getRealm()).toBe(CALLER_REALM);
  });

  test('the caller realm is back after a request failed', async () => {
    const { state, tenant } = newTenant();
    refuse['/services/oauth-oidc'] = 500;
    await expect(tenant.readProvider('alpha')).rejects.toMatchObject({
      response: { status: 500 },
    });
    expect(state.getRealm()).toBe(CALLER_REALM);
    refuse['getAllTypes'] = new Error('socket hang up');
    await expect(tenant.readGate('bravo')).rejects.toThrow('socket hang up');
    expect(state.getRealm()).toBe(CALLER_REALM);
  });

  test('a realm without a provider reads undefined, any other failure throws', async () => {
    const { tenant } = newTenant();
    refuse['/services/oauth-oidc'] = 404;
    expect(await tenant.readProvider('bravo')).toBeUndefined();
    refuse['/services/oauth-oidc'] = 403;
    await expect(tenant.readProvider('bravo')).rejects.toBeDefined();
  });

  test('an authentication tree that does not exist reads false, any other failure throws', async () => {
    const { tenant } = newTenant();
    expect(await tenant.authServiceExists('alpha', 'Login')).toBe(true);
    refuse['/trees/Login'] = 404;
    expect(await tenant.authServiceExists('alpha', 'Login')).toBe(false);
    refuse['/trees/Login'] = 500;
    await expect(
      tenant.authServiceExists('alpha', 'Login')
    ).rejects.toBeDefined();
  });

  test('an open gate lists the type and answers 200 with the number of agents', async () => {
    const { tenant } = newTenant();
    expect(await tenant.readGate('alpha')).toEqual({
      typeListed: true,
      listStatus: 200,
      agentCount: 2,
    });
  });

  test('a closed gate is an answer: the list is refused with 501', async () => {
    const { tenant } = newTenant();
    refuse['/agents/AIAgent'] = 501;
    expect(await tenant.readGate('alpha')).toEqual({
      typeListed: true,
      listStatus: 501,
      agentCount: null,
    });
  });

  test('a list that gets no answer at all throws: it is not a closed gate', async () => {
    const { tenant } = newTenant();
    refuse['/agents/AIAgent'] = new Error('socket hang up');
    await expect(tenant.readGate('alpha')).rejects.toThrow('socket hang up');
  });

  test('only secret stores backed by ESV secrets are read, and a mapping without aliases has an empty list', async () => {
    const { tenant } = newTenant();
    const stores = await tenant.readSecretStoreMappings('alpha');
    expect(stores).toEqual([
      {
        storeId: 'ESV',
        storeTypeId: 'GoogleSecretManagerSecretStoreProvider',
        mappings: [
          { secretId: 'am.x', aliases: ['esv-x'] },
          { secretId: 'am.y', aliases: [] },
        ],
      },
    ]);
    expect(
      requests.some((request) => request.url.includes('default-keystore'))
    ).toBe(false);
  });

  test('the IDM agents are counted over all pages', async () => {
    const { tenant } = newTenant();
    expect(await tenant.countIdmAgents('alpha')).toBe(3);
    expect(
      requests.filter((request) =>
        request.url.includes('/managed/alpha_aiagent?')
      )
    ).toHaveLength(2);
  });
});

describe('the writes of the repair', () => {
  function newRepairTenant() {
    const state = State({});
    state.setHost(HOST);
    state.setDeploymentType('cloud');
    state.setRealm(CALLER_REALM);
    currentState = state;
    return { state, tenant: createAIAgentFeatureRepairTenant(state) };
  }

  test('the whole managed and repo.ds configuration is written with PUT', async () => {
    const { tenant } = newRepairTenant();
    await tenant.putManagedConfig({ _id: 'managed', objects: [{ name: 'a' }] });
    await tenant.putRepoDs({ _id: 'repo.ds', resourceMapping: {} });
    expect(
      requests.map(
        (request) =>
          `${request.method} ${request.url.replace(/^.*\/openidm/, '')}`
      )
    ).toEqual(['PUT /config/managed', 'PUT /config/repo.ds']);
    expect(requests[0].body).toEqual({
      _id: 'managed',
      objects: [{ name: 'a' }],
    });
  });

  test('a provider is written to its realm without _id and _rev, and the caller realm is back', async () => {
    const { state, tenant } = newRepairTenant();
    const input = {
      _id: '',
      _rev: '-5',
      advancedOAuth2Config: { passwordGrantAuthService: 'Login' },
    } as never;
    await tenant.putProvider('bravo', input);
    const put = requests.find((request) => request.method === 'PUT')!;
    expect(put.url).toContain(
      '/realms/root/realms/bravo/realm-config/services/oauth-oidc'
    );
    expect(put.realm).toBe('bravo');
    expect(put.body).toEqual({
      advancedOAuth2Config: { passwordGrantAuthService: 'Login' },
    });
    // the object the caller passed in is not changed
    expect((input as any)._id).toBe('');
    expect(state.getRealm()).toBe(CALLER_REALM);
  });

  test('the caller realm is back after a failed write', async () => {
    const { state, tenant } = newRepairTenant();
    refuse['/services/oauth-oidc'] = 400;
    await expect(
      tenant.putProvider('alpha', {} as never)
    ).rejects.toMatchObject({ response: { status: 400 } });
    expect(state.getRealm()).toBe(CALLER_REALM);
    refuse['/mappings/'] = 500;
    await expect(
      tenant.deleteSecretMapping(
        'bravo',
        'ESV',
        'GoogleSecretManagerSecretStoreProvider',
        'am.x'
      )
    ).rejects.toBeDefined();
    expect(state.getRealm()).toBe(CALLER_REALM);
  });

  test('the template of a realm is the one the server answers to the template action', async () => {
    const { tenant } = newRepairTenant();
    const template = await tenant.readProviderTemplate('bravo');
    expect(template).toMatchObject({
      advancedOAuth2Config: { supportedScopes: [] },
    });
    const post = requests.find((request) => request.method === 'POST')!;
    expect(post.url).toContain(
      '/realms/root/realms/bravo/realm-config/services/oauth-oidc?_action=template'
    );
  });

  test('a secret store mapping is deleted from the ESV store of the realm', async () => {
    const { tenant } = newRepairTenant();
    await tenant.deleteSecretMapping(
      'alpha',
      'ESV',
      'GoogleSecretManagerSecretStoreProvider',
      'am.test.one'
    );
    const del = requests.find((request) => request.method === 'DELETE')!;
    expect(del.url).toContain('/realms/root/realms/alpha/');
    expect(del.url).toContain(
      '/secrets/stores/GoogleSecretManagerSecretStoreProvider/ESV/mappings/am.test.one'
    );
    expect(del.realm).toBe('alpha');
  });

  test('the enable action is POST /environment/aiagent?_action=enable', async () => {
    const { tenant } = newRepairTenant();
    await tenant.enableFeature();
    expect(requests.find((request) => request.method === 'POST')!.url).toBe(
      'https://tenant.example.com/environment/aiagent?_action=enable'
    );
  });

  test('all IDM objects of a type are read over all pages with every field', async () => {
    const { tenant } = newRepairTenant();
    expect(await tenant.readIdmObjects('alpha_aiagent')).toHaveLength(3);
    expect(requests.some((request) => request.url.includes('_fields=*'))).toBe(
      true
    );
  });
});
