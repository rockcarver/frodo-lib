import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import MockAdapter from 'axios-mock-adapter';

import { SingleTreeExportInterface } from '../../ops/JourneyOps';
import { getTypedFilename } from '../../utils/ExportImportUtils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function parseQueryString(query: string) {
  const vars = query.split('&');
  const searchParam = {};
  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');
    searchParam[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
  }
  return searchParam;
}

export function readJsonFile(file: string) {
  const json = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `${file}`), 'utf8')
  );
  return json;
}

/****
 **
 ** AM Mocks and Mock Data
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
 * Tree Mock Data
 */

export function getJourney(journeyId: string): SingleTreeExportInterface {
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
 * SAML Mock Data
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

export function getSaml2ProvidersImportData(
  file = 'allAlphaProviders.saml.json'
) {
  const importData = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, `./Saml2Ops/importSaml2Providers/${file}`),
      'utf8'
    )
  );
  return importData;
}

/**
 * CirclesOfTrust Mock Data
 */
export function getCircleOfTrustImportData(cotId: string) {
  const importData = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        `./CirclesOfTrustOps/importCircleOfTrust/${getTypedFilename(
          cotId,
          'cot.saml',
          'json'
        )}`
      ),
      'utf8'
    )
  );
  return importData;
}

export function getCirclesOfTrustImportData() {
  const importData = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        `./CirclesOfTrustOps/importCirclesOfTrust/allAlphaCirclesOfTrust.cot.saml.json`
      ),
      'utf8'
    )
  );
  return importData;
}

export function getCircleOfTrustRawData(cotId: string) {
  const importData = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        `./CirclesOfTrustOps/raw/${getTypedFilename(cotId, 'cot', 'json')}`
      ),
      'utf8'
    )
  );
  return importData;
}

/**
 * Agent Mock Data
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
