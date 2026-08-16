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

/**
 * Deliberate, MCP-facing parameter name aliases: descriptor parameter name ->
 * accepted actual bound-method parameter name, keyed by capability id. Journey
 * and tree are interchangeable names for the same AM concept, and the journey
 * domain consistently exposes the friendlier "journeyId" even where the
 * underlying method still calls it "treeId" — same position, same value, no
 * functional difference.
 */
const ACCEPTED_PARAMETER_NAME_ALIASES: Record<string, Record<string, string>> =
  {
    'authn.journey.exportJourney': { journeyId: 'treeId' },
  };

/**
 * Extracts a compiled method's declared parameter names, in order, by parsing
 * its source. Used to catch drift between a descriptor's declared parameter
 * `position`s and the actual argument order the bound Frodo method expects —
 * a mismatch that toInvocationArgs cannot detect at runtime, because a
 * positional call site has no way to know an argument was meant for a
 * different slot than the one the descriptor put it in.
 */
function extractParameterNames(fn: (...args: unknown[]) => unknown): string[] {
  const source = fn.toString();
  const match = source.match(/^(?:async\s+)?(?:function\s*)?[^(]*\(([^)]*)\)/);
  if (!match) {
    return [];
  }
  const paramsSource = match[1].trim();
  if (!paramsSource) {
    return [];
  }
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of paramsSource) {
    if (char === '(' || char === '[' || char === '{') depth++;
    if (char === ')' || char === ']' || char === '}') depth--;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current);
  }
  return parts.map((part) => part.trim().split('=')[0].trim());
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
    expect(inferObjectType('readScriptTypes', ['script'], 'list')).toBe(
      'ScriptType'
    );
  });

  test('builds capability inventory for selected domains', () => {
    const capabilities = buildCapabilityInventory(frodo, {
      includeTopLevelDomains: ['authn'],
      includeUtils: false,
    });

    expect(capabilities.length).toBeGreaterThan(0);
    expect(
      capabilities.some((cap) => cap.id === 'authn.journey.readJourney')
    ).toBe(true);
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
    expect(
      createScript?.parameters?.map((parameter) => parameter.name)
    ).toEqual(['scriptId', 'scriptName', 'scriptData']);

    const updateScript = byId.get('script.updateScript');
    expect(updateScript).toBeDefined();
    expect(updateScript?.argumentMode).toBe('named');
    expect(
      updateScript?.parameters?.map((parameter) => parameter.name)
    ).toEqual(['scriptId', 'scriptData']);

    const readScript = byId.get('script.readScript');
    expect(readScript).toBeDefined();
    expect(readScript?.argumentMode).toBe('named');
    expect(readScript?.parameters?.map((parameter) => parameter.name)).toEqual([
      'scriptId',
    ]);
  });

  test('exposes explicit oauth2oidc create/update contracts', () => {
    const capabilities = buildCapabilityInventory(frodo, {
      includeTopLevelDomains: ['oauth2oidc'],
      includeUtils: false,
    });

    const byId = new Map(capabilities.map((cap) => [cap.id, cap]));

    const createClient = byId.get('oauth2oidc.client.createOAuth2Client');
    expect(createClient).toBeDefined();
    expect(createClient?.argumentMode).toBe('named');
    expect(
      createClient?.parameters?.map((parameter) => parameter.name)
    ).toEqual(['clientId', 'clientData']);

    const updateClient = byId.get('oauth2oidc.client.updateOAuth2Client');
    expect(updateClient).toBeDefined();
    expect(updateClient?.argumentMode).toBe('named');
    expect(
      updateClient?.parameters?.map((parameter) => parameter.name)
    ).toEqual(['clientId', 'clientData']);

    const createExternal = byId.get(
      'oauth2oidc.external.createSocialIdentityProvider'
    );
    expect(createExternal).toBeDefined();
    expect(createExternal?.argumentMode).toBe('named');
    expect(
      createExternal?.parameters?.map((parameter) => parameter.name)
    ).toEqual(['providerType', 'providerId', 'providerData']);

    const updateIssuer = byId.get(
      'oauth2oidc.issuer.updateOAuth2TrustedJwtIssuer'
    );
    expect(updateIssuer).toBeDefined();
    expect(updateIssuer?.argumentMode).toBe('named');
    expect(
      updateIssuer?.parameters?.map((parameter) => parameter.name)
    ).toEqual(['issuerId', 'issuerData']);
  });

  test('exposes explicit authn read/create/update/delete contracts', () => {
    const capabilities = buildCapabilityInventory(frodo, {
      includeTopLevelDomains: ['authn'],
      includeUtils: false,
    });

    const byId = new Map(capabilities.map((cap) => [cap.id, cap]));

    const createJourney = byId.get('authn.journey.createJourney');
    expect(createJourney).toBeDefined();
    expect(createJourney?.argumentMode).toBe('named');
    expect(
      createJourney?.parameters?.map((parameter) => parameter.name)
    ).toEqual(['journeyId', 'journeyData']);

    const deleteJourney = byId.get('authn.journey.deleteJourney');
    expect(deleteJourney).toBeDefined();
    expect(deleteJourney?.argumentMode).toBe('named');
    expect(
      deleteJourney?.parameters?.map((parameter) => parameter.name)
    ).toEqual(['journeyId', 'options']);

    const updateNode = byId.get('authn.node.updateNode');
    expect(updateNode).toBeDefined();
    expect(updateNode?.argumentMode).toBe('named');
    expect(updateNode?.parameters?.map((parameter) => parameter.name)).toEqual([
      'nodeId',
      'nodeType',
      'nodeData',
    ]);

    const readNodeType = byId.get('authn.node.readNodeType');
    expect(readNodeType).toBeDefined();
    expect(readNodeType?.argumentMode).toBe('named');
    expect(
      readNodeType?.parameters?.map((parameter) => parameter.name)
    ).toEqual(['nodeType', 'nodeTypeVersion']);

    const readNodesByType = byId.get('authn.node.readNodesByType');
    expect(readNodesByType).toBeDefined();
    expect(readNodesByType?.argumentMode).toBe('named');
    expect(
      readNodesByType?.parameters?.map((parameter) => parameter.name)
    ).toEqual(['nodeType', 'nodeTypeVersion']);

    const readCustomNode = byId.get('authn.node.readCustomNode');
    expect(readCustomNode).toBeDefined();
    expect(readCustomNode?.argumentMode).toBe('named');
    expect(
      readCustomNode?.parameters?.map((parameter) => parameter.name)
    ).toEqual(['nodeId', 'nodeName']);

    const updateAuthenticationSettings = byId.get(
      'authn.settings.updateAuthenticationSettings'
    );
    expect(updateAuthenticationSettings).toBeDefined();
    expect(updateAuthenticationSettings?.argumentMode).toBe('named');
    expect(
      updateAuthenticationSettings?.parameters?.map(
        (parameter) => parameter.name
      )
    ).toEqual(['settings', 'globalConfig']);
  });

  test('exposes explicit idm create/read/update/delete contracts', () => {
    const capabilities = buildCapabilityInventory(frodo, {
      includeTopLevelDomains: ['idm'],
      includeUtils: false,
    });

    const byId = new Map(capabilities.map((cap) => [cap.id, cap]));

    const createConfigEntity = byId.get('idm.config.createConfigEntity');
    expect(createConfigEntity).toBeDefined();
    expect(createConfigEntity?.argumentMode).toBe('named');
    expect(
      createConfigEntity?.parameters?.map((parameter) => parameter.name)
    ).toEqual(['entityId', 'entityData', 'wait']);

    const readConfigEntity = byId.get('idm.config.readConfigEntity');
    expect(readConfigEntity).toMatchObject({
      argumentMode: 'named',
      scope: 'single',
      semanticAliases: expect.arrayContaining([
        'password policy',
        'realm password policy',
      ]),
      parameters: [
        expect.objectContaining({
          name: 'entityId',
        }),
      ],
    });
    expect(readConfigEntity?.parameters?.[0].examples).toBeUndefined();

    const readConfigEntitiesByType = byId.get(
      'idm.config.readConfigEntitiesByType'
    );
    expect(readConfigEntitiesByType).toMatchObject({
      argumentMode: 'named',
      scope: 'bulk',
      semanticAliases: expect.arrayContaining([
        'all password policies',
        'password policies',
      ]),
      parameters: [
        expect.objectContaining({
          name: 'type',
        }),
        expect.objectContaining({ name: 'includeDefault', required: false }),
      ],
    });
    expect(readConfigEntitiesByType?.parameters?.[0].examples).toBeUndefined();

    const readManagedObject = byId.get('idm.managed.readManagedObject');
    expect(readManagedObject).toBeDefined();
    expect(readManagedObject?.argumentMode).toBe('named');
    expect(
      readManagedObject?.parameters?.map((parameter) => parameter.name)
    ).toEqual(['type', 'id', 'fields']);

    const updateManagedObjectsProperties = byId.get(
      'idm.managed.updateManagedObjectsProperties'
    );
    expect(updateManagedObjectsProperties).toBeDefined();
    expect(updateManagedObjectsProperties?.argumentMode).toBe('named');
    expect(
      updateManagedObjectsProperties?.parameters?.map(
        (parameter) => parameter.name
      )
    ).toEqual(['type', 'filter', 'operations', 'rev', 'pageSize']);

    const updateSystemObject = byId.get('idm.system.updateSystemObject');
    expect(updateSystemObject).toBeDefined();
    expect(updateSystemObject?.argumentMode).toBe('named');
    expect(
      updateSystemObject?.parameters?.map((parameter) => parameter.name)
    ).toEqual([
      'systemName',
      'systemObjectType',
      'systemObjectId',
      'systemObjectData',
      'failIfExists',
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

    // Verify summary structure for known gaps
    expect(summary.authn).toBeUndefined();
    expect(summary.oauth2oidc).toBeUndefined();

    // Verify idm gaps
    expect(summary.idm).toBeDefined();
    expect(summary.idm?.total).toBe(1);
    expect(summary.idm?.byOperation).toEqual({ search: 1 });
    expect(summary.idm?.ids).toEqual([
      'idm.managed.queryRelatedManagedObjects',
    ]);
  });

  test('named-argument-mode descriptor parameter positions match the bound method signature', () => {
    // Regression test: idm.managed.createManagedObject once declared
    // parameters in order [type, id, moData], but the bound method's real
    // signature is (type, moData, id = undefined). toInvocationArgs trusts
    // the descriptor's declared `position`s to build a positional call, so
    // that mismatch silently sent id's value where moData was expected (and
    // vice versa) on every dispatch — no error, just a corrupted request.
    // This walks every generic, named-argument-mode descriptor and confirms
    // its declared parameter names, in position order, match the actual
    // bound method's parameter names, in declaration order.
    const capabilities = buildCapabilityInventory(frodo, {
      includeUtils: false,
    });
    const mismatches: string[] = [];

    for (const capability of capabilities) {
      if (capability.kind !== 'generic' || capability.argumentMode !== 'named') {
        continue;
      }
      const parameters = capability.parameters ?? [];
      if (parameters.length < 2) {
        // A single mismatched parameter can't be out of order relative to itself.
        continue;
      }

      let node: unknown = frodo;
      for (const segment of capability.modulePath) {
        if (!node || (typeof node !== 'object' && typeof node !== 'function')) {
          node = undefined;
          break;
        }
        node = (node as Record<string, unknown>)[segment];
      }
      const method =
        node && (typeof node === 'object' || typeof node === 'function')
          ? (node as Record<string, unknown>)[capability.methodName]
          : undefined;
      if (typeof method !== 'function') {
        continue;
      }

      const actualNames = extractParameterNames(
        method as (...args: unknown[]) => unknown
      );
      // Skip methods bound with a single destructured-object parameter —
      // those have no positional slots for a descriptor to misalign with.
      if (actualNames.length !== parameters.length) {
        continue;
      }

      const declaredNames = parameters
        .slice()
        .sort(
          (left, right) =>
            (left.position ?? Number.MAX_SAFE_INTEGER) -
            (right.position ?? Number.MAX_SAFE_INTEGER)
        )
        .map((parameter) => parameter.name);

      const aliases = ACCEPTED_PARAMETER_NAME_ALIASES[capability.id];
      const misalignedIndex = declaredNames.findIndex(
        (declaredName, index) =>
          declaredName !== actualNames[index] &&
          aliases?.[declaredName] !== actualNames[index]
      );
      if (misalignedIndex !== -1) {
        mismatches.push(
          `${capability.id}: descriptor declares [${declaredNames.join(', ')}] but bound method expects [${actualNames.join(', ')}]`
        );
      }
    }

    expect(mismatches).toEqual([]);
  });
});
