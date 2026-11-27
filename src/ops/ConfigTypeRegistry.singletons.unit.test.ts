/**
 * Run tests
 *
 *        npm run test:only -- src/ops/ConfigTypeRegistry.singletons
 *
 * The shared suite of the configuration types that have exactly one object, kept in one file: the KBA configuration and,
 * after it, every type of that shape. A type is a ROW of the table below, and every row gets the same tests: the split gives
 * its golden folder byte for byte; the merge reads it back and refuses what is not the file of the type (a file that is not
 * there, text that is not JSON, a placeholder without a value, an object of another id); the pull makes the requests that
 * the row lists and gives the golden set; the push makes the requests that the row lists, gives one outcome and tells the
 * callback once; and a push of a file that holds another id than the one of the type, an id such as `../managed/x` among
 * them, sends nothing. A new type adds a row, a golden folder (`src/test/golden/<key>`) and the tests that are about that
 * type alone (its entity, its recorded requests, its bytes against the command line); it does not copy this suite.
 *
 * A row says what the type is:
 * - `key`, `source`, `golden`, `path`, `ownedFolders`, `keepsRev`: the key of the type, the source file of its owner module,
 *   the golden folder, the path of its file, the folders that its file set owns, and whether its file keeps `_rev`.
 * - `id` and `hasId`: the id of the one object of the type, and whether the object holds it under `_id` (the push refuses a
 *   file that holds another) or holds none (the file is then taken as it is).
 * - `scope`: the scope that the api of the type checks before it sends a request. The tenant of the row has a token of that
 *   scope, and a test shows that a token of another scope sends nothing, so a row cannot pass with the scope of another api.
 * - `functions`: the split, the merge, the pull and the push of the type.
 * - `entityOf`: what the merge gives, as the entity.
 * - `pullRequests` and `pushRequests`: the requests that a pull and a push make, one line each (`GET <url>`). The body of
 *   the push is not in the row: it is the golden file with its placeholders filled, for every row.
 *
 * Two rows are not types of the library; they are shapes that the first rows do not have, made with the functions of the
 * engine and an api that exists: an object that holds no id in a file in a folder, read and written through the api of the
 * Cloud environment, which checks another scope than the IDM (the shape of the cookie domains of Cloud), and a file at the
 * root of the set. They show what a type of that shape passes to the engine; no module of the library is written for them.
 *
 * Hermetic: made-up data, no tenant, no recording; the golden folders are read, nothing is written.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import { jest } from '@jest/globals';
import { type IdObjectSkeletonInterface } from '../api/ApiTypes';
import { type CookieDomains } from '../api/cloud/EnvCookieDomainsApi';
import { type State } from '../shared/State';
import {
  importSpecifiersOf,
  NODE_IO_MODULES,
} from '../test/exportFileFormat/importsOf';
import { goldenDifferences } from '../test/utils/FileSetGolden';
import {
  axiosTenant,
  chainOf,
  countingReader,
  everythingOf,
  IDM_SCOPE,
  newState,
  readerOf,
  restoreAdapter,
  type Tenant,
} from '../test/utils/FileSetTestKit';
import { assertFileSetPath } from '../utils/FileSetPathUtils';
import {
  createMemoryFileSetReader,
  type FileSetReader,
  type VirtualFileSet,
} from '../utils/FileSetUtils';
import {
  readCookieDomains,
  updateCookieDomains,
} from './cloud/EnvCookieDomainsOps';
import { FrodoError } from './FrodoError';
import {
  importConfigEntities,
  mergeKbaConfig,
  pullKbaConfig,
  pushKbaConfig,
  readConfigEntity,
  splitKbaConfig,
  type ConfigEntityExportInterface,
} from './IdmConfigOps';
import {
  mergeAndWriteSingleton,
  mergeSingleton,
  splitSingleton,
} from './internal/FileSetEngine';
import { type PushOutcome, type ResultCallback } from './OpsTypes';

afterEach(restoreAdapter);

const GOLDEN_ROOT = fileURLToPath(new URL('../test/golden', import.meta.url));
const CONFIG_URL = 'https://openam-matrix.example.com/openidm/config';
const ENVIRONMENT_URL = 'https://openam-matrix.example.com/environment';

/** The functions of a type. */
type Functions = {
  split(entity: object): VirtualFileSet;
  merge(arguments_: { reader: FileSetReader; state: State }): Promise<unknown>;
  pull(arguments_: { state: State }): Promise<VirtualFileSet>;
  push(arguments_: {
    reader: FileSetReader;
    resultCallback?: ResultCallback<never>;
    state: State;
  }): Promise<PushOutcome[]>;
};

