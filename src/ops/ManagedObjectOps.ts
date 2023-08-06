import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import {
  getManagedObject as _getManagedObject,
  createManagedObject as _createManagedObject,
  putManagedObject as _putManagedObject,
  deleteManagedObject as _deleteManagedObject,
  findManagedObjects as _findManagedObjects,
  queryAllManagedObjectsByType,
} from '../api/ManagedObjectApi';
import { State } from '../shared/State';

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
   * Find managed objects
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} filter CREST search filter
   * @param {string[]} fields array of fields to return
   * @return {Promise<IdObjectSkeletonInterface[]>} a promise resolving to an array of managed objects
   */
  findManagedObjects(
    type: string,
    filter: string,
    fields: string[]
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
    async deleteManagedObject(
      type: string,
      id: string
    ): Promise<IdObjectSkeletonInterface> {
      return deleteManagedObject({ type, id, state });
    },
    async findManagedObjects(
      type: string,
      filter: string,
      fields: string[]
    ): Promise<IdObjectSkeletonInterface[]> {
      return findManagedObjects({ type, filter, fields, state });
    },
    async resolveUserName(type: string, id: string) {
      return resolveUserName({ type, id, state });
    },
    async resolveFullName(type: string, id: string) {
      return resolveFullName({ type, id, state });
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
  if (id)
    return _putManagedObject({ type, id, moData, failIfExists: true, state });
  return _createManagedObject({ moType: type, moData, state });
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
  return _getManagedObject({ type, id, fields, state });
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
  return _putManagedObject({ type, id, moData, state });
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
  return _deleteManagedObject({ type, id, state });
}

export async function findManagedObjects({
  type,
  filter,
  fields,
  state,
}: {
  type: string;
  filter: string;
  fields: string[];
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  const { result } = await _findManagedObjects({ type, filter, fields, state });
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
