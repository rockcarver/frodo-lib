import util from 'util';

import { State } from '../shared/State';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { generateAmApi } from './BaseApi';

const getSessionInfoURLTemplate = '%s/json%s/sessions/?_action=getSessionInfo';
const apiVersion = 'resource=4.0';

function getApiConfig() {
  return {
    apiVersion,
  };
}

export type SessionInfoType = {
  username: string;
  universalId: string;
  realm: string;
  latestAccessTime: string;
  maxIdleExpirationTime: string;
  maxSessionExpirationTime: string;
  properties: {
    AMCtxId: string;
    [k: string]: string;
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
  const urlString = util.format(
    getSessionInfoURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).post(
    urlString,
    {
      tokenId,
    },
    {
      withCredentials: true,
    }
  );
  return data as SessionInfoType;
}
