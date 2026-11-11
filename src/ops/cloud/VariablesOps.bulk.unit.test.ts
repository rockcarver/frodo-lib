import { jest } from '@jest/globals';

/**
 * `importVariables` takes an optional result callback (frodo-lib#957). With it, the outcome
 * of every variable is passed to it once, as it happens: a variable that was imported as the
 * variable, a variable that could not be imported as an error that names it and carries the
 * cause. A failed variable does not stop the others, is not part of the result, and the
 * function does not throw for it. Without a callback nothing changes: one combined error is
 * thrown after every variable was tried.
 * `exportVariables` reads the list and nothing per variable, so it has no item that can fail
 * and takes no callback.
 * Mocked unit test: no recordings.
 */

const getVariable = jest.fn(async (_args?: any): Promise<any> => {
  throw Object.assign(new Error('not found'), { response: { status: 404 } });
});
const putVariable = jest.fn(async (args?: any): Promise<any> => ({
  _id: args.variableId,
  valueBase64: args.valueBase64,
  description: args.description,
}));
const setVariableDescription = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
// the actual module is not loaded first: its imports reach VariablesOps, which would then keep the real API
const getVariables = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
jest.unstable_mockModule('../../api/cloud/VariablesApi', () => ({
  getVariables,
  getVariable,
  putVariable,
  setVariableDescription,
  deleteVariable: jest.fn(),
}));

const {
  default: VariablesOps,
  exportVariables,
  importVariables,
} = await import('./VariablesOps');
const { default: State } = await import('../../shared/State');
const { encode } = await import('../../utils/Base64Utils');

const state = State({});
state.setRealm('alpha');

const variable = (id: string, extra = {}): any => ({
  _id: id,
  value: `value of ${id}`,
  description: `description of ${id}`,
  expressionType: 'string',
  ...extra,
});

const importData = (): any => ({
  variable: { a: variable('a'), b: variable('b'), c: variable('c') },
});

/** The messages of an error and of everything nested in it. */
function messagesOf(error: any): string {
  return [error?.message, ...(error?.originalErrors ?? []).map(messagesOf)]
    .filter(Boolean)
    .join(' | ');
}

type Outcome = { error?: any; result?: any };
let outcomes: Outcome[];
const callback = (error?: any, result?: any) =>
  outcomes.push({ error, result });

/** Writing variable b fails. */
const failVariableB = () =>
  putVariable.mockImplementation(async (args: any) => {
    if (args.variableId === 'b') throw new Error('variable b: HTTP 500');
    return {
      _id: args.variableId,
      valueBase64: args.valueBase64,
      description: args.description,
    };
  });

beforeEach(() => {
  outcomes = [];
  for (const mock of [getVariable, putVariable, setVariableDescription]) {
    mock.mockClear();
  }
  getVariable.mockImplementation(async () => {
    throw Object.assign(new Error('not found'), { response: { status: 404 } });
  });
  putVariable.mockImplementation(async (args: any) => ({
    _id: args.variableId,
    valueBase64: args.valueBase64,
    description: args.description,
  }));
});

describe('exportVariables', () => {
  test('reads the list once and nothing per variable, so there is no item that can fail', async () => {
    getVariables.mockResolvedValue({
      result: [
        { _id: 'a', valueBase64: encode('1') },
        { _id: 'b', valueBase64: encode('2') },
      ],
    });
    getVariable.mockClear();

    const exportData = await exportVariables({ noDecode: false, state });

    expect(Object.keys(exportData.variable)).toEqual(['a', 'b']);
    expect(getVariables).toHaveBeenCalledTimes(1);
    expect(getVariable).not.toHaveBeenCalled();
  });
});

describe('importVariables', () => {
  test('without a callback: imports every variable', async () => {
    const response = await importVariables({
      importData: importData(),
      state,
    });

    expect(response.map((v) => v._id)).toEqual(['a', 'b', 'c']);
  });

  test('with a callback: reports every variable once, in order, and returns the same as without', async () => {
    const plain = await importVariables({ importData: importData(), state });

    const response = await importVariables({
      importData: importData(),
      resultCallback: callback,
      state,
    });

    expect(response).toEqual(plain);
    expect(outcomes.map((o) => o.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map((o) => o.result?._id)).toEqual(['a', 'b', 'c']);
  });

  test('with a callback: a variable that needs no update is reported as it is in the import data and is not in the result', async () => {
    const data = importData();
    getVariable.mockImplementation(async (args: any) => {
      if (args.variableId === 'a')
        return {
          _id: 'a',
          valueBase64: encode('value of a'),
          description: 'description of a',
          expressionType: 'string',
          loaded: true,
        };
      throw Object.assign(new Error('not found'), {
        response: { status: 404 },
      });
    });

    const response = await importVariables({
      importData: data,
      resultCallback: callback,
      state,
    });

    expect(response.map((v) => v._id)).toEqual(['b', 'c']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes.map((o) => o.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes[0].result._id).toBe('a');
    expect(putVariable.mock.calls.map(([a]: any) => a.variableId)).toEqual([
      'b',
      'c',
    ]);
  });

  test('with a callback: a variable that cannot be written is a failed item that names it, the others are imported, the function does not throw', async () => {
    failVariableB();

    const response = await importVariables({
      importData: importData(),
      resultCallback: callback,
      state,
    });

    expect(response.map((v) => v._id)).toEqual(['a', 'c']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].result._id).toBe('a');
    expect(outcomes[2].result._id).toBe('c');
    expect(outcomes[1].result).toBeUndefined();
    expect(outcomes[1].error.message).toBe('Error importing variable b');
    expect(outcomes[1].error.originalErrors).toHaveLength(1);
    expect(messagesOf(outcomes[1].error)).toContain('variable b: HTTP 500');
    expect(putVariable).toHaveBeenCalledTimes(3);
  });

  test('with a callback: every variable failing reports every variable, returns an empty result and does not throw', async () => {
    putVariable.mockRejectedValue(new Error('HTTP 500'));

    const response = await importVariables({
      importData: importData(),
      resultCallback: callback,
      state,
    });

    expect(response).toEqual([]);
    expect(outcomes).toHaveLength(3);
    expect(outcomes.every((o) => o.error && !o.result)).toBe(true);
    expect(outcomes.map((o) => o.error.message)).toEqual([
      'Error importing variable a',
      'Error importing variable b',
      'Error importing variable c',
    ]);
  });

  test('without a callback: the failures are thrown as one combined error after every variable was tried', async () => {
    failVariableB();

    const error: any = await importVariables({
      importData: importData(),
      state,
    }).catch((e) => e);

    // unchanged: the combined error with one error per failed variable nested
    expect(error.message).toBe('Error importing variables');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe('Error importing variable b');
    expect(messagesOf(error)).toContain('variable b: HTTP 500');
    expect(putVariable).toHaveBeenCalledTimes(3);
  });

  test('the facade passes the callback on', async () => {
    await VariablesOps(state).importVariables(importData(), callback);

    expect(outcomes.map((o) => o.result?._id)).toEqual(['a', 'b', 'c']);
  });
});
