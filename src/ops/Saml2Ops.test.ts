import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Saml2, state } from '../index';
import * as globalConfig from '../storage/StaticStorage';
import { Saml2ProiderLocation } from '../api/ApiTypes';
import {
  mockGetSaml2Providers,
  mockFindSaml2Providers,
  mockGetSaml2ProviderByLocationAndId,
  mockGetSaml2ProviderMetadata,
  mockGetScript,
  mockPutScript,
  getSaml2ProviderImportData,
  getSaml2ProvidersImportData,
} from '../test/mocks/ForgeRockApiMockEngine';
import { encodeBase64Url } from '../api/utils/Base64';
import { Saml2ExportInterface } from '../../types/ops/OpsTypes';
import { isEqualJson } from './utils/OpsUtils';
import { mockCreateSaml2Provider } from '../test/mocks/ForgeRockApiMockEngine';
import { convertTextArrayToBase64Url } from './utils/ExportImportUtils';

const mock = new MockAdapter(axios);
const outputHandler = (message: string) => {
  console.log(message);
};

state.default.session.setTenant('https://openam-volker-dev.forgeblocks.com/am');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');
state.default.session.setDeploymentType(globalConfig.CLOUD_DEPLOYMENT_TYPE_KEY);
state.default.session.setDebug(true);
state.default.session.setDebugHandler(outputHandler);
state.default.session.setPrintHandler(outputHandler);

describe('Saml2Ops - createSaml2ExportTemplate()', () => {
  test('createSaml2ExportTemplate() 0: Method is implemented', async () => {
    expect(Saml2.createSaml2ExportTemplate).toBeDefined();
  });

  test('createSaml2ExportTemplate() 1: Create saml2 export template', async () => {
    const saml2Export: Saml2ExportInterface = {
      script: {},
      saml: {
        hosted: {},
        remote: {},
        metadata: {},
      },
    };
    const response = Saml2.createSaml2ExportTemplate();
    expect(isEqualJson(response, saml2Export, ['meta'])).toBeTruthy();
  });
});

describe('Saml2Ops - getSaml2ProviderStubs()', () => {
  test('getSaml2ProviderStubs() 0: Method is implemented', async () => {
    expect(Saml2.getSaml2ProviderStubs).toBeDefined();
  });

  test('getSaml2ProviderStubs() 1: Get saml2 entity provider stubs', async () => {
    mockGetSaml2Providers(mock);
    const providers = await Saml2.getSaml2ProviderStubs();
    expect(providers).toBeTruthy();
    expect(providers.length).toBe(8);
  });
});

describe('Saml2Ops - getProviderByLocationAndId()', () => {
  test('getProviderByLocationAndId() 0: Method is implemented', async () => {
    expect(Saml2.getProviderByLocationAndId).toBeDefined();
  });

  test('getProviderByLocationAndId() 1: Get hosted provider "iSPAzure"', async () => {
    const location = Saml2ProiderLocation.HOSTED;
    const entityId = 'iSPAzure';
    const entityId64 = encodeBase64Url(entityId);
    mockGetSaml2ProviderByLocationAndId(mock);
    const provider = await Saml2.getProviderByLocationAndId(
      location,
      entityId64
    );
    expect(provider).toBeTruthy();
    expect(provider._id).toBe(entityId64);
    expect(provider.entityId).toBe(entityId);
    expect(provider.entityLocation).toBeFalsy();
    expect(provider.roles).toBeFalsy();
  });

  test('getProviderByLocationAndId() 2: Get remote provider "urn:federation:MicrosoftOnline"', async () => {
    const location = Saml2ProiderLocation.REMOTE;
    const entityId = 'urn:federation:MicrosoftOnline';
    const entityId64 = encodeBase64Url(entityId);
    mockGetSaml2ProviderByLocationAndId(mock);
    const provider = await Saml2.getProviderByLocationAndId(
      location,
      entityId64
    );
    expect(provider).toBeTruthy();
    expect(provider._id).toBe(entityId64);
    expect(provider.entityId).toBe(entityId);
    expect(provider.entityLocation).toBeFalsy();
    expect(provider.roles).toBeFalsy();
  });
});

