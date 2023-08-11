import { State } from '../shared/State';
import { queryAllManagedObjectsByType } from '../api/ManagedObjectApi';
import { printMessage } from '../utils/Console';
import Constants from '../shared/Constants';
import { IdObjectSkeletonInterface } from '../api/ApiTypes';

export type Organization = {
  /**
   * Get organization managed object type
   * @returns {string} organization managed object type in this realm
   */
  getRealmManagedOrganization(): string;
  /**
   * Read all organizations
   * @returns {Promise<IdObjectSkeletonInterface[]>} promise resolving to an array of organization objects
   */
  readOrganizations(): Promise<IdObjectSkeletonInterface[]>;

  // Deprecated

  /**
   * Get organizations
   * @returns {Promise<IdObjectSkeletonInterface[]>} promise resolving to an array of organization objects
   * @deprecated since v2.0.0 use {@link Organization.readOrganizations | readOrganizations} instead
   * ```javascript
   * readOrganizations(): Promise<IdObjectSkeletonInterface[]>
   * ```
   * @group Deprecated
   */
  getOrganizations(): Promise<IdObjectSkeletonInterface[]>;
};

export default (state: State): Organization => {
  return {
    getRealmManagedOrganization(): string {
      return getRealmManagedOrganization({ state });
    },
    async readOrganizations(): Promise<IdObjectSkeletonInterface[]> {
      return readOrganizations({ state });
    },

    // Deprecated

    async getOrganizations(): Promise<IdObjectSkeletonInterface[]> {
      return readOrganizations({ state });
    },
  };
};

/**
 * Get organization managed object type
 * @returns {String} organization managed object type in this realm
 */
export function getRealmManagedOrganization({ state }: { state: State }) {
  let realmManagedOrg = 'organization';
  if (state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY) {
    realmManagedOrg = `${state.getRealm()}_organization`;
  }
  return realmManagedOrg;
}

/**
 * Read all organizations
 * @returns {Promise<IdObjectSkeletonInterface[]>} promise resolving to an object containing an array of organization objects
 */
export async function readOrganizations({
  state,
}: {
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  let orgs = [];
  const errors = [];
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
      result = await queryAllManagedObjectsByType({
        type: getRealmManagedOrganization({ state }),
        fields: ['name', 'parent/*/name', 'children/*/name', '*'],
        pageCookie: result.pagedResultsCookie,
        state,
      });
    } catch (error) {
      errors.push(error);
    }
    orgs = orgs.concat(result.result);
  } while (result.pagedResultsCookie);
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Error:\n${errorMessages}`);
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
