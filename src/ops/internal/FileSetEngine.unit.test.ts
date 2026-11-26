/**
 * Run tests
 *
 *        npm run test:only -- src/ops/internal/FileSetEngine
 *
 * The engine of a pull to a file set and a push from one (`src/ops/internal/FileSetEngine.ts`): the parts that do not
 * depend on the configuration type. There is one `describe` for each function. A file set is read from memory
 * (`createMemoryFileSetReader`) and a state is made up, so nothing here touches a tenant, a file or the real home.
 *
 * The functions were written for the command line first; the rows that come from there are the cases that command had:
 * the root realm of a Cloud deployment, ids that differ only in case, a name of 300 characters, one object that fails.
 */
import { jest } from '@jest/globals';
import ts from 'typescript';
import StateImpl, { type State } from '../../shared/State';
import {
  importSpecifiersOf,
  NODE_IO_MODULES,
} from '../../test/exportFileFormat/importsOf';
import { typeAlias } from '../../test/utils/SourceText';
import { encodedName } from '../../utils/FileSetPathUtils';
import {
  createMemoryFileSetReader,
  type FileSetReader,
} from '../../utils/FileSetUtils';
import { FrodoError } from '../FrodoError';
import { type LeftOutAttributesCallback } from '../OpsTypes';
import {
  applyOverrides,
  assignFileNames,
  fileOfObject,
  idOfFile,
  inRealm,
  isCloudRootRealm,
  overridesOf,
  readFileSetJson,
  realmOfDir,
  realmsToVisit,
  runPerObject,
  unmatchedOverrides,
  type RealmOverrides,
} from './FileSetEngine';

const host = 'https://openam-matrix.example.com/am';

/** A state of a deployment type. */
const stateOf = (deployment: 'cloud' | 'forgeops' | 'classic'): State => {
  const state = StateImpl({ host });
  state.setDeploymentType(deployment);
  return state;
};

/** A reader over files made up for a test. */
const readerOf = (files: Record<string, string>): FileSetReader =>
  createMemoryFileSetReader({
    files: Object.entries(files).map(([path, content]) => ({ path, content })),
    ownedFolders: [],
  });

describe('isCloudRootRealm', () => {
  it.each([
    ['the root realm of a Cloud deployment', 'cloud', '/', true],
    ['the root realm of a ForgeOps deployment', 'forgeops', '/', false],
    ['the root realm of a classic deployment', 'classic', '/', false],
    ['a realm of a Cloud deployment', 'cloud', 'alpha', false],
    ['a sub-realm path of a Cloud deployment', 'cloud', '/alpha', false],
    ['no realm on a Cloud deployment', 'cloud', undefined, false],
  ] as const)('%s: %s', (_what, deployment, realm, expected) => {
    expect(isCloudRootRealm({ realm, state: stateOf(deployment) })).toBe(
      expected
    );
  });
});

describe('realmsToVisit', () => {
  const names = ['/', 'alpha', 'bravo'];

  it('visits every realm of a Cloud deployment except the root realm, which it leaves out', async () => {
    const realmNames = jest.fn(async () => names);

    await expect(
      realmsToVisit({ realmNames, state: stateOf('cloud') })
    ).resolves.toEqual(['alpha', 'bravo']);
    expect(realmNames).toHaveBeenCalledTimes(1);
  });

  it.each([['forgeops'], ['classic']] as const)(
    'keeps the root realm of a %s deployment',
    async (deployment) => {
      await expect(
        realmsToVisit({
          realmNames: async () => names,
          state: stateOf(deployment),
        })
      ).resolves.toEqual(['/', 'alpha', 'bravo']);
    }
  );

  it('visits only the realm that was named, and does not ask for the names of the realms', async () => {
    const realmNames = jest.fn(async () => names);

    await expect(
      realmsToVisit({ realm: 'bravo', realmNames, state: stateOf('cloud') })
    ).resolves.toEqual(['bravo']);
    await expect(
      realmsToVisit({ realm: '/', realmNames, state: stateOf('forgeops') })
    ).resolves.toEqual(['/']);
    expect(realmNames).not.toHaveBeenCalled();
  });

  it('takes the default key and an empty name for every realm', async () => {
    for (const realm of ['__default__realm__', '', undefined]) {
      await expect(
        realmsToVisit({
          realm,
          realmNames: async () => names,
          state: stateOf('forgeops'),
        })
      ).resolves.toEqual(names);
    }
  });

  it('leaves out the root realm of a Cloud deployment even when it was named', async () => {
    await expect(
      realmsToVisit({
        realm: '/',
        realmNames: async () => names,
        state: stateOf('cloud'),
      })
    ).resolves.toEqual([]);
  });

  it('does not change the list that the tenant answered', async () => {
    const answer = [...names];
    await realmsToVisit({
      realmNames: async () => answer,
      state: stateOf('cloud'),
    });

    expect(answer).toEqual(names);
  });

  it('passes on the failure to read the names of the realms', async () => {
    await expect(
      realmsToVisit({
        realmNames: async () => {
          throw new Error('no realms');
        },
        state: stateOf('cloud'),
      })
    ).rejects.toThrow('no realms');
  });
});

