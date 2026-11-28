/**
 * Run tests
 *
 *        npm run test:only -- src/ops/internal/FileSetEngine.list
 *
 * The engine functions of a configuration type that has a LIST of objects, one file for each (`splitList`, `mergeList`,
 * `mergeAndWriteList`, `assertBounded` in `src/ops/internal/FileSetEngine.ts`): the split into a file set and the findings of
 * a pull, the read of the files of a folder with the check of every id, and the push object by object. The functions of the
 * engine that serve a type with one object are in `FileSetEngine.unit.test.ts`.
 *
 * The three ways that a type says what its id looks like (`idPrefix`) have a spec each:
 * - `LOCALES`: a prefix and one name (`uilocale/fr`),
 * - `ROLES`: no prefix and one name (`openidm-admin`),
 * - `FREE`: the id never reaches a request, so any text will do (a name that a type keeps in a list of a larger object).
 * A canary is a value that a test puts into the state or the environment of the process and then looks for in everything that a
 * caller can see: it must not be there.
 *
 * Hermetic: made-up objects and files, a reader over memory, no tenant, no recording.
 */
import { inspect } from 'node:util';
import { jest } from '@jest/globals';
import StateImpl, { type State } from '../../shared/State';
import { importSpecifiersOf } from '../../test/exportFileFormat/importsOf';
import {
  countingReader,
  everythingOf,
  readerOf,
} from '../../test/utils/FileSetTestKit';
import { sourceText } from '../../test/utils/SourceText';
import { encodedName } from '../../utils/FileSetPathUtils';
import { type FileSetReader } from '../../utils/FileSetUtils';
import { FrodoError } from '../FrodoError';
import { type PullFinding, type PullResult } from '../OpsTypes';
import {
  assertBounded,
  fileOfObject,
  mergeAndWriteList,
  mergeList,
  splitList,
  type ListRead,
  type ListSpec,
} from './FileSetEngine';

const LOCALES: ListSpec = {
  folder: 'locales',
  idPrefix: 'uilocale/',
  type: { key: 'locales' },
};
const ROLES: ListSpec = {
  folder: 'roles',
  idPrefix: '',
  type: { key: 'roles' },
};
const FREE: ListSpec = {
  folder: 'free',
  idPrefix: null,
  type: { key: 'free' },
};

const stateOf = (): State => {
  const state = StateImpl({ host: 'https://openam-matrix.example.com/am' });
  state.setDeploymentType('cloud');
  return state;
};

/** What one name is, in the words of a message. */
const ONE_NAME =
  'one name (not empty, not "." or "..", not "." or ".." with a ";" after it, no slash, backslash, "?", "#", "%" or control character, and no blank at either end)';

/** The words of the findings, as the engine writes them: each reason has one message, and it never holds an id. */
const MESSAGES = {
  collision: 'another object has the same file name',
  noName: 'its id leaves no file name',
  notOfType:
    'its id does not start with the prefix: not an object of this type',
  unreadable: 'the entry is not an object that holds an id that is a text',
  placeholder:
    'its id holds a placeholder opener: an id is never filled from a placeholder',
  notOneNameAfterPrefix: (prefix: string) =>
    `its id is not an id of this type: it is not the prefix ${JSON.stringify(prefix)} followed by ${ONE_NAME}`,
  notOneName: `its id is not an id of this type: it is not ${ONE_NAME}`,
  notText: 'its id holds a control character or a character that is not text',
};

/** What a push says of a file that holds an id that is not an id of the type: the path, and what an id of the type is. */
const notAnIdOfThisType = (path: string, prefix: string | null): string =>
  `The file ${path} does not hold an id of this type: it is not ${prefix ? `the prefix ${JSON.stringify(prefix)} followed by ${ONE_NAME}` : ONE_NAME}.`;

/** A split with the two options that a type has to say, as a caller of a type that keeps neither writes them. */
const split = (
  spec: ListSpec,
  objects: unknown[],
  more: Partial<Parameters<typeof splitList>[0]> = {}
): PullResult =>
  splitList({
    ...spec,
    objects,
    keepRev: false,
    keepModifiedProperties: false,
    ...more,
  });

const paths = (result: PullResult): string[] =>
  result.fileSet.files.map((file) => file.path);

const kindsAndIds = (findings: PullFinding[]): [string, string | undefined][] =>
  findings.map((finding) => [finding.kind, finding.id]);

