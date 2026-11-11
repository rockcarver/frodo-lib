/**
 * Unit tests for the bulk functions of the CIMD profile module: delete all,
 * export, import, and the export file shape.
 *
 * Run with:
 *
 *        npm run test:only src/ops/OAuth2CIMDProfileOps.bulk
 *
 * They follow the contract of the other bulk functions: every item is tried,
 * the outcome of each is passed to an optional `resultCallback`, a failed item
 * does not stop the others, and without a callback the failures are collected
 * and thrown as one error after every item was tried. The api layer and the
 * agent type request are replaced by fakes, so every deployment shape is
 * asserted request by request. Nothing here needs a tenant or a recording.
 */
import { jest } from '@jest/globals';
import { FrodoError } from './FrodoError';

const getAgentTypes = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
jest.unstable_mockModule('../api/AgentApi', () => ({
  getAgentTypes,
}));

const getCIMDProfiles = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const getCIMDProfile = jest.fn(async (_args?: any): Promise<any> => ({}));
const putCIMDProfile = jest.fn(async (_args?: any): Promise<any> => ({
  status: 200,
  data: {},
}));
const deleteCIMDProfile = jest.fn(async (_args?: any): Promise<any> => ({}));
const getCIMDProfileTemplate = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const getCIMDProfileSchema = jest.fn(async (_args?: any): Promise<any> => ({}));
jest.unstable_mockModule('../api/OAuth2CIMDProfileApi', () => ({
  getCIMDProfiles,
  getCIMDProfile,
  putCIMDProfile,
  deleteCIMDProfile,
  getCIMDProfileTemplate,
  getCIMDProfileSchema,
}));

const { default: OAuth2CIMDProfileOps, ...ops } =
  await import('./OAuth2CIMDProfileOps');
const { default: State } = await import('../shared/State');

const CLOUD_ONLY_MESSAGE =
  'This operation is not available in PingOne Advanced Identity Cloud.';

type Output = {
  prints: { message: unknown; type: string }[];
  created: { type: string; total: number; message: string }[];
  updated: { id: string; message: string }[];
  stopped: { id: string; message: string; status: string }[];
};

// The type list is cached per host, realm and deployment type for the life of
// the process: every state has a host of its own.
let hostCounter = 0;
function newState({
  realm = 'alpha',
  deployment = 'cloud',
}: { realm?: string; deployment?: string } = {}) {
  hostCounter += 1;
  const state = State({});
  state.setHost(`https://openam-matrix-${hostCounter}.example.com/am`);
  state.setDeploymentType(deployment);
  state.setRealm(realm);
  const output: Output = { prints: [], created: [], updated: [], stopped: [] };
  state.setPrintHandler((message, type) => {
    output.prints.push({ message, type });
  });
  state.setCreateProgressHandler((type, total, message) => {
    output.created.push({ type, total, message });
    return `indicator-${output.created.length}`;
  });
  state.setUpdateProgressHandler((id, message) => {
    output.updated.push({ id, message });
  });
  state.setStopProgressHandler((id, message, status) => {
    output.stopped.push({ id, message, status });
  });
  return { state, output };
}

function errorWithStatus(status: number, data?: unknown) {
  const error: any = new Error(`HTTP ${status}`);
  error.response = { status, data };
  return error;
}

function typeItem(id: string, name = `${id} Agents`) {
  return { _id: id, name, collection: true };
}
const typesWithCIMD = () => [
  typeItem('2.2_Agent'),
  typeItem('OAuth2Client', 'OAuth2 Clients'),
  typeItem('CIMDProfile', 'CIMD Profile Agents'),
  typeItem('WebAgent'),
];
const typesWithoutCIMD = () =>
  typesWithCIMD().filter((item) => item._id !== 'CIMDProfile');

// A small complete profile: six groups with a few attributes each. The plain
// form is what the list returns, the wrapped form what a write answers.
const GROUPS: Record<string, Record<string, unknown>> = {
  cimdConfig: {
    cimdClientIdUrlPatterns: ['https://clients.matrix.example.com/*'],
    cimdMetadataDenyList: ['scope', 'redirect_uris'],
    cimdSsrfProtectionEnabled: true,
  },
  coreOAuth2ClientConfig: { status: 'Active', clientName: [], scopes: [] },
  advancedOAuth2ClientConfig: {
    grantTypes: ['authorization_code'],
    tokenEndpointAuthMethod: 'none',
    customLoginUrlTemplate: null,
  },
  coreOpenIDClientConfig: { claims: [], jwtTokenLifetime: 3600 },
  signEncOAuth2ClientConfig: { idTokenEncryptionEnabled: false },
  overrideOAuth2ClientConfig: { providerOverridesEnabled: false },
};
const TYPE = { _id: 'CIMDProfile', name: 'CIMD Profile', collection: true };

