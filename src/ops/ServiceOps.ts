import {
  type AmServiceSkeleton,
  deleteService,
  deleteServiceNextDescendent,
  type FullService,
  getListOfServices as _getListOfServices,
  getService,
  getServiceDescendents,
  putService,
  putServiceNextDescendent,
} from '../api/ServiceApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { type ExportMetaData } from './OpsTypes';

export type Service = {
  createServiceExportTemplate(): ServiceExportInterface;
  /**
   * Get list of services
   * @param {boolean} globalConfig true if the list of global services is requested, false otherwise. Default: false.
   */
  getListOfServices(
    globalConfig?: boolean
  ): Promise<import('../api/ServiceApi').ServiceListItem[]>;
  /**
   * Get all services including their descendents.
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   * @returns Promise resolving to an array of services with their descendants
   */
  getFullServices(globalConfig?: boolean): Promise<FullService[]>;
  /**
   * Deletes the specified service
   * @param {string} serviceId The service to delete
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   */
  deleteFullService(serviceId: string, globalConfig?: boolean): Promise<void>;
  /**
   * Deletes all services
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   */
  deleteFullServices(globalConfig?: boolean): Promise<void>;
  /**
   * Export service. The response can be saved to file as is.
   * @param serviceId service id/name
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<ServiceExportInterface>} Promise resolving to a ServiceExportInterface object.
   */
  exportService(
    serviceId: string,
    globalConfig?: boolean
  ): Promise<ServiceExportInterface>;
  /**
   * Export all services
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   */
  exportServices(globalConfig?: boolean): Promise<ServiceExportInterface>;
  /**
   * Imports a single service using a reference to the service and a file to read the data from. Optionally clean (remove) an existing service first
   * @param {string} serviceId The service id/name to add
   * @param {ServiceExportInterface} importData The service configuration export data to import
   * @param {ServiceImportOptions} options Import options
   * @returns {Promise<AmServiceSkeleton>} A promise resolving to a service object
   */
  importService(
    serviceId: string,
    importData: ServiceExportInterface,
    options: ServiceImportOptions
  ): Promise<AmServiceSkeleton>;
  /**
   * Imports multiple services from the same file. Optionally clean (remove) existing services first
   * @param {ServiceExportInterface} importData The service configuration export data to import
   * @param {ServiceImportOptions} options Import options
   * @returns {Promise<AmServiceSkeleton[]>} A promise resolving to an array of service objects
   */
  importServices(
    importData: ServiceExportInterface,
    options: ServiceImportOptions
  ): Promise<AmServiceSkeleton[]>;
};