describe('inRealm', () => {
  it('runs the work in the realm and gives what it gives', async () => {
    const state = stateOf('cloud');
    state.setRealm('alpha');

    const seen = await inRealm({
      realm: 'bravo',
      state,
      work: async () => state.getRealm(),
    });

    expect(seen).toBe('bravo');
  });

  it('puts the realm of the caller back after the work', async () => {
    const state = stateOf('cloud');
    state.setRealm('alpha');

    await inRealm({ realm: 'bravo', state, work: async () => undefined });

    expect(state.getRealm()).toBe('alpha');
  });

  it('puts the realm of the caller back when the work throws, and passes the error on', async () => {
    const state = stateOf('cloud');
    state.setRealm('alpha');
    const failure = new Error('request failed');

    await expect(
      inRealm({
        realm: 'bravo',
        state,
        work: async () => {
          throw failure;
        },
      })
    ).rejects.toBe(failure);
    expect(state.getRealm()).toBe('alpha');
  });

  it('puts every realm back in turn when the work goes into a realm itself', async () => {
    const state = stateOf('forgeops');
    state.setRealm('/');
    const seen: string[] = [];

    await inRealm({
      realm: 'alpha',
      state,
      work: async () => {
        seen.push(state.getRealm());
        await inRealm({
          realm: 'bravo',
          state,
          work: async () => {
            seen.push(state.getRealm());
          },
        });
        seen.push(state.getRealm());
      },
    });

    expect(seen).toEqual(['alpha', 'bravo', 'alpha']);
    expect(state.getRealm()).toBe('/');
  });

  it('leaves a loop over realms on the realm it started in, also after the first realm failed', async () => {
    const state = stateOf('forgeops');
    state.setRealm('/');
    const visited: string[] = [];
    for (const realm of ['alpha', 'bravo']) {
      await inRealm({
        realm,
        state,
        work: async () => {
          visited.push(state.getRealm());
          if (realm === 'alpha') throw new Error('first realm failed');
        },
      }).catch(() => undefined);
    }

    expect(visited).toEqual(['alpha', 'bravo']);
    expect(state.getRealm()).toBe('/');
  });
});

describe('assignFileNames', () => {
  it('gives each id the file name of an id, as the agent types write it', () => {
    const { names, collisions, refused } = assignFileNames([
      'Login',
      'a/b',
      'con',
    ]);

    expect([...names]).toEqual([
      ['Login', 'Login'],
      ['a/b', 'a%2Fb'],
      ['con', ''],
    ]);
    expect(collisions).toEqual([]);
    expect(refused).toEqual([]);
  });

  it('lets the first of two ids that differ only in case keep the name, and reports the second', () => {
    const { names, collisions } = assignFileNames(['Login', 'login', 'LOGIN']);

    expect([...names]).toEqual([['Login', 'Login']]);
    expect(collisions).toEqual([
      { id: 'login', firstId: 'Login' },
      { id: 'LOGIN', firstId: 'Login' },
    ]);
  });

  it('takes the order of the ids as it is given: the other id keeps the name when the order is the other', () => {
    expect(assignFileNames(['Login', 'login']).collisions).toEqual([
      { id: 'login', firstId: 'Login' },
    ]);
    expect(assignFileNames(['login', 'Login']).collisions).toEqual([
      { id: 'Login', firstId: 'login' },
    ]);
  });

  it('takes two ids that are one name in two Unicode forms for a collision', () => {
    const { names, collisions } = assignFileNames(['é', 'é']);

    expect([...names.keys()]).toEqual(['é']);
    expect(collisions).toEqual([{ id: 'é', firstId: 'é' }]);
  });

  it('cuts an id of 300 characters at 250 bytes, so two such ids that differ later collide', () => {
    const first = `${'n'.repeat(250)}one`;
    const second = `${'n'.repeat(250)}two`;
    const { names, collisions } = assignFileNames([first, second, 'short']);

    expect(names.get(first)).toBe('n'.repeat(250));
    expect(names.get('short')).toBe('short');
    expect(names.has(second)).toBe(false);
    expect(collisions).toEqual([{ id: second, firstId: first }]);
  });

  it('keeps the names of the ids that do not collide, in the order given', () => {
    const { names } = assignFileNames(['b', 'a', 'B', 'c']);

    expect([...names.keys()]).toEqual(['b', 'a', 'c']);
  });

  it('takes the function of a type for the name of a file', () => {
    const { names, collisions, refused } = assignFileNames(
      ['a:b', 'a/b', 'a%3Ab'],
      encodedName
    );

    expect(names.get('a:b')).toBe('a%3Ab');
    expect(names.get('a/b')).toBe('a%2Fb');
    // `a%3Ab` is the name that `a:b` has, so it collides
    expect(collisions).toEqual([{ id: 'a%3Ab', firstId: 'a:b' }]);
    expect(refused).toEqual([]);
  });

  it('reports an id that has no name as refused, with the error, and goes on with the others', () => {
    const { names, collisions, refused } = assignFileNames(
      ['ok', '..', 'con', 'also ok', ''],
      encodedName
    );

    expect([...names.keys()]).toEqual(['ok', 'also ok']);
    expect(collisions).toEqual([]);
    expect(refused.map((r) => r.id)).toEqual(['..', 'con', '']);
    expect(refused[0].error).toBeInstanceOf(Error);
    expect(refused[0].error.message).toBe(
      "'..' does not name an object: an id or a name is not a path"
    );
  });

  it('never throws for an id, also when the function throws something that is not an error', () => {
    const { names, refused } = assignFileNames(['a', 'b'], (id) => {
      if (id === 'b') throw 'not an error';
      return id;
    });

    expect([...names.keys()]).toEqual(['a']);
    expect(refused).toHaveLength(1);
    expect(refused[0].error).toBeInstanceOf(Error);
    expect(refused[0].error.message).toBe('not an error');
  });

  it('gives nothing for no ids', () => {
    const { names, collisions, refused } = assignFileNames([]);

    expect(names.size).toBe(0);
    expect(collisions).toEqual([]);
    expect(refused).toEqual([]);
  });
});

