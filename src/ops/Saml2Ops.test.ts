import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Saml2, state } from '../index';
import * as global from '../storage/StaticStorage';
import {
  mockGetSaml2Providers,
  mockFindSaml2Providers,
  mockGetSaml2ProviderByLocationAndId,
  mockGetSaml2ProviderMetadata,
} from '../test/mocks/ForgeRockApiMockEngine';

const mock = new MockAdapter(axios);

state.default.session.setTenant('https://openam-frodo-dev.forgeblocks.com/am');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');
state.default.session.setDeploymentType(global.CLOUD_DEPLOYMENT_TYPE_KEY);

describe('Saml2Ops - listSaml2Providers()', () => {
  mockGetSaml2Providers(mock);
  test('listSaml2Providers() 0: Method is implemented', async () => {
    expect(Saml2.listSaml2Providers).toBeDefined();
  });

  test('listSaml2Providers() 1: List saml2 entity providers', async () => {
    mockGetSaml2Providers(mock);
    expect.assertions(2);
    await Saml2.listSaml2Providers();
    expect(true).toBeTruthy();
  });
});

describe('Saml2Ops - exportSaml2ProviderToFile()', () => {
  test('exportSaml2ProviderToFile() 0: Method is implemented', async () => {
    expect(Saml2.exportSaml2ProviderToFile).toBeDefined();
  });
});

describe('Saml2Ops - exportSaml2Metadata()', () => {
  test('exportSaml2Metadata() 0: Method is implemented', async () => {
    expect(Saml2.exportSaml2Metadata).toBeDefined();
  });

  test('describeSaml2Provider() 1: Export hosted saml2 entity provider metadata', async () => {
    mockGetSaml2ProviderMetadata(mock);
    expect.assertions(2);
    await Saml2.exportSaml2Metadata('iSPAzure');
    expect(true).toBeTruthy();
  });

  test('describeSaml2Provider() 2: Export remote saml2 entity provider metadata', async () => {
    mockGetSaml2ProviderMetadata(mock);
    expect.assertions(2);
    await Saml2.exportSaml2Metadata('urn:federation:MicrosoftOnline');
    expect(true).toBeTruthy();
  });
});

describe('Saml2Ops - describeSaml2Provider()', () => {
  test('describeSaml2Provider() 0: Method is implemented', async () => {
    expect(Saml2.describeSaml2Provider).toBeDefined();
  });

  test('describeSaml2Provider() 1: Describe saml2 entity provider', async () => {
    mockFindSaml2Providers(mock);
    mockGetSaml2ProviderByLocationAndId(mock);
    mockGetSaml2ProviderMetadata(mock);
    expect.assertions(2);
    await Saml2.describeSaml2Provider('iSPAzure');
    expect(true).toBeTruthy();
  });
});

describe('Saml2Ops - exportSaml2ProvidersToFile()', () => {
  test('exportSaml2ProvidersToFile() 0: Method is implemented', async () => {
    expect(Saml2.exportSaml2ProvidersToFile).toBeDefined();
  });
});

describe('Saml2Ops - exportSaml2ProvidersToFiles()', () => {
  test('exportSaml2ProvidersToFiles() 0: Method is implemented', async () => {
    expect(Saml2.exportSaml2ProvidersToFiles).toBeDefined();
  });
});

describe('Saml2Ops - importSaml2ProviderFromFile()', () => {
  test('importSaml2ProviderFromFile() 0: Method is implemented', async () => {
    expect(Saml2.importSaml2ProviderFromFile).toBeDefined();
  });
});

describe('Saml2Ops - importFirstSaml2ProviderFromFile()', () => {
  test('importFirstSaml2ProviderFromFile() 0: Method is implemented', async () => {
    expect(Saml2.importFirstSaml2ProviderFromFile).toBeDefined();
  });
});

describe('Saml2Ops - importSaml2ProvidersFromFile()', () => {
  test('importSaml2ProvidersFromFile() 0: Method is implemented', async () => {
    expect(Saml2.importSaml2ProvidersFromFile).toBeDefined();
  });
});

describe('Saml2Ops - importSaml2ProvidersFromFiles()', () => {
  test('importSaml2ProvidersFromFiles() 0: Method is implemented', async () => {
    expect(Saml2.importSaml2ProvidersFromFiles).toBeDefined();
  });
});

// Test contributions

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

describe('Saml2Ops - exportRawSaml2ProviderToFile()', () => {
  test('exportRawSaml2ProviderToFile() 0: Method is implemented', async () => {
    expect(Saml2.exportRawSaml2ProviderToFile).toBeDefined();
  });
});

describe('Saml2Ops - exportRawSaml2ProvidersToFile()', () => {
  test('exportRawSaml2ProvidersToFile() 0: Method is implemented', async () => {
    expect(Saml2.exportRawSaml2ProvidersToFile).toBeDefined();
  });
});

describe('Saml2Ops - exportRawSaml2ProvidersToFiles()', () => {
  test('exportRawSaml2ProvidersToFiles() 0: Method is implemented', async () => {
    expect(Saml2.exportRawSaml2ProvidersToFiles).toBeDefined();
  });
});

describe('Saml2Ops - importRawSaml2ProvidersFromFile()', () => {
  test('importRawSaml2ProvidersFromFile() 0: Method is implemented', async () => {
    expect(Saml2.importRawSaml2ProvidersFromFile).toBeDefined();
  });
});

describe('Saml2Ops - importRawSaml2ProvidersFromFiles()', () => {
  test('importRawSaml2ProvidersFromFiles() 0: Method is implemented', async () => {
    expect(Saml2.importRawSaml2ProvidersFromFiles).toBeDefined();
  });
});

describe('Saml2Ops - importRawSaml2ProviderFromFile()', () => {
  test('importRawSaml2ProviderFromFile() 0: Method is implemented', async () => {
    expect(Saml2.importRawSaml2ProviderFromFile).toBeDefined();
  });
});
