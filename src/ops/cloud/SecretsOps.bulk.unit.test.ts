import { jest } from '@jest/globals';

/**
 * `importSecrets` takes an optional result callback (frodo-lib#957). With it, the outcome of
 * every secret is passed to it once, as it happens: a secret that was imported as the secret
 * (one that needed no update as it is in the import data, never with its value), a secret that
 * could not be imported as an error that names it and carries the cause. A failed secret does
 * not stop the others, is not part of the result, and the function does not throw for it.
 * Without a callback nothing changes: one combined error is thrown after every secret was tried.
 * Failing to resolve the values of the secrets throws before any secret is imported.
 * `exportSecrets` reads the list and the values in one call and nothing per secret, so it has
 * no item that can fail and takes no callback.
 * Mocked unit test: no recordings.
 */

const getSecret = jest.fn(async (args?: any): Promise<any> => ({
  _id: args.secretId,
  description: 'current description',
  encoding: 'generic',
  activeVersion: '1',
}));
const setSecretDescription = jest.fn(async (_args?: any): Promise<any> => ({}));
const putSecret = jest.fn(async (args?: any): Promise<any> => ({
  _id: args.secretId,
}));
const createNewVersionOfSecret = jest.fn(async (_args?: any): Promise<any> => ({
  version: '2',
}));
const getSecrets = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const actualSecretsApi = await import('../../api/cloud/SecretsApi');
jest.unstable_mockModule('../../api/cloud/SecretsApi', () => ({
  ...actualSecretsApi,
  getSecrets,
  getSecret,
  setSecretDescription,
  putSecret,
  createNewVersionOfSecret,
}));

const decryptMap = jest.fn(async (_args?: any): Promise<any> => ({}));
const actualIdmCryptoOps = await import('../IdmCryptoOps');
jest.unstable_mockModule('../IdmCryptoOps', () => ({
  ...actualIdmCryptoOps,
  decryptMap,
}));

const {
  default: SecretsOps,
  exportSecrets,
  importSecrets,
} = await import('./SecretsOps');
const { default: State } = await import('../../shared/State');

const state = State({});
state.setRealm('alpha');

const secret = (id: string, extra = {}): any => ({
  _id: id,
  description: 'new description',
  encoding: 'generic',
  useInPlaceholders: true,
  ...extra,
});

const importData = (): any => ({
  secret: { a: secret('a'), b: secret('b'), c: secret('c') },
});

const OPTIONS = { includeActiveValues: false, source: '' };

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

/** Updating the description of secret b fails. */
const failSecretB = () =>
  setSecretDescription.mockImplementation(async (args: any) => {
    if (args.secretId === 'b') throw new Error('secret b: HTTP 500');
    return {};
  });

beforeEach(() => {
  outcomes = [];
  for (const mock of [
    getSecret,
    setSecretDescription,
    putSecret,
    createNewVersionOfSecret,
    decryptMap,
  ]) {
    mock.mockClear();
  }
  getSecret.mockImplementation(async (args: any) => ({
    _id: args.secretId,
    description: 'current description',
    encoding: 'generic',
    activeVersion: '1',
  }));
  setSecretDescription.mockImplementation(async () => ({}));
});

describe('exportSecrets', () => {
  test('reads the list once and nothing per secret, so there is no item that can fail', async () => {
    getSecrets.mockResolvedValue({ result: [secret('a'), secret('b')] });
    getSecret.mockClear();

    const exportData = await exportSecrets({
      options: { includeActiveValues: false, target: null },
      state,
    });

    expect(Object.keys(exportData.secret)).toEqual(['a', 'b']);
    expect(getSecrets).toHaveBeenCalledTimes(1);
    expect(getSecret).not.toHaveBeenCalled();
  });
});