/** One type of the table. */
type Row = {
  key: string;
  source: string;
  golden: string;
  path: string;
  ownedFolders: string[];
  keepsRev: boolean;
  id: string;
  hasId: boolean;
  scope: string;
  functions: Functions;
  entityOf: (merged: unknown) => object;
  pullRequests: string[];
  pushRequests: string[];
};

/**
 * The functions of a type that has one object in one file, made with the engine from what the type reads and writes: the
 * shapes of this table, which are not types of the library.
 * @param {string} path the path of the file
 * @param {string} id the id of the object
 * @param {string | null} idKey the key that holds the id, or null for an object that holds none
 * @param {() => Promise<object>} read reads the object from the tenant
 * @param {(object: object, state: State) => Promise<unknown>} write writes the object to the tenant
 * @returns {Functions} the four functions
 */
function shapeFunctions({
  path,
  id,
  idKey,
  read,
  write,
}: {
  path: string;
  id: string;
  idKey: string | null;
  read: (state: State) => Promise<object>;
  write: (object: object, state: State) => Promise<unknown>;
}): Functions {
  const merge = ({ reader, state }: { reader: FileSetReader; state: State }) =>
    mergeSingleton({ path, id, idKey, reader, state });
  return {
    split: (object) => splitSingleton({ object, path }),
    merge,
    pull: async ({ state }) =>
      splitSingleton({ object: await read(state), path }),
    push: ({ reader, resultCallback, state }) =>
      mergeAndWriteSingleton({
        id,
        path,
        merge: () => merge({ reader, state }),
        write: (merged) => write(merged as object, state),
        resultCallback: resultCallback as ResultCallback<unknown>,
      }),
  };
}

/** The table. A type of the library adds a row here. */
const ROWS: Row[] = [
  {
    key: 'kba',
    source: 'src/ops/IdmConfigOps.ts',
    golden: 'kba',
    path: 'kba/selfservice.kba.json',
    ownedFolders: ['kba'],
    keepsRev: false,
    id: 'selfservice.kba',
    hasId: true,
    scope: IDM_SCOPE,
    functions: {
      split: splitKbaConfig,
      merge: mergeKbaConfig,
      pull: pullKbaConfig,
      push: pushKbaConfig as Functions['push'],
    },
    entityOf: (merged) =>
      (merged as ConfigEntityExportInterface).idm['selfservice.kba'],
    pullRequests: [`GET ${CONFIG_URL}/selfservice.kba`],
    pushRequests: [`PUT ${CONFIG_URL}/selfservice.kba`],
  },
  // the shape of the cookie domains of Cloud: an object that holds no id, in a file in a folder, read and written through the
  // api of the Cloud environment, whose scope is not the one of the IDM
  {
    key: 'shape-no-id',
    source: 'src/ops/internal/FileSetEngine.ts',
    golden: 'shape-no-id',
    path: 'cookie-domains/cookie-domains.json',
    ownedFolders: ['cookie-domains'],
    keepsRev: false,
    id: 'cookie-domains',
    hasId: false,
    scope: 'fr:idc:cookie-domain:*',
    functions: shapeFunctions({
      path: 'cookie-domains/cookie-domains.json',
      id: 'cookie-domains',
      idKey: null,
      read: (state) => readCookieDomains({ state }),
      write: (domains, state) =>
        updateCookieDomains({ domains: domains as CookieDomains, state }),
    }),
    entityOf: (merged) => merged as object,
    pullRequests: [`GET ${ENVIRONMENT_URL}/cookie-domains`],
    pushRequests: [`PUT ${ENVIRONMENT_URL}/cookie-domains`],
  },
  // a file at the root of the set, which owns no folder (a config entity, for the requests)
  {
    key: 'shape-root-file',
    source: 'src/ops/internal/FileSetEngine.ts',
    golden: 'shape-root-file',
    path: 'single.json',
    ownedFolders: [],
    keepsRev: false,
    id: 'single',
    hasId: true,
    scope: IDM_SCOPE,
    functions: shapeFunctions({
      path: 'single.json',
      id: 'single',
      idKey: '_id',
      read: (state) => readConfigEntity({ entityId: 'single', state }),
      write: async (entity, state) =>
        (
          await importConfigEntities({
            importData: { idm: { single: entity as never } },
            options: { validate: false },
            state,
          })
        )[0],
    }),
    entityOf: (merged) => merged as object,
    pullRequests: [`GET ${CONFIG_URL}/single`],
    pushRequests: [`PUT ${CONFIG_URL}/single`],
  },
];

