import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';
import { frodo, frodo as instance0, state as state0 } from '../index';
import type { McpServiceOptions } from '../index';
import Constants from '../shared/Constants';
import { autoSetupPolly } from '../utils/AutoSetupPolly';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

autoSetupPolly();

const host0 = 'https://instance0/am';
const host1 = 'https://instance1/am';
const host2 = 'https://instance2/am';

describe('FrodoLib', () => {
  test('exposes terminal, managed schema, and MCP helpers through the facade', () => {
    expect(frodo.utils.terminal).toEqual(
      expect.objectContaining({
        theme: expect.any(Function),
        themeForMode: expect.any(Function),
        resolveThemeMode: expect.any(Function),
        FRODO_COLOR_THEME_ENV_KEY: expect.any(String),
        contrastRatio: expect.any(Function),
        TerminalContrastFilter: expect.any(Function),
        ALL_ANSI_COLOR_NAMES: expect.any(Array),
        detectTerminalBackgroundRgb: expect.any(Function),
        matchBackgroundPreset: expect.any(Function),
      })
    );

    expect(frodo.idm.managed.schema).toEqual(
      expect.objectContaining({
        buildManagedObjectSchemaPropertyPayload: expect.any(Function),
        extractManagedObjectSchemaPropertyFields: expect.any(Function),
        MANAGED_OBJECT_SCHEMA_CREATABLE_PROPERTY_TYPES: expect.any(Array),
        setSchemaProperty: expect.any(Function),
        removeSchemaProperty: expect.any(Function),
        parseSubPropertyPath: expect.any(Function),
        navigateToPropertyContainer: expect.any(Function),
        navigatePropertyPath: expect.any(Function),
        buildManagedObjectTypeSchema: expect.any(Function),
        MANAGED_OBJECT_TYPE_DEFAULT_ICON: expect.any(String),
        buildManagedObjectSchemaRelationshipPropertyPayload:
          expect.any(Function),
        extractManagedObjectSchemaRelationshipPropertyFields:
          expect.any(Function),
        toManagedObjectSchemaRelationshipReverseFields: expect.any(Function),
        inferManagedObjectSchemaRelationshipReverseIdentity:
          expect.any(Function),
      })
    );

    expect(Object.keys(frodo.mcp).sort()).toEqual(
      [
        'buildCapabilityInventory',
        'createService',
        'getRealmFromContext',
        'hydrateDiscoveryContext',
        'listProfiles',
        'policyPresets',
        'resolveProfileSelection',
        'resolveRequestScopedFrodo',
      ].sort()
    );
  });

  test('binds MCP service construction to the instance that created it', async () => {
    const instance = frodo.createInstance({ host: 'https://instance1/am' });
    const readJourney = jest.fn(async (journeyId: string) => ({
      id: journeyId,
      found: true,
    }));
    const scopedInstance = {
      login: { getTokens: jest.fn(async () => {}) },
      authn: { journey: { readJourney } },
    };
    const createInstance = jest
      .spyOn(instance, 'createInstance')
      .mockReturnValue(scopedInstance as any);
    instance.authn.journey.readJourney = readJourney;

    const service = instance.mcp.createService({
      inventoryOptions: { includeTopLevelDomains: ['authn'] },
      policyPreset: 'read-only',
    });
    const result = await service.executeTool({
      toolName: 'frodo_dispatch_read_only',
      arguments: {
        skillId: 'authn.journey.readJourney',
        positionalArgs: ['journey-123'],
      },
      context: {
        auth: {
          mode: 'state-config',
          config: { host: 'https://tenant.example/am' },
        },
      },
    });

    expect(createInstance).toHaveBeenCalledWith({
      host: 'https://tenant.example/am',
    });
    expect(readJourney).toHaveBeenCalledWith('journey-123');
    expect(result.data).toEqual({ id: 'journey-123', found: true });
  });

  test('binds MCP discovery hydration to the facade instance', async () => {
    const instance = frodo.createInstance({ host: 'https://instance1/am' });
    const rootDeployment = jest
      .spyOn(frodo.state, 'getDeploymentType')
      .mockReturnValue('classic');
    const instanceDeployment = jest
      .spyOn(instance.state, 'getDeploymentType')
      .mockReturnValue('classic');

    await frodo.mcp.hydrateDiscoveryContext();
    await instance.mcp.hydrateDiscoveryContext();

    expect(rootDeployment).toHaveBeenCalledTimes(1);
    expect(instanceDeployment).toHaveBeenCalledTimes(1);
    rootDeployment.mockRestore();
    instanceDeployment.mockRestore();
  });

  test('binds MCP inventory construction to the facade instance', () => {
    const instance = frodo.createInstance({ host: 'https://instance1/am' });
    Object.defineProperty(instance.authn.journey, 'readInstanceBindingProbe', {
      value: jest.fn(),
      enumerable: true,
    });

    const rootInventory = frodo.mcp.buildCapabilityInventory({
      includeTopLevelDomains: ['authn'],
    });
    const instanceInventory = instance.mcp.buildCapabilityInventory({
      includeTopLevelDomains: ['authn'],
    });

    expect(rootInventory.map(({ id }) => id)).toContain(
      'authn.journey.readJourney'
    );
    expect(rootInventory.map(({ id }) => id)).not.toContain(
      'authn.journey.readInstanceBindingProbe'
    );
    expect(instanceInventory.map(({ id }) => id)).toContain(
      'authn.journey.readInstanceBindingProbe'
    );
  });

  test('binds request-scoped resolution to the facade instance', () => {
    const instance = frodo.createInstance({ host: 'https://instance1/am' });
    const rootScoped = { marker: 'root' } as any;
    const instanceScoped = { marker: 'instance' } as any;
    const rootCreateInstance = jest
      .spyOn(frodo, 'createInstance')
      .mockReturnValue(rootScoped);
    const instanceCreateInstance = jest
      .spyOn(instance, 'createInstance')
      .mockReturnValue(instanceScoped);
    const context = {
      auth: {
        mode: 'state-config' as const,
        config: { host: 'https://tenant/am' },
      },
    };

    expect(frodo.mcp.resolveRequestScopedFrodo(context)).toBe(rootScoped);
    expect(instance.mcp.resolveRequestScopedFrodo(context)).toBe(
      instanceScoped
    );
    expect(rootCreateInstance).toHaveBeenCalledWith(context.auth.config);
    expect(instanceCreateInstance).toHaveBeenCalledWith(context.auth.config);
    rootCreateInstance.mockRestore();
    instanceCreateInstance.mockRestore();
  });

  test('MCP service options do not accept an instance override', () => {
    // @ts-expect-error The facade instance is selected by its receiver.
    const options: McpServiceOptions = { frodoInstance: frodo };
    expect(options).toEqual({ frodoInstance: frodo });
  });

  test('exposes journey validation through the Frodo facade', () => {
    const journey = frodo.authn.journey.createSingleTreeExportTemplate();
    journey.tree._id = 'InvalidJourney';
    journey.tree.entryNodeId = 'missing-entry';
    journey.tree.nodes = {};
    const multiJourney = frodo.authn.journey.createMultiTreeExportTemplate();
    multiJourney.trees.InvalidJourney = journey;

    return expect(
      frodo.authn.journey.validateJourneys([], multiJourney)
    ).resolves.toMatchObject([
      { code: 'MISSING_ENTRY_NODE', journeyId: 'InvalidJourney' },
    ]);
  });

  test(`frodo.createInstance(): FrodoLib is instantiable using factory function`, async () => {
    state0.setHost('https://instance0/am');
    const instance1 = frodo.createInstance({
      host: 'https://instance1/am',
    });
    const instance2 = frodo.createInstance({
      host: 'https://instance2/am',
    });
    expect(instance0.state.getHost()).toEqual(host0);
    expect(instance1.state.getHost()).toEqual(host1);
    expect(instance2.state.getHost()).toEqual(host2);
  });

  test(`frodo.createInstanceWithAdminAccount(): FrodoLib is instantiable using factory helper`, async () => {
    state0.setHost('https://instance0/am');
    const instance1 = frodo.createInstanceWithAdminAccount(
      'https://instance1/am',
      'admin1',
      'password1'
    );
    const instance2 = frodo.createInstanceWithAdminAccount(
      'https://instance2/am',
      'admin2',
      'password2'
    );
    expect(instance0.state.getHost()).toEqual(host0);
    expect(instance1.state.getHost()).toEqual(host1);
    expect(instance1.state.getUsername()).toEqual('admin1');
    expect(instance1.state.getPassword()).toEqual('password1');
    expect(instance2.state.getHost()).toEqual(host2);
    expect(instance2.state.getUsername()).toEqual('admin2');
    expect(instance2.state.getPassword()).toEqual('password2');
  });

  test(`frodo.createInstanceWithServiceAccount(): FrodoLib is instantiable using factory helper`, async () => {
    state0.setHost('https://instance0/am');
    const instance1 = frodo.createInstanceWithServiceAccount(
      'https://instance1/am',
      'serviceAccount1',
      '{"k":"jwk1"}'
    );
    const instance2 = frodo.createInstanceWithServiceAccount(
      'https://instance2/am',
      'serviceAccount2',
      '{"k":"jwk2"}'
    );
    expect(instance0.state.getHost()).toEqual(host0);
    expect(instance1.state.getHost()).toEqual(host1);
    expect(instance1.state.getServiceAccountId()).toEqual('serviceAccount1');
    expect(instance1.state.getServiceAccountJwk()).toMatchObject(
      JSON.parse('{"k":"jwk1"}')
    );
    expect(instance2.state.getHost()).toEqual(host2);
    expect(instance2.state.getServiceAccountId()).toEqual('serviceAccount2');
    expect(instance2.state.getServiceAccountJwk()).toMatchObject(
      JSON.parse('{"k":"jwk2"}')
    );
  });

  test(`frodo.createInstanceWithAmsterAccount(): FrodoLib is instantiable using factory helper`, async () => {
    const privateKey1 = fs.readFileSync(
      path.resolve(__dirname, '../test/mocks/CryptoUtils/pkcs8Rsa.pem'),
      'utf8'
    );
    const privateKey2 = fs.readFileSync(
      path.resolve(__dirname, '../test/mocks/CryptoUtils/pkcs1Rsa.pem'),
      'utf8'
    );
    const customAmsterService = 'AmsterLogin';
    state0.setHost('https://instance0/am');
    const instance1 = frodo.createInstanceWithAmsterAccount(
      'https://instance1/am',
      privateKey1
    );
    const instance2 = frodo.createInstanceWithAmsterAccount(
      'https://instance2/am',
      privateKey2,
      customAmsterService
    );
    expect(instance0.state.getHost()).toEqual(host0);
    expect(instance1.state.getHost()).toEqual(host1);
    expect(instance1.state.getAmsterPrivateKey()).toEqual(privateKey1);
    expect(instance1.state.getAuthenticationService()).toEqual(
      Constants.DEFAULT_AMSTER_SERVICE
    );
    expect(instance2.state.getHost()).toEqual(host2);
    expect(instance2.state.getAmsterPrivateKey()).toEqual(privateKey2);
    expect(instance2.state.getAuthenticationService()).toEqual(
      customAmsterService
    );
  });

  test(`frodo.createInstanceWithBrowserLogin(): FrodoLib is instantiable using factory helper`, async () => {
    state0.setHost('https://instance0/am');
    const instance1 = frodo.createInstanceWithBrowserLogin(
      'https://instance1/am',
      'client1',
      'openid fr:idm:*',
      'http://127.0.0.1:54321/callback'
    );
    const instance2 = frodo.createInstanceWithBrowserLogin(
      'https://instance2/am',
      'client2'
    );
    expect(instance0.state.getHost()).toEqual(host0);
    expect(instance1.state.getHost()).toEqual(host1);
    expect(instance1.state.getAuthMode()).toEqual('interactive');
    expect(instance1.state.getBrowserLoginClientId()).toEqual('client1');
    expect(instance1.state.getBrowserLoginScope()).toEqual('openid fr:idm:*');
    expect(instance1.state.getAdminClientRedirectUri()).toEqual(
      'http://127.0.0.1:54321/callback'
    );
    expect(instance1.state.getUsername()).toBeFalsy();
    expect(instance1.state.getPassword()).toBeFalsy();
    expect(instance2.state.getHost()).toEqual(host2);
    expect(instance2.state.getAuthMode()).toEqual('interactive');
    expect(instance2.state.getBrowserLoginClientId()).toEqual('client2');
  });
});
