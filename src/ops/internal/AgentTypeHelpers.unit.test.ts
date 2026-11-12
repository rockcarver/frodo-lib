import { jest } from '@jest/globals';
import { FrodoError } from '../FrodoError';

const getAgentTypes = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));

jest.unstable_mockModule('../../api/AgentApi', () => ({
  deleteAgentByTypeAndId: jest.fn(),
  findAgentByTypeAndId: jest.fn(),
  getAgentByTypeAndId: jest.fn(),
  getAgentGroups: jest.fn(),
  getAgents: jest.fn(),
  getAgentsByType: jest.fn(),
  putAgentByTypeAndId: jest.fn(),
  putAgentGroupByTypeAndId: jest.fn(),
  getAgentTypes,
}));

const { isAgentTypeOffered, readAgentTypeItems } =
  await import('./AgentTypeHelpers');
const { default: AgentOps, readAgentTypes } = await import('../AgentOps');

const CLOUD_ONLY_MESSAGE =
  'This operation is not available in PingOne Advanced Identity Cloud.';

// The type list is cached per host, realm and deployment type for the life of
// the process. Every test uses a host of its own so that no test sees the list
// of another one.
let hostCounter = 0;
function uniqueHost() {
  hostCounter += 1;
  return `https://openam-matrix-${hostCounter}.example.com/am`;
}

function mockState({
  realm = 'alpha',
  host = uniqueHost(),
  deployment = 'cloud',
} = {}) {
  return {
    getRealm: () => realm,
    getHost: () => host,
    getDebugHandler: () => undefined,
    getDeploymentType: () => deployment,
    getAuthMode: () => 'noninteractive',
    getUseBearerTokenForAmApis: () => false,
  } as any;
}

function errorWithStatus(status: number, message?: string) {
  const error: any = new Error(`HTTP ${status}`);
  error.response = { status, data: message ? { message } : undefined };
  return error;
}

function typeItem(id: string, name = `${id} Agents`) {
  return { _id: id, name, collection: true };
}

// What a Cloud alpha realm answers when it offers CIMD profiles (shape of the
// recorded answer; names are the server's).
const typesWithCIMD = () => [
  typeItem('2.2_Agent'),
  typeItem('IdentityGatewayAgent'),
  typeItem('OAuth2Client', 'OAuth2 Clients'),
  typeItem('CIMDProfile', 'CIMD Profile Agents'),
  typeItem('TrustedJwtIssuer', 'OAuth2 Trusted JWT Issuer Agents'),
  typeItem('WebAgent'),
];

// The same realm before the feature existed: the type is simply absent.
const typesWithoutCIMD = () =>
  typesWithCIMD().filter((item) => item._id !== 'CIMDProfile');

beforeEach(() => {
  getAgentTypes.mockReset();
  getAgentTypes.mockResolvedValue({ result: typesWithCIMD() });
});

describe('isAgentTypeOffered', () => {
  test('Cloud alpha realm that lists the type: true', async () => {
    const state = mockState({ realm: 'alpha', deployment: 'cloud' });
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state })
    ).resolves.toBe(true);
    expect(getAgentTypes).toHaveBeenCalledTimes(1);
  });

  test('Cloud alpha realm without the type: false, no error', async () => {
    getAgentTypes.mockResolvedValue({ result: typesWithoutCIMD() });
    const state = mockState({ realm: 'alpha', deployment: 'cloud' });
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state })
    ).resolves.toBe(false);
    await expect(
      isAgentTypeOffered({ agentType: 'WebAgent', state })
    ).resolves.toBe(true);
  });

  test('Cloud root realm (403 with the Cloud message): no types, false', async () => {
    getAgentTypes.mockRejectedValue(errorWithStatus(403, CLOUD_ONLY_MESSAGE));
    const state = mockState({ realm: '/', deployment: 'cloud' });
    await expect(readAgentTypeItems({ state })).resolves.toEqual([]);
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state })
    ).resolves.toBe(false);
  });

  test('a 403 with another message is an error, not "no types"', async () => {
    getAgentTypes.mockRejectedValue(errorWithStatus(403, 'Forbidden'));
    const state = mockState({ realm: '/', deployment: 'cloud' });
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state })
    ).rejects.toBeInstanceOf(FrodoError);
  });

  test.each(['cloud', 'classic', 'forgeops'])(
    'a 404 (%s): no types, false',
    async (deployment) => {
      getAgentTypes.mockRejectedValue(errorWithStatus(404));
      const state = mockState({ realm: '/', deployment });
      await expect(readAgentTypeItems({ state })).resolves.toEqual([]);
      await expect(
        isAgentTypeOffered({ agentType: 'CIMDProfile', state })
      ).resolves.toBe(false);
    }
  );

  test('a 500 is a FrodoError that names the realm and keeps the cause', async () => {
    const failure = errorWithStatus(500);
    getAgentTypes.mockRejectedValue(failure);
    const state = mockState({ realm: 'alpha', deployment: 'cloud' });
    const error: FrodoError = await isAgentTypeOffered({
      agentType: 'CIMDProfile',
      state,
    }).then(
      () => {
        throw new Error('expected a rejection');
      },
      (e) => e
    );
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toContain('Error reading alpha realm agent types');
    expect(error.originalErrors[0]).toBe(failure);
  });

  test('classic realm / without the type: false', async () => {
    getAgentTypes.mockResolvedValue({ result: typesWithoutCIMD() });
    const state = mockState({ realm: '/', deployment: 'classic' });
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state })
    ).resolves.toBe(false);
  });

  test('ForgeOps realm / with the type: true', async () => {
    const state = mockState({ realm: '/', deployment: 'forgeops' });
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state })
    ).resolves.toBe(true);
  });

  test('finds a type that no code mentions', async () => {
    getAgentTypes.mockResolvedValue({
      result: [typeItem('SomeFutureAgent')],
    });
    const state = mockState();
    await expect(
      isAgentTypeOffered({ agentType: 'SomeFutureAgent' as any, state })
    ).resolves.toBe(true);
    await expect(
      isAgentTypeOffered({ agentType: 'WebAgent', state })
    ).resolves.toBe(false);
  });
});

