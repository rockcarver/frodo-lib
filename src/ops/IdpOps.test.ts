import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Idp, state } from '../index';
import * as global from '../storage/StaticStorage';
import { mockGetSocialProviders } from '../test/mocks/ForgeRockApiMockEngine';

const mock = new MockAdapter(axios);

state.setHost('https://openam-frodo-dev.forgeblocks.com/am');
state.setRealm('alpha');
state.setCookieName('cookieName');
state.setCookieValue('cookieValue');
state.setDeploymentType(global.CLOUD_DEPLOYMENT_TYPE_KEY);

describe('IdpOps - exportSocialProviderToFile()', () => {
  test('exportSocialProviderToFile() 0: Method is implemented', async () => {
    expect(Idp.exportSocialProviderToFile).toBeDefined();
  });
});

describe('IdpOps - exportSocialProvidersToFile()', () => {
  test('exportSocialProvidersToFile() 0: Method is implemented', async () => {
    expect(Idp.exportSocialProvidersToFile).toBeDefined();
  });
});

describe('IdpOps - exportSocialProvidersToFiles()', () => {
  test('exportSocialProvidersToFiles() 0: Method is implemented', async () => {
    expect(Idp.exportSocialProvidersToFiles).toBeDefined();
  });
});

describe('IdpOps - getSocialProvider()', () => {
  test('getSocialProvider() 0: Method is implemented', async () => {
    expect(Idp.getSocialProvider).toBeDefined();
  });
});

describe('IdpOps - importFirstSocialProviderFromFile()', () => {
  test('importFirstSocialProviderFromFile() 0: Method is implemented', async () => {
    expect(Idp.importFirstSocialProviderFromFile).toBeDefined();
  });
});

describe('IdpOps - importSocialProviderFromFile()', () => {
  test('importSocialProviderFromFile() 0: Method is implemented', async () => {
    expect(Idp.importSocialProviderFromFile).toBeDefined();
  });
});

describe('IdpOps - importSocialProvidersFromFile()', () => {
  test('importSocialProvidersFromFile() 0: Method is implemented', async () => {
    expect(Idp.importSocialProvidersFromFile).toBeDefined();
  });
});

describe('IdpOps - importSocialProvidersFromFiles()', () => {
  test('importSocialProvidersFromFiles() 0: Method is implemented', async () => {
    expect(Idp.importSocialProvidersFromFiles).toBeDefined();
  });
});

describe('IdpOps - listSocialProviders()', () => {
  test('listSocialProviders() 0: Method is implemented', async () => {
    expect(Idp.listSocialProviders).toBeDefined();
  });

  test('listSocialProviders() 1: List social identity providers', async () => {
    mockGetSocialProviders(mock);
    expect.assertions(2);
    await Idp.listSocialProviders();
    expect(true).toBeTruthy();
  });
});
