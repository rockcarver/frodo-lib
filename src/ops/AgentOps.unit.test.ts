import { jest } from '@jest/globals';

const getAgentByTypeAndId = jest.fn(async (_args?: any): Promise<any> => ({}));
const putAgentByTypeAndId = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/AgentApi', () => ({
  deleteAgentByTypeAndId: jest.fn(),
  findAgentByTypeAndId: jest.fn(),
  getAgentByTypeAndId,
  getAgentGroups: jest.fn(),
  getAgents: jest.fn(),
  getAgentsByType: jest.fn(),
  putAgentByTypeAndId,
  putAgentGroupByTypeAndId: jest.fn(),
  getAgentTypes: jest.fn(),
}));

const { createAIAgent } = await import('./AgentOps');

function mockState() {
  return {
    getRealm: () => 'alpha',
    getDebugHandler: () => undefined,
    getDeploymentType: () => 'cloud',
  } as any;
}

function errorWithStatus(status: number) {
  const error: any = new Error(`HTTP ${status}`);
  error.response = { status };
  return error;
}

describe('createAIAgent', () => {
  beforeEach(() => {
    getAgentByTypeAndId.mockReset();
    putAgentByTypeAndId.mockReset();
    putAgentByTypeAndId.mockResolvedValue({ _id: 'my-agent' });
  });

  test('creates the agent when the existence check confirms a 404', async () => {
    getAgentByTypeAndId.mockRejectedValue(errorWithStatus(404));

    const result = await createAIAgent({
      agentId: 'my-agent',
      agentData: {} as any,
      includeAgentIdentity: false,
      state: mockState(),
    });

    expect(result).toEqual({ _id: 'my-agent' });
    expect(putAgentByTypeAndId).toHaveBeenCalledTimes(1);
  });

  test('does not attempt to create when the existence check fails with a 403', async () => {
    getAgentByTypeAndId.mockRejectedValue(errorWithStatus(403));

    await expect(
      createAIAgent({
        agentId: 'my-agent',
        agentData: {} as any,
        includeAgentIdentity: false,
        state: mockState(),
      })
    ).rejects.toThrow();
    expect(putAgentByTypeAndId).not.toHaveBeenCalled();
  });

  test('does not attempt to create when the existence check fails with a 500', async () => {
    getAgentByTypeAndId.mockRejectedValue(errorWithStatus(500));

    await expect(
      createAIAgent({
        agentId: 'my-agent',
        agentData: {} as any,
        includeAgentIdentity: false,
        state: mockState(),
      })
    ).rejects.toThrow();
    expect(putAgentByTypeAndId).not.toHaveBeenCalled();
  });

  test('does not attempt to create on a network/timeout failure with no response', async () => {
    getAgentByTypeAndId.mockRejectedValue(
      new Error('timeout of 5000ms exceeded')
    );

    await expect(
      createAIAgent({
        agentId: 'my-agent',
        agentData: {} as any,
        includeAgentIdentity: false,
        state: mockState(),
      })
    ).rejects.toThrow();
    expect(putAgentByTypeAndId).not.toHaveBeenCalled();
  });

  test('still proceeds to (re)create when the agent already exists (read succeeds) -- importAIAgent relies on this upsert-style behavior, unrelated to the not-found-misclassification fix', async () => {
    getAgentByTypeAndId.mockResolvedValue({ _id: 'my-agent' });

    const result = await createAIAgent({
      agentId: 'my-agent',
      agentData: {} as any,
      includeAgentIdentity: false,
      state: mockState(),
    });

    expect(result).toEqual({ _id: 'my-agent' });
    expect(putAgentByTypeAndId).toHaveBeenCalledTimes(1);
  });
});
