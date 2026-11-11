import { jest } from '@jest/globals';

/**
 * `importFullConfiguration` hands the journeys to `importJourneys` with an error-only callback when the caller gave a
 * result callback, so that the journeys are items of their own and the other sections are not affected by a failed one.
 * A caller without a result callback gets the behaviour that was there before: `importJourneys` is called without a
 * callback and rejects the whole batch with one error that names every invalid journey (frodo-lib#957).
 *
 * Mocked unit test: no recordings, no tenant.
 */

const importJourneysMock: any = jest.fn();

jest.unstable_mockModule('./JourneyOps', () => ({
  exportJourneys: jest.fn(),
  importJourneys: importJourneysMock,
}));
jest.unstable_mockModule('./AmConfigOps', () => ({
  exportAmConfigEntities: jest.fn(),
  importAmConfigEntities: jest.fn(),
}));

const ConfigOps = await import('./ConfigOps');

const state: any = {
  getDeploymentType: () => 'cloud',
  getIsIGA: () => false,
  getRealm: () => '/alpha',
  getVerbose: () => false,
  getCreateProgressHandler: () => undefined,
  getUpdateProgressHandler: () => undefined,
  getStopProgressHandler: () => undefined,
  setRealm: jest.fn(),
};

const importData: any = {
  global: {},
  realm: { alpha: { trees: { Login: {} } } },
};

describe('importFullConfiguration and the result callback of importJourneys', () => {
  beforeEach(() => {
    importJourneysMock.mockReset().mockResolvedValue([]);
  });

  test('without a result callback importJourneys gets none', async () => {
    await ConfigOps.importFullConfiguration({
      importData,
      options: { includeDynamic: true, includeStatic: true } as any,
      resultCallback: undefined as any,
      state,
    });

    expect(importJourneysMock).toHaveBeenCalledTimes(1);
    expect(importJourneysMock.mock.calls[0][0].resultCallback).toBeUndefined();
  });

  test('with a result callback importJourneys gets a callback that passes the errors on and ignores the journeys', async () => {
    const resultCallback = jest.fn();

    await ConfigOps.importFullConfiguration({
      importData,
      options: { includeDynamic: true, includeStatic: true } as any,
      resultCallback,
      state,
    });

    const given = importJourneysMock.mock.calls[0][0].resultCallback;
    expect(typeof given).toBe('function');
    resultCallback.mockClear();
    given(undefined, { _id: 'Login' });
    expect(resultCallback).not.toHaveBeenCalled();
    const error = new Error('Error importing the alpha realm journey Login');
    given(error, undefined);
    expect(resultCallback).toHaveBeenCalledTimes(1);
    expect(resultCallback).toHaveBeenCalledWith(error, undefined);
  });
});
