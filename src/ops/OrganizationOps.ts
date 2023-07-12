import { queryAllManagedObjectsByType } from '../api/IdmConfigApi';
import { State } from '../shared/State';
import { printMessage } from './utils/Console';

export type Organization = {
  /**
   * Get organization managed object type
   * @returns {String} organization managed object type in this realm
   */
  getRealmManagedOrganization(): string;
  /**
   * Get organizations
   * @returns {Promise} promise resolving to an object containing an array of organization objects
   */
  getOrganizations(): Promise<any[]>;
};

export default (state: State): Organization => {
  return {
    /**
     * Get organization managed object type
     * @returns {String} organization managed object type in this realm
     */
    getRealmManagedOrganization() {
      return getRealmManagedOrganization({ state });
    },

    /**
     * Get organizations
     * @returns {Promise} promise resolving to an object containing an array of organization objects
     */
    async getOrganizations() {
      return getOrganizations({ state });
    },
  };
};

/**
 * Get organization managed object type
 * @returns {String} organization managed object type in this realm
 */
export function getRealmManagedOrganization({ state }: { state: State }) {
  let realmManagedOrg = 'organization';
  if (state.getDeploymentType() === global.CLOUD_DEPLOYMENT_TYPE_KEY) {
    realmManagedOrg = `${state.getRealm()}_organization`;
  }
  return realmManagedOrg;
}

/**
 * Get organizations
 * @returns {Promise} promise resolving to an object containing an array of organization objects
 */
export async function getOrganizations({ state }: { state: State }) {
  const orgs = [];
  let result = {
    result: [],
    resultCount: 0,
    pagedResultsCookie: null,
    totalPagedResultsPolicy: 'NONE',
    totalPagedResults: -1,
    remainingPagedResults: -1,
  };
  try {
    do {
      try {
        // eslint-disable-next-line no-await-in-loop
        result = await queryAllManagedObjectsByType({
          type: getRealmManagedOrganization({ state }),
          fields: ['name', 'parent/*/name', 'children/*/name'],
          pageCookie: result.pagedResultsCookie,
          state,
        });
      } catch (queryAllManagedObjectsByTypeError) {
        printMessage({
          message: queryAllManagedObjectsByTypeError,
          type: 'error',
          state,
        });
        printMessage({
          message: `Error querying ${getRealmManagedOrganization({
            state,
          })} objects: ${queryAllManagedObjectsByTypeError}`,
          type: 'error',
          state,
        });
      }
      orgs.concat(result.result);
      printMessage({ message: '.', type: 'text', newline: false, state });
    } while (result.pagedResultsCookie);
  } catch (error) {
    printMessage({ message: error.response.data, type: 'error', state });
    printMessage({
      message: `Error retrieving all organizations: ${error}`,
      type: 'error',
      state,
    });
  }
  return orgs;
}

// unfinished work
export async function listOrganizationsTopDown({ state }: { state: State }) {
  const orgs = [];
  let result = {
    result: [],
    resultCount: 0,
    pagedResultsCookie: null,
    totalPagedResultsPolicy: 'NONE',
    totalPagedResults: -1,
    remainingPagedResults: -1,
  };
  do {
    try {
      // eslint-disable-next-line no-await-in-loop
      result = await queryAllManagedObjectsByType({
        type: getRealmManagedOrganization({ state }),
        fields: ['name', 'parent/*/name', 'children/*/name'],
        pageCookie: result.pagedResultsCookie,
        state,
      });
    } catch (queryAllManagedObjectsByTypeError) {
      printMessage({
        message: queryAllManagedObjectsByTypeError,
        type: 'error',
        state,
      });
      printMessage({
        message: `Error querying ${getRealmManagedOrganization({
          state,
        })} objects: ${queryAllManagedObjectsByTypeError}`,
        type: 'error',
        state,
      });
    }
    orgs.concat(result.result);
    printMessage({ message: '.', type: 'text', newline: false, state });
  } while (result.pagedResultsCookie);
  return orgs;
}
