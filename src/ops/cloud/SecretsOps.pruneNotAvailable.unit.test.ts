/**
 * Unit tests for how pruneVersionsOfSecret() treats the answer "This operation is not available in PingOne Advanced
 * Identity Cloud." (HTTP 403) of the delete of a version.
 *
 * It passes the function of the api layer, deleteVersionOfSecret(), to getResult(), so the error that getResult()
 * receives is the raw AxiosError of the api layer: its answer is in `response.status` and `response.data.message`, it
 * has no `httpStatus` and no `httpMessage`. The version that answers so is skipped without a word: the delete is still
 * sent, the result callback is not called for it, nothing is thrown, and a debug message names it. Every other answer
 * is a failed item that names the version and nests the cause.
 *
 * Real AxiosErrors, the real getResult() and FrodoError are used, only the api layer is faked.
 *
 * Run with:
 *
 *        npm run test:only SecretsOps.pruneNotAvailable
 *
 * Origin: frodo-lib#957 (bulk exports and imports report per item). No recording and no tenant is needed. All values
 * are made up.
 */
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';
import type { VersionOfSecretSkeleton } from '../../api/cloud/SecretsApi';
import State from '../../shared/State';
import { FrodoError } from '../FrodoError';

const NOT_AVAILABLE =
  'This operation is not available in PingOne Advanced Identity Cloud.';
const SECRET_ID = 'esv-sample-secret';
const versionUrl = (version: string) =>
  `https://tenant.example.com/environment/secrets/${SECRET_ID}/versions/${version}`;

/** The answer of the server, as the api layer raises it: an AxiosError with the response of the server. */
function axiosAnswer(
  version: string,
  status: number,
  data: object | null
): AxiosError {
  const error = new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST'
  );
  error.config = {
    url: versionUrl(version),
    method: 'delete',
  } as AxiosError['config'];
  error.response = { status, data } as AxiosError['response'];
  return error;
}

const notAvailable = (version: string) =>
  axiosAnswer(version, 403, { code: 403, message: NOT_AVAILABLE });

/** Versions 1 to 3 are to be pruned, version 4 is the active one. */
const VERSIONS: VersionOfSecretSkeleton[] = ['1', '2', '3', '4'].map(
  (version) => ({ version, status: 'ENABLED' })
);

/** What the api layer answers for a version: set per version, a version that is not set is deleted. */
let answers: Record<string, Error>;

const getSecret = jest.fn(async (_args?: unknown) => ({
  _id: SECRET_ID,
  activeVersion: '4',
}));
const getSecretVersions = jest.fn(async (_args?: unknown) => VERSIONS);
const deleteVersionOfSecret = jest.fn(
  async ({
    version,
  }: {
    version: string;
  }): Promise<VersionOfSecretSkeleton> => {
    if (answers[version]) throw answers[version];
    return { version, status: 'DESTROYED' };
  }
);

const secretsApi = await import('../../api/cloud/SecretsApi');
jest.unstable_mockModule('../../api/cloud/SecretsApi', () => ({
  ...secretsApi,
  getSecret,
  getSecretVersions,
  deleteVersionOfSecret,
}));

const { pruneVersionsOfSecret } = await import('./SecretsOps');

const state = State({});
const debug = jest.fn();
const debugLines = () => debug.mock.calls.map(([message]) => String(message));
const skipLines = () => debugLines().filter((line) => line.includes('skipped'));
const deletedVersions = () =>
  deleteVersionOfSecret.mock.calls.map(([{ version }]) => version);

beforeEach(() => {
  jest.clearAllMocks();
  answers = {};
  state.setDebugHandler(debug);
});

afterEach(() => {
  state.setDebugHandler(undefined);
});

describe('pruneVersionsOfSecret()', () => {
  test('deletes every version but the active one and reports each', async () => {
    const resultCallback = jest.fn();

    await pruneVersionsOfSecret({
      secretId: SECRET_ID,
      resultCallback,
      state,
    });

    expect(deletedVersions()).toEqual(['1', '2', '3']);
    expect(resultCallback.mock.calls.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(skipLines()).toEqual([]);
  });

  test('skips the version that answers 403 "not available in PingOne Advanced Identity Cloud": the delete is sent, the callback is not told, nothing is thrown, a debug message names it', async () => {
    answers['2'] = notAvailable('2');
    const resultCallback = jest.fn();

    await pruneVersionsOfSecret({
      secretId: SECRET_ID,
      resultCallback,
      state,
    });

    // the delete of the version is still sent, and the versions after it are still deleted
    expect(deletedVersions()).toEqual(['1', '2', '3']);
    expect(resultCallback.mock.calls).toEqual([
      [undefined, { version: '1', status: 'DESTROYED' }],
      [undefined, { version: '3', status: 'DESTROYED' }],
    ]);
    const lines = skipLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(
      `Failed to prune version 2 of secret ${SECRET_ID}`
    );
    expect(lines[0]).toContain(
      'not available in PingOne Advanced Identity Cloud'
    );
    expect(lines[0]).toContain(`[DELETE ${versionUrl('2')}]`);
  });

  test('skips the version without a callback too: nothing is thrown and the others are deleted', async () => {
    answers['1'] = notAvailable('1');

    await expect(
      pruneVersionsOfSecret({ secretId: SECRET_ID, state })
    ).resolves.toBeDefined();

    expect(deletedVersions()).toEqual(['1', '2', '3']);
    expect(skipLines()).toHaveLength(1);
  });

  test.each([
    [
      'a 403 with another message',
      (v: string) => axiosAnswer(v, 403, { code: 403, message: 'Forbidden' }),
    ],
    ['a 403 without a body', (v: string) => axiosAnswer(v, 403, null)],
    [
      'a 500 with the "not available" message',
      (v: string) => axiosAnswer(v, 500, { code: 500, message: NOT_AVAILABLE }),
    ],
  ])(
    '%s is a failed item: the callback is told, it names the version and nests the cause, the others are still deleted',
    async (_answer, makeCause) => {
      const cause = makeCause('2');
      answers['2'] = cause;
      const resultCallback = jest.fn();

      await pruneVersionsOfSecret({
        secretId: SECRET_ID,
        resultCallback,
        state,
      });

      expect(deletedVersions()).toEqual(['1', '2', '3']);
      const failures = resultCallback.mock.calls.filter(([error]) => error);
      expect(failures).toHaveLength(1);
      const [error] = failures[0] as [FrodoError];
      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe(
        `Failed to prune version 2 of secret ${SECRET_ID}`
      );
      expect(error.originalErrors[0]).toBe(cause);
      expect(skipLines()).toEqual([]);
    }
  );

  test('a failed item is thrown when there is no callback, naming the secret and nesting the version that failed', async () => {
    const cause = axiosAnswer('2', 403, { code: 403, message: 'Forbidden' });
    answers['2'] = cause;

    const error: FrodoError = await pruneVersionsOfSecret({
      secretId: SECRET_ID,
      state,
    }).then(
      () => {
        throw new Error('expected the prune to throw, but it returned');
      },
      (e) => e
    );

    expect(error.message).toBe(`Error pruning versions of secret ${SECRET_ID}`);
    const [versionError] = error.originalErrors as FrodoError[];
    expect(versionError.message).toBe(
      `Failed to prune version 2 of secret ${SECRET_ID}`
    );
    expect(versionError.originalErrors[0]).toBe(cause);
    // the run stops at the first failure when nothing collects the failed items
    expect(deletedVersions()).toEqual(['1', '2']);
  });
});
