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

/**
 * A state of a Cloud deployment that holds a bearer token for the IDM, so that a request of the IDM api goes out without a
 * login.
 * @returns {State} the state
 */
export function newState(): State {
  const state = StateImpl({ host: HOST });
  state.setDeploymentType('cloud');
  state.setBearerTokenMeta({
    access_token: 'sample-bearer-token',
    token_type: 'Bearer',
    scope: 'fr:idm:*',
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
