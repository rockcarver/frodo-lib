/**
 * Run tests
 *
 *        npm run test:only -- src/test/utils/ToyType
 *
 * A configuration type that exists only for the tests (`ToyType.ts`) is pulled, written to a file set, read back and pushed,
 * through the same functions of the engine and the builder that the first real type will use. The files of a pull are
 * compared byte for byte with a golden folder that was written by hand (`src/test/golden/toy`), and the golden helper
 * (`FileSetGolden.ts`) is shown to fail for the four ways a pull can differ from it: a changed byte, a missing file, an extra
 * file and a different list of owned folders.
 *
 * Hermetic: made-up toys, no tenant, no recording; the one folder that is written is a copy of the golden folder in the
 * temporary folder of the machine, which the test removes.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';
import { FrodoError } from '../../ops/FrodoError';
import StateImpl, { type State } from '../../shared/State';
import {
  buildFileSet,
  createMemoryFileSetReader,
  type VirtualFileSet,
} from '../../utils/FileSetUtils';
import { goldenDifferences } from './FileSetGolden';
import {
  mergeToys,
  pullToys,
  pushToys,
  splitToys,
  TOY_TENANT,
  type ToyObject,
} from './ToyType';

const GOLDEN = fileURLToPath(new URL('../golden/toy', import.meta.url));
const host = 'https://openam-matrix.example.com/am';

const stateOf = (deployment: 'cloud' | 'forgeops' | 'classic'): State => {
  const state = StateImpl({ host });
  state.setDeploymentType(deployment);
  return state;
};

/** The toys of the tenant that a realm answers with, and the realms that it was asked in. */
const tenant = (toys: Record<string, ToyObject[]> = TOY_TENANT) => {
  const asked: { realm: string; stateRealm: string }[] = [];
  return {
    asked,
    readToys: (state: State) => async (realm: string) => {
      asked.push({ realm, stateRealm: state.getRealm() });
      return JSON.parse(JSON.stringify(toys[realm] ?? []));
    },
    realmNames: async () => [...new Set(['/', ...Object.keys(toys)])],
  };
};

const pull = async (
  deployment: 'cloud' | 'forgeops' | 'classic' = 'cloud',
  more: { realm?: string; toys?: Record<string, ToyObject[]> } = {}
) => {
  const state = stateOf(deployment);
  const fake = tenant(more.toys);
  const split = await pullToys({
    readToys: fake.readToys(state),
    realmNames: fake.realmNames,
    realm: more.realm,
    state,
  });
  return { ...split, asked: fake.asked, state };
};

