/**
 * Compares the definitions in a tenant with the reference of the IDM feature `aiagent`
 * ({@link AI_AGENT_FEATURE_REFERENCE}) and classes every difference.
 *
 * @remarks
 * Pure functions on plain data: nothing here reads or writes a tenant.
 */
import {
  AI_AGENT_FEATURE_REFERENCE,
  AIAgentFeatureReference,
} from './AIAgentFeatureReference';

/** The part of `config/managed` the comparison reads. */
export type ManagedConfigLike = {
  objects?: ({ name?: string } & Record<string, unknown>)[];
  [key: string]: unknown;
};

/** The part of `config/repo.ds` the comparison reads. */
export type RepoDsConfigLike = {
  resourceMapping?: {
    explicitMapping?: Record<string, unknown>;
    genericMapping?: Record<string, unknown>;
  };
  [key: string]: unknown;
};

/** The class of a difference that changes no behaviour. */
export type AIAgentCosmeticClass =
  /** a string that differs only in white space, for example one trailing newline */
  | 'whitespace'
  /** the `schema.title` of a managed object definition */
  | 'title'
  /** a property of an explicit `repo.ds` mapping that the original does not have */
  | 'extra-mapping-property';

/**
 * One difference between the reference and a tenant.
 */
export type AIAgentDefinitionDifference = {
  /** The configuration object the difference is in. */
  config: 'managed' | 'repo.ds';
  /** The managed object name (config `managed`) or the mapping key such as `managed/alpha_aiagent` (config `repo.ds`). */
  object: string;
  /** For config `repo.ds`: which section of `resourceMapping` holds the mapping `object`. */
  section?: 'explicitMapping' | 'genericMapping';
  /**
   * Where in the object, as a path of property names and array indexes (`schema.properties.name`, a number is an
   * index). Empty for the whole object.
   */
  path: (string | number)[];
  /** Same location as `path`, rendered for people: `schema.title`, `onDelete.source`. */
  location: string;
  /** `missing`: the tenant lacks it. `extra`: the tenant has it, the reference does not. `changed`: both have it, the values differ. */
  kind: 'missing' | 'extra' | 'changed';
  /** The value in the reference; undefined for `extra`. */
  expected?: unknown;
  /** The value in the tenant; undefined for `missing`. */
  actual?: unknown;
  /** True if the difference changes no behaviour (see {@link AIAgentCosmeticClass}). */
  cosmetic: boolean;
  /** Which kind of cosmetic difference it is; set exactly when `cosmetic` is true. */
  cosmeticClass?: AIAgentCosmeticClass;
};

/** The outcome of comparing a tenant with the reference. */
export type AIAgentDefinitionComparison = {
  /**
   * True if the tenant holds at least one definition of the feature. False means the feature was never installed
   * there, which is not a drift.
   */
  present: boolean;
  /** The realms whose managed object `<realm>_aiagent` exists in the tenant. */
  realms: string[];
  differences: AIAgentDefinitionDifference[];
};

type Obj = Record<string, unknown>;

const isObject = (value: unknown): value is Obj =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Deep equality of two JSON values that ignores the order of the keys of an object (the order of an array matters).
 * Comparing the serialised text would call two objects different only because a server returned their keys in another
 * order.
 * @param {unknown} a one value
 * @param {unknown} b the other value
 * @returns {boolean} true if both hold the same JSON value
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => deepEqual(item, b[index]))
    );
  }
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a).filter((key) => a[key] !== undefined);
    const other = Object.keys(b).filter((key) => b[key] !== undefined);
    return (
      keys.length === other.length &&
      keys.every((key) => key in b && deepEqual(a[key], b[key]))
    );
  }
  return false;
}

/** Render a path of keys and indexes: `a.b[0].c`. */
export function renderPath(path: (string | number)[]): string {
  return path.reduce<string>(
    (text, part) =>
      typeof part === 'number'
        ? `${text}[${part}]`
        : text
          ? `${text}.${part}`
          : part,
    ''
  );
}

/** Read the value at a path of keys and indexes; undefined if any step is missing. */
export function readPath(root: unknown, path: (string | number)[]): unknown {
  let node: unknown = root;
  for (const part of path) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string | number, unknown>)[part];
  }
  return node;
}

/**
 * Set the value at a path of keys and indexes, creating objects on the way. A value of undefined removes the last key.
 * @param root object to change in place
 */
