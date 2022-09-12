import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { encode, decode } from '../../api/utils/Base64';
import { parseUrl } from '../../api/utils/ApiUtils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function readJsonFile(file: string) {
  const json = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `${file}`), 'utf8')
  );
  return json;
}

/**
 * AM Mocks and Utils
 */

export function getTrees() {
  const treeObjects = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, './TreeApi/getTrees/trees.json'),
      'utf8'
    )
  );
  return treeObjects;
}

export function mockGetTrees(mock: MockAdapter) {
  mock
    .onGet(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/authentication\/authenticationtrees\/trees\?_queryFilter=true/
    )
    .reply(function () {
      const mockStatus = 200;
      const mockResponse = getTrees();
      expect(mockResponse).toBeTruthy();
      return [mockStatus, mockResponse];
    });
}

export function getTree(treeId: string) {
  const treeObject = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, `./TreeApi/getTree/${treeId}.json`),
      'utf8'
    )
  );
  return treeObject;
}

export function mockGetTree(mock: MockAdapter) {
  mock
    .onGet(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/authentication\/authenticationtrees\/trees\/.+/
    )
    .reply(function (config) {
      const elements = config.url ? config.url.split('/') : [];
      const treeId = elements[elements?.length - 1];
      const mockStatus = 200;
      const mockResponse = getTree(treeId);
      expect(mockResponse._id).toBe(treeId);
      return [mockStatus, mockResponse];
    });
}

export function mockPutTree(
  mock: MockAdapter,
  callback: (mockTreeId: string, mockTreeObj) => void
) {
  mock
    .onPut(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/authentication\/authenticationtrees\/trees\/.+/
    )
    .reply(function (config) {
      const elements = config.url ? config.url.split('/') : [];
      const treeId = elements[elements?.length - 1];
      const mockStatus = 200;
      const mockTreeObj = JSON.parse(config.data);
      callback(treeId, mockTreeObj);
      return [mockStatus, mockTreeObj];
    });
}

export function mockGetNode(mock: MockAdapter) {
  mock
    .onGet(
      /\/json\/realms\/root\/realms\/alpha\/realm-config\/authentication\/authenticationtrees\/nodes\/.+/
    )
    .reply(function (config) {
      const elements = config.url ? config.url.split('/') : [];
      const nodeType = elements[elements?.length - 2];
      const nodeId = elements[elements?.length - 1];
      const mockStatus = 200;
      const mockResponse = JSON.parse(
        fs.readFileSync(
          path.resolve(
            __dirname,
            `./NodeApi/getNode/${nodeType}/${nodeId}.json`
          ),
          'utf8'
        )
      );
      expect(mockResponse._id).toBe(nodeId);
      return [mockStatus, mockResponse];
    });
}

export function mockPutNode(
  mock: MockAdapter,
  callback: (mockNodeId: string, mockNodeObj) => void
) {
  mock
    .onPut(
      /\/json\/realms\/root\/realms\/alpha\/realm-config\/authentication\/authenticationtrees\/nodes\/.+/
    )
    .reply(function (config) {
      const elements = config.url ? config.url.split('/') : [];
      const nodeId = elements[elements?.length - 1];
      const mockStatus = 200;
      const mockNodeObj = JSON.parse(config.data);
      callback(nodeId, mockNodeObj);
      return [mockStatus, mockNodeObj];
    });
}

export function getScript(scriptId: string) {
  const treeObject = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, `./ScriptApi/getScript/${scriptId}.json`),
      'utf8'
    )
  );
  return treeObject;
}

export function mockGetScript(mock: MockAdapter) {
  mock
    .onGet(/.*?\/json\/realms\/root\/realms\/alpha\/scripts\/.+/)
    .reply(function (config) {
      const elements = config.url ? config.url.split('/') : [];
      const scriptId = elements[elements?.length - 1];
      const mockStatus = 200;
      const mockResponse = getScript(scriptId);
      expect(mockResponse._id).toBe(scriptId);
      return [mockStatus, mockResponse];
    });
}

// mockPutScript(mock);
export function mockPutScript(
  mock: MockAdapter,
  callback: (mockScriptId: string, mockScriptObj) => void
) {
  mock
    .onPut(/.*?\/json\/realms\/root\/realms\/alpha\/scripts\/.+/)
    .reply(function (config) {
      const elements = config.url ? config.url.split('/') : [];
      const scriptId = elements[elements?.length - 1];
      const mockStatus = 200;
      const mockScriptObj = JSON.parse(config.data);
      callback(scriptId, mockScriptObj);
      return [mockStatus, mockScriptObj];
    });
}

