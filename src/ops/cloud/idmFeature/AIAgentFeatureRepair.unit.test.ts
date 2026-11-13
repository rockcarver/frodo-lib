/**
 * Unit tests for the plan and the repair of the IDM feature `aiagent`.
 *
 * Run with:
 *
 *        npm run test:only AIAgentFeatureRepair.unit
 *
 * Origin: frodo-lib#1060. The tests run against a fake platform (see `AIAgentFeature.fixtures.ts`) that behaves like the
 * tenants where the feature broke: its registry is derived from the definitions, its enable action installs the feature
 * internally (adding drifted definitions a second time), writes the provider of every realm and answers 500 if one is
 * unusable, and AM accepts AI agents only some reads later. No tenant is needed.
 */
import { AxiosError } from 'axios';
import {
  clone,
  FakeRepairState,
  fakeRepairTenant,
  healthyRepairState,
} from './AIAgentFeature.fixtures';
import { applyDifferences } from './AIAgentFeatureDefinitions';
import { AI_AGENT_FEATURE_REFERENCE } from './AIAgentFeatureReference';
import {
  DEFAULT_GATE_TIMEOUT,
  GATE_POLL_INTERVAL,
  planAIAgentFeatureRepair,
  repairAIAgentFeature,
} from './AIAgentFeatureRepair';
import { ESV_SECRET_STORE_TYPE } from './AIAgentFeatureTenant';
import { IdmFeatureRepairPlan } from './IdmFeatureTypes';

const objectOf = (managed: any, name: string) =>
  managed.objects.find((object: any) => object.name === name);
const ids = (plan: IdmFeatureRepairPlan) => plan.steps.map((step) => step.id);
const outcome = (result: { results: any[] }) =>
  result.results.map(
    (r) => `${r.step.id}${r.step.realm ? ':' + r.step.realm : ''}=${r.status}`
  );

function httpError(status: number): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_RESPONSE',
    {} as never,
    undefined,
    {
      status,
      statusText: '',
      headers: {},
      config: {} as never,
      data: { code: status },
    }
  );
}

function fakeClock() {
  let time = 0;
  const sleeps: number[] = [];
  return {
    sleeps,
    clock: {
      now: () => time,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        time += ms;
      },
    },
  };
}

/** The tenant as it was when the feature broke: drifted definitions, both gates closed, a provider without the authentication service, a realm without a provider. */
function brokenState(): FakeRepairState {
  const state = healthyRepairState();
  state.feature.installedVersion = null;
  objectOf(state.managed, 'alpha_aiagent').onDelete.source += '\n';
  objectOf(state.managed, 'bravo_aiagent').onDelete.source += '\n';
  for (const realm of ['alpha', 'bravo']) {
    state.gates[realm] = {
      typeListed: false,
      listStatus: 501,
      agentCount: null,
    };
  }
  const alpha = state.providers.alpha as any;
  delete alpha.advancedOAuth2Config.passwordGrantAuthService;
  alpha.aiAgentsConfig.aiAgentsEnabled = false;
  state.providers.bravo = undefined;
  state.idmObjectsByType.alpha_aiagent = [{ _id: 'a1', name: 'agent one' }];
  return state;
}

/** Two mappings that point to no ESV secret, and IDM agents that AM does not list. */
function withDanglingMappings(state: FakeRepairState) {
  state.secretStores.alpha = [
    {
      storeId: 'ESV',
      storeTypeId: ESV_SECRET_STORE_TYPE,
      mappings: [
        { secretId: 'am.test.one', aliases: ['test'] },
        { secretId: 'am.test.two', aliases: ['esv-missing'] },
        { secretId: 'am.keep', aliases: ['esv-one'] },
      ],
    },
  ];
  state.gates.alpha = { typeListed: true, listStatus: 200, agentCount: 0 };
  state.idmAgents.alpha = 4;
}

