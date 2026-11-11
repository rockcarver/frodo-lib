import { type NoIdObjectSkeletonInterface } from '../api/ApiTypes';
import {
  deleteCIMDProfile as _deleteCIMDProfile,
  getCIMDProfiles as _getCIMDProfiles,
  getCIMDProfileSchema as _getCIMDProfileSchema,
  getCIMDProfileTemplate as _getCIMDProfileTemplate,
  putCIMDProfile as _putCIMDProfile,
  type CIMDProfileSchema,
  type CIMDProfileSkeleton,
} from '../api/OAuth2CIMDProfileApi';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { getCurrentRealmName } from '../utils/ForgeRockUtils';
import { FrodoError } from './FrodoError';
import { isAgentTypeOffered } from './internal/AgentTypeHelpers';

/**
 * Manage CIMD profiles (agent type `CIMDProfile`).
 *
 * A CIMD profile is an allow-list of `https://` client id URL patterns: a client whose client id matches a pattern of
 * a profile may act as an OAuth 2.0 client without being registered (Client ID Metadata Documents). A deployment
 * advertises whether it offers the type in its agent type list. Where it does not (the root realm of an Identity
 * Cloud tenant, a tenant or a self-hosted server from before the feature), reading all profiles gives an empty list and
 * every function that names a profile, the template or the schema fails with the error code
 * `CIMD_PROFILES_NOT_AVAILABLE`; {@link OAuth2CIMDProfile.isCIMDProfileAvailable} answers the question without an error.
 *
 * Reads return the plain shape (values without the `{ inherited, value }` wrapper) as the profile is stored: a profile
 * that was stored with few attributes has few attributes. Writes accept plain and wrapped values.
 */
export type OAuth2CIMDProfile = {
  /**
   * Find out whether the realm offers CIMD profiles. The answer comes from the agent type list of the deployment,
   * which is kept per realm; a deployment without the type is a normal answer (`false`), not an error.
   * @param {boolean} refreshCache true to ask the server again before answering, false to use the list read earlier. Default: false.
   * @returns {Promise<boolean>} a promise that resolves to true if the realm offers the agent type CIMDProfile and false otherwise
   */
  isCIMDProfileAvailable(refreshCache?: boolean): Promise<boolean>;
  /**
   * Read the CIMD profile template. The template is plain and not valid as it stands: the list of client id URL patterns is empty and the server requires at least one when it creates a profile. Fails with the error code CIMD_PROFILES_NOT_AVAILABLE if the realm does not offer CIMD profiles.
   * @returns {Promise<CIMDProfileSkeleton>} a promise that resolves to a CIMD profile template object
   */
  readCIMDProfileTemplate(): Promise<CIMDProfileSkeleton>;
  /**
   * Read the CIMD profile schema. Fails with the error code CIMD_PROFILES_NOT_AVAILABLE if the realm does not offer CIMD profiles.
   * @returns {Promise<CIMDProfileSchema>} a promise that resolves to the JSON schema of a CIMD profile
   */
  readCIMDProfileSchema(): Promise<CIMDProfileSchema>;
  /**
   * Read all CIMD profiles of the realm, sorted by id, in the plain shape. If the realm does not offer CIMD profiles the result is empty and no request for profiles is made.
   * @returns {Promise<CIMDProfileSkeleton[]>} a promise that resolves to an array of CIMD profile objects
   */
  readCIMDProfiles(): Promise<CIMDProfileSkeleton[]>;
  /**
   * Read a CIMD profile in the plain shape, the same object that readCIMDProfiles returns for it. The id is matched ignoring case, as the server does. Fails with the error code CIMD_PROFILES_NOT_AVAILABLE if the realm does not offer CIMD profiles.
   * @param {string} profileId CIMD profile id
   * @returns {Promise<CIMDProfileSkeleton>} a promise that resolves to a CIMD profile object
   */
  readCIMDProfile(profileId: string): Promise<CIMDProfileSkeleton>;
  /**
   * Create a CIMD profile. Fails if a profile with that id exists (ids are unique ignoring case). The server completes the profile with its defaults, so a body with a client id URL pattern in cimdConfig is enough; values may be plain or wrapped as inherited/value. Fails with the error code CIMD_PROFILES_NOT_AVAILABLE if the realm does not offer CIMD profiles.
   * @param {string} profileId CIMD profile id
   * @param {CIMDProfileSkeleton | NoIdObjectSkeletonInterface} profileData CIMD profile object
   * @returns {Promise<CIMDProfileSkeleton>} a promise that resolves to the created CIMD profile object as the server answers it (wrapped shape)
   */
  createCIMDProfile(
    profileId: string,
    profileData: CIMDProfileSkeleton | NoIdObjectSkeletonInterface
  ): Promise<CIMDProfileSkeleton>;
  /**
   * Update or create a CIMD profile. The server stores exactly what is sent when the profile exists: a body with only cimdConfig leaves a profile with only those attributes, a body without cimdConfig leaves a profile without client id URL patterns. Read the profile first and send every group that should be kept. When the id does not exist the profile is created and completed with the server's defaults. The server does not check revisions, so a concurrent update is lost without notice. Fails with the error code CIMD_PROFILES_NOT_AVAILABLE if the realm does not offer CIMD profiles.
   * @param {string} profileId CIMD profile id
   * @param {CIMDProfileSkeleton | NoIdObjectSkeletonInterface} profileData CIMD profile object
   * @returns {Promise<CIMDProfileSkeleton>} a promise that resolves to the stored CIMD profile object as the server answers it (wrapped shape)
   */
  updateCIMDProfile(
    profileId: string,
    profileData: CIMDProfileSkeleton | NoIdObjectSkeletonInterface
  ): Promise<CIMDProfileSkeleton>;
  /**
   * Delete a CIMD profile. Fails if the profile does not exist, and with the error code CIMD_PROFILES_NOT_AVAILABLE if the realm does not offer CIMD profiles.
   * @param {string} profileId CIMD profile id
   * @returns {Promise<CIMDProfileSkeleton>} a promise that resolves to the deleted CIMD profile object (wrapped shape)
   */
  deleteCIMDProfile(profileId: string): Promise<CIMDProfileSkeleton>;
};

