import { jest } from '@jest/globals';
import * as root from './index';
import type { TerminalContrastFilter } from './index';
import type { Frodo } from './lib/FrodoLib';
import { buildToolManifest } from './mcp/ToolManifest';

const legacyRootValues = [
  'MCP_POLICY_PRESETS',
  'applyCapabilityPolicy',
  'describeCapabilityRouting',
  'rankCapabilitiesForDeployment',
  'hydrateMcpDiscoveryContext',
  'MCP_AMBIGUOUS_OBJECT_CONCEPTS',
  'MCP_SEMANTIC_OBJECT_SYNONYMS',
  'descriptorPatternsSupportFamily',
  'discoverManagedObjectFamilies',
  'matchManagedObjectFamily',
  'normalizeSemanticObjectFamily',
  'resolveSemanticObjectFamily',
  'MCP_SEMANTIC_TERM_SYNONYMS',
  'matchSemanticIdentifiers',
  'normalizeSemanticIdentifier',
  'capabilityMatchesAnyProfile',
  'capabilityMatchesDisabled',
  'getMcpProfileDefinition',
  'listAllMcpProfiles',
  'listMcpProfiles',
  'resolveMcpProfileSelection',
  'FORGEOPS_DOMAIN_PRODUCT_MAP',
  'classifyDomainProduct',
  'parseAmDocsVersion',
  'parseIdmDocsVersion',
  'resolveDocsContext',
  'buildCapabilityInventory',
  'inferObjectType',
  'inferOperationType',
  'inferRiskClass',
  'buildToolManifest',
  'createToolRuntime',
  'getRealmFromContext',
  'resolveRequestScopedFrodo',
  'composeCapabilityPolicy',
  'createMcpService',
  'theme',
  'themeForMode',
  'resolveThemeMode',
  'FRODO_COLOR_THEME_ENV_KEY',
  'contrastRatio',
  'TerminalContrastFilter',
  'ALL_ANSI_COLOR_NAMES',
  'detectTerminalBackgroundRgb',
  'matchBackgroundPreset',
  'buildManagedObjectSchemaPropertyPayload',
  'extractManagedObjectSchemaPropertyFields',
  'MANAGED_OBJECT_SCHEMA_CREATABLE_PROPERTY_TYPES',
  'navigatePropertyPath',
  'navigateToPropertyContainer',
  'parseSubPropertyPath',
  'removeSchemaProperty',
  'setSchemaProperty',
  'buildManagedObjectTypeSchema',
  'MANAGED_OBJECT_TYPE_DEFAULT_ICON',
  'buildManagedObjectSchemaRelationshipPropertyPayload',
  'extractManagedObjectSchemaRelationshipPropertyFields',
  'inferManagedObjectSchemaRelationshipReverseIdentity',
  'toManagedObjectSchemaRelationshipReverseFields',
];

