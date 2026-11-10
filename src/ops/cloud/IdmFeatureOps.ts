import {
  getIdmFeature as _getIdmFeature,
  getIdmFeatures as _getIdmFeatures,
  installIdmFeature as _installIdmFeature,
  validateIdmFeature as _validateIdmFeature,
  IdmFeatureActionResponse,
  IdmFeatureActionResult,
  IdmFeatureInterface,
} from '../../api/cloud/IdmFeatureApi';
import { State } from '../../shared/State';
import { FrodoError } from '../FrodoError';

/**
 * IDM tenant-configuration feature management (`GET/POST /openidm/feature`).
 *
 * @remarks
 * This is a distinct resource from `cloud.feature` (`FeatureOps.ts`), despite
 * the overlapping "feature" terminology and shared `installedVersion` field
 * name -- confirmed live against a real tenant that they return entirely
 * different, unrelated lists. `cloud.feature.readFeatures`/`hasFeature` read
 * environment-level entitlement/licensing flags (e.g. `identity-cloud`,
 * `workforce`, `service-accounts`) via a bare `{host}/feature` path already
 * used internally by `ServiceAccountOps.ts` -- left untouched here. This
 * module is for IDM's own tenant-configuration features (`groups`, `aiagent`,
 * `am/2fa/profiles`, `indexed/strings/6thru20`, `password/timestamps`, etc.)
 * that install new managed-object types/properties or repository indexes
 * into the tenant, documented at
 * https://docs.pingidentity.com/pingoneaic/idm-rest-api/endpoints/rest-feature.md.
 *
 * Installing a feature is irreversible: per that same documentation,
 * uninstalling or disabling a feature once installed requires contacting
 * Ping support and rolling back the tenant. There is no self-service undo.
 */
export type IdmFeature = {
  /**
   * Read all IDM tenant-configuration features and their install status.
   * @returns {Promise<IdmFeatureInterface[]>} a promise that resolves to an array of feature objects
   */
  readIdmFeatures(): Promise<IdmFeatureInterface[]>;
  /**
   * Read a single IDM tenant-configuration feature and its install status.
   * @param {string} featureId feature id, e.g. 'aiagent'
   * @returns {Promise<IdmFeatureInterface>} a promise that resolves to the feature object
   */
  readIdmFeature(featureId: string): Promise<IdmFeatureInterface>;
  /**
   * Check if an IDM tenant-configuration feature is installed.
   * @param {string} featureId feature id, e.g. 'aiagent'
   * @returns {Promise<boolean>} a promise that resolves to true if the feature is installed
   */
  hasIdmFeature(featureId: string): Promise<boolean>;
  /**
   * Validate whether an IDM tenant-configuration feature is installable,
   * without installing it. The result always has four fields: `status` (from
   * the response body), `success` (true when the feature can be installed),
   * `message` (the response message, unchanged, for example "Validate complete.
   * 24 failure(s).") and `failures` (one entry per reason the feature cannot be
   * installed, for example "config/managed: /objects/-: value already present
   * at /objects/14"; an empty array when there are none). `success` is what the
   * response says; when the response has no `success` field, it is true
   * exactly when `failures` is empty. A validation that finds failures is a
   * result with `success: false`, not an error; a request that fails (HTTP
   * error, network error) throws a FrodoError.
   * @param {string} featureId feature id, e.g. 'aiagent'
   * @returns {Promise<IdmFeatureActionResult>} a promise that resolves to the validation result: status, success, message and failures
   */
  validateIdmFeature(featureId: string): Promise<IdmFeatureActionResult>;
  /**
   * Install an IDM tenant-configuration feature. Irreversible -- see the
   * module-level remarks. The result always has four fields: `status` (from
   * the response body), `success`, `message` (the response message, unchanged,
   * for example "Install complete.") and `failures` (empty unless the response
   * lists failures). `success` is true when the request succeeded and the
   * response does not say `success: false` and lists no failures; the install
   * response documented by Ping has no `success` field, so a successful
   * install is `success: true` without one. `success: false` means the
   * endpoint reported a failure, with its `failures` and `message` kept. A
   * request that fails (HTTP error, network error) throws a FrodoError. This
   * makes no second request: a caller that wants confirmation reads the feature
   * again (`readIdmFeature` or `hasIdmFeature`) and checks `installedVersion`.
   * @param {string} featureId feature id, e.g. 'aiagent'
   * @returns {Promise<IdmFeatureActionResult>} a promise that resolves to the install result: status, success, message and failures
   */
  installIdmFeature(featureId: string): Promise<IdmFeatureActionResult>;
};