export default (state: State): Service => {
  return {
    createServiceExportTemplate(): ServiceExportInterface {
      return createServiceExportTemplate({ state });
    },

    /**
     * Get list of services
     * @param {boolean} globalConfig true if the list of global services is requested, false otherwise. Default: false.
     */
    async getListOfServices(globalConfig = false) {
      return getListOfServices({ globalConfig, state });
    },

    /**
     * Get all services including their descendents.
     * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
     * @returns Promise resolving to an array of services with their descendants
     */
    async getFullServices(globalConfig = false): Promise<FullService[]> {
      return getFullServices({ globalConfig, state });
    },

    /**
     * Deletes the specified service
     * @param {string} serviceId The service to delete
     * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
     */
    async deleteFullService(serviceId: string, globalConfig = false) {
      return deleteFullService({ serviceId, globalConfig, state });
    },

    /**
     * Deletes all services
     * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
     */
    async deleteFullServices(globalConfig = false) {
      return deleteFullServices({ globalConfig, state });
    },

    /**
     * Export service. The response can be saved to file as is.
     * @param serviceId service id/name
     * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
     * @returns {Promise<ServiceExportInterface>} Promise resolving to a ServiceExportInterface object.
     */
    async exportService(
      serviceId: string,
      globalConfig = false
    ): Promise<ServiceExportInterface> {
      return exportService({ serviceId, globalConfig, state });
    },

    /**
     * Export all services
     * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
     */
    async exportServices(
      globalConfig = false
    ): Promise<ServiceExportInterface> {
      return exportServices({ globalConfig, state });
    },

    /**
     * Imports a single service using a reference to the service and a file to read the data from. Optionally clean (remove) an existing service first
     * @param {string} serviceId The service id/name to add
     * @param {ServiceExportInterface} importData The service configuration export data to import
     * @param {ServiceImportOptions} options Import options
     * @returns {Promise<AmServiceSkeleton>} A promise resolving to a service object
     */
    async importService(
      serviceId: string,
      importData: ServiceExportInterface,
      options: ServiceImportOptions = {
        clean: false,
        global: false,
        realm: false,
      }
    ): Promise<AmServiceSkeleton> {
      return importService({
        serviceId,
        importData,
        options,
        state,
      });
    },

    /**
     * Imports multiple services from the same file. Optionally clean (remove) existing services first
     * @param {ServiceExportInterface} importData The service configuration export data to import
     * @param {ServiceImportOptions} options Import options
     * @returns {Promise<AmServiceSkeleton[]>} A promise resolving to an array of service objects
     */
    async importServices(
      importData: ServiceExportInterface,
      options: ServiceImportOptions = {
        clean: false,
        global: false,
        realm: false,
      }
    ): Promise<AmServiceSkeleton[]> {
      return importServices({
        importData,
        options,
        state,
      });
    },
  };
};

export interface ServiceExportInterface {
  meta?: ExportMetaData;
  service: Record<string, AmServiceSkeleton>;
}

/**
 * Service import options
 */
export interface ServiceImportOptions {
  /**
   * Indicates whether to remove previously existing services of the same id before importing
   */
  clean: boolean;

  /**
   * Indicates whether to import service(s) as global services
   */
  global: boolean;

  /**
   * Indicates whether to import service(s) to the current realm
   */
  realm: boolean;
}

/**
 * Create an empty service export template
 * @returns {SingleTreeExportInterface} an empty service export template
 */
export function createServiceExportTemplate({
  state,
}: {
  state: State;
}): ServiceExportInterface {
  return {
    meta: getMetadata({ state }),
    service: {},
  } as ServiceExportInterface;
}

/**
 * Get list of services
 * @param {boolean} globalConfig true if the list of global services is requested, false otherwise. Default: false.
 */
export async function getListOfServices({
  globalConfig = false,
  state,
}: {
  globalConfig: boolean;
  state: State;
}) {
  debugMessage({ message: `ServiceOps.getListOfServices: start`, state });
  const services = (await _getListOfServices({ globalConfig, state })).result;
  debugMessage({ message: `ServiceOps.getListOfServices: end`, state });
  return services;
}

/**
 * Get all services including their descendents.
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns Promise resolving to an array of services with their descendants
 */
export async function getFullServices({
  globalConfig = false,
  state,
}: {
  globalConfig: boolean;
  state: State;
}): Promise<FullService[]> {
  debugMessage({
    message: `ServiceOps.getFullServices: start, globalConfig=${globalConfig}`,
    state,
  });
  const serviceList = (await _getListOfServices({ globalConfig, state }))
    .result;

  const fullServiceData = await Promise.all(
    serviceList.map(async (listItem) => {
      try {
        const [service, nextDescendents] = await Promise.all([
          getService({ serviceId: listItem._id, globalConfig, state }),
          getServiceDescendents({
            serviceId: listItem._id,
            globalConfig,
            state,
          }),
        ]);

        return {
          ...service,
          nextDescendents,
        };
      } catch (error) {
        if (
          !(
            error.response?.status === 403 &&
            error.response?.data?.message ===
              'This operation is not available in ForgeRock Identity Cloud.'
          )
        ) {
          const message = error.response?.data?.message;
          printMessage({
            message: `Unable to retrieve data for ${listItem._id} with error: ${message}`,
            type: 'error',
            state,
          });
        }
      }
    })
  );

  debugMessage({ message: `ServiceOps.getFullServices: end`, state });
  return fullServiceData.filter((data) => !!data); // make sure to filter out any undefined objects
}

