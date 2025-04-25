import {
  type AmServiceSkeleton,
  type ServiceNextDescendent,
  deleteService,
  deleteServiceNextDescendent,
  type FullService,
  getListOfServices as _getListOfServices,
  getService,
  getServiceDescendents,
  putService,
  putServiceNextDescendent,
  ServiceNextDescendentResponse,
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
import { cloneDeep } from '../utils/JsonUtils';
import { FrodoError } from './FrodoError';
import { type ExportMetaData } from './OpsTypes';

export type Service = {
  createServiceExportTemplate(): ServiceExportInterface;
  /**
   * Get list of services
   * @param {boolean} globalConfig true if the list of global services is requested, false otherwise. Default: false.
   */
  getListOfServices(
    globalConfig?: boolean
  ): Promise<import('../api/ServiceApi').AmServiceSkeleton[]>;
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
  deleteFullService(
    serviceId: string,
    globalConfig?: boolean
  ): Promise<AmServiceSkeleton>;
  deleteServiceNextDescendentOnly(
    serviceId:string,
    globalConfig?:boolean
  ):Promise<ServiceNextDescendent>;
  /**
   * Deletes all services
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   */
  deleteFullServices(globalConfig?: boolean): Promise<AmServiceSkeleton[]>;
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
    async deleteFullService(
      serviceId: string,
      globalConfig = false
    ): Promise<AmServiceSkeleton> {
      return deleteFullService({ serviceId, globalConfig, state });
    },
    async deleteServiceNextDescendentOnly(
      serviceId:string,
      globalConfig =false
    ): Promise<ServiceNextDescendent> {
      return deleteServiceNextDescentdentOnly({serviceId,globalConfig, state});
    },
    /**
     * Deletes all services
     * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
     */
    async deleteFullServices(
      globalConfig: boolean = false
    ): Promise<AmServiceSkeleton[]> {
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
  try {
    debugMessage({ message: `ServiceOps.getListOfServices: start`, state });
    // Filter out the Scripting service entities since they consist of scripts, which are handled in ScriptOps.
    const services = (
      await _getListOfServices({ globalConfig, state })
    ).result.filter((s) => !(s._type && s._type.name === 'Scripting'));
    debugMessage({ message: `ServiceOps.getListOfServices: end`, state });
    return services;
  } catch (error) {
    throw new FrodoError(
      `Error getting list of ${globalConfig ? 'global' : 'realm'} services`,
      error
    );
  }
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
  try {
    debugMessage({
      message: `ServiceOps.getFullServices: start, globalConfig=${globalConfig}`,
      state,
    });
    const serviceList = await getListOfServices({ globalConfig, state });

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
              'This operation is not available in PingOne Advanced Identity Cloud.'
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
  } catch (error) {
    throw new FrodoError(
      `Error getting ${globalConfig ? 'global' : 'realm'} full service configs`,
      error
    );
  }
}

/**
 * Saves a service including descendents
 * @param {string} serviceId the service id / name
 * @param {FullService} fullServiceData service object including descendants
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns promise resolving to a service object
 */
export async function putFullService({
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
  try {
    debugMessage({
      message: `ServiceOps.putFullService: start, serviceId=${serviceId}, globalConfig=${globalConfig}`,
      state,
    });
    const fullServiceDataCopy = cloneDeep(fullServiceData);
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
          throw new FrodoError(
            `Error deleting service '${serviceId}' before import`,
            error
          );
        }
      }
    }

    // delete location field before adding or updating the service
    delete fullServiceData.location;

    // special-case email service, which may contain circular dependency
    if (serviceId === 'email' && fullServiceData.transportType) {
      // delete transport type so we can set it later from fullServiceDataCopy
      delete fullServiceData.transportType;
    }

    // create service first
    let result = await putService({
      serviceId,
      serviceData: fullServiceData,
      globalConfig,
      state,
    });

    // return fast if no next descendents supplied
    if (!nextDescendents || nextDescendents.length === 0) {
      debugMessage({
        message: `ServiceOps.putFullService: end (w/o descendents)`,
        state,
      });
      return result;
    }

    // now create next descendents
    const nextDescendentResult = await Promise.all(
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
          throw new FrodoError(
            `Error putting descendent '${descendentId}' of service '${serviceId}'`,
            error
          );
        }
        return result;
      })
    );

    // special-case email service, which may contain circular dependency
    if (serviceId === 'email' && fullServiceDataCopy.transportType) {
      // delete transport type so we can set it later from fullServiceDataCopy
      fullServiceData.transportType = fullServiceDataCopy.transportType;

      // create service first
      result = await putService({
        serviceId,
        serviceData: fullServiceData,
        globalConfig,
        state,
      });
    }

    // finally add nextDescendentResult
    result.nextDescendents = nextDescendentResult;

    debugMessage({
      message: `ServiceOps.putFullService: end (w/ descendents)`,
      state,
    });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error putting ${globalConfig ? 'global' : 'realm'
      } full service config ${serviceId}`,
      error
    );
  }
}

/**
 * Saves multiple services using the serviceEntries which contain both id and data with descendants
 * @param {[string, FullService][]} serviceEntries The services to add
 * @param {boolean} clean Indicates whether to remove possible existing services first
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @param {boolean} realmConfig true if the current realm service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AmService[]>} promise resolving to an array of service objects
 */
export async function putFullServices({
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
  const errors: Error[] = [];
  const results: AmServiceSkeleton[] = [];
  for (const [id, data] of serviceEntries) {
    try {
      let result: AmServiceSkeleton;
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
      debugMessage({ message: `Imported: ${id}`, state });
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(
      `Error putting ${globalConfig ? 'global' : 'realm'} full service configs`,
      errors
    );
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
  try {
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

    debugMessage({ message: `ServiceOps.deleteFullService: end`, state });
    return deleteService({ serviceId, globalConfig, state });
  } catch (error) {
    throw new FrodoError(
      `Error deleting ${globalConfig ? 'global' : 'realm'
      } full service config ${serviceId}`,
      error
    );
  }
}

export async function deleteServiceNextDescentdentOnly({
  serviceId,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  globalConfig: boolean;
  state: State;
}):Promise<ServiceNextDescendent> {
  try {
    debugMessage({
      message: `ServiceOps.deleteServiceDescendentOnly: start, globalConfig=${globalConfig}`,
      state,
    });
    const serviceNextDescendentData = await getServiceDescendents({
      serviceId,
      globalConfig,
      state,
    });

    return await Promise.all (serviceNextDescendentData.map((nextDescendent) => deleteServiceNextDescendent({
          serviceId,
          serviceType: nextDescendent._type._id,
          serviceNextDescendentId: nextDescendent._id,
          globalConfig,
          state,
        })
      )
    )
  }
  catch (error) {
    throw new FrodoError(
      `Error deleting ${globalConfig ? 'global' : 'realm'
      } full service config ${serviceId}`,
      error
    );
  }
}
/**
 * Deletes all services
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @return {Promise<AmServiceSkeleton[]>} a promise resolving to an array of deleted service objects
 */
export async function deleteFullServices({
  globalConfig = false,
  state,
}: {
  globalConfig: boolean;
  state: State;
}): Promise<AmServiceSkeleton[]> {
  debugMessage({
    message: `ServiceOps.deleteFullServices: start, globalConfig=${globalConfig}`,
    state,
  });
  try {
    const serviceList = await getListOfServices({ globalConfig, state });

    const deleted: AmServiceSkeleton[] = await Promise.all(
      serviceList.map(async (serviceListItem) => {
        try {
          return deleteFullService({
            serviceId: serviceListItem._id,
            globalConfig,
            state,
          });
        } catch (error) {
          if (
            !(
              error.response?.status === 403 &&
              error.response?.data?.message ===
              'This operation is not available in PingOne Advanced Identity Cloud.'
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
    debugMessage({ message: `ServiceOps.deleteFullServices: end`, state });
    return deleted;
  } catch (error) {
    throw new FrodoError(
      `Error deleting ${globalConfig ? 'global' : 'realm'
      } full service configs`,
      error
    );
  }
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
  try {
    debugMessage({
      message: `ServiceOps.exportService: start, globalConfig=${globalConfig}`,
      state,
    });
    const exportData = createServiceExportTemplate({ state });
    const service = await getService({ serviceId, globalConfig, state });
    service.nextDescendents = await getServiceDescendents({
      serviceId,
      globalConfig,
      state,
    });
    service.location = globalConfig ? 'global' : state.getRealm();
    exportData.service[serviceId] = service;
    debugMessage({ message: `ServiceOps.exportService: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting ${globalConfig ? 'global' : 'realm'
      } service ${serviceId}`,
      error
    );
  }
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
  let indicatorId: string;
  try {
    const exportData = createServiceExportTemplate({ state });
    const services = await getFullServices({ globalConfig, state });
    indicatorId = createProgressIndicator({
      total: services.length,
      message: `Exporting ${globalConfig ? 'global' : 'realm'} services...`,
      state,
    });
    for (const service of services) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting ${globalConfig ? 'global' : 'realm'} service ${service._id
          }`,
        state,
      });
      service.location = globalConfig ? 'global' : state.getRealm();
      exportData.service[service._type._id] = service;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${services.length} ${globalConfig ? 'global' : 'realm'
        } services.`,
      state,
    });
    debugMessage({ message: `ServiceOps.exportServices: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting ${globalConfig ? 'global' : 'realm'} services.`,
      status: 'fail',
      state,
    });
    throw new FrodoError(
      `Error exporting ${globalConfig ? 'global' : 'realm'} services`,
      error
    );
  }
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
  try {
    debugMessage({
      message: `ServiceOps.importService: start, global=${options.global}, realm=${options.realm}`,
      state,
    });
    const serviceData = importData.service[serviceId];
    let result: AmServiceSkeleton;
    if (
      options.global ||
      (!options.realm && serviceData.location === 'global')
    ) {
      result = await putFullService({
        serviceId,
        fullServiceData: serviceData,
        clean: options.clean,
        globalConfig: true,
        state,
      });
      debugMessage({ message: `ServiceOps.importService: end`, state });
      return result;
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
      debugMessage({ message: `ServiceOps.importService: end`, state });
      return result;
    }
    throw new FrodoError(
      `Nothing to do! If the service you are attempting to import is a global service, make sure to specify so explicitly or if the service was exported from a different realm, make sure to explicitly specify to import into the current realm. Current options:\nExplicitly import into current realm: ${options.realm}\nExported from realm: ${serviceData.location}\nGlobal service: ${options.global}`
    );
  } catch (error) {
    throw new FrodoError(`Error importing service ${serviceId}`, error);
  }
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
    throw new FrodoError(`Error importing services`, error);
  }
}