describe('pulling the toys', () => {
  it('gives the golden file set, byte for byte', async () => {
    const { fileSet } = await pull();

    expect(goldenDifferences(fileSet, GOLDEN)).toEqual([]);
  });

  it('reads the toys of every realm in that realm, and leaves the root realm of a Cloud deployment out', async () => {
    const { asked, state } = await pull('cloud');

    expect(asked).toEqual([
      { realm: 'alpha', stateRealm: 'alpha' },
      { realm: 'bravo', stateRealm: 'bravo' },
    ]);
    expect(state.getRealm()).not.toBe('bravo');
  });

  it('keeps the root realm of a ForgeOps deployment, in the folder `root`', async () => {
    const toys = { ...TOY_TENANT, '/': [{ _id: 'Top', name: 'Top' }] };
    const { fileSet, asked } = await pull('forgeops', { toys });

    expect(asked.map((a) => a.realm)).toEqual(['/', 'alpha', 'bravo']);
    expect(fileSet.files.map((file) => file.path)).toContain(
      'realms/root/toys/Top.json'
    );
    expect(fileSet.ownedFolders).toContain('realms/root/toys');
  });

  it('pulls only the realm that was named, and does not ask for the realms', async () => {
    const { fileSet, asked } = await pull('cloud', { realm: 'bravo' });

    expect(asked).toEqual([{ realm: 'bravo', stateRealm: 'bravo' }]);
    expect(fileSet).toEqual({
      files: [
        {
          path: 'realms/bravo/toys/Login.json',
          content: '{\n  "_id": "Login",\n  "name": "Bravo login"\n}\n',
        },
      ],
      ownedFolders: ['realms/bravo/toys'],
    });
  });

  it('gives byte for byte the same files when pulled twice', async () => {
    const first = await pull();
    const second = await pull();

    expect(second.fileSet).toEqual(first.fileSet);
    expect(JSON.stringify(second.fileSet)).toBe(JSON.stringify(first.fileSet));
  });

  it('gives the same files whatever order the tenant answers in', async () => {
    const reversed: Record<string, ToyObject[]> = {};
    for (const [realm, toys] of Object.entries(TOY_TENANT)) {
      reversed[realm] = [...toys].reverse();
    }

    expect((await pull('cloud', { toys: reversed })).fileSet).toEqual(
      (await pull()).fileSet
    );
  });

  it('does not change what the tenant answered, and writes no `_rev`', async () => {
    const toys = JSON.parse(JSON.stringify(TOY_TENANT));
    const { fileSet } = splitToys({ toys });

    expect(toys).toEqual(TOY_TENANT);
    expect(fileSet.files.map((file) => file.content).join('')).not.toContain(
      '_rev'
    );
  });

  it('gives a set that the builder takes as it is', async () => {
    const { fileSet } = await pull();

    expect(buildFileSet(fileSet)).toEqual(fileSet);
  });

  it('reports a toy whose name another toy has, and the id that leaves no file name, and writes the others', async () => {
    const toys: Record<string, ToyObject[]> = {
      alpha: [
        { _id: 'login', name: 'second' },
        { _id: 'Login', name: 'first' },
        { _id: '..', name: 'no name' },
        { _id: 'con', name: 'device' },
        { _id: 'fine', name: 'fine' },
      ],
    };
    const { fileSet, collisions, refused } = await pull('cloud', { toys });

    // ids are taken in ordinal order: `Login` is before `login`
    expect(collisions).toEqual([
      { realm: 'alpha', id: 'login', firstId: 'Login' },
    ]);
    expect(refused.map((r) => `${r.realm} ${r.id}`)).toEqual([
      'alpha ..',
      'alpha con',
    ]);
    expect(refused[0].error.message).toBe(
      "'..' does not name an object: an id or a name is not a path"
    );
    expect(fileSet.files.map((file) => file.path)).toEqual([
      'realms/alpha/toys/Login.json',
      'realms/alpha/toys/fine.json',
    ]);
  });

  describe('with overrides', () => {
    const overrides = {
      alpha: [
        {
          id: 'LOGIN',
          overrides: { size: 9, host: '${HOST_ON_PUSH}', tags: ['z'] },
        },
        { id: 'Nobody', overrides: { a: 1 } },
      ],
      charlie: [{ id: 'Login', overrides: { a: 1 } }],
    };

    it('merges them into the object that the id names, whatever the case, and writes a placeholder of an override as it is', async () => {
      const state = stateOf('cloud');
      const fake = tenant();
      const { fileSet } = await pullToys({
        readToys: fake.readToys(state),
        realmNames: fake.realmNames,
        overrides,
        state,
      });
      const login = fileSet.files.find(
        (file) => file.path === 'realms/alpha/toys/Login.json'
      );

      expect(login?.content).toContain('"host": "${HOST_ON_PUSH}"');
      expect(JSON.parse(login!.content)).toMatchObject({
        size: 9,
        tags: ['z', 'a'],
        name: 'Login',
      });
      // the other files are the golden files
      expect(
        goldenDifferences(fileSet, GOLDEN).filter(
          (line) => line !== 'changed: realms/alpha/toys/Login.json'
        )
      ).toEqual([]);
    });

    it('reports the entries that matched nothing, in the realms that were visited only', async () => {
      const state = stateOf('cloud');
      const fake = tenant();
      const { unmatched } = await pullToys({
        readToys: fake.readToys(state),
        realmNames: fake.realmNames,
        overrides,
        state,
      });

      expect(unmatched).toEqual([{ realm: 'alpha', id: 'Nobody' }]);
    });
  });
});

