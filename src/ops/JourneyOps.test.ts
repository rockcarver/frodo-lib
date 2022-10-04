import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Journey, state } from '../index';
import * as global from '../storage/StaticStorage';
import { isEqualJson } from './utils/OpsUtils';
import {
  mockFindSaml2Providers,
  mockPutSocialProviderByTypeAndId,
  mockCreateSaml2Provider,
  mockUpdateSaml2Provider,
  mockCreateCircleOfTrust,
  mockUpdateCircleOfTrust,
  mockPutScript,
  mockPutConfigEntity,
  mockGetSocialProviders,
  mockGetSaml2ProviderMetadata,
  mockGetSaml2ProviderByLocationAndId,
  mockGetSaml2Providers,
  mockGetCirclesOfTrust,
  mockGetConfigEntity,
  mockGetScript,
  getTree,
  mockGetTrees,
  mockGetTree,
  mockGetNode,
  mockPutTree,
  mockPutNode,
  readJsonFile,
} from '../test/mocks/ForgeRockApiMockEngine';

const mock = new MockAdapter(axios);

state.default.session.setTenant('https://openam-frodo-dev.forgeblocks.com/am');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');
state.default.session.setDeploymentType(global.CLOUD_DEPLOYMENT_TYPE_KEY);

describe('JourneyOps - getJourneys()', () => {
  test('getJourneys() 0: Method is implemented', async () => {
    expect(Journey.getJourneys).toBeDefined();
  });

  test('getJourneys() 1: Get all journeys', async () => {
    mockGetTrees(mock);
    const journeys = await Journey.getJourneys();
    expect(journeys).toBeTruthy();
    expect(journeys.length).toBe(92);
  });
});

