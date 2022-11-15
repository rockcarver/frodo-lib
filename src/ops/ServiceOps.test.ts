import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Service, state } from '../index';

import {
  mockDeleteDeleteServiceById,
  mockEmptyNextDescendants,
  mockExportSingleService,
  mockListServices,
  mockPutService,
} from '../test/mocks/ForgeRockApiMockEngine';

const mock = new MockAdapter(axios);

state.default.session.setTenant('https://openam-frodo-dev.forgeblocks.com/am');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');
state.default.session.setDeploymentType(global.CLOUD_DEPLOYMENT_TYPE_KEY);

describe('ServiceOps - listServices()', () => {
  test('listServices() 0: Method is implemented', async () => {
    expect(Service.listServices).toBeDefined();
  });

  test('listServices() 1: List all services', async () => {
    mockListServices(mock);
    const services = await Service.listServices();
    expect(services).toBeTruthy();
    expect(services.length).toBe(8);
  });
});

describe('ServiceOps - exportService()', () => {
  test('exportService() 0: Method is implemented', async () => {
    expect(Service.exportService).toBeDefined();
  });

  test('exportService() 1: Get single service', async () => {
    mockExportSingleService(mock);
    mockEmptyNextDescendants(mock);
    const serviceId = 'oauth-oidc';
    expect.assertions(13);
    const serviceExport = await Service.exportService(
      serviceId,
      undefined,
      false
    );
    expect(serviceExport).toBeTruthy();
    if (serviceExport) {
      expect(serviceExport._type._id).toBe(serviceId);
      expect(
        Object.keys(serviceExport.advancedOIDCConfig as object).length
      ).toBe(24);
      expect(
        Object.keys(serviceExport.clientDynamicRegistrationConfig as object)
          .length
      ).toBe(5);
      expect(
        Object.keys(serviceExport.advancedOAuth2Config as object).length
      ).toBe(29);
      expect(Object.keys(serviceExport.coreOIDCConfig as object).length).toBe(
        7
      );
      expect(Object.keys(serviceExport.coreOAuth2Config as object).length).toBe(
        11
      );
      expect(Object.keys(serviceExport.consent as object).length).toBe(8);
      expect(Object.keys(serviceExport.deviceCodeConfig as object).length).toBe(
        4
      );
      expect(Object.keys(serviceExport.pluginsConfig as object).length).toBe(
        15
      );
      expect(Object.keys(serviceExport._type as object).length).toBe(3);
      expect(Object.keys(serviceExport.cibaConfig as object).length).toBe(3);
    }
  });
});

describe('ServiceOps - exportServicesToFile()', () => {
  test('exportServicesToFile() 0: Method is implemented', async () => {
    expect(Service.exportServicesToFile).toBeDefined();
  });

  test('exportServicesToFile() 1: Export multiple services to file', async () => {
    mockListServices(mock);
    mockExportSingleService(mock);
    mockEmptyNextDescendants(mock);
    const firstServiceId = 'oauth-oidc';
    expect.assertions(30);
    const serviceExport = await Service.exportServicesToFile(undefined, false);

    expect(serviceExport).toBeTruthy();
    if (serviceExport) {
      expect(Object.keys(serviceExport as object).length).toBe(8);
      expect(serviceExport[0]._type._id).toBe(firstServiceId);
      expect(
        Object.keys(serviceExport[0].advancedOIDCConfig as object).length
      ).toBe(24);
      expect(
        Object.keys(serviceExport[0].clientDynamicRegistrationConfig as object)
          .length
      ).toBe(5);
      expect(
        Object.keys(serviceExport[0].advancedOAuth2Config as object).length
      ).toBe(29);
      expect(
        Object.keys(serviceExport[0].coreOIDCConfig as object).length
      ).toBe(7);
      expect(
        Object.keys(serviceExport[0].coreOAuth2Config as object).length
      ).toBe(11);
      expect(Object.keys(serviceExport[0].consent as object).length).toBe(8);
      expect(
        Object.keys(serviceExport[0].deviceCodeConfig as object).length
      ).toBe(4);
      expect(Object.keys(serviceExport[0].pluginsConfig as object).length).toBe(
        15
      );
      expect(Object.keys(serviceExport[0]._type as object).length).toBe(3);
      expect(Object.keys(serviceExport[0].cibaConfig as object).length).toBe(3);
    }
  });
});

describe('ServiceOps - exportServicesToFiles()', () => {
  test('exportServicesToFiles() 0: Method is implemented', async () => {
    expect(Service.exportServicesToFiles).toBeDefined();
  });
});

describe('ServiceOps - deleteServiceOp()', () => {
  test('deleteServiceOp() 0: Method is implemented', async () => {
    expect(Service.deleteServiceOp).toBeDefined();
  });

  test('deleteServiceOp() 1: Delete a single service', async () => {
    mockEmptyNextDescendants(mock);
    mockDeleteDeleteServiceById(mock);
    const serviceId = 'oauth-oidc';
    expect.assertions(3);
    const serviceDelete = await Service.deleteServiceOp(serviceId);

    expect(serviceDelete).toBeTruthy();
    expect(serviceDelete.status).toBe(200);
  });
});

describe('ServiceOps - importService()', () => {
  test('importService() 0: Method is implemented', async () => {
    expect(Service.importService).toBeDefined();
  });

  test('importService() 1: Import single service', async () => {
    mockPutService(mock);
    const serviceId = 'baseurl';
    expect.assertions(1);
    const importService = await Service.importService(
      serviceId,
      false,
      './src/test/mocks/ServiceApi/baseurl.service.json'
    );

    expect(importService).toBeTruthy();
  });

  test('importService() 2: Import single service failure: file not found', async () => {
    mockPutService(mock);
    const serviceId = 'baseurl';
    expect.assertions(1);
    const importService = await Service.importService(
      serviceId,
      false,
      './src/test/mocks/ServiceApi/baseurl_not_found.service.json'
    );

    expect(importService).toBeFalsy();
  });

  test('importService() 2: Clean import single service', async () => {
    mockPutService(mock);
    mockDeleteDeleteServiceById(mock);
    const serviceId = 'baseurl';
    expect.assertions(1);
    const importService = await Service.importService(
      serviceId,
      true,
      './src/test/mocks/ServiceApi/baseurl.service.json'
    );

    expect(importService).toBeTruthy();
  });
});

describe('ServiceOps - importServices()', () => {
  test('importServices() 0: Method is implemented', async () => {
    expect(Service.importServices).toBeDefined();
  });

  test('importServices() 1: Import multiple services', async () => {
    mockPutService(mock);
    expect.assertions(1);
    const importService = await Service.importServices(
      false,
      './src/test/mocks/ServiceApi/allServices.service.json'
    );

    expect(importService).toBeTruthy();
  });

  test('importServices() 2: Import multiple service failure: file not found', async () => {
    mockPutService(mock);
    expect.assertions(1);
    const importService = await Service.importServices(
      false,
      './src/test/mocks/ServiceApi/allServices_not_found.service.json'
    );

    expect(importService).toBeFalsy();
  });

  test('importServices() 3: Clean import multiple services', async () => {
    mockPutService(mock);
    mockDeleteDeleteServiceById(mock);
    expect.assertions(10);
    const importService = await Service.importServices(
      true,
      './src/test/mocks/ServiceApi/allServices.service.json'
    );

    expect(importService).toBeTruthy();
  });
});
