import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import { putConfigEntity } from '../api/IdmConfigApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { FrodoError } from './FrodoError';
import {
  deleteConfigEntity,
  readConfigEntitiesByType,
  readConfigEntity,
} from './IdmConfigOps';
import { ExportMetaData } from './OpsTypes';

export type Mapping = {
  /**
   * Create an empty mapping export template
   * @returns {MappingExportInterface} an empty mapping export template
   */
  createMappingExportTemplate(): MappingExportInterface;
  /**
   * Read mappings from sync.json (legacy)
   * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of mapping objects
   */
  readSyncMappings(): Promise<MappingSkeleton[]>;
  /**
   * Read mappings
   * @param {string} connectorId limit mappings to connector
   * @param {string} moType limit mappings to managed object type
   * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of mapping objects
   */
  readMappings(
    connectorId?: string,
    moType?: string
  ): Promise<MappingSkeleton[]>;
  /**
   * Read mapping
   * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
   * @returns {Promise<MappingSkeleton>} a promise that resolves an mapping object
   */
  readMapping(mappingId: string): Promise<MappingSkeleton>;
  /**
   * Create mapping
   * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
   * @param {MappingSkeleton} mappingData mapping object
   * @returns {Promise<MappingSkeleton>} a promise that resolves to an mapping object
   */
  createMapping(
    mappingId: string,
    mappingData: MappingSkeleton
  ): Promise<MappingSkeleton>;
  /**
   * Update or create mapping
   * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
   * @param {MappingSkeleton} mappingData mapping object
   * @returns {Promise<MappingSkeleton>} a promise that resolves to an mapping object
   */
  updateMapping(
    mappingId: string,
    mappingData: MappingSkeleton
  ): Promise<MappingSkeleton>;
  /**
   * Update or create mappings in sync.json (legacy)
   * @param {MappingSkeleton} mappingData mapping object
   * @returns {Promise<MappingSkeleton>} a promise that resolves to an mapping object
   */
  updateSyncMappings(mappings: MappingSkeleton[]): Promise<MappingSkeleton[]>;
  /**
   * Delete all mappings
   * @param {string} connectorId limit mappings to connector
   * @param {string} moType limit mappings to managed object type
   * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of mapping objects
   */
  deleteMappings(
    connectorId?: string,
    moType?: string
  ): Promise<MappingSkeleton[]>;
  /**
   * Delete mapping
   * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
   * @returns {Promise<MappingSkeleton>} a promise that resolves an mapping object
   */
  deleteMapping(mappingId: string): Promise<MappingSkeleton>;
  /**
   * Export mapping
   * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
   * @param {MappingExportOptions} options export options
   * @returns {Promise<MappingExportInterface>} a promise that resolves to a MappingExportInterface object
   */
  exportMapping(
    mappingId: string,
    options?: MappingExportOptions
  ): Promise<MappingExportInterface>;
  /**
   * Export all mappings
   * @param {MappingExportOptions} options export options
   * @returns {Promise<MappingExportInterface>} a promise that resolves to a MappingExportInterface object
   */
  exportMappings(
    options?: MappingExportOptions
  ): Promise<MappingExportInterface>;
  /**
   * Import mapping
   * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
   * @param {MappingExportInterface} importData import data
   * @param {MappingImportOptions} options import options
   * @returns {Promise<MappingSkeleton>} a promise resolving to a MappingSkeleton object
   */
  importMapping(
    mappingId: string,
    importData: MappingExportInterface,
    options?: MappingImportOptions
  ): Promise<MappingSkeleton>;
  /**
   * Import first mapping
   * @param {MappingExportInterface} importData import data
   * @param {MappingImportOptions} options import options
   * @returns {Promise<MappingSkeleton>} a promise resolving to a MappingSkeleton object
   */
  importFirstMapping(
    importData: MappingExportInterface,
    options?: MappingImportOptions
  ): Promise<MappingSkeleton>;
  /**
   * Import all mappings
   * @param {MappingExportInterface} importData import data
   * @param {MappingImportOptions} options import options
   * @returns {Promise<MappingSkeleton[]>} a promise resolving to an array of MappingSkeleton objects
   */
  importMappings(
    importData: MappingExportInterface,
    options?: MappingImportOptions
  ): Promise<MappingSkeleton[]>;
  /**
   * Helper that returns a boolean indicating whether the mapping is a legacy mapping or not given the id
   * @param {string} mappingId the mapping id
   * @returns {boolean} true if the mapping is a legacy mapping, false otherwise
   * @throws {FrodoError} if the id is invalid
   */
  isLegacyMapping(mappingId: string): boolean;
};

