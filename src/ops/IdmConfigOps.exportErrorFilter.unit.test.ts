/**
 * Unit tests for the error filter of exportConfigEntities(): what it skips without a word, and what stays a failed item.
 *
 * The filter is meant to skip the IDM config entities that a tenant cannot answer:
 *
 * - a 404 "Not Found" for an id in IDM_UNAVAILABLE_ENTITIES (entities that do not exist by default or ever),
 * - the 404 "No configuration exists for id org.apache.felix.fileinstall/openidm" (OPENIDM-18270),
 * - the 403 "This operation is not available in PingOne Advanced Identity Cloud.".
 *
 * Every other error is a failed item: it goes to the result callback, or is thrown when there is none.
 *
 * The filter receives the error that getResult() builds, `Error exporting idm config entity <id>`, which wraps the
 * error of readConfigEntity(), which wraps the AxiosError of the api layer. FrodoError copies the http fields only from
 * its immediate original error, so the wrapper that the filter receives has none: the filter has to look through the
 * nested errors. These tests use the real getResult(), getErrorCallback() and FrodoError, and fake only the api layer.
 *
 * Run with:
 *
 *        npm run test:only IdmConfigOps.exportErrorFilter
 *
 * Origin: frodo-lib#957 (bulk exports and imports report per item). No recording and no tenant is needed. All ids are
 * made up, except the ones in the list of entities that a tenant does not have, which are fixed by the library.
 */
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';
import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import State from '../shared/State';
import { FrodoError } from './FrodoError';

const NOT_AVAILABLE =
  'This operation is not available in PingOne Advanced Identity Cloud.';
const FELIX_ID = 'org.apache.felix.fileinstall/openidm';
const FELIX_MESSAGE = `No configuration exists for id ${FELIX_ID}`;

/** The entities that a tenant does not have by default or ever (IDM_UNAVAILABLE_ENTITIES), pinned here. */
const UNAVAILABLE_IDS = [
  'script',
  'notificationFactory',
  'apiVersion',
  'metrics',
  'repo.init',
  'endpoint/validateQueryFilter',
  'endpoint/oauthproxy',
  'external.rest',
  'scheduler',
  FELIX_ID,
  'cluster',
  'endpoint/mappingDetails',
  'fieldPolicy/teammember',
];

/** An entity that a tenant has, and an id that is in no list of the library. */
const okEntity = (_id: string): IdObjectSkeletonInterface => ({
  _id,
  enabled: true,
});
const OTHER_ID = 'sample/widgetSettings';

const requestUrl = (id: string) =>
  `https://openidm.example.com/openidm/config/${id}`;

/** The answer of an IDM server, as the api layer raises it: an AxiosError with the response of the server. */
function axiosAnswer(
  id: string,
  status: number,
  data: object | null
): AxiosError {
  const error = new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST'
  );
  error.config = {
    url: requestUrl(id),
    method: 'get',
  } as AxiosError['config'];
  error.response = { status, data } as AxiosError['response'];
  return error;
}

const notFound = (id: string) =>
  axiosAnswer(id, 404, {
    code: 404,
    reason: 'Not Found',
    message: 'Not Found',
  });

/** An AxiosError that has no response: the server was not reached. */
function networkError(id: string): AxiosError {
  const error = new AxiosError('connect ECONNRESET', 'ECONNRESET');
  error.config = {
    url: requestUrl(id),
    method: 'get',
  } as AxiosError['config'];
  return error;
}

/** Where the chain of errors that a failing entity produces ends: the api layer. */
let answers: Record<string, Error>;

const getConfigEntities = jest.fn(async () => ({ result: [] }));
const getConfigEntity = jest.fn(
  async ({
    entityId,
  }: {
    entityId: string;
  }): Promise<IdObjectSkeletonInterface> => {
    if (answers[entityId]) throw answers[entityId];
    return okEntity(entityId);
  }
);

jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  getConfigEntities,
  getConfigEntity,
  getConfigEntitiesByType: jest.fn(),
  getConfigStubs: jest.fn(),
  putConfigEntity: jest.fn(),
  deleteConfigEntity: jest.fn(),
}));

const { exportConfigEntities } = await import('./IdmConfigOps');

/** Export the given ids, each answering as set in `answers`, and return everything a caller can observe. */
async function exportIds(ids: string[], callback = true) {
  getConfigEntities.mockResolvedValue({ result: ids.map(okEntity) });
  const resultCallback = jest.fn();
  const result = await exportConfigEntities({
    resultCallback: callback ? resultCallback : undefined,
    state,
  });
  return { result, resultCallback };
}