describe('unfiltered type list', () => {
  test('a blacklisted type is offered but not returned by readAgentTypes, from one request', async () => {
    const state = mockState();
    await expect(
      isAgentTypeOffered({ agentType: 'OAuth2Client', state })
    ).resolves.toBe(true);
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state })
    ).resolves.toBe(true);
    await expect(
      isAgentTypeOffered({ agentType: 'TrustedJwtIssuer', state })
    ).resolves.toBe(true);
    const types = await readAgentTypes({ state });
    expect(types).not.toContain('OAuth2Client');
    expect(types).not.toContain('CIMDProfile');
    expect(types).not.toContain('TrustedJwtIssuer');
    expect(types).toEqual(expect.arrayContaining(['WebAgent']));
    expect(getAgentTypes).toHaveBeenCalledTimes(1);
  });

  test('readAgentTypes reads blacklisted types from a cache that holds them', async () => {
    const state = mockState();
    // The generic reader first, the question about the blacklisted type after.
    await readAgentTypes({ state });
    await expect(
      isAgentTypeOffered({ agentType: 'OAuth2Client', state })
    ).resolves.toBe(true);
    expect(getAgentTypes).toHaveBeenCalledTimes(1);
  });

  test('the Soap STS agent is left out of a read outside classic deployments only, whichever facades exist', async () => {
    getAgentTypes.mockResolvedValue({
      result: [typeItem('WebAgent'), typeItem('SoapSTSAgent')],
    });
    const host = uniqueHost();
    const cloud = mockState({ host, deployment: 'cloud' });
    const classic = mockState({ host, deployment: 'classic' });
    // creating the facade of a state changes the reads of no other state
    AgentOps(cloud);
    await expect(readAgentTypes({ state: classic })).resolves.toEqual([
      'WebAgent',
      'SoapSTSAgent',
    ]);
    await expect(readAgentTypes({ state: cloud })).resolves.toEqual([
      'WebAgent',
    ]);
    AgentOps(classic);
    await expect(readAgentTypes({ state: classic })).resolves.toEqual([
      'WebAgent',
      'SoapSTSAgent',
    ]);
    // The helper has the type for both.
    for (const state of [cloud, classic]) {
      await expect(
        isAgentTypeOffered({ agentType: 'SoapSTSAgent', state })
      ).resolves.toBe(true);
    }
  });
});

