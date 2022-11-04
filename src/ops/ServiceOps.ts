import { existsSync, readFileSync } from 'fs';
import {
  deleteService,
  deleteServiceNextDescendents,
  getService,
  getServiceList,
  getServiceNextDescendents,
  putService,
  putServiceDescendents,
  Service,
  ServiceNextDescendent,
} from '../api/ServiceApi';
import { getCurrentRealmName } from '../api/utils/ApiUtils';
import {
  createProgressIndicator,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from './utils/Console';
import {
  getTypedFilename,
  readFilesRecursive,
  saveServicesToFile,
} from './utils/ExportImportUtils';

interface FullService extends Service {
  nextDescendents?: ServiceNextDescendent[];
}

/**
 * Lists all services
 */
export async function listServices() {
  const serviceList = await getServiceList();
  serviceList.sort((a, b) => a.name.localeCompare(b.name));
  serviceList.forEach((item) => {
    printMessage(`${item._id} - ${item.name}`, 'data');
  });
}

/**
 * Exports a single service to file
 * @param {string} serviceId The service to export
 * @param {string} file Optional filename for the export
 * @returns Promise resolving succesfull export
 */
export async function exportService(serviceId: string, file?: string) {
  const fileName = file
    ? getTypedFilename(file, 'service')
    : getTypedFilename(serviceId, 'service');

  if (serviceId === null) {
    return;
  }
  const service = await getService(serviceId);

  createProgressIndicator(
    1,
    `Exporting service ${serviceId} to file: ${fileName}`
  );

  const serviceNextDescendentData = await getServiceNextDescendents(serviceId);
  service.nextDescendents = serviceNextDescendentData;
  saveServicesToFile('service', service, '_id', fileName);
  updateProgressIndicator(`Exporting ${serviceId}`);
  stopProgressIndicator(`Export to '${fileName}' done.`);
}

/**
 * Retrieves all services and their descendants.
 * @returns Promise resolving to an array of services with their descendants
 */
async function getFullServices(): Promise<FullService[]> {
  const serviceList = await getServiceList();

  const fullServiceData = await Promise.all(
    serviceList.map(async (listItem) => {
      try {
        const [service, nextDescendents] = await Promise.all([
          getService(listItem._id),
          getServiceNextDescendents(listItem._id),
        ]);

        return {
          ...service,
          nextDescendents,
        };
      } catch (error) {
        const message = error.response?.data?.message;
        printMessage(
          `Unable to retrieve data for ${listItem._id} with error: ${message}`,
          'error'
        );
      }
    })
  );

  return fullServiceData.filter((data) => !!data); // make sure to filter out any undefined objects
}

/**
 * Exports all services for the realm to a single file
 * @param {string} file Options filename for the file, otherwise all{realm}Services.service.json will be the name
 */
export async function exportServicesToFile(file?: string) {
  const realm = getCurrentRealmName() ?? '';
  const fileName = file
    ? getTypedFilename(file, 'service')
    : getTypedFilename(`all${realm}Services`, 'service');
  const services = await getFullServices();

  createProgressIndicator(1, `Exporting services to file: ${fileName}`);
  saveServicesToFile('service', services, '_id', fileName);
  updateProgressIndicator(`Exporting ${fileName}`);
  stopProgressIndicator(`Export to '${fileName}' done.`);
}

/**
 * Exports all services to separate files.
 */
export async function exportServicesToFiles() {
  const services = await getFullServices();

  createProgressIndicator(
    services.length,
    'Exporting services to separate files.'
  );
  services.forEach((service) => {
    const fileName = getTypedFilename(service._type._id, 'service');
    updateProgressIndicator(
      `Exporting service: ${service._type._id} to ${fileName}`
    );
    saveServicesToFile('service', service, '_id', fileName);
  });
  stopProgressIndicator(`Export done.`);
}

/**
 * Deletes the specified service
 * @param {string} serviceId The service to delete
 */
async function deleteFullService(serviceId: string) {
  const serviceNextDescendentData = await getServiceNextDescendents(serviceId);

  await Promise.all(
    serviceNextDescendentData.map((nextDescendent) =>
      deleteServiceNextDescendents(
        serviceId,
        nextDescendent._type._id,
        nextDescendent._id
      )
    )
  );

  await deleteService(serviceId);
  printMessage(`Deleted... ${serviceId}`, 'info');
}

/**
 * Deletes all services
 */
async function deleteFullServices() {
  const serviceList = await getServiceList();

  await Promise.all(
    serviceList.map((serviceListItem) => deleteFullService(serviceListItem._id))
  );
}

/**
 * Saves a service using the provide id and data, including descendants
 * @param {string} id the service id / name
 * @param {string} data service object including descendants
 * @returns promise resolving when the service has been saved
 */
async function putFullService(id: string, data: FullService) {
  const nextDescendents = data.nextDescendents;

  delete data.nextDescendents;
  delete data._rev;
  delete data.enabled;

  await putService(id, data);

  if (!nextDescendents) {
    return;
  }

  await Promise.all(
    nextDescendents.map(async (descendent) => {
      const type = descendent._type._id;
      const descendentId = descendent._id;
      await putServiceDescendents(id, type, descendentId, descendent);
    })
  );
}

/**
 * Saves multiple services using the serviceEntries which contain both id and data with descendants
 * @param {[string, FullService][]} serviceEntries The services to add
 */
async function putFullServices(serviceEntries: [string, FullService][]) {
  for (const [id, data] of serviceEntries) {
    try {
      await putFullService(id, data);
      printMessage(`Imported: ${id}`, 'info');
    } catch (error) {
      const message = error.response?.data?.message;
      const detail = error.response?.data?.detail;
      printMessage(
        `Unable to import service: ${id} with error: ${message}`,
        'error'
      );
      if (detail) {
        printMessage(`Details: ${JSON.stringify(detail)}`, 'error');
      }
    }
  }
}

/**
 * Imports a single service using a reference to the service and a file to read the data from. Optionally clean (remove) an existing service first
 * @param {string} serviceId The service id/name to add
 * @param {boolean} clean Indicates whether to remove a possible existing service with the same id first.
 * @param {string} file Reference to the filename with the data for the service
 * @returns Promise resolving when the service has been imported
 */
export async function importService(
  serviceId: string,
  clean: boolean,
  file: string
) {
  if (!file || !file?.length) {
    file = `${serviceId}.service.json`;
  }

  if (!existsSync(file)) {
    printMessage(
      `Unable to import service: ${serviceId} with error: file: ${file} not found`,
      'error'
    );
    return;
  }
  const serviceData = JSON.parse(readFileSync(file, 'utf8'));

  if (clean) {
    await deleteService(serviceId);
  }

  try {
    for (const id in serviceData.service) {
      const data = serviceData.service[id];
      await putFullService(serviceId, data);
    }
    printMessage(`Imported service: ${serviceId}`, 'info');
  } catch (error) {
    const message = error.response?.data?.message;
    const detail = error.response?.data?.detail;
    printMessage(
      `Unable to import service: ${serviceId} with error: ${message}`,
      'error'
    );
    if (detail) {
      printMessage(`Details: ${JSON.stringify(detail)}`, 'error');
    }
  }

  return;
}

/**
 * Imports multiple services from the same file. Optionally clean (remove) existing services first
 * @param {boolean} clean Indicates whether to remove possible existing services first
 * @param {string} file Reference to the filename with the services to import
 */
export async function importServices(clean: boolean, file: string) {
  const fileString = readFileSync(file, 'utf8');
  const serviceData = JSON.parse(fileString);

  if (clean) {
    await deleteFullServices();
  }

  await putFullServices(Object.entries(serviceData.service));
}

/**
 * Reads the specified directory and imports all files with a .service.json extension.
 * @param {boolean} clean Indicates whether to remove possible existing services first
 * @param {string} directory Reference to the directory with the services to import
 */
export async function importServicesSeparate(
  clean: boolean,
  directory: string
) {
  const paths = await readFilesRecursive(directory);

  if (clean) {
    await deleteFullServices();
  }

  for (const path of paths) {
    const parts = path.replaceAll('\\', '/').split('/');
    const fileName = parts[parts.length - 1];

    if (fileName.indexOf('.service.') > -1) {
      const serviceId = fileName.replace('.service.json', '');
      await importService(serviceId, false, path);
    }
  }
}

/**
 * Deletes a service by id/name
 * @param {string} serviceId Reference to the service to delete
 */
export async function deleteServiceOp(serviceId: string) {
  await deleteFullService(serviceId);
}