describe('splitList', () => {
  describe('the file set', () => {
    it('gives one file for each object, named after what follows the prefix, and owns the folder', () => {
      const result = split(LOCALES, [
        { _id: 'uilocale/fr', greeting: 'bonjour' },
        { _id: 'uilocale/en', greeting: 'hello' },
      ]);

      expect(paths(result)).toEqual(['locales/en.json', 'locales/fr.json']);
      expect(result.fileSet.ownedFolders).toEqual(['locales']);
      expect(result.findings).toEqual([]);
    });

    it('writes the bytes of `fileOfObject`: keys in order, `${` escaped, a newline at the end', () => {
      const object = { _id: 'uilocale/fr', b: 'a ${x}', a: [2, 1] };

      const { fileSet } = split(LOCALES, [object]);

      expect(fileSet.files).toEqual([
        fileOfObject({
          path: 'locales/fr.json',
          object,
          keepRev: false,
          keepModifiedProperties: false,
        }),
      ]);
      expect(fileSet.files[0].content).toBe(
        '{\n  "_id": "uilocale/fr",\n  "a": [\n    2,\n    1\n  ],\n  "b": "a \\\\${x}"\n}\n'
      );
    });

    it('keeps `_rev` and the modified properties when the type says so, and leaves them out when it says not', () => {
      const object = {
        _id: 'uilocale/fr',
        _rev: '4',
        lastModifiedDate: 'yesterday',
        text: 'x',
      };
      const content = (keepRev: boolean, keepModifiedProperties: boolean) =>
        JSON.parse(
          split(LOCALES, [object], { keepRev, keepModifiedProperties }).fileSet
            .files[0].content
        );

      expect(content(true, false)).toEqual({
        _id: 'uilocale/fr',
        _rev: '4',
        text: 'x',
      });
      expect(content(false, true)).toEqual({
        _id: 'uilocale/fr',
        lastModifiedDate: 'yesterday',
        text: 'x',
      });
      expect(content(true, true)).toEqual(object);
      expect(content(false, false)).toEqual({ _id: 'uilocale/fr', text: 'x' });
    });

    it('takes both options from the caller: there is no default, because the defaults of the two files differ', () => {
      // read by tsc over the test files; a test run does not report a type error
      const probes = (): void => {
        // @ts-expect-error both options are required
        splitList({ ...LOCALES, objects: [] });
        // @ts-expect-error keepModifiedProperties is required
        splitList({ ...LOCALES, objects: [], keepRev: true });
        // @ts-expect-error keepRev is required
        splitList({ ...LOCALES, objects: [], keepModifiedProperties: true });
        // @ts-expect-error the id prefix is required: a list says what its ids look like
        splitList({
          folder: 'x',
          type: { key: 'x' },
          objects: [],
          keepRev: true,
          keepModifiedProperties: true,
        });
      };
      expect(typeof probes).toBe('function');
    });

    it('gives an empty set that owns the folder for no object, and for objects that all become findings', () => {
      expect(split(LOCALES, [])).toEqual({
        fileSet: { files: [], ownedFolders: ['locales'] },
        findings: [],
      });
      const result = split(LOCALES, [{ _id: 'access' }, null]);
      expect(result.fileSet).toEqual({ files: [], ownedFolders: ['locales'] });
      expect(result.findings).toHaveLength(2);
    });

    it('gives the same set for the same objects, whatever order they are given in, and changes none of them', () => {
      const objects = [
        { _id: 'uilocale/c', n: { z: 1, a: 2 } },
        { _id: 'uilocale/a', n: 1 },
        { _id: 'uilocale/b', n: 2 },
      ];
      const before = JSON.stringify(objects);

      const first = split(LOCALES, objects);
      const reversed = split(LOCALES, [...objects].reverse());
      const again = split(LOCALES, objects);

      expect(JSON.stringify(objects)).toBe(before);
      expect(reversed).toEqual(first);
      expect(JSON.stringify(again)).toBe(JSON.stringify(first));
      expect(paths(first)).toEqual([
        'locales/a.json',
        'locales/b.json',
        'locales/c.json',
      ]);
    });

    it('gives the file of an override the override, merged after the escaping, and tells the callback the full id', () => {
      const asked: string[] = [];

      const { fileSet } = split(
        LOCALES,
        [
          { _id: 'uilocale/fr', size: 1, text: 'a ${kept}' },
          { _id: 'uilocale/en', size: 1 },
        ],
        {
          overridesFor: (id) => {
            asked.push(id);
            return id === 'uilocale/fr'
              ? { size: 9, host: '${HOST_ON_PUSH}' }
              : undefined;
          },
        }
      );

      expect(asked.sort()).toEqual(['uilocale/en', 'uilocale/fr']);
      expect(JSON.parse(fileSet.files[1].content)).toEqual({
        _id: 'uilocale/fr',
        host: '${HOST_ON_PUSH}',
        size: 9,
        text: 'a \\${kept}',
      });
      expect(JSON.parse(fileSet.files[0].content)).toEqual({
        _id: 'uilocale/en',
        size: 1,
      });
    });
  });

  describe('the id of the type: a prefix and one name', () => {
    it('writes `uilocale/fr` to `locales/fr.json`, with the bytes of the object', () => {
      const object = { _id: 'uilocale/fr', hello: 'bonjour' };

      const { fileSet } = split(LOCALES, [object]);

      expect(fileSet.files.map((file) => file.path)).toEqual([
        'locales/fr.json',
      ]);
      expect(JSON.parse(fileSet.files[0].content)).toEqual(object);
    });

    it.each([
      ['access'],
      ['uilocale'],
      ['uilocale2/x'],
      ['UILOCALE/x'],
      ['openidm/uilocale/x'],
      ['managed/alpha_user'],
      // as long as the prefix and more, so that what follows the first nine characters is one name
      ['abcdefghijkl'],
      // an id that holds `${` and does not start with the prefix is not of the type: a notice, whichever test is made first
      ['other/${X}'],
      ['access${x}'],
    ])(
      'takes %j for an entry that is not an object of the type: not-of-type, never written',
      (id) => {
        const result = split(LOCALES, [{ _id: id }, { _id: 'uilocale/fr' }]);

        expect(result.findings).toEqual([
          { kind: 'not-of-type', id, message: MESSAGES.notOfType },
        ]);
        expect(paths(result)).toEqual(['locales/fr.json']);
      }
    );

    it.each([
      ['uilocale/..'],
      ['uilocale/.'],
      ['uilocale/'],
      ['uilocale/a/b'],
      ['uilocale//'],
      ['uilocale/x?y'],
      ['uilocale/x?_action=y'],
      ['uilocale/x#f'],
      ['uilocale/a%2fb'],
      ['uilocale/a\\b'],
      ['uilocale/a\tb'],
      ['uilocale/a\u0085b'],
      ['uilocale/x\ud800'],
      // the URL parser cuts the spaces off the end of a URL: `uilocale/.. ` would be the request for the folder above
      ['uilocale/.. '],
      ['uilocale/. '],
      ['uilocale/fr '],
      ['uilocale/ fr'],
      ['uilocale/fr\u00a0'],
      ['uilocale/fr\u3000'],
      // a server may cut the parameters off a segment before it reads the dots
      ['uilocale/..;'],
      ['uilocale/.;x=y'],
    ])('refuses %j: it starts with the prefix and is not one name', (id) => {
      const result = split(LOCALES, [{ _id: id }]);

      expect(result.findings).toEqual([
        {
          kind: 'refused',
          id,
          message: MESSAGES.notOneNameAfterPrefix('uilocale/'),
        },
      ]);
      expect(result.fileSet.files).toEqual([]);
    });

    it.each([
      ['uilocale/en-US'],
      ['uilocale/a b'],
      ['uilocale/..foo'],
      ['uilocale/a..b'],
      ['uilocale/My Schedule'],
      ['uilocale/a@b'],
      ['uilocale/a;b'],
      ['uilocale/a;..'],
      ['uilocale/ABC:x'],
      ['uilocale/é'],
    ])('writes %j: the rest of the id is one name', (id) => {
      const result = split(LOCALES, [{ _id: id }]);

      expect(result.findings).toEqual([]);
      expect(result.fileSet.files).toHaveLength(1);
    });

    it('refuses an id that holds `${`, in every mode, so that a push never reads a placeholder into an id', () => {
      const holds = (spec: ListSpec, id: string) =>
        split(spec, [{ _id: id }]).findings;

      expect(holds(LOCALES, 'uilocale/a${b}')).toEqual([
        {
          kind: 'refused',
          id: 'uilocale/a${b}',
          message: MESSAGES.placeholder,
        },
      ]);
      expect(holds(ROLES, 'a${b}')).toEqual([
        { kind: 'refused', id: 'a${b}', message: MESSAGES.placeholder },
      ]);
      expect(holds(FREE, '${b}')).toEqual([
        { kind: 'refused', id: '${b}', message: MESSAGES.placeholder },
      ]);
      // a `$` and a `{` that are not together are text
      expect(holds(FREE, 'a$ {b}')).toEqual([]);
    });
  });

  describe('the id of the type: one name and no prefix', () => {
    it.each([
      ['openidm-admin'],
      ['35ddf95a-42f8-4ba1-8dd4-370d9a4c2c61'],
      ['a b'],
      ['..foo'],
    ])('writes %j as a file of its own name', (id) => {
      const result = split(ROLES, [{ _id: id }]);

      expect(result.findings).toEqual([]);
      expect(paths(result)).toEqual([`roles/${id}.json`]);
    });

    it.each([
      ['a/b'],
      ['..'],
      ['.'],
      ['a?b'],
      ['a#b'],
      ['a%2fb'],
      ['a\\b'],
      ['a\u0000b'],
      ['\ud800'],
    ])(
      'refuses %j, and never takes it for an id of another type: with no prefix every failure is a refusal',
      (id) => {
        expect(split(ROLES, [{ _id: id }]).findings).toEqual([
          { kind: 'refused', id, message: MESSAGES.notOneName },
        ]);
      }
    );
  });

  describe('the id of the type: an id that never reaches a request', () => {
    it('takes any text that is not empty, with no control character and no lone surrogate, a slash and a blank too, and gives it a name that is a file name', () => {
      const result = split(
        FREE,
        [
          { _id: 'a/b' },
          { _id: ' with space ' },
          { _id: '../x' },
          { _id: 'smile \ud83d\ude00' },
        ],
        { nameOf: encodedName }
      );

      expect(result.findings).toEqual([]);
      expect(result.fileSet.files).toHaveLength(4);
      expect(paths(result)).toContain('free/a%2Fb.json');
    });

    it.each([
      ['a control character', 'a\u0000b'],
      ['an escape', 'a\u001bb'],
      ['a tab', 'a\tb'],
      ['DEL', 'a\u007fb'],
      ['a control character of the C1 block', 'a\u0085b'],
      ['a lone high surrogate', '\ud800'],
      ['a lone low surrogate at the end', 'x\udc00'],
    ])(
      'refuses an id with %s although the id never reaches a request: it is the id of an outcome and of an error',
      (_what, id) => {
        const result = split(FREE, [{ _id: id }, { _id: 'ok' }]);

        expect(result.findings).toEqual([
          { kind: 'refused', id, message: MESSAGES.notText },
        ]);
        expect(paths(result)).toEqual(['free/ok.json']);
      }
    );

    it('does not look for a prefix: every entry is of the type', () => {
      expect(
        split(FREE, [{ _id: 'access' }, { _id: 'uilocale/fr' }]).findings
      ).toEqual([]);
    });

    it('still refuses an id that leaves no file name, with one message that does not hold the id', () => {
      const result = split(
        FREE,
        [{ _id: '..' }, { _id: 'con' }, { _id: 'ok' }],
        {
          nameOf: encodedName,
        }
      );

      expect(result.findings).toEqual([
        { kind: 'refused', id: '..', message: MESSAGES.noName },
        { kind: 'refused', id: 'con', message: MESSAGES.noName },
      ]);
      expect(paths(result)).toEqual(['free/ok.json']);
    });
  });

  describe('an entry that is not an object that holds an id', () => {
    const entries: [string, unknown][] = [
      ['null', null],
      ['a number', 7],
      ['a text', 'uilocale/fr'],
      ['an array', [{ _id: 'uilocale/fr' }]],
      ['an object without an id', {}],
      ['an empty id', { _id: '' }],
      ['an id that is a number', { _id: 7 }],
      ['an id that is null', { _id: null }],
      ['an id that is a list', { _id: ['uilocale/fr'] }],
    ];

    it.each(entries)(
      'takes %s for an unreadable entry: no id, one message, and the others are written',
      (_what, entry) => {
        const result = split(LOCALES, [entry, { _id: 'uilocale/fr' }]);

        expect(result.findings).toEqual([
          { kind: 'unreadable', message: MESSAGES.unreadable },
        ]);
        expect(Object.keys(result.findings[0])).toEqual(['kind', 'message']);
        expect(paths(result)).toEqual(['locales/fr.json']);
      }
    );

    it('reports the unreadable entries first, in the order of the answer, and the others after them, by id', () => {
      const result = split(LOCALES, [
        { _id: 'uilocale/zz/zz' },
        7,
        { _id: 'access' },
        null,
        { _id: 'uilocale/..' },
        { _id: 'Access' },
        {},
      ]);

      expect(result.findings.map((finding) => finding.kind)).toEqual([
        'unreadable',
        'unreadable',
        'unreadable',
        'not-of-type',
        'not-of-type',
        'refused',
        'refused',
      ]);
      // by id in ordinal order: `Access` before `access`, `uilocale/..` before `uilocale/zz/zz`
      expect(kindsAndIds(result.findings).slice(3)).toEqual([
        ['not-of-type', 'Access'],
        ['not-of-type', 'access'],
        ['refused', 'uilocale/..'],
        ['refused', 'uilocale/zz/zz'],
      ]);
    });
  });

  describe('two objects that would be one file', () => {
    it('keeps the id that sorts first and reports the other as a collision, whatever order the tenant answered in', () => {
      const login = { _id: 'Login', name: 'first' };
      const lower = { _id: 'login', name: 'second' };

      for (const answer of [
        [login, lower],
        [lower, login],
      ]) {
        const result = split(FREE, answer);

        expect(result.findings).toEqual([
          {
            kind: 'collision',
            id: 'login',
            firstId: 'Login',
            message: MESSAGES.collision,
          },
        ]);
        expect(paths(result)).toEqual(['free/Login.json']);
        expect(JSON.parse(result.fileSet.files[0].content).name).toBe('first');
      }
    });

    it('takes two Unicode forms of one name for one file', () => {
      const composed = 'é';
      const decomposed = 'é';

      const result = split(FREE, [{ _id: decomposed }, { _id: composed }]);

      expect(result.fileSet.files).toHaveLength(1);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toMatchObject({
        kind: 'collision',
        id: composed < decomposed ? decomposed : composed,
        firstId: composed < decomposed ? composed : decomposed,
      });
    });

    it('takes `a/b` and `a%2Fb` for one name, which is the file name of the first', () => {
      const result = split(FREE, [{ _id: 'a/b' }, { _id: 'a%2Fb' }]);

      // `%` sorts before `/`, so `a%2Fb` keeps `a%2Fb.json` and `a/b`, whose name is the same, is the collision
      expect(result.findings).toEqual([
        {
          kind: 'collision',
          id: 'a/b',
          firstId: 'a%2Fb',
          message: MESSAGES.collision,
        },
      ]);
      expect(paths(result)).toEqual(['free/a%2Fb.json']);
    });

    it('reports an id that the answer holds twice as a collision with itself, and writes it once', () => {
      const result = split(FREE, [
        { _id: 'twice', n: 1 },
        { _id: 'twice', n: 2 },
      ]);

      expect(result.findings).toEqual([
        {
          kind: 'collision',
          id: 'twice',
          firstId: 'twice',
          message: MESSAGES.collision,
        },
      ]);
      expect(paths(result)).toEqual(['free/twice.json']);
      expect(JSON.parse(result.fileSet.files[0].content).n).toBe(1);
    });

    it('reports the clashes in a prefixed type by the name that the rest of the id gives', () => {
      const result = split(LOCALES, [
        { _id: 'uilocale/FR' },
        { _id: 'uilocale/fr' },
      ]);

      expect(result.findings).toEqual([
        {
          kind: 'collision',
          id: 'uilocale/fr',
          firstId: 'uilocale/FR',
          message: MESSAGES.collision,
        },
      ]);
    });
  });

  describe('the name of a file', () => {
    it('is the name of the CLI by default: `Login:SSO` keeps its colon', () => {
      const result = split(FREE, [{ _id: 'Login:SSO' }]);

      expect(paths(result)).toEqual(['free/Login:SSO.json']);
    });

    it('is what the type gives when it passes its own function, which is told the name without the prefix', () => {
      const asked: string[] = [];
      const result = split(LOCALES, [{ _id: 'uilocale/Login:SSO' }], {
        nameOf: (name) => {
          asked.push(name);
          return encodedName(name);
        },
      });

      expect(asked).toEqual(['Login:SSO']);
      expect(paths(result)).toEqual(['locales/Login%3ASSO.json']);
    });

    it('gives a name that does not fit in a file name its shortened form with a checksum, as the name functions do', () => {
      const long = `${'a'.repeat(300)}-1`;

      const result = split(FREE, [{ _id: long }]);

      expect(paths(result)[0]).toMatch(/^free\/a{241}~[0-9a-f]{8}\.json$/);
      expect(JSON.parse(result.fileSet.files[0].content)._id).toBe(long);
    });
  });

  describe('what a finding says', () => {
    // a finding says which object it is about in its `id`: no message holds an id, because the id is text from the tenant
    // (a control character or a bidirectional mark changes what a terminal shows) and the caller shows it in its own safe form
    const MARKER = 'secret-id-4711';
    const scenarios: [
      string,
      ListSpec,
      unknown[],
      Parameters<typeof split>[2],
    ][] = [
      [
        'a collision',
        FREE,
        [{ _id: `A-${MARKER}` }, { _id: `a-${MARKER}` }],
        undefined,
      ],
      [
        'an id that leaves no file name, whose name function throws with the id in its error',
        FREE,
        [{ _id: MARKER }],
        {
          nameOf: (name: string) => {
            throw new Error(`no name for ${name}`);
          },
        },
      ],
      [
        'an id that is not an id of the type',
        LOCALES,
        [{ _id: `uilocale/${MARKER}/x` }],
        undefined,
      ],
      [
        'an id with no prefix that is not one name',
        ROLES,
        [{ _id: `${MARKER}/x` }],
        undefined,
      ],
      [
        'an id that holds a control character or a lone surrogate, where the id never reaches a request',
        FREE,
        [{ _id: `${MARKER}\u001b[2J` }, { _id: `${MARKER}\ud800` }],
        undefined,
      ],
      [
        'an id that ends in a space',
        LOCALES,
        [{ _id: `uilocale/${MARKER} ` }],
        undefined,
      ],
      [
        'an id that holds a placeholder',
        LOCALES,
        [{ _id: `uilocale/${MARKER}\${x}` }],
        undefined,
      ],
      [
        'an entry that is not of the type',
        LOCALES,
        [{ _id: MARKER }],
        undefined,
      ],
      [
        'an entry that holds no usable id, whatever else it holds',
        LOCALES,
        [{ _id: 7, name: MARKER }, { name: MARKER }],
        undefined,
      ],
    ];

    it.each(scenarios)(
      'never holds an id in the message of %s',
      (_what, spec, objects, more) => {
        const result = split(spec, objects, more);

        expect(result.findings.length).toBeGreaterThan(0);
        for (const finding of result.findings) {
          expect(finding.message.toLowerCase()).not.toContain(MARKER);
          expect(finding.message).not.toMatch(/\p{Cc}/u);
        }
        expect(
          result.findings
            .map((finding) => finding.message)
            .join('\n')
            .toLowerCase()
        ).not.toContain(MARKER);
      }
    );

    it('has one message for each reason, the same whatever the id', () => {
      const reasons = (ids: string[]) =>
        new Set(
          split(
            LOCALES,
            ids.map((_id) => ({ _id }))
          ).findings.map((finding) => finding.message)
        );

      expect(reasons(['access', 'other', 'x/y/z', 'uilocale'])).toEqual(
        new Set([MESSAGES.notOfType])
      );
      expect(reasons(['uilocale/a/b', 'uilocale/..', 'uilocale/?x'])).toEqual(
        new Set([MESSAGES.notOneNameAfterPrefix('uilocale/')])
      );
    });

    it('says `firstId` for a collision and for nothing else', () => {
      const result = split(
        LOCALES,
        [
          { _id: 'uilocale/a' },
          { _id: 'uilocale/A' },
          { _id: 'access' },
          { _id: 'uilocale/b/c' },
          null,
        ],
        {}
      );

      expect(
        result.findings.map((finding) => [finding.kind, 'firstId' in finding])
      ).toEqual([
        ['unreadable', false],
        ['not-of-type', false],
        ['collision', true],
        ['refused', false],
      ]);
    });
  });
});

