import util from 'util';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { cloneDeep, deleteDeepByKey } from '../utils/JsonUtils';
import {
  type AmConfigEntityInterface,
  type NoIdObjectSkeletonInterface,
  type PagedResult,
  type Readable,
  type Writable,
} from './ApiTypes';
import { generateAmApi } from './BaseApi';

const cimdProfileURLTemplate = '%s/json%s/realm-config/agents/CIMDProfile/%s';
const cimdProfileListURLTemplate =
  '%s/json%s/realm-config/agents/CIMDProfile?_queryFilter=true';
const cimdProfileActionURLTemplate =
  '%s/json%s/realm-config/agents/CIMDProfile?_action=%s';

// The value the generic agent requests for this type have used since the type
// appeared. Identity Cloud answers every value (and none) the same way and
// returns no Content-API-Version, so the version is not negotiated there. A
// self-hosted server may validate it on a route it knows from PingAM 9.0 on:
// this is the one place to change then.
const apiVersion = 'protocol=2.1,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * The CIMD settings of a profile: which `https://` client ids may act as OAuth 2.0 clients without registration.
 */
export type CIMDConfig = {
  /** URL patterns a client id must match (required by the server when the profile is created) */
  cimdClientIdUrlPatterns?: Readable<string[]> | Writable<string[]>;
  /** metadata members of the client id document that are ignored */
  cimdMetadataDenyList?: Readable<string[]> | Writable<string[]>;
  /** whether the server refuses client id URLs that point to internal addresses */
  cimdSsrfProtectionEnabled?: Readable<boolean> | Writable<boolean>;
};

/**
 * A CIMD profile (agent type `CIMDProfile`).
 *
 * The single read returns the properties of the groups wrapped as `{ inherited, value }` (`Writable`), the list and the
 * query return the plain values (`Readable`); the server accepts either on a write. Only `cimdConfig` is spelled out,
 * the other groups carry about a hundred properties between them and are typed loosely (the schema is the reference:
 * {@link getCIMDProfileSchema}).
 */
export type CIMDProfileSkeleton = AmConfigEntityInterface & {
  cimdConfig?: CIMDConfig;
  coreOAuth2ClientConfig?: Record<string, unknown>;
  advancedOAuth2ClientConfig?: Record<string, unknown>;
  coreOpenIDClientConfig?: Record<string, unknown>;
  signEncOAuth2ClientConfig?: Record<string, unknown>;
  overrideOAuth2ClientConfig?: Record<string, unknown>;
  _type?: {
    _id: 'CIMDProfile';
    name: string;
    collection: boolean;
  };
};

/**
 * The JSON schema of a CIMD profile as the server describes it.
 */
export type CIMDProfileSchema = {
  type: 'object';
  properties: Record<string, unknown>;
};

/**
 * Encode a CIMD profile id for use as the last segment of a URL path.
 *
 * Besides what `encodeURIComponent` escapes, this also escapes the five characters it leaves alone (`! ' ( ) *`) as
 * `%21 %27 %28 %29 %2A`, because the edge of Identity Cloud answers an empty 400 for their raw forms.
 * @param {string} profileId CIMD profile id
 * @returns {string} the id as a safe URL path segment
 */
