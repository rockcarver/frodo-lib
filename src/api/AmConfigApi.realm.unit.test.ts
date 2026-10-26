import { jest } from '@jest/globals';
import { AxiosError } from 'axios';

const request = jest.fn<(url: string) => Promise<{ data: { _id: string } }>>();
const generate = () => ({
  get: request,
  post: request,
  put: request,
});
jest.unstable_mockModule('./BaseApi', () => ({
  generateAmApi: generate,
  generateAmAuthApi: generate,
  generateOauth2Api: generate,
  generateIdmApi: generate,
  generateIdmSystemApi: generate,
  generateLogKeysApi: generate,
  generateLogApi: generate,
  generateEnvApi: generate,
  generateGovernanceApi: generate,
  generateWSFedApi: generate,
  generateReleaseApi: generate,
}));

const { getConfigEntity, putConfigEntity } = await import('./AmConfigApi');
const { default: State } = await import('../shared/State');

const HOST = 'https://tenant.example.com/am';
const entity = { _id: 'example' };

beforeEach(() => {
  request.mockReset();
});

describe.each(['GET', 'POST', 'PUT'])('%s config entity', (method) => {
  test.each([
    ['/alpha', '/realms/root/realms/alpha'],
    ['/', '/realms/root'],
    [undefined, ''],
  ])(
    'restores the active realm after success or failure in realm %s',
    async (realm, realmPath) => {
      const state = State({});
      state.setHost(HOST);
      state.setRealm('/bravo');
      const options = {
        state,
        path: '/realm-config/webhooks',
        version: '1.0',
        realm,
      };
      const call = () =>
        method === 'PUT'
          ? putConfigEntity({ ...options, entityData: entity })
          : getConfigEntity({
              ...options,
              action: method === 'POST' ? 'nextdescendents' : undefined,
            });
      const url = `${HOST}/json${realmPath}${options.path}${
        method === 'POST' ? '?_action=nextdescendents' : ''
      }`;
      const failure = new AxiosError(
        'Request failed with status code 500',
        'ERR_BAD_RESPONSE',
        undefined,
        undefined,
        {
          status: 500,
          statusText: 'Internal Server Error',
          headers: {},
          config: {} as never,
          data: { message: 'Internal Server Error' },
        }
      );

      request.mockImplementation(async (requestUrl) => {
        expect(requestUrl).toBe(url);
        expect(state.getRealm()).toBe(realm ?? '/bravo');
        return { data: entity };
      });
      await expect(call()).resolves.toEqual(entity);
      expect(state.getRealm()).toBe('/bravo');

      request.mockImplementation(async (requestUrl) => {
        expect(requestUrl).toBe(url);
        expect(state.getRealm()).toBe(realm ?? '/bravo');
        throw failure;
      });
      await expect(call()).rejects.toMatchObject({
        name: 'FrodoError',
        message: `Error ${
          method === 'PUT'
            ? 'putting config entity at'
            : 'getting config entity from'
        } resource path '${url}'`,
        originalErrors: [failure],
        httpStatus: 500,
      });
      expect(state.getRealm()).toBe('/bravo');
      expect(request).toHaveBeenCalledTimes(2);
    }
  );
});

test('skips a put without entity data without changing the realm', async () => {
  const state = State({});
  state.setRealm('/bravo');

  await expect(
    putConfigEntity({
      state,
      path: '/realm-config/webhooks',
      version: '1.0',
      realm: '/alpha',
    })
  ).resolves.toBeUndefined();
  expect(state.getRealm()).toBe('/bravo');
  expect(request).not.toHaveBeenCalled();
});
