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
import {
  createProgressIndicator,
  debugMessage,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { getCurrentRealmName } from '../utils/ForgeRockUtils';
import { FrodoError } from './FrodoError';
import { isAgentTypeOffered } from './internal/AgentTypeHelpers';
import { ExportMetaData, ResultCallback } from './OpsTypes';

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
  /**
   * Delete all CIMD profiles of the realm. Every profile is tried: a profile that cannot be deleted does not stop the others. If the realm does not offer CIMD profiles there is nothing to delete: the result is empty, no request for profiles is made and the callback is not called.
   * @param {ResultCallback<CIMDProfileSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every profile is passed to it as it happens (a failed profile as an error that names the profile) and a failed profile does not throw. Without it, the failures are collected and thrown as one error after every profile was tried. Failing to read the profiles always throws.
   * @returns {Promise<CIMDProfileSkeleton[]>} a promise that resolves to the CIMD profiles that were deleted
   */
  deleteCIMDProfiles(
    resultCallback?: ResultCallback<CIMDProfileSkeleton>
  ): Promise<CIMDProfileSkeleton[]>;
  /**
   * Export all CIMD profiles of the realm. The response can be saved to file as is. The profiles are written as readCIMDProfiles returns them (plain shape, as stored, including _id, _rev and _type). If the realm does not offer CIMD profiles the export holds none, and no request for profiles is made.
   * @param {ResultCallback<CIMDProfileSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every profile is passed to it as it happens (a failed profile as an error that names the profile) and a failed profile does not throw. Without it, the failures are collected and thrown as one error after every profile was tried. Failing to read the profiles always throws.
   * @returns {Promise<CIMDProfileExportInterface>} a promise that resolves to the export data
   */
  exportCIMDProfiles(
    resultCallback?: ResultCallback<CIMDProfileSkeleton>
  ): Promise<CIMDProfileExportInterface>;
  /**
   * Export a CIMD profile. The response can be saved to file as is. Fails with the error code CIMD_PROFILES_NOT_AVAILABLE if the realm does not offer CIMD profiles.
   * @param {string} profileId CIMD profile id
   * @returns {Promise<CIMDProfileExportInterface>} a promise that resolves to the export data
   */
  exportCIMDProfile(profileId: string): Promise<CIMDProfileExportInterface>;
  /**
   * Import CIMD profiles. The import data is usually read from a CIMD profile export file. Existing profiles are replaced by exactly what the file holds. A profile that the server completes with its defaults because it did not exist (an export of a profile that was stored with few attributes) is written a second time so that it equals the exported one. If the realm does not offer CIMD profiles nothing is imported, one warning is printed and the result is empty. The scripts and journeys that a profile names must exist before it is imported.
   * @param {CIMDProfileExportInterface} importData CIMD profile import data.
   * @param {ResultCallback<CIMDProfileImportResult>} resultCallback Optional callback to process individual results. When given, the outcome of every profile is passed to it as it happens (a failed profile as an error that names the profile) and a failed profile does not throw. Without it, the failures are collected and thrown as one error after every profile was tried.
   * @returns {Promise<CIMDProfileImportResult[]>} a promise that resolves to the result of each profile that was imported: the stored profile, whether it was created and whether it was restored to the exported state by the second write
   */
  importCIMDProfiles(
    importData: CIMDProfileExportInterface,
    resultCallback?: ResultCallback<CIMDProfileImportResult>
  ): Promise<CIMDProfileImportResult[]>;
  /**
   * Import a CIMD profile from CIMD profile import data. Fails with the error code CIMD_PROFILES_NOT_AVAILABLE if the realm does not offer CIMD profiles.
   * @param {string} profileId CIMD profile id
   * @param {CIMDProfileExportInterface} importData CIMD profile import data.
   * @returns {Promise<CIMDProfileImportResult>} a promise that resolves to the stored profile, whether it was created and whether it was restored to the exported state by the second write
   */
  importCIMDProfile(
    profileId: string,
    importData: CIMDProfileExportInterface
  ): Promise<CIMDProfileImportResult>;
  /**
   * Create an empty CIMD profile export template
   * @returns {CIMDProfileExportInterface} an empty CIMD profile export template
   */
  createCIMDProfileExportTemplate(): CIMDProfileExportInterface;
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
    async deleteCIMDProfiles(
      resultCallback?: ResultCallback<CIMDProfileSkeleton>
    ) {
      return deleteCIMDProfiles({ resultCallback, state });
    },
    async exportCIMDProfiles(
      resultCallback?: ResultCallback<CIMDProfileSkeleton>
    ) {
      return exportCIMDProfiles({ resultCallback, state });
    },
    async exportCIMDProfile(profileId: string) {
      return exportCIMDProfile({ profileId, state });
    },
    async importCIMDProfiles(
      importData: CIMDProfileExportInterface,
      resultCallback?: ResultCallback<CIMDProfileImportResult>
    ) {
      return importCIMDProfiles({ importData, resultCallback, state });
    },
    async importCIMDProfile(
      profileId: string,
      importData: CIMDProfileExportInterface
    ) {
      return importCIMDProfile({ profileId, importData, state });
    },
    createCIMDProfileExportTemplate() {
      return createCIMDProfileExportTemplate({ state });
    },
  };
};

