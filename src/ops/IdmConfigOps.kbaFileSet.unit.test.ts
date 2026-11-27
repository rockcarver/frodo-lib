/**
 * Run tests
 *
 *        npm run test:only -- src/ops/IdmConfigOps.kbaFileSet
 *
 * The pull and the push of the KBA configuration (the config entity `selfservice.kba`) as a file set: the first
 * configuration type that is pulled to a file set and pushed from one, and the pattern that the other single-file
 * configuration types of the IDM follow. The cases:
 *
 * - `splitKbaConfig` and `mergeKbaConfig` are pure. The split gives the golden folder `src/test/golden/kba` byte for byte (the
 *   entity of the tenant is `entity.json` there), the merge reads it back, and the id of what it reads is the `_id` that the file
 *   holds, never its name.
 * - `pullKbaConfig` and `pushKbaConfig` send the requests that the recorded runs of the command line show: one GET of
 *   `config/selfservice.kba` for the pull, one PUT of the same path for the push. A stub adapter answers; the requests are
 *   compared with those of `readConfigEntity` and `importConfigEntities`, which the command line calls today, and with the
 *   requests that the recordings hold.
 * - The file that the pull gives is the file that the command line writes today (`saveJsonToFile`, which the command line
 *   calls), byte for byte, for an entity without `${`.
 *
 * Hermetic: made-up data, no tenant, no recording; the one folder that is written is a temporary folder that the test
 * removes. The sample host is `https://openam-matrix.example.com/am`.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';
import axios, { type AxiosRequestConfig } from 'axios';
import { type IdObjectSkeletonInterface } from '../api/ApiTypes';
import { FrodoLib } from '../lib/FrodoLib';
import StateImpl, { type State } from '../shared/State';
import {
  importSpecifiersOf,
  NODE_IO_MODULES,
} from '../test/exportFileFormat/importsOf';
import { goldenDifferences } from '../test/utils/FileSetGolden';
import { stubAdapter, type StubAnswer } from '../test/utils/StubAdapter';
import { readJsonFile, saveJsonToFile } from '../utils/ExportImportUtils';
import { assertFileSetPath } from '../utils/FileSetPathUtils';
import {
  createMemoryFileSetReader,
  type FileSetReader,
  type VirtualFileSet,
} from '../utils/FileSetUtils';
import { FrodoError, isNotFoundError } from './FrodoError';
import {
  exportConfigEntity,
  importConfigEntities,
  kbaConfigType,
  mergeKbaConfig,
  pullKbaConfig,
  pushKbaConfig,
  readConfigEntity,
  splitKbaConfig,
} from './IdmConfigOps';

const GOLDEN = fileURLToPath(new URL('../test/golden/kba', import.meta.url));
const GOLDEN_FILE = join(GOLDEN, 'files/kba/selfservice.kba.json');
const PATH = 'kba/selfservice.kba.json';
const HOST = 'https://openam-matrix.example.com/am';
const CONFIG_URL = 'https://openam-matrix.example.com/openidm/config';

/** The entity as the tenant has it: a revision, a date of the last change, a French and a Japanese text, keys out of order. */
const entity = (): IdObjectSkeletonInterface =>
  JSON.parse(readFileSync(join(GOLDEN, 'entity.json'), 'utf8'));

/** What the recorded run of the command line wrote, and sent: the file of its fixture and the body of its recorded PUT. */
const CLI_FIXTURE = `{
  "_id": "selfservice.kba",
  "kbaPropertyName": "kbaInfo",
  "minimumAnswersToDefine": 2,
  "minimumAnswersToVerify": 1,
  "questions": {
    "1": {
      "en": "What's your favorite color?",
      "en_GB": "What is your favourite colour?",
      "fr": "Quelle est votre couleur préférée?"
    },
    "2": {
      "en": "Who was your first employer?"
    },
    "3": {
      "en": "who are you"
    }
  }
}
`;
const RECORDED_PUT_BODY =
  '{"_id":"selfservice.kba","kbaPropertyName":"kbaInfo","minimumAnswersToDefine":2,"minimumAnswersToVerify":1,"questions":{"1":{"en":"What\'s your favorite color?","en_GB":"What is your favourite colour?","fr":"Quelle est votre couleur préférée?"},"2":{"en":"Who was your first employer?"},"3":{"en":"who are you"}}}';

