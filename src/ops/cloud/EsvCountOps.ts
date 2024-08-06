import {
  EsvCountResponse,
  getEsvCount as _getCountOfESVs,
} from '../../api/cloud/EsvCountApi';
import { State } from '../../shared/State';
import { FrodoError } from '../FrodoError';

export type EsvCount = {
  /**
   * Get count of ESV secrets and variables in the environment.
   * @returns {Promise<EsvCountResponse>} a promise that resolves to an object with counts of secrets and variables
   */
  getEsvCount(): Promise<EsvCountResponse>;
};

export default (state: State): EsvCount => {
  return {
    async getEsvCount(): Promise<EsvCountResponse> {
      return getEsvCount({ state });
    },
  };
};

export async function getEsvCount({
  state,
}: {
  state: State;
}): Promise<EsvCountResponse> {
  try {
    const counts = await _getCountOfESVs({ state });
    return counts;
  } catch (error) {
    throw new FrodoError(`Error counting ESVs`, error);
  }
}
