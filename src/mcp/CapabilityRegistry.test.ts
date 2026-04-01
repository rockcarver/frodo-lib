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
});