export default (state: State): OAuth2CIMDProfile => {
  return {
    async isCIMDProfileAvailable(refreshCache: boolean = false) {
      return isCIMDProfileAvailable({ refreshCache, state });
    },
    async readCIMDProfileTemplate() {
      return readCIMDProfileTemplate({ state });
    },
    async readCIMDProfileSchema() {
      return readCIMDProfileSchema({ state });
    },
    async readCIMDProfiles() {
      return readCIMDProfiles({ state });
    },
    async readCIMDProfile(profileId: string) {
      return readCIMDProfile({ profileId, state });
    },
    async createCIMDProfile(
      profileId: string,
      profileData: CIMDProfileSkeleton | NoIdObjectSkeletonInterface
    ) {
      return createCIMDProfile({ profileId, profileData, state });
    },
    async updateCIMDProfile(
      profileId: string,
      profileData: CIMDProfileSkeleton | NoIdObjectSkeletonInterface
    ) {
      return updateCIMDProfile({ profileId, profileData, state });
    },
    async deleteCIMDProfile(profileId: string) {
      return deleteCIMDProfile({ profileId, state });
    },
  };
};

/**
 * The characters that a CIMD profile id must not contain. On Identity Cloud the edge refuses `! # % ' ( ) * / ? \`
 * before the server sees the request (an empty 400 or an HTML page) and the server or the edge answers 500 for
 * `+ , ;`. Self-hosted deployments may accept some of them: this is the one place to relax the check.
 */
export const CIMD_PROFILE_ID_REFUSED_CHARACTERS = [
  '!',
  '#',
  '%',
  "'",
  '(',
  ')',
  '*',
  '/',
  '?',
  '\\',
  '+',
  ',',
  ';',
];

/**
 * The groups of a CIMD profile (the top-level members that hold attributes).
 */
const CIMD_PROFILE_GROUPS = [
  'cimdConfig',
  'coreOAuth2ClientConfig',
  'advancedOAuth2ClientConfig',
  'coreOpenIDClientConfig',
  'signEncOAuth2ClientConfig',
  'overrideOAuth2ClientConfig',
];

/**
 * Check a CIMD profile id before any request is made. A courtesy that replaces an empty 400 or 500 of the server by a
 * message: it throws a plain error (no cause, no code) if the id is not a non-empty string, is `.` or `..`, contains a
 * control character, begins or ends with a space, or contains one of the characters in
 * {@link CIMD_PROFILE_ID_REFUSED_CHARACTERS}. Everything else the server accepts is allowed, including `[ ] |`, a space
 * inside, non-ASCII characters and very long ids.
 * @param {string} profileId CIMD profile id
 * @throws {FrodoError} if the id would be refused by the server or its edge
 */