const fullPlain = (id: string) => ({
  _id: id,
  _rev: '-1122334455',
  ...JSON.parse(JSON.stringify(GROUPS)),
  _type: TYPE,
});
const fullWrapped = (id: string) => ({
  _id: id,
  _rev: '1234567890',
  ...Object.fromEntries(
    Object.entries(GROUPS).map(([group, attributes]) => [
      group,
      Object.fromEntries(
        Object.entries(attributes).map(([name, value]) => [
          name,
          { inherited: false, value },
        ])
      ),
    ])
  ),
  _type: TYPE,
});
// stored with few attributes: the server completes it when it creates it
const sparsePlain = (id: string) => ({
  _id: id,
  _rev: '-1122334455',
  cimdConfig: {
    cimdClientIdUrlPatterns: ['https://clients.matrix.example.com/*'],
  },
  coreOAuth2ClientConfig: { status: 'Active' },
  _type: TYPE,
});

const page = (...profiles: any[]) => ({
  result: profiles,
  resultCount: profiles.length,
  pagedResultsCookie: null,
});
const exportOf = (...profiles: any[]) => ({
  meta: {},
  cimdProfile: Object.fromEntries(profiles.map((p) => [p._id, p])),
});

beforeEach(() => {
  for (const mock of [
    getAgentTypes,
    getCIMDProfiles,
    getCIMDProfile,
    putCIMDProfile,
    deleteCIMDProfile,
    getCIMDProfileTemplate,
    getCIMDProfileSchema,
  ]) {
    mock.mockReset();
  }
  getAgentTypes.mockResolvedValue({ result: typesWithCIMD() });
  getCIMDProfiles.mockResolvedValue(page());
  // by default a write creates the profile and the server completes it
  putCIMDProfile.mockImplementation(async ({ profileId }: any) => ({
    status: 201,
    data: fullWrapped(profileId),
  }));
  deleteCIMDProfile.mockImplementation(async ({ profileId }: any) =>
    fullWrapped(profileId)
  );
});

function expectNoRequestForProfiles() {
  expect(getCIMDProfiles).not.toHaveBeenCalled();
  expect(getCIMDProfile).not.toHaveBeenCalled();
  expect(putCIMDProfile).not.toHaveBeenCalled();
  expect(deleteCIMDProfile).not.toHaveBeenCalled();
}

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) current = current.originalErrors[0];
  return current;
}

const settle = <T>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ value, error: undefined as any }),
    (error) => ({ value: undefined as T, error })
  );

// the shapes of a deployment that does not offer the type
const unlistedShapes: [string, () => void, string, string][] = [
  [
    'Cloud root realm (type list answers 403 with the Cloud message)',
    () =>
      getAgentTypes.mockRejectedValue(
        errorWithStatus(403, { message: CLOUD_ONLY_MESSAGE })
      ),
    '/',
    'cloud',
  ],
  [
    'Cloud tenant from before the feature',
    () => getAgentTypes.mockResolvedValue({ result: typesWithoutCIMD() }),
    'alpha',
    'cloud',
  ],
  [
    'classic root realm before PingAM 9.0',
    () => getAgentTypes.mockResolvedValue({ result: typesWithoutCIMD() }),
    '/',
    'classic',
  ],
  [
    'ForgeOps root realm before PingAM 9.0',
    () => getAgentTypes.mockResolvedValue({ result: typesWithoutCIMD() }),
    '/',
    'forgeops',
  ],
  [
    'a realm whose type list answers 404',
    () => getAgentTypes.mockRejectedValue(errorWithStatus(404)),
    'alpha',
    'cloud',
  ],
];

describe('createCIMDProfileExportTemplate', () => {
  test('is an empty export with metadata', () => {
    const { state } = newState();
    const template = ops.createCIMDProfileExportTemplate({ state });
    expect(template.cimdProfile).toEqual({});
    expect(template.meta).toEqual(
      expect.objectContaining({ exportTool: expect.any(String) })
    );
    expect(
      OAuth2CIMDProfileOps(state).createCIMDProfileExportTemplate().cimdProfile
    ).toEqual({});
  });
});

