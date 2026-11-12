/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent AuthenticateOps.perInstanceState
 *
 * A process can hold several instances (the MCP server with several
 * connections, `createInstance` consumers, scripts). What a login learns about
 * a tenant belongs to the instance that learned it: the admin client id of the
 * authorization code flow (lib#1009) and the service account scopes of the
 * tenant, which tell an IGA or PingFed tenant from another one (lib#1008).
 * These tests log two instances in against two fake AMs that answer
 * differently and count what the real login code sends.
 */
import '../index';
import { startFakeAm, type FakeAm } from '../../test/support/fakeAm';
import FrodoLib from '../lib/FrodoLib';
import Constants from '../shared/Constants';
import { createJwkRsa } from './JoseOps';

const IGA = { scope: Constants.AVAILABLE_SCOPES.IGAFullScope };
const PINGFED = { scope: Constants.AVAILABLE_SCOPES.WSFedAdminScope };
const IDM = { scope: 'fr:idm:*' };

const ams: FakeAm[] = [];

async function am(options: Parameters<typeof startFakeAm>[0] = {}) {
  const started = await startFakeAm(options);
  ams.push(started);
  return started;
}

afterEach(async () => {
  await Promise.all(ams.splice(0).map((a) => a.close()));
});

async function serviceAccountInstance(host: string) {
  const frodo = FrodoLib({ host, deploymentType: 'cloud' });
  frodo.state.setUseTokenCache(false);
  frodo.state.setServiceAccountId('sa-1');
  frodo.state.setServiceAccountJwk(await createJwkRsa());
  return frodo;
}

function forgeopsUserInstance(host: string, adminClientId?: string) {
  const frodo = FrodoLib({ host, deploymentType: 'forgeops' });
  frodo.state.setUseTokenCache(false);
  frodo.state.setUsername('someone');
  frodo.state.setPassword('password');
  if (adminClientId) frodo.state.setAdminClientId(adminClientId);
  return frodo;
}

/** Makes the credentials of an instance about to expire, so that its next getTokens() logs in again. */
function expireCredentials(frodo: ReturnType<typeof FrodoLib>) {
  const soon = Date.now() + 1000;
  const { state } = frodo;
  if (state.getUserSessionTokenMeta()) {
    state.setUserSessionTokenMeta({
      ...state.getUserSessionTokenMeta(),
      expires: soon,
    });
  }
  if (state.getBearerTokenMeta()) {
    state.setBearerTokenMeta({ ...state.getBearerTokenMeta(), expires: soon });
  }
}

/** The client ids that the authorization endpoint and the token endpoint received. */
function clientIds(fake: FakeAm, part: string): string[] {
  return fake
    .bodies(part)
    .map((body) => new URLSearchParams(body).get('client_id'));
}

describe('the service account scopes are read for each instance (lib#1008)', () => {
  test('1: two tenants that answer differently: each instance takes the answer of its own tenant', async () => {
    const withIga = await am({ serviceAccountScopes: [IDM, IGA, PINGFED] });
    const plain = await am({ serviceAccountScopes: [IDM] });

    const first = await serviceAccountInstance(withIga.host);
    await first.login.getTokens();
    const second = await serviceAccountInstance(plain.host);
    await second.login.getTokens();

    expect(first.state.getIsIGA()).toBe(true);
    expect(first.state.getIsPingFed()).toBe(true);
    // the plain tenant is not an IGA or PingFed tenant, whatever the first one is
    expect(second.state.getIsIGA()).toBe(false);
    expect(second.state.getIsPingFed()).toBe(false);
    expect(withIga.count('/environment/scopes/service-accounts')).toBe(1);
    expect(plain.count('/environment/scopes/service-accounts')).toBe(1);
  });

  test('2: the same in the other order: a plain tenant first does not make the next one plain', async () => {
    const plain = await am({ serviceAccountScopes: [IDM] });
    const withIga = await am({ serviceAccountScopes: [IDM, IGA, PINGFED] });

    const first = await serviceAccountInstance(plain.host);
    await first.login.getTokens();
    const second = await serviceAccountInstance(withIga.host);
    await second.login.getTokens();

    expect(first.state.getIsIGA()).toBe(false);
    expect(second.state.getIsIGA()).toBe(true);
    expect(second.state.getIsPingFed()).toBe(true);
  });

  test('3: one instance reads the catalog once, however often it logs in again', async () => {
    const withIga = await am({ serviceAccountScopes: [IDM, IGA] });
    const frodo = await serviceAccountInstance(withIga.host);

    await frodo.login.getTokens();
    // a new login on the same instance that has to find out again whether it is an IGA tenant
    expireCredentials(frodo);
    frodo.state.setIsIGA(undefined);
    frodo.state.setIsPingFed(undefined);
    await frodo.login.getTokens();

    expect(withIga.accessTokens()).toBe(2);
    expect(frodo.state.getIsIGA()).toBe(true);
    expect(withIga.count('/environment/scopes/service-accounts')).toBe(1);
  });

  test('4: an instance that is pointed at another host reads the catalog of that host', async () => {
    const withIga = await am({ serviceAccountScopes: [IDM, IGA] });
    const plain = await am({ serviceAccountScopes: [IDM] });

    const frodo = await serviceAccountInstance(withIga.host);
    await frodo.login.getTokens();
    expect(frodo.state.getIsIGA()).toBe(true);

    frodo.state.setHost(plain.host);
    expireCredentials(frodo);
    frodo.state.setIsIGA(undefined);
    frodo.state.setIsPingFed(undefined);
    await frodo.login.getTokens();

    expect(plain.accessTokens()).toBe(1);
    expect(frodo.state.getIsIGA()).toBe(false);
    expect(plain.count('/environment/scopes/service-accounts')).toBe(1);
  });
});

describe('the admin client id is kept for each instance (lib#1009)', () => {
  test('5: an instance with its own admin client id and one without: each flow sends its own', async () => {
    const custom = await am({ authorizationCode: 'code-custom' });
    const standard = await am({ authorizationCode: 'code-standard' });

    const first = forgeopsUserInstance(custom.host, 'my-admin-client');
    await first.login.getTokens();
    const second = forgeopsUserInstance(standard.host);
    await second.login.getTokens();

    expect(clientIds(custom, '/authorize')).toEqual(['my-admin-client']);
    expect(clientIds(custom, '/access_token')).toEqual(['my-admin-client']);
    // the default of the ForgeOps deployment type, not the client id of the instance that logged in before
    expect(clientIds(standard, '/authorize')).toEqual(['idm-admin-ui']);
    expect(clientIds(standard, '/access_token')).toEqual(['idm-admin-ui']);
  });

  test('6: the same in the other order: an instance without its own client id does not lend it to the next one', async () => {
    const standard = await am({ authorizationCode: 'code-standard' });
    const custom = await am({ authorizationCode: 'code-custom' });

    const first = forgeopsUserInstance(standard.host);
    await first.login.getTokens();
    const second = forgeopsUserInstance(custom.host, 'my-admin-client');
    await second.login.getTokens();

    expect(clientIds(standard, '/authorize')).toEqual(['idm-admin-ui']);
    expect(clientIds(custom, '/authorize')).toEqual(['my-admin-client']);
  });

  test('7: two instances that log in at the same moment keep their own client ids', async () => {
    const one = await am({ authorizationCode: 'code-one' });
    const two = await am({ authorizationCode: 'code-two' });

    await Promise.all([
      forgeopsUserInstance(one.host, 'client-one').login.getTokens(),
      forgeopsUserInstance(two.host, 'client-two').login.getTokens(),
    ]);

    expect(clientIds(one, '/authorize')).toEqual(['client-one']);
    expect(clientIds(two, '/authorize')).toEqual(['client-two']);
  });

  test('7b: a tenant that is detected as cloud uses the cloud default, not the client id an earlier ForgeOps instance used', async () => {
    const earlier = await am({ authorizationCode: 'code-earlier' });
    const detected = await am({ authorizationCode: 'code-detected' });

    await forgeopsUserInstance(earlier.host).login.getTokens();
    // no deployment type given: the instance finds out that this is a cloud tenant, which sets no client id
    const frodo = FrodoLib({ host: detected.host });
    frodo.state.setUseTokenCache(false);
    frodo.state.setUsername('someone');
    frodo.state.setPassword('password');
    await frodo.login.getTokens();

    expect(frodo.state.getDeploymentType()).toBe('cloud');
    // the detection probe and the authorization code flow
    expect(clientIds(detected, '/authorize')).toEqual([
      'idmAdminClient',
      'idmAdminClient',
    ]);
  });

  test('8: a single instance behaves as before: its client id is used by every login it makes', async () => {
    const single = await am({ authorizationCode: 'code-single' });
    const frodo = forgeopsUserInstance(single.host, 'my-admin-client');

    await frodo.login.getTokens();
    expireCredentials(frodo);
    await frodo.login.getTokens();

    expect(single.logins()).toBe(2);
    expect(clientIds(single, '/authorize')).toEqual([
      'my-admin-client',
      'my-admin-client',
    ]);
  });
});
