import util from 'util';

import { State } from '../../shared/State';
import { printMessage } from '../../utils/Console';
import { IdObjectSkeletonInterface, PagedResult } from '../ApiTypes';
import { generateAmApi } from '../BaseApi';

const serverURLTemplate = '%s/json/global-config/servers/%s';
const serversURLTemplate = '%s/json/global-config/servers?_queryFilter=true';
const propertiesURLTemplate = serverURLTemplate + '/properties/%s';
const defaultPropertiesURLTemplate =
  '%s/json/global-config/servers/server-default/properties/%s';
const propertyTypes = [
  'advanced',
  'cts',
  'directoryConfiguration',
  'general',
  'sdk',
  'security',
  'session',
  'uma',
];

const apiVersion = 'protocol=2.1,resource=1.0';

function getApiConfig() {
  return {
    apiVersion,
  };
}

export type ServerSkeleton = IdObjectSkeletonInterface & {
  url: string;
  siteName: string;
};

export type ServerPropertiesSkeleton = {
  advanced: object;
  cts: object;
  directoryConfiguration: object;
  general: object;
  sdk: object;
  security: object;
  session: object;
  uma: object;
};

/**
 * Get server
 * @param {string} serverId Server id
 * @returns {Promise<ServerSkeleton>} a promise that resolves to a server object
 */
export async function getServer({
  serverId,
  state,
}: {
  serverId: string;
  state: State;
}): Promise<ServerSkeleton> {
  const urlString = util.format(serverURLTemplate, state.getHost(), serverId);
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Get all servers
 * @returns {Promise<PagedResult<ServerSkeleton[]>>} a promise that resolves to an array of server objects
 */
export async function getServers({
  state,
}: {
  state: State;
}): Promise<PagedResult<ServerSkeleton>> {
  const urlString = util.format(serversURLTemplate, state.getHost());
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get server properties
 * @param {string} serverId Server id
 * @returns {Promise<ServerPropertiesSkeleton>} a promise that resolves to a server properties object
 */
export async function getServerProperties({
  serverId,
  state,
}: {
  serverId: string;
  state: State;
}): Promise<ServerPropertiesSkeleton> {
  const properties = {};
  for (const property of propertyTypes) {
    const urlString = util.format(
      propertiesURLTemplate,
      state.getHost(),
      serverId,
      property
    );
    try {
      const { data } = await generateAmApi({
        resource: getApiConfig(),
        state,
      }).get(urlString, {
        withCredentials: true,
      });
      properties[property] = data;
    } catch (e) {
      printMessage({
        message: `Error exporting server properties for server with id '${serverId}' from url '${urlString}': ${e.message}`,
        type: 'error',
        state,
      });
    }
  }
  return properties as ServerPropertiesSkeleton;
}

/**
 * Get default server properties
 * @returns {Promise<ServerPropertiesSkeleton>} a promise that resolves to a server properties object
 */
export async function getDefaultServerProperties({
  state,
}: {
  state: State;
}): Promise<ServerPropertiesSkeleton> {
  const properties = {} as ServerPropertiesSkeleton;
  for (const property of propertyTypes) {
    const urlString = util.format(
      defaultPropertiesURLTemplate,
      state.getHost(),
      property
    );
    try {
      const { data } = await generateAmApi({
        resource: getApiConfig(),
        state,
      }).get(urlString, {
        withCredentials: true,
      });
      properties[property] = data;
    } catch (e) {
      printMessage({
        message: `Error exporting default server properties from url '${urlString}': ${e.message}`,
        type: 'error',
        state,
      });
    }
  }
  return properties;
}

/**
 * Creates a server
 * @param {ServerSkeleton} serverData server object
 * @returns {Promise<ServerSkeleton>} a promise that resolves to a server object
 */
export async function createServer({
  serverData,
  state,
}: {
  serverData: ServerSkeleton;
  state;
}): Promise<ServerSkeleton> {
  const urlString = util.format(
    serverURLTemplate,
    state.getHost(),
    serverData._id
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).put(urlString, serverData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put server properties
 * @param {string} serverId
 * @param {ServerPropertiesSkeleton} serverPropertiesData server properties object
 * @returns {Promise<ServerPropertiesSkeleton>} a promise that resolves to a server properties object
 */
export async function putServerProperties({
  serverId,
  serverPropertiesData,
  state,
}: {
  serverId;
  serverPropertiesData: ServerPropertiesSkeleton;
  state;
}): Promise<ServerPropertiesSkeleton> {
  const result = {} as ServerPropertiesSkeleton;
  for (const [property, propertyData] of Object.entries(serverPropertiesData)) {
    const urlString = util.format(
      propertiesURLTemplate,
      state.getHost(),
      serverId,
      property
    );
    const { data } = await generateAmApi({
      resource: getApiConfig(),
      state,
    }).put(urlString, propertyData, {
      withCredentials: true,
      headers: { 'If-Match': '*' },
    });
    result[property] = data;
  }
  return result;
}

/**
 * Put default server properties
 * @param {ServerPropertiesSkeleton} defaultServerPropertiesData default server properties object
 * @returns {Promise<ServerPropertiesSkeleton>} a promise that resolves to a default server properties object
 */
export async function putDefaultServerProperties({
  defaultServerPropertiesData,
  state,
}: {
  defaultServerPropertiesData: ServerPropertiesSkeleton;
  state;
}): Promise<ServerPropertiesSkeleton> {
  const result = {} as ServerPropertiesSkeleton;
  for (const [property, propertyData] of Object.entries(
    defaultServerPropertiesData
  )) {
    const urlString = util.format(
      defaultPropertiesURLTemplate,
      state.getHost(),
      property
    );
    const { data } = await generateAmApi({
      resource: getApiConfig(),
      state,
    }).put(urlString, propertyData, {
      withCredentials: true,
      headers: { 'If-Match': '*' },
    });
    result[property] = data;
  }
  return result;
}
