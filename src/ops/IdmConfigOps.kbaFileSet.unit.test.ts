/**
 * Run tests
 *
 *        npm run test:only -- src/ops/IdmConfigOps.kbaFileSet
 *
 * What is true of the KBA configuration (the config entity `selfservice.kba`) as a file set, and of nothing else. What every
 * type of its shape has to do (the golden folder, the refusals of the merge, the requests, the outcomes, a file that names
 * another id) is in the shared suite, `ConfigTypeRegistry.singletons.unit.test.ts`, which has a row for this type. Here:
 *
 * - The file that the pull gives is the file that the command line writes today (`saveJsonToFile`, which the command line
 *   calls), byte for byte, for the entity of the recorded run of the command line and for an entity without `${`; the entity
 *   of the golden folder has numeric keys, French and Japanese text and a `${`, which are the rules of the file.
 * - The pull sends the one request of the recorded runs and of `readConfigEntity`, and reads the entity as it is (an export
 *   would put `${NAME}` back for a value of the state). The push sends the one PUT of the recorded runs and of
 *   `importConfigEntities` after the command line has read the file with `readJsonFile`.
 * - A file whose `_id` is another than `selfservice.kba` sends nothing, whatever the id says: the three ids that a request
 *   would have resolved to another path are named.
 * - The methods of the facade use the state of their instance, and the descriptor says what the type is.
 *
 * Hermetic: made-up data, no tenant, no recording; the one folder that is written is a temporary folder that the test
 * removes. The sample host is `https://openam-matrix.example.com/am`.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';
import { type IdObjectSkeletonInterface } from '../api/ApiTypes';
import { FrodoLib } from '../lib/FrodoLib';
import {
  importSpecifiersOf,
  NODE_IO_MODULES,
} from '../test/exportFileFormat/importsOf';
import { goldenDifferences } from '../test/utils/FileSetGolden';
import {
  answer,
  chainOf,
  countingReader,
  HOST,
  newState,
  readerOf,
  restoreAdapter,
  ROUND_TRIP_TEXTS,
  seen,
} from '../test/utils/FileSetTestKit';
import { readJsonFile, saveJsonToFile } from '../utils/ExportImportUtils';
import { createMemoryFileSetReader } from '../utils/FileSetUtils';
import { FrodoError } from './FrodoError';
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

afterEach(restoreAdapter);

const GOLDEN = fileURLToPath(new URL('../test/golden/kba', import.meta.url));
const GOLDEN_FILE = join(GOLDEN, 'files/kba/selfservice.kba.json');
const PATH = 'kba/selfservice.kba.json';
const CONFIG_URL = 'https://openam-matrix.example.com/openidm/config';

/** The entity as the tenant has it: a revision, a date of the last change, a French and a Japanese text, keys out of order. */
const entity = (): IdObjectSkeletonInterface =>
  JSON.parse(readFileSync(join(GOLDEN, 'entity.json'), 'utf8'));

/** The text of the golden file, which the pull of `entity.json` gives. */
const goldenText = (): string => readFileSync(GOLDEN_FILE, 'utf8');

/** The golden file with another id. */
const goldenWithId = (id: string): string =>
  goldenText().replace('"_id": "selfservice.kba"', `"_id": "${id}"`);

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

/** The entity that the recorded `pull kba` run of the command line got from the tenant: one question, 206 bytes written. */
const RECORDED_ENTITY = {
  _id: 'selfservice.kba',
  kbaPropertyName: 'kbaInfo',
  minimumAnswersToDefine: 1,
  minimumAnswersToVerify: 1,
  questions: { '1': { en: "What's your favorite color?" } },
};