describe('planIdmFeatureRepair', () => {
  test('a healthy tenant has nothing to repair and nothing is read for a backup', async () => {
    const { tenant, writes, calls } = fakeRepairTenant(healthyRepairState());
    const plan = await planAIAgentFeatureRepair(tenant);
    expect(plan).toMatchObject({ repairable: true, blockers: [], steps: [] });
    expect(plan.backup.managed).toBeNull();
    expect(writes).toEqual([]);
    expect(calls.some((call) => call.startsWith('readIdmObjects'))).toBe(false);
  });

  test('drifted definitions while AI agents work are a warning: nothing to repair', async () => {
    const state = healthyRepairState();
    state.feature.installedVersion = null;
    objectOf(state.managed, 'alpha_aiagent').schema.title = 'AI Agent';
    const { tenant } = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(tenant);
    expect(plan).toMatchObject({ repairable: true, steps: [] });
    expect(plan.diagnosis.findings.map((f) => f.id)).toContain(
      'definitions-cosmetic-drift'
    );
  });

  test('a broken tenant: the steps are itemised in the order they are safe', async () => {
    const state = brokenState();
    withDanglingMappings(state);
    state.gates.bravo = {
      typeListed: false,
      listStatus: 501,
      agentCount: null,
    };
    const { tenant, writes } = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(tenant);
    expect(plan.repairable).toBe(true);
    expect(ids(plan)).toEqual([
      'delete-secret-mapping',
      'delete-secret-mapping',
      'create-provider',
      'set-auth-service',
      'align-definitions',
      'enable',
      'wait-for-gate',
      'restore-definitions',
      'diagnose',
    ]);
    expect(
      plan.steps
        .filter((s) => s.id === 'delete-secret-mapping')
        .map((s) => s.details.secretId)
    ).toEqual(['am.test.one', 'am.test.two']);
    expect(plan.steps.find((s) => s.id === 'create-provider')).toMatchObject({
      realm: 'bravo',
      details: { authService: 'Login' },
    });
    expect(plan.steps.find((s) => s.id === 'set-auth-service')).toMatchObject({
      realm: 'alpha',
    });
    const align = plan.steps.find((s) => s.id === 'align-definitions')!;
    expect((align.details.differences as any[]).map((d) => d.object)).toEqual([
      'alpha_aiagent',
      'bravo_aiagent',
    ]);
    expect(plan.steps.every((s) => s.description.length > 0)).toBe(true);
    expect(plan.steps.filter((s) => s.writes).map((s) => s.id)).not.toContain(
      'wait-for-gate'
    );
    expect(writes).toEqual([]);
  });

  test('the backup holds what the steps overwrite or delete, and is taken before any write', async () => {
    const state = brokenState();
    withDanglingMappings(state);
    state.idmObjectsByType.alpha_aiagentprivilege = [{ _id: 'p1' }];
    const { tenant, writes } = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(tenant);
    expect(writes).toEqual([]);
    expect(plan.backup.managed).toEqual(state.managed);
    expect(plan.backup.repoDs).toEqual(state.repoDs);
    expect(plan.backup.feature).toMatchObject({
      _id: 'aiagent',
      installedVersion: null,
    });
    expect(Object.keys(plan.backup.providers).sort()).toEqual([
      'alpha',
      'bravo',
    ]);
    expect(plan.backup.providers.bravo).toBeNull();
    expect(plan.backup.idmObjects.alpha_aiagent).toEqual([
      { _id: 'a1', name: 'agent one' },
    ]);
    expect(plan.backup.idmObjects.alpha_aiagentprivilege).toEqual([
      { _id: 'p1' },
    ]);
    expect(plan.backup.secretStoreMappings.map((m) => m.secretId)).toEqual([
      'am.test.one',
      'am.test.two',
    ]);
    // the backup is a copy: a later change of the tenant does not change it
    objectOf(state.managed, 'alpha_aiagent').name = 'changed';
    expect(objectOf(plan.backup.managed, 'alpha_aiagent')).toBeDefined();
  });

  test('a plan is plain data: it survives JSON', async () => {
    const { tenant } = fakeRepairTenant(brokenState());
    const plan = await planAIAgentFeatureRepair(tenant);
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  });

  test('keepAligned leaves out the step that puts the definitions back', async () => {
    const { tenant } = fakeRepairTenant(brokenState());
    const plan = await planAIAgentFeatureRepair(tenant, { keepAligned: true });
    expect(plan.options.keepAligned).toBe(true);
    expect(ids(plan)).toContain('align-definitions');
    expect(ids(plan)).not.toContain('restore-definitions');
  });

  test('an installed registry needs no alignment before the enable action', async () => {
    const state = healthyRepairState();
    state.gates.alpha = {
      typeListed: false,
      listStatus: 501,
      agentCount: null,
    };
    state.gates.bravo = {
      typeListed: false,
      listStatus: 501,
      agentCount: null,
    };
    const { tenant } = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(tenant);
    expect(ids(plan)).toEqual(['enable', 'wait-for-gate', 'diagnose']);
  });

  test('only a dangling-mapping symptom: the mappings go, no enable action', async () => {
    const state = healthyRepairState();
    withDanglingMappings(state);
    const { tenant } = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(tenant);
    expect(ids(plan)).toEqual([
      'delete-secret-mapping',
      'delete-secret-mapping',
      'diagnose',
    ]);
  });

  test('the authentication service is Login unless the caller names another that exists', async () => {
    const state = brokenState();
    state.authServices = {
      alpha: ['Login', 'MyLogin'],
      bravo: ['Login', 'MyLogin'],
    };
    const { tenant } = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(tenant, {
      authService: 'MyLogin',
    });
    expect(plan.options.authService).toBe('MyLogin');
    expect(
      plan.steps.find((s) => s.id === 'create-provider')!.details.authService
    ).toBe('MyLogin');
  });

  test('an authentication service the realm lacks blocks the plan', async () => {
    const state = brokenState();
    state.authServices = { alpha: ['Login'], bravo: [] };
    const { tenant } = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(tenant);
    expect(plan).toMatchObject({ repairable: false, steps: [] });
    expect(plan.blockers.map((b) => b.id)).toEqual([
      'authentication-service-missing',
    ]);
    expect(plan.blockers[0].message).toContain('bravo');
  });

  test('structural drift blocks the plan and names the finding', async () => {
    const state = brokenState();
    delete objectOf(state.managed, 'alpha_group').schema.properties
      .aiagentprivileges;
    const { tenant } = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(tenant);
    expect(plan).toMatchObject({ repairable: false, steps: [] });
    expect(plan.blockers.map((b) => b.id)).toContain(
      'definitions-structural-drift'
    );
    expect(plan.backup.managed).toBeNull();
  });

  test('a feature version the library does not know blocks the plan', async () => {
    const state = healthyRepairState();
    const { tenant } = fakeRepairTenant(state);
    tenant.readFeature = async () => ({
      _id: 'aiagent',
      installedVersion: '2',
      availableVersions: ['1', '2'],
    });
    const plan = await planAIAgentFeatureRepair(tenant);
    expect(plan.blockers.map((b) => b.id)).toEqual(['version-unsupported']);
  });

  test('a registry that reads not installed for an unknown reason makes the enable action unsafe: blocked', async () => {
    const state = healthyRepairState();
    state.gates.alpha = {
      typeListed: false,
      listStatus: 501,
      agentCount: null,
    };
    const { tenant } = fakeRepairTenant(state);
    tenant.readFeature = async () => ({
      _id: 'aiagent',
      installedVersion: null,
      availableVersions: ['1'],
    });
    const plan = await planAIAgentFeatureRepair(tenant);
    expect(plan.repairable).toBe(false);
    expect(plan.blockers.map((b) => b.id)).toContain('registry-unexplained');
  });
});

