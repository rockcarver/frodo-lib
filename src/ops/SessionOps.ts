import {
  getSessionInfo as _getSessionInfo,
  type SessionInfoType,
} from '../api/SessionApi';
import { State } from '../shared/State';
import { FrodoError } from './FrodoError';

export type Session = {
  /**
   * Get session info
   * @param {string} tokenId session token
   * @returns {Promise<SessionInfoType>} a promise resolving to a session info object
   */
  getSessionInfo(tokenId: string): Promise<SessionInfoType>;
};

export default (state: State): Session => {
  return {
    async getSessionInfo(tokenId: string): Promise<SessionInfoType> {
      return getSessionInfo({ tokenId, state });
    },
  };
};

/**
 * Get session info
 * @param {string} tokenId session token
 * @returns {Promise<SessionInfoType>} a promise resolving to a session info object
 */
export async function getSessionInfo({
  tokenId,
  state,
}: {
  tokenId: string;
  state: State;
}): Promise<SessionInfoType> {
  try {
    return _getSessionInfo({ tokenId, state });
  } catch (error) {
    throw new FrodoError(`Error getting session info`, error);
  }
}