/** What the command line writes for an entity: the library function that its `pull kba` calls. */
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
  it('writes the keys in order; the keys that are numbers come in the order of their value', () => {
    const { content } = splitKbaConfig(entity()).files[0];

    expect(Object.keys(JSON.parse(content))).toEqual([
      '_id',
      'createDate',
      'kbaPropertyName',
      'minimumAnswersToDefine',
      'minimumAnswersToVerify',
      'questions',
    ]);
    // a JavaScript object lists the keys `1`, `2`, `3`, `4` and `10` in the order of their value, and the file of the command line does too
    expect(Object.keys(JSON.parse(content).questions)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '10',
    ]);
    expect(content.startsWith('{\n  "_id": "selfservice.kba",\n')).toBe(true);
  });

  it('keeps `createDate`, which is not one of the ten modified properties, and takes `modifiedDate` out of a question', () => {
    const written = JSON.parse(splitKbaConfig(entity()).files[0].content);

    expect(written.createDate).toBe('2026-01-15T10:00:00.000Z');
    expect(written.questions['10'].modifiedDate).toBeUndefined();
  });

  it('writes the French and the Japanese text as UTF-8, `é` in two bytes and each Japanese letter in three', () => {
    const { content } = splitKbaConfig(entity()).files[0];

    expect(content).toContain('Quelle est votre couleur préférée?');
    expect(content).toContain('あなたの好きな色は何ですか？');
    expect(Buffer.byteLength(content, 'utf8')).toBeGreaterThan(content.length);
  });

  it('escapes the `${` of a question, so that a push does not take it for a placeholder', () => {
    const { content } = splitKbaConfig(entity()).files[0];

    expect(content).toContain('\\\\${notAPlaceholder}');
  });

  describe('against the file that the command line writes', () => {
    it('gives, for the entity of the recorded `pull kba` run, the 206 bytes that the command line writes for it', () => {
      const { content } = splitKbaConfig(RECORDED_ENTITY).files[0];

      expect(Buffer.byteLength(content, 'utf8')).toBe(206);
      expect(content).toBe(writtenByTheCommandLine(RECORDED_ENTITY));
    });

    it('gives the file of the fixture of the `push kba` run, 413 bytes, from the entity that the file holds (the split is a fixed point of the file)', () => {
      const { content } = splitKbaConfig(JSON.parse(CLI_FIXTURE)).files[0];

      expect(Buffer.byteLength(content, 'utf8')).toBe(413);
      expect(content).toBe(CLI_FIXTURE);
      expect(content).toBe(writtenByTheCommandLine(JSON.parse(CLI_FIXTURE)));
    });

    it('gives the file that the command line writes for an entity that has a revision and modified properties, and no `${`', () => {
      const given = JSON.parse(
        JSON.stringify(entity()).replace(
          '${notAPlaceholder}',
          'notAPlaceholder'
        )
      );

      expect(splitKbaConfig(given).files[0].content).toBe(
        writtenByTheCommandLine(JSON.parse(JSON.stringify(given)))
      );
    });
  });
});

describe('mergeKbaConfig', () => {
  it('gives what an import takes: the entity under its id, with its `${` as text again', async () => {
    const merged = await mergeKbaConfig({
      reader: readerOf({ [PATH]: goldenText() }),
      state: newState(),
    });

    expect(Object.keys(merged)).toEqual(['idm']);
    expect(Object.keys(merged.idm)).toEqual(['selfservice.kba']);
    expect(merged.idm['selfservice.kba'].questions).toMatchObject({
      '3': { en: 'Which word, ${notAPlaceholder}, do you remember?' },
    });
    expect(merged.idm['selfservice.kba']._rev).toBeUndefined();
  });

  it('fills a placeholder with the value that the state holds', async () => {
    const state = newState();
    state.setEnv('KBA_PROPERTY', 'kbaInfoFromState');
    const text = JSON.stringify({
      _id: 'selfservice.kba',
      kbaPropertyName: '${KBA_PROPERTY}',
    });

    const merged = await mergeKbaConfig({
      reader: readerOf({ [PATH]: text }),
      state,
    });

    expect(merged.idm['selfservice.kba'].kbaPropertyName).toBe(
      'kbaInfoFromState'
    );
  });

  it.each(['..', '../managed/alpha_user', '../../am/json/realms/root/users/x'])(
    'refuses the id %j, which a request would have resolved to another path',
    async (foreign) => {
      await expect(
        mergeKbaConfig({
          reader: readerOf({ [PATH]: goldenWithId(foreign) }),
          state: newState(),
        })
      ).rejects.toThrow(
        `The file ${PATH} does not hold the id of this type, "selfservice.kba".`
      );
    }
  );
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

  it('gives the golden file set for the entity that the tenant answers with', async () => {
    answer({ data: entity() });

    expect(
      goldenDifferences(await pullKbaConfig({ state: newState() }), GOLDEN)
    ).toEqual([]);
  });

  it('rejects with the error of the read as it is, one level: the message names the entity and the cause is the answer of the tenant', async () => {
    answer({
      status: 404,
      data: { code: 404, reason: 'Not Found', message: 'No configuration' },
    });

    const error = await pullKbaConfig({ state: newState() }).catch((e) => e);

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error reading config entity selfservice.kba');
    expect(error.originalErrors).toHaveLength(1);
    expect(
      (error.originalErrors[0] as { response?: { status?: number } }).response
        ?.status
    ).toBe(404);
  });
});

