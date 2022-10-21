import { readFileSync } from 'fs';
import {
  getServiceList,
  getService,
  getServiceNextDescendents,
  deleteService,
  putService,
  putServiceDescendents,
  deleteServiceNextDescendents,
  Service,
  ServiceNextDescendent,
} from '../api/ServiceApi';
import { printMessage } from './utils/Console';
import { readFilesRecursive, saveToFile } from './utils/ExportImportUtils';

export async function listServices() {
  const serviceList = await getServiceList();
  serviceList.sort((a, b) => a.name.localeCompare(b.name));
  serviceList.forEach((item) => {
    printMessage(`${item._id} - ${item.name}`, 'data');
  });

  await getFullServices();
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

        console.log('nextDescendents', nextDescendents);

        return {
          ...service,
          nextDescendents,
        };
      } catch (error) {
        console.log(error);
        // throw error;
      }
    })
  );

  return fullServiceData;
}

export async function exportServicesToFile(file?: string) {
  const fileName = file ?? 'services.json';

  console.log('Exporting all services to a single file...');
  const services = await getFullServices();

  saveToFile('service', services, '_id', fileName);
}

export async function exportServicesToFiles() {
  console.log('Exporting all services to separate files...');

  const services = await getFullServices();

  services.forEach((service) => {
    const fileName = `./${service._id}.json`;

    saveToFile('service', service, '_id', fileName);
  });
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
  await Promise.all(
    serviceEntries.map(([id, data]) => {
      return putFullService(id, data);
    })
  );
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

  await putService(serviceId, serviceData);
}

export async function importServices(clean: boolean, file: string) {
  const fileString = readFileSync(file, 'utf8');
  const serviceData = JSON.parse(fileString);
  // TODO: validate file

  if (clean) {
    await deleteFullServices();
  }

  await putFullServices(Object.entries(serviceData));
}

export async function importServicesSeparate(
  clean: boolean,
  directory: string
) {
  const fileNames = await readFilesRecursive(directory);

  const serviceData = fileNames.map((fileName): [string, FullService] => {
    const fileString = readFileSync(`${directory}/${fileName}`, 'utf8');
    const serviceId = fileName.replace('.json', '');
    const serviceData = JSON.parse(fileString);
    // TODO: validate file
    return [serviceId, serviceData];
  });

  if (clean) {
    await deleteFullServices();
  }

  await putFullServices(serviceData);
}

export async function deleteServiceOp(serviceId: string) {
  await deleteFullService(serviceId);
}
