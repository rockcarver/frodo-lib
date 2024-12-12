import {
  AmConfigEntitiesInterface,
  ConfigSkeleton,
  getConfigEntities,
  putConfigEntities,
} from '../api/AmConfigApi';
import { AmConfigEntityInterface, PagedResult } from '../api/ApiTypes';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { getRealmsForExport } from '../utils/ForgeRockUtils';
import { FrodoError } from './FrodoError';
import { ExportMetaData } from './OpsTypes';

export type AmConfig = {
  /**
   * Create an empty config entity export template
   * @returns {Promise<ConfigEntityExportInterface>} an empty config entity export template
   */
  createConfigEntityExportTemplate(
    realms?: string[]
  ): Promise<ConfigEntityExportInterface>;
  /**
   * Export all other AM config entities
   * @param {boolean} includeReadOnly Include read only config in the export
   * @param {boolean} onlyRealm Export config only from the active realm. If onlyGlobal is also active, then it will also export the global config.
   * @param {boolean} onlyGlobal Export global config only. If onlyRealm is also active, then it will also export the active realm config.
   * @returns {Promise<ConfigEntityExportInterface>} promise resolving to a ConfigEntityExportInterface object
   */
  exportAmConfigEntities(
    includeReadOnly: boolean,
    onlyRealm: boolean,
    onlyGlobal: boolean
  ): Promise<ConfigEntityExportInterface>;
  /**
   * Import all other AM config entities
   * @param {ConfigEntityExportInterface} importData The config import data
   * @returns {Promise<ConfigSkeleton | null>} a promise that resolves to a config object containing global and realm config entities, or null if no import was performed
   */
  importAmConfigEntities(
    importData: ConfigEntityExportInterface
  ): Promise<ConfigSkeleton | null>;
};

export default (state: State): AmConfig => {
  return {
    async createConfigEntityExportTemplate(
      realms?: string[]
    ): Promise<ConfigEntityExportInterface> {
      return createConfigEntityExportTemplate({ realms, state });
    },
    async exportAmConfigEntities(
      includeReadOnly = false,
      onlyRealm = false,
      onlyGlobal = false
    ): Promise<ConfigEntityExportInterface> {
      return exportAmConfigEntities({
        includeReadOnly,
        onlyRealm,
        onlyGlobal,
        state,
      });
    },
    async importAmConfigEntities(
      importData: ConfigEntityExportInterface
    ): Promise<ConfigSkeleton | null> {
      return importAmConfigEntities({ importData, state });
    },
  };
};

export interface ConfigEntityExportInterface {
  meta?: ExportMetaData;
  global: Record<string, Record<string, AmConfigEntityInterface>>;
  realm: Record<
    string,
    Record<string, Record<string, AmConfigEntityInterface>>
  >;
}

/**
 * Create an empty config export template
 * @param {string[]} realms the list of realm names
 * @returns {Promise<ConfigEntityExportInterface>} an empty config entity export template
 */
export async function createConfigEntityExportTemplate({
  state,
  realms,
}: {
  state: State;
  realms?: string[];
}): Promise<ConfigEntityExportInterface> {
  if (!realms) {
    realms = await getRealmsForExport({ state });
  }
  return {
    meta: getMetadata({ state }),
    global: {},
    realm: Object.fromEntries(realms.map((r) => [r, {}])),
  } as ConfigEntityExportInterface;
}

/**
 * Export all other AM config entities
 * @param {boolean} includeReadOnly Include read only config in the export
 * @param {boolean} onlyRealm Export config only from the active realm. If onlyGlobal is also active, then it will also export the global config.
 * @param {boolean} onlyGlobal Export global config only. If onlyRealm is also active, then it will also export the active realm config.
 * @returns {Promise<ConfigEntityExportInterface>} promise resolving to a ConfigEntityExportInterface object
 */
