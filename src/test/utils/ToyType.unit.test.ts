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

  it('gives a toy whose file holds no `_id` the id that the name of its file stands for', async () => {
    const reader = readerOf(
      buildFileSet({
        files: [{ path: 'realms/alpha/toys/a%2Fb.json', content: '{"x":1}' }],
      })
    );

    const merged = await mergeToys({ reader, state: stateOf('cloud') });

    expect(merged.alpha).toEqual([{ x: 1, _id: 'a/b' }]);
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
          { path: 'realms/alpha/toys/A.json', content: '{"a":"${NO_VALUE}"}' },
          { path: 'realms/alpha/toys/B.json', content: '{"b":1}' },
          { path: 'realms/alpha/toys/C.json', content: '{ not json' },
          { path: 'realms/alpha/toys/D.json', content: '{"d":1}' },
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

    expect(sent).toEqual(['B', 'D']);
    expect(outcomes.map((o) => [o.id, o.error?.message])).toEqual([
      ['A', 'Error processing A'],
      ['B', undefined],
      ['C', 'Error processing C'],
      ['D', undefined],
    ]);
    expect(outcomes[0].error?.originalErrors[0].message).toBe(
      'No value found for placeholder "NO_VALUE"'
    );
    expect(outcomes[2].error?.originalErrors[0].message).toBe(
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
