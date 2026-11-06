import { jest } from '@jest/globals';

// The real operations build the real urls; only the HTTP client is replaced by
// one that records the url and the state of each request.
const requests: { url: string; state: any }[] = [];

const actualBaseApi = await import('../api/BaseApi');
jest.unstable_mockModule('../api/BaseApi', () => ({
  ...actualBaseApi,
  generateIdmApi: ({ state }: { state: any }) => ({
    get: async (url: string) => {
      requests.push({ url, state });
      return { data: { _id: 'managed' } };
    },
  }),
}));

const { FrodoLib } = await import('./FrodoLib');

const SENDING = 'https://openam-sending.example.com';

function instance() {
  return FrodoLib({
    host: `${SENDING}/am`,
    realm: 'alpha',
    deploymentType: 'cloud',
  });
}

beforeEach(() => {
  requests.length = 0;
});

describe('createRemoteProxyView()', () => {
  it('makes the IDM operations of the view through the remote proxy and leaves the instance alone', async () => {
    const frodo = instance();
    const view = frodo.createRemoteProxyView('receiving');
    await frodo.idm.config.readConfigEntity('managed');
    await view.idm.config.readConfigEntity('managed');
    await frodo.idm.config.readConfigEntity('managed');
    const [local1, remote, local2] = requests.map((r) => r.url);
    expect(remote).toBe(
      local1.replace('/openidm/', '/openidm/external/idm/receiving/')
    );
    expect(
      remote.startsWith(`${SENDING}/openidm/external/idm/receiving/`)
    ).toBe(true);
    expect(local1.startsWith(`${SENDING}/openidm/config/`)).toBe(true);
    expect(local2).toBe(local1);
  });

  it('keeps the instance and several views apart when they run at the same time', async () => {
    const frodo = instance();
    const one = frodo.createRemoteProxyView('one');
    const two = frodo.createRemoteProxyView('two');
    await Promise.all([
      one.idm.config.readConfigEntity('managed'),
      frodo.idm.config.readConfigEntity('managed'),
      two.idm.config.readConfigEntity('managed'),
      one.idm.config.readConfigEntity('sync'),
    ]);
    const byPath = requests.map((r) => r.url.replace(SENDING, ''));
    expect(byPath.sort()).toEqual(
      [
        '/openidm/config/managed',
        '/openidm/external/idm/one/config/managed',
        '/openidm/external/idm/one/config/sync',
        '/openidm/external/idm/two/config/managed',
      ].sort()
    );
  });

  it('uses the login of the instance, also after it is refreshed', async () => {
    const frodo = instance();
    const view = frodo.createRemoteProxyView('receiving');
    frodo.state.setBearerTokenMeta({
      access_token: 'first',
      expires_in: 3600,
    } as any);
    await view.idm.config.readConfigEntity('managed');
    const viewState = requests[0].state;
    expect(viewState.getBearerToken()).toBe('first');
    frodo.state.setBearerTokenMeta({
      access_token: 'refreshed',
      expires_in: 3600,
    } as any);
    expect(viewState.getBearerToken()).toBe('refreshed');
  });

  it('follows the host of the instance', async () => {
    const frodo = instance();
    const view = frodo.createRemoteProxyView('receiving');
    frodo.state.setHost('https://openam-moved.example.com/am');
    await view.idm.config.readConfigEntity('managed');
    expect(requests[0].url).toBe(
      'https://openam-moved.example.com/openidm/external/idm/receiving/config/managed'
    );
  });

  it.each(['a/b', '..', 'a?x=1', 'a%2Fb', 'a b', ''])(
    'refuses the name %j when the view is created, before any request',
    (name) => {
      const frodo = instance();
      expect(() => frodo.createRemoteProxyView(name)).toThrow('is not allowed');
      expect(requests).toHaveLength(0);
    }
  );

  it('creates a view for the names a tenant can have', () => {
    const frodo = instance();
    for (const name of ['receiving', 'volker-dev', 'Tenant_1', 'my.tenant']) {
      expect(frodo.createRemoteProxyView(name).proxyId).toBe(name);
    }
  });

  it('holds the name of the proxy and the IDM operations, nothing else', () => {
    const view = instance().createRemoteProxyView('receiving');
    expect(Object.keys(view).sort()).toEqual(['idm', 'proxyId']);
    expect(view.proxyId).toBe('receiving');
    expect(Object.keys(view.idm).sort()).toEqual(
      Object.keys(instance().idm).sort()
    );
  });
});
