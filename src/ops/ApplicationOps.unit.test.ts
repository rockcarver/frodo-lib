import { jest } from '@jest/globals';
import { encode } from '../utils/Base64Utils';
import type {
  ApplicationSkeleton,
  ApplicationSsoEntities,
} from './ApplicationOps';

/**
 * What an application points to is read from its record: `ssoEntities.oidcId` (the OAuth2 client),
 * `ssoEntities.idpPrivateId` and `ssoEntities.spPrivateId` (base64 SAML entity ids) and `connectorId`.
 * The dependency discovery reads these keys through the types (`applicationData.ssoEntities?.oidcId`), so `tsc`
 * fails when `ApplicationSsoEntities` lacks one of them. (Test files are neither compiled by `tsc` nor type checked
 * by jest, so the type is guarded by the source and not by the typed records below.)
 * These tests pin that the import and the export read exactly these keys, for a record of each template type.
 * Mocked unit test: no recordings.
 */

const importOAuth2Client = jest.fn(async (_args?: any): Promise<any> => ({}));
const exportOAuth2Client = jest.fn(async (_args?: any): Promise<any> => ({}));
jest.unstable_mockModule('./OAuth2ClientOps', () => ({
  deleteOAuth2Client: jest.fn(),
  exportOAuth2Client,
  getOAuth2ClientScriptReferences: jest.fn(() => []),
  importOAuth2Client,
  readOAuth2Client: jest.fn(),
}));

const importSaml2Provider = jest.fn(async (_args?: any): Promise<any> => ({}));
const exportSaml2Provider = jest.fn(async (_args?: any): Promise<any> => ({}));
jest.unstable_mockModule('./Saml2Ops', () => ({
  deleteSaml2Provider: jest.fn(),
  exportSaml2Provider,
  getSaml2ProviderScriptReferences: jest.fn(() => []),
  importSaml2Provider,
  readSaml2EntityIds: jest.fn(),
  readSaml2Provider: jest.fn(),
}));

const importCirclesOfTrust = jest.fn(async (_args?: any): Promise<any> => []);
const exportCirclesOfTrust = jest.fn(async (_args?: any): Promise<any> => ({}));
jest.unstable_mockModule('./CirclesOfTrustOps', () => ({
  exportCirclesOfTrust,
  importCirclesOfTrust,
  readCirclesOfTrust: jest.fn(),
  updateCircleOfTrust: jest.fn(),
}));

const importConnector = jest.fn(async (_args?: any): Promise<any> => ({}));
const exportConnector = jest.fn(async (_args?: any): Promise<any> => ({}));
jest.unstable_mockModule('./ConnectorOps', () => ({
  deleteConnector: jest.fn(),
  disableConnector: jest.fn(),
  enableConnector: jest.fn(),
  exportConnector,
  importConnector,
  isConnectorEnabled: jest.fn(),
  readConnector: jest.fn(),
  readConnectorEnabledStates: jest.fn(),
}));

const readManagedObject = jest.fn(async (_args?: any): Promise<any> => ({}));
const updateManagedObject = jest.fn(
  async (args?: any): Promise<any> => args.moData
);
jest.unstable_mockModule('./ManagedObjectOps', () => ({
  createManagedObject: jest.fn(),
  deleteManagedObject: jest.fn(),
  queryManagedObjects: jest.fn(),
  readManagedObject,
  readManagedObjects: jest.fn(),
  updateManagedObject,
}));

const { exportApplication, importApplications } =
  await import('./ApplicationOps');

/** A state that answers every getter with undefined, except for the ones below. */
function mockState() {
  const answers: Record<string, unknown> = {
    getRealm: '/alpha',
    getDeploymentType: 'cloud',
    getIsIGA: false,
    getUseRealmPrefixOnManagedObjects: false,
  };
  return new Proxy(
    {},
    {
      get: (_target, name: string) => () => answers[name],
    }
  ) as any;
}

const idpEntityId = 'https://idp.example.com/matrix';
const spEntityId = 'https://sp.example.com/matrix';