describe('reading the file set and pushing it', () => {
  const fileSetOfTheTenant = async () => (await pull()).fileSet;
  const readerOf = (fileSet: VirtualFileSet) =>
    createMemoryFileSetReader(fileSet);

  it('merges what a pull split: the toys come back as they were on the tenant, without `_rev`', async () => {
    const reader = readerOf(await fileSetOfTheTenant());

    const merged = await mergeToys({ reader, state: stateOf('cloud') });
    const expected: Record<string, ToyObject[]> = {};
    for (const [realm, toys] of Object.entries(TOY_TENANT)) {
      expected[realm] = toys
        .map(({ _rev, ...rest }) => rest as ToyObject)
        .sort((a, b) => (a._id < b._id ? -1 : 1));
    }

    expect(Object.keys(merged)).toEqual(['alpha', 'bravo']);
    for (const realm of Object.keys(expected)) {
      expect(merged[realm]).toEqual(expected[realm]);
    }
  });

  it('fails the merge for a file that holds no `_id`, and names the file: the name of a file is never an id', async () => {
    const reader = readerOf(
      buildFileSet({
        files: [{ path: 'realms/alpha/toys/a%2Fb.json', content: '{"x":1}' }],
      })
    );

    await expect(
      mergeToys({ reader, state: stateOf('cloud') })
    ).rejects.toThrow('The file realms/alpha/toys/a%2Fb.json holds no _id.');
  });

  it('merges only the realm that was named, and none that does not exist in the set', async () => {
    const reader = readerOf(await fileSetOfTheTenant());
    const state = stateOf('cloud');

    expect(
      Object.keys(await mergeToys({ reader, realm: 'bravo', state }))
    ).toEqual(['bravo']);
    expect(await mergeToys({ reader, realm: 'charlie', state })).toEqual({
      charlie: [],
    });
  });

  it('merges a set that has no realms at all as nothing', async () => {
    const reader = readerOf({ files: [], ownedFolders: [] });

    expect(await mergeToys({ reader, state: stateOf('cloud') })).toEqual({});
  });

  it('pushes every toy in its realm, one outcome for each, in order, and puts the realm back', async () => {
    const reader = readerOf(await fileSetOfTheTenant());
    const state = stateOf('cloud');
    state.setRealm('alpha');
    const sent: string[] = [];

    const outcomes = await pushToys({
      reader,
      state,
      importToy: async (realm, toy) => {
        sent.push(`${realm}:${toy._id}:${state.getRealm()}`);
        return toy;
      },
    });

    expect(sent).toEqual([
      'alpha:Login:alpha',
      'alpha:Zion:alpha',
      'alpha:a/b:alpha',
      'bravo:Login:bravo',
    ]);
    expect(outcomes).toEqual([
      { id: 'Login' },
      { id: 'Zion' },
      { id: 'a/b' },
      { id: 'Login' },
    ]);
    expect(state.getRealm()).toBe('alpha');
  });

  it('pushes the rest when a toy fails, and says which one failed', async () => {
    const reader = readerOf(await fileSetOfTheTenant());
    const results: [string | undefined, string | undefined][] = [];

    const outcomes = await pushToys({
      reader,
      state: stateOf('cloud'),
      importToy: async (realm, toy) => {
        if (realm === 'alpha' && toy._id === 'Zion') {
          throw new Error('the server refused it');
        }
        return toy;
      },
      resultCallback: (error, result) => {
        results.push([error?.message, result?._id]);
      },
    });

    expect(outcomes.map((o) => [o.id, o.error?.message])).toEqual([
      ['Login', undefined],
      ['Zion', 'Error processing Zion'],
      ['a/b', undefined],
      ['Login', undefined],
    ]);
    expect(outcomes[1].error).toBeInstanceOf(FrodoError);
    expect(outcomes[1].error?.originalErrors[0].message).toBe(
      'the server refused it'
    );
    expect(results).toEqual([
      [undefined, 'Login'],
      ['Error processing Zion', undefined],
      [undefined, 'a/b'],
      [undefined, 'Login'],
    ]);
  });

  it('hands the left-out callback to the function that sends a toy', async () => {
    const reader = readerOf(await fileSetOfTheTenant());
    const leftOutCallback = jest.fn();
    const handed: unknown[] = [];

    await pushToys({
      reader,
      state: stateOf('cloud'),
      leftOutCallback,
      importToy: async (_realm, toy, callback) => {
        handed.push(callback);
        return toy;
      },
    });

    expect(handed).toEqual([
      leftOutCallback,
      leftOutCallback,
      leftOutCallback,
      leftOutCallback,
    ]);
  });

  it('fills the placeholder of a file from the state when it pushes, and a literal `${` that a pull escaped stays as it was', async () => {
    const files = [
      {
        path: 'realms/alpha/toys/Login.json',
        content:
          '{"_id":"Login","host":"${HOST_ON_PUSH}","text":"\\\\${kept}"}',
      },
    ];
    const state = stateOf('cloud');
    state.setEnv('HOST_ON_PUSH', 'https://openam-zion.example.com');
    const received: ToyObject[] = [];

    await pushToys({
      reader: readerOf(buildFileSet({ files })),
      state,
      importToy: async (_realm, toy) => {
        received.push(toy);
        return toy;
      },
    });

    expect(received).toEqual([
      {
        _id: 'Login',
        host: 'https://openam-zion.example.com',
        text: '${kept}',
      },
    ]);
  });

  it('fails only the file whose placeholder has no value, or whose text is not JSON, and pushes the others', async () => {
    const reader = readerOf(
      buildFileSet({
        files: [
          {
            path: 'realms/alpha/toys/A.json',
            content: '{"_id":"A","a":"${NO_VALUE}"}',
          },
          { path: 'realms/alpha/toys/B.json', content: '{"_id":"B","b":1}' },
          { path: 'realms/alpha/toys/C.json', content: '{ not json' },
          { path: 'realms/alpha/toys/D.json', content: '{"_id":"D","d":1}' },
        ],
      })
    );
    const sent: string[] = [];

    const outcomes = await pushToys({
      reader,
      state: stateOf('cloud'),
      importToy: async (_realm, toy) => {
        sent.push(toy._id);
        return toy;
      },
    });

    // the toys go in the order of their ids; a file that cannot be read has its path for an id, which sorts after them
    expect(sent).toEqual(['B', 'D']);
    expect(outcomes.map((o) => [o.id, o.error?.message])).toEqual([
      ['B', undefined],
      ['D', undefined],
      ['realms/alpha/toys/A.json', 'Error processing realms/alpha/toys/A.json'],
      ['realms/alpha/toys/C.json', 'Error processing realms/alpha/toys/C.json'],
    ]);
    expect(outcomes[2].error?.originalErrors[0].message).toBe(
      'No value found for placeholder "NO_VALUE"'
    );
    expect(outcomes[3].error?.originalErrors[0].message).toBe(
      'Error parsing JSON from realms/alpha/toys/C.json'
    );
  });

  it('is the identity: pull, read back, split again gives the same file set', async () => {
    const first = await fileSetOfTheTenant();
    const merged = await mergeToys({
      reader: readerOf(first),
      state: stateOf('cloud'),
    });

    expect(splitToys({ toys: merged }).fileSet).toEqual(first);
  });
});

