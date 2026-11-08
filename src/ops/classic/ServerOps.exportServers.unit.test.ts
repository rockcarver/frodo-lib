import { jest } from '@jest/globals';

const getServersMock = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const getServerPropertiesMock = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const getDefaultServerPropertiesMock = jest.fn(
  async (_args?: any): Promise<any> => ({ default: true })
);

jest.unstable_mockModule('../../api/classic/ServerApi', () => ({
  createServer: jest.fn(),
  getDefaultServerProperties: getDefaultServerPropertiesMock,
  getServer: jest.fn(),
  getServerProperties: getServerPropertiesMock,
  getServers: getServersMock,
  putDefaultServerProperties: jest.fn(),
  putServerProperties: jest.fn(),
}));

jest.unstable_mockModule('../../utils/Console', () => ({
  createProgressIndicator: jest.fn(() => 'progress-id'),
  debugMessage: jest.fn(),
  printMessage: jest.fn(),
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
}));

jest.unstable_mockModule('../../utils/ExportImportUtils', () => ({
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));

const { exportServers } = await import('./ServerOps');
const { FrodoError } = await import('../FrodoError');
const { stopProgressIndicator } = await import('../../utils/Console');

const state = {} as any;

const makeServers = () =>
  [1, 2, 3, 4, 5].map((n) => ({
    _id: `0${n}`,
    url: `https://server${n}.example.com:8080/am`,
    siteName: null,
  }));

beforeEach(() => {
  jest.clearAllMocks();
  getServersMock.mockResolvedValue({ result: makeServers() });
  getServerPropertiesMock.mockImplementation(async ({ serverId }: any) => ({
    _id: serverId,
    property: 'value',
  }));
  getDefaultServerPropertiesMock.mockResolvedValue({ default: true });
});

describe('exportServers', () => {
  test('exports every server with its properties when all reads succeed', async () => {
    const exportData = await exportServers({
      options: { includeDefault: false },
      state,
    });

    expect(Object.keys(exportData.server)).toEqual([
      '01',
      '02',
      '03',
      '04',
      '05',
    ]);
    expect((exportData.server['03'] as any).properties).toEqual({
      _id: '03',
      property: 'value',
    });
    expect(getServerPropertiesMock).toHaveBeenCalledTimes(5);
    expect(getDefaultServerPropertiesMock).not.toHaveBeenCalled();
  });

  test('includes the default properties when asked for', async () => {
    const exportData = await exportServers({
      options: { includeDefault: true },
      state,
    });

    expect(exportData.defaultProperties).toEqual({ default: true });
  });

  test('reads every server after one fails and throws one error naming the failed server', async () => {
    const cause = Object.assign(
      new Error('Request failed with status code 500'),
      {
        name: 'AxiosError',
      }
    );
    getServerPropertiesMock.mockImplementation(async ({ serverId }: any) => {
      if (serverId === '03') throw cause;
      return { _id: serverId };
    });

    let thrown: any;
    try {
      await exportServers({ options: { includeDefault: false }, state });
    } catch (error) {
      thrown = error;
    }

    // servers 4 and 5 are still read after server 3 failed
    expect(
      getServerPropertiesMock.mock.calls.map(([args]: any) => args.serverId)
    ).toEqual(['01', '02', '03', '04', '05']);
    expect(thrown).toBeInstanceOf(FrodoError);
    expect(thrown.message).toBe('Error exporting servers');
    expect(thrown.originalErrors).toHaveLength(1);
    expect(thrown.originalErrors[0]).toBeInstanceOf(FrodoError);
    expect(thrown.originalErrors[0].message).toBe(
      'Error exporting server https://server3.example.com:8080/am (03)'
    );
    expect(thrown.originalErrors[0].originalErrors).toEqual([cause]);
    expect(stopProgressIndicator).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'fail' })
    );
  });

  test('names every failed server when several fail', async () => {
    getServerPropertiesMock.mockImplementation(async ({ serverId }: any) => {
      if (serverId === '01' || serverId === '05') throw new Error('boom');
      return { _id: serverId };
    });

    const thrown: any = await exportServers({
      options: { includeDefault: false },
      state,
    }).catch((e) => e);

    expect(getServerPropertiesMock).toHaveBeenCalledTimes(5);
    expect(thrown.originalErrors.map((e: any) => e.message)).toEqual([
      'Error exporting server https://server1.example.com:8080/am (01)',
      'Error exporting server https://server5.example.com:8080/am (05)',
    ]);
  });

  test('names the failed default properties read next to failed servers', async () => {
    getServerPropertiesMock.mockImplementation(async ({ serverId }: any) => {
      if (serverId === '02') throw new Error('boom');
      return { _id: serverId };
    });
    getDefaultServerPropertiesMock.mockRejectedValue(new Error('no defaults'));

    const thrown: any = await exportServers({
      options: { includeDefault: true },
      state,
    }).catch((e) => e);

    expect(thrown.originalErrors.map((e: any) => e.message)).toEqual([
      'Error exporting server https://server2.example.com:8080/am (02)',
      'Error reading default server properties',
    ]);
  });

  test('throws one error and reads no properties when the servers cannot be listed', async () => {
    const cause = new Error('Request failed with status code 500');
    getServersMock.mockRejectedValue(cause);

    const thrown: any = await exportServers({
      options: { includeDefault: false },
      state,
    }).catch((e) => e);

    expect(getServerPropertiesMock).not.toHaveBeenCalled();
    expect(thrown).toBeInstanceOf(FrodoError);
    expect(thrown.message).toBe('Error reading servers');
    // the failure of the list read is wrapped once more, as it always was
    expect(thrown.originalErrors).toHaveLength(1);
    expect(thrown.originalErrors[0]).toBeInstanceOf(FrodoError);
    expect(thrown.originalErrors[0].originalErrors).toEqual([cause]);
  });
});
