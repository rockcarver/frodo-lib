import { getCurrentRealmPath } from './utils/ApiUtils';
import util from 'util';
import storage from '../storage/SessionStorage';
import { generateAmApi } from './BaseApi';

const serviceURLTemplate = '%s/json%s/realm-config/services/%s';
const serviceURLNextDescendentsTemplate =
  '%s/json%s/realm-config/services/%s?_action=nextdescendents';
const serviceURLNextDescendentsPutTemplate =
  '%s/json%s/realm-config/services/%s/%s/%s';
const serviceListURLTemplate =
  '%s/json%s/realm-config/services?_queryFilter=true';
const apiVersion = 'protocol=2.0,resource=1.0';

function getApiConfig() {
  const configPath = getCurrentRealmPath();
  return {
    path: `${configPath}/realm-config/services`,
    apiVersion,
  };
}

// TODO: move this to a common place
type PagedResult<Result> = {
  result: Result[];
  resultCount: number;
  pagedResultsCookie: string;
  totalPagedResultsPolicy: 'EXACT';
  totalPagedResults: number;
  remainingPagedResults: number;
};

export interface ServiceListItem {
  /**
   * The identifier for the service - used to construct the subpath for the service
   */
  _id: string;
  /**
   * The user-facing name of the service
   */
  name: string;
  /**
   * The revision number of the service
   */
  _rev: string;
}

export interface Service {
  _id: '';
  _rev: string;
  _type: {
    _id: string;
    name: string;
    collection: boolean;
  };
  [key: string]: any;
}

export interface ServiceNextDescendent {
  [key: string]: any;
}

export async function getServiceList(): Promise<ServiceListItem[]> {
  const urlString = util.format(
    serviceListURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath()
  );
  return generateAmApi(getApiConfig())
    .get<PagedResult<ServiceListItem>>(urlString, {
      withCredentials: true,
    })
    .then((response) => response.data.result);
}

export async function getService(id: string): Promise<Service> {
  const urlString = util.format(
    serviceURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    id
  );
  return generateAmApi(getApiConfig())
    .get<Service>(urlString, {
      withCredentials: true,
    })
    .then((response) => response.data);
}

export async function getServiceNextDescendents(
  id: string
): Promise<ServiceNextDescendent[]> {
  const urlString = util.format(
    serviceURLNextDescendentsTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    id
  );
  return generateAmApi(getApiConfig())
    .post<ServiceNextDescendent[]>(urlString, {
      withCredentials: true,
    })
    .then((response) => response.data)
    .catch((error) => {
      if (error.response.status === 403) {
        return [];
      }
      throw error;
    });
}

export async function putService(id: string, data: Service): Promise<void> {
  const urlString = util.format(
    serviceURLTemplate,
    storage.session.getTenant(),
    storage.session.getRealm(),
    id
  );
  return generateAmApi(getApiConfig()).put(urlString, data, {
    withCredentials: true,
  });
}

export async function putServiceDescendents(
  serviceId: string,
  type: string,
  id: string,
  data: ServiceNextDescendent
): Promise<unknown> {
  const urlString = util.format(
    serviceURLNextDescendentsPutTemplate,
    storage.session.getTenant(),
    storage.session.getRealm(),
    serviceId,
    type,
    id
  );
  return generateAmApi(getApiConfig()).put(urlString, data, {
    withCredentials: true,
  });
}

export async function deleteService(id: string): Promise<unknown> {
  const urlString = util.format(
    serviceURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    id
  );
  return generateAmApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
}

export async function deleteServiceNextDescendents(
  serviceId: string,
  type: string,
  id: string
) {
  const urlString = util.format(
    serviceURLNextDescendentsPutTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    serviceId,
    type,
    id
  );
  return generateAmApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
}
