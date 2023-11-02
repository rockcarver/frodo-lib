import {
  getSessionInfo as _getSessionInfo,
  type SessionInfoType,
} from '../api/SessionApi';
import { State } from '../shared/State';

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
  return _getSessionInfo({ tokenId, state });
}
