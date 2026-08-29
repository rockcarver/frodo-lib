import { jest } from '@jest/globals';

const getIdmFeaturesApi = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const getIdmFeatureApi = jest.fn(async (_args?: any): Promise<any> => ({}));
const validateIdmFeatureApi = jest.fn(async (_args?: any): Promise<any> => ({}));
const installIdmFeatureApi = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../../api/cloud/IdmFeatureApi', () => ({
  getIdmFeatures: getIdmFeaturesApi,
  getIdmFeature: getIdmFeatureApi,
  validateIdmFeature: validateIdmFeatureApi,
  installIdmFeature: installIdmFeatureApi,
}));

const {
  readIdmFeatures,
  readIdmFeature,
  hasIdmFeature,
  validateIdmFeature,
  installIdmFeature,
} = await import('./IdmFeatureOps');

const state = {} as any;

describe('IdmFeatureOps', () => {
  beforeEach(() => {
    getIdmFeaturesApi.mockReset();
    getIdmFeatureApi.mockReset();
    validateIdmFeatureApi.mockReset();
    installIdmFeatureApi.mockReset();
  });

  test('readIdmFeatures returns the result array', async () => {
    getIdmFeaturesApi.mockResolvedValue({
      result: [{ _id: 'groups', installedVersion: '1', availableVersions: ['1'] }],
    });
    const features = await readIdmFeatures({ state });
    expect(features).toEqual([
      { _id: 'groups', installedVersion: '1', availableVersions: ['1'] },
    ]);
  });

  test('readIdmFeature returns a single feature', async () => {
    getIdmFeatureApi.mockResolvedValue({
      _id: 'aiagent',
      installedVersion: null,
      availableVersions: ['1'],
    });
    const feature = await readIdmFeature({ featureId: 'aiagent', state });
    expect(feature._id).toBe('aiagent');
    expect(getIdmFeatureApi).toHaveBeenCalledWith(
      expect.objectContaining({ featureId: 'aiagent' })
    );
  });

  test('hasIdmFeature reflects a truthy installedVersion', async () => {
    getIdmFeatureApi.mockResolvedValue({
      _id: 'aiagent',
      installedVersion: '1',
      availableVersions: ['1'],
    });
    await expect(hasIdmFeature({ featureId: 'aiagent', state })).resolves.toBe(
      true
    );
  });

  test('hasIdmFeature returns false when installedVersion is null', async () => {
    getIdmFeatureApi.mockResolvedValue({
      _id: 'am/2fa/profiles',
      installedVersion: null,
      availableVersions: ['1'],
    });
    await expect(
      hasIdmFeature({ featureId: 'am/2fa/profiles', state })
    ).resolves.toBe(false);
  });

  test('hasIdmFeature returns false (not a thrown error) on a 404', async () => {
    const notFound: any = new Error('Not Found');
    notFound.name = 'AxiosError';
    notFound.response = { status: 404 };
    getIdmFeatureApi.mockRejectedValue(notFound);
    await expect(
      hasIdmFeature({ featureId: 'not-a-real-feature', state })
    ).resolves.toBe(false);
  });

  test('hasIdmFeature propagates a non-404 failure', async () => {
    const forbidden: any = new Error('Forbidden');
    forbidden.name = 'AxiosError';
    forbidden.response = { status: 403 };
    getIdmFeatureApi.mockRejectedValue(forbidden);
    await expect(
      hasIdmFeature({ featureId: 'aiagent', state })
    ).rejects.toBeDefined();
  });

  test('validateIdmFeature returns the validation result', async () => {
    validateIdmFeatureApi.mockResolvedValue({
      status: 200,
      success: true,
      message: 'Validate complete.',
    });
    const result = await validateIdmFeature({ featureId: 'groups', state });
    expect(result.success).toBe(true);
    expect(validateIdmFeatureApi).toHaveBeenCalledWith(
      expect.objectContaining({ featureId: 'groups' })
    );
  });

  test('installIdmFeature returns the install result', async () => {
    installIdmFeatureApi.mockResolvedValue({
      status: 200,
      success: true,
      message: 'Install complete.',
    });
    const result = await installIdmFeature({ featureId: 'groups', state });
    expect(result.success).toBe(true);
    expect(installIdmFeatureApi).toHaveBeenCalledWith(
      expect.objectContaining({ featureId: 'groups' })
    );
  });

  test('readIdmFeatures wraps a failure in a FrodoError', async () => {
    getIdmFeaturesApi.mockRejectedValue(new Error('network error'));
    await expect(readIdmFeatures({ state })).rejects.toMatchObject({
      name: 'FrodoError',
    });
  });
});