/** What the callback was told about each id: the error or the entity, per id, in the order of the calls. */
function reportsPerId(resultCallback: jest.Mock) {
  const reports: Record<string, string[]> = {};
  for (const [error, entity] of resultCallback.mock.calls as [
    FrodoError | undefined,
    IdObjectSkeletonInterface | undefined,
  ][]) {
    const id = error
      ? error.message.replace('Error exporting idm config entity ', '')
      : entity._id;
    (reports[id] ??= []).push(error ? 'failed' : 'exported');
  }
  return reports;
}

const state = State({});
const debug = jest.fn();
const debugLines = () => debug.mock.calls.map(([message]) => String(message));
/** The debug lines that exportConfigEntities() writes when it skips an entity (getResult() writes its own). */
const skipLines = () =>
  debugLines().filter((line) =>
    line.startsWith('IdmConfigOps.exportConfigEntities: skipped')
  );

beforeEach(() => {
  jest.clearAllMocks();
  answers = {};
  state.setDeploymentType('cloud');
  state.setDebugHandler(debug);
});

afterEach(() => {
  state.setDebugHandler(undefined);
});

describe('exportConfigEntities() skips what a tenant cannot answer', () => {
  test.each(UNAVAILABLE_IDS)(
    'the entity %s answering 404 Not Found is skipped: not reported, not thrown, and a debug message names it',
    async (id) => {
      answers[id] = notFound(id);

      const { result, resultCallback } = await exportIds([id, OTHER_ID]);

      expect(Object.keys(result.idm)).toEqual([OTHER_ID]);
      expect(reportsPerId(resultCallback)).toEqual({
        [OTHER_ID]: ['exported'],
      });
      const lines = skipLines();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain(`skipped config entity ${id},`);
      expect(lines[0]).toContain('404');
      // like the other places that skip an answer, the debug line names the request
      expect(lines[0]).toContain(`[GET ${requestUrl(id)}]`);
    }
  );

  test('the 404 of an unavailable entity is skipped without a callback too: nothing is thrown', async () => {
    answers['script'] = notFound('script');

    const { result } = await exportIds(['script', OTHER_ID], false);

    expect(Object.keys(result.idm)).toEqual([OTHER_ID]);
    expect(skipLines()).toHaveLength(1);
    expect(skipLines()[0]).toContain('skipped config entity script,');
  });

  test('the felix 404 is skipped by its message alone, the other 404 answer fields do not matter', async () => {
    answers[FELIX_ID] = axiosAnswer(FELIX_ID, 404, {
      code: 404,
      message: FELIX_MESSAGE,
    });

    const { result, resultCallback } = await exportIds([FELIX_ID, OTHER_ID]);

    expect(Object.keys(result.idm)).toEqual([OTHER_ID]);
    expect(reportsPerId(resultCallback)).toEqual({ [OTHER_ID]: ['exported'] });
    const lines = skipLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(`skipped config entity ${FELIX_ID},`);
    expect(lines[0]).toContain('404');
    expect(lines[0]).toContain(`[GET ${requestUrl(FELIX_ID)}]`);
  });

  test('the felix 404 is skipped without a callback too', async () => {
    answers[FELIX_ID] = axiosAnswer(FELIX_ID, 404, {
      code: 404,
      message: FELIX_MESSAGE,
    });

    const { result } = await exportIds([FELIX_ID, OTHER_ID], false);

    expect(Object.keys(result.idm)).toEqual([OTHER_ID]);
  });

  test('the 403 "not available in PingOne Advanced Identity Cloud" is skipped, with or without a callback', async () => {
    answers[OTHER_ID] = axiosAnswer(OTHER_ID, 403, {
      code: 403,
      message: NOT_AVAILABLE,
    });

    for (const callback of [true, false]) {
      const { result, resultCallback } = await exportIds(
        [OTHER_ID, 'sample/other'],
        callback
      );

      expect(Object.keys(result.idm)).toEqual(['sample/other']);
      expect(resultCallback).toHaveBeenCalledTimes(callback ? 1 : 0);
      if (callback) {
        expect(reportsPerId(resultCallback)).toEqual({
          'sample/other': ['exported'],
        });
      }
    }
  });

  test('the 403 "not available" is skipped by the filter too when getResult() does not see it first: nested deeper, with a debug message', async () => {
    // getResult() only looks at the error that readConfigEntity() raises; one more layer hides the answer from it
    answers[OTHER_ID] = new FrodoError(
      'Error calling the api',
      axiosAnswer(OTHER_ID, 403, { code: 403, message: NOT_AVAILABLE })
    );

    const { result, resultCallback } = await exportIds([
      OTHER_ID,
      'sample/other',
    ]);

    expect(Object.keys(result.idm)).toEqual(['sample/other']);
    expect(reportsPerId(resultCallback)).toEqual({
      'sample/other': ['exported'],
    });
    const lines = skipLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(`skipped config entity ${OTHER_ID},`);
    expect(lines[0]).toContain('403');
    expect(lines[0]).toContain(`[GET ${requestUrl(OTHER_ID)}]`);
  });

  test('the answer is found however deep it is nested and at whatever position of a list of causes', async () => {
    // an answer three layers down, two of them FrodoErrors that copy no http field from their cause
    answers['script'] = new FrodoError(
      'layer 3',
      new FrodoError('layer 2', new FrodoError('layer 1', notFound('script')))
    );
    // the answer is the last of several causes: a FrodoError only copies the http fields of the first one
    answers['metrics'] = new FrodoError('several causes', [
      new Error('the first cause says nothing'),
      new FrodoError('and neither does the second', new Error('no answer')),
      notFound('metrics'),
    ]);
    answers[FELIX_ID] = new FrodoError('several causes', [
      new Error('the first cause says nothing'),
      axiosAnswer(FELIX_ID, 404, { code: 404, message: FELIX_MESSAGE }),
    ]);
    answers['sample/notAvailableCauses'] = new FrodoError('several causes', [
      new Error('the first cause says nothing'),
      axiosAnswer('sample/notAvailableCauses', 403, {
        code: 403,
        message: NOT_AVAILABLE,
      }),
    ]);
    // an error that only carries the http fields, without the response they were copied from
    answers['scheduler'] = Object.assign(new FrodoError('copied fields only'), {
      httpStatus: 404,
      httpErrorReason: 'Not Found',
    });

    const { result, resultCallback } = await exportIds([
      'script',
      'metrics',
      FELIX_ID,
      'sample/notAvailableCauses',
      'scheduler',
      OTHER_ID,
    ]);

    expect(Object.keys(result.idm)).toEqual([OTHER_ID]);
    expect(reportsPerId(resultCallback)).toEqual({ [OTHER_ID]: ['exported'] });
    expect(skipLines()).toHaveLength(5);
    // an error chain that carries no request is skipped all the same, and the debug line has no request to name
    const line = skipLines().find((l) =>
      l.includes('config entity scheduler,')
    );
    expect(line).toBeDefined();
    expect(line).not.toContain('[');
  });

  test('the reason of the answer decides for an unavailable entity, not its message', async () => {
    answers['cluster'] = axiosAnswer('cluster', 404, {
      code: 404,
      reason: 'Not Found',
      message: 'The cluster is not configured',
    });
    answers['scheduler'] = axiosAnswer('scheduler', 404, {
      code: 404,
      reason: 'Gone',
      message: 'Not Found',
    });

    const { result, resultCallback } = await exportIds([
      'cluster',
      'scheduler',
      OTHER_ID,
    ]);

    expect(Object.keys(result.idm)).toEqual([OTHER_ID]);
    expect(reportsPerId(resultCallback)).toEqual({
      scheduler: ['failed'],
      [OTHER_ID]: ['exported'],
    });
  });
});

