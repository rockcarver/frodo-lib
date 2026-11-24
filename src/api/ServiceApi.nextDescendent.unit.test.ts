/**
 * Unit tests for the request that deletes one next descendent of a service.
 *
 * Run with:
 *
 *        npm run test:only src/api/ServiceApi.nextDescendent
 *
 * The HTTP layer (`BaseApi`) is replaced by a fake that records every request
 * and answers it from a small in-memory service, so the real api layer and the
 * real ops layer run, and nothing here needs a tenant or a recording.
 */
import { jest } from '@jest/globals';

type Call = { method: string; url: string };

const calls: Call[] = [];
/** the descendents that the fake lists for any service */
let listed: { _id: string; _type: { _id: string } }[] = [];

function generate() {
  const record = (method: string) => async (url: string) => {
    calls.push({ method, url });
    if (method === 'POST') return { data: { result: listed } };
    return { data: { _id: 'deleted' } };
  };
  return {
    get: record('GET'),
    put: record('PUT'),
    post: record('POST'),
    delete: record('DELETE'),
  };
}

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

const { deleteServiceNextDescendent } = await import('./ServiceApi');
const ServiceOps = await import('../ops/ServiceOps');
const { FrodoError } = await import('../ops/FrodoError');
const { default: State } = await import('../shared/State');

const HOST = 'https://openam-matrix.example.com/am';

function newState() {
  const state = State({});
  state.setHost(HOST);
  state.setDeploymentType('cloud');
  state.setRealm('alpha');
  return state;
}

const deletes = () => calls.filter((call) => call.method === 'DELETE');

beforeEach(() => {
  calls.length = 0;
  listed = [];
});

describe('deleteServiceNextDescendent (api layer)', () => {
  test('deletes the global descendent at /json/global-config/services/<service>/<type>/<id>', async () => {
    await deleteServiceNextDescendent({
      serviceId: 'CorsService',
      serviceType: 'CorsConfiguration',
      serviceNextDescendentId: 'cors',
      globalConfig: true,
      state: newState(),
    });

    expect(calls).toEqual([
      {
        method: 'DELETE',
        url: `${HOST}/json/global-config/services/CorsService/CorsConfiguration/cors`,
      },
    ]);
  });

  test('deletes the realm descendent below the realm of the state', async () => {
    await deleteServiceNextDescendent({
      serviceId: 'SocialIdentityProviders',
      serviceType: 'google',
      serviceNextDescendentId: 'google',
      state: newState(),
    });

    expect(calls).toEqual([
      {
        method: 'DELETE',
        url: `${HOST}/json/realms/root/realms/alpha/realm-config/services/SocialIdentityProviders/google/google`,
      },
    ]);
  });

  test.each([
    ['a hash', 'a#b', 'a%23b'],
    ['a question mark', 'a?b', 'a%3Fb'],
    ['a slash', 'a/b', 'a%2Fb'],
    ['a percent sign', 'a%2Fb', 'a%252Fb'],
    ['a space', 'a b', 'a%20b'],
    ['a plain name', 'cors', 'cors'],
  ])(
    'an id with %s is one encoded segment of the path',
    async (_label, id, encoded) => {
      await deleteServiceNextDescendent({
        serviceId: 'CorsService',
        serviceType: 'CorsConfiguration',
        serviceNextDescendentId: id,
        globalConfig: true,
        state: newState(),
      });

      expect(deletes().map((call) => call.url)).toEqual([
        `${HOST}/json/global-config/services/CorsService/CorsConfiguration/${encoded}`,
      ]);
    }
  );

  test('a type with a special character is encoded, too', async () => {
    await deleteServiceNextDescendent({
      serviceId: 'CorsService',
      serviceType: 'Cors/Configuration#1',
      serviceNextDescendentId: 'cors',
      globalConfig: true,
      state: newState(),
    });

    expect(deletes().map((call) => call.url)).toEqual([
      `${HOST}/json/global-config/services/CorsService/Cors%2FConfiguration%231/cors`,
    ]);
  });

  test('a service id with a slash stays a path (federation services are addressed that way)', async () => {
    await deleteServiceNextDescendent({
      serviceId: 'federation/saml2',
      serviceType: 'type',
      serviceNextDescendentId: 'id',
      globalConfig: true,
      state: newState(),
    });

    expect(deletes().map((call) => call.url)).toEqual([
      `${HOST}/json/global-config/services/federation/saml2/type/id`,
    ]);
  });

  test.each([
    ['an empty id', ''],
    ['a blank id', '  '],
    ['a dot', '.'],
    ['two dots', '..'],
  ])('%s throws and sends no request', async (_label, id) => {
    await expect(
      deleteServiceNextDescendent({
        serviceId: 'CorsService',
        serviceType: 'CorsConfiguration',
        serviceNextDescendentId: id,
        globalConfig: true,
        state: newState(),
      })
    ).rejects.toThrow('cannot be used in a request path');
    expect(calls).toEqual([]);
  });

  test.each([
    ['an empty type', ''],
    ['a dot type', '.'],
    ['a type of two dots', '..'],
  ])('%s throws and sends no request', async (_label, type) => {
    await expect(
      deleteServiceNextDescendent({
        serviceId: 'CorsService',
        serviceType: type,
        serviceNextDescendentId: 'cors',
        globalConfig: true,
        state: newState(),
      })
    ).rejects.toThrow('cannot be used in a request path');
    expect(calls).toEqual([]);
  });
});