describe('mergeList', () => {
  const state = stateOf();
  const read = (
    files: Record<string, string>,
    spec: ListSpec = LOCALES,
    given: State = state
  ): Promise<ListRead[]> =>
    mergeList({ ...spec, reader: readerOf(files), state: given });

  /** What a caller can see of a result: the ids, the paths and whether each file was read or refused. */
  const shown = (reads: ListRead[]) =>
    reads.map(({ id, path, object, error }) => ({
      id,
      path,
      ok: object !== undefined && error === undefined,
    }));

  describe('the files of the folder', () => {
    it('reads every `.json` file of the folder, in the order of its path, and takes the id from the content', async () => {
      const reads = await read({
        'locales/b.json': '{"_id":"uilocale/zz","n":2}',
        'locales/a.json': '{"_id":"uilocale/yy","n":1}',
      });

      expect(reads).toEqual([
        {
          id: 'uilocale/yy',
          path: 'locales/a.json',
          object: { _id: 'uilocale/yy', n: 1 },
        },
        {
          id: 'uilocale/zz',
          path: 'locales/b.json',
          object: { _id: 'uilocale/zz', n: 2 },
        },
      ]);
    });

    it('never reads a file name: the same files under other names give the same ids and objects', async () => {
      const named = await read({
        'locales/fr.json': '{"_id":"uilocale/fr"}',
        'locales/en.json': '{"_id":"uilocale/en"}',
      });
      const renamed = await read({
        'locales/f0.json': '{"_id":"uilocale/en"}',
        'locales/f1.json': '{"_id":"uilocale/fr"}',
      });
      // a file that is called like another id and holds a different one
      const swapped = await read({
        'locales/fr.json': '{"_id":"uilocale/en"}',
        'locales/en.json': '{"_id":"uilocale/fr"}',
      });

      const idsOf = (reads: ListRead[]) => reads.map((r) => r.id).sort();
      expect(idsOf(renamed)).toEqual(idsOf(named));
      expect(idsOf(swapped)).toEqual(idsOf(named));
      expect(swapped.map((r) => [r.path, r.id])).toEqual([
        ['locales/en.json', 'uilocale/fr'],
        ['locales/fr.json', 'uilocale/en'],
      ]);
    });

    it('lists the folder and nothing else, and reads only its `.json` files', async () => {
      const { reader, asked } = countingReader({
        'locales/a.json': '{"_id":"uilocale/a"}',
        'locales/notes.txt': 'not read',
        // the name of a file ends in `.json`, not in `json`
        'locales/xjson': '{"_id":"uilocale/x"}',
        'locales/backupjson': '{"_id":"uilocale/backup"}',
        'locales/a.json.bak': '{"_id":"uilocale/bak"}',
        'locales/sub/b.json': '{"_id":"uilocale/b"}',
        // a folder whose name ends in `.json` is a folder, and is not read
        'locales/folder.json/d.json': '{"_id":"uilocale/d"}',
        'other/c.json': '{"_id":"uilocale/c"}',
      });

      const reads = await mergeList({ ...LOCALES, reader, state });

      expect(shown(reads)).toEqual([
        { id: 'uilocale/a', path: 'locales/a.json', ok: true },
      ]);
      expect(asked.listed).toEqual(['locales']);
      expect(asked.read).toEqual(['locales/a.json']);
    });

    it('gives nothing, and reads nothing, for a folder that does not exist and for one that is empty', async () => {
      const missing = countingReader({ 'other/x.json': '{}' });
      const empty = {
        async listDirectory() {
          return [];
        },
        async readFile() {
          throw new Error('never read');
        },
      } as FileSetReader;

      expect(
        await mergeList({ ...LOCALES, reader: missing.reader, state })
      ).toEqual([]);
      expect(missing.asked.read).toEqual([]);
      expect(await mergeList({ ...LOCALES, reader: empty, state })).toEqual([]);
    });

    it('fills the placeholders of the other values from the state, and leaves an escaped one as text', async () => {
      const given = stateOf();
      given.setEnv('HOST_ON_PUSH', 'https://openam-zion.example.com');

      const [one] = await read(
        {
          'locales/a.json':
            '{"_id":"uilocale/a","host":"${HOST_ON_PUSH}","text":"\\\\${kept}"}',
        },
        LOCALES,
        given
      );

      expect(one.object).toEqual({
        _id: 'uilocale/a',
        host: 'https://openam-zion.example.com',
        text: '${kept}',
      });
    });

    it('fails only the file that cannot be used: the others are read', async () => {
      const reads = await read({
        'locales/a.json': '{"_id":"uilocale/a"}',
        'locales/b.json': '{ not json',
        'locales/c.json': '{"_id":"uilocale/c","v":"${NO_VALUE}"}',
        'locales/d.json': '{"_id":"uilocale/d"}',
      });

      expect(shown(reads)).toEqual([
        { id: 'uilocale/a', path: 'locales/a.json', ok: true },
        { id: 'locales/b.json', path: 'locales/b.json', ok: false },
        { id: 'locales/c.json', path: 'locales/c.json', ok: false },
        { id: 'uilocale/d', path: 'locales/d.json', ok: true },
      ]);
      expect(reads[1].error).toBeInstanceOf(FrodoError);
      expect(reads[1].error?.message).toBe(
        'Error parsing JSON from locales/b.json'
      );
      expect(reads[2].error?.message).toBe(
        'No value found for placeholder "NO_VALUE"'
      );
    });

    it('takes a reader that gives something that is not text for a file that cannot be used, and names the file', async () => {
      const inner = readerOf({
        'locales/a.json': '{"_id":"uilocale/a"}',
        'locales/b.json': '{"_id":"uilocale/b"}',
      });
      const reader: FileSetReader = {
        listDirectory: (path) => inner.listDirectory(path),
        readFile: async (path) =>
          path === 'locales/a.json'
            ? (Buffer.from('{"_id":"uilocale/a"}') as unknown as string)
            : inner.readFile(path),
      };

      const reads = await mergeList({ ...LOCALES, reader, state });

      expect(shown(reads)).toEqual([
        { id: 'locales/a.json', path: 'locales/a.json', ok: false },
        { id: 'uilocale/b', path: 'locales/b.json', ok: true },
      ]);
      expect(reads[0].error?.message).toBe(
        'The reader did not return text for locales/a.json.'
      );
    });

    it('rejects when the reader cannot list the folder, which fails every file at once, and says what it was doing, with the cause', async () => {
      const reader: FileSetReader = {
        async listDirectory() {
          throw new Error('disk gone');
        },
        async readFile() {
          throw new Error('never read');
        },
      };

      const error = await mergeList({ ...LOCALES, reader, state }).catch(
        (e) => e
      );

      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe('Error listing the folder locales');
      expect(error.originalErrors[0].message).toBe('disk gone');
    });

    it('fails only the file that the reader cannot read: it is one failed object, the others are read, and the cause is kept', async () => {
      const inner = readerOf({
        'locales/a.json': '{"_id":"uilocale/a"}',
        'locales/b.json': '{"_id":"uilocale/b"}',
        'locales/c.json': '{"_id":"uilocale/c"}',
      });
      const reader: FileSetReader = {
        listDirectory: (path) => inner.listDirectory(path),
        readFile: async (path) => {
          if (path === 'locales/b.json') throw new Error('disk gone');
          return inner.readFile(path);
        },
      };

      const reads = await mergeList({ ...LOCALES, reader, state });

      expect(shown(reads)).toEqual([
        { id: 'uilocale/a', path: 'locales/a.json', ok: true },
        { id: 'locales/b.json', path: 'locales/b.json', ok: false },
        { id: 'uilocale/c', path: 'locales/c.json', ok: true },
      ]);
      expect(reads[1].error).toBeInstanceOf(FrodoError);
      expect(reads[1].error?.message).toBe('Error reading file locales/b.json');
      expect((reads[1].error as FrodoError).originalErrors[0].message).toBe(
        'disk gone'
      );
    });

    it('fails every file, one by one, when the reader cannot read any of them, and does not reject: the push then has one failed object for each', async () => {
      const reader: FileSetReader = {
        async listDirectory() {
          return [
            { name: 'a.json', isDirectory: false },
            { name: 'b.json', isDirectory: false },
          ];
        },
        async readFile() {
          throw new Error('disk gone');
        },
      };
      const write = jest.fn(async () => ({}));

      const outcomes = await mergeAndWriteList({
        ...LOCALES,
        reader,
        state,
        write,
      });

      expect(outcomes.map((o) => [o.id, o.error?.message])).toEqual([
        ['locales/a.json', 'Error processing locales/a.json'],
        ['locales/b.json', 'Error processing locales/b.json'],
      ]);
      expect(write).not.toHaveBeenCalled();
    });

    it('takes a file that is listed and not there for a file that cannot be used', async () => {
      const reader: FileSetReader = {
        async listDirectory() {
          return [{ name: 'gone.json', isDirectory: false }];
        },
        async readFile() {
          return undefined;
        },
      };

      const [one] = await mergeList({ ...LOCALES, reader, state });

      expect(one.id).toBe('locales/gone.json');
      expect(one.error?.message).toBe(
        'The file locales/gone.json does not exist.'
      );
    });
  });

  describe('a file that does not hold an id that is usable', () => {
    it.each([
      ['no `_id`', '{"a":1}'],
      ['a null `_id`', '{"_id":null}'],
      ['`null`', 'null'],
      ['an array', '["uilocale/a"]'],
      ['a number', '5'],
    ])(
      'refuses a file with %s, with its path for an id',
      async (_what, text) => {
        const [one] = await read({ 'locales/x.json': text });

        expect(one.id).toBe('locales/x.json');
        expect(one.object).toBeUndefined();
        expect(one.error).toBeInstanceOf(FrodoError);
        expect(one.error?.message).toBe(
          'The file locales/x.json holds no _id.'
        );
      }
    );

    it.each([
      ['an empty `_id`', '{"_id":""}'],
      ['a number for an `_id`', '{"_id":7}'],
      ['a list for an `_id`', '{"_id":["uilocale/a"]}'],
      ['an object for an `_id`', '{"_id":{"a":1}}'],
    ])('refuses a file with %s', async (_what, text) => {
      const [one] = await read({ 'locales/x.json': text });

      expect(one.id).toBe('locales/x.json');
      expect(one.error?.message).toBe(
        'The file locales/x.json holds an _id that is empty or not a text.'
      );
    });
  });

  describe('the id of the type', () => {
    it.each([
      ['access'],
      ['uilocale'],
      ['uilocale2/x'],
      ['abcdefghijkl'],
      ['../managed/alpha_user'],
      ['uilocale/..'],
      ['uilocale/.'],
      ['uilocale/'],
      ['uilocale/a/b'],
      ['uilocale/x?_action=y'],
      ['uilocale/x#f'],
      ['uilocale/a%2fb'],
      ['uilocale/a\\b'],
      ['uilocale/x\ud800'],
      // a space at the end is cut off by the URL parser: these would be the requests for `uilocale/..`, `uilocale` and `uilocale/fr`
      ['uilocale/.. '],
      ['uilocale/. '],
      ['uilocale/fr '],
      ['uilocale/ fr'],
      ['uilocale/fr\u00a0'],
      ['uilocale/fr\u2003'],
      // a path parameter on a dot
      ['uilocale/..;'],
      ['uilocale/.;x=y'],
    ])(
      'refuses a file that holds %j, with its path for an id, and the message does not hold the id',
      async (id) => {
        const reads = await read({
          'locales/a.json': JSON.stringify({ _id: id }),
          'locales/b.json': '{"_id":"uilocale/b"}',
        });

        expect(shown(reads)).toEqual([
          { id: 'locales/a.json', path: 'locales/a.json', ok: false },
          { id: 'uilocale/b', path: 'locales/b.json', ok: true },
        ]);
        expect(reads[0].error?.message).toBe(
          notAnIdOfThisType('locales/a.json', 'uilocale/')
        );
      }
    );

    it('names no id in what it says, whatever the id holds: the message is the same for every id that fails', async () => {
      const messages = new Set<string>();
      for (const id of ['access', '../x', 'uilocale/a/b', 'uilocale/..']) {
        const [one] = await read({
          'locales/a.json': JSON.stringify({ _id: id }),
        });
        messages.add(String(one.error?.message));
      }

      expect(messages.size).toBe(1);
    });

    it('takes one name and no prefix when the type has none, and any text when the id never reaches a request', async () => {
      const roles = await read(
        {
          'roles/a.json': '{"_id":"openidm-admin"}',
          'roles/b.json': '{"_id":"a/b"}',
        },
        ROLES
      );
      const free = await read(
        {
          'free/a.json': '{"_id":"a/b"}',
          'free/b.json': '{"_id":"x\\ud800"}',
          'free/c.json': '{"_id":"a\\u0000b"}',
          'free/d.json': '{"_id":"a\\u001bb"}',
          'free/e.json': '{"_id":" a "}',
        },
        FREE
      );

      expect(shown(roles)).toEqual([
        { id: 'openidm-admin', path: 'roles/a.json', ok: true },
        { id: 'roles/b.json', path: 'roles/b.json', ok: false },
      ]);
      expect(roles[1].error?.message).toBe(
        notAnIdOfThisType('roles/b.json', '')
      );
      expect(shown(free)).toEqual([
        { id: 'a/b', path: 'free/a.json', ok: true },
        { id: 'free/b.json', path: 'free/b.json', ok: false },
        { id: 'free/c.json', path: 'free/c.json', ok: false },
        { id: 'free/d.json', path: 'free/d.json', ok: false },
        { id: ' a ', path: 'free/e.json', ok: true },
      ]);
      // no id reaches a request in this mode, but it is the id of an outcome and of an error: no control character, no lone surrogate
      for (const refused of [free[1], free[2], free[3]]) {
        expect(refused.error?.message).toBe(
          `The file ${refused.path} holds an _id with a control character or a character that is not text.`
        );
      }
    });

    it('takes ids that differ in case for two ids: the comparison is exact', async () => {
      const reads = await read({
        'locales/a.json': '{"_id":"uilocale/FR"}',
        'locales/b.json': '{"_id":"uilocale/fr"}',
      });

      expect(shown(reads).map((r) => r.ok)).toEqual([true, true]);
    });
  });

  describe('an id that two files hold', () => {
    const twice = {
      'locales/a.json': '{"_id":"uilocale/zq-4711","n":1}',
      'locales/b.json': '{"_id":"uilocale/zq-4711","n":2}',
      'locales/c.json': '{"_id":"uilocale/other"}',
    };

    it('refuses the later file in the order of the paths, names the earlier PATH, and never the id', async () => {
      const reads = await read(twice);

      expect(shown(reads)).toEqual([
        { id: 'uilocale/zq-4711', path: 'locales/a.json', ok: true },
        { id: 'locales/b.json', path: 'locales/b.json', ok: false },
        { id: 'uilocale/other', path: 'locales/c.json', ok: true },
      ]);
      expect(reads[0].object).toEqual({ _id: 'uilocale/zq-4711', n: 1 });
      expect(reads[1].error?.message).toBe(
        'The file locales/b.json holds the same _id as the file locales/a.json.'
      );
      expect(everythingOf(reads[1].error)).not.toContain('zq-4711');
    });

    it('refuses the same file whatever order the reader lists them in', async () => {
      const inner = readerOf(twice);
      const reversed: FileSetReader = {
        listDirectory: async (path) =>
          [...((await inner.listDirectory(path)) ?? [])].reverse(),
        readFile: (path) => inner.readFile(path),
      };

      const reads = await mergeList({ ...LOCALES, reader: reversed, state });

      expect(shown(reads)).toEqual(shown(await read(twice)));
      expect(reads[1].error?.message).toBe(
        'The file locales/b.json holds the same _id as the file locales/a.json.'
      );
    });

    it('holds a file that is refused for another reason to no id: a later file with that id is read', async () => {
      const reads = await read({
        'locales/a.json': '{"_id":"uilocale/x","v":"${NO_VALUE}"}',
        'locales/b.json': '{"_id":"uilocale/x"}',
      });

      expect(shown(reads).map((r) => r.ok)).toEqual([false, true]);
    });

    it('refuses a second file whose id has upper-case letters, as it does for one that has none: the comparison is exact in both directions', async () => {
      const reads = await read({
        'locales/a.json': '{"_id":"uilocale/en-US","n":1}',
        'locales/b.json': '{"_id":"uilocale/en-US","n":2}',
        'locales/c.json': '{"_id":"uilocale/en-us","n":3}',
      });

      expect(shown(reads)).toEqual([
        { id: 'uilocale/en-US', path: 'locales/a.json', ok: true },
        { id: 'locales/b.json', path: 'locales/b.json', ok: false },
        { id: 'uilocale/en-us', path: 'locales/c.json', ok: true },
      ]);
      expect(reads[1].error?.message).toBe(
        'The file locales/b.json holds the same _id as the file locales/a.json.'
      );
    });

    it('refuses a second file in every mode', async () => {
      const files = {
        'free/a.json': '{"_id":"same"}',
        'free/b.json': '{"_id":"same"}',
      };

      const reads = await read(files, FREE);

      expect(shown(reads).map((r) => r.ok)).toEqual([true, false]);
    });
  });

  describe('an id that holds `${`', () => {
    // the canary is the value that a hostile file set would like to read out through an id: it is the value of a name
    const CANARY = 'canary-value-that-must-never-be-shown-4711';
    const withCanary = (): State => {
      const given = stateOf();
      given.setEnv('CANARY_NAME', CANARY);
      return given;
    };

    it.each([
      ['a prefixed id', LOCALES, 'uilocale/${CANARY_NAME}'],
      ['an id with no prefix', ROLES, 'a-${CANARY_NAME}'],
      ['an id that never reaches a request', FREE, '${CANARY_NAME}'],
      ['a base64 placeholder', LOCALES, 'uilocale/${BASE64:CANARY_NAME}'],
    ])(
      'refuses %s before the placeholder is filled, and the value is nowhere',
      async (_what, spec, id) => {
        const reads = await mergeList({
          ...spec,
          reader: readerOf({
            [`${spec.folder}/a.json`]: JSON.stringify({ _id: id }),
          }),
          state: withCanary(),
        });

        expect(reads).toHaveLength(1);
        expect(reads[0].id).toBe(`${spec.folder}/a.json`);
        expect(reads[0].error?.message).toBe(
          `The file ${spec.folder}/a.json holds an _id with a placeholder opener, which an id never holds.`
        );
        expect(everythingOf(reads[0].error)).not.toContain(CANARY);
        expect(inspect(reads, { depth: null })).not.toContain(CANARY);
      }
    );

    it('refuses an id that holds `${` whether or not the name has a value: the message is the same', async () => {
      const [filled] = await mergeList({
        ...LOCALES,
        reader: readerOf({
          'locales/a.json': '{"_id":"uilocale/${CANARY_NAME}"}',
        }),
        state: withCanary(),
      });
      const [empty] = await mergeList({
        ...LOCALES,
        reader: readerOf({
          'locales/a.json': '{"_id":"uilocale/${CANARY_NAME}"}',
        }),
        state: stateOf(),
      });

      expect(filled.error?.message).toBe(empty.error?.message);
    });

    it('does not print the value of a variable of the process, when the state is told to read the environment', async () => {
      process.env.ENG1_CANARY_NAME = CANARY;
      const given = stateOf();
      given.setUseProcessEnvironmentForPlaceholders(true);
      try {
        const [one] = await mergeList({
          ...LOCALES,
          reader: readerOf({
            'locales/a.json': '{"_id":"uilocale/${ENG1_CANARY_NAME}"}',
          }),
          state: given,
        });

        expect(one.error).toBeInstanceOf(FrodoError);
        expect(everythingOf(one.error)).not.toContain(CANARY);
        expect(inspect(one, { depth: null })).not.toContain(CANARY);
      } finally {
        delete process.env.ENG1_CANARY_NAME;
      }
    });

    it('reads the id as the text of the file holds it: an escaped `${`, and a `$` and a `{` that a JSON escape writes, are `${` too', async () => {
      const reads = await read({
        // the text of the file has two backslashes before `${`, which a push of a pulled file writes for a literal `${`
        'locales/a.json': '{"_id":"uilocale/a\\\\${x}"}',
        // the text of the file does not hold `${`, the id that it parses to does
        'locales/b.json': '{"_id":"uilocale/b\\u0024{X}"}',
        'locales/c.json': '{"_id":"uilocale/c$\\u007bX}"}',
      });

      expect(shown(reads).map((r) => r.ok)).toEqual([false, false, false]);
      for (const one of reads) {
        expect(one.error?.message).toContain(
          'holds an _id with a placeholder opener'
        );
      }
    });

    it('refuses an id that a value of the state would change into another: the id of the file is the id that its text holds', async () => {
      // the value closes the string and adds a second `_id`, which a parse takes for the id of the file
      const given = stateOf();
      given.setEnv('CANARY_NAME', `${CANARY}","_id":"uilocale/zz-4711`);

      const [one] = await mergeList({
        ...LOCALES,
        reader: readerOf({
          'locales/a.json': '{"_id":"uilocale/a","x":"${CANARY_NAME}"}',
        }),
        state: given,
      });

      expect(one.id).toBe('locales/a.json');
      expect(one.error?.message).toBe(
        'The file locales/a.json holds an _id that its placeholders changed, which an id never does.'
      );
      expect(everythingOf(one.error)).not.toContain(CANARY);
      expect(everythingOf(one.error)).not.toContain('zz-4711');
    });

    it('refuses a file that is JSON only when its placeholders are filled, because its id cannot be checked', async () => {
      const given = stateOf();
      given.setEnv('CANARY_NAME', `"uilocale/${CANARY}"`);

      const [one] = await mergeList({
        ...LOCALES,
        reader: readerOf({ 'locales/a.json': '{"_id":${CANARY_NAME}}' }),
        state: given,
      });

      expect(one.id).toBe('locales/a.json');
      expect(one.error?.message).toBe(
        'The file locales/a.json is not JSON until its placeholders are filled, so its _id cannot be checked.'
      );
      expect(everythingOf(one.error)).not.toContain(CANARY);
    });

    it('does not take a text that is not JSON for a file that its placeholders could save: the error is the one of the parse', async () => {
      const [one] = await read({ 'locales/a.json': '{ no' });

      expect(one.error?.message).toBe('Error parsing JSON from locales/a.json');
    });
  });
});