export default (state: State): Mapping => {
  return {
    createMappingExportTemplate(): MappingExportInterface {
      return createMappingExportTemplate({ state });
    },
    async readSyncMappings(): Promise<MappingSkeleton[]> {
      return readSyncMappings({ state });
    },
    async readMappings(
      connectorId: string = undefined,
      moType: string = undefined
    ): Promise<any> {
      return readMappings({ connectorId, moType, state });
    },
    async readMapping(mappingId: string): Promise<any> {
      return readMapping({ mappingId, state });
    },
    async createMapping(
      mappingId: string,
      mappingData: MappingSkeleton
    ): Promise<any> {
      return createMapping({
        mappingId,
        mappingData,
        state,
      });
    },
    async updateMapping(
      mappingId: string,
      mappingData: MappingSkeleton
    ): Promise<MappingSkeleton> {
      return updateMapping({
        mappingId,
        mappingData,
        state,
      });
    },
    async updateSyncMappings(
      mappings: MappingSkeleton[]
    ): Promise<MappingSkeleton[]> {
      return updateLegacyMappings({
        mappings,
        state,
      });
    },
    async deleteMappings(
      connectorId: string = undefined,
      moType: string = undefined
    ): Promise<MappingSkeleton[]> {
      return deleteMappings({ connectorId, moType, state });
    },
    async deleteMapping(mappingId: string): Promise<MappingSkeleton> {
      return deleteMapping({ mappingId, state });
    },
    async exportMapping(
      mappingId: string,
      options: MappingExportOptions = { deps: true, useStringArrays: true }
    ): Promise<MappingExportInterface> {
      return exportMapping({ mappingId, options, state });
    },
    async exportMappings(
      options: MappingExportOptions = { deps: true, useStringArrays: true }
    ): Promise<MappingExportInterface> {
      return exportMappings({ options, state });
    },
    async importMapping(
      mappingId: string,
      importData: MappingExportInterface,
      options?: MappingImportOptions
    ): Promise<MappingSkeleton> {
      return importMapping({ mappingId, importData, options, state });
    },
    async importFirstMapping(
      importData: MappingExportInterface,
      options?: MappingImportOptions
    ): Promise<MappingSkeleton> {
      return importFirstMapping({ importData, options, state });
    },
    async importMappings(
      importData: MappingExportInterface,
      options?: MappingImportOptions
    ): Promise<MappingSkeleton[]> {
      return importMappings({ importData, options, state });
    },
    isLegacyMapping,
  };
};

export type MappingPolicy = {
  action: 'CREATE' | 'DELETE' | 'EXCEPTION' | 'IGNORE' | 'UPDATE';
  situation:
    | 'ABSENT'
    | 'ALL_GONE'
    | 'AMBIGUOUS'
    | 'CONFIRMED'
    | 'FOUND'
    | 'FOUND_ALREADY_LINKED'
    | 'LINK_ONLY'
    | 'MISSING'
    | 'SOURCE_IGNORED'
    | 'SOURCE_MISSING'
    | 'TARGET_IGNORED'
    | 'UNASSIGNED'
    | 'UNQUALIFIED';
};

export type MappingProperty = {
  source?: string;
  target: string;
  transform?: {
    globals: any;
    source: string;
    type: string;
  };
};

export type MappingSkeleton = IdObjectSkeletonInterface & {
  name: string;
  displayName?: string;
  linkQualifiers?: string[];
  consentRequired?: boolean;
  policies?: MappingPolicy[];
  properties?: MappingProperty[];
  source?: string;
  target?: string;
  syncAfter?: string[];
};

