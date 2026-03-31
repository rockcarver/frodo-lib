/**
 * Builds MCP capability inventory records from a Frodo instance.
 *
 * @remarks
 * This module is a transitional registry helper. It provides deterministic
 * discovery and normalization so downstream MCP runtime code can consume a stable
 * descriptor shape while the library evolves toward richer metadata-driven
 * manifests.
 */

import { Frodo } from '../lib/FrodoLib';
import {
  McpCapabilityDescriptor,
  McpCapabilityInventoryOptions,
  McpCapabilityKind,
  McpCapabilityOperationType,
  McpCapabilityRiskClass,
  McpToolAnnotations,
} from './CapabilityTypes';

/** Top-level domain keys excluded from the capability inventory by default. */
const DEFAULT_EXCLUDED_TOP_LEVEL_DOMAINS = new Set<string>(['state']);

/**
 * Frodo instance factory helpers that should never appear as MCP tools.
 * These produce new Frodo instances rather than operating on managed objects.
 */
const DEFAULT_INSTANCE_HELPERS = new Set<string>([
  'createInstance',
  'createInstanceWithAdminAccount',
  'createInstanceWithServiceAccount',
  'createInstanceWithAmsterAccount',
]);

/**
 * Produces a normalized capability inventory by walking the provided Frodo
 * instance and inferring operation metadata from method signatures and names.
 *
 * @param frodo Frodo instance to inspect.
 * @param options Optional inventory filters.
 * @returns Sorted capability descriptors ready for policy filtering.
 */
export function buildCapabilityInventory(
  frodo: Frodo,
  options: McpCapabilityInventoryOptions = {}
): McpCapabilityDescriptor[] {
  const includeTopLevelDomains =
    options.includeTopLevelDomains && options.includeTopLevelDomains.length
      ? new Set(options.includeTopLevelDomains)
      : undefined;
  const excludeTopLevelDomains = new Set<string>([
    ...DEFAULT_EXCLUDED_TOP_LEVEL_DOMAINS,
    ...(options.excludeTopLevelDomains || []),
  ]);
  if (options.includeUtils === false) {
    excludeTopLevelDomains.add('utils');
  }

  const descriptors: McpCapabilityDescriptor[] = [];
  const visited = new WeakSet<object>();

  /**
   * Recursively walks a node of the Frodo object graph, collecting descriptors
   * for every function encountered. Cycles are broken via a WeakSet.
   *
   * @param node Current node being inspected.
   * @param path Dot-separated path segments from the Frodo root to this node.
   */
  const walk = (node: unknown, path: string[]): void => {
    if (!node || (typeof node !== 'object' && typeof node !== 'function')) {
      return;
    }

    if (typeof node === 'object') {
      if (visited.has(node)) {
        return;
      }
      visited.add(node);
    }

    for (const key of Object.keys(node)) {
      const value = (node as Record<string, unknown>)[key];
      const nextPath = [...path, key];
      if (
        !shouldTraverse(
          nextPath,
          includeTopLevelDomains,
          excludeTopLevelDomains
        )
      ) {
        continue;
      }
      if (typeof value === 'function') {
        if (shouldIncludeMethod(nextPath)) {
          descriptors.push(buildDescriptor(nextPath));
        }
        continue;
      }
      if (value && typeof value === 'object') {
        walk(value, nextPath);
      }
    }
  };

  walk(frodo, []);
  return dedupeDescriptors(descriptors).sort((a, b) =>
    a.id.localeCompare(b.id)
  );
}

/**
 * Determines whether a given path node should be visited during the walk.
 *
 * @remarks
 * Only the first path segment (the top-level domain) is evaluated. Deeper
 * segments are always traversed once the domain passes this gate.
 *
 * @param path Current path being evaluated.
 * @param includeTopLevelDomains Allowlist of top-level domain keys, or
 *   `undefined` to allow all domains not explicitly excluded.
 * @param excludeTopLevelDomains Blocklist of top-level domain keys.
 * @returns `true` if the path should be traversed; `false` to skip it.
 */
function shouldTraverse(
  path: string[],
  includeTopLevelDomains: Set<string> | undefined,
  excludeTopLevelDomains: Set<string>
): boolean {
  if (!path.length) {
    return true;
  }
  const topLevel = path[0];
  if (includeTopLevelDomains && !includeTopLevelDomains.has(topLevel)) {
    return false;
  }
  if (excludeTopLevelDomains.has(topLevel)) {
    return false;
  }
  return true;
}

