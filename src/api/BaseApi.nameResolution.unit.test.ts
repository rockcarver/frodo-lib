/**
 * Unit tests for what a request says when the host name cannot be resolved.
 *
 * Run with:
 *
 *        npm run test:only BaseApi.nameResolution
 *
 * Origin: frodo-cli#922 and frodo-lib#806. The request failed with
 * `getaddrinfo ENOTFOUND <host>` and nothing else, whether the host was
 * mistyped, DNS was down or the operating system did not let the process use
 * the network. The request's error now carries a diagnosis, and
 * `FrodoError.getCombinedMessage()` prints it under the error.
 *
 * Uses a custom axios adapter that fails the way the system resolver does (no
 * real network, no Polly) and answers the two local probes with fakes, so the
 * outcome does not depend on the machine the test runs on. The decision itself
 * is tested in `NetworkDiagnosisUtils.unit.test.ts`.
 */
import { jest } from '@jest/globals';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { FrodoError } from '../ops/FrodoError';
import StateImpl from '../shared/State';
import {
  defaultNameResolutionProbes,
  resetNameResolutionDiagnoses,
} from '../utils/NetworkDiagnosisUtils';
import { generateAmApi, generateLogApi } from './BaseApi';

/** What axios hands to an interceptor when the system resolver failed. */
function failingAdapter(code: string, host: string, attempts: { n: number }) {
  return async (config: AxiosRequestConfig) => {
    attempts.n++;
    const cause: NodeJS.ErrnoException = new Error(
      `getaddrinfo ${code} ${host}`
    );
    cause.code = code;
    throw AxiosError.from(cause, code, config as never);
  };
}

function fakeProbes(
  bind: { ok: true } | { ok: false; code: string },
  resolve: { ok: true } | { ok: false; code: string }
) {
  return {
    bind: jest
      .spyOn(defaultNameResolutionProbes, 'canBindLoopback')
      .mockResolvedValue(bind),
    resolve: jest
      .spyOn(defaultNameResolutionProbes, 'resolveAddress')
      .mockResolvedValue(resolve),
  };
}

async function failure(request: Promise<unknown>): Promise<AxiosError> {
  try {
    await request;
  } catch (error) {
    return error as AxiosError;
  }
  throw new Error('the request was expected to fail');
}

beforeEach(() => resetNameResolutionDiagnoses());
afterEach(() => jest.restoreAllMocks());

describe('BaseApi: a host name that cannot be resolved', () => {
  test('1: The error carries the diagnosis and keeps its message and code', async () => {
    fakeProbes({ ok: false, code: 'EPERM' }, { ok: false, code: 'ENOTFOUND' });
    const attempts = { n: 0 };
    const request = generateAmApi({
      resource: {},
      requiredScopes: [],
      state: StateImpl({}),
      requestOverride: {
        adapter: failingAdapter('ENOTFOUND', 'tenant.example.com', attempts),
      },
    });

    const error = await failure(request.get('https://tenant.example.com/am/x'));

    expect(error.code).toBe('ENOTFOUND');
    expect(error.message).toBe('getaddrinfo ENOTFOUND tenant.example.com');
    expect(error['nameResolutionDiagnosis']).toEqual({
      kind: 'no-network-permission',
      message: expect.stringContaining("Cannot resolve 'tenant.example.com'"),
    });
  });

  test('2: FrodoError prints the diagnosis under the error, indented with it', async () => {
    fakeProbes({ ok: true }, { ok: false, code: 'ENOTFOUND' });
    const request = generateLogApi({
      resource: {},
      state: StateImpl({}),
      requestOverride: {
        adapter: failingAdapter('ENOTFOUND', 'typo.example.com', { n: 0 }),
      },
    });

    const error = await failure(request.get('https://typo.example.com/am/x'));

    expect(
      new FrodoError('Error getting log sources', error).getCombinedMessage()
    ).toBe(
      [
        'Error getting log sources',
        '  getaddrinfo ENOTFOUND typo.example.com',
        "  Cannot resolve 'typo.example.com': DNS has no address for this name. Check the host name for typos.",
      ].join('\n')
    );
  });

  test('3: The system resolver saying EAI_AGAIN is diagnosed too', async () => {
    fakeProbes({ ok: true }, { ok: false, code: 'ETIMEOUT' });
    const request = generateAmApi({
      resource: {},
      requiredScopes: [],
      state: StateImpl({}),
      requestOverride: {
        adapter: failingAdapter('EAI_AGAIN', 'tenant.example.com', { n: 0 }),
      },
    });

    const error = await failure(request.get('https://tenant.example.com/am/x'));

    expect(error['nameResolutionDiagnosis'].kind).toBe('dns-unreachable');
  });

  test('4: A burst of failing requests runs one diagnosis', async () => {
    const { bind, resolve } = fakeProbes(
      { ok: true },
      { ok: false, code: 'ENOTFOUND' }
    );
    const attempts = { n: 0 };
    const request = generateAmApi({
      resource: {},
      requiredScopes: [],
      state: StateImpl({}),
      requestOverride: {
        adapter: failingAdapter('ENOTFOUND', 'tenant.example.com', attempts),
      },
    });

    const errors = await Promise.all(
      Array.from({ length: 40 }, () =>
        failure(request.get('https://tenant.example.com/am/x'))
      )
    );

    expect(attempts.n).toBe(40);
    expect(bind).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(errors.every((e) => e['nameResolutionDiagnosis'])).toBe(true);
  });

  test('5: It runs once the retries are over, not after every attempt', async () => {
    const { bind } = fakeProbes({ ok: true }, { ok: false, code: 'ENOTFOUND' });
    const attempts = { n: 0 };
    const askedAfterAttempt: number[] = [];
    bind.mockImplementation(async () => {
      askedAfterAttempt.push(attempts.n);
      return { ok: true };
    });
    const state = StateImpl({});
    state.setAxiosRetryConfig({
      retries: 2,
      retryDelay: () => 1,
      retryCondition: () => true,
    });
    const request = generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      requestOverride: {
        adapter: failingAdapter('ENOTFOUND', 'tenant.example.com', attempts),
      },
    });

    const error = await failure(request.get('https://tenant.example.com/am/x'));

    expect(attempts.n).toBe(3);
    expect(askedAfterAttempt).toEqual([3]);
    expect(error['nameResolutionDiagnosis']).toBeDefined();
  });

  test('6: Other network errors pass through untouched and ask nothing', async () => {
    const { bind, resolve } = fakeProbes({ ok: true }, { ok: true });
    const request = generateAmApi({
      resource: {},
      requiredScopes: [],
      state: StateImpl({}),
      requestOverride: {
        adapter: failingAdapter('ECONNREFUSED', 'tenant.example.com', { n: 0 }),
      },
    });

    const error = await failure(request.get('https://tenant.example.com/am/x'));

    expect(error['nameResolutionDiagnosis']).toBeUndefined();
    expect(bind).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
    expect(new FrodoError('Error', error).getCombinedMessage()).toBe(
      'Error\n  getaddrinfo ECONNREFUSED tenant.example.com'
    );
  });
});
