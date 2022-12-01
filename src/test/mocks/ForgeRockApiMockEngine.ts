import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { encode, decode } from '../../api/utils/Base64';
import { parseQueryString, parseUrl } from '../../api/utils/ApiUtils';
import slugify from 'slugify';
import { getTypedFilename } from '../../ops/utils/ExportImportUtils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function readJsonFile(file: string) {
  const json = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `${file}`), 'utf8')
  );
  return json;
}

/****
 **
 ** AM Mocks and Utils
 **
 **/

/**
 * Authentication Mocks
 */

export function getServerInfo(variation: string = null) {
  const prefix = 'info';
  const infoObject = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        `./ServerInfoApi/getServerInfo/${
          variation ? prefix + '-' + variation : prefix
        }.json`
      ),
      'utf8'
    )
  );
  return infoObject;
}

export function getServerVersionInfo(variation: string = null) {
  const prefix = 'version';
  const versionObject = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        `./ServerInfoApi/getServerVersionInfo/${
          variation ? prefix + '-' + variation : prefix
        }.json`
      ),
      'utf8'
    )
  );
  return versionObject;
}

export function mockGetServerInfo(mock: MockAdapter, variation: string = null) {
  mock.onGet(/.*?\/json\/serverinfo\/\*/).reply(function (config) {
    const elements = config.url ? config.url.split('/') : [];
    const id = elements[elements?.length - 1];
    const mockStatus = 200;
    const mockResponse = getServerInfo(variation);
    if (typeof expect !== 'undefined') expect(mockResponse._id).toBe(id);
    return [mockStatus, mockResponse];
  });
}

export function mockGetServerVersionInfo(
  mock: MockAdapter,
  variation: string = null
) {
  mock.onGet(/.*?\/json\/serverinfo\/version/).reply(function (config) {
    const elements = config.url ? config.url.split('/') : [];
    const id = elements[elements?.length - 1];
    const mockStatus = 200;
    const mockResponse = getServerVersionInfo(variation);
    if (typeof expect !== 'undefined') expect(mockResponse._id).toBe(id);
    return [mockStatus, mockResponse];
  });
}

export function getTreeStepResponse(
  treeId: string | undefined,
  authId: string | undefined
) {
  const key = authId ? authId : 'undefined';
  const treeStepsObj = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        `./AuthenticateApi/step/${treeId ? treeId : 'default'}_steps.json`
      ),
      'utf8'
    )
  );
  return treeStepsObj[key];
}

export function mockStep(mock: MockAdapter) {
  mock
    .onPost(/.*?\/json\/realms\/root\/authenticate.*/)
    .reply(function (config) {
      const parsed = parseUrl(config.url);
      const treeId = parsed.searchParam['authIndexValue'];
      const body = JSON.parse(config.data);
      const authId = body.authId;
      const mockStatus = 200;
      const mockResponse = getTreeStepResponse(treeId, authId);
      if (typeof expect !== 'undefined') expect(mockResponse).toBeTruthy();
      return [mockStatus, mockResponse];
    });
}

export function mockAuthorize(mock: MockAdapter) {
  mock.onPost(/.*?\/oauth2\/authorize.*/).reply(function (config) {
    const parsed = parseQueryString(config.data);
    const responseType = parsed['response_type'];
    let mockStatus = 500;
    const mockResponse = undefined;
    const mockHeaders = {};
    if (responseType === 'code') {
      mockStatus = 302;
      const headers = readJsonFile(`./OAuth2OIDCApi/authorize/headers.json`);
      for (const header of headers) {
        mockHeaders[header['key']] = header['value'];
      }
    }
    if (typeof expect !== 'undefined') expect(mockHeaders).toBeTruthy();
    return [mockStatus, mockResponse, mockHeaders];
  });
}

export function mockAccessToken(mock: MockAdapter) {
  mock.onPost(/.*?\/oauth2\/access_token.*/).reply(function (config) {
    const parsed = parseQueryString(config.data);
    const grantType = parsed['grant_type'];
    const code = parsed['code'];
    let mockStatus = 500;
    let mockResponse = undefined;
    const mockHeaders = {};
    if (grantType === 'authorization_code' && code) {
      mockStatus = 200;
      mockResponse = readJsonFile(`./OAuth2OIDCApi/accessToken/body.json`);
      const headers = readJsonFile(`./OAuth2OIDCApi/accessToken/headers.json`);
      for (const header of Object.entries(headers)) {
        mockHeaders[header['key']] = header['value'];
      }
    }
    if (typeof expect !== 'undefined') expect(mockResponse).toBeTruthy();
    return [mockStatus, mockResponse, mockHeaders];
  });
}

