import { jest } from '@jest/globals';

/**
 * `exportSocialIdentityProviders` tries every provider. Without a result
 * callback the failures are collected and thrown as one combined error; with
 * one, every outcome is reported to it as it happens (a failed provider as an
 * error that names it), a failed provider does not throw and is not part of
 * the export, and a failure to read the providers still throws.
 * Mocked unit test: no recordings.
 */

const getSocialIdentityProviders = jest.fn(
  async (_args?: any): Promise<any> => ({ result: [] })
);

const actualApi = await import('../api/SocialIdentityProvidersApi');
jest.unstable_mockModule('../api/SocialIdentityProvidersApi', () => ({
  ...actualApi,
  getSocialIdentityProviders,
}));

const readScript = jest.fn(async (_args?: any): Promise<any> => ({}));
const actualScriptOps = await import('./ScriptOps');
jest.unstable_mockModule('./ScriptOps', () => ({
  ...actualScriptOps,
  readScript,
}));

const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  createProgressIndicator: jest.fn(() => 'progress-id'),
  debugMessage: jest.fn(),
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
}));

const actualExportImportUtils = await import('../utils/ExportImportUtils');
jest.unstable_mockModule('../utils/ExportImportUtils', () => ({
  ...actualExportImportUtils,
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));

const { exportSocialIdentityProviders } = await import('./IdpOps');

const state = {
  getRealm: () => 'alpha',
  getDeploymentType: () => 'cloud',
} as any;

/** The messages of an error and of everything nested in it. */
function messagesOf(error: any): string {
  return [error?.message, ...(error?.originalErrors ?? []).map(messagesOf)]
    .filter(Boolean)
    .join(' | ');
}

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
  getSocialIdentityProviders.mockReset();
  getSocialIdentityProviders.mockImplementation(async () => ({
    result: [
      { _id: 'google', transform: 'script-google' },
      { _id: 'github', transform: 'script-github' },
      { _id: 'apple', transform: 'script-apple' },
    ],
  }));
  readScript.mockReset();
  readScript.mockImplementation(async ({ scriptId }: any) => ({
    _id: scriptId,
    script: Buffer.from('return 1;').toString('base64'),
  }));
});

/** the script of the provider cannot be read */
const failScript = (scriptId: string) =>
  readScript.mockImplementation(async (args: any) => {
    if (args.scriptId === scriptId) throw failure;
    return {
      _id: args.scriptId,
      script: Buffer.from('return 1;').toString('base64'),
    };
  });

describe('exportSocialIdentityProviders', () => {
  test('exports the providers with the scripts they use, without a callback', async () => {
    const exported = await exportSocialIdentityProviders({ state });

    expect(Object.keys(exported.idp)).toEqual(['google', 'github', 'apple']);
    expect(Object.keys(exported.script)).toEqual([
      'script-google',
      'script-github',
      'script-apple',
    ]);
  });

  test('with a callback every provider is reported once, in order, as the provider that was read', async () => {
    const outcomes: any[] = [];

    const exported = await exportSocialIdentityProviders({
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });

    expect(outcomes).toHaveLength(3);
    expect(outcomes.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map(([, provider]) => provider._id)).toEqual([
      'google',
      'github',
      'apple',
    ]);
    expect(outcomes[1][1]).toBe(exported.idp['github']);
  });

  test('with a callback a failed provider is reported with its name and is not exported, the others are, nothing is thrown', async () => {
    failScript('script-github');
    const outcomes: any[] = [];

    const exported = await exportSocialIdentityProviders({
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });

    expect(readScript).toHaveBeenCalledTimes(3);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][1]._id).toBe('google');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(
      'Error exporting alpha realm provider github'
    );
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][1]._id).toBe('apple');
    // the partial result: no provider and no script of the failed one
    expect(Object.keys(exported.idp)).toEqual(['google', 'apple']);
    expect(Object.keys(exported.script)).toEqual([
      'script-google',
      'script-apple',
    ]);
  });

  test('with a callback every failure is reported once when all providers fail', async () => {
    readScript.mockRejectedValue(failure);
    const errors: any[] = [];
    const successes: any[] = [];

    const exported = await exportSocialIdentityProviders({
      resultCallback: (error, provider) =>
        error ? errors.push(error) : successes.push(provider),
      state,
    });

    expect(successes).toEqual([]);
    expect(errors.map((error) => error.message)).toEqual([
      'Error exporting alpha realm provider google',
      'Error exporting alpha realm provider github',
      'Error exporting alpha realm provider apple',
    ]);
    expect(exported.idp).toEqual({});
  });

  test('without a callback every provider is tried and the failures are thrown as one combined error', async () => {
    failScript('script-github');

    const error: any = await exportSocialIdentityProviders({ state }).catch(
      (e) => e
    );

    expect(readScript).toHaveBeenCalledTimes(3);
    expect(error.message).toBe('Error exporting alpha realm providers');
    // providers -> dependencies -> one error per failed provider
    const dependencies = error.originalErrors[0];
    expect(dependencies.message).toBe(
      'Error exporting alpha realm dependencies'
    );
    expect(dependencies.originalErrors).toHaveLength(1);
    expect(dependencies.originalErrors[0].message).toBe(
      'Error exporting alpha realm provider github'
    );
    expect(messagesOf(dependencies.originalErrors[0])).toContain('HTTP 404');
  });

  test('a provider without a script is exported without reading one', async () => {
    getSocialIdentityProviders.mockResolvedValue({
      result: [{ _id: 'plain' }],
    });

    const exported = await exportSocialIdentityProviders({
      resultCallback: () => undefined,
      state,
    });

    expect(readScript).not.toHaveBeenCalled();
    expect(Object.keys(exported.idp)).toEqual(['plain']);
    expect(exported.script).toEqual({});
  });

  test('does not read the scripts when the dependencies are not asked for', async () => {
    const exported = await exportSocialIdentityProviders({
      options: { deps: false, useStringArrays: true },
      state,
    });

    expect(readScript).not.toHaveBeenCalled();
    expect(Object.keys(exported.idp)).toHaveLength(3);
  });

  test('a failure to read the providers still throws, with and without a callback', async () => {
    getSocialIdentityProviders.mockRejectedValue(new Error('HTTP 500'));
    const callback = jest.fn();

    const withCallback: any = await exportSocialIdentityProviders({
      resultCallback: callback,
      state,
    }).catch((e) => e);
    const without: any = await exportSocialIdentityProviders({ state }).catch(
      (e) => e
    );

    expect(withCallback.message).toBe('Error exporting alpha realm providers');
    expect(without.message).toBe('Error exporting alpha realm providers');
    expect(callback).not.toHaveBeenCalled();
  });

  test('an exception of the callback is not reported to the callback as a failed provider', async () => {
    const callback = jest.fn((_error?: any, _provider?: any) => {
      throw new Error('callback bug');
    });

    const error: any = await exportSocialIdentityProviders({
      resultCallback: callback,
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error exporting alpha realm providers');
    expect(rootCause(error).message).toBe('callback bug');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeUndefined();
  });
});

describe('the facade', () => {
  test('exportSocialIdentityProviders passes the callback on', async () => {
    const { default: Idp } = await import('./IdpOps');
    failScript('script-github');
    const outcomes: any[] = [];

    await Idp(state).exportSocialIdentityProviders(
      undefined,
      (error, provider) => outcomes.push([error, provider])
    );

    expect(outcomes).toHaveLength(3);
    expect(outcomes[1][0].message).toBe(
      'Error exporting alpha realm provider github'
    );
  });
});
