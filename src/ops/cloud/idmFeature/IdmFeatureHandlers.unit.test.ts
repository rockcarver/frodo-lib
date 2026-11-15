/**
 * The registry of IDM feature handlers: which features the library can diagnose and repair, and the two lookups that
 * `canDiagnoseIdmFeature`, `listDiagnosableIdmFeatures`, `diagnoseIdmFeature`, `planIdmFeatureRepair` and
 * `repairIdmFeature` share.
 *
 * Run with:
 *
 *        npm run test:only IdmFeatureHandlers
 *
 * Origin: frodo-lib#1100 ("a new handler is listed without a second edit", "`canDiagnose` is true for exactly the ids
 * listed"). The real registry holds one handler today, so a second copy of its list would pass every test that only
 * reads the real registry. These tests hand the two lookups registries of their own (the optional second parameter),
 * one of which gets a handler after it was built, so that a list that is not read from the registry fails.
 */
import { jest } from '@jest/globals';
import {
  getIdmFeatureHandler,
  IdmFeatureHandler,
  listIdmFeatureHandlerIds,
} from './IdmFeatureHandlers';

const handler = (): IdmFeatureHandler => ({
  diagnose: jest.fn<IdmFeatureHandler['diagnose']>(),
  plan: jest.fn<IdmFeatureHandler['plan']>(),
  repair: jest.fn<IdmFeatureHandler['repair']>(),
});

/** Ids that are probed against every registry: listed ones, absent ones and names of Object.prototype. */
const PROBES = [
  'first',
  'second',
  'added-later',
  'aiagent',
  'groups',
  '',
  'constructor',
  '__proto__',
  'toString',
  'hasOwnProperty',
];

/** A feature is found exactly when it is listed, for every probe. */
function expectFoundExactlyWhenListed(
  registry: Record<string, IdmFeatureHandler>
) {
  const listed = listIdmFeatureHandlerIds(registry);
  for (const featureId of PROBES) {
    expect([
      featureId,
      getIdmFeatureHandler(featureId, registry) !== undefined,
    ]).toEqual([featureId, listed.includes(featureId)]);
  }
}

describe('a registry of two handlers', () => {
  const first = handler();
  const second = handler();
  const registry: Record<string, IdmFeatureHandler> = { first, second };

  test('lists both ids and finds both handlers', () => {
    expect(listIdmFeatureHandlerIds(registry)).toEqual(['first', 'second']);
    expect(getIdmFeatureHandler('first', registry)).toBe(first);
    expect(getIdmFeatureHandler('second', registry)).toBe(second);
  });

  test('finds a feature exactly when it lists it', () => {
    expectFoundExactlyWhenListed(registry);
  });

  test('knows nothing of a feature that is not in it, aiagent included', () => {
    expect(getIdmFeatureHandler('aiagent', registry)).toBeUndefined();
    expect(listIdmFeatureHandlerIds(registry)).not.toContain('aiagent');
  });

  test('a handler added afterwards is listed and found without another edit', () => {
    const grown: Record<string, IdmFeatureHandler> = { ...registry };
    expect(listIdmFeatureHandlerIds(grown)).not.toContain('added-later');
    expect(getIdmFeatureHandler('added-later', grown)).toBeUndefined();
    const added = handler();
    grown['added-later'] = added;
    expect(listIdmFeatureHandlerIds(grown)).toEqual([
      'first',
      'second',
      'added-later',
    ]);
    expect(getIdmFeatureHandler('added-later', grown)).toBe(added);
    expectFoundExactlyWhenListed(grown);
  });

  test('a handler taken out is no longer listed or found', () => {
    const shrunk: Record<string, IdmFeatureHandler> = { ...registry };
    delete shrunk.second;
    expect(listIdmFeatureHandlerIds(shrunk)).toEqual(['first']);
    expect(getIdmFeatureHandler('second', shrunk)).toBeUndefined();
    expectFoundExactlyWhenListed(shrunk);
  });

  test('every call lists a new array', () => {
    const listed = listIdmFeatureHandlerIds(registry);
    listed.push('groups');
    listed.length = 0;
    expect(listIdmFeatureHandlerIds(registry)).toEqual(['first', 'second']);
  });
});

describe('the edges of a registry', () => {
  test('an empty registry lists nothing and finds nothing', () => {
    expect(listIdmFeatureHandlerIds({})).toEqual([]);
    expectFoundExactlyWhenListed({});
  });

  test('what a registry inherits is not in it', () => {
    const registry: Record<string, IdmFeatureHandler> = Object.create({
      inherited: handler(),
    });
    registry.own = handler();
    expect(listIdmFeatureHandlerIds(registry)).toEqual(['own']);
    expect(getIdmFeatureHandler('inherited', registry)).toBeUndefined();
    expect(getIdmFeatureHandler('own', registry)).toBeDefined();
  });

  test('a feature id that is not a string is not found and does not throw', () => {
    const registry = { first: handler() };
    expect(getIdmFeatureHandler(undefined as any, registry)).toBeUndefined();
    expect(getIdmFeatureHandler(null as any, registry)).toBeUndefined();
    expect(getIdmFeatureHandler(1 as any, registry)).toBeUndefined();
  });
});

describe('the library registry (the default)', () => {
  test('it holds the feature aiagent', () => {
    expect(listIdmFeatureHandlerIds()).toContain('aiagent');
    expect(getIdmFeatureHandler('aiagent')).toBeDefined();
  });

  test('it finds a feature exactly when it lists it', () => {
    const listed = listIdmFeatureHandlerIds();
    expect(listed.length).toBeGreaterThan(0);
    for (const featureId of [...PROBES, ...listed]) {
      expect([
        featureId,
        getIdmFeatureHandler(featureId) !== undefined,
      ]).toEqual([featureId, listed.includes(featureId)]);
    }
  });

  test('every handler it holds can diagnose, plan and repair', () => {
    for (const featureId of listIdmFeatureHandlerIds()) {
      const found = getIdmFeatureHandler(featureId)!;
      expect(typeof found.diagnose).toBe('function');
      expect(typeof found.plan).toBe('function');
      expect(typeof found.repair).toBe('function');
    }
  });

  test('the default and an explicit default give the same answers: nothing else is read', () => {
    const listed = listIdmFeatureHandlerIds();
    const explicit: Record<string, IdmFeatureHandler> = {};
    for (const featureId of listed) {
      explicit[featureId] = getIdmFeatureHandler(featureId)!;
    }
    expect(listIdmFeatureHandlerIds(explicit)).toEqual(listed);
  });
});