/**
 * The export file of CIMD profiles: the profiles keyed by `_id`, each as `readCIMDProfiles` returns it (plain shape,
 * as stored).
 */
export interface CIMDProfileExportInterface {
  meta?: ExportMetaData;
  cimdProfile: Record<string, CIMDProfileSkeleton>;
}

/**
 * The outcome of importing one CIMD profile.
 */
export interface CIMDProfileImportResult {
  /** the profile as the server answered the last write (wrapped shape) */
  profile: CIMDProfileSkeleton;
  /** true if the profile did not exist and was created, false if an existing profile was replaced */
  created: boolean;
  /** true if the server completed a profile it created with its defaults and the profile was written a second time to equal the exported one */
  repaired: boolean;
}

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

/**
 * Create an empty CIMD profile export template
 * @param {object} params structured and named parameters
 * @param {State} params.state the state object
 * @returns {CIMDProfileExportInterface} an empty CIMD profile export template
 */
export function createCIMDProfileExportTemplate({
  state,
}: {
  state: State;
}): CIMDProfileExportInterface {
  return {
    meta: getMetadata({ state }),
    cimdProfile: {},
  };
}

/**
 * Report the outcome of one profile: to the result callback if there is one, otherwise a failure is collected.
 * @param {object} params structured and named parameters
 * @param {R} params.result the result of the profile (undefined if it failed)
 * @param {FrodoError} params.failure the error that names the profile (undefined if it succeeded)
 * @param {FrodoError[]} params.errors where the failures are collected when there is no result callback
 * @param {ResultCallback<R>} params.resultCallback Optional callback to process individual results
 */
function _reportOutcome<R>({
  result,
  failure,
  errors,
  resultCallback,
}: {
  result?: R;
  failure?: FrodoError;
  errors: FrodoError[];
  resultCallback?: ResultCallback<R>;
}) {
  if (failure) {
    if (resultCallback) {
      resultCallback(failure, undefined);
    } else {
      errors.push(failure);
    }
  } else if (resultCallback) {
    resultCallback(undefined, result);
  }
}

/**
 * Delete all CIMD profiles of the realm. Every profile is tried: a profile that cannot be deleted does not stop the others. A realm that does not offer CIMD profiles has none to delete: the result is empty, no request for profiles is made and the callback is not called.
 * @param {object} params structured and named parameters
 * @param {ResultCallback<CIMDProfileSkeleton>} params.resultCallback Optional callback to process individual results. When given, the outcome of every profile is passed to it as it happens (a failed profile as an error that names the profile) and a failed profile does not throw. Without it, the failures are collected and thrown as one error after every profile was tried. Failing to read the profiles always throws.
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileSkeleton[]>} a promise that resolves to the CIMD profiles that were deleted
 * @throws {FrodoError} If the profiles cannot be read (always), or if one or more profiles cannot be deleted and there is no result callback.
 */
