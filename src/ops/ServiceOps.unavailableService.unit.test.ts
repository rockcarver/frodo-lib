import { jest } from '@jest/globals';

/**
 * A service that is not available in PingOne Advanced Identity Cloud is
 * skipped by `getFullServices` without a word: no failure, no call of the
 * result callback. The skip leaves a debug line that names the operation and
 * the service, so the calls that were skipped can be audited.
 * Mocked unit test: no recordings.
 */

const getListOfServices = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const getService = jest.fn(async (_args?: any): Promise<any> => ({}));
const getServiceDescendents = jest.fn(async (_args?: any): Promise<any> => []);

const actualApi = await import('../api/ServiceApi');
jest.unstable_mockModule('../api/ServiceApi', () => ({
  ...actualApi,
  getListOfServices,
  getService,
  getServiceDescendents,
}));

const debugMessage = jest.fn();
const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  debugMessage,
}));

const { getFullServices } = await import('./ServiceOps');

const state = {
  getRealm: () => 'alpha',
  getDeploymentType: () => 'cloud',
} as any;

const notAvailable = () =>
  Object.assign(new Error('HTTP 403'), {
    config: { method: 'get', url: 'https://am.example.com/json/services/two' },
    response: {
      status: 403,
      data: {
        message:
          'This operation is not available in PingOne Advanced Identity Cloud.',
      },
    },
  });

beforeEach(() => {
  jest.clearAllMocks();
  getListOfServices.mockReset();
  getListOfServices.mockResolvedValue({
    result: [{ _id: 'one' }, { _id: 'two' }, { _id: 'three' }],
  });
  getService.mockReset();
  getService.mockImplementation(async ({ serviceId }: any) => {
    if (serviceId === 'two') throw notAvailable();
    return { _id: serviceId };
  });
  getServiceDescendents.mockReset();
  getServiceDescendents.mockResolvedValue([]);
});

describe('getFullServices: a service that is not available in the cloud', () => {
  test.each([
    ['without a callback', undefined],
    ['with a callback', jest.fn()],
  ])(
    'is skipped without a word and leaves a debug line (%s)',
    async (_label, callback) => {
      const services = await getFullServices({
        globalConfig: false,
        resultCallback: callback as any,
        state,
      });

      expect(services.map((service) => service._id)).toEqual(['one', 'three']);
      if (callback) {
        // the two services that could be read, and nothing for the skipped one
        expect(callback).toHaveBeenCalledTimes(2);
        expect(
          callback.mock.calls.every(([error]) => error === undefined)
        ).toBe(true);
      }
      const lines = debugMessage.mock.calls
        .map(([arg]: any) => arg.message)
        .filter((message: string) => message.includes('not available'));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('ServiceOps.getFullServices');
      expect(lines[0]).toContain('two');
      // and the request that was answered so, as the other skip sites say it
      expect(lines[0]).toContain(
        '[GET https://am.example.com/json/services/two]'
      );
    }
  );
});
