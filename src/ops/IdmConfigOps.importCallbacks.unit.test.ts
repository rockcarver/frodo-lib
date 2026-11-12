/**
 * Unit tests for importConfigEntities(): it tries every entity.
 *
 * Without a result callback the failures are collected and thrown as one combined error after every entity was tried.
 * With one, the outcome of every entity is reported to it as it happens (a failed entity as an error that names it, with
 * the cause nested), a failed entity does not throw and is not part of the result, and the entities that were imported
 * are returned. A protected entity of PingOne Advanced Identity Cloud that the tenant refuses (403 ERR_BAD_REQUEST) is
 * skipped without a word for the caller, with a debug message that names the entity and the request.
 *
 * Only the api layer is faked: the real updateConfigEntity(), FrodoError and findFailedRequest() are used.
 *
 * Run with:
 *
 *        npm run test:only IdmConfigOps.importCallbacks
 *
 * Origin: frodo-lib#957 (bulk exports and imports report per item). No recording and no tenant is needed. All ids are
 * made up, except the protected ones, which are fixed by the library (AIC_PROTECTED_ENTITIES).
 */
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';
import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import State from '../shared/State';
import { FrodoError } from './FrodoError';

const PROTECTED_ID = 'emailTemplate/frForgotUsername';
const OTHER_PROTECTED_ID = 'emailTemplate/frResetPassword';

const requestUrl = (id: string) =>
  `https://openidm.example.com/openidm/config/${id}`;

/** The answer of an IDM server, as the api layer raises it: an AxiosError with the response of the server. */
function axiosAnswer(
  id: string,
  status: number,
  code = 'ERR_BAD_REQUEST'
): AxiosError {
  const error = new AxiosError(
    `Request failed with status code ${status}`,
    code
  );
  error.config = {
    url: requestUrl(id),
    method: 'put',
  } as AxiosError['config'];
  error.response = {
    status,
    data: { code: status, message: 'refused' },
  } as AxiosError['response'];
  return error;
}

/** Where the chain of errors that a failing entity produces ends: the api layer. */
let answers: Record<string, Error>;

const putConfigEntity = jest.fn(
  async ({
    entityId,
    entityData,
  }: {
    entityId: string;
    entityData: IdObjectSkeletonInterface;
  }): Promise<IdObjectSkeletonInterface> => {
    if (answers[entityId]) throw answers[entityId];
    return { ...entityData, _id: entityId };
  }
);

jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  getConfigEntities: jest.fn(),
  getConfigEntity: jest.fn(),
  getConfigEntitiesByType: jest.fn(),
  getConfigStubs: jest.fn(),
  putConfigEntity,
  deleteConfigEntity: jest.fn(),
}));

/** Script hooks are valid, except in the entities listed here. */
let invalidHooks: string[];
jest.unstable_mockModule('../utils/ScriptValidationUtils', () => ({
  areScriptHooksValid: jest.fn(
    ({ jsonData }: { jsonData: IdObjectSkeletonInterface }) =>
      !invalidHooks.includes(jsonData._id)
  ),
}));

const { importConfigEntities } = await import('./IdmConfigOps');

const state = State({});
const debug = jest.fn();
const debugLines = () => debug.mock.calls.map(([message]) => String(message));
/** The debug lines that importConfigEntities() writes when it skips an entity. */
const skipLines = () =>
  debugLines().filter((line) =>
    line.startsWith('IdmConfigOps.importConfigEntities: skipped')
  );

/** An import file with the given ids; the ids are the keys and the entities carry them. */
const importDataOf = (...ids: string[]): any => ({
  meta: {},
  idm: Object.fromEntries(
    ids.map((id) => [
      id,
      { _id: id, enabled: true } as IdObjectSkeletonInterface,
    ])
  ),
});

const idsOf = (entities: IdObjectSkeletonInterface[]) =>
  entities.map((entity) => entity._id);

/** The ids that the api layer was asked to write, in order. */
const written = () => putConfigEntity.mock.calls.map(([args]) => args.entityId);

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

beforeEach(() => {
  jest.clearAllMocks();
  answers = {};
  invalidHooks = [];
  state.setDeploymentType('cloud');
  state.setDebugHandler(debug);
});

afterEach(() => {
  state.setDebugHandler(undefined);
});