/**
 * Saves a service including descendents
 * @param {string} serviceId the service id / name
 * @param {FullService} fullServiceData service object including descendants
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns promise resolving to a service object
 */
async function putFullService({
  serviceId,
  fullServiceData,
  clean,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  fullServiceData: FullService;
  clean: boolean;
  globalConfig: boolean;
  state: State;
}): Promise<AmServiceSkeleton> {
  debugMessage({
    message: `ServiceOps.putFullService: start, serviceId=${serviceId}, globalConfig=${globalConfig}`,
    state,
  });
  const nextDescendents = fullServiceData.nextDescendents;

  delete fullServiceData.nextDescendents;
  delete fullServiceData._rev;
  delete fullServiceData.enabled;

  if (clean) {
    try {
      debugMessage({ message: `ServiceOps.putFullService: clean`, state });
      await deleteFullService({ serviceId, globalConfig, state });
    } catch (error) {
      if (
        !(
          error.response?.status === 404 &&
          error.response?.data?.message === 'Not Found'
        )
      ) {
        const message = error.response?.data?.message || error;
        printMessage({
          message: `Error deleting service '${serviceId}' before import: ${message}`,
          type: 'error',
          state,
        });
      }
    }
  }

  // delete location field before adding or updating the service
  delete fullServiceData.location;

  // create service first
  const result = await putService({
    serviceId,
    serviceData: fullServiceData,
    globalConfig,
    state,
  });

  // return fast if no next descendents supplied
  if (nextDescendents.length === 0) {
    debugMessage({
      message: `ServiceOps.putFullService: end (w/o descendents)`,
      state,
    });
    return result;
  }

  // now create next descendents
  await Promise.all(
    nextDescendents.map(async (descendent) => {
      const type = descendent._type._id;
      const descendentId = descendent._id;
      debugMessage({
        message: `ServiceOps.putFullService: descendentId=${descendentId}`,
        state,
      });
      let result = undefined;
      try {
        result = await putServiceNextDescendent({
          serviceId,
          serviceType: type,
          serviceNextDescendentId: descendentId,
          serviceNextDescendentData: descendent,
          globalConfig,
          state,
        });
      } catch (error) {
        const message = error.response?.data?.message;
        printMessage({
          message: `Put descendent '${descendentId}' of service '${serviceId}': ${message}`,
          type: 'error',
          state,
        });
      }
      return result;
    })
  );
  debugMessage({
    message: `ServiceOps.putFullService: end (w/ descendents)`,
    state,
  });
}

/**
 * Saves multiple services using the serviceEntries which contain both id and data with descendants
 * @param {[string, FullService][]} serviceEntries The services to add
 * @param {boolean} clean Indicates whether to remove possible existing services first
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @param {boolean} realmConfig true if the current realm service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AmService[]>} promise resolving to an array of service objects
 */
async function putFullServices({
  serviceEntries,
  clean,
  globalConfig = false,
  realmConfig = false,
  state,
}: {
  serviceEntries: [string, FullService][];
  clean: boolean;
  globalConfig: boolean;
  realmConfig: boolean;
  state: State;
}): Promise<AmServiceSkeleton[]> {
  debugMessage({
    message: `ServiceOps.putFullServices: start, globalConfig=${globalConfig}`,
    state,
  });
  const results: AmServiceSkeleton[] = [];
  for (const [id, data] of serviceEntries) {
    try {
      let result;
      if (globalConfig || (!realmConfig && data.location === 'global')) {
        result = await putFullService({
          serviceId: id,
          fullServiceData: data,
          clean,
          globalConfig: true,
          state,
        });
      }
      if (
        realmConfig ||
        (!globalConfig && data.location === state.getRealm())
      ) {
        result = await putFullService({
          serviceId: id,
          fullServiceData: data,
          clean,
          globalConfig: false,
          state,
        });
      }
      if (result) results.push(result);
      printMessage({ message: `Imported: ${id}`, type: 'info', state });
    } catch (error) {
      const message = error.response?.data?.message || error;
      const detail = error.response?.data?.detail;
      printMessage({
        message: `Import service '${id}': ${message}`,
        type: 'error',
        state,
      });
      if (detail) {
        printMessage({
          message: `Details: ${JSON.stringify(detail)}`,
          type: 'error',
          state,
        });
      }
    }
  }
  debugMessage({ message: `ServiceOps.putFullServices: end`, state });
  return results;
}

