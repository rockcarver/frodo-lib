import { jest } from '@jest/globals';

/**
 * `exportPolicies`, `exportPoliciesByPolicySet` and `importPolicies` take an optional result
 * callback (frodo-lib#957). With it, the outcome of every policy is passed to it once, as it
 * happens: a policy that was exported or imported completely as the policy, a policy whose
 * prerequisites or dependencies failed as one error that names the policy and carries the
 * causes. A failed policy does not stop the others, is left out of the export or of the result,
 * and the function does not throw for it. A failure to read the policies still throws.
 * Without a callback nothing changes: one combined error is thrown after every policy was tried.
 * Mocked unit test: no recordings.
 */

const getPolicies = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
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
  getPolicies,
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

const getPolicySet = jest.fn(async (args?: any): Promise<any> => ({
  _id: args.policySetName,
  name: args.policySetName,
}));
const actualPolicySetApi = await import('../api/PolicySetApi');
jest.unstable_mockModule('../api/PolicySetApi', () => ({
  ...actualPolicySetApi,
  getPolicySet,
}));

const readScript = jest.fn(async (args?: any): Promise<any> => ({
  _id: args.scriptId,
  name: `script ${args.scriptId}`,
  script: Buffer.from(`log("${args.scriptId}")`).toString('base64'),
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

const updateResourceType = jest.fn(async (args?: any): Promise<any> => ({
  ...args.resourceTypeData,
}));
const actualResourceTypeOps = await import('./ResourceTypeOps');
jest.unstable_mockModule('./ResourceTypeOps', () => ({
  ...actualResourceTypeOps,
  updateResourceType,
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
  default: PolicyOps,
  exportPolicies,
  exportPoliciesByPolicySet,
  importPolicies,
} = await import('./PolicyOps');
const { default: State } = await import('../shared/State');

const state = State({});
state.setRealm('alpha');

const NO_DEPS = { deps: false, prereqs: false, useStringArrays: false };
const DEPS = { deps: true, prereqs: false, useStringArrays: false };
// the policy set is skipped (policySetName), only the resource types are prerequisites
const PREREQS = { deps: false, prereqs: true, policySetName: 'app' };

/** A policy, optionally with scripts in its condition. */
const policy = (id: string, scriptIds: string[] = [], extra = {}): any => ({
  _id: id,
  name: id,
  applicationName: 'app',
  resourceTypeUuid: `rt-${id}`,
  condition: scriptIds.length
    ? {
        type: 'AND',
        conditions: scriptIds.map((scriptId) => ({ type: 'Script', scriptId })),
      }
    : undefined,
  ...extra,
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
    getPolicies,
    getPoliciesByPolicySet,
    getPolicy,
    putPolicy,
    getResourceType,
    getPolicySet,
    readScript,
    updateScript,
    updateResourceType,
    createProgressIndicator,
    stopProgressIndicator,
  ]) {
    mock.mockClear();
  }
  getPolicies.mockImplementation(async () => ({ result: [] }));
  getPoliciesByPolicySet.mockImplementation(async () => ({ result: [] }));
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
    script: Buffer.from(`log("${args.scriptId}")`).toString('base64'),
  }));
  updateScript.mockImplementation(async (args: any) => ({
    ...args.scriptData,
  }));
  updateResourceType.mockImplementation(async (args: any) => ({
    ...args.resourceTypeData,
  }));
});