/** A record with every field of the skeleton filled in, except what the test overrides. */
function application(
  overrides: Partial<ApplicationSkeleton>
): ApplicationSkeleton {
  return {
    _id: 'app-1',
    authoritative: false,
    connectorId: undefined,
    description: '',
    icon: '',
    mappingNames: [],
    name: 'matrix-app',
    templateName: 'template',
    templateVersion: '1.0',
    uiConfig: {},
    url: '',
    ...overrides,
  };
}

const oidcSso: ApplicationSsoEntities = {
  oidcId: 'matrix-client',
  idpLoginUrl: 'https://login.example.com/matrix',
};

const samlSso: ApplicationSsoEntities = {
  domain: 'example.com',
  idpLocation: 'idp-location',
  idpLoginUrl: 'https://login.example.com/matrix',
  idpPrivateId: encode(idpEntityId, false),
  key: 'signing-key',
  spLocation: 'sp-location',
  spPrivateId: encode(spEntityId, false),
};

const wsfedSso: ApplicationSsoEntities = {
  domain: 'example.com',
  idpLoginUrl: 'https://login.example.com/matrix',
  pfApcId: 'apc-1',
  pfIdpAdapterId: 'adapter-1',
  pfPolicyId: 'policy-1',
  pfSigningCertId: 'cert-1',
  pfSpConnectionId: 'connection-1',
};

