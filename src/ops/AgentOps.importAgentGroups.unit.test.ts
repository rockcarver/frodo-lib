import { jest } from '@jest/globals';

/**
 * `importAgentGroups` tries every agent group. Without a result callback the
 * failures are collected and thrown as one combined error; with one, every
 * outcome is reported to it as it happens (a failed agent group as an error
 * that names the group and its type, with the cause nested), a failed group
 * does not throw and is not part of the result, and the groups that were
 * imported are returned. A group type that answers HTTP 501 is a failed group
 * like any other, as an agent of such a type is in importAgents. A Soap STS group
 * is refused outside a classic deployment, as a failed group too. Mocked unit
 * test: no recordings.
 */

const putAgentGroupByTypeAndId = jest.fn(async (args?: any): Promise<any> => ({
  _id: args?.agentGroupId,
}));

jest.unstable_mockModule('../api/AgentApi', () => ({
  deleteAgentByTypeAndId: jest.fn(),
  findAgentByTypeAndId: jest.fn(),
  getAgentByTypeAndId: jest.fn(),
  getAgentGroups: jest.fn(),
  getAgents: jest.fn(),
  getAgentsByType: jest.fn(),
  getAgentTypes: jest.fn(),
  putAgentByTypeAndId: jest.fn(),
  putAgentGroupByTypeAndId,
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

const { default: AgentOps, importAgentGroups } = await import('./AgentOps');

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

function importData(): any {
  return {
    agentGroup: {
      'group-1': { _id: 'group-1', _type: { _id: 'WebAgentGroup' } },
      'group-2': { _id: 'group-2', _type: { _id: 'J2EEAgentGroup' } },
      'group-3': {
        _id: 'group-3',
        _type: { _id: 'IdentityGatewayAgentGroup' },
      },
    },
  };
}

let failure: Error;

/** the write of the group is rejected */
const failGroup = (groupId: string, error: Error = failure) =>
  putAgentGroupByTypeAndId.mockImplementation(async (args: any) => {
    if (args.agentGroupId === groupId) throw error;
    return { _id: args.agentGroupId };
  });

const ids = (groups: any[]) => groups.map((it) => it._id);

beforeEach(() => {
  failure = new Error('HTTP 400');
  jest.clearAllMocks();
  putAgentGroupByTypeAndId.mockReset();
  putAgentGroupByTypeAndId.mockImplementation(async (args: any) => ({
    _id: args.agentGroupId,
  }));
});

describe('importAgentGroups', () => {
  test('imports every group, with and without a callback', async () => {
    const plain = await importAgentGroups({ importData: importData(), state });
    const reported: any[] = [];
    const withCallback = await importAgentGroups({
      importData: importData(),
      resultCallback: (error, group) => reported.push([error, group]),
      state,
    });

    expect(ids(plain)).toEqual(['group-1', 'group-2', 'group-3']);
    expect(ids(withCallback)).toEqual(['group-1', 'group-2', 'group-3']);
    expect(reported.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(ids(reported.map(([, group]) => group))).toEqual([
      'group-1',
      'group-2',
      'group-3',
    ]);
  });

  test('with a callback a failed group is reported by name and type, with its cause, and the others are imported', async () => {
    failGroup('group-2');
    const outcomes: any[] = [];

    const result = await importAgentGroups({
      importData: importData(),
      resultCallback: (error, group) => outcomes.push([error, group]),
      state,
    });

    expect(ids(result)).toEqual(['group-1', 'group-3']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0]).toBeUndefined();
    expect(outcomes[0][1]._id).toBe('group-1');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(
      'Error importing alpha realm agent group group-2 of type J2EEAgentGroup'
    );
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][0]).toBeUndefined();
    expect(outcomes[2][1]._id).toBe('group-3');
    expect(putAgentGroupByTypeAndId).toHaveBeenCalledTimes(3);
  });

  test('with a callback and every group failing nothing is thrown and nothing is returned', async () => {
    putAgentGroupByTypeAndId.mockRejectedValue(failure);
    const outcomes: any[] = [];

    const result = await importAgentGroups({
      importData: importData(),
      resultCallback: (error, group) => outcomes.push([error, group]),
      state,
    });

    expect(result).toEqual([]);
    expect(outcomes.map(([error]) => error.message)).toEqual([
      'Error importing alpha realm agent group group-1 of type WebAgentGroup',
      'Error importing alpha realm agent group group-2 of type J2EEAgentGroup',
      'Error importing alpha realm agent group group-3 of type IdentityGatewayAgentGroup',
    ]);
    expect(outcomes.every(([, group]) => group === undefined)).toBe(true);
  });

  test('without a callback every group is tried, then one combined error is thrown with one error per failed group', async () => {
    putAgentGroupByTypeAndId.mockImplementation(async (args: any) => {
      if (args.agentGroupId !== 'group-2') throw failure;
      return { _id: args.agentGroupId };
    });

    const error: any = await importAgentGroups({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm agent groups');
    expect(error.originalErrors.map((e: any) => e.message)).toEqual([
      'Error importing alpha realm agent group group-1 of type WebAgentGroup',
      'Error importing alpha realm agent group group-3 of type IdentityGatewayAgentGroup',
    ]);
    expect(rootCause(error.originalErrors[0])).toBe(failure);
    expect(rootCause(error.originalErrors[1])).toBe(failure);
    expect(putAgentGroupByTypeAndId).toHaveBeenCalledTimes(3);
  });

  test('with a callback a group type that answers HTTP 501 is a failed group: named, with its cause, and the others are imported', async () => {
    const unsupported: any = new Error('HTTP 501');
    unsupported.response = { status: 501 };
    failGroup('group-2', unsupported);
    const outcomes: any[] = [];

    const result = await importAgentGroups({
      importData: importData(),
      resultCallback: (error, group) => outcomes.push([error, group]),
      state,
    });

    expect(ids(result)).toEqual(['group-1', 'group-3']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(
      'Error importing alpha realm agent group group-2 of type J2EEAgentGroup'
    );
    expect(outcomes[1][1]).toBeUndefined();
    expect(rootCause(outcomes[1][0])).toBe(unsupported);
    expect(outcomes[2][0]).toBeUndefined();
  });

  test('without a callback a group type that answers HTTP 501 fails the import after every group was tried', async () => {
    const unsupported: any = new Error('HTTP 501');
    unsupported.httpStatus = 501;
    failGroup('group-2', unsupported);

    const error: any = await importAgentGroups({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm agent groups');
    expect(error.originalErrors.map((e: any) => e.message)).toEqual([
      'Error importing alpha realm agent group group-2 of type J2EEAgentGroup',
    ]);
    expect(rootCause(error.originalErrors[0])).toBe(unsupported);
    expect(putAgentGroupByTypeAndId).toHaveBeenCalledTimes(3);
  });

  test('every group is reported exactly once, in order, also when the callback throws', async () => {
    failGroup('group-2');
    const calls: string[] = [];
    const boom = new Error('callback failed');

    const error: any = await importAgentGroups({
      importData: importData(),
      resultCallback: (failed, group) => {
        calls.push(failed ? failed.message : group._id);
        if (group?._id === 'group-1') throw boom;
      },
      state,
    }).catch((e) => e);

    // the exception of the callback ends the run; it is not reported back as
    // a failed group
    expect(calls).toEqual(['group-1']);
    expect(rootCause(error)).toBe(boom);
    expect(putAgentGroupByTypeAndId).toHaveBeenCalledTimes(1);
  });

  test('import data without groups still throws, with a callback too', async () => {
    const callback = jest.fn();

    await expect(
      importAgentGroups({
        importData: {} as any,
        resultCallback: callback,
        state,
      })
    ).rejects.toBeDefined();
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('importAgentGroups on the facade', () => {
  test('passes the result callback on', async () => {
    failGroup('group-2');
    const callback = jest.fn();

    const result = await AgentOps(state).importAgentGroups(
      importData(),
      callback
    );

    expect(ids(result)).toEqual(['group-1', 'group-3']);
    expect(callback).toHaveBeenCalledTimes(3);
    expect((callback.mock.calls[1][0] as any).message).toBe(
      'Error importing alpha realm agent group group-2 of type J2EEAgentGroup'
    );
  });

  test('without a callback it throws one combined error as before', async () => {
    failGroup('group-2');

    const error: any = await AgentOps(state)
      .importAgentGroups(importData())
      .catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm agent groups');
    expect(putAgentGroupByTypeAndId).toHaveBeenCalledTimes(3);
  });
});

describe('importAgentGroups: Soap STS agent groups', () => {
  const stsData = (): any => ({
    agentGroup: {
      'group-1': { _id: 'group-1', _type: { _id: 'WebAgent' } },
      'sts-1': { _id: 'sts-1', _type: { _id: 'SoapSTSAgent' } },
    },
  });
  const stateOf = (deploymentType: string): any => ({
    ...state,
    getDeploymentType: () => deploymentType,
  });

  test.each(['cloud', 'forgeops'])(
    'with a callback a Soap STS group is a failed group on a %s deployment, nothing is sent for it, the other group is imported',
    async (deploymentType) => {
      const outcomes: any[] = [];

      const result = await importAgentGroups({
        importData: stsData(),
        resultCallback: (error, group) => outcomes.push([error, group]),
        state: stateOf(deploymentType),
      });

      expect(ids(result)).toEqual(['group-1']);
      expect(outcomes.map(([error]) => error?.message)).toEqual([
        undefined,
        'Error importing alpha realm agent group sts-1 of type SoapSTSAgent',
      ]);
      expect(rootCause(outcomes[1][0]).message).toBe(
        `Can't import alpha realm Soap STS agent groups for '${deploymentType}' deployment type.`
      );
      expect(putAgentGroupByTypeAndId).toHaveBeenCalledTimes(1);
      expect(putAgentGroupByTypeAndId.mock.calls[0][0]).toMatchObject({
        agentType: 'WebAgent',
        agentGroupId: 'group-1',
      });
    }
  );

  test('without a callback a Soap STS group on a cloud deployment fails the import after the other groups were tried', async () => {
    const error: any = await importAgentGroups({
      importData: stsData(),
      state: stateOf('cloud'),
    }).catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm agent groups');
    expect(error.originalErrors.map((e: any) => e.message)).toEqual([
      'Error importing alpha realm agent group sts-1 of type SoapSTSAgent',
    ]);
    expect(rootCause(error.originalErrors[0]).message).toBe(
      "Can't import alpha realm Soap STS agent groups for 'cloud' deployment type."
    );
    expect(putAgentGroupByTypeAndId).toHaveBeenCalledTimes(1);
  });

  test('a Soap STS group is imported on a classic deployment', async () => {
    const result = await importAgentGroups({
      importData: stsData(),
      state: stateOf('classic'),
    });

    expect(ids(result)).toEqual(['group-1', 'sts-1']);
    expect(putAgentGroupByTypeAndId).toHaveBeenCalledTimes(2);
    expect(putAgentGroupByTypeAndId.mock.calls[1][0]).toMatchObject({
      agentType: 'SoapSTSAgent',
      agentGroupId: 'sts-1',
    });
  });
});
