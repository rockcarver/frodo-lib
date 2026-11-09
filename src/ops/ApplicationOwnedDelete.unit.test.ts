import { jest } from '@jest/globals';
import { encode } from '../utils/Base64Utils';
import type {
  ApplicationOwnedObjectResult,
  ApplicationOwnership,
  ApplicationSkeleton,
} from './ApplicationOps';

/**
 * Deleting the objects an application owns (frodo-lib#969). The record names them (`ssoEntities.oidcId`,
 * `ssoEntities.idpPrivateId` and `spPrivateId`, `connectorId`, `mappingNames`); they are deleted one by one, an object
 * that another application still names is kept, a failure of one object does not stop the others, and every object is
 * reported once. The record itself and the shared objects (circles of trust, scripts, ...) are never deleted.
 * Mocked unit test: no recordings. Only the functions that delete, update or read are replaced; every other module is
 * the real one, so the test does not depend on the export lists of the modules ApplicationOps imports.
 */

/** What was deleted or updated, in order. */
const calls: string[] = [];

const actualManagedObjectOps = await import('./ManagedObjectOps');
const readManagedObjects = jest.fn(async (_args?: any): Promise<any[]> => []);
const readManagedObject = jest.fn(async (_args?: any): Promise<any> => ({}));
const queryManagedObjects = jest.fn(async (_args?: any): Promise<any[]> => []);
const deleteManagedObject = jest.fn(async (_args?: any): Promise<any> => ({}));
jest.unstable_mockModule('./ManagedObjectOps', () => ({
  ...actualManagedObjectOps,
  deleteManagedObject,
  queryManagedObjects,
  readManagedObject,
  readManagedObjects,
}));

const actualOAuth2ClientOps = await import('./OAuth2ClientOps');
const deleteOAuth2Client = jest.fn(async (args: any): Promise<any> => {
  calls.push(`oauth2 ${args.clientId}`);
  return {};
});
jest.unstable_mockModule('./OAuth2ClientOps', () => ({
  ...actualOAuth2ClientOps,
  deleteOAuth2Client,
}));

const actualSaml2Ops = await import('./Saml2Ops');
const deleteSaml2Provider = jest.fn(async (args: any): Promise<any> => {
  calls.push(`saml ${args.entityId}`);
  return {};
});
jest.unstable_mockModule('./Saml2Ops', () => ({
  ...actualSaml2Ops,
  deleteSaml2Provider,
}));

const actualCirclesOfTrustOps = await import('./CirclesOfTrustOps');
const readCirclesOfTrust = jest.fn(async (_args?: any): Promise<any[]> => []);
const updateCircleOfTrust = jest.fn(async (args: any): Promise<any> => {
  calls.push(
    `cot ${args.cotId} keeps [${args.cotData.trustedProviders.join(', ')}]`
  );
  return args.cotData;
});
const deleteCircleOfTrust = jest.fn(async (_args?: any): Promise<any> => ({}));
const deleteCirclesOfTrust = jest.fn(async (_args?: any): Promise<any[]> => []);
jest.unstable_mockModule('./CirclesOfTrustOps', () => ({
  ...actualCirclesOfTrustOps,
  deleteCircleOfTrust,
  deleteCirclesOfTrust,
  readCirclesOfTrust,
  updateCircleOfTrust,
}));

const actualConnectorOps = await import('./ConnectorOps');
const deleteConnector = jest.fn(async (args: any): Promise<any> => {
  calls.push(`connector ${args.connectorId} deep=${args.deep}`);
  return {};
});
jest.unstable_mockModule('./ConnectorOps', () => ({
  ...actualConnectorOps,
  deleteConnector,
}));

const actualMappingOps = await import('./MappingOps');
const readMappings = jest.fn(async (_args?: any): Promise<any[]> => []);
const deleteMapping = jest.fn(async (args: any): Promise<any> => {
  calls.push(`mapping ${args.mappingId}`);
  return {};
});
jest.unstable_mockModule('./MappingOps', () => ({
  ...actualMappingOps,
  deleteMapping,
  readMappings,
}));

const {
  default: ApplicationOps,
  deleteApplicationOwnedObjects,
  deleteApplicationOwnedObjectsById,
  deleteApplicationOwnedObjectsByName,
  getApplicationOwnership,
} = await import('./ApplicationOps');
const { FrodoError } = await import('./FrodoError');

