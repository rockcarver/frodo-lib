/**
 * Run tests
 *
 *        npm run test:only BaseApi.errorSerialization.replays
 *
 * The error of a request that an instance of `BaseApi.ts` sends again and that
 * fails again: the instance sends the request again with the config of the first
 * one (after a 401 that ends the session of the request, after a 403 that a
 * higher level of access may answer, after a 429 that names a wait), and the
 * error of the second request has to be written as a view as well, whichever way
 * the request is sent. No network and no recordings: a stub adapter answers.
 */
import { jest } from '@jest/globals';
import type { AxiosError } from 'axios';
import StateImpl, { State } from '../shared/State';
import { allForms, MARKER_A, MARKER_D } from '../test/utils/SerializationForms';
import { settled, stubAdapter } from '../test/utils/StubAdapter';
import { generateAmApi, generateIdmApi, generateLogApi } from './BaseApi';

const BASE_URL = 'http://serialization.example.test';

const withAuthorization = (state: State) => {
  state.setUseBearerTokenForAmApis(true);
  state.setBearerTokenMeta({
    access_token: MARKER_A,
    token_type: 'Bearer',
    expires: Date.now() + 60 * 60 * 1000,
    scope: 'fr:am:* fr:idm:*',
  } as never);
};

function expectNoMarker(value: unknown, markers: string[]) {
  for (const [form, text] of Object.entries(allForms(value))) {
    for (const marker of markers) {
      if (text.includes(marker)) {
        throw new Error(`${marker} is in the form '${form}':\n${text}`);
      }
    }
  }
}

describe('a request that is sent again and fails again', () => {
  test('1: after a 401 that ends the session of the request, the error of the second request is a view', async () => {
    const state = StateImpl({});
    withAuthorization(state);
    let renewals = 0;
    state.setTokenRefreshHandler(async () => {
      renewals++;
    });
    state.setRejectedCredentialHandler(async () => true);
    const { adapter, requests } = stubAdapter([
      { status: 401, data: { code: 401, message: 'no session' } },
    ]);

    const error = await generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      requestOverride: { baseURL: BASE_URL, adapter },
    })
      .get('/things')
      .catch((caught: AxiosError) => caught);

    // the request was sent a second time, through the instance
    expect(requests).toHaveLength(2);
    expect(renewals).toBe(1);
    expect(error.response?.status).toBe(401);
    expect(typeof error.toJSON).toBe('function');
    expectNoMarker(error, [MARKER_A]);
    expect(JSON.parse(JSON.stringify(error))).toMatchObject({
      status: 401,
      method: 'GET',
      url: `${BASE_URL}/things`,
    });
  });

  test('2: after a 403 that a higher level of access may answer, the error of the second request is a view', async () => {
    const state = StateImpl({});
    withAuthorization(state);
    state.setActiveCredentialSource('browser' as never);
    let escalations = 0;
    // the first 403 is answered with a higher level of access, the second has none left
    state.setPrivilegeEscalationHandler(async () => ++escalations === 1);
    const { adapter, requests } = stubAdapter([
      { status: 403, data: { code: 403, message: 'denied' } },
    ]);

    const error = await generateIdmApi({
      requiredScopes: [],
      state,
      requestOverride: { baseURL: BASE_URL, adapter },
    })
      .get('/things')
      .catch((caught: AxiosError) => caught);

    expect(requests).toHaveLength(2);
    expect(escalations).toBe(2);
    expect(error.response?.status).toBe(403);
    expect(typeof error.toJSON).toBe('function');
    expectNoMarker(error, [MARKER_A]);
  });

  describe('after a 429 that names a wait', () => {
    beforeEach(() => {
      jest.useFakeTimers({
        now: Date.UTC(2026, 0, 1),
        doNotFake: ['nextTick', 'queueMicrotask'],
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('3: the error of the second request is a view', async () => {
      const state = StateImpl({});
      logKeys(state);
      const { adapter, requests } = stubAdapter([
        {
          status: 429,
          headers: { 'retry-after': '1' },
          data: { code: 429, message: 'rate limit exceeded' },
        },
      ]);
      const outcome = settled(
        generateLogApi({
          state,
          requestOverride: { baseURL: BASE_URL, adapter },
        })
          .get('/logs')
          .catch((caught: AxiosError) => caught)
      );

      await jest.advanceTimersByTimeAsync(10_000);

      expect(outcome.done).toBe(true);
      const error = outcome.value as AxiosError;
      expect(requests).toHaveLength(2);
      expect(error.response?.status).toBe(429);
      expect(typeof error.toJSON).toBe('function');
      expectNoMarker(error, [MARKER_A, MARKER_D]);
    });
  });
});

function logKeys(state: State) {
  state.setLogApiKey(MARKER_A);
  state.setLogApiSecret(MARKER_D);
}
