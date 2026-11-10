import { jest } from '@jest/globals';

/**
 * The agent bulk deletes (`deleteAgents`, `deleteAIAgents`,
 * `deleteIdentityGatewayAgents`, `deleteJavaAgents`, `deleteWebAgents`) try
 * every agent. Without a result callback the failures are collected and thrown
 * as one combined error; with one, every outcome is reported to it, a failed
 * delete does not throw, and a failed read of the agent list still does.
 * Mocked unit test: no recordings.
 */

const deleteAgentByTypeAndId = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const findAgentByTypeAndId = jest.fn(async (_args?: any): Promise<any> => []);
const getAgentsByType = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const getAgentTypes = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));

jest.unstable_mockModule('../api/AgentApi', () => ({
  deleteAgentByTypeAndId,
  findAgentByTypeAndId,
  getAgentByTypeAndId: jest.fn(),
  getAgentGroups: jest.fn(),
  getAgents: jest.fn(),
  getAgentsByType,
  getAgentTypes,
  putAgentByTypeAndId: jest.fn(),
  putAgentGroupByTypeAndId: jest.fn(),
}));

jest.unstable_mockModule('./ManagedObjectOps', () => ({
  addRelationship: jest.fn(),
  createManagedObject: jest.fn(),
  queryManagedObjects: jest.fn(),
  queryRelatedManagedObjects: jest.fn(),
  readManagedObject: jest.fn(),
  readManagedObjects: jest.fn(),
  replaceRelationship: jest.fn(),
}));

jest.unstable_mockModule('./ManagedObjectSchemaOps', () => ({
  readManagedObjectSchema: jest.fn(async () => ({ properties: { _id: {} } })),
}));

const AgentOps = await import('./AgentOps');
const { FrodoError } = await import('./FrodoError');

function mockState() {
  return {
    getRealm: () => 'alpha',
    getHost: () => 'https://agents.example.com',
    getDebugHandler: () => undefined,
    getDeploymentType: () => 'cloud',
    getAuthMode: () => 'noninteractive',
    getUseBearerTokenForAmApis: () => false,
  } as any;
}

const state = mockState();

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

const makeAgents = (type: string) =>
  ['a', 'b', 'c'].map((id) => ({ _id: id, _type: { _id: type } }));

type Case = {
  /** name of the function under test */
  fn:
    | 'deleteAgents'
    | 'deleteAIAgents'
    | 'deleteIdentityGatewayAgents'
    | 'deleteJavaAgents'
    | 'deleteWebAgents';
  type: string;
  /** message of the combined error (what a caller sees without a callback) */
  combined: string;
  /** message of the error of one agent that could not be deleted */
  item: (id: string) => string;
};

const CASES: Case[] = [
  {
    fn: 'deleteAgents',
    type: 'J2EEAgent',
    combined: 'Error deleting agents',
    item: (id) => `Error deleting alpha realm agent ${id} of type J2EEAgent`,
  },
  {
    fn: 'deleteIdentityGatewayAgents',
    type: 'IdentityGatewayAgent',
    combined: 'Error deleting identity gateway agents',
    item: (id) =>
      `Error deleting alpha realm agent ${id} of type IdentityGatewayAgent`,
  },
  {
    fn: 'deleteJavaAgents',
    type: 'J2EEAgent',
    combined: 'Error deleting alpha realm java agents',
    item: (id) => `Error deleting alpha realm agent ${id} of type J2EEAgent`,
  },
  {
    fn: 'deleteWebAgents',
    type: 'WebAgent',
    combined: 'Error deleting alpha realm web agents',
    item: (id) => `Error deleting alpha realm agent ${id} of type WebAgent`,
  },
  {
    fn: 'deleteAIAgents',
    type: 'AIAgent',
    combined: 'Error deleting alpha realm AI agents',
    item: (id) => `Error deleting alpha realm AI agent ${id}`,
  },
];

let attempted: string[];
let failure: Error;

/** Make the list request of the case return three agents, and the delete of agent b fail. */
function arrange(c: Case) {
  const agents = makeAgents(c.type);
  getAgentTypes.mockResolvedValue({ result: [{ _id: c.type }] });
  getAgentsByType.mockResolvedValue({ result: agents });
  findAgentByTypeAndId.mockImplementation(async ({ agentId }: any) =>
    agents.filter((agent) => agent._id === agentId)
  );
  deleteAgentByTypeAndId.mockImplementation(async ({ agentId }: any) => {
    attempted.push(agentId);
    if (agentId === 'b') throw failure;
    return {};
  });
  return agents;
}

