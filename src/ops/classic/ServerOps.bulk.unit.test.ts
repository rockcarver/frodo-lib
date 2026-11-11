import { jest } from '@jest/globals';

/**
 * `exportServers` and `importServers` take an optional result callback (frodo-lib#957). With
 * it, the outcome of every server is passed to it once, as it happens: a server that was
 * exported or imported as the server, a server that failed as an error that names its url and
 * id and carries the cause. A failed server does not stop the others, is left out of the export
 * or of the result, and the function does not throw for it. The default properties, when they
 * are asked for, are not a server: they are reported only when they fail. Failing to list the
 * servers still throws. Without a callback nothing changes: one combined error is thrown after
 * every server was tried.
 * Mocked unit test: no recordings.
 */

const getServers = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const getServerProperties = jest.fn(async (args?: any): Promise<any> => ({
  general: { id: args.serverId },
}));
const getDefaultServerProperties = jest.fn(
  async (_args?: any): Promise<any> => ({ general: { default: true } })
);
const createServer = jest.fn(async (args?: any): Promise<any> => ({
  ...args.serverData,
}));
const putServerProperties = jest.fn(async (args?: any): Promise<any> => ({
  ...args.serverPropertiesData,
}));
const putDefaultServerProperties = jest.fn(
  async (args?: any): Promise<any> => ({
    ...args.defaultServerPropertiesData,
  })
);
// the actual module is not loaded first: its imports may reach ServerOps, which would then keep the real API
jest.unstable_mockModule('../../api/classic/ServerApi', () => ({
  getServer: jest.fn(),
  getServers,
  getServerProperties,
  getDefaultServerProperties,
  createServer,
  putServerProperties,
  putDefaultServerProperties,
}));

const createProgressIndicator = jest.fn(() => 'progress-id');
const stopProgressIndicator = jest.fn();
const actualConsole = await import('../../utils/Console');
jest.unstable_mockModule('../../utils/Console', () => ({
  ...actualConsole,
  createProgressIndicator,
  stopProgressIndicator,
  updateProgressIndicator: jest.fn(),
  debugMessage: jest.fn(),
}));

const {
  default: ServerOps,
  exportServers,
  importServers,
} = await import('./ServerOps');
const { default: State } = await import('../../shared/State');

const state = State({});
state.setRealm('alpha');

const server = (id: string): any => ({
  _id: id,
  url: `https://${id}.example.com/am`,
  siteName: 'site',
});

const servers = () => [server('01'), server('02'), server('03')];

/** The messages of an error and of everything nested in it. */
function messagesOf(error: any): string {
  return [error?.message, ...(error?.originalErrors ?? []).map(messagesOf)]
    .filter(Boolean)
    .join(' | ');
}

type Outcome = { error?: any; result?: any };
let outcomes: Outcome[];
const callback = (error?: any, result?: any) =>
  outcomes.push({ error, result });

const NO_DEFAULT = { includeDefault: false };
const WITH_DEFAULT = { includeDefault: true };

beforeEach(() => {
  outcomes = [];
  for (const mock of [
    getServers,
    getServerProperties,
    getDefaultServerProperties,
    createServer,
    putServerProperties,
    putDefaultServerProperties,
    createProgressIndicator,
    stopProgressIndicator,
  ]) {
    mock.mockClear();
  }
  getServers.mockImplementation(async () => ({ result: servers() }));
  getServerProperties.mockImplementation(async (args: any) => ({
    general: { id: args.serverId },
  }));
  getDefaultServerProperties.mockImplementation(async () => ({
    general: { default: true },
  }));
  createServer.mockImplementation(async (args: any) => ({
    ...args.serverData,
  }));
  putServerProperties.mockImplementation(async (args: any) => ({
    ...args.serverPropertiesData,
  }));
  putDefaultServerProperties.mockImplementation(async (args: any) => ({
    ...args.defaultServerPropertiesData,
  }));
});