const newState = (): State => {
  const state = StateImpl({ host: HOST });
  state.setDeploymentType('cloud');
  state.setBearerTokenMeta({
    access_token: 'sample-bearer-token',
    token_type: 'Bearer',
    scope: 'fr:idm:*',
    expires_in: 3600,
    expires: Date.now() + 60 * 60 * 1000,
  } as never);
  return state;
};

const originalAdapter = axios.defaults.adapter;
afterEach(() => {
  axios.defaults.adapter = originalAdapter;
});

/** Answer the requests of the instances that are created from now on, and keep them. */
function answer(...answers: StubAnswer[]): AxiosRequestConfig[] {
  const stub = stubAdapter(answers);
  axios.defaults.adapter = stub.adapter;
  return stub.requests;
}

/** What the tenant saw of each request, in a form to compare: the verb, the url, every header and the body. */
function seen(requests: AxiosRequestConfig[]) {
  return requests.map((request) => ({
    method: String(request.method).toUpperCase(),
    url: request.url,
    headers: (
      request.headers as unknown as { toJSON(): Record<string, unknown> }
    ).toJSON(),
    data: request.data as unknown,
  }));
}

/** The files of a set that a reader holds. */
const readerOf = (files: Record<string, string>): FileSetReader =>
  createMemoryFileSetReader({
    files: Object.entries(files).map(([path, content]) => ({ path, content })),
    ownedFolders: [],
  });

/** The text of the golden file, which the pull of `entity.json` gives. */
const goldenText = (): string => readFileSync(GOLDEN_FILE, 'utf8');

/** A reader that serves the golden file and counts what it is asked for. */
function countingReader(files: Record<string, string>) {
  const inner = readerOf(files);
  const asked = { read: [] as string[], listed: [] as string[] };
  const reader: FileSetReader = {
    async listDirectory(path) {
      asked.listed.push(path);
      return inner.listDirectory(path);
    },
    async readFile(path) {
      asked.read.push(path);
      return inner.readFile(path);
    },
  };
  return { reader, asked };
}

/** The errors below an error, with the error itself first. */
function chainOf(error: unknown): unknown[] {
  const chain: unknown[] = [error];
  for (const original of (error as { originalErrors?: unknown[] })
    .originalErrors ?? []) {
    chain.push(...chainOf(original));
  }
  return chain;
}

