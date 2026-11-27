/**
 * Run tests
 *
 *        npm run test:only -- src/mcp/CapabilityRegistry.pullPush
 *
 * What the capability registry does with the two verbs of a file set, `pull` and `push`
 * (https://github.com/rockcarver/frodo-lib/blob/main/decisions/0019-crudq-naming-for-facade-methods-with-pull-and-push.md,
 * pull and push as the CRUDQ names for file sets):
 * - A pull is classed as an `export` and a push as an `import`, so every policy that allows or denies an export or an import
 *   treats them alike: a pull is not mutating and is medium risk, a push writes and is high risk. A name that holds a word of
 *   the sensitive-keyword rule is critical, whatever the verb.
 * - Neither is read-only: the read-only dispatch refuses both, and the presets `read-only` and `agentic` leave out the pull
 *   as well as the push.
 * - Neither is offered on MCP for now: the capability of every pull and push of the facade is `excluded`, so it is in no
 *   inventory and no dispatch reaches it. The walk names the pull or push that has no such entry, so that the next type
 *   cannot forget it.
 *
 * Hermetic: no tenant, no recording; a runtime that is given made-up descriptors.
 */
import { jest } from '@jest/globals';
import { frodo } from '../lib/FrodoLib';
import { facadePaths } from '../test/utils/FileSetTestKit';
import { resolveCapabilityMeta } from './CapabilityMetadata';
import { applyCapabilityPolicy, MCP_POLICY_PRESETS } from './CapabilityPolicy';
import {
  buildCapabilityInventory,
  inferObjectType,
  inferOperationType,
  inferRiskClass,
} from './CapabilityRegistry';
import type { McpCapabilityDescriptor } from './CapabilityTypes';
import { buildToolManifest } from './ToolManifest';
import { createToolRuntime } from './ToolRuntime';

/** The descriptor that the registry would build for a method of the facade, from what it infers. */
function descriptorOf(path: string): McpCapabilityDescriptor {
  const segments = path.split('.');
  const methodName = segments[segments.length - 1];
  const modulePath = segments.slice(0, -1);
  const operationType = inferOperationType(methodName);
  const riskClass = inferRiskClass(operationType, methodName);
  const mutating = operationType === 'import';
  return {
    id: path,
    toolName: `frodo.${path}`,
    methodName,
    modulePath,
    domain: modulePath[0],
    objectType: inferObjectType(methodName, modulePath, operationType),
    operationType,
    kind: 'generic',
    riskClass,
    mutating,
    destructive: false,
    deploymentTypes: ['any'],
    trustTier: 'full-trust',
    requiredScopes: [],
    annotations: {
      readOnlyHint: !mutating,
      destructiveHint: false,
      idempotentHint: operationType === 'export',
      openWorldHint: false,
    },
  };
}

const PULL = 'idm.config.pullKbaConfig';
const PUSH = 'idm.config.pushKbaConfig';

describe('what the registry infers for a pull and a push', () => {
  it('classes a pull as an export and a push as an import', () => {
    expect(inferOperationType('pullKbaConfig')).toBe('export');
    expect(inferOperationType('pushKbaConfig')).toBe('import');
    // the verb is a prefix before a capital, as for the others
    expect(inferOperationType('pulled')).toBe('special');
    expect(inferOperationType('pull')).toBe('special');
    expect(inferOperationType('pushover')).toBe('special');
    expect(inferOperationType('importPush')).toBe('import');
  });

  it('takes the object type from what follows the verb', () => {
    expect(inferObjectType('pullKbaConfig', ['idm', 'config'], 'export')).toBe(
      'KbaConfig'
    );
    expect(inferObjectType('pushKbaConfig', ['idm', 'config'], 'import')).toBe(
      'KbaConfig'
    );
    expect(
      inferObjectType('pullJourneys', ['authn', 'journey'], 'export')
    ).toBe('Journey');
  });

  it('gives a pull the risk of an export, a push the risk of an import, and a sensitive word the risk it always has', () => {
    expect(inferRiskClass('export', 'pullKbaConfig')).toBe('medium');
    expect(inferRiskClass('import', 'pushKbaConfig')).toBe('high');
    expect(inferRiskClass('export', 'pullPasswordPolicies')).toBe('critical');
    expect(inferRiskClass('import', 'pushSecrets')).toBe('critical');
  });

  it.each([
    'secret',
    'password',
    'token',
    'credential',
    'serviceAccount',
    'apiKey',
    'privateKey',
  ])(
    'classes a pull and a push with the word %s in the name as critical',
    (word) => {
      const name = `${word[0].toUpperCase()}${word.slice(1)}Config`;

      expect(inferRiskClass('export', `pull${name}`)).toBe('critical');
      expect(inferRiskClass('import', `push${name}`)).toBe('critical');
      // and the same words are what make them so: without the word the verbs have the risk of an export and of an import
      expect(inferRiskClass('export', 'pullKbaConfig')).toBe('medium');
    }
  );

  it('leaves a pull to the presets that allow an export, and a push to the one that allows everything', () => {
    const pull = descriptorOf(PULL);
    const push = descriptorOf(PUSH);
    const allowed = (preset: keyof typeof MCP_POLICY_PRESETS) =>
      applyCapabilityPolicy([pull, push], MCP_POLICY_PRESETS[preset]).map(
        (descriptor) => descriptor.id
      );

    expect(allowed('read-only')).toEqual([]);
    expect(allowed('agentic')).toEqual([]);
    expect(allowed('standard')).toEqual([PULL]);
    expect(allowed('admin')).toEqual([PULL, PUSH]);
  });
});

describe('the read-only dispatch', () => {
  const runtime = () => {
    const capabilities = [descriptorOf(PULL), descriptorOf(PUSH)];
    return createToolRuntime(
      buildToolManifest(capabilities),
      capabilities,
      frodo,
      {
        resolveFrodoForRequest: () =>
          ({
            login: { getTokens: jest.fn(async () => {}) },
            idm: {
              config: { pullKbaConfig: jest.fn(), pushKbaConfig: jest.fn() },
            },
          }) as never,
      }
    );
  };

  it.each([
    [PULL, 'export'],
    [PUSH, 'import'],
  ])('refuses %s, as an operation of the type %s', async (id, type) => {
    await expect(
      runtime().executeTool({
        toolName: 'frodo_dispatch_read_only',
        arguments: { skillId: id },
        context: { auth: { mode: 'state-config', config: {} } },
      })
    ).rejects.toThrow(`'frodo_dispatch_read_only' cannot execute '${type}'`);
  });
});

describe('what MCP offers', () => {
  it('has neither the pull nor the push of the KBA configuration in the inventory', () => {
    const ids = buildCapabilityInventory(frodo, { includeUtils: false }).map(
      (capability) => capability.id
    );

    expect(ids).toContain('idm.config.readConfigEntity');
    expect(ids).not.toContain(PULL);
    expect(ids).not.toContain(PUSH);
  });

  it.each([PULL, PUSH])('has an entry that excludes %s', (id) => {
    expect(resolveCapabilityMeta(id)?.excluded).toBe(true);
  });

  it('has an entry that excludes every pull and push of the facade, so that the next type cannot forget it', () => {
    const paths = facadePaths(frodo).filter((path) =>
      /^(pull|push)[A-Z]/.test(path.split('.').pop() as string)
    );

    expect(paths).toEqual(expect.arrayContaining([PULL, PUSH]));
    expect(
      paths.filter((path) => resolveCapabilityMeta(path)?.excluded !== true)
    ).toEqual([]);
  });
});
