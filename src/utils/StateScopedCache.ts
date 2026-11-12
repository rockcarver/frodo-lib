import { type State } from '../shared/State';
import { getIdmBaseUrl } from './ForgeRockUtils';

/**
 * A cache of values that describe the tenant an instance talks to, such as the
 * schema of a managed object type.
 *
 * A process can hold several instances (the MCP server with several
 * connections, `createInstance` consumers, scripts), each of them logged in to
 * its own tenant. A cache that lives in the module would hand the value of the
 * tenant that asked first to all of them. This cache is kept for each state, in
 * a `WeakMap` like `authenticatedAs` and `loginsInFlight` in `AuthenticateOps`,
 * and it is tied to the IDM base URL the values were read from: an instance
 * that is pointed at another host starts with an empty cache.
 */
export type StateScopedCache<V> = {
  /**
   * Get the value kept under `key` for the tenant the state is pointed at
   * @param {State} state library state
   * @param {string} key key, such as a managed object type
   * @returns {V | undefined} the value, or undefined if the state has none
   */
  get(state: State, key: string): V | undefined;
  /**
   * Keep a value under `key` for the tenant the state is pointed at
   * @param {State} state library state
   * @param {string} key key, such as a managed object type
   * @param {V} value value to keep
   */
  set(state: State, key: string, value: V): void;
  /**
   * Drop the value kept under `key` for the state. Other states keep theirs.
   * @param {State} state library state
   * @param {string} key key, such as a managed object type
   */
  delete(state: State, key: string): void;
};

/**
 * Create a cache that is kept for each state
 * @returns {StateScopedCache<V>} an empty cache
 */
export function createStateScopedCache<V>(): StateScopedCache<V> {
  const entries = new WeakMap<
    State,
    { source: string; values: Map<string, V> }
  >();

  /**
   * The values of a state for the tenant it is pointed at now
   * @param {State} state library state
   * @returns {Map<string, V>} the values
   */
  function valuesOf(state: State): Map<string, V> {
    const source = getIdmBaseUrl(state);
    let entry = entries.get(state);
    if (!entry || entry.source !== source) {
      entry = { source, values: new Map<string, V>() };
      entries.set(state, entry);
    }
    return entry.values;
  }

  return {
    get: (state, key) => valuesOf(state).get(key),
    set: (state, key, value) => {
      valuesOf(state).set(key, value);
    },
    delete: (state, key) => {
      valuesOf(state).delete(key);
    },
  };
}