/** The names that an object inherits: a realm, an id or a path with one of these names is an ordinary name. */
const PROTOTYPE_NAMES = [
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  '__proto__',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
];

describe.each(PROTOTYPE_NAMES)('the name %s', (name) => {
  it('is a realm with no overrides when the entries have none for it', () => {
    const matched = new Set<string>();

    expect(
      overridesOf(
        { alpha: [{ id: 'Login', overrides: { a: 1 } }] },
        name,
        'Login',
        matched
      )
    ).toBeUndefined();
    expect(overridesOf({}, name, 'Login', matched)).toBeUndefined();
    expect(overridesOf(undefined, name, 'Login', matched)).toBeUndefined();
    expect(matched.size).toBe(0);
    expect(
      unmatchedOverrides({ alpha: [{ id: 'Login' }] }, matched, new Set([name]))
    ).toEqual([]);
  });

  it('is a realm whose own entry is found, used and reported like any other', () => {
    // JSON.parse makes an own property, also for `__proto__`: this is how an overrides file arrives
    const entries = JSON.parse(
      `{ ${JSON.stringify(name)}: [ { "id": "Login", "overrides": { "a": 1 } }, { "id": "Other" } ] }`
    ) as RealmOverrides;
    const matched = new Set<string>();

    expect(overridesOf(entries, name, 'LOGIN', matched)).toEqual({ a: 1 });
    expect(unmatchedOverrides(entries, matched, new Set([name]))).toEqual([
      { realm: name, id: 'Other' },
    ]);
    expect(unmatchedOverrides(entries, matched, new Set())).toEqual([]);
  });

  it('is an id that gets a file name, and an id that overrides are found for', () => {
    const { names, collisions, refused } = assignFileNames([name, 'plain']);

    expect([...names]).toEqual([
      [name, name],
      ['plain', 'plain'],
    ]);
    expect(collisions).toEqual([]);
    expect(refused).toEqual([]);
    expect(
      overridesOf(
        { alpha: [{ id: name, overrides: { a: 1 } }] },
        'alpha',
        name,
        new Set()
      )
    ).toEqual({ a: 1 });
    expect(idOfFile(`${name}.json`)).toBe(name);
  });

  it('is the one realm to visit when it is named', async () => {
    await expect(
      realmsToVisit({
        realm: name,
        realmNames: async () => ['alpha'],
        state: stateOf('forgeops'),
      })
    ).resolves.toEqual([name]);
  });
});