export type SyncSkeleton = IdObjectSkeletonInterface & {
  mappings: MappingSkeleton[];
};

export type ManagedSkeleton = IdObjectSkeletonInterface & {
  objects: MappingSkeleton[];
};

export interface MappingExportInterface {
  meta?: ExportMetaData;
  mapping: Record<string, MappingSkeleton>;
  sync: SyncSkeleton;
}

/**
 * Mapping export options
 */
export interface MappingExportOptions {
  /**
   * Use string arrays to store multi-line text in scripts.
   */
  useStringArrays: boolean;
  /**
   * Include any dependencies.
   */
  deps: boolean;
  /**
   * limit mappings to connector
   */
  connectorId?: string;
  /**
   * limit mappings to managed object type
   */
  moType?: string;
}

/**
 * Mapping import options
 */
export interface MappingImportOptions {
  /**
   * Include any dependencies.
   */
  deps: boolean;
}

export function createMappingExportTemplate({
  state,
}: {
  state: State;
}): MappingExportInterface {
  return {
    meta: getMetadata({ state }),
    mapping: {},
    sync: {
      _id: 'sync',
      mappings: [],
    },
  } as MappingExportInterface;
}

/**
 * Read mappings from sync.json (legacy)
 * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of mapping objects
 */
export async function readSyncMappings({
  state,
}: {
  state: State;
}): Promise<MappingSkeleton[]> {
  try {
    debugMessage({
      message: `MappingOps.readLegacyMappings: start`,
      state,
    });
    const sync = await readConfigEntity({
      entityId: 'sync',
      state,
    });
    const mappings = (sync.mappings as MappingSkeleton[]).map((it) => {
      it._id = `sync/${it.name}`;
      return it;
    });
    //Add syncAfter property to mappings, according to the ordering
    const syncAfter = [];
    for (const mapping of mappings) {
      mapping.syncAfter = syncAfter.slice();
      syncAfter.push(mapping.name);
    }
    debugMessage({
      message: `MappingOps.readLegacyMappings: end`,
      state,
    });
    return mappings;
  } catch (error) {
    throw new FrodoError(`Error reading sync mappings`, error);
  }
}

/**
 * Read the new mappings that are not legacy (i.e. those not from sync.json)
 * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of mapping objects
 */
export async function readNewMappings({
  state,
}: {
  state: State;
}): Promise<MappingSkeleton[]> {
  try {
    debugMessage({
      message: `MappingOps.readNewMappings: start`,
      state,
    });
    const mapping = (await readConfigEntitiesByType({
      type: 'mapping',
      state,
    })) as MappingSkeleton[];
    const mappings = mapping.map((it) => {
      it._id = `mapping/${it.name}`;
      return it;
    });
    debugMessage({
      message: `MappingOps.readNewMappings: end`,
      state,
    });
    return sortMappings(mappings);
  } catch (error) {
    throw new FrodoError(`Error reading new mappings`, error);
  }
}

/**
 * Read mappings in order of which they are synced.
 * @param {string} connectorId limit mappings to connector
 * @param {string} moType limit mappings to managed object type
 * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of mapping objects
 */
export async function readMappings({
  connectorId,
  moType,
  state,
}: {
  connectorId?: string;
  moType?: string;
  state: State;
}): Promise<MappingSkeleton[]> {
  try {
    debugMessage({
      message: `MappingOps.readMappings: start [connectorId=${
        connectorId ? connectorId : 'all'
      }, moType=${moType ? moType : 'all'}]`,
      state,
    });
    let mappings = await readSyncMappings({ state });
    mappings = mappings.concat(await readNewMappings({ state }));
    if (connectorId)
      mappings = mappings.filter(
        (mapping) =>
          mapping.source.startsWith(`system/${connectorId}/`) ||
          mapping.target.startsWith(`system/${connectorId}/`)
      );
    if (moType)
      mappings = mappings.filter(
        (mapping) =>
          mapping.source === `managed/${moType}` ||
          mapping.target === `managed/${moType}`
      );
    debugMessage({
      message: `MappingOps.readMappings: end`,
      state,
    });
    return sortMappings(mappings);
  } catch (error) {
    throw new FrodoError(`Error reading mappings`, error);
  }
}

