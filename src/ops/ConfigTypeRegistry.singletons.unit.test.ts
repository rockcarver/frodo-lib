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
 * - `functions`: the split, the merge, the pull and the push of the type, given the tenant that the row talks to.
 * - `tenant`: the tenant that the row talks to, which answers and says what it saw.
 * - `entityOf`: what the merge gives, as the entity.
 * - `pullRequests` and `pushRequests`: the requests that a pull and a push make, one line each (`GET <url>`).
 *
 * Two rows are not types of the library; they are shapes that the first rows do not have, made with the functions of the
 * engine and a tenant in memory, and no module: an object that holds no id in a file in a folder (the shape of the cookie
 * domains of Cloud), and a file at the root of the set. They show what a type of that shape passes to the engine.
 *
 * Hermetic: made-up data, no tenant, no recording; the golden folders are read, nothing is written.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';
import { type IdObjectSkeletonInterface } from '../api/ApiTypes';
import { type State } from '../shared/State';
import {
  importSpecifiersOf,
  NODE_IO_MODULES,
} from '../test/exportFileFormat/importsOf';
import { goldenDifferences } from '../test/utils/FileSetGolden';
import {
  answer,
  chainOf,
  countingReader,
  newState,
  readerOf,
  restoreAdapter,
  seen,
} from '../test/utils/FileSetTestKit';
import { type StubAnswer } from '../test/utils/StubAdapter';
import { assertFileSetPath } from '../utils/FileSetPathUtils';
import {
  createMemoryFileSetReader,
  type FileSetReader,
  type VirtualFileSet,
} from '../utils/FileSetUtils';
import { FrodoError } from './FrodoError';
import {
  mergeKbaConfig,
  pullKbaConfig,
  pushKbaConfig,
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

/** A tenant that a row talks to. */
type Tenant = {
  /** The state that the functions of the row are given. */
  state: State;
  /** The answers to the requests that follow, in turn; the last one is repeated. A status of 400 or more is a failure. */
  answer(...answers: StubAnswer[]): void;
  /** What the tenant has seen so far, one line for each request: the verb and the url. */
  seen(): string[];
};

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
  source?: string;
  golden: string;
  path: string;
  ownedFolders: string[];
  keepsRev: boolean;
  id: string;
  hasId: boolean;
  functions: (tenant: Tenant) => Functions;
  tenant: () => Tenant;
  entityOf: (merged: unknown) => object;
  pullRequests: string[];
  pushRequests: string[];
};

/** The tenant of a type of the IDM: the requests go through axios, and an adapter answers them. */
function idmTenant(): Tenant {
  let requests: ReturnType<typeof answer> = [];
  return {
    state: newState(),
    answer: (...answers) => {
      requests = answer(...answers);
    },
    seen: () => seen(requests).map(({ method, url }) => `${method} ${url}`),
  };
}

/**
 * A tenant in memory, for a type that is not of the IDM: what a type of that shape reads and writes through functions of
 * its own. It answers like the adapter does, and the functions of the row record what they ask for.
 * @param {string} name what the lines of the requests call the tenant
 * @returns {Tenant & { read: () => Promise<object>; write: (object: object) => Promise<object> }} the tenant and its two functions
 */
function memoryTenant(name: string) {
  let answers: StubAnswer[] = [{ data: {} }];
  const lines: string[] = [];
  const next = (line: string): StubAnswer => {
    lines.push(line);
    return answers[Math.min(lines.length - 1, answers.length - 1)];
  };
  const refuse = (status: number): never => {
    const cause = new AxiosError(
      `Request failed with status code ${status}`,
      'ERR_BAD_RESPONSE',
      undefined,
      undefined,
      { status } as never
    );
    throw new FrodoError(`Error answered ${status}`, cause);
  };
  const tenant: Tenant = {
    state: newState(),
    answer: (...given) => {
      answers = given;
      lines.length = 0;
    },
    seen: () => [...lines],
  };
  return {
    ...tenant,
    read: async (): Promise<object> => {
      const given = next(`GET ${name}`);
      if ((given.status ?? 200) >= 400) refuse(given.status as number);
      return (given.data ?? {}) as object;
    },
    write: async (object: object): Promise<object> => {
      const given = next(`PUT ${name}`);
      if ((given.status ?? 200) >= 400) refuse(given.status as number);
      return (given.data ?? object) as object;
    },
  };
}

