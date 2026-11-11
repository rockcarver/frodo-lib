import { jest } from '@jest/globals';

/**
 * `exportPolicySets` and `importPolicySets` take an optional result callback (frodo-lib#957).
 * With it, the outcome of every policy set is passed to it once, as it happens: a policy set
 * that was exported or imported completely as the policy set, a policy set whose prerequisites
 * or dependencies failed as one error that names the policy set and carries the cause. A failed
 * policy set does not stop the others, is left out of the export or of the result, and the
 * function does not throw for it. A failure to read the policy sets still throws.
 * Without a callback nothing changes: one combined error is thrown after every policy set was tried.
 * Mocked unit test: no recordings.
 */

const getPolicySets = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const getPolicySet = jest.fn(async (_args?: any): Promise<any> => {
  throw Object.assign(new Error('not found'), { response: { status: 404 } });
});
const updatePolicySetApi = jest.fn(async (args?: any): Promise<any> => ({
  ...args.policySetData,
}));
const createPolicySetApi = jest.fn(async (args?: any): Promise<any> => ({
  ...args.policySetData,
}));
const actualPolicySetApi = await import('../api/PolicySetApi');
jest.unstable_mockModule('../api/PolicySetApi', () => ({
  ...actualPolicySetApi,
  getPolicySets,
  getPolicySet,
  updatePolicySet: updatePolicySetApi,
  createPolicySet: createPolicySetApi,
}));

const getPoliciesByPolicySet = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const getPolicy = jest.fn(async (_args?: any): Promise<any> => {
  throw Object.assign(new Error('not found'), { response: { status: 404 } });
});
const putPolicy = jest.fn(async (args?: any): Promise<any> => ({
  ...args.policyData,
}));
const actualPoliciesApi = await import('../api/PoliciesApi');
jest.unstable_mockModule('../api/PoliciesApi', () => ({
  ...actualPoliciesApi,
  getPoliciesByPolicySet,
  getPolicy,
  putPolicy,
}));

const getResourceType = jest.fn(async (args?: any): Promise<any> => ({
  _id: args.resourceTypeUuid,
  uuid: args.resourceTypeUuid,
}));
const actualResourceTypesApi = await import('../api/ResourceTypesApi');
jest.unstable_mockModule('../api/ResourceTypesApi', () => ({
  ...actualResourceTypesApi,
  getResourceType,
}));

const readScript = jest.fn(async (args?: any): Promise<any> => ({
  _id: args.scriptId,
  name: `script ${args.scriptId}`,
  script: Buffer.from('x').toString('base64'),
}));
const updateScript = jest.fn(async (args?: any): Promise<any> => ({
  ...args.scriptData,
}));
const actualScriptOps = await import('./ScriptOps');
jest.unstable_mockModule('./ScriptOps', () => ({
  ...actualScriptOps,
  readScript,
  updateScript,
}));

const importResourceType = jest.fn(async (args?: any): Promise<any> => ({
  ...args.importData.resourcetype[args.resourceTypeUuid],
}));
const actualResourceTypeOps = await import('./ResourceTypeOps');
jest.unstable_mockModule('./ResourceTypeOps', () => ({
  ...actualResourceTypeOps,
  importResourceType,
}));

const createProgressIndicator = jest.fn(() => 'progress-id');
const stopProgressIndicator = jest.fn();
const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  createProgressIndicator,
  stopProgressIndicator,
  updateProgressIndicator: jest.fn(),
  debugMessage: jest.fn(),
}));

const {
  default: PolicySetOps,
  exportPolicySets,
  importPolicySets,
} = await import('./PolicySetOps');
const { default: State } = await import('../shared/State');

const state = State({});
state.setRealm('alpha');

const NO_DEPS = { deps: false, prereqs: false, useStringArrays: false };
const DEPS = { deps: true, prereqs: false, useStringArrays: false };
const PREREQS = { deps: false, prereqs: true, useStringArrays: false };

/** A policy set that uses the resource type of the same name. */
const policySet = (name: string): any => ({
  _id: name,
  name,
  resourceTypeUuids: [`rt-${name}`],
});

