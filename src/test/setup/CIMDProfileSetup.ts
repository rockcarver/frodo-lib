import {
  deleteCIMDProfile,
  getCIMDProfiles,
  putCIMDProfile,
  type CIMDProfileSkeleton,
} from '../../api/OAuth2CIMDProfileApi';
import { state } from '../../index';
import { readAgentTypeItems } from '../../ops/internal/AgentTypeHelpers';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import {
  defaultMatchRequestsBy,
  filterRecording,
} from '../../utils/PollyUtils';

/**
 * The realm of the CIMD tests. The tests read the list of the realm and delete every profile of it in the last phase,
 * so the realm must hold no profile that is not a test profile: recording stops before it starts if it does.
 */
export const TEST_REALM = 'bravo';

/** Every object the tests create has an id that starts with this (the check ignores case, the server does too) */
export const TEST_ID_PREFIX = 'FrodoTest';

/** Is this recording phase active (replay runs all phases)? */
export function phase(n: 1 | 2 | 3): boolean {
  return (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === String(n))
  );
}

const isTestId = (id: string) =>
  id.toLowerCase().startsWith(TEST_ID_PREFIX.toLowerCase());

/** A CIMD profile in the plain shape of the list: the wrapper `{ inherited, value }` is optional on a write */
export const rich = (n: number): CIMDProfileSkeleton => ({
  cimdConfig: {
    cimdClientIdUrlPatterns: [
      `https://clients${n}.matrix.example.com/*`,
      `https://clients${n}.matrix.example.com:8443/agents/*`,
    ],
    cimdMetadataDenyList: ['scope', 'redirect_uris'],
    cimdSsrfProtectionEnabled: true,
  },
  coreOAuth2ClientConfig: {
    status: 'Active',
    clientName: [`FrodoTest CIMD profile ${n}`],
    scopes: ['openid', 'profile'],
    defaultScopes: ['openid'],
    redirectionUris: [`https://clients${n}.matrix.example.com/callback`],
    accessTokenLifetime: 300,
  },
  advancedOAuth2ClientConfig: {
    grantTypes: ['authorization_code', 'refresh_token'],
    tokenEndpointAuthMethod: 'none',
    // a journey every realm of a tenant has
    treeName: 'Login',
  },
});

/** A CIMD profile in the wrapped shape of the single read: SSRF protection off, a deny list */
export const wrapped = (n: number): CIMDProfileSkeleton => ({
  cimdConfig: {
    cimdClientIdUrlPatterns: {
      inherited: false,
      value: [`https://clients${n}.matrix.example.com/agents/*`],
    },
    cimdMetadataDenyList: {
      inherited: false,
      value: ['client_name', 'contacts'],
    },
    cimdSsrfProtectionEnabled: { inherited: false, value: false },
  },
});

/** The smallest body the server accepts on create: it completes the profile with its defaults */
export const minimal = (n: number): CIMDProfileSkeleton => ({
  cimdConfig: {
    cimdClientIdUrlPatterns: [`https://clients${n}.matrix.example.com/*`],
  },
});

/** A sparse profile: only some of the attributes, the rest is absent */
export const sparse = (n: number): CIMDProfileSkeleton => ({
  cimdConfig: {
    cimdClientIdUrlPatterns: [`https://clients${n}.matrix.example.com/*`],
    cimdMetadataDenyList: ['scope'],
    cimdSsrfProtectionEnabled: true,
  },
  coreOAuth2ClientConfig: {
    status: 'Active',
    clientName: [`FrodoTest CIMD sparse ${n}`],
  },
});

/** The server refuses this pattern: the scheme is not https */
export const invalidPattern = (n: number): CIMDProfileSkeleton => ({
  cimdConfig: {
    cimdClientIdUrlPatterns: [`http://clients${n}.matrix.example.com/*`],
  },
});

/** The server refuses these attributes: one inside a group, one that is no group at all */
export const unknownAttributes = (n: number): CIMDProfileSkeleton =>
  ({
    cimdConfig: {
      cimdClientIdUrlPatterns: [`https://clients${n}.matrix.example.com/*`],
      cimdBogus: true,
    },
    notAGroup: { x: 1 },
  }) as unknown as CIMDProfileSkeleton;

/** An id with the characters the module has to encode (and some it must not refuse): space, brackets, accent, signs */
export const oddId = 'FrodoTest CIMD id [x]^|é$&=:@~.';

/**
 * What a snapshot holds of a large profile: per group the number of attributes, of wrapped attributes (`{ inherited,
 * value }`) and of nulls, so that the shape (single read: wrapped, list: plain) and the completeness (sparse or
 * completed by the server) can be asserted without a thousand lines.
 * @param {object} profile a CIMD profile in either shape
 * @returns {object} the shape
 */
export function shapeOf(profile: Record<string, any>) {
  const isWrapped = (value: any) =>
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'inherited' in value;
  const groups: Record<
    string,
    { attributes: number; wrapped: number; nulls: number }
  > = {};
  for (const [name, group] of Object.entries(profile)) {
    if (name.startsWith('_') || !group || typeof group !== 'object') continue;
    const values = Object.values(group);
    groups[name] = {
      attributes: values.length,
      wrapped: values.filter(isWrapped).length,
      nulls: values.filter((value) => value === null).length,
    };
  }
  return {
    id: profile._id,
    hasRevision: typeof profile._rev === 'string',
    type: profile._type,
    groups,
  };
}

