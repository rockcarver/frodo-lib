/**
 * Unit tests for the comparison of the definitions of the IDM feature `aiagent` with the shipped reference.
 *
 * Run with:
 *
 *        npm run test:only AIAgentFeatureDefinitions.unit
 *
 * Origin: frodo-lib#1060. The registry reads "not installed" when one of the 26 definitions the feature writes
 * differs from the original, however slightly. The comparison names the difference and says whether it is cosmetic
 * (white space, a title, an extra mapping property) or structural. No tenant is needed.
 */
import { healthyManagedConfig, healthyRepoDs } from './AIAgentFeature.fixtures';
import {
  compareAIAgentDefinitions,
  readPath,
  renderPath,
  writePath,
} from './AIAgentFeatureDefinitions';
import {
  AI_AGENT_FEATURE_REFERENCE,
  AI_AGENT_FEATURE_REFERENCE_VERSION,
} from './AIAgentFeatureReference';

const objectOf = (managed: any, name: string) =>
  managed.objects.find((object: any) => object.name === name);

describe('the shipped reference', () => {
  test('describes version 1 and the 26 operations of the feature', () => {
    const reference = AI_AGENT_FEATURE_REFERENCE;
    expect(reference.version).toBe(AI_AGENT_FEATURE_REFERENCE_VERSION);
    expect(Object.keys(reference.managedObjects).sort()).toEqual([
      'alpha_aiagent',
      'alpha_aiagentprivilege',
      'bravo_aiagent',
      'bravo_aiagentprivilege',
    ]);
    expect(
      Object.keys(reference.managedObjects).length +
        reference.schemaAdditions.length +
        reference.orderAdditions.length +
        Object.keys(reference.explicitMappings).length +
        reference.genericMappingProperties.length
    ).toBe(26);
    for (const addition of reference.schemaAdditions) {
      expect(addition.value).toBeDefined();
    }
  });

  test('holds no host name, e-mail address or tenant name', () => {
    // the JSON schema URL of every managed object is the only URL
    const text = JSON.stringify(AI_AGENT_FEATURE_REFERENCE).replaceAll(
      'http://forgerock.org/json-schema#',
      ''
    );
    expect(text).not.toMatch(/forgeblocks|@|openam-|https?:\/\//i);
  });
});

describe('compareAIAgentDefinitions', () => {
  test('a healthy tenant has no difference', () => {
    const result = compareAIAgentDefinitions(
      healthyManagedConfig(),
      healthyRepoDs()
    );
    expect(result.present).toBe(true);
    expect(result.realms).toEqual(['alpha', 'bravo']);
    expect(result.differences).toEqual([]);
  });

  test('a tenant without any definition of the feature never had it installed', () => {
    const result = compareAIAgentDefinitions(
      { objects: [{ name: 'alpha_user', schema: {} }] },
      { resourceMapping: { explicitMapping: {}, genericMapping: {} } }
    );
    expect(result.present).toBe(false);
    expect(result.realms).toEqual([]);
  });

  test('a trailing newline in onDelete.source is cosmetic, class whitespace', () => {
    const managed = healthyManagedConfig();
    objectOf(managed, 'alpha_aiagent').onDelete.source += '\n';
    const { differences } = compareAIAgentDefinitions(managed, healthyRepoDs());
    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatchObject({
      config: 'managed',
      object: 'alpha_aiagent',
      location: 'onDelete.source',
      kind: 'changed',
      cosmetic: true,
      cosmeticClass: 'whitespace',
    });
    expect(differences[0].actual).toBe(
      `${differences[0].expected as string}\n`
    );
  });

  test('a changed schema.title is cosmetic, class title', () => {
    const managed = healthyManagedConfig();
    objectOf(managed, 'alpha_aiagentprivilege').schema.title =
      'AI Agent Privilege';
    const { differences } = compareAIAgentDefinitions(managed, healthyRepoDs());
    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatchObject({
      object: 'alpha_aiagentprivilege',
      location: 'schema.title',
      cosmetic: true,
      cosmeticClass: 'title',
    });
  });

  test('an extra property in an explicit mapping is cosmetic, class extra-mapping-property', () => {
    const repoDs = healthyRepoDs();
    (repoDs.resourceMapping as any).explicitMapping[
      'managed/alpha_aiagentprivilege'
    ].properties.leftover = { type: 'simple', ldapAttribute: 'description' };
    const { differences } = compareAIAgentDefinitions(
      healthyManagedConfig(),
      repoDs
    );
    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatchObject({
      config: 'repo.ds',
      object: 'managed/alpha_aiagentprivilege',
      location: 'properties.leftover',
      kind: 'extra',
      cosmetic: true,
      cosmeticClass: 'extra-mapping-property',
    });
  });

  test('every drift class together is reported, each with its class', () => {
    const managed = healthyManagedConfig();
    objectOf(managed, 'alpha_aiagent').onDelete.source += '\n';
    objectOf(managed, 'bravo_aiagent').onDelete.source += '\n';
    objectOf(managed, 'alpha_aiagentprivilege').schema.title = 'x';
    const repoDs = healthyRepoDs();
    (repoDs.resourceMapping as any).explicitMapping[
      'managed/bravo_aiagent'
    ].properties.leftover = {};
    const { differences } = compareAIAgentDefinitions(managed, repoDs);
    expect(differences.map((d) => d.cosmeticClass).sort()).toEqual([
      'extra-mapping-property',
      'title',
      'whitespace',
      'whitespace',
    ]);
    expect(differences.every((d) => d.cosmetic)).toBe(true);
  });

  test('an extra property in a managed object schema is structural', () => {
    const managed = healthyManagedConfig();
    objectOf(managed, 'alpha_aiagent').schema.properties.custom = {
      type: 'string',
    };
    const { differences } = compareAIAgentDefinitions(managed, healthyRepoDs());
    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatchObject({
      location: 'schema.properties.custom',
      kind: 'extra',
      cosmetic: false,
    });
  });

  test('a changed value that is not white space is structural', () => {
    const managed = healthyManagedConfig();
    objectOf(managed, 'bravo_aiagent').onDelete.source = 'return;';
    const { differences } = compareAIAgentDefinitions(managed, healthyRepoDs());
    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatchObject({ kind: 'changed', cosmetic: false });
  });

  test('a missing managed object is structural and named', () => {
    const managed = healthyManagedConfig();
    managed.objects = managed.objects.filter(
      (object) => object.name !== 'bravo_aiagentprivilege'
    );
    const { differences, present } = compareAIAgentDefinitions(
      managed,
      healthyRepoDs()
    );
    expect(present).toBe(true);
    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatchObject({
      config: 'managed',
      object: 'bravo_aiagentprivilege',
      kind: 'missing',
      cosmetic: false,
    });
  });

  test('a missing property addition on a base object is structural', () => {
    const managed = healthyManagedConfig();
    delete objectOf(managed, 'alpha_group').schema.properties.aiagentprivileges;
    const { differences } = compareAIAgentDefinitions(managed, healthyRepoDs());
    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatchObject({
      object: 'alpha_group',
      location: 'schema.properties.aiagentprivileges',
      kind: 'missing',
      cosmetic: false,
    });
  });

  test('a value missing from schema.order is structural', () => {
    const managed = healthyManagedConfig();
    const group = objectOf(managed, 'bravo_group');
    group.schema.order = group.schema.order.filter(
      (name: string) => name !== 'aiagentprivileges'
    );
    const { differences } = compareAIAgentDefinitions(managed, healthyRepoDs());
    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatchObject({
      object: 'bravo_group',
      location: 'schema.order',
      kind: 'missing',
      cosmetic: false,
    });
  });

  test('a missing repo.ds explicit mapping and a missing generic mapping property are structural', () => {
    const repoDs = healthyRepoDs();
    delete (repoDs.resourceMapping as any).explicitMapping[
      'managed/alpha_aiagent'
    ];
    delete (repoDs.resourceMapping as any).genericMapping[
      'managed/bravo_application'
    ].properties.aiagentprivileges;
    const { differences } = compareAIAgentDefinitions(
      healthyManagedConfig(),
      repoDs
    );
    expect(differences.map((d) => `${d.object} ${d.kind}`).sort()).toEqual([
      'managed/alpha_aiagent missing',
      'managed/bravo_application missing',
    ]);
    expect(differences.every((d) => !d.cosmetic)).toBe(true);
  });

  test('objects are found by name, whatever their position in the list', () => {
    const managed = healthyManagedConfig();
    managed.objects.reverse();
    const { differences } = compareAIAgentDefinitions(managed, healthyRepoDs());
    expect(differences).toEqual([]);
  });

  test('realms are the ones that have the managed object <realm>_aiagent', () => {
    const managed = healthyManagedConfig();
    managed.objects = managed.objects.filter(
      (object) => object.name !== 'bravo_aiagent'
    );
    expect(compareAIAgentDefinitions(managed, healthyRepoDs()).realms).toEqual([
      'alpha',
    ]);
  });
});

describe('paths', () => {
  test('renderPath, readPath and writePath agree on keys and indexes', () => {
    const path = ['schema', 'items', 0, 'notify'];
    expect(renderPath(path)).toBe('schema.items[0].notify');
    const root: Record<string, unknown> = {};
    writePath(root, path, true);
    expect(root).toEqual({ schema: { items: { 0: { notify: true } } } });
    expect(readPath(root, path)).toBe(true);
    writePath(root, path, undefined);
    expect(readPath(root, path)).toBeUndefined();
    expect(readPath(undefined, path)).toBeUndefined();
  });
});
