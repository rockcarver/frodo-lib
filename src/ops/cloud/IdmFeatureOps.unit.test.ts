import { jest } from '@jest/globals';

const getIdmFeaturesApi = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const getIdmFeatureApi = jest.fn(async (_args?: any): Promise<any> => ({}));
const validateIdmFeatureApi = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
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

beforeEach(() => {
  getIdmFeaturesApi.mockReset();
  getIdmFeatureApi.mockReset();
  validateIdmFeatureApi.mockReset();
  installIdmFeatureApi.mockReset();
});

describe('IdmFeatureOps', () => {
  test('readIdmFeatures returns the result array', async () => {
    getIdmFeaturesApi.mockResolvedValue({
      result: [
        { _id: 'groups', installedVersion: '1', availableVersions: ['1'] },
      ],
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

  test('readIdmFeatures wraps a failure in a FrodoError', async () => {
    getIdmFeaturesApi.mockRejectedValue(new Error('network error'));
    await expect(readIdmFeatures({ state })).rejects.toMatchObject({
      name: 'FrodoError',
    });
  });
});

describe('IdmFeatureOps validateIdmFeature', () => {
  test('asks the api to validate the feature it was given', async () => {
    validateIdmFeatureApi.mockResolvedValue({
      status: 200,
      success: true,
      message: 'Validate complete.',
      failures: [],
    });
    await validateIdmFeature({ featureId: 'groups', state });
    expect(validateIdmFeatureApi).toHaveBeenCalledTimes(1);
    expect(validateIdmFeatureApi).toHaveBeenCalledWith(
      expect.objectContaining({ featureId: 'groups', state })
    );
  });

  test('a feature that can be installed is a success with no failures', async () => {
    validateIdmFeatureApi.mockResolvedValue({
      status: 200,
      success: true,
      message: 'Validate complete.',
      failures: [],
    });
    await expect(
      validateIdmFeature({ featureId: 'groups', state })
    ).resolves.toEqual({
      status: 200,
      success: true,
      message: 'Validate complete.',
      failures: [],
    });
  });

  test('a feature that cannot be installed keeps its failures and message', async () => {
    const failures = [
      'config/repo.ds: /resourceMapping/explicitMapping/managed/alpha_aiagent: must not already exist',
      'config/managed: /objects/-: value already present at /objects/14',
    ];
    validateIdmFeatureApi.mockResolvedValue({
      status: 200,
      success: false,
      message: 'Validate complete. 2 failure(s).',
      failures,
    });
    await expect(
      validateIdmFeature({ featureId: 'aiagent', state })
    ).resolves.toEqual({
      status: 200,
      success: false,
      message: 'Validate complete. 2 failure(s).',
      failures,
    });
  });

  test('failures is an empty array when the response has none', async () => {
    validateIdmFeatureApi.mockResolvedValue({
      status: 200,
      success: true,
      message: 'Validate complete.',
    });
    const result = await validateIdmFeature({ featureId: 'groups', state });
    expect(result.failures).toEqual([]);
    expect(result.success).toBe(true);
  });

  test('without a success field the feature can be installed when there are no failures', async () => {
    validateIdmFeatureApi.mockResolvedValue({
      status: 200,
      message: 'Validate complete.',
      failures: [],
    });
    const result = await validateIdmFeature({ featureId: 'groups', state });
    expect(result.success).toBe(true);
    expect(result.failures).toEqual([]);
  });

  test('without a success field and without a failures field the feature can be installed', async () => {
    validateIdmFeatureApi.mockResolvedValue({
      status: 200,
      message: 'Validate complete.',
    });
    const result = await validateIdmFeature({ featureId: 'groups', state });
    expect(result.success).toBe(true);
    expect(result.failures).toEqual([]);
  });

  test('without a success field the feature cannot be installed when there are failures', async () => {
    validateIdmFeatureApi.mockResolvedValue({
      status: 200,
      message: 'Validate complete. 1 failure(s).',
      failures: ['config/managed: /objects/-: value already present'],
    });
    const result = await validateIdmFeature({ featureId: 'aiagent', state });
    expect(result.success).toBe(false);
    expect(result.failures).toEqual([
      'config/managed: /objects/-: value already present',
    ]);
  });

  test('a success: false without failures is not installable', async () => {
    validateIdmFeatureApi.mockResolvedValue({
      status: 200,
      success: false,
      message: 'Validate complete.',
    });
    const result = await validateIdmFeature({ featureId: 'aiagent', state });
    expect(result.success).toBe(false);
    expect(result.failures).toEqual([]);
  });

  test('takes success from the response when it has one', async () => {
    validateIdmFeatureApi.mockResolvedValue({
      status: 200,
      success: true,
      message: 'Validate complete.',
      failures: ['config/managed: /objects/-: value already present'],
    });
    const result = await validateIdmFeature({ featureId: 'aiagent', state });
    expect(result.success).toBe(true);
    expect(result.failures).toHaveLength(1);
  });

  test('passes the status and the message through unchanged', async () => {
    validateIdmFeatureApi.mockResolvedValue({
      status: 202,
      success: true,
      message: 'Some other wording.',
      failures: [],
    });
    const result = await validateIdmFeature({ featureId: 'groups', state });
    expect(result.status).toBe(202);
    expect(result.message).toBe('Some other wording.');
  });

  test('wraps a failed request in a FrodoError that keeps the cause', async () => {
    const forbidden: any = new Error('Request failed with status code 403');
    forbidden.name = 'AxiosError';
    forbidden.response = { status: 403 };
    validateIdmFeatureApi.mockRejectedValue(forbidden);
    const error: any = await validateIdmFeature({
      featureId: 'groups',
      state,
    }).catch((e) => e);
    expect(error.name).toBe('FrodoError');
    expect(error.message).toBe('Error validating IDM feature groups');
    expect(error.originalErrors).toEqual([forbidden]);
    expect(error.httpStatus).toBe(403);
  });
});

describe('IdmFeatureOps installIdmFeature', () => {
  test('asks the api to install the feature it was given', async () => {
    installIdmFeatureApi.mockResolvedValue({
      status: 200,
      message: 'Install complete.',
    });
    await installIdmFeature({ featureId: 'request/access', state });
    expect(installIdmFeatureApi).toHaveBeenCalledTimes(1);
    expect(installIdmFeatureApi).toHaveBeenCalledWith(
      expect.objectContaining({ featureId: 'request/access', state })
    );
  });

  test('the documented response, which has no success field, is a success', async () => {
    installIdmFeatureApi.mockResolvedValue({
      status: 200,
      message: 'Install complete.',
    });
    await expect(
      installIdmFeature({ featureId: 'request/access', state })
    ).resolves.toEqual({
      status: 200,
      success: true,
      message: 'Install complete.',
      failures: [],
    });
  });

  test('a response with success: true is a success', async () => {
    installIdmFeatureApi.mockResolvedValue({
      status: 200,
      success: true,
      message: 'Install complete.',
    });
    const result = await installIdmFeature({ featureId: 'groups', state });
    expect(result.success).toBe(true);
    expect(result.failures).toEqual([]);
  });

  test('a response with an empty failures list is a success', async () => {
    installIdmFeatureApi.mockResolvedValue({
      status: 200,
      message: 'Install complete.',
      failures: [],
    });
    const result = await installIdmFeature({ featureId: 'groups', state });
    expect(result.success).toBe(true);
    expect(result.failures).toEqual([]);
  });

  test('a response with success: false is a failure that keeps its failures and message', async () => {
    const failures = ['config/managed: /objects/-: value already present'];
    installIdmFeatureApi.mockResolvedValue({
      status: 200,
      success: false,
      message: 'Install failed. 1 failure(s).',
      failures,
    });
    await expect(
      installIdmFeature({ featureId: 'aiagent', state })
    ).resolves.toEqual({
      status: 200,
      success: false,
      message: 'Install failed. 1 failure(s).',
      failures,
    });
  });

  test('a response with success: false and no failures is a failure with an empty list', async () => {
    installIdmFeatureApi.mockResolvedValue({
      status: 200,
      success: false,
      message: 'Install failed.',
    });
    const result = await installIdmFeature({ featureId: 'aiagent', state });
    expect(result.success).toBe(false);
    expect(result.failures).toEqual([]);
    expect(result.message).toBe('Install failed.');
  });

  test('a response with failures and no success field is a failure', async () => {
    const failures = [
      'config/repo.ds: /resourceMapping/explicitMapping/managed/alpha_aiagent: must not already exist',
    ];
    installIdmFeatureApi.mockResolvedValue({
      status: 200,
      message: 'Install failed. 1 failure(s).',
      failures,
    });
    const result = await installIdmFeature({ featureId: 'aiagent', state });
    expect(result.success).toBe(false);
    expect(result.failures).toEqual(failures);
    expect(result.message).toBe('Install failed. 1 failure(s).');
  });

  test('a response with success: true but failures is a failure', async () => {
    installIdmFeatureApi.mockResolvedValue({
      status: 200,
      success: true,
      message: 'Install complete.',
      failures: ['config/managed: /objects/-: value already present'],
    });
    const result = await installIdmFeature({ featureId: 'aiagent', state });
    expect(result.success).toBe(false);
    expect(result.failures).toEqual([
      'config/managed: /objects/-: value already present',
    ]);
  });

  test('passes the status and the message through unchanged', async () => {
    installIdmFeatureApi.mockResolvedValue({
      status: 202,
      message: 'Some other wording.',
    });
    const result = await installIdmFeature({ featureId: 'groups', state });
    expect(result.status).toBe(202);
    expect(result.message).toBe('Some other wording.');
  });

  test('makes no second request to confirm the install', async () => {
    installIdmFeatureApi.mockResolvedValue({
      status: 200,
      message: 'Install complete.',
    });
    await installIdmFeature({ featureId: 'groups', state });
    expect(installIdmFeatureApi).toHaveBeenCalledTimes(1);
    expect(getIdmFeatureApi).not.toHaveBeenCalled();
    expect(getIdmFeaturesApi).not.toHaveBeenCalled();
    expect(validateIdmFeatureApi).not.toHaveBeenCalled();
  });

  test('wraps a failed request in a FrodoError that keeps the cause', async () => {
    const serverError: any = new Error('Request failed with status code 500');
    serverError.name = 'AxiosError';
    serverError.response = { status: 500 };
    installIdmFeatureApi.mockRejectedValue(serverError);
    const error: any = await installIdmFeature({
      featureId: 'groups',
      state,
    }).catch((e) => e);
    expect(error.name).toBe('FrodoError');
    expect(error.message).toBe('Error installing IDM feature groups');
    expect(error.originalErrors).toEqual([serverError]);
    expect(error.httpStatus).toBe(500);
  });
});