/** What the CLI-side runs (the pull of the command line) write for an entity: the lib function that the command line calls. */
function writtenByTheCommandLine(data: object): string {
  const folder = mkdtempSync(join(tmpdir(), 'kba-file-set-'));
  try {
    const file = join(folder, 'kba/selfservice.kba.json');
    saveJsonToFile({
      data,
      filename: file,
      includeMeta: false,
      state: newState(),
    });
    return readFileSync(file, 'utf8');
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

describe('splitKbaConfig', () => {
  it('gives the golden file set, byte for byte', () => {
    expect(goldenDifferences(splitKbaConfig(entity()), GOLDEN)).toEqual([]);
  });

  it('gives one file, at a path that the gate of the file sets lets through, in a folder that the set owns', () => {
    const set = splitKbaConfig(entity());

    expect(set.files.map((file) => file.path)).toEqual([PATH]);
    expect(() => assertFileSetPath(set.files[0].path)).not.toThrow();
    expect(set.ownedFolders).toEqual(['kba']);
  });

  it('leaves `_rev` and the modified properties out at every depth, and keeps the keys that only look like them', () => {
    const written = JSON.parse(splitKbaConfig(entity()).files[0].content);

    expect(written._rev).toBeUndefined();
    expect(written.lastChanged).toBeUndefined();
    expect(written.questions['10'].modifiedDate).toBeUndefined();
    // `createDate` is not one of the ten modified properties
    expect(written.createDate).toBe('2026-01-15T10:00:00.000Z');
  });

  it('writes the keys in order, two spaces for each level and one newline at the end; the keys that are numbers come in the order of their value', () => {
    const { content } = splitKbaConfig(entity()).files[0];

    expect(Object.keys(JSON.parse(content))).toEqual([
      '_id',
      'createDate',
      'kbaPropertyName',
      'minimumAnswersToDefine',
      'minimumAnswersToVerify',
      'questions',
    ]);
    // a JavaScript object lists the keys `1`, `2`, `3` and `10` in the order of their value, and the file of the command line does too
    expect(Object.keys(JSON.parse(content).questions)).toEqual([
      '1',
      '2',
      '3',
      '10',
    ]);
    expect(content.startsWith('{\n  "_id": "selfservice.kba",\n')).toBe(true);
    expect(content.endsWith('}\n')).toBe(true);
    expect(content.endsWith('\n\n')).toBe(false);
  });

  it('writes text that is not ASCII as it is, in UTF-8, and not as a `\\u` escape', () => {
    const { content } = splitKbaConfig(entity()).files[0];

    expect(content).toContain('Quelle est votre couleur préférée?');
    expect(content).toContain('あなたの好きな色は何ですか？');
    expect(content).not.toContain('\\u');
    // `é` takes two bytes, each Japanese letter three
    expect(Buffer.byteLength(content, 'utf8')).toBeGreaterThan(content.length);
  });

  it('escapes `${`, so that a push does not take it for a placeholder', () => {
    const { content } = splitKbaConfig(entity()).files[0];

    expect(content).toContain('\\\\${notAPlaceholder}');
    expect(content).not.toMatch(/[^\\]\$\{/);
  });

  it('does not change the entity it is given', () => {
    const given = entity();
    const before = JSON.stringify(given);

    splitKbaConfig(given);

    expect(JSON.stringify(given)).toBe(before);
  });

  it('gives the same file for the same entity, whatever the order of its keys', () => {
    const given = entity();
    const reversed = Object.fromEntries(
      Object.entries(given).reverse()
    ) as IdObjectSkeletonInterface;

    expect(splitKbaConfig(reversed)).toEqual(splitKbaConfig(given));
  });

  it('gives, for the entity of the recorded run, the file that the command line wrote then, byte for byte', () => {
    const recorded = JSON.parse(CLI_FIXTURE);

    expect(splitKbaConfig(recorded).files[0].content).toBe(CLI_FIXTURE);
  });
});

describe('mergeKbaConfig', () => {
  const state = (): State => newState();

  it('gives what an import takes: the entity under its id, with its text as it was before the split', async () => {
    const merged = await mergeKbaConfig({
      reader: readerOf({ [PATH]: goldenText() }),
      state: state(),
    });

    expect(Object.keys(merged)).toEqual(['idm']);
    expect(Object.keys(merged.idm)).toEqual(['selfservice.kba']);
    const given = entity() as Record<string, unknown>;
    const { _rev, lastChanged, ...expected } = given;
    expect(_rev).toBeDefined();
    expect(lastChanged).toBeDefined();
    // the entity without what the split leaves out; `${notAPlaceholder}` is text again
    (expected.questions as Record<string, Record<string, unknown>>)['10'] = {
      en: 'What was the name of your first pet?',
    };
    expect(merged.idm['selfservice.kba']).toEqual(expected);
    expect(merged.idm['selfservice.kba'].questions).toMatchObject({
      '3': { en: 'Which word, ${notAPlaceholder}, do you remember?' },
    });
  });

  it('gives back what the split was given, apart from what the split leaves out', async () => {
    const set = splitKbaConfig(entity());
    const merged = await mergeKbaConfig({
      reader: createMemoryFileSetReader(set),
      state: state(),
    });

    expect(splitKbaConfig(merged.idm['selfservice.kba'])).toEqual(set);
  });

  it('takes the id from the file, never from its name or its path', async () => {
    const other = goldenText().replace(
      '"_id": "selfservice.kba"',
      '"_id": "selfservice.other"'
    );
    const merged = await mergeKbaConfig({
      reader: readerOf({ [PATH]: other }),
      state: state(),
    });

    expect(Object.keys(merged.idm)).toEqual(['selfservice.other']);
    expect(merged.idm['selfservice.other']._id).toBe('selfservice.other');
  });

  it('fills a placeholder with the value that the state holds', async () => {
    const given = state();
    given.setEnv('KBA_PROPERTY', 'kbaInfoFromState');
    const text = JSON.stringify({
      _id: 'selfservice.kba',
      kbaPropertyName: '${KBA_PROPERTY}',
    });

    const merged = await mergeKbaConfig({
      reader: readerOf({ [PATH]: text }),
      state: given,
    });

    expect(merged.idm['selfservice.kba'].kbaPropertyName).toBe(
      'kbaInfoFromState'
    );
  });

  it('fails for a placeholder that has no value, names the placeholder, and never shows a value of the state', async () => {
    const given = state();
    given.setEnv('OTHER_NAME', 'a-value-that-must-stay-out-of-the-message');
    const text = JSON.stringify({
      _id: 'selfservice.kba',
      kbaPropertyName: '${KBA_PROPERTY}',
    });

    const failure = mergeKbaConfig({
      reader: readerOf({ [PATH]: text }),
      state: given,
    });

    await expect(failure).rejects.toBeInstanceOf(FrodoError);
    const message = chainOf(await failure.catch((error) => error))
      .map((error) => (error as Error).message)
      .join(' | ');
    expect(message).toContain('KBA_PROPERTY');
    expect(message).not.toContain('a-value-that-must-stay-out-of-the-message');
  });

  it('fails, and names the file, for a file that is not there; a file under another name is not the file', async () => {
    await expect(
      mergeKbaConfig({ reader: readerOf({}), state: state() })
    ).rejects.toThrow(PATH);
    await expect(
      mergeKbaConfig({
        reader: readerOf({ 'kba/renamed.json': goldenText() }),
        state: state(),
      })
    ).rejects.toThrow(PATH);
  });

  it('fails, and names the file, for text that is not JSON', async () => {
    await expect(
      mergeKbaConfig({
        reader: readerOf({ [PATH]: '{ not json' }),
        state: state(),
      })
    ).rejects.toThrow(`Error parsing JSON from ${PATH}`);
  });

  it.each([
    ['holds no `_id`', '{"kbaPropertyName":"kbaInfo"}'],
    ['holds an empty `_id`', '{"_id":"","kbaPropertyName":"kbaInfo"}'],
    [
      'holds an `_id` that is not text',
      '{"_id":3,"kbaPropertyName":"kbaInfo"}',
    ],
    ['holds JSON that is not an object', '["selfservice.kba"]'],
    ['holds `null`', 'null'],
  ])('fails, and names the file, for a file that %s', async (_what, text) => {
    await expect(
      mergeKbaConfig({ reader: readerOf({ [PATH]: text }), state: state() })
    ).rejects.toThrow(`The file ${PATH} holds no _id`);
  });

  it('reads one file and lists nothing, so the name of no other file matters', async () => {
    const { reader, asked } = countingReader({
      [PATH]: goldenText(),
      'kba/other.json': '{"_id":"selfservice.other"}',
    });

    await mergeKbaConfig({ reader, state: state() });

    expect(asked).toEqual({ read: [PATH], listed: [] });
  });
});

describe('pullKbaConfig', () => {
  it('sends the one request that the recorded run of the command line shows, and the same as `readConfigEntity`', async () => {
    const reference = answer({ data: entity() });
    await readConfigEntity({ entityId: 'selfservice.kba', state: newState() });
    const expected = seen(reference);

    const requests = answer({ data: entity() });
    await pullKbaConfig({ state: newState() });

    expect(seen(requests)).toEqual(expected);
    // the recording holds a GET of `/openidm/config/selfservice.kba`, with no query and no body
    expect(
      seen(requests).map(({ method, url, data }) => ({ method, url, data }))
    ).toEqual([
      {
        method: 'GET',
        url: `${CONFIG_URL}/selfservice.kba`,
        data: undefined,
      },
    ]);
  });

  it('gives the golden file set for the entity that the tenant answers with', async () => {
    answer({ data: entity() });

    const set = await pullKbaConfig({ state: newState() });

    expect(goldenDifferences(set, GOLDEN)).toEqual([]);
  });

  it('gives the file that the command line writes today, byte for byte', async () => {
    // the entity has `${` in one text, which the command line writes as it is and the pull escapes: left out here
    const given = JSON.parse(
      JSON.stringify(entity()).replace('${notAPlaceholder}', 'notAPlaceholder')
    );
    answer({ data: given });

    const set = await pullKbaConfig({ state: newState() });

    expect(set.files).toHaveLength(1);
    expect(set.files[0].content).toBe(
      writtenByTheCommandLine(JSON.parse(JSON.stringify(given)))
    );
  });

  it('reads the entity as it is: a value that the state holds is not put back as a placeholder', async () => {
    const state = newState();
    state.setEnv('KBA_PROPERTY', 'kbaInfo');
    // an export would write `${KBA_PROPERTY}` for `kbaInfo`: the reference shows what it does with the same state
    answer({ data: entity() });
    expect(
      JSON.stringify(
        (await exportConfigEntity({ entityId: 'selfservice.kba', state })).idm[
          'selfservice.kba'
        ]
      )
    ).toContain('${KBA_PROPERTY}');

    answer({ data: entity() });
    const set = await pullKbaConfig({ state });

    expect(set.files[0].content).toContain('"kbaPropertyName": "kbaInfo"');
    expect(set.files[0].content).not.toContain('KBA_PROPERTY');
  });

  it('does not change what the tenant answered', async () => {
    const answered = entity();
    const before = JSON.stringify(answered);
    answer({ data: answered });

    await pullKbaConfig({ state: newState() });

    expect(JSON.stringify(answered)).toBe(before);
  });

  it.each([
    [404, 'Not Found', 'No configuration exists for id selfservice.kba'],
    [500, 'Internal Server Error', 'The server failed'],
  ])(
    'rejects with a FrodoError that keeps the cause when the tenant answers %i, and gives no file set',
    async (status, reason, message) => {
      answer({ status, data: { code: status, reason, message } });

      const outcome = pullKbaConfig({ state: newState() });

      await expect(outcome).rejects.toBeInstanceOf(FrodoError);
      const error = await outcome.catch((e) => e);
      expect(
        chainOf(error).some(
          (cause) =>
            (cause as { response?: { status?: number } }).response?.status ===
            status
        )
      ).toBe(true);
      expect(isNotFoundError(error)).toBe(status === 404);
    }
  );
});

describe('pushKbaConfig', () => {
  const golden = (): FileSetReader => readerOf({ [PATH]: goldenText() });

  it('sends the one request that the recorded run of the command line shows: a PUT of the file as it is', async () => {
    const requests = answer({ data: { _id: 'selfservice.kba' } });

    const outcomes = await pushKbaConfig({
      reader: readerOf({ [PATH]: CLI_FIXTURE }),
      state: newState(),
    });

    expect(outcomes).toEqual([{ id: 'selfservice.kba' }]);
    expect(
      seen(requests).map(({ method, url, data }) => ({ method, url, data }))
    ).toEqual([
      {
        method: 'PUT',
        url: `${CONFIG_URL}/selfservice.kba`,
        data: RECORDED_PUT_BODY,
      },
    ]);
  });

  it('sends the same requests as `importConfigEntities` after the command line has read the file', async () => {
    const state = newState();
    const fromFile = readJsonFile({
      filePath: GOLDEN_FILE,
      state,
    }) as IdObjectSkeletonInterface;
    const reference = answer({ data: { _id: 'selfservice.kba' } });
    await importConfigEntities({
      importData: { idm: { [fromFile._id]: fromFile } },
      options: { validate: false },
      state,
    });
    const expected = seen(reference);
    expect(expected).toHaveLength(1);

    const requests = answer({ data: { _id: 'selfservice.kba' } });
    await pushKbaConfig({ reader: golden(), state: newState() });

    expect(seen(requests)).toEqual(expected);
  });

  it('sends the entity to the id that the file holds, never to the name of the file', async () => {
    const other = goldenText().replace(
      '"_id": "selfservice.kba"',
      '"_id": "selfservice.other"'
    );
    const requests = answer({ data: { _id: 'selfservice.other' } });

    const outcomes = await pushKbaConfig({
      reader: readerOf({ [PATH]: other }),
      state: newState(),
    });

    expect(outcomes).toEqual([{ id: 'selfservice.other' }]);
    expect(seen(requests).map(({ url }) => url)).toEqual([
      `${CONFIG_URL}/selfservice.other`,
    ]);
  });

  it('reads one file, lists nothing, and sends one request whatever else the folder holds', async () => {
    const { reader, asked } = countingReader({
      [PATH]: goldenText(),
      'kba/other.json': '{"_id":"selfservice.other"}',
      'kba/selfservice.kba.json.bak': '{"_id":"selfservice.bak"}',
    });
    const requests = answer({ data: {} });

    await pushKbaConfig({ reader, state: newState() });

    expect(asked).toEqual({ read: [PATH], listed: [] });
    expect(requests).toHaveLength(1);
  });

  it('tells the callback once for the object, with the answer of the tenant', async () => {
    answer({ data: { _id: 'selfservice.kba', answered: true } });
    const resultCallback = jest.fn();

    await pushKbaConfig({
      reader: golden(),
      resultCallback,
      state: newState(),
    });

    expect(resultCallback).toHaveBeenCalledTimes(1);
    expect(resultCallback).toHaveBeenCalledWith(undefined, {
      _id: 'selfservice.kba',
      answered: true,
    });
  });

  it('pushes what a pull gave: the entity without the revision and the modified properties', async () => {
    answer({ data: entity() });
    const set: VirtualFileSet = await pullKbaConfig({ state: newState() });
    const requests = answer({ data: {} });

    await pushKbaConfig({
      reader: createMemoryFileSetReader(set),
      state: newState(),
    });

    const sent = JSON.parse(String(seen(requests)[0].data));
    const { _rev, lastChanged, ...rest } = entity() as Record<string, unknown>;
    expect(_rev).toBeDefined();
    expect(lastChanged).toBeDefined();
    expect(sent._rev).toBeUndefined();
    expect(sent.lastChanged).toBeUndefined();
    expect(sent.questions['3'].en).toBe(
      'Which word, ${notAPlaceholder}, do you remember?'
    );
    expect(sent.kbaPropertyName).toBe(rest.kbaPropertyName);
  });

  describe('when the tenant refuses', () => {
    it('is an outcome with the error, the callback is told once, and nothing is thrown', async () => {
      answer({
        status: 500,
        data: { code: 500, reason: 'Internal Server Error', message: 'no' },
      });
      const resultCallback = jest.fn();

      const outcomes = await pushKbaConfig({
        reader: golden(),
        resultCallback,
        state: newState(),
      });

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].id).toBe('selfservice.kba');
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
  });

  describe('when the file cannot be used', () => {
    it.each([
      ['is not there', {} as Record<string, string>, 'does not exist'],
      ['is not JSON', { [PATH]: '{ not json' }, 'Error parsing JSON'],
      ['holds no _id', { [PATH]: '{"a":1}' }, 'holds no _id'],
    ])(
      'is an outcome that names the path, no request is sent and the callback is told once, for a file that %s',
      async (_what, files, text) => {
        const requests = answer({ data: {} });
        const resultCallback = jest.fn();

        const outcomes = await pushKbaConfig({
          reader: readerOf(files),
          resultCallback,
          state: newState(),
        });

        expect(requests).toHaveLength(0);
        expect(outcomes).toHaveLength(1);
        expect(outcomes[0].id).toBe(PATH);
        expect(outcomes[0].error).toBeInstanceOf(FrodoError);
        expect(
          chainOf(outcomes[0].error)
            .map((error) => (error as Error).message)
            .join(' | ')
        ).toContain(text);
        expect(resultCallback).toHaveBeenCalledTimes(1);
        expect(resultCallback.mock.calls[0][0]).toBe(outcomes[0].error);
      }
    );
  });
});

describe('the methods of the facade', () => {
  /** An instance of the library, with its own state: what a caller of the facade has. */
  const instance = () => {
    const library = FrodoLib({ host: HOST, deploymentType: 'cloud' });
    library.state.setBearerTokenMeta({
      access_token: 'sample-bearer-token',
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as never);
    return library;
  };

  it('pulls with the state of the instance: one GET, and the golden file set', async () => {
    const requests = answer({ data: entity() });

    const set = await instance().idm.config.pullKbaConfig();

    expect(goldenDifferences(set, GOLDEN)).toEqual([]);
    expect(seen(requests).map(({ method, url }) => ({ method, url }))).toEqual([
      { method: 'GET', url: `${CONFIG_URL}/selfservice.kba` },
    ]);
  });

  it('pushes with the state of the instance, and hands the result callback on', async () => {
    const requests = answer({ data: { _id: 'selfservice.kba' } });
    const resultCallback = jest.fn();

    const outcomes = await instance().idm.config.pushKbaConfig(
      readerOf({ [PATH]: goldenText() }),
      resultCallback
    );

    expect(outcomes).toEqual([{ id: 'selfservice.kba' }]);
    expect(resultCallback).toHaveBeenCalledTimes(1);
    expect(seen(requests).map(({ method }) => method)).toEqual(['PUT']);
  });

  it('pushes without a result callback', async () => {
    answer({ data: { _id: 'selfservice.kba' } });

    await expect(
      instance().idm.config.pushKbaConfig(readerOf({ [PATH]: goldenText() }))
    ).resolves.toEqual([{ id: 'selfservice.kba' }]);
  });

  it('has the two methods, and nothing else that starts with pull or push', () => {
    expect(
      Object.keys(instance().idm.config).filter((name) =>
        /^(pull|push)[A-Z]/.test(name)
      )
    ).toEqual(['pullKbaConfig', 'pushKbaConfig']);
  });
});

describe('the descriptor of the type', () => {
  it('names the pull and the push as they are, and the module as the owner of the type', () => {
    expect(kbaConfigType.pull).toBe(pullKbaConfig);
    expect(kbaConfigType.push).toBe(pushKbaConfig);
  });
});

describe('the module stays pure', () => {
  const imports = importSpecifiersOf('src/ops/IdmConfigOps.ts');

  it('imports no module of the file system, the machine or other processes', () => {
    expect(imports.filter((s) => NODE_IO_MODULES.includes(s))).toEqual([]);
  });

  it('reaches the file set only through the engine and the types of the file sets', () => {
    expect(imports).toContain('./internal/FileSetEngine');
    expect(imports.filter((s) => /FileSet/.test(s)).sort()).toEqual([
      '../utils/FileSetUtils',
      './internal/FileSetEngine',
    ]);
  });
});
