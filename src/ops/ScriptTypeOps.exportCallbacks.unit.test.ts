import { jest } from '@jest/globals';

/**
 * `exportScriptTypes` tries every script type. A failed read of the engine
 * configuration (anything but HTTP 404) or of the context is a failed script
 * type that is named, not a line that is printed and swallowed. Without a
 * result callback the failures are collected and thrown as one combined error
 * after every script type was tried; with one, every outcome is reported to it
 * as it happens (a failed script type as an error that names it, with the
 * failed reads nested), nothing is thrown, a failed script type is not part of
 * the export, and the script types that could be exported are returned.
 * Failing to read the list of script types always throws.
 * Mocked unit test: no recordings.
 */

const getScriptTypes = jest.fn(async (): Promise<any> => ({ result: [] }));
const getScriptingEngineConfiguration = jest.fn(
  async (args?: any): Promise<any> => ({
    engine: `engine of ${args?.scriptTypeId}`,
  })
);
const getScriptingContext = jest.fn(async (args?: any): Promise<any> => ({
  name: `context of ${args?.scriptTypeId}`,
}));
const actualApi = await import('../api/ScriptTypeApi');
jest.unstable_mockModule('../api/ScriptTypeApi', () => ({
  ...actualApi,
  getScriptTypes,
  getScriptingEngineConfiguration,
  getScriptingContext,
}));

const printMessage = jest.fn();
const createProgressIndicator = jest.fn(() => 'indicator');
const updateProgressIndicator = jest.fn();
const stopProgressIndicator = jest.fn();
const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  debugMessage: jest.fn(),
  printMessage,
  createProgressIndicator,
  updateProgressIndicator,
  stopProgressIndicator,
}));

const { default: ScriptTypeOps, exportScriptTypes } =
  await import('./ScriptTypeOps');
const { default: State } = await import('../shared/State');
const { FrodoError } = await import('./FrodoError');

const state = State({});
state.setDeploymentType('classic');

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

const ids = ['t1', 't2', 't3'];

/** an answer of the server, in the shape that the api layer raises it */
const answer = (status: number, message = `HTTP ${status}`): any => {
  const error: any = new Error(message);
  error.response = { status };
  return error;
};

/** the engine configuration of the script type cannot be read */
const failEngine = (scriptTypeId: string, error: Error) =>
  getScriptingEngineConfiguration.mockImplementation(async (args: any) => {
    if (args.scriptTypeId === scriptTypeId) throw error;
    return { engine: `engine of ${args.scriptTypeId}` };
  });

/** the context of the script type cannot be read */
const failContext = (scriptTypeId: string, error: Error) =>
  getScriptingContext.mockImplementation(async (args: any) => {
    if (args.scriptTypeId === scriptTypeId) throw error;
    return { name: `context of ${args.scriptTypeId}` };
  });

const exportedIds = (data: any) => Object.keys(data.scripttype);

beforeEach(() => {
  jest.clearAllMocks();
  getScriptTypes.mockReset();
  getScriptTypes.mockImplementation(async () => ({
    result: ids.map((_id) => ({ _id })),
  }));
  getScriptingEngineConfiguration.mockReset();
  getScriptingEngineConfiguration.mockImplementation(async (args: any) => ({
    engine: `engine of ${args.scriptTypeId}`,
  }));
  getScriptingContext.mockReset();
  getScriptingContext.mockImplementation(async (args: any) => ({
    name: `context of ${args.scriptTypeId}`,
  }));
});

