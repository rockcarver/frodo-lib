import { jest } from '@jest/globals';

import type { ScriptContext } from '../api/ScriptApi';

const deleteScriptApiMock: any = jest.fn();
const getLibraryScriptConfigByNameMock: any = jest.fn();
const getScriptApiMock: any = jest.fn();
const getScriptByNameApiMock: any = jest.fn();
const getScriptsMock: any = jest.fn();
const putScriptMock: any = jest.fn();

jest.unstable_mockModule('../api/ScriptApi', () => ({
  deleteScript: deleteScriptApiMock,
  deleteScriptByName: jest.fn(),
  getLibraryScriptConfigByName: getLibraryScriptConfigByNameMock,
  getScript: getScriptApiMock,
  getScriptByName: getScriptByNameApiMock,
  getScripts: getScriptsMock,
  putScript: putScriptMock,
}));

const ScriptOps = await import('./ScriptOps');

const state = {
  getAmVersion: () => '7.5.0',
  getCreateProgressHandler: () => undefined,
  getDebugHandler: () => undefined,
  getFrodoVersion: () => '4.0.0-test',
  getHost: () => 'https://example.com',
  getRealm: () => '/',
  getStopProgressHandler: () => undefined,
  getUpdateProgressHandler: () => undefined,
  getUsername: () => 'tester',
} as any;

const encodeScript = (lines: string[]) =>
  Buffer.from(lines.join('\n')).toString('base64');

const makeScript = ({
  id,
  name,
  context,
  language = 'JAVASCRIPT',
  evaluatorVersion,
  defaultScript = false,
  scriptLines,
}: {
  id: string;
  name: string;
  context: ScriptContext;
  language?: 'JAVASCRIPT' | 'GROOVY';
  evaluatorVersion?: string;
  defaultScript?: boolean;
  scriptLines?: string[];
}) => ({
  _id: id,
  name,
  description: `${name} description`,
  default: defaultScript,
  script: encodeScript(scriptLines ?? [`// ${name}`]),
  language,
  context,
  ...(evaluatorVersion ? { evaluatorVersion } : {}),
  createdBy: 'tester',
  creationDate: 0,
  lastModifiedBy: 'tester',
  lastModifiedDate: 0,
});

beforeEach(() => {
  jest.clearAllMocks();
  getLibraryScriptConfigByNameMock.mockResolvedValue({ result: [] });
  putScriptMock.mockImplementation(
    async ({ scriptData }: { scriptData: any }) => scriptData
  );
});

describe('ScriptOps source sister functions', () => {
  test('readScriptSource returns decoded plain-text source, not the wrapper object', async () => {
    getScriptApiMock.mockResolvedValue(
      makeScript({
        id: 'script-1',
        name: 'Script One',
        context: 'AUTHENTICATION_TREE_DECISION_NODE',
        scriptLines: ['var a = 1;', 'var b = 2;'],
      })
    );

    const source = await ScriptOps.readScriptSource({
      scriptId: 'script-1',
      state,
    });

    expect(source).toBe('var a = 1;\nvar b = 2;');
    expect(getScriptApiMock).toHaveBeenCalledWith({
      scriptId: 'script-1',
      state,
    });
  });

  test('readScriptSourceByName resolves by name and returns decoded source', async () => {
    getScriptByNameApiMock.mockResolvedValue({
      result: [
        makeScript({
          id: 'script-2',
          name: 'Script Two',
          context: 'AUTHENTICATION_TREE_DECISION_NODE',
          scriptLines: ['return true;'],
        }),
      ],
    });

    const source = await ScriptOps.readScriptSourceByName({
      scriptName: 'Script Two',
      state,
    });

    expect(source).toBe('return true;');
  });

  test('updateScriptSource preserves all metadata and only replaces the script body', async () => {
    getScriptApiMock.mockResolvedValue(
      makeScript({
        id: 'script-3',
        name: 'Script Three',
        context: 'AUTHENTICATION_TREE_DECISION_NODE',
        evaluatorVersion: '2.0',
        scriptLines: ['old source'],
      })
    );

    const updated = await ScriptOps.updateScriptSource({
      scriptId: 'script-3',
      source: 'new source',
      state,
    });

    expect(putScriptMock).toHaveBeenCalledTimes(1);
    const [{ scriptData }] = putScriptMock.mock.calls[0] as [
      { scriptData: any },
    ];
    expect(scriptData.name).toBe('Script Three');
    expect(scriptData.context).toBe('AUTHENTICATION_TREE_DECISION_NODE');
    expect(scriptData.evaluatorVersion).toBe('2.0');
    expect(Buffer.from(scriptData.script, 'base64').toString('utf-8')).toBe(
      'new source'
    );
    expect(updated.name).toBe('Script Three');
  });

  test('listScripts strips script bodies and returns only lightweight fields', async () => {
    getScriptsMock.mockResolvedValue({
      result: [
        makeScript({
          id: 'script-4',
          name: 'Script Four',
          context: 'AUTHENTICATION_TREE_DECISION_NODE',
          evaluatorVersion: '2.0',
          scriptLines: ['a very large script body'.repeat(1000)],
        }),
        makeScript({
          id: 'script-5',
          name: 'Script Five',
          context: 'OAUTH2_ACCESS_TOKEN_MODIFICATION',
          language: 'GROOVY',
        }),
      ],
    });

    const summaries = await ScriptOps.listScripts({ state });

    expect(summaries).toEqual([
      {
        _id: 'script-4',
        name: 'Script Four',
        context: 'AUTHENTICATION_TREE_DECISION_NODE',
        language: 'JAVASCRIPT',
        evaluatorVersion: '2.0',
        default: false,
      },
      {
        _id: 'script-5',
        name: 'Script Five',
        context: 'OAUTH2_ACCESS_TOKEN_MODIFICATION',
        language: 'GROOVY',
        evaluatorVersion: undefined,
        default: false,
      },
    ]);
    // The whole point of listScripts: no summary entry carries a script body.
    for (const summary of summaries) {
      expect((summary as Record<string, unknown>).script).toBeUndefined();
    }
  });

  test('listScripts applies the same ScriptFilter semantics as readScripts', async () => {
    getScriptsMock.mockResolvedValue({
      result: [
        makeScript({
          id: 'script-6',
          name: 'Legacy JS',
          context: 'AUTHENTICATION_SERVER_SIDE',
        }),
        makeScript({
          id: 'script-7',
          name: 'Journey JS',
          context: 'AUTHENTICATION_TREE_DECISION_NODE',
        }),
      ],
    });

    const summaries = await ScriptOps.listScripts({
      filter: {
        field: 'context',
        value: 'AUTHENTICATION_TREE_DECISION_NODE',
      },
      state,
    });

    expect(summaries.map((s) => s._id)).toEqual(['script-7']);
  });
});
