import { IdObjectSkeletonInterface, PagedResult } from '../api/ApiTypes';
import {
  createManagedObject as _createManagedObject,
  DEFAULT_PAGE_SIZE,
  deleteManagedObject as _deleteManagedObject,
  getManagedObject as _getManagedObject,
  type ManagedObjectPatchOperationInterface,
  patchManagedObject as _patchManagedObject,
  putManagedObject as _putManagedObject,
  queryAllManagedObjectsByType,
  queryManagedObjects as _queryManagedObjects,
} from '../api/ManagedObjectApi';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { FrodoError } from './FrodoError';

export type ManagedObject = {
  /**
   * Create managed object
   * @param {string} type managed object type, e.g. teammember or alpha_user
   * @param {IdObjectSkeletonInterface} moData managed object data
   * @param {string} id managed object _id
   */
  createManagedObject(
    type: string,
    moData: IdObjectSkeletonInterface,
    id?: string
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Read managed object
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} id managed object id
   * @param {string[]} id array of fields to include
   * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IdObjectSkeletonInterface
   */
  readManagedObject(
    type: string,
    id: string,
    fields: string[]
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Read all managed object of the specified type
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string[]} fields array of fields to return
   * @returns {Promise<IdObjectSkeletonInterface[]>} a promise that resolves to an array of IdObjectSkeletonInterfaces
   */
  readManagedObjects(
    type: string,
    fields: string[]
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Update managed object
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} id managed object id
   * @param {IdObjectSkeletonInterface} moData managed object data
   * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IdObjectSkeletonInterface
   */
  updateManagedObject(
    type: string,
    id: string,
    moData: IdObjectSkeletonInterface
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Partially update managed object through a collection of patch operations.
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} id managed object id
   * @param {ManagedObjectPatchOperationInterface[]} operations collection of patch operations to perform on the object
   * @param {string} rev managed object revision
   * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IdObjectSkeletonInterface
   */
  updateManagedObjectProperties(
    type: string,
    id: string,
    operations: ManagedObjectPatchOperationInterface[],
    rev?: string
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Partially update multiple managed object through a collection of patch operations.
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} filter CREST search filter
   * @param {ManagedObjectPatchOperationInterface[]} operations collection of patch operations to perform on the object
   * @param {string} rev managed object revision
   * @param {number} pageSize page size
   * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IdObjectSkeletonInterface
   */
  updateManagedObjectsProperties(
    type: string,
    filter: string,
    operations: ManagedObjectPatchOperationInterface[],
    rev?: string,
    pageSize?: number
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Delete managed object
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} id managed object id
   * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IdObjectSkeletonInterface
   */
  deleteManagedObject(
    type: string,
    id: string
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Delete managed objects by filter
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} filter filter
   * @returns {Promise<number>} a promise that resolves the number of deleted objects
   */
  deleteManagedObjects(type: string, filter: string): Promise<number>;
  /**
   * Query managed objects
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} filter CREST search filter
   * @param {string[]} fields array of fields to return
   * @return {Promise<IdObjectSkeletonInterface[]>} a promise resolving to an array of managed objects
   */
  queryManagedObjects(
    type: string,
    filter?: string,
    fields?: string[],
    pageSize?: number
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Resolve a managed object's uuid to a human readable username
   * @param {string} type managed object type, e.g. teammember or alpha_user
   * @param {string} id managed object _id
   * @returns {Promise<string>} resolved username or uuid if any error occurs during reslution
   */
  resolveUserName(type: string, id: string): Promise<string>;
  /**
   * Resolve a managed object's uuid to a human readable full name
   * @param {string} type managed object type, e.g. teammember or alpha_user
   * @param {string} id managed object _id
   * @returns {Promise<string>} resolved full name or uuid if any error occurs during reslution
   */
  resolveFullName(type: string, id: string): Promise<string>;
  /**
   * Resolve a perpetrator's uuid to a human readable string identifying the perpetrator
   * @param {string} id managed object _id
   * @returns {Promise<string>} resolved perpetrator descriptive string or uuid if any error occurs during reslution
   */
  resolvePerpetratorUuid(id: string): Promise<string>;
};

export default (state: State): ManagedObject => {
  return {
    async createManagedObject(
      type: string,
      moData: IdObjectSkeletonInterface,
      id: string = undefined
    ): Promise<IdObjectSkeletonInterface> {
      return createManagedObject({ type, id, moData, state });
    },
    async readManagedObject(
      type: string,
      id: string,
      fields: string[]
    ): Promise<IdObjectSkeletonInterface> {
      return readManagedObject({ type, id, fields, state });
    },
    async readManagedObjects(
      type: string,
      fields: string[]
    ): Promise<IdObjectSkeletonInterface[]> {
      return readManagedObjects({ type, fields, state });
    },
    async updateManagedObject(
      type: string,
      id: string,
      moData: IdObjectSkeletonInterface
    ): Promise<IdObjectSkeletonInterface> {
      return updateManagedObject({ type, id, moData, state });
    },
    async updateManagedObjectProperties(
      type: string,
      id: string,
      operations: ManagedObjectPatchOperationInterface[],
      rev?: string
    ): Promise<IdObjectSkeletonInterface> {
      return updateManagedObjectProperties({
        type,
        id,
        operations,
        rev,
        state,
      });
    },
    async updateManagedObjectsProperties(
      type: string,
      filter: string,
      operations: ManagedObjectPatchOperationInterface[],
      rev?: string,
      pageSize: number = DEFAULT_PAGE_SIZE
    ): Promise<IdObjectSkeletonInterface[]> {
      return updateManagedObjectsProperties({
        type,
        filter,
        operations,
        rev,
        pageSize,
        state,
      });
    },
    async deleteManagedObject(
      type: string,
      id: string
    ): Promise<IdObjectSkeletonInterface> {
      return deleteManagedObject({ type, id, state });
    },
    async deleteManagedObjects(type: string, filter: string): Promise<number> {
      return deleteManagedObjects({ type, filter, state });
    },
    async queryManagedObjects(
      type: string,
      filter: string = undefined,
      fields: string[] = [],
      pageSize: number = DEFAULT_PAGE_SIZE
    ): Promise<IdObjectSkeletonInterface[]> {
      return queryManagedObjects({ type, filter, fields, pageSize, state });
    },
    async resolveUserName(type: string, id: string) {
      return resolveUserName({ type, id, state });
    },
    async resolveFullName(type: string, id: string) {
      return resolveFullName({ type, id, state });
    },
    async resolvePerpetratorUuid(id: string): Promise<string> {
      return resolvePerpetratorUuid({ id, state });
    },
  };
};

export async function createManagedObject({
  type,
  id,
  moData,
  state,
}: {
  type: string;
  id?: string;
  moData: IdObjectSkeletonInterface;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    if (id)
      return _putManagedObject({ type, id, moData, failIfExists: true, state });
    return _createManagedObject({ moType: type, moData, state });
  } catch (error) {
    throw new FrodoError(
      `Error creating managed ${type} object${id ? ' (' + id + ')' : ''}`,
      error
    );
  }
}

export async function readManagedObject({
  type,
  id,
  fields,
  state,
}: {
  type: string;
  id: string;
  fields: string[];
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    return _getManagedObject({ type, id, fields, state });
  } catch (error) {
    throw new FrodoError(`Error reading managed ${type} object`, error);
  }
}

export async function readManagedObjects({
  type,
  fields,
  state,
}: {
  type: string;
  fields: string[];
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  try {
    let managedObjects: IdObjectSkeletonInterface[] = [];
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
        type,
        fields,
        pageCookie: result.pagedResultsCookie,
        state,
      });
      managedObjects = managedObjects.concat(result.result);
    } while (result.pagedResultsCookie);
    return managedObjects;
  } catch (error) {
    throw new FrodoError(`Error reading managed ${type} objects`, error);
  }
}