/** A type of this table that is a shape and not a module: the engine and a tenant in memory. */
function shapeRow(own: {
  key: string;
  path: string;
  id: string;
  hasId: boolean;
  ownedFolders: string[];
}): Row {
  const base = `${own.key}`;
  let current: ReturnType<typeof memoryTenant> | undefined;
  const spec = {
    path: own.path,
    id: own.id,
    idKey: own.hasId ? '_id' : null,
  };
  return {
    key: own.key,
    golden: own.key,
    path: own.path,
    ownedFolders: own.ownedFolders,
    keepsRev: false,
    id: own.id,
    hasId: own.hasId,
    source: 'src/ops/internal/FileSetEngine.ts',
    tenant: () => {
      current = memoryTenant(base);
      return current;
    },
    functions: () => {
      const merge = ({
        reader,
        state,
      }: {
        reader: FileSetReader;
        state: State;
      }) => mergeSingleton({ ...spec, reader, state });
      return {
        split: (object) => splitSingleton({ object, path: own.path }),
        merge,
        pull: async () =>
          splitSingleton({
            object: await (current as ReturnType<typeof memoryTenant>).read(),
            path: own.path,
          }),
        push: ({ reader, resultCallback, state }) =>
          mergeAndWriteSingleton({
            id: own.id,
            path: own.path,
            merge: () => merge({ reader, state }),
            write: (merged) =>
              (current as ReturnType<typeof memoryTenant>).write(merged),
            resultCallback: resultCallback as ResultCallback<object>,
          }),
      };
    },
    entityOf: (merged) => merged as object,
    pullRequests: [`GET ${base}`],
    pushRequests: [`PUT ${base}`],
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
    functions: () => ({
      split: splitKbaConfig,
      merge: mergeKbaConfig,
      pull: pullKbaConfig,
      push: pushKbaConfig as Functions['push'],
    }),
    tenant: idmTenant,
    entityOf: (merged) =>
      (merged as ConfigEntityExportInterface).idm['selfservice.kba'],
    pullRequests: [`GET ${CONFIG_URL}/selfservice.kba`],
    pushRequests: [`PUT ${CONFIG_URL}/selfservice.kba`],
  },
  // the shape of the cookie domains of Cloud: an object that holds no id, in a file in a folder
  shapeRow({
    key: 'shape-no-id',
    path: 'cookie-domains/cookie-domains.json',
    id: 'cookie-domains',
    hasId: false,
    ownedFolders: ['cookie-domains'],
  }),
  // a file at the root of the set, which owns no folder
  shapeRow({
    key: 'shape-root-file',
    path: 'single.json',
    id: 'single',
    hasId: true,
    ownedFolders: [],
  }),
];

/** The ids that a file must not push to, with what a request to them would be. */
const FOREIGN_IDS = [
  'selfservice.other',
  '..',
  '../managed/alpha_user',
  '../../am/json/realms/root/users/x',
  '',
];

/** The entity of the golden folder of a row, as a tenant has it. */
const entityOfRow = (row: Row): Record<string, unknown> =>
  JSON.parse(
    readFileSync(join(GOLDEN_ROOT, row.golden, 'entity.json'), 'utf8')
  );

/** The text of the golden file of a row. */
const goldenText = (row: Row): string =>
  readFileSync(join(GOLDEN_ROOT, row.golden, 'files', row.path), 'utf8');

describe.each(ROWS)('the single-object type $key', (row) => {
  const goldenFolder = join(GOLDEN_ROOT, row.golden);
  const make = () => {
    const tenant = row.tenant();
    return { tenant, fns: row.functions(tenant) };
  };
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

    it('writes text that is not ASCII as it is, escapes every `${`, and ends with one newline', () => {
      const { fns } = make();
      const { content } = fns.split(entityOfRow(row)).files[0];

      expect(content).not.toContain('\\u');
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
      it.each(FOREIGN_IDS)(
        'refuses a file that holds the id %j, and names the file and both ids',
        async (foreign) => {
          const failure = merge({ [row.path]: withId(foreign) });

          await expect(failure).rejects.toBeInstanceOf(FrodoError);
          const message = ((await failure.catch((error) => error)) as Error)
            .message;
          if (foreign === '') {
            expect(message).toContain(`The file ${row.path} holds no _id`);
          } else {
            expect(message).toContain(`The file ${row.path} holds the id`);
            expect(message).toContain(`"${row.id}"`);
          }
        }
      );

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
        ).rejects.toThrow('but the id of this type is');
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
      expect(outcomes).toEqual([{ id: row.id }]);
      expect(resultCallback).toHaveBeenCalledTimes(1);
      expect(resultCallback).toHaveBeenCalledWith(undefined, {
        answered: true,
      });
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

    if (row.hasId) {
      it.each(FOREIGN_IDS)(
        'sends nothing for a file that holds the id %j: the outcome is the path of the file and the error names both ids',
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
          const message = chainOf(outcomes[0].error)
            .map((error) => (error as Error).message)
            .join(' | ');
          expect(message).toContain(row.path);
          // an empty id is no id; any other names both
          if (foreign !== '') expect(message).toContain(`"${row.id}"`);
          expect(resultCallback).toHaveBeenCalledTimes(1);
        }
      );
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
