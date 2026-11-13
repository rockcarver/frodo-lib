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
import { FrodoError, isNotFoundError } from '../FrodoError';
import { getIdmFeatureHandler } from './idmFeature/IdmFeatureHandlers';
import {
  IdmFeatureDiagnosis,
  IdmFeatureRepairExecutionOptions,
  IdmFeatureRepairOptions,
  IdmFeatureRepairPlan,
  IdmFeatureRepairResult,
} from './idmFeature/IdmFeatureTypes';

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
  /**
   * Find out why an IDM tenant-configuration feature reads as not installed or does not work. Read-only: it
   * changes nothing in the tenant. The library has a diagnosis for the feature `aiagent`; for any other feature the
   * result has `supported: false` and no findings, and only the registry entry is reported.
   *
   * The result is `{ featureId, supported, installedVersion, availableVersions, findings }`. A finding has an `id`
   * that names the condition (`definitions-cosmetic-drift`, `provider-auth-service-not-set`, `gate-closed`,
   * `secret-mappings-dangling` and so on), a `severity` (`error`: the feature does not work, `warning`: cosmetic or
   * advisory, `info`: a healthy part), a `message`, whether the condition is `repairable` and its `details`.
   * A condition that exists per realm is reported once per realm, with `details.realm`. A check that cannot be made
   * (for example a request that is refused) is a finding `check-failed`, not an error; only a failing read of the
   * registry throws.
   *
   * For `aiagent` the checks are: the registry and the result of `validate`; the definitions the feature writes
   * (managed object definitions and `repo.ds` mappings) compared with the original of version 1, each difference
   * classed cosmetic (white space, a title, an extra mapping property) or structural; per realm that has the AI agent
   * managed objects, the OAuth 2.0 provider (it exists, has a password grant authentication service, has AI agents
   * enabled with the expected object names), whether AM accepts AI agents (the agent type is listed and listing
   * them answers 200, not 501), the mappings of the realm's ESV secret store that point to ESV secrets that do not
   * exist, and IDM AI agent objects that AM does not list. A feature version other than the one the library knows
   * the definitions of is reported as `version-unsupported`.
   * @param {string} featureId feature id, e.g. 'aiagent'
   * @returns {Promise<IdmFeatureDiagnosis>} a promise that resolves to the diagnosis
   */
  diagnoseIdmFeature(featureId: string): Promise<IdmFeatureDiagnosis>;
  /**
   * Plan the repair of what `diagnoseIdmFeature` finds wrong with a feature, without writing anything. The library can
   * repair the feature `aiagent`; for any other feature this throws.
   *
   * The result is a plan: `{ featureId, options, diagnosis, repairable, blockers, steps, backup }`. `steps` are the
   * writes, itemised and in the order they run (delete secret store mappings that point to no ESV secret; create an
   * OAuth 2.0 provider from the server's template or give one the password grant authentication service it lacks; align
   * definitions that differ only cosmetically from the original when the enable action has to run; run the enable
   * action; wait for the AM gate; put the customised definitions back; diagnose again). `backup` holds what the steps
   * would overwrite or delete, as the tenant returns it: managed and repo.ds configuration, the OAuth 2.0 providers, the
   * IDM AI agent and privilege objects and the mappings to be deleted. The plan therefore holds the raw backup of the
   * tenant configuration, including the settings of the OAuth 2.0 providers that are not meant to be shared: handle it like
   * the configuration itself (do not log or share it). The library writes no file: keep the backup before you call
   * `repairIdmFeature`. `repairable` is false, with `blockers`, if something the library does not repair is
   * wrong (structural drift, a feature version it does not know, an authentication service the realm lacks); the plan
   * then has no steps. `repairable` with no steps means there is nothing to repair. Only errors are repaired; a warning
   * (for example a customised title while AI agents work) is left alone.
   *
   * The enable action installs the IDM feature internally, which would add definitions that are present but not equal to
   * the original a second time. The plan therefore aligns them first and puts them back at the end, unless
   * `keepAligned`; the registry then reads "not installed" again if they were customised.
   * @param {string} featureId feature id, e.g. 'aiagent'
   * @param {IdmFeatureRepairOptions} options `keepAligned` (default false) and `authService` (default `Login`)
   * @returns {Promise<IdmFeatureRepairPlan>} a promise that resolves to the plan
   */
  planIdmFeatureRepair(
    featureId: string,
    options?: IdmFeatureRepairOptions
  ): Promise<IdmFeatureRepairPlan>;
  /**
   * Run a plan of `planIdmFeatureRepair`. Mutating: it writes configuration to the tenant. Every write is read back and
   * compared with what was written, and a difference stops the run with a FrodoError; so does a tenant that no longer
   * looks as it did when the plan was made. The enable action is run only if the registry reads the feature installed
   * (after aligning the definitions if the plan says so). If a step fails after definitions were aligned they are put
   * back before the error is thrown, unless the plan keeps them aligned (that is decided by what this run aligned, not by
   * the steps the plan still has). A plan carries no binding to a tenant; that is safe because every step reads the
   * tenant again and recomputes against the shipped original definitions, so a plan made for one tenant can only align
   * the same cosmetic differences, delete a mapping that still points to no ESV secret, create a provider that is still
   * missing, or set the authentication service of a provider that still has none, and anything else in it is refused.
   *
   * With `wait` the repair polls until AM accepts AI agents in the realms it enabled and returns as soon as it does, for
   * at most `timeout` milliseconds (default 1,200,000, 20 minutes): the effect of the enable action can need minutes.
   * Without it the repair returns after the enable action answered. A gate that is still closed when the time is up is
   * a step with status `failed` and `completed: false`, not an error. `resultCallback` is called with the result of each
   * step as soon as it is known. The result has the diagnosis after the repair.
   * @param {IdmFeatureRepairPlan} plan the plan, from `planIdmFeatureRepair`
   * @param {IdmFeatureRepairExecutionOptions} options `wait`, `timeout` (milliseconds) and `resultCallback`
   * @returns {Promise<IdmFeatureRepairResult>} a promise that resolves to what was done
   */
  repairIdmFeature(
    plan: IdmFeatureRepairPlan,
    options?: IdmFeatureRepairExecutionOptions
  ): Promise<IdmFeatureRepairResult>;
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
    async diagnoseIdmFeature(featureId: string): Promise<IdmFeatureDiagnosis> {
      return diagnoseIdmFeature({ featureId, state });
    },
    async planIdmFeatureRepair(
      featureId: string,
      options?: IdmFeatureRepairOptions
    ): Promise<IdmFeatureRepairPlan> {
      return planIdmFeatureRepair({ featureId, options, state });
    },
    async repairIdmFeature(
      plan: IdmFeatureRepairPlan,
      options?: IdmFeatureRepairExecutionOptions
    ): Promise<IdmFeatureRepairResult> {
      return repairIdmFeature({ plan, options, state });
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

export async function diagnoseIdmFeature({
  featureId,
  state,
}: {
  featureId: string;
  state: State;
}): Promise<IdmFeatureDiagnosis> {
  try {
    const handler = getIdmFeatureHandler(featureId);
    if (handler) return await handler.diagnose(state);
    // no diagnosis for this feature: report its registry entry, nothing is judged
    let installedVersion: string | null = null;
    let availableVersions: string[] = [];
    try {
      const feature = await _getIdmFeature({ featureId, state });
      installedVersion = feature.installedVersion ?? null;
      availableVersions = feature.availableVersions ?? [];
    } catch (error) {
      // an unknown feature id answers 404; any other failure is a real one
      if (!isNotFoundError(error)) throw error;
    }
    return {
      featureId,
      supported: false,
      installedVersion,
      availableVersions,
      findings: [],
    };
  } catch (error) {
    throw new FrodoError(`Error diagnosing IDM feature ${featureId}`, error);
  }
}

export async function planIdmFeatureRepair({
  featureId,
  options,
  state,
}: {
  featureId: string;
  options?: IdmFeatureRepairOptions;
  state: State;
}): Promise<IdmFeatureRepairPlan> {
  const handler = getIdmFeatureHandler(featureId);
  if (!handler) {
    throw new FrodoError(
      `Error planning the repair of IDM feature ${featureId}: the library has no repair for this feature`
    );
  }
  try {
    return await handler.plan(state, options);
  } catch (error) {
    throw new FrodoError(
      `Error planning the repair of IDM feature ${featureId}`,
      error
    );
  }
}

export async function repairIdmFeature({
  plan,
  options,
  state,
}: {
  plan: IdmFeatureRepairPlan;
  options?: IdmFeatureRepairExecutionOptions;
  state: State;
}): Promise<IdmFeatureRepairResult> {
  const featureId = plan?.featureId;
  const handler = getIdmFeatureHandler(featureId);
  if (!handler) {
    throw new FrodoError(
      `Error repairing IDM feature ${featureId}: the library has no repair for this feature`
    );
  }
  try {
    return await handler.repair(state, plan, options);
  } catch (error) {
    // a failed step is already a FrodoError that names the step: do not wrap it a second time
    if (error instanceof FrodoError) throw error;
    throw new FrodoError(`Error repairing IDM feature ${featureId}`, error);
  }
}