describe('JourneyOps - exportJourney()', () => {
  test('exportJourney() 0: Method is implemented', async () => {
    expect(Journey.exportJourney).toBeDefined();
  });

  test('exportJourney() 1: Export journey w/o dependencies', async () => {
    mockGetTree(mock);
    mockGetNode(mock);
    const treeId = 'FrodoTest';
    const treeObject = getTree(treeId);
    expect.assertions(24);
    const journeyExport = await Journey.exportJourney(treeId, {
      useStringArrays: false,
      deps: false,
      verbose: false,
    });
    expect(journeyExport).toBeTruthy();
    expect(journeyExport.tree['_id']).toBe(treeId);
    expect(journeyExport.tree).toStrictEqual(treeObject);
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

  test('exportJourney() 2: Export journey w/ dependencies', async () => {
    mockGetTree(mock);
    mockGetNode(mock);
    mockGetConfigEntity(mock);
    mockGetScript(mock);
    mockGetSaml2Providers(mock);
    mockGetCirclesOfTrust(mock);
    mockGetSaml2ProviderByLocationAndId(mock);
    mockGetSaml2ProviderMetadata(mock);
    mockGetSocialProviders(mock);
    const treeId = 'FrodoTest';
    const treeObject = getTree(treeId);
    expect.assertions(42);
    const journeyExport = await Journey.exportJourney('FrodoTest', {
      useStringArrays: false,
      deps: true,
      verbose: false,
    });
    // console.dir(journeyExport);
    expect(journeyExport).toBeTruthy();
    expect(journeyExport.tree['_id']).toBe(treeId);
    expect(journeyExport.tree).toStrictEqual(treeObject);
    expect(Object.keys(journeyExport.nodes as object).length).toBe(7);
    expect(Object.keys(journeyExport.innerNodes as object).length).toBe(5);
    expect(Object.keys(journeyExport.circlesOfTrust as object).length).toBe(1);
    expect(Object.keys(journeyExport.emailTemplates as object).length).toBe(1);
    expect(Object.keys(journeyExport.saml2Entities as object).length).toBe(2);
    expect(Object.keys(journeyExport.scripts as object).length).toBe(9);
    expect(
      Object.keys(journeyExport.socialIdentityProviders as object).length
    ).toBe(8);
    expect(journeyExport.themes?.length).toBe(1);
  });
});

describe('JourneyOps - importJourney()', () => {
  test('importJourney() 0: Method is implemented', async () => {
    expect(Journey.importJourney).toBeDefined();
  });

  test('importJourney() 1: Import journey w/o dependencies', async () => {
    const treeId = 'FrodoTest';
    const treeObject = getTree(treeId);
    mockPutTree(mock, (mockTreeId, mockTreeObj) => {
      expect(mockTreeId).toEqual(treeId);
      expect(isEqualJson(mockTreeObj, treeObject, ['_rev'])).toBeTruthy();
    });
    let nodeIds = [
      // nodes
      '278bf084-9eea-46fe-8ce9-2600dde3b046',
      '64157fca-bd5b-4405-a4c8-64ffd98a5461',
      '731c5810-020b-45c8-a7fc-3c21903ae2b3',
      'bf153f37-83dd-4f39-aa0c-74135430242e',
      'd5cc2d52-6ce4-452d-85ea-3a5b50218b67',
      'e2c39477-847a-4df2-9c5d-b449a752638b',
      'fc7e47cd-c679-4211-8e05-a36654f23c67',
      // inner nodes
      '7a351800-fb7e-4145-903c-388554747556',
      '804e6a68-1720-442b-926a-007e90f02782',
      '228a44d5-fd78-4278-8999-fdd470ea7ebf',
      'dd16c8d4-baca-4ae0-bcd8-fb98b9040524',
      '038f9b2a-36b2-489b-9e03-386c9a62ea21',
    ];
    mockPutNode(mock, (mockNodeId, mockNodeObj) => {
      expect(nodeIds).toContain(mockNodeId);
      nodeIds = nodeIds.filter((nodeId) => nodeId !== mockNodeId);
    });
    expect.assertions(15);
    const journeyExport = readJsonFile(
      './JourneyOps/importJourney/FrodoTest.journey.json'
    );
    await Journey.importJourney(journeyExport, {
      reUuid: false,
      deps: false,
      verbose: false,
    });
    expect(nodeIds.length).toBe(0);
  });

  test('importJourney() 2: Import journey w/ dependencies', async () => {
    const treeId = 'FrodoTest';
    // mock TreeApi
    const treeObject = getTree(treeId);
    mockPutTree(mock, (mockTreeId, mockTreeObj) => {
      // console.log('mockPutTree: ' + mockTreeId);
      expect(mockTreeId).toEqual(treeId);
      expect(isEqualJson(mockTreeObj, treeObject, ['_rev'])).toBeTruthy();
    });
    // mock NodeApi
    let nodeIds = [
      // nodes
      '278bf084-9eea-46fe-8ce9-2600dde3b046',
      '64157fca-bd5b-4405-a4c8-64ffd98a5461',
      '731c5810-020b-45c8-a7fc-3c21903ae2b3',
      'bf153f37-83dd-4f39-aa0c-74135430242e',
      'd5cc2d52-6ce4-452d-85ea-3a5b50218b67',
      'e2c39477-847a-4df2-9c5d-b449a752638b',
      'fc7e47cd-c679-4211-8e05-a36654f23c67',
      // inner nodes
      '7a351800-fb7e-4145-903c-388554747556',
      '804e6a68-1720-442b-926a-007e90f02782',
      '228a44d5-fd78-4278-8999-fdd470ea7ebf',
      'dd16c8d4-baca-4ae0-bcd8-fb98b9040524',
      '038f9b2a-36b2-489b-9e03-386c9a62ea21',
    ];
    mockPutNode(mock, (mockNodeId, mockNodeObj) => {
      // console.log('mockPutNode: ' + mockNodeId);
      expect(nodeIds).toContain(mockNodeId);
      nodeIds = nodeIds.filter((nodeId) => nodeId !== mockNodeId);
    });
    // mock EmailTemplateApi
    let entityIds = ['emailTemplate/welcome', 'ui/themerealm'];
    mockPutConfigEntity(mock, (mockEntityId, mockEntityObj) => {
      // console.log('mockPutConfigEntity: ' + mockEntityId);
      expect(entityIds).toContain(mockEntityId);
      entityIds = entityIds.filter((entityId) => entityId !== mockEntityId);
    });
    // mock ScriptApi
    let scriptIds = [
      '58c824ae-84ed-4724-82cd-db128fc3f6c',
      '739bdc48-fd24-4c52-b353-88706d75558a',
      '58d29080-4563-480b-89bb-1e7719776a21',
      '23143919-6b78-40c3-b25e-beca19b229e0',
      'bae1d54a-e97d-4997-aa5d-c027f21af82c',
      '484e6246-dbc6-4288-97e6-54e55431402e',
      '6325cf19-a49b-471e-8d26-7e4df76df0e2',
      'dbe0bf9a-72aa-49d5-8483-9db147985a47',
      '73cecbfc-dad0-4395-be6a-6858ee3a80e5',
    ];
    mockPutScript(mock, (mockScriptId, mockScriptObj) => {
      // console.log('mockPutScript: ' + mockScriptId);
      expect(scriptIds).toContain(mockScriptId);
      scriptIds = scriptIds.filter((scriptId) => scriptId !== mockScriptId);
    });
    // mock CircleOfTrustApi
    let cotIds = ['AzureCOT'];
    mockCreateCircleOfTrust(mock, (mockCotId, mockCotObj) => {
      // console.log('mockCreateCirclesOfTrust: ' + mockCotId);
      expect(cotIds).toContain(mockCotId);
      cotIds = cotIds.filter((cotId) => cotId !== mockCotId);
    });
    mockUpdateCircleOfTrust(mock, (mockCotId, mockCotObj) => {
      // console.log('mockUpdateCirclesOfTrust: ' + mockCotId);
      expect(cotIds).toContain(mockCotId);
      cotIds = cotIds.filter((cotId) => cotId !== mockCotId);
    });
    // mock Saml2Api
    mockFindSaml2Providers(mock);
    let saml2ProviderIds64 = [
      'aVNQQXp1cmU',
      'dXJuOmZlZGVyYXRpb246TWljcm9zb2Z0T25saW5l',
    ];
    mockCreateSaml2Provider(
      mock,
      (
        mockSaml2ProviderId64,
        mockSaml2ProviderLocation,
        mockSaml2ProviderObj
      ) => {
        // console.log('mockCreateSaml2Provider: ' + mockSaml2ProviderId64);
        expect(saml2ProviderIds64).toContain(mockSaml2ProviderId64);
        saml2ProviderIds64 = saml2ProviderIds64.filter(
          (saml2ProviderId) => saml2ProviderId !== mockSaml2ProviderId64
        );
      }
    );
    mockUpdateSaml2Provider(
      mock,
      (
        mockSaml2ProviderId64,
        mockSaml2ProviderLocation,
        mockSaml2ProviderObj
      ) => {
        // console.log('mockUpdateSaml2Provider: ' + mockSaml2ProviderId64);
        expect(saml2ProviderIds64).toContain(mockSaml2ProviderId64);
        saml2ProviderIds64 = saml2ProviderIds64.filter(
          (saml2ProviderId) => saml2ProviderId !== mockSaml2ProviderId64
        );
      }
    );
    // mock SocialIdentityProviderApi
    let socialProviderIds = [
      'google',
      'github',
      'facebook',
      'apple-stoyan',
      'apple_web',
      'okta-trial-5735851',
      'adfs',
      'azure',
    ];
    mockPutSocialProviderByTypeAndId(
      mock,
      (mockSocialProviderId, mockSocialProviderType, mockSocialProviderObj) => {
        // console.log(
        //   'mockPutSocialProviderByTypeAndId: ' + mockSocialProviderId
        // );
        expect(socialProviderIds).toContain(mockSocialProviderId);
        socialProviderIds = socialProviderIds.filter(
          (socialProviderId) => socialProviderId !== mockSocialProviderId
        );
      }
    );
    expect.assertions(45);
    const journeyExport = readJsonFile(
      './JourneyOps/importJourney/FrodoTest.journey.json'
    );
    await Journey.importJourney(journeyExport, {
      reUuid: false,
      deps: true,
      verbose: false,
    });
    expect(nodeIds.length).toBe(0);
    expect(entityIds.length).toBe(0);
    expect(scriptIds.length).toBe(0);
    expect(cotIds.length).toBe(0);
    expect(saml2ProviderIds64.length).toBe(0);
    expect(socialProviderIds.length).toBe(0);
  });
});

describe('JourneyOps - enableJourney()', () => {
  test('enableJourney() 0: Method is implemented', async () => {
    expect(Journey.enableJourney).toBeDefined();
  });

  test('enableJourney() 1: Enable a disabled journey', async () => {
    const treeId = 'Disabled';
    mockGetTree(mock);
    mockPutTree(mock, (mockTreeId, mockTreeObj) => {
      expect(mockTreeId).toEqual(treeId);
      expect(mockTreeObj['_rev']).toBeFalsy();
      expect(mockTreeObj['enabled']).toBeTruthy();
    });
    expect.assertions(5);
    const result = await Journey.enableJourney(treeId);
    expect(result).toBeTruthy();
  });

  test('enableJourney() 2: Enable an already enabled journey', async () => {
    const treeId = 'FrodoTest';
    mockGetTree(mock);
    mockPutTree(mock, (mockTreeId, mockTreeObj) => {
      expect(mockTreeId).toEqual(treeId);
      expect(mockTreeObj['_rev']).toBeFalsy();
      expect(mockTreeObj['enabled']).toBeTruthy();
    });
    expect.assertions(5);
    const result = await Journey.enableJourney(treeId);
    expect(result).toBeTruthy();
  });
});

describe('JourneyOps - disableJourney()', () => {
  test('disableJourney() 0: Method is implemented', async () => {
    expect(Journey.disableJourney).toBeDefined();
  });

  test('disableJourney() 1: Disable an enabled journey', async () => {
    const treeId = 'FrodoTest';
    mockGetTree(mock);
    mockPutTree(mock, (mockTreeId, mockTreeObj) => {
      expect(mockTreeId).toEqual(treeId);
      expect(mockTreeObj['_rev']).toBeFalsy();
      expect(mockTreeObj['enabled']).toBeFalsy();
    });
    expect.assertions(5);
    const result = await Journey.disableJourney(treeId);
    expect(result).toBeTruthy();
  });

  test('disableJourney() 2: Disable an already disabled journey', async () => {
    const treeId = 'Disabled';
    mockGetTree(mock);
    mockPutTree(mock, (mockTreeId, mockTreeObj) => {
      expect(mockTreeId).toEqual(treeId);
      expect(mockTreeObj['_rev']).toBeFalsy();
      expect(mockTreeObj['enabled']).toBeFalsy();
    });
    expect.assertions(5);
    const result = await Journey.disableJourney(treeId);
    expect(result).toBeTruthy();
  });
});
