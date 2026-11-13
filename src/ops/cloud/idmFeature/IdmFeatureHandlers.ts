/**
 * The IDM features that have a diagnosis (and a repair), by feature id.
 *
 * @remarks
 * A feature without a handler keeps today's behaviour: it can be read, validated and installed, and nothing more.
 * Adding a handler is the way to teach the library about another feature that is known to break.
 */
import { State } from '../../../shared/State';
import { diagnoseAIAgentFeature } from './AIAgentFeatureDiagnose';
import { AI_AGENT_FEATURE_ID } from './AIAgentFeatureReference';
import {
  planAIAgentFeatureRepair,
  repairAIAgentFeature,
} from './AIAgentFeatureRepair';
import {
  createAIAgentFeatureRepairTenant,
  createAIAgentFeatureTenant,
} from './AIAgentFeatureTenant';
import {
  IdmFeatureDiagnosis,
  IdmFeatureRepairExecutionOptions,
  IdmFeatureRepairOptions,
  IdmFeatureRepairPlan,
  IdmFeatureRepairResult,
} from './IdmFeatureTypes';

/**
 * What the library can do for one feature. An interface, not a type alias: the help generator lists the methods of
 * the types of the public modules, and this is internal.
 */
export interface IdmFeatureHandler {
  /** Read-only diagnosis of the feature in the tenant behind `state`. */
  diagnose(state: State): Promise<IdmFeatureDiagnosis>;
  /** Plan the repair of the feature: diagnoses it and reads what would be overwritten. Writes nothing. */
  plan(
    state: State,
    options?: IdmFeatureRepairOptions
  ): Promise<IdmFeatureRepairPlan>;
  /** Run a plan of `plan`. */
  repair(
    state: State,
    plan: IdmFeatureRepairPlan,
    options?: IdmFeatureRepairExecutionOptions
  ): Promise<IdmFeatureRepairResult>;
}

const handlers: Record<string, IdmFeatureHandler> = {
  [AI_AGENT_FEATURE_ID]: {
    diagnose: (state) =>
      diagnoseAIAgentFeature(createAIAgentFeatureTenant(state)),
    plan: (state, options) =>
      planAIAgentFeatureRepair(
        createAIAgentFeatureRepairTenant(state),
        options
      ),
    repair: (state, plan, options) =>
      repairAIAgentFeature(
        createAIAgentFeatureRepairTenant(state),
        plan,
        options
      ),
  },
};

/**
 * The handler of a feature.
 * @param {string} featureId feature id, for example `aiagent`
 * @returns {IdmFeatureHandler | undefined} the handler, or undefined if the library has none for that feature
 */
export function getIdmFeatureHandler(
  featureId: string
): IdmFeatureHandler | undefined {
  return Object.prototype.hasOwnProperty.call(handlers, featureId)
    ? handlers[featureId]
    : undefined;
}