/**
 * Deletes the specified service
 * @param {string} serviceId The service to delete
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 */
export async function deleteFullService({
  serviceId,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  globalConfig: boolean;
  state: State;
}) {
  debugMessage({
    message: `ServiceOps.deleteFullService: start, globalConfig=${globalConfig}`,
    state,
  });
  const serviceNextDescendentData = await getServiceDescendents({
    serviceId,
    globalConfig,
    state,
  });

  await Promise.all(
    serviceNextDescendentData.map((nextDescendent) =>
      deleteServiceNextDescendent({
        serviceId,
        serviceType: nextDescendent._type._id,
        serviceNextDescendentId: nextDescendent._id,
        globalConfig,
        state,
      })
    )
  );

  await deleteService({ serviceId, globalConfig, state });
  debugMessage({ message: `ServiceOps.deleteFullService: end`, state });
}

/**
 * Deletes all services
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 */
export async function deleteFullServices({
  globalConfig = false,
  state,
}: {
  globalConfig: boolean;
  state: State;
}) {
  debugMessage({
    message: `ServiceOps.deleteFullServices: start, globalConfig=${globalConfig}`,
    state,
  });
  try {
    const serviceList = (await _getListOfServices({ globalConfig, state }))
      .result;

    await Promise.all(
      serviceList.map(async (serviceListItem) => {
        try {
          await deleteFullService({
            serviceId: serviceListItem._id,
            globalConfig,
            state,
          });
        } catch (error) {
          if (
            !(
              error.response?.status === 403 &&
              error.response?.data?.message ===
                'This operation is not available in ForgeRock Identity Cloud.'
            )
          ) {
            const message = error.response?.data?.message;
            printMessage({
              message: `Delete service '${serviceListItem._id}': ${message}`,
              state,
              type: 'error',
            });
          }
        }
      })
    );
  } catch (error) {
    const message = error.response?.data?.message;
    printMessage({
      message: `Delete services: ${message}`,
      type: 'error',
      state,
    });
  }
  debugMessage({ message: `ServiceOps.deleteFullServices: end`, state });
}

/**
 * Export service. The response can be saved to file as is.
 * @param serviceId service id/name
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<ServiceExportInterface>} Promise resolving to a ServiceExportInterface object.
 */
export async function exportService({
  serviceId,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  globalConfig: boolean;
  state: State;
}): Promise<ServiceExportInterface> {
  debugMessage({
    message: `ServiceOps.exportService: start, globalConfig=${globalConfig}`,
    state,
  });
  const exportData = createServiceExportTemplate({ state });
  try {
    const service = await getService({ serviceId, globalConfig, state });
    service.nextDescendents = await getServiceDescendents({
      serviceId,
      globalConfig,
      state,
    });
    service.location = globalConfig ? 'global' : state.getRealm();
    exportData.service[serviceId] = service;
  } catch (error) {
    const message = error.response?.data?.message;
    printMessage({
      message: `Export service '${serviceId}': ${message}`,
      type: 'error',
      state,
    });
  }
  debugMessage({ message: `ServiceOps.exportService: end`, state });
  return exportData;
}

