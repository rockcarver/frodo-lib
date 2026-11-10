import util from 'util';
import { IdObjectSkeletonInterface } from '../../api/ApiTypes';
import Constants from '../../shared/Constants';
import { State } from '../../shared/State';
import { getIdmBaseUrl } from '../../utils/ForgeRockUtils';
import { generateIdmApi } from '../BaseApi';

const idmFeatureListURLTemplate = '%s/feature?_queryFilter=true';
const idmFeatureURLTemplate = '%s/feature/%s';
const idmFeatureActionURLTemplate = '%s/feature/%s?_action=%s';

/**
 * A single IDM tenant-configuration feature (e.g. `groups`, `aiagent`,
 * `am/2fa/profiles`), distinct from `cloud.feature`'s environment-level
 * entitlement/licensing flags (e.g. `identity-cloud`, `workforce`,
 * `service-accounts`) -- confirmed live to be two entirely separate REST
 * resources sharing similar terminology, not the same one. See
 * `IdmFeatureOps.ts`'s header comment for the full distinction.
 */
export interface IdmFeatureInterface extends IdObjectSkeletonInterface {
  installedVersion: string | null;
  availableVersions: string[];
}

/**
 * The body of a response to `POST /openidm/feature/{id}?_action=validate` or
 * `?_action=install`, as the endpoint sends it. Which fields are present
 * depends on the action: validate sends `success` and `failures`, install
 * sends only `status` and `message` (per Ping's REST documentation), so
 * `success` and `failures` are optional here. The ops layer turns this into
 * an `IdmFeatureActionResult`; callers use that, not this.
 */
export interface IdmFeatureActionResponse {
  /** The `status` field of the body (200 in every response seen). */
  status: number;
  /** Sent by validate (true when the feature can be installed), not by install. */
  success?: boolean;
  /** Human-readable outcome, for example `Validate complete.` or `Install complete.` */
  message: string;
  /** Sent by validate: one entry per reason the feature cannot be installed. */
  failures?: string[];
}

/**
 * The outcome of validating or installing an IDM tenant-configuration
 * feature, as `frodo.cloud.idmFeature.validateIdmFeature` and
 * `installIdmFeature` return it. Unlike the body the endpoint sends, which
 * has different fields for validate and install, every field is always
 * present, so a caller does not need to know the response shapes.
 */
export interface IdmFeatureActionResult {
  /** The `status` field of the response body (200 in every response seen). */
  status: number;
  /**
   * The outcome. For validate: true when the feature can be installed. For
   * install: true when the request succeeded and the response reports no
   * failure.
   */
  success: boolean;
  /** The message of the response, unchanged (for example `Validate complete. 24 failure(s).`). */
  message: string;
  /**
   * The reasons the feature cannot be installed (validate), or the reasons the
   * install failed (install). Empty when there are none; never undefined.
   */
  failures: string[];
}

/**
 * Get all IDM tenant-configuration features and their install status.
 * @returns {Promise<{ result: IdmFeatureInterface[] }>} a promise that resolves to an object containing an array of feature objects
 */
export async function getIdmFeatures({
  state,
}: {
  state: State;
}): Promise<{ result: IdmFeatureInterface[] }> {
  const urlString = util.format(
    idmFeatureListURLTemplate,
    getIdmBaseUrl(state)
  );
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride: {},
    state,
  }).get(urlString);
  return data;
}

/**
 * Get a single IDM tenant-configuration feature and its install status.
 * @param {string} featureId feature id, e.g. 'aiagent' or 'am/2fa/profiles'.
 * Ids containing a literal slash work fine here -- confirmed live -- as long
 * as it's sent as a real, unencoded path segment (this function's plain
 * string interpolation already does that correctly); percent-encoding the
 * slash (`%2F` or `%252F`) is what breaks it, so don't "fix" this by adding
 * `encodeURIComponent`.
 * @returns {Promise<IdmFeatureInterface>} a promise that resolves to the feature object
 */
export async function getIdmFeature({
  featureId,
  state,
}: {
  featureId: string;
  state: State;
}): Promise<IdmFeatureInterface> {
  const urlString = util.format(
    idmFeatureURLTemplate,
    getIdmBaseUrl(state),
    featureId
  );
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride: {},
    state,
  }).get(urlString);
  return data;
}

/**
 * Validate whether an IDM tenant-configuration feature is installable,
 * without installing it.
 * @param {string} featureId feature id, e.g. 'aiagent'
 * @returns {Promise<IdmFeatureActionResponse>} a promise that resolves to the raw validation response
 */
export async function validateIdmFeature({
  featureId,
  state,
}: {
  featureId: string;
  state: State;
}): Promise<IdmFeatureActionResponse> {
  const urlString = util.format(
    idmFeatureActionURLTemplate,
    getIdmBaseUrl(state),
    featureId,
    'validate'
  );
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride: {},
    state,
  }).post(urlString, {});
  return data;
}

/**
 * Install an IDM tenant-configuration feature. Irreversible: per Ping's own
 * documentation, uninstalling or disabling a feature once installed requires
 * contacting Ping support and rolling back the tenant -- there is no
 * self-service undo.
 * @param {string} featureId feature id, e.g. 'aiagent'
 * @returns {Promise<IdmFeatureActionResponse>} a promise that resolves to the raw install response
 */
export async function installIdmFeature({
  featureId,
  state,
}: {
  featureId: string;
  state: State;
}): Promise<IdmFeatureActionResponse> {
  const urlString = util.format(
    idmFeatureActionURLTemplate,
    getIdmBaseUrl(state),
    featureId,
    'install'
  );
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride: {},
    state,
  }).post(urlString, {});
  return data;
}
