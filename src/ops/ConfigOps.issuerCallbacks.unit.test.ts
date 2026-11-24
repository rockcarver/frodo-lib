/**
 * Unit tests for the per-issuer reporting of a full configuration import.
 *
 * Run with:
 *
 *        npm run test:only ConfigOps.issuerCallbacks
 *
 * The tests replace the HTTP layer (`BaseApi`) with a fake tenant that answers
 * 200 with an empty result, records the requests and fails the write of one
 * trusted JWT issuer. A classic deployment with the realms `/` and `alpha`
 * keeps it small; no recording, no tenant.
 */
import { jest } from '@jest/globals';

const requests: string[] = [];
const FAILING_ISSUER = 'matrix-failing';
const realms = [
  { _id: 'L3Jvb3Q', name: '/', parentPath: null, active: true },
  { _id: 'YWxwaGE', name: 'alpha', parentPath: '/', active: true },
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
  if (method === 'PUT' && url.includes(`/TrustedJwtIssuer/${FAILING_ISSUER}`)) {
    throw { response: { status: 500, data: { message: 'Server Error' } } };
  }
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
const { importFullConfiguration } = await import('./ConfigOps');

const HOST = 'https://tenant.example.com/am';

function newState() {
  const state = State({});
  state.setHost(HOST);
  state.setDeploymentType('classic');
  state.setRealm('/alpha');
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

function issuer(id: string) {
  return {
    _id: id,
    _type: {
      _id: 'TrustedJwtIssuer',
      name: 'OAuth2 Trusted JWT Issuer',
      collection: true,
    },
    issuer: `https://idp-${id}.matrix.example.com`,
    allowedSubjects: ['neo'],
  };
}

// two issuers (one of them is refused by the tenant) and one OAuth2 client,
// which is imported after the issuers
const importData = {
  meta: {},
  global: {},
  realm: {
    'root-alpha': {
      trustedJwtIssuer: {
        [FAILING_ISSUER]: issuer(FAILING_ISSUER),
        'matrix-working': issuer('matrix-working'),
      },
      application: { c1: { _id: 'c1', coreOAuth2ClientConfig: {} } },
    },
  },
};

const paths = () =>
  requests.map((r) => r.replace(HOST, '').replace(/\?.*/, ''));
const ISSUER_PUTS = [
  `PUT /json/realms/root/realms/alpha/realm-config/agents/TrustedJwtIssuer/${FAILING_ISSUER}`,
  'PUT /json/realms/root/realms/alpha/realm-config/agents/TrustedJwtIssuer/matrix-working',
];
const CLIENT_PUT =
  'PUT /json/realms/root/realms/alpha/realm-config/agents/OAuth2Client/c1';

beforeEach(() => {
  requests.length = 0;
});

describe('importFullConfiguration with trusted JWT issuers', () => {
  test('with a result callback a failed issuer is reported as an error of its own, once, and the rest is still imported', async () => {
    const errors: string[] = [];

    await importFullConfiguration({
      importData: importData as never,
      options: importOptions as never,
      resultCallback: (error) => {
        if (error) errors.push(error.message);
      },
      state: newState(),
    });

    // one error, naming the issuer (not the whole "Trusted JWT Issuers" section)
    expect(errors).toEqual([
      `Error importing alpha realm trusted issuer ${FAILING_ISSUER}`,
    ]);
    // both issuers were tried once and the client after them was imported
    expect(paths().filter((p) => ISSUER_PUTS.includes(p))).toEqual(ISSUER_PUTS);
    expect(paths()).toContain(CLIENT_PUT);
  });

  test('without a result callback the section fails as before: one error for the section', async () => {
    const error = await importFullConfiguration({
      importData: importData as never,
      options: importOptions as never,
      resultCallback: undefined,
      state: newState(),
    }).then(
      () => {
        throw new Error('expected a rejection');
      },
      (e) => e
    );

    expect(error.message).toBe('Error Importing Trusted JWT Issuers');
    // every issuer was tried before the section failed
    expect(paths().filter((p) => ISSUER_PUTS.includes(p))).toEqual(ISSUER_PUTS);
  });
});
