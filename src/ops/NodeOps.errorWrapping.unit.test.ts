import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../test/utils/ErrorWrapping';

/**
 * NodeOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * These functions return the promise of the API layer from a try block. Without `await` the promise leaves the try
 * before it settles, the catch never runs, and the caller gets the raw AxiosError instead of the FrodoError with the
 * context of the operation. Every row makes the API function reject and checks the message of the FrodoError and
 * the cause in its originalErrors.
 * Mocked unit test: NodeApi is replaced, there are no recordings and no network.
 */

const actualNodeApi = await import('../api/NodeApi');
const nodeApi = {
  createNode: jest.fn<(...args: any[]) => Promise<any>>(),
  deleteNode: jest.fn<(...args: any[]) => Promise<any>>(),
  putNode: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/NodeApi', () => ({
  ...actualNodeApi,
  ...nodeApi,
}));

const ops = await import('./NodeOps');

const state = StateImpl({});
state.setRealm('alpha');

function resetMocks() {
  for (const api of Object.values(nodeApi)) api.mockReset();
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
    name: 'updateNode',
    call: () =>
      ops.updateNode({
        nodeId: 'node-1',
        nodeType: 'ScriptedDecisionNode',
        nodeData: {} as any,
        state,
      }),
    api: nodeApi.putNode,
    message: 'Error updating ScriptedDecisionNode node node-1',
  },
  {
    name: 'deleteNode',
    call: () =>
      ops.deleteNode({
        nodeId: 'node-1',
        nodeType: 'ScriptedDecisionNode',
        state,
      }),
    api: nodeApi.deleteNode,
    message: 'Error deleting ScriptedDecisionNode node node-1',
  },
  {
    name: 'createNode (without id)',
    call: () =>
      ops.createNode({
        nodeType: 'ScriptedDecisionNode',
        nodeData: {} as any,
        state,
      }),
    api: nodeApi.createNode,
    message: 'Error creating ScriptedDecisionNode node undefined',
  },
];

describe('NodeOps: a failed API call ends as a FrodoError', () => {
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