/** A policy of a policy set, with one script in its condition. */
const policyOf = (setName: string, scriptId: string): any => ({
  _id: `${setName}-policy`,
  name: `${setName}-policy`,
  applicationName: setName,
  condition: { type: 'Script', scriptId },
});

/** The messages of an error and of everything nested in it. */
function messagesOf(error: any): string {
  return [error?.message, ...(error?.originalErrors ?? []).map(messagesOf)]
    .filter(Boolean)
    .join(' | ');
}

type Outcome = { error?: any; result?: any };
let outcomes: Outcome[];
const callback = (error?: any, result?: any) =>
  outcomes.push({ error, result });

/** An export with the meta data taken out, which differs between two exports. */
const withoutMeta = (exportData: any) => {
  const { meta, ...rest } = exportData;
  void meta;
  return rest;
};

beforeEach(() => {
  outcomes = [];
  for (const mock of [
    getPolicySets,
    getPolicySet,
    updatePolicySetApi,
    createPolicySetApi,
    getPoliciesByPolicySet,
    getPolicy,
    putPolicy,
    getResourceType,
    readScript,
    updateScript,
    importResourceType,
    createProgressIndicator,
    stopProgressIndicator,
  ]) {
    mock.mockClear();
  }
  getPolicySets.mockImplementation(async () => ({ result: [] }));
  getPolicySet.mockImplementation(async () => {
    throw Object.assign(new Error('not found'), { response: { status: 404 } });
  });
  updatePolicySetApi.mockImplementation(async (args: any) => ({
    ...args.policySetData,
  }));
  createPolicySetApi.mockImplementation(async (args: any) => ({
    ...args.policySetData,
  }));
  getPoliciesByPolicySet.mockImplementation(async (args: any) => ({
    result: [policyOf(args.policySetId, `s-${args.policySetId}`)],
  }));
  getPolicy.mockImplementation(async () => {
    throw Object.assign(new Error('not found'), { response: { status: 404 } });
  });
  putPolicy.mockImplementation(async (args: any) => ({ ...args.policyData }));
  getResourceType.mockImplementation(async (args: any) => ({
    _id: args.resourceTypeUuid,
    uuid: args.resourceTypeUuid,
  }));
  readScript.mockImplementation(async (args: any) => ({
    _id: args.scriptId,
    name: `script ${args.scriptId}`,
    script: Buffer.from('x').toString('base64'),
  }));
  updateScript.mockImplementation(async (args: any) => ({
    ...args.scriptData,
  }));
  importResourceType.mockImplementation(async (args: any) => ({
    ...args.importData.resourcetype[args.resourceTypeUuid],
  }));
});

