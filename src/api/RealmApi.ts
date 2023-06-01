import util from 'util';
import {
  getTenantURL,
  getCurrentRealmPath,
  getRealmName,
} from './utils/ApiUtils';
import { generateAmApi } from './BaseApi';
import State from '../shared/State';

const realmsListURLTemplate = '%s/json/global-config/realms/?_queryFilter=true';
const realmURLTemplate = '%s/json/global-config/realms/%s';

const apiVersion = 'protocol=2.0,resource=1.0';
const getApiConfig = () => {
  const configPath = getCurrentRealmPath();
  return {
    path: `${configPath}/am/json/global-config/realms`,
    apiVersion,
  };
};

/**
 * Get all realms
 * @returns {Promise} a promise that resolves to an object containing an array of realm objects
 */
export async function getRealms({ state }: { state: State }) {
  const urlString = util.format(realmsListURLTemplate, state.getHost());
  return generateAmApi({ resource: getApiConfig(), state }).get(urlString, {
    withCredentials: true,
  });
}

/**
 * Get realm by id
 * @param {String} id realm id
 * @returns {Promise} a promise that resolves to an object containing a realm object
 */
export async function getRealm({ id, state }: { id: string; state: State }) {
  const urlString = util.format(realmURLTemplate, state.getHost(), id);
  return generateAmApi({ resource: getApiConfig(), state }).get(urlString, {
    withCredentials: true,
  });
}

/**
 * Get realm by name
 * @param {String} name realm name
 * @returns {Promise} a promise that resolves to a realm object
 */
export async function getRealmByName({
  name,
  state,
}: {
  name: string;
  state: State;
}) {
  return getRealms({ state }).then((realms) => {
    for (const realm of realms.data.result) {
      if (getRealmName(name) === realm.name) {
        return realm;
      }
    }
    throw new Error(`Realm ${name} not found!`);
  });
}

/**
 * Put realm
 * @param {String} id realm id
 * @param {Object} data realm config object
 * @returns {Promise} a promise that resolves to an object containing a realm object
 */
export async function putRealm({
  id,
  data,
  state,
}: {
  id: string;
  data: object;
  state: State;
}) {
  const urlString = util.format(realmURLTemplate, state.getHost(), id);
  return generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    data,
    {
      withCredentials: true,
    }
  );
}

/**
 * Delete realm
 * @param {String} id realm id
 * @returns {Promise} a promise that resolves to an object containing a realm object
 */
export async function deleteRealm({ id, state }: { id: string; state: State }) {
  const urlString = util.format(
    realmURLTemplate,
    getTenantURL(state.getHost()),
    id
  );
  return generateAmApi({ resource: getApiConfig(), state }).delete(urlString, {
    withCredentials: true,
  });
}