describe('mergeAndWriteList', () => {
  const state = stateOf();
  const written = () => {
    const calls: [Record<string, unknown>, string, unknown][] = [];
    const write = jest.fn(
      async (
        object: Record<string, unknown>,
        id: string,
        leftOutCallback?: unknown
      ) => {
        calls.push([object, id, leftOutCallback]);
        return { answered: id };
      }
    );
    return { write, calls };
  };

  it('writes every object in the order of the ids, one outcome for each, with the id of the file and its object', async () => {
    const { write, calls } = written();

    const outcomes = await mergeAndWriteList({
      ...LOCALES,
      reader: readerOf({
        'locales/1.json': '{"_id":"uilocale/c","n":3}',
        'locales/2.json': '{"_id":"uilocale/a","n":1}',
        'locales/3.json': '{"_id":"uilocale/b","n":2}',
      }),
      state,
      write,
    });

    expect(outcomes).toEqual([
      { id: 'uilocale/a' },
      { id: 'uilocale/b' },
      { id: 'uilocale/c' },
    ]);
    expect(calls.map(([object, id]) => [id, object.n])).toEqual([
      ['uilocale/a', 1],
      ['uilocale/b', 2],
      ['uilocale/c', 3],
    ]);
  });

  it('refuses a file that is not an object of the type: its outcome has its path for an id and the error, and nothing is written for it', async () => {
    const { write, calls } = written();

    const outcomes = await mergeAndWriteList({
      ...LOCALES,
      reader: readerOf({
        'locales/a.json': '{"_id":"access"}',
        'locales/b.json': '{"_id":"../managed/alpha_user"}',
        'locales/c.json': '{"_id":"uilocale/x?_action=y"}',
        'locales/d.json': '{"_id":"uilocale/a/b"}',
        'locales/e.json': '{"_id":"uilocale/ok"}',
      }),
      state,
      write,
    });

    expect(outcomes.map((o) => [o.id, o.error === undefined])).toEqual([
      ['locales/a.json', false],
      ['locales/b.json', false],
      ['locales/c.json', false],
      ['locales/d.json', false],
      ['uilocale/ok', true],
    ]);
    expect(outcomes[0].error).toBeInstanceOf(FrodoError);
    expect(outcomes[0].error?.message).toBe('Error processing locales/a.json');
    expect(outcomes[0].error?.originalErrors[0].message).toBe(
      notAnIdOfThisType('locales/a.json', 'uilocale/')
    );
    expect(calls.map(([, id]) => id)).toEqual(['uilocale/ok']);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('writes only ids whose request goes to the object of that id: the URL that is built from each is the folder and the id', async () => {
    // what a write does with the id: it builds the URL of the request as the request layer does (the WHATWG parser)
    const urls: [string, string][] = [];
    const write = jest.fn(
      async (_object: Record<string, unknown>, id: string) => {
        const url = new URL(
          `https://openam-matrix.example.com/openidm/config/${id}`
        );
        urls.push([id, url.pathname]);
        return {};
      }
    );
    const files: Record<string, string> = {};
    [
      'uilocale/.. ',
      'uilocale/. ',
      'uilocale/fr ',
      'uilocale/ fr',
      'uilocale/..;',
      'uilocale/.;x',
      'uilocale/..',
      'uilocale/a/b',
      'uilocale/x?_action=y',
      'uilocale/fr',
      'uilocale/My Schedule',
      'uilocale/en-US',
    ].forEach((id, index) => {
      files[`locales/f${String(index).padStart(2, '0')}.json`] = JSON.stringify(
        { _id: id }
      );
    });

    const outcomes = await mergeAndWriteList({
      ...LOCALES,
      reader: readerOf(files),
      state,
      write,
    });

    expect(urls.map(([id]) => id).sort()).toEqual([
      'uilocale/My Schedule',
      'uilocale/en-US',
      'uilocale/fr',
    ]);
    for (const [id, pathname] of urls) {
      expect(decodeURIComponent(pathname)).toBe(`/openidm/config/${id}`);
    }
    expect(outcomes.filter((o) => o.error === undefined)).toHaveLength(3);
    expect(outcomes.filter((o) => o.error !== undefined)).toHaveLength(9);
  });

  it('sorts a file that was refused among the others by its path, as that is its id', async () => {
    const { write } = written();

    const outcomes = await mergeAndWriteList({
      ...FREE,
      reader: readerOf({
        'free/a.json': '{"_id":"zzz"}',
        'free/b.json': '{ no',
        'free/c.json': '{"_id":"AAA"}',
      }),
      state,
      write,
    });

    // ids in ordinal order: `AAA`, then the path `free/b.json`, then `zzz`
    expect(outcomes.map((o) => o.id)).toEqual(['AAA', 'free/b.json', 'zzz']);
  });

  it('tells the result callback once for every file, the refused ones too, with the answer of the write', async () => {
    const { write } = written();
    const told: [string | undefined, unknown][] = [];

    await mergeAndWriteList({
      ...LOCALES,
      reader: readerOf({
        'locales/a.json': '{"_id":"uilocale/a"}',
        'locales/b.json': '{"_id":"access"}',
      }),
      state,
      write,
      resultCallback: (error, result) => {
        told.push([error?.message, result]);
      },
    });

    // in the order of the ids: the path of the refused file sorts before `uilocale/a`
    expect(told).toEqual([
      ['Error processing locales/b.json', undefined],
      [undefined, { answered: 'uilocale/a' }],
    ]);
  });

  it('hands the left-out callback on to every write, as it was given', async () => {
    const { write, calls } = written();
    const leftOutCallback = jest.fn();

    await mergeAndWriteList({
      ...LOCALES,
      reader: readerOf({
        'locales/a.json': '{"_id":"uilocale/a"}',
        'locales/b.json': '{"_id":"uilocale/b"}',
      }),
      state,
      write,
      leftOutCallback,
    });

    expect(calls.map(([, , callback]) => callback)).toEqual([
      leftOutCallback,
      leftOutCallback,
    ]);
    expect(leftOutCallback).not.toHaveBeenCalled();
  });

  it('gives the write no left-out callback when it was given none, and works without a result callback', async () => {
    const { write, calls } = written();

    const outcomes = await mergeAndWriteList({
      ...LOCALES,
      reader: readerOf({ 'locales/a.json': '{"_id":"uilocale/a"}' }),
      state,
      write,
    });

    expect(outcomes).toEqual([{ id: 'uilocale/a' }]);
    expect(calls[0][2]).toBeUndefined();
  });

  it('is an outcome with the error for an object that the write fails on, and the others are written', async () => {
    const write = jest.fn(
      async (_object: Record<string, unknown>, id: string) => {
        if (id === 'uilocale/b') throw new Error('the server refused it');
        return {};
      }
    );

    const outcomes = await mergeAndWriteList({
      ...LOCALES,
      reader: readerOf({
        'locales/a.json': '{"_id":"uilocale/a"}',
        'locales/b.json': '{"_id":"uilocale/b"}',
        'locales/c.json': '{"_id":"uilocale/c"}',
      }),
      state,
      write,
    });

    expect(outcomes.map((o) => [o.id, o.error?.message])).toEqual([
      ['uilocale/a', undefined],
      ['uilocale/b', 'Error processing uilocale/b'],
      ['uilocale/c', undefined],
    ]);
    expect(outcomes[1].error?.originalErrors[0].message).toBe(
      'the server refused it'
    );
  });

  it('ends the run when the result callback throws, as the run of the objects does: the objects after it are not written', async () => {
    const { write, calls } = written();

    await expect(
      mergeAndWriteList({
        ...LOCALES,
        reader: readerOf({
          'locales/a.json': '{"_id":"uilocale/a"}',
          'locales/b.json': '{"_id":"uilocale/b"}',
        }),
        state,
        write,
        resultCallback: () => {
          throw new Error('the callback broke');
        },
      })
    ).rejects.toThrow('the callback broke');
    expect(calls.map(([, id]) => id)).toEqual(['uilocale/a']);
  });

  it('gives nothing, and writes nothing, for a folder that is not there', async () => {
    const { write } = written();

    await expect(
      mergeAndWriteList({ ...LOCALES, reader: readerOf({}), state, write })
    ).resolves.toEqual([]);
    expect(write).not.toHaveBeenCalled();
  });

  it('shows no value of the state anywhere when the id of a file is a placeholder: not in the outcome, the callback, the output', async () => {
    const CANARY = 'canary-value-that-must-never-be-shown-4711';
    const given = stateOf();
    given.setEnv('CANARY_NAME', CANARY);
    const { write } = written();
    const resultCallback = jest.fn();
    const printed: string[] = [];
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
      (name) =>
        jest.spyOn(console, name).mockImplementation((...a: unknown[]) => {
          printed.push(a.map(String).join(' '));
        })
    );
    const out = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: unknown) => {
        printed.push(String(chunk));
        return true;
      });
    const err = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: unknown) => {
        printed.push(String(chunk));
        return true;
      });
    let outcomes;
    try {
      outcomes = await mergeAndWriteList({
        ...LOCALES,
        reader: readerOf({
          'locales/a.json': '{"_id":"uilocale/${CANARY_NAME}"}',
          'locales/b.json': '{"_id":"${CANARY_NAME}"}',
        }),
        state: given,
        write,
        resultCallback,
      });
    } finally {
      [...spies, out, err].forEach((spy) => spy.mockRestore());
    }

    expect(outcomes).toHaveLength(2);
    expect(outcomes.every((o) => o.error instanceof FrodoError)).toBe(true);
    expect(write).not.toHaveBeenCalled();
    expect(inspect(outcomes, { depth: null })).not.toContain(CANARY);
    expect(everythingOf(outcomes[0].error)).not.toContain(CANARY);
    expect(everythingOf(outcomes[1].error)).not.toContain(CANARY);
    expect(inspect(resultCallback.mock.calls, { depth: null })).not.toContain(
      CANARY
    );
    expect(printed.join('\n')).not.toContain(CANARY);
  });
});