describe('type list cache', () => {
  test('an empty answer is not cached: the next call asks again', async () => {
    const state = mockState();
    getAgentTypes.mockResolvedValue({ result: [] });
    await expect(readAgentTypeItems({ state })).resolves.toEqual([]);
    await expect(readAgentTypeItems({ state })).resolves.toEqual([]);
    expect(getAgentTypes).toHaveBeenCalledTimes(2);

    getAgentTypes.mockResolvedValue({ result: typesWithCIMD() });
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state })
    ).resolves.toBe(true);
    expect(getAgentTypes).toHaveBeenCalledTimes(3);
  });

  test('a denied answer (403, 404) is not cached either', async () => {
    const state = mockState({ realm: '/' });
    getAgentTypes.mockRejectedValue(errorWithStatus(404));
    await expect(readAgentTypeItems({ state })).resolves.toEqual([]);
    getAgentTypes.mockResolvedValue({ result: typesWithCIMD() });
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state })
    ).resolves.toBe(true);
  });

  test('a list is requested once per host, realm and deployment type', async () => {
    const state = mockState();
    await readAgentTypeItems({ state });
    await readAgentTypeItems({ state });
    await isAgentTypeOffered({ agentType: 'WebAgent', state });
    await isAgentTypeOffered({ agentType: 'CIMDProfile', state });
    expect(getAgentTypes).toHaveBeenCalledTimes(1);
  });

  test('two realms of one host do not share a list', async () => {
    const host = uniqueHost();
    const alpha = mockState({ host, realm: 'alpha' });
    const bravo = mockState({ host, realm: 'bravo' });
    getAgentTypes.mockResolvedValue({ result: typesWithCIMD() });
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state: alpha })
    ).resolves.toBe(true);
    getAgentTypes.mockResolvedValue({ result: typesWithoutCIMD() });
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state: bravo })
    ).resolves.toBe(false);
    expect(getAgentTypes).toHaveBeenCalledTimes(2);
    // Each realm keeps its own answer.
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state: alpha })
    ).resolves.toBe(true);
    expect(getAgentTypes).toHaveBeenCalledTimes(2);
  });

  test('two hosts do not share a list', async () => {
    getAgentTypes.mockResolvedValue({ result: typesWithCIMD() });
    const first = mockState({ host: uniqueHost() });
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state: first })
    ).resolves.toBe(true);
    getAgentTypes.mockResolvedValue({ result: typesWithoutCIMD() });
    const second = mockState({ host: uniqueHost() });
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state: second })
    ).resolves.toBe(false);
    expect(getAgentTypes).toHaveBeenCalledTimes(2);
  });

  test('two deployment types of one host and realm do not share a list', async () => {
    const host = uniqueHost();
    getAgentTypes.mockResolvedValue({ result: typesWithCIMD() });
    await expect(
      isAgentTypeOffered({
        agentType: 'CIMDProfile',
        state: mockState({ host, realm: '/', deployment: 'forgeops' }),
      })
    ).resolves.toBe(true);
    getAgentTypes.mockResolvedValue({ result: typesWithoutCIMD() });
    await expect(
      isAgentTypeOffered({
        agentType: 'CIMDProfile',
        state: mockState({ host, realm: '/', deployment: 'classic' }),
      })
    ).resolves.toBe(false);
  });

  test('refreshCache asks again and replaces the entry', async () => {
    const state = mockState();
    getAgentTypes.mockResolvedValue({ result: typesWithoutCIMD() });
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state })
    ).resolves.toBe(false);

    getAgentTypes.mockResolvedValue({ result: typesWithCIMD() });
    // Without a refresh the old list is used.
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state })
    ).resolves.toBe(false);
    expect(getAgentTypes).toHaveBeenCalledTimes(1);

    await expect(
      isAgentTypeOffered({
        agentType: 'CIMDProfile',
        refreshCache: true,
        state,
      })
    ).resolves.toBe(true);
    expect(getAgentTypes).toHaveBeenCalledTimes(2);
    // The refreshed list is the cached one from now on.
    await expect(
      isAgentTypeOffered({ agentType: 'CIMDProfile', state })
    ).resolves.toBe(true);
    expect(getAgentTypes).toHaveBeenCalledTimes(2);
  });

  test('the facade readAgentTypes(true) refreshes the cached list', async () => {
    const state = mockState();
    getAgentTypes.mockResolvedValue({ result: [typeItem('WebAgent')] });
    const agent = AgentOps(state);
    await expect(agent.readAgentTypes()).resolves.toEqual(['WebAgent']);

    getAgentTypes.mockResolvedValue({
      result: [typeItem('WebAgent'), typeItem('J2EEAgent')],
    });
    await expect(agent.readAgentTypes()).resolves.toEqual(['WebAgent']);
    await expect(agent.readAgentTypes(true)).resolves.toEqual([
      'WebAgent',
      'J2EEAgent',
    ]);
    expect(getAgentTypes).toHaveBeenCalledTimes(2);
  });

  test('the caller gets a copy: changing it does not change the cache', async () => {
    const state = mockState();
    // The answer of the request ...
    const fresh = await readAgentTypeItems({ state });
    const expected = JSON.parse(JSON.stringify(fresh));
    fresh.pop();
    fresh[0].name = 'changed by the caller';

    // ... and the answer from the cache.
    const cached = await readAgentTypeItems({ state });
    expect(cached).toEqual(expected);
    cached.pop();
    cached[0].name = 'changed by the caller';

    await expect(readAgentTypeItems({ state })).resolves.toEqual(expected);
    expect(getAgentTypes).toHaveBeenCalledTimes(1);
  });
});
