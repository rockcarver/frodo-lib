/**
 * Unit tests for how deleteConfigEntities() and deleteConfigEntitiesByType() treat the answer "This operation is not
 * available in PingOne Advanced Identity Cloud." (HTTP 403) of an entity.
 *
 * Both pass the function of the api layer to getResult(), so the error that getResult() receives is the raw AxiosError
 * of the api layer: its answer is in `response.status` and `response.data.message`, it has no `httpStatus` and no
 * `httpMessage` (FrodoError copies those from its immediate original error, the AxiosError itself has none). The
 * entity that answers so is skipped without a word, like every other place that knows this answer: the delete is
 * still sent, the result callback is not called for it, nothing is thrown, and a debug message names the entity and
 * the request. Every other answer is a failed item that names the entity and nests the cause.
 *
 * These tests use real AxiosErrors, as the api layer raises them, the real getResult() and FrodoError, and fake only
 * the api layer.
 *
 * Run with:
 *
 *        npm run test:only IdmConfigOps.deleteNotAvailable
 *
 * Origin: frodo-lib#957 (bulk exports and imports report per item). No recording and no tenant is needed. All ids are
 * made up.
 */
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';
import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import State from '../shared/State';
import { FrodoError } from './FrodoError';

const NOT_AVAILABLE =
  'This operation is not available in PingOne Advanced Identity Cloud.';
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
    method: 'delete',
  } as AxiosError['config'];
  error.response = { status, data } as AxiosError['response'];
  return error;
}

const notAvailable = (id: string) =>
  axiosAnswer(id, 403, { code: 403, message: NOT_AVAILABLE });

/** An AxiosError without a response: the server was not reached. */
function networkError(id: string): AxiosError {
  const error = new AxiosError('connect ECONNRESET', 'ECONNRESET');
  error.config = {
    url: requestUrl(id),
    method: 'delete',
  } as AxiosError['config'];
  return error;
}

/** What the api layer answers for an entity: set per entity, an entity that is not set is deleted. */
let answers: Record<string, Error>;

const IDS = ['sample/one', 'sample/two', 'sample/three'];

const getConfigStubs = jest.fn(async (_args?: unknown) => ({
  configurations: IDS.map((_id) => ({ _id, pid: _id, factoryPid: null })),
}));
const getConfigEntitiesByType = jest.fn(async (_args?: unknown) => ({
  result: IDS.map((_id) => ({ _id })),
}));
const deleteConfigEntity = jest.fn(
  async ({
    entityId,
  }: {
    entityId: string;
  }): Promise<IdObjectSkeletonInterface> => {
    if (answers[entityId]) throw answers[entityId];
    return { _id: entityId };
  }
);

jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  getConfigStubs,
  getConfigEntities: jest.fn(),
  getConfigEntitiesByType,
  getConfigEntity: jest.fn(),
  putConfigEntity: jest.fn(),
  patchConfigEntity: jest.fn(),
  deleteConfigEntity,
}));

const { deleteConfigEntities, deleteConfigEntitiesByType } =
  await import('./IdmConfigOps');

const state = State({});
const debug = jest.fn();
const debugLines = () => debug.mock.calls.map(([message]) => String(message));
const skipLines = () => debugLines().filter((line) => line.includes('skipped'));

beforeEach(() => {
  jest.clearAllMocks();
  answers = {};
  state.setDebugHandler(debug);
});

afterEach(() => {
  state.setDebugHandler(undefined);
});

/** The two functions under test, called the same way. */
const DELETES: [
  string,
  (resultCallback?: jest.Mock) => Promise<IdObjectSkeletonInterface[]>,
][] = [
  [
    'deleteConfigEntities()',
    (resultCallback) => deleteConfigEntities({ resultCallback, state }),
  ],
  [
    'deleteConfigEntitiesByType()',
    (resultCallback) =>
      deleteConfigEntitiesByType({ type: 'sample', resultCallback, state }),
  ],
];