/**
 * Tree Mocks
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
      if (typeof expect !== 'undefined') expect(mockResponse).toBeTruthy();
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
      if (typeof expect !== 'undefined') expect(mockResponse._id).toBe(treeId);
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

/**
 * Node Mocks
 */

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
      if (typeof expect !== 'undefined') expect(mockResponse._id).toBe(nodeId);
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

/**
 * Script Mocks
 */

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
      if (typeof expect !== 'undefined')
        expect(mockResponse._id).toBe(scriptId);
      return [mockStatus, mockResponse];
    });
}

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

/**
 * SAML Mocks
 */
export function getSaml2ProviderImportData(entityId: string) {
  const importData = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        `./Saml2Ops/importSaml2Provider/${getTypedFilename(
          entityId,
          'saml',
          'json'
        )}`
      ),
      'utf8'
    )
  );
  return importData;
}

export function getSaml2ProvidersImportData() {
  const importData = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        `./Saml2Ops/importSaml2Providers/allAlphaProviders.saml.json`
      ),
      'utf8'
    )
  );
  return importData;
}

export function getSaml2Providers() {
  const providers = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, './Saml2Api/getProviders/providers.json'),
      'utf8'
    )
  );
  return providers;
}

export function mockGetSaml2Providers(mock: MockAdapter) {
  mock
    .onGet(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/saml2\?_queryFilter=true/
    )
    .reply(function () {
      const mockStatus = 200;
      const mockResponse = getSaml2Providers();
      if (typeof expect !== 'undefined') expect(mockResponse).toBeTruthy();
      return [mockStatus, mockResponse];
    });
}

export function mockFindSaml2Providers(mock: MockAdapter) {
  mock
    .onGet(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/saml2\?_queryFilter=.+?&_fields=.+/
    )
    .reply(function (config) {
      const parsed = parseUrl(config.url);
      const filter = parsed.searchParam['_queryFilter'];
      const entityId = filter.match(/entityId eq '(.+?)'/)[1];
      const mockStatus = 200;
      let mockResponse = {
        result: [],
        resultCount: 0,
        pagedResultsCookie: null,
        totalPagedResultsPolicy: 'EXACT',
        totalPagedResults: 1,
        remainingPagedResults: -1,
      };
      try {
        mockResponse = JSON.parse(
          fs.readFileSync(
            path.resolve(
              __dirname,
              `./Saml2Api/findSaml2Providers/${slugify(entityId)}_stub.json`
            ),
            'utf8'
          )
        );
        if (typeof expect !== 'undefined')
          expect(mockResponse.result[0].entityId).toBe(entityId);
      } catch (error) {
        // ignore errors
      }
      if (typeof expect !== 'undefined') expect(mockResponse).toBeTruthy();
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
      if (typeof expect !== 'undefined') expect(mockResponse).toBeTruthy();
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
      if (typeof expect !== 'undefined')
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
      const mockSaml2ProviderLocation = elements[elements?.length - 2];
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
          `./Saml2Api/getProviderMetadata/${realm}/${encodeURIComponent(
            entityId
          )}.xml`
        ),
        'utf8'
      );
      if (typeof expect !== 'undefined') expect(mockResponse).toBeTruthy();
      return [mockStatus, mockResponse];
    });
}

/**
 * Social Identity Provider Mocks
 */

export function getSocialProviders() {
  const objects = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        './SocialIdentityProvidersApi/getSocialIdentityProviders/socialIdentityProviders.json'
      ),
      'utf8'
    )
  );
  return objects;
}

export function mockGetSocialProviders(mock: MockAdapter) {
  mock
    .onPost(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/services\/SocialIdentityProviders\?_action=nextdescendents/
    )
    .reply(function () {
      const mockStatus = 200;
      const mockResponse = getSocialProviders();
      if (typeof expect !== 'undefined') expect(mockResponse).toBeTruthy();
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
 * Agent mocks and utils
 */

export function getAgentTypes() {
  const objects = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, './AgentApi/getAgentTypes/agentTypes.json'),
      'utf8'
    )
  );
  return objects;
}

