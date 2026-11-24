import {
  deleteServiceNextDescendent as _deleteServiceNextDescendent,
  getListOfServices as _getListOfServices,
  deleteService,
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
import { findFailedRequest, getMetadata } from '../utils/ExportImportUtils';
import { getCurrentRealmName } from '../utils/ForgeRockUtils';
import { cloneDeep } from '../utils/JsonUtils';
import { FrodoError, getFailedResponse } from './FrodoError';
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
   * Deletes the specified service and its descendents.
   * @param {string} serviceId The service to delete
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<AmServiceSkeleton>} The deleted service
   */
  deleteFullService(
    serviceId: string,
    globalConfig?: boolean
  ): Promise<AmServiceSkeleton>;
  /**
   * Deletes one next descendent of a service and leaves the service itself in place. The descendent is looked up in the list that the server gives for the service and deleted by the id it is listed with, so the name must match a listed id exactly, case included.
   * @param {string} serviceId The service that holds the descendent
   * @param {string} nextDescendentName The id (the name) of the next descendent to delete
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<AmServiceSkeleton>} Promise resolving to the deleted descendent
   * @throws {FrodoError} If the service has no next descendent of that name. Nothing is deleted then.
   */
  deleteServiceNextDescendent(
    serviceId: string,
    nextDescendentName: string,
    globalConfig?: boolean
  ): Promise<AmServiceSkeleton>;
  /**
   * Deletes all next descendents of a service and leaves the service itself in place. Every descendent is attempted. Without a result callback the function throws one error after all were attempted, which names each descendent that could not be deleted. With a result callback each result is passed to it as it is known (a descendent that could not be deleted as an error that names it), nothing is thrown for such a descendent, and the descendents that were deleted are returned. A failure to read the descendents of the service always throws.
   * @param {string} serviceId The service that holds the descendents
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   * @param {ResultCallback<AmServiceSkeleton>} resultCallback Optional callback to process individual results
   * @returns {Promise<AmServiceSkeleton[]>} Promise resolving to the deleted descendents
   * @throws {FrodoError} If the descendents cannot be read. Without a callback, also after all descendents were attempted, naming each one that could not be deleted.
   */
  deleteServiceNextDescendents(
    serviceId: string,
    globalConfig?: boolean,
    resultCallback?: ResultCallback<AmServiceSkeleton>
  ): Promise<AmServiceSkeleton[]>;
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
   * @param {ResultCallback<AmServiceSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every service is passed to it as it happens (a failed service as an error that names it) and a failed service does not throw: the services that could be imported are returned. A service of the file that does not belong to the target (another realm, or global when importing into the realm) is not imported and not reported. Without it, the failures are collected and thrown as one error after every service was tried.
   * @returns {Promise<AmServiceSkeleton[]>} A promise resolving to an array of service objects
   */
  importServices(
    importData: ServiceExportInterface,
    options: ServiceImportOptions,
    resultCallback?: ResultCallback<AmServiceSkeleton>
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
     * Deletes the specified service and its descendents.
     * @param {string} serviceId The service to delete
     * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
     * @returns {Promise<AmServiceSkeleton>} The deleted service
     */
    async deleteFullService(
      serviceId: string,
      globalConfig = false
    ): Promise<AmServiceSkeleton> {
      return deleteFullService({ serviceId, globalConfig, state });
    },

    /**
     * Deletes one next descendent of a service and leaves the service itself in place. The descendent is looked up in the list that the server gives for the service and deleted by the id it is listed with, so the name must match a listed id exactly, case included.
     * @param {string} serviceId The service that holds the descendent
     * @param {string} nextDescendentName The id (the name) of the next descendent to delete
     * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
     * @returns {Promise<AmServiceSkeleton>} Promise resolving to the deleted descendent
     * @throws {FrodoError} If the service has no next descendent of that name. Nothing is deleted then.
     */
    async deleteServiceNextDescendent(
      serviceId: string,
      nextDescendentName: string,
      globalConfig = false
    ): Promise<AmServiceSkeleton> {
      return deleteServiceNextDescendent({
        serviceId,
        nextDescendentName,
        globalConfig,
        state,
      });
    },

    /**
     * Deletes all next descendents of a service and leaves the service itself in place. Every descendent is attempted. Without a result callback the function throws one error after all were attempted, which names each descendent that could not be deleted. With a result callback each result is passed to it as it is known (a descendent that could not be deleted as an error that names it), nothing is thrown for such a descendent, and the descendents that were deleted are returned. A failure to read the descendents of the service always throws.
     * @param {string} serviceId The service that holds the descendents
     * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
     * @param {ResultCallback<AmServiceSkeleton>} resultCallback Optional callback to process individual results
     * @returns {Promise<AmServiceSkeleton[]>} Promise resolving to the deleted descendents
     * @throws {FrodoError} If the descendents cannot be read. Without a callback, also after all descendents were attempted, naming each one that could not be deleted.
     */
    async deleteServiceNextDescendents(
      serviceId: string,
      globalConfig = false,
      resultCallback: ResultCallback<AmServiceSkeleton> = void 0
    ): Promise<AmServiceSkeleton[]> {
      return deleteServiceNextDescendents({
        serviceId,
        globalConfig,
        resultCallback,
        state,
      });
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
     * @param {ResultCallback<AmServiceSkeleton>} resultCallback Optional callback to process individual results
     * @returns {Promise<AmServiceSkeleton[]>} A promise resolving to an array of service objects
     */
    async importServices(
      importData: ServiceExportInterface,
      options: ServiceImportOptions = {
        clean: false,
        global: false,
        realm: false,
      },
      resultCallback?: ResultCallback<AmServiceSkeleton>
    ): Promise<AmServiceSkeleton[]> {
      return importServices({
        importData,
        options,
        resultCallback,
        state,
      });
    },
  };
};

/**
 * True if the server refused the request because it does not offer the service in PingOne Advanced Identity Cloud.
 * The error is looked at through the whole chain of errors ({@link getFailedResponse}): an operation that calls other
 * operations wraps a failure in a `FrodoError` at every level, and only the error of the request carries the answer of
 * the server.
 * @param {unknown} error the error that was caught, wrapped or not
 * @returns {boolean} true for the refusal of an unavailable service
 */
function isUnavailableServiceError(error: unknown): boolean {
  const response = getFailedResponse(error) as
    { status?: number; data?: { message?: string } } | undefined;
  const httpError = error as { httpStatus?: number; httpMessage?: string };
  return (
    (response?.status ?? httpError?.httpStatus) === 403 &&
    (response?.data?.message ?? httpError?.httpMessage) ===
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
            const unavailable = results.find(
              (result) =>
                result.status === 'rejected' &&
                isUnavailableServiceError(result.reason)
            ) as PromiseRejectedResult | undefined;
            const request = findFailedRequest(unavailable?.reason);
            debugMessage({
              message: `ServiceOps.getFullServices: skipped service ${listItem._id}, this operation is not available in PingOne Advanced Identity Cloud${request ? ` [${request}]` : ''}`,
              state,
            });
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
        const failed = getFailedResponse(error);
        if (!(
          failed?.status === 404 && failed?.data?.message === 'Not Found'
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
 * Every service is tried: a service that cannot be saved does not stop the others.
 * @param {[string, FullService][]} serviceEntries The services to add
 * @param {boolean} clean Indicates whether to remove possible existing services first
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @param {boolean} realmConfig true if the current realm service is the target of the operation, false otherwise. Default: false.
 * @param {ResultCallback<AmServiceSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every service is passed to it as it happens (a failed service as an error that names it) and a failed service does not throw: the services that could be saved are returned. A service that does not belong to the target is not saved and not reported. Without it, the failures are collected and thrown as one error after every service was tried.
 * @returns {Promise<AmService[]>} promise resolving to an array of service objects
 */
export async function putFullServices({
  serviceEntries,
  clean,
  globalConfig = false,
  realmConfig = false,
  resultCallback = void 0,
  state,
}: {
  serviceEntries: [string, FullService][];
  clean: boolean;
  globalConfig: boolean;
  realmConfig: boolean;
  resultCallback?: ResultCallback<AmServiceSkeleton>;
  state: State;
}): Promise<AmServiceSkeleton[]> {
  debugMessage({
    message: `ServiceOps.putFullServices: start, globalConfig=${globalConfig}`,
    state,
  });
  const errors: Error[] = [];
  const results: AmServiceSkeleton[] = [];
  for (const [id, data] of serviceEntries) {
    let result: AmServiceSkeleton;
    let failure: Error;
    try {
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
      debugMessage({ message: `Imported: ${id}`, state });
    } catch (error) {
      failure = error;
    }
    if (failure) {
      if (resultCallback) {
        resultCallback(
          new FrodoError(`Error importing service ${id}`, failure),
          undefined
        );
      } else {
        errors.push(failure);
      }
    } else if (result) {
      results.push(result);
      if (resultCallback) resultCallback(undefined, result);
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
 * Deletes one next descendent of a service and leaves the service itself in place. The descendent is looked up in the list that the server gives for the service and deleted by the id it is listed with, so the name must match a listed id exactly, case included.
 * @param {string} serviceId The service that holds the descendent
 * @param {string} nextDescendentName The id (the name) of the next descendent to delete
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AmServiceSkeleton>} Promise resolving to the deleted descendent
 * @throws {FrodoError} If the service has no next descendent of that name. Nothing is deleted then.
 */
export async function deleteServiceNextDescendent({
  serviceId,
  nextDescendentName,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  nextDescendentName: string;
  globalConfig?: boolean;
  state: State;
}): Promise<AmServiceSkeleton> {
  try {
    debugMessage({
      message: `ServiceOps.deleteServiceNextDescendent: start, globalConfig=${globalConfig}`,
      state,
    });
    const descendents = await getServiceDescendents({
      serviceId,
      globalConfig,
      state,
    });
    const descendent = descendents.find(
      (item) => item._id === nextDescendentName
    );
    if (!descendent) {
      throw new FrodoError(`Descendent '${nextDescendentName}' not found`);
    }
    const result = await _deleteServiceNextDescendent({
      serviceId,
      serviceType: descendent._type._id,
      serviceNextDescendentId: descendent._id,
      globalConfig,
      state,
    });
    debugMessage({
      message: `ServiceOps.deleteServiceNextDescendent: end`,
      state,
    });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error deleting descendent '${nextDescendentName}' of service '${serviceId}'`,
      error
    );
  }
}

/**
 * Deletes all next descendents of a service and leaves the service itself in place. Every descendent is attempted. Without a result callback the function throws one error after all were attempted, which names each descendent that could not be deleted. With a result callback each result is passed to it as it is known (a descendent that could not be deleted as an error that names it), nothing is thrown for such a descendent, and the descendents that were deleted are returned. A failure to read the descendents of the service always throws.
 * @param {string} serviceId The service that holds the descendents
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @param {ResultCallback<AmServiceSkeleton>} resultCallback Optional callback to process individual results
 * @returns {Promise<AmServiceSkeleton[]>} Promise resolving to the deleted descendents
 * @throws {FrodoError} If the descendents cannot be read. Without a callback, also after all descendents were attempted, naming each one that could not be deleted.
 */
export async function deleteServiceNextDescendents({
  serviceId,
  globalConfig = false,
  resultCallback = void 0,
  state,
}: {
  serviceId: string;
  globalConfig?: boolean;
  resultCallback?: ResultCallback<AmServiceSkeleton>;
  state: State;
}): Promise<AmServiceSkeleton[]> {
  const errors: FrodoError[] = [];
  let outcomes: { result: AmServiceSkeleton }[];
  debugMessage({
    message: `ServiceOps.deleteServiceNextDescendents: start, globalConfig=${globalConfig}`,
    state,
  });
  try {
    const descendents = await getServiceDescendents({
      serviceId,
      globalConfig,
      state,
    });
    outcomes = await Promise.all(
      descendents.map(async (descendent) => {
        let result: AmServiceSkeleton;
        try {
          result = await _deleteServiceNextDescendent({
            serviceId,
            serviceType: descendent._type._id,
            serviceNextDescendentId: descendent._id,
            globalConfig,
            state,
          });
        } catch (error) {
          const failure = new FrodoError(
            `Error deleting descendent '${descendent._id}' of service '${serviceId}'`,
            error
          );
          if (resultCallback) resultCallback(failure);
          else errors.push(failure);
          return undefined;
        }
        if (resultCallback) resultCallback(undefined, result);
        return { result };
      })
    );
  } catch (error) {
    throw new FrodoError(
      `Error deleting descendents of service '${serviceId}'`,
      error
    );
  }
  if (errors.length > 0) {
    throw new FrodoError(
      `Error deleting descendents of service '${serviceId}': ${errors.map((error) => error.message).join('; ')}`,
      errors
    );
  }
  debugMessage({
    message: `ServiceOps.deleteServiceNextDescendents: end`,
    state,
  });
  return outcomes
    .filter((outcome) => !!outcome)
    .map((outcome) => outcome.result);
}

/**
 * Deletes the specified service and its descendents.
 * @param {string} serviceId The service to delete
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AmServiceSkeleton>} The deleted service
 */
export async function deleteFullService({
  serviceId,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  globalConfig?: boolean;
  state: State;
}) {
  try {
    debugMessage({
      message: `ServiceOps.deleteFullService: start, globalConfig=${globalConfig}`,
      state,
    });
    await deleteServiceNextDescendents({ serviceId, globalConfig, state });
    debugMessage({ message: `ServiceOps.deleteFullService: end`, state });
    return await deleteService({ serviceId, globalConfig, state });
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
 * Every service is tried: a service that cannot be imported does not stop the others.
 * @param {ServiceExportInterface} importData The service configuration export data to import
 * @param {ServiceImportOptions} options Import options
 * @param {ResultCallback<AmServiceSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every service is passed to it as it happens (a failed service as an error that names it) and a failed service does not throw: the services that could be imported are returned. A service of the file that does not belong to the target (another realm, or global when importing into the realm) is not imported and not reported. Without it, the failures are collected and thrown as one error after every service was tried.
 * @returns {Promise<AmServiceSkeleton[]>} A promise resolving to an array of service objects
 */
export async function importServices({
  importData,
  options = {
    clean: false,
    global: false,
    realm: false,
  },
  resultCallback = void 0,
  state,
}: {
  importData: ServiceExportInterface;
  options: ServiceImportOptions;
  resultCallback?: ResultCallback<AmServiceSkeleton>;
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
      resultCallback,
      state,
    });
    debugMessage({ message: `ServiceOps.importServices: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error importing services`, error);
  }
}