describe('deleteCIMDProfiles', () => {
  test.each([
    ['Cloud alpha', 'alpha', 'cloud'],
    ['ForgeOps root realm', '/', 'forgeops'],
    ['classic root realm', '/', 'classic'],
  ])(
    '%s with the type and no profile: nothing to delete',
    async (_n, realm, deployment) => {
      const { state } = newState({ realm, deployment });
      const callback = jest.fn();
      expect(
        await ops.deleteCIMDProfiles({ resultCallback: callback, state })
      ).toEqual([]);
      expect(getCIMDProfiles).toHaveBeenCalledTimes(1);
      expect(deleteCIMDProfile).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
    }
  );

  test.each([[1], [3]])(
    'deletes %s profile(s) in order and reports each once',
    async (count) => {
      const { state } = newState();
      const profiles = ['matrix-a', 'matrix-b', 'matrix-c']
        .slice(0, count)
        .map(fullPlain);
      getCIMDProfiles.mockResolvedValue(page(...profiles));
      const callback = jest.fn();
      const deleted = await ops.deleteCIMDProfiles({
        resultCallback: callback,
        state,
      });
      expect(deleted).toEqual(profiles);
      expect(deleteCIMDProfile.mock.calls.map((c) => c[0].profileId)).toEqual(
        profiles.map((p) => p._id)
      );
      expect(callback.mock.calls).toEqual(
        profiles.map((profile) => [undefined, profile])
      );
    }
  );

  test('works without a callback', async () => {
    const { state } = newState();
    getCIMDProfiles.mockResolvedValue(page(fullPlain('matrix-a')));
    expect(await ops.deleteCIMDProfiles({ state })).toHaveLength(1);
  });

  describe('with a callback: a failed profile does not stop the others and nothing throws', () => {
    test('the failure names the profile, carries the cause and is reported once', async () => {
      const { state } = newState();
      const profiles = ['matrix-a', 'matrix-b', 'matrix-c'].map(fullPlain);
      getCIMDProfiles.mockResolvedValue(page(...profiles));
      deleteCIMDProfile.mockImplementation(async ({ profileId }: any) => {
        if (profileId === 'matrix-b') throw errorWithStatus(500);
        return fullWrapped(profileId);
      });
      const callback = jest.fn();
      const deleted = await ops.deleteCIMDProfiles({
        resultCallback: callback,
        state,
      });
      expect(deleteCIMDProfile).toHaveBeenCalledTimes(3);
      expect(deleted).toEqual([profiles[0], profiles[2]]);
      expect(callback).toHaveBeenCalledTimes(3);
      const [failure, result] = callback.mock.calls[1] as [FrodoError, unknown];
      expect(result).toBeUndefined();
      expect(failure).toBeInstanceOf(FrodoError);
      expect(failure.message).toBe(
        'Error deleting alpha realm CIMD profile matrix-b'
      );
      expect(rootCause(failure).response.status).toBe(500);
      expect(callback.mock.calls[0]).toEqual([undefined, profiles[0]]);
      expect(callback.mock.calls[2]).toEqual([undefined, profiles[2]]);
    });
  });

  describe('without a callback: every profile is tried, then one error holds all failures', () => {
    test('two failures of three', async () => {
      const { state } = newState();
      const profiles = ['matrix-a', 'matrix-b', 'matrix-c'].map(fullPlain);
      getCIMDProfiles.mockResolvedValue(page(...profiles));
      deleteCIMDProfile.mockImplementation(async ({ profileId }: any) => {
        if (profileId !== 'matrix-b') throw errorWithStatus(500);
        return fullWrapped(profileId);
      });
      const { error } = await settle(ops.deleteCIMDProfiles({ state }));
      expect(deleteCIMDProfile).toHaveBeenCalledTimes(3);
      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe('Error deleting alpha realm CIMD profiles');
      expect(error.originalErrors.map((e: Error) => e.message)).toEqual([
        'Error deleting alpha realm CIMD profile matrix-a',
        'Error deleting alpha realm CIMD profile matrix-c',
      ]);
    });
  });

  test('failing to read the profiles always throws, also with a callback, and deletes nothing', async () => {
    const { state } = newState();
    getCIMDProfiles.mockRejectedValue(errorWithStatus(500));
    const callback = jest.fn();
    const { error } = await settle(
      ops.deleteCIMDProfiles({ resultCallback: callback, state })
    );
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error deleting alpha realm CIMD profiles');
    expect(deleteCIMDProfile).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  test.each(unlistedShapes)(
    '%s: nothing to do, no request for profiles, no callback, no message',
    async (_name, arrange, realm, deployment) => {
      arrange();
      const { state, output } = newState({ realm, deployment });
      const callback = jest.fn();
      expect(
        await ops.deleteCIMDProfiles({ resultCallback: callback, state })
      ).toEqual([]);
      expectNoRequestForProfiles();
      expect(callback).not.toHaveBeenCalled();
      expect(output.prints).toEqual([]);
    }
  );

  test('the facade passes the callback on', async () => {
    const { state } = newState();
    getCIMDProfiles.mockResolvedValue(page(fullPlain('matrix-a')));
    const callback = jest.fn();
    await OAuth2CIMDProfileOps(state).deleteCIMDProfiles(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('exportCIMDProfiles', () => {
  test('writes the profiles keyed by _id, exactly as the list returns them', async () => {
    const { state } = newState();
    const profiles = [fullPlain('matrix-b'), sparsePlain('matrix-a')];
    getCIMDProfiles.mockResolvedValue(page(...profiles));
    const exported = await ops.exportCIMDProfiles({ state });
    expect(Object.keys(exported.cimdProfile)).toEqual(['matrix-a', 'matrix-b']);
    expect(exported.cimdProfile['matrix-a']).toEqual(sparsePlain('matrix-a'));
    expect(exported.cimdProfile['matrix-b']).toEqual(fullPlain('matrix-b'));
    expect(exported.meta).toBeDefined();
  });

  test('reports every profile to the callback as a success, once', async () => {
    const { state } = newState();
    const profiles = ['matrix-a', 'matrix-b'].map(fullPlain);
    getCIMDProfiles.mockResolvedValue(page(...profiles));
    const callback = jest.fn();
    await ops.exportCIMDProfiles({ resultCallback: callback, state });
    expect(callback.mock.calls).toEqual(
      profiles.map((profile) => [undefined, profile])
    );
  });

  test('shows a progress indicator for the profiles', async () => {
    const { state, output } = newState();
    getCIMDProfiles.mockResolvedValue(
      page(fullPlain('matrix-a'), fullPlain('matrix-b'))
    );
    await ops.exportCIMDProfiles({ state });
    expect(output.created).toEqual([
      expect.objectContaining({
        total: 2,
        message: expect.stringContaining('CIMD profiles'),
      }),
    ]);
    expect(output.updated).toHaveLength(2);
    expect(output.stopped).toEqual([
      expect.objectContaining({
        id: 'indicator-1',
        status: 'none',
        message: 'Exported 2 alpha realm CIMD profiles.',
      }),
    ]);
  });

  test('a realm without profiles prints nothing: no progress indicator, no message', async () => {
    const { state, output } = newState();
    const exported = await ops.exportCIMDProfiles({ state });
    expect(exported.cimdProfile).toEqual({});
    expect(exported.meta).toBeDefined();
    expect(output.created).toEqual([]);
    expect(output.updated).toEqual([]);
    expect(output.stopped).toEqual([]);
    expect(output.prints).toEqual([]);
  });

  test('failing to read the profiles always throws, also with a callback, and stops the indicator', async () => {
    const { state, output } = newState();
    getCIMDProfiles.mockRejectedValue(errorWithStatus(500));
    const callback = jest.fn();
    const { error } = await settle(
      ops.exportCIMDProfiles({ resultCallback: callback, state })
    );
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error exporting alpha realm CIMD profiles');
    expect(callback).not.toHaveBeenCalled();
    expect(output.created).toEqual([]);
  });

  test.each(unlistedShapes)(
    '%s: the export holds none, no request for profiles, nothing printed',
    async (_name, arrange, realm, deployment) => {
      arrange();
      const { state, output } = newState({ realm, deployment });
      const callback = jest.fn();
      const exported = await ops.exportCIMDProfiles({
        resultCallback: callback,
        state,
      });
      expect(exported.cimdProfile).toEqual({});
      expect(exported.meta).toBeDefined();
      expectNoRequestForProfiles();
      expect(callback).not.toHaveBeenCalled();
      expect(output.created).toEqual([]);
      expect(output.prints).toEqual([]);
    }
  );
});

describe('exportCIMDProfile', () => {
  test('writes one profile under its stored id, in the plain shape', async () => {
    const { state } = newState();
    getCIMDProfiles.mockResolvedValue(
      page(fullPlain('casea1'), fullPlain('matrix-b'))
    );
    const exported = await ops.exportCIMDProfile({
      profileId: 'CaseA1',
      state,
    });
    expect(exported.cimdProfile).toEqual({ casea1: fullPlain('casea1') });
    expect(exported.meta).toBeDefined();
    expect(getCIMDProfile).not.toHaveBeenCalled();
  });

  test('an absent profile is an error of the export that names it', async () => {
    const { state } = newState();
    const { error } = await settle(
      ops.exportCIMDProfile({ profileId: 'matrix-z', state })
    );
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(
      'Error exporting alpha realm CIMD profile matrix-z'
    );
    expect(rootCause(error).message).toBe(
      'alpha realm CIMD profile matrix-z not found'
    );
  });

  test.each(unlistedShapes)(
    '%s: throws CIMD_PROFILES_NOT_AVAILABLE and makes no request for profiles',
    async (_name, arrange, realm, deployment) => {
      arrange();
      const { state } = newState({ realm, deployment });
      const { error } = await settle(
        ops.exportCIMDProfile({ profileId: 'a', state })
      );
      expect(error.code).toBe('CIMD_PROFILES_NOT_AVAILABLE');
      expectNoRequestForProfiles();
    }
  );

  test('an id that the server refuses is refused before any request', async () => {
    const { state } = newState();
    const { error } = await settle(
      ops.exportCIMDProfile({ profileId: 'a/b', state })
    );
    expect(error).toBeInstanceOf(FrodoError);
    expect(getAgentTypes).not.toHaveBeenCalled();
  });
});

describe('importCIMDProfiles: what is written', () => {
  test('a complete profile that the server creates as it is: one write, not repaired', async () => {
    const { state } = newState();
    const profile = fullPlain('matrix-a');
    const results = await ops.importCIMDProfiles({
      importData: exportOf(profile),
      state,
    });
    expect(putCIMDProfile).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      { profile: fullWrapped('matrix-a'), created: true, repaired: false },
    ]);
  });

  test('a sparse profile that the server completes: written twice with the same body, repaired', async () => {
    const { state } = newState();
    const profile = sparsePlain('matrix-a');
    const before = JSON.parse(JSON.stringify(profile));
    const results = await ops.importCIMDProfiles({
      importData: exportOf(profile),
      state,
    });
    expect(putCIMDProfile).toHaveBeenCalledTimes(2);
    const [first, second] = putCIMDProfile.mock.calls.map((c) => c[0]);
    expect(first.profileId).toBe('matrix-a');
    expect(first.failIfExists).toBe(false);
    expect(second.failIfExists).toBe(false);
    // the same body, exactly as exported (the api layer drops _rev)
    expect(first.profileData).toEqual(before);
    expect(second.profileData).toEqual(before);
    expect(results).toEqual([
      { profile: fullWrapped('matrix-a'), created: true, repaired: true },
    ]);
  });

  test('a profile that existed (200): one write, stored as sent, not created', async () => {
    const { state } = newState();
    putCIMDProfile.mockResolvedValue({
      status: 200,
      data: sparsePlain('matrix-a'),
    });
    const results = await ops.importCIMDProfiles({
      importData: exportOf(sparsePlain('matrix-a')),
      state,
    });
    expect(putCIMDProfile).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      { profile: sparsePlain('matrix-a'), created: false, repaired: false },
    ]);
  });

  test('the answer to the repair is the stored profile', async () => {
    const { state } = newState();
    const stored = sparsePlain('matrix-a');
    putCIMDProfile
      .mockResolvedValueOnce({ status: 201, data: fullWrapped('matrix-a') })
      .mockResolvedValueOnce({ status: 200, data: stored });
    const [result] = await ops.importCIMDProfiles({
      importData: exportOf(sparsePlain('matrix-a')),
      state,
    });
    expect(result).toEqual({ profile: stored, created: true, repaired: true });
  });

  test('a failing second write fails the item: created, but not restored', async () => {
    const { state } = newState();
    putCIMDProfile
      .mockResolvedValueOnce({ status: 201, data: fullWrapped('matrix-a') })
      .mockRejectedValueOnce(errorWithStatus(500));
    const callback = jest.fn();
    const results = await ops.importCIMDProfiles({
      importData: exportOf(sparsePlain('matrix-a')),
      resultCallback: callback,
      state,
    });
    expect(results).toEqual([]);
    const [failure] = callback.mock.calls[0] as [FrodoError];
    expect(failure.message).toBe(
      'Error importing alpha realm CIMD profile matrix-a: created, but not restored to the exported state'
    );
    expect(rootCause(failure).response.status).toBe(500);
  });

  test.each([
    ['plain', fullPlain('matrix-a')],
    ['wrapped', fullWrapped('matrix-a')],
  ])('%s values are sent as they are', async (_name, profile) => {
    const { state } = newState();
    await ops.importCIMDProfiles({ importData: exportOf(profile), state });
    expect(putCIMDProfile.mock.calls[0][0].profileData).toEqual(profile);
  });

  test('the import data is not changed', async () => {
    const { state } = newState();
    const importData = exportOf(sparsePlain('matrix-a'), fullPlain('matrix-b'));
    const before = JSON.parse(JSON.stringify(importData));
    await ops.importCIMDProfiles({ importData, state });
    expect(importData).toEqual(before);
    expect(importData.cimdProfile['matrix-a']._rev).toBe('-1122334455');
  });

  test('an export imported again writes bodies equal to the exported objects', async () => {
    const { state } = newState();
    const profiles = [fullPlain('matrix-a'), fullPlain('matrix-b')];
    getCIMDProfiles.mockResolvedValue(page(...profiles));
    const exported = await ops.exportCIMDProfiles({ state });
    await ops.importCIMDProfiles({ importData: exported, state });
    expect(putCIMDProfile.mock.calls.map((c) => c[0].profileData)).toEqual(
      profiles
    );
  });

  test('a first write that fails fails the item with the names of the attributes the server refused', async () => {
    const { state } = newState();
    putCIMDProfile.mockRejectedValue(
      errorWithStatus(400, {
        message: 'Invalid attribute specified.',
        detail: { validAttributes: ['cimdClientIdUrlPatterns', 'status'] },
      })
    );
    const callback = jest.fn();
    await ops.importCIMDProfiles({
      importData: exportOf({
        _id: 'matrix-a',
        cimdConfig: { cimdClientIdUrlPatterns: [], extraAttribute: 1 },
      }),
      resultCallback: callback,
      state,
    });
    // nothing is dropped and retried
    expect(putCIMDProfile).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].message).toBe(
      'Error importing alpha realm CIMD profile matrix-a: the server does not accept the attribute(s) extraAttribute'
    );
  });
});

describe('importCIMDProfiles: the per-item contract', () => {
  const importData = () =>
    exportOf(
      fullPlain('matrix-a'),
      fullPlain('matrix-b'),
      fullPlain('matrix-c')
    );
  const failOn = (...ids: string[]) =>
    putCIMDProfile.mockImplementation(async ({ profileId }: any) => {
      if (ids.includes(profileId)) throw errorWithStatus(500);
      return { status: 201, data: fullWrapped(profileId) };
    });

  test('with a callback: every profile is reported once, the others still run, nothing throws', async () => {
    const { state } = newState();
    failOn('matrix-b');
    const callback = jest.fn();
    const results = await ops.importCIMDProfiles({
      importData: importData(),
      resultCallback: callback,
      state,
    });
    expect(putCIMDProfile).toHaveBeenCalledTimes(3);
    expect(results.map((r) => r.profile._id)).toEqual(['matrix-a', 'matrix-c']);
    expect(callback).toHaveBeenCalledTimes(3);
    const [failure, result] = callback.mock.calls[1] as [FrodoError, unknown];
    expect(result).toBeUndefined();
    expect(failure).toBeInstanceOf(FrodoError);
    expect(failure.message).toBe(
      'Error importing alpha realm CIMD profile matrix-b'
    );
    expect(rootCause(failure).response.status).toBe(500);
    // a success carries one result of the kind the function returns
    expect(callback.mock.calls[0]).toEqual([undefined, results[0]]);
    expect(callback.mock.calls[2]).toEqual([undefined, results[1]]);
  });

  test('a failure in the middle does not stop the last profile', async () => {
    const { state } = newState();
    failOn('matrix-a', 'matrix-b');
    const results = await ops.importCIMDProfiles({
      importData: importData(),
      resultCallback: jest.fn(),
      state,
    });
    expect(results.map((r) => r.profile._id)).toEqual(['matrix-c']);
  });

  test('without a callback: every profile is tried, then one error holds all failures', async () => {
    const { state } = newState();
    failOn('matrix-a', 'matrix-c');
    const { error } = await settle(
      ops.importCIMDProfiles({ importData: importData(), state })
    );
    expect(putCIMDProfile).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error importing alpha realm CIMD profiles');
    expect(error.originalErrors.map((e: Error) => e.message)).toEqual([
      'Error importing alpha realm CIMD profile matrix-a',
      'Error importing alpha realm CIMD profile matrix-c',
    ]);
  });

  test('a profile whose _type names another type fails only that item', async () => {
    const { state } = newState();
    const wrongType = { ...fullPlain('matrix-b'), _type: { _id: 'WebAgent' } };
    const callback = jest.fn();
    const results = await ops.importCIMDProfiles({
      importData: exportOf(
        fullPlain('matrix-a'),
        wrongType,
        fullPlain('matrix-c')
      ),
      resultCallback: callback,
      state,
    });
    expect(putCIMDProfile).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
    const [failure] = callback.mock.calls[1] as [FrodoError];
    expect(failure.message).toBe(
      'Error importing alpha realm CIMD profile matrix-b'
    );
    expect(rootCause(failure).message).toBe(
      "Wrong agent type! Expected 'CIMDProfile' but got 'WebAgent'."
    );
  });

  test('a missing _type is accepted (hand-written files)', async () => {
    const { state } = newState();
    const { _type, ...withoutType } = fullPlain('matrix-a');
    expect(_type).toBeDefined();
    const results = await ops.importCIMDProfiles({
      importData: exportOf(withoutType),
      state,
    });
    expect(results).toHaveLength(1);
  });

  test('an id that the server refuses fails that item before any write', async () => {
    const { state } = newState();
    const callback = jest.fn();
    await ops.importCIMDProfiles({
      importData: {
        cimdProfile: { 'a/b': fullPlain('a/b'), ok: fullPlain('ok') },
      },
      resultCallback: callback,
      state,
    });
    expect(putCIMDProfile).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeInstanceOf(FrodoError);
    expect(callback.mock.calls[0][0].message).toBe(
      'Error importing alpha realm CIMD profile a/b'
    );
  });
});

describe('importCIMDProfiles: nothing to import, and a deployment that does not offer the type', () => {
  test.each([
    ['an empty set', { cimdProfile: {} }],
    ['no cimdProfile key', {}],
    ['no import data', undefined],
  ])(
    '%s: nothing happens, not even a type list request',
    async (_n, importData) => {
      const { state, output } = newState();
      const callback = jest.fn();
      expect(
        await ops.importCIMDProfiles({
          importData: importData as any,
          resultCallback: callback,
          state,
        })
      ).toEqual([]);
      expect(getAgentTypes).not.toHaveBeenCalled();
      expectNoRequestForProfiles();
      expect(callback).not.toHaveBeenCalled();
      expect(output.prints).toEqual([]);
    }
  );

  test.each(unlistedShapes)(
    '%s: one warning, no write, no callback, no failure',
    async (_name, arrange, realm, deployment) => {
      arrange();
      const { state, output } = newState({ realm, deployment });
      const callback = jest.fn();
      const results = await ops.importCIMDProfiles({
        importData: exportOf(fullPlain('matrix-a'), fullPlain('matrix-b')),
        resultCallback: callback,
        state,
      });
      expect(results).toEqual([]);
      expectNoRequestForProfiles();
      expect(callback).not.toHaveBeenCalled();
      expect(output.prints).toHaveLength(1);
      expect(output.prints[0].type).toBe('warn');
      expect(output.prints[0].message).toBe(
        `Skipped 2 CIMD profiles: the ${realm === '/' ? '/' : realm} realm of this deployment does not offer CIMD profiles.`
      );
    }
  );

  test('the warning of a single profile is in the singular', async () => {
    getAgentTypes.mockResolvedValue({ result: typesWithoutCIMD() });
    const { state, output } = newState();
    await ops.importCIMDProfiles({
      importData: exportOf(fullPlain('matrix-a')),
      state,
    });
    expect(output.prints[0].message).toMatch(/^Skipped 1 CIMD profile:/);
  });

  test('a failing type list (500) is an error, not "unavailable"', async () => {
    getAgentTypes.mockRejectedValue(errorWithStatus(500));
    const { state } = newState();
    const { error } = await settle(
      ops.importCIMDProfiles({
        importData: exportOf(fullPlain('matrix-a')),
        state,
      })
    );
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.code).toBeUndefined();
    expect(putCIMDProfile).not.toHaveBeenCalled();
  });
});