export function getScriptByName(scriptName: string) {
  const treeObject = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, `./ScriptApi/getScriptByName/${scriptName}.json`),
      'utf8'
    )
  );
  return treeObject;
}

// export function mockGetScriptByName(mock: MockAdapter) {
//   mock
//     .onGet(
//       /\/json\/realms\/root\/realms\/alpha\/scripts\?_queryFilter=name\+eq\+'.+'/
//     )
//     .reply(function (config) {
//       const elements = config.url ? config.url.split('/') : [];
//       const scriptId = elements[elements?.length - 1];
//       const mockStatus = 200;
//       const mockResponse = getScript(scriptId);
//       expect(mockResponse._id).toBe(scriptId);
//       return [mockStatus, mockResponse];
//     });
// }

export function getSaml2Providers() {
  const treeObjects = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, './Saml2Api/getProviders/providers.json'),
      'utf8'
    )
  );
  return treeObjects;
}

export function mockGetSaml2Providers(mock: MockAdapter) {
  mock
    .onGet(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/saml2\?_queryFilter=true/
    )
    .reply(function () {
      const mockStatus = 200;
      const mockResponse = getSaml2Providers();
      expect(mockResponse).toBeTruthy();
      return [mockStatus, mockResponse];
    });
}

export function mockFindSaml2Providers(mock: MockAdapter) {
  mock
    .onGet(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/saml2\?_queryFilter=.+?&_fields=.+/
    )
    .reply(function () {
      const mockStatus = 200;
      const mockResponse = {
        result: [],
        resultCount: 0,
        pagedResultsCookie: null,
        totalPagedResultsPolicy: 'EXACT',
        totalPagedResults: 1,
        remainingPagedResults: -1,
      };
      expect(mockResponse).toBeTruthy();
      return [mockStatus, mockResponse];
    });
}

export function getCirclesOfTrust() {
  const treeObjects = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        './CirclesOfTrustApi/getCirclesOfTrust/cots.json'
      ),
      'utf8'
    )
  );
  return treeObjects;
}

export function mockGetCirclesOfTrust(mock: MockAdapter) {
  mock
    .onGet(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/federation\/circlesoftrust\?_queryFilter=true/
    )
    .reply(function () {
      const mockStatus = 200;
      const mockResponse = getCirclesOfTrust();
      expect(mockResponse).toBeTruthy();
      return [mockStatus, mockResponse];
    });
}

export function mockCreateCircleOfTrust(
  mock: MockAdapter,
  callback: (mockCotId: string, mockCotObj) => void
) {
  mock
    .onPost(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/federation\/circlesoftrust\/\?_action=create/
    )
    .reply(function (config) {
      const mockCotObj = JSON.parse(config.data);
      const cotId = mockCotObj._id;
      const mockStatus = 200;
      callback(cotId, mockCotObj);
      return [mockStatus, mockCotObj];
    });
}

export function mockUpdateCircleOfTrust(
  mock: MockAdapter,
  callback: (mockCotId: string, mockCotObj) => void
) {
  mock
    .onPut(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/federation\/circlesoftrust\/.+/
    )
    .reply(function (config) {
      const elements = config.url ? config.url.split('/') : [];
      const cotId = elements[elements?.length - 1];
      const mockStatus = 200;
      const mockCotObj = JSON.parse(config.data);
      callback(cotId, mockCotObj);
      return [mockStatus, mockCotObj];
    });
}

export function mockGetSaml2ProviderByLocationAndId(mock: MockAdapter) {
  mock
    .onGet(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/saml2\/.+?\/.+/
    )
    .reply(function (config) {
      const elements = config.url ? config.url.split('/') : [];
      const location = elements[elements?.length - 2];
      const providerId = elements[elements?.length - 1];
      const mockStatus = 200;
      const mockResponse = JSON.parse(
        fs.readFileSync(
          path.resolve(
            __dirname,
            `./Saml2Api/getProviderByLocationAndId/${location}/${providerId}.json`
          ),
          'utf8'
        )
      );
      expect(mockResponse._id).toBe(providerId);
      return [mockStatus, mockResponse];
    });
}

export function mockCreateSaml2Provider(
  mock: MockAdapter,
  callback: (
    mockSaml2ProviderId64: string,
    mockSaml2ProviderLocation: string,
    mockSaml2ProviderObj
  ) => void
) {
  mock
    .onPost(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/saml2\/(hosted|remote)\/\?_action=(create|importEntity)/
    )
    .reply(function (config) {
      const elements = config.url
        ? parseUrl(config.url).pathname.split('/')
        : [];
      const mockSaml2ProviderLocation = elements[elements?.length - 1];
      const mockSaml2ProviderObj = JSON.parse(config.data);
      let mockSaml2ProviderId64 = '';
      if (mockSaml2ProviderObj._id) {
        mockSaml2ProviderId64 = mockSaml2ProviderObj._id;
      } else {
        const metaDataXml = decode(mockSaml2ProviderObj.standardMetadata);
        mockSaml2ProviderId64 = encode(
          metaDataXml.match(/entityID="(.+?)"/)[1],
          false
        );
      }
      const mockStatus = 200;
      callback(
        mockSaml2ProviderId64,
        mockSaml2ProviderLocation,
        mockSaml2ProviderObj
      );
      return [mockStatus, mockSaml2ProviderObj];
    });
}