/**
 * Read mapping
 * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
 * @returns {Promise<MappingSkeleton>} a promise that resolves an mapping object
 */
export async function readMapping({
  mappingId,
  state,
}: {
  mappingId: string;
  state: State;
}): Promise<MappingSkeleton> {
  const mappings = await readMappings({ state });
  for (const mapping of mappings) {
    if (mapping._id === mappingId) return mapping;
  }
  throw new FrodoError(`Mapping '${mappingId}' not found!`);
}

/**
 * Create mapping
 * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
 * @param {MappingSkeleton} mappingData mapping object
 * @returns {Promise<MappingSkeleton>} a promise that resolves to an mapping object
 */
export async function createMapping({
  mappingId,
  mappingData,
  state,
}: {
  mappingId: string;
  mappingData: MappingSkeleton;
  state: State;
}): Promise<MappingSkeleton> {
  debugMessage({
    message: `MappingOps.createMapping: start`,
    state,
  });
  try {
    await readMapping({
      mappingId,
      state,
    });
  } catch (error) {
    try {
      const result = await updateMapping({
        mappingId,
        mappingData,
        state,
      });
      debugMessage({
        message: `MappingOps.createMapping: end`,
        state,
      });
      return result as MappingSkeleton;
    } catch (error) {
      throw new FrodoError(`Error creating mapping ${mappingId}`, error);
    }
  }
  throw new FrodoError(`Mapping ${mappingId} already exists!`);
}

/**
 * Update or create mapping
 * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
 * @param {MappingSkeleton} mappingData mapping object
 * @returns {Promise<MappingSkeleton>} a promise that resolves to an mapping object
 */
export async function updateMapping({
  mappingId,
  mappingData,
  state,
}: {
  mappingId: string;
  mappingData: MappingSkeleton;
  state: State;
}): Promise<MappingSkeleton> {
  if (isLegacyMapping(mappingId)) {
    try {
      let mappings = await readSyncMappings({ state });
      mappings = mappings.map((mapping) => {
        if (mappingId === mapping._id) {
          // update existing mapping with incoming
          return mappingData;
        }
        return mapping;
      });
      if (mappings.findIndex((mapping) => mapping._id === mappingId) === -1) {
        // incoming mapping does not exist, add it as new in the array
        mappings.push(mappingData);
      }
      const sync = await putConfigEntity({
        entityId: 'sync',
        entityData: { mappings },
        state,
      });
      for (const mapping of (sync.mappings as MappingSkeleton[]).map(
        (it: MappingSkeleton) => {
          it._id = `sync/${it.name}`;
          return it;
        }
      )) {
        if (mapping._id === mappingId) return mapping;
      }
    } catch (error) {
      throw new FrodoError(`Error updating sync mapping ${mappingId}`, error);
    }
    throw new FrodoError(
      `Mapping ${mappingId} not found after successful update!`
    );
  } else {
    try {
      const mapping = await putConfigEntity({
        entityId: mappingId,
        entityData: mappingData,
        state,
      });
      return mapping as MappingSkeleton;
    } catch (error) {
      throw new FrodoError(`Error updating mapping ${mappingId}`, error);
    }
  }
}

/**
 * Update or create multiple mappings
 * @param {MappingSkeleton[]} mappings array of mapping objects
 * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of mapping objects
 */
export async function updateLegacyMappings({
  mappings,
  state,
}: {
  mappings: MappingSkeleton[];
  state: State;
}): Promise<MappingSkeleton[]> {
  try {
    const sync = await putConfigEntity({
      entityId: 'sync',
      entityData: { mappings },
      state,
    });
    return sync.mappings as MappingSkeleton[];
  } catch (error) {
    throw new FrodoError(`Error updating legacy mappings`, error);
  }
}