export async function updateManagedObject({
  type,
  id,
  moData,
  state,
}: {
  type: string;
  id: string;
  moData: IdObjectSkeletonInterface;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    return _putManagedObject({ type, id, moData, state });
  } catch (error) {
    throw new FrodoError(
      `Error updating managed ${type} object (${id})`,
      error
    );
  }
}

export async function updateManagedObjectProperties({
  type,
  id,
  operations,
  rev = null,
  state,
}: {
  type: string;
  id: string;
  operations: ManagedObjectPatchOperationInterface[];
  rev?: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    return _patchManagedObject({ type, id, operations, rev, state });
  } catch (error) {
    throw new FrodoError(
      `Error updating managed ${type} object properties (${id})`,
      error
    );
  }
}

export async function updateManagedObjectsProperties({
  type,
  filter,
  operations,
  rev = null,
  pageSize = DEFAULT_PAGE_SIZE,
  state,
}: {
  type: string;
  filter: string;
  operations: ManagedObjectPatchOperationInterface[];
  rev?: string;
  pageSize?: number;
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  const result: IdObjectSkeletonInterface[] = [];
  const errors = [];
  let page: PagedResult<IdObjectSkeletonInterface> = {
    result: [],
    resultCount: 0,
    pagedResultsCookie: null,
    totalPagedResultsPolicy: 'NONE',
    totalPagedResults: -1,
    remainingPagedResults: -1,
  };
  do {
    try {
      page = await _queryManagedObjects({
        type,
        filter,
        fields: [],
        pageSize,
        pageCookie: page.pagedResultsCookie,
        state,
      });
      for (const obj of page.result) {
        try {
          result.push(
            await _patchManagedObject({
              type,
              id: obj._id,
              operations,
              rev,
              state,
            })
          );
        } catch (error) {
          errors.push(error);
        }
      }
    } catch (error) {
      errors.push(error);
    }
  } while (page.pagedResultsCookie);
  if (errors.length > 0) {
    throw new FrodoError(
      `Error patching "${type}" objects matching filter "${filter}"`,
      errors
    );
  }
  return result;
}

export async function deleteManagedObject({
  type,
  id,
  state,
}: {
  type: string;
  id: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    return _deleteManagedObject({ type, id, state });
  } catch (error) {
    throw new FrodoError(
      `Error deleting managed ${type} object (${id})`,
      error
    );
  }
}

export async function deleteManagedObjects({
  type,
  filter,
  state,
}: {
  type: string;
  filter: string;
  state: State;
}): Promise<number> {
  let count = 0;
  const errors = [];
  let result: PagedResult<IdObjectSkeletonInterface> = {
    result: [],
    resultCount: 0,
    pagedResultsCookie: null,
    totalPagedResultsPolicy: 'NONE',
    totalPagedResults: -1,
    remainingPagedResults: -1,
  };
  do {
    try {
      result = await _queryManagedObjects({
        type,
        filter,
        fields: ['_id'],
        pageCookie: result.pagedResultsCookie,
        state,
      });
      for (const obj of result.result) {
        await deleteManagedObject({ type, id: obj._id, state });
        count++;
      }
    } catch (error) {
      errors.push(error);
    }
  } while (result.pagedResultsCookie);
  if (errors.length > 0) {
    throw new FrodoError(
      `Error deleting "${type}" objects matching filter "${filter}". Successfully deleted ${count} objects.`,
      errors
    );
  }
  return count;
}

export async function queryManagedObjects({
  type,
  filter = 'true',
  fields = ['*'],
  pageSize = DEFAULT_PAGE_SIZE,
  state,
}: {
  type: string;
  filter?: string;
  fields?: string[];
  pageSize?: number;
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  const result: IdObjectSkeletonInterface[] = [];
  const errors = [];
  let page: PagedResult<IdObjectSkeletonInterface> = {
    result: [],
    resultCount: 0,
    pagedResultsCookie: null,
    totalPagedResultsPolicy: 'NONE',
    totalPagedResults: -1,
    remainingPagedResults: -1,
  };
  do {
    try {
      page = await _queryManagedObjects({
        type,
        filter,
        fields,
        pageSize,
        pageCookie: page.pagedResultsCookie,
        state,
      });
      result.push(...page.result);
    } catch (error) {
      errors.push(error);
    }
  } while (page.pagedResultsCookie);
  if (errors.length > 0) {
    throw new FrodoError(
      `Error querying "${type}" objects matching filter "${filter}"`,
      errors
    );
  }
  return result;
}

export async function resolveUserName({
  type,
  id,
  state,
}: {
  type: string;
  id: string;
  state: State;
}): Promise<string> {
  try {
    return (
      await _getManagedObject({
        type,
        id,
        fields: ['userName'],
        state,
      })
    ).userName as string;
  } catch (error) {
    // ignore
  }
  return id;
}

export async function resolveFullName({
  type,
  id,
  state,
}: {
  type: string;
  id: string;
  state: State;
}): Promise<string> {
  try {
    const managedObject = await _getManagedObject({
      type,
      id,
      fields: ['givenName', 'sn'],
      state,
    });
    return `${managedObject.givenName} ${managedObject.sn}`;
  } catch (error) {
    // ignore
  }
  return id;
}

export async function resolvePerpetratorUuid({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<string> {
  try {
    if (state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY) {
      const lookupPromises: Promise<IdObjectSkeletonInterface>[] = [];
      lookupPromises.push(
        _getManagedObject({
          type: 'teammember',
          id,
          fields: ['givenName', 'sn', 'userName'],
          state,
        })
      );
      lookupPromises.push(
        _getManagedObject({
          type: 'svcacct',
          id,
          fields: ['name', 'description'],
          state,
        })
      );
      lookupPromises.push(
        _getManagedObject({
          type: 'alpha_user',
          id,
          fields: ['givenName', 'sn', 'userName'],
          state,
        })
      );
      lookupPromises.push(
        _getManagedObject({
          type: 'bravo_user',
          id,
          fields: ['givenName', 'sn', 'userName'],
          state,
        })
      );
      const lookupResults = await Promise.allSettled(lookupPromises);
      // tenant admin
      if (lookupResults[0].status === 'fulfilled') {
        const admin = lookupResults[0].value;
        return `Admin user: ${admin.givenName} ${admin.sn} (${admin.userName})`;
      }
      // service account
      if (lookupResults[1].status === 'fulfilled') {
        const sa = lookupResults[1].value;
        return `Service account: ${sa.name} (${sa.description})`;
      }
      // alpha user
      if (lookupResults[2].status === 'fulfilled') {
        const user = lookupResults[2].value;
        return `Alpha user: ${user.givenName} ${user.sn} (${user.userName})`;
      }
      // bravo user
      if (lookupResults[3].status === 'fulfilled') {
        const user = lookupResults[3].value;
        return `Bravo user:${user.givenName} ${user.sn} (${user.userName})`;
      }
    } else {
      const user = await _getManagedObject({
        type: 'user',
        id,
        fields: ['givenName', 'sn', 'userName'],
        state,
      });
      return `${user.givenName} ${user.sn} (${user.userName})`;
    }
  } catch (error) {
    // ignore
  }
  return id;
}