export async function deleteCIMDProfiles({
  resultCallback,
  state,
}: {
  resultCallback?: ResultCallback<CIMDProfileSkeleton>;
  state: State;
}): Promise<CIMDProfileSkeleton[]> {
  debugMessage({
    message: `OAuth2CIMDProfileOps.deleteCIMDProfiles: start`,
    state,
  });
  const realm = getCurrentRealmName(state) + ' realm';
  const deleted: CIMDProfileSkeleton[] = [];
  const errors: FrodoError[] = [];
  let profiles: CIMDProfileSkeleton[];
  try {
    // a realm that does not offer the type has no profiles: readCIMDProfiles gives none and asks for none
    profiles = await readCIMDProfiles({ state });
  } catch (error) {
    throw new FrodoError(`Error deleting ${realm} CIMD profiles`, error);
  }
  for (const profile of profiles) {
    let failure: FrodoError | undefined;
    try {
      debugMessage({
        message: `OAuth2CIMDProfileOps.deleteCIMDProfiles: '${profile._id}'`,
        state,
      });
      await _deleteCIMDProfile({ profileId: profile._id, state });
    } catch (error) {
      failure = new FrodoError(
        `Error deleting ${realm} CIMD profile ${profile._id}`,
        error
      );
    }
    if (!failure) deleted.push(profile);
    _reportOutcome({ result: profile, failure, errors, resultCallback });
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error deleting ${realm} CIMD profiles`, errors);
  }
  debugMessage({
    message: `OAuth2CIMDProfileOps.deleteCIMDProfiles: end`,
    state,
  });
  return deleted;
}

/**
 * Export all CIMD profiles of the realm. The response can be saved to file as is. The profiles are written as `readCIMDProfiles` returns them. A realm that does not offer CIMD profiles has none: the export holds none, no request for profiles is made and nothing is printed. A realm that offers the type but holds no profile prints nothing either.
 * @param {object} params structured and named parameters
 * @param {ResultCallback<CIMDProfileSkeleton>} params.resultCallback Optional callback to process individual results. When given, the outcome of every profile is passed to it as it happens (a failed profile as an error that names the profile) and a failed profile does not throw. Without it, the failures are collected and thrown as one error after every profile was tried. Failing to read the profiles always throws. There is no per-profile failure in this version (the list carries whole profiles), so the callback receives successes only; it is part of the contract so that bulk functions are alike.
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileExportInterface>} a promise that resolves to the export data
 */
export async function exportCIMDProfiles({
  resultCallback,
  state,
}: {
  resultCallback?: ResultCallback<CIMDProfileSkeleton>;
  state: State;
}): Promise<CIMDProfileExportInterface> {
  debugMessage({
    message: `OAuth2CIMDProfileOps.exportCIMDProfiles: start`,
    state,
  });
  const realm = getCurrentRealmName(state) + ' realm';
  const exportData = createCIMDProfileExportTemplate({ state });
  let indicatorId: string;
  try {
    // a realm that does not offer the type has no profiles: readCIMDProfiles gives none and asks for none
    const profiles = await readCIMDProfiles({ state });
    // a realm without profiles prints nothing, so that a full export stays quiet
    if (profiles.length > 0) {
      indicatorId = createProgressIndicator({
        total: profiles.length,
        message: `Exporting ${realm} CIMD profiles...`,
        state,
      });
      for (const profile of profiles) {
        updateProgressIndicator({
          id: indicatorId,
          message: `Exporting ${realm} CIMD profile ${profile._id}`,
          state,
        });
        exportData.cimdProfile[profile._id] = profile;
        if (resultCallback) resultCallback(undefined, profile);
      }
      stopProgressIndicator({
        id: indicatorId,
        message: `Exported ${profiles.length} ${realm} CIMD profiles.`,
        state,
      });
    }
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting ${realm} CIMD profiles`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting ${realm} CIMD profiles`, error);
  }
  debugMessage({
    message: `OAuth2CIMDProfileOps.exportCIMDProfiles: end`,
    state,
  });
  return exportData;
}

/**
 * Export a CIMD profile. The response can be saved to file as is.
 * @param {object} params structured and named parameters
 * @param {string} params.profileId CIMD profile id
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileExportInterface>} a promise that resolves to the export data
 * @throws {FrodoError} with the code `CIMD_PROFILES_NOT_AVAILABLE` if the realm does not offer CIMD profiles
 */
export async function exportCIMDProfile({
  profileId,
  state,
}: {
  profileId: string;
  state: State;
}): Promise<CIMDProfileExportInterface> {
  debugMessage({
    message: `OAuth2CIMDProfileOps.exportCIMDProfile: start [${profileId}]`,
    state,
  });
  checkCIMDProfileId(profileId);
  await assertCIMDProfileAvailable({ state });
  try {
    const exportData = createCIMDProfileExportTemplate({ state });
    const profile = await readCIMDProfile({ profileId, state });
    exportData.cimdProfile[profile._id] = profile;
    debugMessage({
      message: `OAuth2CIMDProfileOps.exportCIMDProfile: end [${profileId}]`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} CIMD profile ${profileId}`,
      error
    );
  }
}

