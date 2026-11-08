import { jest } from '@jest/globals';

/**
 * Only a provisioning application, one with a connector, has a status, and it
 * is the state of its connector: `active` if the connector is enabled,
 * `inactive` if it is disabled. Every other application, and one whose
 * connector configuration does not exist, has status `none`. Enabling or
 * disabling an application enables or disables its connector (the work is
 * done by ConnectorOps, which is mocked here); an application without a
 * connector has no status to change and is an error.
 * Mocked unit test: no recordings.
 */

const notFound = () =>
  Object.assign(new Error('Request failed with status code 404'), {
    response: { status: 404 },
  });
const serverError = () =>
  Object.assign(new Error('Request failed with status code 500'), {
    response: { status: 500 },
  });

const readManagedObject = jest.fn(async (_args?: any): Promise<any> => ({}));
const readManagedObjects = jest.fn(async (_args?: any): Promise<any> => []);
const queryManagedObjects = jest.fn(async (_args?: any): Promise<any> => []);
const unused = jest.fn(async (_args?: any): Promise<any> => ({}));

const isConnectorEnabled = jest.fn(async (_args?: any): Promise<any> => true);
const readConnectorEnabledStates = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const enableConnector = jest.fn(async (_args?: any): Promise<any> => ({}));
const disableConnector = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/cloud/iga/IgaGlossaryApi', () => ({
  deleteApplicationGlossary: unused,
  getApplicationGlossary: unused,
  putApplicationGlossary: unused,
}));
jest.unstable_mockModule('../api/cloud/iga/IgaRequestFormApi', () => ({
  getRequestFormAssignments: unused,
}));
jest.unstable_mockModule('../api/ScriptApi', () => ({
  getScriptByName: unused,
}));
jest.unstable_mockModule('../utils/Console', () => ({
  createProgressIndicator: jest.fn(() => 'progress-id'),
  curlirizeMessage: jest.fn(),
  debugMessage: jest.fn(),
  printError: jest.fn(),
  printMessage: jest.fn(),
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
  verboseMessage: jest.fn(),
}));
jest.unstable_mockModule('../utils/ExportImportUtils', () => ({
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));
jest.unstable_mockModule('./CirclesOfTrustOps', () => ({
  exportCirclesOfTrust: unused,
  importCirclesOfTrust: unused,
  readCirclesOfTrust: unused,
  updateCircleOfTrust: unused,
}));
jest.unstable_mockModule('./cloud/iga/IgaGlossaryOps', () => ({
  deleteGlossarySchemaByNameAndObjectType: unused,
  exportGlossarySchemaByNameAndObjectType: unused,
  importGlossarySchemas: unused,
  readGlossarySchemas: unused,
}));
jest.unstable_mockModule('./cloud/iga/IgaRequestFormOps', () => ({
  deleteOrphanedRequestFormAssignments: unused,
  deleteRequestForm: unused,
  exportRequestForm: unused,
  importRequestForms: unused,
  readRequestForm: unused,
}));
jest.unstable_mockModule('./cloud/iga/IgaRequestTypeOps', () => ({
  deleteRequestType: unused,
  readRequestType: unused,
}));
jest.unstable_mockModule('./ConnectorOps', () => ({
  deleteConnector: unused,
  disableConnector,
  enableConnector,
  exportConnector: unused,
  importConnector: unused,
  isConnectorEnabled,
  readConnector: unused,
  readConnectorEnabledStates,
}));
jest.unstable_mockModule('./ManagedObjectOps', () => ({
  createManagedObject: unused,
  deleteManagedObject: unused,
  queryManagedObjects,
  readManagedObject,
  readManagedObjects,
  updateManagedObject: unused,
}));
jest.unstable_mockModule('./MappingOps', () => ({ readMappings: unused }));
jest.unstable_mockModule('./OAuth2ClientOps', () => ({
  deleteOAuth2Client: unused,
  exportOAuth2Client: unused,
  getOAuth2ClientScriptReferences: unused,
  importOAuth2Client: unused,
  readOAuth2Client: unused,
}));
jest.unstable_mockModule('./Saml2Ops', () => ({
  deleteSaml2Provider: unused,
  exportSaml2Provider: unused,
  getSaml2ProviderScriptReferences: unused,
  importSaml2Provider: unused,
  readSaml2EntityIds: unused,
  readSaml2Provider: unused,
}));
jest.unstable_mockModule('./ScriptOps', () => ({
  getLibraryScriptNames: unused,
  readScript: unused,
}));

const {
  default: ApplicationOps,
  disableApplication,
  disableApplicationByName,
  enableApplication,
  enableApplicationByName,
  readApplicationStatus,
  readApplicationStatusByName,
  readApplicationStatuses,
} = await import('./ApplicationOps');
const { FrodoError } = await import('./FrodoError');

const state = {
  getRealm: () => 'alpha',
  getDeploymentType: () => 'cloud',
  getUseRealmPrefixOnManagedObjects: () => false,
  getIsIGA: () => false,
} as any;

const bookmarkApp = { _id: 'app-bookmark', name: 'Bookmark' };
const entraApp = { _id: 'app-entra', name: 'Entra', connectorId: 'Entra' };
const workdayApp = {
  _id: 'app-workday',
  name: 'Workday',
  connectorId: 'Workday',
};
const orphanApp = {
  _id: 'app-orphan',
  name: 'Orphan',
  connectorId: 'GoneConnector',
};
const apps: Record<string, any> = Object.fromEntries(
  [bookmarkApp, entraApp, workdayApp, orphanApp].map((app) => [app._id, app])
);

/** a FrodoError chain as the ops layer throws it */
const wrapped = (cause: Error) =>
  new FrodoError('Error reading connector', new FrodoError('inner', cause));

beforeEach(() => {
  jest.clearAllMocks();
  readManagedObject.mockReset();
  readManagedObject.mockImplementation(async ({ id }: any) => {
    if (!apps[id]) throw notFound();
    return apps[id];
  });
  queryManagedObjects.mockReset();
  queryManagedObjects.mockImplementation(async ({ filter }: any) =>
    Object.values(apps).filter((app) => filter === `name eq '${app.name}'`)
  );
  readManagedObjects.mockReset();
  readManagedObjects.mockResolvedValue(Object.values(apps));
  isConnectorEnabled.mockReset();
  isConnectorEnabled.mockResolvedValue(true);
  readConnectorEnabledStates.mockReset();
  readConnectorEnabledStates.mockResolvedValue({
    Entra: true,
    Workday: false,
  });
  enableConnector.mockReset();
  enableConnector.mockResolvedValue({ changed: true, ready: true });
  disableConnector.mockReset();
  disableConnector.mockResolvedValue({ changed: true });
});

describe('readApplicationStatus', () => {
  test('is active when the connector is enabled', async () => {
    isConnectorEnabled.mockResolvedValue(true);
    expect(
      await readApplicationStatus({ applicationId: 'app-entra', state })
    ).toEqual({
      applicationId: 'app-entra',
      applicationName: 'Entra',
      connectorId: 'Entra',
      status: 'active',
    });
    expect(isConnectorEnabled).toHaveBeenCalledWith({
      connectorId: 'Entra',
      state,
    });
  });

  test('is inactive when the connector is disabled', async () => {
    isConnectorEnabled.mockResolvedValue(false);
    expect(
      (await readApplicationStatus({ applicationId: 'app-entra', state }))
        .status
    ).toBe('inactive');
  });

  test('is none for an application without a connector, and no connector is read', async () => {
    expect(
      await readApplicationStatus({ applicationId: 'app-bookmark', state })
    ).toEqual({
      applicationId: 'app-bookmark',
      applicationName: 'Bookmark',
      status: 'none',
    });
    expect(isConnectorEnabled).not.toHaveBeenCalled();
  });

  test('is none when the connector the application names does not exist', async () => {
    isConnectorEnabled.mockRejectedValue(wrapped(notFound()));
    expect(
      await readApplicationStatus({ applicationId: 'app-orphan', state })
    ).toEqual({
      applicationId: 'app-orphan',
      applicationName: 'Orphan',
      connectorId: 'GoneConnector',
      status: 'none',
    });
  });

  test('a connector that cannot be read for another reason is an error', async () => {
    isConnectorEnabled.mockRejectedValue(wrapped(serverError()));
    await expect(
      readApplicationStatus({ applicationId: 'app-entra', state })
    ).rejects.toBeInstanceOf(FrodoError);
  });

  test('an application that does not exist is an error', async () => {
    await expect(
      readApplicationStatus({ applicationId: 'nope', state })
    ).rejects.toBeInstanceOf(FrodoError);
  });

  test('can be read by name', async () => {
    isConnectorEnabled.mockResolvedValue(false);
    expect(
      await readApplicationStatusByName({ applicationName: 'Entra', state })
    ).toMatchObject({ applicationName: 'Entra', status: 'inactive' });
    expect(queryManagedObjects).toHaveBeenCalledWith(
      expect.objectContaining({ filter: "name eq 'Entra'" })
    );
  });

  test('an unknown name is an error', async () => {
    await expect(
      readApplicationStatusByName({ applicationName: 'Nope', state })
    ).rejects.toBeInstanceOf(FrodoError);
  });
});

describe('readApplicationStatuses', () => {
  test('reads the applications once and the states of the connectors in one request', async () => {
    const statuses = await readApplicationStatuses({ state });
    expect(readManagedObjects).toHaveBeenCalledTimes(1);
    expect(readConnectorEnabledStates).toHaveBeenCalledTimes(1);
    expect(isConnectorEnabled).not.toHaveBeenCalled();
    expect(statuses).toEqual([
      {
        applicationId: 'app-bookmark',
        applicationName: 'Bookmark',
        status: 'none',
      },
      {
        applicationId: 'app-entra',
        applicationName: 'Entra',
        connectorId: 'Entra',
        status: 'active',
      },
      {
        applicationId: 'app-workday',
        applicationName: 'Workday',
        connectorId: 'Workday',
        status: 'inactive',
      },
      {
        applicationId: 'app-orphan',
        applicationName: 'Orphan',
        connectorId: 'GoneConnector',
        status: 'none',
      },
    ]);
  });

  test('does not read the connectors when no application has one', async () => {
    readManagedObjects.mockResolvedValue([bookmarkApp]);
    expect(await readApplicationStatuses({ state })).toEqual([
      {
        applicationId: 'app-bookmark',
        applicationName: 'Bookmark',
        status: 'none',
      },
    ]);
    expect(readConnectorEnabledStates).not.toHaveBeenCalled();
  });

  test('a failed read of the connectors is an error', async () => {
    readConnectorEnabledStates.mockRejectedValue(serverError());
    await expect(readApplicationStatuses({ state })).rejects.toBeInstanceOf(
      FrodoError
    );
  });
});

describe('enableApplication', () => {
  test('enables the connector of the application and reports the status', async () => {
    enableConnector.mockResolvedValue({ changed: true, ready: true });
    expect(
      await enableApplication({
        applicationId: 'app-entra',
        options: { timeout: 5000 },
        state,
      })
    ).toEqual({
      applicationId: 'app-entra',
      applicationName: 'Entra',
      connectorId: 'Entra',
      status: 'active',
      changed: true,
      ready: true,
    });
    expect(enableConnector).toHaveBeenCalledWith({
      connectorId: 'Entra',
      options: { timeout: 5000 },
      state,
    });
    expect(disableConnector).not.toHaveBeenCalled();
  });

  test('passes on that the connector does not answer in time', async () => {
    enableConnector.mockResolvedValue({
      changed: true,
      ready: false,
      error: 'connector not available',
    });
    expect(
      await enableApplicationByName({ applicationName: 'Entra', state })
    ).toMatchObject({
      status: 'active',
      changed: true,
      ready: false,
      error: 'connector not available',
    });
  });

  test('an application that is active already is not changed', async () => {
    enableConnector.mockResolvedValue({ changed: false, ready: true });
    expect(
      (await enableApplication({ applicationId: 'app-entra', state })).changed
    ).toBe(false);
  });

  test('an application without a connector has no status to change', async () => {
    const failure = await enableApplication({
      applicationId: 'app-bookmark',
      state,
    }).catch((error) => error);
    expect(failure).toBeInstanceOf(FrodoError);
    expect(failure.originalErrors[0].message).toContain('has no connector');
    expect(enableConnector).not.toHaveBeenCalled();
  });

  test('a connector that does not exist is an error', async () => {
    enableConnector.mockRejectedValue(wrapped(notFound()));
    await expect(
      enableApplication({ applicationId: 'app-orphan', state })
    ).rejects.toBeInstanceOf(FrodoError);
  });

  test('an unknown application name is an error', async () => {
    await expect(
      enableApplicationByName({ applicationName: 'Nope', state })
    ).rejects.toBeInstanceOf(FrodoError);
    expect(enableConnector).not.toHaveBeenCalled();
  });
});

describe('disableApplication', () => {
  test('disables the connector of the application and reports the status', async () => {
    expect(
      await disableApplication({ applicationId: 'app-entra', state })
    ).toEqual({
      applicationId: 'app-entra',
      applicationName: 'Entra',
      connectorId: 'Entra',
      status: 'inactive',
      changed: true,
    });
    expect(disableConnector).toHaveBeenCalledWith({
      connectorId: 'Entra',
      state,
    });
    expect(enableConnector).not.toHaveBeenCalled();
  });

  test('can be done by name', async () => {
    disableConnector.mockResolvedValue({ changed: false });
    expect(
      await disableApplicationByName({ applicationName: 'Workday', state })
    ).toEqual({
      applicationId: 'app-workday',
      applicationName: 'Workday',
      connectorId: 'Workday',
      status: 'inactive',
      changed: false,
    });
  });

  test('an application without a connector has no status to change', async () => {
    await expect(
      disableApplication({ applicationId: 'app-bookmark', state })
    ).rejects.toBeInstanceOf(FrodoError);
    expect(disableConnector).not.toHaveBeenCalled();
  });

  test('a connector that does not exist is an error', async () => {
    disableConnector.mockRejectedValue(wrapped(notFound()));
    await expect(
      disableApplicationByName({ applicationName: 'Orphan', state })
    ).rejects.toBeInstanceOf(FrodoError);
  });
});

describe('the Application module', () => {
  test('wires the seven methods to the functions', async () => {
    const applications = ApplicationOps(state);
    expect(await applications.readApplicationStatus('app-entra')).toMatchObject(
      { status: 'active' }
    );
    expect(
      await applications.readApplicationStatusByName('Entra')
    ).toMatchObject({ status: 'active' });
    expect(await applications.readApplicationStatuses()).toHaveLength(4);
    expect(
      await applications.enableApplication('app-entra', { timeout: 1 })
    ).toMatchObject({ status: 'active' });
    expect(enableConnector).toHaveBeenLastCalledWith({
      connectorId: 'Entra',
      options: { timeout: 1 },
      state,
    });
    expect(await applications.enableApplicationByName('Entra')).toMatchObject({
      status: 'active',
    });
    expect(await applications.disableApplication('app-entra')).toMatchObject({
      status: 'inactive',
    });
    expect(await applications.disableApplicationByName('Entra')).toMatchObject({
      status: 'inactive',
    });
  });
});
