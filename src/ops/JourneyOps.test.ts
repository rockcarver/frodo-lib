import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Journey, state } from '../index';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as global from '../storage/StaticStorage';
import {
  mockGetTree,
  mockGetNode,
} from '../../test/mocks/ForgeRockApiMockEngine';

const mock = new MockAdapter(axios);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// function mockGetTree(mock: MockAdapter) {
//   mock
//     .onGet(
//       /\/json\/realms\/root\/realms\/alpha\/realm-config\/authentication\/authenticationtrees\/trees\/.+/
//     )
//     .reply(function (config) {
//       const elements = config.url ? config.url.split('/') : [];
//       const treeId = elements[elements?.length - 1];
//       const mockStatus = 200;
//       const mockResponse = JSON.parse(
//         fs.readFileSync(
//           path.resolve(
//             __dirname,
//             `../../test/mocks/TreeApi/getTree/${treeId}.json`
//           ),
//           'utf8'
//         )
//       );
//       expect(mockResponse._id).toBe(treeId);
//       return [mockStatus, mockResponse];
//     });
// }

// function mockGetNode(mock: MockAdapter) {
//   mock
//     .onGet(
//       /\/json\/realms\/root\/realms\/alpha\/realm-config\/authentication\/authenticationtrees\/nodes\/.+/
//     )
//     .reply(function (config) {
//       const elements = config.url ? config.url.split('/') : [];
//       const nodeType = elements[elements?.length - 2];
//       const nodeId = elements[elements?.length - 1];
//       const mockStatus = 200;
//       const mockResponse = JSON.parse(
//         fs.readFileSync(
//           path.resolve(
//             __dirname,
//             `../../test/mocks/NodeApi/getNode/${nodeType}/${nodeId}.json`
//           ),
//           'utf8'
//         )
//       );
//       expect(mockResponse._id).toBe(nodeId);
//       return [mockStatus, mockResponse];
//     });
// }

state.default.session.setTenant('');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');
state.default.session.setDeploymentType(global.CLOUD_DEPLOYMENT_TYPE_KEY);

const journeyId = 'FrodoTest';
const journeyObject = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      `../../test/mocks/TreeApi/getTree/${journeyId}.json`
    ),
    'utf8'
  )
);

describe('JourneyOps - getJourneys()', () => {
  test('getJourneys() 0: Method is implemented', async () => {
    expect(Journey.getJourneys).toBeDefined();
  });

  test('getJourneys() 1: Get all journeys', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../../test/mocks/TreeApi/getTrees/trees.json'),
        'utf8'
      )
    );
    mock
      .onGet(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/trees?_queryFilter=true'
      )
      .reply(200, mockResponse);
    const journeys = await Journey.getJourneys();
    expect(journeys).toBeTruthy();
    expect(journeys.length).toBe(92);
  });
});

describe('JourneyOps - exportJourney()', () => {
  test('exportJourney() 0: Method is implemented', async () => {
    expect(Journey.exportJourney).toBeDefined();
  });

  test('exportJourney() 1: Export single journey w/o dependencies', async () => {
    mockGetTree(mock);
    mockGetNode(mock);
    expect.assertions(24);
    const journeyExport = await Journey.exportJourney(journeyId, {
      useStringArrays: false,
      deps: false,
      verbose: false,
    });
    expect(journeyExport).toBeTruthy();
    expect(journeyExport.tree['_id']).toBe(journeyId);
    expect(journeyExport.tree).toStrictEqual(journeyObject);
    expect(Object.keys(journeyExport.nodes as object).length).toBe(7);
    expect(Object.keys(journeyExport.innerNodes as object).length).toBe(5);
    expect(Object.keys(journeyExport.circlesOfTrust as object).length).toBe(0);
    expect(Object.keys(journeyExport.emailTemplates as object).length).toBe(0);
    expect(Object.keys(journeyExport.saml2Entities as object).length).toBe(0);
    expect(Object.keys(journeyExport.scripts as object).length).toBe(0);
    expect(
      Object.keys(journeyExport.socialIdentityProviders as object).length
    ).toBe(0);
    expect(journeyExport.themes?.length).toBe(0);
  });

  test.skip('exportJourney() 2: Export single journey w/ dependencies', async () => {
    const mockGetTreeResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/TreeApi/getTree/FrodoTest.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/trees/FrodoTest'
      )
      .reply(200, mockGetTreeResponse);
    const mockGetThemesResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/IdmConfigApi/getConfigEntity/themes.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet('/openidm/config/ui/themerealm')
      .reply(200, mockGetThemesResponse);

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
              `../../test/mocks/NodeApi/getNode/${nodeType}/${nodeId}.json`
            ),
            'utf8'
          )
        );
        expect(mockResponse._id).toBe(nodeId);
        return [mockStatus, mockResponse];
      });
    expect.assertions(22);
    const journeyExport = await Journey.exportJourney('FrodoTest', {
      useStringArrays: false,
      deps: false,
      verbose: false,
    });
    expect(journeyExport).toBeTruthy();
    expect(journeyExport.tree['_id']).toBe('FrodoTest');
    expect(Object.keys(journeyExport.nodes as object).length).toBe(7);
    expect(Object.keys(journeyExport.innerNodes as object).length).toBe(5);
    expect(Object.keys(journeyExport.circlesOfTrust as object).length).toBe(0);
    expect(Object.keys(journeyExport.emailTemplates as object).length).toBe(0);
    expect(Object.keys(journeyExport.saml2Entities as object).length).toBe(0);
    expect(Object.keys(journeyExport.scripts as object).length).toBe(0);
    expect(
      Object.keys(journeyExport.socialIdentityProviders as object).length
    ).toBe(0);
    expect(journeyExport.themes?.length).toBe(0);
  });
});