/**
 * The names of the attributes of a profile, group by group, and of its members outside the groups: what the profile
 * has, not what the attributes are set to (plain and wrapped values look alike).
 */
function _attributeNames(profile: CIMDProfileSkeleton): Set<string> {
  const names = new Set<string>();
  for (const [key, value] of Object.entries(profile ?? {})) {
    if (['_id', '_rev', '_type'].includes(key)) continue;
    if (
      CIMD_PROFILE_GROUPS.includes(key) &&
      value &&
      typeof value === 'object'
    ) {
      for (const attribute of Object.keys(value)) {
        names.add(`${key}.${attribute}`);
      }
    } else {
      names.add(key);
    }
  }
  return names;
}

/**
 * The second write of an import failed after the profile was created: it exists with the server's defaults.
 */
class CIMDProfileNotRestoredError extends FrodoError {
  constructor(message: string, cause: Error) {
    super(message, cause);
    // it is an ordinary FrodoError to every reader of the error
    this.name = 'FrodoError';
  }
}

/**
 * Write a CIMD profile so that it is stored exactly as given, whether or not it exists.
 *
 * The server stores what a PUT to an existing id sends, but completes the body with its defaults when it creates the
 * profile (HTTP 201), so a profile that was stored with few attributes would come back expanded. When the answer to a
 * create holds attributes that the body lacked, the same body is written once more (now an update, which stores exactly
 * what is sent). A complete profile needs one write. `_rev` is removed by the api layer; the object passed in is not
 * changed.
 * @param {object} params structured and named parameters
 * @param {string} params.profileId CIMD profile id
 * @param {CIMDProfileSkeleton} params.profileData CIMD profile object, plain or wrapped values
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileImportResult>} a promise that resolves to the stored profile, whether it was created and whether the second write ran
 * @throws {FrodoError} if a write fails; if the second write fails the profile exists with the server's defaults and the message says so
 */
export async function putCIMDProfileExact({
  profileId,
  profileData,
  state,
}: {
  profileId: string;
  profileData: CIMDProfileSkeleton | NoIdObjectSkeletonInterface;
  state: State;
}): Promise<CIMDProfileImportResult> {
  const first = await _putCIMDProfile({
    profileId,
    profileData,
    failIfExists: false,
    state,
  });
  if (first.status !== 201) {
    // the profile existed and is stored exactly as sent
    return { profile: first.data, created: false, repaired: false };
  }
  const sent = _attributeNames(profileData);
  const completed = [..._attributeNames(first.data)].filter(
    (name) => !sent.has(name)
  );
  if (completed.length === 0) {
    return { profile: first.data, created: true, repaired: false };
  }
  debugMessage({
    message: `OAuth2CIMDProfileOps.putCIMDProfileExact: the server completed ${profileId} with its defaults (${completed.join(', ')}), writing it again`,
    state,
  });
  try {
    const second = await _putCIMDProfile({
      profileId,
      profileData,
      failIfExists: false,
      state,
    });
    return { profile: second.data, created: true, repaired: true };
  } catch (error) {
    throw new CIMDProfileNotRestoredError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} CIMD profile ${profileId}: created, but not restored to the exported state`,
      error
    );
  }
}

/**
 * Import one profile of the import data: id check, type guard, exact write. Its failure names the profile.
 */
async function _importOneCIMDProfile({
  profileId,
  profileData,
  state,
}: {
  profileId: string;
  profileData: CIMDProfileSkeleton;
  state: State;
}): Promise<CIMDProfileImportResult> {
  try {
    checkCIMDProfileId(profileId);
    const typeId = profileData?._type?._id;
    // a missing _type is accepted (hand-written files)
    if (typeId !== undefined && typeId !== 'CIMDProfile') {
      throw new FrodoError(
        `Wrong agent type! Expected 'CIMDProfile' but got '${typeId}'.`
      );
    }
    return await putCIMDProfileExact({ profileId, profileData, state });
  } catch (error) {
    if (error instanceof CIMDProfileNotRestoredError) throw error;
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} CIMD profile ${profileId}${describeInvalidAttributes(error, profileData)}`,
      error
    );
  }
}

