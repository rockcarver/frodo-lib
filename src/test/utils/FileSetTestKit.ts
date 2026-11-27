import { inspect } from 'node:util';
import axios, { type AxiosRequestConfig } from 'axios';
import StateImpl, { type State } from '../../shared/State';
import {
  createMemoryFileSetReader,
  type FileSetReader,
} from '../../utils/FileSetUtils';
import { stubAdapter, type StubAnswer } from './StubAdapter';

/**
 * What the tests of a pull and a push of a configuration type share: a state with a made-up host and a bearer token, a
 * tenant that is an axios adapter which answers the requests and keeps them, readers over made-up files, the chain of errors
 * below an error, and the paths of the functions of the facade. Test-only: nothing here touches a tenant, a file or the real
 * home.
 */

/** The made-up host of the sample data. */
export const HOST = 'https://openam-matrix.example.com/am';

/** The scope that the requests of the IDM api need. */
export const IDM_SCOPE = 'fr:idm:*';

/**
 * A state of a Cloud deployment that holds a bearer token, so that a request of an api goes out without a login. The
 * token carries the scope that a request checks before it is sent, so the scope has to be the one of the api that the test
 * talks to: the IDM api needs `fr:idm:*`, the api of the Cloud environment (the cookie domains, say) needs its own.
 * @param {{ scope?: string }} options the scope of the token. Default: the scope of the IDM api
 * @returns {State} the state
 */
export function newState({
  scope = IDM_SCOPE,
}: { scope?: string } = {}): State {
  const state = StateImpl({ host: HOST });
  state.setDeploymentType('cloud');
  state.setBearerTokenMeta({
    access_token: 'sample-bearer-token',
    token_type: 'Bearer',
    scope,
    expires_in: 3600,
    expires: Date.now() + 60 * 60 * 1000,
  } as never);
  return state;
}

const originalAdapter = axios.defaults.adapter;

/** Put the adapter of axios back; a test file calls it after each test. */
export function restoreAdapter(): void {
  axios.defaults.adapter = originalAdapter;
}

/**
 * Answer the requests of the instances that are created from now on, in turn, and keep them.
 * @param {StubAnswer[]} answers the answers; the last one is repeated
 * @returns {AxiosRequestConfig[]} the requests, which fill in as they are made
 */
export function answer(...answers: StubAnswer[]): AxiosRequestConfig[] {
  const stub = stubAdapter(answers);
  axios.defaults.adapter = stub.adapter;
  return stub.requests;
}

/**
 * What the tenant saw of each request, in a form to compare: the verb, the url, every header and the body.
 * @param {AxiosRequestConfig[]} requests the requests that an adapter kept
 * @returns {{ method: string; url: string; headers: Record<string, unknown>; data: unknown }[]} what was seen
 */
export function seen(requests: AxiosRequestConfig[]) {
  return requests.map((request) => ({
    method: String(request.method).toUpperCase(),
    url: request.url as string,
    headers: (
      request.headers as unknown as { toJSON(): Record<string, unknown> }
    ).toJSON(),
    data: request.data as unknown,
  }));
}

/**
 * A reader over files made up for a test.
 * @param {Record<string, string>} files the text of each file, by path
 * @returns {FileSetReader} the reader
 */
export const readerOf = (files: Record<string, string>): FileSetReader =>
  createMemoryFileSetReader({
    files: Object.entries(files).map(([path, content]) => ({ path, content })),
    ownedFolders: [],
  });

/**
 * A reader over files made up for a test that counts what it is asked for.
 * @param {Record<string, string>} files the text of each file, by path
 * @returns {{ reader: FileSetReader; asked: { read: string[]; listed: string[] } }} the reader and what it was asked for
 */
export function countingReader(files: Record<string, string>) {
  const inner = readerOf(files);
  const asked = { read: [] as string[], listed: [] as string[] };
  const reader: FileSetReader = {
    async listDirectory(path) {
      asked.listed.push(path);
      return inner.listDirectory(path);
    },
    async readFile(path) {
      asked.read.push(path);
      return inner.readFile(path);
    },
  };
  return { reader, asked };
}

/**
 * The errors below an error, with the error itself first.
 * @param {unknown} error the error
 * @returns {unknown[]} the error and every error nested in it
 */
export function chainOf(error: unknown): unknown[] {
  const chain: unknown[] = [error];
  for (const original of (error as { originalErrors?: unknown[] })
    .originalErrors ?? []) {
    chain.push(...chainOf(original));
  }
  return chain;
}

/**
 * Everything that a caller can see of a failure: the message and the stack of every error in it, the way it prints with
 * every field and the way it serializes. A test that must show that a text never reaches a caller looks for the text here.
 * @param {unknown} error the failure
 * @returns {string} the text of all of it
 */
export function everythingOf(error: unknown): string {
  return [
    chainOf(error)
      .map((e) => `${(e as Error).message}\n${(e as Error).stack}`)
      .join('\n'),
    inspect(error, { depth: null, showHidden: true }),
    JSON.stringify(error, Object.getOwnPropertyNames(error as object)),
  ].join('\n');
}

/**
 * The path of every function on the facade, as the capability registry writes it (`idm.config.pullKbaConfig`).
 * @param {unknown} root the facade
 * @returns {string[]} the paths
 */
export function facadePaths(root: unknown): string[] {
  const paths: string[] = [];
  const visited = new WeakSet<object>();
  const walk = (node: unknown, path: string[]): void => {
    if (!node || typeof node !== 'object' || visited.has(node)) return;
    visited.add(node);
    for (const [key, value] of Object.entries(node)) {
      // the state, the caches and the factory are not operations
      if (path.length === 0 && ['state', 'cache', 'factory'].includes(key)) {
        continue;
      }
      if (typeof value === 'function') paths.push([...path, key].join('.'));
      else walk(value, [...path, key]);
    }
  };
  walk(root, []);
  return paths;
}

/** A tenant that a test talks to through axios, with an adapter that answers. */
export type Tenant = {
  /** The state that the functions under test are given; its token has the scope that the tenant was made with. */
  state: State;
  /** The answers to the requests that follow, in turn; the last one is repeated. A status of 400 or more is a failure. */
  answer(...answers: StubAnswer[]): void;
  /** What the tenant has seen so far, one line for each request: the verb and the url. */
  seen(): string[];
  /** The body of each request that the tenant has seen, as it went out (`undefined` for a request without one). */
  bodies(): unknown[];
};

/**
 * A tenant whose api needs a scope: the requests go through axios, and an adapter answers them.
 * @param {{ scope?: string }} options the scope of the token of the state. Default: the scope of the IDM api
 * @returns {Tenant} the tenant
 */
export function axiosTenant({
  scope = IDM_SCOPE,
}: { scope?: string } = {}): Tenant {
  let requests: AxiosRequestConfig[] = [];
  return {
    state: newState({ scope }),
    answer: (...answers) => {
      requests = answer(...answers);
    },
    seen: () => seen(requests).map(({ method, url }) => `${method} ${url}`),
    bodies: () => seen(requests).map(({ data }) => data),
  };
}