/**
 * Delete mappings
 * @param {string} connectorId limit mappings to connector
 * @param {string} moType limit mappings to managed object type
 * @returns {Promise<MappingSkeleton[]>} a promise that resolves to an array of mapping objects
 */
export async function deleteMappings({
  connectorId,
  moType,
  state,
}: {
  connectorId?: string;
  moType?: string;
  state: State;
}): Promise<MappingSkeleton[]> {
  try {
    debugMessage({ message: `MappingOps.deleteMappings: start`, state });
    const mappings = await readMappings({ state });
    const deletedMappings: MappingSkeleton[] = [];
    // delete all mappings
    if (!connectorId && !moType) {
      // delete all mappings in sync.json
      await updateLegacyMappings({
        mappings: [],
        state,
      });
      for (const mapping of mappings.filter((it) => isLegacyMapping(it._id))) {
        deletedMappings.push(mapping);
      }
      // delete all the new mappings
      for (const mapping of mappings.filter((it) => !isLegacyMapping(it._id))) {
        deletedMappings.push(
          await deleteMapping({ mappingId: mapping._id, state })
        );
      }
      return deletedMappings;
    }
    // delete filtered mappings
    else {
      let mappingsToDelete: MappingSkeleton[] = [];
      if (connectorId) {
        debugMessage({
          message: `MappingOps.deleteMappings: select mappings for connector ${connectorId}`,
          state,
        });
        mappingsToDelete = mappings.filter(
          (mapping) =>
            mapping.source.startsWith(`system/${connectorId}/`) ||
            mapping.target.startsWith(`system/${connectorId}/`)
        );
      }
      if (moType) {
        debugMessage({
          message: `MappingOps.deleteMappings: select mappings for managed object type ${moType}`,
          state,
        });
        mappingsToDelete = mappingsToDelete.filter(
          (mapping) =>
            mapping.source === `managed/${moType}` ||
            mapping.target === `managed/${moType}`
        );
      }
      // filter only sync mappings
      const legacyMappingIdsToDelete = mappingsToDelete
        .filter((it) => isLegacyMapping(it._id))
        .map((it) => it._id);
      debugMessage({
        message: `MappingOps.deleteMappings: selected ${
          mappingsToDelete.length
        } mappings: ${legacyMappingIdsToDelete.join(', ')}`,
        state,
      });
      const updatedLegacyMappings = mappings.filter(
        (mapping) => !legacyMappingIdsToDelete.includes(mapping._id)
      );
      debugMessage({
        message: `MappingOps.deleteMappings: ${
          updatedLegacyMappings.length
        } remaining mappings: ${updatedLegacyMappings
          .map((mapping) => mapping._id)
          .join(', ')}`,
        state,
      });
      // update the mappings
      const finalMappings = await updateLegacyMappings({
        mappings: updatedLegacyMappings,
        state,
      });
      for (const mapping of mappings.filter((it) => isLegacyMapping(it._id))) {
        deletedMappings.push(mapping);
      }
      debugMessage({
        message: `MappingOps.deleteMappings: ${
          finalMappings.length
        } mappings after update: ${finalMappings
          .map((mapping) => mapping._id)
          .join(', ')}`,
        state,
      });
      // are there any mappings that were not deleted?
      const undeletedMappings = finalMappings.filter((mapping) =>
        legacyMappingIdsToDelete.includes(mapping._id)
      );
      // delete all the new mappings
      for (const mapping of mappings.filter((it) => !isLegacyMapping(it._id))) {
        deletedMappings.push(
          await deleteMapping({ mappingId: mapping._id, state })
        );
      }
      // if there were undeleted mappings, throw exception
      if (undeletedMappings.length > 0) {
        const message = `${
          undeletedMappings.length
        } mappings were not deleted from sync.json: ${undeletedMappings
          .map((mapping) => mapping._id)
          .join(', ')}`;
        debugMessage({
          message,
          state,
        });
        throw new FrodoError(message);
      }
      debugMessage({
        message: `MappingOps.deleteMappings: deleted ${
          mappingsToDelete.length
        } mappings: ${legacyMappingIdsToDelete.join(', ')}`,
        state,
      });
      debugMessage({ message: `MappingOps.deleteMappings: end`, state });
      // otherwise return deleted mappings
      return deletedMappings;
    }
  } catch (error) {
    throw new FrodoError(`Error deleting mappings`, error);
  }
}