describe('exportPolicySets', () => {
  const sets = () => [policySet('a'), policySet('b'), policySet('c')];

  test('without a callback: exports every policy set with its policies, scripts and resource types', async () => {
    getPolicySets.mockResolvedValue({ result: sets() });

    const exportData = await exportPolicySets({
      options: { ...DEPS, prereqs: true },
      state,
    });

    expect(Object.keys(exportData.policyset)).toEqual(['a', 'b', 'c']);
    expect(Object.keys(exportData.policy)).toEqual([
      'a-policy',
      'b-policy',
      'c-policy',
    ]);
    expect(Object.keys(exportData.script)).toEqual(['s-a', 's-b', 's-c']);
    expect(Object.keys(exportData.resourcetype)).toEqual([
      'rt-a',
      'rt-b',
      'rt-c',
    ]);
  });

  test('with a callback: reports every policy set once, in order, and exports the same as without', async () => {
    const options = { ...DEPS, prereqs: true };
    getPolicySets.mockResolvedValue({ result: sets() });
    const plain = await exportPolicySets({ options, state });

    const exportData = await exportPolicySets({
      options,
      resultCallback: callback,
      state,
    });

    expect(withoutMeta(exportData)).toEqual(withoutMeta(plain));
    expect(outcomes.map((o) => o.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map((o) => o.result?.name)).toEqual(['a', 'b', 'c']);
  });

  test('with a callback: a policy set whose dependencies cannot be read is a failed item that names it and leaves nothing behind', async () => {
    getPolicySets.mockResolvedValue({ result: sets() });
    readScript.mockImplementation(async (args: any) => {
      if (args.scriptId === 's-b') throw new Error('script s-b: HTTP 500');
      return { _id: args.scriptId, name: 'n', script: 'eA==' };
    });

    const exportData = await exportPolicySets({
      options: DEPS,
      resultCallback: callback,
      state,
    });

    expect(Object.keys(exportData.policyset)).toEqual(['a', 'c']);
    // b-policy was read before its script failed: it is not in the export
    expect(Object.keys(exportData.policy)).toEqual(['a-policy', 'c-policy']);
    expect(Object.keys(exportData.script)).toEqual(['s-a', 's-c']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].result?.name).toBe('a');
    expect(outcomes[2].result?.name).toBe('c');
    expect(outcomes[1].result).toBeUndefined();
    expect(outcomes[1].error.message).toBe(
      'Error exporting alpha realm policy set b'
    );
    expect(outcomes[1].error.originalErrors).toHaveLength(1);
    expect(outcomes[1].error.originalErrors[0].message).toContain(
      'policy set b dependencies'
    );
  });

  test('with a callback: a policy set whose resource type cannot be read is a failed item with the cause nested', async () => {
    getPolicySets.mockResolvedValue({ result: sets() });
    getResourceType.mockImplementation(async (args: any) => {
      if (args.resourceTypeUuid === 'rt-c')
        throw new Error('resource type rt-c: HTTP 500');
      return { _id: args.resourceTypeUuid, uuid: args.resourceTypeUuid };
    });

    const exportData = await exportPolicySets({
      options: PREREQS,
      resultCallback: callback,
      state,
    });

    expect(Object.keys(exportData.policyset)).toEqual(['a', 'b']);
    expect(Object.keys(exportData.resourcetype)).toEqual(['rt-a', 'rt-b']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[2].error.message).toContain('policy set c');
    expect(messagesOf(outcomes[2].error)).toContain(
      'resource type rt-c: HTTP 500'
    );
  });

  test('with a callback: a policy set whose prerequisites and dependencies both fail is reported once', async () => {
    getPolicySets.mockResolvedValue({ result: [policySet('a')] });
    getResourceType.mockRejectedValue(new Error('resource type: HTTP 500'));
    readScript.mockRejectedValue(new Error('script: HTTP 500'));

    await exportPolicySets({
      options: { ...DEPS, prereqs: true },
      resultCallback: callback,
      state,
    });

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].error.originalErrors).toHaveLength(2);
    expect(messagesOf(outcomes[0].error)).toContain('resource type: HTTP 500');
  });

  test('with a callback: every policy set failing reports every policy set and returns an empty export without throwing', async () => {
    getPolicySets.mockResolvedValue({ result: sets() });
    getResourceType.mockRejectedValue(new Error('resource type: HTTP 500'));

    const exportData = await exportPolicySets({
      options: PREREQS,
      resultCallback: callback,
      state,
    });

    expect(exportData.policyset).toEqual({});
    expect(exportData.resourcetype).toEqual({});
    expect(outcomes).toHaveLength(3);
    expect(outcomes.every((o) => o.error && !o.result)).toBe(true);
  });

  test('with a callback: the progress indicator ends as a failure that says how many policy sets were exported', async () => {
    getPolicySets.mockResolvedValue({ result: sets() });
    getResourceType.mockImplementation(async (args: any) => {
      if (args.resourceTypeUuid === 'rt-b') throw new Error('HTTP 500');
      return { _id: args.resourceTypeUuid, uuid: args.resourceTypeUuid };
    });

    await exportPolicySets({
      options: PREREQS,
      resultCallback: callback,
      state,
    });

    expect(stopProgressIndicator).toHaveBeenCalledTimes(1);
    const arg: any = stopProgressIndicator.mock.calls[0][0];
    expect(arg.status).toBe('fail');
    expect(arg.message).toContain('Exported 2 of 3');
  });

  test('with a callback: failing to read the policy sets still throws and reports nothing', async () => {
    getPolicySets.mockRejectedValue(new Error('list: HTTP 500'));

    const error: any = await exportPolicySets({
      options: DEPS,
      resultCallback: callback,
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error exporting alpha realm policy sets');
    expect(messagesOf(error)).toContain('list: HTTP 500');
    expect(outcomes).toEqual([]);
  });

  test('without a callback: a policy set that fails is thrown as one combined error after every policy set was tried', async () => {
    getPolicySets.mockResolvedValue({ result: sets() });
    readScript.mockImplementation(async (args: any) => {
      if (args.scriptId === 's-b') throw new Error('script s-b: HTTP 500');
      return { _id: args.scriptId, name: 'n', script: 'eA==' };
    });

    const error: any = await exportPolicySets({ options: DEPS, state }).catch(
      (e) => e
    );

    // unchanged: the combined error of the whole export
    expect(error.message).toBe('Error exporting alpha realm policy sets');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      'Error exporting alpha realm policy set b dependencies'
    );
    // every policy set was tried
    expect(readScript.mock.calls.map(([a]: any) => a.scriptId)).toEqual([
      's-a',
      's-b',
      's-c',
    ]);
    expect(stopProgressIndicator.mock.calls[0][0]).toMatchObject({
      message: 'Exported 3 alpha realm policy sets.',
    });
  });

  test('the facade passes the callback on', async () => {
    getPolicySets.mockResolvedValue({ result: [policySet('a')] });

    await PolicySetOps(state).exportPolicySets(NO_DEPS, callback);

    expect(outcomes.map((o) => o.result?.name)).toEqual(['a']);
  });
});