describe('Saml2Ops - getProviderMetadataUrl()', () => {
  test('getProviderMetadataUrl() 0: Method is implemented', async () => {
    expect(Saml2.getProviderMetadataUrl).toBeDefined();
  });

  test('getProviderMetadataUrl() 1: Get metadata url for hosted entity provider "idp"', async () => {
    const entityId = 'idp';
    const metadataUrl =
      'https://openam-volker-dev.forgeblocks.com/am/saml2/jsp/exportmetadata.jsp?entityid=idp&realm=alpha';
    const result = Saml2.getProviderMetadataUrl(entityId);
    expect(result).toBe(metadataUrl);
  });

  test('getProviderMetadataUrl() 2: Get metadata url for hosted entity provider "https://sts.windows.net/711ffa9c-5972-4713-ace3-688c9732614a/"', async () => {
    const entityId =
      'https://sts.windows.net/711ffa9c-5972-4713-ace3-688c9732614a/';
    const metadataUrl =
      'https://openam-volker-dev.forgeblocks.com/am/saml2/jsp/exportmetadata.jsp?entityid=https%3A%2F%2Fsts.windows.net%2F711ffa9c-5972-4713-ace3-688c9732614a%2F&realm=alpha';
    const result = Saml2.getProviderMetadataUrl(entityId);
    expect(result).toBe(metadataUrl);
  });
});

describe('Saml2Ops - getProviderMetadata()', () => {
  test('getProviderMetadata() 0: Method is implemented', async () => {
    expect(Saml2.getProviderMetadata).toBeDefined();
  });

  test('getProviderMetadata() 1: Get metadata for hosted provider "iSPAzure"', async () => {
    const entityId = 'iSPAzure';
    const metaSub =
      '<EntityDescriptor entityID="iSPAzure" xmlns="urn:oasis:names:tc:SAML:2.0:metadata" xmlns:query="urn:oasis:names:tc:SAML:metadata:ext:query" xmlns:mdattr="urn:oasis:names:tc:SAML:metadata:attribute" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:xenc="http://www.w3.org/2001/04/xmlenc#" xmlns:xenc11="http://www.w3.org/2009/xmlenc11#" xmlns:alg="urn:oasis:names:tc:SAML:metadata:algsupport" xmlns:x509qry="urn:oasis:names:tc:SAML:metadata:X509:query" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">';
    mockGetSaml2ProviderMetadata(mock);
    const metadata = await Saml2.getProviderMetadata(entityId);
    expect(metadata).toBeTruthy();
    expect(metadata.indexOf(metaSub)).toBeTruthy();
  });

  test('getProviderMetadata() 2: Get metadata for hosted provider "https://sts.windows.net/711ffa9c-5972-4713-ace3-688c9732614a/"', async () => {
    const entityId =
      'https://sts.windows.net/711ffa9c-5972-4713-ace3-688c9732614a/';
    const metaSub =
      '<EntityDescriptor entityID="https://sts.windows.net/711ffa9c-5972-4713-ace3-688c9732614a/" ID="_e5f839b8-1482-40ae-9261-b6eb35465a16" xmlns="urn:oasis:names:tc:SAML:2.0:metadata" xmlns:query="urn:oasis:names:tc:SAML:metadata:ext:query" xmlns:mdattr="urn:oasis:names:tc:SAML:metadata:attribute" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:xenc="http://www.w3.org/2001/04/xmlenc#" xmlns:xenc11="http://www.w3.org/2009/xmlenc11#" xmlns:alg="urn:oasis:names:tc:SAML:metadata:algsupport" xmlns:x509qry="urn:oasis:names:tc:SAML:metadata:X509:query" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">';
    mockGetSaml2ProviderMetadata(mock);
    const metadata = await Saml2.getProviderMetadata(entityId);
    expect(metadata).toBeTruthy();
    expect(metadata.indexOf(metaSub)).toBeTruthy();
  });
});

describe('Saml2Ops - getSaml2ProviderStub()', () => {
  test('getSaml2ProviderStub() 0: Method is implemented', async () => {
    expect(Saml2.getSaml2ProviderStub).toBeDefined();
  });

  test('getSaml2ProviderStub() 1: Get stub of hosted provider "iSPAzure"', async () => {
    const location = Saml2ProiderLocation.HOSTED;
    const entityId = 'iSPAzure';
    const entityId64 = encodeBase64Url(entityId);
    mockFindSaml2Providers(mock);
    const stub = await Saml2.getSaml2ProviderStub(entityId);
    expect(stub).toBeTruthy();
    expect(stub._id).toBe(entityId64);
    expect(stub.entityId).toBe(entityId);
    expect(stub.location).toBe(location);
    expect(stub.roles).toBeTruthy();
  });

  test('getSaml2ProviderStub() 2: Get stub of remote provider "https://sts.windows.net/711ffa9c-5972-4713-ace3-688c9732614a/"', async () => {
    const location = Saml2ProiderLocation.REMOTE;
    const entityId =
      'https://sts.windows.net/711ffa9c-5972-4713-ace3-688c9732614a/';
    const entityId64 = encodeBase64Url(entityId);
    mockFindSaml2Providers(mock);
    const stub = await Saml2.getSaml2ProviderStub(entityId);
    expect(stub).toBeTruthy();
    expect(stub._id).toBe(entityId64);
    expect(stub.entityId).toBe(entityId);
    expect(stub.location).toBe(location);
    expect(stub.roles).toBeTruthy();
  });
});