/** Ids that a file must not push to, whatever the type: the paths that a request would resolve to, and an empty id. */
const FOREIGN_IDS = [
  'selfservice.other',
  '..',
  '../managed/alpha_user',
  '../../am/json/realms/root/users/x',
  '',
];

/**
 * Ids that look like the id of a type and are not it: the same letters in full-width forms (which a comparison that
 * normalises with NFKC takes for the id), the Cyrillic letters, the id with a zero-width space after it and with a combining
 * accent after it, and the id in capitals.
 * @param {string} id the id of a type
 * @returns {string[]} the look-alikes
 */
const lookAlikesOf = (id: string): string[] => [
  id.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)),
  id.replace(/[aeopcxy]/g, (c) => 'аеорсху'['aeopcxy'.indexOf(c)]),
  `${id}​`,
  `${id}́`,
  id.toUpperCase(),
];

/** The value that no message, outcome, callback or output may ever show. */
const CANARY = 'canary-value-that-must-never-be-shown-4711';

/** The entity of the golden folder of a row, as a tenant has it. */
const entityOfRow = (row: Row): Record<string, unknown> =>
  JSON.parse(
    readFileSync(join(GOLDEN_ROOT, row.golden, 'entity.json'), 'utf8')
  );

/** The text of the golden file of a row. */
const goldenText = (row: Row): string =>
  readFileSync(join(GOLDEN_ROOT, row.golden, 'files', row.path), 'utf8');

/**
 * What a push must send for the golden file: the object that the file holds, with its escaped `${` as text, in the order of
 * the file, as the request carries it.
 * @param {Row} row the row
 * @returns {string} the body
 */
const goldenBody = (row: Row): string =>
  JSON.stringify(JSON.parse(goldenText(row).replaceAll('\\\\${', '${')));

