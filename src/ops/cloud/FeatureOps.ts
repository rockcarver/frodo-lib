import {
  getFeatures as _getFeatures,
  FeatureInterface,
} from '../../api/cloud/FeatureApi';
import State from '../../shared/State';
import { debugMessage } from '../utils/Console';

export default class FeatureOps {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  /**
   * Get all features
   * @returns {Promise<FeatureInterface[]>} a promise that resolves to an array of feature objects
   */
  async getFeatures(): Promise<FeatureInterface[]> {
    return getFeatures({ state: this.state });
  }

  /**
   * Check if feature is available
   * @param {string} featureId feature id (e.g. 'service-accounts')
   * @returns {Promise<boolean>} a promise that resolves to true if the feature is available and to false otherwise
   */
  async hasFeature(featureId: string): Promise<boolean> {
    return hasFeature({ featureId, state: this.state });
  }
}

/**
 * Get all features
 * @returns {Promise<FeatureInterface[]>} a promise that resolves to an array of feature objects
 */
export async function getFeatures({
  state,
}: {
  state: State;
}): Promise<FeatureInterface[]> {
  if (typeof state.getFeatures() !== 'undefined') return state.getFeatures();
  try {
    const { result } = await _getFeatures({ state });
    state.setFeatures(JSON.parse(JSON.stringify(result)));
  } catch (error) {
    debugMessage({ message: error.response?.data, state });
    state.setFeatures([]);
  }
  return state.getFeatures();
}

/**
 * Check if feature is available
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
  if (typeof state.getFeatures() === 'undefined') await getFeatures({ state });
  const featureIds = state.getFeatures().map((feature) => feature._id);
  return featureIds.includes(featureId);
}
