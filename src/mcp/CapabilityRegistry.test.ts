/**
 * Verifies baseline capability inference and policy filtering behavior.
 *
 * @remarks
 * These tests intentionally target foundational behavior only, so later registry
 * and MCP runtime work can extend coverage without changing the baseline contract.
 */

import {
  MCP_POLICY_PRESETS,
  applyCapabilityPolicy,
  buildCapabilityInventory,
  frodo,
  inferObjectType,
  inferOperationType,
  inferRiskClass,
} from '../index';
import knownContractGaps from './contract-gap-baseline.json';

const HIGH_RISK_DOMAINS = ['script', 'oauth2oidc', 'authn', 'idm'];

const KNOWN_CONTRACT_GAPS = [...knownContractGaps].sort();

function getHighRiskMixedContractViolations(): string[] {
  const highRiskDomains = new Set(HIGH_RISK_DOMAINS);
  const capabilities = buildCapabilityInventory(frodo, {
    includeTopLevelDomains: [...highRiskDomains],
    includeUtils: false,
  });

  return capabilities
    .filter((capability) => capability.kind === 'generic')
    .filter((capability) => highRiskDomains.has(capability.domain))
    .filter((capability) =>
      ['create', 'update', 'read', 'search', 'delete'].includes(
        capability.operationType
      )
    )
    .filter((capability) => {
      let node: unknown = frodo;
      for (const segment of capability.modulePath) {
        if (!node || (typeof node !== 'object' && typeof node !== 'function')) {
          return false;
        }
        node = (node as Record<string, unknown>)[segment];
      }
      const method =
        node && (typeof node === 'object' || typeof node === 'function')
          ? (node as Record<string, unknown>)[capability.methodName]
          : undefined;
      if (typeof method !== 'function') {
        return false;
      }

      if ((method as (...args: unknown[]) => unknown).length <= 1) {
        return false;
      }

      const parameters = capability.parameters ?? [];
      return capability.argumentMode === 'mixed' && parameters.length === 0;
    })
    .map((capability) => capability.id)
    .sort();
}

function summarizeContractGapsByDomain(ids: string[]): Record<string, unknown> {
  const summary: Record<
    string,
    {
      total: number;
      byOperation: Record<string, number>;
      ids: string[];
    }
  > = {};

  for (const id of ids) {
    const segments = id.split('.');
    const domain = segments[0] ?? 'unknown';
    const methodName = segments[segments.length - 1] ?? '';
    const operationType = inferOperationType(methodName);
    if (!summary[domain]) {
      summary[domain] = {
        total: 0,
        byOperation: {},
        ids: [],
      };
    }

    summary[domain].total += 1;
    summary[domain].byOperation[operationType] =
      (summary[domain].byOperation[operationType] ?? 0) + 1;
    summary[domain].ids.push(id);
  }

  for (const domain of Object.keys(summary)) {
    summary[domain].ids.sort();
  }

  return summary;
}

describe('MCP capability foundation', () => {
  test('infers operation types and risk classes from method names', () => {
    expect(inferOperationType('countUsers')).toBe('count');
    // singular read → read
    expect(inferOperationType('readJourney')).toBe('read');
    // plural read → list (Frodo convention: readJourneys = list all journeys)
    expect(inferOperationType('readJourneys')).toBe('list');
    expect(inferOperationType('readUsers')).toBe('list');
    expect(inferOperationType('readScripts')).toBe('list');
    // ies-plural form
    expect(inferOperationType('readPolicies')).toBe('list');
    expect(inferOperationType('deleteJourney')).toBe('delete');
    expect(inferRiskClass('delete', 'deleteJourney')).toBe('high');
    expect(inferRiskClass('read', 'readServiceAccount')).toBe('critical');
  });

  test('normalizes object type from plural method names correctly', () => {
    // simple plural: strip trailing s
    expect(inferObjectType('readJourneys', ['authn', 'journey'], 'list')).toBe(
      'Journey'
    );
    // ies→y must run before the generic s-strip
    expect(inferObjectType('readPolicies', ['authz', 'policy'], 'list')).toBe(
      'Policy'
    );
    // compound plural
    expect(
      inferObjectType('readScriptTypes', ['script'], 'list')
    ).toBe('ScriptType');
  });

  test('builds capability inventory for selected domains', () => {
    const capabilities = buildCapabilityInventory(frodo, {
      includeTopLevelDomains: ['authn'],
      includeUtils: false,
    });

    expect(capabilities.length).toBeGreaterThan(0);
    expect(capabilities.some((cap) => cap.id === 'authn.journey.readJourney')).toBe(
      true
    );
    expect(capabilities.some((cap) => cap.id.startsWith('state.'))).toBe(false);
  });

  test('applies read-only policy preset', () => {
    const capabilities = buildCapabilityInventory(frodo, {
      includeTopLevelDomains: ['authn'],
      includeUtils: false,
    });

    const filtered = applyCapabilityPolicy(
      capabilities,
      MCP_POLICY_PRESETS['read-only']
    );

    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every((cap) =>
        ['count', 'read', 'search', 'list'].includes(cap.operationType)
      )
    ).toBe(true);
  });

  test('exposes explicit script contracts for create/update/read', () => {
    const capabilities = buildCapabilityInventory(frodo, {
      includeTopLevelDomains: ['script'],
      includeUtils: false,
    });

    const byId = new Map(capabilities.map((cap) => [cap.id, cap]));

    const createScript = byId.get('script.createScript');
    expect(createScript).toBeDefined();
    expect(createScript?.argumentMode).toBe('named');
    expect(createScript?.parameters?.map((parameter) => parameter.name)).toEqual(
      ['scriptId', 'scriptName', 'scriptData']
    );

    const updateScript = byId.get('script.updateScript');
    expect(updateScript).toBeDefined();
    expect(updateScript?.argumentMode).toBe('named');
    expect(updateScript?.parameters?.map((parameter) => parameter.name)).toEqual(
      ['scriptId', 'scriptData']
    );

    const readScript = byId.get('script.readScript');
    expect(readScript).toBeDefined();
    expect(readScript?.argumentMode).toBe('named');
    expect(readScript?.parameters?.map((parameter) => parameter.name)).toEqual([
      'scriptId',
    ]);
  });

  test('high-risk multi-argument methods do not rely on unconstrained mixed contracts', () => {
    const violations = getHighRiskMixedContractViolations();

    // Enforce a strict no-regression gate while the broader backlog is burned down.
    // Any newly introduced unconstrained mixed contract in high-risk domains will
    // fail this test and force an explicit metadata decision.
    expect(violations).toEqual(KNOWN_CONTRACT_GAPS);
  });

  test('summarizes known mixed-contract gaps by domain and operation', () => {
    const violations = getHighRiskMixedContractViolations();
    const summary = summarizeContractGapsByDomain(violations) as Record<
      string,
      {
        total: number;
        byOperation: Record<string, number>;
        ids: string[];
      }
    >;

    expect(summary).toMatchObject({
      authn: {
        total: 10,
        byOperation: {
          create: 2,
          read: 1,
          update: 4,
          delete: 3,
        },
      },
      idm: {
        total: 19,
        byOperation: {
          create: 5,
          read: 3,
          update: 8,
          delete: 3,
        },
      },
      oauth2oidc: {
        total: 6,
        byOperation: {
          create: 3,
          update: 3,
        },
      },
    });

    expect(summary.authn.ids).toContain('authn.node.createNode');
    expect(summary.idm.ids).toContain('idm.managed.updateManagedObject');
    expect(summary.oauth2oidc.ids).toContain(
      'oauth2oidc.client.createOAuth2Client'
    );
  });
});
