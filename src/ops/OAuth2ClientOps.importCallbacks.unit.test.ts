import { jest } from '@jest/globals';

/**
 * `importOAuth2Clients` tries every client. Without a result callback the
 * failures are collected and thrown as one combined error; with one, every
 * outcome is reported to it as it happens (a failed client as an error that
 * names it, with the cause nested), a failed client does not throw and is not
 * part of the result, and the clients that were imported are returned.
 * Mocked unit test: no recordings.
 */

const putOAuth2Client = jest.fn(async (args?: any): Promise<any> => ({
  _id: args?.id,
}));
const actualApi = await import('../api/OAuth2ClientApi');
jest.unstable_mockModule('../api/OAuth2ClientApi', () => ({
  ...actualApi,
  putOAuth2Client,
}));

const updateScript = jest.fn(async (_args?: any): Promise<any> => ({}));
const actualScriptOps = await import('./ScriptOps');
jest.unstable_mockModule('./ScriptOps', () => ({
  ...actualScriptOps,
  updateScript,
}));

const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  debugMessage: jest.fn(),
}));

const { default: OAuth2ClientOps, importOAuth2Clients } =
  await import('./OAuth2ClientOps');

const state = {
  getRealm: () => 'alpha',
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

/** c1 uses the script s1, c2 uses no script, c3 uses s3 */
function importData(): any {
  return {
    script: { s1: { _id: 's1' }, s3: { _id: 's3' } },
    application: {
      c1: {
        _id: 'c1',
        _provider: { _id: 'provider' },
        _rev: '1',
        overrideOAuth2ClientConfig: { accessTokenModificationScript: 's1' },
      },
      c2: { _id: 'c2' },
      c3: {
        _id: 'c3',
        overrideOAuth2ClientConfig: { oidcClaimsScript: 's3' },
      },
    },
  };
}

let failure: Error;

/** the write of the client is rejected */
const failClient = (clientId: string, error: Error = failure) =>
  putOAuth2Client.mockImplementation(async (args: any) => {
    if (args.id === clientId) throw error;
    return { _id: args.id };
  });

const ids = (clients: any[]) => clients.map((client) => client._id);

beforeEach(() => {
  failure = new Error('HTTP 400');
  jest.clearAllMocks();
  putOAuth2Client.mockReset();
  putOAuth2Client.mockImplementation(async (args: any) => ({ _id: args.id }));
  updateScript.mockReset();
  updateScript.mockResolvedValue({});
});

describe('importOAuth2Clients', () => {
  test('imports every client, with and without a callback', async () => {
    const plain = await importOAuth2Clients({
      importData: importData(),
      state,
    });
    const reported: any[] = [];
    const withCallback = await importOAuth2Clients({
      importData: importData(),
      resultCallback: (error, client) => reported.push([error, client]),
      state,
    });

    expect(ids(plain)).toEqual(['c1', 'c2', 'c3']);
    expect(ids(withCallback)).toEqual(['c1', 'c2', 'c3']);
    expect(reported.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(ids(reported.map(([, client]) => client))).toEqual([
      'c1',
      'c2',
      'c3',
    ]);
  });

  test('writes the dependencies and the client, without provider and revision', async () => {
    await importOAuth2Clients({ importData: importData(), state });

    expect(updateScript.mock.calls.map(([args]) => args.scriptId)).toEqual([
      's1',
      's3',
    ]);
    const written = putOAuth2Client.mock.calls.map(([args]) => args);
    expect(written.map((args) => args.id)).toEqual(['c1', 'c2', 'c3']);
    expect(written[0].clientData._provider).toBeUndefined();
    expect(written[0].clientData._rev).toBeUndefined();
  });

  test('with a callback a failed client is reported by name, with its cause, and the others are imported', async () => {
    failClient('c2');
    const outcomes: any[] = [];

    const result = await importOAuth2Clients({
      importData: importData(),
      resultCallback: (error, client) => outcomes.push([error, client]),
      state,
    });

    expect(ids(result)).toEqual(['c1', 'c3']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0]).toBeUndefined();
    expect(outcomes[0][1]._id).toBe('c1');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(
      'Error importing alpha realm oauth2 client c2'
    );
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][0]).toBeUndefined();
    expect(outcomes[2][1]._id).toBe('c3');
    expect(putOAuth2Client).toHaveBeenCalledTimes(3);
  });

  test('a script dependency that cannot be imported makes the client a failed client that is not written', async () => {
    updateScript.mockImplementation(async (args: any) => {
      if (args.scriptId === 's1') throw failure;
      return {};
    });
    const outcomes: any[] = [];

    const result = await importOAuth2Clients({
      importData: importData(),
      resultCallback: (error, client) => outcomes.push([error, client]),
      state,
    });

    expect(ids(result)).toEqual(['c2', 'c3']);
    expect(outcomes[0][0].message).toBe(
      'Error importing alpha realm oauth2 client c1'
    );
    expect(outcomes[0][0].originalErrors[0].message).toBe(
      'Error importing alpha realm script dependency s1'
    );
    expect(rootCause(outcomes[0][0])).toBe(failure);
    expect(putOAuth2Client.mock.calls.map(([args]) => args.id)).toEqual([
      'c2',
      'c3',
    ]);
  });

  test('with a callback and every client failing nothing is thrown and nothing is returned', async () => {
    putOAuth2Client.mockRejectedValue(failure);
    const outcomes: any[] = [];

    const result = await importOAuth2Clients({
      importData: importData(),
      resultCallback: (error, client) => outcomes.push([error, client]),
      state,
    });

    expect(result).toEqual([]);
    expect(outcomes.map(([error]) => error.message)).toEqual([
      'Error importing alpha realm oauth2 client c1',
      'Error importing alpha realm oauth2 client c2',
      'Error importing alpha realm oauth2 client c3',
    ]);
    expect(outcomes.every(([, client]) => client === undefined)).toBe(true);
  });

  test('without a callback every client is tried, then one combined error is thrown with the raw error of each failed client', async () => {
    putOAuth2Client.mockImplementation(async (args: any) => {
      if (args.id === 'c1' || args.id === 'c3') throw failure;
      return { _id: args.id };
    });

    const error: any = await importOAuth2Clients({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm oauth2 clients');
    expect(error.originalErrors).toHaveLength(2);
    // one nested error per failed client, as the write raised it (no wrapper
    // that names the client is added without a callback)
    expect(error.originalErrors.map((e: any) => e.message)).toEqual([
      'Error updating alpha realm oauth2 client c1',
      'Error updating alpha realm oauth2 client c3',
    ]);
    expect(rootCause(error.originalErrors[0])).toBe(failure);
    expect(rootCause(error.originalErrors[1])).toBe(failure);
    expect(putOAuth2Client).toHaveBeenCalledTimes(3);
  });

  test('without a callback a script dependency error is nested as before', async () => {
    updateScript.mockRejectedValue(failure);

    const error: any = await importOAuth2Clients({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm oauth2 clients');
    expect(error.originalErrors.map((e: any) => e.message)).toEqual([
      'Error importing alpha realm script dependency s1',
      'Error importing alpha realm script dependency s3',
    ]);
  });

  test('every client is reported exactly once, in order, also when the callback throws', async () => {
    failClient('c2');
    const calls: string[] = [];
    const boom = new Error('callback failed');

    const error: any = await importOAuth2Clients({
      importData: importData(),
      resultCallback: (failed, client) => {
        calls.push(failed ? failed.message : client._id);
        if (client?._id === 'c1') throw boom;
      },
      state,
    }).catch((e) => e);

    // the exception of the callback ends the run; it is not reported back as
    // a failed client
    expect(calls).toEqual(['c1']);
    expect(rootCause(error)).toBe(boom);
    expect(putOAuth2Client).toHaveBeenCalledTimes(1);
  });

  test('without the dependencies option no script is written', async () => {
    await importOAuth2Clients({
      importData: importData(),
      options: { deps: false },
      state,
    });

    expect(updateScript).not.toHaveBeenCalled();
    expect(putOAuth2Client).toHaveBeenCalledTimes(3);
  });

  test('import data without applications still throws, with a callback too', async () => {
    const callback = jest.fn();

    await expect(
      importOAuth2Clients({
        importData: {} as any,
        resultCallback: callback,
        state,
      })
    ).rejects.toBeDefined();
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('importOAuth2Clients on the facade', () => {
  test('passes the result callback on', async () => {
    failClient('c2');
    const callback = jest.fn();

    const result = await OAuth2ClientOps(state).importOAuth2Clients(
      importData(),
      undefined,
      callback
    );

    expect(ids(result)).toEqual(['c1', 'c3']);
    expect(callback).toHaveBeenCalledTimes(3);
    expect((callback.mock.calls[1][0] as any).message).toBe(
      'Error importing alpha realm oauth2 client c2'
    );
  });

  test('without a callback it throws one combined error as before', async () => {
    failClient('c2');

    const error: any = await OAuth2ClientOps(state)
      .importOAuth2Clients(importData())
      .catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm oauth2 clients');
    expect(putOAuth2Client).toHaveBeenCalledTimes(3);
  });
});
