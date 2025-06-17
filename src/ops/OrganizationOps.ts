import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import { queryAllManagedObjectsByType } from '../api/ManagedObjectApi';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { FrodoError } from './FrodoError';

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
  if (
    state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY ||
    state.getUseRealmPrefixOnManagedObjects() === true
  ) {
    realmManagedOrg = `${state.getRealm()}_organization`;
    debugMessage({
      message: `DeploymentType === cloud or UseRealmPrefixOnManagedObjects is true, returning '${realmManagedOrg}'`,
      state: state,
    });
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
      orgs = orgs.concat(result.result);
    } catch (error) {
      errors.push(error);
    }
  } while (result.pagedResultsCookie);
  if (errors.length > 0) {
    throw new FrodoError(`Error reading organizations`, errors);
  }
  return orgs;
}

// unfinished work
export async function listOrganizationsTopDown({ state }: { state: State }) {
  try {
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
      result = await queryAllManagedObjectsByType({
        type: getRealmManagedOrganization({ state }),
        fields: ['name', 'parent/*/name', 'children/*/name'],
        pageCookie: result.pagedResultsCookie,
        state,
      });
      orgs.concat(result.result);
    } while (result.pagedResultsCookie);
    return orgs;
  } catch (error) {
    throw new FrodoError(`Error querying organizations`, error);
  }
}
