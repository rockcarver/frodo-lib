import { jest } from '@jest/globals';

/**
 * The facade method `importFirstApplication` imports the first application of
 * the import data only, as its name says and as the module function of the
 * same name does. It used to call `importApplications` and so imported every
 * application of the file. The facade still returns an array (its declared
 * type), with the one application in it.
 * Mocked unit test: no recordings.
 */

const importOAuth2Client = jest.fn(async (_args?: any): Promise<any> => ({}));
jest.unstable_mockModule('./OAuth2ClientOps', () => ({
  deleteOAuth2Client: jest.fn(),
  exportOAuth2Client: jest.fn(),
  getOAuth2ClientScriptReferences: jest.fn(() => []),
  importOAuth2Client,
  readOAuth2Client: jest.fn(),
}));

const updateManagedObject = jest.fn(async (args?: any): Promise<any> => ({
  _id: args?.id,
  ...args?.moData,
}));
jest.unstable_mockModule('./ManagedObjectOps', () => ({
  createManagedObject: jest.fn(),
  deleteManagedObject: jest.fn(),
  queryManagedObjects: jest.fn(),
  readManagedObject: jest.fn(),
  readManagedObjects: jest.fn(),
  updateManagedObject,
}));

const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  debugMessage: jest.fn(),
}));

const { default: ApplicationOps, importFirstApplication } =
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

/** two OIDC applications and one bookmark application */
function importData(): any {
  return {
    managedApplication: {
      'id-1': {
        _id: 'id-1',
        _provider: { _id: 'provider' },
        _rev: '1',
        name: 'matrix-one',
        ssoEntities: { oidcId: 'client-1' },
      },
      'id-2': {
        _id: 'id-2',
        name: 'matrix-two',
        ssoEntities: { oidcId: 'client-2' },
      },
      'id-3': { _id: 'id-3', name: 'matrix-three' },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  updateManagedObject.mockReset();
  updateManagedObject.mockImplementation(async (args: any) => ({
    _id: args.id,
    ...args.moData,
  }));
  importOAuth2Client.mockReset();
  importOAuth2Client.mockResolvedValue({});
});

describe('the importFirstApplication facade method', () => {
  test('writes the first application only and returns an array of one', async () => {
    const result = await ApplicationOps(mockState()).importFirstApplication(
      importData(),
      { deps: false }
    );

    expect(updateManagedObject).toHaveBeenCalledTimes(1);
    expect(updateManagedObject.mock.calls[0][0]).toMatchObject({ id: 'id-1' });
    // the options reach the import: no dependencies were asked for
    expect(importOAuth2Client).not.toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
    expect(result.map((it) => it._id)).toEqual(['id-1']);
  });

  test('imports the dependencies of the first application only', async () => {
    await ApplicationOps(mockState()).importFirstApplication(importData(), {
      deps: true,
    });

    expect(importOAuth2Client).toHaveBeenCalledTimes(1);
    expect(importOAuth2Client.mock.calls[0][0]).toMatchObject({
      clientId: 'client-1',
    });
  });

  test('does not go on to the second application when the first fails', async () => {
    updateManagedObject.mockImplementation(async () => {
      throw new Error('HTTP 400');
    });

    await expect(
      ApplicationOps(mockState()).importFirstApplication(importData(), {
        deps: false,
      })
    ).rejects.toThrow();
    expect(updateManagedObject).toHaveBeenCalledTimes(1);
  });

  test('agrees with the module function of the same name', async () => {
    const state = mockState();
    const viaFacade = await ApplicationOps(state).importFirstApplication(
      importData(),
      { deps: false }
    );
    const viaFunction = await importFirstApplication({
      importData: importData(),
      options: { deps: false },
      state,
    });

    expect(viaFacade).toEqual([viaFunction]);
  });

  test('fails on an empty import file as the module function does', async () => {
    const state = mockState();
    const empty = () => ({ managedApplication: {} }) as any;
    const fromFunction = await importFirstApplication({
      importData: empty(),
      options: { deps: false },
      state,
    }).catch((error) => error);

    await expect(
      ApplicationOps(state).importFirstApplication(empty(), { deps: false })
    ).rejects.toThrow(fromFunction.message);
    expect(updateManagedObject).not.toHaveBeenCalled();
  });
});
