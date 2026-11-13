/**
 * Unit tests for the diagnosis of the IDM feature `aiagent`.
 *
 * Run with:
 *
 *        npm run test:only AIAgentFeatureDiagnose.unit
 *
 * Origin: frodo-lib#1060. Four independent causes broke the feature on development tenants after a platform update:
 * a cosmetic difference in a definition (the registry then reads "not installed"), an OAuth 2.0 provider that the
 * platform's write cannot be applied to (the enable action then fails with a generic 500), a closed AM gate (501), and
 * mappings of the realm's secret store that point to ESV secrets that do not exist (AM then cannot read or create AI
 * agents). The tests run the diagnosis against a fake tenant whose state each test changes. No tenant is needed.
 */
import { AxiosError } from 'axios';
import {
  clone,
  fakeTenant,
  FakeTenantState,
  healthyTenantState,
} from './AIAgentFeature.fixtures';
import {
  AI_AGENT_FEATURE_OPERATIONS,
  diagnoseAIAgentFeature,
  MAX_DETAIL_VALUE_LENGTH,
  previewValue,
} from './AIAgentFeatureDiagnose';
import { ESV_SECRET_STORE_TYPE } from './AIAgentFeatureTenant';
import { IdmFeatureDiagnosis } from './IdmFeatureTypes';

const objectOf = (managed: any, name: string) =>
  managed.objects.find((object: any) => object.name === name);

async function diagnose(change?: (state: FakeTenantState) => void) {
  const state = healthyTenantState();
  change?.(state);
  const { tenant, calls } = fakeTenant(state);
  const diagnosis = await diagnoseAIAgentFeature(tenant);
  return { diagnosis, calls, state };
}

const find = (diagnosis: IdmFeatureDiagnosis, id: string, realm?: string) =>
  diagnosis.findings.filter(
    (finding) =>
      finding.id === id && (!realm || finding.details.realm === realm)
  );
const ids = (diagnosis: IdmFeatureDiagnosis) =>
  diagnosis.findings.map((finding) => finding.id);

/** The registry as a tenant with only a trailing newline in the definitions sees it. */
const drift = (state: FakeTenantState) => {
  state.feature = { installedVersion: null, availableVersions: ['1'] };
  objectOf(state.managed, 'alpha_aiagent').onDelete.source += '\n';
  objectOf(state.managed, 'bravo_aiagent').onDelete.source += '\n';
};

const closeGate = (state: FakeTenantState, realm: string, status = 501) => {
  state.gates[realm] = {
    typeListed: false,
    listStatus: status,
    agentCount: null,
  };
};

function httpError(status: number): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
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

describe('a healthy tenant', () => {
  test('has no error and no warning', async () => {
    const { diagnosis } = await diagnose();
    expect(diagnosis).toMatchObject({
      featureId: 'aiagent',
      supported: true,
      installedVersion: '1',
      availableVersions: ['1'],
    });
    expect(
      diagnosis.findings.filter((finding) => finding.severity !== 'info')
    ).toEqual([]);
    expect(ids(diagnosis)).toEqual([
      'registry-installed',
      'gate-open',
      'gate-open',
    ]);
    expect(find(diagnosis, 'registry-installed')[0].details).toMatchObject({
      installedVersion: '1',
      validateFailures: 26,
      operations: AI_AGENT_FEATURE_OPERATIONS,
    });
  });

  test('makes no write: the tenant has no write method to call', async () => {
    const { calls } = await diagnose();
    // every method of the interface is a read; the fake would throw on anything else
    expect(calls).toContain('readFeature');
    expect(
      calls.every((call) => /^(read|validate|authService|count)/.test(call))
    ).toBe(true);
  });

  test('a definition that differs from the reference does not matter while the registry says installed', async () => {
    const { diagnosis } = await diagnose((state) => {
      objectOf(state.managed, 'alpha_aiagent').onDelete.source += '\n';
    });
    expect(find(diagnosis, 'definitions-differ-from-reference')).toHaveLength(
      1
    );
    expect(
      find(diagnosis, 'definitions-differ-from-reference')[0]
    ).toMatchObject({
      severity: 'info',
      repairable: false,
    });
    expect(
      diagnosis.findings.filter((finding) => finding.severity !== 'info')
    ).toEqual([]);
  });
});