describe('repairIdmFeature', () => {
  async function planned(state: FakeRepairState, options = {}) {
    const fake = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(fake.tenant, options);
    fake.writes.length = 0;
    fake.calls.length = 0;
    return { ...fake, plan };
  }

  test('the broken tenant is repaired in order, the customised definitions are put back, the gate is waited for', async () => {
    const state = brokenState();
    withDanglingMappings(state);
    state.gates.bravo = {
      typeListed: false,
      listStatus: 501,
      agentCount: null,
    };
    state.closedReadsAfterEnable = 2;
    const { tenant, plan, writes } = await planned(state);
    const { clock, sleeps } = fakeClock();
    const result = await repairAIAgentFeature(
      tenant,
      plan,
      { wait: true },
      clock
    );
    expect(writes).toEqual([
      'deleteSecretMapping:alpha:am.test.one',
      'deleteSecretMapping:alpha:am.test.two',
      'putProvider:bravo',
      'putProvider:alpha',
      'putManagedConfig',
      'enableFeature',
      'putManagedConfig',
    ]);
    expect(outcome(result)).toEqual([
      'delete-secret-mapping:alpha=done',
      'delete-secret-mapping:alpha=done',
      'create-provider:bravo=done',
      'set-auth-service:alpha=done',
      'align-definitions=done',
      'enable=done',
      'wait-for-gate=done',
      'restore-definitions=done',
      'diagnose=done',
    ]);
    expect(result.completed).toBe(true);
    // the wait returned as soon as the gate was open, not after the timeout
    expect(sleeps.length).toBeGreaterThan(0);
    expect(sleeps.reduce((a, b) => a + b, 0)).toBeLessThan(
      DEFAULT_GATE_TIMEOUT
    );
    // the tenant: mappings gone (the working one stays), providers usable, customised definitions back
    expect(state.secretStores.alpha[0].mappings.map((m) => m.secretId)).toEqual(
      ['am.keep']
    );
    expect(
      (state.providers.alpha as any).advancedOAuth2Config
        .passwordGrantAuthService
    ).toBe('Login');
    expect(
      (state.providers.bravo as any).advancedOAuth2Config
        .passwordGrantAuthService
    ).toBe('Login');
    expect(
      objectOf(state.managed, 'alpha_aiagent').onDelete.source.endsWith('\n')
    ).toBe(true);
    expect(state.enableRuns).toBe(1);
    // nothing was added twice
    expect(
      state.managed.objects!.filter((o: any) => o.name === 'alpha_aiagent')
    ).toHaveLength(1);
    expect(
      result.diagnosis.findings.filter((f) => f.id === 'gate-open')
    ).toHaveLength(2);
    expect(
      result.diagnosis.findings.some((f) => f.id === 'provider-missing')
    ).toBe(false);
  });

  test('the providers are written without _id and _rev, with the authentication service', async () => {
    const state = brokenState();
    const { tenant, plan } = await planned(state);
    const bodies: any[] = [];
    const put = tenant.putProvider;
    tenant.putProvider = async (realm, provider) => {
      bodies.push({ realm, provider: clone(provider) });
      return put(realm, provider);
    };
    await repairAIAgentFeature(tenant, plan, {}, fakeClock().clock);
    expect(bodies.map((b) => b.realm)).toEqual(['bravo', 'alpha']);
    for (const { provider } of bodies) {
      expect('_id' in provider).toBe(false);
      expect('_rev' in provider).toBe(false);
      expect(provider.advancedOAuth2Config.passwordGrantAuthService).toBe(
        'Login'
      );
    }
    // alpha keeps what it had
    expect(bodies[1].provider.aiAgentsConfig).toBeDefined();
  });

  test('keepAligned leaves the definitions aligned and the registry reads installed', async () => {
    const state = brokenState();
    const { tenant, plan } = await planned(state, { keepAligned: true });
    const result = await repairAIAgentFeature(
      tenant,
      plan,
      {},
      fakeClock().clock
    );
    expect(outcome(result)).not.toContain('restore-definitions=done');
    expect(
      objectOf(state.managed, 'alpha_aiagent').onDelete.source.endsWith('\n')
    ).toBe(false);
    expect(state.feature.installedVersion).toBe('1');
  });

  test('without wait the repair does not wait: the step is skipped and the gate may still be closed', async () => {
    const state = brokenState();
    state.closedReadsAfterEnable = 3;
    const { tenant, plan } = await planned(state);
    const { clock, sleeps } = fakeClock();
    const result = await repairAIAgentFeature(tenant, plan, {}, clock);
    expect(sleeps).toEqual([]);
    expect(outcome(result)).toContain('wait-for-gate=skipped');
    expect(result.completed).toBe(true);
    expect(result.diagnosis.findings.some((f) => f.id === 'gate-closed')).toBe(
      true
    );
  });

  test('wait polls every poll interval and returns as soon as the gate is open', async () => {
    const state = brokenState();
    state.closedReadsAfterEnable = 2;
    const { tenant, plan } = await planned(state);
    const { clock, sleeps } = fakeClock();
    const result = await repairAIAgentFeature(
      tenant,
      plan,
      { wait: true },
      clock
    );
    expect(sleeps).toEqual([GATE_POLL_INTERVAL, GATE_POLL_INTERVAL]);
    expect(outcome(result)).toContain('wait-for-gate=done');
  });

  test('the default timeout is 20 minutes in milliseconds, and a gate that stays closed is a failed step, not an error', async () => {
    const state = brokenState();
    state.closedReadsAfterEnable = 100000;
    const { tenant, plan } = await planned(state);
    const { clock, sleeps } = fakeClock();
    const result = await repairAIAgentFeature(
      tenant,
      plan,
      { wait: true },
      clock
    );
    expect(DEFAULT_GATE_TIMEOUT).toBe(1_200_000);
    expect(sleeps.reduce((a, b) => a + b, 0)).toBe(1_200_000);
    expect(outcome(result)).toContain('wait-for-gate=failed');
    expect(result.completed).toBe(false);
    // the rest still ran: the definitions are back and the diagnosis is there
    expect(outcome(result).slice(-2)).toEqual([
      'restore-definitions=done',
      'diagnose=done',
    ]);
  });

  test('a timeout option is milliseconds', async () => {
    const state = brokenState();
    state.closedReadsAfterEnable = 100000;
    const { tenant, plan } = await planned(state);
    const { clock, sleeps } = fakeClock();
    await repairAIAgentFeature(
      tenant,
      plan,
      { wait: true, timeout: 25000 },
      clock
    );
    expect(sleeps).toEqual([10000, 10000, 5000]);
  });

  test('the callback gets each result as it happens, and a callback that throws does not stop the repair', async () => {
    const state = brokenState();
    const { tenant, plan } = await planned(state);
    const seen: string[] = [];
    const result = await repairAIAgentFeature(
      tenant,
      plan,
      {
        resultCallback: (r) => {
          seen.push(`${r.step.id}=${r.status}`);
          throw new Error('callback failed');
        },
      },
      fakeClock().clock
    );
    expect(seen).toEqual(result.results.map((r) => `${r.step.id}=${r.status}`));
    expect(result.completed).toBe(true);
  });

  test('a plan that is blocked cannot be run', async () => {
    const state = brokenState();
    state.authServices = { alpha: ['Login'], bravo: [] };
    const { tenant, plan, writes } = await planned(state);
    await expect(
      repairAIAgentFeature(tenant, plan, {}, fakeClock().clock)
    ).rejects.toThrow('cannot be run');
    expect(writes).toEqual([]);
  });

  test('a plan with no steps does nothing and returns the diagnosis', async () => {
    const { tenant, plan, writes } = await planned(healthyRepairState());
    const result = await repairAIAgentFeature(
      tenant,
      plan,
      {},
      fakeClock().clock
    );
    expect(result).toMatchObject({ completed: true, results: [] });
    expect(result.diagnosis.supported).toBe(true);
    expect(writes).toEqual([]);
  });

  test('a second run after the symptom shows is repaired too: the dangling mappings of the realm go', async () => {
    const state = brokenState();
    state.idmAgents.alpha = 4;
    state.secretStores.alpha = [
      {
        storeId: 'ESV',
        storeTypeId: ESV_SECRET_STORE_TYPE,
        mappings: [{ secretId: 'am.test.one', aliases: ['test'] }],
      },
    ];
    const first = await planned(state);
    // while the gate is closed the mapping is a warning: the plan leaves it
    expect(ids(first.plan)).not.toContain('delete-secret-mapping');
    await repairAIAgentFeature(
      first.tenant,
      first.plan,
      { wait: true },
      fakeClock().clock
    );
    expect(state.secretStores.alpha[0].mappings).toHaveLength(1);
    // now the gate is open and AM lists none of the 4 IDM agents: an error that the next plan repairs
    const second = await planned(state);
    expect(ids(second.plan)).toEqual(['delete-secret-mapping', 'diagnose']);
    await repairAIAgentFeature(
      second.tenant,
      second.plan,
      {},
      fakeClock().clock
    );
    expect(state.secretStores.alpha[0].mappings).toEqual([]);
  });
});