export function encodeCIMDProfileId(profileId: string): string {
  return encodeURIComponent(profileId).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Get all CIMD profiles of the realm
 *
 * The list returns the profiles in the plain shape (values without the `{ inherited, value }` wrapper) as they are
 * stored: a profile that was stored with few attributes has few attributes here.
 * @param {object} params structured and named parameters
 * @param {State} params.state the state object
 * @returns {Promise<PagedResult<CIMDProfileSkeleton>>} a promise that resolves to a paged result containing an array of CIMD profile objects
 */
export async function getCIMDProfiles({
  state,
}: {
  state: State;
}): Promise<PagedResult<CIMDProfileSkeleton>> {
  const urlString = util.format(
    cimdProfileListURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get a CIMD profile by id
 *
 * The single read returns the **wrapped** shape: the properties of the groups are `{ inherited, value }` objects. The
 * list ({@link getCIMDProfiles}) returns the same profile in the plain shape. An absent id answers 404.
 * @param {object} params structured and named parameters
 * @param {string} params.profileId CIMD profile id
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileSkeleton>} a promise that resolves to a CIMD profile object in the wrapped shape
 */
export async function getCIMDProfile({
  profileId,
  state,
}: {
  profileId: string;
  state: State;
}): Promise<CIMDProfileSkeleton> {
  const urlString = util.format(
    cimdProfileURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    encodeCIMDProfileId(profileId)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put a CIMD profile
 *
 * Unlike the other functions of this module this one returns the HTTP status together with the answer, because the
 * two successful answers mean different things: `201` (created) tells that the server may have completed the body
 * with its defaults, `200` (updated) tells that the profile is stored exactly as sent.
 *
 * The body is sent as given (plain or wrapped values, nothing is merged with the template), except that `_rev` (the
 * server rejects it) and every key containing `-encrypted` are removed from a copy: the object passed in is not
 * changed. `_id` and `_type` stay in the body, the server tolerates them. The answer is the wrapped object.
 * @param {object} params structured and named parameters
 * @param {string} params.profileId CIMD profile id
 * @param {CIMDProfileSkeleton | NoIdObjectSkeletonInterface} params.profileData CIMD profile object
 * @param {boolean} params.failIfExists true to refuse an existing id with 412 (create only), false to upsert (default: false)
 * @param {State} params.state the state object
 * @returns {Promise<{ status: number; data: CIMDProfileSkeleton }>} a promise that resolves to the HTTP status (200 or 201) and the CIMD profile object the server answered
 */
export async function putCIMDProfile({
  profileId,
  profileData,
  failIfExists = false,
  state,
}: {
  profileId: string;
  profileData: CIMDProfileSkeleton | NoIdObjectSkeletonInterface;
  failIfExists?: boolean;
  state: State;
}): Promise<{ status: number; data: CIMDProfileSkeleton }> {
  // work on a copy: the caller's object is not ours to change
  const profile = deleteDeepByKey(cloneDeep(profileData), '-encrypted');
  delete profile._rev;
  const urlString = util.format(
    cimdProfileURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    encodeCIMDProfileId(profileId)
  );
  const requestOverride = failIfExists
    ? { headers: { 'If-None-Match': '*' } }
    : {};
  const { status, data } = await generateAmApi({
    resource: getApiConfig(),
    requestOverride,
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).put(urlString, profile, {
    withCredentials: true,
  });
  return { status, data };
}

/**
 * Delete a CIMD profile
 * @param {object} params structured and named parameters
 * @param {string} params.profileId CIMD profile id
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileSkeleton>} a promise that resolves to the deleted CIMD profile object (wrapped shape)
 */
export async function deleteCIMDProfile({
  profileId,
  state,
}: {
  profileId: string;
  state: State;
}): Promise<CIMDProfileSkeleton> {
  const urlString = util.format(
    cimdProfileURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    encodeCIMDProfileId(profileId)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get the template of a CIMD profile
 *
 * The template is in the plain shape and is not valid as it stands: `cimdClientIdUrlPatterns` is empty and the server
 * requires at least one pattern when it creates a profile.
 * @param {object} params structured and named parameters
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileSkeleton>} a promise that resolves to the CIMD profile template
 */
export async function getCIMDProfileTemplate({
  state,
}: {
  state: State;
}): Promise<CIMDProfileSkeleton> {
  const urlString = util.format(
    cimdProfileActionURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    'template'
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).post(
    urlString,
    {},
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Get the schema of a CIMD profile
 * @param {object} params structured and named parameters
 * @param {State} params.state the state object
 * @returns {Promise<CIMDProfileSchema>} a promise that resolves to the JSON schema of a CIMD profile
 */
export async function getCIMDProfileSchema({
  state,
}: {
  state: State;
}): Promise<CIMDProfileSchema> {
  const urlString = util.format(
    cimdProfileActionURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    'schema'
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).post(
    urlString,
    {},
    {
      withCredentials: true,
    }
  );
  return data;
}
