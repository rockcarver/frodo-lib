import { readFileSync } from 'fs';
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
import {
  createProgressIndicator,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from './utils/Console';
import { readFilesRecursive, saveToFile } from './utils/ExportImportUtils';

export async function listServices() {
  const serviceList = await getServiceList();
  serviceList.sort((a, b) => a.name.localeCompare(b.name));
  serviceList.forEach((item) => {
    printMessage(`${item._id} - ${item.name}`, 'data');
  });
}

export async function exportService(serviceId: string, file?: string) {
  const fileName = file ?? `${serviceId}.json`;

  if (serviceId === null) {
    return;
  }
  const service = await getService(serviceId);

  const serviceNextDescendentData = await getServiceNextDescendents(serviceId);
  service.nextDescendents = serviceNextDescendentData;
  saveToFile('service', service, '_id', fileName);
}

interface FullService extends Service {
  nextDescendents?: ServiceNextDescendent[];
}

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

export async function exportServicesToFile(file?: string) {
  const fileName = file ?? 'services.json';
  const services = await getFullServices();

  createProgressIndicator(1, `Exporting services to file: ${fileName}`);
  saveToFile('service', services, '_id', fileName);
  updateProgressIndicator(`Exporting ${fileName}`);
  stopProgressIndicator(`Export to '${fileName}' done.`);
}

export async function exportServicesToFiles() {
  const services = await getFullServices();

  createProgressIndicator(
    services.length,
    'Exporting services to separate files.'
  );
  services.forEach((service) => {
    const fileName = `./${service._type._id}.json`;
    updateProgressIndicator(
      `Exporting service: ${service._type._id} to ${fileName}`
    );
    saveToFile('service', service, '_id', fileName);
  });
  stopProgressIndicator(`Export done.`);
}

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

async function deleteFullServices() {
  const serviceList = await getServiceList();

  await Promise.all(
    serviceList.map((serviceListItem) => deleteFullService(serviceListItem._id))
  );
}

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

export async function importService(
  serviceId: string,
  clean: boolean,
  file: string
) {
  const serviceData = JSON.parse(readFileSync(file, 'utf8'));

  if (clean) {
    await deleteService(serviceId);
  }

  try {
    for (const id in serviceData.service) {
      const data = serviceData.service[id];
      await putFullService(serviceId, data);
    }
    printMessage(`Imported service: ${serviceId}`);
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

export async function importServices(clean: boolean, file: string) {
  const fileString = readFileSync(file, 'utf8');
  const serviceData = JSON.parse(fileString);

  if (clean) {
    await deleteFullServices();
  }

  await putFullServices(Object.entries(serviceData.service));
}

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
    const serviceId = fileName.replace('.json', '');

    await importService(serviceId, false, path);
  }
}

export async function deleteServiceOp(serviceId: string) {
  await deleteFullService(serviceId);
}
