import { jest } from '@jest/globals';
import StateImpl, { type State } from '../../../shared/State';
import { expectWrappedFailure } from '../../../test/utils/ErrorWrapping';

/**
 * IgaRequestFormOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * The export functions keep the promise of the function that prepares the export in a variable and return it
 * from the try block. Without `await` a failure of the preparation skips the catch. Every export row makes the preparation
 * fail after a successful read.
 * Mocked unit test: IgaRequestFormApi is replaced, there are no recordings and no network.
 */

const actualIgaRequestFormApi =
  await import('../../../api/cloud/iga/IgaRequestFormApi');
const igaRequestFormApi = {
  getRequestForm: jest.fn<(...args: any[]) => Promise<any>>(),
  queryRequestForms: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../../../api/cloud/iga/IgaRequestFormApi', () => ({
  ...actualIgaRequestFormApi,
  ...igaRequestFormApi,
}));

const ops = await import('./IgaRequestFormOps');

function resetMocks() {
  for (const api of Object.values(igaRequestFormApi)) api.mockReset();
}

type ExportRow = {
  name: string;
  call: (state: State) => Promise<unknown>;
  api?: ReturnType<typeof jest.fn<(...args: any[]) => Promise<any>>>;
  message: string;
  arrange?: () => void;
};

const exportCases: ExportRow[] = [
  {
    name: 'exportRequestForm',
    call: (state: State) =>
      ops.exportRequestForm({
        formId: 'form-1',
        options: { deps: true, useStringArrays: true },
        state,
      }),
    api: igaRequestFormApi.getRequestForm,
    message: 'Error exporting request form form-1',
    arrange: () => {
      igaRequestFormApi.getRequestForm.mockResolvedValue({
        id: 'form-1',
        name: 'sample-form',
      });
    },
  },
  {
    name: 'exportRequestFormByName',
    call: (state: State) =>
      ops.exportRequestFormByName({ formName: 'sample-form', state }),
    api: igaRequestFormApi.queryRequestForms,
    message: 'Error exporting request form sample-form',
    arrange: () => {
      igaRequestFormApi.queryRequestForms.mockResolvedValue([
        { id: 'form-1', name: 'sample-form' },
      ]);
    },
  },
];

describe('IgaRequestFormOps: a failure while an export is prepared ends as a FrodoError', () => {
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