/**
 * Import CIMD profiles. The import data is usually read from a CIMD profile export file. Every profile is tried: a profile that cannot be imported does not stop the others. A profile whose `_type` names another type fails; a missing `_type` is accepted. No attribute is removed to make a write succeed: an attribute that the server does not accept fails the profile, because a deny list or the SSRF switch must never be dropped silently. The import data is not changed. A realm that does not offer CIMD profiles cannot receive any: one warning names the number of profiles that were skipped, nothing fails and the callback is not called. The scripts and journeys that a profile names must exist before it is imported.
 * @param {object} params structured and named parameters
 * @param {CIMDProfileExportInterface} params.importData CIMD profile import data.
 * @param {ResultCallback<CIMDProfileImportResult>} params.resultCallback Optional callback to process individual results. When given, the outcome of every profile is passed to it as it happens (a failed profile as an error that names the profile) and a failed profile does not throw. Without it, the failures are collected and thrown as one error after every profile was tried.
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileImportResult[]>} a promise that resolves to the result of each profile that was imported
 * @throws {FrodoError} if one or more profiles cannot be imported and there is no result callback.
 */
export async function importCIMDProfiles({
  importData,
  resultCallback,
  state,
}: {
  importData: CIMDProfileExportInterface;
  resultCallback?: ResultCallback<CIMDProfileImportResult>;
  state: State;
}): Promise<CIMDProfileImportResult[]> {
  debugMessage({
    message: `OAuth2CIMDProfileOps.importCIMDProfiles: start`,
    state,
  });
  const realm = getCurrentRealmName(state) + ' realm';
  const profileIds = Object.keys(importData?.cimdProfile ?? {});
  // nothing to import: not even the type list is asked, so a full import without CIMD data is unchanged
  if (profileIds.length === 0) return [];
  if (!(await isCIMDProfileAvailable({ state }))) {
    printMessage({
      message: `Skipped ${profileIds.length} CIMD profile${profileIds.length === 1 ? '' : 's'}: the ${realm} of this deployment does not offer CIMD profiles.`,
      type: 'warn',
      state,
    });
    return [];
  }
  const results: CIMDProfileImportResult[] = [];
  const errors: FrodoError[] = [];
  for (const profileId of profileIds) {
    let result: CIMDProfileImportResult | undefined;
    let failure: FrodoError | undefined;
    try {
      debugMessage({
        message: `OAuth2CIMDProfileOps.importCIMDProfiles: ${profileId}`,
        state,
      });
      result = await _importOneCIMDProfile({
        profileId,
        profileData: importData.cimdProfile[profileId],
        state,
      });
    } catch (error) {
      failure = error;
    }
    if (!failure) results.push(result);
    _reportOutcome({ result, failure, errors, resultCallback });
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing ${realm} CIMD profiles`, errors);
  }
  debugMessage({
    message: `OAuth2CIMDProfileOps.importCIMDProfiles: end`,
    state,
  });
  return results;
}

/**
 * Import a CIMD profile from CIMD profile import data. The import data is not changed.
 * @param {object} params structured and named parameters
 * @param {string} params.profileId CIMD profile id
 * @param {CIMDProfileExportInterface} params.importData CIMD profile import data.
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileImportResult>} a promise that resolves to the stored profile, whether it was created and whether the second write ran
 * @throws {FrodoError} with the code `CIMD_PROFILES_NOT_AVAILABLE` if the realm does not offer CIMD profiles
 */
export async function importCIMDProfile({
  profileId,
  importData,
  state,
}: {
  profileId: string;
  importData: CIMDProfileExportInterface;
  state: State;
}): Promise<CIMDProfileImportResult> {
  debugMessage({
    message: `OAuth2CIMDProfileOps.importCIMDProfile: start [${profileId}]`,
    state,
  });
  checkCIMDProfileId(profileId);
  await assertCIMDProfileAvailable({ state });
  const profileData = importData?.cimdProfile?.[profileId];
  if (!profileData) {
    throw new FrodoError(
      `${getCurrentRealmName(state) + ' realm'} CIMD profile ${profileId} not found in import data!`
    );
  }
  const result = await _importOneCIMDProfile({ profileId, profileData, state });
  debugMessage({
    message: `OAuth2CIMDProfileOps.importCIMDProfile: end [${profileId}]`,
    state,
  });
  return result;
}
