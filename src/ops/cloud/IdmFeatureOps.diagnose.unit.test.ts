/**
 * Unit tests for `diagnoseIdmFeature` of the IDM feature module.
 *
 * Run with:
 *
 *        npm run test:only IdmFeatureOps.diagnose
 *
 * Origin: frodo-lib#1060. The library has a diagnosis for one feature, `aiagent`. Any other feature keeps today's
 * behaviour: it is read, validated and installed, and the diagnosis only reports its registry entry.
 */
import { jest } from '@jest/globals';

const getIdmFeatureApi = jest.fn(async (_args?: any): Promise<any> => ({}));
jest.unstable_mockModule('../../api/cloud/IdmFeatureApi', () => ({
  getIdmFeatures: jest.fn(),
  getIdmFeature: getIdmFeatureApi,
  validateIdmFeature: jest.fn(),
  installIdmFeature: jest.fn(),
}));

const diagnose = jest.fn(async (_state?: any): Promise<any> => ({
  featureId: 'aiagent',
  supported: true,
  installedVersion: '1',
  availableVersions: ['1'],
  findings: [],
}));
jest.unstable_mockModule('./idmFeature/IdmFeatureHandlers', () => ({
  getIdmFeatureHandler: (featureId: string) =>
    featureId === 'aiagent' ? { diagnose } : undefined,
}));

const { diagnoseIdmFeature } = await import('./IdmFeatureOps');
const state = {} as any;

beforeEach(() => {
  getIdmFeatureApi.mockReset();
  diagnose.mockClear();
});

describe('diagnoseIdmFeature', () => {
  test('a feature with a handler is diagnosed by it, with the state', async () => {
    const result = await diagnoseIdmFeature({ featureId: 'aiagent', state });
    expect(result.supported).toBe(true);
    expect(diagnose).toHaveBeenCalledWith(state);
    expect(getIdmFeatureApi).not.toHaveBeenCalled();
  });

  test('a feature without a handler is not supported: no findings, only its registry entry', async () => {
    getIdmFeatureApi.mockResolvedValue({
      _id: 'groups',
      installedVersion: '1',
      availableVersions: ['1'],
    });
    await expect(
      diagnoseIdmFeature({ featureId: 'groups', state })
    ).resolves.toEqual({
      featureId: 'groups',
      supported: false,
      installedVersion: '1',
      availableVersions: ['1'],
      findings: [],
    });
    expect(diagnose).not.toHaveBeenCalled();
  });

  test('an id that is no feature at all (404) is not supported and has no version', async () => {
    const notFound: any = new Error('Not Found');
    notFound.name = 'AxiosError';
    notFound.response = { status: 404 };
    getIdmFeatureApi.mockRejectedValue(notFound);
    await expect(
      diagnoseIdmFeature({ featureId: 'nope', state })
    ).resolves.toEqual({
      featureId: 'nope',
      supported: false,
      installedVersion: null,
      availableVersions: [],
      findings: [],
    });
  });

  test('a registry read that fails for another reason is a FrodoError', async () => {
    const forbidden: any = new Error('Forbidden');
    forbidden.name = 'AxiosError';
    forbidden.response = { status: 403 };
    getIdmFeatureApi.mockRejectedValue(forbidden);
    await expect(
      diagnoseIdmFeature({ featureId: 'groups', state })
    ).rejects.toMatchObject({
      name: 'FrodoError',
      message: 'Error diagnosing IDM feature groups',
      httpStatus: 403,
    });
  });

  test('a failure of the diagnosis of a supported feature is a FrodoError that keeps the cause', async () => {
    const cause = new Error('registry unreadable');
    diagnose.mockRejectedValueOnce(cause);
    const error = await diagnoseIdmFeature({
      featureId: 'aiagent',
      state,
    }).catch((e) => e);
    expect(error.name).toBe('FrodoError');
    expect(error.message).toBe('Error diagnosing IDM feature aiagent');
    expect(error.originalErrors[0]).toBe(cause);
  });
});