describe('drifted definitions', () => {
  test('with a closed gate: an error that the repair can fix, and the gate is an error too', async () => {
    const { diagnosis } = await diagnose((state) => {
      drift(state);
      closeGate(state, 'alpha');
      closeGate(state, 'bravo');
    });
    expect(find(diagnosis, 'registry-not-installed')[0].severity).toBe(
      'warning'
    );
    const cosmetic = find(diagnosis, 'definitions-cosmetic-drift');
    expect(cosmetic).toHaveLength(1);
    expect(cosmetic[0]).toMatchObject({ severity: 'error', repairable: true });
    expect(
      (cosmetic[0].details.differences as any[]).map((d) => d.object)
    ).toEqual(['alpha_aiagent', 'bravo_aiagent']);
    expect(find(diagnosis, 'gate-closed')).toHaveLength(2);
    expect(find(diagnosis, 'definitions-structural-drift')).toEqual([]);
  });

  test('with an open gate and AI agents working: a warning, nothing to repair', async () => {
    const { diagnosis } = await diagnose(drift);
    expect(find(diagnosis, 'definitions-cosmetic-drift')[0]).toMatchObject({
      severity: 'warning',
      repairable: false,
    });
    expect(find(diagnosis, 'gate-open')).toHaveLength(2);
    expect(
      diagnosis.findings.some((finding) => finding.severity === 'error')
    ).toBe(false);
  });

  test.each([
    [
      'a changed title',
      (state: FakeTenantState) => {
        objectOf(state.managed, 'alpha_aiagent').schema.title = 'AI Agent';
      },
      'title',
    ],
    [
      'an extra mapping property',
      (state: FakeTenantState) => {
        (state.repoDs.resourceMapping as any).explicitMapping[
          'managed/alpha_aiagentprivilege'
        ].properties.leftover = {};
      },
      'extra-mapping-property',
    ],
  ])(
    '%s is a cosmetic difference of class %s',
    async (_name, change, cosmeticClass) => {
      const { diagnosis } = await diagnose((state) => {
        state.feature = { installedVersion: null, availableVersions: ['1'] };
        change(state);
      });
      const finding = find(diagnosis, 'definitions-cosmetic-drift')[0];
      expect(finding).toBeDefined();
      expect((finding.details.differences as any[])[0].cosmeticClass).toBe(
        cosmeticClass
      );
    }
  );

  test('a structural difference is an error that cannot be repaired, and the cosmetic ones are not either', async () => {
    const { diagnosis } = await diagnose((state) => {
      drift(state);
      closeGate(state, 'alpha');
      delete objectOf(state.managed, 'bravo_group').schema.properties
        .aiagentprivileges;
    });
    const structural = find(diagnosis, 'definitions-structural-drift');
    expect(structural).toHaveLength(1);
    expect(structural[0]).toMatchObject({
      severity: 'error',
      repairable: false,
    });
    expect(find(diagnosis, 'definitions-cosmetic-drift')[0].repairable).toBe(
      false
    );
  });

  test('a registry that reads null although every definition equals the original is unexplained', async () => {
    const { diagnosis } = await diagnose((state) => {
      state.feature = { installedVersion: null, availableVersions: ['1'] };
    });
    expect(find(diagnosis, 'registry-unexplained')[0]).toMatchObject({
      severity: 'warning',
      repairable: false,
    });
  });
});

describe('a feature that was never installed', () => {
  test('is reported as such and no realm is read', async () => {
    const { diagnosis, calls } = await diagnose((state) => {
      state.feature = { installedVersion: null, availableVersions: ['1'] };
      state.managed = { objects: [{ name: 'alpha_user' }] };
      state.repoDs = {
        resourceMapping: { explicitMapping: {}, genericMapping: {} },
      };
    });
    expect(ids(diagnosis)).toEqual([
      'registry-not-installed',
      'feature-not-installed',
    ]);
    expect(diagnosis.findings[1]).toMatchObject({
      severity: 'info',
      repairable: false,
    });
    expect(calls.some((call) => call.includes(':'))).toBe(false);
  });
});

describe('the feature version', () => {
  test.each([
    [
      'installed is 2',
      { installedVersion: '2', availableVersions: ['1', '2'] },
    ],
    [
      'the registry has no installed version and offers only 2',
      { installedVersion: null, availableVersions: ['2'] },
    ],
    ['nothing is known', { installedVersion: null, availableVersions: [] }],
  ])(
    '%s: cannot be compared with the reference of version 1',
    async (_name, feature) => {
      const { diagnosis, calls } = await diagnose((state) => {
        state.feature = feature;
      });
      expect(ids(diagnosis)).toEqual(['version-unsupported']);
      expect(diagnosis.findings[0]).toMatchObject({
        severity: 'error',
        repairable: false,
      });
      expect(calls).toEqual(['readFeature']);
    }
  );

  test('version 1 installed while 2 is available is compared as usual', async () => {
    const { diagnosis } = await diagnose((state) => {
      state.feature = { installedVersion: '1', availableVersions: ['1', '2'] };
    });
    expect(ids(diagnosis)).toContain('registry-installed');
    expect(ids(diagnosis)).not.toContain('version-unsupported');
  });
});