export async function exportAmConfigEntities({
  includeReadOnly = false,
  onlyRealm = false,
  onlyGlobal = false,
  state,
}: {
  includeReadOnly: boolean;
  onlyRealm: boolean;
  onlyGlobal: boolean;
  state: State;
}): Promise<ConfigEntityExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({
      message: `AmConfigOps.exportAmConfigEntities: start`,
      state,
    });
    const entities = await getConfigEntities({
      includeReadOnly,
      onlyRealm,
      onlyGlobal,
      state,
    });
    const exportData = await createConfigEntityExportTemplate({
      state,
      realms: Object.keys(entities.realm),
    });
    const totalEntities =
      Object.keys(entities.global).length +
      Object.values(entities.realm).reduce(
        (total, realmEntities) => total + Object.keys(realmEntities).length,
        0
      );
    indicatorId = createProgressIndicator({
      total: totalEntities,
      message: 'Exporting am config entities...',
      state,
    });
    exportData.global = processConfigEntitiesForExport({
      state,
      indicatorId,
      entities: entities.global,
    });
    Object.entries(entities.realm).forEach(
      ([key, value]) =>
        (exportData.realm[key] = processConfigEntitiesForExport({
          state,
          indicatorId,
          entities: value,
        }))
    );
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${totalEntities} am config entities.`,
      state,
    });
    debugMessage({ message: `AmConfigOps.exportAmConfigEntities: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting am config entities.`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting am config entities`, error);
  }
}

/**
 * Import all other AM config entities
 * @param {ConfigEntityExportInterface} importData The config import data
 * @returns {Promise<ConfigSkeleton | null>} a promise that resolves to a config object containing global and realm config entities, or null if no import was performed
 */
export async function importAmConfigEntities({
  importData,
  state,
}: {
  importData: ConfigEntityExportInterface;
  state: State;
}): Promise<ConfigSkeleton | null> {
  debugMessage({
    message: `ServiceOps.importAmConfigEntities: start`,
    state,
  });
  try {
    const result = await putConfigEntities({
      config: importData as unknown as ConfigSkeleton,
      state,
    });
    debugMessage({ message: `AmConfigOps.importAmConfigEntities: end`, state });
    // If no import was accomplished, return null
    if (
      Object.keys(result.global).length === 0 &&
      !Object.values(result.realm).find((r) => Object.keys(r).length > 0)
    ) {
      return null;
    }
    return result;
  } catch (error) {
    throw new FrodoError(`Error importing am config entities`, error);
  }
}

/**
 * Helper to process the API results into export format
 * @param {AmConfigEntities} entities the entities being processed
 * @param {string} indicatorId the progress indicator id
 * @returns {Record<string, AmConfigEntityInterface>} the processed entities
 */
function processConfigEntitiesForExport({
  state,
  entities,
  indicatorId,
}: {
  state: State;
  entities: AmConfigEntitiesInterface;
  indicatorId: string;
}): Record<string, Record<string, AmConfigEntityInterface>> {
  const exportedEntities = {};
  const entries = Object.entries(entities);
  for (const [key, value] of entries) {
    updateProgressIndicator({
      id: indicatorId,
      message: `Exporting ${key}`,
      state,
    });
    const exportedValue = {};
    if (!value) {
      continue;
    }
    if (!value.result) {
      if ((value as AmConfigEntityInterface)._id) {
        exportedValue[(value as AmConfigEntityInterface)._id] = value;
        exportedEntities[key] = exportedValue;
      } else if (
        (value as AmConfigEntityInterface)._type &&
        (value as AmConfigEntityInterface)._type._id
      ) {
        exportedValue[(value as AmConfigEntityInterface)._type._id] = value;
        exportedEntities[key] = exportedValue;
      } else {
        exportedEntities[key] = value;
      }
      continue;
    }
    const { result } = value as PagedResult<AmConfigEntityInterface>;
    result.forEach((o) => (exportedValue[o._id] = o));
    exportedEntities[key] = exportedValue;
  }
  return exportedEntities;
}