describe('importPolicySets', () => {
  const importData = (): any => ({
    script: {
      's-a': { _id: 's-a', name: 'one' },
      's-b': { _id: 's-b', name: 'two' },
      's-c': { _id: 's-c', name: 'three' },
    },
    resourcetype: {
      'rt-a': { _id: 'rt-a', uuid: 'rt-a' },
      'rt-b': { _id: 'rt-b', uuid: 'rt-b' },
      'rt-c': { _id: 'rt-c', uuid: 'rt-c' },
    },
    policyset: {
      a: policySet('a'),
      b: policySet('b'),
      c: policySet('c'),
    },
    policy: {
      'a-policy': policyOf('a', 's-a'),
      'b-policy': policyOf('b', 's-b'),
      'c-policy': policyOf('c', 's-c'),
    },
  });
  /** Writing policy set b fails. */
  const failSetB = () =>
    updatePolicySetApi.mockImplementation(async (args: any) => {
      if (args.policySetData.name === 'b')
        throw new Error('policy set b: HTTP 500');
      return { ...args.policySetData };
    });

  test('without a callback: imports every policy set', async () => {
    const response = await importPolicySets({
      importData: importData(),
      options: DEPS,
      state,
    });

    expect(response.map((p) => p.name)).toEqual(['a', 'b', 'c']);
  });

  test('with a callback: reports every policy set once, in order, and returns the same as without', async () => {
    const plain = await importPolicySets({
      importData: importData(),
      options: DEPS,
      state,
    });

    const response = await importPolicySets({
      importData: importData(),
      options: DEPS,
      resultCallback: callback,
      state,
    });

    expect(response).toEqual(plain);
    expect(outcomes.map((o) => o.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map((o) => o.result?.name)).toEqual(['a', 'b', 'c']);
  });

  test('with a callback: a policy set that needs no update is reported as it is in the import data and is not in the result', async () => {
    const data = importData();
    getPolicySet.mockImplementation(async (args: any) => {
      if (args.policySetName === 'a') return { ...data.policyset.a, _rev: '3' };
      throw Object.assign(new Error('not found'), {
        response: { status: 404 },
      });
    });

    const response = await importPolicySets({
      importData: data,
      options: NO_DEPS,
      resultCallback: callback,
      state,
    });

    expect(response.map((p) => p.name)).toEqual(['b', 'c']);
    expect(outcomes.map((o) => o.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes[0].result?.name).toBe('a');
  });

  test('with a callback: a policy set that cannot be written is a failed item that names it, the others are imported, the function does not throw', async () => {
    failSetB();

    const response = await importPolicySets({
      importData: importData(),
      options: DEPS,
      resultCallback: callback,
      state,
    });

    expect(response.map((p) => p.name)).toEqual(['a', 'c']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].result?.name).toBe('a');
    expect(outcomes[2].result?.name).toBe('c');
    expect(outcomes[1].result).toBeUndefined();
    expect(outcomes[1].error.message).toBe(
      'Error importing alpha realm policy set b'
    );
    expect(messagesOf(outcomes[1].error)).toContain('policy set b: HTTP 500');
    // the dependencies of the others were imported
    expect(putPolicy.mock.calls.map(([a]: any) => a.policyId)).toEqual([
      'a-policy',
      'b-policy',
      'c-policy',
    ]);
  });

  test('with a callback: a policy set that was written but whose policy cannot be imported is one failed item and not part of the result', async () => {
    putPolicy.mockImplementation(async (args: any) => {
      if (args.policyId === 'a-policy') throw new Error('policy: HTTP 500');
      return { ...args.policyData };
    });

    const response = await importPolicySets({
      importData: importData(),
      options: DEPS,
      resultCallback: callback,
      state,
    });

    expect(response.map((p) => p.name)).toEqual(['b', 'c']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].error.message).toContain('policy set a');
    expect(messagesOf(outcomes[0].error)).toContain('policy: HTTP 500');
    expect(outcomes[1].result?.name).toBe('b');
  });

  test('with a callback: a policy set that fails in several steps is reported once with every cause', async () => {
    importResourceType.mockRejectedValue(new Error('resource type: HTTP 500'));
    updatePolicySetApi.mockRejectedValue(new Error('policy set: HTTP 500'));
    updateScript.mockRejectedValue(new Error('script: HTTP 500'));

    await importPolicySets({
      importData: importData(),
      options: { deps: true, prereqs: true },
      resultCallback: callback,
      state,
    });

    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].error.originalErrors).toHaveLength(3);
    expect(messagesOf(outcomes[0].error)).toContain('resource type: HTTP 500');
    expect(messagesOf(outcomes[0].error)).toContain('policy set: HTTP 500');
    expect(messagesOf(outcomes[0].error)).toContain('script: HTTP 500');
  });

  test('with a callback: every policy set failing reports every policy set, returns an empty result and does not throw', async () => {
    updatePolicySetApi.mockRejectedValue(new Error('policy set: HTTP 500'));

    const response = await importPolicySets({
      importData: importData(),
      options: NO_DEPS,
      resultCallback: callback,
      state,
    });

    expect(response).toEqual([]);
    expect(outcomes).toHaveLength(3);
    expect(
      outcomes.map((o) => /policy set ([abc])$/.exec(o.error.message)?.[1])
    ).toEqual(['a', 'b', 'c']);
  });

  test('without a callback: the failures are thrown as one combined error after every policy set was tried', async () => {
    failSetB();

    const error: any = await importPolicySets({
      importData: importData(),
      options: DEPS,
      state,
    }).catch((e) => e);

    // unchanged: the combined error with the raw error of the failed write nested
    expect(error.message).toBe('Error importing alpha realm policy sets');
    expect(error.originalErrors).toHaveLength(1);
    expect(messagesOf(error)).toContain('policy set b: HTTP 500');
    // every policy set was tried
    expect(updatePolicySetApi).toHaveBeenCalledTimes(3);
    expect(putPolicy).toHaveBeenCalledTimes(3);
  });

  test('the facade passes the callback on', async () => {
    await PolicySetOps(state).importPolicySets(importData(), NO_DEPS, callback);

    expect(outcomes.map((o) => o.result?.name)).toEqual(['a', 'b', 'c']);
  });
});