export function writePath(
  root: unknown,
  path: (string | number)[],
  value: unknown
): void {
  if (!path.length) throw new Error('writePath needs a path');
  let node = root as Record<string | number, unknown>;
  for (const part of path.slice(0, -1)) {
    if (node[part] === null || typeof node[part] !== 'object') node[part] = {};
    node = node[part] as Record<string | number, unknown>;
  }
  const last = path[path.length - 1];
  if (value === undefined) {
    delete node[last];
  } else {
    node[last] = value;
  }
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Differences between two values; objects by key, arrays of equal length by index, anything else as a whole. */
function deepDiff(
  expected: unknown,
  actual: unknown,
  path: (string | number)[],
  found: Omit<AIAgentDefinitionDifference, 'config' | 'object' | 'cosmetic'>[]
): void {
  if (isObject(expected) && isObject(actual)) {
    for (const key of Object.keys(expected)) {
      if (!(key in actual)) {
        found.push({
          path: [...path, key],
          location: renderPath([...path, key]),
          kind: 'missing',
          expected: expected[key],
        });
      } else {
        deepDiff(expected[key], actual[key], [...path, key], found);
      }
    }
    for (const key of Object.keys(actual)) {
      if (!(key in expected)) {
        found.push({
          path: [...path, key],
          location: renderPath([...path, key]),
          kind: 'extra',
          actual: actual[key],
        });
      }
    }
    return;
  }
  if (
    Array.isArray(expected) &&
    Array.isArray(actual) &&
    expected.length === actual.length
  ) {
    expected.forEach((item, index) =>
      deepDiff(item, actual[index], [...path, index], found)
    );
    return;
  }
  if (!deepEqual(expected, actual)) {
    found.push({
      path,
      location: renderPath(path),
      kind: 'changed',
      expected,
      actual,
    });
  }
}

/** Class a difference: cosmetic changes no behaviour, everything else is structural. */
function classify(
  config: 'managed' | 'repo.ds',
  found: Omit<AIAgentDefinitionDifference, 'config' | 'object' | 'cosmetic'>
): { cosmetic: boolean; cosmeticClass?: AIAgentCosmeticClass } {
  if (
    found.kind === 'changed' &&
    typeof found.expected === 'string' &&
    typeof found.actual === 'string' &&
    collapse(found.expected) === collapse(found.actual)
  ) {
    return { cosmetic: true, cosmeticClass: 'whitespace' };
  }
  if (
    config === 'managed' &&
    found.kind === 'changed' &&
    typeof found.expected === 'string' &&
    typeof found.actual === 'string' &&
    found.path.length === 2 &&
    found.path[0] === 'schema' &&
    found.path[1] === 'title'
  ) {
    return { cosmetic: true, cosmeticClass: 'title' };
  }
  if (
    config === 'repo.ds' &&
    found.kind === 'extra' &&
    found.path.length === 2 &&
    found.path[0] === 'properties'
  ) {
    return { cosmetic: true, cosmeticClass: 'extra-mapping-property' };
  }
  return { cosmetic: false };
}

function record(
  config: 'managed' | 'repo.ds',
  object: string,
  found: Omit<AIAgentDefinitionDifference, 'config' | 'object' | 'cosmetic'>[],
  into: AIAgentDefinitionDifference[],
  section?: 'explicitMapping' | 'genericMapping'
): void {
  for (const one of found) {
    into.push({
      config,
      object,
      ...(section ? { section } : {}),
      ...one,
      ...classify(config, one),
    });
  }
}

/**
 * Compare the managed configuration and the repo.ds configuration of a tenant with the reference definitions of the
 * feature.
 * @param {ManagedConfigLike} managed `config/managed` of the tenant
 * @param {RepoDsConfigLike} repoDs `config/repo.ds` of the tenant
 * @param {AIAgentFeatureReference} reference the reference to compare with; the shipped one by default
 * @returns {AIAgentDefinitionComparison} whether the tenant holds the feature at all, its realms and every difference
 */
export function compareAIAgentDefinitions(
  managed: ManagedConfigLike,
  repoDs: RepoDsConfigLike,
  reference: AIAgentFeatureReference = AI_AGENT_FEATURE_REFERENCE
): AIAgentDefinitionComparison {
  const byName = new Map<string, Obj>();
  for (const object of managed?.objects ?? []) {
    if (object && typeof object.name === 'string')
      byName.set(object.name, object);
  }
  const explicit = repoDs?.resourceMapping?.explicitMapping ?? {};
  const generic = repoDs?.resourceMapping?.genericMapping ?? {};
  const differences: AIAgentDefinitionDifference[] = [];

  const present =
    Object.keys(reference.managedObjects).some((name) => byName.has(name)) ||
    Object.keys(reference.explicitMappings).some((key) => key in explicit);
  const realms = [
    ...new Set(
      Object.keys(reference.managedObjects)
        .filter((name) => name.endsWith('_aiagent') && byName.has(name))
        .map((name) => name.slice(0, -'_aiagent'.length))
    ),
  ];

  // the appended managed object definitions
  for (const [name, expected] of Object.entries(reference.managedObjects)) {
    const actual = byName.get(name);
    if (!actual) {
      differences.push({
        config: 'managed',
        object: name,
        path: [],
        location: '',
        kind: 'missing',
        expected,
        cosmetic: false,
      });
      continue;
    }
    const found: Omit<
      AIAgentDefinitionDifference,
      'config' | 'object' | 'cosmetic'
    >[] = [];
    deepDiff(expected, actual, [], found);
    record('managed', name, found, differences);
  }

  // the properties added to existing managed objects
  for (const addition of reference.schemaAdditions) {
    const target = byName.get(addition.object);
    if (!target) {
      differences.push({
        config: 'managed',
        object: addition.object,
        path: [],
        location: '',
        kind: 'missing',
        cosmetic: false,
      });
      continue;
    }
    const actual = readPath(target, addition.path);
    if (actual === undefined) {
      differences.push({
        config: 'managed',
        object: addition.object,
        path: addition.path,
        location: renderPath(addition.path),
        kind: 'missing',
        expected: addition.value,
        cosmetic: false,
      });
      continue;
    }
    const found: Omit<
      AIAgentDefinitionDifference,
      'config' | 'object' | 'cosmetic'
    >[] = [];
    deepDiff(addition.value, actual, addition.path, found);
    record('managed', addition.object, found, differences);
  }

  // the values appended to a list (schema.order)
  for (const addition of reference.orderAdditions) {
    const target = byName.get(addition.object);
    if (!target) continue; // reported by the additions above
    const actual = readPath(target, addition.path);
    if (!Array.isArray(actual) || !actual.includes(addition.value)) {
      differences.push({
        config: 'managed',
        object: addition.object,
        path: addition.path,
        location: renderPath(addition.path),
        kind: 'missing',
        expected: addition.value,
        cosmetic: false,
      });
    }
  }

  // repo.ds: the explicit mappings
  for (const [key, expected] of Object.entries(reference.explicitMappings)) {
    if (!(key in explicit)) {
      differences.push({
        config: 'repo.ds',
        object: key,
        section: 'explicitMapping',
        path: [],
        location: '',
        kind: 'missing',
        expected,
        cosmetic: false,
      });
      continue;
    }
    const found: Omit<
      AIAgentDefinitionDifference,
      'config' | 'object' | 'cosmetic'
    >[] = [];
    deepDiff(expected, explicit[key], [], found);
    record('repo.ds', key, found, differences, 'explicitMapping');
  }

  // repo.ds: the property added to generic mappings
  for (const addition of reference.genericMappingProperties) {
    const mapping = generic[addition.mapping];
    const path = ['properties', addition.property];
    const actual = readPath(mapping, path);
    if (actual === undefined) {
      differences.push({
        config: 'repo.ds',
        object: addition.mapping,
        section: 'genericMapping',
        path,
        location: renderPath(path),
        kind: 'missing',
        expected: addition.value,
        cosmetic: false,
      });
      continue;
    }
    const found: Omit<
      AIAgentDefinitionDifference,
      'config' | 'object' | 'cosmetic'
    >[] = [];
    deepDiff(addition.value, actual, path, found);
    record('repo.ds', addition.mapping, found, differences, 'genericMapping');
  }

  return { present, realms, differences };
}

type Direction = 'expected' | 'actual';

/** The object a difference's path is relative to, in the given configuration; undefined if the tenant lacks it. */
function targetOf(
  managed: ManagedConfigLike,
  repoDs: RepoDsConfigLike,
  difference: AIAgentDefinitionDifference
): unknown {
  if (difference.config === 'managed') {
    return (managed?.objects ?? []).find(
      (object) => object?.name === difference.object
    );
  }
  const section = difference.section ?? 'explicitMapping';
  return (
    repoDs?.resourceMapping?.[section] as Record<string, unknown> | undefined
  )?.[difference.object];
}

/**
 * Which of the differences do not hold the value of `which` in the given configuration. With `expected` a difference
 * holds when the tenant has the original value (nothing at the path for an `extra` one), with `actual` when it still has
 * the value that was read when the differences were found.
 * @param {ManagedConfigLike} managed `config/managed`, as read now
 * @param {RepoDsConfigLike} repoDs `config/repo.ds`, as read now
 * @param {AIAgentDefinitionDifference[]} differences differences found earlier
 * @param {'expected' | 'actual'} which the side every difference is expected to be on
 * @returns {AIAgentDefinitionDifference[]} the differences that are not on that side; empty if all are
 */
export function differencesNotOnSide(
  managed: ManagedConfigLike,
  repoDs: RepoDsConfigLike,
  differences: AIAgentDefinitionDifference[],
  which: Direction
): AIAgentDefinitionDifference[] {
  return differences.filter((difference) => {
    const target = targetOf(managed, repoDs, difference);
    if (!target) return true;
    const want = which === 'expected' ? difference.expected : difference.actual;
    const have = readPath(target, difference.path);
    return !deepEqual(have, want);
  });
}

/**
 * Put every difference on the side of `which` in the given configuration, in place: `expected` restores the original
 * (an `extra` value is removed), `actual` puts back the value that was found.
 * @param {ManagedConfigLike} managed `config/managed`; changed in place
 * @param {RepoDsConfigLike} repoDs `config/repo.ds`; changed in place
 * @param {AIAgentDefinitionDifference[]} differences the differences to apply
 * @param {'expected' | 'actual'} which the side to put them on
 */
export function applyDifferences(
  managed: ManagedConfigLike,
  repoDs: RepoDsConfigLike,
  differences: AIAgentDefinitionDifference[],
  which: Direction
): void {
  for (const difference of differences) {
    const target = targetOf(managed, repoDs, difference);
    if (!target) {
      throw new Error(
        `The ${difference.config === 'managed' ? 'managed object' : 'mapping'} ${difference.object} is not in the configuration`
      );
    }
    if (!difference.path.length) {
      throw new Error(
        `The difference at the top of ${difference.object} cannot be applied`
      );
    }
    const value =
      which === 'expected' ? difference.expected : difference.actual;
    writePath(
      target,
      difference.path,
      value === undefined ? undefined : JSON.parse(JSON.stringify(value))
    );
  }
}

/** The place of a difference: the same one in a plan and in a fresh comparison. */
function differenceKey(difference: AIAgentDefinitionDifference): string {
  return [
    difference.config,
    difference.section ?? '',
    difference.object,
    renderPath(difference.path),
  ].join('|');
}

/**
 * Check differences that were recorded in a plan against the tenant and the shipped reference as they are now, and
 * return the differences to write.
 *
 * A plan is plain data that a caller can keep, edit or send back, so what a repair writes must not be what the plan says
 * but what the reference says. Every planned difference has to be one that a fresh comparison finds now, has to be
 * cosmetic, and has to carry the same `expected` (the original, which only the reference can say) and the same `actual`
 * (what the tenant held when the plan was made). The differences returned are the fresh ones: the value written is the
 * reference's and the value to put back is the one read from the tenant just now.
 * @param {AIAgentDefinitionDifference[]} planned the differences a plan recorded
 * @param {ManagedConfigLike} managed `config/managed`, as read now
 * @param {RepoDsConfigLike} repoDs `config/repo.ds`, as read now
 * @param {AIAgentFeatureReference} reference the reference to compare with; the shipped one by default
 * @returns {{ fresh: AIAgentDefinitionDifference[]; problems: string[] }} the differences to write, and why the plan is refused (empty if it is not)
 */
export function confirmDifferences(
  planned: AIAgentDefinitionDifference[],
  managed: ManagedConfigLike,
  repoDs: RepoDsConfigLike,
  reference: AIAgentFeatureReference = AI_AGENT_FEATURE_REFERENCE
): { fresh: AIAgentDefinitionDifference[]; problems: string[] } {
  const now = new Map(
    compareAIAgentDefinitions(managed, repoDs, reference).differences.map(
      (difference) => [differenceKey(difference), difference]
    )
  );
  const fresh: AIAgentDefinitionDifference[] = [];
  const problems: string[] = [];
  for (const one of planned) {
    const where = `${one?.object ?? '?'} ${one?.location ?? ''}`.trim();
    const found =
      one && Array.isArray(one.path) ? now.get(differenceKey(one)) : undefined;
    if (!found) {
      problems.push(
        `${where}: the tenant does not differ from the original there`
      );
    } else if (!found.cosmetic) {
      problems.push(`${where}: the difference is not a cosmetic one`);
    } else if (
      found.kind !== one.kind ||
      !deepEqual(found.expected, one.expected)
    ) {
      problems.push(`${where}: the original is not what the plan records`);
    } else if (!deepEqual(found.actual, one.actual)) {
      problems.push(`${where}: the tenant changed since the plan was made`);
    } else {
      fresh.push(found);
    }
  }
  return { fresh, problems };
}