describe('exportPolicies', () => {
  const policies = () => [
    policy('a', ['s1']),
    policy('b', ['s2']),
    policy('c', ['s3']),
  ];

  test('without a callback: exports every policy with its scripts', async () => {
    getPolicies.mockResolvedValue({ result: policies() });

    const exportData = await exportPolicies({ options: DEPS, state });

    expect(Object.keys(exportData.policy)).toEqual(['a', 'b', 'c']);
    expect(Object.keys(exportData.script)).toEqual(['s1', 's2', 's3']);
  });

  test('with a callback: reports every policy once, in order, and exports the same as without', async () => {
    getPolicies.mockResolvedValue({ result: policies() });
    const plain = await exportPolicies({ options: DEPS, state });
    getPolicies.mockResolvedValue({ result: policies() });

    const exportData = await exportPolicies({
      options: DEPS,
      resultCallback: callback,
      state,
    });

    expect(withoutMeta(exportData)).toEqual(withoutMeta(plain));
    expect(outcomes.map((o) => o.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map((o) => o.result?._id)).toEqual(['a', 'b', 'c']);
  });

  test('with a callback: a policy whose script cannot be read is a failed item, the others are exported', async () => {
    getPolicies.mockResolvedValue({ result: policies() });
    readScript.mockImplementation(async (args: any) => {
      if (args.scriptId === 's2') throw new Error('script s2: HTTP 500');
      return {
        _id: args.scriptId,
        name: `script ${args.scriptId}`,
        script: Buffer.from('x').toString('base64'),
      };
    });

    const exportData = await exportPolicies({
      options: DEPS,
      resultCallback: callback,
      state,
    });

    // the policies that could be exported completely, and nothing of the failed one
    expect(Object.keys(exportData.policy)).toEqual(['a', 'c']);
    expect(Object.keys(exportData.script)).toEqual(['s1', 's3']);
    // each policy exactly once: two successes, one failure that names the policy
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].result?._id).toBe('a');
    expect(outcomes[2].result?._id).toBe('c');
    const failure = outcomes[1];
    expect(failure.result).toBeUndefined();
    expect(failure.error.message).toContain('policy b');
    expect(messagesOf(failure.error)).toContain('script s2: HTTP 500');
    expect(failure.error.originalErrors.length).toBeGreaterThan(0);
  });

  test('with a callback: a policy that fails after one of its dependencies was read leaves nothing behind in the export', async () => {
    // b has two scripts: the first is read, the second fails
    getPolicies.mockResolvedValue({
      result: [policy('a', ['s1']), policy('b', ['s2', 's3'])],
    });
    readScript.mockImplementation(async (args: any) => {
      if (args.scriptId === 's3') throw new Error('script s3: HTTP 500');
      return {
        _id: args.scriptId,
        name: `script ${args.scriptId}`,
        script: Buffer.from('x').toString('base64'),
      };
    });

    const exportData = await exportPolicies({
      options: DEPS,
      resultCallback: callback,
      state,
    });

    expect(Object.keys(exportData.policy)).toEqual(['a']);
    expect(Object.keys(exportData.script)).toEqual(['s1']);
  });

  test('with a callback: a policy whose prerequisites and dependencies both fail is reported once with both causes', async () => {
    getPolicies.mockResolvedValue({ result: [policy('a', ['s1'])] });
    getResourceType.mockRejectedValue(new Error('resource type: HTTP 500'));
    readScript.mockRejectedValue(new Error('script: HTTP 500'));

    await exportPolicies({
      options: { deps: true, prereqs: true, useStringArrays: false },
      resultCallback: callback,
      state,
    });

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].error.originalErrors).toHaveLength(2);
    expect(messagesOf(outcomes[0].error)).toContain('resource type: HTTP 500');
    expect(messagesOf(outcomes[0].error)).toContain('script: HTTP 500');
  });

  test('with a callback: every policy failing reports every policy and returns an empty export without throwing', async () => {
    getPolicies.mockResolvedValue({ result: policies() });
    readScript.mockRejectedValue(new Error('script: HTTP 500'));

    const exportData = await exportPolicies({
      options: DEPS,
      resultCallback: callback,
      state,
    });

    expect(exportData.policy).toEqual({});
    expect(exportData.script).toEqual({});
    expect(outcomes).toHaveLength(3);
    expect(outcomes.every((o) => o.error && !o.result)).toBe(true);
    expect(
      outcomes.map((o) => /policy ([abc])/.exec(o.error.message)?.[1])
    ).toEqual(['a', 'b', 'c']);
  });

  test('with a callback: the progress indicator ends as a failure that says how many policies were exported', async () => {
    getPolicies.mockResolvedValue({ result: policies() });
    readScript.mockImplementation(async (args: any) => {
      if (args.scriptId === 's2') throw new Error('script s2: HTTP 500');
      return { _id: args.scriptId, name: 'n', script: 'eA==' };
    });

    await exportPolicies({
      options: DEPS,
      resultCallback: callback,
      state,
    });

    expect(stopProgressIndicator).toHaveBeenCalledTimes(1);
    const arg: any = stopProgressIndicator.mock.calls[0][0];
    expect(arg.status).toBe('fail');
    expect(arg.message).toContain('Exported 2 of 3');
  });

  test('with a callback: failing to read the policies still throws and reports nothing', async () => {
    getPolicies.mockRejectedValue(new Error('list: HTTP 500'));

    const error: any = await exportPolicies({
      options: DEPS,
      resultCallback: callback,
      state,
    }).catch((e) => e);

    expect(error.message).toContain('policies');
    expect(messagesOf(error)).toContain('list: HTTP 500');
    expect(outcomes).toEqual([]);
  });

  test('without a callback: a policy that fails is thrown as one combined error after every policy was tried', async () => {
    getPolicies.mockResolvedValue({ result: policies() });
    readScript.mockImplementation(async (args: any) => {
      if (args.scriptId === 's2') throw new Error('script s2: HTTP 500');
      return { _id: args.scriptId, name: 'n', script: 'eA==' };
    });

    const error: any = await exportPolicies({ options: DEPS, state }).catch(
      (e) => e
    );

    // unchanged: the combined error of the whole export, with the raw dependency error nested
    expect(error.message).toBe('Error exporting alpha realm policies');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      'Error exporting alpha realm policy dependencies'
    );
    expect(messagesOf(error)).toContain('script s2: HTTP 500');
    // every policy was still tried
    expect(readScript.mock.calls.map(([a]: any) => a.scriptId)).toEqual([
      's1',
      's2',
      's3',
    ]);
    expect(stopProgressIndicator.mock.calls[0][0]).toMatchObject({
      status: 'fail',
      message: 'Error exporting alpha realm policies.',
    });
  });

  test('the facade passes the callback on', async () => {
    getPolicies.mockResolvedValue({ result: [policy('a')] });

    await PolicyOps(state).exportPolicies(NO_DEPS, callback);

    expect(outcomes.map((o) => o.result?._id)).toEqual(['a']);
  });

  test('the facade without a callback keeps the default options and the old behaviour', async () => {
    getPolicies.mockResolvedValue({ result: [policy('a', ['s1'])] });

    const exportData = await PolicyOps(state).exportPolicies();

    expect(Object.keys(exportData.policy)).toEqual(['a']);
    expect(Object.keys(exportData.script)).toEqual(['s1']);
  });
});

