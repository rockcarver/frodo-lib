import { AmServiceSkeleton } from '../api/ApiTypes';
import {
  deleteService,
  deleteServiceNextDescendent,
  getService,
  getListOfServices as _getListOfServices,
  getServiceDescendents,
  putService,
  putServiceNextDescendent,
  ServiceNextDescendent,
} from '../api/ServiceApi';
import { ServiceExportInterface } from './OpsTypes';
import { debugMessage, printMessage } from './utils/Console';

interface FullService extends AmServiceSkeleton {
  nextDescendents?: ServiceNextDescendent[];
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
export async function getListOfServices(globalConfig = false) {
  debugMessage(`ServiceOps.getListOfServices: start`);
  const services = (await _getListOfServices({ globalConfig })).result;
  debugMessage(`ServiceOps.getListOfServices: end`);
  return services;
}

/**
 * Get all services including their descendents.
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns Promise resolving to an array of services with their descendants
 */
export async function getFullServices(
  globalConfig = false
): Promise<FullService[]> {
  debugMessage(
    `ServiceOps.getFullServices: start, globalConfig=${globalConfig}`
  );
  const serviceList = (await _getListOfServices({ globalConfig })).result;

  const fullServiceData = await Promise.all(
    serviceList.map(async (listItem) => {
      try {
        const [service, nextDescendents] = await Promise.all([
          getService({ serviceId: listItem._id, globalConfig }),
          getServiceDescendents({ serviceId: listItem._id, globalConfig }),
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
          printMessage(
            `Unable to retrieve data for ${listItem._id} with error: ${message}`,
            'error'
          );
        }
      }
    })
  );

  debugMessage(`ServiceOps.getFullServices: end`);
  return fullServiceData.filter((data) => !!data); // make sure to filter out any undefined objects
}

/**
 * Saves a service using the provide id and data, including descendents
 * @param {string} serviceId the service id / name
 * @param {string} fullServiceData service object including descendants
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns promise resolving to a service object
 */
async function putFullService(
  serviceId: string,
  fullServiceData: FullService,
  clean: boolean,
  globalConfig = false
): Promise<AmServiceSkeleton> {
  debugMessage(
    `ServiceOps.putFullService: start, serviceId=${serviceId}, globalConfig=${globalConfig}`
  );
  const nextDescendents = fullServiceData.nextDescendents;

  delete fullServiceData.nextDescendents;
  delete fullServiceData._rev;
  delete fullServiceData.enabled;

  if (clean) {
    try {
      debugMessage(`ServiceOps.putFullService: clean`);
      await deleteFullService(serviceId, globalConfig);
    } catch (error) {
      if (
        !(
          error.response?.status === 404 &&
          error.response?.data?.message === 'Not Found'
        )
      ) {
        const message = error.response?.data?.message;
        printMessage(
          `Error deleting service '${serviceId}' before import: ${message}`,
          'error'
        );
      }
    }
  }

  // create service first
  const result = await putService({
    serviceId,
    serviceData: fullServiceData,
    globalConfig,
  });

  // return fast if no next descendents supplied
  if (nextDescendents.length === 0) {
    debugMessage(`ServiceOps.putFullService: end (w/o descendents)`);
    return result;
  }

  // now create next descendents
  await Promise.all(
    nextDescendents.map(async (descendent) => {
      const type = descendent._type._id;
      const descendentId = descendent._id;
      debugMessage(`ServiceOps.putFullService: descendentId=${descendentId}`);
      let result = undefined;
      try {
        result = await putServiceNextDescendent({
          serviceId,
          serviceType: type,
          serviceNextDescendentId: descendentId,
          serviceNextDescendentData: descendent,
          globalConfig,
        });
      } catch (error) {
        const message = error.response?.data?.message;
        printMessage(
          `Put descendent '${descendentId}' of service '${serviceId}': ${message}`,
          'error'
        );
      }
      return result;
    })
  );
  debugMessage(`ServiceOps.putFullService: end (w/ descendents)`);
}

/**
 * Saves multiple services using the serviceEntries which contain both id and data with descendants
 * @param {[string, FullService][]} serviceEntries The services to add
 * @param {boolean} clean Indicates whether to remove possible existing services first
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AmService[]>} promise resolving to an array of service objects
 */
async function putFullServices(
  serviceEntries: [string, FullService][],
  clean: boolean,
  globalConfig = false
): Promise<AmServiceSkeleton[]> {
  debugMessage(
    `ServiceOps.putFullServices: start, globalConfig=${globalConfig}`
  );
  const results: AmServiceSkeleton[] = [];
  for (const [id, data] of serviceEntries) {
    try {
      const result = await putFullService(id, data, clean, globalConfig);
      results.push(result);
      printMessage(`Imported: ${id}`, 'info');
    } catch (error) {
      const message = error.response?.data?.message;
      const detail = error.response?.data?.detail;
      printMessage(`Import service '${id}': ${message}`, 'error');
      if (detail) {
        printMessage(`Details: ${JSON.stringify(detail)}`, 'error');
      }
    }
  }
  debugMessage(`ServiceOps.putFullServices: end`);
  return results;
}

/**
 * Deletes the specified service
 * @param {string} serviceId The service to delete
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 */
export async function deleteFullService(
  serviceId: string,
  globalConfig = false
) {
  debugMessage(
    `ServiceOps.deleteFullService: start, globalConfig=${globalConfig}`
  );
  const serviceNextDescendentData = await getServiceDescendents({
    serviceId,
    globalConfig,
  });

  await Promise.all(
    serviceNextDescendentData.map((nextDescendent) =>
      deleteServiceNextDescendent({
        serviceId,
        serviceType: nextDescendent._type._id,
        serviceNextDescendentId: nextDescendent._id,
        globalConfig,
      })
    )
  );

  await deleteService({ serviceId, globalConfig });
  debugMessage(`ServiceOps.deleteFullService: end`);
}

/**
 * Deletes all services
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 */
export async function deleteFullServices(globalConfig = false) {
  debugMessage(
    `ServiceOps.deleteFullServices: start, globalConfig=${globalConfig}`
  );
  try {
    const serviceList = (await _getListOfServices({ globalConfig })).result;

    await Promise.all(
      serviceList.map(async (serviceListItem) => {
        try {
          await deleteFullService(serviceListItem._id, globalConfig);
        } catch (error) {
          if (
            !(
              error.response?.status === 403 &&
              error.response?.data?.message ===
                'This operation is not available in ForgeRock Identity Cloud.'
            )
          ) {
            const message = error.response?.data?.message;
            printMessage(
              `Delete service '${serviceListItem._id}': ${message}`,
              'error'
            );
          }
        }
      })
    );
  } catch (error) {
    const message = error.response?.data?.message;
    printMessage(`Delete services: ${message}`, 'error');
  }
  debugMessage(`ServiceOps.deleteFullServices: end`);
}

/**
 * Export service. The response can be saved to file as is.
 * @param serviceId service id/name
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<ServiceExportInterface>} Promise resolving to a ServiceExportInterface object.
 */
export async function exportService(
  serviceId: string,
  globalConfig = false
): Promise<ServiceExportInterface> {
  debugMessage(`ServiceOps.exportService: start, globalConfig=${globalConfig}`);
  const exportData = createServiceExportTemplate();
  try {
    const service = await getService({ serviceId, globalConfig });
    service.nextDescendents = await getServiceDescendents({
      serviceId,
      globalConfig,
    });
    exportData.service[serviceId] = service;
  } catch (error) {
    const message = error.response?.data?.message;
    printMessage(`Export service '${serviceId}': ${message}`, 'error');
  }
  debugMessage(`ServiceOps.exportService: end`);
  return exportData;
}

/**
 * Export all services
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 */
export async function exportServices(
  globalConfig = false
): Promise<ServiceExportInterface> {
  debugMessage(
    `ServiceOps.exportServices: start, globalConfig=${globalConfig}`
  );
  const exportData = createServiceExportTemplate();
  try {
    const services = await getFullServices(globalConfig);
    for (const service of services) {
      exportData.service[service._type._id] = service;
    }
  } catch (error) {
    const message = error.response?.data?.message;
    printMessage(`Export servics: ${message}`, 'error');
  }
  debugMessage(`ServiceOps.exportServices: end`);
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
export async function importService(
  serviceId: string,
  importData: ServiceExportInterface,
  clean: boolean,
  globalConfig = false
): Promise<AmServiceSkeleton> {
  debugMessage(`ServiceOps.importService: start, globalConfig=${globalConfig}`);
  const serviceData = importData.service[serviceId];
  const result = await putFullService(
    serviceId,
    serviceData,
    clean,
    globalConfig
  );
  debugMessage(`ServiceOps.importService: end`);
  return result;
}

/**
 * Imports multiple services from the same file. Optionally clean (remove) existing services first
 * @param {ServiceExportInterface} importData The service configuration export data to import
 * @param {boolean} clean Indicates whether to remove possible existing services first
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 */
export async function importServices(
  importData: ServiceExportInterface,
  clean: boolean,
  globalConfig = false
) {
  debugMessage(
    `ServiceOps.importServices: start, globalConfig=${globalConfig}`
  );
  try {
    const result = await putFullServices(
      Object.entries(importData.service),
      clean,
      globalConfig
    );
    debugMessage(`ServiceOps.importServices: end`);
    return result;
  } catch (error) {
    const message = error.response?.data?.message;
    const detail = error.response?.data?.detail;
    printMessage(`Unable to import services: error: ${message}`, 'error');
    if (detail) {
      printMessage(`Details: ${JSON.stringify(detail)}`, 'error');
    }
    throw error;
  }
}
