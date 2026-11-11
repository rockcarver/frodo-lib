import { jest } from '@jest/globals';

/**
 * `exportOAuth2Clients` tries every client. Without a result callback the
 * failures are collected and thrown as one combined error; with one, every
 * outcome is reported to it as it happens (a failed client as an error that
 * names it), a failed client does not throw and leaves nothing in the export,
 * and a failure to read the provider or the clients still throws. A script
 * that is not available in the cloud is skipped without a word, but leaves a
 * debug line.
 * Mocked unit test: no recordings.
 */

const getOAuth2Clients = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));

const actualApi = await import('../api/OAuth2ClientApi');
jest.unstable_mockModule('../api/OAuth2ClientApi', () => ({
  ...actualApi,
  getOAuth2Clients,
}));

const readOAuth2Provider = jest.fn(async (_args?: any): Promise<any> => ({
  _id: 'provider',
}));
const actualProviderOps = await import('./OAuth2ProviderOps');
jest.unstable_mockModule('./OAuth2ProviderOps', () => ({
  ...actualProviderOps,
  readOAuth2Provider,
}));

const readScript = jest.fn(async (_args?: any): Promise<any> => ({}));
const actualScriptOps = await import('./ScriptOps');
jest.unstable_mockModule('./ScriptOps', () => ({
  ...actualScriptOps,
  readScript,
}));

const debugMessage = jest.fn();
const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  createProgressIndicator: jest.fn(() => 'progress-id'),
  debugMessage,
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
}));

