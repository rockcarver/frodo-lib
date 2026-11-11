/**
 * Unit tests for the answer "This operation is not available in PingOne Advanced Identity Cloud." (HTTP 403) in
 * Saml2Ops: where it is skipped without a word, and which failures stay failures.
 *
 * Three places of the module know this answer, and all of them receive the error that the api layer raises, an
 * AxiosError with the response of the server in `response.status` and `response.data.message`:
 *
 * - readSaml2ProviderStubs() answers an empty list,
 * - readSaml2EntityIds() answers an empty list,
 * - exportSaml2Providers() skips the provider that answered so and goes on with the others.
 *
 * A raw AxiosError has no `httpStatus` and no `httpMessage` (FrodoError copies them from its immediate original
 * error, the AxiosError itself does not have them), so a test of `error.httpStatus === 403` never matches it. These
 * tests use real AxiosErrors, as the api layer raises them, and fake only the api layer.
 *
 * Any other answer is a failure: it is thrown, with the cause nested. The status and the message must both match.
 *
 * Run with:
 *
 *        npm run test:only Saml2Ops.notAvailableAnswer
 *
 * Origin: frodo-lib#957 (bulk exports and imports report per item). No recording and no tenant is needed. All values
 * are made up.
 */
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';
import State from '../shared/State';
import { FrodoError } from './FrodoError';

const NOT_AVAILABLE =
  'This operation is not available in PingOne Advanced Identity Cloud.';
const HOST = 'https://am.example.com/am';
const STUBS_URL = `${HOST}/json/realms/root/realms/alpha/realm-config/saml2?_queryFilter=true`;
const providerUrl = (id: string) =>
  `${HOST}/json/realms/root/realms/alpha/realm-config/saml2/hosted/${id}`;
const METADATA_URL = `${HOST}/saml2/jsp/exportmetadata.jsp?entityid=https%3A%2F%2Fsp2.example.com&realm=alpha`;

/** The answer of the server, as the api layer raises it: an AxiosError that carries the response. */
function axiosAnswer(
  url: string,
  status: number,
  data: object | null
): AxiosError {
  const error = new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST'
  );
  error.config = { url, method: 'get' } as AxiosError['config'];
  error.response = { status, data } as AxiosError['response'];
  return error;
}

const notAvailable = (url: string) =>
  axiosAnswer(url, 403, { code: 403, message: NOT_AVAILABLE });

/** An AxiosError without a response: the server was not reached. */
function networkError(url: string): AxiosError {
  const error = new AxiosError('connect ECONNRESET', 'ECONNRESET');
  error.config = { url, method: 'get' } as AxiosError['config'];
  return error;
}

const entityIds = [
  'https://sp1.example.com',
  'https://sp2.example.com',
  'https://sp3.example.com',
];
/** the id of a provider is its base64url entity id */
const idOf = (entityId: string) => Buffer.from(entityId).toString('base64url');

const getProviderStubs = jest.fn(async (_args?: unknown): Promise<unknown> => ({
  result: [],
}));
const getProvider = jest.fn(async (_args?: unknown): Promise<unknown> => ({}));
const getProviderMetadata = jest.fn(
  async (_args?: unknown): Promise<unknown> => '<EntityDescriptor/>'
);

jest.unstable_mockModule('../api/Saml2Api', () => ({
  createProvider: jest.fn(),
  deleteProvider: jest.fn(),
  getProvider,
  getProviderMetadata,
  getProviderMetadataUrl: jest.fn(() => `${HOST}/saml2/jsp/exportmetadata.jsp`),
  getProviderStubs,
  queryProviderStubs: jest.fn(),
  updateProvider: jest.fn(),
}));

const { exportSaml2Providers, readSaml2EntityIds, readSaml2ProviderStubs } =
  await import('./Saml2Ops');

const state = State({});
const debug = jest.fn();
const debugLines = () => debug.mock.calls.map(([message]) => String(message));
/** The debug lines that name the skip of a "not available" answer. */
const skipLines = () => debugLines().filter((line) => line.includes('skipped'));