describe('deprecated root API compatibility', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('keeps every deprecated root value export available', () => {
    expect(Object.keys(root)).toEqual(expect.arrayContaining(legacyRootValues));
  });

  test('keeps TerminalContrastFilter usable as both a value and a type', () => {
    const filter: TerminalContrastFilter = new root.TerminalContrastFilter(
      'black'
    );
    expect(filter).toBeInstanceOf(root.TerminalContrastFilter);
  });

  test('root MCP adapters use the singleton by default and accept explicit instances', async () => {
    const defaultCreateInstance = jest
      .spyOn(root.frodo, 'createInstance')
      .mockReturnValue({
        state: { getDeploymentType: () => 'classic' },
        login: { getTokens: jest.fn(async () => {}) },
        authn: { journey: { readJourney: jest.fn(async () => 'default') } },
      } as unknown as Frodo);
    jest
      .spyOn(root.frodo.authn.journey, 'readJourney')
      .mockImplementation(async () => 'default' as never);

    const defaultService = root.createMcpService({
      inventoryOptions: { includeTopLevelDomains: ['authn'] },
      policyPreset: 'read-only',
    });
    await defaultService.executeTool({
      toolName: 'frodo_dispatch_read_only',
      arguments: {
        skillId: 'authn.journey.readJourney',
        positionalArgs: ['id'],
      },
      context: {
        auth: {
          mode: 'state-config',
          config: { host: 'https://example.test' },
        },
      },
    });
    expect(defaultCreateInstance).toHaveBeenCalledWith({
      host: 'https://example.test',
    });
    defaultCreateInstance.mockRestore();
    const explicitRoot = root.frodo.createInstance({
      host: 'https://explicit.test',
    });
    const explicitCreateInstance = jest
      .spyOn(explicitRoot, 'createInstance')
      .mockReturnValue({
        state: { getDeploymentType: () => 'classic' },
        login: { getTokens: jest.fn(async () => {}) },
        authn: { journey: { readJourney: jest.fn(async () => 'explicit') } },
      } as unknown as Frodo);
    jest
      .spyOn(explicitRoot.authn.journey, 'readJourney')
      .mockImplementation(async () => 'explicit' as never);
    const explicitService = root.createMcpService({
      frodoInstance: explicitRoot,
      inventoryOptions: { includeTopLevelDomains: ['authn'] },
      policyPreset: 'read-only',
    });
    await explicitService.executeTool({
      toolName: 'frodo_dispatch_read_only',
      arguments: {
        skillId: 'authn.journey.readJourney',
        positionalArgs: ['id'],
      },
      context: {
        auth: {
          mode: 'state-config',
          config: { host: 'https://example.test' },
        },
      },
    });
    expect(explicitCreateInstance).toHaveBeenCalledWith({
      host: 'https://example.test',
    });
  });

  test('hydrate and request-scoped adapters accept default and explicit roots', async () => {
    const explicitRoot = root.frodo.createInstance({
      host: 'https://explicit.test',
      deploymentType: 'classic',
    });
    const singletonDeployment = jest.spyOn(
      root.frodo.state,
      'getDeploymentType'
    );
    const explicitDeployment = jest.spyOn(
      explicitRoot.state,
      'getDeploymentType'
    );

    await root.hydrateMcpDiscoveryContext();
    await root.hydrateMcpDiscoveryContext({ frodoInstance: explicitRoot });
    expect(singletonDeployment).toHaveBeenCalled();
    expect(explicitDeployment).toHaveBeenCalled();
    singletonDeployment.mockRestore();
    explicitDeployment.mockRestore();

    const defaultFactory = jest
      .spyOn(root.frodo, 'createInstance')
      .mockReturnValue({ marker: 'default' } as unknown as Frodo);
    expect(
      root.resolveRequestScopedFrodo({
        auth: { mode: 'state-config', config: {} },
      })
    ).toEqual({ marker: 'default' });
    expect(defaultFactory).toHaveBeenCalled();
    defaultFactory.mockRestore();

    const explicitFactory = jest
      .spyOn(explicitRoot, 'createInstance')
      .mockReturnValue({ marker: 'explicit' } as unknown as Frodo);
    expect(
      root.resolveRequestScopedFrodo(
        { auth: { mode: 'state-config', config: {} } },
        explicitRoot
      )
    ).toEqual({ marker: 'explicit' });
    expect(explicitFactory).toHaveBeenCalled();
  });

  test('createToolRuntime adapter accepts default and explicit roots', async () => {
    const manifest = buildToolManifest([]);
    const scopedInstance = {
      state: {
        getDeploymentType: () => 'classic',
        getAmVersion: () => undefined,
        getIdmVersion: () => undefined,
      },
      login: { getTokens: jest.fn(async () => {}) },
    } as unknown as Frodo;
    let resolvedRoot: Frodo | undefined;
    const defaultRuntime = root.createToolRuntime(manifest, [], {
      resolveFrodoForRequest: (_context, frodoRoot) => {
        resolvedRoot = frodoRoot;
        return scopedInstance;
      },
    });
    await defaultRuntime.executeTool({
      toolName: 'frodo_discover',
      context: {
        auth: {
          mode: 'state-config',
          config: { host: 'https://tenant.test' },
        },
      },
    });
    expect(resolvedRoot).toBe(root.frodo);

    const explicitRoot = root.frodo.createInstance({
      host: 'https://explicit.test',
    });
    let explicitResolvedRoot: Frodo | undefined;
    const explicitRuntime = root.createToolRuntime(manifest, [], {
      frodoRoot: explicitRoot,
      resolveFrodoForRequest: (_context, frodoRoot) => {
        explicitResolvedRoot = frodoRoot;
        return scopedInstance;
      },
    });
    await explicitRuntime.executeTool({
      toolName: 'frodo_discover',
      context: {
        auth: {
          mode: 'state-config',
          config: { host: 'https://tenant.test' },
        },
      },
    });
    expect(explicitResolvedRoot).toBe(explicitRoot);
  });
});
