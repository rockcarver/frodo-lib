import { jest } from '@jest/globals';

/**
 * `importSocialIdentityProviders` tries every provider. Without a result
 * callback the failures are collected and thrown as one combined error; with
 * one, every outcome is reported to it as it happens (a failed provider as an
 * error that names it, with the reasons nested), a failed provider does not
 * throw and is not part of the result, and the providers that were imported
 * are returned. A provider whose script could not be imported is a failed
 * provider although the provider itself was written.
 * Mocked unit test: no recordings.
 */

const putProviderByTypeAndId = jest.fn(async (args?: any): Promise<any> => ({
  _id: args?.id,
}));
const actualApi = await import('../api/SocialIdentityProvidersApi');
jest.unstable_mockModule('../api/SocialIdentityProvidersApi', () => ({
  ...actualApi,
  putProviderByTypeAndId,
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

const { default: IdpOps, importSocialIdentityProviders } =
  await import('./IdpOps');

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

/** google and facebook have a transformation script, apple has none */
function importData(): any {
  return {
    script: {
      'script-google': { _id: 'script-google', script: ['return 1;'] },
      'script-facebook': { _id: 'script-facebook', script: ['return 2;'] },
    },
    idp: {
      google: {
        _id: 'google',
        _type: { _id: 'googleConfig' },
        transform: 'script-google',
      },
      facebook: {
        _id: 'facebook',
        _type: { _id: 'facebookConfig' },
        transform: 'script-facebook',
      },
      apple: { _id: 'apple', _type: { _id: 'appleConfig' } },
    },
  };
}

let failure: Error;

/** the write of the provider is rejected */
const failProvider = (providerId: string, error: Error = failure) =>
  putProviderByTypeAndId.mockImplementation(async (args: any) => {
    if (args.id === providerId) throw error;
    return { _id: args.id };
  });

/** the script cannot be imported */
const failScript = (scriptId: string, error: Error = failure) =>
  updateScript.mockImplementation(async (args: any) => {
    if (args.scriptId === scriptId) throw error;
    return {};
  });

const ids = (providers: any[]) => providers.map((provider) => provider._id);

beforeEach(() => {
  failure = new Error('HTTP 400');
  jest.clearAllMocks();
  putProviderByTypeAndId.mockReset();
  putProviderByTypeAndId.mockImplementation(async (args: any) => ({
    _id: args.id,
  }));
  updateScript.mockReset();
  updateScript.mockResolvedValue({});
});

describe('importSocialIdentityProviders', () => {
  test('imports every provider with its script, with and without a callback', async () => {
    const plain = await importSocialIdentityProviders({
      importData: importData(),
      state,
    });
    const reported: any[] = [];
    const withCallback = await importSocialIdentityProviders({
      importData: importData(),
      resultCallback: (error, provider) => reported.push([error, provider]),
      state,
    });

    expect(ids(plain)).toEqual(['google', 'facebook', 'apple']);
    expect(ids(withCallback)).toEqual(['google', 'facebook', 'apple']);
    expect(reported.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(ids(reported.map(([, provider]) => provider))).toEqual([
      'google',
      'facebook',
      'apple',
    ]);
    // two scripts per run
    expect(updateScript).toHaveBeenCalledTimes(4);
  });

  test('with a callback a failed provider is reported by name, with its cause, and the others are imported', async () => {
    failProvider('facebook');
    const outcomes: any[] = [];

    const result = await importSocialIdentityProviders({
      importData: importData(),
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });

    expect(ids(result)).toEqual(['google', 'apple']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0]).toBeUndefined();
    expect(outcomes[0][1]._id).toBe('google');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(
      'Error importing alpha realm provider facebook'
    );
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][0]).toBeUndefined();
    expect(outcomes[2][1]._id).toBe('apple');
    expect(putProviderByTypeAndId).toHaveBeenCalledTimes(3);
  });

  test('a script that cannot be imported makes the provider a failed provider, although it was written', async () => {
    failScript('script-google');
    const outcomes: any[] = [];

    const result = await importSocialIdentityProviders({
      importData: importData(),
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });

    // the provider was written ...
    expect(putProviderByTypeAndId).toHaveBeenCalledTimes(3);
    // ... but it is reported as failed and is not in the result
    expect(ids(result)).toEqual(['facebook', 'apple']);
    expect(outcomes[0][1]).toBeUndefined();
    expect(outcomes[0][0].message).toBe(
      'Error importing alpha realm provider google'
    );
    expect(outcomes[0][0].originalErrors).toHaveLength(1);
    expect(outcomes[0][0].originalErrors[0]).toBe(failure);
  });

  test('a provider whose script and write both fail is one failed provider with both reasons nested', async () => {
    const writeFailure = new Error('HTTP 500');
    failScript('script-google');
    failProvider('google', writeFailure);
    const outcomes: any[] = [];

    const result = await importSocialIdentityProviders({
      importData: importData(),
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });

    expect(ids(result)).toEqual(['facebook', 'apple']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0].originalErrors).toHaveLength(2);
    expect(outcomes[0][0].originalErrors[0]).toBe(failure);
    expect(rootCause(outcomes[0][0].originalErrors[1])).toBe(writeFailure);
  });

  test('with a callback and every provider failing nothing is thrown and nothing is returned', async () => {
    putProviderByTypeAndId.mockRejectedValue(failure);
    const outcomes: any[] = [];

    const result = await importSocialIdentityProviders({
      importData: importData(),
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });

    expect(result).toEqual([]);
    expect(outcomes.map(([error]) => error.message)).toEqual([
      'Error importing alpha realm provider google',
      'Error importing alpha realm provider facebook',
      'Error importing alpha realm provider apple',
    ]);
    expect(outcomes.every(([, provider]) => provider === undefined)).toBe(true);
  });

  test('without a callback every provider is tried, then one combined error is thrown with the error of each failure', async () => {
    failScript('script-google');
    failProvider('facebook');

    const error: any = await importSocialIdentityProviders({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm providers');
    // the script error of google, then the write error of facebook, each as
    // it was raised: no wrapper that names the provider
    expect(error.originalErrors).toHaveLength(2);
    expect(error.originalErrors[0]).toBe(failure);
    expect(error.originalErrors[1].message).toBe(
      'Error updating alpha realm provider facebook'
    );
    expect(rootCause(error.originalErrors[1])).toBe(failure);
    expect(putProviderByTypeAndId).toHaveBeenCalledTimes(3);
  });

  test('without a callback the errors of one provider are listed in the order in which they happened', async () => {
    const writeFailure = new Error('HTTP 500');
    failScript('script-google');
    failProvider('google', writeFailure);

    const error: any = await importSocialIdentityProviders({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(error.originalErrors).toHaveLength(2);
    expect(error.originalErrors[0]).toBe(failure);
    expect(rootCause(error.originalErrors[1])).toBe(writeFailure);
  });

  test('every provider is reported exactly once, in order, also when the callback throws', async () => {
    failProvider('facebook');
    const calls: string[] = [];
    const boom = new Error('callback failed');

    const error: any = await importSocialIdentityProviders({
      importData: importData(),
      resultCallback: (failed, provider) => {
        calls.push(failed ? failed.message : provider._id);
        if (provider?._id === 'google') throw boom;
      },
      state,
    }).catch((e) => e);

    // the exception of the callback ends the run; it is not reported back as
    // a failed provider
    expect(calls).toEqual(['google']);
    expect(rootCause(error)).toBe(boom);
    expect(putProviderByTypeAndId).toHaveBeenCalledTimes(1);
  });

  test('without the dependencies option no script is written', async () => {
    await importSocialIdentityProviders({
      importData: importData(),
      options: { deps: false },
      state,
    });

    expect(updateScript).not.toHaveBeenCalled();
    expect(putProviderByTypeAndId).toHaveBeenCalledTimes(3);
  });

  test('import data without scripts imports the providers without a script step', async () => {
    const data = importData();
    delete data.script;

    const result = await importSocialIdentityProviders({
      importData: data,
      state,
    });

    expect(ids(result)).toEqual(['google', 'facebook', 'apple']);
    expect(updateScript).not.toHaveBeenCalled();
  });

  test('import data without providers still throws, with a callback too', async () => {
    const callback = jest.fn();

    await expect(
      importSocialIdentityProviders({
        importData: {} as any,
        resultCallback: callback,
        state,
      })
    ).rejects.toBeDefined();
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('importSocialIdentityProviders on the facade', () => {
  test('passes the result callback on', async () => {
    failProvider('facebook');
    const callback = jest.fn();

    const result = await IdpOps(state).importSocialIdentityProviders(
      importData(),
      undefined,
      callback
    );

    expect(ids(result)).toEqual(['google', 'apple']);
    expect(callback).toHaveBeenCalledTimes(3);
    expect((callback.mock.calls[1][0] as any).message).toBe(
      'Error importing alpha realm provider facebook'
    );
  });

  test('without a callback it throws one combined error as before', async () => {
    failProvider('facebook');

    const error: any = await IdpOps(state)
      .importSocialIdentityProviders(importData())
      .catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm providers');
    expect(putProviderByTypeAndId).toHaveBeenCalledTimes(3);
  });
});
