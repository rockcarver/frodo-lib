import { jest } from '@jest/globals';
import { FrodoError } from './FrodoError';

const getAgentByTypeAndId = jest.fn(async (_args?: any): Promise<any> => ({}));
const getAgentsByType = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const getAgentTypes = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const putAgentByTypeAndId = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/AgentApi', () => ({
  deleteAgentByTypeAndId: jest.fn(),
  findAgentByTypeAndId: jest.fn(),
  getAgentByTypeAndId,
  getAgentGroups: jest.fn(),
  getAgents: jest.fn(),
  getAgentsByType,
  putAgentByTypeAndId,
  putAgentGroupByTypeAndId: jest.fn(),
  getAgentTypes,
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

const { createAIAgent, readAgents } = await import('./AgentOps');

function mockState() {
  return {
    getRealm: () => 'alpha',
    getDebugHandler: () => undefined,
    getDeploymentType: () => 'cloud',
    getAuthMode: () => 'noninteractive',
    getUseBearerTokenForAmApis: () => false,
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

describe('readAgents', () => {
  const agentTypes = ['FirstAgent', 'SecondAgent', 'ThirdAgent'];

  beforeEach(() => {
    getAgentTypes.mockReset();
    getAgentTypes.mockResolvedValue({
      result: agentTypes.map((_id) => ({ _id })),
    });
    getAgentsByType.mockReset();
    getAgentsByType.mockImplementation(async ({ agentType }: any) => ({
      result: [{ _id: agentType }],
    }));
  });

  test('reports a non-501 failure after requesting every agent type', async () => {
    const failure = errorWithStatus(500);
    getAgentsByType.mockImplementation(async ({ agentType }: any) => {
      if (agentType === 'SecondAgent') {
        throw failure;
      }
      return { result: [{ _id: agentType }] };
    });

    await expect(readAgents({ state: mockState() })).rejects.toMatchObject({
      message: expect.stringContaining('SecondAgent'),
      originalErrors: [
        expect.objectContaining({
          message: expect.stringContaining('SecondAgent'),
          originalErrors: [failure],
        }),
      ],
    });
    expect(getAgentsByType).toHaveBeenCalledTimes(3);
  });

  test.each([
    ['httpStatus', { httpStatus: 501 }],
    ['response.status', { response: { status: 501 } }],
  ])('skips an unsupported type when 501 is in %s', async (_field, failure) => {
    getAgentsByType.mockImplementation(async ({ agentType }: any) => {
      if (agentType === 'SecondAgent') {
        throw failure;
      }
      return { result: [{ _id: agentType }] };
    });

    await expect(readAgents({ state: mockState() })).resolves.toEqual([
      { _id: 'FirstAgent' },
      { _id: 'ThirdAgent' },
    ]);
    expect(getAgentsByType).toHaveBeenCalledTimes(3);
  });

  test.each([403, 404])('does not skip a %i failure', async (status) => {
    getAgentsByType.mockImplementation(async ({ agentType }: any) => {
      if (agentType === 'SecondAgent') {
        throw errorWithStatus(status);
      }
      return { result: [{ _id: agentType }] };
    });

    const error = await readAgents({ state: mockState() }).catch(
      (caughtError) => caughtError
    );
    expect(error.message).toContain('SecondAgent');
    if (status === 403) {
      expect(error).toBeInstanceOf(FrodoError);
    }
    expect(getAgentsByType).toHaveBeenCalledTimes(3);
  });

  test('reports every failed agent type in one error', async () => {
    getAgentsByType.mockImplementation(async ({ agentType }: any) => {
      if (agentType === 'SecondAgent') {
        throw errorWithStatus(500);
      }
      if (agentType === 'ThirdAgent') {
        throw errorWithStatus(403);
      }
      return { result: [{ _id: agentType }] };
    });

    await expect(readAgents({ state: mockState() })).rejects.toMatchObject({
      message: expect.stringContaining('SecondAgent, ThirdAgent'),
      originalErrors: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('SecondAgent'),
        }),
        expect.objectContaining({
          message: expect.stringContaining('ThirdAgent'),
        }),
      ]),
    });
    expect(getAgentsByType).toHaveBeenCalledTimes(3);
  });
});
