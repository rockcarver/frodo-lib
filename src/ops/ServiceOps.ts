import {
  getListOfServices as _getListOfServices,
  deleteService,
  deleteServiceNextDescendent,
  getService,
  getServiceDescendents,
  putService,
  putServiceNextDescendent,
  type AmServiceSkeleton,
  type FullService,
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
import { getCurrentRealmName } from '../utils/ForgeRockUtils';
import { cloneDeep } from '../utils/JsonUtils';
import { FrodoError } from './FrodoError';
import { type ExportMetaData, type ResultCallback } from './OpsTypes';

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
   * @param {ResultCallback<FullService>} resultCallback Optional callback to process individual results. With a callback, a service that cannot be read is passed to it as an error that names the service and does not fail the read: the services that could be read are returned.
   * @returns Promise resolving to an array of services with their descendants
   * @throws {FrodoError} Without a callback, after all services are attempted, names each failed service. Services unavailable in PingOne Advanced Identity Cloud are skipped.
   */
  getFullServices(
    globalConfig?: boolean,
    resultCallback?: ResultCallback<FullService>
  ): Promise<FullService[]>;
  /**
   * Deletes the specified service
   * @param {string} serviceId The service to delete
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   */
  deleteFullService(
    serviceId: string,
    globalConfig?: boolean
  ): Promise<AmServiceSkeleton>;
  /**
   * Deletes all services
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   * @returns Promise resolving to an array of deleted services
   * @throws {FrodoError} After all services are attempted, names each failed service. Successful deletes are reported, and services unavailable in PingOne Advanced Identity Cloud are skipped.
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
   * @param {ResultCallback<FullService>} resultCallback Optional callback to process individual results. With a callback, a service that cannot be read is passed to it as an error that names the service and is left out of the export; without one the export fails.
   */
  exportServices(
    globalConfig?: boolean,
    resultCallback?: ResultCallback<FullService>
  ): Promise<ServiceExportInterface>;
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
     * @param {ResultCallback<FullService>} resultCallback Optional callback to process individual results
     * @returns Promise resolving to an array of services with their descendants
     */
    async getFullServices(
      globalConfig = false,
      resultCallback: ResultCallback<FullService> = void 0
    ): Promise<FullService[]> {
      return getFullServices({ globalConfig, resultCallback, state });
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
     * @param {ResultCallback<FullService>} resultCallback Optional callback to process individual results
     */
    async exportServices(
      globalConfig = false,
      resultCallback: ResultCallback<FullService> = void 0
    ): Promise<ServiceExportInterface> {
      return exportServices({ globalConfig, resultCallback, state });
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

function isUnavailableServiceError(error: unknown): boolean {
  const httpError = error as {
    response?: { status?: number; data?: { message?: string } };
    httpStatus?: number;
    httpMessage?: string;
  };
  return (
    (httpError?.response?.status ?? httpError?.httpStatus) === 403 &&
    (httpError?.response?.data?.message ?? httpError?.httpMessage) ===
      'This operation is not available in PingOne Advanced Identity Cloud.'
  );
}

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
}): Promise<AmServiceSkeleton[]> {
  try {
    debugMessage({ message: `ServiceOps.getListOfServices: start`, state });
    // Filter out the Scripting service entities since they consist of scripts, which are handled in ScriptOps.
    const services = (
      await _getListOfServices({ globalConfig, state })
    ).result.filter((s) => !(s._type && s._type.name === 'Scripting'));
    debugMessage({ message: `ServiceOps.getListOfServices: end`, state });
    return services;
  } catch (error) {
    if (
      error.response?.status === 403 &&
      error.response?.data?.message ===
        'This operation is not available in PingOne Advanced Identity Cloud.'
    ) {
      return [];
    } else {
      throw new FrodoError(
        `Error getting list of ${globalConfig ? 'global' : `${getCurrentRealmName(state) + ' realm'}`} services`,
        error
      );
    }
  }
}

/**
 * Get all services including their descendents.
 * Every service is attempted. Without a result callback the function throws one error after all services were attempted that carries one nested error per service that could not be read. With a result callback each service is passed to it as it is read (a service that cannot be read as an error that names the service), nothing is thrown for such a service, and the services that could be read are returned. A failure to list the services always throws.
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @param {ResultCallback<FullService>} resultCallback Optional callback to process individual results
 * @returns Promise resolving to an array of services with their descendants
 */
export async function getFullServices({
  globalConfig = false,
  resultCallback = void 0,
  state,
}: {
  globalConfig: boolean;
  resultCallback?: ResultCallback<FullService>;
  state: State;
}): Promise<FullService[]> {
  const errors: FrodoError[] = [];
  let fullServiceData: FullService[];
  try {
    debugMessage({
      message: `ServiceOps.getFullServices: start, globalConfig=${globalConfig}`,
      state,
    });
    const serviceList = await getListOfServices({ globalConfig, state });

    fullServiceData = await Promise.all(
      serviceList.map(async (listItem) => {
        try {
          const results = await Promise.allSettled([
            getService({ serviceId: listItem._id, globalConfig, state }),
            getServiceDescendents({
              serviceId: listItem._id,
              globalConfig,
              state,
            }),
          ]);
          const failures = results
            .filter((result) => result.status === 'rejected')
            .filter((result) => !isUnavailableServiceError(result.reason));
          if (failures.length > 0) {
            throw new FrodoError(
              `Error reading service '${listItem._id}'`,
              failures.map((result) => result.reason)
            );
          }
          const [service, nextDescendents] = results;
          if (
            service.status !== 'fulfilled' ||
            nextDescendents.status !== 'fulfilled'
          ) {
            return;
          }

          const fullService = {
            ...service.value,
            nextDescendents: nextDescendents.value,
          };
          if (resultCallback) resultCallback(undefined, fullService);
          return fullService;
        } catch (error) {
          if (!isUnavailableServiceError(error)) {
            const failure = new FrodoError(
              `Unable to retrieve data for service '${listItem._id}'`,
              error
            );
            if (resultCallback) resultCallback(failure);
            else errors.push(failure);
          }
        }
      })
    );
  } catch (error) {
    throw new FrodoError(
      `Error getting ${globalConfig ? 'global' : `${getCurrentRealmName(state) + ' realm'}`} full service configs`,
      error
    );
  }
  if (errors.length > 0) {
    throw new FrodoError(
      `Error getting ${globalConfig ? 'global' : `${getCurrentRealmName(state) + ' realm'}`} full service configs: ${errors.map((error) => error.message).join('; ')}`,
      errors
    );
  }
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
    const nextDescendents = fullServiceDataCopy.nextDescendents;
    const transportType = fullServiceDataCopy.transportType;

    delete fullServiceDataCopy.nextDescendents;
    delete fullServiceDataCopy._rev;
    delete fullServiceDataCopy.enabled;

    if (clean) {
      try {
        debugMessage({ message: `ServiceOps.putFullService: clean`, state });
        await deleteFullService({ serviceId, globalConfig, state });
      } catch (error) {
        if (!(
          error.response?.status === 404 &&
          error.response?.data?.message === 'Not Found'
        )) {
          throw new FrodoError(
            `Error deleting service '${serviceId}' before import`,
            error
          );
        }
      }
    }

    // delete location field before adding or updating the service
    delete fullServiceDataCopy.location;

    // special-case email service, which may contain circular dependency
    if (serviceId === 'email' && transportType) {
      // delete transport type so we can set it later from fullServiceDataCopy
      delete fullServiceDataCopy.transportType;
    }

    // create service first
    let result = await putService({
      serviceId,
      serviceData: fullServiceDataCopy,
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
        // If performing an update (not create), idp updates will throw an HTTP 500 error unless the redirectAfterFormPostURI attribute has a value.
        // If no redirectAfterFormPostURI is provided, importing with an empty string as its value will perform the same function without the 500 error.
        if (
          serviceId === 'SocialIdentityProviders' &&
          descendent.redirectAfterFormPostURI === undefined
        ) {
          descendent.redirectAfterFormPostURI = '';
        }
        const type = descendent._type._id;
        const descendentId = descendent._id;
        debugMessage({
          message: `ServiceOps.putFullService: descendentId=${descendentId}`,
          state,
        });
        let result;
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
    if (serviceId === 'email' && transportType) {
      // delete transport type so we can set it later from fullServiceDataCopy
      fullServiceDataCopy.transportType = transportType;

      // create service first
      result = await putService({
        serviceId,
        serviceData: fullServiceDataCopy,
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
      `Error putting ${
        globalConfig ? 'global' : `${getCurrentRealmName(state) + ' realm'}`
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
      `Error putting ${globalConfig ? 'global' : `${getCurrentRealmName(state) + ' realm'}`} full service configs`,
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
      `Error deleting ${
        globalConfig ? 'global' : `${getCurrentRealmName(state) + ' realm'}`
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
  const errors: FrodoError[] = [];
  let deleted: AmServiceSkeleton[];
  debugMessage({
    message: `ServiceOps.deleteFullServices: start, globalConfig=${globalConfig}`,
    state,
  });
  try {
    const serviceList = await getListOfServices({ globalConfig, state });

    deleted = await Promise.all(
      serviceList.map(async (serviceListItem) => {
        try {
          const service = await deleteFullService({
            serviceId: serviceListItem._id,
            globalConfig,
            state,
          });
          printMessage({
            message: `Deleted service '${serviceListItem._id}'.`,
            state,
          });
          return service;
        } catch (error) {
          if (!isUnavailableServiceError(error)) {
            errors.push(
              new FrodoError(
                `Error deleting service '${serviceListItem._id}'`,
                error
              )
            );
          }
        }
      })
    );
  } catch (error) {
    throw new FrodoError(
      `Error deleting ${
        globalConfig ? 'global' : `${getCurrentRealmName(state) + ' realm'}`
      } full service configs`,
      error
    );
  }
  if (errors.length > 0) {
    throw new FrodoError(
      `Error deleting ${globalConfig ? 'global' : `${getCurrentRealmName(state) + ' realm'}`} full service configs: ${errors.map((error) => error.message).join('; ')}`,
      errors
    );
  }
  debugMessage({ message: `ServiceOps.deleteFullServices: end`, state });
  return deleted.filter((service) => !!service);
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
      `Error exporting ${
        globalConfig ? 'global' : `${getCurrentRealmName(state) + ' realm'}`
      } service ${serviceId}`,
      error
    );
  }
}

/**
 * Export all services
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @param {ResultCallback<FullService>} resultCallback Optional callback to process individual results. With a callback, a service that cannot be read is passed to it as an error that names the service and is left out of the export; without one the export fails.
 */
export async function exportServices({
  globalConfig = false,
  resultCallback = void 0,
  state,
}: {
  globalConfig: boolean;
  resultCallback?: ResultCallback<FullService>;
  state: State;
}): Promise<ServiceExportInterface> {
  debugMessage({
    message: `ServiceOps.exportServices: start, globalConfig=${globalConfig}`,
    state,
  });
  let indicatorId: string;
  try {
    const exportData = createServiceExportTemplate({ state });
    const services = await getFullServices({
      globalConfig,
      resultCallback,
      state,
    });
    indicatorId = createProgressIndicator({
      total: services.length,
      message: `Exporting ${globalConfig ? 'global' : `${getCurrentRealmName(state) + ' realm'}`} services...`,
      state,
    });
    for (const service of services) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting ${globalConfig ? 'global' : `${getCurrentRealmName(state) + ' realm'}`} service ${
          service._id
        }`,
        state,
      });
      service.location = globalConfig ? 'global' : state.getRealm();
      exportData.service[service._type._id] = service;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${services.length} ${
        globalConfig ? 'global' : `${getCurrentRealmName(state) + ' realm'}`
      } services.`,
      state,
    });
    debugMessage({ message: `ServiceOps.exportServices: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting ${globalConfig ? 'global' : `${getCurrentRealmName(state) + ' realm'}`} services.`,
      status: 'fail',
      state,
    });
    throw new FrodoError(
      `Error exporting ${globalConfig ? 'global' : `${getCurrentRealmName(state) + ' realm'}`} services`,
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
