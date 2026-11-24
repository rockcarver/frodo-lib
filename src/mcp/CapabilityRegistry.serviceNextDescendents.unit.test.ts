import { frodo } from '../lib/FrodoLib';
import { buildCapabilityInventory } from './CapabilityRegistry';

/**
 * The two methods that delete next descendents of a service reach MCP callers
 * as destructive capabilities of high risk, and the plural one does not offer
 * its result callback (a function cannot be part of a JSON payload).
 * Unit test: no recordings, no tenant.
 */
describe('the next-descendent deletes of frodo.service in the capability registry', () => {
  const inventory = buildCapabilityInventory(frodo, {
    includeUtils: false,
  } as any);
  const capability = (id: string) => inventory.find((entry) => entry.id === id);

  test.each([
    ['service.deleteServiceNextDescendent', 'deleteServiceNextDescendent'],
    ['service.deleteServiceNextDescendents', 'deleteServiceNextDescendents'],
  ])('%s is a mutating delete of high risk', (id, methodName) => {
    const entry = capability(id);

    expect(entry).toBeDefined();
    expect(typeof (frodo.service as any)[methodName]).toBe('function');
    expect(entry.operationType).toBe('delete');
    expect(entry.mutating).toBe(true);
    expect(entry.riskClass).toBe('high');
    expect(entry.notes).toContain('leaves the service in place');
  });

  test('the singular one takes the service, the descendent name and the scope', () => {
    expect(
      capability('service.deleteServiceNextDescendent').parameters.map(
        (parameter) => [parameter.name, !!parameter.required]
      )
    ).toEqual([
      ['serviceId', true],
      ['nextDescendentName', true],
      ['globalConfig', false],
    ]);
  });

  test('the plural one takes the service and the scope, and offers no callback', () => {
    expect(
      capability('service.deleteServiceNextDescendents').parameters.map(
        (parameter) => [parameter.name, !!parameter.required]
      )
    ).toEqual([
      ['serviceId', true],
      ['globalConfig', false],
    ]);
  });
});
