import {
  getTelemetryExporters,
  TelemetryExporters,
  LogExporterSkeleton,
  putTelemetryExporter,
  deleteTelemetryExporter,
  TelemetryExporterCategory,
} from '../../api/cloud/TelemetryApi';
import {
  createProgressIndicator,
  stopProgressIndicator,
  updateProgressIndicator,
  debugMessage,
} from '../../utils/Console';
import { State } from '../../shared/State';
import { getMetadata } from '../../utils/ExportImportUtils';
import { FrodoError } from '../FrodoError';
import { ExportMetaData } from '../OpsTypes';

export type Telemetry = {
  /**
   * Read all telemetry exporters
   * @returns {Promise<TelemetryExporters>} a promise resolving to the telemetry exporters
   */
  readTelemetry(): Promise<TelemetryExporters>;
  /**
   * Export telemetry exporters, optionally filtered by id and/or category
   * @param {string} exporterId optional exporter id to filter by
   * @param {TelemetryExporterCategory} category optional category to filter by
   * @returns {Promise<TelemetryExportInterface[]>} a promise resolving to a TelemetryExportInterface object
   */
  exportTelemetry(
    exporterId?: string,
    category?: TelemetryExporterCategory
  ): Promise<TelemetryExportInterface>;
  /**
   * Import telemetry exporters
   * @param {TelemetryExportInterface} importData telemetry import data
   * @param {string} exporterId optional exporter id; if provided, only imports the specified exporter
   * @param {TelemetryExporterCategory} category optional exporter category; if provided, only imports exporters of the specified category
   * @returns {Promise<LogExporterSkeleton[]>} the imported log exporters
   */
  importTelemetry(
    importData: TelemetryExportInterface,
    exporterId?: string,
    category?: TelemetryExporterCategory
  ): Promise<LogExporterSkeleton[]>;
  /**
   * Create or update a telemetry exporter
   * @param {TelemetryExporterCategory} category exporter category
   * @param {string} exporterId exporter id
   * @param {LogExporterSkeleton} exporterData exporter configuration
   * @returns {Promise<LogExporterSkeleton>} the updated exporter
   */
  updateTelemetry(
    category: TelemetryExporterCategory,
    exporterId: string,
    exporterData: LogExporterSkeleton
  ): Promise<LogExporterSkeleton>;
  /**
   * Delete telemetry exporters
   * @param {string} exporterId optional exporter id; if provided, only deletes the specified exporter
   * @param {TelemetryExporterCategory} category optional exporter category; if provided, only deletes exporters in the specified category
   * @returns {Promise<LogExporterSkeleton[]>}
   */
  deleteTelemetry(
    exporterId?: string,
    category?: TelemetryExporterCategory
  ): Promise<LogExporterSkeleton[]>;
};

export default (state: State): Telemetry => {
  return {
    async readTelemetry(): Promise<TelemetryExporters> {
      return readTelemetry({ state });
    },
    async exportTelemetry(
      exporterId: string = null,
      category: TelemetryExporterCategory = null
    ): Promise<TelemetryExportInterface> {
      return exportTelemetry({ exporterId, category, state });
    },
    async importTelemetry(
      importData: TelemetryExportInterface,
      exporterId: string = null,
      category: TelemetryExporterCategory = null
    ): Promise<LogExporterSkeleton[]> {
      return importTelemetry({ exporterId, category, importData, state });
    },
    async updateTelemetry(
      category: TelemetryExporterCategory,
      exporterId: string,
      exporterData: LogExporterSkeleton
    ): Promise<LogExporterSkeleton> {
      return updateTelemetry({
        category,
        exporterId,
        exporterData,
        state,
      });
    },
    async deleteTelemetry(
      exporterId: string = null,
      category: TelemetryExporterCategory = null
    ): Promise<LogExporterSkeleton[]> {
      return deleteTelemetry({
        exporterId,
        category,
        state,
      });
    },
  };
};

export interface TelemetryExportInterface {
  meta?: ExportMetaData;
  telemetry: TelemetryExporters;
}

/**
 * Create an empty telemetry export template
 * @returns {TelemetryExportInterface} an empty telemetry export template
 */
export function createTelemetryExportTemplate({
  state,
}: {
  state: State;
}): TelemetryExportInterface {
  return {
    meta: getMetadata({ state }),
    telemetry: { otlp: [], splunk: [] },
  };
}

/**
 * Read all telemetry exporters
 * @returns {Promise<TelemetryExporters>} a promise resolving to telemetry exporters
 */
export async function readTelemetry({
  state,
}: {
  state: State;
}): Promise<TelemetryExporters> {
  try {
    debugMessage({ message: `TelemetryOps.readTelemetry: start`, state });
    const telemetry = await getTelemetryExporters({ state });
    debugMessage({ message: `TelemetryOps.readTelemetry: end`, state });
    return telemetry;
  } catch (e) {
    throw new FrodoError('Error reading telemetry exporters', e);
  }
}