export function getAgents() {
  const objects = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, './AgentApi/getAgents/agents.json'),
      'utf8'
    )
  );
  return objects;
}

export function getAgent(agentType, agentId) {
  const objects = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        `./AgentApi/getAgentByTypeAndId/${agentType}/${agentId}.json`
      ),
      'utf8'
    )
  );
  return objects;
}

export function mockGetAgentTypes(mock: MockAdapter) {
  mock
    .onGet(
      /\/json\/realms\/root\/realms\/alpha\/realm-config\/agents\?_action=getAllTypes/
    )
    .reply(function () {
      const mockStatus = 200;
      const mockResponse = getAgentTypes();
      if (typeof expect !== 'undefined') expect(mockResponse).toBeTruthy();
      return [mockStatus, mockResponse];
    });
}

export function mockGetAgentsByType(mock: MockAdapter) {
  mock
    .onGet(
      /\/json\/realms\/root\/realms\/alpha\/realm-config\/agents\/.+?\?_queryFilter=true/
    )
    .reply(function (config) {
      const parsed = parseUrl(config.url);
      const elements = parsed.pathname ? parsed.pathname.split('/') : [];
      const agentType = elements[elements?.length - 1];
      const mockStatus = 200;
      const mockResponse = JSON.parse(
        fs.readFileSync(
          path.resolve(
            __dirname,
            `./AgentApi/getAgentsByType/${agentType}s.json`
          ),
          'utf8'
        )
      );
      if (typeof expect !== 'undefined') expect(mockResponse).toBeTruthy();
      return [mockStatus, mockResponse];
    });
}

export function mockGetAgents(mock: MockAdapter) {
  mock
    .onPost(
      /\/json\/realms\/root\/realms\/alpha\/realm-config\/agents\?_action=nextdescendents/
    )
    .reply(function () {
      const mockStatus = 200;
      const mockResponse = getAgents();
      if (typeof expect !== 'undefined') expect(mockResponse).toBeTruthy();
      return [mockStatus, mockResponse];
    });
}

export function mockFindAgentById(mock: MockAdapter) {
  mock
    .onGet(
      /\/json\/realms\/root\/realms\/alpha\/realm-config\/agents\?_queryFilter=_id\+eq\+'.+?'/
    )
    .reply(function (config) {
      const parsed = parseUrl(config.url);
      const filter = parsed.searchParam['_queryFilter'];
      const agentId = filter.match(/_id\+eq\+'(.+?)'/)[1];
      const mockStatus = 200;
      const mockResponse = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, `./AgentApi/findAgentById/${agentId}.json`),
          'utf8'
        )
      );
      if (typeof expect !== 'undefined')
        expect(mockResponse.result[0]._id).toBe(agentId);
      return [mockStatus, mockResponse];
    });
}

export function mockFindAgentByTypeAndId(mock: MockAdapter) {
  mock
    .onGet(
      /\/json\/realms\/root\/realms\/alpha\/realm-config\/agents\/.+?\?_queryFilter=_id\+eq\+'.+?'/
    )
    .reply(function (config) {
      const parsed = parseUrl(config.url);
      const elements = parsed.pathname ? parsed.pathname.split('/') : [];
      const agentType = elements[elements?.length - 1];
      const filter = parsed.searchParam['_queryFilter'];
      const agentId = filter.match(/_id\+eq\+'(.+?)'/)[1];
      const mockStatus = 200;
      let mockResponse = JSON.parse(
        fs.readFileSync(
          path.resolve(
            __dirname,
            `./AgentApi/findAgentByTypeAndId/not_found.json`
          ),
          'utf8'
        )
      );
      try {
        mockResponse = JSON.parse(
          fs.readFileSync(
            path.resolve(
              __dirname,
              `./AgentApi/findAgentByTypeAndId/${agentType}/${agentId}.json`
            ),
            'utf8'
          )
        );
        if (typeof expect !== 'undefined')
          expect(mockResponse.result[0]._id).toBe(agentId);
      } catch (error) {
        // ignore errors
      }
      return [mockStatus, mockResponse];
    });
}

