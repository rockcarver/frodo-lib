import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import path from 'path';
import { parseQueryString } from '../../api/utils/ApiUtils';
import { fileURLToPath } from 'url';
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

export function getTree(treeId: string) {
  const treeObject = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, `./TreeApi/getTree/${treeId}.json`),
      'utf8'
    )
  );
  return treeObject;
}

export function getJourney(journeyId: string) {
  const treeObject = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        `./JourneyOps/importJourney/${journeyId}.journey.json`
      ),
      'utf8'
    )
  );
  return treeObject;
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

/**
 * Agent test utils
 */

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

/**
 * IDM Mock Data
 */

export function getConfigEntity(entityId: string, variant = '') {
  const configEntity = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        `./IdmConfigApi/getConfigEntity/${entityId}${
          variant ? '-' + variant : ''
        }.json`
      ),
      'utf8'
    )
  );
  return configEntity;
}
