/**
 * Unit tests for `canDiagnoseIdmFeature` and `listDiagnosableIdmFeatures` of the IDM feature module, against the
 * library's REAL registry of handlers.
 *
 * Run with:
 *
 *        npm run test:only IdmFeatureOps.diagnosable
 *
 * Origin: frodo-lib#1100. A caller that wants to know whether the library can diagnose a feature before it asks the
 * tenant anything (frodo-cli keeps a copy of this knowledge) needs an answer that sends no request and needs no login.
 * The file `IdmFeatureOps.diagnosable.registry.unit.test.ts` proves that the answer comes from the registry and not from a
 * constant; this one pins what the real registry says and what the answer promises.
 */
import { jest } from '@jest/globals';

const api = {
  getIdmFeatures: jest.fn(async (_args?: any): Promise<any> => ({})),
  getIdmFeature: jest.fn(async (_args?: any): Promise<any> => ({})),
  validateIdmFeature: jest.fn(async (_args?: any): Promise<any> => ({})),
  installIdmFeature: jest.fn(async (_args?: any): Promise<any> => ({})),
};
jest.unstable_mockModule('../../api/cloud/IdmFeatureApi', () => api);

const {
  default: IdmFeatureOps,
  canDiagnoseIdmFeature,
  listDiagnosableIdmFeatures,
} = await import('./IdmFeatureOps');
const { getIdmFeatureHandler } =
  await import('./idmFeature/IdmFeatureHandlers');

/** A state that fails the test as soon as anything reads or writes it: no login, no tenant, no token. */
const untouchable = new Proxy(
  {},
  {
    get(_target, property) {
      throw new Error(`the state was read: ${String(property)}`);
    },
    set(_target, property) {
      throw new Error(`the state was written: ${String(property)}`);
    },
  }
) as any;

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockClear();
});

describe('canDiagnoseIdmFeature', () => {
  test('aiagent can be diagnosed', () => {
    expect(canDiagnoseIdmFeature({ featureId: 'aiagent' })).toBe(true);
  });

  test.each([
    ['a feature the tenant knows but the library does not', 'groups'],
    ['an id with a slash', 'am/2fa/profiles'],
    ['an empty id', ''],
    ['an id in another case', 'AIAGENT'],
    ['an id with a space around it', ' aiagent '],
    ['a name of Object.prototype', 'constructor'],
    ['another name of Object.prototype', 'toString'],
    ['a prototype key', '__proto__'],
    ['hasOwnProperty', 'hasOwnProperty'],
  ])('%s cannot: %s', (_why, featureId) => {
    expect(canDiagnoseIdmFeature({ featureId })).toBe(false);
  });

  test('an id that is not a string cannot be diagnosed (and does not throw)', () => {
    expect(canDiagnoseIdmFeature({ featureId: undefined as any })).toBe(false);
    expect(canDiagnoseIdmFeature({ featureId: null as any })).toBe(false);
    expect(canDiagnoseIdmFeature({ featureId: 42 as any })).toBe(false);
  });

  test('it agrees with the registry that diagnoseIdmFeature, planIdmFeatureRepair and repairIdmFeature use', () => {
    for (const featureId of [
      'aiagent',
      'groups',
      '',
      'constructor',
      'am/2fa/profiles',
    ]) {
      expect(canDiagnoseIdmFeature({ featureId })).toBe(
        getIdmFeatureHandler(featureId) !== undefined
      );
    }
  });
});

describe('listDiagnosableIdmFeatures', () => {
  test('the library can diagnose aiagent', () => {
    expect(listDiagnosableIdmFeatures()).toContain('aiagent');
  });

  test('every listed id has a handler and is diagnosable, and no id without a handler is listed', () => {
    const listed = listDiagnosableIdmFeatures();
    expect(listed.length).toBeGreaterThan(0);
    for (const featureId of listed) {
      expect(getIdmFeatureHandler(featureId)).toBeDefined();
      expect(canDiagnoseIdmFeature({ featureId })).toBe(true);
    }
    for (const featureId of ['groups', '', 'constructor', 'toString']) {
      expect(listed).not.toContain(featureId);
    }
  });

  test('the ids are strings, without duplicates', () => {
    const listed = listDiagnosableIdmFeatures();
    expect(listed.every((id) => typeof id === 'string' && id.length > 0)).toBe(
      true
    );
    expect(new Set(listed).size).toBe(listed.length);
  });

  test('every call returns a new array: changing it changes nothing', () => {
    const first = listDiagnosableIdmFeatures();
    const before = [...first];
    first.push('groups');
    first.splice(0, first.length);
    expect(listDiagnosableIdmFeatures()).toEqual(before);
    expect(canDiagnoseIdmFeature({ featureId: 'groups' })).toBe(false);
    expect(canDiagnoseIdmFeature({ featureId: 'aiagent' })).toBe(true);
  });
});

describe('on the frodo facade module', () => {
  test('both answers come back synchronously, not as promises', () => {
    const idmFeature = IdmFeatureOps(untouchable);
    const can = idmFeature.canDiagnoseIdmFeature('aiagent');
    const listed = idmFeature.listDiagnosableIdmFeatures();
    expect(can).toBe(true);
    expect(typeof (can as any)?.then).toBe('undefined');
    expect(Array.isArray(listed)).toBe(true);
    expect(typeof (listed as any)?.then).toBe('undefined');
    expect(listed).toContain('aiagent');
  });

  test('they send no request and need no login: no API call is made and the state is never touched', () => {
    const idmFeature = IdmFeatureOps(untouchable);
    idmFeature.canDiagnoseIdmFeature('aiagent');
    idmFeature.canDiagnoseIdmFeature('groups');
    idmFeature.listDiagnosableIdmFeatures();
    for (const fn of Object.values(api)) expect(fn).not.toHaveBeenCalled();
  });

  test('the facade agrees with the module functions', () => {
    const idmFeature = IdmFeatureOps(untouchable);
    expect(idmFeature.listDiagnosableIdmFeatures()).toEqual(
      listDiagnosableIdmFeatures()
    );
    for (const featureId of ['aiagent', 'groups', '']) {
      expect(idmFeature.canDiagnoseIdmFeature(featureId)).toBe(
        canDiagnoseIdmFeature({ featureId })
      );
    }
  });
});
