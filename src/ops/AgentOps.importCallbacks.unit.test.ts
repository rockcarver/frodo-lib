import { jest } from '@jest/globals';

/**
 * The agent bulk imports (`importAgents`, `importIdentityGatewayAgents`,
 * `importJavaAgents`, `importWebAgents`, `importAIAgents`) try every agent.
 * Without a result callback the failures are collected and thrown as one
 * combined error; with one, every outcome is reported to it as it happens, a
 * failed agent does not throw, and import data that cannot be read still does.
 * `importAgents` treats an agent type that answers HTTP 501 as a failed agent.
 * Mocked unit test: no recordings.
 */

const putAgentByTypeAndId = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/AgentApi', () => ({
  deleteAgentByTypeAndId: jest.fn(),
  findAgentByTypeAndId: jest.fn(),
  getAgentByTypeAndId: jest.fn(async () => {
    const error: any = new Error('HTTP 404');
    error.response = { status: 404 };
    throw error;
  }),
  getAgentGroups: jest.fn(),
  getAgents: jest.fn(),
  getAgentsByType: jest.fn(),
  getAgentTypes: jest.fn(),
  putAgentByTypeAndId,
  putAgentGroupByTypeAndId: jest.fn(),
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

const AgentOps = await import('./AgentOps');

const state = {
  getRealm: () => 'alpha',
  getHost: () => 'https://agents.example.com',
  getDebugHandler: () => undefined,
  getDeploymentType: () => 'cloud',
  getAuthMode: () => 'noninteractive',
  getUseBearerTokenForAmApis: () => false,
} as any;

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

type Case = {
  /** name of the function under test */
  fn:
    | 'importAgents'
    | 'importIdentityGatewayAgents'
    | 'importJavaAgents'
    | 'importWebAgents'
    | 'importAIAgents';
  type: string;
  /** message of the combined error (what a caller sees without a callback) */
  combined: string;
  /** true if the function returns the agents it imported */
  returnsAgents: boolean;
  /** an agent type that the function does not accept */
  wrongType: string;
};

const CASES: Case[] = [
  {
    fn: 'importAgents',
    type: 'J2EEAgent',
    combined: 'Error importing alpha realm agents',
    returnsAgents: true,
    wrongType: 'SoapSTSAgent',
  },
  {
    fn: 'importIdentityGatewayAgents',
    type: 'IdentityGatewayAgent',
    combined: 'Error importing alpha realm identity gateway agents',
    returnsAgents: false,
    wrongType: 'WebAgent',
  },
  {
    fn: 'importJavaAgents',
    type: 'J2EEAgent',
    combined: 'Error importing alpha realm java agents',
    returnsAgents: false,
    wrongType: 'WebAgent',
  },
  {
    fn: 'importWebAgents',
    type: 'WebAgent',
    combined: 'Error importing alpha realm web agents',
    returnsAgents: false,
    wrongType: 'J2EEAgent',
  },
  {
    fn: 'importAIAgents',
    type: 'AIAgent',
    combined: 'Error importing alpha realm AI agents',
    returnsAgents: false,
    wrongType: 'WebAgent',
  },
];

const itemMessage = (id: string, type: string) =>
  `Error importing alpha realm agent ${id} of type ${type}`;

const importDataOf = (type: string, ids = ['a', 'b', 'c']): any => ({
  meta: {},
  agent: Object.fromEntries(
    ids.map((id) => [id, { _id: id, _type: { _id: type } }])
  ),
});

/** Call the function of the case with the facade-like arguments. */
function call(c: Case, importData: any, resultCallback?: any): Promise<any> {
  const params: any = { importData, resultCallback, state };
  if (c.fn === 'importAgents') params.globalConfig = false;
  // the put path is the one that does not provision an identity
  if (c.fn === 'importAIAgents') params.includeAgentIdentity = false;
  return (AgentOps as any)[c.fn](params);
}

let attempted: string[];
let failure: Error;

beforeEach(() => {
  attempted = [];
  failure = new Error('HTTP 400');
  putAgentByTypeAndId.mockReset();
  putAgentByTypeAndId.mockImplementation(
    async ({ agentId, agentType }: any) => {
      attempted.push(agentId);
      if (agentId === 'b') throw failure;
      return { _id: agentId, _type: { _id: agentType } };
    }
  );
  createManagedObject.mockReset();
  createManagedObject.mockResolvedValue({});
  replaceRelationship.mockReset();
  replaceRelationship.mockResolvedValue({});
});