/**
 * A push never reads a file name. The id of a toy is the `_id` that its file holds: the files are the same toys whatever they
 * are called, in the order of their ids, which is what lets a type give a long id a shortened name with a checksum.
 */
describe('a push never reads a file name', () => {
  const LONG_ONE = `${'a'.repeat(300)}-1`;
  const LONG_TWO = `${'a'.repeat(300)}-2`;
  /** The toys of the tenant, and ids that need escapes, are long, or are not text. */
  const hardToys = (): Record<string, ToyObject[]> => ({
    alpha: [
      ...TOY_TENANT.alpha,
      { _id: LONG_ONE, name: 'long one' },
      { _id: LONG_TWO, name: 'long two' },
      { _id: 'x\ud800', name: 'a lone surrogate' },
      { _id: '😀'.repeat(70), name: 'emoji' },
      { _id: '/'.repeat(100), name: 'slashes' },
      { _id: `a:${'n'.repeat(247)}`, name: 'a colon' },
    ],
    bravo: TOY_TENANT.bravo,
  });
  const readerOf = (fileSet: VirtualFileSet) =>
    createMemoryFileSetReader(fileSet);

  /** Every file of the set under another name: reversed, as `f<index>.json`, in the same folder. */
  const renamedEvery = (fileSet: VirtualFileSet): VirtualFileSet => ({
    ownedFolders: fileSet.ownedFolders,
    files: [...fileSet.files].reverse().map((file, index) => ({
      path: `${file.path.slice(0, file.path.lastIndexOf('/'))}/f${index}.json`,
      content: file.content,
    })),
  });

  /** What a push does and says: the toys it sends, in order, and how it ends, for every object. */
  const pushed = async (fileSet: VirtualFileSet) => {
    const sent: string[] = [];
    const told: [string | undefined, string | undefined][] = [];
    const state = stateOf('cloud');
    const outcomes = await pushToys({
      reader: readerOf(fileSet),
      state,
      importToy: async (realm, toy) => {
        sent.push(`${realm}:${JSON.stringify(toy)}`);
        if (toy._id === LONG_TWO) throw new Error('the server refused it');
        return toy;
      },
      resultCallback: (error, result) => {
        told.push([error?.message, result?._id]);
      },
    });
    return {
      sent,
      told,
      outcomes: outcomes.map((outcome) => [
        outcome.id,
        outcome.error?.message,
        outcome.error?.originalErrors?.map((e) => e.message),
      ]),
    };
  };

  it('gives the same toys, the same order, the same outcomes, errors and callback calls when every file has another name', async () => {
    const { fileSet } = await pull('cloud', { toys: hardToys() });
    const renamed = renamedEvery(fileSet);

    // the files are all called something else, in the same folders, and the pull is made of hard ids
    expect(fileSet.files).toHaveLength(10);
    expect(renamed.files).toHaveLength(10);
    expect(renamed.files.map((file) => file.path)).not.toEqual(
      expect.arrayContaining(fileSet.files.map((file) => file.path))
    );
    expect(
      renamed.files.every((file) =>
        /^realms\/\w+\/toys\/f\d+\.json$/.test(file.path)
      )
    ).toBe(true);
    expect(renamed.files.some((file) => file.path.includes('~'))).toBe(false);
    expect(fileSet.files.some((file) => file.path.includes('~'))).toBe(true);

    const before = await mergeToys({
      reader: readerOf(fileSet),
      state: stateOf('cloud'),
    });
    const after = await mergeToys({
      reader: readerOf(renamed),
      state: stateOf('cloud'),
    });

    expect(after).toEqual(before);
    expect(before.alpha.map((toy) => toy._id)).toContain('x\ud800');
    expect(before.alpha.map((toy) => toy._id)).toContain(LONG_ONE);

    const first = await pushed(fileSet);
    const second = await pushed(renamed);

    expect(second).toEqual(first);
    // the toys went in the order of their ids, and the failed one is the one that the server refused, by its id
    expect(first.sent).toHaveLength(10);
    expect(
      first.outcomes.filter((outcome) => outcome[1] !== undefined)
    ).toEqual([
      [LONG_TWO, `Error processing ${LONG_TWO}`, ['the server refused it']],
    ]);
    // realm by realm, each in the order of the ids
    const alphaIds = hardToys().alpha.map((toy) => toy._id);
    expect(first.outcomes.map((outcome) => outcome[0])).toEqual([
      ...alphaIds.sort((a, b) => (a < b ? -1 : 1)),
      'Login',
    ]);
    expect(first.told).toHaveLength(10);
  });

  it('sends the toys in the order of their ids, and not in the order of the files', async () => {
    const reader = readerOf(
      buildFileSet({
        files: [
          { path: 'realms/alpha/toys/1.json', content: '{"_id":"c"}' },
          { path: 'realms/alpha/toys/2.json', content: '{"_id":"a"}' },
          { path: 'realms/alpha/toys/3.json', content: '{"_id":"b"}' },
        ],
      })
    );
    const sent: string[] = [];

    const outcomes = await pushToys({
      reader,
      state: stateOf('cloud'),
      importToy: async (_realm, toy) => {
        sent.push(toy._id);
        return toy;
      },
    });

    expect(sent).toEqual(['a', 'b', 'c']);
    expect(outcomes.map((outcome) => outcome.id)).toEqual(['a', 'b', 'c']);
  });

  it('takes the id from the file and not from its name, also when the name looks like another id', async () => {
    const reader = readerOf(
      buildFileSet({
        files: [
          { path: 'realms/alpha/toys/Login.json', content: '{"_id":"Zion"}' },
          { path: 'realms/alpha/toys/Zion.json', content: '{"_id":"Login"}' },
        ],
      })
    );
    const sent: string[] = [];

    const outcomes = await pushToys({
      reader,
      state: stateOf('cloud'),
      importToy: async (_realm, toy) => {
        sent.push(toy._id);
        return toy;
      },
    });

    expect(sent).toEqual(['Login', 'Zion']);
    expect(outcomes).toEqual([{ id: 'Login' }, { id: 'Zion' }]);
  });

  it('fails only the file that holds no `_id`, with its path for an id, and pushes the others', async () => {
    const { fileSet } = await pull('cloud', { toys: hardToys() });
    const withoutId: VirtualFileSet = {
      ...fileSet,
      files: [
        ...fileSet.files,
        { path: 'realms/alpha/toys/noid.json', content: '{"name":"no id"}\n' },
        { path: 'realms/alpha/toys/null.json', content: 'null\n' },
      ],
    };
    const sent: string[] = [];
    const told: (string | undefined)[] = [];

    const outcomes = await pushToys({
      reader: readerOf(buildFileSet(withoutId)),
      state: stateOf('cloud'),
      importToy: async (_realm, toy) => {
        sent.push(toy._id);
        return toy;
      },
      resultCallback: (error) => {
        told.push(error?.message);
      },
    });

    const failed = outcomes.filter((outcome) => outcome.error);
    expect(failed.map((outcome) => outcome.id)).toEqual([
      'realms/alpha/toys/noid.json',
      'realms/alpha/toys/null.json',
    ]);
    expect(failed[0].error?.message).toBe(
      'Error processing realms/alpha/toys/noid.json'
    );
    expect(failed[0].error?.originalErrors[0].message).toBe(
      'The file realms/alpha/toys/noid.json holds no _id.'
    );
    expect(failed[1].error?.originalErrors[0].message).toBe(
      'The file realms/alpha/toys/null.json holds no _id.'
    );
    // the others were pushed, all ten of them, and the callback was told of every file
    expect(sent).toHaveLength(10);
    expect(outcomes).toHaveLength(12);
    expect(told.filter((message) => message !== undefined)).toHaveLength(2);
    expect(told).toHaveLength(12);
    await expect(
      mergeToys({
        reader: readerOf(buildFileSet(withoutId)),
        state: stateOf('cloud'),
      })
    ).rejects.toThrow('holds no _id.');
  });

  it('pulls the same files twice, and whatever order the tenant answers in', async () => {
    const first = await pull('cloud', { toys: hardToys() });
    const second = await pull('cloud', { toys: hardToys() });
    const reversed = hardToys();
    reversed.alpha.reverse();
    const third = await pull('cloud', { toys: reversed });

    expect(second.fileSet).toEqual(first.fileSet);
    expect(third.fileSet).toEqual(first.fileSet);
    expect(first.collisions).toEqual([]);
    expect(first.refused).toEqual([]);
  });

  it('is the identity for ids of every kind: pull, read back, split again gives the same files, and the toys come back whole', async () => {
    const first = await pull('cloud', { toys: hardToys() });
    const merged = await mergeToys({
      reader: readerOf(first.fileSet),
      state: stateOf('cloud'),
    });

    expect(splitToys({ toys: merged }).fileSet).toEqual(first.fileSet);
    const ids = merged.alpha.map((toy) => toy._id);
    for (const toy of hardToys().alpha) {
      expect(ids).toContain(toy._id);
    }
  });

  it('gives every id its own file and never makes a path that the gate refuses, however the id is made', () => {
    const ids: string[] = [];
    for (const character of [
      'a',
      'é',
      '€',
      '😀',
      '/',
      '?',
      '*',
      '%',
      '\u0085',
      ' ',
    ]) {
      for (const length of [
        1, 60, 62, 63, 84, 85, 86, 120, 125, 126, 250, 251, 255, 256, 300, 1000,
      ]) {
        ids.push(character.repeat(length));
      }
    }
    ids.push(
      '\ud800',
      'x\ud800',
      `${'x'.repeat(254)}\ud800`,
      `${'x'.repeat(245)}\ud800`
    );
    const toys = ids.map((_id) => ({ _id }));

    const split = splitToys({ toys: { alpha: toys } });

    // only ids that leave no name (dots, `*`, a device name) are refused; every other id is a file, and no two ids share one
    expect(split.collisions).toEqual([]);
    expect(
      split.refused.map((r) => r.id).every((id) => /^[*.]+$/.test(id))
    ).toBe(true);
    expect(split.fileSet.files.length + split.refused.length).toBe(ids.length);
    for (const file of split.fileSet.files) {
      expect(
        Buffer.byteLength(file.path.slice(file.path.lastIndexOf('/') + 1))
      ).toBeLessThanOrEqual(255);
    }
  });
});

