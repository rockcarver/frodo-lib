import { type NoIdObjectSkeletonInterface } from '../../api/ApiTypes';
import {
  deleteOAuth2TrustedJwtIssuer,
  getOAuth2TrustedJwtIssuers,
  putOAuth2TrustedJwtIssuer,
} from '../../api/OAuth2TrustedJwtIssuerApi';
import { state } from '../../index';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import {
  defaultMatchRequestsBy,
  filterRecording,
} from '../../utils/PollyUtils';

/**
 * The realm of the issuer tests. The tests read the list of the realm and delete every issuer of it in the last phase,
 * so the realm must hold no issuer that is not a test issuer: recording stops before it starts if it does.
 */
export const TEST_REALM = 'bravo';

/** Every object the tests create has an id that starts with this */
export const TEST_ID_PREFIX = 'FrodoTest';

/** Is this recording phase active (replay runs all phases)? */
export function phase(n: 1 | 2 | 3): boolean {
  return (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === String(n))
  );
}

const isTestId = (id: string) => id.startsWith(TEST_ID_PREFIX);

/**
 * Throw-away PUBLIC keys, made for these tests and never used anywhere else. The private halves were discarded when
 * the keys were made, so nothing can be signed with them. The issuers below trust nobody.
 */
const PUBLIC_KEYS = [
  {
    kty: 'RSA',
    e: 'AQAB',
    use: 'sig',
    kid: 'frodo-test-key-1',
    alg: 'RS256',
    n: '3ly-15BVi20yWpfx0SamBc3sRZK3euh_Kx7ZWhK2p67YgzUn7s8hr8fHaJZiaaURIF992HSZWvPk_hEnzYTH4e2iWsWeGnGZDHqZY-psXEJ77cnQqb-pWKCx9casASauWGgEEDJgkol5kkuY-zIlllAtW2kJjc4t9_zingD9TQ8_RmU2Wmp6FlMEyYLps-GnIuFMoG9lIpS3a2u7en80aSeaZL5LCEjk0nR7DoOY751exGs0B1QPReEm3RXAHfr4fjG-uLsVavEworVRrqPYG0yitnxCpkyjwNflgdJD5xghO1lOD4G88sOdoRDxZqUwRiZAP6Mja6Qi8xMf24KvFQ',
  },
  {
    kty: 'RSA',
    e: 'AQAB',
    use: 'sig',
    kid: 'frodo-test-key-2',
    alg: 'RS256',
    n: 'sLQYLEJC504p2YdNSnmXb0Ao4wIjKKpiihfrxn4HLnoSAIP25Vj0o2cuPIn7_9xGnCg4ApSRSAIXKpL-kzh9RIfmWrIet41QXnpSYuK-LDvNm-rImyaZ_5-cTFNYKNdK93dg7QnT76a_NudEcIwxdD2kSF81Hkya-hrshAWl_Qn8BAoECHXUSo58wXqwJ5IexlNcJYdIaQ8HVzMq2GOL0fAFAzMJv4grzFVYtQJjaV8Y9QpTnRPqbZSVXYRAGxW0RboROJJG1eMPdEHC7pELFkcBR_ex2V-Ep2NtF2DfoYRE1vjc-QjgQ9bIuL_8kQ1MJZhyEPlD2h8Bu9TgQ_e9aQ',
  },
];

/** A JWKS (a JSON string, as the issuer holds it) with one of the throw-away public keys */
export const jwks = (n: 1 | 2) =>
  JSON.stringify({ keys: [PUBLIC_KEYS[n - 1]] });

/** An issuer with a JWKS in the wrapped shape of the single read */
export const withJwkSet = (n: number): NoIdObjectSkeletonInterface => ({
  issuer: { inherited: false, value: `https://issuer${n}.matrix.example.com` },
  allowedSubjects: {
    inherited: false,
    value: [`alice${n}@matrix.example.com`],
  },
  jwkSet: { inherited: false, value: jwks(1) },
  consentedScopesClaim: { inherited: false, value: 'scope' },
  resourceOwnerIdentityClaim: { inherited: false, value: 'sub' },
});

/** An issuer that fetches its keys from a URI, in the plain shape of the list */
export const withJwksUri = (n: number): NoIdObjectSkeletonInterface => ({
  issuer: `https://issuer${n}.matrix.example.com`,
  allowedSubjects: [`bob${n}@matrix.example.com`],
  jwksUri: `https://issuer${n}.matrix.example.com/.well-known/jwks.json`,
  jwksCacheTimeout: 7200000,
});

/** The smallest body the server accepts on create: it completes the issuer with its defaults */
export const minimal = (n: number): NoIdObjectSkeletonInterface => ({
  issuer: `https://issuer${n}.matrix.example.com`,
});

/** A sparse issuer: only some of the attributes, the rest is absent */
export const sparse = (n: number): NoIdObjectSkeletonInterface => ({
  issuer: { inherited: false, value: `https://issuer${n}.matrix.example.com` },
  allowedSubjects: { inherited: false, value: [] },
});

/** The server refuses this attribute */
export const unknownAttribute = (n: number): NoIdObjectSkeletonInterface => ({
  issuer: `https://issuer${n}.matrix.example.com`,
  bogusAttribute: 'x',
});