export function checkCIMDProfileId(profileId: string): void {
  if (typeof profileId !== 'string' || profileId.length === 0) {
    throw new FrodoError('A CIMD profile id must be a non-empty string.');
  }
  if (profileId === '.' || profileId === '..') {
    throw new FrodoError(`'${profileId}' is not a valid CIMD profile id.`);
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(profileId)) {
    throw new FrodoError(
      `The CIMD profile id '${profileId}' contains a control character.`
    );
  }
  if (profileId.startsWith(' ') || profileId.endsWith(' ')) {
    throw new FrodoError(
      `The CIMD profile id '${profileId}' begins or ends with a space.`
    );
  }
  const refused = CIMD_PROFILE_ID_REFUSED_CHARACTERS.find((char) =>
    profileId.includes(char)
  );
  if (refused) {
    throw new FrodoError(
      `The CIMD profile id '${profileId}' contains the character '${refused}', which a deployment refuses in an id.`
    );
  }
}

/**
 * Tell which attributes of a profile the server did not accept. The server answers `400 "Invalid attribute specified."`
 * and lists only the attributes it knows (`detail.validAttributes`); this compares them with the members of the body:
 * the top-level members other than `_id`, `_rev`, `_type` and the six groups, and the members of each group.
 * @param {unknown} error the error of the request
 * @param {CIMDProfileSkeleton | NoIdObjectSkeletonInterface} profileData the profile that was sent
 * @returns {string} the text to append to the message of the error, `: the server does not accept the attribute(s) x, y`, or an empty string if the cause is not that answer or no attribute could be named
 */
export function describeInvalidAttributes(
  error: unknown,
  profileData: CIMDProfileSkeleton | NoIdObjectSkeletonInterface
): string {
  const response = (error as { response?: { status?: number; data?: any } })
    ?.response;
  const valid: unknown = response?.data?.detail?.validAttributes;
  if (
    response?.status !== 400 ||
    response?.data?.message !== 'Invalid attribute specified.' ||
    !Array.isArray(valid)
  ) {
    return '';
  }
  const known = new Set<string>(valid.map(String));
  const unknown: string[] = [];
  for (const [key, value] of Object.entries(profileData ?? {})) {
    if (['_id', '_rev', '_type'].includes(key)) continue;
    if (CIMD_PROFILE_GROUPS.includes(key)) {
      if (value && typeof value === 'object') {
        for (const attribute of Object.keys(value)) {
          if (!known.has(attribute)) unknown.push(attribute);
        }
      }
    } else if (!known.has(key)) {
      unknown.push(key);
    }
  }
  return unknown.length > 0
    ? `: the server does not accept the attribute(s) ${unknown.join(', ')}`
    : '';
}

function hasHttpStatus(error: unknown, status: number): boolean {
  const withStatus = error as {
    httpStatus?: number;
    response?: { status?: number };
  };
  return (
    withStatus?.httpStatus === status || withStatus?.response?.status === status
  );
}

/**
 * Find out whether the realm offers CIMD profiles, from the agent type list of the deployment.
 * @param {object} params structured and named parameters
 * @param {boolean} params.refreshCache true to ask the server again before answering. Default: false.
 * @param {State} params.state the state object
 * @returns {Promise<boolean>} a promise that resolves to true if the realm offers the agent type CIMDProfile and false otherwise
 */
export async function isCIMDProfileAvailable({
  refreshCache = false,
  state,
}: {
  refreshCache?: boolean;
  state: State;
}): Promise<boolean> {
  return isAgentTypeOffered({ agentType: 'CIMDProfile', refreshCache, state });
}

/**
 * Make sure the realm offers CIMD profiles before a request names one. If the cached type list does not offer the type
 * the list is read once more, so that a stale negative does not block a tenant that was upgraded after the first
 * read. The error is thrown as it is, not wrapped, so that a caller reads `error.code` without walking `originalErrors`.
 * @param {object} params structured and named parameters
 * @param {State} params.state the state object
 * @throws {FrodoError} with the code `CIMD_PROFILES_NOT_AVAILABLE` if the realm does not offer the agent type CIMDProfile
 */
export async function assertCIMDProfileAvailable({
  state,
}: {
  state: State;
}): Promise<void> {
  if (await isCIMDProfileAvailable({ state })) return;
  if (await isCIMDProfileAvailable({ refreshCache: true, state })) return;
  throw new FrodoError(
    `CIMD profiles are not available in the ${getCurrentRealmName(state) + ' realm'} of this deployment: the server does not offer the agent type 'CIMDProfile'.`,
    null,
    'CIMD_PROFILES_NOT_AVAILABLE'
  );
}

/**
 * Read the CIMD profile template. The template is plain and not valid as it stands: the list of client id URL patterns is empty and the server requires at least one when it creates a profile.
 * @param {object} params structured and named parameters
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileSkeleton>} a promise that resolves to a CIMD profile template object
 * @throws {FrodoError} with the code `CIMD_PROFILES_NOT_AVAILABLE` if the realm does not offer CIMD profiles
 */