/**
 * Returns `false` for low-level Frodo instance factory helpers that should
 * never be surfaced as MCP tools.
 *
 * @param path Full path from the Frodo root to the method, where the last
 *   segment is the method name.
 * @returns `true` if the method should be included in the inventory.
 */
function shouldIncludeMethod(path: string[]): boolean {
  const methodName = path[path.length - 1];
  if (DEFAULT_INSTANCE_HELPERS.has(methodName)) {
    return false;
  }
  return true;
}

/**
 * Builds a fully populated {@link McpCapabilityDescriptor} for the method at
 * the given path by running all inference helpers.
 *
 * @param path Full dot-path from the Frodo root to the method, where the last
 *   segment is the method name.
 * @returns A complete capability descriptor ready for policy filtering.
 */
function buildDescriptor(path: string[]): McpCapabilityDescriptor {
  const methodName = path[path.length - 1];
  const modulePath = path.slice(0, -1);
  const domain = modulePath[0] || 'root';
  const operationType = inferOperationType(methodName);
  const objectType = inferObjectType(methodName, modulePath, operationType);
  const kind: McpCapabilityKind =
    operationType === 'special' ? 'special' : 'generic';
  const riskClass = inferRiskClass(operationType, methodName);
  const mutating = isMutating(operationType);
  const destructive = isDestructive(operationType, methodName);
  const annotations = inferAnnotations(operationType, mutating, destructive);
  const sourcePath = [...modulePath, methodName].join('.');

  return {
    id: sourcePath,
    toolName: `frodo.${sourcePath}`,
    methodName,
    modulePath,
    domain,
    objectType,
    operationType,
    kind,
    riskClass,
    mutating,
    destructive,
    deploymentTypes: ['any'],
    requiredScopes: [],
    annotations,
  };
}

/**
 * Infers a normalized operation type from a Frodo method name.
 *
 * @remarks
 * Frodo follows a consistent naming convention where the *singular* form reads
 * one object by id or name (`readJourney`) and the *plural* form reads all
 * objects of that type (`readJourneys`). This function maps the plural form to
 * the `list` operation type so policy filtering and tooling can reliably
 * distinguish single-object reads from collection reads without requiring
 * explicit per-method metadata.
 *
 * @param methodName Method name to classify.
 * @returns Inferred operation type.
 */
export function inferOperationType(
  methodName: string
): McpCapabilityOperationType {
  if (/^create[A-Z]/.test(methodName)) return 'create';
  // Plural read<ObjectType>s → list all objects; singular read<ObjectType> → read one.
  if (/^read[A-Z].*s$/.test(methodName)) return 'list';
  if (/^read[A-Z]/.test(methodName)) return 'read';
  if (/^update[A-Z]/.test(methodName)) return 'update';
  if (/^delete[A-Z]/.test(methodName)) return 'delete';
  if (/^(search|query)[A-Z]/.test(methodName)) return 'search';
  if (/^(list|getListOf|getFull)[A-Z]/.test(methodName)) return 'list';
  if (/^export[A-Z]/.test(methodName)) return 'export';
  if (/^import[A-Z]/.test(methodName)) return 'import';
  return 'special';
}

/**
 * Infers an object type label from a method name and module path.
 *
 * @param methodName Method name to inspect.
 * @param modulePath Path of containing modules.
 * @param operationType Previously inferred operation type.
 * @returns Inferred object type or fallback token.
 */
export function inferObjectType(
  methodName: string,
  modulePath: string[],
  operationType: McpCapabilityOperationType
): string {
  const operationPrefixes = [
    'create',
    'read',
    'update',
    'delete',
    'search',
    'query',
    'list',
    'getListOf',
    'getFull',
    'export',
    'import',
  ];
  const matchedPrefix = operationPrefixes.find((prefix) =>
    methodName.startsWith(prefix)
  );

  if (matchedPrefix) {
    const suffix = methodName.slice(matchedPrefix.length);
    if (suffix) {
      return normalizeObjectTypeSuffix(suffix);
    }
  }

  if (operationType === 'special' && modulePath.length > 0) {
    return modulePath[modulePath.length - 1];
  }

  return 'unknown';
}