describe('exportConfigEntities() reports everything else as a failed item', () => {
  test('the 404 of an entity that is in no list is a failed item that names the entity and nests the cause', async () => {
    const cause = notFound(OTHER_ID);
    answers[OTHER_ID] = cause;

    const { result, resultCallback } = await exportIds([
      OTHER_ID,
      'sample/other',
    ]);

    expect(Object.keys(result.idm)).toEqual(['sample/other']);
    const failures = resultCallback.mock.calls.filter(([error]) => error);
    expect(failures).toHaveLength(1);
    const [error, entity] = failures[0] as [FrodoError, unknown];
    expect(entity).toBeUndefined();
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(`Error exporting idm config entity ${OTHER_ID}`);
    // the chain: the item, the read of the entity, the AxiosError of the server
    const reading = error.originalErrors[0] as FrodoError;
    expect(reading.message).toBe(`Error reading config entity ${OTHER_ID}`);
    expect(reading.httpStatus).toBe(404);
    expect(reading.originalErrors).toEqual([cause]);
    expect(reportsPerId(resultCallback)).toEqual({
      [OTHER_ID]: ['failed'],
      'sample/other': ['exported'],
    });
    expect(skipLines()).toEqual([]);
  });

  test('the 404 of an entity that is in no list is thrown when there is no callback', async () => {
    answers[OTHER_ID] = notFound(OTHER_ID);

    await expect(
      exportIds([OTHER_ID, 'sample/other'], false)
    ).rejects.toMatchObject({
      message: `Error exporting idm config entity ${OTHER_ID}`,
      originalErrors: [
        expect.objectContaining({
          message: `Error reading config entity ${OTHER_ID}`,
          httpStatus: 404,
        }),
      ],
    });
  });

  test('a 404 of an unavailable entity whose reason is not "Not Found" is a failed item', async () => {
    answers['script'] = axiosAnswer('script', 404, {
      code: 404,
      reason: 'Gone Missing',
      message: 'Gone Missing',
    });
    answers['metrics'] = axiosAnswer('metrics', 404, null);

    const { resultCallback } = await exportIds(['script', 'metrics', OTHER_ID]);

    expect(reportsPerId(resultCallback)).toEqual({
      script: ['failed'],
      metrics: ['failed'],
      [OTHER_ID]: ['exported'],
    });
  });

  test.each([
    [403, { code: 403, reason: 'Not Found', message: 'Forbidden' }],
    [400, { code: 400, reason: 'Not Found', message: 'Bad Request' }],
    [409, { code: 409, reason: 'Not Found', message: 'Conflict' }],
    [500, { code: 500, reason: 'Not Found', message: 'Internal Server Error' }],
    [401, { code: 401, reason: 'Unauthorized', message: 'Access Denied' }],
  ])(
    'an unavailable entity answering %i (not 404) is a failed item',
    async (status, data) => {
      answers['script'] = axiosAnswer('script', status, data);

      const { resultCallback } = await exportIds(['script', OTHER_ID]);

      expect(reportsPerId(resultCallback)).toEqual({
        script: ['failed'],
        [OTHER_ID]: ['exported'],
      });
    }
  );

  test('the felix message with another status, and another 404 message for the felix entity, are failed items', async () => {
    answers[FELIX_ID] = axiosAnswer(FELIX_ID, 500, {
      code: 500,
      message: FELIX_MESSAGE,
    });
    answers['sample/other'] = axiosAnswer('sample/other', 403, {
      code: 403,
      message: FELIX_MESSAGE,
    });
    answers['sample/third'] = axiosAnswer('sample/third', 404, {
      code: 404,
      message:
        'No configuration exists for id org.apache.felix.fileinstall/other',
    });

    const { resultCallback } = await exportIds([
      FELIX_ID,
      'sample/other',
      'sample/third',
      OTHER_ID,
    ]);

    expect(reportsPerId(resultCallback)).toEqual({
      [FELIX_ID]: ['failed'],
      'sample/other': ['failed'],
      'sample/third': ['failed'],
      [OTHER_ID]: ['exported'],
    });
  });

  test('a 403 with another message than "not available" is a failed item, the nested 403 as well', async () => {
    answers[OTHER_ID] = axiosAnswer(OTHER_ID, 403, {
      code: 403,
      message: 'Forbidden',
    });
    answers['sample/other'] = new FrodoError(
      'Error calling the api',
      axiosAnswer('sample/other', 403, { code: 403, message: 'Forbidden' })
    );
    answers['sample/third'] = axiosAnswer('sample/third', 500, {
      code: 500,
      message: NOT_AVAILABLE,
    });

    const { resultCallback } = await exportIds([
      OTHER_ID,
      'sample/other',
      'sample/third',
    ]);

    expect(reportsPerId(resultCallback)).toEqual({
      [OTHER_ID]: ['failed'],
      'sample/other': ['failed'],
      'sample/third': ['failed'],
    });
  });

  test('a nested 403 "not available" is a failed item when it is not an HTTP answer of the server (no status)', async () => {
    answers[OTHER_ID] = new FrodoError(
      'Error calling the api',
      Object.assign(new Error('not a response'), {
        response: { data: { message: NOT_AVAILABLE } },
      })
    );

    const { resultCallback } = await exportIds([OTHER_ID]);

    expect(reportsPerId(resultCallback)).toEqual({ [OTHER_ID]: ['failed'] });
  });

  test.each([
    [
      'a 500',
      (id: string) =>
        axiosAnswer(id, 500, { code: 500, message: 'Internal Server Error' }),
    ],
    [
      'a 401',
      (id: string) =>
        axiosAnswer(id, 401, {
          code: 401,
          reason: 'Unauthorized',
          message: 'Access Denied',
        }),
    ],
    ['a network error', (id: string) => networkError(id)],
    [
      'an error without any HTTP field',
      (id: string) => new Error(`boom ${id}`),
    ],
  ])(
    '%s is a failed item with the cause nested, for an unavailable entity and for another one',
    async (_name, makeCause) => {
      const causes: Record<string, Error> = {
        script: makeCause('script'),
        [OTHER_ID]: makeCause(OTHER_ID),
      };
      answers = { ...causes };

      const { result, resultCallback } = await exportIds([
        'script',
        OTHER_ID,
        'sample/other',
      ]);

      expect(Object.keys(result.idm)).toEqual(['sample/other']);
      expect(reportsPerId(resultCallback)).toEqual({
        script: ['failed'],
        [OTHER_ID]: ['failed'],
        'sample/other': ['exported'],
      });
      for (const [error] of resultCallback.mock.calls.filter(([e]) => e) as [
        FrodoError,
      ][]) {
        const id = error.message.replace(
          'Error exporting idm config entity ',
          ''
        );
        const reading = error.originalErrors[0] as FrodoError;
        expect(reading.message).toBe(`Error reading config entity ${id}`);
        expect(reading.originalErrors).toEqual([causes[id]]);
      }
    }
  );

  test('an error other than a skippable answer is thrown when there is no callback', async () => {
    answers['script'] = axiosAnswer('script', 500, {
      code: 500,
      message: 'Internal Server Error',
    });

    await expect(exportIds(['script', OTHER_ID], false)).rejects.toMatchObject({
      message: 'Error exporting idm config entity script',
    });
  });
});

