import {
  getRelease as _getRelease,
  Release,
} from '../../api/cloud/EnvReleaseApi';
import { State } from '../../shared/State';
import { FrodoError } from '../FrodoError';

export type EnvRelease = {
  /**
   * Read release information
   * @returns {Promise<Release>} a promise that resolves to a Release object
   */
  readRelease(): Promise<Release>;
};

export default (state: State): EnvRelease => {
  return {
    async readRelease(): Promise<Release> {
      return readRelease({ state });
    },
  };
};

/**
 * Read release information
 * @returns {Promise<Release>} a promise that resolves to a Release object
 */
export async function readRelease({
  state,
}: {
  state: State;
}): Promise<Release> {
  try {
    const domains = await _getRelease({ state });
    return domains;
  } catch (error) {
    throw new FrodoError(
      `Error reading federation enforcement configuration`,
      error
    );
  }
}
