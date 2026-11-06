/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent AuthenticateOps.stateSnapshot
 *
 * `state.getState()` is a snapshot that a caller copies or serialises, for
 * example the request context of an MCP server that builds an instance from it
 * (frodo-lib#910). A login sets runtime objects on the state, the auto-refresh
 * timer among them, and the snapshot must stay plain data after it. These tests
 * log in to a fake AM that runs in the test process.
 */
import '../index';
import { startFakeAm, type FakeAm } from '../../test/support/fakeAm';
import FrodoLib from '../lib/FrodoLib';
import { createJwkRsa } from './JoseOps';

let am: FakeAm;
const timers: NodeJS.Timeout[] = [];

beforeEach(async () => {
  am = await startFakeAm();
});

afterEach(async () => {
  for (const timer of timers.splice(0)) clearTimeout(timer);
  await am.close();
});

function track(frodo: ReturnType<typeof FrodoLib>) {
  const timer = frodo.state.getAutoRefreshTimer();
  if (timer) timers.push(timer);
  return timer;
}

describe('state.getState() after a login', () => {
  test('1: a user session: the snapshot serialises and the refresh timer keeps running', async () => {
    const frodo = FrodoLib({ host: am.host, deploymentType: 'classic' });
    frodo.state.setUseTokenCache(false);
    frodo.state.setUsername('someone');
    frodo.state.setPassword('password');
    await frodo.login.getTokens();
    const timer = track(frodo);
    expect(timer).toBeDefined();

    const snapshot = frodo.state.getState();

    expect(() => JSON.stringify(snapshot)).not.toThrow();
    expect(snapshot.autoRefreshTimer).toBeUndefined();
    expect(JSON.parse(JSON.stringify(snapshot)).host).toBe(am.host);
    // taking the snapshot leaves the live timer alone
    expect(frodo.state.getAutoRefreshTimer()).toBe(timer);
  });

  test('2: a service account: the snapshot serialises and the refresh timer keeps running', async () => {
    const frodo = FrodoLib({ host: am.host, deploymentType: 'cloud' });
    frodo.state.setUseTokenCache(false);
    frodo.state.setServiceAccountId('sa-1');
    frodo.state.setServiceAccountJwk(await createJwkRsa());
    await frodo.login.getTokens();
    const timer = track(frodo);
    expect(timer).toBeDefined();

    const snapshot = frodo.state.getState();

    expect(() => JSON.stringify(snapshot)).not.toThrow();
    expect(snapshot.autoRefreshTimer).toBeUndefined();
    expect(frodo.state.getAutoRefreshTimer()).toBe(timer);
  });

  test('3: an instance built from the snapshot, as an MCP request context does, logs in on its own', async () => {
    const frodo = FrodoLib({ host: am.host, deploymentType: 'classic' });
    frodo.state.setUseTokenCache(false);
    frodo.state.setUsername('someone');
    frodo.state.setPassword('password');
    await frodo.login.getTokens();
    track(frodo);
    expect(am.logins()).toBe(1);

    const scoped = FrodoLib({ ...frodo.state.getState(), realm: 'alpha' });
    await scoped.login.getTokens();
    track(scoped);

    expect(am.logins()).toBe(2);
    // it has a timer of its own, not the one of the instance it was built from
    expect(scoped.state.getAutoRefreshTimer()).toBeDefined();
    expect(scoped.state.getAutoRefreshTimer()).not.toBe(
      frodo.state.getAutoRefreshTimer()
    );
  });
});