describe.each(CASES)('$fn', (c) => {
  test('imports every agent without a callback', async () => {
    putAgentByTypeAndId.mockImplementation(
      async ({ agentId, agentType }: any) => {
        attempted.push(agentId);
        return { _id: agentId, _type: { _id: agentType } };
      }
    );

    const result = await call(c, importDataOf(c.type));

    expect(attempted).toEqual(['a', 'b', 'c']);
    if (c.returnsAgents) {
      expect(result.map((agent: any) => agent._id)).toEqual(['a', 'b', 'c']);
    } else {
      expect(result).toBeUndefined();
    }
  });

  test('with a callback every agent is reported once, in order, as the agent that was put', async () => {
    putAgentByTypeAndId.mockImplementation(
      async ({ agentId, agentType }: any) => {
        attempted.push(agentId);
        return { _id: agentId, _type: { _id: agentType }, put: true };
      }
    );
    const outcomes: any[] = [];

    const result = await call(
      c,
      importDataOf(c.type),
      (error: any, agent: any) => outcomes.push([error, agent])
    );

    expect(outcomes).toHaveLength(3);
    expect(outcomes.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map(([, agent]) => agent._id)).toEqual(['a', 'b', 'c']);
    expect(outcomes.every(([, agent]) => agent.put === true)).toBe(true);
    if (c.returnsAgents) {
      expect(result.map((agent: any) => agent._id)).toEqual(['a', 'b', 'c']);
    }
  });

  test('with a callback a failed agent is reported with its name and type and the others are still imported', async () => {
    const outcomes: any[] = [];

    const result = await call(
      c,
      importDataOf(c.type),
      (error: any, agent: any) => outcomes.push([error, agent])
    );

    // every agent was tried, the failed one in its place, nothing thrown
    expect(attempted).toEqual(['a', 'b', 'c']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0]).toBeUndefined();
    expect(outcomes[0][1]._id).toBe('a');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(itemMessage('b', c.type));
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][0]).toBeUndefined();
    expect(outcomes[2][1]._id).toBe('c');
    // the failed agent is not part of the result
    if (c.returnsAgents) {
      expect(result.map((agent: any) => agent._id)).toEqual(['a', 'c']);
    }
  });

  test('with a callback every failure is reported once when all agents fail', async () => {
    putAgentByTypeAndId.mockImplementation(async ({ agentId }: any) => {
      attempted.push(agentId);
      throw failure;
    });
    const errors: any[] = [];
    const successes: any[] = [];

    const result = await call(
      c,
      importDataOf(c.type),
      (error: any, agent: any) =>
        error ? errors.push(error) : successes.push(agent)
    );

    expect(attempted).toEqual(['a', 'b', 'c']);
    expect(successes).toEqual([]);
    expect(errors.map((error) => error.message)).toEqual([
      itemMessage('a', c.type),
      itemMessage('b', c.type),
      itemMessage('c', c.type),
    ]);
    if (c.returnsAgents) expect(result).toEqual([]);
  });

  test('without a callback every agent is tried and the failures are thrown as one combined error', async () => {
    const error: any = await call(c, importDataOf(c.type)).catch((e) => e);

    expect(attempted).toEqual(['a', 'b', 'c']);
    expect(error.message).toBe(c.combined);
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(itemMessage('b', c.type));
    expect(rootCause(error)).toBe(failure);
  });

  test('without a callback every failure is in the combined error when all agents fail', async () => {
    putAgentByTypeAndId.mockImplementation(async ({ agentId }: any) => {
      attempted.push(agentId);
      throw failure;
    });

    const error: any = await call(c, importDataOf(c.type)).catch((e) => e);

    expect(attempted).toEqual(['a', 'b', 'c']);
    expect(error.originalErrors.map((e: any) => e.message)).toEqual([
      itemMessage('a', c.type),
      itemMessage('b', c.type),
      itemMessage('c', c.type),
    ]);
  });

  test('import data that cannot be read still throws, with and without a callback', async () => {
    const callback = jest.fn();

    const withCallback: any = await call(c, {}, callback).catch((e) => e);
    const without: any = await call(c, {}).catch((e) => e);

    expect(withCallback.message).toBe(c.combined);
    expect(without.message).toBe(c.combined);
    expect(callback).not.toHaveBeenCalled();
    expect(putAgentByTypeAndId).not.toHaveBeenCalled();
  });

  test('an agent of a type the function does not import is a failed agent that names the type', async () => {
    const importData = importDataOf(c.type);
    importData.agent.b._type._id = c.wrongType;
    const outcomes: any[] = [];

    await call(c, importData, (error: any, agent: any) =>
      outcomes.push([error, agent])
    );

    expect(outcomes).toHaveLength(3);
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(itemMessage('b', c.wrongType));
    // the others were imported
    expect(outcomes[0][1]._id).toBe('a');
    expect(outcomes[2][1]._id).toBe('c');
    expect(attempted).toEqual(['a', 'c']);
  });

  test('an exception of the callback is not reported to the callback as a failed agent', async () => {
    const callback = jest.fn((_error?: any, _agent?: any) => {
      throw new Error('callback bug');
    });

    const error: any = await call(c, importDataOf(c.type), callback).catch(
      (e) => e
    );

    expect(error.message).toBe(c.combined);
    expect(rootCause(error).message).toBe('callback bug');
    // told once about agent a, and not again about its own exception
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeUndefined();
  });
});