/** A state that answers every getter with undefined, except for the ones given. */
function mockState(realm = '/alpha') {
  const answers: Record<string, unknown> = {
    getRealm: realm,
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

const oidcApp = application({
  name: 'matrix-web',
  ssoEntities: { oidcId: 'matrix-client', idpLoginUrl: 'https://login/matrix' },
});

const samlApp = application({
  name: 'matrix-saml',
  ssoEntities: {
    domain: 'example.com',
    idpLocation: 'idp-location',
    idpLoginUrl: 'https://login/matrix',
    idpPrivateId: encode(idpEntityId, false),
    key: 'signing-key',
    spLocation: 'sp-location',
    spPrivateId: encode(spEntityId, false),
  },
});

const provisioningApp = application({
  name: 'matrix-sync',
  connectorId: 'matrix-connector',
  mappingNames: ['matrixToZion', 'zionToMatrix'],
});

/** Every kind of owned object in one record. */
const fullApp = application({
  name: 'matrix-full',
  ssoEntities: {
    ...samlApp.ssoEntities,
    oidcId: 'matrix-client',
  },
  connectorId: 'matrix-connector',
  mappingNames: ['matrixToZion', 'zionToMatrix'],
});

const mappingsOfTheTenant = [
  { _id: 'mapping/matrixToZion', name: 'matrixToZion' },
  { _id: 'sync/zionToMatrix', name: 'zionToMatrix' },
  { _id: 'mapping/other', name: 'other' },
];

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

beforeEach(() => {
  calls.length = 0;
  jest.clearAllMocks();
  readManagedObjects.mockResolvedValue([]);
  readManagedObject.mockResolvedValue({});
  queryManagedObjects.mockResolvedValue([]);
  readCirclesOfTrust.mockResolvedValue([]);
  readMappings.mockResolvedValue(mappingsOfTheTenant);
});

describe('the objects an application owns are deleted, one by one', () => {
  test('an OIDC application: its OAuth2 client', async () => {
    const callback = jest.fn();
    const results = await deleteApplicationOwnedObjects({
      applicationData: oidcApp,
      ownership: getApplicationOwnership([oidcApp]),
      resultCallback: callback,
      state: mockState(),
    });
    expect(calls).toEqual(['oauth2 matrix-client']);
    expect(results).toEqual([
      { kind: 'oauth2Client', id: 'matrix-client', outcome: 'deleted' },
    ]);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(undefined, results[0]);
  });

  test('a SAML application: both providers by their decoded entity id, each taken out of its circles of trust', async () => {
    // a fresh circle of trust for every read, as the tenant answers
    readCirclesOfTrust.mockImplementation(async () => [
      {
        _id: 'matrix-cot',
        trustedProviders: [
          `${idpEntityId}|saml2`,
          `${spEntityId}|saml2`,
          'https://other.example.com/zion|saml2',
        ],
      },
    ]);
    const results = await deleteApplicationOwnedObjects({
      applicationData: samlApp,
      ownership: getApplicationOwnership([samlApp]),
      state: mockState(),
    });
    expect(results.map((r) => [r.kind, r.id, r.outcome])).toEqual([
      ['saml2Provider', idpEntityId, 'deleted'],
      ['saml2Provider', spEntityId, 'deleted'],
    ]);
    expect(deleteSaml2Provider).toHaveBeenCalledTimes(2);
    expect(readCirclesOfTrust).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ entityProviders: [idpEntityId] })
    );
    expect(readCirclesOfTrust).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ entityProviders: [spEntityId] })
    );
    // the provider is removed from the circle of trust, the others stay
    expect(updateCircleOfTrust).toHaveBeenCalledTimes(2);
    expect(updateCircleOfTrust.mock.calls[0][0]).toMatchObject({
      cotId: 'matrix-cot',
      cotData: {
        trustedProviders: [
          `${spEntityId}|saml2`,
          'https://other.example.com/zion|saml2',
        ],
      },
    });
  });

  test('a provisioning application: its mappings by name (the ids are read once), then its connector without a deep delete', async () => {
    const results = await deleteApplicationOwnedObjects({
      applicationData: provisioningApp,
      ownership: getApplicationOwnership([provisioningApp]),
      state: mockState(),
    });
    expect(readMappings).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      'mapping mapping/matrixToZion',
      'mapping sync/zionToMatrix',
      'connector matrix-connector deep=false',
    ]);
    expect(results.map((r) => [r.kind, r.id, r.outcome])).toEqual([
      ['mapping', 'matrixToZion', 'deleted'],
      ['mapping', 'zionToMatrix', 'deleted'],
      ['connector', 'matrix-connector', 'deleted'],
    ]);
    // a mapping of the connector that the record does not name is not touched
    expect(calls).not.toContain('mapping mapping/other');
  });

  test('every kind in one record: OAuth2 client, SAML providers, mappings, connector, in that order', async () => {
    const results = await deleteApplicationOwnedObjects({
      applicationData: fullApp,
      ownership: getApplicationOwnership([fullApp]),
      state: mockState(),
    });
    expect(results.map((r) => r.kind)).toEqual([
      'oauth2Client',
      'saml2Provider',
      'saml2Provider',
      'mapping',
      'mapping',
      'connector',
    ]);
    expect(calls).toEqual([
      'oauth2 matrix-client',
      `saml ${idpEntityId}`,
      `saml ${spEntityId}`,
      'mapping mapping/matrixToZion',
      'mapping sync/zionToMatrix',
      'connector matrix-connector deep=false',
    ]);
  });
});

