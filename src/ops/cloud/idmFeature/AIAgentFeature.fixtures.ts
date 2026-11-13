/**
 * Test fixtures for the IDM feature `aiagent`: a healthy tenant built from the reference, and a fake tenant whose
 * state a test changes. Used by the unit tests next to it; not part of the library.
 */
import {
  ManagedConfigLike,
  RepoDsConfigLike,
  writePath,
} from './AIAgentFeatureDefinitions';
import {
  AI_AGENT_FEATURE_REALMS,
  AI_AGENT_FEATURE_REFERENCE,
} from './AIAgentFeatureReference';
import {
  AIAgentFeatureTenant,
  AIAgentGateState,
  AIAgentSecretStoreMappings,
  ESV_SECRET_STORE_TYPE,
} from './AIAgentFeatureTenant';

export const clone = <T>(value: T): T =>
  value === undefined ? value : JSON.parse(JSON.stringify(value));

/** `config/managed` of a healthy tenant: the base objects with everything the feature adds. */
export function healthyManagedConfig(): ManagedConfigLike {
  const objects: Record<string, unknown>[] = [];
  for (const realm of AI_AGENT_FEATURE_REALMS) {
    objects.push({
      name: `${realm}_user`,
      schema: {
        properties: {
          userName: { type: 'string' },
          groups: {
            items: { resourceCollection: [{ path: `managed/${realm}_group` }] },
          },
        },
      },
    });
    objects.push({
      name: `${realm}_group`,
      schema: {
        properties: { members: { items: {} } },
        order: ['_id', 'name', 'description', 'condition', 'members'],
      },
    });
    objects.push({
      name: `${realm}_application`,
      schema: { properties: { ssoEntities: {} } },
    });
  }
  const byName = new Map(
    objects.map((object) => [object.name as string, object])
  );
  for (const addition of AI_AGENT_FEATURE_REFERENCE.schemaAdditions) {
    writePath(
      byName.get(addition.object),
      addition.path,
      clone(addition.value)
    );
  }
  for (const addition of AI_AGENT_FEATURE_REFERENCE.orderAdditions) {
    (
      byName.get(addition.object) as { schema: { order: string[] } }
    ).schema.order.push(addition.value);
  }
  for (const definition of Object.values(
    AI_AGENT_FEATURE_REFERENCE.managedObjects
  )) {
    objects.push(clone(definition));
  }
  return { _id: 'managed', objects };
}

/** `config/repo.ds` of a healthy tenant. */
export function healthyRepoDs(): RepoDsConfigLike {
  const explicitMapping: Record<string, unknown> = {};
  const genericMapping: Record<string, unknown> = {};
  for (const [key, mapping] of Object.entries(
    AI_AGENT_FEATURE_REFERENCE.explicitMappings
  )) {
    explicitMapping[key] = clone(mapping);
  }
  for (const addition of AI_AGENT_FEATURE_REFERENCE.genericMappingProperties) {
    const mapping = (genericMapping[addition.mapping] ??= {
      properties: {},
    }) as { properties: Record<string, unknown> };
    mapping.properties[addition.property] = clone(addition.value);
  }
  return {
    _id: 'repo.ds',
    resourceMapping: { explicitMapping, genericMapping },
  };
}

/** A healthy OAuth 2.0 provider of a realm. */
export function healthyProvider(realm: string): Record<string, unknown> {
  return {
    advancedOAuth2Config: { passwordGrantAuthService: 'Login' },
    aiAgentsConfig: {
      aiAgentsEnabled: true,
      aiAgentsIdentityObjectName: `managed/${realm}_aiagent`,
      aiAgentsPrivilegeObjectName: `managed/${realm}_aiagentprivilege`,
      aiAgentsIdentityObjectMapping: ['client_id|oauth2ClientId'],
    },
  };
}

/** What a fake tenant answers; a test changes the parts it cares about. */
export type FakeTenantState = {
  feature: { installedVersion: string | null; availableVersions: string[] };
  validateFailures: string[];
  managed: ManagedConfigLike;
  repoDs: RepoDsConfigLike;
  providers: Record<string, Record<string, unknown> | undefined>;
  authServices: Record<string, string[]>;
  gates: Record<string, AIAgentGateState>;
  esvSecretIds: string[];
  secretStores: Record<string, AIAgentSecretStoreMappings[]>;
  idmAgents: Record<string, number>;
  /** method name -> error to throw instead of answering */
  fail: Record<string, unknown>;
};

/** The state of a healthy tenant whose registry reads "1". */
export function healthyTenantState(): FakeTenantState {
  const state: FakeTenantState = {
    feature: { installedVersion: '1', availableVersions: ['1'] },
    validateFailures: Array.from({ length: 26 }, (_, i) =>
      i < 4
        ? `config/managed: /objects/-: value already present at /objects/${12 + i}`
        : `config/managed: /objects/${i}/x: must not already exist`
    ),
    managed: healthyManagedConfig(),
    repoDs: healthyRepoDs(),
    providers: {},
    authServices: {},
    gates: {},
    esvSecretIds: ['esv-one'],
    secretStores: {},
    idmAgents: {},
    fail: {},
  };
  for (const realm of AI_AGENT_FEATURE_REALMS) {
    state.providers[realm] = healthyProvider(realm);
    state.authServices[realm] = ['Login'];
    state.gates[realm] = { typeListed: true, listStatus: 200, agentCount: 2 };
    state.secretStores[realm] = [
      { storeId: 'ESV', storeTypeId: ESV_SECRET_STORE_TYPE, mappings: [] },
    ];
    state.idmAgents[realm] = 2;
  }
  return state;
}

/** A fake tenant over a state object; it records the methods that were called. */
export function fakeTenant(state: FakeTenantState): {
  tenant: AIAgentFeatureTenant;
  calls: string[];
} {
  const calls: string[] = [];
  const run = async <T>(name: string, answer: () => T): Promise<T> => {
    calls.push(name);
    if (name in state.fail) throw state.fail[name];
    return answer();
  };
  const tenant: AIAgentFeatureTenant = {
    readFeature: () =>
      run('readFeature', () => ({
        _id: 'aiagent',
        ...clone(state.feature),
      })),
    validateFeature: () =>
      run('validateFeature', () => ({
        status: 200,
        success: state.validateFailures.length === 0,
        message: `Validate complete. ${state.validateFailures.length} failure(s).`,
        failures: [...state.validateFailures],
      })),
    readManagedConfig: () =>
      run('readManagedConfig', () => clone(state.managed)),
    readRepoDs: () => run('readRepoDs', () => clone(state.repoDs)),
    readProvider: (realm) =>
      run(
        `readProvider:${realm}`,
        () => clone(state.providers[realm]) as never
      ),
    authServiceExists: (realm, name) =>
      run(`authServiceExists:${realm}`, () =>
        (state.authServices[realm] ?? []).includes(name)
      ),
    readGate: (realm) =>
      run(`readGate:${realm}`, () => clone(state.gates[realm])),
    readEsvSecretIds: () =>
      run('readEsvSecretIds', () => [...state.esvSecretIds]),
    readSecretStoreMappings: (realm) =>
      run(`readSecretStoreMappings:${realm}`, () =>
        clone(state.secretStores[realm] ?? [])
      ),
    countIdmAgents: (realm) =>
      run(`countIdmAgents:${realm}`, () => state.idmAgents[realm] ?? 0),
  };
  return { tenant, calls };
}