describe('importConfigEntities() tries every entity', () => {
  test('imports every entity, with and without a callback', async () => {
    const plain = await importConfigEntities({
      importData: importDataOf('sample/a', 'sample/b', 'sample/c'),
      options: { validate: false },
      state,
    });
    const reported: any[] = [];
    const withCallback = await importConfigEntities({
      importData: importDataOf('sample/a', 'sample/b', 'sample/c'),
      options: { validate: false },
      resultCallback: (error, entity) => reported.push([error, entity]),
      state,
    });

    expect(idsOf(plain)).toEqual(['sample/a', 'sample/b', 'sample/c']);
    expect(idsOf(withCallback)).toEqual(['sample/a', 'sample/b', 'sample/c']);
    expect(reported.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(idsOf(reported.map(([, entity]) => entity))).toEqual([
      'sample/a',
      'sample/b',
      'sample/c',
    ]);
  });

  test('with a callback a failed entity is reported by name, with its cause, and the others are imported', async () => {
    answers['sample/b'] = axiosAnswer('sample/b', 400);
    const outcomes: any[] = [];

    const result = await importConfigEntities({
      importData: importDataOf('sample/a', 'sample/b', 'sample/c'),
      options: { validate: false },
      resultCallback: (error, entity) => outcomes.push([error, entity]),
      state,
    });

    // nothing is thrown, the failed entity is not in the result, and the others were written after it
    expect(idsOf(result)).toEqual(['sample/a', 'sample/c']);
    expect(written()).toEqual(['sample/a', 'sample/b', 'sample/c']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0]).toBeUndefined();
    expect(outcomes[0][1]._id).toBe('sample/a');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0]).toBeInstanceOf(FrodoError);
    expect(outcomes[1][0].message).toBe(
      'Error importing idm config entity sample/b'
    );
    // the cause is nested: the update, then the answer of the server
    expect(outcomes[1][0].originalErrors[0].message).toBe(
      'Error updating config entity sample/b'
    );
    expect(rootCause(outcomes[1][0])).toBe(answers['sample/b']);
    expect(outcomes[2][0]).toBeUndefined();
    expect(outcomes[2][1]._id).toBe('sample/c');
  });

  test('without a callback every entity is tried, then one combined error is thrown that names every failed entity', async () => {
    answers['sample/a'] = axiosAnswer('sample/a', 400);
    answers['sample/c'] = axiosAnswer('sample/c', 500, 'ERR_BAD_RESPONSE');

    const failure = await importConfigEntities({
      importData: importDataOf('sample/a', 'sample/b', 'sample/c', 'sample/d'),
      options: { validate: false },
      state,
    }).catch((error) => error);

    // the first failure did not stop the rest
    expect(written()).toEqual(['sample/a', 'sample/b', 'sample/c', 'sample/d']);
    expect(failure).toBeInstanceOf(FrodoError);
    expect(failure.message).toBe('Error importing idm config entities');
    expect(failure.originalErrors.map((error: Error) => error.message)).toEqual(
      [
        'Error importing idm config entity sample/a',
        'Error importing idm config entity sample/c',
      ]
    );
    expect(rootCause(failure.originalErrors[0])).toBe(answers['sample/a']);
    expect(rootCause(failure.originalErrors[1])).toBe(answers['sample/c']);
  });

  test('an invalid script hook is a failed entity that is named, and the others are imported', async () => {
    invalidHooks = ['sample/b'];
    const outcomes: any[] = [];

    const result = await importConfigEntities({
      importData: importDataOf('sample/a', 'sample/b', 'sample/c'),
      options: { validate: true },
      resultCallback: (error, entity) => outcomes.push([error, entity]),
      state,
    });

    expect(idsOf(result)).toEqual(['sample/a', 'sample/c']);
    // the invalid entity is never written
    expect(written()).toEqual(['sample/a', 'sample/c']);
    expect(outcomes[1][0].message).toBe(
      'Error importing idm config entity sample/b'
    );
    expect(rootCause(outcomes[1][0]).message).toBe(
      "Invalid script hook in the config object 'sample/b'"
    );

    // without a callback the invalid entity does not stop the others either
    putConfigEntity.mockClear();
    const failure = await importConfigEntities({
      importData: importDataOf('sample/a', 'sample/b', 'sample/c'),
      options: { validate: true },
      state,
    }).catch((error) => error);
    expect(written()).toEqual(['sample/a', 'sample/c']);
    expect(failure.originalErrors.map((error: Error) => error.message)).toEqual(
      ['Error importing idm config entity sample/b']
    );
  });

  test('an exception of the callback is not taken for a failed import and reported a second time', async () => {
    const callback = jest.fn((error: Error) => {
      if (!error) throw new Error('the callback failed');
    });

    await expect(
      importConfigEntities({
        importData: importDataOf('sample/a', 'sample/b'),
        options: { validate: false },
        resultCallback: callback,
        state,
      })
    ).rejects.toThrow('the callback failed');

    // reported once, as a success; not reported again as an error, and the next entity is not reached
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeUndefined();
    expect(written()).toEqual(['sample/a']);
  });

  test('the option wait is passed on to every write', async () => {
    await importConfigEntities({
      importData: importDataOf('sample/a', 'sample/b'),
      options: { validate: false, wait: true },
      state,
    });

    expect(putConfigEntity.mock.calls.map(([args]) => args.wait)).toEqual([
      true,
      true,
    ]);
  });

  test('only the entity of the given id is tried', async () => {
    answers['sample/a'] = axiosAnswer('sample/a', 400);

    const result = await importConfigEntities({
      entityId: 'sample/b',
      importData: importDataOf('sample/a', 'sample/b', 'sample/c'),
      options: { validate: false },
      state,
    });

    expect(idsOf(result)).toEqual(['sample/b']);
    expect(written()).toEqual(['sample/b']);
  });

  test('only the entities of the option entitiesToImport are tried', async () => {
    const result = await importConfigEntities({
      importData: importDataOf('sample/a', 'sample/b', 'sample/c'),
      options: { validate: false, entitiesToImport: ['sample/c', 'sample/a'] },
      state,
    });

    expect(idsOf(result)).toEqual(['sample/a', 'sample/c']);
    expect(written()).toEqual(['sample/a', 'sample/c']);
  });
});