describe('Saml2Ops - getSaml2Provider()', () => {
  test('getSaml2Provider() 0: Method is implemented', async () => {
    expect(Saml2.getSaml2Provider).toBeDefined();
  });

  test('getSaml2Provider() 1: Get hosted provider "iSPAzure"', async () => {
    const entityId = 'iSPAzure';
    const entityId64 = encodeBase64Url(entityId);
    mockFindSaml2Providers(mock);
    mockGetSaml2ProviderByLocationAndId(mock);
    const provider = await Saml2.getSaml2Provider(entityId);
    expect(provider).toBeTruthy();
    expect(provider._id).toBe(entityId64);
    expect(provider.entityId).toBe(entityId);
    expect(provider.entityLocation).toBeFalsy();
    expect(provider.location).toBeFalsy();
    expect(provider.roles).toBeFalsy();
  });

  test('getSaml2Provider() 2: Get remote provider "https://sts.windows.net/711ffa9c-5972-4713-ace3-688c9732614a/"', async () => {
    const entityId =
      'https://sts.windows.net/711ffa9c-5972-4713-ace3-688c9732614a/';
    const entityId64 = encodeBase64Url(entityId);
    mockFindSaml2Providers(mock);
    mockGetSaml2ProviderByLocationAndId(mock);
    const provider = await Saml2.getSaml2Provider(entityId);
    expect(provider).toBeTruthy();
    expect(provider._id).toBe(entityId64);
    expect(provider.entityId).toBe(entityId);
    expect(provider.entityLocation).toBeFalsy();
    expect(provider.location).toBeFalsy();
    expect(provider.roles).toBeFalsy();
  });
});

describe('Saml2Ops - exportSaml2Provider()', () => {
  test('exportSaml2Provider() 0: Method is implemented', async () => {
    expect(Saml2.exportSaml2Provider).toBeDefined();
  });

  test('exportSaml2Provider() 1: Export hosted provider "iSPAzure"', async () => {
    const location = Saml2ProiderLocation.HOSTED;
    const entityId = 'iSPAzure';
    const entityId64 = encodeBase64Url(entityId);
    mockFindSaml2Providers(mock);
    mockGetSaml2ProviderByLocationAndId(mock);
    mockGetSaml2ProviderMetadata(mock);
    mockGetScript(mock);
    const exportData = await Saml2.exportSaml2Provider(entityId);
    expect(
      isEqualJson(exportData, Saml2.createSaml2ExportTemplate(), [
        'meta',
        'script',
        'hosted',
        'remote',
        'metadata',
      ])
    ).toBeTruthy();
    expect(exportData.saml[location][entityId64]).toBeTruthy();
    expect(exportData.saml.metadata[entityId64]).toBeTruthy();
    expect(Object.keys(exportData.script).length).toBe(0);
  });

  test('exportSaml2Provider() 2: Export remote provider "https://sts.windows.net/711ffa9c-5972-4713-ace3-688c9732614a/"', async () => {
    const location = Saml2ProiderLocation.REMOTE;
    const entityId =
      'https://sts.windows.net/711ffa9c-5972-4713-ace3-688c9732614a/';
    const entityId64 = encodeBase64Url(entityId);
    mockFindSaml2Providers(mock);
    mockGetSaml2ProviderByLocationAndId(mock);
    mockGetSaml2ProviderMetadata(mock);
    mockGetScript(mock);
    const exportData = await Saml2.exportSaml2Provider(entityId);
    expect(
      isEqualJson(exportData, Saml2.createSaml2ExportTemplate(), [
        'meta',
        'script',
        'hosted',
        'remote',
        'metadata',
      ])
    ).toBeTruthy();
    expect(exportData.saml[location][entityId64]).toBeTruthy();
    expect(exportData.saml.metadata[entityId64]).toBeTruthy();
    expect(Object.keys(exportData.script).length).toBe(0);
  });
});

