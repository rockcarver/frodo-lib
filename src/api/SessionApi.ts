import util from 'util';
import { State } from '../shared/State';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { generateAmAuthApi } from './BaseApi';

const getSessionInfoURLTemplate = '%s/json%s/sessions/?_action=getSessionInfo';
const logoutSessionURLTemplate = '%s/json%s/sessions?_action=logout';
const apiVersion = 'resource=4.0';
// the version of the logout call in the documentation
const logoutApiVersion = 'resource=3.1, protocol=1.0';

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
  const { data } = await generateAmAuthApi({
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

/**
 * Log out a session: AM ends the session that the token identifies and the token
 * stops working. The call carries the session token itself, in the header that
 * is named like the session cookie, and no other credential: it never starts a
 * login and does not depend on what the instance would use for its other calls.
 * @param {string} tokenId session token
 * @returns {Promise<{ result: string }>} a promise resolving to the answer of AM (`Successfully logged out`)
 */
export async function logoutSession({
  tokenId,
  state,
}: {
  tokenId: string;
  state: State;
}): Promise<{ result: string }> {
  const urlString = util.format(
    logoutSessionURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmAuthApi({
    resource: { apiVersion: logoutApiVersion },
    requestOverride: {
      headers: { [state.getCookieName() || 'iPlanetDirectoryPro']: tokenId },
    },
    // no credential of the instance is attached: the session to end is the credential
    anonymous: true,
    state,
  }).post(urlString);
  return data as { result: string };
}
