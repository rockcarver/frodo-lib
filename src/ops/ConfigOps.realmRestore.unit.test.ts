/**
 * Unit tests for the active realm after a full configuration export or import.
 *
 * Run with:
 *
 *        npm run test:only ConfigOps.realmRestore
 *
 * Origin: frodo-lib#838. `exportFullConfiguration` and `importFullConfiguration`
 * switch the active realm for each realm of the configuration and put the
 * caller's realm back afterwards. Without a result callback the first failed
 * request is rethrown, which ended the function inside the loop and left the
 * state on the realm that was being processed; every later call on the same
 * state then went to the wrong realm.
 *
 * The tests replace the HTTP layer (`BaseApi`) with a fake tenant that answers
 * 200 with an empty result for everything except the one request named by
 * `failOn`, which answers 500. No recording and no tenant is needed. A
 * classic deployment keeps the fake small: it has no IDM or telemetry calls,
 * so the first failure happens in the realm loop and not before it.
 */
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';

const requests: string[] = [];
// the URL part of a request that answers 500; empty for none
let failOn = '';

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

function serverError(url: string): AxiosError {
  return new AxiosError(
    'Request failed with status code 500',
    'ERR_BAD_RESPONSE',
    { url } as never,
    undefined,
    {
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      config: {} as never,
      data: { code: 500, reason: 'Internal Server Error', message: 'failed' },
    }
  );
}

function answer(method: string, url: string) {
  requests.push(`${method} ${url}`);
  if (failOn && url.includes(failOn)) throw serverError(url);
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
// the realm the caller works in, and the realm whose request fails
const CALLER_REALM = '/bravo';
const FAILING_REALM_PATH = '/realms/alpha/scripts';

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

// one script for the alpha realm: its import is the request that fails
const importData = {
  meta: {},
  global: {},
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
        },
      },
    },
  },
};

const failedInAlpha = () =>
  requests.filter((request) => request.includes(FAILING_REALM_PATH));

beforeEach(() => {
  requests.length = 0;
  failOn = FAILING_REALM_PATH;
});

describe('exportFullConfiguration', () => {
  test('puts the caller realm back when a request fails and there is no result callback', async () => {
    const state = newState();
    await expect(
      exportFullConfiguration({
        options: { ...exportOptions },
        resultCallback: undefined,
        state,
      })
    ).rejects.toMatchObject({ message: 'Error Exporting Scripts' });
    // the failure happened in the alpha realm, inside the loop
    expect(failedInAlpha()).toHaveLength(1);
    expect(state.getRealm()).toBe(CALLER_REALM);
  });

  test('puts the caller realm back when the errors go to a result callback', async () => {
    const state = newState();
    const reported: string[] = [];
    await exportFullConfiguration({
      options: { ...exportOptions },
      resultCallback: (error) => {
        if (error) reported.push(error.message);
      },
      state,
    });
    expect(reported).toContain('Error Exporting Scripts');
    expect(state.getRealm()).toBe(CALLER_REALM);
  });
});

describe('importFullConfiguration', () => {
  test('puts the caller realm back when a request fails and there is no result callback', async () => {
    const state = newState();
    await expect(
      importFullConfiguration({
        importData: importData as never,
        options: { ...importOptions },
        resultCallback: undefined,
        state,
      })
    ).rejects.toMatchObject({ message: 'Error Importing Scripts' });
    // the failure happened in the alpha realm, inside the loop
    expect(failedInAlpha().length).toBeGreaterThan(0);
    expect(state.getRealm()).toBe(CALLER_REALM);
  });

  test('puts the caller realm back when the errors go to a result callback', async () => {
    const state = newState();
    const reported: string[] = [];
    await importFullConfiguration({
      importData: importData as never,
      options: { ...importOptions },
      resultCallback: (error) => {
        if (error) reported.push(error.message);
      },
      state,
    });
    expect(reported).toContain('Error updating alpha realm script');
    expect(state.getRealm()).toBe(CALLER_REALM);
  });

  test('leaves the caller realm alone when nothing fails', async () => {
    failOn = '';
    const state = newState();
    await importFullConfiguration({
      importData: importData as never,
      options: { ...importOptions },
      resultCallback: undefined,
      state,
    });
    expect(failedInAlpha().length).toBeGreaterThan(0);
    expect(state.getRealm()).toBe(CALLER_REALM);
  });
});