describe.each(DELETES)('%s', (_name, deleteAll) => {
  test('deletes every entity and reports each one when none fails', async () => {
    const resultCallback = jest.fn();

    const results = await deleteAll(resultCallback);

    expect(results).toEqual(IDS.map((_id) => ({ _id })));
    expect(resultCallback.mock.calls).toEqual(
      IDS.map((_id) => [undefined, { _id }])
    );
    expect(skipLines()).toEqual([]);
  });

  test('skips the entity that answers 403 "not available in PingOne Advanced Identity Cloud": the delete is sent, the callback is not told, nothing is thrown, a debug message names it', async () => {
    answers['sample/two'] = notAvailable('sample/two');
    const resultCallback = jest.fn();

    const results = await deleteAll(resultCallback);

    expect(results).toEqual([{ _id: 'sample/one' }, { _id: 'sample/three' }]);
    // the delete of the entity is still sent, and the entities after it are still deleted
    expect(
      deleteConfigEntity.mock.calls.map(([{ entityId }]) => entityId)
    ).toEqual(IDS);
    expect(resultCallback.mock.calls).toEqual([
      [undefined, { _id: 'sample/one' }],
      [undefined, { _id: 'sample/three' }],
    ]);
    const lines = skipLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Error deleting idm config entity sample/two');
    expect(lines[0]).toContain(
      'not available in PingOne Advanced Identity Cloud'
    );
    expect(lines[0]).toContain(`[DELETE ${requestUrl('sample/two')}]`);
  });

  test('skips the entity without a callback too: nothing is thrown and the others are deleted', async () => {
    answers['sample/one'] = notAvailable('sample/one');

    const results = await deleteAll();

    expect(results).toEqual([{ _id: 'sample/two' }, { _id: 'sample/three' }]);
    expect(deleteConfigEntity).toHaveBeenCalledTimes(3);
    expect(skipLines()).toHaveLength(1);
  });

  test('skips every entity when all of them answer "not available"', async () => {
    for (const id of IDS) answers[id] = notAvailable(id);
    const resultCallback = jest.fn();

    const results = await deleteAll(resultCallback);

    expect(results).toEqual([]);
    expect(resultCallback).not.toHaveBeenCalled();
    expect(skipLines()).toHaveLength(3);
  });

  test.each([
    [
      'a 403 with another message',
      (id: string) => axiosAnswer(id, 403, { code: 403, message: 'Forbidden' }),
    ],
    ['a 403 without a body', (id: string) => axiosAnswer(id, 403, null)],
    [
      'a 500 with the "not available" message',
      (id: string) =>
        axiosAnswer(id, 500, { code: 500, message: NOT_AVAILABLE }),
    ],
    [
      'a 404 with the "not available" message',
      (id: string) =>
        axiosAnswer(id, 404, { code: 404, message: NOT_AVAILABLE }),
    ],
    [
      'a 401',
      (id: string) =>
        axiosAnswer(id, 401, { code: 401, message: 'Unauthorized' }),
    ],
    ['a network error', (id: string) => networkError(id)],
  ])(
    '%s is a failed item: the callback is told, it names the entity and nests the cause, the others are still deleted',
    async (_answer, makeCause) => {
      const cause = makeCause('sample/two');
      answers['sample/two'] = cause;
      const resultCallback = jest.fn();

      const results = await deleteAll(resultCallback);

      expect(results).toEqual([{ _id: 'sample/one' }, { _id: 'sample/three' }]);
      expect(resultCallback).toHaveBeenCalledTimes(3);
      const failures = resultCallback.mock.calls.filter(([error]) => error);
      expect(failures).toHaveLength(1);
      const [error, value] = failures[0] as [FrodoError, unknown];
      expect(value).toBeUndefined();
      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe('Error deleting idm config entity sample/two');
      expect(error.originalErrors).toHaveLength(1);
      expect(error.originalErrors[0]).toBe(cause);
      expect(deleteConfigEntity).toHaveBeenCalledTimes(3);
      expect(skipLines()).toEqual([]);
    }
  );

  test('a failed item is thrown when there is no callback, naming the entity and nesting the cause', async () => {
    const cause = axiosAnswer('sample/one', 500, {
      code: 500,
      message: 'boom',
    });
    answers['sample/one'] = cause;

    await expect(deleteAll()).rejects.toMatchObject({
      message: 'Error deleting idm config entity sample/one',
      originalErrors: [cause],
    });
  });

  test('a skipped entity and a failed one in the same run: the failed one is reported, the skipped one only in the debug log', async () => {
    answers['sample/one'] = notAvailable('sample/one');
    const cause = axiosAnswer('sample/three', 500, {
      code: 500,
      message: NOT_AVAILABLE,
    });
    answers['sample/three'] = cause;
    const resultCallback = jest.fn();

    const results = await deleteAll(resultCallback);

    expect(results).toEqual([{ _id: 'sample/two' }]);
    expect(resultCallback).toHaveBeenCalledTimes(2);
    expect(resultCallback.mock.calls[0]).toEqual([
      undefined,
      { _id: 'sample/two' },
    ]);
    const [error] = resultCallback.mock.calls[1] as [FrodoError];
    expect(error.message).toBe('Error deleting idm config entity sample/three');
    expect(error.originalErrors[0]).toBe(cause);
    const lines = skipLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('sample/one');
  });
});