/**
 * Delete mapping
 * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
 * @returns {Promise<MappingSkeleton>} a promise that resolves an mapping object
 */
export async function deleteMapping({
  mappingId,
  state,
}: {
  mappingId: string;
  state: State;
}): Promise<MappingSkeleton> {
  try {
    debugMessage({ message: `MappingOps.deleteMapping: start`, state });
    if (isLegacyMapping(mappingId)) {
      const mappings = await readSyncMappings({ state });
      const mappingsToDelete = mappings.filter(
        (mapping) => mapping._id === mappingId
      );
      if (mappingsToDelete.length !== 1) {
        const message = `Mapping ${mappingId} not found in sync.json or multiple mappings found!`;
        debugMessage({
          message: `MappingOps.deleteMapping: ${message}`,
          state,
        });
        throw new FrodoError(message);
      }
      const updatedMappings = mappings.filter(
        (mapping) => mapping._id !== mappingId
      );
      debugMessage({
        message: `MappingOps.deleteMapping: ${
          updatedMappings.length
        } remaining mappings in sync.json: ${updatedMappings
          .map((mapping) => mapping._id)
          .join(', ')}`,
        state,
      });
      // update the mappings
      const finalMappings = await updateLegacyMappings({
        mappings: updatedMappings,
        state,
      });
      debugMessage({
        message: `MappingOps.deleteMapping: ${
          finalMappings.length
        } mappings in sync.json after update: ${finalMappings
          .map((mapping) => mapping._id)
          .join(', ')}`,
        state,
      });
      // are there any mappings that were not deleted?
      const undeletedMappings = finalMappings.filter(
        (mapping) => mappingId == mapping._id
      );
      // if so, throw exception
      if (undeletedMappings.length > 0) {
        const message = `Mapping ${undeletedMappings[0]} was not deleted from sync.json after successful update.`;
        debugMessage({
          message,
          state,
        });
        throw new FrodoError(message);
      }
      debugMessage({
        message: `MappingOps.deleteMapping: deleted legacy mapping ${mappingId} from sync.json.`,
        state,
      });
      debugMessage({ message: `MappingOps.deleteMapping: end`, state });
      // otherwise return deleted mapping
      return mappingsToDelete[0];
    } else {
      const mapping = await deleteConfigEntity({
        entityId: mappingId,
        state,
      });
      debugMessage({ message: `MappingOps.deleteMapping: end`, state });
      return mapping as MappingSkeleton;
    }
  } catch (error) {
    throw new FrodoError(`Error deleting mapping ${mappingId}`, error);
  }
}

/**
 * Export mapping
 * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
 * @param {MappingExportOptions} options export options
 * @returns {Promise<MappingExportInterface>} a promise that resolves to a MappingExportInterface object
 */
