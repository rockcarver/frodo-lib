import { jest } from '@jest/globals';
import StateImpl, { type State } from '../../../shared/State';
import { expectWrappedFailure } from '../../../test/utils/ErrorWrapping';

/**
 * IgaEventOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * The export functions keep the promise of the function that prepares the export in a variable and return it
 * from the try block. Without `await` a failure of the preparation skips the catch. Every export row makes the preparation
 * fail after a successful read.
 * Mocked unit test: IgaEventApi is replaced, there are no recordings and no network.
 */

const actualIgaEventApi = await import('../../../api/cloud/iga/IgaEventApi');
const igaEventApi = {
  getEvent: jest.fn<(...args: any[]) => Promise<any>>(),
  queryEvents: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../../../api/cloud/iga/IgaEventApi', () => ({
  ...actualIgaEventApi,
  ...igaEventApi,
}));

const ops = await import('./IgaEventOps');

function resetMocks() {
  for (const api of Object.values(igaEventApi)) api.mockReset();
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
    name: 'exportEvent',
    call: (state: State) =>
      ops.exportEvent({ eventId: 'event-1', options: { deps: true }, state }),
    api: igaEventApi.getEvent,
    message: 'Error exporting event event-1',
    arrange: () => {
      igaEventApi.getEvent.mockResolvedValue({
        id: 'event-1',
        name: 'sample-event',
      });
    },
  },
  {
    name: 'exportEventByName',
    call: (state: State) =>
      ops.exportEventByName({ eventName: 'sample-event', state }),
    api: igaEventApi.queryEvents,
    message: 'Error exporting event sample-event',
    arrange: () => {
      igaEventApi.queryEvents.mockResolvedValue([
        { id: 'event-1', name: 'sample-event' },
      ]);
    },
  },
];

describe('IgaEventOps: a failure while an export is prepared ends as a FrodoError', () => {
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