const actualExportImportUtils = await import('../utils/ExportImportUtils');
jest.unstable_mockModule('../utils/ExportImportUtils', () => ({
  ...actualExportImportUtils,
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));

const { exportOAuth2Clients } = await import('./OAuth2ClientOps');

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

let failure: Error;

beforeEach(() => {
  failure = new Error('HTTP 404');
  jest.clearAllMocks();
  getOAuth2Clients.mockReset();
  // c1 uses s1, c2 uses s2 and s3, c3 uses s1 again, c4 uses no script
  getOAuth2Clients.mockResolvedValue({
    result: [
      {
        _id: 'c1',
        overrideOAuth2ClientConfig: { accessTokenModificationScript: 's1' },
      },
      {
        _id: 'c2',
        overrideOAuth2ClientConfig: {
          oidcClaimsScript: 's2',
          validateScopesScript: 's3',
        },
      },
      {
        _id: 'c3',
        overrideOAuth2ClientConfig: { accessTokenModificationScript: 's1' },
      },
      { _id: 'c4' },
    ],
  });
  readOAuth2Provider.mockReset();
  readOAuth2Provider.mockResolvedValue({ _id: 'provider' });
  readScript.mockReset();
  readScript.mockImplementation(async ({ scriptId }: any) => ({
    _id: scriptId,
    script: Buffer.from('return 1;').toString('base64'),
  }));
});

/** the script cannot be read */
const failScript = (scriptId: string, error: any = failure) =>
  readScript.mockImplementation(async (args: any) => {
    if (args.scriptId === scriptId) throw error;
    return {
      _id: args.scriptId,
      script: Buffer.from('return 1;').toString('base64'),
    };
  });

describe('exportOAuth2Clients', () => {
  test('exports the clients with their scripts, each script once, without a callback', async () => {
    const exported = await exportOAuth2Clients({ state });

    expect(Object.keys(exported.application)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(Object.keys(exported.script)).toEqual(['s1', 's2', 's3']);
    expect(readScript).toHaveBeenCalledTimes(3);
    expect(exported.application['c1']._provider).toEqual({ _id: 'provider' });
  });

  test('with a callback every client is reported once, in order, as the client that was read', async () => {
    const outcomes: any[] = [];

    const exported = await exportOAuth2Clients({
      resultCallback: (error, client) => outcomes.push([error, client]),
      state,
    });

    expect(outcomes).toHaveLength(4);
    expect(outcomes.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map(([, client]) => client._id)).toEqual([
      'c1',
      'c2',
      'c3',
      'c4',
    ]);
    expect(outcomes[1][1]).toBe(exported.application['c2']);
  });

  test('with a callback a failed client is reported with its name and leaves nothing in the export, the others are exported, nothing is thrown', async () => {
    failScript('s3');
    const outcomes: any[] = [];

    const exported = await exportOAuth2Clients({
      resultCallback: (error, client) => outcomes.push([error, client]),
      state,
    });

    expect(outcomes).toHaveLength(4);
    expect(outcomes[0][1]._id).toBe('c1');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(
      'Error exporting alpha realm oauth2 client c2'
    );
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][1]._id).toBe('c3');
    expect(outcomes[3][1]._id).toBe('c4');
    // the partial result: no client and no script of the failed one
    expect(Object.keys(exported.application)).toEqual(['c1', 'c3', 'c4']);
    expect(Object.keys(exported.script)).toEqual(['s1']);
  });

  test('with a callback every failure is reported once when all clients fail', async () => {
    readScript.mockRejectedValue(failure);
    const errors: any[] = [];
    const successes: any[] = [];

    const exported = await exportOAuth2Clients({
      resultCallback: (error, client) =>
        error ? errors.push(error) : successes.push(client),
      state,
    });

    // c4 has no script and cannot fail
    expect(errors.map((error) => error.message)).toEqual([
      'Error exporting alpha realm oauth2 client c1',
      'Error exporting alpha realm oauth2 client c2',
      'Error exporting alpha realm oauth2 client c3',
    ]);
    expect(successes.map((client) => client._id)).toEqual(['c4']);
    expect(Object.keys(exported.application)).toEqual(['c4']);
  });

  test('without a callback every client is tried and the failures are thrown as one combined error', async () => {
    failScript('s3');

    const error: any = await exportOAuth2Clients({ state }).catch((e) => e);

    // every script was read, also those of the clients after the failed one
    expect(readScript).toHaveBeenCalledTimes(3);
    expect(error.message).toBe('Error exporting alpha realm oauth2 clients');
    expect(error.originalErrors).toHaveLength(1);
    // the error of the script, which names the client, as before
    expect(error.originalErrors[0].message).toBe(
      'Error retrieving alpha realm script s3 referenced by validateScopesScript key in client c2'
    );
    expect(rootCause(error)).toBe(failure);
  });

  test('a script that is not available in the cloud is skipped without a word and leaves a debug line', async () => {
    const notAvailable: any = new Error('HTTP 403');
    notAvailable.httpStatus = 403;
    notAvailable.httpMessage =
      'This operation is not available in PingOne Advanced Identity Cloud.';
    failScript('s2', notAvailable);
    const outcomes: any[] = [];

    const exported = await exportOAuth2Clients({
      resultCallback: (error, client) => outcomes.push([error, client]),
      state,
    });
    const withoutCallback = await exportOAuth2Clients({ state });

    expect(outcomes.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    // the client is exported, the script is not
    expect(Object.keys(exported.application)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(Object.keys(exported.script)).toEqual(['s1', 's3']);
    expect(Object.keys(withoutCallback.script)).toEqual(['s1', 's3']);
    const lines = debugMessage.mock.calls
      .map(([arg]: any) => arg.message)
      .filter((message: string) => message.includes('not available'));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain(
      'OAuth2ClientOps.exportOAuth2ClientDependencies'
    );
    expect(lines[0]).toContain('s2');
    expect(lines[0]).toContain('c2');
  });

  test('does not read the scripts when the dependencies are not asked for', async () => {
    const exported = await exportOAuth2Clients({
      options: { deps: false, useStringArrays: true },
      state,
    });

    expect(readScript).not.toHaveBeenCalled();
    expect(Object.keys(exported.application)).toHaveLength(4);
  });

  test.each([
    [
      'the provider',
      () => readOAuth2Provider.mockRejectedValue(new Error('x')),
    ],
    ['the clients', () => getOAuth2Clients.mockRejectedValue(new Error('x'))],
  ])(
    'a failure to read %s still throws, with and without a callback',
    async (_what, arrange) => {
      arrange();
      const callback = jest.fn();

      const withCallback: any = await exportOAuth2Clients({
        resultCallback: callback,
        state,
      }).catch((e) => e);
      const without: any = await exportOAuth2Clients({ state }).catch((e) => e);

      expect(withCallback.message).toBe(
        'Error exporting alpha realm oauth2 clients'
      );
      expect(without.message).toBe(
        'Error exporting alpha realm oauth2 clients'
      );
      expect(callback).not.toHaveBeenCalled();
    }
  );

  test('an exception of the callback is not reported to the callback as a failed client', async () => {
    const callback = jest.fn((_error?: any, _client?: any) => {
      throw new Error('callback bug');
    });

    const error: any = await exportOAuth2Clients({
      resultCallback: callback,
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error exporting alpha realm oauth2 clients');
    expect(rootCause(error).message).toBe('callback bug');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeUndefined();
  });
});

describe('the facade', () => {
  test('exportOAuth2Clients passes the callback on', async () => {
    const { default: OAuth2Client } = await import('./OAuth2ClientOps');
    failScript('s3');
    const outcomes: any[] = [];

    await OAuth2Client(state).exportOAuth2Clients(undefined, (error, client) =>
      outcomes.push([error, client])
    );

    expect(outcomes).toHaveLength(4);
    expect(outcomes[1][0].message).toBe(
      'Error exporting alpha realm oauth2 client c2'
    );
  });
});
