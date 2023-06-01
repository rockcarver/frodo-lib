import { queryAllManagedObjectsByType } from '../api/IdmConfigApi';
import State from '../shared/State';
import { printMessage } from './utils/Console';

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
        printMessage(queryAllManagedObjectsByTypeError, 'error');
        printMessage(
          `Error querying ${getRealmManagedOrganization({
            state,
          })} objects: ${queryAllManagedObjectsByTypeError}`,
          'error'
        );
      }
      orgs.concat(result.result);
      printMessage('.', 'text', false);
    } while (result.pagedResultsCookie);
  } catch (error) {
    printMessage(error.response.data, 'error');
    printMessage(`Error retrieving all organizations: ${error}`, 'error');
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
      printMessage(queryAllManagedObjectsByTypeError, 'error');
      printMessage(
        `Error querying ${getRealmManagedOrganization({
          state,
        })} objects: ${queryAllManagedObjectsByTypeError}`,
        'error'
      );
    }
    orgs.concat(result.result);
    printMessage('.', 'text', false);
  } while (result.pagedResultsCookie);
  return orgs;
}