describe('importCIMDProfile', () => {
  test('writes one profile of the import data and returns its result', async () => {
    const { state } = newState();
    const importData = exportOf(fullPlain('matrix-a'), fullPlain('matrix-b'));
    const result = await ops.importCIMDProfile({
      profileId: 'matrix-b',
      importData,
      state,
    });
    expect(putCIMDProfile).toHaveBeenCalledTimes(1);
    expect(putCIMDProfile.mock.calls[0][0].profileId).toBe('matrix-b');
    expect(result).toEqual({
      profile: fullWrapped('matrix-b'),
      created: true,
      repaired: false,
    });
  });

  test('repairs a sparse profile like the bulk import', async () => {
    const { state } = newState();
    const result = await ops.importCIMDProfile({
      profileId: 'matrix-a',
      importData: exportOf(sparsePlain('matrix-a')),
      state,
    });
    expect(putCIMDProfile).toHaveBeenCalledTimes(2);
    expect(result.repaired).toBe(true);
  });

  test('a profile that is not in the import data is an error', async () => {
    const { state } = newState();
    const { error } = await settle(
      ops.importCIMDProfile({
        profileId: 'matrix-z',
        importData: exportOf(fullPlain('matrix-a')),
        state,
      })
    );
    expect(error.message).toBe(
      'alpha realm CIMD profile matrix-z not found in import data!'
    );
    expect(putCIMDProfile).not.toHaveBeenCalled();
  });

  test('a wrong type and a failing write are errors that name the profile', async () => {
    const { state } = newState();
    const wrongType = { ...fullPlain('matrix-a'), _type: { _id: 'WebAgent' } };
    const wrong = await settle(
      ops.importCIMDProfile({
        profileId: 'matrix-a',
        importData: exportOf(wrongType),
        state,
      })
    );
    expect(wrong.error.message).toBe(
      'Error importing alpha realm CIMD profile matrix-a'
    );
    expect(rootCause(wrong.error).message).toMatch(/Wrong agent type!/);
    putCIMDProfile.mockRejectedValue(errorWithStatus(500));
    const failed = await settle(
      ops.importCIMDProfile({
        profileId: 'matrix-a',
        importData: exportOf(fullPlain('matrix-a')),
        state,
      })
    );
    expect(failed.error.message).toBe(
      'Error importing alpha realm CIMD profile matrix-a'
    );
  });

  test('does not change the import data', async () => {
    const { state } = newState();
    const importData = exportOf(sparsePlain('matrix-a'));
    const before = JSON.parse(JSON.stringify(importData));
    await ops.importCIMDProfile({ profileId: 'matrix-a', importData, state });
    expect(importData).toEqual(before);
  });

  test.each(unlistedShapes)(
    '%s: throws CIMD_PROFILES_NOT_AVAILABLE and writes nothing',
    async (_name, arrange, realm, deployment) => {
      arrange();
      const { state } = newState({ realm, deployment });
      const { error } = await settle(
        ops.importCIMDProfile({
          profileId: 'matrix-a',
          importData: exportOf(fullPlain('matrix-a')),
          state,
        })
      );
      expect(error.code).toBe('CIMD_PROFILES_NOT_AVAILABLE');
      expectNoRequestForProfiles();
    }
  );

  test('the facade delegates both imports', async () => {
    const { state } = newState();
    const cimd = OAuth2CIMDProfileOps(state);
    const importData = exportOf(fullPlain('matrix-a'));
    expect(await cimd.importCIMDProfile('matrix-a', importData)).toEqual(
      expect.objectContaining({ created: true })
    );
    const callback = jest.fn();
    await cimd.importCIMDProfiles(importData, callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('putCIMDProfileExact', () => {
  test('does not change the profile it is given', async () => {
    const { state } = newState();
    const profile = sparsePlain('matrix-a');
    const before = JSON.parse(JSON.stringify(profile));
    await ops.putCIMDProfileExact({
      profileId: 'matrix-a',
      profileData: profile,
      state,
    });
    expect(profile).toEqual(before);
  });

  test('a first write that fails throws as it is', async () => {
    const { state } = newState();
    const failure = errorWithStatus(412);
    putCIMDProfile.mockRejectedValue(failure);
    await expect(
      ops.putCIMDProfileExact({
        profileId: 'matrix-a',
        profileData: sparsePlain('matrix-a'),
        state,
      })
    ).rejects.toBe(failure);
  });
});