export function mockUpdateSaml2Provider(
  mock: MockAdapter,
  callback: (
    mockSaml2ProviderId64: string,
    mockSaml2ProviderLocation: string,
    mockSaml2ProviderObj
  ) => void
) {
  mock
    .onPut(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/saml2\/(hosted|remote)\/.+/
    )
    .reply(function (config) {
      const elements = config.url ? config.url.split('/') : [];
      const mockSaml2ProviderLocation = elements[elements?.length - 2];
      const mockSaml2ProviderId64 = elements[elements?.length - 1];
      const mockSaml2ProviderObj = JSON.parse(config.data);
      const mockStatus = 200;
      callback(
        mockSaml2ProviderId64,
        mockSaml2ProviderLocation,
        mockSaml2ProviderObj
      );
      return [mockStatus, mockSaml2ProviderObj];
    });
}

export function mockGetSaml2ProviderMetadata(mock: MockAdapter) {
  mock
    .onGet(/.*?\/saml2\/jsp\/exportmetadata.jsp\?entityid=.+?&realm=.+/)
    .reply(function (config) {
      const parsed = parseUrl(config.url);
      const realm = parsed.searchParam['realm'];
      const entityId = parsed.searchParam['entityid'];
      const mockStatus = 200;
      const mockResponse = fs.readFileSync(
        path.resolve(
          __dirname,
          `./Saml2Api/getProviderMetadata/${realm}/${encode(
            entityId,
            false
          )}.xml`
        ),
        'utf8'
      );
      expect(mockResponse).toBeTruthy();
      return [mockStatus, mockResponse];
    });
}

export function getSocialProviders() {
  const treeObjects = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        './SocialIdentityProvidersApi/getSocialIdentityProviders/socialIdentityProviders.json'
      ),
      'utf8'
    )
  );
  return treeObjects;
}

export function mockGetSocialProviders(mock: MockAdapter) {
  mock
    .onPost(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/services\/SocialIdentityProviders\?_action=nextdescendents/
    )
    .reply(function () {
      const mockStatus = 200;
      const mockResponse = getSocialProviders();
      expect(mockResponse).toBeTruthy();
      return [mockStatus, mockResponse];
    });
}

export function mockPutSocialProviderByTypeAndId(
  mock: MockAdapter,
  callback: (
    mockSocialProviderId: string,
    mockSocialProviderType: string,
    mockSocialProviderObj
  ) => void
) {
  mock
    .onPut(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/services\/SocialIdentityProviders\/.+?\/.+/
    )
    .reply(function (config) {
      const elements = config.url ? config.url.split('/') : [];
      const mockSocialProviderType = elements[elements?.length - 2];
      const mockSocialProviderId = elements[elements?.length - 1];
      const mockSocialProviderObj = JSON.parse(config.data);
      const mockStatus = 200;
      callback(
        mockSocialProviderId,
        mockSocialProviderType,
        mockSocialProviderObj
      );
      return [mockStatus, mockSocialProviderObj];
    });
}

/**
 * IDM Mocks and Utils
 */

export function mockGetConfigEntity(mock: MockAdapter) {
  mock.onGet(/.*?\/openidm\/config\/.+/).reply(function (config) {
    const entityId = config.url
      ? config.url.substring(config.url.indexOf('/config/') + 8)
      : '';
    const mockStatus = 200;
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          `./IdmConfigApi/getConfigEntity/${entityId}.json`
        ),
        'utf8'
      )
    );
    expect(mockResponse._id).toBe(entityId);
    return [mockStatus, mockResponse];
  });
}

export function mockPutConfigEntity(
  mock: MockAdapter,
  callback: (mockEntityId: string, mockEntityObj) => void
) {
  mock.onPut(/.*?\/openidm\/config\/.+/).reply(function (config) {
    const entityId = config.url
      ? config.url.substring(config.url.indexOf('/config/') + 8)
      : '';
    const mockStatus = 200;
    const mockResponse = JSON.parse(config.data);
    callback(entityId, mockResponse);
    return [mockStatus, mockResponse];
  });
}