describe('importSecrets', () => {
  test('without a callback: imports every secret', async () => {
    const response = await importSecrets({
      importData: importData(),
      options: OPTIONS,
      state,
    });

    expect(response.map((s) => s._id)).toEqual(['a', 'b', 'c']);
  });

  test('with a callback: reports every secret once, in order, and returns the same as without', async () => {
    const plain = await importSecrets({
      importData: importData(),
      options: OPTIONS,
      state,
    });

    const response = await importSecrets({
      importData: importData(),
      options: OPTIONS,
      resultCallback: callback,
      state,
    });

    expect(response).toEqual(plain);
    expect(outcomes.map((o) => o.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map((o) => o.result?._id)).toEqual(['a', 'b', 'c']);
  });

  test('with a callback: a secret that needs no update is reported without its value and is not in the result', async () => {
    const data = importData();
    data.secret.a = secret('a', {
      description: 'current description',
      activeValue: 'must-not-be-passed-on',
    });

    const response = await importSecrets({
      importData: data,
      options: OPTIONS,
      resultCallback: callback,
      state,
    });

    expect(response.map((s) => s._id)).toEqual(['b', 'c']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].error).toBeUndefined();
    expect(outcomes[0].result._id).toBe('a');
    expect(outcomes[0].result.description).toBe('current description');
    expect(outcomes[0].result).not.toHaveProperty('activeValue');
    expect(JSON.stringify(outcomes)).not.toContain('must-not-be-passed-on');
    // the import data of the caller is left as it was
    expect(data.secret.a.activeValue).toBe('must-not-be-passed-on');
  });

  test('with a callback: a secret that cannot be imported is a failed item that names it, the others are imported, the function does not throw', async () => {
    failSecretB();

    const response = await importSecrets({
      importData: importData(),
      options: OPTIONS,
      resultCallback: callback,
      state,
    });

    expect(response.map((s) => s._id)).toEqual(['a', 'c']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].result._id).toBe('a');
    expect(outcomes[2].result._id).toBe('c');
    expect(outcomes[1].result).toBeUndefined();
    expect(outcomes[1].error.message).toBe('Error importing secret b');
    expect(outcomes[1].error.originalErrors).toHaveLength(1);
    expect(messagesOf(outcomes[1].error)).toContain('secret b: HTTP 500');
    expect(setSecretDescription).toHaveBeenCalledTimes(3);
  });

  test('with a callback: every secret failing reports every secret, returns an empty result and does not throw', async () => {
    setSecretDescription.mockRejectedValue(new Error('HTTP 500'));

    const response = await importSecrets({
      importData: importData(),
      options: OPTIONS,
      resultCallback: callback,
      state,
    });

    expect(response).toEqual([]);
    expect(outcomes).toHaveLength(3);
    expect(outcomes.every((o) => o.error && !o.result)).toBe(true);
    expect(outcomes.map((o) => o.error.message)).toEqual([
      'Error importing secret a',
      'Error importing secret b',
      'Error importing secret c',
    ]);
  });

  test('with a callback: failing to resolve the values still throws before any secret is written', async () => {
    decryptMap.mockRejectedValue(new Error('cannot decrypt'));
    const data = importData();
    data.secret.b = secret('b', { activeValue: { $crypto: { type: 'x' } } });

    const error: any = await importSecrets({
      importData: data,
      options: { includeActiveValues: true, source: '' },
      resultCallback: callback,
      state,
    }).catch((e) => e);

    expect(error.message).toContain('Unable to resolve values for secrets');
    expect(messagesOf(error)).toContain('cannot decrypt');
    expect(outcomes).toEqual([]);
    expect(setSecretDescription).not.toHaveBeenCalled();
    expect(createNewVersionOfSecret).not.toHaveBeenCalled();
  });

  test('without a callback: the failures are thrown as one combined error after every secret was tried', async () => {
    failSecretB();

    const error: any = await importSecrets({
      importData: importData(),
      options: OPTIONS,
      state,
    }).catch((e) => e);

    // unchanged: the combined error with the raw error of the failed secret nested
    expect(error.message).toBe('Error importing secrets');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toContain('secret b');
    expect(messagesOf(error)).toContain('secret b: HTTP 500');
    expect(setSecretDescription).toHaveBeenCalledTimes(3);
  });

  test('the facade passes the callback on, after the include-values and source arguments', async () => {
    await SecretsOps(state).importSecrets(importData(), false, null, callback);

    expect(outcomes.map((o) => o.result?._id)).toEqual(['a', 'b', 'c']);
  });
});