describe('the enable action is guarded', () => {
  test('it is not run on definitions that are present but not equal to the original', async () => {
    const state = brokenState();
    const { tenant, plan } = await (async () => {
      const fake = fakeRepairTenant(state);
      return { ...fake, plan: await planAIAgentFeatureRepair(fake.tenant) };
    })();
    // a plan without the alignment, as a caller could hand-build one
    const unsafe: IdmFeatureRepairPlan = {
      ...plan,
      steps: plan.steps.filter((s) => s.id === 'enable'),
    };
    await expect(
      repairAIAgentFeature(tenant, unsafe, {}, fakeClock().clock)
    ).rejects.toThrow('Error repairing IDM feature aiagent');
    expect(state.enableRuns).toBe(0);
    expect(
      state.managed.objects!.filter((o: any) => o.name === 'alpha_aiagent')
    ).toHaveLength(1);
  });

  test('it is not run if the registry still reads not installed after the alignment', async () => {
    const state = brokenState();
    const fake = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(fake.tenant);
    // something else makes the registry read null: the platform keeps its own state
    const read = fake.tenant.readFeature;
    let aligned = false;
    const put = fake.tenant.putManagedConfig;
    fake.tenant.putManagedConfig = async (config) => {
      aligned = true;
      return put(config);
    };
    fake.tenant.readFeature = async () => {
      const feature = await read();
      return aligned ? { ...feature, installedVersion: null } : feature;
    };
    await expect(
      repairAIAgentFeature(fake.tenant, plan, {}, fakeClock().clock)
    ).rejects.toThrow('Error repairing IDM feature aiagent');
    expect(state.enableRuns).toBe(0);
    // the customised definitions were put back
    expect(
      objectOf(state.managed, 'alpha_aiagent').onDelete.source.endsWith('\n')
    ).toBe(true);
  });
});

