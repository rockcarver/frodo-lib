import StateImpl, { deriveState } from './State';

describe('State cache of the application template catalog', () => {
  test('1: is off by default and has no path of its own', () => {
    const state = StateImpl({});
    expect(state.getUseTemplateCatalogCache()).toBe(false);
    expect(state.getTemplateCatalogCachePath()).toBeUndefined();
  });

  test('2: is turned on and off, and the path is set, per state', () => {
    const first = StateImpl({});
    const second = StateImpl({});
    first.setUseTemplateCatalogCache(true);
    first.setTemplateCatalogCachePath('/tmp/first');
    expect(first.getUseTemplateCatalogCache()).toBe(true);
    expect(first.getTemplateCatalogCachePath()).toBe('/tmp/first');
    expect(second.getUseTemplateCatalogCache()).toBe(false);
    expect(second.getTemplateCatalogCachePath()).toBeUndefined();
    expect(StateImpl({}).getUseTemplateCatalogCache()).toBe(false);
    first.setUseTemplateCatalogCache(false);
    expect(first.getUseTemplateCatalogCache()).toBe(false);
  });

  test('3: is off and has no path again after reset', () => {
    const state = StateImpl({});
    state.setUseTemplateCatalogCache(true);
    state.setTemplateCatalogCachePath('/tmp/x');
    state.reset();
    expect(state.getUseTemplateCatalogCache()).toBe(false);
    expect(state.getTemplateCatalogCachePath()).toBeUndefined();
  });

  test('4: a derived state answers with the settings of its parent', () => {
    const parent = StateImpl({});
    const derived = deriveState(parent, { getIdmHost: () => 'https://x/y' });
    parent.setUseTemplateCatalogCache(true);
    parent.setTemplateCatalogCachePath('/tmp/parent');
    expect(derived.getUseTemplateCatalogCache()).toBe(true);
    expect(derived.getTemplateCatalogCachePath()).toBe('/tmp/parent');
  });

  test('5: is not read from the environment', () => {
    process.env.FRODO_USE_TEMPLATE_CATALOG_CACHE = 'true';
    process.env.FRODO_TEMPLATE_CATALOG_CACHE_PATH = '/tmp/env';
    process.env.FRODO_NO_CACHE = '';
    try {
      const state = StateImpl({});
      expect(state.getUseTemplateCatalogCache()).toBe(false);
      expect(state.getTemplateCatalogCachePath()).toBeUndefined();
    } finally {
      delete process.env.FRODO_USE_TEMPLATE_CATALOG_CACHE;
      delete process.env.FRODO_TEMPLATE_CATALOG_CACHE_PATH;
      delete process.env.FRODO_NO_CACHE;
    }
  });
});