describe('what is never deleted', () => {
  test('the record itself and the shared objects: no application, circle of trust or script is deleted', async () => {
    await deleteApplicationOwnedObjects({
      applicationData: fullApp,
      ownership: getApplicationOwnership([fullApp]),
      state: mockState(),
    });
    expect(deleteManagedObject).not.toHaveBeenCalled();
    expect(deleteCircleOfTrust).not.toHaveBeenCalled();
    expect(deleteCirclesOfTrust).not.toHaveBeenCalled();
  });

  test('an application without owned objects: nothing is read and nothing deleted', async () => {
    const callback = jest.fn();
    const results = await deleteApplicationOwnedObjects({
      applicationData: application({ name: 'bookmark' }),
      resultCallback: callback,
      state: mockState(),
    });
    expect(results).toEqual([]);
    expect(callback).not.toHaveBeenCalled();
    expect(readManagedObjects).not.toHaveBeenCalled();
    expect(readMappings).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });
});

describe('an object that another application still names is kept', () => {
  const other = application({
    _id: 'app-2',
    name: 'zion-sync',
    connectorId: 'matrix-connector',
    mappingNames: ['otherMapping'],
  });

  test('the connector is kept and its owners are reported; the mappings only this application names are deleted', async () => {
    const callback = jest.fn();
    const results = await deleteApplicationOwnedObjects({
      applicationData: provisioningApp,
      ownership: getApplicationOwnership([provisioningApp, other]),
      resultCallback: callback,
      state: mockState(),
    });
    expect(calls).toEqual([
      'mapping mapping/matrixToZion',
      'mapping sync/zionToMatrix',
    ]);
    const connector = results.find((r) => r.kind === 'connector');
    expect(connector).toEqual({
      kind: 'connector',
      id: 'matrix-connector',
      outcome: 'kept',
      owners: [{ applicationId: 'app-2', applicationName: 'zion-sync' }],
    });
    // kept is not an error
    expect(callback).toHaveBeenCalledWith(undefined, connector);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  test('without an ownership index the ownership is read once for the realm', async () => {
    readManagedObjects.mockResolvedValue([provisioningApp, other]);
    const results = await deleteApplicationOwnedObjects({
      applicationData: provisioningApp,
      state: mockState(),
    });
    expect(readManagedObjects).toHaveBeenCalledTimes(1);
    expect(readManagedObjects.mock.calls[0][0]).toMatchObject({
      type: 'alpha_application',
    });
    expect(results.find((r) => r.kind === 'connector')?.outcome).toBe('kept');
  });

  test('a mapping that two applications name is kept for the one and deleted for neither', async () => {
    const sharesMapping = application({
      _id: 'app-3',
      name: 'zion-shared',
      mappingNames: ['matrixToZion'],
    });
    const results = await deleteApplicationOwnedObjects({
      applicationData: provisioningApp,
      ownership: getApplicationOwnership([provisioningApp, sharesMapping]),
      state: mockState(),
    });
    expect(results.map((r) => [r.id, r.outcome])).toEqual([
      ['matrixToZion', 'kept'],
      ['zionToMatrix', 'deleted'],
      ['matrix-connector', 'deleted'],
    ]);
    expect(calls).not.toContain('mapping mapping/matrixToZion');
  });

  test('the application being deleted is not another owner of its own objects, whether or not the index still holds it', async () => {
    const withIt = getApplicationOwnership([oidcApp]);
    const without: ApplicationOwnership = { entries: [] };
    for (const ownership of [withIt, without]) {
      calls.length = 0;
      const results = await deleteApplicationOwnedObjects({
        applicationData: oidcApp,
        ownership,
        state: mockState(),
      });
      expect(results[0].outcome).toBe('deleted');
      expect(calls).toEqual(['oauth2 matrix-client']);
    }
  });
});

describe('a failure of one object does not stop the others', () => {
  test('a failed OAuth2 client: reported to the callback with the object named, the rest deleted, nothing thrown', async () => {
    deleteOAuth2Client.mockRejectedValueOnce(
      new FrodoError('client is in use')
    );
    const callback = jest.fn();
    const results = await deleteApplicationOwnedObjects({
      applicationData: fullApp,
      ownership: getApplicationOwnership([fullApp]),
      resultCallback: callback,
      state: mockState(),
    });
    expect(results).toHaveLength(6);
    expect(results[0]).toMatchObject({
      kind: 'oauth2Client',
      id: 'matrix-client',
      outcome: 'failed',
    });
    expect(rootCause(results[0].error).message).toBe('client is in use');
    expect(results.slice(1).every((r) => r.outcome === 'deleted')).toBe(true);
    expect(callback).toHaveBeenCalledTimes(6);
    expect(callback.mock.calls[0][0]).toBe(results[0].error);
    expect(callback.mock.calls[0][1]).toBe(results[0]);
    expect(callback.mock.calls.slice(1).every((c) => c[0] === undefined)).toBe(
      true
    );
    expect(calls).toContain('connector matrix-connector deep=false');
  });

  test('a provider that was deleted but could not be taken out of its circle of trust is reported as failed, saying so', async () => {
    readCirclesOfTrust.mockResolvedValueOnce([
      { _id: 'matrix-cot', trustedProviders: [`${idpEntityId}|saml2`] },
    ]);
    updateCircleOfTrust.mockRejectedValueOnce(new FrodoError('cot is locked'));
    const results = await deleteApplicationOwnedObjects({
      applicationData: samlApp,
      ownership: getApplicationOwnership([samlApp]),
      state: mockState(),
    });
    expect(results[0]).toMatchObject({ id: idpEntityId, outcome: 'failed' });
    expect(results[0].error?.message).toContain(
      'was deleted, but it could not be removed from its circles of trust'
    );
    expect(results[1]).toMatchObject({ id: spEntityId, outcome: 'deleted' });
  });

  test('a provider that cannot be deleted stays in its circles of trust', async () => {
    deleteSaml2Provider.mockRejectedValueOnce(new FrodoError('not found'));
    const results = await deleteApplicationOwnedObjects({
      applicationData: samlApp,
      ownership: getApplicationOwnership([samlApp]),
      state: mockState(),
    });
    expect(results[0]).toMatchObject({ id: idpEntityId, outcome: 'failed' });
    // only the service provider's circles of trust were looked at
    expect(readCirclesOfTrust).toHaveBeenCalledTimes(1);
    expect(readCirclesOfTrust).toHaveBeenCalledWith(
      expect.objectContaining({ entityProviders: [spEntityId] })
    );
  });

  test('a mapping that does not exist is a failure naming it; the others and the connector are still deleted', async () => {
    readMappings.mockResolvedValue([
      { _id: 'sync/zionToMatrix', name: 'zionToMatrix' },
    ]);
    const results = await deleteApplicationOwnedObjects({
      applicationData: provisioningApp,
      ownership: getApplicationOwnership([provisioningApp]),
      state: mockState(),
    });
    expect(results.map((r) => [r.id, r.outcome])).toEqual([
      ['matrixToZion', 'failed'],
      ['zionToMatrix', 'deleted'],
      ['matrix-connector', 'deleted'],
    ]);
    expect(results[0].error?.message).toContain('matrixToZion');
  });

  test('mappings that cannot be read: every mapping fails with that cause, the connector is still deleted', async () => {
    readMappings.mockRejectedValue(new FrodoError('mappings unreadable'));
    const results = await deleteApplicationOwnedObjects({
      applicationData: provisioningApp,
      ownership: getApplicationOwnership([provisioningApp]),
      state: mockState(),
    });
    expect(results.map((r) => r.outcome)).toEqual([
      'failed',
      'failed',
      'deleted',
    ]);
    expect(rootCause(results[0].error).message).toBe('mappings unreadable');
    expect(deleteMapping).not.toHaveBeenCalled();
  });

  test('a callback is optional', async () => {
    deleteOAuth2Client.mockRejectedValueOnce(new FrodoError('no'));
    await expect(
      deleteApplicationOwnedObjects({
        applicationData: oidcApp,
        ownership: getApplicationOwnership([oidcApp]),
        state: mockState(),
      })
    ).resolves.toHaveLength(1);
  });
});

describe('what is thrown', () => {
  test('an ownership that cannot be read: a FrodoError, and nothing is deleted', async () => {
    readManagedObjects.mockRejectedValue(new Error('managed objects down'));
    await expect(
      deleteApplicationOwnedObjects({
        applicationData: oidcApp,
        state: mockState(),
      })
    ).rejects.toBeInstanceOf(FrodoError);
    expect(calls).toEqual([]);
  });

  test('by id: the application is read first; an unknown id is a FrodoError and nothing is deleted', async () => {
    readManagedObject.mockResolvedValue(provisioningApp);
    const keeper = application({
      _id: 'app-9',
      name: 'zion-keeper',
      connectorId: 'matrix-connector',
    });
    const byIdCallback = jest.fn();
    const results = await deleteApplicationOwnedObjectsById({
      applicationId: 'app-1',
      ownership: getApplicationOwnership([provisioningApp, keeper]),
      resultCallback: byIdCallback,
      state: mockState(),
    });
    expect(readManagedObject).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'alpha_application', id: 'app-1' })
    );
    expect(results).toHaveLength(3);
    // the ownership that was passed in is the one used: nothing is read, and the connector is kept
    expect(readManagedObjects).not.toHaveBeenCalled();
    expect(results.find((r) => r.kind === 'connector')?.outcome).toBe('kept');
    expect(byIdCallback).toHaveBeenCalledTimes(3);
    calls.length = 0;
    readManagedObject.mockRejectedValue(new Error('no such application'));
    await expect(
      deleteApplicationOwnedObjectsById({
        applicationId: 'missing',
        state: mockState(),
      })
    ).rejects.toBeInstanceOf(FrodoError);
    expect(calls).toEqual([]);
  });

  test('by name: the application is queried by name; an unknown name is a FrodoError', async () => {
    queryManagedObjects.mockResolvedValue([oidcApp]);
    const byNameCallback = jest.fn();
    const results = await deleteApplicationOwnedObjectsByName({
      applicationName: 'matrix-web',
      ownership: getApplicationOwnership([oidcApp]),
      resultCallback: byNameCallback,
      state: mockState(),
    });
    expect(byNameCallback).toHaveBeenCalledTimes(1);
    expect(queryManagedObjects).toHaveBeenCalledWith(
      expect.objectContaining({ filter: "name eq 'matrix-web'" })
    );
    expect(results).toHaveLength(1);
    calls.length = 0;
    queryManagedObjects.mockResolvedValue([]);
    await expect(
      deleteApplicationOwnedObjectsByName({
        applicationName: 'missing',
        state: mockState(),
      })
    ).rejects.toBeInstanceOf(FrodoError);
    expect(calls).toEqual([]);
  });
});