describe('every write is read back', () => {
  test('a configuration write that did not take stops the run before the enable action', async () => {
    const state = brokenState();
    const fake = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(fake.tenant);
    fake.tenant.putManagedConfig = async () => {}; // accepted, not stored
    const error = await repairAIAgentFeature(
      fake.tenant,
      plan,
      {},
      fakeClock().clock
    ).catch((e) => e);
    expect(error.name).toBe('FrodoError');
    expect(error.getCombinedMessage()).toContain(
      'does not hold what was written'
    );
    expect(state.enableRuns).toBe(0);
  });

  test('a provider write that did not take stops the run', async () => {
    const state = brokenState();
    const fake = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(fake.tenant);
    fake.tenant.putProvider = async () => {};
    const error = await repairAIAgentFeature(
      fake.tenant,
      plan,
      {},
      fakeClock().clock
    ).catch((e) => e);
    expect(error.getCombinedMessage()).toContain(
      'does not read back as it was written'
    );
    expect(state.enableRuns).toBe(0);
  });

  test('a mapping that is still there after the delete stops the run', async () => {
    const state = healthyRepairState();
    withDanglingMappings(state);
    const fake = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(fake.tenant);
    fake.tenant.deleteSecretMapping = async () => {};
    const error = await repairAIAgentFeature(
      fake.tenant,
      plan,
      {},
      fakeClock().clock
    ).catch((e) => e);
    expect(error.getCombinedMessage()).toContain(
      'is still in the secret store'
    );
  });
});

describe('a plan is not applied to a tenant that changed', () => {
  test('definitions that changed since the plan stop the alignment', async () => {
    const state = brokenState();
    const fake = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(fake.tenant);
    objectOf(state.managed, 'alpha_aiagent').onDelete.source += '\n'; // somebody changed it again
    fake.writes.length = 0;
    await expect(
      repairAIAgentFeature(fake.tenant, plan, {}, fakeClock().clock)
    ).rejects.toThrow('Error repairing IDM feature aiagent');
    expect(
      fake.writes.filter(
        (w) =>
          w.startsWith('put') &&
          w !== 'putProvider:alpha' &&
          w !== 'putProvider:bravo'
      )
    ).toEqual([]);
    expect(state.enableRuns).toBe(0);
  });

  test('a provider that appeared since the plan is not overwritten', async () => {
    const state = brokenState();
    const fake = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(fake.tenant);
    state.providers.bravo = {
      advancedOAuth2Config: { passwordGrantAuthService: 'Login' },
      aiAgentsConfig: {},
    };
    fake.writes.length = 0;
    await expect(
      repairAIAgentFeature(fake.tenant, plan, {}, fakeClock().clock)
    ).rejects.toThrow('Error repairing IDM feature aiagent');
    expect(fake.writes).not.toContain('putProvider:bravo');
  });

  test('a mapping whose ESV secret exists now is not deleted', async () => {
    const state = healthyRepairState();
    withDanglingMappings(state);
    const fake = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(fake.tenant);
    state.esvSecretIds.push('test'); // the secret was created since
    await expect(
      repairAIAgentFeature(fake.tenant, plan, {}, fakeClock().clock)
    ).rejects.toThrow('Error repairing IDM feature aiagent');
    expect(
      fake.writes.filter((w) =>
        w.startsWith('deleteSecretMapping:alpha:am.test.one')
      )
    ).toEqual([]);
  });

  test('a mapping that is gone is skipped, not an error', async () => {
    const state = healthyRepairState();
    withDanglingMappings(state);
    const fake = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(fake.tenant);
    state.secretStores.alpha[0].mappings =
      state.secretStores.alpha[0].mappings.filter(
        (m) => m.secretId !== 'am.test.one'
      );
    const result = await repairAIAgentFeature(
      fake.tenant,
      plan,
      {},
      fakeClock().clock
    );
    expect(outcome(result)).toEqual([
      'delete-secret-mapping:alpha=skipped',
      'delete-secret-mapping:alpha=done',
      'diagnose=done',
    ]);
  });
});

