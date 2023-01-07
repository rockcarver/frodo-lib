import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import path from 'path';
import fs from 'fs';
import { Service, state } from '../index';
import { ServiceExportInterface } from '../ops/OpsTypes';

import {
  mockDeleteDeleteServiceById,
  mockEmptyNextDescendants,
  mockExportSingleService,
  mockListServices,
  mockPutService,
} from '../test/mocks/ForgeRockApiMockEngine';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mock = new MockAdapter(axios);

state.default.session.setTenant('https://openam-frodo-dev.forgeblocks.com/am');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');
state.default.session.setDeploymentType(global.CLOUD_DEPLOYMENT_TYPE_KEY);

describe('ServiceOps - getListOfServices()', () => {
  test('getListOfServices() 0: Method is implemented', async () => {
    expect(Service.getListOfServices).toBeDefined();
  });

  test('getListOfServices() 1: List all services', async () => {
    mockListServices(mock);
    const services = await Service.getListOfServices();
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
    expect.assertions(14);
    const serviceExport = await Service.exportService(serviceId);
    expect(serviceExport).toBeTruthy();
    if (serviceExport) {
      expect(serviceExport.service['oauth-oidc']._type._id).toBe(serviceId);
      expect(
        Object.keys(
          serviceExport.service['oauth-oidc'].advancedOIDCConfig as object
        ).length
      ).toBe(24);
      expect(
        Object.keys(
          serviceExport.service['oauth-oidc']
            .clientDynamicRegistrationConfig as object
        ).length
      ).toBe(5);
      expect(
        Object.keys(
          serviceExport.service['oauth-oidc'].advancedOAuth2Config as object
        ).length
      ).toBe(29);
      expect(
        Object.keys(
          serviceExport.service['oauth-oidc'].coreOIDCConfig as object
        ).length
      ).toBe(7);
      expect(
        Object.keys(
          serviceExport.service['oauth-oidc'].coreOAuth2Config as object
        ).length
      ).toBe(11);
      expect(
        Object.keys(serviceExport.service['oauth-oidc'].consent as object)
          .length
      ).toBe(8);
      expect(
        Object.keys(
          serviceExport.service['oauth-oidc'].deviceCodeConfig as object
        ).length
      ).toBe(4);
      expect(
        Object.keys(serviceExport.service['oauth-oidc'].pluginsConfig as object)
          .length
      ).toBe(15);
      expect(
        Object.keys(serviceExport.service['oauth-oidc']._type as object).length
      ).toBe(3);
      expect(
        Object.keys(serviceExport.service['oauth-oidc'].cibaConfig as object)
          .length
      ).toBe(3);
    }
  });
});

describe('ServiceOps - exportServices()', () => {
  test('exportServices() 0: Method is implemented', async () => {
    expect(Service.exportServices).toBeDefined();
  });

  test('exportServices() 1: Export multiple services to file', async () => {
    mockListServices(mock);
    mockExportSingleService(mock);
    mockEmptyNextDescendants(mock);
    const firstServiceId = 'oauth-oidc';
    expect.assertions(30);
    const serviceExport = await Service.exportServices();

    expect(serviceExport).toBeTruthy();
    if (serviceExport) {
      expect(
        Object.keys(serviceExport.service['oauth-oidc'] as object).length
      ).toBe(13);
      expect(serviceExport.service['oauth-oidc']._type._id).toBe(
        firstServiceId
      );
      expect(
        Object.keys(
          serviceExport.service['oauth-oidc'].advancedOIDCConfig as object
        ).length
      ).toBe(24);
      expect(
        Object.keys(
          serviceExport.service['oauth-oidc']
            .clientDynamicRegistrationConfig as object
        ).length
      ).toBe(5);
      expect(
        Object.keys(
          serviceExport.service['oauth-oidc'].advancedOAuth2Config as object
        ).length
      ).toBe(29);
      expect(
        Object.keys(
          serviceExport.service['oauth-oidc'].coreOIDCConfig as object
        ).length
      ).toBe(7);
      expect(
        Object.keys(
          serviceExport.service['oauth-oidc'].coreOAuth2Config as object
        ).length
      ).toBe(11);
      expect(
        Object.keys(serviceExport.service['oauth-oidc'].consent as object)
          .length
      ).toBe(8);
      expect(
        Object.keys(
          serviceExport.service['oauth-oidc'].deviceCodeConfig as object
        ).length
      ).toBe(4);
      expect(
        Object.keys(serviceExport.service['oauth-oidc'].pluginsConfig as object)
          .length
      ).toBe(15);
      expect(
        Object.keys(serviceExport.service['oauth-oidc']._type as object).length
      ).toBe(3);
      expect(
        Object.keys(serviceExport.service['oauth-oidc'].cibaConfig as object)
          .length
      ).toBe(3);
    }
  });
});

describe('ServiceOps - importService()', () => {
  test('importService() 0: Method is implemented', async () => {
    expect(Service.importService).toBeDefined();
  });

  test('importService() 1: Import single service', async () => {
    mockPutService(mock);
    const serviceId = 'baseurl';
    expect.assertions(2);
    const data = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/ServiceApi/baseurl.service.json'
        ),
        'utf8'
      )
    );
    const importService = await Service.importService(
      serviceId,
      data as ServiceExportInterface,
      false
    );

    expect(importService).toBeTruthy();
  });

  test('importService() 2: Clean import single service', async () => {
    mockPutService(mock);
    mockDeleteDeleteServiceById(mock);
    const serviceId = 'baseurl';
    const data = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/ServiceApi/baseurl.service.json'
        ),
        'utf8'
      )
    );
    expect.assertions(3);
    const importService = await Service.importService(
      serviceId,
      data as ServiceExportInterface,
      true
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
    expect.assertions(9);
    const data = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/ServiceApi/allServices.service.json'
        ),
        'utf8'
      )
    );
    const importService = await Service.importServices(data, false);

    expect(importService).toBeTruthy();
  });

  test('importServices() 2: Clean import multiple services', async () => {
    mockPutService(mock);
    mockDeleteDeleteServiceById(mock);
    expect.assertions(17);
    const data = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/ServiceApi/allServices.service.json'
        ),
        'utf8'
      )
    );
    const importService = await Service.importServices(data, true);

    expect(importService).toBeTruthy();
  });
});
