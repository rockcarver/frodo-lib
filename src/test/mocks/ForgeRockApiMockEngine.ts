import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { encode } from '../../api/utils/Base64';
import { parseUrl } from '../../api/utils/ApiUtils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

export function getSocialIdentityProviders() {
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

export function mockGetSocialIdentityProviders(mock: MockAdapter) {
  mock
    .onPost(
      /.*?\/json\/realms\/root\/realms\/alpha\/realm-config\/services\/SocialIdentityProviders\?_action=nextdescendents/
    )
    .reply(function () {
      const mockStatus = 200;
      const mockResponse = getSocialIdentityProviders();
      expect(mockResponse).toBeTruthy();
      return [mockStatus, mockResponse];
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