describe('exportConfigEntities() reports every entity exactly once', () => {
  test('a mixed batch: exported, skipped (404, felix, 403) and failed (404, 500, network) entities', async () => {
    answers['script'] = notFound('script');
    answers[FELIX_ID] = axiosAnswer(FELIX_ID, 404, {
      code: 404,
      message: FELIX_MESSAGE,
    });
    answers['sample/notAvailable'] = axiosAnswer('sample/notAvailable', 403, {
      code: 403,
      message: NOT_AVAILABLE,
    });
    answers['sample/deepNotAvailable'] = new FrodoError(
      'Error calling the api',
      axiosAnswer('sample/deepNotAvailable', 403, {
        code: 403,
        message: NOT_AVAILABLE,
      })
    );
    answers['sample/missing'] = notFound('sample/missing');
    answers['sample/broken'] = axiosAnswer('sample/broken', 500, {
      code: 500,
      message: 'Internal Server Error',
    });
    answers['sample/offline'] = networkError('sample/offline');
    const ids = [
      'sample/a',
      'script',
      FELIX_ID,
      'sample/notAvailable',
      'sample/deepNotAvailable',
      'sample/missing',
      'sample/b',
      'sample/broken',
      'sample/offline',
      'metrics',
    ];

    const { result, resultCallback } = await exportIds(ids);

    expect(Object.keys(result.idm).sort()).toEqual(
      ['sample/a', 'sample/b', 'metrics'].sort()
    );
    expect(reportsPerId(resultCallback)).toEqual({
      'sample/a': ['exported'],
      'sample/b': ['exported'],
      metrics: ['exported'],
      'sample/missing': ['failed'],
      'sample/broken': ['failed'],
      'sample/offline': ['failed'],
    });
    expect(resultCallback).toHaveBeenCalledTimes(6);
    // each entity that the filter skipped left exactly one debug line; the plain 403 never reaches the filter, because
    // getResult() skips it first (and writes its own debug line)
    const lines = skipLines();
    expect(lines).toHaveLength(3);
    for (const id of ['script', FELIX_ID, 'sample/deepNotAvailable']) {
      expect(
        lines.filter((line) => line.includes(`skipped config entity ${id},`))
      ).toHaveLength(1);
    }
  });

  test('without a callback a batch of skipped and exported entities returns the exported ones', async () => {
    answers['script'] = notFound('script');
    answers[FELIX_ID] = axiosAnswer(FELIX_ID, 404, {
      code: 404,
      message: FELIX_MESSAGE,
    });

    const { result } = await exportIds(['script', FELIX_ID, OTHER_ID], false);

    expect(result.idm).toEqual({ [OTHER_ID]: okEntity(OTHER_ID) });
    expect(getConfigEntity).toHaveBeenCalledTimes(3);
  });
});