describe('overridesOf and unmatchedOverrides', () => {
  const entries: RealmOverrides = {
    alpha: [
      { id: 'Login', overrides: { a: 1 } },
      { id: 'Other', overrides: { b: 2 } },
      { id: 'NoOverrides' },
    ],
    bravo: [{ id: 'Login', overrides: { c: 3 } }],
    charlie: [{ id: 'Missing', overrides: { d: 4 } }],
  };

  it('finds the overrides of an object by realm and id, and the id matches ignoring case', () => {
    const matched = new Set<string>();

    expect(overridesOf(entries, 'alpha', 'Login', matched)).toEqual({ a: 1 });
    expect(overridesOf(entries, 'alpha', 'LOGIN', matched)).toEqual({ a: 1 });
    expect(overridesOf(entries, 'alpha', 'login', matched)).toEqual({ a: 1 });
    expect(overridesOf(entries, 'bravo', 'login', matched)).toEqual({ c: 3 });
  });

  it('gives nothing for an object that has no entry, in that realm', () => {
    const matched = new Set<string>();

    expect(overridesOf(entries, 'alpha', 'Unknown', matched)).toBeUndefined();
    expect(overridesOf(entries, 'bravo', 'Other', matched)).toBeUndefined();
    expect(overridesOf(entries, 'delta', 'Login', matched)).toBeUndefined();
    expect(overridesOf(undefined, 'alpha', 'Login', matched)).toBeUndefined();
    expect(matched.size).toBe(0);
  });

  it('counts an entry without overrides as used', () => {
    const matched = new Set<string>();

    expect(
      overridesOf(entries, 'alpha', 'NoOverrides', matched)
    ).toBeUndefined();
    expect(matched.size).toBe(1);
  });

  it('reports the entries that matched no object, of the realms that were visited', () => {
    const matched = new Set<string>();
    overridesOf(entries, 'alpha', 'login', matched);
    overridesOf(entries, 'bravo', 'Login', matched);

    expect(
      unmatchedOverrides(
        entries,
        matched,
        new Set(['alpha', 'bravo', 'charlie'])
      )
    ).toEqual([
      { realm: 'alpha', id: 'Other' },
      { realm: 'alpha', id: 'NoOverrides' },
      { realm: 'charlie', id: 'Missing' },
    ]);
  });

  it('does not report an entry of a realm that was not visited', () => {
    expect(unmatchedOverrides(entries, new Set(), new Set(['bravo']))).toEqual([
      { realm: 'bravo', id: 'Login' },
    ]);
    expect(unmatchedOverrides(entries, new Set(), new Set())).toEqual([]);
  });

  it('reports nothing when every entry was used, and when there are no entries', () => {
    const matched = new Set<string>();
    for (const [realm, list] of Object.entries(entries)) {
      for (const entry of list) overridesOf(entries, realm, entry.id, matched);
    }

    expect(
      unmatchedOverrides(entries, matched, new Set(Object.keys(entries)))
    ).toEqual([]);
    expect(
      unmatchedOverrides(undefined, new Set(), new Set(['alpha']))
    ).toEqual([]);
  });

  it('takes two entries of one realm that differ only in case for one entry, as the command line does: the first is applied and both count as used', () => {
    const twins: RealmOverrides = {
      alpha: [
        { id: 'Login', overrides: { a: 1 } },
        { id: 'login', overrides: { b: 2 } },
      ],
    };
    const matched = new Set<string>();

    expect(overridesOf(twins, 'alpha', 'LOGIN', matched)).toEqual({ a: 1 });
    expect(unmatchedOverrides(twins, matched, new Set(['alpha']))).toEqual([]);
    // a realm that has only the second spelling is reported when nothing matched
    expect(unmatchedOverrides(twins, new Set(), new Set(['alpha']))).toEqual([
      { realm: 'alpha', id: 'Login' },
      { realm: 'alpha', id: 'login' },
    ]);
  });

  it('remembers an entry by realm and id, so the same id in another realm is another entry', () => {
    const matched = new Set<string>();
    overridesOf(entries, 'alpha', 'Login', matched);

    expect(unmatchedOverrides(entries, matched, new Set(['bravo']))).toEqual([
      { realm: 'bravo', id: 'Login' },
    ]);
  });
});

describe('applyOverrides', () => {
  it('replaces a scalar by a scalar, a scalar by an object and an object by null', () => {
    expect(
      applyOverrides(
        { a: 1, b: 'two', c: { d: 1 }, keep: true },
        { a: 2, b: { nested: true }, c: null }
      )
    ).toEqual({ a: 2, b: { nested: true }, c: null, keep: true });
  });

  it('merges objects key by key, at every depth', () => {
    expect(
      applyOverrides(
        { a: { b: { c: 1, d: 2 }, e: 3 } },
        { a: { b: { c: 9 }, f: 4 } }
      )
    ).toEqual({ a: { b: { c: 9, d: 2 }, e: 3, f: 4 } });
  });

  it('merges arrays by position and never shortens them', () => {
    expect(
      applyOverrides(
        { list: [1, 2, 3], objects: [{ a: 1, b: 2 }] },
        { list: [9], objects: [{ a: 7 }, { c: 1 }] }
      )
    ).toEqual({ list: [9, 2, 3], objects: [{ a: 7, b: 2 }, { c: 1 }] });
  });

  it('gives a copy of the object when there are no overrides', () => {
    const object = { a: { b: 1 } };
    const result = applyOverrides(object);

    expect(result).toEqual(object);
    expect(result).not.toBe(object);
    expect(result.a).not.toBe(object.a);
  });

  it('changes neither argument, also not when the result is changed afterwards', () => {
    const object = { a: { b: 1 }, list: [1, 2] };
    const overrides = { a: { c: { deep: [1] } }, list: [5] };
    const objectBefore = JSON.stringify(object);
    const overridesBefore = JSON.stringify(overrides);

    const result = applyOverrides(object, overrides) as {
      a: { c: { deep: number[] } };
      list: number[];
    };
    result.a.c.deep.push(2);
    result.list.push(3);
    (result.a as Record<string, unknown>).added = true;

    expect(JSON.stringify(object)).toBe(objectBefore);
    expect(JSON.stringify(overrides)).toBe(overridesBefore);
  });

  it('works on objects that cannot be changed', () => {
    const object = Object.freeze({ a: Object.freeze({ b: 1 }) });
    const overrides = Object.freeze({ a: Object.freeze({ c: 2 }) });

    expect(applyOverrides(object, overrides)).toEqual({ a: { b: 1, c: 2 } });
  });
});

describe('idOfFile and realmOfDir', () => {
  it.each([
    ['Login.json', 'Login'],
    ['a%2Fb.json', 'a/b'],
    ['a%20b.json', 'a b'],
    ['%C3%A9.json', 'é'],
    ['no-extension', 'no-extension'],
    ['x.json.json', 'x.json'],
    // `.json` is taken off the end only, not where it first occurs
    ['my.json.config.json', 'my.json.config'],
    ['a.jsonx', 'a.jsonx'],
    ['a.JSON', 'a.JSON'],
    ['100%.json', '100%'],
    ['%E0%A4%A.json', '%E0%A4%A'],
  ])('the file %j is the object %j', (fileName, expected) => {
    expect(idOfFile(fileName)).toBe(expected);
  });

  it.each([
    ['root', '/'],
    ['alpha', 'alpha'],
    ['parent/child', 'parent/child'],
    ['Root', 'Root'],
    ['', ''],
  ])('the folder %j is the realm %j', (dir, expected) => {
    expect(realmOfDir(dir)).toBe(expected);
  });
});

