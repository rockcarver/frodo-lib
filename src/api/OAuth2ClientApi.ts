import util from 'util';
import { generateAmApi } from './BaseApi';
import { deleteDeepByKey, getCurrentRealmPath } from './utils/ApiUtils';
import * as state from '../shared/State';
import { OAuth2ClientSkeleton, PagedResults } from './ApiTypes';

const oauth2ClientURLTemplate = '%s/json%s/realm-config/agents/OAuth2Client/%s';
const oauth2ClientListURLTemplate =
  '%s/json%s/realm-config/agents/OAuth2Client?_queryFilter=true';
const apiVersion = 'protocol=2.1,resource=1.0';
const getApiConfig = () => {
  const configPath = getCurrentRealmPath();
  return {
    path: `${configPath}/realm-config/agents/OAuth2Client`,
    apiVersion,
  };
};

/**
 * Get OAuth2 Clients
 * @returns {Promise<PagedResults>} a promise that resolves to a PagedResults object containing an array of oauth2client objects
 */
export async function getOAuth2Clients(): Promise<PagedResults> {
  const urlString = util.format(
    oauth2ClientListURLTemplate,
    state.getHost(),
    getCurrentRealmPath()
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get OAuth2 Client
 * @param {string} id client id
 * @returns {Promise<OAuth2ClientSkeleton>} a promise that resolves to an oauth2 client object
 */
export async function getOAuth2Client(
  id: string
): Promise<OAuth2ClientSkeleton> {
  const urlString = util.format(
    oauth2ClientURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    id
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put OAuth2 Client
 * @param {string} id client id
 * @param {OAuth2ClientSkeleton} clientData oauth2client object
 * @returns {Promise<OAuth2ClientSkeleton>} a promise that resolves to an oauth2 client object
 */
export async function putOAuth2Client(
  id: string,
  clientData: OAuth2ClientSkeleton
): Promise<OAuth2ClientSkeleton> {
  // until we figure out a way to use transport keys in Frodo,
  // we'll have to drop those encrypted attributes.
  const client = deleteDeepByKey(clientData, '-encrypted');
  delete client._provider;
  delete client._rev;
  const urlString = util.format(
    oauth2ClientURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    id
  );
  const { data } = await generateAmApi(getApiConfig()).put(urlString, client, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete OAuth2 Client
 * @param {string} id OAuth2 Client
 * @returns {Promise<OAuth2ClientSkeleton>} a promise that resolves to an oauth2client object
 */
export async function deleteOAuth2Client(
  id: string
): Promise<OAuth2ClientSkeleton> {
  const urlString = util.format(
    oauth2ClientURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    id
  );
  const { data } = await generateAmApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
