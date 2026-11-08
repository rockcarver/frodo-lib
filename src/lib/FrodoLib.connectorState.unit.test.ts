import { jest } from '@jest/globals';

/**
 * The connector and application functions that read and switch the enabled
 * state are reachable on the `frodo` facade, and the real operations build the
 * requests the Admin UI sends. Only the HTTP client is replaced by one that
 * records the method, the url and the body of each request.
 * Mocked unit test: no recordings.
 */

type Recorded = { method: string; url: string; body?: unknown };
const requests: Recorded[] = [];

/** what the fake tenant answers, by "METHOD path" (the path starts after /openidm) */
let answers: Record<string, any[]>;

function answer(method: string, url: string, body?: unknown) {
  requests.push({ method, url, body });
  const path = url.replace(/^.*\/openidm/, '');
  const key = `${method} ${path}`;
  const queue = answers[key];
  if (!queue || queue.length === 0) {
    throw Object.assign(new Error(`no answer for ${key}`), {
      response: { status: 404 },
    });
  }
  const next = queue.length > 1 ? queue.shift() : queue[0];
  if (next instanceof Error) throw next;
  return { data: next };
}

const actualBaseApi = await import('../api/BaseApi');
jest.unstable_mockModule('../api/BaseApi', () => ({
  ...actualBaseApi,
  generateIdmApi: () => ({
    get: async (url: string) => answer('GET', url),
    post: async (url: string, body?: unknown) => answer('POST', url, body),
    patch: async (url: string, body?: unknown) => answer('PATCH', url, body),
  }),
}));

const { FrodoLib } = await import('./FrodoLib');

const frodo = FrodoLib({
  host: 'https://openam-sending.example.com/am',
  realm: 'alpha',
  deploymentType: 'cloud',
});

/** "METHOD path" of every request, without the host */
const sent = () =>
  requests.map(
    ({ method, url }) => `${method} ${url.replace(/^.*\/openidm/, '')}`
  );

beforeEach(() => {
  requests.length = 0;
  answers = {};
});

describe('frodo.idm.connector', () => {
  test('disableConnector reads the connector and sends one patch of /enabled that waits for completion', async () => {
    answers['GET /config/provisioner.openicf/Entra'] = [
      { _id: 'provisioner.openicf/Entra', enabled: true },
    ];
    answers['PATCH /config/provisioner.openicf/Entra?waitForCompletion=true'] =
      [{ _id: 'provisioner.openicf/Entra', enabled: false }];
    const result = await frodo.idm.connector.disableConnector('Entra');
    expect(sent()).toEqual([
      'GET /config/provisioner.openicf/Entra',
      'PATCH /config/provisioner.openicf/Entra?waitForCompletion=true',
    ]);
    expect(requests[1].body).toEqual([
      { operation: 'replace', field: '/enabled', value: false },
    ]);
    expect(result).toMatchObject({ enabled: false, changed: true });
  });

  test('enableConnector patches true and repeats the connection test until it answers ok', async () => {
    answers['GET /config/provisioner.openicf/Entra'] = [
      { _id: 'provisioner.openicf/Entra', enabled: false },
    ];
    answers['PATCH /config/provisioner.openicf/Entra?waitForCompletion=true'] =
      [{ _id: 'provisioner.openicf/Entra', enabled: true }];
    answers['POST /system/Entra?_action=test'] = [
      { enabled: true, ok: false, error: 'connector not available' },
      { enabled: true, ok: true },
    ];
    const result = await frodo.idm.connector.enableConnector('Entra', {
      interval: 1,
    });
    expect(sent()).toEqual([
      'GET /config/provisioner.openicf/Entra',
      'PATCH /config/provisioner.openicf/Entra?waitForCompletion=true',
      'POST /system/Entra?_action=test',
      'POST /system/Entra?_action=test',
    ]);
    expect(requests[1].body).toEqual([
      { operation: 'replace', field: '/enabled', value: true },
    ]);
    expect(result).toMatchObject({
      enabled: true,
      changed: true,
      ready: true,
    });
  });

  test('isConnectorEnabled and readConnectorEnabledStates', async () => {
    answers['GET /config/provisioner.openicf/Entra'] = [
      { _id: 'provisioner.openicf/Entra', enabled: false },
    ];
    expect(await frodo.idm.connector.isConnectorEnabled('Entra')).toBe(false);

    const filter = encodeURIComponent("_id sw 'provisioner.openicf'");
    answers[`GET /config?_queryFilter=${filter}&_fields=enabled`] = [
      {
        result: [
          { _id: 'provisioner.openicf.connectorinfoprovider' },
          { _id: 'provisioner.openicf/Entra', enabled: false },
          { _id: 'provisioner.openicf/Workday', enabled: true },
        ],
      },
    ];
    expect(await frodo.idm.connector.readConnectorEnabledStates()).toEqual({
      Entra: false,
      Workday: true,
    });
  });
});

describe('frodo.app', () => {
  const entra = { _id: 'app-entra', name: 'Entra', connectorId: 'Entra' };
  const bookmark = { _id: 'app-bookmark', name: 'Bookmark' };

  test('readApplicationStatuses reads the applications once and the connector states in one request', async () => {
    answers[
      'GET /managed/alpha_application?_queryFilter=true&_pageSize=1000&_fields=authoritative,connectorId,description,icon,mappingNames,name,ssoEntities,templateName,templateVersion,uiConfig,url'
    ] = [{ result: [bookmark, entra], pagedResultsCookie: null }];
    const filter = encodeURIComponent("_id sw 'provisioner.openicf'");
    answers[`GET /config?_queryFilter=${filter}&_fields=enabled`] = [
      { result: [{ _id: 'provisioner.openicf/Entra', enabled: false }] },
    ];
    const statuses = await frodo.app.readApplicationStatuses();
    expect(sent().filter((r) => r.includes('/config?')).length).toBe(1);
    expect(sent().filter((r) => r.includes('/managed/')).length).toBe(1);
    expect(statuses).toEqual([
      {
        applicationId: 'app-bookmark',
        applicationName: 'Bookmark',
        status: 'none',
      },
      {
        applicationId: 'app-entra',
        applicationName: 'Entra',
        connectorId: 'Entra',
        status: 'inactive',
      },
    ]);
  });

  test('disableApplication reaches the connector of the application', async () => {
    answers[
      'GET /managed/alpha_application/app-entra?_fields=authoritative,connectorId,description,icon,mappingNames,name,ssoEntities,templateName,templateVersion,uiConfig,url'
    ] = [entra];
    answers['GET /config/provisioner.openicf/Entra'] = [
      { _id: 'provisioner.openicf/Entra', enabled: true },
    ];
    answers['PATCH /config/provisioner.openicf/Entra?waitForCompletion=true'] =
      [{ _id: 'provisioner.openicf/Entra', enabled: false }];
    const result = await frodo.app.disableApplication('app-entra');
    expect(sent().slice(-1)).toEqual([
      'PATCH /config/provisioner.openicf/Entra?waitForCompletion=true',
    ]);
    expect(result).toEqual({
      applicationId: 'app-entra',
      applicationName: 'Entra',
      connectorId: 'Entra',
      status: 'inactive',
      changed: true,
    });
  });
});