describe('realms and toys with the names of Object.prototype', () => {
  const NAMES = ['constructor', 'toString', '__proto__', 'hasOwnProperty'];
  /** The toys of the tenant as a parse makes them: an own property for every name, `__proto__` too. */
  const toys = (): Record<string, ToyObject[]> =>
    JSON.parse(
      `{ ${NAMES.map(
        (name) =>
          `${JSON.stringify(name)}: [ { "_id": ${JSON.stringify(name)}, "name": "toy of ${name}" } ]`
      ).join(', ')} }`
    );

  it('are pulled to files and pushed back, each in its own realm', async () => {
    const state = stateOf('forgeops');
    const fake = tenant(toys());
    const split = await pullToys({
      readToys: fake.readToys(state),
      realmNames: async () => NAMES,
      state,
    });

    expect(split.fileSet.files.map((file) => file.path)).toEqual(
      NAMES.map((name) => `realms/${name}/toys/${name}.json`).sort()
    );
    const sent: string[] = [];
    const outcomes = await pushToys({
      reader: createMemoryFileSetReader(split.fileSet),
      state,
      importToy: async (realm, toy) => {
        sent.push(`${realm}:${toy._id}`);
        return toy;
      },
    });

    expect(sent.sort()).toEqual(NAMES.map((name) => `${name}:${name}`).sort());
    expect(outcomes.every((outcome) => outcome.error === undefined)).toBe(true);
    expect(outcomes).toHaveLength(NAMES.length);
  });

  it('are merged as realms of their own, not as members of the object that holds them', async () => {
    const { fileSet } = splitToys({ toys: toys() });
    const merged = await mergeToys({
      reader: createMemoryFileSetReader(fileSet),
      state: stateOf('forgeops'),
    });

    expect(Object.keys(merged).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(Object.getOwnPropertyDescriptor(merged, name)?.value).toEqual([
        { _id: name, name: `toy of ${name}` },
      ]);
    }
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
  });
});