describe('pushKbaConfig', () => {
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
    await pushKbaConfig({
      reader: readerOf({ [PATH]: goldenText() }),
      state: newState(),
    });

    expect(seen(requests)).toEqual(expected);
  });

  it('pushes what a pull gave: the entity without the revision and the modified properties', async () => {
    answer({ data: entity() });
    const set = await pullKbaConfig({ state: newState() });
    const requests = answer({ data: {} });

    await pushKbaConfig({
      reader: createMemoryFileSetReader(set),
      state: newState(),
    });

    const sent = JSON.parse(String(seen(requests)[0].data));
    expect(sent._rev).toBeUndefined();
    expect(sent.lastChanged).toBeUndefined();
    expect(sent.kbaPropertyName).toBe('kbaInfo');
    expect(sent.questions['3'].en).toBe(
      'Which word, ${notAPlaceholder}, do you remember?'
    );
  });

  it.each(['..', '../managed/alpha_user', '../../am/json/realms/root/users/x'])(
    'sends nothing for a file that holds the id %j: the library does not send a request to another path',
    async (foreign) => {
      const requests = answer({ data: {} });

      const outcomes = await pushKbaConfig({
        reader: readerOf({ [PATH]: goldenWithId(foreign) }),
        state: newState(),
      });

      expect(requests).toHaveLength(0);
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].id).toBe(PATH);
      expect(
        chainOf(outcomes[0].error)
          .map((error) => (error as Error).message)
          .join(' | ')
      ).toContain(
        `The file ${PATH} does not hold the id of this type, "selfservice.kba".`
      );
    }
  );

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
});

describe('a pull then a push of the texts that hold `${`', () => {
  // the entity of the tenant goes through the pull, the file and the push: what the tenant is sent is what it had, whether or
  // not a complete `${NAME}` is in the text, in the line or anywhere in the file
  it.each(ROUND_TRIP_TEXTS)(
    'sends the text back as it was: $name',
    async ({ text, state: values, afterImport }) => {
      const state = newState();
      for (const [name, value] of Object.entries(values ?? {})) {
        state.setEnv(name, value);
      }
      const given = {
        _id: 'selfservice.kba',
        _rev: '1-a',
        kbaPropertyName: 'kbaInfo',
        questions: { '1': { en: text, [`key ${text}`]: text } },
      };
      answer({ data: JSON.parse(JSON.stringify(given)) });
      const set = await pullKbaConfig({ state });
      const requests = answer({ data: {} });

      const outcomes = await pushKbaConfig({
        reader: createMemoryFileSetReader(set),
        state,
      });

      expect(outcomes).toEqual([{ id: 'selfservice.kba' }]);
      const sent = JSON.parse(String(seen(requests)[0].data));
      const { _rev, ...expected } = given;
      expect(_rev).toBe('1-a');
      // the import fills `${NAME}` again for a name that the state holds, which is all that may differ
      const after = (value: string): string =>
        afterImport === undefined ? value : afterImport;
      expect(sent).toEqual({
        ...expected,
        questions: {
          '1': { en: after(text), [`key ${after(text)}`]: after(text) },
        },
      });
    }
  );
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
  it('names the pull and the push as they are', () => {
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
    expect(imports.filter((s) => /FileSet/.test(s)).sort()).toEqual([
      '../utils/FileSetUtils',
      './internal/FileSetEngine',
    ]);
  });
});