describe('a step that fails', () => {
  test('after the alignment the customised definitions are put back before the error is thrown', async () => {
    const state = brokenState();
    state.fail.enableFeature = httpError(500);
    const { tenant, plan } = await (async () => {
      const fake = fakeRepairTenant(state);
      return { ...fake, plan: await planAIAgentFeatureRepair(fake.tenant) };
    })();
    const seen: string[] = [];
    const error = await repairAIAgentFeature(
      tenant,
      plan,
      { resultCallback: (r) => seen.push(`${r.step.id}=${r.status}`) },
      fakeClock().clock
    ).catch((e) => e);
    expect(error.name).toBe('FrodoError');
    expect(error.message).toContain('Run the enable action');
    expect(error.httpStatus).toBe(500);
    expect(seen).toEqual([
      'create-provider=done',
      'set-auth-service=done',
      'align-definitions=done',
      'enable=failed',
      'restore-definitions=done',
    ]);
    expect(
      objectOf(state.managed, 'alpha_aiagent').onDelete.source.endsWith('\n')
    ).toBe(true);
  });

  test('with keepAligned the definitions stay aligned', async () => {
    const state = brokenState();
    state.fail.enableFeature = httpError(500);
    const fake = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(fake.tenant, {
      keepAligned: true,
    });
    await expect(
      repairAIAgentFeature(fake.tenant, plan, {}, fakeClock().clock)
    ).rejects.toThrow();
    expect(
      objectOf(state.managed, 'alpha_aiagent').onDelete.source.endsWith('\n')
    ).toBe(false);
  });

  test('a failure before the alignment writes no definitions', async () => {
    const state = brokenState();
    state.fail['putProvider:bravo'] = httpError(400);
    const fake = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(fake.tenant);
    fake.writes.length = 0;
    await expect(
      repairAIAgentFeature(fake.tenant, plan, {}, fakeClock().clock)
    ).rejects.toThrow('Error repairing IDM feature aiagent');
    expect(fake.writes).toEqual(['putProvider:bravo']);
  });
});

describe('the fake platform', () => {
  test('models what the guard protects against: the enable action adds drifted definitions a second time', async () => {
    const state = brokenState();
    const { tenant } = fakeRepairTenant(state);
    // give both providers what the platform needs, leave the definitions drifted, call the action
    state.providers.bravo = clone(state.providers.alpha);
    (
      state.providers.alpha as any
    ).advancedOAuth2Config.passwordGrantAuthService = 'Login';
    (
      state.providers.bravo as any
    ).advancedOAuth2Config.passwordGrantAuthService = 'Login';
    await tenant.enableFeature();
    expect(
      state.managed.objects!.filter((o: any) => o.name === 'alpha_aiagent')
    ).toHaveLength(2);
  });

  test('applyDifferences on a copy never changes the original', () => {
    const state = brokenState();
    const copy = clone(state.managed);
    applyDifferences(copy, state.repoDs, [], 'expected');
    expect(copy).toEqual(state.managed);
  });
});