export function mockGetAgentByTypeAndId(mock: MockAdapter) {
  mock
    .onGet(
      /\/json\/realms\/root\/realms\/alpha\/realm-config\/agents\/[a-zA-Z0-9/_-]+$/
    )
    .reply(function (config) {
      const elements = config.url ? config.url.split('/') : [];
      const agentType = elements[elements?.length - 2];
      const agentId = elements[elements?.length - 1];
      const mockStatus = 200;
      const mockResponse = JSON.parse(
        fs.readFileSync(
          path.resolve(
            __dirname,
            `./AgentApi/getAgentByTypeAndId/${agentType}/${agentId}.json`
          ),
          'utf8'
        )
      );
      if (typeof expect !== 'undefined') expect(mockResponse._id).toBe(agentId);
      return [mockStatus, mockResponse];
    });
}

export function mockPutAgentByTypeAndId(
  mock: MockAdapter,
  callback: (mockAgentType: string, mockAgentId: string, mockAgentObj) => void
) {
  mock
    .onPut(/\/json\/realms\/root\/realms\/alpha\/realm-config\/agents\/.+/)
    .reply(function (config) {
      const elements = config.url ? config.url.split('/') : [];
      const agentType = elements[elements?.length - 2];
      const agentId = elements[elements?.length - 1];
      const mockStatus = 200;
      const mockAgentObj = JSON.parse(config.data);
      callback(agentType, agentId, mockAgentObj);
      return [mockStatus, mockAgentObj];
    });
}

export function mockDeleteAgentByTypeAndId(
  mock: MockAdapter,
  callback: (mockAgentType: string, mockAgentId: string, mockAgentObj) => void
) {
  mock
    .onDelete(/\/json\/realms\/root\/realms\/alpha\/realm-config\/agents\/.+/)
    .reply(function (config) {
      const elements = config.url ? config.url.split('/') : [];
      const agentType = elements[elements?.length - 2];
      const agentId = elements[elements?.length - 1];
      const mockStatus = 200;
      const mockAgentObj = getAgent(agentType, agentId);
      callback(agentType, agentId, mockAgentObj);
      return [mockStatus, mockAgentObj];
    });
}

/****
 **
 ** IDM Mocks and Utils
 **
 **/

export function mockGetAllConfigEntities(mock: MockAdapter) {
  mock.onGet(/.*?\/openidm\/config$/).reply(function () {
    const mockStatus = 200;
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          `./IdmConfigApi/getAllConfigEntities/entities.json`
        ),
        'utf8'
      )
    );
    return [mockStatus, mockResponse];
  });
}

export function mockGetConfigEntity(
  mock: MockAdapter,
  variation: string = null
) {
  mock.onGet(/.*?\/openidm\/config\/.+/).reply(function (config) {
    const entityId = config.url
      ? config.url.substring(config.url.indexOf('/config/') + 8)
      : '';
    const mockStatus = 200;
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          `./IdmConfigApi/getConfigEntity/${
            variation ? entityId + '-' + variation : entityId
          }.json`
        ),
        'utf8'
      )
    );
    if (typeof expect !== 'undefined') expect(mockResponse._id).toBe(entityId);
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

export function mockGetConfigEntitiesByType(mock: MockAdapter) {
  mock
    .onGet(/.*?\/openidm\/config\?_queryFilter=_id%20sw%20'.+?'/)
    .reply(function (config) {
      console.log('config.url=' + config.url);
      const entityType = config.url
        ? config.url.match(
            /.*?\/openidm\/config\?_queryFilter=_id%20sw%20'(.+?)'/
          )[1]
        : '';
      const mockStatus = 200;
      console.log('entityType=' + entityType);
      const mockResponse = JSON.parse(
        fs.readFileSync(
          path.resolve(
            __dirname,
            `./IdmConfigApi/getConfigEntitiesByType/${entityType}.json`
          ),
          'utf8'
        )
      );
      return [mockStatus, mockResponse];
    });
}

/****
 **
 ** Mock Helpers & Utils
 **
 **/

export function mockAll(mock: MockAdapter) {
  mockGetServerInfo(mock);
  mockGetServerVersionInfo(mock);
  mockStep(mock);
  mockAuthorize(mock);
  mockAccessToken(mock);
  mockGetTrees(mock);
}