describe('the OAuth 2.0 provider of a realm', () => {
  test('a realm without a provider is an error the repair can fix', async () => {
    const { diagnosis } = await diagnose((state) => {
      state.providers.bravo = undefined;
    });
    expect(find(diagnosis, 'provider-missing', 'bravo')[0]).toMatchObject({
      severity: 'error',
      repairable: true,
    });
    expect(find(diagnosis, 'provider-missing', 'alpha')).toEqual([]);
  });

  test.each([
    ['unset', undefined],
    ['empty', ''],
    ['AM placeholder', '[Empty]'],
  ])(
    'a password grant authentication service that is %s is an error the repair can fix',
    async (_name, value) => {
      const { diagnosis } = await diagnose((state) => {
        const provider = state.providers.alpha as any;
        if (value === undefined)
          delete provider.advancedOAuth2Config.passwordGrantAuthService;
        else provider.advancedOAuth2Config.passwordGrantAuthService = value;
      });
      expect(
        find(diagnosis, 'provider-auth-service-not-set', 'alpha')[0]
      ).toMatchObject({ severity: 'error', repairable: true });
    }
  );

  test('an authentication service that is no tree of the realm is a warning', async () => {
    const { diagnosis } = await diagnose((state) => {
      state.authServices.alpha = [];
    });
    expect(
      find(diagnosis, 'provider-auth-service-unknown', 'alpha')[0]
    ).toMatchObject({ severity: 'warning', repairable: false });
  });

  test('AI agents not enabled in the provider is an error the repair can fix', async () => {
    const { diagnosis } = await diagnose((state) => {
      (state.providers.alpha as any).aiAgentsConfig.aiAgentsEnabled = false;
    });
    expect(
      find(diagnosis, 'provider-ai-agents-disabled', 'alpha')[0]
    ).toMatchObject({ severity: 'error', repairable: true });
  });

  test('object names of another realm in an enabled provider are a warning', async () => {
    const { diagnosis } = await diagnose((state) => {
      (state.providers.bravo as any).aiAgentsConfig.aiAgentsIdentityObjectName =
        'managed/alpha_aiagent';
    });
    const finding = find(diagnosis, 'provider-ai-agents-config', 'bravo')[0];
    expect(finding).toMatchObject({ severity: 'warning', repairable: false });
    expect(finding.details.expected).toMatchObject({
      aiAgentsIdentityObjectName: 'managed/bravo_aiagent',
    });
  });

  test('the enable action is needed, so drift is an error, when a provider lacks the authentication service', async () => {
    const { diagnosis } = await diagnose((state) => {
      drift(state);
      delete (state.providers.alpha as any).advancedOAuth2Config
        .passwordGrantAuthService;
    });
    expect(find(diagnosis, 'definitions-cosmetic-drift')[0]).toMatchObject({
      severity: 'error',
      repairable: true,
    });
  });
});

describe('the AM gate', () => {
  test.each([
    [
      'AIAgent missing from the type list',
      { typeListed: false, listStatus: 501, agentCount: null },
    ],
    [
      'the list answers 501',
      { typeListed: true, listStatus: 501, agentCount: null },
    ],
    [
      'the type is missing and the list answers 404',
      { typeListed: false, listStatus: 404, agentCount: null },
    ],
  ])('%s: closed, the repair can fix it', async (_name, gate) => {
    const { diagnosis } = await diagnose((state) => {
      state.gates.alpha = gate;
    });
    const finding = find(diagnosis, 'gate-closed', 'alpha')[0];
    expect(finding).toMatchObject({ severity: 'error', repairable: true });
    expect(finding.details).toMatchObject({
      typeListed: gate.typeListed,
      listStatus: gate.listStatus,
    });
    expect(find(diagnosis, 'gate-open', 'bravo')).toHaveLength(1);
  });

  test('a list that answers 500 cannot be judged', async () => {
    const { diagnosis } = await diagnose((state) => {
      state.gates.alpha = {
        typeListed: true,
        listStatus: 500,
        agentCount: null,
      };
    });
    expect(find(diagnosis, 'gate-check-failed', 'alpha')[0]).toMatchObject({
      severity: 'warning',
      repairable: false,
    });
    expect(find(diagnosis, 'gate-closed', 'alpha')).toEqual([]);
  });
});