describe('exportPoliciesByPolicySet', () => {
  const policies = () => [
    policy('a', ['s1']),
    policy('b', ['s2']),
    policy('c', ['s3']),
  ];

  test('with a callback: reports every policy once and exports the same as without', async () => {
    getPoliciesByPolicySet.mockResolvedValue({ result: policies() });
    const plain = await exportPoliciesByPolicySet({
      policySetName: 'app',
      options: DEPS,
      state,
    });
    getPoliciesByPolicySet.mockResolvedValue({ result: policies() });

    const exportData = await exportPoliciesByPolicySet({
      policySetName: 'app',
      options: DEPS,
      resultCallback: callback,
      state,
    });

    expect(withoutMeta(exportData)).toEqual(withoutMeta(plain));
    expect(outcomes.map((o) => o.result?._id)).toEqual(['a', 'b', 'c']);
    expect(outcomes.every((o) => !o.error)).toBe(true);
  });

  test('with a callback: a failed policy is named, the others are exported', async () => {
    getPoliciesByPolicySet.mockResolvedValue({ result: policies() });
    readScript.mockImplementation(async (args: any) => {
      if (args.scriptId === 's1') throw new Error('script s1: HTTP 500');
      return { _id: args.scriptId, name: 'n', script: 'eA==' };
    });

    const exportData = await exportPoliciesByPolicySet({
      policySetName: 'app',
      options: DEPS,
      resultCallback: callback,
      state,
    });

    expect(Object.keys(exportData.policy)).toEqual(['b', 'c']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].error.message).toContain('policy a');
    expect(messagesOf(outcomes[0].error)).toContain('script s1: HTTP 500');
    expect(outcomes[1].result?._id).toBe('b');
    expect(outcomes[2].result?._id).toBe('c');
  });

  test('with a callback: every policy failing returns an empty export without throwing', async () => {
    getPoliciesByPolicySet.mockResolvedValue({ result: policies() });
    readScript.mockRejectedValue(new Error('script: HTTP 500'));

    const exportData = await exportPoliciesByPolicySet({
      policySetName: 'app',
      options: DEPS,
      resultCallback: callback,
      state,
    });

    expect(exportData.policy).toEqual({});
    expect(outcomes).toHaveLength(3);
    expect(outcomes.every((o) => o.error)).toBe(true);
  });

  test('with a callback: failing to read the policies of the set still throws', async () => {
    getPoliciesByPolicySet.mockRejectedValue(new Error('list: HTTP 404'));

    const error: any = await exportPoliciesByPolicySet({
      policySetName: 'app',
      options: DEPS,
      resultCallback: callback,
      state,
    }).catch((e) => e);

    expect(error.message).toBe(
      'Error exporting alpha realm policies in set app'
    );
    expect(messagesOf(error)).toContain('list: HTTP 404');
    expect(outcomes).toEqual([]);
  });

  test('without a callback: the failures are thrown as one combined error', async () => {
    getPoliciesByPolicySet.mockResolvedValue({ result: policies() });
    readScript.mockImplementation(async (args: any) => {
      if (args.scriptId === 's3') throw new Error('script s3: HTTP 500');
      return { _id: args.scriptId, name: 'n', script: 'eA==' };
    });

    const error: any = await exportPoliciesByPolicySet({
      policySetName: 'app',
      options: DEPS,
      state,
    }).catch((e) => e);

    expect(error.message).toBe(
      'Error exporting alpha realm policies in set app'
    );
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      'Error exporting alpha realm policy dependencies'
    );
    expect(readScript).toHaveBeenCalledTimes(3);
  });

  test('the facade passes the callback on', async () => {
    getPoliciesByPolicySet.mockResolvedValue({ result: [policy('a')] });

    await PolicyOps(state).exportPoliciesByPolicySet('app', NO_DEPS, callback);

    expect(outcomes.map((o) => o.result?._id)).toEqual(['a']);
  });
});

