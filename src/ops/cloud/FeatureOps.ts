import {
  getFeatures as _getFeatures,
  FeatureInterface,
} from '../../api/cloud/FeatureApi';
import { State } from '../../shared/State';
import { debugMessage } from '../../utils/Console';
import { FrodoError } from '../FrodoError';

export type Feature = {
  /**
   * Read all features. Fails with a FrodoError when the list cannot be read, for example when the credential lacks the scope fr:idc:feature:* (the platform answers 403): an empty list means that the tenant has no features. The list is read once per state and kept; a failed read is not kept, the next call asks again.
   * @returns {Promise<FeatureInterface[]>} a promise that resolves to an array of feature objects
   */
  readFeatures(): Promise<FeatureInterface[]>;
  /**
   * Check if feature is available. Unlike readFeatures, it does not fail when the list cannot be read: it answers false, because it is used to decide whether to offer a function, and a credential that may not read the list must not lose functions that it may use. The failure is written to the debug output and the list is not requested again for the same host.
   * @param {string} featureId feature id (e.g. 'service-accounts')
   * @returns {Promise<boolean>} a promise that resolves to true if the feature is available and to false otherwise (also when the list cannot be read)
   */
  hasFeature(featureId: string): Promise<boolean>;
};

export default (state: State): Feature => {
  return {
    /**
     * Read all features. Fails with a FrodoError when the list cannot be read, for example when the credential lacks the scope fr:idc:feature:* (the platform answers 403): an empty list means that the tenant has no features. The list is read once per state and kept; a failed read is not kept, the next call asks again.
     * @returns {Promise<FeatureInterface[]>} a promise that resolves to an array of feature objects
     */
    async readFeatures(): Promise<FeatureInterface[]> {
      return readFeatures({ state });
    },

    /**
     * Check if feature is available. Unlike readFeatures, it does not fail when the list cannot be read: it answers false, because it is used to decide whether to offer a function, and a credential that may not read the list must not lose functions that it may use. The failure is written to the debug output and the list is not requested again for the same host.
     * @param {string} featureId feature id (e.g. 'service-accounts')
     * @returns {Promise<boolean>} a promise that resolves to true if the feature is available and to false otherwise (also when the list cannot be read)
     */
    async hasFeature(featureId: string): Promise<boolean> {
      return hasFeature({ featureId, state });
    },
  };
};

/**
 * The hosts for which the feature list could not be read, per state: `hasFeature` asks once and then answers false
 * without asking again. `readFeatures` does not use it, so that it always tells the truth.
 */
const unreadable = new WeakMap<State, string>();

/**
 * Read all features. Throws a FrodoError when the list cannot be read (for example HTTP 403 for a credential without
 * the scope fr:idc:feature:*); a failed read is not remembered as an empty list.
 * @returns {Promise<FeatureInterface[]>} a promise that resolves to an array of feature objects
 */
export async function readFeatures({
  state,
}: {
  state: State;
}): Promise<FeatureInterface[]> {
  if (typeof state.getFeatures() !== 'undefined') return state.getFeatures();
  try {
    const { result } = await _getFeatures({ state });
    state.setFeatures(JSON.parse(JSON.stringify(result)));
  } catch (error) {
    throw new FrodoError(`Error reading the features`, error);
  }
  return state.getFeatures();
}

/**
 * Check if feature is available. Never throws for an unreadable list: it answers false (the list is optional
 * information for deciding whether to offer a function), says why in the debug output and does not ask again for the
 * same host.
 * @param {string} featureId feature id (e.g. 'service-accounts')
 * @returns {Promise<boolean>} a promise that resolves to true if the feature is available and to false otherwise
 */
export async function hasFeature({
  featureId,
  state,
}: {
  featureId: string;
  state: State;
}): Promise<boolean> {
  if (
    typeof state.getFeatures() === 'undefined' &&
    unreadable.get(state) !== state.getHost()
  ) {
    try {
      await readFeatures({ state });
    } catch (error) {
      const cause = (error as FrodoError).originalErrors?.[0] as
        | {
            message?: string;
            response?: { status?: number; data?: unknown };
          }
        | undefined;
      debugMessage({
        message: `FeatureOps.hasFeature: could not read the feature list, assuming none: ${cause?.message ?? (error as Error).message}${
          cause?.response?.status ? ` (HTTP ${cause.response.status})` : ''
        }${cause?.response?.data ? ` ${JSON.stringify(cause.response.data)}` : ''}`,
        state,
      });
      unreadable.set(state, state.getHost());
    }
  }
  const features = state.getFeatures() ?? [];
  return features.map((feature) => feature._id).includes(featureId);
}