describe('exportScriptTypes', () => {
  test('exports every script type with its engine configuration and context, with and without a callback', async () => {
    const plain = await exportScriptTypes({ state });
    const reported: any[] = [];
    const withCallback = await exportScriptTypes({
      resultCallback: (error, scriptType) => reported.push([error, scriptType]),
      state,
    });

    expect(exportedIds(plain)).toEqual(ids);
    expect(exportedIds(withCallback)).toEqual(ids);
    expect(plain.scripttype['t2']).toEqual({
      _id: 't2',
      engineConfiguration: { engine: 'engine of t2' },
      context: { name: 'context of t2' },
    });
    expect(reported.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(reported.map(([, scriptType]) => scriptType._id)).toEqual(ids);
    expect(printMessage).not.toHaveBeenCalled();
    expect(stopProgressIndicator).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: 'Exported 3 scriptTypes.',
        status: 'success',
      })
    );
  });

  test.each([
    ['an error with an http status of 404', () => new FrodoError('x'), true],
    ['a raw answer of 404', () => answer(404), false],
  ])(
    'a script type without an engine configuration (%s) is not a failure: it is exported without it',
    async (_name, makeError, nested) => {
      const error: any = makeError();
      if (nested) error.httpStatus = 404;
      failEngine('t2', error);
      const reported: any[] = [];

      const result = await exportScriptTypes({
        resultCallback: (e, scriptType) => reported.push([e, scriptType]),
        state,
      });

      expect(exportedIds(result)).toEqual(ids);
      expect(result.scripttype['t2'].engineConfiguration).toBeUndefined();
      expect(result.scripttype['t2'].context).toEqual({
        name: 'context of t2',
      });
      expect(reported.map(([e]) => e)).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
      expect(printMessage).not.toHaveBeenCalled();
    }
  );

  test('with a callback a failed engine configuration read is a failed script type that is named, and the others are exported', async () => {
    const failure = answer(500);
    failEngine('t2', failure);
    const outcomes: any[] = [];

    const result = await exportScriptTypes({
      resultCallback: (error, scriptType) => outcomes.push([error, scriptType]),
      state,
    });

    // nothing is thrown, nothing is printed, the failed script type is not part of the export
    expect(exportedIds(result)).toEqual(['t1', 't3']);
    expect(printMessage).not.toHaveBeenCalled();
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][1]._id).toBe('t1');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0]).toBeInstanceOf(FrodoError);
    expect(outcomes[1][0].message).toBe('Error exporting script type t2');
    expect(
      outcomes[1][0].originalErrors.map((error: Error) => error.message)
    ).toEqual(['Error reading the engine configuration of script type t2']);
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][1]._id).toBe('t3');
    expect(stopProgressIndicator).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: 'Exported 2 of 3 scriptTypes.',
        status: 'fail',
      })
    );
  });

  test('a failed context read is a failed script type that is named; a 404 of the context is a failure too', async () => {
    const failure = answer(404);
    failContext('t3', failure);
    const outcomes: any[] = [];

    const result = await exportScriptTypes({
      resultCallback: (error, scriptType) => outcomes.push([error, scriptType]),
      state,
    });

    expect(exportedIds(result)).toEqual(['t1', 't2']);
    expect(outcomes[2][0].message).toBe('Error exporting script type t3');
    expect(
      outcomes[2][0].originalErrors.map((error: Error) => error.message)
    ).toEqual(['Error reading the context of script type t3']);
    expect(rootCause(outcomes[2][0])).toBe(failure);
    expect(printMessage).not.toHaveBeenCalled();
  });

  test('when both reads fail, one failed script type carries both reasons, the engine configuration first', async () => {
    const engineFailure = answer(500, 'engine broke');
    const contextFailure = answer(403, 'context refused');
    failEngine('t1', engineFailure);
    failContext('t1', contextFailure);
    const outcomes: any[] = [];

    await exportScriptTypes({
      resultCallback: (error, scriptType) => outcomes.push([error, scriptType]),
      state,
    });

    expect(outcomes).toHaveLength(3);
    const reasons = outcomes[0][0].originalErrors;
    expect(reasons.map((error: Error) => error.message)).toEqual([
      'Error reading the engine configuration of script type t1',
      'Error reading the context of script type t1',
    ]);
    expect(rootCause(reasons[0])).toBe(engineFailure);
    expect(rootCause(reasons[1])).toBe(contextFailure);
  });

  test('without a callback every script type is tried, then one combined error is thrown that names every failed script type', async () => {
    failEngine('t1', answer(500));
    failContext('t3', answer(403));

    const failure = await exportScriptTypes({ state }).catch((e) => e);

    // the first failure did not stop the rest
    expect(
      getScriptingContext.mock.calls.map(([args]: any) => args.scriptTypeId)
    ).toEqual(ids);
    expect(getScriptingEngineConfiguration.mock.calls).toHaveLength(3);
    expect(failure).toBeInstanceOf(FrodoError);
    expect(failure.message).toBe('Error exporting scriptTypes');
    expect(failure.originalErrors.map((error: Error) => error.message)).toEqual(
      ['Error exporting script type t1', 'Error exporting script type t3']
    );
    expect(printMessage).not.toHaveBeenCalled();
    expect(stopProgressIndicator).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: 'Exported 1 of 3 scriptTypes.',
        status: 'fail',
      })
    );
  });

  test('failing to read the list of script types always throws, and the callback is not called', async () => {
    const failure = answer(500);
    getScriptTypes.mockRejectedValue(failure);
    const callback = jest.fn();

    const withCallback = await exportScriptTypes({
      resultCallback: callback,
      state,
    }).catch((e) => e);
    const plain = await exportScriptTypes({ state }).catch((e) => e);

    for (const thrown of [withCallback, plain]) {
      expect(thrown).toBeInstanceOf(FrodoError);
      expect(thrown.message).toBe('Error reading scriptTypes');
      // the error of the export wraps the error of the read of the list
      expect(thrown.originalErrors[0].message).toBe(
        'Error reading scriptTypes'
      );
      expect(rootCause(thrown)).toBe(failure);
    }
    expect(callback).not.toHaveBeenCalled();
    expect(stopProgressIndicator).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'fail' })
    );
  });

  test('the facade passes the callback on', async () => {
    failEngine('t2', answer(500));
    const outcomes: any[] = [];

    const result = await ScriptTypeOps(state).exportScriptTypes(
      (error, scriptType) => outcomes.push([error, scriptType])
    );

    expect(exportedIds(result)).toEqual(['t1', 't3']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[1][0].message).toBe('Error exporting script type t2');
  });
});
