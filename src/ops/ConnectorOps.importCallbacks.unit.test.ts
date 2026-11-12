import { jest } from '@jest/globals';

/**
 * `importConnectors` tries every connector. Without a result callback the
 * failures are collected and thrown as one combined error; with one, every
 * outcome is reported to it as it happens (a failed connector as an error that
 * names it, with the cause nested), a failed connector does not throw and is
 * not part of the result, and the connectors that were imported are returned.
 * Mocked unit test: no recordings.
 */

const idOf = (entityId: string) => entityId.split('/')[1];

const putConfigEntity = jest.fn(async (args?: any): Promise<any> => ({
  _id: idOf(args?.entityId),
}));
const actualApi = await import('../api/IdmConfigApi');
jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  ...actualApi,
  putConfigEntity,
}));

const { default: ConnectorOps, importConnectors } =
  await import('./ConnectorOps');

const state = {
  getRealm: () => 'alpha',
  getDebugHandler: () => undefined,
  getDeploymentType: () => 'cloud',
} as any;

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

function importData(): any {
  return {
    connector: {
      'conn-1': { name: 'conn-1', enabled: true },
      'conn-2': { name: 'conn-2', enabled: true },
      'conn-3': { name: 'conn-3', enabled: false },
    },
  };
}

let failure: Error;

/** the write of the connector is rejected */
const failConnector = (connectorId: string, error: Error = failure) =>
  putConfigEntity.mockImplementation(async (args: any) => {
    if (idOf(args.entityId) === connectorId) throw error;
    return { _id: idOf(args.entityId) };
  });

const ids = (connectors: any[]) => connectors.map((it) => it._id);

beforeEach(() => {
  failure = new Error('HTTP 400');
  jest.clearAllMocks();
  putConfigEntity.mockReset();
  putConfigEntity.mockImplementation(async (args: any) => ({
    _id: idOf(args.entityId),
  }));
});

describe('importConnectors', () => {
  test('imports every connector, with and without a callback', async () => {
    const plain = await importConnectors({ importData: importData(), state });
    const reported: any[] = [];
    const withCallback = await importConnectors({
      importData: importData(),
      resultCallback: (error, connector) => reported.push([error, connector]),
      state,
    });

    expect(ids(plain)).toEqual(['conn-1', 'conn-2', 'conn-3']);
    expect(ids(withCallback)).toEqual(['conn-1', 'conn-2', 'conn-3']);
    expect(reported.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(ids(reported.map(([, connector]) => connector))).toEqual([
      'conn-1',
      'conn-2',
      'conn-3',
    ]);
    expect(putConfigEntity.mock.calls[0][0]).toMatchObject({
      entityId: 'provisioner.openicf/conn-1',
    });
  });

  test('with a callback a failed connector is reported by name, with its cause, and the others are imported', async () => {
    failConnector('conn-2');
    const outcomes: any[] = [];

    const result = await importConnectors({
      importData: importData(),
      resultCallback: (error, connector) => outcomes.push([error, connector]),
      state,
    });

    expect(ids(result)).toEqual(['conn-1', 'conn-3']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0]).toBeUndefined();
    expect(outcomes[0][1]._id).toBe('conn-1');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe('Error importing connector conn-2');
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][0]).toBeUndefined();
    expect(outcomes[2][1]._id).toBe('conn-3');
    expect(putConfigEntity).toHaveBeenCalledTimes(3);
  });

  test('with a callback and every connector failing nothing is thrown and nothing is returned', async () => {
    putConfigEntity.mockRejectedValue(failure);
    const outcomes: any[] = [];

    const result = await importConnectors({
      importData: importData(),
      resultCallback: (error, connector) => outcomes.push([error, connector]),
      state,
    });

    expect(result).toEqual([]);
    expect(outcomes.map(([error]) => error.message)).toEqual([
      'Error importing connector conn-1',
      'Error importing connector conn-2',
      'Error importing connector conn-3',
    ]);
    expect(outcomes.every(([, connector]) => connector === undefined)).toBe(
      true
    );
  });

  test('without a callback every connector is tried, then one combined error is thrown with the error of each failure', async () => {
    putConfigEntity.mockImplementation(async (args: any) => {
      if (idOf(args.entityId) !== 'conn-2') throw failure;
      return { _id: idOf(args.entityId) };
    });

    const error: any = await importConnectors({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing connectors');
    // the errors as the write raised them: no wrapper that names the connector
    expect(error.originalErrors.map((e: any) => e.message)).toEqual([
      'Error updating connector conn-1',
      'Error updating connector conn-3',
    ]);
    expect(rootCause(error.originalErrors[0])).toBe(failure);
    expect(rootCause(error.originalErrors[1])).toBe(failure);
    expect(putConfigEntity).toHaveBeenCalledTimes(3);
  });

  test('every connector is reported exactly once, in order, also when the callback throws', async () => {
    failConnector('conn-2');
    const calls: string[] = [];
    const boom = new Error('callback failed');

    const error: any = await importConnectors({
      importData: importData(),
      resultCallback: (failed, connector) => {
        calls.push(failed ? failed.message : connector._id);
        if (connector?._id === 'conn-1') throw boom;
      },
      state,
    }).catch((e) => e);

    // the exception of the callback ends the run; it is not reported back as
    // a failed connector
    expect(calls).toEqual(['conn-1']);
    expect(rootCause(error)).toBe(boom);
    expect(putConfigEntity).toHaveBeenCalledTimes(1);
  });

  test('import data without connectors still throws, with a callback too', async () => {
    const callback = jest.fn();

    await expect(
      importConnectors({
        importData: {} as any,
        resultCallback: callback,
        state,
      })
    ).rejects.toBeDefined();
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('importConnectors on the facade', () => {
  test('passes the result callback on', async () => {
    failConnector('conn-2');
    const callback = jest.fn();

    const result = await ConnectorOps(state).importConnectors(
      importData(),
      { deps: true },
      callback
    );

    expect(ids(result)).toEqual(['conn-1', 'conn-3']);
    expect(callback).toHaveBeenCalledTimes(3);
    expect((callback.mock.calls[1][0] as any).message).toBe(
      'Error importing connector conn-2'
    );
  });

  test('without a callback it throws one combined error as before', async () => {
    failConnector('conn-2');

    const error: any = await ConnectorOps(state)
      .importConnectors(importData())
      .catch((e) => e);

    expect(error.message).toBe('Error importing connectors');
    expect(putConfigEntity).toHaveBeenCalledTimes(3);
  });
});
