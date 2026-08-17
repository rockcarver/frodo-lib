import { jest } from '@jest/globals';

import { hydrateMcpDiscoveryContext } from '../index';

describe('MCP discovery hydration', () => {
  test('hydrates both live catalogs concurrently', async () => {
    const onEvent = jest.fn();
    const context = await hydrateMcpDiscoveryContext({
      frodoInstance: {
        state: { getDeploymentType: () => 'cloud' },
        idm: {
          config: {
            readManagedObjectTypes: jest.fn(async () => ['alpha_user']),
            readConfigEntityStubs: jest.fn(async () => [
              { _id: 'alphaOrgPrivileges' },
              { _id: 'fieldPolicy/alpha_user' },
            ]),
          },
        },
      } as any,
      activeTarget: { host: 'https://example.test', profile: 'all' },
      onEvent,
    });

    expect(context).toEqual({
      managedObjectTypes: ['alpha_user'],
      managedObjectHydrationStatus: 'available',
      configEntityIds: ['alphaOrgPrivileges', 'fieldPolicy/alpha_user'],
      configEntityHydrationStatus: 'available',
      activeTarget: { host: 'https://example.test', profile: 'all' },
    });
    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  test('isolates catalog failures', async () => {
    const context = await hydrateMcpDiscoveryContext({
      frodoInstance: {
        state: { getDeploymentType: () => 'forgeops' },
        idm: {
          config: {
            readManagedObjectTypes: jest.fn(async () => ['alpha_user']),
            readConfigEntityStubs: jest.fn(async () => {
              throw new Error('unavailable');
            }),
          },
        },
      } as any,
    });

    expect(context.managedObjectTypes).toEqual(['alpha_user']);
    expect(context.managedObjectHydrationStatus).toBe('available');
    expect(context.configEntityIds).toEqual([]);
    expect(context.configEntityHydrationStatus).toBe('failed');
  });

  test('bounds catalog hydration with the configured timeout', async () => {
    const context = await hydrateMcpDiscoveryContext({
      frodoInstance: {
        state: { getDeploymentType: () => 'cloud' },
        idm: {
          config: {
            readManagedObjectTypes: () => new Promise<string[]>(() => {}),
            readConfigEntityStubs: () => new Promise<never>(() => {}),
          },
        },
      } as any,
      timeoutMs: 1,
    });

    expect(context.managedObjectHydrationStatus).toBe('timed-out');
    expect(context.configEntityHydrationStatus).toBe('timed-out');
  });

  test('skips IDM catalogs for non-IDM deployments', async () => {
    const readManagedObjectTypes = jest.fn();
    const readConfigEntityStubs = jest.fn();
    const context = await hydrateMcpDiscoveryContext({
      frodoInstance: {
        state: { getDeploymentType: () => 'classic' },
        idm: {
          config: { readManagedObjectTypes, readConfigEntityStubs },
        },
      } as any,
    });

    expect(context.managedObjectHydrationStatus).toBe('not-applicable');
    expect(context.configEntityHydrationStatus).toBe('not-applicable');
    expect(readManagedObjectTypes).not.toHaveBeenCalled();
    expect(readConfigEntityStubs).not.toHaveBeenCalled();
  });
});