describe('deleting descendents through the ops layer sends the requests of the listed ids', () => {
  const hostile = [
    { _id: 'a#b', _type: { _id: 'CorsConfiguration' } },
    { _id: 'a?b', _type: { _id: 'CorsConfiguration' } },
    { _id: 'a/b', _type: { _id: 'CorsConfiguration' } },
    { _id: '..', _type: { _id: 'CorsConfiguration' } },
    { _id: '.', _type: { _id: 'CorsConfiguration' } },
    { _id: '', _type: { _id: 'CorsConfiguration' } },
    { _id: 'cors', _type: { _id: 'CorsConfiguration' } },
  ];

  test('deleteServiceNextDescendents encodes what can be encoded and sends nothing for ids that cannot be names', async () => {
    listed = hostile;

    const error = await ServiceOps.deleteServiceNextDescendents({
      serviceId: 'CorsService',
      globalConfig: true,
      state: newState(),
    }).catch((error) => error);

    const base = `${HOST}/json/global-config/services/CorsService/CorsConfiguration`;
    expect(
      deletes()
        .map((call) => call.url)
        .sort()
    ).toEqual(
      [`${base}/a%23b`, `${base}/a%3Fb`, `${base}/a%2Fb`, `${base}/cors`].sort()
    );
    // the three refused ids are named by the error, the others were deleted
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.originalErrors).toHaveLength(3);
    expect(error.message).toContain("descendent '..'");
    expect(error.message).toContain("descendent '.'");
    expect(error.message).toContain("descendent ''");
  });

  test.each(['..', '.', ''])(
    'deleteServiceNextDescendent of a listed id %j sends the list request and no delete',
    async (id) => {
      listed = hostile;

      await expect(
        ServiceOps.deleteServiceNextDescendent({
          serviceId: 'CorsService',
          nextDescendentName: id,
          globalConfig: true,
          state: newState(),
        })
      ).rejects.toBeInstanceOf(FrodoError);

      expect(calls.map((call) => call.method)).toEqual(['POST']);
    }
  );

  test('deleteServiceNextDescendent deletes the listed id of a descendent that needs encoding', async () => {
    listed = hostile;

    await ServiceOps.deleteServiceNextDescendent({
      serviceId: 'CorsService',
      nextDescendentName: 'a/b',
      globalConfig: true,
      state: newState(),
    });

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `POST ${HOST}/json/global-config/services/CorsService?_action=nextdescendents`,
      `DELETE ${HOST}/json/global-config/services/CorsService/CorsConfiguration/a%2Fb`,
    ]);
  });

  test('a name that is not listed sends the list request and no delete', async () => {
    listed = hostile;

    await expect(
      ServiceOps.deleteServiceNextDescendent({
        serviceId: 'CorsService',
        nextDescendentName: 'Cors',
        globalConfig: true,
        state: newState(),
      })
    ).rejects.toBeInstanceOf(FrodoError);

    expect(calls.map((call) => call.method)).toEqual(['POST']);
  });
});