/** The ids of the tests, by what the tests do with them */
export const ids = {
  // staged before the tests that read it, or created by a test of the first phase
  profile1: 'FrodoTestCIMDProfile1',
  profile2: 'FrodoTestCIMDProfile2',
  profile3: 'FrodoTestCIMDProfile3',
  // imported by tests
  profile4: 'FrodoTestCIMDProfile4',
  profile5: 'FrodoTestCIMDProfile5',
  profile6: 'FrodoTestCIMDProfile6',
  profile7: 'FrodoTestCIMDProfile7',
  // upserted by an update of an id that does not exist
  upsert: 'FrodoTestCIMDUpsert',
  // case-insensitive uniqueness
  caseOriginal: 'FrodoTestCIMDCase',
  caseOther: 'FRODOTESTCIMDCASE',
  // staged for the second phase (delete by id)
  delete1: 'FrodoTestCIMDDelete1',
  delete2: 'FrodoTestCIMDDelete2',
  // staged for the third phase (delete all)
  all1: 'FrodoTestCIMDAll1',
  all2: 'FrodoTestCIMDAll2',
  all3: 'FrodoTestCIMDAll3',
  all4: 'FrodoTestCIMDAll4',
  all5: 'FrodoTestCIMDAll5',
};

let currentRealm = TEST_REALM;

/**
 * Change the realm the tests run against (default: the test realm). The root realm of a Cloud tenant offers no CIMD
 * profiles, which is what a describe block of its own shows: set the realm in its `beforeAll` and put it back in its
 * `afterAll`, because the realm has to be known before the first request of a test, the type list of the hook.
 * @param {string} realm the realm, for example '/'
 */
export function setTestRealm(realm: string = TEST_REALM) {
  currentRealm = realm;
}

/**
 * Make the state point at the realm of the tests. The host stays as the login left it: when the host is the alias of
 * a connection profile, the login replaced it by the host of the profile, and setting the default state again would
 * put the alias back.
 */
export function useTestRealm() {
  state.setRealm(currentRealm);
}

/**
 * Fail before anything is written if the realm holds a profile that is not a test profile.
 * @throws {Error} if there is a foreign profile (only the number is named)
 */
export async function assertNoForeignProfiles() {
  const { result } = await getCIMDProfiles({ state });
  const foreign = result.filter((profile) => !isTestId(profile._id));
  if (foreign.length > 0) {
    throw new Error(
      `Refusing to record: the realm '${TEST_REALM}' holds ${foreign.length} CIMD profile(s) that are not test profiles.`
    );
  }
}

/** Delete every test profile of the realm (and only those) */
export async function removeTestProfiles() {
  const { result } = await getCIMDProfiles({ state });
  for (const profile of result) {
    if (isTestId(profile._id)) {
      await deleteCIMDProfile({ profileId: profile._id, state });
    }
  }
}

/** Delete the profile if it exists, then create it if data are given */
export async function stageProfile(id: string, data?: CIMDProfileSkeleton) {
  try {
    await deleteCIMDProfile({ profileId: id, state });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore: it did not exist
  }
  if (data) {
    await putCIMDProfile({ profileId: id, profileData: data, state });
  }
}

/** The staging of a phase in record mode: a realm that holds nothing but test profiles, and what the phase needs */
export async function stagePhase(n: 1 | 2 | 3) {
  useTestRealm();
  await assertNoForeignProfiles();
  await removeTestProfiles();
  switch (n) {
    case 2:
      await stageProfile(ids.delete1, rich(11));
      await stageProfile(ids.delete2, minimal(12));
      await stageProfile(oddId, minimal(13));
      break;
    case 3:
      await stageProfile(ids.all1, rich(21));
      await stageProfile(ids.all2, wrapped(22));
      await stageProfile(ids.all3, sparse(23));
      break;
  }
}

/** What the tests saw of the requests of the current test (the replay ignores headers, so the tests look at them here) */
export const requests: {
  method: string;
  path: string;
  headers: Record<string, string>;
}[] = [];

/**
 * The last request of the current test with this method.
 * @param {string} method the HTTP method
 * @returns the request, with lower case header names
 */
export function lastRequest(method: string) {
  return [...requests].reverse().find((request) => request.method === method);
}

/**
 * Register the replay and the recording of a test file: ordered matching (a request that is made twice in a test, for
 * example the second write of an import that completes a profile, replays in the order it was recorded), the filter
 * of secrets in record mode, the test realm, and the agent type list asked for again by every test.
 *
 * The type list is cached for the life of the process. Without the refresh the first test that needs it would hold the
 * only recording of the request, and a test run alone (`-t`) would fail in replay.
 * @param {boolean} primeTypes true to ask the type list before each test (default: true)
 * @returns the Polly context
 */
export function setup(primeTypes = true) {
  const matchConfig = defaultMatchRequestsBy();
  matchConfig.order = true;
  const ctx = autoSetupPolly(matchConfig);

  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
    requests.length = 0;
    ctx.polly.server.any().on('request', (req) => {
      requests.push({
        method: req.method,
        path: req.pathname,
        headers: Object.fromEntries(
          Object.entries(req.headers).map(([k, v]) => [
            k.toLowerCase(),
            String(v),
          ])
        ),
      });
    });
    useTestRealm();
    if (primeTypes) {
      await readAgentTypeItems({ refreshCache: true, state });
    }
  });

  return ctx;
}