describe('importing the dependencies of an application', () => {
  const options = { deps: true };

  function importData(records: ApplicationSkeleton[]) {
    return {
      meta: {},
      managedApplication: Object.fromEntries(records.map((r) => [r._id, r])),
      connector: {},
    } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('an OIDC application imports the OAuth2 client named by ssoEntities.oidcId', async () => {
    await importApplications({
      importData: importData([application({ ssoEntities: oidcSso })]),
      options,
      state: mockState(),
    });
    expect(importOAuth2Client).toHaveBeenCalledTimes(1);
    expect(importOAuth2Client.mock.calls[0][0].clientId).toBe('matrix-client');
    expect(importSaml2Provider).not.toHaveBeenCalled();
    expect(importCirclesOfTrust).not.toHaveBeenCalled();
    expect(importConnector).not.toHaveBeenCalled();
  });

  test('a SAML application imports the providers named by the decoded idpPrivateId and spPrivateId', async () => {
    await importApplications({
      importData: importData([application({ ssoEntities: samlSso })]),
      options,
      state: mockState(),
    });
    expect(importSaml2Provider.mock.calls.map((c) => c[0].entityId)).toEqual([
      idpEntityId,
      spEntityId,
    ]);
    expect(importCirclesOfTrust).toHaveBeenCalledTimes(1);
    expect(importCirclesOfTrust.mock.calls[0][0].entityProviders).toEqual([
      idpEntityId,
      spEntityId,
    ]);
    expect(importOAuth2Client).not.toHaveBeenCalled();
    expect(importConnector).not.toHaveBeenCalled();
  });

  test('a WS-Fed application has no dependency that is imported', async () => {
    await importApplications({
      importData: importData([application({ ssoEntities: wsfedSso })]),
      options,
      state: mockState(),
    });
    expect(importOAuth2Client).not.toHaveBeenCalled();
    expect(importSaml2Provider).not.toHaveBeenCalled();
    expect(importCirclesOfTrust).not.toHaveBeenCalled();
    expect(importConnector).not.toHaveBeenCalled();
  });

  test('a provisioning application imports the connector named by connectorId', async () => {
    await importApplications({
      importData: importData([
        application({
          connectorId: 'matrix-ldap',
          mappingNames: ['systemMatrixAccount_managedAlpha_user'],
        }),
      ]),
      options,
      state: mockState(),
    });
    expect(importConnector).toHaveBeenCalledTimes(1);
    expect(importConnector.mock.calls[0][0].connectorId).toBe('matrix-ldap');
    expect(importOAuth2Client).not.toHaveBeenCalled();
    expect(importSaml2Provider).not.toHaveBeenCalled();
  });

  test('a bookmark application has no dependency, and no ssoEntities is no error', async () => {
    const result = await importApplications({
      importData: importData([application({})]),
      options,
      state: mockState(),
    });
    expect(result).toHaveLength(1);
    expect(importOAuth2Client).not.toHaveBeenCalled();
    expect(importSaml2Provider).not.toHaveBeenCalled();
    expect(importCirclesOfTrust).not.toHaveBeenCalled();
    expect(importConnector).not.toHaveBeenCalled();
  });

  test('without deps, no dependency is imported', async () => {
    await importApplications({
      importData: importData([application({ ssoEntities: samlSso })]),
      options: { deps: false },
      state: mockState(),
    });
    expect(importSaml2Provider).not.toHaveBeenCalled();
    expect(importCirclesOfTrust).not.toHaveBeenCalled();
  });

  test('the record is written without members, owners and roles that the import data does not carry', async () => {
    await importApplications({
      importData: importData([application({ ssoEntities: oidcSso })]),
      options,
      state: mockState(),
    });
    expect(updateManagedObject).toHaveBeenCalledTimes(1);
    const written = updateManagedObject.mock.calls[0][0];
    expect(written.type).toBe('alpha_application');
    expect(written.id).toBe('app-1');
    expect(written.moData).not.toHaveProperty('members');
    expect(written.moData).not.toHaveProperty('owners');
    expect(written.moData).not.toHaveProperty('roles');
    expect(written.moData.ssoEntities).toEqual(oidcSso);
  });
});

describe('exporting the dependencies of an application', () => {
  const options = { deps: true, useStringArrays: true };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('an OIDC application exports the OAuth2 client named by ssoEntities.oidcId', async () => {
    readManagedObject.mockResolvedValueOnce(
      application({ ssoEntities: oidcSso })
    );
    const exported = await exportApplication({
      applicationId: 'app-1',
      options,
      state: mockState(),
    });
    expect(exportOAuth2Client).toHaveBeenCalledTimes(1);
    expect(exportOAuth2Client.mock.calls[0][0].clientId).toBe('matrix-client');
    expect(exportSaml2Provider).not.toHaveBeenCalled();
    expect(exportConnector).not.toHaveBeenCalled();
    expect(Object.keys(exported.managedApplication)).toEqual(['app-1']);
  });

  test('a SAML application exports the providers named by the decoded idpPrivateId and spPrivateId', async () => {
    readManagedObject.mockResolvedValueOnce(
      application({ ssoEntities: samlSso })
    );
    await exportApplication({
      applicationId: 'app-1',
      options,
      state: mockState(),
    });
    expect(exportSaml2Provider.mock.calls.map((c) => c[0].entityId)).toEqual([
      idpEntityId,
      spEntityId,
    ]);
    expect(exportCirclesOfTrust.mock.calls[0][0].entityProviders).toEqual([
      idpEntityId,
      spEntityId,
    ]);
    expect(exportOAuth2Client).not.toHaveBeenCalled();
  });

  test('a provisioning application exports the connector named by connectorId', async () => {
    readManagedObject.mockResolvedValueOnce(
      application({ connectorId: 'matrix-ldap' })
    );
    await exportApplication({
      applicationId: 'app-1',
      options,
      state: mockState(),
    });
    expect(exportConnector).toHaveBeenCalledTimes(1);
    expect(exportConnector.mock.calls[0][0].connectorId).toBe('matrix-ldap');
    expect(exportOAuth2Client).not.toHaveBeenCalled();
    expect(exportSaml2Provider).not.toHaveBeenCalled();
  });

  test('a WS-Fed or bookmark application has no dependency that is exported', async () => {
    readManagedObject.mockResolvedValueOnce(
      application({ ssoEntities: wsfedSso })
    );
    await exportApplication({
      applicationId: 'app-1',
      options,
      state: mockState(),
    });
    readManagedObject.mockResolvedValueOnce(application({}));
    await exportApplication({
      applicationId: 'app-1',
      options,
      state: mockState(),
    });
    expect(exportOAuth2Client).not.toHaveBeenCalled();
    expect(exportSaml2Provider).not.toHaveBeenCalled();
    expect(exportCirclesOfTrust).not.toHaveBeenCalled();
    expect(exportConnector).not.toHaveBeenCalled();
  });
});
