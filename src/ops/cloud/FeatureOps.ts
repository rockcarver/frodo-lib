import {
  getFeatures as _getFeatures,
  FeatureInterface,
} from '../../api/cloud/FeatureApi';
import { debugMessage } from '../utils/Console';

let _features: FeatureInterface[] = undefined;

/**
 * Get all features
 * @returns {Promise<FeatureInterface[]>} a promise that resolves to an array of feature objects
 */
export async function getFeatures(): Promise<FeatureInterface[]> {
  if (typeof _features !== 'undefined') return _features;
  try {
    const { result } = await _getFeatures();
    _features = JSON.parse(JSON.stringify(result));
  } catch (error) {
    debugMessage(error.response?.data);
    _features = [];
  }
  return _features;
}

/**
 * Check if feature is available
 * @param {string} featureId feature id (e.g. 'service-accounts')
 * @returns {Promise<boolean>} a promise that resolves to true if the feature is available and to false otherwise
 */
export async function hasFeature(featureId: string): Promise<boolean> {
  if (typeof _features === 'undefined') await getFeatures();
  const featureIds = _features.map((feature) => feature._id);
  return featureIds.includes(featureId);
}
