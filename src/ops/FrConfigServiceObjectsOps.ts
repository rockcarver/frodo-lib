import {
  getServiceObject as _getServiceObject,
  ServiceObjectEntry,
  ServiceObjectSkeleton,
} from '../api/FrConfigServiceObjectsApi';
import { State } from '../shared/State';
import { FrodoError } from './FrodoError';

export type FrConfigServiceObject = {
  getServiceObject(objectType, objectEntry): Promise<ServiceObjectSkeleton>;
};

export default (state: State): FrConfigServiceObject => {
  return {
    async getServiceObject(
      objectType: string,
      objectEntry: ServiceObjectEntry
    ): Promise<ServiceObjectSkeleton> {
      return getServiceObject({ objectType, objectEntry, state });
    },
  };
};

export async function getServiceObject({
  objectType,
  objectEntry,
  state,
}: {
  objectType: string;
  objectEntry: ServiceObjectEntry;
  state: State;
}): Promise<ServiceObjectSkeleton> {
  try {
    const response = await _getServiceObject({
      objectType,
      objectEntry,
      state,
    });

    const attributes = await escapePlaceholders(response);

    return attributes;
  } catch (error) {
    throw new FrodoError(
      `Error reading service object with ${objectEntry.searchField}= ${objectEntry.searchValue} from ${objectType}`,
      error
    );
  }
}

async function escapePlaceholders(content) {
  return JSON.parse(JSON.stringify(content).replace(/\$\{/g, '\\\\${'));
}
// export async function getServiceObjectsFromFile(file)Promise<boolean>{
//   fs.
// }