/** Three hosted providers; each answers with its own data unless `failing` says otherwise. */
function serveProviders(failing: Record<string, Error> = {}) {
  getProviderStubs.mockResolvedValue({
    result: entityIds.map((entityId) => ({
      _id: idOf(entityId),
      entityId,
      location: 'hosted',
      roles: [],
    })),
  });
  getProvider.mockImplementation(async (args: unknown) => {
    const { entityId64 } = args as { entityId64: string };
    if (failing[entityId64]) throw failing[entityId64];
    const entityId = entityIds.find((id) => idOf(id) === entityId64);
    return { _id: entityId64, entityId, identityProvider: {} };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  getProviderStubs.mockReset();
  getProvider.mockReset();
  getProviderMetadata.mockReset();
  getProviderMetadata.mockImplementation(
    async (args: unknown) =>
      `<EntityDescriptor entityID="${(args as { entityId: string }).entityId}"/>`
  );
  state.setRealm('alpha');
  state.setDeploymentType('cloud');
  state.setDebugHandler(debug);
});

afterEach(() => {
  state.setDebugHandler(undefined);
});

/** Run a call that is expected to throw, and return what it threw. */
async function thrownBy(call: () => Promise<unknown>): Promise<FrodoError> {
  try {
    await call();
  } catch (error) {
    return error as FrodoError;
  }
  throw new Error('expected the call to throw, but it returned');
}

/** The answers that must stay failures, with a name. The first one has the right message but not the right status. */
const FAILING_ANSWERS: [string, (url: string) => Error][] = [
  [
    'a 500 with the "not available" message',
    (url) => axiosAnswer(url, 500, { code: 500, message: NOT_AVAILABLE }),
  ],
  [
    'a 404 with the "not available" message',
    (url) => axiosAnswer(url, 404, { code: 404, message: NOT_AVAILABLE }),
  ],
  [
    'a 401 with the "not available" message',
    (url) => axiosAnswer(url, 401, { code: 401, message: NOT_AVAILABLE }),
  ],
  [
    'a 400 with the "not available" message',
    (url) => axiosAnswer(url, 400, { code: 400, message: NOT_AVAILABLE }),
  ],
  [
    'a 403 with another message',
    (url) => axiosAnswer(url, 403, { code: 403, message: 'Forbidden' }),
  ],
  [
    'a 403 with a message that only starts like the "not available" one',
    (url) =>
      axiosAnswer(url, 403, {
        code: 403,
        message: NOT_AVAILABLE.replace(/\.$/, ''),
      }),
  ],
  ['a 403 without a message', (url) => axiosAnswer(url, 403, { code: 403 })],
  ['a 403 without a body', (url) => axiosAnswer(url, 403, null)],
  ['a 500 without a body', (url) => axiosAnswer(url, 500, null)],
  ['a network error', (url) => networkError(url)],
  ['an error without any http field', () => new Error('boom')],
];

describe('readSaml2EntityIds()', () => {
  test('answers the entity ids of the providers', async () => {
    serveProviders();

    expect(await readSaml2EntityIds({ state })).toEqual(entityIds);
    expect(skipLines()).toEqual([]);
  });

  test('answers an empty list when the tenant answers 403 "not available in PingOne Advanced Identity Cloud": nothing is thrown, a debug message names the operation and the request', async () => {
    getProviderStubs.mockRejectedValue(notAvailable(STUBS_URL));

    expect(await readSaml2EntityIds({ state })).toEqual([]);

    const lines = skipLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Saml2Ops.readSaml2EntityIds: skipped');
    expect(lines[0]).toContain('PingOne Advanced Identity Cloud');
    expect(lines[0]).toContain(`[GET ${STUBS_URL}]`);
  });

  test('the skip leaves no debug message at all when the state has no debug handler', async () => {
    state.setDebugHandler(undefined);
    getProviderStubs.mockRejectedValue(notAvailable(STUBS_URL));

    expect(await readSaml2EntityIds({ state })).toEqual([]);
    expect(debug).not.toHaveBeenCalled();
  });

  test.each(FAILING_ANSWERS)(
    '%s is a failure: it is thrown with the cause nested, and not skipped',
    async (_name, makeCause) => {
      const cause = makeCause(STUBS_URL);
      getProviderStubs.mockRejectedValue(cause);

      const error = await thrownBy(() => readSaml2EntityIds({ state }));

      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe('Error reading alpha realm saml2 entity ids');
      expect(error.originalErrors).toEqual([cause]);
      expect(error.originalErrors[0]).toBe(cause);
      expect(skipLines()).toEqual([]);
    }
  );

  test('a failure that is a 403 with another message keeps its http fields on the thrown error', async () => {
    getProviderStubs.mockRejectedValue(
      axiosAnswer(STUBS_URL, 403, { code: 403, message: 'Forbidden' })
    );

    const error = await thrownBy(() => readSaml2EntityIds({ state }));

    expect(error.httpStatus).toBe(403);
    expect(error.httpMessage).toBe('Forbidden');
  });
});

describe('readSaml2ProviderStubs() (unchanged: the reference the other two must agree with)', () => {
  test('answers an empty list on the 403 "not available" answer', async () => {
    getProviderStubs.mockRejectedValue(notAvailable(STUBS_URL));

    expect(await readSaml2ProviderStubs({ state })).toEqual([]);
  });

  test.each(FAILING_ANSWERS)('%s is a failure', async (_name, makeCause) => {
    const cause = makeCause(STUBS_URL);
    getProviderStubs.mockRejectedValue(cause);

    const error = await thrownBy(() => readSaml2ProviderStubs({ state }));

    expect(error.message).toBe(
      'Error reading alpha realm saml2 provider stubs'
    );
    expect(error.originalErrors).toEqual([cause]);
  });

  test('readSaml2EntityIds() and readSaml2ProviderStubs() agree on every answer', async () => {
    const answers: Error[] = [
      notAvailable(STUBS_URL),
      ...FAILING_ANSWERS.map(([, makeCause]) => makeCause(STUBS_URL)),
    ];
    for (const answer of answers) {
      getProviderStubs.mockRejectedValue(answer);
      const stubs = await readSaml2ProviderStubs({ state }).then(
        () => 'skipped',
        () => 'failed'
      );
      const ids = await readSaml2EntityIds({ state }).then(
        () => 'skipped',
        () => 'failed'
      );
      expect([answer.message, ids]).toEqual([answer.message, stubs]);
    }
  });
});

describe('exportSaml2Providers() skips a provider that answers "not available in PingOne Advanced Identity Cloud"', () => {
  test('exports every provider when none fails', async () => {
    serveProviders();

    const exported = await exportSaml2Providers({ state });

    expect(Object.keys(exported.saml.hosted)).toEqual(entityIds.map(idOf));
    expect(Object.keys(exported.saml.metadata)).toEqual(entityIds.map(idOf));
    expect(skipLines()).toEqual([]);
  });

  test('the provider that answers 403 "not available" is left out, the others are exported, nothing is thrown, and a debug message names the operation, the provider and the request', async () => {
    const skippedId = idOf(entityIds[1]);
    serveProviders({ [skippedId]: notAvailable(providerUrl(skippedId)) });

    const exported = await exportSaml2Providers({ state });

    expect(Object.keys(exported.saml.hosted)).toEqual([
      idOf(entityIds[0]),
      idOf(entityIds[2]),
    ]);
    expect(Object.keys(exported.saml.metadata)).toEqual([
      idOf(entityIds[0]),
      idOf(entityIds[2]),
    ]);
    // the providers after the skipped one are still tried
    expect(getProvider).toHaveBeenCalledTimes(3);
    const lines = skipLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Saml2Ops.exportSaml2Providers: skipped');
    expect(lines[0]).toContain(skippedId);
    expect(lines[0]).toContain('PingOne Advanced Identity Cloud');
    expect(lines[0]).toContain(`[GET ${providerUrl(skippedId)}]`);
  });

  test('every provider answering "not available" exports none and does not throw', async () => {
    serveProviders(
      Object.fromEntries(
        entityIds.map((entityId) => [
          idOf(entityId),
          notAvailable(providerUrl(idOf(entityId))),
        ])
      )
    );

    const exported = await exportSaml2Providers({ state });

    expect(exported.saml.hosted).toEqual({});
    expect(exported.saml.metadata).toEqual({});
    expect(skipLines()).toHaveLength(3);
  });

  test('the metadata of a provider answering 403 "not available" skips that provider too: it is the same try', async () => {
    serveProviders();
    getProviderMetadata.mockImplementation(async (args: unknown) => {
      const { entityId } = args as { entityId: string };
      if (entityId === entityIds[1]) throw notAvailable(METADATA_URL);
      return `<EntityDescriptor entityID="${entityId}"/>`;
    });

    const exported = await exportSaml2Providers({ state });

    expect(Object.keys(exported.saml.hosted)).toEqual([
      idOf(entityIds[0]),
      idOf(entityIds[2]),
    ]);
    const lines = skipLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(idOf(entityIds[1]));
    expect(lines[0]).toContain(`[GET ${METADATA_URL}]`);
  });

  test('a debug message is not needed to skip: without a debug handler the provider is skipped all the same', async () => {
    state.setDebugHandler(undefined);
    const skippedId = idOf(entityIds[0]);
    serveProviders({ [skippedId]: notAvailable(providerUrl(skippedId)) });

    const exported = await exportSaml2Providers({ state });

    expect(Object.keys(exported.saml.hosted)).toEqual([
      idOf(entityIds[1]),
      idOf(entityIds[2]),
    ]);
  });

  test('listing the providers answering 403 "not available" exports none and does not throw', async () => {
    getProviderStubs.mockRejectedValue(notAvailable(STUBS_URL));

    const exported = await exportSaml2Providers({ state });

    expect(exported.saml.hosted).toEqual({});
    expect(getProvider).not.toHaveBeenCalled();
  });
});

describe('exportSaml2Providers() reports every other answer as a failure', () => {
  test.each(FAILING_ANSWERS)(
    '%s is thrown at the end, with the provider named and the cause nested, after every provider was tried',
    async (_name, makeCause) => {
      const failedId = idOf(entityIds[1]);
      const cause = makeCause(providerUrl(failedId));
      serveProviders({ [failedId]: cause });

      const error = await thrownBy(() => exportSaml2Providers({ state }));

      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe('Error exporting alpha realm saml2 providers');
      expect(error.originalErrors).toHaveLength(1);
      const [providerError] = error.originalErrors as FrodoError[];
      expect(providerError.message).toBe(
        `Error exporting alpha realm saml2 provider ${failedId}`
      );
      expect(providerError.originalErrors).toEqual([cause]);
      expect(providerError.originalErrors[0]).toBe(cause);
      // the providers after the failed one are still tried
      expect(getProvider).toHaveBeenCalledTimes(3);
      expect(skipLines()).toEqual([]);
    }
  );

  test('a skipped provider and a failed one in the same run: the failed one is thrown alone, the skipped one is only in the debug log', async () => {
    const skippedId = idOf(entityIds[0]);
    const failedId = idOf(entityIds[2]);
    const cause = axiosAnswer(providerUrl(failedId), 500, {
      code: 500,
      message: NOT_AVAILABLE,
    });
    serveProviders({
      [skippedId]: notAvailable(providerUrl(skippedId)),
      [failedId]: cause,
    });

    const error = await thrownBy(() => exportSaml2Providers({ state }));

    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      `Error exporting alpha realm saml2 provider ${failedId}`
    );
    expect((error.originalErrors[0] as FrodoError).originalErrors).toEqual([
      cause,
    ]);
    const lines = skipLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(skippedId);
  });

  test('every failing provider is named, in the order of the providers', async () => {
    const first = idOf(entityIds[0]);
    const third = idOf(entityIds[2]);
    serveProviders({
      [first]: axiosAnswer(providerUrl(first), 403, {
        code: 403,
        message: 'Forbidden',
      }),
      [third]: networkError(providerUrl(third)),
    });

    const error = await thrownBy(() => exportSaml2Providers({ state }));

    expect(error.originalErrors.map((e) => e.message)).toEqual([
      `Error exporting alpha realm saml2 provider ${first}`,
      `Error exporting alpha realm saml2 provider ${third}`,
    ]);
  });
});