describe('a plan is data that somebody can have edited', () => {
  async function brokenPlan(change?: (state: FakeRepairState) => void) {
    const state = brokenState();
    change?.(state);
    const fake = fakeRepairTenant(state);
    const plan = JSON.parse(
      JSON.stringify(await planAIAgentFeatureRepair(fake.tenant))
    ) as IdmFeatureRepairPlan;
    fake.writes.length = 0;
    return { state, ...fake, plan };
  }
  const step = (plan: IdmFeatureRepairPlan, id: string) =>
    plan.steps.find((s) => s.id === id)!;
  const configWrites = (writes: string[]) =>
    writes.filter((w) => w === 'putManagedConfig' || w === 'putRepoDs');

  test('an align step whose expected value was edited is refused: nothing is written to the configuration, the enable action does not run', async () => {
    const { state, tenant, plan, writes } = await brokenPlan();
    (step(plan, 'align-definitions').details.differences as any[])[0].expected =
      'return evil();';
    const error = await repairAIAgentFeature(
      tenant,
      plan,
      {},
      fakeClock().clock
    ).catch((e) => e);
    expect(error.name).toBe('FrodoError');
    expect(error.getCombinedMessage()).toContain('is refused');
    expect(error.getCombinedMessage()).toContain(
      'the original is not what the plan records'
    );
    expect(configWrites(writes)).toEqual([]);
    expect(state.enableRuns).toBe(0);
    expect(
      objectOf(state.managed, 'alpha_aiagent').onDelete.source
    ).not.toContain('evil');
  });

  test('what is written is the reference value, taken from a fresh comparison, not from the plan', async () => {
    const { state, tenant, plan } = await brokenPlan();
    const written: any[] = [];
    const put = tenant.putManagedConfig;
    tenant.putManagedConfig = async (config) => {
      written.push(clone(config));
      return put(config);
    };
    await repairAIAgentFeature(tenant, plan, {}, fakeClock().clock);
    // the first write is the alignment: it holds the shipped original, whatever the plan says
    expect(
      objectOf(written[0], 'alpha_aiagent').onDelete.source.endsWith('\n')
    ).toBe(false);
    expect(objectOf(written[0], 'alpha_aiagent').onDelete.source).toBe(
      AI_AGENT_FEATURE_REFERENCE.managedObjects.alpha_aiagent.onDelete
        ? (
            AI_AGENT_FEATURE_REFERENCE.managedObjects.alpha_aiagent
              .onDelete as any
          ).source
        : ''
    );
    expect(state.enableRuns).toBe(1);
  });

  test('an align step that names a definition the reference does not differ in is refused', async () => {
    const { state, tenant, plan, writes } = await brokenPlan();
    (step(plan, 'align-definitions').details.differences as any[]).push({
      config: 'managed',
      object: 'alpha_user',
      path: ['schema', 'title'],
      location: 'schema.title',
      kind: 'changed',
      expected: 'Evil',
      actual: 'User',
      cosmetic: true,
      cosmeticClass: 'title',
    });
    await expect(
      repairAIAgentFeature(tenant, plan, {}, fakeClock().clock)
    ).rejects.toThrow('Error repairing IDM feature aiagent');
    expect(configWrites(writes)).toEqual([]);
    expect(state.enableRuns).toBe(0);
  });

  test('an align step that passes a structural difference off as a cosmetic one is refused', async () => {
    const { state, tenant, plan, writes } = await brokenPlan();
    // after the plan was made the tenant gained an extra property in a managed object: structural
    objectOf(state.managed, 'bravo_aiagentprivilege').schema.properties.custom =
      { type: 'string' };
    (step(plan, 'align-definitions').details.differences as any[]).push({
      config: 'managed',
      object: 'bravo_aiagentprivilege',
      path: ['schema', 'properties', 'custom'],
      location: 'schema.properties.custom',
      kind: 'extra',
      actual: { type: 'string' },
      cosmetic: true,
      cosmeticClass: 'extra-mapping-property',
    });
    const error = await repairAIAgentFeature(
      tenant,
      plan,
      {},
      fakeClock().clock
    ).catch((e) => e);
    expect(error.getCombinedMessage()).toContain(
      'the difference is not a cosmetic one'
    );
    expect(configWrites(writes)).toEqual([]);
    expect(state.enableRuns).toBe(0);
  });

  test('the values to put back are read from the tenant when the definitions are aligned, not taken from the restore step of the plan', async () => {
    const { state, tenant, plan } = await brokenPlan();
    for (const difference of step(plan, 'restore-definitions').details
      .differences as any[]) {
      difference.actual = 'return evil();';
    }
    const result = await repairAIAgentFeature(
      tenant,
      plan,
      {},
      fakeClock().clock
    );
    expect(result.completed).toBe(true);
    // the customised definition is back, as the tenant had it
    expect(
      objectOf(state.managed, 'alpha_aiagent').onDelete.source.endsWith('\n')
    ).toBe(true);
    expect(JSON.stringify(state.managed)).not.toContain('evil');
  });

  test('a restore step without an alignment in the run puts nothing back', async () => {
    const { state, tenant, plan, writes } = await brokenPlan();
    const hand: IdmFeatureRepairPlan = {
      ...plan,
      steps: [step(plan, 'restore-definitions')],
    };
    const result = await repairAIAgentFeature(
      tenant,
      hand,
      {},
      fakeClock().clock
    );
    expect(outcome(result)).toContain('restore-definitions=skipped');
    expect(configWrites(writes)).toEqual([]);
    expect(
      objectOf(state.managed, 'alpha_aiagent').onDelete.source.endsWith('\n')
    ).toBe(true);
  });

  test('a step for a realm the feature is not installed for is refused', async () => {
    const { tenant, plan, writes } = await brokenPlan();
    step(plan, 'create-provider').realm = 'root';
    await expect(
      repairAIAgentFeature(tenant, plan, {}, fakeClock().clock)
    ).rejects.toThrow('Error repairing IDM feature aiagent');
    expect(writes).toEqual([]);
  });

  test('an authentication service the realm lacks is not written, whatever the plan says', async () => {
    const { tenant, plan, writes } = await brokenPlan();
    plan.options.authService = 'NoSuchTree';
    const error = await repairAIAgentFeature(
      tenant,
      plan,
      {},
      fakeClock().clock
    ).catch((e) => e);
    expect(error.getCombinedMessage()).toContain(
      'no authentication tree named NoSuchTree'
    );
    expect(writes).toEqual([]);
  });
});

describe('the value that is put back comes back in whatever key order the server returns', () => {
  const reverseKeys = (value: any): any =>
    Array.isArray(value)
      ? value.map(reverseKeys)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .reverse()
              .map(([k, v]) => [k, reverseKeys(v)])
          )
        : value;

  test('an object-valued extra mapping property is restored and read back although its keys are reordered', async () => {
    const state = brokenState();
    const extra = {
      type: 'simple',
      ldapAttribute: 'description',
      isMultiValued: false,
    };
    (state.repoDs.resourceMapping as any).explicitMapping[
      'managed/alpha_aiagentprivilege'
    ].properties.leftover = extra;
    const fake = fakeRepairTenant(state);
    // the server stores what it is sent with the keys of every object reversed
    fake.tenant.putRepoDs = async (config) => {
      state.repoDs = reverseKeys(clone(config));
    };
    const plan = await planAIAgentFeatureRepair(fake.tenant);
    expect(
      (
        plan.steps.find((s) => s.id === 'align-definitions')!.details
          .differences as any[]
      ).map((d) => d.cosmeticClass)
    ).toContain('extra-mapping-property');
    const result = await repairAIAgentFeature(
      fake.tenant,
      plan,
      {},
      fakeClock().clock
    );
    expect(result.completed).toBe(true);
    const back = (state.repoDs.resourceMapping as any).explicitMapping[
      'managed/alpha_aiagentprivilege'
    ].properties.leftover;
    expect(back).toEqual(extra);
    expect(Object.keys(back)).not.toEqual(Object.keys(extra));
  });
});

