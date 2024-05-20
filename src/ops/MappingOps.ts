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
   * @returns {Promise<MappingExportInterface>} a promise that resolves to a MappingExportInterface object
   */
  exportMapping(mappingId: string): Promise<MappingExportInterface>;
  /**
   * Export all mappings
   * @returns {Promise<MappingExportInterface>} a promise that resolves to a MappingExportInterface object
   */
  exportMappings(): Promise<MappingExportInterface>;
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
    async exportMapping(mappingId: string): Promise<MappingExportInterface> {
      return exportMapping({ mappingId, state });
    },
    async exportMappings(): Promise<MappingExportInterface> {
      return exportMappings({ state });
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
};

export interface MappingExportInterface {
  meta?: ExportMetaData;
  mapping: Record<string, MappingSkeleton>;
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
 * Read mappings
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
    let mappings = (await readConfigEntitiesByType({
      type: 'mapping',
      state,
    })) as MappingSkeleton[];
    const legacyMappings = await readSyncMappings({ state });
    mappings = mappings.concat(legacyMappings);
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
    return mappings;
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
  if (mappingId.startsWith('sync/')) {
    const mappings = await readSyncMappings({ state });
    for (const mapping of mappings) {
      if (mapping._id === mappingId) return mapping;
    }
    throw new FrodoError(`Mapping '${mappingId}' not found!`);
  } else if (mappingId.startsWith('mapping/')) {
    const mapping = await readConfigEntity({
      entityId: mappingId,
      state,
    });
    return mapping as MappingSkeleton;
  } else {
    throw new FrodoError(
      `Invalid mapping id ${mappingId}. Must start with 'sync/' or 'mapping/'`
    );
  }
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
  if (mappingId.startsWith('sync/')) {
    try {
      let mappings = await readMappings({ state });
      mappings = mappings.map((mapping) => {
        if (mappingId == mapping._id) {
          // update existing mapping with incoming
          return mappingData;
        }
        return mapping;
      });
      if (mappings.findIndex((mapping) => mapping._id == mappingId) == -1) {
        // incoming mapping does not exist, add it as new in the array
        mappings.push(mappingData);
      }
      const sync = await putConfigEntity({
        entityId: 'sync',
        entityData: { mappings },
        state,
      });
      for (const mapping of sync.mappings.map((it: MappingSkeleton) => {
        it._id = `sync/${it.name}`;
        return it;
      })) {
        if (mapping._id === mappingId) return mapping;
      }
    } catch (error) {
      throw new FrodoError(`Error updating sync mapping ${mappingId}`, error);
    }
    throw new FrodoError(
      `Mapping ${mappingId} not found after successful update!`
    );
  } else if (mappingId.startsWith('mapping/')) {
    try {
      const mapping = await putConfigEntity({
        entityId: mappingId,
        entityData: mappingData,
        state,
      });
      return mapping;
    } catch (error) {
      throw new FrodoError(`Error updating mapping ${mappingId}`, error);
    }
  } else {
    throw new FrodoError(
      `Invalid mapping id ${mappingId}. Must start with 'sync/' or 'mapping/'`
    );
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
    return sync.mappings;
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
      for (const mapping of mappings.filter((it) =>
        it._id.startsWith('sync/')
      )) {
        deletedMappings.push(mapping);
      }
      // delete all the new mappings
      for (const mapping of mappings.filter((it) =>
        it._id.startsWith('mapping/')
      )) {
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
        .filter((it) => it._id.startsWith('sync/'))
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
      for (const mapping of mappings.filter((it) =>
        it._id.startsWith('sync/')
      )) {
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
      for (const mapping of mappings.filter((it) =>
        it._id.startsWith('mapping/')
      )) {
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
    if (mappingId.startsWith('sync/')) {
      const mappings = await readMappings({ state });
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
    } else if (mappingId.startsWith('mapping/')) {
      const mapping = await deleteConfigEntity({
        entityId: mappingId,
        state,
      });
      debugMessage({ message: `MappingOps.deleteMapping: end`, state });
      return mapping as MappingSkeleton;
    } else {
      throw new FrodoError(
        `Invalid mapping id ${mappingId}. Must start with 'sync/' or 'mapping/'`
      );
    }
  } catch (error) {
    throw new FrodoError(`Error deleting mapping ${mappingId}`, error);
  }
}

/**
 * Export mapping
 * @param {string} mappingId id of the mapping (new: 'mapping/\<name>', legacy: 'sync/\<name>')
 * @returns {Promise<MappingExportInterface>} a promise that resolves to a MappingExportInterface object
 */
export async function exportMapping({
  mappingId,
  state,
}: {
  mappingId: string;
  state: State;
}): Promise<MappingExportInterface> {
  try {
    debugMessage({ message: `MappingOps.exportMapping: start`, state });
    const mappingData = await readMapping({ mappingId, state });
    const exportData = createMappingExportTemplate({ state });
    exportData.mapping[mappingData._id] = mappingData;
    debugMessage({ message: `MappingOps.exportMapping: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting mappings`, error);
  }
}

/**
 * Export all mappings
 * @returns {Promise<MappingExportInterface>} a promise that resolves to a MappingExportInterface object
 */
export async function exportMappings({
  state,
}: {
  state: State;
}): Promise<MappingExportInterface> {
  let indicatorId: string;
  try {
    const exportData = createMappingExportTemplate({ state });
    const allMappingsData = await readMappings({ state });
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
      exportData.mapping[mappingData._id] = mappingData;
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
  for (const key of Object.keys(importData.mapping)) {
    if (key === mappingId) {
      try {
        if (options.deps) {
          //
        }
        response = await updateMapping({
          mappingId,
          mappingData: importData.mapping[mappingId],
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
  for (const key of Object.keys(importData.mapping)) {
    try {
      if (options.deps) {
        //
      }
      response = await updateMapping({
        mappingId: key,
        mappingData: importData.mapping[key],
        state,
      });
      imported.push(key);
    } catch (error) {
      errors.push(error);
    }
    break;
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
  for (const key of Object.keys(importData.mapping)) {
    try {
      if (options.deps) {
        //
      }
      response.push(
        await updateMapping({
          mappingId: key,
          mappingData: importData.mapping[key],
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
