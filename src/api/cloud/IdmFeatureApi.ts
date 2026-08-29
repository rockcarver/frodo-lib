import util from 'util';

import { IdObjectSkeletonInterface } from '../../api/ApiTypes';
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

export interface IdmFeatureActionResult {
  status: number;
  success: boolean;
  message: string;
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
  const urlString = util.format(idmFeatureListURLTemplate, getIdmBaseUrl(state));
  const { data } = await generateIdmApi({ requestOverride: {}, state }).get(
    urlString
  );
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
  const { data } = await generateIdmApi({ requestOverride: {}, state }).get(
    urlString
  );
  return data;
}

/**
 * Validate whether an IDM tenant-configuration feature is installable,
 * without installing it.
 * @param {string} featureId feature id, e.g. 'aiagent'
 * @returns {Promise<IdmFeatureActionResult>} a promise that resolves to the validation result
 */
export async function validateIdmFeature({
  featureId,
  state,
}: {
  featureId: string;
  state: State;
}): Promise<IdmFeatureActionResult> {
  const urlString = util.format(
    idmFeatureActionURLTemplate,
    getIdmBaseUrl(state),
    featureId,
    'validate'
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).post(
    urlString,
    {}
  );
  return data;
}

/**
 * Install an IDM tenant-configuration feature. Irreversible: per Ping's own
 * documentation, uninstalling or disabling a feature once installed requires
 * contacting Ping support and rolling back the tenant -- there is no
 * self-service undo.
 * @param {string} featureId feature id, e.g. 'aiagent'
 * @returns {Promise<IdmFeatureActionResult>} a promise that resolves to the install result
 */
export async function installIdmFeature({
  featureId,
  state,
}: {
  featureId: string;
  state: State;
}): Promise<IdmFeatureActionResult> {
  const urlString = util.format(
    idmFeatureActionURLTemplate,
    getIdmBaseUrl(state),
    featureId,
    'install'
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).post(
    urlString,
    {}
  );
  return data;
}
