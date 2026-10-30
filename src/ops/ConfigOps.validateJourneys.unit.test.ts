import { jest } from '@jest/globals';

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

describe('ConfigOps journey validation option', () => {
  beforeEach(() => {
    importJourneysMock.mockReset().mockResolvedValue([]);
  });

  test.each([
    ['default', undefined, undefined],
    [
      'disabled',
      { validateJourneys: false, includeDynamic: true, includeStatic: true },
      false,
    ],
  ])(
    'passes the %s validation setting to importJourneys',
    async (_label, options, validate) => {
      await ConfigOps.importFullConfiguration({
        importData: {
          global: {},
          realm: {
            alpha: {
              trees: { Login: {} },
            },
          },
        } as any,
        options: options as any,
        resultCallback: undefined as any,
        state: {
          getDeploymentType: () => 'cloud',
          getIsIGA: () => false,
          getRealm: () => '/alpha',
          getVerbose: () => false,
          getCreateProgressHandler: () => undefined,
          getUpdateProgressHandler: () => undefined,
          getStopProgressHandler: () => undefined,
          setRealm: jest.fn(),
        } as any,
      });

      expect(importJourneysMock).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            deps: false,
            validate,
          }),
        })
      );
    }
  );
});