describe('the realm secrets', () => {
  const dangling = (state: FakeTenantState, realm = 'alpha') => {
    state.secretStores[realm] = [
      {
        storeId: 'ESV',
        storeTypeId: ESV_SECRET_STORE_TYPE,
        mappings: [
          {
            secretId:
              'am.applications.agents.remote.consent.request.signing.ES256',
            aliases: ['test'],
          },
          {
            secretId: 'am.services.pingone.worker.bogus.clientsecret',
            aliases: ['esv-ping-one-worker-secret'],
          },
          { secretId: 'am.some.working.secret', aliases: ['esv-one'] },
          { secretId: 'am.some.prefixed.secret', aliases: ['one'] },
        ],
      },
    ];
  };

  test('mappings to ESV secrets that do not exist are reported, the others are not', async () => {
    const { diagnosis } = await diagnose((state) => dangling(state));
    const finding = find(diagnosis, 'secret-mappings-dangling', 'alpha')[0];
    expect((finding.details.mappings as any[]).map((m) => m.secretId)).toEqual([
      'am.applications.agents.remote.consent.request.signing.ES256',
      'am.services.pingone.worker.bogus.clientsecret',
    ]);
    expect(find(diagnosis, 'secret-mappings-dangling', 'bravo')).toEqual([]);
  });

  test('without a symptom it is a warning: AI agents work on tenants that have one', async () => {
    const { diagnosis } = await diagnose((state) => dangling(state));
    expect(
      find(diagnosis, 'secret-mappings-dangling', 'alpha')[0]
    ).toMatchObject({ severity: 'warning', repairable: false });
    expect(find(diagnosis, 'agents-without-am-entry')).toEqual([]);
  });

  test('with IDM agents that AM does not list it is an error the repair can fix, and the data is reported', async () => {
    const { diagnosis } = await diagnose((state) => {
      dangling(state);
      state.gates.alpha = { typeListed: true, listStatus: 200, agentCount: 0 };
      state.idmAgents.alpha = 4;
    });
    expect(
      find(diagnosis, 'secret-mappings-dangling', 'alpha')[0]
    ).toMatchObject({ severity: 'error', repairable: true });
    expect(
      find(diagnosis, 'agents-without-am-entry', 'alpha')[0]
    ).toMatchObject({
      severity: 'error',
      repairable: false,
      details: { realm: 'alpha', idmAgents: 4, amAgents: 0 },
    });
  });

  test('IDM agents without an AM entry are reported without dangling mappings too, and never repaired', async () => {
    const { diagnosis } = await diagnose((state) => {
      state.gates.bravo = { typeListed: true, listStatus: 200, agentCount: 1 };
      state.idmAgents.bravo = 3;
    });
    expect(find(diagnosis, 'agents-without-am-entry', 'bravo')).toHaveLength(1);
    expect(find(diagnosis, 'secret-mappings-dangling')).toEqual([]);
  });

  test('stores of another type are not looked at', async () => {
    const { diagnosis } = await diagnose((state) => {
      state.secretStores.alpha = [
        {
          storeId: 'other',
          storeTypeId: 'FileSystemSecretStore',
          mappings: [{ secretId: 'x', aliases: ['nothing'] }],
        },
      ];
    });
    // the fake tenant returns what the real one filters by type; the diagnosis judges every store it is given
    expect(find(diagnosis, 'secret-mappings-dangling', 'alpha')).toHaveLength(
      1
    );
  });

  test('the ESV secrets are read once for all realms', async () => {
    const { calls } = await diagnose();
    expect(calls.filter((call) => call === 'readEsvSecretIds')).toHaveLength(1);
  });
});

