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

const createManagedObject = jest.fn(async (_args?: any): Promise<any> => ({}));
const replaceRelationship = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('./ManagedObjectOps', () => ({
  addRelationship: jest.fn(),
  createManagedObject,
  queryManagedObjects: jest.fn(),
  queryRelatedManagedObjects: jest.fn(),
  readManagedObject: jest.fn(),
  readManagedObjects: jest.fn(),
  replaceRelationship,
}));

jest.unstable_mockModule('./ManagedObjectSchemaOps', () => ({
  readManagedObjectSchema: jest.fn(async () => ({ properties: { _id: {} } })),
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
    createManagedObject.mockReset();
    createManagedObject.mockResolvedValue({});
    replaceRelationship.mockReset();
    replaceRelationship.mockResolvedValue({});
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

  test('a privilege-linking failure is reported in _provisioningStatus instead of rejecting the call', async () => {
    getAgentByTypeAndId.mockRejectedValue(errorWithStatus(404));
    replaceRelationship.mockRejectedValue(new Error('link failed'));

    const result = await createAIAgent({
      agentId: 'my-agent',
      agentData: {
        _aiAgentIdentity: {
          _id: 'identity-1',
          _privileges: [{ _id: 'priv-1' }],
        },
      } as any,
      includeAgentIdentity: true,
      state: mockState(),
    });

    const status = result._provisioningStatus as any;
    expect(result._id).toBe('my-agent');
    expect(status.agentIdentityId).toBe('identity-1');
    expect(status.privileges).toHaveLength(1);
    const privilegeStatus = status.privileges[0];
    expect(privilegeStatus.outcome).toBe('created');
    expect(privilegeStatus.linkedToAgent).toBe(false);
    expect(privilegeStatus.errors).toHaveLength(1);
  });

  test('does not mutate the caller-supplied agentData object', async () => {
    getAgentByTypeAndId.mockRejectedValue(errorWithStatus(404));

    const agentData = {
      _aiAgentIdentity: { _id: 'identity-1', _privileges: [] },
    } as any;

    await createAIAgent({
      agentId: 'my-agent',
      agentData,
      includeAgentIdentity: true,
      state: mockState(),
    });

    expect(agentData._aiAgentIdentity).toEqual({
      _id: 'identity-1',
      _privileges: [],
    });
  });

  test('a core agent-creation failure still rejects even when includeAgentIdentity is true', async () => {
    getAgentByTypeAndId.mockRejectedValue(errorWithStatus(404));
    putAgentByTypeAndId.mockRejectedValue(new Error('put failed'));

    await expect(
      createAIAgent({
        agentId: 'my-agent',
        agentData: {
          _aiAgentIdentity: { _id: 'identity-1', _privileges: [] },
        } as any,
        includeAgentIdentity: true,
        state: mockState(),
      })
    ).rejects.toThrow();
    expect(createManagedObject).not.toHaveBeenCalled();
  });
});