describe('importAgents: an agent type that answers HTTP 501', () => {
  const answer501 = (shape: 'frodo' | 'axios') => {
    const error: any = new Error('HTTP 501');
    if (shape === 'frodo') error.httpStatus = 501;
    else error.response = { status: 501 };
    return error;
  };

  test.each(['frodo', 'axios'] as const)(
    'is a failed agent that names the agent type, not a skipped one (%s error)',
    async (shape) => {
      failure = answer501(shape);
      const outcomes: any[] = [];

      await AgentOps.importAgents({
        importData: importDataOf('J2EEAgent'),
        globalConfig: false,
        resultCallback: (error, agent) => outcomes.push([error, agent]),
        state,
      });

      expect(outcomes).toHaveLength(3);
      expect(outcomes[1][1]).toBeUndefined();
      expect(outcomes[1][0].message).toBe(itemMessage('b', 'J2EEAgent'));
      expect(rootCause(outcomes[1][0])).toBe(failure);
    }
  );

  test('is part of the combined error without a callback', async () => {
    failure = answer501('axios');

    const error: any = await AgentOps.importAgents({
      importData: importDataOf('J2EEAgent'),
      globalConfig: false,
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm agents');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(itemMessage('b', 'J2EEAgent'));
  });

  test('every other agent is still imported', async () => {
    failure = answer501('frodo');

    await AgentOps.importAgents({
      importData: importDataOf('J2EEAgent'),
      globalConfig: false,
      resultCallback: () => undefined,
      state,
    });

    expect(attempted).toEqual(['a', 'b', 'c']);
  });
});

describe('importAIAgents with the agent identity', () => {
  /** an AI agent with an identity that has one privilege */
  const aiImportData = (): any => ({
    meta: {},
    agent: Object.fromEntries(
      ['a', 'b', 'c'].map((id) => [
        id,
        {
          _id: id,
          _type: { _id: 'AIAgent' },
          _aiAgentIdentity: {
            _id: `identity-${id}`,
            _privileges: [{ _id: `priv-${id}` }],
          },
        },
      ])
    ),
  });

  test('an agent whose identity could not be provisioned is a failed agent', async () => {
    // the privilege of agent b cannot be linked to the agent
    replaceRelationship.mockImplementation(async (args: any) => {
      if (JSON.stringify(args).includes('identity-b')) {
        throw new Error('link failed');
      }
      return {};
    });
    putAgentByTypeAndId.mockImplementation(async ({ agentId }: any) => ({
      _id: agentId,
    }));
    const outcomes: any[] = [];

    await AgentOps.importAIAgents({
      importData: aiImportData(),
      includeAgentIdentity: true,
      resultCallback: (error, agent) => outcomes.push([error, agent]),
      state,
    });

    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][1]._id).toBe('a');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(itemMessage('b', 'AIAgent'));
    expect(outcomes[2][1]._id).toBe('c');
  });

  test('imports the agents with their identities and reports each once', async () => {
    putAgentByTypeAndId.mockImplementation(async ({ agentId }: any) => ({
      _id: agentId,
    }));
    const agents: any[] = [];

    await AgentOps.importAIAgents({
      importData: aiImportData(),
      includeAgentIdentity: true,
      resultCallback: (error, agent) => {
        expect(error).toBeUndefined();
        agents.push(agent);
      },
      state,
    });

    expect(agents.map((agent) => agent._id)).toEqual(['a', 'b', 'c']);
  });
});

describe('the facade', () => {
  test.each([
    [
      'importAgents',
      'J2EEAgent',
      (f: any, d: any, cb: any) => f.importAgents(d, false, cb),
    ],
    [
      'importIdentityGatewayAgents',
      'IdentityGatewayAgent',
      (f: any, d: any, cb: any) => f.importIdentityGatewayAgents(d, cb),
    ],
    [
      'importJavaAgents',
      'J2EEAgent',
      (f: any, d: any, cb: any) => f.importJavaAgents(d, cb),
    ],
    [
      'importWebAgents',
      'WebAgent',
      (f: any, d: any, cb: any) => f.importWebAgents(d, cb),
    ],
    [
      'importAIAgents',
      'AIAgent',
      (f: any, d: any, cb: any) => f.importAIAgents(d, false, cb),
    ],
  ])('%s passes the callback on', async (_name, type, run) => {
    const outcomes: any[] = [];

    await run(
      AgentOps.default(state),
      importDataOf(type),
      (error: any, agent: any) => outcomes.push([error, agent])
    );

    expect(outcomes).toHaveLength(3);
    expect(outcomes[1][0].message).toBe(itemMessage('b', type));
    expect(outcomes[0][1]._id).toBe('a');
  });
});