/**
 * Strips trailing plurality markers from an object-type suffix to produce a
 * canonical singular PascalCase label.
 *
 * @remarks
 * Replacement order is significant: `ies→y` and `IES→Y` must execute before
 * the generic trailing-`s` strip so that e.g. `Policies` correctly becomes
 * `Policy` rather than `Policie`.
 *
 * @param suffix The portion of a method name that follows the operation prefix,
 *   e.g. `"Journeys"` extracted from `readJourneys`.
 * @returns Normalised singular label, e.g. `"Journey"`.
 */
function normalizeObjectTypeSuffix(suffix: string): string {
  // ies→y and IES→Y must run before the generic trailing-s strip so that
  // e.g. 'Policies' correctly becomes 'Policy' rather than 'Policie'.
  return suffix
    .replace(/ByName$/, '')
    .replace(/ies$/, 'y')
    .replace(/IES$/, 'Y')
    .replace(/s$/, '');
}

/**
 * Infers a baseline risk class from the operation and method name.
 *
 * @param operationType Inferred operation type.
 * @param methodName Method name used for keyword-based risk escalation.
 * @returns Inferred risk class.
 */
export function inferRiskClass(
  operationType: McpCapabilityOperationType,
  methodName: string
): McpCapabilityRiskClass {
  if (operationType === 'delete') return 'high';
  if (operationType === 'import') return 'high';
  if (operationType === 'export') return 'medium';
  if (operationType === 'create' || operationType === 'update') return 'medium';
  if (/secret|password|token|credential|serviceAccount/i.test(methodName)) {
    return 'critical';
  }
  return 'low';
}

/**
 * Returns `true` for operation types that write, create, or destroy data.
 *
 * @param operationType Operation type to evaluate.
 * @returns `true` if the operation mutates managed state.
 */
function isMutating(operationType: McpCapabilityOperationType): boolean {
  return ['create', 'update', 'delete', 'import'].includes(operationType);
}

/**
 * Returns `true` when calling the method may irreversibly remove or invalidate
 * data. `delete` operations are always destructive; other operations are
 * classified by scanning for destructive verb keywords in the method name.
 *
 * @param operationType Inferred operation type.
 * @param methodName Full method name for keyword scanning.
 * @returns `true` if the operation should carry a destructive hint.
 */
function isDestructive(
  operationType: McpCapabilityOperationType,
  methodName: string
): boolean {
  if (operationType === 'delete') {
    return true;
  }
  return /(disable|revoke|remove|reset|purge|truncate)/i.test(methodName);
}

/**
 * Builds the MCP tool annotation hints from pre-computed operation properties.
 *
 * @remarks
 * `openWorldHint` is always `false` because Frodo tools operate on a specific,
 * bounded AM/IDM environment; they do not produce broad side-effects beyond
 * that tenant.
 *
 * @param operationType Inferred operation type, used to set `idempotentHint`.
 * @param mutating Whether the operation writes data, used to set `readOnlyHint`.
 * @param destructive Whether the operation is destructive, forwarded directly.
 * @returns Populated {@link McpToolAnnotations} object.
 */
function inferAnnotations(
  operationType: McpCapabilityOperationType,
  mutating: boolean,
  destructive: boolean
): McpToolAnnotations {
  const readOnlyHint = !mutating;
  const idempotentHint = ['read', 'search', 'list', 'export'].includes(
    operationType
  );
  return {
    readOnlyHint,
    destructiveHint: destructive,
    idempotentHint,
    openWorldHint: false,
  };
}

/**
 * Removes duplicate descriptors from an array, keeping the first occurrence of
 * each unique {@link McpCapabilityDescriptor.id}.
 *
 * @param descriptors Unsorted descriptor array, potentially containing
 *   duplicates generated by the walk.
 * @returns New array with duplicates removed, preserving order of first
 *   occurrence.
 */
function dedupeDescriptors(
  descriptors: McpCapabilityDescriptor[]
): McpCapabilityDescriptor[] {
  const seen = new Set<string>();
  const deduped: McpCapabilityDescriptor[] = [];
  for (const descriptor of descriptors) {
    if (seen.has(descriptor.id)) {
      continue;
    }
    seen.add(descriptor.id);
    deduped.push(descriptor);
  }
  return deduped;
}
