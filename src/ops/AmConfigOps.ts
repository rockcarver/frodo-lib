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
import { getErrorCallback, getMetadata } from '../utils/ExportImportUtils';
import { getRealmsForExport } from '../utils/ForgeRockUtils';
import { ExportMetaData, ResultCallback } from './OpsTypes';

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
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<ConfigEntityExportInterface>} promise resolving to a ConfigEntityExportInterface object
   */
  exportAmConfigEntities(
    includeReadOnly: boolean,
    onlyRealm: boolean,
    onlyGlobal: boolean,
    resultCallback?: ResultCallback<AmConfigEntityInterface>
  ): Promise<ConfigEntityExportInterface>;
  /**
   * Import all other AM config entities
   * @param {ConfigEntityExportInterface} importData The config import data
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<ConfigSkeleton | null>} a promise that resolves to a config object containing global and realm config entities, or null if no import was performed
   */
  importAmConfigEntities(
    importData: ConfigEntityExportInterface,
    resultCallback?: ResultCallback<AmConfigEntityInterface>
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
      onlyGlobal = false,
      resultCallback = void 0
    ): Promise<ConfigEntityExportInterface> {
      return exportAmConfigEntities({
        includeReadOnly,
        onlyRealm,
        onlyGlobal,
        resultCallback,
        state,
      });
    },
    async importAmConfigEntities(
      importData: ConfigEntityExportInterface,
      resultCallback = void 0
    ): Promise<ConfigSkeleton | null> {
      return importAmConfigEntities({ importData, resultCallback, state });
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
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<ConfigEntityExportInterface>} promise resolving to a ConfigEntityExportInterface object
 */
export async function exportAmConfigEntities({
  includeReadOnly = false,
  onlyRealm = false,
  onlyGlobal = false,
  resultCallback = void 0,
  state,
}: {
  includeReadOnly: boolean;
  onlyRealm: boolean;
  onlyGlobal: boolean;
  resultCallback?: ResultCallback<AmConfigEntityInterface>;
  state: State;
}): Promise<ConfigEntityExportInterface> {
  debugMessage({
    message: `AmConfigOps.exportAmConfigEntities: start`,
    state,
  });
  const entities = await getConfigEntities({
    includeReadOnly,
    onlyRealm,
    onlyGlobal,
    resultCallback: getErrorCallback(resultCallback),
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
  const indicatorId = createProgressIndicator({
    total: totalEntities,
    message: 'Exporting am config entities...',
    state,
  });
  exportData.global = processConfigEntitiesForExport({
    state,
    indicatorId,
    entities: entities.global,
    resultCallback,
  });
  Object.entries(entities.realm).forEach(
    ([key, value]) =>
      (exportData.realm[key] = processConfigEntitiesForExport({
        state,
        indicatorId,
        entities: value,
        resultCallback,
      }))
  );
  stopProgressIndicator({
    id: indicatorId,
    message: `Exported ${totalEntities} am config entities.`,
    state,
  });
  return exportData;
}

/**
 * Import all other AM config entities
 * @param {ConfigEntityExportInterface} importData The config import data
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<ConfigSkeleton | null>} a promise that resolves to a config object containing global and realm config entities, or null if no import was performed
 */
export async function importAmConfigEntities({
  importData,
  resultCallback = void 0,
  state,
}: {
  importData: ConfigEntityExportInterface;
  resultCallback?: ResultCallback<AmConfigEntityInterface>;
  state: State;
}): Promise<ConfigSkeleton | null> {
  debugMessage({
    message: `ServiceOps.importAmConfigEntities: start`,
    state,
  });
  const result = await putConfigEntities({
    config: importData as unknown as ConfigSkeleton,
    resultCallback,
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
}

/**
 * Helper to process the API results into export format
 * @param {AmConfigEntities} entities the entities being processed
 * @param {string} indicatorId the progress indicator id
 * @param {ResultCallback} resultCallback Optional callback to process individual exports
 * @returns {Record<string, AmConfigEntityInterface>} the processed entities
 */
function processConfigEntitiesForExport({
  state,
  entities,
  indicatorId,
  resultCallback,
}: {
  state: State;
  entities: AmConfigEntitiesInterface;
  indicatorId: string;
  resultCallback: ResultCallback<AmConfigEntityInterface>;
}): Record<string, Record<string, AmConfigEntityInterface>> {
  const exportedEntities = {};
  const entries = Object.entries(entities);
  for (const [key, value] of entries) {
    updateProgressIndicator({
      id: indicatorId,
      message: `Exporting ${key}`,
      state,
    });
    if (!value) {
      continue;
    }
    if (!value.result) {
      if ((value as AmConfigEntityInterface)._id) {
        exportedEntities[key] = {
          [(value as AmConfigEntityInterface)._id]: value,
        };
      } else if (
        (value as AmConfigEntityInterface)._type &&
        (value as AmConfigEntityInterface)._type._id
      ) {
        exportedEntities[key] = {
          [(value as AmConfigEntityInterface)._type._id]: value,
        };
      } else {
        exportedEntities[key] = value;
      }
    } else {
      const { result } = value as PagedResult<AmConfigEntityInterface>;
      const exportedValue = {};
      result.forEach((o) => (exportedValue[o._id] = o));
      exportedEntities[key] = exportedValue;
    }
    if (resultCallback) {
      resultCallback(undefined, exportedEntities[key]);
    }
  }
  return exportedEntities;
}