export default (state: State): IdmFeature => {
  return {
    async readIdmFeatures(): Promise<IdmFeatureInterface[]> {
      return readIdmFeatures({ state });
    },
    async readIdmFeature(featureId: string): Promise<IdmFeatureInterface> {
      return readIdmFeature({ featureId, state });
    },
    async hasIdmFeature(featureId: string): Promise<boolean> {
      return hasIdmFeature({ featureId, state });
    },
    async validateIdmFeature(
      featureId: string
    ): Promise<IdmFeatureActionResult> {
      return validateIdmFeature({ featureId, state });
    },
    async installIdmFeature(
      featureId: string
    ): Promise<IdmFeatureActionResult> {
      return installIdmFeature({ featureId, state });
    },
  };
};

export async function readIdmFeatures({
  state,
}: {
  state: State;
}): Promise<IdmFeatureInterface[]> {
  try {
    const { result } = await _getIdmFeatures({ state });
    return result;
  } catch (error) {
    throw new FrodoError('Error reading IDM features', error);
  }
}

export async function readIdmFeature({
  featureId,
  state,
}: {
  featureId: string;
  state: State;
}): Promise<IdmFeatureInterface> {
  try {
    return await _getIdmFeature({ featureId, state });
  } catch (error) {
    throw new FrodoError(`Error reading IDM feature ${featureId}`, error);
  }
}

export async function hasIdmFeature({
  featureId,
  state,
}: {
  featureId: string;
  state: State;
}): Promise<boolean> {
  try {
    const feature = await readIdmFeature({ featureId, state });
    return !!feature.installedVersion;
  } catch (error) {
    // A 404 reliably means the feature id itself doesn't exist -- confirmed
    // zero, not an unknown failure. Any other failure (permission, timeout,
    // etc.) propagates rather than being silently treated as "not installed".
    if ((error as FrodoError).httpStatus === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * The failures a response lists; an empty array when it lists none.
 */
function failuresOf(response: IdmFeatureActionResponse): string[] {
  return Array.isArray(response.failures) ? response.failures : [];
}

export async function validateIdmFeature({
  featureId,
  state,
}: {
  featureId: string;
  state: State;
}): Promise<IdmFeatureActionResult> {
  try {
    const response = await _validateIdmFeature({ featureId, state });
    const failures = failuresOf(response);
    return {
      status: response.status,
      // The response states the outcome; without a `success` field it is
      // installable exactly when it lists no failures.
      success:
        typeof response.success === 'boolean'
          ? response.success
          : failures.length === 0,
      message: response.message,
      failures,
    };
  } catch (error) {
    throw new FrodoError(`Error validating IDM feature ${featureId}`, error);
  }
}

export async function installIdmFeature({
  featureId,
  state,
}: {
  featureId: string;
  state: State;
}): Promise<IdmFeatureActionResult> {
  try {
    const response = await _installIdmFeature({ featureId, state });
    const failures = failuresOf(response);
    return {
      status: response.status,
      // The documented install response has no `success` field: the request
      // succeeded (a failed request throws), so only an explicit
      // `success: false` or listed failures make it a failure.
      success: response.success !== false && failures.length === 0,
      message: response.message,
      failures,
    };
  } catch (error) {
    throw new FrodoError(`Error installing IDM feature ${featureId}`, error);
  }
}
