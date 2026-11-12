import { jest } from '@jest/globals';

/**
 * `importScriptTypes` tries every script type. Without a result callback the
 * failures are collected and thrown as one combined error; with one, every
 * outcome is reported to it as it happens (a failed script type as an error
 * that names it, with the cause nested), a failed script type does not throw
 * and is not part of the result, and the script types that were imported are
 * returned.
 * Mocked unit test: no recordings.
 */

const putScriptType = jest.fn(async (args?: any): Promise<any> => ({
  _id: args?.scriptTypeId,
}));
const putScriptingEngineConfiguration = jest.fn(
  async (args?: any): Promise<any> => ({
    engine: `engine of ${args?.scriptTypeId}`,
  })
);
const actualApi = await import('../api/ScriptTypeApi');
jest.unstable_mockModule('../api/ScriptTypeApi', () => ({
  ...actualApi,
  putScriptType,
  putScriptingEngineConfiguration,
}));

const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  debugMessage: jest.fn(),
}));

const { default: ScriptTypeOps, importScriptTypes } =
  await import('./ScriptTypeOps');

const state = {
  getRealm: () => 'alpha',
  getDeploymentType: () => 'cloud',
} as any;

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

/** t1 and t2 have an engine configuration and a context, t3 has neither */
function importData(): any {
  return {
    scripttype: {
      t1: {
        _id: 't1',
        engineConfiguration: { maxThreads: 1 },
        context: { name: 'context of t1' },
      },
      t2: {
        _id: 't2',
        engineConfiguration: { maxThreads: 2 },
        context: { name: 'context of t2' },
      },
      t3: { _id: 't3' },
    },
  };
}

let failure: Error;

/** the write of the script type is rejected */
const failScriptType = (scriptTypeId: string, error: Error = failure) =>
  putScriptType.mockImplementation(async (args: any) => {
    if (args.scriptTypeId === scriptTypeId) throw error;
    return { _id: args.scriptTypeId };
  });

const ids = (scriptTypes: any[]) => scriptTypes.map((it) => it._id);

beforeEach(() => {
  failure = new Error('HTTP 400');
  jest.clearAllMocks();
  putScriptType.mockReset();
  putScriptType.mockImplementation(async (args: any) => ({
    _id: args.scriptTypeId,
  }));
  putScriptingEngineConfiguration.mockReset();
  putScriptingEngineConfiguration.mockImplementation(async (args: any) => ({
    engine: `engine of ${args.scriptTypeId}`,
  }));
});

