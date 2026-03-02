import {
  abortDirectConfigurationSession as _abortDirectConfigurationSession,
  applyDirectConfigurationSession as _applyDirectConfigurationSession,
  DirectConfigurationSessionState,
  getDirectConfigurationSessionState as _getDirectConfigurationSessionState,
  initDirectConfigurationSession as _initDirectConfigurationSession,
} from '../../api/cloud/EnvDirectConfigurationSessionApi';
import { State } from '../../shared/State';
import { FrodoError } from '../FrodoError';

export type EnvDirectConfigurationSession = {
  /**
   * Initiate direct configuration session
   * @returns {Promise<DirectConfigurationSessionState>} a promise that resolves to a DirectConfigurationSessionState object
   */
  initDirectConfigurationSession(): Promise<DirectConfigurationSessionState>;
  /**
   * Apply direct configuration session
   * @returns {Promise<DirectConfigurationSessionState>} a promise that resolves to a DirectConfigurationSessionState object
   */
  applyDirectConfigurationSession(): Promise<DirectConfigurationSessionState>;
  /**
   * Abort direct configuration session
   * @returns {Promise<DirectConfigurationSessionState>} a promise that resolves to a DirectConfigurationSessionState object
   */
  abortDirectConfigurationSession(): Promise<DirectConfigurationSessionState>;
  /**
   * Read direct configuration session state
   * @returns {Promise<DirectConfigurationSessionState>} a promise that resolves to a DirectConfigurationSessionState object
   */
  readDirectConfigurationSessionState(): Promise<DirectConfigurationSessionState>;
};

export default (state: State): EnvDirectConfigurationSession => {
  return {
    async initDirectConfigurationSession(): Promise<DirectConfigurationSessionState> {
      return initDirectConfigurationSession({ state });
    },
    async applyDirectConfigurationSession(): Promise<DirectConfigurationSessionState> {
      return applyDirectConfigurationSession({ state });
    },
    async abortDirectConfigurationSession(): Promise<DirectConfigurationSessionState> {
      return abortDirectConfigurationSession({ state });
    },
    async readDirectConfigurationSessionState(): Promise<DirectConfigurationSessionState> {
      return readDirectConfigurationSessionState({ state });
    },
  };
};

/**
 * Initiate direct configuration session
 * @returns {Promise<DirectConfigurationSessionState>} a promise that resolves to a DirectConfigurationSessionState object
 */
export async function initDirectConfigurationSession({
  state,
}: {
  state: State;
}): Promise<DirectConfigurationSessionState> {
  try {
    const result = await _initDirectConfigurationSession({ state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error initiating direct configuration session`,
      error
    );
  }
}

/**
 * Apply direct configuration session
 * @returns {Promise<DirectConfigurationSessionState>} a promise that resolves to a DirectConfigurationSessionState object
 */
export async function applyDirectConfigurationSession({
  state,
}: {
  state: State;
}): Promise<DirectConfigurationSessionState> {
  try {
    const result = await _applyDirectConfigurationSession({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error applying direct configuration session`, error);
  }
}

/**
 * Abort direct configuration session
 * @returns {Promise<DirectConfigurationSessionState>} a promise that resolves to a DirectConfigurationSessionState object
 */
export async function abortDirectConfigurationSession({
  state,
}: {
  state: State;
}): Promise<DirectConfigurationSessionState> {
  try {
    const result = await _abortDirectConfigurationSession({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error aborting direct configuration session`, error);
  }
}

/**
 * Read direct configuration session state
 * @returns {Promise<DirectConfigurationSessionState>} a promise that resolves to a DirectConfigurationSessionState object
 */
export async function readDirectConfigurationSessionState({
  state,
}: {
  state: State;
}): Promise<DirectConfigurationSessionState> {
  try {
    const result = await _getDirectConfigurationSessionState({ state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error getting direct configuration session state`,
      error
    );
  }
}
