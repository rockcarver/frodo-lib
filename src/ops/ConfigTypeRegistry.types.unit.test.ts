/**
 * Run tests
 *
 *        npm run test:only -- src/ops/ConfigTypeRegistry.types
 *
 * The conformance walk of the registry of configuration types (`src/ops/ConfigTypeRegistry.ts`): what every type on the list
 * has to have, so that a type that is added later cannot forget one of the steps of the checklist for a new type (the guide
 * for contributors has it). The real list is walked once; the rules are shown to fail on fixtures, one rule at a time, so that
 * each of them is known to be able to fail. Every `pull` and `push` function of a descriptor
 * - is a method of the `frodo` facade, found exactly once, so that it is not hidden and not ambiguous,
 * - has an entry in the generated help (`src/lib/Help.ts`), which is what the capability registry and the shell read, and
 * - belongs to a type that has a golden folder `src/test/golden/<key>` with `files/` and `owned-folders.json`.
 * The key and the two order numbers of a type are used once.
 *
 * Hermetic: it reads the facade object, the generated help and the folder of the golden file sets.
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frodo } from '../lib/FrodoLib';
import { facadePaths } from '../test/utils/FileSetTestKit';
import { type VirtualFileSet } from '../utils/FileSetUtils';
import { getHelpMetadata } from '../utils/HelpUtils';
import {
  ConfigTypeRegistry,
  type ConfigTypeDescriptor,
} from './ConfigTypeRegistry';
import { type PushOutcome } from './OpsTypes';

const GOLDEN_ROOT = fileURLToPath(new URL('../test/golden', import.meta.url));

/** What the walk needs to know about the world. */
type World = {
  /** The paths of the functions of the facade. */
  facade: string[];
  /** The names of the methods that the generated help describes, one entry for each. */
  help: string[];
  /** Whether the golden folder of a key is there and holds what a golden folder holds. */
  hasGolden: (key: string) => boolean;
};

/**
 * What is wrong with a registry: one line for each rule that a type breaks.
 * @param {ConfigTypeDescriptor[]} registry the list of the types
 * @param {World} world the facade, the help and the golden folders
 * @returns {string[]} the broken rules, empty if there are none
 */
function violationsOf(
  registry: ConfigTypeDescriptor[],
  world: World
): string[] {
  const violations: string[] = [];
  const used = {
    key: new Map<string, number>(),
    exportOrder: new Map<number, number>(),
    importOrder: new Map<number, number>(),
  };
  const count = <T>(map: Map<T, number>, value: T): void => {
    map.set(value, (map.get(value) ?? 0) + 1);
  };
  for (const type of registry) {
    count(used.key, type.key);
    count(used.exportOrder, type.exportOrder);
    count(used.importOrder, type.importOrder);
    if (!/^[a-z][a-z0-9-]*$/.test(type.key)) {
      violations.push(
        `${type.key}: the key is lower case letters, digits and dashes`
      );
    }
    for (const field of ['exportOrder', 'importOrder'] as const) {
      if (!Number.isInteger(type[field]) || type[field] <= 0) {
        violations.push(`${type.key}: ${field} is a positive whole number`);
      }
    }
    if (type.deployments.length === 0) {
      violations.push(`${type.key}: no deployment type offers the type`);
    }
    if (!type.pull && !type.push) {
      violations.push(`${type.key}: neither a pull nor a push`);
    }
    for (const verb of ['pull', 'push'] as const) {
      const name = type[verb]?.name;
      if (type[verb] === undefined) continue;
      if (!name) {
        violations.push(`${type.key}: the ${verb} has no name`);
        continue;
      }
      const found = world.facade.filter(
        (path) => path.split('.').pop() === name
      );
      if (found.length !== 1) {
        violations.push(
          `${type.key}: ${name} is on the facade ${found.length} times, not once`
        );
      }
      const described = world.help.filter((method) => method === name);
      if (described.length !== 1) {
        violations.push(
          `${type.key}: ${name} has ${described.length} entries in the generated help, not one`
        );
      }
    }
    if (!world.hasGolden(type.key)) {
      violations.push(
        `${type.key}: no golden folder src/test/golden/${type.key}`
      );
    }
  }
  for (const [key, n] of used.key) {
    if (n > 1) violations.push(`${key}: the key is used ${n} times`);
  }
  for (const field of ['exportOrder', 'importOrder'] as const) {
    for (const [value, n] of used[field]) {
      if (n > 1) violations.push(`${field} ${value} is used ${n} times`);
    }
  }
  return violations;
}

