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
   * @param {boolean} clean Indicates whether to remove a possible existing service with the same id first.
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   * @returns Promise resolving when the service has been imported
   */
  importService(
    serviceId: string,
    importData: ServiceExportInterface,
    clean: boolean,
    globalConfig?: boolean
  ): Promise<AmServiceSkeleton>;
  /**
   * Imports multiple services from the same file. Optionally clean (remove) existing services first
   * @param {ServiceExportInterface} importData The service configuration export data to import
   * @param {boolean} clean Indicates whether to remove possible existing services first
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   */
  importServices(
    importData: ServiceExportInterface,
    clean: boolean,
    globalConfig?: boolean
  ): Promise<AmServiceSkeleton[]>;
};

export default (state: State): Service => {
  return {
    createServiceExportTemplate(): ServiceExportInterface {
      return createServiceExportTemplate();
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
     * @param {boolean} clean Indicates whether to remove a possible existing service with the same id first.
     * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
     * @returns Promise resolving when the service has been imported
     */
    async importService(
      serviceId: string,
      importData: ServiceExportInterface,
      clean: boolean,
      globalConfig = false
    ): Promise<AmServiceSkeleton> {
      return importService({
        serviceId,
        importData,
        clean,
        globalConfig,
        state,
      });
    },

    /**
     * Imports multiple services from the same file. Optionally clean (remove) existing services first
     * @param {ServiceExportInterface} importData The service configuration export data to import
     * @param {boolean} clean Indicates whether to remove possible existing services first
     * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
     */
    async importServices(
      importData: ServiceExportInterface,
      clean: boolean,
      globalConfig = false
    ) {
      return importServices({
        importData,
        clean,
        globalConfig,
        state,
      });
    },
  };
};

export interface ServiceExportInterface {
  meta?: Record<string, ExportMetaData>;
  service: Record<string, AmServiceSkeleton>;
}

/**
 * Create an empty service export template
 * @returns {SingleTreeExportInterface} an empty service export template
 */
export function createServiceExportTemplate(): ServiceExportInterface {
  return {
    meta: {},
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
        const message = error.response?.data?.message;
        printMessage({
          message: `Error deleting service '${serviceId}' before import: ${message}`,
          type: 'error',
          state,
        });
      }
    }
  }

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
 * @returns {Promise<AmService[]>} promise resolving to an array of service objects
 */
async function putFullServices({
  serviceEntries,
  clean,
  globalConfig = false,
  state,
}: {
  serviceEntries: [string, FullService][];
  clean: boolean;
  globalConfig: boolean;
  state: State;
}): Promise<AmServiceSkeleton[]> {
  debugMessage({
    message: `ServiceOps.putFullServices: start, globalConfig=${globalConfig}`,
    state,
  });
  const results: AmServiceSkeleton[] = [];
  for (const [id, data] of serviceEntries) {
    try {
      const result = await putFullService({
        serviceId: id,
        fullServiceData: data,
        clean,
        globalConfig,
        state,
      });
      results.push(result);
      printMessage({ message: `Imported: ${id}`, type: 'info', state });
    } catch (error) {
      const message = error.response?.data?.message;
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
  const exportData = createServiceExportTemplate();
  try {
    const service = await getService({ serviceId, globalConfig, state });
    service.nextDescendents = await getServiceDescendents({
      serviceId,
      globalConfig,
      state,
    });
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
  const exportData = createServiceExportTemplate();
  try {
    const services = await getFullServices({ globalConfig, state });
    createProgressIndicator({
      total: services.length,
      message: `Exporting${globalString}services...`,
      state,
    });
    for (const service of services) {
      updateProgressIndicator({
        message: `Exporting${globalString}service ${service._id}`,
        state,
      });
      exportData.service[service._type._id] = service;
    }
    stopProgressIndicator({
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
 * @param {boolean} clean Indicates whether to remove a possible existing service with the same id first.
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns Promise resolving when the service has been imported
 */
export async function importService({
  serviceId,
  importData,
  clean,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  importData: ServiceExportInterface;
  clean: boolean;
  globalConfig: boolean;
  state: State;
}): Promise<AmServiceSkeleton> {
  debugMessage({
    message: `ServiceOps.importService: start, globalConfig=${globalConfig}`,
    state,
  });
  const serviceData = importData.service[serviceId];
  const result = await putFullService({
    serviceId,
    fullServiceData: serviceData,
    clean,
    globalConfig,
    state,
  });
  debugMessage({ message: `ServiceOps.importService: end`, state });
  return result;
}

/**
 * Imports multiple services from the same file. Optionally clean (remove) existing services first
 * @param {ServiceExportInterface} importData The service configuration export data to import
 * @param {boolean} clean Indicates whether to remove possible existing services first
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 */
export async function importServices({
  importData,
  clean,
  globalConfig = false,
  state,
}: {
  importData: ServiceExportInterface;
  clean: boolean;
  globalConfig: boolean;
  state: State;
}) {
  debugMessage({
    message: `ServiceOps.importServices: start, globalConfig=${globalConfig}`,
    state,
  });
  try {
    const result = await putFullServices({
      serviceEntries: Object.entries(importData.service),
      clean,
      globalConfig,
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