describe('importPolicies', () => {
  const importData = (): any => ({
    script: {
      s1: { _id: 's1', name: 'one' },
      s2: { _id: 's2', name: 'two' },
      s3: { _id: 's3', name: 'three' },
    },
    resourcetype: {
      'rt-a': { _id: 'rt-a', uuid: 'rt-a' },
      'rt-b': { _id: 'rt-b', uuid: 'rt-b' },
      'rt-c': { _id: 'rt-c', uuid: 'rt-c' },
    },
    policyset: {},
    policy: {
      a: policy('a', ['s1']),
      b: policy('b', ['s2']),
      c: policy('c', ['s3']),
    },
  });
  /** Writing policy b fails. */
  const failPolicyB = () =>
    putPolicy.mockImplementation(async (args: any) => {
      if (args.policyId === 'b') throw new Error('policy b: HTTP 500');
      return { ...args.policyData };
    });

  test('without a callback: imports every policy', async () => {
    const response = await importPolicies({
      importData: importData(),
      options: DEPS,
      state,
    });

    expect(response.map((p) => p._id)).toEqual(['a', 'b', 'c']);
  });

  test('with a callback: reports every policy once, in order, and returns the same as without', async () => {
    const plain = await importPolicies({
      importData: importData(),
      options: DEPS,
      state,
    });

    const response = await importPolicies({
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
    expect(outcomes.map((o) => o.result?._id)).toEqual(['a', 'b', 'c']);
  });

  test('with a callback: a policy that needs no update is reported as it is in the import data and is not in the result', async () => {
    const data = importData();
    // the tenant has the same policy a: the update is skipped
    getPolicy.mockImplementation(async (args: any) => {
      if (args.policyId === 'a') return { ...data.policy.a, _rev: '7' };
      throw Object.assign(new Error('not found'), {
        response: { status: 404 },
      });
    });

    const response = await importPolicies({
      importData: data,
      options: NO_DEPS,
      resultCallback: callback,
      state,
    });

    expect(response.map((p) => p._id)).toEqual(['b', 'c']);
    expect(outcomes.map((o) => o.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes[0].result?._id).toBe('a');
    expect(putPolicy.mock.calls.map(([a]: any) => a.policyId)).toEqual([
      'b',
      'c',
    ]);
  });

  test('with a callback: a policy that cannot be written is a failed item that names it, the others are imported, the function does not throw', async () => {
    failPolicyB();

    const response = await importPolicies({
      importData: importData(),
      options: DEPS,
      resultCallback: callback,
      state,
    });

    expect(response.map((p) => p._id)).toEqual(['a', 'c']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].result?._id).toBe('a');
    expect(outcomes[2].result?._id).toBe('c');
    expect(outcomes[1].result).toBeUndefined();
    expect(outcomes[1].error.message).toBe(
      'Error importing alpha realm policy b'
    );
    expect(messagesOf(outcomes[1].error)).toContain('policy b: HTTP 500');
    // the dependencies of the others were imported
    expect(updateScript.mock.calls.map(([a]: any) => a.scriptId)).toEqual([
      's1',
      's2',
      's3',
    ]);
  });

  test('with a callback: a policy that was written but whose script cannot be imported is one failed item and not part of the result', async () => {
    updateScript.mockImplementation(async (args: any) => {
      if (args.scriptId === 's1') throw new Error('script s1: HTTP 500');
      return { ...args.scriptData };
    });

    const response = await importPolicies({
      importData: importData(),
      options: DEPS,
      resultCallback: callback,
      state,
    });

    expect(response.map((p) => p._id)).toEqual(['b', 'c']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].error.message).toContain('policy a');
    expect(messagesOf(outcomes[0].error)).toContain('script s1: HTTP 500');
    expect(outcomes[1].result?._id).toBe('b');
  });

  test('with a callback: a policy that fails in two steps is reported once with both causes', async () => {
    putPolicy.mockRejectedValue(new Error('policy: HTTP 500'));
    updateScript.mockRejectedValue(new Error('script: HTTP 500'));

    await importPolicies({
      importData: importData(),
      options: DEPS,
      resultCallback: callback,
      state,
    });

    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].error.originalErrors).toHaveLength(2);
    expect(messagesOf(outcomes[0].error)).toContain('policy: HTTP 500');
    expect(messagesOf(outcomes[0].error)).toContain('script: HTTP 500');
  });

  test('with a callback: a policy whose import data lacks its script is a failed item, nothing is written for it', async () => {
    const data = importData();
    delete data.script.s2;

    const response = await importPolicies({
      importData: data,
      options: DEPS,
      resultCallback: callback,
      state,
    });

    expect(response.map((p) => p._id)).toEqual(['a', 'c']);
    expect(outcomes[1].error.message).toContain('policy b');
    expect(messagesOf(outcomes[1].error)).toContain('s2');
    expect(putPolicy.mock.calls.map(([a]: any) => a.policyId)).toEqual([
      'a',
      'c',
    ]);
  });

  test('with a callback: a policy whose prerequisite cannot be imported is a failed item', async () => {
    updateResourceType.mockImplementation(async (args: any) => {
      if (args.resourceTypeUuid === 'rt-c')
        throw new Error('resource type rt-c: HTTP 500');
      return { ...args.resourceTypeData };
    });

    const response = await importPolicies({
      importData: importData(),
      options: PREREQS,
      resultCallback: callback,
      state,
    });

    expect(response.map((p) => p._id)).toEqual(['a', 'b']);
    expect(outcomes[2].error.message).toContain('policy c');
    expect(messagesOf(outcomes[2].error)).toContain('rt-c');
  });

  test('with a callback: every policy failing reports every policy, returns an empty result and does not throw', async () => {
    putPolicy.mockRejectedValue(new Error('policy: HTTP 500'));

    const response = await importPolicies({
      importData: importData(),
      options: NO_DEPS,
      resultCallback: callback,
      state,
    });

    expect(response).toEqual([]);
    expect(outcomes).toHaveLength(3);
    expect(
      outcomes.map((o) => /policy ([abc])$/.exec(o.error.message)?.[1])
    ).toEqual(['a', 'b', 'c']);
  });

  test('without a callback: the failures are thrown as one combined error after every policy was tried', async () => {
    failPolicyB();

    const error: any = await importPolicies({
      importData: importData(),
      options: DEPS,
      state,
    }).catch((e) => e);

    // unchanged: the combined error with the raw error of the failed write nested
    expect(error.message).toBe('Error importing alpha realm policies');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toContain(
      'Error updating alpha realm policy b'
    );
    expect(messagesOf(error)).toContain('policy b: HTTP 500');
    // every policy was tried
    expect(putPolicy).toHaveBeenCalledTimes(3);
    expect(updateScript).toHaveBeenCalledTimes(3);
  });

  test('without a callback: the errors of several policies are all in the combined error, in the order they happened', async () => {
    putPolicy.mockRejectedValue(new Error('policy: HTTP 500'));
    updateScript.mockRejectedValue(new Error('script: HTTP 500'));

    const error: any = await importPolicies({
      importData: importData(),
      options: DEPS,
      state,
    }).catch((e) => e);

    expect(error.originalErrors).toHaveLength(6);
    expect(
      error.originalErrors.map((e: any) =>
        e.message.includes('soft dependencies') ? 'script' : 'policy'
      )
    ).toEqual(['policy', 'script', 'policy', 'script', 'policy', 'script']);
  });

  test('the facade passes the callback on', async () => {
    await PolicyOps(state).importPolicies(importData(), NO_DEPS, callback);

    expect(outcomes.map((o) => o.result?._id)).toEqual(['a', 'b', 'c']);
  });
});