export async function readCIMDProfileTemplate({
  state,
}: {
  state: State;
}): Promise<CIMDProfileSkeleton> {
  debugMessage({
    message: `OAuth2CIMDProfileOps.readCIMDProfileTemplate: start`,
    state,
  });
  await assertCIMDProfileAvailable({ state });
  try {
    const template = await _getCIMDProfileTemplate({ state });
    debugMessage({
      message: `OAuth2CIMDProfileOps.readCIMDProfileTemplate: end`,
      state,
    });
    return template;
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} CIMD profile template`,
      error
    );
  }
}

/**
 * Read the CIMD profile schema
 * @param {object} params structured and named parameters
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileSchema>} a promise that resolves to the JSON schema of a CIMD profile
 * @throws {FrodoError} with the code `CIMD_PROFILES_NOT_AVAILABLE` if the realm does not offer CIMD profiles
 */
export async function readCIMDProfileSchema({
  state,
}: {
  state: State;
}): Promise<CIMDProfileSchema> {
  debugMessage({
    message: `OAuth2CIMDProfileOps.readCIMDProfileSchema: start`,
    state,
  });
  await assertCIMDProfileAvailable({ state });
  try {
    const schema = await _getCIMDProfileSchema({ state });
    debugMessage({
      message: `OAuth2CIMDProfileOps.readCIMDProfileSchema: end`,
      state,
    });
    return schema;
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} CIMD profile schema`,
      error
    );
  }
}

/**
 * Read all CIMD profiles of the realm, sorted by id, in the plain shape. A realm that does not offer CIMD profiles has none: the result is empty and no request for profiles is made.
 * @param {object} params structured and named parameters
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileSkeleton[]>} a promise that resolves to an array of CIMD profile objects
 */
export async function readCIMDProfiles({
  state,
}: {
  state: State;
}): Promise<CIMDProfileSkeleton[]> {
  debugMessage({
    message: `OAuth2CIMDProfileOps.readCIMDProfiles: start`,
    state,
  });
  if (!(await isCIMDProfileAvailable({ state }))) {
    debugMessage({
      message: `OAuth2CIMDProfileOps.readCIMDProfiles: the ${getCurrentRealmName(state) + ' realm'} does not offer CIMD profiles`,
      state,
    });
    return [];
  }
  try {
    const { result } = await _getCIMDProfiles({ state });
    const profiles = [...result];
    profiles.sort((a, b) => a._id.localeCompare(b._id));
    debugMessage({
      message: `OAuth2CIMDProfileOps.readCIMDProfiles: end`,
      state,
    });
    return profiles;
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} CIMD profiles`,
      error
    );
  }
}

/**
 * Read a CIMD profile in the plain shape. The profile is picked from the list of the realm, ignoring case, because ids are unique ignoring case and a query by id misses ids with characters outside the basic multilingual plane. The `_id` of the result is the stored one.
 * @param {object} params structured and named parameters
 * @param {string} params.profileId CIMD profile id
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileSkeleton>} a promise that resolves to a CIMD profile object
 * @throws {FrodoError} with the code `CIMD_PROFILES_NOT_AVAILABLE` if the realm does not offer CIMD profiles
 */
export async function readCIMDProfile({
  profileId,
  state,
}: {
  profileId: string;
  state: State;
}): Promise<CIMDProfileSkeleton> {
  debugMessage({
    message: `OAuth2CIMDProfileOps.readCIMDProfile: start [${profileId}]`,
    state,
  });
  checkCIMDProfileId(profileId);
  await assertCIMDProfileAvailable({ state });
  let profiles: CIMDProfileSkeleton[];
  try {
    ({ result: profiles } = await _getCIMDProfiles({ state }));
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} CIMD profile ${profileId}`,
      error
    );
  }
  const lowerCaseId = profileId.toLowerCase();
  const profile =
    profiles.find((item) => item._id === profileId) ??
    profiles.find((item) => item._id?.toLowerCase() === lowerCaseId);
  if (!profile) {
    throw new FrodoError(
      `${getCurrentRealmName(state) + ' realm'} CIMD profile ${profileId} not found`
    );
  }
  debugMessage({
    message: `OAuth2CIMDProfileOps.readCIMDProfile: end [${profileId}]`,
    state,
  });
  return profile;
}

