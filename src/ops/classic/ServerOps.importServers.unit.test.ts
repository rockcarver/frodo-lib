import { jest } from '@jest/globals';

/**
 * `importServers` imports every server, then the default properties. When the
 * import of the default properties fails after servers failed, the error that is
 * thrown carries the errors of the servers too, not only its own.
 * Mocked unit test: no recordings.
 */

const createServer = jest.fn(async (_args?: any): Promise<any> => ({}));
const putServerProperties = jest.fn(async (_args?: any): Promise<any> => ({}));
const putDefaultServerProperties = jest.fn(
  async (_args?: any): Promise<any> => ({})
);

const actualApi = await import('../../api/classic/ServerApi');
jest.unstable_mockModule('../../api/classic/ServerApi', () => ({
  ...actualApi,
  createServer,
  putServerProperties,
  putDefaultServerProperties,
}));

const actualConsole = await import('../../utils/Console');
jest.unstable_mockModule('../../utils/Console', () => ({
  ...actualConsole,
  debugMessage: jest.fn(),
}));

const actualExportImportUtils = await import('../../utils/ExportImportUtils');
jest.unstable_mockModule('../../utils/ExportImportUtils', () => ({
  ...actualExportImportUtils,
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));

const { importServers } = await import('./ServerOps');

const state = {
  getRealm: () => 'alpha',
  getDeploymentType: () => 'classic',
} as any;

/** The messages of an error and of everything nested in it. */
function messagesOf(error: any): string {
  return [error?.message, ...(error?.originalErrors ?? []).map(messagesOf)]
    .filter(Boolean)
    .join(' | ');
}

const importData = (): any => ({
  server: {
    '01': { _id: '01', url: 'http://am1.example.com/am', properties: { a: 1 } },
    '02': { _id: '02', url: 'http://am2.example.com/am', properties: { b: 2 } },
  },
  defaultProperties: { c: 3 },
});

beforeEach(() => {
  jest.clearAllMocks();
  createServer.mockReset();
  createServer.mockImplementation(async ({ serverData }: any) => ({
    ...serverData,
  }));
  putServerProperties.mockReset();
  putServerProperties.mockImplementation(
    async ({ serverPropertiesData }: any) => ({ ...serverPropertiesData })
  );
  putDefaultServerProperties.mockReset();
  putDefaultServerProperties.mockImplementation(
    async ({ defaultServerPropertiesData }: any) => ({
      ...defaultServerPropertiesData,
    })
  );
});

describe('importServers', () => {
  test('imports the servers and the default properties', async () => {
    const response = await importServers({
      importData: importData(),
      options: { includeDefault: true },
      state,
    });

    expect(Object.keys(response.server)).toEqual(['01', '02']);
    expect(response.defaultProperties).toEqual({ c: 3 });
  });

  test('a server that cannot be created is named in the error', async () => {
    createServer.mockImplementation(async ({ serverData }: any) => {
      if (serverData._id === '02') throw new Error('HTTP 500');
      return { ...serverData };
    });

    const error: any = await importServers({
      importData: importData(),
      options: { includeDefault: false },
      state,
    }).catch((e) => e);

    expect(error.originalErrors).toHaveLength(1);
    expect(messagesOf(error)).toContain("id '02'");
    expect(messagesOf(error)).toContain('HTTP 500');
  });

  test('the error of the default properties does not hide the errors of the servers', async () => {
    createServer.mockImplementation(async ({ serverData }: any) => {
      if (serverData._id === '02') throw new Error('server 02: HTTP 500');
      return { ...serverData };
    });
    putDefaultServerProperties.mockImplementation(async () => {
      throw new Error('default properties: HTTP 400');
    });

    const error: any = await importServers({
      importData: importData(),
      options: { includeDefault: true },
      state,
    }).catch((e) => e);

    expect(error.originalErrors).toHaveLength(2);
    expect(messagesOf(error)).toContain("id '02'");
    expect(messagesOf(error)).toContain('server 02: HTTP 500');
    expect(messagesOf(error)).toContain('default properties');
    expect(messagesOf(error)).toContain('default properties: HTTP 400');
  });

  test('the error of the default properties alone is reported', async () => {
    putDefaultServerProperties.mockImplementation(async () => {
      throw new Error('default properties: HTTP 400');
    });

    const error: any = await importServers({
      importData: importData(),
      options: { includeDefault: true },
      state,
    }).catch((e) => e);

    expect(error.originalErrors).toHaveLength(1);
    expect(messagesOf(error)).toContain('default properties: HTTP 400');
  });
});
