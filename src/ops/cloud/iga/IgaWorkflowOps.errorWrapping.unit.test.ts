import StateImpl, { type State } from '../../../shared/State';
import { expectWrappedFailure } from '../../../test/utils/ErrorWrapping';

/**
 * IgaWorkflowOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * The export functions keep the promise of the function that prepares the export in a variable and return it
 * from the try block. Without `await` a failure of the preparation skips the catch. Every export row makes the preparation
 * fail.
 * Mocked unit test: there are no recordings and no network.
 */

const ops = await import('./IgaWorkflowOps');

type ExportRow = {
  name: string;
  call: (state: State) => Promise<unknown>;
  message: string;
  arrange?: () => void;
};

const exportCases: ExportRow[] = [
  {
    name: 'exportWorkflow',
    call: (state: State) =>
      ops.exportWorkflow({ workflowId: 'workflow-1', state }),
    message: 'Error exporting workflow workflow-1',
  },
];

describe('IgaWorkflowOps: a failure while an export is prepared ends as a FrodoError', () => {
  // The preparation of the export (an async function) fails because the metadata of the export cannot be read from
  // the state.
  test.each(exportCases)('$name', async ({ call, message, arrange }) => {
    const cause = new Error('sample metadata failure');
    const failing = StateImpl({});
    failing.setRealm('alpha');
    failing.getFrodoVersion = () => {
      throw cause;
    };
    arrange?.();
    await expectWrappedFailure(call(failing), message, cause);
  });
});