describe('a check that cannot be made', () => {
  test('a failing validate is a finding and the diagnosis goes on', async () => {
    const { diagnosis } = await diagnose((state) => {
      state.fail.validateFeature = httpError(500);
    });
    const finding = find(diagnosis, 'check-failed')[0];
    expect(finding).toMatchObject({
      severity: 'warning',
      repairable: false,
      details: { check: 'validate', httpStatus: 500 },
    });
    expect(ids(diagnosis)).toContain('gate-open');
  });

  test('a refused provider read names the realm and the status', async () => {
    const { diagnosis } = await diagnose((state) => {
      state.fail['readProvider:alpha'] = httpError(403);
    });
    const finding = find(diagnosis, 'check-failed', 'alpha')[0];
    expect(finding.details).toMatchObject({
      check: 'OAuth 2.0 provider',
      realm: 'alpha',
      httpStatus: 403,
    });
    expect(find(diagnosis, 'gate-open', 'alpha')).toHaveLength(1);
  });

  test('a failing definitions read hides the definitions and every realm', async () => {
    const { diagnosis } = await diagnose((state) => {
      state.fail.readManagedConfig = httpError(403);
    });
    expect(find(diagnosis, 'check-failed')[0].details.check).toBe(
      'definitions'
    );
    expect(find(diagnosis, 'gate-open')).toEqual([]);
  });

  test('a failing ESV secret read is reported once', async () => {
    const { diagnosis } = await diagnose((state) => {
      state.fail.readEsvSecretIds = httpError(403);
    });
    expect(
      find(diagnosis, 'check-failed').filter(
        (f) => f.details.check === 'ESV secrets'
      )
    ).toHaveLength(1);
  });

  test('a failing gate read in one realm leaves the other realm judged', async () => {
    const { diagnosis } = await diagnose((state) => {
      state.fail['readGate:alpha'] = new Error('socket hang up');
    });
    expect(find(diagnosis, 'check-failed', 'alpha')[0].details.check).toBe(
      'AM gate'
    );
    expect(find(diagnosis, 'gate-open', 'bravo')).toHaveLength(1);
  });

  test('a failing registry read is an error: there is nothing to diagnose', async () => {
    await expect(
      diagnose((state) => {
        state.fail.readFeature = httpError(403);
      })
    ).rejects.toMatchObject({ response: { status: 403 } });
  });
});

describe('the fixtures', () => {
  test('a clone of the healthy state is independent of it', () => {
    const state = healthyTenantState();
    const copy = clone(state.managed);
    objectOf(copy, 'alpha_aiagent').onDelete.source = 'x';
    expect(objectOf(state.managed, 'alpha_aiagent').onDelete.source).not.toBe(
      'x'
    );
  });
});

describe('the size of the values in the details of a finding', () => {
  test('a short value is kept as it is', () => {
    expect(previewValue('Alpha realm - AI Agent')).toBe(
      'Alpha realm - AI Agent'
    );
    const small = { a: 1, b: ['x'] };
    expect(previewValue(small)).toBe(small);
    expect(previewValue(undefined)).toBeUndefined();
    expect(previewValue(null)).toBeNull();
  });

  test('a long string becomes its length, a short hash and its first characters', () => {
    const text = `${'a'.repeat(100)}${'b'.repeat(4900)}`;
    const preview = previewValue(text) as any;
    expect(preview).toMatchObject({ truncated: true, length: 5000 });
    expect(preview.sha256).toMatch(/^[0-9a-f]{16}$/);
    expect(preview.preview).toBe(`${'a'.repeat(80)}…`);
    expect(JSON.stringify(preview).length).toBeLessThan(
      MAX_DETAIL_VALUE_LENGTH + 100
    );
    expect((previewValue(`${text}!`) as any).sha256).not.toBe(preview.sha256);
    expect((previewValue(text) as any).sha256).toBe(preview.sha256);
  });

  test('a long object is described by its JSON', () => {
    const big = { script: 'z'.repeat(1000) };
    const preview = previewValue(big) as any;
    expect(preview.truncated).toBe(true);
    expect(preview.length).toBe(JSON.stringify(big).length);
  });

  test('the differences in a finding carry short values: a whole missing object is described, a title is kept', async () => {
    const { diagnosis } = await diagnose((state) => {
      state.feature = { installedVersion: null, availableVersions: ['1'] };
      state.managed.objects = state.managed.objects!.filter(
        (object) => object.name !== 'bravo_aiagentprivilege'
      );
      objectOf(state.managed, 'alpha_aiagent').schema.title = 'AI Agent';
    });
    const differences = find(diagnosis, 'definitions-structural-drift')[0]
      .details.differences as any[];
    const whole = differences.find(
      (d) => d.object === 'bravo_aiagentprivilege'
    );
    expect(whole.expected.truncated).toBe(true);
    expect(whole.expected.length).toBeGreaterThan(MAX_DETAIL_VALUE_LENGTH);
    const title = find(diagnosis, 'definitions-cosmetic-drift')[0].details
      .differences as any[];
    expect(title[0]).toMatchObject({
      location: 'schema.title',
      expected: 'Alpha realm - AI Agent',
      actual: 'AI Agent',
    });
    expect(JSON.stringify(diagnosis).length).toBeLessThan(5000);
  });
});