/** The server refuses this group of attributes, whose members the module removes before it tries again */
export const unknownGroup = (n: number): NoIdObjectSkeletonInterface => ({
  issuer: `https://issuer${n}.matrix.example.com`,
  legacyGroup: { x: 1, y: 2 },
});

/** The agent type an issuer carries in an export of agents */
export const issuerType = {
  _id: 'TrustedJwtIssuer',
  name: 'OAuth2 Trusted JWT Issuer Agents',
  collection: true,
};

/** The ids of the tests, by what the tests do with them */
export const ids = {
  issuer1: 'FrodoTestIssuer1',
  issuer2: 'FrodoTestIssuer2',
  issuer3: 'FrodoTestIssuer3',
  // imported by tests
  issuer4: 'FrodoTestIssuer4',
  issuer5: 'FrodoTestIssuer5',
  issuer6: 'FrodoTestIssuer6',
  issuer7: 'FrodoTestIssuer7',
  issuer8: 'FrodoTestIssuer8',
  // upserted by an update of an id that does not exist
  upsert: 'FrodoTestIssuerUpsert',
  // staged for the second phase (delete by id)
  delete1: 'FrodoTestIssuerDelete1',
  delete2: 'FrodoTestIssuerDelete2',
  // staged for the third phase (delete all)
  all1: 'FrodoTestIssuerAll1',
  all2: 'FrodoTestIssuerAll2',
  all3: 'FrodoTestIssuerAll3',
  all4: 'FrodoTestIssuerAll4',
  all5: 'FrodoTestIssuerAll5',
};

/**
 * What a snapshot holds of an issuer: its members and which of them are wrapped (`{ inherited, value }`) or null, so
 * that the shape (single read: wrapped, list: plain with nulls) and the completeness (sparse or completed by the
 * server) can be asserted without the key material.
 * @param {object} issuer a trusted JWT issuer in either shape
 * @returns {object} the shape
 */
export function shapeOf(issuer: Record<string, any>) {
  const isWrapped = (value: any) =>
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'inherited' in value;
  const members = Object.entries(issuer).filter(
    ([name]) => !name.startsWith('_')
  );
  return {
    id: issuer._id,
    hasRevision: typeof issuer._rev === 'string',
    type: issuer._type,
    members: members.map(([name]) => name).sort(),
    wrapped: members
      .filter(([, value]) => isWrapped(value))
      .map(([name]) => name)
      .sort(),
    nulls: members
      .filter(([, value]) => value === null)
      .map(([name]) => name)
      .sort(),
  };
}

let currentRealm = TEST_REALM;

/**
 * Change the realm the tests run against (default: the test realm). The root realm of a Cloud tenant offers no trusted
 * JWT issuers, which is what a describe block of its own shows: set the realm in its `beforeAll` and put it back in
 * its `afterAll`.
 * @param {string} realm the realm, for example '/'
 */
export function setTestRealm(realm: string = TEST_REALM) {
  currentRealm = realm;
}

/**
 * Make the state point at the realm of the tests. The host stays as the login left it: when the host is the alias of
 * a connection profile, the login replaced it by the host of the profile.
 */
export function useTestRealm() {
  state.setRealm(currentRealm);
}

/**
 * Fail before anything is written if the realm holds an issuer that is not a test issuer.
 * @throws {Error} if there is a foreign issuer (only the number is named)
 */
export async function assertNoForeignIssuers() {
  const { result } = await getOAuth2TrustedJwtIssuers({ state });
  const foreign = result.filter((issuer) => !isTestId(issuer._id));
  if (foreign.length > 0) {
    throw new Error(
      `Refusing to record: the realm '${TEST_REALM}' holds ${foreign.length} trusted JWT issuer(s) that are not test issuers.`
    );
  }
}

/** Delete every test issuer of the realm (and only those) */
export async function removeTestIssuers() {
  const { result } = await getOAuth2TrustedJwtIssuers({ state });
  for (const issuer of result) {
    if (isTestId(issuer._id)) {
      await deleteOAuth2TrustedJwtIssuer({ id: issuer._id, state });
    }
  }
}

/** Delete the issuer if it exists, then create it if data are given */
export async function stageIssuer(
  id: string,
  data?: NoIdObjectSkeletonInterface
) {
  try {
    await deleteOAuth2TrustedJwtIssuer({ id, state });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore: it did not exist
  }
  if (data) {
    await putOAuth2TrustedJwtIssuer({ id, issuerData: data, state });
  }
}

/** The staging of a phase in record mode: a realm that holds nothing but test issuers, and what the phase needs */
export async function stagePhase(n: 1 | 2 | 3) {
  useTestRealm();
  await assertNoForeignIssuers();
  await removeTestIssuers();
  switch (n) {
    case 2:
      await stageIssuer(ids.delete1, withJwkSet(11));
      await stageIssuer(ids.delete2, minimal(12));
      break;
    case 3:
      await stageIssuer(ids.all1, withJwkSet(21));
      await stageIssuer(ids.all2, withJwksUri(22));
      await stageIssuer(ids.all3, sparse(23));
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
 * Register the replay and the recording of a test file: ordered matching (a request that is made twice in a test
 * replays in the order it was recorded), the filter of secrets in record mode, and the test realm.
 * @returns the Polly context
 */
export function setup() {
  const matchConfig = defaultMatchRequestsBy();
  matchConfig.order = true;
  const ctx = autoSetupPolly(matchConfig);

  beforeEach(() => {
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
  });

  return ctx;
}
