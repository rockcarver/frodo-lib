import { jest } from '@jest/globals';
import StateImpl, { type State } from '../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../test/utils/ErrorWrapping';

/**
 * ScriptOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * These functions return the promise of the API layer from a try block. Without `await` the promise leaves the try
 * before it settles, the catch never runs, and the caller gets the raw AxiosError instead of the FrodoError with the
 * context of the operation. Every row makes the API function reject and checks the message of the FrodoError and
 * the cause in its originalErrors.
 *
 * The export functions keep the promise of the function that prepares the export in a variable and return it
 * from the try block. Without `await` a failure of the preparation skips the catch. Every export row makes the preparation
 * fail after a successful read.
 * Mocked unit test: ScriptApi is replaced, there are no recordings and no network.
 */

const actualScriptApi = await import('../api/ScriptApi');
const scriptApi = {
  deleteScript: jest.fn<(...args: any[]) => Promise<any>>(),
  deleteScriptByName: jest.fn<(...args: any[]) => Promise<any>>(),
  getScript: jest.fn<(...args: any[]) => Promise<any>>(),
  getScriptByName: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/ScriptApi', () => ({
  ...actualScriptApi,
  ...scriptApi,
}));

const ops = await import('./ScriptOps');

const state = StateImpl({});
state.setRealm('alpha');

function resetMocks() {
  for (const api of Object.values(scriptApi)) api.mockReset();
}

type Row = {
  name: string;
  call: () => Promise<unknown>;
  api: ReturnType<typeof jest.fn<(...args: any[]) => Promise<any>>>;
  message: string;
  wrappers?: number;
  arrange?: () => void;
};

const cases: Row[] = [
  {
    name: 'deleteScript',
    call: () => ops.deleteScript({ scriptId: 'script-1', state }),
    api: scriptApi.deleteScript,
    message: 'Error deleting alpha realm script script-1',
  },
  {
    name: 'deleteScriptByName',
    call: () => ops.deleteScriptByName({ scriptName: 'sample-script', state }),
    api: scriptApi.deleteScriptByName,
    message: 'Error deleting alpha realm script sample-script',
  },
];

describe('ScriptOps: a failed API call ends as a FrodoError', () => {
  beforeEach(resetMocks);

  test.each(cases)(
    '$name',
    async ({ call, api, message, wrappers, arrange }) => {
      const cause = failedRequest(500);
      arrange?.();
      api.mockRejectedValue(cause);
      await expectWrappedFailure(call(), message, cause, wrappers);
      expect(api).toHaveBeenCalledTimes(1);
    }
  );
});

type ExportRow = {
  name: string;
  call: (state: State) => Promise<unknown>;
  api?: ReturnType<typeof jest.fn<(...args: any[]) => Promise<any>>>;
  message: string;
  arrange?: () => void;
};

const exportCases: ExportRow[] = [
  {
    name: 'exportScript',
    call: (state: State) => ops.exportScript({ scriptId: 'script-1', state }),
    api: scriptApi.getScript,
    message: 'Error exporting alpha realm script script-1',
    arrange: () => {
      scriptApi.getScript.mockResolvedValue({
        _id: 'script-1',
        name: 'sample-script',
        script: '',
      });
    },
  },
  {
    name: 'exportScriptByName',
    call: (state: State) =>
      ops.exportScriptByName({ scriptName: 'sample-script', state }),
    api: scriptApi.getScriptByName,
    message: 'Error exporting alpha realm script sample-script',
    arrange: () => {
      scriptApi.getScriptByName.mockResolvedValue({
        result: [{ _id: 'script-1', name: 'sample-script', script: '' }],
      });
    },
  },
];

describe('ScriptOps: a failure while an export is prepared ends as a FrodoError', () => {
  beforeEach(resetMocks);

  // The preparation of the export (an async function) fails because the metadata of the export cannot be read from
  // the state; the read before it succeeds.
  test.each(exportCases)('$name', async ({ call, api, message, arrange }) => {
    const cause = new Error('sample metadata failure');
    const failing = StateImpl({});
    failing.setRealm('alpha');
    failing.getFrodoVersion = () => {
      throw cause;
    };
    arrange?.();
    await expectWrappedFailure(call(failing), message, cause);
    if (api) expect(api).toHaveBeenCalledTimes(1);
  });
});