describe('waiting for the gate: what goes wrong while looking', () => {
  async function brokenPlan() {
    const state = brokenState();
    const fake = fakeRepairTenant(state);
    const plan = await planAIAgentFeatureRepair(fake.tenant);
    return { state, ...fake, plan };
  }

  test('a look that fails keeps the wait going, and the repair completes when the gate opens', async () => {
    const { tenant, plan } = await brokenPlan();
    const read = tenant.readGate;
    let calls = 0;
    tenant.readGate = async (realm) => {
      calls += 1;
      if (calls <= 2) throw httpError(503);
      return read(realm);
    };
    const { clock, sleeps } = fakeClock();
    const result = await repairAIAgentFeature(
      tenant,
      plan,
      { wait: true },
      clock
    );
    expect(outcome(result)).toContain('wait-for-gate=done');
    expect(sleeps).toEqual([GATE_POLL_INTERVAL]);
    expect(result.completed).toBe(true);
  });

  test('a look that keeps failing is named in the failed step when the time is up', async () => {
    const { tenant, plan } = await brokenPlan();
    const read = tenant.readGate;
    tenant.readGate = async (realm) => {
      if (realm === 'alpha') throw httpError(503);
      return read(realm);
    };
    const result = await repairAIAgentFeature(
      tenant,
      plan,
      { wait: true, timeout: 25000 },
      fakeClock().clock
    );
    const wait = result.results.find((r) => r.step.id === 'wait-for-gate')!;
    expect(wait.status).toBe('failed');
    expect(wait.message).toContain(
      'AM does not accept AI agents in alpha after 25 seconds'
    );
    expect(wait.message).toContain(
      'The last error while looking: alpha: HTTP 503'
    );
    expect(result.completed).toBe(false);
  });

  test('a look that works again clears the error', async () => {
    const { tenant, plan } = await brokenPlan();
    const read = tenant.readGate;
    let calls = 0;
    tenant.readGate = async (realm) => {
      calls += 1;
      if (calls === 1 && realm === 'alpha') throw httpError(503);
      if (realm === 'alpha')
        return { typeListed: false, listStatus: 501, agentCount: null };
      return read(realm);
    };
    const result = await repairAIAgentFeature(
      tenant,
      plan,
      { wait: true, timeout: 15000 },
      fakeClock().clock
    );
    const wait = result.results.find((r) => r.step.id === 'wait-for-gate')!;
    expect(wait.status).toBe('failed');
    expect(wait.message).not.toContain('The last error');
  });

  test.each([401, 403])(
    'a look that is refused with %s stops the wait with a FrodoError, and the definitions are put back',
    async (status) => {
      const { state, tenant, plan } = await brokenPlan();
      tenant.readGate = async () => {
        throw httpError(status);
      };
      const { clock, sleeps } = fakeClock();
      const seen: string[] = [];
      const error = await repairAIAgentFeature(
        tenant,
        plan,
        {
          wait: true,
          resultCallback: (r) => seen.push(`${r.step.id}=${r.status}`),
        },
        clock
      ).catch((e) => e);
      expect(error.name).toBe('FrodoError');
      expect(error.originalErrors[0].message).toContain(
        `is refused (HTTP ${status}`
      );
      expect(sleeps).toEqual([]);
      expect(seen.slice(-2)).toEqual([
        'wait-for-gate=failed',
        'restore-definitions=done',
      ]);
      expect(
        objectOf(state.managed, 'alpha_aiagent').onDelete.source.endsWith('\n')
      ).toBe(true);
    }
  );

  test('a list that answers 403 (an answer, not an exception) stops the wait too', async () => {
    const { tenant, plan } = await brokenPlan();
    tenant.readGate = async () => ({
      typeListed: true,
      listStatus: 403,
      agentCount: null,
    });
    const error = await repairAIAgentFeature(
      tenant,
      plan,
      { wait: true },
      fakeClock().clock
    ).catch((e) => e);
    expect(error.name).toBe('FrodoError');
    expect(error.originalErrors[0].message).toContain('is refused (HTTP 403');
  });

  test('a list that answers 500 is named if the gate never opens', async () => {
    const { tenant, plan } = await brokenPlan();
    tenant.readGate = async () => ({
      typeListed: true,
      listStatus: 500,
      agentCount: null,
    });
    const result = await repairAIAgentFeature(
      tenant,
      plan,
      { wait: true, timeout: 5000 },
      fakeClock().clock
    );
    expect(
      result.results.find((r) => r.step.id === 'wait-for-gate')!.message
    ).toContain('listing AI agents answered 500');
  });
});