/** The world as it is. */
const realWorld: World = {
  facade: facadePaths(frodo),
  help: getHelpMetadata().map((doc) => doc.methodName),
  hasGolden: (key) => {
    const folder = join(GOLDEN_ROOT, key);
    return (
      existsSync(join(folder, 'owned-folders.json')) &&
      existsSync(join(folder, 'files')) &&
      statSync(join(folder, 'files')).isDirectory()
    );
  },
};

async function pullToys(): Promise<VirtualFileSet> {
  return { files: [], ownedFolders: [] };
}
async function pushToys(): Promise<PushOutcome[]> {
  return [];
}

/** A type that satisfies every rule in a world that is made for it. */
const toy = (
  own: Partial<ConfigTypeDescriptor> = {}
): ConfigTypeDescriptor => ({
  key: 'toys',
  scope: 'global',
  isStatic: true,
  deployments: ['cloud'],
  exportOrder: 10,
  importOrder: 10,
  pull: pullToys,
  push: pushToys,
  ...own,
});
const toyWorld = (own: Partial<World> = {}): World => ({
  facade: ['toy.pullToys', 'toy.pushToys'],
  help: ['pullToys', 'pushToys'],
  hasGolden: () => true,
  ...own,
});

describe('the types on the registry', () => {
  it('satisfy every rule', () => {
    expect(ConfigTypeRegistry.length).toBeGreaterThan(0);
    expect(violationsOf(ConfigTypeRegistry, realWorld)).toEqual([]);
  });

  it('are found where the rules look: the facade and the help are read, and the list is not empty', () => {
    expect(realWorld.facade).toContain('idm.config.readConfigEntity');
    expect(realWorld.facade).toContain('idm.config.pullKbaConfig');
    expect(realWorld.facade).not.toContain('state.getHost');
    expect(realWorld.help).toContain('pullKbaConfig');
    expect(realWorld.hasGolden('kba')).toBe(true);
    expect(realWorld.hasGolden('no-such-type')).toBe(false);
  });
});

describe('the rules of the walk', () => {
  it('pass for a type that has everything', () => {
    expect(violationsOf([toy()], toyWorld())).toEqual([]);
  });

  it('fail for a pull that is not on the facade, and for one that is there twice', () => {
    expect(
      violationsOf([toy()], toyWorld({ facade: ['toy.pushToys'] }))
    ).toEqual(['toys: pullToys is on the facade 0 times, not once']);
    expect(
      violationsOf(
        [toy()],
        toyWorld({
          facade: ['toy.pullToys', 'toy.pushToys', 'other.pullToys'],
        })
      )
    ).toEqual(['toys: pullToys is on the facade 2 times, not once']);
  });

  it('fail for a push that has no entry in the generated help', () => {
    expect(violationsOf([toy()], toyWorld({ help: ['pullToys'] }))).toEqual([
      'toys: pushToys has 0 entries in the generated help, not one',
    ]);
  });

  it('fail for a type that has no golden folder', () => {
    expect(violationsOf([toy()], toyWorld({ hasGolden: () => false }))).toEqual(
      ['toys: no golden folder src/test/golden/toys']
    );
  });

  it('fail for a key that two types use', () => {
    expect(
      violationsOf(
        [toy(), toy({ exportOrder: 20, importOrder: 20 })],
        toyWorld()
      )
    ).toEqual(['toys: the key is used 2 times']);
  });

  it('fail for an order number that two types use, in the export and in the import', () => {
    expect(
      violationsOf([toy({ key: 'alpha' }), toy({ key: 'bravo' })], toyWorld())
    ).toEqual([
      'exportOrder 10 is used 2 times',
      'importOrder 10 is used 2 times',
    ]);
    expect(
      violationsOf(
        [
          toy({ key: 'alpha' }),
          toy({ key: 'bravo', exportOrder: 20, importOrder: 10 }),
        ],
        toyWorld()
      )
    ).toEqual(['importOrder 10 is used 2 times']);
  });

  it('fail for a key that is not lower case, an order number that is not a positive whole number, and a type that no deployment offers', () => {
    expect(violationsOf([toy({ key: 'Toys' })], toyWorld())).toEqual([
      'Toys: the key is lower case letters, digits and dashes',
    ]);
    expect(
      violationsOf([toy({ exportOrder: 0, importOrder: 1.5 })], toyWorld())
    ).toEqual([
      'toys: exportOrder is a positive whole number',
      'toys: importOrder is a positive whole number',
    ]);
    expect(violationsOf([toy({ deployments: [] })], toyWorld())).toEqual([
      'toys: no deployment type offers the type',
    ]);
  });

  it('fail for a type that can neither be pulled nor pushed', () => {
    expect(
      violationsOf([toy({ pull: undefined, push: undefined })], toyWorld())
    ).toEqual(['toys: neither a pull nor a push']);
  });
});