describe('the application module', () => {
  test('passes the record, the ownership and the callback on, and the ids and names to the lookups', async () => {
    const frodoApplications = ApplicationOps(mockState());
    const callback = jest.fn();
    const ownership = getApplicationOwnership([oidcApp]);
    const results: ApplicationOwnedObjectResult[] =
      await frodoApplications.deleteApplicationOwnedObjects(oidcApp, {
        ownership,
        resultCallback: callback,
      });
    expect(results).toEqual([
      { kind: 'oauth2Client', id: 'matrix-client', outcome: 'deleted' },
    ]);
    expect(callback).toHaveBeenCalledTimes(1);
    // the options are optional: without them the ownership is read
    readManagedObjects.mockResolvedValue([oidcApp]);
    await frodoApplications.deleteApplicationOwnedObjects(oidcApp);
    expect(readManagedObjects).toHaveBeenCalledTimes(1);

    readManagedObject.mockResolvedValue(oidcApp);
    const byIdCallback = jest.fn();
    await frodoApplications.deleteApplicationOwnedObjectsById('app-1', {
      ownership,
      resultCallback: byIdCallback,
    });
    expect(byIdCallback).toHaveBeenCalledTimes(1);
    expect(readManagedObject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'app-1' })
    );
    queryManagedObjects.mockResolvedValue([oidcApp]);
    const byNameCallback = jest.fn();
    await frodoApplications.deleteApplicationOwnedObjectsByName('matrix-web', {
      ownership,
      resultCallback: byNameCallback,
    });
    expect(byNameCallback).toHaveBeenCalledTimes(1);
    expect(queryManagedObjects).toHaveBeenCalledWith(
      expect.objectContaining({ filter: "name eq 'matrix-web'" })
    );
  });
});