export async function exportMapping({
  mappingId,
  options = { deps: true, useStringArrays: true },
  state,
}: {
  mappingId: string;
  options?: MappingExportOptions;
  state: State;
}): Promise<MappingExportInterface> {
  try {
    debugMessage({ message: `MappingOps.exportMapping: start`, state });
    const mappingData = await readMapping({ mappingId, state });
    const exportData = createMappingExportTemplate({ state });
    if (options.deps) {
      // TODO
    }
    if (options.useStringArrays) {
      // TODO
    }
    if (isLegacyMapping(mappingId)) {
      exportData.sync.mappings.push(mappingData);
    } else {
      exportData.mapping[mappingId] = mappingData;
    }
    debugMessage({ message: `MappingOps.exportMapping: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting mappings`, error);
  }
}

/**
 * Export all mappings
 * @param {MappingExportOptions} options export options
 * @returns {Promise<MappingExportInterface>} a promise that resolves to a MappingExportInterface object
 */
export async function exportMappings({
  options = { deps: true, useStringArrays: true },
  state,
}: {
  options?: MappingExportOptions;
  state: State;
}): Promise<MappingExportInterface> {
  let indicatorId: string;
  try {
    const exportData = createMappingExportTemplate({ state });
    const allMappingsData = await readMappings({
      connectorId: options.connectorId,
      moType: options.moType,
      state,
    });
    indicatorId = createProgressIndicator({
      total: allMappingsData.length,
      message: 'Exporting mappings',
      state,
    });
    for (const mappingData of allMappingsData) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting mapping ${mappingData._id}`,
        state,
      });
      if (options.deps) {
        // TODO
      }
      if (options.useStringArrays) {
        // TODO
      }
      if (isLegacyMapping(mappingData._id)) {
        exportData.sync.mappings.push(mappingData);
      } else {
        exportData.mapping[mappingData._id] = mappingData;
      }
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `${allMappingsData.length} mappings exported.`,
      state,
    });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting mappings`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting mappings`, error);
  }
}

/**
 * Import mapping
 * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
 * @param {MappingExportInterface} importData import data
 * @param {MappingImportOptions} options import options
 * @returns {Promise<MappingSkeleton>} a promise resolving to a MappingSkeleton object
 */
export async function importMapping({
  mappingId,
  importData,
  options = { deps: true },
  state,
}: {
  mappingId: string;
  importData: MappingExportInterface;
  options?: MappingImportOptions;
  state: State;
}): Promise<MappingSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  const isLegacy = isLegacyMapping(mappingId);
  for (const key of isLegacy
    ? importData.sync.mappings.map((m) => m._id)
    : Object.keys(importData.mapping)) {
    if (key === mappingId) {
      try {
        if (options.deps) {
          // TODO
        }
        response = await updateMapping({
          mappingId,
          mappingData: isLegacy
            ? importData.sync.mappings.find((m) => m._id === mappingId)
            : importData.mapping[mappingId],
          state,
        });
        imported.push(key);
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing mapping ${mappingId}`, errors);
  }
  if (0 === imported.length) {
    throw new FrodoError(`Mapping ${mappingId} not found in import data`);
  }
  return response;
}

/**
 * Import first mapping
 * @param {MappingExportInterface} importData import data
 * @param {MappingImportOptions} options import options
 * @returns {Promise<MappingSkeleton>} a promise resolving to a MappingSkeleton object
 */
export async function importFirstMapping({
  importData,
  options = { deps: true },
  state,
}: {
  importData: MappingExportInterface;
  options?: MappingImportOptions;
  state: State;
}): Promise<MappingSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  const mappingIds = Object.keys(importData.mapping);
  let mappingId;
  // Sync order starts with mappings in sync.json first before moving on to sync the individual mapping files, so try sync mappings first.
  // See https://backstage.forgerock.com/docs/idm/7.5/synchronization-guide/mappings.html
  if (importData.sync?.mappings?.length > 0) {
    mappingId = importData.sync.mappings[0]._id;
  } else if (mappingIds.length > 0) {
    mappingId = mappingIds[0];
  }
  if (mappingId) {
    try {
      if (options.deps) {
        // TODO
      }
      response = await updateMapping({
        mappingId,
        mappingData: isLegacyMapping(mappingId)
          ? importData.sync.mappings.find((m) => m._id === mappingId)
          : importData.mapping[mappingId],
        state,
      });
      imported.push(mappingId);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing first mapping`, errors);
  }
  if (0 === imported.length) {
    throw new FrodoError(`No mappings found in import data!`);
  }
  return response;
}

/**
 * Import all mappings
 * @param {MappingExportInterface} importData import data
 * @param {MappingImportOptions} options import options
 * @returns {Promise<MappingSkeleton[]>} a promise resolving to an array of MappingSkeleton objects
 */
export async function importMappings({
  importData,
  options = { deps: true },
  state,
}: {
  importData: MappingExportInterface;
  options?: MappingImportOptions;
  state: State;
}): Promise<MappingSkeleton[]> {
  const response = [];
  const errors = [];
  let mappings = [];
  if (importData.mapping) {
    mappings = mappings.concat(Object.values(importData.mapping));
  }
  if (importData.sync && Array.isArray(importData.sync.mappings)) {
    mappings = mappings.concat(importData.sync.mappings);
  }
  for (const mappingData of mappings) {
    try {
      if (options.deps) {
        // TODO
      }
      response.push(
        await updateMapping({
          mappingId: mappingData._id,
          mappingData,
          state,
        })
      );
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing mappings`, errors);
  }
  return response;
}