describe('readFileSetJson', () => {
  it('reads the file and parses it', async () => {
    const reader = readerOf({ 'a/x.json': '{"name":"x","list":[1,2]}\n' });

    await expect(
      readFileSetJson({ reader, path: 'a/x.json', state: stateOf('cloud') })
    ).resolves.toEqual({ name: 'x', list: [1, 2] });
  });

  it('gives undefined for a file that does not exist', async () => {
    await expect(
      readFileSetJson({
        reader: readerOf({ 'a/x.json': '{}' }),
        path: 'a/missing.json',
        state: stateOf('cloud'),
      })
    ).resolves.toBeUndefined();
  });

  it('fills a placeholder from the values of the state, and a BASE64 placeholder decoded', async () => {
    const state = stateOf('cloud');
    state.setEnvs({
      MADE_UP_URL: 'https://openam-matrix.example.com',
      MADE_UP_ENCODED: Buffer.from('plain text').toString('base64'),
    });
    const reader = readerOf({
      'x.json':
        '{"url":"${MADE_UP_URL}/path","text":"${BASE64:MADE_UP_ENCODED}"}',
    });

    await expect(
      readFileSetJson({ reader, path: 'x.json', state })
    ).resolves.toEqual({
      url: 'https://openam-matrix.example.com/path',
      text: 'plain text',
    });
  });

  it('writes an escaped placeholder as a placeholder and does not fill it', async () => {
    const reader = readerOf({ 'x.json': '{"literal":"\\\\${NOT_FILLED}"}' });

    await expect(
      readFileSetJson({ reader, path: 'x.json', state: stateOf('cloud') })
    ).resolves.toEqual({ literal: '${NOT_FILLED}' });
  });

  describe('the process environment', () => {
    const name = 'FILE_SET_ENGINE_TEST_VARIABLE';
    const reader = readerOf({ 'x.json': `{"v":"\${${name}}"}` });
    afterEach(() => {
      delete process.env[name];
    });

    it('fills a placeholder from it only when the state says so', async () => {
      process.env[name] = 'from the environment';
      const state = stateOf('cloud');

      await expect(
        readFileSetJson({ reader, path: 'x.json', state })
      ).rejects.toThrow(`No value found for placeholder "${name}"`);

      state.setUseProcessEnvironmentForPlaceholders(true);
      await expect(
        readFileSetJson({ reader, path: 'x.json', state })
      ).resolves.toEqual({ v: 'from the environment' });
    });

    it('prefers the value of the state', async () => {
      process.env[name] = 'from the environment';
      const state = stateOf('cloud');
      state.setUseProcessEnvironmentForPlaceholders(true);
      state.setEnv(name, 'from the state');

      await expect(
        readFileSetJson({ reader, path: 'x.json', state })
      ).resolves.toEqual({ v: 'from the state' });
    });
  });

  it('names a placeholder that has no value and shows no value', async () => {
    process.env.FILE_SET_ENGINE_TEST_SECRET = 'must-not-appear';
    try {
      const state = stateOf('cloud');
      state.setEnv('KNOWN', 'a-value-of-the-state');
      const reader = readerOf({
        'x.json': '{"a":"${KNOWN}","b":"${UNKNOWN_NAME}"}',
      });

      const error = await readFileSetJson({
        reader,
        path: 'x.json',
        state,
      }).catch((e) => e);

      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe(
        'No value found for placeholder "UNKNOWN_NAME"'
      );
      expect(JSON.stringify(error.message)).not.toContain(
        'a-value-of-the-state'
      );
      expect(error.message).not.toContain('must-not-appear');
    } finally {
      delete process.env.FILE_SET_ENGINE_TEST_SECRET;
    }
  });

  it('reads an empty file as a file that is not JSON, never as a missing one', async () => {
    const error = await readFileSetJson({
      reader: readerOf({ 'a/empty.json': '' }),
      path: 'a/empty.json',
      state: stateOf('cloud'),
    }).catch((e) => e);

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error parsing JSON from a/empty.json');
  });

  it('says what it was reading when the reader fails, and keeps the cause', async () => {
    const cause = new Error('disk gone');
    const reader: FileSetReader = {
      listDirectory: async () => undefined,
      readFile: async () => {
        throw cause;
      },
    };

    const error = await readFileSetJson({
      reader,
      path: 'a/x.json',
      state: stateOf('cloud'),
    }).catch((e) => e);

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error reading file a/x.json');
    expect(error.originalErrors).toEqual([cause]);
  });

  it('says what it was parsing when the text is not JSON, and keeps the cause', async () => {
    const error = await readFileSetJson({
      reader: readerOf({ 'a/x.json': '{ not json' }),
      path: 'a/x.json',
      state: stateOf('cloud'),
    }).catch((e) => e);

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error parsing JSON from a/x.json');
    expect(error.originalErrors[0]).toBeInstanceOf(SyntaxError);
  });

  it('fails like a read that the reader refuses, for a path that is not a path of a file set', async () => {
    await expect(
      readFileSetJson({
        reader: readerOf({ 'a/x.json': '{}' }),
        path: '../x.json',
        state: stateOf('cloud'),
      })
    ).rejects.toThrow('Error reading file ../x.json');
  });
});

