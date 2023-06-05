import util from 'util';
import { getTenantURL, getRealmName } from './utils/ApiUtils';
import { generateAmApi } from './BaseApi';
import State from '../shared/State';

const realmsListURLTemplate = '%s/json/global-config/realms/?_queryFilter=true';
const realmURLTemplate = '%s/json/global-config/realms/%s';

const apiVersion = 'protocol=2.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * Get all realms
 * @returns {Promise} a promise that resolves to an object containing an array of realm objects
 */
export async function getRealms({ state }: { state: State }) {
  const urlString = util.format(realmsListURLTemplate, state.getHost());
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Get realm by id
 * @param {String} realmId realm id
 * @returns {Promise} a promise that resolves to an object containing a realm object
 */
export async function getRealm({
  realmId,
  state,
}: {
  realmId: string;
  state: State;
}) {
  const urlString = util.format(realmURLTemplate, state.getHost(), realmId);
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Get realm by name
 * @param {String} realmName realm name
 * @returns {Promise} a promise that resolves to a realm object
 */
export async function getRealmByName({
  realmName,
  state,
}: {
  realmName: string;
  state: State;
}) {
  const { data } = await getRealms({ state }).then((realms) => {
    for (const realm of realms.data.result) {
      if (getRealmName(realmName) === realm.name) {
        return realm;
      }
    }
    throw new Error(`Realm ${realmName} not found!`);
  });
  return data;
}

/**
 * Put realm
 * @param {string} realmId realm id
 * @param {object} realmData realm config object
 * @returns {Promise} a promise that resolves to an object containing a realm object
 */
export async function putRealm({
  realmId,
  realmData,
  state,
}: {
  realmId: string;
  realmData: object;
  state: State;
}) {
  const urlString = util.format(realmURLTemplate, state.getHost(), realmId);
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    realmData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete realm
 * @param {String} realmId realm id
 * @returns {Promise} a promise that resolves to an object containing a realm object
 */
export async function deleteRealm({
  realmId,
  state,
}: {
  realmId: string;
  state: State;
}) {
  const urlString = util.format(
    realmURLTemplate,
    getTenantURL(state.getHost()),
    realmId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