describe('assertBounded and the volume of a type', () => {
  const UNBOUNDED = { key: 'oauth2-clients', volume: 'unbounded' } as const;

  it('throws a FrodoError that names the type, for a type that is unbounded', () => {
    let error: unknown;
    try {
      assertBounded(UNBOUNDED);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(FrodoError);
    expect((error as Error).message).toMatch(
      /^The configuration type 'oauth2-clients' is unbounded: /
    );
  });

  it.each([
    ['bounded', { key: 'x', volume: 'bounded' } as const],
    ['not given', { key: 'x' }],
  ])('lets a type pass whose volume is %s', (_what, type) => {
    expect(() => assertBounded(type)).not.toThrow();
  });

  it('names no option of a command line and no environment variable', () => {
    let message = '';
    try {
      assertBounded(UNBOUNDED);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toBe('');
    expect(message).not.toMatch(/--|FRODO_/);
  });

  it('is the first thing that splitList does: it reads none of the objects', () => {
    const touched: unknown[] = [];
    const objects = new Proxy([] as unknown[], {
      get(target, property, receiver) {
        touched.push(property);
        return Reflect.get(target, property, receiver);
      },
    });

    expect(() =>
      splitList({
        ...LOCALES,
        type: UNBOUNDED,
        objects,
        keepRev: false,
        keepModifiedProperties: false,
      })
    ).toThrow('is unbounded');
    expect(touched).toEqual([]);
  });

  it('is the first thing that mergeList does: it lists nothing and reads nothing', async () => {
    const { reader, asked } = countingReader({
      'locales/a.json': '{"_id":"uilocale/a"}',
    });

    await expect(
      mergeList({ ...LOCALES, type: UNBOUNDED, reader, state: stateOf() })
    ).rejects.toThrow('is unbounded');
    expect(asked).toEqual({ read: [], listed: [] });
  });

  it('is the first thing that mergeAndWriteList does: it lists nothing, reads nothing and writes nothing', async () => {
    const { reader, asked } = countingReader({
      'locales/a.json': '{"_id":"uilocale/a"}',
    });
    const write = jest.fn(async () => ({}));

    await expect(
      mergeAndWriteList({
        ...LOCALES,
        type: UNBOUNDED,
        reader,
        state: stateOf(),
        write,
      })
    ).rejects.toThrow('is unbounded');
    expect(asked).toEqual({ read: [], listed: [] });
    expect(write).not.toHaveBeenCalled();
  });

  it('passes a bounded type through all three, and the descriptor of a type is a spec of its own: the flag has one source', async () => {
    const descriptor = { key: 'locales', volume: 'bounded', scope: 'global' };
    const spec: ListSpec = { ...LOCALES, type: descriptor as never };

    expect(split(spec, [{ _id: 'uilocale/fr' }]).fileSet.files).toHaveLength(1);
    expect(
      await mergeList({
        ...spec,
        reader: readerOf({ 'locales/a.json': '{"_id":"uilocale/a"}' }),
        state: stateOf(),
      })
    ).toHaveLength(1);
  });
});

describe('the list functions stay in the engine', () => {
  const engine = sourceText('ops/internal/FileSetEngine.ts');

  it('know no type: no word of the IDM, of a config path or of a locale', () => {
    expect(engine).not.toMatch(/uilocale|openidm|config\//i);
  });

  it('import the segment test from a module of the utilities, and no file system', () => {
    const imports = importSpecifiersOf('src/ops/internal/FileSetEngine.ts');

    expect(imports).toContain('../../utils/RequestPathUtils');
    expect(imports.filter((s) => /^(node:)?fs/.test(s))).toEqual([]);
  });

  it('print nothing, whatever they find', async () => {
    const printed: string[] = [];
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
      (name) =>
        jest.spyOn(console, name).mockImplementation((...a: unknown[]) => {
          printed.push(a.map(String).join(' '));
        })
    );
    const out = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: unknown) => {
        printed.push(String(chunk));
        return true;
      });
    try {
      split(LOCALES, [{ _id: 'access' }, null, { _id: 'uilocale/a/b' }]);
      await mergeAndWriteList({
        ...LOCALES,
        reader: readerOf({ 'locales/a.json': '{"_id":"access"}' }),
        state: stateOf(),
        write: async () => ({}),
      });
    } finally {
      [...spies, out].forEach((spy) => spy.mockRestore());
    }

    expect(printed).toEqual([]);
  });
});