/**
 * Export telemetry exporters, optionally filtered by id and/or category
 * @param {string} exporterId optional exporter id to filter by
 * @param {TelemetryExporterCategory} category optional category to filter by
 * @returns {Promise<TelemetryExportInterface>} a promise resolving to a TelemetryExportInterface object
 */
export async function exportTelemetry({
  exporterId,
  category,
  state,
}: {
  exporterId?: string;
  category?: TelemetryExporterCategory;
  state: State;
}): Promise<TelemetryExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({ message: `TelemetryOps.exportTelemetry: start`, state });
    const telemetry = await readTelemetry({ state });
    const exportData = createTelemetryExportTemplate({ state });

    const exporters = (
      Object.keys(telemetry) as TelemetryExporterCategory[]
    ).flatMap((cat) => {
      if (category && category !== cat) return [];

      return telemetry[cat]
        .filter((provider) => !exporterId || provider.id === exporterId)
        .map((provider) => ({ category: cat, provider }));
    });

    indicatorId = createProgressIndicator({
      total: exporters.length,
      message: 'Exporting telemetry exporters...',
      state,
    });

    for (const exporter of exporters) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting telemetry exporter ${exporter.provider.id}`,
        state,
      });

      exportData.telemetry[exporter.category].push(exporter.provider as any);
    }

    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${exporters.length} telemetry exporters.`,
      state,
    });
    debugMessage({ message: `TelemetryOps.exportTelemetry: end`, state });

    return exportData;
  } catch (e) {
    stopProgressIndicator({
      id: indicatorId,
      message: 'Error exporting telemetry exporters',
      status: 'fail',
      state,
    });
    throw new FrodoError('Error exporting telemetry', e);
  }
}
/**
 * Import telemetry exporters
 * @param {string} exporterId optional exporter id; if provided, only imports the specified exporter
 * @param {TelemetryExporterCategory} category optional exporter category; if provided, only imports exporters of the specified category
 * @param {TelemetryExportInterface} importData telemetry import data
 * @returns {Promise<LogExporterSkeleton[]>} the imported telemetry exporters
 */
export async function importTelemetry({
  exporterId,
  category,
  importData,
  state,
}: {
  exporterId?: string;
  category?: TelemetryExporterCategory;
  importData: TelemetryExportInterface;
  state: State;
}): Promise<LogExporterSkeleton[]> {
  try {
    debugMessage({ message: `TelemetryOps.importTelemetry: start`, state });
    const results: LogExporterSkeleton[] = [];

    for (const cat of Object.keys(
      importData.telemetry
    ) as TelemetryExporterCategory[]) {
      if (category && category !== cat) continue;
      for (const exporterData of importData.telemetry[cat]) {
        if (exporterId && exporterId !== exporterData.id) continue;

        const response = await updateTelemetry({
          category: cat,
          exporterId: exporterData.id,
          exporterData,
          state,
        });
        results.push(response);
      }
    }
    debugMessage({ message: `TelemetryOps.importTelemetry: end`, state });
    return results;
  } catch (e) {
    throw new FrodoError('Error importing telemetry exporters', e);
  }
}
/**
 * Create or update a single telemetry exporter
 * @param {TelemetryExporterCategory} category exporter category
 * @param {string} exporterId exporter id
 * @param {LogExporterSkeleton} exporterData exporter data
 * @returns {Promise<LogExporterSkeleton>} the created/updated exporter
 */
export async function updateTelemetry({
  category,
  exporterId,
  exporterData,
  state,
}: {
  category: TelemetryExporterCategory;
  exporterId: string;
  exporterData: LogExporterSkeleton;
  state: State;
}): Promise<LogExporterSkeleton> {
  try {
    debugMessage({ message: 'TelemetryOps.updateTelemetry: start', state });

    const result = await putTelemetryExporter({
      category,
      exporterId,
      exporterData,
      state,
    });

    debugMessage({ message: 'TelemetryOps.updateTelemetry: end', state });

    return result;
  } catch (e) {
    throw new FrodoError('Error updating telemetry exporter', e);
  }
}
/**
 * Delete telemetry exporters
 * @param {string} exporterId optional exporter id
 * @param {TelemetryExporterCategory} category optional exporter category
 * @returns {Promise<LogExporterSkeleton[]>}
 */
export async function deleteTelemetry({
  exporterId,
  category,
  state,
}: {
  exporterId?: string;
  category?: TelemetryExporterCategory;
  state: State;
}): Promise<LogExporterSkeleton[]> {
  try {
    debugMessage({ message: `TelemetryOps.deleteTelemetry: start`, state });

    const telemetry = await readTelemetry({ state });

    const results = [];
    for (const cat of Object.keys(telemetry) as TelemetryExporterCategory[]) {
      if (category && cat !== category) continue;

      for (const exporter of telemetry[cat]) {
        if (exporterId && exporter.id !== exporterId) continue;

        const response = await deleteTelemetryExporter({
          category: cat,
          exporterId: exporter.id,
          state,
        });
        results.push(response);
      }
    }

    debugMessage({ message: `TelemetryOps.deleteTelemetry: end`, state });
    return results;
  } catch (e) {
    throw new FrodoError('Error deleting telemetry exporters', e);
  }
}