/**
 * Export all services
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 */
export async function exportServices({
  globalConfig = false,
  state,
}: {
  globalConfig: boolean;
  state: State;
}): Promise<ServiceExportInterface> {
  debugMessage({
    message: `ServiceOps.exportServices: start, globalConfig=${globalConfig}`,
    state,
  });
  const globalString = globalConfig ? ' global ' : ' ';
  const exportData = createServiceExportTemplate({ state });
  let indicatorId: string;
  try {
    const services = await getFullServices({ globalConfig, state });
    indicatorId = createProgressIndicator({
      total: services.length,
      message: `Exporting${globalString}services...`,
      state,
    });
    for (const service of services) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting${globalString}service ${service._id}`,
        state,
      });
      service.location = globalConfig ? 'global' : state.getRealm();
      exportData.service[service._type._id] = service;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${services.length}${globalString}services.`,
      state,
    });
  } catch (error) {
    const message = error.response?.data?.message;
    printMessage({
      message: `Export${globalString}services: ${message}`,
      type: 'error',
      state,
    });
  }
  debugMessage({ message: `ServiceOps.exportServices: end`, state });
  return exportData;
}

/**
 * Imports a single service using a reference to the service and a file to read the data from. Optionally clean (remove) an existing service first
 * @param {string} serviceId The service id/name to add
 * @param {ServiceExportInterface} importData The service configuration export data to import
 * @param {ServiceImportOptions} options Import options
 * @returns {Promise<AmServiceSkeleton>} A promise resolving to a service object
 */
export async function importService({
  serviceId,
  importData,
  options = {
    clean: false,
    global: false,
    realm: false,
  },
  state,
}: {
  serviceId: string;
  importData: ServiceExportInterface;
  options: ServiceImportOptions;
  state: State;
}): Promise<AmServiceSkeleton> {
  debugMessage({
    message: `ServiceOps.importService: start, global=${options.global}, realm=${options.realm}`,
    state,
  });
  const serviceData = importData.service[serviceId];
  let result;
  if (options.global || (!options.realm && serviceData.location === 'global')) {
    result = await putFullService({
      serviceId,
      fullServiceData: serviceData,
      clean: options.clean,
      globalConfig: true,
      state,
    });
  }
  if (
    options.realm ||
    (!options.global && serviceData.location === state.getRealm())
  ) {
    result = await putFullService({
      serviceId,
      fullServiceData: serviceData,
      clean: options.clean,
      globalConfig: false,
      state,
    });
  }
  debugMessage({ message: `ServiceOps.importService: end`, state });
  return result;
}

/**
 * Imports multiple services from the same file. Optionally clean (remove) existing services first
 * @param {ServiceExportInterface} importData The service configuration export data to import
 * @param {ServiceImportOptions} options Import options
 * @returns {Promise<AmServiceSkeleton[]>} A promise resolving to an array of service objects
 */
export async function importServices({
  importData,
  options = {
    clean: false,
    global: false,
    realm: false,
  },
  state,
}: {
  importData: ServiceExportInterface;
  options: ServiceImportOptions;
  state: State;
}): Promise<AmServiceSkeleton[]> {
  debugMessage({
    message: `ServiceOps.importServices: start, global=${options.global}, realm=${options.realm}`,
    state,
  });
  try {
    const result = await putFullServices({
      serviceEntries: Object.entries(importData.service),
      clean: options.clean,
      globalConfig: options.global,
      realmConfig: options.realm,
      state,
    });
    debugMessage({ message: `ServiceOps.importServices: end`, state });
    return result;
  } catch (error) {
    const message = error.response?.data?.message;
    const detail = error.response?.data?.detail;
    printMessage({
      message: `Unable to import services: error: ${message}`,
      type: 'error',
      state,
    });
    if (detail) {
      printMessage({
        message: `Details: ${JSON.stringify(detail)}`,
        type: 'error',
        state,
      });
    }
    throw error;
  }
}
