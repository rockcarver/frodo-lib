/**
 * Unit tests for the script types of a full configuration export.
 *
 * Run with:
 *
 *        npm run test:only ConfigOps.scriptTypeExport
 *
 * A script type whose engine configuration or context cannot be read is a failed
 * script type that is named, not a line that is printed and swallowed. With a
 * result callback the export reports that one script type as an error of its own,
 * once, and keeps the script types that could be read. Without one the section
 * fails: one error for the section, as for the other sections.
 *
 * The tests replace the HTTP layer (`BaseApi`) with a fake classic tenant that lists
 * three script types, refuses the context of one of them and answers 200 with an
 * empty result to everything else. No recording, no tenant.
 */
import { jest } from '@jest/globals';

const requests: string[] = [];
const FAILING = 'FAILING_CONTEXT';
const SCRIPT_TYPES = ['FIRST_TYPE', FAILING, 'THIRD_TYPE'];
const empty = {
  result: [],
  resultCount: 0,
  pagedResultsCookie: null,
  totalPagedResults: 0,
  remainingPagedResults: 0,
};

function answer(method: string, url: string) {
  requests.push(`${method} ${url}`);
  if (
    method === 'GET' &&
    url.endsWith('/scripting/contexts?_queryFilter=true')
  ) {
    return {
      data: {
        ...empty,
        result: SCRIPT_TYPES.map((_id) => ({ _id })),
        resultCount: SCRIPT_TYPES.length,
      },
    };
  }
  if (method === 'GET' && url.endsWith(`/json/contexts/${FAILING}`)) {
    throw { response: { status: 500, data: { message: 'Server Error' } } };
  }
  if (method === 'GET' && url.includes('/json/contexts/')) {
    return { data: { name: url.split('/').pop() } };
  }
  if (method === 'GET' && url.endsWith('/engineConfiguration')) {
    return { data: { maxThreads: 1 } };
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
const { exportFullConfiguration } = await import('./ConfigOps');

function newState() {
  const state = State({});
  state.setHost('https://tenant.example.com/am');
  state.setDeploymentType('classic');
  state.setRealm('/alpha');
  return state;
}

const exportOptions = {
  useStringArrays: true,
  noDecode: false,
  coords: true,
  includeDefault: false,
  includeActiveValues: true,
  target: '',
  includeReadOnly: false,
  onlyRealm: false,
  onlyGlobal: true,
  onlyCustom: false,
  includeStatic: true,
  includeDynamic: true,
};

beforeEach(() => {
  requests.length = 0;
});

describe('exportFullConfiguration with script types', () => {
  test('with a result callback a failed script type is reported as an error of its own, once, and the others are exported', async () => {
    const errors: string[] = [];

    const result = await exportFullConfiguration({
      options: exportOptions,
      resultCallback: (error) => {
        if (error) errors.push(error.message);
      },
      state: newState(),
    });

    expect(Object.keys(result.global.scripttype)).toEqual([
      'FIRST_TYPE',
      'THIRD_TYPE',
    ]);
    // one error, naming the script type (not the whole "Script Types" section)
    expect(errors.filter((message) => message.includes('script type'))).toEqual(
      [`Error exporting script type ${FAILING}`]
    );
    expect(
      errors.filter((message) => message.includes('Script Types'))
    ).toEqual([]);
  });

  test('without a result callback the section fails: one error for the section, after every script type was tried', async () => {
    const error = await exportFullConfiguration({
      options: exportOptions,
      resultCallback: undefined,
      state: newState(),
    }).then(
      () => undefined,
      (e) => e
    );

    expect(error).toBeDefined();
    expect(error.message).toBe('Error Exporting Script Types');
    expect(error.originalErrors[0].message).toBe('Error exporting scriptTypes');
    expect(
      error.originalErrors[0].originalErrors.map((e: Error) => e.message)
    ).toEqual([`Error exporting script type ${FAILING}`]);
    // the failed script type did not stop the next one
    const contexts = requests
      .filter((request) => request.includes('/json/contexts/'))
      .map((request) => request.split('/').pop());
    expect(contexts).toEqual(SCRIPT_TYPES);
  });
});