describe('exportServers', () => {
  test('without a callback: exports every server with its properties and the default properties', async () => {
    const exportData = await exportServers({ options: WITH_DEFAULT, state });

    expect(Object.keys(exportData.server)).toEqual(['01', '02', '03']);
    expect(exportData.server['02'].properties).toEqual({
      general: { id: '02' },
    });
    expect(exportData.defaultProperties).toEqual({
      general: { default: true },
    });
  });

  test('with a callback: reports every server once, in order, and exports the same as without', async () => {
    const plain = await exportServers({ options: WITH_DEFAULT, state });
    getServers.mockImplementation(async () => ({ result: servers() }));

    const exportData = await exportServers({
      options: WITH_DEFAULT,
      resultCallback: callback,
      state,
    });

    expect(exportData.server).toEqual(plain.server);
    expect(exportData.defaultProperties).toEqual(plain.defaultProperties);
    expect(outcomes.map((o) => o.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map((o) => o.result?._id)).toEqual(['01', '02', '03']);
  });

  test('with a callback: a server whose properties cannot be read is a failed item that names its url and id, the others are exported', async () => {
    getServerProperties.mockImplementation(async (args: any) => {
      if (args.serverId === '02') throw new Error('server 02: HTTP 500');
      return { general: { id: args.serverId } };
    });

    const exportData = await exportServers({
      options: NO_DEFAULT,
      resultCallback: callback,
      state,
    });

    expect(Object.keys(exportData.server)).toEqual(['01', '03']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].result._id).toBe('01');
    expect(outcomes[2].result._id).toBe('03');
    expect(outcomes[1].result).toBeUndefined();
    expect(outcomes[1].error.message).toBe(
      'Error exporting server https://02.example.com/am (02)'
    );
    expect(outcomes[1].error.originalErrors).toHaveLength(1);
    expect(messagesOf(outcomes[1].error)).toContain('server 02: HTTP 500');
  });

  test('with a callback: every server failing reports every server and returns an export without servers, without throwing', async () => {
    getServerProperties.mockRejectedValue(new Error('HTTP 500'));

    const exportData = await exportServers({
      options: NO_DEFAULT,
      resultCallback: callback,
      state,
    });

    expect(exportData.server).toEqual({});
    expect(outcomes).toHaveLength(3);
    expect(outcomes.every((o) => o.error && !o.result)).toBe(true);
  });

  test('with a callback: default properties that cannot be read are reported as one error that names them, the servers are still exported', async () => {
    getDefaultServerProperties.mockRejectedValue(
      new Error('defaults: HTTP 500')
    );

    const exportData = await exportServers({
      options: WITH_DEFAULT,
      resultCallback: callback,
      state,
    });

    expect(Object.keys(exportData.server)).toEqual(['01', '02', '03']);
    expect(exportData.defaultProperties).toEqual({});
    // three servers and the failed default properties, each once; the default properties are not reported when they succeed
    expect(outcomes).toHaveLength(4);
    expect(outcomes.slice(0, 3).every((o) => !o.error)).toBe(true);
    expect(outcomes[3].error.message).toBe(
      'Error reading default server properties'
    );
    expect(messagesOf(outcomes[3].error)).toContain('defaults: HTTP 500');
  });

  test('with a callback: the progress indicator ends as a failure that says how many servers were exported', async () => {
    getServerProperties.mockImplementation(async (args: any) => {
      if (args.serverId === '03') throw new Error('HTTP 500');
      return { general: {} };
    });

    await exportServers({
      options: NO_DEFAULT,
      resultCallback: callback,
      state,
    });

    expect(stopProgressIndicator).toHaveBeenCalledTimes(1);
    const arg: any = stopProgressIndicator.mock.calls[0][0];
    expect(arg.status).toBe('fail');
    expect(arg.message).toBe('Exported 2 of 3 servers.');
  });

  test('with a callback: failing to list the servers still throws and reports nothing', async () => {
    getServers.mockRejectedValue(new Error('list: HTTP 500'));

    const error: any = await exportServers({
      options: NO_DEFAULT,
      resultCallback: callback,
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error reading servers');
    expect(messagesOf(error)).toContain('list: HTTP 500');
    expect(outcomes).toEqual([]);
  });

  test('without a callback: the failures are thrown as one combined error after every server was tried', async () => {
    getServerProperties.mockImplementation(async (args: any) => {
      if (args.serverId === '02') throw new Error('server 02: HTTP 500');
      return { general: {} };
    });

    const error: any = await exportServers({
      options: NO_DEFAULT,
      state,
    }).catch((e) => e);

    // unchanged: the combined error with the named error of the failed server nested
    expect(error.message).toBe('Error exporting servers');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      'Error exporting server https://02.example.com/am (02)'
    );
    expect(getServerProperties).toHaveBeenCalledTimes(3);
    expect(stopProgressIndicator.mock.calls[0][0]).toMatchObject({
      status: 'fail',
      message: 'Error exporting servers.',
    });
  });

  test('without a callback: the error of the default properties is thrown next to the errors of the servers', async () => {
    getServerProperties.mockRejectedValue(new Error('server: HTTP 500'));
    getDefaultServerProperties.mockRejectedValue(
      new Error('defaults: HTTP 500')
    );

    const error: any = await exportServers({
      options: WITH_DEFAULT,
      state,
    }).catch((e) => e);

    expect(error.originalErrors).toHaveLength(4);
    expect(error.originalErrors[3].message).toBe(
      'Error reading default server properties'
    );
  });

  test('the facade passes the callback on', async () => {
    await ServerOps(state).exportServers(NO_DEFAULT, callback);

    expect(outcomes.map((o) => o.result?._id)).toEqual(['01', '02', '03']);
  });
});

describe('importServers', () => {
  const importData = (): any => ({
    server: {
      '01': { ...server('01'), properties: { a: 1 } },
      '02': { ...server('02'), properties: { b: 2 } },
      '03': { ...server('03'), properties: { c: 3 } },
    },
    defaultProperties: { d: 4 },
  });
  /** Writing the properties of server 02 fails. */
  const failServer02 = () =>
    putServerProperties.mockImplementation(async (args: any) => {
      if (args.serverId === '02') throw new Error('server 02: HTTP 500');
      return { ...args.serverPropertiesData };
    });

  test('without a callback: imports every server and the default properties', async () => {
    const response = await importServers({
      importData: importData(),
      options: WITH_DEFAULT,
      state,
    });

    expect(Object.keys(response.server)).toEqual(['01', '02', '03']);
    expect(response.defaultProperties).toEqual({ d: 4 });
  });

  test('with a callback: reports every server once, in order, and returns the same as without', async () => {
    const plain = await importServers({
      importData: importData(),
      options: WITH_DEFAULT,
      state,
    });

    const response = await importServers({
      importData: importData(),
      options: WITH_DEFAULT,
      resultCallback: callback,
      state,
    });

    expect(response).toEqual(plain);
    expect(outcomes.map((o) => o.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map((o) => o.result?._id)).toEqual(['01', '02', '03']);
    expect(outcomes[0].result.properties).toEqual({ a: 1 });
  });

  test('with a callback: a server that cannot be written is a failed item that names its url and id, the others are imported, the function does not throw', async () => {
    failServer02();

    const response = await importServers({
      importData: importData(),
      options: NO_DEFAULT,
      resultCallback: callback,
      state,
    });

    expect(Object.keys(response.server)).toEqual(['01', '03']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].result._id).toBe('01');
    expect(outcomes[2].result._id).toBe('03');
    expect(outcomes[1].result).toBeUndefined();
    expect(outcomes[1].error.message).toBe(
      'Error importing server https://02.example.com/am (02)'
    );
    expect(messagesOf(outcomes[1].error)).toContain('server 02: HTTP 500');
    expect(putServerProperties).toHaveBeenCalledTimes(3);
  });

  test('with a callback: a server that cannot be created is named, with the cause nested', async () => {
    createServer.mockImplementation(async (args: any) => {
      if (args.serverData._id === '01') throw new Error('create 01: HTTP 500');
      return { ...args.serverData };
    });

    await importServers({
      importData: importData(),
      options: NO_DEFAULT,
      resultCallback: callback,
      state,
    });

    expect(outcomes[0].error.message).toBe(
      'Error importing server https://01.example.com/am (01)'
    );
    expect(messagesOf(outcomes[0].error)).toContain('create 01: HTTP 500');
    expect(messagesOf(outcomes[0].error)).toContain("id '01'");
  });

  test('with a callback: a server that exists already is imported', async () => {
    createServer.mockImplementation(async () => {
      throw Object.assign(new Error('exists'), {
        response: { status: 400, data: { message: 'Update not supported' } },
      });
    });

    const response = await importServers({
      importData: importData(),
      options: NO_DEFAULT,
      resultCallback: callback,
      state,
    });

    expect(Object.keys(response.server)).toEqual(['01', '02', '03']);
    expect(outcomes.every((o) => !o.error)).toBe(true);
  });

  test('with a callback: only the server of the given id is reported', async () => {
    await importServers({
      serverId: '02',
      importData: importData(),
      options: NO_DEFAULT,
      resultCallback: callback,
      state,
    });

    expect(outcomes.map((o) => o.result?._id)).toEqual(['02']);
    expect(createServer).toHaveBeenCalledTimes(1);
  });

  test('with a callback: every server failing reports every server, returns an empty result and does not throw', async () => {
    putServerProperties.mockRejectedValue(new Error('HTTP 500'));

    const response = await importServers({
      importData: importData(),
      options: NO_DEFAULT,
      resultCallback: callback,
      state,
    });

    expect(response.server).toEqual({});
    expect(outcomes).toHaveLength(3);
    expect(outcomes.every((o) => o.error && !o.result)).toBe(true);
  });

  test('with a callback: default properties that cannot be imported are reported as one error that names them, the servers are still imported', async () => {
    putDefaultServerProperties.mockRejectedValue(
      new Error('defaults: HTTP 400')
    );

    const response = await importServers({
      importData: importData(),
      options: WITH_DEFAULT,
      resultCallback: callback,
      state,
    });

    expect(Object.keys(response.server)).toEqual(['01', '02', '03']);
    expect(response.defaultProperties).toEqual({});
    expect(outcomes).toHaveLength(4);
    expect(outcomes.slice(0, 3).every((o) => !o.error)).toBe(true);
    expect(outcomes[3].error.message).toBe(
      'Error importing default server properties'
    );
    expect(messagesOf(outcomes[3].error)).toContain('defaults: HTTP 400');
  });

  test('without a callback: the failures are thrown as one combined error after every server was tried', async () => {
    failServer02();
    putDefaultServerProperties.mockRejectedValue(
      new Error('defaults: HTTP 400')
    );

    const error: any = await importServers({
      importData: importData(),
      options: WITH_DEFAULT,
      state,
    }).catch((e) => e);

    // unchanged: the raw error of the server and the named error of the default properties
    expect(error.message).toBe('Error importing servers');
    expect(error.originalErrors).toHaveLength(2);
    expect(error.originalErrors[0].message).toBe('server 02: HTTP 500');
    expect(error.originalErrors[1].message).toBe(
      'Error importing default server properties'
    );
    expect(putServerProperties).toHaveBeenCalledTimes(3);
  });

  test('the facade passes the callback on, after the server id and url', async () => {
    await ServerOps(state).importServers(
      importData(),
      NO_DEFAULT,
      undefined,
      undefined,
      callback
    );

    expect(outcomes.map((o) => o.result?._id)).toEqual(['01', '02', '03']);
  });
});