describe('importConfigEntities() skips a protected entity that the cloud refuses', () => {
  test.each([true, false])(
    'the 403 answer for a protected entity is skipped with callback=%s: not reported, not thrown, not in the result, and a debug message names it and the request',
    async (callback) => {
      answers[PROTECTED_ID] = axiosAnswer(PROTECTED_ID, 403);
      const resultCallback = jest.fn();

      const result = await importConfigEntities({
        importData: importDataOf('sample/a', PROTECTED_ID, 'sample/c'),
        options: { validate: false },
        resultCallback: callback ? resultCallback : undefined,
        state,
      });

      expect(idsOf(result)).toEqual(['sample/a', 'sample/c']);
      // the others were still written, after the skipped one
      expect(written()).toEqual(['sample/a', PROTECTED_ID, 'sample/c']);
      expect(resultCallback).toHaveBeenCalledTimes(callback ? 2 : 0);
      if (callback) {
        expect(
          resultCallback.mock.calls.map(([error, entity]) => [
            error,
            (entity as IdObjectSkeletonInterface)?._id,
          ])
        ).toEqual([
          [undefined, 'sample/a'],
          [undefined, 'sample/c'],
        ]);
      }
      const lines = skipLines();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain(`skipped config entity ${PROTECTED_ID},`);
      expect(lines[0]).toContain('403');
      expect(lines[0]).toContain(`[PUT ${requestUrl(PROTECTED_ID)}]`);
    }
  );

  test('several protected entities are each skipped and named, and a failed entity next to them is still reported', async () => {
    answers[PROTECTED_ID] = axiosAnswer(PROTECTED_ID, 403);
    answers[OTHER_PROTECTED_ID] = axiosAnswer(OTHER_PROTECTED_ID, 403);
    answers['sample/b'] = axiosAnswer('sample/b', 400);

    const failure = await importConfigEntities({
      importData: importDataOf(
        PROTECTED_ID,
        'sample/b',
        OTHER_PROTECTED_ID,
        'sample/c'
      ),
      options: { validate: false },
      state,
    }).catch((error) => error);

    expect(failure.originalErrors.map((error: Error) => error.message)).toEqual(
      ['Error importing idm config entity sample/b']
    );
    expect(skipLines()).toHaveLength(2);
    expect(skipLines()[0]).toContain(PROTECTED_ID);
    expect(skipLines()[1]).toContain(OTHER_PROTECTED_ID);
    expect(written()).toEqual([
      PROTECTED_ID,
      'sample/b',
      OTHER_PROTECTED_ID,
      'sample/c',
    ]);
  });

  test('the skip applies only to the cloud', async () => {
    state.setDeploymentType('classic');
    answers[PROTECTED_ID] = axiosAnswer(PROTECTED_ID, 403);
    const outcomes: any[] = [];

    await importConfigEntities({
      importData: importDataOf(PROTECTED_ID),
      options: { validate: false },
      resultCallback: (error, entity) => outcomes.push([error, entity]),
      state,
    });

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0][0].message).toBe(
      `Error importing idm config entity ${PROTECTED_ID}`
    );
    expect(skipLines()).toHaveLength(0);
  });

  test.each([
    ['another entity that answers 403', 'sample/a', 403, 'ERR_BAD_REQUEST'],
    [
      'a protected entity that answers 500',
      PROTECTED_ID,
      500,
      'ERR_BAD_RESPONSE',
    ],
    [
      'a protected entity that answers 401',
      PROTECTED_ID,
      401,
      'ERR_BAD_REQUEST',
    ],
    [
      'a protected entity that answers 403 with another code',
      PROTECTED_ID,
      403,
      'ERR_NETWORK',
    ],
  ])('is not skipped: %s', async (_name, id, status, code) => {
    answers[id] = axiosAnswer(id, status, code);
    const outcomes: any[] = [];

    const result = await importConfigEntities({
      importData: importDataOf(id, 'sample/z'),
      options: { validate: false },
      resultCallback: (error, entity) => outcomes.push([error, entity]),
      state,
    });

    expect(idsOf(result)).toEqual(['sample/z']);
    expect(outcomes[0][0].message).toBe(
      `Error importing idm config entity ${id}`
    );
    expect(rootCause(outcomes[0][0])).toBe(answers[id]);
    expect(skipLines()).toHaveLength(0);
  });
});