/**
 * Helper that returns a boolean indicating whether the mapping is a legacy mapping or not given the id
 * @param {string} mappingId the mapping id
 * @returns {boolean} true if the mapping is a legacy mapping, false otherwise
 * @throws {FrodoError} if the id is invalid
 */
export function isLegacyMapping(mappingId: string): boolean {
  if (
    !mappingId ||
    (!mappingId.startsWith('sync/') && !mappingId.startsWith('mapping/'))
  ) {
    throw new FrodoError(
      `Invalid mapping id ${mappingId}. Must start with 'sync/' or 'mapping/'`
    );
  }
  return mappingId.startsWith('sync/');
}

/**
 * Helper that sorts an array of mappings in place and returns the sorted array. It sorts first by mapping type (legacy mappings come before non-legacy mappings), and then by the syncAfter property.
 * If syncAfter doesn't exist, it prioritizes mappings without the syncAfter property (note that the behavior that should happen in this instance is not specified in the documentation, at least as of July 9, 2024).
 *
 * See sync order documentation: https://backstage.forgerock.com/docs/idm/7.5/synchronization-guide/mappings.html
 *
 * Note: According to the documentation, then endpoint /openidm/sync/mappings?_queryFilter=true should return all mappings (legacy and new) in the correct order, which would make this method unnecessary when reading mappings. However, this doesn't
 * seem to always be the case. The endpoint prioritizes non-legacy mappings over legacy mappings which is opposite what the documentation says the correct sync order should be. Additionally, the endpoint does not always return all the mappings.
 * In the future, if the endpoint is fixed, we may instead want to use /openidm/sync/mappings?_queryFilter=true to determine correct ordering.
 *
 * @param {MappingSkeleton[]} mappings The list of mappings to sort in place
 * @returns The sorted list of mappings
 */
export function sortMappings(mappings: MappingSkeleton[]) {
  return mappings.sort((m1, m2) => {
    // Order by mapping type first. Sync (legacy) mappings get synced first according to the documentation: https://backstage.forgerock.com/docs/idm/7.5/synchronization-guide/mappings.html
    const m1IsLegacy = isLegacyMapping(m1._id);
    const m2IsLegacy = isLegacyMapping(m2._id);
    if (m1IsLegacy && !m2IsLegacy) {
      return -1;
    }
    if (m2IsLegacy && !m1IsLegacy) {
      return 1;
    }
    // The reason for sorting by the length of the syncAfter array is because this is how syncAfter works for sync.json mappings when you query the /openidm/sync/mappings?_queryFilter=true endpoint. For example, the last mapping
    // in sync.json would have a list of all the mappings that get synced prior to it, meaning it would have the longest syncAfter array, while the first mapping would have an empty syncAfter array.
    if (m1.syncAfter && m2.syncAfter) {
      if (m1.syncAfter.length < m2.syncAfter.length) {
        return -1;
      }
      if (m1.syncAfter.length > m2.syncAfter.length) {
        return 1;
      }
      return 0;
    }
    // Prioritize those mappings that don't have a syncAfter property if none is provided for one of them. The reason for this decision is this is how the /openidm/sync/mappings?_queryFilter=true endpoint orders mappings that don't
    // have this property, at least according to my observations. The actual behavior for when mappings don't have syncAfter is not specified in the documentation.
    if (m1.syncAfter) {
      return 1;
    }
    if (m2.syncAfter) {
      return -1;
    }
    return 0;
  });
}
