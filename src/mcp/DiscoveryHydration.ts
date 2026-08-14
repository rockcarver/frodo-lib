import { Frodo, frodo } from '../lib/FrodoLib';
import {
  McpCatalogHydrationStatus,
  McpDiscoveryContext,
  McpDiscoveryTarget,
} from './ToolManifest';

const DEFAULT_DISCOVERY_HYDRATION_TIMEOUT_MS = 3000;

export type McpDiscoveryHydrationCatalog =
  | 'managed-object-types'
  | 'config-entity-ids';

export type McpDiscoveryHydrationEvent = {
  catalog: McpDiscoveryHydrationCatalog;
  status: McpCatalogHydrationStatus;
  count: number;
  error?: unknown;
};

export type McpDiscoveryHydrationOptions = {
  frodoInstance?: Frodo;
  timeoutMs?: number;
  activeTarget?: McpDiscoveryTarget;
  onEvent?: (event: McpDiscoveryHydrationEvent) => void;
};

type CatalogHydrationResult = {
  values: string[];
  status: McpCatalogHydrationStatus;
};

/**
 * Hydrates tenant catalogs used by MCP discovery and semantic skill matching.
 * Catalog failures are isolated so service construction can continue.
 */
export async function hydrateMcpDiscoveryContext(
  options: McpDiscoveryHydrationOptions = {}
): Promise<McpDiscoveryContext> {
  const frodoInstance = options.frodoInstance ?? frodo;
  const deploymentType = frodoInstance.state.getDeploymentType();
  const activeTarget = options.activeTarget
    ? { ...options.activeTarget }
    : undefined;
  if (deploymentType !== 'cloud' && deploymentType !== 'forgeops') {
    options.onEvent?.({
      catalog: 'managed-object-types',
      status: 'not-applicable',
      count: 0,
    });
    options.onEvent?.({
      catalog: 'config-entity-ids',
      status: 'not-applicable',
      count: 0,
    });
    return {
      managedObjectTypes: [],
      managedObjectHydrationStatus: 'not-applicable',
      configEntityIds: [],
      configEntityHydrationStatus: 'not-applicable',
      ...(activeTarget && { activeTarget }),
    };
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_DISCOVERY_HYDRATION_TIMEOUT_MS;
  const [managedObjects, configEntities] = await Promise.all([
    hydrateCatalog(
      'managed-object-types',
      () => frodoInstance.idm.config.readManagedObjectTypes(),
      timeoutMs,
      options.onEvent
    ),
    hydrateCatalog(
      'config-entity-ids',
      async () =>
        (await frodoInstance.idm.config.readConfigEntityStubs())
          .map((stub) => stub._id)
          .filter(Boolean),
      timeoutMs,
      options.onEvent
    ),
  ]);

  return {
    managedObjectTypes: managedObjects.values,
    managedObjectHydrationStatus: managedObjects.status,
    configEntityIds: configEntities.values,
    configEntityHydrationStatus: configEntities.status,
    ...(activeTarget && { activeTarget }),
  };
}

async function hydrateCatalog(
  catalog: McpDiscoveryHydrationCatalog,
  read: () => Promise<string[]>,
  timeoutMs: number,
  onEvent?: (event: McpDiscoveryHydrationEvent) => void
): Promise<CatalogHydrationResult> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const values = await Promise.race([
      read(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('MCP discovery hydration timed out.')),
          timeoutMs
        );
      }),
    ]);
    onEvent?.({ catalog, status: 'available', count: values.length });
    return { values, status: 'available' };
  } catch (error) {
    const status =
      error instanceof Error &&
      error.message === 'MCP discovery hydration timed out.'
        ? 'timed-out'
        : 'failed';
    onEvent?.({ catalog, status, count: 0, error });
    return { values: [], status };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
