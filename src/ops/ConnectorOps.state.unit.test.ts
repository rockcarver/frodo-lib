import { jest } from '@jest/globals';

/**
 * A connector is enabled or disabled the way the Admin UI does it: one patch of
 * `/enabled` on `provisioner.openicf/<id>` that waits for IDM to have consumed
 * it, and nothing else is written. A connector that is in the requested state
 * is not written. Enabling then repeats the connection test until the
 * connector answers ok, because right after the patch it answers
 * `connector not available`; a connector that does not answer in time is not
 * an error. A disabled connector is not a registered system any more, so
 * disabling does not test. The enabled states of all connectors come from one
 * request.
 * Mocked unit test: no recordings.
 */

const notFound = () =>
  Object.assign(new Error('Request failed with status code 404'), {
    response: { status: 404 },
  });

const getConfigEntity = jest.fn(async (_args?: any): Promise<any> => ({}));
const patchConfigEntity = jest.fn(async (_args?: any): Promise<any> => ({}));
const getConfigEntitiesByType = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const unused = jest.fn(async (_args?: any): Promise<any> => ({}));
const readSystemStatus = jest.fn(async (_args?: any): Promise<any> => ({
  enabled: true,
  ok: true,
}));

jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  deleteConfigEntity: unused,
  getConfigEntitiesByType,
  getConfigEntity,
  patchConfigEntity,
  putConfigEntity: unused,
}));
jest.unstable_mockModule('../api/IdmSystemApi', () => ({ readSystemStatus }));
jest.unstable_mockModule('./IdmConfigOps', () => ({
  readConfigEntitiesByType: unused,
}));
jest.unstable_mockModule('./MappingOps', () => ({
  deleteMapping: unused,
  readMappings: unused,
  updateMapping: unused,
}));
jest.unstable_mockModule('../utils/Console', () => ({
  createProgressIndicator: jest.fn(() => 'progress-id'),
  debugMessage: jest.fn(),
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
}));
jest.unstable_mockModule('../utils/ExportImportUtils', () => ({
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));

const {
  default: ConnectorOps,
  disableConnector,
  enableConnector,
  isConnectorEnabled,
  readConnectorEnabledStates,
} = await import('./ConnectorOps');
const { FrodoError } = await import('./FrodoError');

const state = {} as any;

const connector = (enabled?: boolean) => ({
  _id: 'provisioner.openicf/ldap',
  ...(enabled !== undefined && { enabled }),
});

/** drive the fake clock until the promise has settled */
async function settle<T>(promise: Promise<T>): Promise<T> {
  let done = false;
  promise.then(
    () => (done = true),
    () => (done = true)
  );
  for (let i = 0; i < 400 && !done; i++) {
    await jest.advanceTimersByTimeAsync(100);
  }
  return promise;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  getConfigEntity.mockReset();
  getConfigEntity.mockResolvedValue(connector(false));
  patchConfigEntity.mockReset();
  patchConfigEntity.mockImplementation(async ({ operations }: any) =>
    connector(operations[0].value)
  );
  readSystemStatus.mockReset();
  readSystemStatus.mockResolvedValue({ enabled: true, ok: true });
  getConfigEntitiesByType.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('enableConnector', () => {
  test('sends the patch the Admin UI sends, and nothing else', async () => {
    const result = await settle(
      enableConnector({ connectorId: 'ldap', state })
    );
    expect(patchConfigEntity).toHaveBeenCalledTimes(1);
    expect(patchConfigEntity).toHaveBeenCalledWith({
      entityId: 'provisioner.openicf/ldap',
      operations: [{ operation: 'replace', field: '/enabled', value: true }],
      wait: true,
      state,
    });
    expect(result).toEqual({
      connectorId: 'ldap',
      connector: connector(true),
      enabled: true,
      changed: true,
      ready: true,
    });
  });

  test('repeats the connection test until the connector answers ok', async () => {
    readSystemStatus
      .mockResolvedValueOnce({
        enabled: true,
        ok: false,
        error: 'connector not available',
      })
      .mockResolvedValueOnce({ enabled: true, ok: true });
    const result = await settle(
      enableConnector({ connectorId: 'ldap', state })
    );
    expect(readSystemStatus).toHaveBeenCalledTimes(2);
    expect(readSystemStatus).toHaveBeenCalledWith({
      systemName: 'ldap',
      state,
    });
    expect(result.ready).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('waits the interval between two tests', async () => {
    readSystemStatus
      .mockResolvedValueOnce({ enabled: true, ok: false, error: 'not yet' })
      .mockResolvedValueOnce({ enabled: true, ok: true });
    const promise = enableConnector({
      connectorId: 'ldap',
      options: { interval: 1000 },
      state,
    });
    await jest.advanceTimersByTimeAsync(999);
    expect(readSystemStatus).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(readSystemStatus).toHaveBeenCalledTimes(2);
    expect((await promise).ready).toBe(true);
  });

  test('a test that fails with an error counts as not ready yet', async () => {
    readSystemStatus
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce({ enabled: true, ok: true });
    const result = await settle(
      enableConnector({ connectorId: 'ldap', state })
    );
    expect(readSystemStatus).toHaveBeenCalledTimes(2);
    expect(result.ready).toBe(true);
  });

  test('a connector that never answers is not an error: ready is false and the last answer is returned', async () => {
    readSystemStatus.mockResolvedValue({
      enabled: true,
      ok: false,
      error: 'connector not available',
    });
    const result = await settle(
      enableConnector({
        connectorId: 'ldap',
        options: { timeout: 2000, interval: 500 },
        state,
      })
    );
    // at 0, 500, 1000, 1500 and 2000 ms
    expect(readSystemStatus).toHaveBeenCalledTimes(5);
    expect(result).toEqual({
      connectorId: 'ldap',
      connector: connector(true),
      enabled: true,
      changed: true,
      ready: false,
      error: 'connector not available',
    });
  });

  test('a timeout of 0 tests once', async () => {
    readSystemStatus.mockResolvedValue({
      enabled: true,
      ok: false,
      error: 'connector not available',
    });
    const result = await settle(
      enableConnector({ connectorId: 'ldap', options: { timeout: 0 }, state })
    );
    expect(readSystemStatus).toHaveBeenCalledTimes(1);
    expect(result.ready).toBe(false);
  });

  test('stops waiting after the default timeout of 30 seconds', async () => {
    readSystemStatus.mockResolvedValue({ enabled: true, ok: false });
    const promise = enableConnector({ connectorId: 'ldap', state });
    await jest.advanceTimersByTimeAsync(29999);
    expect(readSystemStatus).toHaveBeenCalledTimes(60);
    await jest.advanceTimersByTimeAsync(1);
    const result = await promise;
    // at 0, 500, ... 30000 ms
    expect(readSystemStatus).toHaveBeenCalledTimes(61);
    expect(result.ready).toBe(false);
    expect(result.error).toBe('the connection test did not succeed');
  });

  test('leaves a connector that is enabled already alone, but still waits for it', async () => {
    getConfigEntity.mockResolvedValue(connector(true));
    const result = await settle(
      enableConnector({ connectorId: 'ldap', state })
    );
    expect(patchConfigEntity).not.toHaveBeenCalled();
    expect(readSystemStatus).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      connectorId: 'ldap',
      connector: connector(true),
      enabled: true,
      changed: false,
      ready: true,
    });
  });

  test('a configuration without the flag counts as enabled, as in IDM', async () => {
    getConfigEntity.mockResolvedValue(connector(undefined));
    const result = await settle(
      enableConnector({ connectorId: 'ldap', state })
    );
    expect(patchConfigEntity).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
  });

  test('a connector that does not exist is a FrodoError and nothing is written', async () => {
    getConfigEntity.mockRejectedValue(notFound());
    const failure = await settle(
      enableConnector({ connectorId: 'nope', state })
    ).catch((error) => error);
    expect(failure).toBeInstanceOf(FrodoError);
    expect(failure.message).toContain('Error enabling connector nope');
    expect(patchConfigEntity).not.toHaveBeenCalled();
    expect(readSystemStatus).not.toHaveBeenCalled();
  });

  test('a failed patch is a FrodoError and the connection is not tested', async () => {
    patchConfigEntity.mockRejectedValue(new Error('HTTP 500'));
    const failure = await settle(
      enableConnector({ connectorId: 'ldap', state })
    ).catch((error) => error);
    expect(failure).toBeInstanceOf(FrodoError);
    expect(readSystemStatus).not.toHaveBeenCalled();
  });
});

describe('disableConnector', () => {
  test('sends the patch the Admin UI sends, and nothing else', async () => {
    getConfigEntity.mockResolvedValue(connector(true));
    const result = await disableConnector({ connectorId: 'ldap', state });
    expect(patchConfigEntity).toHaveBeenCalledTimes(1);
    expect(patchConfigEntity).toHaveBeenCalledWith({
      entityId: 'provisioner.openicf/ldap',
      operations: [{ operation: 'replace', field: '/enabled', value: false }],
      wait: true,
      state,
    });
    expect(result).toEqual({
      connectorId: 'ldap',
      connector: connector(false),
      enabled: false,
      changed: true,
    });
  });

  test('does not test the connection: a disabled connector is not a system any more', async () => {
    getConfigEntity.mockResolvedValue(connector(true));
    await disableConnector({ connectorId: 'ldap', state });
    expect(readSystemStatus).not.toHaveBeenCalled();
  });

  test('leaves a connector that is disabled already alone', async () => {
    getConfigEntity.mockResolvedValue(connector(false));
    const result = await disableConnector({ connectorId: 'ldap', state });
    expect(patchConfigEntity).not.toHaveBeenCalled();
    expect(result).toEqual({
      connectorId: 'ldap',
      connector: connector(false),
      enabled: false,
      changed: false,
    });
  });

  test('a connector that does not exist is a FrodoError and nothing is written', async () => {
    getConfigEntity.mockRejectedValue(notFound());
    const failure = await disableConnector({
      connectorId: 'nope',
      state,
    }).catch((error) => error);
    expect(failure).toBeInstanceOf(FrodoError);
    expect(failure.message).toContain('Error disabling connector nope');
    expect(patchConfigEntity).not.toHaveBeenCalled();
  });
});

describe('isConnectorEnabled', () => {
  test('reads the flag of the connector', async () => {
    getConfigEntity.mockResolvedValueOnce(connector(true));
    expect(await isConnectorEnabled({ connectorId: 'ldap', state })).toBe(true);
    expect(getConfigEntity).toHaveBeenCalledWith({
      entityId: 'provisioner.openicf/ldap',
      state,
    });
    getConfigEntity.mockResolvedValueOnce(connector(false));
    expect(await isConnectorEnabled({ connectorId: 'ldap', state })).toBe(
      false
    );
  });

  test('a configuration without the flag counts as enabled', async () => {
    getConfigEntity.mockResolvedValueOnce(connector(undefined));
    expect(await isConnectorEnabled({ connectorId: 'ldap', state })).toBe(true);
  });

  test('a connector that does not exist is an error', async () => {
    getConfigEntity.mockRejectedValueOnce(notFound());
    await expect(
      isConnectorEnabled({ connectorId: 'nope', state })
    ).rejects.toBeInstanceOf(FrodoError);
  });
});

describe('readConnectorEnabledStates', () => {
  test('reads the states of all connectors in one request, and leaves out what is no connector', async () => {
    getConfigEntitiesByType.mockResolvedValue({
      result: [
        { _id: 'provisioner.openicf.connectorinfoprovider' },
        { _id: 'provisioner.openicf/Entra', enabled: false },
        { _id: 'provisioner.openicf/Workday', enabled: true },
        { _id: 'provisioner.openicf/NoFlag' },
        { _id: 'provisioner.other/Thing', enabled: true },
      ],
    });
    const states = await readConnectorEnabledStates({ state });
    expect(getConfigEntitiesByType).toHaveBeenCalledTimes(1);
    expect(getConfigEntitiesByType).toHaveBeenCalledWith({
      type: 'provisioner.openicf',
      fields: ['enabled'],
      state,
    });
    expect(states).toEqual({ Entra: false, Workday: true });
  });

  test('a failed request is a FrodoError', async () => {
    getConfigEntitiesByType.mockRejectedValue(new Error('HTTP 500'));
    await expect(readConnectorEnabledStates({ state })).rejects.toBeInstanceOf(
      FrodoError
    );
  });
});

describe('the Connector module', () => {
  test('wires the four methods to the functions', async () => {
    const connectors = ConnectorOps(state);
    getConfigEntity.mockResolvedValue(connector(true));
    expect(await connectors.isConnectorEnabled('ldap')).toBe(true);

    expect(await connectors.disableConnector('ldap')).toMatchObject({
      enabled: false,
      changed: true,
    });
    expect(patchConfigEntity).toHaveBeenLastCalledWith(
      expect.objectContaining({
        operations: [{ operation: 'replace', field: '/enabled', value: false }],
      })
    );

    getConfigEntity.mockResolvedValue(connector(false));
    expect(
      await settle(connectors.enableConnector('ldap', { timeout: 0 }))
    ).toMatchObject({ enabled: true, changed: true, ready: true });

    getConfigEntitiesByType.mockResolvedValue({
      result: [{ _id: 'provisioner.openicf/ldap', enabled: true }],
    });
    expect(await connectors.readConnectorEnabledStates()).toEqual({
      ldap: true,
    });
  });

  test('passes the options of enableConnector on', async () => {
    getConfigEntity.mockResolvedValue(connector(false));
    readSystemStatus.mockResolvedValue({ enabled: true, ok: false });
    const result = await settle(
      ConnectorOps(state).enableConnector('ldap', { timeout: 0 })
    );
    expect(readSystemStatus).toHaveBeenCalledTimes(1);
    expect(result.ready).toBe(false);
  });
});
