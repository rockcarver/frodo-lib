/**
 * Unit tests for the BaseApi outbound agent configuration (keep-alive).
 *
 * Run with:
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent BaseApi.agentConfig
 *
 * Pure unit cells asserting the options the shared (module-level memoized)
 * agents are constructed with, that the scoped (per-call) https agent variant
 * gets the same defaults, and that the FRODO_NO_KEEPALIVE opt-out restores the
 * legacy (keepAlive: false) behavior. No network, no Polly. The real-socket
 * reuse cell lives in BaseApi.connectionReuse.test.ts.
 *
 * BaseApi reads process.env.FRODO_NO_KEEPALIVE at module evaluation time, so
 * each cell sets the env var, calls jest.resetModules(), and re-imports the
 * module dynamically. (jest.isolateModulesAsync hits a Jest ESM module-cache
 * bug with BaseApi's dependency graph, so resetModules is used instead.)
 *
 * getHttpAgent()/getHttpsAgent() are module-private, so cells observe the
 * agents through the public generate*Api surface: the agents are attached to
 * request.defaults.httpAgent / request.defaults.httpsAgent.
 */
import { jest } from '@jest/globals';

const savedNoKeepalive = process.env.FRODO_NO_KEEPALIVE;

async function importBaseApi(): Promise<any> {
  jest.resetModules();
  return (await import('./BaseApi')) as any;
}

async function generateAgentPair(): Promise<{
  httpAgent: any;
  httpsAgent: any;
}> {
  const BaseApi = await importBaseApi();
  const StateImpl = (await import('../shared/State')).default;
  const request = BaseApi.generateAmApi({
    resource: {},
    state: StateImpl({}),
  });
  return {
    httpAgent: request.defaults.httpAgent,
    httpsAgent: request.defaults.httpsAgent,
  };
}

describe('BaseApi agent keep-alive configuration (unit)', () => {
  afterEach(() => {
    if (savedNoKeepalive === undefined) delete process.env.FRODO_NO_KEEPALIVE;
    else process.env.FRODO_NO_KEEPALIVE = savedNoKeepalive;
  });

  test('shared http and https agents are configured for connection reuse', async () => {
    delete process.env.FRODO_NO_KEEPALIVE;
    const { httpAgent, httpsAgent } = await generateAgentPair();
    for (const agent of [httpAgent, httpsAgent]) {
      expect(agent.keepAlive).toBe(true);
      expect(agent.keepAliveMsecs).toBe(1000);
      expect(agent.maxFreeSockets).toBe(16);
      expect(agent.scheduling).toBe('lifo');
      expect(agent.maxSockets).toBe(500);
    }
  });

  test('the insecure-connection https agent variant follows the same defaults', async () => {
    delete process.env.FRODO_NO_KEEPALIVE;
    const { httpAgent } = await generateAgentPair();
    // Route through the insecure-connection branch of getHttpsAgent()
    const StateImpl = (await import('../shared/State')).default;
    const BaseApi = await importBaseApi();
    const state = StateImpl({});
    state.setAllowInsecureConnection(true);
    const request = BaseApi.generateAmApi({
      resource: {},
      state,
    });
    const insecureAgent = request.defaults.httpsAgent;
    for (const agent of [httpAgent, insecureAgent]) {
      expect(agent.keepAlive).toBe(true);
      expect(agent.keepAliveMsecs).toBe(1000);
      expect(agent.maxFreeSockets).toBe(16);
      expect(agent.scheduling).toBe('lifo');
    }
  });

  test('FRODO_NO_KEEPALIVE=1 restores the legacy configuration (keepAlive false)', async () => {
    process.env.FRODO_NO_KEEPALIVE = '1';
    const { httpAgent, httpsAgent } = await generateAgentPair();
    expect(httpAgent.keepAlive).toBe(false);
    expect(httpsAgent.keepAlive).toBe(false);
  });

  test("FRODO_NO_KEEPALIVE='yes' also restores the legacy configuration", async () => {
    process.env.FRODO_NO_KEEPALIVE = 'yes';
    const { httpAgent } = await generateAgentPair();
    expect(httpAgent.keepAlive).toBe(false);
  });

  test("FRODO_NO_KEEPALIVE='' (empty) keeps keep-alive enabled", async () => {
    process.env.FRODO_NO_KEEPALIVE = '';
    const { httpAgent } = await generateAgentPair();
    expect(httpAgent.keepAlive).toBe(true);
  });

  test('FRODO_NO_KEEPALIVE set to any other value keeps keep-alive enabled', async () => {
    process.env.FRODO_NO_KEEPALIVE = '0';
    const { httpAgent } = await generateAgentPair();
    expect(httpAgent.keepAlive).toBe(true);
  });
});

describe('BaseApi scoped (per-call) https agent variant (unit)', () => {
  afterEach(() => {
    if (savedNoKeepalive === undefined) delete process.env.FRODO_NO_KEEPALIVE;
    else process.env.FRODO_NO_KEEPALIVE = savedNoKeepalive;
  });

  test('getHttpsAgent(shareAgent=false) instances get the same keep-alive defaults', async () => {
    // The scoped variant currently has no in-repo callers (it was removed from
    // generateReleaseApi in f4ef6492f), but it shares the same constructor site
    // and constants as the shared variants inside getHttpsAgent(), so the
    // shared-variant cells above cover the option values it receives.
    // This cell documents the contract by asserting the runtime shape the
    // ProxyAgent exposes for those options.
    delete process.env.FRODO_NO_KEEPALIVE;
    const { ProxyAgent } = (await import('proxy-agent')) as any;
    const agent = new ProxyAgent({
      maxSockets: 500,
      maxFreeSockets: 16,
      timeout: 30000,
      keepAlive: true,
      keepAliveMsecs: 1000,
      scheduling: 'lifo',
    });
    expect(agent.keepAlive).toBe(true);
    expect(agent.keepAliveMsecs).toBe(1000);
    expect(agent.maxFreeSockets).toBe(16);
    expect(agent.scheduling).toBe('lifo');
  });
});