describe('importScriptTypes', () => {
  test('imports every script type, with and without a callback', async () => {
    const plain = await importScriptTypes({ importData: importData(), state });
    const reported: any[] = [];
    const withCallback = await importScriptTypes({
      importData: importData(),
      resultCallback: (error, scriptType) => reported.push([error, scriptType]),
      state,
    });

    expect(ids(plain)).toEqual(['t1', 't2', 't3']);
    expect(ids(withCallback)).toEqual(['t1', 't2', 't3']);
    // the result carries the context and the engine configuration that were
    // in the import data and the ones that were written
    expect(plain[0]).toEqual({
      _id: 't1',
      context: { name: 'context of t1' },
      engineConfiguration: { engine: 'engine of t1' },
    });
    expect(reported.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(ids(reported.map(([, scriptType]) => scriptType))).toEqual([
      't1',
      't2',
      't3',
    ]);
  });

  test('with a callback a failed script type is reported by name, with its cause, and the others are imported', async () => {
    failScriptType('t2');
    const outcomes: any[] = [];

    const result = await importScriptTypes({
      importData: importData(),
      resultCallback: (error, scriptType) => outcomes.push([error, scriptType]),
      state,
    });

    expect(ids(result)).toEqual(['t1', 't3']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0]).toBeUndefined();
    expect(outcomes[0][1]._id).toBe('t1');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe('Error importing script type t2');
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][0]).toBeUndefined();
    expect(outcomes[2][1]._id).toBe('t3');
    expect(putScriptType).toHaveBeenCalledTimes(3);
  });

  test('an engine configuration that cannot be written makes the script type a failed script type that is not written', async () => {
    putScriptingEngineConfiguration.mockImplementation(async (args: any) => {
      if (args.scriptTypeId === 't1') throw failure;
      return {};
    });
    const outcomes: any[] = [];

    const result = await importScriptTypes({
      importData: importData(),
      resultCallback: (error, scriptType) => outcomes.push([error, scriptType]),
      state,
    });

    expect(ids(result)).toEqual(['t2', 't3']);
    expect(outcomes[0][0].message).toBe('Error importing script type t1');
    expect(rootCause(outcomes[0][0])).toBe(failure);
    expect(putScriptType.mock.calls.map(([args]) => args.scriptTypeId)).toEqual(
      ['t2', 't3']
    );
  });

  test('with a callback and every script type failing nothing is thrown and nothing is returned', async () => {
    putScriptType.mockRejectedValue(failure);
    const outcomes: any[] = [];

    const result = await importScriptTypes({
      importData: importData(),
      resultCallback: (error, scriptType) => outcomes.push([error, scriptType]),
      state,
    });

    expect(result).toEqual([]);
    expect(outcomes.map(([error]) => error.message)).toEqual([
      'Error importing script type t1',
      'Error importing script type t2',
      'Error importing script type t3',
    ]);
    expect(outcomes.every(([, scriptType]) => scriptType === undefined)).toBe(
      true
    );
  });

  test('without a callback every script type is tried, then one combined error is thrown with the raw error of each failure', async () => {
    putScriptType.mockImplementation(async (args: any) => {
      if (args.scriptTypeId === 't1' || args.scriptTypeId === 't3') {
        throw failure;
      }
      return { _id: args.scriptTypeId };
    });

    const error: any = await importScriptTypes({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing script types');
    expect(error.originalErrors).toHaveLength(2);
    expect(error.originalErrors[0]).toBe(failure);
    expect(error.originalErrors[1]).toBe(failure);
    expect(putScriptType).toHaveBeenCalledTimes(3);
  });

  test('only the script type of the given id is imported and the others are not reported', async () => {
    const outcomes: any[] = [];

    const result = await importScriptTypes({
      scriptTypeId: 't2',
      importData: importData(),
      resultCallback: (error, scriptType) => outcomes.push([error, scriptType]),
      state,
    });

    expect(ids(result)).toEqual(['t2']);
    expect(outcomes).toHaveLength(1);
    expect(putScriptType).toHaveBeenCalledTimes(1);
  });

  test('every script type is reported exactly once, in order, also when the callback throws', async () => {
    failScriptType('t2');
    const calls: string[] = [];
    const boom = new Error('callback failed');

    const error: any = await importScriptTypes({
      importData: importData(),
      resultCallback: (failed, scriptType) => {
        calls.push(failed ? failed.message : scriptType._id);
        if (scriptType?._id === 't1') throw boom;
      },
      state,
    }).catch((e) => e);

    // the exception of the callback ends the run; it is not reported back as
    // a failed script type
    expect(calls).toEqual(['t1']);
    expect(rootCause(error)).toBe(boom);
    expect(putScriptType).toHaveBeenCalledTimes(1);
  });

  test('import data without script types still throws, with a callback too', async () => {
    const callback = jest.fn();

    await expect(
      importScriptTypes({
        importData: {} as any,
        resultCallback: callback,
        state,
      })
    ).rejects.toBeDefined();
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('importScriptTypes on the facade', () => {
  test('passes the result callback on', async () => {
    failScriptType('t2');
    const callback = jest.fn();

    const result = await ScriptTypeOps(state).importScriptTypes(
      importData(),
      undefined,
      callback
    );

    expect(ids(result)).toEqual(['t1', 't3']);
    expect(callback).toHaveBeenCalledTimes(3);
    expect((callback.mock.calls[1][0] as any).message).toBe(
      'Error importing script type t2'
    );
  });

  test('without a callback it throws one combined error as before', async () => {
    failScriptType('t2');

    const error: any = await ScriptTypeOps(state)
      .importScriptTypes(importData())
      .catch((e) => e);

    expect(error.message).toBe('Error importing script types');
    expect(putScriptType).toHaveBeenCalledTimes(3);
  });
});