describe('the golden helper', () => {
  let copy: string;
  beforeEach(() => {
    copy = mkdtempSync(join(tmpdir(), 'file-set-golden-'));
    cpSync(GOLDEN, copy, { recursive: true });
  });
  afterEach(() => {
    rmSync(copy, { recursive: true, force: true });
  });

  it('finds nothing to say about the golden set, and about a copy of the golden folder', async () => {
    const { fileSet } = await pull();

    expect(goldenDifferences(fileSet, GOLDEN)).toEqual([]);
    expect(goldenDifferences(fileSet, copy)).toEqual([]);
  });

  it('fails for one changed byte', async () => {
    const { fileSet } = await pull();
    const file = join(copy, 'files/realms/bravo/toys/Login.json');
    const text = readFileSync(file, 'utf8');
    writeFileSync(file, text.replace('Bravo login', 'Bravo logim'));

    expect(goldenDifferences(fileSet, copy)).toEqual([
      'changed: realms/bravo/toys/Login.json',
    ]);
  });

  it('fails for a changed line end and for a missing newline at the end', async () => {
    const { fileSet } = await pull();
    const crlf = join(copy, 'files/realms/bravo/toys/Login.json');
    writeFileSync(crlf, readFileSync(crlf, 'utf8').replace(/\n/g, '\r\n'));
    const noNewline = join(copy, 'files/realms/alpha/toys/Zion.json');
    writeFileSync(noNewline, readFileSync(noNewline, 'utf8').trimEnd());

    expect(goldenDifferences(fileSet, copy)).toEqual([
      'changed: realms/alpha/toys/Zion.json',
      'changed: realms/bravo/toys/Login.json',
    ]);
  });

  it('fails for a file that the set does not have', async () => {
    const { fileSet } = await pull();
    const smaller: VirtualFileSet = {
      ...fileSet,
      files: fileSet.files.filter(
        (file) => file.path !== 'realms/alpha/toys/Zion.json'
      ),
    };

    expect(goldenDifferences(smaller, GOLDEN)).toEqual([
      'missing: realms/alpha/toys/Zion.json',
    ]);
  });

  it('fails for a file that the golden folder does not have', async () => {
    const { fileSet } = await pull();
    const bigger: VirtualFileSet = {
      ...fileSet,
      files: [
        ...fileSet.files,
        { path: 'realms/alpha/toys/Extra.json', content: '{}\n' },
      ],
    };

    expect(goldenDifferences(bigger, GOLDEN)).toEqual([
      'extra: realms/alpha/toys/Extra.json',
    ]);
  });

  it('fails for a different list of owned folders', async () => {
    const { fileSet } = await pull();

    expect(
      goldenDifferences(
        { ...fileSet, ownedFolders: ['realms/alpha/toys'] },
        GOLDEN
      )
    ).toEqual([
      'owned folders: expected ["realms/alpha/toys","realms/bravo/toys"], got ["realms/alpha/toys"]',
    ]);
    writeFileSync(join(copy, 'owned-folders.json'), '["realms/alpha/toys"]\n');
    expect(goldenDifferences(fileSet, copy)).toEqual([
      'owned folders: expected ["realms/alpha/toys"], got ["realms/alpha/toys","realms/bravo/toys"]',
    ]);
  });

  it('fails for every difference at once, and says each', async () => {
    const { fileSet } = await pull();
    const other: VirtualFileSet = {
      files: [
        { path: 'realms/alpha/toys/Login.json', content: 'changed\n' },
        { path: 'realms/other/toys/New.json', content: '{}\n' },
      ],
      ownedFolders: [],
    };

    expect(goldenDifferences(other, GOLDEN)).toEqual([
      'missing: realms/alpha/toys/Zion.json',
      'missing: realms/alpha/toys/a%2Fb.json',
      'missing: realms/bravo/toys/Login.json',
      'changed: realms/alpha/toys/Login.json',
      'extra: realms/other/toys/New.json',
      'owned folders: expected ["realms/alpha/toys","realms/bravo/toys"], got []',
    ]);
    expect(fileSet.files).toHaveLength(4);
  });
});
