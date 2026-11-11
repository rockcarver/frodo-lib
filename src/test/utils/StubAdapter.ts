import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';

/** One answer of a stub adapter. */
export type StubAnswer = {
  status?: number;
  headers?: Record<string, string>;
  data?: unknown;
};

/**
 * An axios adapter that answers the requests of an instance in turn without any network, the way the http adapter
 * does: a status of 400 or more rejects with an `AxiosError` that carries the response. Once the answers are used up
 * it repeats the last one.
 * @param {StubAnswer[]} answers the answers, in the order of the requests
 * @returns {{ adapter: AxiosAdapter; requests: AxiosRequestConfig[] }} the adapter and the configs of the requests it
 * has received
 */
export function stubAdapter(answers: StubAnswer[]): {
  adapter: AxiosAdapter;
  requests: AxiosRequestConfig[];
} {
  const requests: AxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    const answer = answers[Math.min(requests.length, answers.length - 1)];
    requests.push(config);
    const response: AxiosResponse = {
      status: answer.status ?? 200,
      statusText: 'sample status',
      headers: new AxiosHeaders(answer.headers ?? {}),
      config,
      data: answer.data ?? {},
    };
    if (response.status >= 400) {
      throw new AxiosError(
        `Request failed with status code ${response.status}`,
        response.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
        config,
        undefined,
        response
      );
    }
    return response;
  };
  return { adapter, requests };
}
