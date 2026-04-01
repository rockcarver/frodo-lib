import {
  IdObjectSkeletonInterface,
  PagedResult,
  PatchOperationInterface,
} from '../api/ApiTypes';
import {
  countManagedSystemObjects as _countManagedSystemObjects,
  createManagedSystemObject as _createManagedSystemObject,
  DEFAULT_PAGE_SIZE,
  deleteManagedSystemObject as _deleteManagedSystemObject,
  getManagedSystemObject as _getManagedSystemObject,
  patchManagedSystemObject as _patchManagedSystemObject,
  putManagedSystemObject as _putManagedSystemObject,
  queryAllManagedSystemObjectsByType as _queryAllManagedSystemObjectsByType,
  queryManagedSystemObjects as _queryManagedSystemObjects,
} from '../api/ManagedSystemObjectApi';
import { getManagedObject as _getManagedObject } from '../api/ManagedObjectApi';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { FrodoError } from './FrodoError';

export type ManagedObject = {
  /**
   * Create managed system object
   * @param {string} type managed system object type, e.g. teammember or alpha_user
   * @param {IdObjectSkeletonInterface} moData managed system object data
   * @param {string} id managed system object _id
   */
  createManagedSystemObject(
    type: string,
    moData: IdObjectSkeletonInterface,
    id?: string
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Read managed system object
   * @param {string} type managed system object type, e.g. alpha_user or user
   * @param {string} id managed system object id
   * @param {string[]} id array of fields to include
   * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IdObjectSkeletonInterface
   */
  readManagedSystemObject(
    type: string,
    id: string,
    fields: string[]
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Read all managed system object of the specified type
   * @param {string} type managed system object type, e.g. alpha_user or user
   * @param {string[]} fields array of fields to return
   * @returns {Promise<IdObjectSkeletonInterface[]>} a promise that resolves to an array of IdObjectSkeletonInterfaces
   */
  readManagedSystemObjects(
    type: string,
    fields: string[]
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Count managed system objects of the specified type.
   * @param {string} type managed system object type, e.g. teammember or svcacct
   * @param {string} filter CREST search filter
   * @returns {Promise<number>} a promise that resolves to the object count
   */
  countManagedSystemObjects(type: string, filter?: string): Promise<number>;
  /**
   * Update managed system object
   * @param {string} type managed system object type, e.g. alpha_user or user
   * @param {string} id managed system object id
   * @param {IdObjectSkeletonInterface} moData managed system object data
   * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IdObjectSkeletonInterface
   */
  updateManagedSystemObject(
    type: string,
    id: string,
    moData: IdObjectSkeletonInterface
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Partially update managed system object through a collection of patch operations.
   * @param {string} type managed system object type, e.g. alpha_user or user
   * @param {string} id managed system object id
   * @param {PatchOperationInterface[]} operations collection of patch operations to perform on the object
   * @param {string} rev managed system object revision
   * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IdObjectSkeletonInterface
   */
  updateManagedSystemObjectProperties(
    type: string,
    id: string,
    operations: PatchOperationInterface[],
    rev?: string
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Partially update multiple managed system object through a collection of patch operations.
   * @param {string} type managed system object type, e.g. alpha_user or user
   * @param {string} filter CREST search filter
   * @param {PatchOperationInterface[]} operations collection of patch operations to perform on the object
   * @param {string} rev managed system object revision
   * @param {number} pageSize page size
   * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IdObjectSkeletonInterface
   */
  updateManagedSystemObjectsProperties(
    type: string,
    filter: string,
    operations: PatchOperationInterface[],
    rev?: string,
    pageSize?: number
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Delete managed system object
   * @param {string} type managed system object type, e.g. alpha_user or user
   * @param {string} id managed system object id
   * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IdObjectSkeletonInterface
   */
  deleteManagedSystemObject(
    type: string,
    id: string
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Delete managed system objects by filter
   * @param {string} type managed system object type, e.g. alpha_user or user
   * @param {string} filter filter
   * @returns {Promise<number>} a promise that resolves the number of deleted objects
   */
  deleteManagedSystemObjects(type: string, filter: string): Promise<number>;
  /**
   * Query managed system objects
   * @param {string} type managed system object type, e.g. alpha_user or user
   * @param {string} filter CREST search filter
   * @param {string[]} fields array of fields to return
   * @return {Promise<IdObjectSkeletonInterface[]>} a promise resolving to an array of managed system objects
   */
  queryManagedSystemObjects(
    type: string,
    filter?: string,
    fields?: string[],
    pageSize?: number
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Resolve a managed system object's uuid to a human readable username
   * @param {string} type managed system object type, e.g. teammember or alpha_user
   * @param {string} id managed system object _id
   * @returns {Promise<string>} resolved username or uuid if any error occurs during reslution
   */
  resolveUserName(type: string, id: string): Promise<string>;
  /**
   * Resolve a managed system object's uuid to a human readable full name
   * @param {string} type managed system object type, e.g. teammember or alpha_user
   * @param {string} id managed system object _id
   * @returns {Promise<string>} resolved full name or uuid if any error occurs during reslution
   */
  resolveFullName(type: string, id: string): Promise<string>;
  /**
   * Resolve a perpetrator's uuid to a human readable string identifying the perpetrator
   * @param {string} id managed system object _id
   * @returns {Promise<string>} resolved perpetrator descriptive string or uuid if any error occurs during reslution
   */
  resolvePerpetratorUuid(id: string): Promise<string>;
};

export default (state: State): ManagedObject => {
  return {
    async createManagedSystemObject(
      type: string,
      moData: IdObjectSkeletonInterface,
      id: string = undefined
    ): Promise<IdObjectSkeletonInterface> {
      return createManagedSystemObject({ type, id, moData, state });
    },
    async readManagedSystemObject(
      type: string,
      id: string,
      fields: string[]
    ): Promise<IdObjectSkeletonInterface> {
      return readManagedSystemObject({ type, id, fields, state });
    },
    async readManagedSystemObjects(
      type: string,
      fields: string[]
    ): Promise<IdObjectSkeletonInterface[]> {
      return readManagedSystemObjects({ type, fields, state });
    },
    async countManagedSystemObjects(
      type: string,
      filter: string = 'true'
    ): Promise<number> {
      return countManagedSystemObjects({ type, filter, state });
    },
    async updateManagedSystemObject(
      type: string,
      id: string,
      moData: IdObjectSkeletonInterface
    ): Promise<IdObjectSkeletonInterface> {
      return updateManagedSystemObject({ type, id, moData, state });
    },
    async updateManagedSystemObjectProperties(
      type: string,
      id: string,
      operations: PatchOperationInterface[],
      rev?: string
    ): Promise<IdObjectSkeletonInterface> {
      return updateManagedSystemObjectProperties({
        type,
        id,
        operations,
        rev,
        state,
      });
    },
    async updateManagedSystemObjectsProperties(
      type: string,
      filter: string,
      operations: PatchOperationInterface[],
      rev?: string,
      pageSize: number = DEFAULT_PAGE_SIZE
    ): Promise<IdObjectSkeletonInterface[]> {
      return updateManagedSystemObjectsProperties({
        type,
        filter,
        operations,
        rev,
        pageSize,
        state,
      });
    },
    async deleteManagedSystemObject(
      type: string,
      id: string
    ): Promise<IdObjectSkeletonInterface> {
      return deleteManagedSystemObject({ type, id, state });
    },
    async deleteManagedSystemObjects(
      type: string,
      filter: string
    ): Promise<number> {
      return deleteManagedSystemObjects({ type, filter, state });
    },
    async queryManagedSystemObjects(
      type: string,
      filter: string = undefined,
      fields: string[] = [],
      pageSize: number = DEFAULT_PAGE_SIZE
    ): Promise<IdObjectSkeletonInterface[]> {
      return queryManagedSystemObjects({
        type,
        filter,
        fields,
        pageSize,
        state,
      });
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

export async function createManagedSystemObject({
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
      return _putManagedSystemObject({
        type,
        id,
        moData,
        failIfExists: true,
        state,
      });
    return _createManagedSystemObject({ type, moData, state });
  } catch (error) {
    throw new FrodoError(
      `Error creating managed ${type} object${id ? ' (' + id + ')' : ''}`,
      error
    );
  }
}

export async function readManagedSystemObject({
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
    return _getManagedSystemObject({ type, id, fields, state });
  } catch (error) {
    throw new FrodoError(`Error reading managed ${type} object`, error);
  }
}

export async function readManagedSystemObjects({
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
      result = await _queryAllManagedSystemObjectsByType({
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

export async function countManagedSystemObjects({
  type,
  filter = 'true',
  state,
}: {
  type: string;
  filter?: string;
  state: State;
}): Promise<number> {
  try {
    return _countManagedSystemObjects({ type, filter, state });
  } catch (error) {
    throw new FrodoError(
      `Error counting managed ${type} objects matching filter "${filter}"`,
      error
    );
  }
}

export async function updateManagedSystemObject({
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
    return _putManagedSystemObject({ type, id, moData, state });
  } catch (error) {
    throw new FrodoError(
      `Error updating managed ${type} object (${id})`,
      error
    );
  }
}

export async function updateManagedSystemObjectProperties({
  type,
  id,
  operations,
  rev = null,
  state,
}: {
  type: string;
  id: string;
  operations: PatchOperationInterface[];
  rev?: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    return _patchManagedSystemObject({ type, id, operations, rev, state });
  } catch (error) {
    throw new FrodoError(
      `Error updating managed ${type} object properties (${id})`,
      error
    );
  }
}

export async function updateManagedSystemObjectsProperties({
  type,
  filter,
  operations,
  rev = null,
  pageSize = DEFAULT_PAGE_SIZE,
  state,
}: {
  type: string;
  filter: string;
  operations: PatchOperationInterface[];
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
      page = await _queryManagedSystemObjects({
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
            await _patchManagedSystemObject({
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

export async function deleteManagedSystemObject({
  type,
  id,
  state,
}: {
  type: string;
  id: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    return _deleteManagedSystemObject({ type, id, state });
  } catch (error) {
    throw new FrodoError(
      `Error deleting managed ${type} object (${id})`,
      error
    );
  }
}

export async function deleteManagedSystemObjects({
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
      result = await _queryManagedSystemObjects({
        type,
        filter,
        fields: ['_id'],
        pageCookie: result.pagedResultsCookie,
        state,
      });
      for (const obj of result.result) {
        await deleteManagedSystemObject({ type, id: obj._id, state });
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

export async function queryManagedSystemObjects({
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
      page = await _queryManagedSystemObjects({
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
      await _getManagedSystemObject({
        type,
        id,
        fields: ['userName'],
        state,
      })
    ).userName as string;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    const managedObject = await _getManagedSystemObject({
      type,
      id,
      fields: ['givenName', 'sn'],
      state,
    });
    return `${managedObject.givenName} ${managedObject.sn}`;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        _getManagedSystemObject({
          type: 'teammember',
          id,
          fields: ['givenName', 'sn', 'userName'],
          state,
        })
      );
      lookupPromises.push(
        _getManagedSystemObject({
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  }
  return id;
}
