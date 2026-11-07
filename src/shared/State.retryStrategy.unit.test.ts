import { AxiosError, AxiosHeaders } from 'axios';
import Constants from './Constants';
import StateImpl from './State';

describe('setAxiosRetryStrategy()', () => {
  const state = StateImpl({});
  const originalConfig = state.getAxiosRetryConfig();

  afterEach(() => {
    state.setAxiosRetryConfig(originalConfig);
  });

  function errorWithStatus(status?: number, method = 'post') {
    const config = { method, headers: new AxiosHeaders() };
    return new AxiosError(
      'Request failed',
      'ECONNRESET',
      config,
      undefined,
      status === undefined
        ? undefined
        : { status, statusText: '', headers: {}, config, data: '' }
    );
  }

  describe.each([
    {
      strategy: Constants.RETRY_EVERYTHING_KEY,
      retries: 3,
      network: true,
      serverError: true,
    },
    {
      strategy: Constants.RETRY_NETWORK_KEY,
      retries: 3,
      network: true,
      serverError: false,
    },
    {
      strategy: Constants.RETRY_NOTHING_KEY,
      retries: 0,
      network: false,
      serverError: false,
    },
  ])('$strategy', ({ strategy, retries, network, serverError }) => {
    beforeEach(() => {
      state.setAxiosRetryStrategy(strategy);
    });

    it('sets the retry count', () => {
      expect(state.getAxiosRetryConfig().retries).toBe(retries);
    });

    it('handles a network error without a response', () => {
      expect(
        state.getAxiosRetryConfig().retryCondition!(errorWithStatus())
      ).toBe(network);
    });

    it('handles a POST returning 500', () => {
      expect(
        state.getAxiosRetryConfig().retryCondition!(errorWithStatus(500))
      ).toBe(serverError);
    });

    it('does not retry a POST returning 429', () => {
      expect(
        state.getAxiosRetryConfig().retryCondition!(errorWithStatus(429))
      ).toBe(false);
    });
  });

  it.each(['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND'])(
    'retries %s without a response with everything',
    (code) => {
      state.setAxiosRetryStrategy(Constants.RETRY_EVERYTHING_KEY);
      expect(
        state.getAxiosRetryConfig().retryCondition!(
          new AxiosError('Network failure', code)
        )
      ).toBe(true);
    }
  );

  it('preserves retries for idempotent requests with network', () => {
    state.setAxiosRetryStrategy(Constants.RETRY_NETWORK_KEY);
    expect(
      state.getAxiosRetryConfig().retryCondition!(errorWithStatus(500, 'get'))
    ).toBe(true);
  });
});