/**
 * Create a CIMD profile. Fails if a profile with that id exists (the server answers 412 to the create-only request). The server completes the profile with its defaults, so `{ cimdConfig: { cimdClientIdUrlPatterns: [...] } }` is enough.
 * @param {object} params structured and named parameters
 * @param {string} params.profileId CIMD profile id
 * @param {CIMDProfileSkeleton | NoIdObjectSkeletonInterface} params.profileData CIMD profile object, plain or wrapped values
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileSkeleton>} a promise that resolves to the created CIMD profile object as the server answers it (wrapped shape)
 * @throws {FrodoError} with the code `CIMD_PROFILES_NOT_AVAILABLE` if the realm does not offer CIMD profiles
 */
export async function createCIMDProfile({
  profileId,
  profileData,
  state,
}: {
  profileId: string;
  profileData: CIMDProfileSkeleton | NoIdObjectSkeletonInterface;
  state: State;
}): Promise<CIMDProfileSkeleton> {
  debugMessage({
    message: `OAuth2CIMDProfileOps.createCIMDProfile: start [${profileId}]`,
    state,
  });
  checkCIMDProfileId(profileId);
  await assertCIMDProfileAvailable({ state });
  try {
    const { data } = await _putCIMDProfile({
      profileId,
      profileData,
      failIfExists: true,
      state,
    });
    debugMessage({
      message: `OAuth2CIMDProfileOps.createCIMDProfile: end [${profileId}]`,
      state,
    });
    return data;
  } catch (error) {
    if (hasHttpStatus(error, 412)) {
      throw new FrodoError(
        `${getCurrentRealmName(state) + ' realm'} CIMD profile ${profileId} already exists!`,
        error
      );
    }
    throw new FrodoError(
      `Error creating ${getCurrentRealmName(state) + ' realm'} CIMD profile ${profileId}${describeInvalidAttributes(error, profileData)}`,
      error
    );
  }
}

/**
 * Update or create a CIMD profile. On an existing profile the server stores exactly what is sent; on a missing id it creates the profile and completes it with its defaults. Nothing is retried and no attribute is removed: a security setting is never dropped silently.
 * @param {object} params structured and named parameters
 * @param {string} params.profileId CIMD profile id
 * @param {CIMDProfileSkeleton | NoIdObjectSkeletonInterface} params.profileData CIMD profile object, plain or wrapped values
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileSkeleton>} a promise that resolves to the stored CIMD profile object as the server answers it (wrapped shape)
 * @throws {FrodoError} with the code `CIMD_PROFILES_NOT_AVAILABLE` if the realm does not offer CIMD profiles
 */
export async function updateCIMDProfile({
  profileId,
  profileData,
  state,
}: {
  profileId: string;
  profileData: CIMDProfileSkeleton | NoIdObjectSkeletonInterface;
  state: State;
}): Promise<CIMDProfileSkeleton> {
  debugMessage({
    message: `OAuth2CIMDProfileOps.updateCIMDProfile: start [${profileId}]`,
    state,
  });
  checkCIMDProfileId(profileId);
  await assertCIMDProfileAvailable({ state });
  try {
    const { data } = await _putCIMDProfile({
      profileId,
      profileData,
      failIfExists: false,
      state,
    });
    debugMessage({
      message: `OAuth2CIMDProfileOps.updateCIMDProfile: end [${profileId}]`,
      state,
    });
    return data;
  } catch (error) {
    throw new FrodoError(
      `Error updating ${getCurrentRealmName(state) + ' realm'} CIMD profile ${profileId}${describeInvalidAttributes(error, profileData)}`,
      error
    );
  }
}

/**
 * Delete a CIMD profile
 * @param {object} params structured and named parameters
 * @param {string} params.profileId CIMD profile id
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileSkeleton>} a promise that resolves to the deleted CIMD profile object (wrapped shape)
 * @throws {FrodoError} with the code `CIMD_PROFILES_NOT_AVAILABLE` if the realm does not offer CIMD profiles
 */
export async function deleteCIMDProfile({
  profileId,
  state,
}: {
  profileId: string;
  state: State;
}): Promise<CIMDProfileSkeleton> {
  debugMessage({
    message: `OAuth2CIMDProfileOps.deleteCIMDProfile: start [${profileId}]`,
    state,
  });
  checkCIMDProfileId(profileId);
  await assertCIMDProfileAvailable({ state });
  try {
    const deleted = await _deleteCIMDProfile({ profileId, state });
    debugMessage({
      message: `OAuth2CIMDProfileOps.deleteCIMDProfile: end [${profileId}]`,
      state,
    });
    return deleted;
  } catch (error) {
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} CIMD profile ${profileId}`,
      error
    );
  }
}