describe('fileOfObject', () => {
  const read = async (
    file: { path: string; content: string },
    state: State = stateOf('cloud')
  ) =>
    readFileSetJson({
      reader: createMemoryFileSetReader({ files: [file], ownedFolders: [] }),
      path: file.path,
      state,
    });

  it('gives the path as it was given and the text of the object, keys sorted, two spaces, a newline at the end', () => {
    expect(
      fileOfObject({ path: 'a/x.json', object: { b: 1, a: { d: 1, c: 2 } } })
    ).toEqual({
      path: 'a/x.json',
      content: '{\n  "a": {\n    "c": 2,\n    "d": 1\n  },\n  "b": 1\n}\n',
    });
  });

  it('leaves `_rev` out at every depth and keeps the modified properties', () => {
    const { content } = fileOfObject({
      path: 'x.json',
      object: {
        _id: 'x',
        _rev: '1',
        modifiedDate: 'yesterday',
        creationDate: 'before',
        nested: { _rev: '2', lastModifiedBy: 'someone', value: 1 },
      },
    });

    expect(JSON.parse(content)).toEqual({
      _id: 'x',
      modifiedDate: 'yesterday',
      creationDate: 'before',
      nested: { lastModifiedBy: 'someone', value: 1 },
    });
  });

  it('writes no metadata of an export', () => {
    const { content } = fileOfObject({
      path: 'x.json',
      object: {
        meta: {
          exportTool: 'frodo',
          origin: 'https://openam-matrix.example.com',
        },
        a: 1,
      },
    });

    expect(JSON.parse(content)).toEqual({ a: 1 });
  });

  it('keeps a `meta` that is data of the object', () => {
    const { content } = fileOfObject({
      path: 'x.json',
      object: { meta: { owner: 'someone' }, a: 1 },
    });

    expect(JSON.parse(content)).toEqual({ meta: { owner: 'someone' }, a: 1 });
  });

  it('escapes every `${`, so that a push reads it as text and not as a placeholder', async () => {
    const file = fileOfObject({
      path: 'x.json',
      object: { script: 'return "${notAPlaceholder}";', list: ['${a}'] },
    });

    expect(file.content).toContain('\\\\${notAPlaceholder}');
    expect(file.content).not.toMatch(/[^\\]\$\{/);
    // a push gives back what the pull was given
    await expect(read(file)).resolves.toEqual({
      script: 'return "${notAPlaceholder}";',
      list: ['${a}'],
    });
  });

  it('never puts a value of the state into a file', () => {
    const state = stateOf('cloud');
    state.setEnv('MADE_UP', 'a-value-of-the-state');
    const { content } = fileOfObject({
      path: 'x.json',
      object: { a: '${MADE_UP}' },
    });

    expect(content).not.toContain('a-value-of-the-state');
    expect(content).toContain('MADE_UP');
  });

  it('merges the overrides after the escaping, and writes them as they are', async () => {
    const file = fileOfObject({
      path: 'x.json',
      object: { a: '${literal}', b: 1, nested: { c: 1, d: 2 } },
      overrides: { b: '${FILLED_ON_PUSH}', nested: { c: 9 } },
    });
    const state = stateOf('cloud');
    state.setEnv('FILLED_ON_PUSH', 'filled');

    // the object's own `${literal}` is escaped, the override's placeholder is a placeholder
    expect(file.content).toContain('\\\\${literal}');
    expect(file.content).toContain('"${FILLED_ON_PUSH}"');
    await expect(read(file, state)).resolves.toEqual({
      a: '${literal}',
      b: 'filled',
      nested: { c: 9, d: 2 },
    });
  });

  it('changes neither the object nor the overrides', () => {
    const object = { a: { b: 1 }, _rev: '1' };
    const overrides = { a: { c: 2 } };
    const before = JSON.stringify([object, overrides]);

    fileOfObject({ path: 'x.json', object, overrides });

    expect(JSON.stringify([object, overrides])).toBe(before);
  });

  it('gives the same file for the same object, whatever the order of its keys', () => {
    expect(
      fileOfObject({ path: 'x.json', object: { a: 1, b: { c: 1, d: 2 } } })
    ).toEqual(
      fileOfObject({ path: 'x.json', object: { b: { d: 2, c: 1 }, a: 1 } })
    );
  });
});

describe('runPerObject', () => {
  const objects = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];

  it('runs every object, in order, and gives one outcome for each in that order', async () => {
    const order: string[] = [];

    const outcomes = await runPerObject({
      objects,
      work: async ({ object }) => {
        order.push(object.id);
        return object.id.length;
      },
    });

    expect(order).toEqual(['one', 'two', 'three']);
    expect(outcomes).toEqual([{ id: 'one' }, { id: 'two' }, { id: 'three' }]);
  });

  it('runs the objects one after the other, never two at once', async () => {
    const events: string[] = [];

    await runPerObject({
      objects,
      work: async ({ object }) => {
        events.push(`start ${object.id}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        events.push(`end ${object.id}`);
      },
    });

    expect(events).toEqual([
      'start one',
      'end one',
      'start two',
      'end two',
      'start three',
      'end three',
    ]);
  });

  it('does not stop at a failure: the others run, and the outcome of the failed one holds the error', async () => {
    const cause = new Error('refused by the server');
    const ran: string[] = [];

    const outcomes = await runPerObject({
      objects,
      work: async ({ object }) => {
        ran.push(object.id);
        if (object.id === 'two') throw cause;
      },
    });

    expect(ran).toEqual(['one', 'two', 'three']);
    expect(outcomes.map((o) => o.id)).toEqual(['one', 'two', 'three']);
    expect(outcomes[0].error).toBeUndefined();
    expect(outcomes[2].error).toBeUndefined();
    expect(outcomes[1].error).toBeInstanceOf(FrodoError);
    expect(outcomes[1].error.message).toBe('Error processing two');
    expect(outcomes[1].error.originalErrors).toEqual([cause]);
  });

  it('wraps a value that is not an error, and keeps what it said', async () => {
    const outcomes = await runPerObject({
      objects: [{ id: 'one' }],
      work: async () => {
        throw 'plain text';
      },
    });

    expect(outcomes[0].error).toBeInstanceOf(FrodoError);
    expect(outcomes[0].error.originalErrors[0].message).toBe('plain text');
  });

  it('tells the callback once for every object: the error of a failure, the result of a success', async () => {
    const calls: [unknown, unknown][] = [];
    const failure = new Error('failed');

    const outcomes = await runPerObject({
      objects,
      work: async ({ object }) => {
        if (object.id === 'two') throw failure;
        return `result of ${object.id}`;
      },
      resultCallback: (error, result) => {
        calls.push([error, result]);
      },
    });

    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual([undefined, 'result of one']);
    expect(calls[1][0]).toBe(outcomes[1].error);
    expect(calls[1][1]).toBeUndefined();
    expect(calls[2]).toEqual([undefined, 'result of three']);
  });

  it('gives the work the errorCallback for the failures that it handles itself: it tells the callback and the work goes on', async () => {
    const errors: unknown[] = [];

    const outcomes = await runPerObject({
      objects: [{ id: 'one' }],
      work: async ({ errorCallback }) => {
        errorCallback(new FrodoError('a part failed'));
        return 'went on';
      },
      resultCallback: (error) => {
        if (error) errors.push(error.message);
      },
    });

    expect(errors).toEqual(['a part failed']);
    // the work finished: the object is a success, and the callback was told of the part
    expect(outcomes).toEqual([{ id: 'one' }]);
  });

  it('tells the callback twice for an object whose work reports a part and goes on, and the outcome of that object has no error', async () => {
    const calls: [string | undefined, unknown][] = [];

    const outcomes = await runPerObject({
      objects: [{ id: 'one' }, { id: 'two' }],
      work: async ({ object, errorCallback }) => {
        if (object.id === 'one') errorCallback(new FrodoError('a part failed'));
        return `result of ${object.id}`;
      },
      resultCallback: (error, result) => {
        calls.push([error?.message, result]);
      },
    });

    // one: the part (told when it happened), then how the work ended; two: how the work ended
    expect(calls).toEqual([
      ['a part failed', undefined],
      [undefined, 'result of one'],
      [undefined, 'result of two'],
    ]);
    // the outcome holds the failure of the whole object only
    expect(outcomes).toEqual([{ id: 'one' }, { id: 'two' }]);
  });

  it('ends the run when the callback throws: the objects after it do not run and the outcomes are not returned', async () => {
    const ran: string[] = [];
    const broken = new Error('the callback broke');

    await expect(
      runPerObject({
        objects,
        work: async ({ object }) => {
          ran.push(object.id);
        },
        resultCallback: (error, result) => {
          void error;
          void result;
          throw broken;
        },
      })
    ).rejects.toBe(broken);
    expect(ran).toEqual(['one']);
  });

  it('ends the run when the callback throws for a failure too', async () => {
    const ran: string[] = [];
    const broken = new Error('the callback broke');

    await expect(
      runPerObject({
        objects,
        work: async ({ object }) => {
          ran.push(object.id);
          throw new Error('failed');
        },
        resultCallback: () => {
          throw broken;
        },
      })
    ).rejects.toBe(broken);
    expect(ran).toEqual(['one']);
  });

  it('makes the errorCallback throw when there is no callback, so the object fails', async () => {
    const part = new FrodoError('a part failed');

    const outcomes = await runPerObject({
      objects: [{ id: 'one' }, { id: 'two' }],
      work: async ({ object, errorCallback }) => {
        if (object.id === 'one') errorCallback(part);
        return 'fine';
      },
    });

    expect(outcomes[0].error?.originalErrors).toEqual([part]);
    expect(outcomes[1]).toEqual({ id: 'two' });
  });

  it('passes the leftOutCallback on as it is, and counts nothing itself', async () => {
    const leftOutCallback: LeftOutAttributesCallback = jest.fn();
    const seen: unknown[] = [];

    await runPerObject({
      objects,
      leftOutCallback,
      work: async (parameters) => {
        seen.push(parameters.leftOutCallback);
      },
    });

    expect(seen).toEqual([leftOutCallback, leftOutCallback, leftOutCallback]);
    expect(leftOutCallback).not.toHaveBeenCalled();
  });

  it('gives the work no leftOutCallback when it was given none', async () => {
    const seen: unknown[] = [];

    await runPerObject({
      objects: [{ id: 'one' }],
      work: async (parameters) => {
        seen.push(parameters.leftOutCallback);
      },
    });

    expect(seen).toEqual([undefined]);
  });

  it('gives the work the object itself, and the objects can have more than an id', async () => {
    const withBody = [{ id: 'one', body: { a: 1 } }];
    const bodies: unknown[] = [];

    await runPerObject({
      objects: withBody,
      work: async ({ object }) => {
        bodies.push(object);
      },
    });

    expect(bodies).toEqual(withBody);
    expect(bodies[0]).toBe(withBody[0]);
  });

  it('runs an object that has the id of an earlier one, and gives its own outcome', async () => {
    const outcomes = await runPerObject({
      objects: [{ id: 'same' }, { id: 'same' }],
      work: async () => undefined,
    });

    expect(outcomes).toEqual([{ id: 'same' }, { id: 'same' }]);
  });

  it('gives nothing for no objects', async () => {
    const resultCallback = jest.fn();

    await expect(
      runPerObject({ objects: [], work: async () => 1, resultCallback })
    ).resolves.toEqual([]);
    expect(resultCallback).not.toHaveBeenCalled();
  });

  it('prints nothing, for a success or a failure', async () => {
    const written: unknown[] = [];
    const spies = [
      jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        written.push(chunk);
        return true;
      }),
      jest.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
        written.push(chunk);
        return true;
      }),
      ...(['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
        jest.spyOn(console, method).mockImplementation((...args) => {
          written.push(args);
        })
      ),
    ];
    try {
      await runPerObject({
        objects,
        work: async ({ object }) => {
          if (object.id === 'two') throw new Error('failed');
        },
      });
    } finally {
      for (const spy of spies) spy.mockRestore();
    }

    expect(written).toEqual([]);
  });
});

describe('the callback types of OpsTypes', () => {
  it('LeftOutAttributesCallback takes the id and the names of the attributes and gives nothing', () => {
    const type = typeAlias('ops/OpsTypes.ts', 'LeftOutAttributesCallback').type;

    expect(ts.isFunctionTypeNode(type)).toBe(true);
    const signature = type as ts.FunctionTypeNode;
    expect(signature.parameters.map((p) => p.name.getText())).toEqual([
      'id',
      'attributes',
    ]);
    expect(signature.parameters.map((p) => p.type?.getText())).toEqual([
      'string',
      'string[]',
    ]);
    expect(signature.type.kind).toBe(ts.SyntaxKind.VoidKeyword);
  });

  it('the callback of the trusted jwt issuer is an alias of it, so its name and shape stay', () => {
    const type = typeAlias(
      'ops/OAuth2TrustedJwtIssuerOps.ts',
      'OAuth2TrustedJwtIssuerLeftOutAttributesCallback'
    ).type;

    expect(ts.isTypeReferenceNode(type)).toBe(true);
    expect((type as ts.TypeReferenceNode).typeName.getText()).toBe(
      'LeftOutAttributesCallback'
    );
  });

  it('PushOutcome is an id and an optional error', () => {
    const type = typeAlias('ops/OpsTypes.ts', 'PushOutcome').type;

    expect(ts.isTypeLiteralNode(type)).toBe(true);
    expect(
      (type as ts.TypeLiteralNode).members.map((m) => m.getText())
    ).toEqual(['id: string;', 'error?: FrodoError;']);
  });
});

describe('the module stays pure', () => {
  const imports = importSpecifiersOf('src/ops/internal/FileSetEngine.ts');

  it('imports no module of the file system, the machine or other processes', () => {
    expect(imports.filter((s) => NODE_IO_MODULES.includes(s))).toEqual([]);
  });

  it('imports no layer above the ops, and not the facade or the package root', () => {
    expect(
      imports.filter((s) =>
        /^\.\.\/\.\.\/(api|lib|mcp|index)(\/|$)|^\.\.\/\.\.\/ext/.test(s)
      )
    ).toEqual([]);
  });

  it('imports exactly what it needs: the shared state and constants, the format and path rules, the file set types, and the helpers of the ops layer', () => {
    // `ExportImportUtils` holds the filling of placeholders and `getErrorCallback`; it is the one module of the list that
    // reaches the file system, for the functions that the engine does not call
    expect([...imports].sort()).toEqual([
      '../../shared/Constants',
      '../../shared/State',
      '../../utils/ExportFileFormatUtils',
      '../../utils/ExportImportUtils',
      '../../utils/FileSetPathUtils',
      '../../utils/FileSetUtils',
      '../../utils/JsonUtils',
      '../FrodoError',
      '../OpsTypes',
    ]);
  });
});
