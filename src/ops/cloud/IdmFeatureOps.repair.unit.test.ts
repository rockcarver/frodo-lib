/**
 * Unit tests for `planIdmFeatureRepair` and `repairIdmFeature` of the IDM feature module.
 *
 * Run with:
 *
 *        npm run test:only IdmFeatureOps.repair
 *
 * Origin: frodo-lib#1060. The library can repair one feature, `aiagent`. For any other feature there is no repair and a
 * caller has to be told so rather than get an empty plan.
 */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../api/cloud/IdmFeatureApi', () => ({
  getIdmFeatures: jest.fn(),
  getIdmFeature: jest.fn(),
  validateIdmFeature: jest.fn(),
  installIdmFeature: jest.fn(),
}));

const plan = jest.fn(async (_state?: any, _options?: any): Promise<any> => ({
  featureId: 'aiagent',
  repairable: true,
  steps: [],
}));
const repair = jest.fn(
  async (_state?: any, _plan?: any, _options?: any): Promise<any> => ({
    featureId: 'aiagent',
    completed: true,
    results: [],
  })
);
jest.unstable_mockModule('./idmFeature/IdmFeatureHandlers', () => ({
  getIdmFeatureHandler: (featureId: string) =>
    featureId === 'aiagent' ? { diagnose: jest.fn(), plan, repair } : undefined,
}));

const { planIdmFeatureRepair, repairIdmFeature } =
  await import('./IdmFeatureOps');
const { FrodoError } = await import('../FrodoError');
const state = {} as any;

beforeEach(() => {
  plan.mockClear();
  repair.mockClear();
});

describe('planIdmFeatureRepair', () => {
  test('hands the state and the options to the handler of the feature', async () => {
    const options = { keepAligned: true, authService: 'MyLogin' };
    await planIdmFeatureRepair({ featureId: 'aiagent', options, state });
    expect(plan).toHaveBeenCalledWith(state, options);
  });

  test('a feature the library cannot repair is an error, not an empty plan', async () => {
    const error = await planIdmFeatureRepair({
      featureId: 'groups',
      state,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toContain(
      'the library has no repair for this feature'
    );
    expect(plan).not.toHaveBeenCalled();
  });

  test('a failure is a FrodoError that keeps the cause', async () => {
    const cause = new Error('registry unreadable');
    plan.mockRejectedValueOnce(cause);
    const error = await planIdmFeatureRepair({
      featureId: 'aiagent',
      state,
    }).catch((e) => e);
    expect(error.message).toBe(
      'Error planning the repair of IDM feature aiagent'
    );
    expect(error.originalErrors[0]).toBe(cause);
  });
});

describe('repairIdmFeature', () => {
  const aPlan: any = { featureId: 'aiagent', repairable: true, steps: [] };

  test('hands the plan and the options to the handler named by the plan', async () => {
    const options = { wait: true, timeout: 5000 };
    const result = await repairIdmFeature({ plan: aPlan, options, state });
    expect(repair).toHaveBeenCalledWith(state, aPlan, options);
    expect(result.completed).toBe(true);
  });

  test('a plan of a feature the library cannot repair is an error', async () => {
    await expect(
      repairIdmFeature({ plan: { ...aPlan, featureId: 'groups' }, state })
    ).rejects.toMatchObject({ name: 'FrodoError' });
    expect(repair).not.toHaveBeenCalled();
  });

  test('the FrodoError of a failed step is thrown as it is, not wrapped a second time', async () => {
    const stepError = new FrodoError(
      'Error repairing IDM feature aiagent: Run the enable action'
    );
    repair.mockRejectedValueOnce(stepError);
    await expect(repairIdmFeature({ plan: aPlan, state })).rejects.toBe(
      stepError
    );
  });

  test('any other failure is wrapped', async () => {
    repair.mockRejectedValueOnce(new Error('boom'));
    const error = await repairIdmFeature({ plan: aPlan, state }).catch(
      (e) => e
    );
    expect(error.message).toBe('Error repairing IDM feature aiagent');
    expect(error.originalErrors[0].message).toBe('boom');
  });
});
