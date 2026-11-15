/**
 * `canDiagnoseIdmFeature` and `listDiagnosableIdmFeatures` take their answer from the registry of handlers and from
 * nothing else: with a registry that holds two handlers, both come back, and a feature that is added to the registry
 * is listed and diagnosable without a second edit.
 *
 * Run with:
 *
 *        npm run test:only IdmFeatureOps.diagnosable.registry
 *
 * Origin: frodo-lib#1100 ("a new handler is listed without a second edit"). The real registry holds one handler
 * (`aiagent`); `IdmFeatureOps.diagnosable.unit.test.ts` pins what it says.
 */
import { jest } from '@jest/globals';

const handler = { diagnose: jest.fn(), plan: jest.fn(), repair: jest.fn() };
const registry: Record<string, typeof handler> = {
  aiagent: handler,
  'a-second-feature': handler,
};
jest.unstable_mockModule('../../api/cloud/IdmFeatureApi', () => ({
  getIdmFeatures: jest.fn(),
  getIdmFeature: jest.fn(),
  validateIdmFeature: jest.fn(),
  installIdmFeature: jest.fn(),
}));
jest.unstable_mockModule('./idmFeature/IdmFeatureHandlers', () => ({
  getIdmFeatureHandler: (featureId: string) =>
    Object.prototype.hasOwnProperty.call(registry, featureId)
      ? registry[featureId]
      : undefined,
  listIdmFeatureHandlerIds: () => Object.keys(registry),
}));

const { canDiagnoseIdmFeature, listDiagnosableIdmFeatures } =
  await import('./IdmFeatureOps');

afterEach(() => {
  delete registry['a-feature-added-later'];
});

describe('the answer is the registry', () => {
  test('both handlers of the registry are listed and diagnosable', () => {
    expect(listDiagnosableIdmFeatures()).toEqual([
      'aiagent',
      'a-second-feature',
    ]);
    expect(canDiagnoseIdmFeature({ featureId: 'aiagent' })).toBe(true);
    expect(canDiagnoseIdmFeature({ featureId: 'a-second-feature' })).toBe(true);
    expect(canDiagnoseIdmFeature({ featureId: 'groups' })).toBe(false);
  });

  test('a handler that is added to the registry is listed and diagnosable without another edit', () => {
    expect(canDiagnoseIdmFeature({ featureId: 'a-feature-added-later' })).toBe(
      false
    );
    registry['a-feature-added-later'] = handler;
    expect(listDiagnosableIdmFeatures()).toContain('a-feature-added-later');
    expect(canDiagnoseIdmFeature({ featureId: 'a-feature-added-later' })).toBe(
      true
    );
  });

  test('a handler that is taken out of the registry is no longer listed', () => {
    delete registry['a-second-feature'];
    try {
      expect(listDiagnosableIdmFeatures()).toEqual(['aiagent']);
      expect(canDiagnoseIdmFeature({ featureId: 'a-second-feature' })).toBe(
        false
      );
    } finally {
      registry['a-second-feature'] = handler;
    }
  });
});