beforeEach(() => {
  jest.clearAllMocks();
  attempted = [];
  failure = new Error('HTTP 500');
  getAgentTypes.mockReset();
  getAgentsByType.mockReset();
  findAgentByTypeAndId.mockReset();
  deleteAgentByTypeAndId.mockReset();
});

describe('a failed read of the agent list', () => {
  // The first test of the file on purpose: readAgentTypes caches the agent types
  // of a successful read for the rest of the module's life.
  test('deleteAgents throws even with a result callback, and calls it for no agent', async () => {
    getAgentTypes.mockRejectedValue(new Error('list failed'));
    const resultCallback = jest.fn();

    const error: any = await AgentOps.deleteAgents({
      resultCallback,
      state,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error deleting agents');
    expect(rootCause(error).message).toBe('list failed');
    expect(resultCallback).not.toHaveBeenCalled();
    expect(deleteAgentByTypeAndId).not.toHaveBeenCalled();
  });

  test.each(CASES.filter((c) => c.fn !== 'deleteAgents'))(
    '$fn throws even with a result callback, and calls it for no agent',
    async (c) => {
      getAgentsByType.mockRejectedValue(new Error('list failed'));
      const resultCallback = jest.fn();

      const error: any = await AgentOps[c.fn]({
        resultCallback,
        state,
      }).catch((e) => e);

      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe(c.combined);
      expect(rootCause(error).message).toBe('list failed');
      expect(resultCallback).not.toHaveBeenCalled();
      expect(deleteAgentByTypeAndId).not.toHaveBeenCalled();
    }
  );
});

describe.each(CASES)('$fn', (c) => {
  test('with a result callback, reports every outcome and does not throw when one delete fails', async () => {
    const agents = arrange(c);
    const outcomes: [any, any][] = [];
    const resultCallback = jest.fn((error?: any, result?: any) => {
      outcomes.push([error, result]);
    });

    await expect(
      AgentOps[c.fn]({ resultCallback, state })
    ).resolves.toBeUndefined();

    // every agent was tried, in order, the failure did not stop the others
    expect(attempted).toEqual(['a', 'b', 'c']);
    expect(outcomes).toHaveLength(3);
    // the two deleted agents are reported as results
    expect(outcomes[0]).toEqual([undefined, agents[0]]);
    expect(outcomes[2]).toEqual([undefined, agents[2]]);
    // the failed one is reported as an error that names it and keeps the cause
    const [error, result] = outcomes[1];
    expect(result).toBeUndefined();
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(c.item('b'));
    expect(rootCause(error)).toBe(failure);
  });

  test('with a result callback and no failure, reports every agent as a result', async () => {
    const agents = arrange(c);
    deleteAgentByTypeAndId.mockImplementation(async ({ agentId }: any) => {
      attempted.push(agentId);
      return {};
    });
    const resultCallback = jest.fn();

    await AgentOps[c.fn]({ resultCallback, state });

    expect(attempted).toEqual(['a', 'b', 'c']);
    expect(resultCallback.mock.calls).toEqual(
      agents.map((agent) => [undefined, agent])
    );
  });

  test('without a result callback, tries every agent and throws one combined error that names the failed one', async () => {
    arrange(c);

    const error: any = await AgentOps[c.fn]({ state }).catch((e) => e);

    expect(attempted).toEqual(['a', 'b', 'c']);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(c.combined);
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(c.item('b'));
    expect(rootCause(error)).toBe(failure);
  });

  test('without a result callback and no failure, resolves with nothing', async () => {
    arrange(c);
    deleteAgentByTypeAndId.mockImplementation(async ({ agentId }: any) => {
      attempted.push(agentId);
      return {};
    });

    await expect(AgentOps[c.fn]({ state })).resolves.toBeUndefined();
    expect(attempted).toEqual(['a', 'b', 'c']);
  });

  test('the frodo facade passes the result callback on', async () => {
    arrange(c);
    const resultCallback = jest.fn();

    await AgentOps.default(state)[c.fn](resultCallback);

    expect(resultCallback).toHaveBeenCalledTimes(3);
    expect(resultCallback.mock.calls[1][0].message).toBe(c.item('b'));
  });
});