describe.each(ROWS)('the single-object type $key', (row) => {
  const goldenFolder = join(GOLDEN_ROOT, row.golden);
  const make = (): { tenant: Tenant; fns: Functions } => ({
    tenant: axiosTenant({ scope: row.scope }),
    fns: row.functions,
  });
  /** The golden file with another id, for the rows whose object holds one: the text is the golden text but for the id. */
  const withId = (id: string): string =>
    goldenText(row).replace(
      '"_id": ' + JSON.stringify(row.id),
      `"_id": ${JSON.stringify(id)}`
    );

  describe('the split', () => {
    it('gives the golden file set, byte for byte', () => {
      const { fns } = make();

      expect(
        goldenDifferences(fns.split(entityOfRow(row)), goldenFolder)
      ).toEqual([]);
    });

    it('gives one file, at a path that the gate lets through, in the folders that the type owns', () => {
      const { fns } = make();
      const set = fns.split(entityOfRow(row));

      expect(set.files.map((file) => file.path)).toEqual([row.path]);
      expect(() => assertFileSetPath(row.path)).not.toThrow();
      expect(set.ownedFolders).toEqual(row.ownedFolders);
    });

    it('leaves the modified properties out, and `_rev` unless the type keeps it', () => {
      const { fns } = make();
      const written = JSON.parse(fns.split(entityOfRow(row)).files[0].content);

      expect(written.lastChanged).toBeUndefined();
      expect(written._rev !== undefined).toBe(row.keepsRev);
    });

    it('writes the text that is not ASCII as it is, with no escape for it, and keeps text that only looks like an escape', () => {
      const { fns } = make();
      const { content } = fns.split(entityOfRow(row)).files[0];
      const text = readFileSync(
        join(GOLDEN_ROOT, row.golden, 'entity.json'),
        'utf8'
      );
      const letters = [...new Set(text.match(/[^\x00-\x7f]/g) ?? [])];

      // every letter that is not ASCII in the entity is in the file as it is
      expect(letters.length).toBeGreaterThan(0);
      for (const letter of letters) expect(content).toContain(letter);
      // and no JSON escape stands for one of them: a backslash that is itself escaped is text (`\\u00e9` is six letters),
      // so what is looked for is a `\u` that an odd number of backslashes lead
      expect(content).not.toMatch(
        /(?<!\\)(?:\\\\)*\\u(?!00[01][0-9a-fA-F])[0-9a-fA-F]{4}/
      );
    });

    it('escapes every `${`, and ends with one newline', () => {
      const { fns } = make();
      const { content } = fns.split(entityOfRow(row)).files[0];

      expect(content).not.toMatch(/[^\\]\$\{/);
      expect(content.endsWith('}\n')).toBe(true);
      expect(content.endsWith('\n\n')).toBe(false);
    });

    it('does not change the entity, and gives the same file whatever the order of its keys', () => {
      const { fns } = make();
      const given = entityOfRow(row);
      const before = JSON.stringify(given);
      const reversed = Object.fromEntries(Object.entries(given).reverse());

      const set = fns.split(given);

      expect(JSON.stringify(given)).toBe(before);
      expect(fns.split(reversed)).toEqual(set);
    });
  });

  describe('the merge', () => {
    const merge = (files: Record<string, string>, state?: State) => {
      const { fns, tenant } = make();
      return fns.merge({
        reader: readerOf(files),
        state: state ?? tenant.state,
      });
    };

    it('reads the golden file back: the split of what it gives is the golden set again', async () => {
      const { fns, tenant } = make();
      const merged = await fns.merge({
        reader: createMemoryFileSetReader(fns.split(entityOfRow(row))),
        state: tenant.state,
      });

      expect(fns.split(row.entityOf(merged))).toEqual(
        fns.split(entityOfRow(row))
      );
    });

    it('reads one file, lists nothing, and so does not care what else the folder holds', async () => {
      const { fns, tenant } = make();
      const { reader, asked } = countingReader({
        [row.path]: goldenText(row),
        'other/other.json': '{"_id":"other"}',
      });

      await fns.merge({ reader, state: tenant.state });

      expect(asked).toEqual({ read: [row.path], listed: [] });
    });

    it('fails, and names the file, for a file that is not there; a file under another name is not the file', async () => {
      await expect(merge({})).rejects.toThrow(row.path);
      await expect(
        merge({ 'elsewhere/renamed.json': goldenText(row) })
      ).rejects.toThrow(row.path);
    });

    it('fails, and names the file, for text that is not JSON', async () => {
      await expect(merge({ [row.path]: '{ not json' })).rejects.toThrow(
        `Error parsing JSON from ${row.path}`
      );
    });

    it('fails for a placeholder that has no value, names the placeholder, and never shows a value of the state', async () => {
      const { tenant } = make();
      tenant.state.setEnv('OTHER_NAME', 'a-value-that-must-stay-out-of-it');
      const text = JSON.stringify({
        ...(row.hasId ? { _id: row.id } : {}),
        text: '${NO_SUCH_NAME}',
      });

      const failure = merge({ [row.path]: text }, tenant.state);

      await expect(failure).rejects.toBeInstanceOf(FrodoError);
      const message = chainOf(await failure.catch((error) => error))
        .map((error) => (error as Error).message)
        .join(' | ');
      expect(message).toContain('NO_SUCH_NAME');
      expect(message).not.toContain('a-value-that-must-stay-out-of-it');
    });

    if (row.hasId) {
      it.each([...FOREIGN_IDS, ...lookAlikesOf(row.id)])(
        'refuses a file that holds the id %j, names the file and the id of the type, and never shows the id that the file holds',
        async (foreign) => {
          const failure = merge({ [row.path]: withId(foreign) });

          await expect(failure).rejects.toBeInstanceOf(FrodoError);
          const message = ((await failure.catch((error) => error)) as Error)
            .message;
          expect(message).toBe(
            foreign === ''
              ? `The file ${row.path} holds no _id that is a text.`
              : `The file ${row.path} does not hold the id of this type, ${JSON.stringify(row.id)}.`
          );
        }
      );

      it('never prints the value of a placeholder that the id of the file resolves to', async () => {
        const { fns, tenant } = make();
        tenant.state.setEnv('CANARY_NAME', CANARY);

        const error = await fns
          .merge({
            reader: readerOf({ [row.path]: withId('${CANARY_NAME}') }),
            state: tenant.state,
          })
          .catch((e) => e);

        expect(error).toBeInstanceOf(FrodoError);
        expect(everythingOf(error)).not.toContain(CANARY);
      });

      it.each([
        ['no `_id`', '{"text":"x"}'],
        ['an `_id` that is not text', '{"_id":3}'],
        ['an array', '[1]'],
        ['`null`', 'null'],
      ])('refuses a file that holds %s', async (_what, text) => {
        await expect(merge({ [row.path]: text })).rejects.toThrow(
          `The file ${row.path} holds no _id that is a text.`
        );
      });

      it('compares the id that the content holds, and never the name of the file or the path', async () => {
        // the file is at the right path, and the name of the file says the id of the type: the content decides
        await expect(
          merge({ [row.path]: withId('not-' + row.id) })
        ).rejects.toThrow('does not hold the id of this type');
        await expect(
          merge({ [row.path]: withId(row.id) })
        ).resolves.toBeDefined();
      });
    } else {
      it.each([
        ['an array', '[1]'],
        ['`null`', 'null'],
        ['a number', '5'],
      ])(
        'refuses a file that holds %s: the type has an object',
        async (_what, text) => {
          await expect(merge({ [row.path]: text })).rejects.toThrow(
            `The file ${row.path} does not hold a JSON object.`
          );
        }
      );
    }
  });

  describe('the pull', () => {
    it('makes the requests of the row, and gives the golden file set', async () => {
      const { fns, tenant } = make();
      tenant.answer({ data: entityOfRow(row) });

      const set = await fns.pull({ state: tenant.state });

      expect(tenant.seen()).toEqual(row.pullRequests);
      expect(goldenDifferences(set, goldenFolder)).toEqual([]);
    });

    it('does not change what the tenant answered', async () => {
      const { fns, tenant } = make();
      const answered = entityOfRow(row);
      const before = JSON.stringify(answered);
      tenant.answer({ data: answered });

      await fns.pull({ state: tenant.state });

      expect(JSON.stringify(answered)).toBe(before);
    });

    it('needs the scope of its api: a token of another scope sends nothing, and the pull rejects', async () => {
      const { fns, tenant } = make();
      tenant.answer({ data: entityOfRow(row) });

      await expect(
        fns.pull({ state: newState({ scope: 'fr:unrelated:*' }) })
      ).rejects.toBeInstanceOf(FrodoError);
      expect(tenant.seen()).toEqual([]);
    });

    it.each([404, 500])(
      'rejects with a FrodoError that keeps the cause when the tenant answers %i, and gives no file set',
      async (status) => {
        const { fns, tenant } = make();
        tenant.answer({ status, data: { code: status, message: 'refused' } });

        const outcome = fns.pull({ state: tenant.state });

        await expect(outcome).rejects.toBeInstanceOf(FrodoError);
        const error = await outcome.catch((e) => e);
        expect(
          chainOf(error).some(
            (cause) =>
              (cause as { response?: { status?: number } }).response?.status ===
              status
          )
        ).toBe(true);
        expect(tenant.seen()).toEqual(row.pullRequests);
      }
    );
  });

  describe('the push', () => {
    const golden = () => readerOf({ [row.path]: goldenText(row) });

    it('makes the requests of the row, gives one outcome with the id of the type, and tells the callback once', async () => {
      const { fns, tenant } = make();
      tenant.answer({ data: { answered: true } });
      const resultCallback = jest.fn();

      const outcomes = await fns.push({
        reader: golden(),
        resultCallback,
        state: tenant.state,
      });

      expect(tenant.seen()).toEqual(row.pushRequests);
      // the request carries the file: the golden object, its escaped `${` text again, the keys in the order of the file
      expect(tenant.bodies()).toEqual([goldenBody(row)]);
      expect(outcomes).toEqual([{ id: row.id }]);
      expect(resultCallback).toHaveBeenCalledTimes(1);
      expect(resultCallback).toHaveBeenCalledWith(undefined, {
        answered: true,
      });
    });

    it('needs the scope of its api: with a token of another scope the push is an outcome with the error, and nothing is sent', async () => {
      const { fns, tenant } = make();
      tenant.answer({ data: {} });
      const resultCallback = jest.fn();

      const outcomes = await fns.push({
        reader: golden(),
        resultCallback,
        state: newState({ scope: 'fr:unrelated:*' }),
      });

      expect(tenant.seen()).toEqual([]);
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].id).toBe(row.id);
      expect(outcomes[0].error).toBeInstanceOf(FrodoError);
      expect(resultCallback).toHaveBeenCalledTimes(1);
    });

    it('pushes what a pull gave', async () => {
      const { fns, tenant } = make();
      tenant.answer({ data: entityOfRow(row) });
      const set = await fns.pull({ state: tenant.state });
      tenant.answer({ data: {} });

      const outcomes = await fns.push({
        reader: createMemoryFileSetReader(set),
        state: tenant.state,
      });

      expect(outcomes).toEqual([{ id: row.id }]);
      expect(tenant.seen()).toEqual(row.pushRequests);
      expect(tenant.bodies()).toEqual([goldenBody(row)]);
    });

    it('is an outcome with the error when the tenant refuses, the callback is told once, and nothing is thrown', async () => {
      const { fns, tenant } = make();
      tenant.answer({ status: 500, data: { code: 500, message: 'no' } });
      const resultCallback = jest.fn();

      const outcomes = await fns.push({
        reader: golden(),
        resultCallback,
        state: tenant.state,
      });

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].id).toBe(row.id);
      expect(outcomes[0].error).toBeInstanceOf(FrodoError);
      expect(
        chainOf(outcomes[0].error).some(
          (cause) =>
            (cause as { response?: { status?: number } }).response?.status ===
            500
        )
      ).toBe(true);
      expect(resultCallback).toHaveBeenCalledTimes(1);
      expect(resultCallback.mock.calls[0][0]).toBe(outcomes[0].error);
    });

    it.each([
      ['is not there', {} as Record<string, string>, 'does not exist'],
      ['is not JSON', { __PATH__: '{ not json' }, 'Error parsing JSON'],
    ])(
      'is an outcome that names the path, nothing is sent and the callback is told once, for a file that %s',
      async (_what, files, text) => {
        const { fns, tenant } = make();
        tenant.answer({ data: {} });
        const resultCallback = jest.fn();
        const given = Object.fromEntries(
          Object.entries(files).map(([key, value]) => [
            key === '__PATH__' ? row.path : key,
            value,
          ])
        );

        const outcomes = await fns.push({
          reader: readerOf(given),
          resultCallback,
          state: tenant.state,
        });

        expect(tenant.seen()).toEqual([]);
        expect(outcomes).toHaveLength(1);
        expect(outcomes[0].id).toBe(row.path);
        expect(
          chainOf(outcomes[0].error)
            .map((error) => (error as Error).message)
            .join(' | ')
        ).toContain(text);
        expect(resultCallback).toHaveBeenCalledTimes(1);
        expect(resultCallback.mock.calls[0][0]).toBe(outcomes[0].error);
      }
    );

    it.each([
      ['a Buffer', () => Buffer.from(CANARY)],
      ['null', () => null],
      ['a number', () => 42],
    ])(
      'is an outcome that names the file, sends nothing and shows nothing of what the reader gave, for a reader that gives %s',
      async (_what, give) => {
        const { fns, tenant } = make();
        tenant.answer({ data: {} });
        const resultCallback = jest.fn();
        const reader = {
          listDirectory: async () => undefined,
          readFile: async () => give() as unknown as string,
        };

        const outcomes = await fns.push({
          reader,
          resultCallback,
          state: tenant.state,
        });

        expect(tenant.seen()).toEqual([]);
        expect(outcomes).toHaveLength(1);
        expect(outcomes[0].id).toBe(row.path);
        expect(
          chainOf(outcomes[0].error)
            .map((error) => (error as Error).message)
            .join(' | ')
        ).toContain(`The reader did not return text for ${row.path}.`);
        expect(everythingOf(outcomes[0].error)).not.toContain(CANARY);
        expect(resultCallback).toHaveBeenCalledTimes(1);
      }
    );

    if (row.hasId) {
      it.each([...FOREIGN_IDS, ...lookAlikesOf(row.id)])(
        'sends nothing for a file that holds the id %j: the outcome is the path of the file, and the error names the type and not the id of the file',
        async (foreign) => {
          const { fns, tenant } = make();
          tenant.answer({ data: {} });
          const resultCallback = jest.fn();

          const outcomes = await fns.push({
            reader: readerOf({ [row.path]: withId(foreign) }),
            resultCallback,
            state: tenant.state,
          });

          expect(tenant.seen()).toEqual([]);
          expect(outcomes).toHaveLength(1);
          expect(outcomes[0].id).toBe(row.path);
          expect(outcomes[0].error).toBeInstanceOf(FrodoError);
          expect(
            chainOf(outcomes[0].error)
              .map((error) => (error as Error).message)
              .join(' | ')
          ).toContain(
            foreign === ''
              ? `The file ${row.path} holds no _id that is a text.`
              : `The file ${row.path} does not hold the id of this type, ${JSON.stringify(row.id)}.`
          );
          expect(resultCallback).toHaveBeenCalledTimes(1);
        }
      );

      it('never shows the value of a placeholder that the id of the file resolves to: not in the outcome, not in what the callback is told, not in the output', async () => {
        const { fns, tenant } = make();
        tenant.state.setEnv('CANARY_NAME', CANARY);
        tenant.answer({ data: {} });
        const resultCallback = jest.fn();
        const written: string[] = [];
        const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
          (name) =>
            jest.spyOn(console, name).mockImplementation((...a: unknown[]) => {
              written.push(a.map(String).join(' '));
            })
        );
        const write = (chunk: unknown) => {
          written.push(String(chunk));
          return true;
        };
        const out = jest
          .spyOn(process.stdout, 'write')
          .mockImplementation(write);
        const err = jest
          .spyOn(process.stderr, 'write')
          .mockImplementation(write);
        let outcomes: PushOutcome[];
        try {
          outcomes = await fns.push({
            reader: readerOf({ [row.path]: withId('${CANARY_NAME}') }),
            resultCallback,
            state: tenant.state,
          });
        } finally {
          [...spies, out, err].forEach((spy) => spy.mockRestore());
        }

        expect(tenant.seen()).toEqual([]);
        expect(outcomes).toHaveLength(1);
        expect(outcomes[0].id).toBe(row.path);
        expect(everythingOf(outcomes[0].error)).not.toContain(CANARY);
        expect(inspect(outcomes, { depth: null })).not.toContain(CANARY);
        expect(
          inspect(resultCallback.mock.calls, { depth: null })
        ).not.toContain(CANARY);
        expect(written.join('\n')).not.toContain(CANARY);
      });
    }
  });

  describe('the module', () => {
    it('imports no module of the file system, the machine or other processes', () => {
      const imports = importSpecifiersOf(row.source as string);

      expect(imports.filter((s) => NODE_IO_MODULES.includes(s))).toEqual([]);
    });
  });
});

describe('the table', () => {
  it('has a golden folder for every row, and a row for the KBA configuration', () => {
    expect(ROWS.map((row) => row.key)).toContain('kba');
    for (const row of ROWS) {
      expect(() => entityOfRow(row)).not.toThrow();
      expect(goldenText(row).length).toBeGreaterThan(0);
    }
  });

  it('has a row for an object that holds no id, one for a file at the root of the set, and one with an id', () => {
    expect(ROWS.filter((row) => !row.hasId)).toHaveLength(1);
    expect(ROWS.filter((row) => row.ownedFolders.length === 0)).toHaveLength(1);
    expect(ROWS.filter((row) => row.hasId).length).toBeGreaterThan(1);
  });

  it('keeps the id of an object as a key of the entity that the tenant has', () => {
    for (const row of ROWS.filter((r) => r.hasId)) {
      expect((entityOfRow(row) as IdObjectSkeletonInterface)._id).toBe(row.id);
    }
  });
});
