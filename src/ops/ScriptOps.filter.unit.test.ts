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

const encodeScript = (lines: string[]) => Buffer.from(lines.join('\n')).toString('base64');

const makeScript = ({
  id,
  name,
  context,
  language = 'JAVASCRIPT',
  defaultScript = false,
}: {
  id: string;
  name: string;
  context: ScriptContext;
  language?: 'JAVASCRIPT' | 'GROOVY';
  defaultScript?: boolean;
}) => ({
  _id: id,
  name,
  description: `${name} description`,
  default: defaultScript,
  script: encodeScript([`// ${name}`]),
  language,
  context,
  createdBy: 'tester',
  creationDate: 0,
  lastModifiedBy: 'tester',
  lastModifiedDate: 0,
});

beforeEach(() => {
  jest.clearAllMocks();
  getLibraryScriptConfigByNameMock.mockResolvedValue({ result: [] });
  getScriptApiMock.mockResolvedValue(undefined);
  getScriptByNameApiMock.mockResolvedValue({ result: [] });
  putScriptMock.mockImplementation(async ({ scriptData }: { scriptData: any }) => scriptData);
  deleteScriptApiMock.mockImplementation(async ({ scriptId }: { scriptId: string }) => ({
    _id: scriptId,
  }));
});

describe('ScriptOps filter support unit coverage', () => {
  test('readScripts applies nested AND/OR filters', async () => {
    getScriptsMock.mockResolvedValue({
      result: [
        makeScript({
          id: 'legacy-js',
          name: 'Legacy JS',
          context: 'AUTHENTICATION_SERVER_SIDE',
        }),
        makeScript({
          id: 'journey-js',
          name: 'Journey JS',
          context: 'AUTHENTICATION_TREE_DECISION_NODE',
        }),
        makeScript({
          id: 'oauth-groovy',
          name: 'OAuth Groovy',
          context: 'OAUTH2_ACCESS_TOKEN_MODIFICATION',
          language: 'GROOVY',
        }),
      ],
    });

    const result = await ScriptOps.readScripts({
      filter: {
        operator: 'AND',
        filters: [
          { field: 'language', value: 'javascript' },
          {
            operator: 'OR',
            filters: [
              { field: 'type', value: 'legacy' },
              { field: 'use', value: 'AUTHENTICATION_TREE_DECISION_NODE' },
            ],
          },
        ],
      },
      state,
    });

    expect(result.map((script: any) => script._id).sort()).toEqual([
      'journey-js',
      'legacy-js',
    ]);
  });

  test('exportScripts respects optional filters', async () => {
    getScriptsMock.mockResolvedValue({
      result: [
        makeScript({
          id: 'legacy-js',
          name: 'Legacy JS',
          context: 'AUTHENTICATION_SERVER_SIDE',
        }),
        makeScript({
          id: 'journey-js',
          name: 'Journey JS',
          context: 'AUTHENTICATION_TREE_DECISION_NODE',
        }),
        makeScript({
          id: 'oauth-groovy',
          name: 'OAuth Groovy',
          context: 'OAUTH2_ACCESS_TOKEN_MODIFICATION',
          language: 'GROOVY',
        }),
      ],
    });

    const result = await ScriptOps.exportScripts({
      options: {
        deps: false,
        includeDefault: true,
        useStringArrays: true,
        filter: { field: 'type', value: 'nextgen' },
      },
      state,
    });

    expect(Object.values(result.script).map((script: any) => script._id).sort()).toEqual([
      'journey-js',
      'oauth-groovy',
    ]);
  });

  test('importScripts respects optional filters', async () => {
    const importData = {
      script: {
        'legacy-js': {
          ...makeScript({
            id: 'legacy-js',
            name: 'Legacy JS',
            context: 'AUTHENTICATION_SERVER_SIDE',
          }),
          script: ['// Legacy JS'],
        },
        'journey-js': {
          ...makeScript({
            id: 'journey-js',
            name: 'Journey JS',
            context: 'AUTHENTICATION_TREE_DECISION_NODE',
          }),
          script: ['// Journey JS'],
        },
        'oauth-groovy': {
          ...makeScript({
            id: 'oauth-groovy',
            name: 'OAuth Groovy',
            context: 'OAUTH2_ACCESS_TOKEN_MODIFICATION',
            language: 'GROOVY',
          }),
          script: ['// OAuth Groovy'],
        },
      },
    };

    const result = await ScriptOps.importScripts({
      scriptId: '',
      scriptName: '',
      importData,
      options: {
        deps: true,
        reUuid: false,
        includeDefault: true,
        filter: {
          operator: 'AND',
          filters: [
            { field: 'language', value: 'javascript' },
            { field: 'type', value: 'nextgen' },
          ],
        },
      },
      state,
    });

    expect(result.map((script: any) => script._id)).toEqual(['journey-js']);
    expect(putScriptMock).toHaveBeenCalledTimes(1);
    expect(putScriptMock).toHaveBeenCalledWith({
      scriptData: expect.objectContaining({
        _id: 'journey-js',
        name: 'Journey JS',
      }),
      scriptId: 'journey-js',
      state,
    });
  });

  test('deleteScripts respects filters while skipping default scripts', async () => {
    getScriptsMock.mockResolvedValue({
      result: [
        makeScript({
          id: 'legacy-js',
          name: 'Legacy JS',
          context: 'AUTHENTICATION_SERVER_SIDE',
        }),
        makeScript({
          id: 'journey-js',
          name: 'Journey JS',
          context: 'AUTHENTICATION_TREE_DECISION_NODE',
        }),
        makeScript({
          id: 'journey-default',
          name: 'Journey Default',
          context: 'AUTHENTICATION_TREE_DECISION_NODE',
          defaultScript: true,
        }),
      ],
    });

    const result = await ScriptOps.deleteScripts({
      filter: { field: 'type', value: 'nextgen' },
      state,
    });

    expect(result).toEqual([{ _id: 'journey-js' }]);
    expect(deleteScriptApiMock).toHaveBeenCalledTimes(1);
    expect(deleteScriptApiMock).toHaveBeenCalledWith({
      scriptId: 'journey-js',
      state,
    });
  });
});
