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
import { printMessage } from './utils/Console';
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
        console.error(
          `Unable to retrieve data for ${listItem._id} with error: ${error.message}`
        );
      }
    })
  );

  return fullServiceData.filter((data) => !!data); // make sure to filter out any undefined objects
}

export async function exportServicesToFile(file?: string) {
  const fileName = file ?? 'services.json';
  const services = await getFullServices();

  saveToFile('service', services, '_id', fileName);
}

export async function exportServicesToFiles() {
  const services = await getFullServices();

  services.forEach((service) => {
    const fileName = `./${service._type._id}.json`;
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

  for (const id in serviceData.service) {
    const data = serviceData.service[id];
    await putFullService(serviceId, data);
  }
  printMessage(`Imported service: ${serviceId}`);

  return;

  for (const id in serviceData.service) {
    if ({}.hasOwnProperty.call(serviceData.service, id)) {
      const data = serviceData.service[id];
      let nextDescendents = null;
      // eslint-disable-next-line no-prototype-builtins
      if (data.hasOwnProperty('nextDescendents')) {
        nextDescendents = data['nextDescendents'];
        delete data['nextDescendents'];
      }
      delete data._rev;
      putService(id, data).then((result) => {
        if (result !== null) {
          console.log(`Imported ${id}`);
          if (nextDescendents !== null) {
            nextDescendents.forEach(function (descendent) {
              const type = descendent._type._id;
              const descendentId = descendent._id;
              putServiceDescendents(id, type, descendentId, descendent).then(
                (result) => {
                  if (result !== null)
                    console.log(`Imported Service Descendent ${descendentId}`);
                }
              );
            });
          }
        }
      });
    }
  }
}

export async function importServices(clean: boolean, file: string) {
  const fileString = readFileSync(file, 'utf8');
  const serviceData = JSON.parse(fileString);

  if (clean) {
    await deleteFullServices();
  }

  await putFullServices(Object.entries(serviceData));
}

export async function importServicesSeparate(
  clean: boolean,
  directory: string
) {
  const paths = await readFilesRecursive(directory);

  const serviceData = paths.map((path): [string, FullService] => {
    const fileString = readFileSync(`${path}`, 'utf8');
    const parts = path.split('/');
    const fileName = parts[parts.length - 1];
    const serviceId = fileName.replace('.json', '');
    const serviceData = JSON.parse(fileString).service[serviceId];

    //console.log(JSON.stringify())
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
