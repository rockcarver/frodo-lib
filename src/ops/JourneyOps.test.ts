import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Journey, state } from '../index';
import * as global from '../storage/StaticStorage';
import {
  getTree,
  getTrees,
  mockGetTrees,
  mockGetTree,
  mockGetNode,
} from '../test/mocks/ForgeRockApiMockEngine';

const mock = new MockAdapter(axios);

state.default.session.setTenant('');
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

  test('exportJourney() 1: Export single journey w/o dependencies', async () => {
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

  test.skip('exportJourney() 2: Export single journey w/ dependencies', async () => {
    mockGetTree(mock);
    mockGetNode(mock);
    const treeId = 'FrodoTest';
    const treeObject = getTree(treeId);
    expect.assertions(22);
    const journeyExport = await Journey.exportJourney('FrodoTest', {
      useStringArrays: false,
      deps: true,
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
});
