/**
 * Unit tests for the CIMD profile module (single-object life cycle and the
 * availability of the agent type).
 *
 * Run with:
 *
 *        npm run test:only src/ops/OAuth2CIMDProfileOps
 *
 * The api layer of the module and the agent type request are replaced by fakes,
 * so every deployment shape (Cloud, ForgeOps, classic, a server that does not
 * list the type) can be asserted request by request without a tenant or a
 * recording. The answers have the shapes observed on a tenant: the list holds
 * plain values, the PUT answers the wrapped object. A real recording of this
 * module is made by a maintainer.
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

const {
  default: OAuth2CIMDProfileOps,
  assertCIMDProfileAvailable,
  checkCIMDProfileId,
  CIMD_PROFILE_ID_REFUSED_CHARACTERS,
  createCIMDProfile,
  deleteCIMDProfile: deleteProfile,
  describeInvalidAttributes,
  isCIMDProfileAvailable,
  readCIMDProfile,
  readCIMDProfileSchema,
  readCIMDProfileTemplate,
  readCIMDProfiles,
  updateCIMDProfile,
} = await import('./OAuth2CIMDProfileOps');

const CLOUD_ONLY_MESSAGE =
  'This operation is not available in PingOne Advanced Identity Cloud.';

// The type list is cached per host, realm and deployment type for the life of
// the process: every test uses a host of its own.
let hostCounter = 0;
function mockState({
  realm = 'alpha',
  deployment = 'cloud',
}: { realm?: string; deployment?: string } = {}) {
  hostCounter += 1;
  const host = `https://openam-matrix-${hostCounter}.example.com/am`;
  return {
    getRealm: () => realm,
    getHost: () => host,
    getDebugHandler: () => undefined,
    getDeploymentType: () => deployment,
    getAuthMode: () => 'noninteractive',
    getUseBearerTokenForAmApis: () => false,
  } as any;
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

// plain list shape
const plain = (id: string) => ({
  _id: id,
  _rev: '-1122334455',
  cimdConfig: {
    cimdClientIdUrlPatterns: ['https://clients.matrix.example.com/*'],
    cimdMetadataDenyList: ['scope'],
    cimdSsrfProtectionEnabled: true,
  },
  _type: { _id: 'CIMDProfile', name: 'CIMD Profile', collection: true },
});

// wrapped shape of the single read and of the PUT answer
const wrapped = (id: string) => ({
  _id: id,
  _rev: '1234567890',
  cimdConfig: {
    cimdClientIdUrlPatterns: {
      inherited: false,
      value: ['https://clients.matrix.example.com/*'],
    },
    cimdMetadataDenyList: { inherited: false, value: ['scope'] },
    cimdSsrfProtectionEnabled: { inherited: false, value: true },
  },
  _type: { _id: 'CIMDProfile', name: 'CIMD Profile', collection: true },
});

const page = (...ids: string[]) => ({
  result: ids.map(plain),
  resultCount: ids.length,
  pagedResultsCookie: null,
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
  putCIMDProfile.mockResolvedValue({ status: 201, data: wrapped('x') });
  deleteCIMDProfile.mockResolvedValue(wrapped('x'));
  getCIMDProfileTemplate.mockResolvedValue({ cimdConfig: {} });
  getCIMDProfileSchema.mockResolvedValue({ type: 'object', properties: {} });
});

// Every function that names a profile (or the template, or the schema), as a call.
const namedCalls: [string, (state: any) => Promise<unknown>][] = [
  ['readCIMDProfile', (state) => readCIMDProfile({ profileId: 'a', state })],
  [
    'createCIMDProfile',
    (state) =>
      createCIMDProfile({
        profileId: 'a',
        profileData: { cimdConfig: {} },
        state,
      }),
  ],
  [
    'updateCIMDProfile',
    (state) =>
      updateCIMDProfile({
        profileId: 'a',
        profileData: { cimdConfig: {} },
        state,
      }),
  ],
  ['deleteCIMDProfile', (state) => deleteProfile({ profileId: 'a', state })],
  ['readCIMDProfileTemplate', (state) => readCIMDProfileTemplate({ state })],
  ['readCIMDProfileSchema', (state) => readCIMDProfileSchema({ state })],
];

function expectNoRequestForProfiles() {
  expect(getCIMDProfiles).not.toHaveBeenCalled();
  expect(getCIMDProfile).not.toHaveBeenCalled();
  expect(putCIMDProfile).not.toHaveBeenCalled();
  expect(deleteCIMDProfile).not.toHaveBeenCalled();
  expect(getCIMDProfileTemplate).not.toHaveBeenCalled();
  expect(getCIMDProfileSchema).not.toHaveBeenCalled();
}

describe('deployment shapes where the realm offers the type', () => {
  test.each([
    ['Cloud alpha', 'alpha', 'cloud'],
    ['ForgeOps root realm (PingAM 9.0 shape, mocked)', '/', 'forgeops'],
    ['classic root realm (PingAM 9.0 shape, mocked)', '/', 'classic'],
  ])('%s: availability and an empty list', async (_name, realm, deployment) => {
    const state = mockState({ realm, deployment });
    expect(await isCIMDProfileAvailable({ state })).toBe(true);
    expect(await readCIMDProfiles({ state })).toEqual([]);
    expect(getAgentTypes).toHaveBeenCalledTimes(1);
    expect(getCIMDProfiles).toHaveBeenCalledTimes(1);
    expect(getCIMDProfiles).toHaveBeenCalledWith({ state });
  });

  test('Cloud alpha with 2 profiles: sorted by id, plain shape as the list returns it', async () => {
    const state = mockState();
    getCIMDProfiles.mockResolvedValue(page('matrix-b', 'matrix-a'));
    expect(await readCIMDProfiles({ state })).toEqual([
      plain('matrix-a'),
      plain('matrix-b'),
    ]);
  });
});

describe('deployment shapes where the realm does not offer the type', () => {
  const shapes: [string, () => void, string, string][] = [
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
      'Cloud tenant from before the feature (type list without CIMDProfile)',
      () => getAgentTypes.mockResolvedValue({ result: typesWithoutCIMD() }),
      'alpha',
      'cloud',
    ],
    [
      'classic root realm before PingAM 9.0 (type list without CIMDProfile)',
      () => getAgentTypes.mockResolvedValue({ result: typesWithoutCIMD() }),
      '/',
      'classic',
    ],
    [
      'ForgeOps root realm before PingAM 9.0 (type list without CIMDProfile)',
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

  test.each(shapes)(
    '%s: not available, an empty list, no request for profiles',
    async (_name, arrange, realm, deployment) => {
      arrange();
      const state = mockState({ realm, deployment });
      expect(await isCIMDProfileAvailable({ state })).toBe(false);
      expect(await readCIMDProfiles({ state })).toEqual([]);
      expectNoRequestForProfiles();
    }
  );

  describe.each(shapes)('%s', (_name, arrange, realm, deployment) => {
    test.each(namedCalls)(
      '%s throws CIMD_PROFILES_NOT_AVAILABLE after two reads of the type list and makes no request for profiles',
      async (_function, call) => {
        arrange();
        const state = mockState({ realm, deployment });
        const failure = await call(state).then(
          () => undefined,
          (error) => error
        );
        expect(failure).toBeInstanceOf(FrodoError);
        expect(failure.code).toBe('CIMD_PROFILES_NOT_AVAILABLE');
        // asked for the cached list, then once more for a stale negative
        expect(getAgentTypes).toHaveBeenCalledTimes(2);
        expectNoRequestForProfiles();
      }
    );
  });

  test('the error is the coded error itself, not a wrapper, and names the realm', async () => {
    getAgentTypes.mockResolvedValue({ result: typesWithoutCIMD() });
    const state = mockState({ realm: '/alpha' });
    const failure: FrodoError = await readCIMDProfile({
      profileId: 'a',
      state,
    }).then(
      () => undefined,
      (error) => error
    );
    expect(failure.code).toBe('CIMD_PROFILES_NOT_AVAILABLE');
    expect(failure.originalErrors).toEqual([]);
    expect(failure.message).toBe(
      "CIMD profiles are not available in the alpha realm of this deployment: the server does not offer the agent type 'CIMDProfile'."
    );
  });

  test('a failing type list (500) is an error of the call, not "unavailable"', async () => {
    getAgentTypes.mockRejectedValue(errorWithStatus(500));
    const state = mockState();
    const failure = await readCIMDProfiles({ state }).then(
      () => undefined,
      (error) => error
    );
    expect(failure).toBeInstanceOf(FrodoError);
    expect(failure.code).toBeUndefined();
    expect(failure.message).toMatch(/Error reading alpha realm agent types/);
    expectNoRequestForProfiles();
    const named = await readCIMDProfile({
      profileId: 'a',
      state: mockState(),
    }).then(
      () => undefined,
      (error) => error
    );
    expect(named).toBeInstanceOf(FrodoError);
    expect(named.code).toBeUndefined();
  });
});

describe('availability', () => {
  test('refreshCache asks the server again', async () => {
    const state = mockState();
    expect(await isCIMDProfileAvailable({ state })).toBe(true);
    expect(await isCIMDProfileAvailable({ state })).toBe(true);
    expect(getAgentTypes).toHaveBeenCalledTimes(1);
    getAgentTypes.mockResolvedValue({ result: typesWithoutCIMD() });
    expect(await isCIMDProfileAvailable({ refreshCache: true, state })).toBe(
      false
    );
    expect(getAgentTypes).toHaveBeenCalledTimes(2);
  });

  test('a stale negative is refreshed once: a tenant upgraded after the first read can create a profile', async () => {
    const state = mockState();
    getAgentTypes
      .mockResolvedValueOnce({ result: typesWithoutCIMD() })
      .mockResolvedValueOnce({ result: typesWithCIMD() });
    expect(await isCIMDProfileAvailable({ state })).toBe(false);
    putCIMDProfile.mockResolvedValue({ status: 201, data: wrapped('a') });
    expect(
      await createCIMDProfile({
        profileId: 'a',
        profileData: { cimdConfig: {} },
        state,
      })
    ).toEqual(wrapped('a'));
    expect(putCIMDProfile).toHaveBeenCalledTimes(1);
  });

  test('assertCIMDProfileAvailable returns when the type is offered, without a second read', async () => {
    const state = mockState();
    await assertCIMDProfileAvailable({ state });
    expect(getAgentTypes).toHaveBeenCalledTimes(1);
  });

  test('the facade answers the question with and without refreshCache', async () => {
    const state = mockState();
    const cimd = OAuth2CIMDProfileOps(state);
    expect(await cimd.isCIMDProfileAvailable()).toBe(true);
    expect(await cimd.isCIMDProfileAvailable()).toBe(true);
    expect(getAgentTypes).toHaveBeenCalledTimes(1);
    expect(await cimd.isCIMDProfileAvailable(true)).toBe(true);
    expect(getAgentTypes).toHaveBeenCalledTimes(2);
  });
});

describe('a listed type whose request fails', () => {
  test.each([[404], [403], [500]])(
    'readCIMDProfiles throws for HTTP %s and does not swallow it',
    async (status) => {
      getCIMDProfiles.mockRejectedValue(errorWithStatus(status));
      const failure = await readCIMDProfiles({ state: mockState() }).then(
        () => undefined,
        (error) => error
      );
      expect(failure).toBeInstanceOf(FrodoError);
      expect(failure.message).toBe('Error reading alpha realm CIMD profiles');
      expect(failure.httpStatus).toBe(status);
    }
  );

  test('readCIMDProfile wraps a failing list request and names the profile', async () => {
    getCIMDProfiles.mockRejectedValue(errorWithStatus(500));
    await expect(
      readCIMDProfile({ profileId: 'a', state: mockState() })
    ).rejects.toThrow('Error reading alpha realm CIMD profile a');
  });

  test('a 501 is an error of the call like any other', async () => {
    getCIMDProfiles.mockRejectedValue(errorWithStatus(501));
    await expect(readCIMDProfiles({ state: mockState() })).rejects.toThrow(
      FrodoError
    );
  });
});

describe('readCIMDProfile', () => {
  test('reads the list once, not a GET by id', async () => {
    const state = mockState();
    getCIMDProfiles.mockResolvedValue(page('matrix-a', 'matrix-b'));
    expect(await readCIMDProfile({ profileId: 'matrix-b', state })).toEqual(
      plain('matrix-b')
    );
    expect(getCIMDProfiles).toHaveBeenCalledTimes(1);
    expect(getCIMDProfile).not.toHaveBeenCalled();
  });

  test('returns the same plain object as readCIMDProfiles', async () => {
    const state = mockState();
    getCIMDProfiles.mockResolvedValue(page('matrix-a', 'matrix-b'));
    const all = await readCIMDProfiles({ state });
    expect(await readCIMDProfile({ profileId: 'matrix-a', state })).toEqual(
      all[0]
    );
  });

  test('matches the id ignoring case and returns the stored id', async () => {
    const state = mockState();
    getCIMDProfiles.mockResolvedValue(page('casea1'));
    const profile = await readCIMDProfile({ profileId: 'CaseA1', state });
    expect(profile._id).toBe('casea1');
  });

  test('finds an id with characters outside the basic plane', async () => {
    const state = mockState();
    getCIMDProfiles.mockResolvedValue(page('mcp-😀'));
    expect((await readCIMDProfile({ profileId: 'mcp-😀', state }))._id).toBe(
      'mcp-😀'
    );
  });

  test('an absent id is "not found"', async () => {
    const state = mockState();
    getCIMDProfiles.mockResolvedValue(page('matrix-a'));
    const failure = await readCIMDProfile({
      profileId: 'matrix-z',
      state,
    }).then(
      () => undefined,
      (error) => error
    );
    expect(failure).toBeInstanceOf(FrodoError);
    expect(failure.message).toBe('alpha realm CIMD profile matrix-z not found');
    expect(failure.code).toBeUndefined();
  });
});

describe('createCIMDProfile', () => {
  test('sends one PUT that fails if the id exists and returns what the server answers', async () => {
    const state = mockState();
    const profileData = {
      cimdConfig: {
        cimdClientIdUrlPatterns: ['https://clients.matrix.example.com/*'],
      },
    };
    const before = JSON.parse(JSON.stringify(profileData));
    putCIMDProfile.mockResolvedValue({ status: 201, data: wrapped('a') });
    expect(
      await createCIMDProfile({ profileId: 'a', profileData, state })
    ).toEqual(wrapped('a'));
    expect(putCIMDProfile).toHaveBeenCalledTimes(1);
    // exactly the minimal body goes out, nothing is merged with the template
    expect(putCIMDProfile.mock.calls[0][0]).toEqual({
      profileId: 'a',
      profileData: before,
      failIfExists: true,
      state,
    });
    expect(getCIMDProfileTemplate).not.toHaveBeenCalled();
    expect(getCIMDProfiles).not.toHaveBeenCalled();
    expect(profileData).toEqual(before);
  });

  test('maps 412 to "already exists!"', async () => {
    putCIMDProfile.mockRejectedValue(errorWithStatus(412));
    const failure = await createCIMDProfile({
      profileId: 'a',
      profileData: {},
      state: mockState(),
    }).then(
      () => undefined,
      (error) => error
    );
    expect(failure).toBeInstanceOf(FrodoError);
    expect(failure.message).toBe('alpha realm CIMD profile a already exists!');
    expect(failure.httpStatus).toBe(412);
  });

  test('maps any other failure to "Error creating"', async () => {
    putCIMDProfile.mockRejectedValue(errorWithStatus(500));
    await expect(
      createCIMDProfile({
        profileId: 'a',
        profileData: {},
        state: mockState(),
      })
    ).rejects.toThrow('Error creating alpha realm CIMD profile a');
  });
});

describe('updateCIMDProfile', () => {
  const invalid = (names: string[]) =>
    errorWithStatus(400, {
      code: 400,
      reason: 'Bad Request',
      message: 'Invalid attribute specified.',
      detail: { validAttributes: names },
    });

  test('sends one PUT without the create-only flag and returns the answer', async () => {
    const state = mockState();
    putCIMDProfile.mockResolvedValue({ status: 200, data: wrapped('a') });
    expect(
      await updateCIMDProfile({
        profileId: 'a',
        profileData: plain('a'),
        state,
      })
    ).toEqual(wrapped('a'));
    expect(putCIMDProfile).toHaveBeenCalledTimes(1);
    expect(putCIMDProfile.mock.calls[0][0].failIfExists).toBe(false);
  });

  test.each([
    ['plain', plain('a')],
    ['wrapped', wrapped('a')],
  ])(
    'passes %s input to the api unchanged and does not modify it',
    async (_name, data) => {
      const before = JSON.parse(JSON.stringify(data));
      await updateCIMDProfile({
        profileId: 'a',
        profileData: data,
        state: mockState(),
      });
      expect(putCIMDProfile.mock.calls[0][0].profileData).toBe(data);
      expect(data).toEqual(before);
    }
  );

  test("never retries after a 400 and never removes attributes from the caller's object", async () => {
    const profileData = {
      cimdConfig: {
        cimdClientIdUrlPatterns: ['https://clients.matrix.example.com/*'],
        cimdSsrfProtectionEnabled: true,
        cimdMetadataDenyList: ['scope'],
        madeUpAttribute: 1,
      },
      madeUpGroup: {},
    };
    const before = JSON.parse(JSON.stringify(profileData));
    putCIMDProfile.mockRejectedValue(
      invalid([
        'cimdClientIdUrlPatterns',
        'cimdMetadataDenyList',
        'cimdSsrfProtectionEnabled',
      ])
    );
    await expect(
      updateCIMDProfile({ profileId: 'a', profileData, state: mockState() })
    ).rejects.toThrow(FrodoError);
    expect(putCIMDProfile).toHaveBeenCalledTimes(1);
    expect(profileData).toEqual(before);
  });

  test('names the attributes the server does not accept: unknown top-level member and unknown member of cimdConfig', async () => {
    putCIMDProfile.mockRejectedValue(
      invalid(['cimdClientIdUrlPatterns', 'status'])
    );
    const failure = await updateCIMDProfile({
      profileId: 'a',
      profileData: {
        extraTopLevel: true,
        cimdConfig: {
          cimdClientIdUrlPatterns: ['https://clients.matrix.example.com/*'],
          extraInGroup: 1,
        },
        coreOAuth2ClientConfig: { status: 'Active' },
      },
      state: mockState(),
    }).then(
      () => undefined,
      (error) => error
    );
    expect(failure.message).toBe(
      'Error updating alpha realm CIMD profile a: the server does not accept the attribute(s) extraTopLevel, extraInGroup'
    );
  });

  test('a 400 without detail names no attributes', async () => {
    putCIMDProfile.mockRejectedValue(
      errorWithStatus(400, {
        code: 400,
        message: 'Invalid attribute specified.',
      })
    );
    await expect(
      updateCIMDProfile({
        profileId: 'a',
        profileData: { extra: true },
        state: mockState(),
      })
    ).rejects.toThrow(/^Error updating alpha realm CIMD profile a$/);
  });

  test('another 400 names no attributes either', async () => {
    putCIMDProfile.mockRejectedValue(
      errorWithStatus(400, {
        message: 'Values for CIMD Client ID URL Patterns is required.',
      })
    );
    await expect(
      updateCIMDProfile({
        profileId: 'a',
        profileData: { extra: true },
        state: mockState(),
      })
    ).rejects.toThrow(/^Error updating alpha realm CIMD profile a$/);
  });
});

describe('describeInvalidAttributes', () => {
  const error = errorWithStatus(400, {
    message: 'Invalid attribute specified.',
    detail: { validAttributes: ['a', 'b', 'c'] },
  });

  test('ignores _id, _rev, _type and the names of the groups', () => {
    expect(
      describeInvalidAttributes(error, {
        _id: 'x',
        _rev: '1',
        _type: { _id: 'CIMDProfile' },
        cimdConfig: { a: 1 },
        overrideOAuth2ClientConfig: { b: 2 },
      })
    ).toBe('');
  });

  test('lists each unknown attribute once, in the order of the body', () => {
    expect(
      describeInvalidAttributes(error, {
        z: 1,
        cimdConfig: { y: 1, a: 1 },
        advancedOAuth2ClientConfig: { x: 1 },
      })
    ).toBe(': the server does not accept the attribute(s) z, y, x');
  });

  test('is empty for a error that is not that answer', () => {
    expect(describeInvalidAttributes(new Error('boom'), { z: 1 })).toBe('');
    expect(describeInvalidAttributes(undefined, { z: 1 })).toBe('');
    expect(
      describeInvalidAttributes(errorWithStatus(500, error.response.data), {
        z: 1,
      })
    ).toBe('');
  });
});

describe('deleteCIMDProfile', () => {
  test('returns the object the server returns', async () => {
    deleteCIMDProfile.mockResolvedValue(wrapped('a'));
    expect(await deleteProfile({ profileId: 'a', state: mockState() })).toEqual(
      wrapped('a')
    );
    expect(deleteCIMDProfile).toHaveBeenCalledTimes(1);
  });

  test('wraps a failing api call (the promise is awaited inside the try)', async () => {
    deleteCIMDProfile.mockRejectedValue(errorWithStatus(404));
    const failure = await deleteProfile({
      profileId: 'a',
      state: mockState(),
    }).then(
      () => undefined,
      (error) => error
    );
    expect(failure).toBeInstanceOf(FrodoError);
    expect(failure.message).toBe('Error deleting alpha realm CIMD profile a');
    expect(failure.httpStatus).toBe(404);
  });
});

describe('template and schema', () => {
  test('return the answer of the api', async () => {
    const state = mockState();
    expect(await readCIMDProfileTemplate({ state })).toEqual({
      cimdConfig: {},
    });
    expect(await readCIMDProfileSchema({ state })).toEqual({
      type: 'object',
      properties: {},
    });
  });

  test('wrap a failing api call', async () => {
    const state = mockState();
    getCIMDProfileTemplate.mockRejectedValue(errorWithStatus(500));
    getCIMDProfileSchema.mockRejectedValue(errorWithStatus(500));
    await expect(readCIMDProfileTemplate({ state })).rejects.toThrow(
      'Error reading alpha realm CIMD profile template'
    );
    await expect(readCIMDProfileSchema({ state })).rejects.toThrow(
      'Error reading alpha realm CIMD profile schema'
    );
  });
});

describe('the id check', () => {
  const refusedIds: [string, string][] = [
    ['empty', ''],
    ['.', '.'],
    ['..', '..'],
    ['a tab', 'a\tb'],
    ['a newline', 'a\nb'],
    ['a leading space', ' a'],
    ['a trailing space', 'a '],
    ...CIMD_PROFILE_ID_REFUSED_CHARACTERS.map((char): [string, string] => [
      `the character ${char}`,
      `a${char}b`,
    ]),
  ];

  const allowedIds: [string, string][] = [
    ['a dot inside', 'a.b'],
    ['an at sign', 'a@b'],
    ['mixed case', 'MiXeD'],
    ['an opening bracket', 'a[b'],
    ['a pipe', 'a|b'],
    ['a space inside', 'matrix mcp clients'],
    ['an emoji', 'mcp-😀'],
    ['a non-ASCII letter', 'Zoë'],
    ['7,000 characters', 'a'.repeat(7000)],
  ];

  test('refuses exactly the 13 characters of the table', () => {
    expect(CIMD_PROFILE_ID_REFUSED_CHARACTERS).toHaveLength(13);
    expect([...CIMD_PROFILE_ID_REFUSED_CHARACTERS].sort()).toEqual(
      ['!', '#', '%', "'", '(', ')', '*', '/', '?', '\\', '+', ',', ';'].sort()
    );
  });

  test.each(refusedIds)(
    '%s is refused without any request',
    async (_name, id) => {
      expect(() => checkCIMDProfileId(id)).toThrow(FrodoError);
      const state = mockState();
      for (const run of [
        () => readCIMDProfile({ profileId: id, state }),
        () => createCIMDProfile({ profileId: id, profileData: {}, state }),
        () => updateCIMDProfile({ profileId: id, profileData: {}, state }),
        () => deleteProfile({ profileId: id, state }),
      ]) {
        const failure = await run().then(
          () => undefined,
          (error) => error
        );
        expect(failure).toBeInstanceOf(FrodoError);
        expect(failure.code).toBeUndefined();
        expect(failure.originalErrors).toEqual([]);
      }
      expect(getAgentTypes).not.toHaveBeenCalled();
      expectNoRequestForProfiles();
    }
  );

  test.each(allowedIds)('%s is allowed', async (_name, id) => {
    expect(() => checkCIMDProfileId(id)).not.toThrow();
    const state = mockState();
    getCIMDProfiles.mockResolvedValue(page(id));
    expect((await readCIMDProfile({ profileId: id, state }))._id).toBe(id);
    await deleteProfile({ profileId: id, state });
    expect(deleteCIMDProfile).toHaveBeenCalledTimes(1);
  });

  test('a value that is not a string is refused', () => {
    expect(() => checkCIMDProfileId(undefined as unknown as string)).toThrow(
      FrodoError
    );
    expect(() => checkCIMDProfileId(42 as unknown as string)).toThrow(
      FrodoError
    );
  });
});