describe('Saml2Ops - exportSaml2Providers()', () => {
  test('exportSaml2Providers() 0: Method is implemented', async () => {
    expect(Saml2.exportSaml2Providers).toBeDefined();
  });

  test('exportSaml2Providers() 1: Export saml2 entity providers', async () => {
    mockGetSaml2Providers(mock);
    mockGetSaml2ProviderByLocationAndId(mock);
    mockGetSaml2ProviderMetadata(mock);
    mockGetScript(mock);
    const exportData = await Saml2.exportSaml2Providers();
    expect(
      isEqualJson(exportData, Saml2.createSaml2ExportTemplate(), [
        'meta',
        'script',
        'hosted',
        'remote',
        'metadata',
      ])
    ).toBeTruthy();
    expect(Object.entries(exportData.saml.hosted).length).toBe(5);
    expect(Object.entries(exportData.saml.remote).length).toBe(3);
    expect(Object.entries(exportData.saml.metadata).length).toBe(8);
    expect(Object.keys(exportData.script).length).toBe(3);
  });
});

describe('Saml2Ops - importSaml2Provider()', () => {
  test('importSaml2Provider() 0: Method is implemented', async () => {
    expect(Saml2.importSaml2Provider).toBeDefined();
  });

  test('importSaml2Provider() 1: Import hosted provider "https://idc.scheuber.io/am/saml2/IDPAzure"', async () => {
    const entityLocation = Saml2ProiderLocation.HOSTED;
    const entityId = 'https://idc.scheuber.io/am/saml2/IDPAzure';
    const entityId64 = encodeBase64Url(entityId);
    const importData: Saml2ExportInterface =
      getSaml2ProviderImportData(entityId);
    mockPutScript(mock, (mockScriptId, mockScriptObj) => {
      expect(Object.keys(importData.script)).toContain(mockScriptId);
      expect(mockScriptObj._id).toEqual(mockScriptId);
    });
    mockCreateSaml2Provider(
      mock,
      (
        mockSaml2ProviderId64,
        mockSaml2ProviderLocation,
        mockSaml2ProviderObj
      ) => {
        expect(mockSaml2ProviderId64).toEqual(entityId64);
        expect(mockSaml2ProviderLocation).toEqual(entityLocation);
        expect(
          isEqualJson(
            importData.saml[entityLocation][entityId64],
            mockSaml2ProviderObj,
            ['_rev']
          )
        ).toBeTruthy();
      }
    );
    // expect 5 assertions because import contains 1 script
    expect.assertions(5);
    await Saml2.importSaml2Provider(entityId, importData);
  });

  test('importSaml2Provider() 2: Import hosted provider "https://idc.scheuber.io/am/saml2/IDPBroadcom"', async () => {
    const entityLocation = Saml2ProiderLocation.HOSTED;
    const entityId = 'https://idc.scheuber.io/am/saml2/IDPBroadcom';
    const entityId64 = encodeBase64Url(entityId);
    const importData: Saml2ExportInterface =
      getSaml2ProviderImportData(entityId);
    mockPutScript(mock, (mockScriptId, mockScriptObj) => {
      expect(Object.keys(importData.script)).toContain(mockScriptId);
      expect(mockScriptObj._id).toEqual(mockScriptId);
    });
    mockCreateSaml2Provider(
      mock,
      (
        mockSaml2ProviderId64,
        mockSaml2ProviderLocation,
        mockSaml2ProviderObj
      ) => {
        expect(mockSaml2ProviderId64).toEqual(entityId64);
        expect(mockSaml2ProviderLocation).toEqual(entityLocation);
        expect(
          isEqualJson(
            importData.saml[entityLocation][entityId64],
            mockSaml2ProviderObj,
            ['_rev']
          )
        ).toBeTruthy();
      }
    );
    // expect 7 assertions because import contains 2 scripts
    expect.assertions(7);
    await Saml2.importSaml2Provider(entityId, importData);
  });

  test('importSaml2Provider() 3: Import remote provider "https://sts.windows.net/711ffa9c-5972-4713-ace3-688c9732614a/" with metadata', async () => {
    const entityLocation = Saml2ProiderLocation.REMOTE;
    const entityId =
      'https://sts.windows.net/711ffa9c-5972-4713-ace3-688c9732614a/';
    const entityId64 = encodeBase64Url(entityId);
    const importData: Saml2ExportInterface =
      getSaml2ProviderImportData(entityId);
    mockPutScript(mock, (mockScriptId, mockScriptObj) => {
      expect(Object.keys(importData.script)).toContain(mockScriptId);
      expect(mockScriptObj._id).toEqual(mockScriptId);
    });
    mockCreateSaml2Provider(
      mock,
      (
        mockSaml2ProviderId64,
        mockSaml2ProviderLocation,
        mockSaml2ProviderObj
      ) => {
        expect(mockSaml2ProviderId64).toEqual(entityId64);
        expect(mockSaml2ProviderLocation).toEqual(entityLocation);
        // this is an import of a remote identity provider, which can only be done using SAML2 metadata
        expect(mockSaml2ProviderObj.standardMetadata).toEqual(
          convertTextArrayToBase64Url(importData.saml.metadata[entityId64])
        );
      }
    );
    // expect only 3 assertions because import contains no scripts
    expect.assertions(3);
    await Saml2.importSaml2Provider(entityId, importData);
  });
});

describe('Saml2Ops - importSaml2Providers()', () => {
  test('importSaml2Providers() 0: Method is implemented', async () => {
    expect(Saml2.importSaml2Providers).toBeDefined();
  });

  test('importSaml2Providers() 1: Import providers', async () => {
    const importData: Saml2ExportInterface = getSaml2ProvidersImportData();
    let scriptIds = Object.keys(importData.script);
    let hostedEntityIds64 = Object.keys(importData.saml.hosted);
    let remoteEntityIds64 = Object.keys(importData.saml.remote);
    const allEntityIds64 = hostedEntityIds64.concat(remoteEntityIds64);
    let metaDataIds64 = Object.keys(importData.saml.metadata);
    mockPutScript(mock, (mockScriptId, mockScriptObj) => {
      expect(scriptIds).toContain(mockScriptId);
      expect(mockScriptObj._id).toEqual(mockScriptId);
      scriptIds = scriptIds.filter((scriptId) => scriptId !== mockScriptId);
    });
    mockCreateSaml2Provider(
      mock,
      (
        mockSaml2ProviderId64,
        mockSaml2ProviderLocation,
        mockSaml2ProviderObj
      ) => {
        expect(allEntityIds64).toContain(mockSaml2ProviderId64);
        expect(mockSaml2ProviderLocation).toEqual(
          hostedEntityIds64.includes(mockSaml2ProviderId64)
            ? Saml2ProiderLocation.HOSTED
            : Saml2ProiderLocation.REMOTE
        );
        // for hosted providers compare the provider config, for remote providers compare the metadata
        expect(
          isEqualJson(
            importData.saml[mockSaml2ProviderLocation][mockSaml2ProviderId64],
            mockSaml2ProviderObj,
            ['_rev']
          ) ||
            mockSaml2ProviderObj.standardMetadata ===
              convertTextArrayToBase64Url(
                importData.saml.metadata[mockSaml2ProviderId64]
              )
        ).toBeTruthy();
        hostedEntityIds64 = hostedEntityIds64.filter(
          (saml2ProviderId64) => saml2ProviderId64 !== mockSaml2ProviderId64
        );
        remoteEntityIds64 = remoteEntityIds64.filter(
          (saml2ProviderId64) => saml2ProviderId64 !== mockSaml2ProviderId64
        );
        if (mockSaml2ProviderObj.standardMetadata) {
          metaDataIds64 = metaDataIds64.filter(
            (saml2ProviderId64) => saml2ProviderId64 !== mockSaml2ProviderId64
          );
        }
      }
    );
    expect.assertions(40);
    await Saml2.importSaml2Providers(importData);
    expect(scriptIds.length).toBe(0);
    expect(hostedEntityIds64.length).toBe(0);
    expect(remoteEntityIds64.length).toBe(0);
    // frodo exports metadata for both hosted and remote providers but on import it is only required for remote providers
    expect(metaDataIds64.length).toBe(6);
  });
});

describe('Saml2Ops - deleteSaml2Provider()', () => {
  test('deleteSaml2Provider() 0: Method is implemented', async () => {
    expect(Saml2.deleteSaml2Provider).toBeDefined();
  });
});

describe('Saml2Ops - deleteSaml2Providers()', () => {
  test('deleteSaml2Providers() 0: Method is implemented', async () => {
    expect(Saml2.deleteSaml2Providers).toBeDefined();
  });
});

describe('Saml2Ops - getRawProviders()', () => {
  test('getRawProviders() 0: Method is implemented', async () => {
    expect(Saml2.getRawProviders).toBeDefined();
  });
});

describe('Saml2Ops - getRawProvider()', () => {
  test('getRawProvider() 0: Method is implemented', async () => {
    expect(Saml2.getRawProvider).toBeDefined();
  });
});

describe('Saml2Ops - putRawProvider()', () => {
  test('putRawProvider() 0: Method is implemented', async () => {
    expect(Saml2.putRawProvider).toBeDefined();
  });
});
