import { jest } from '@jest/globals';

/**
 * `importApplications` tries every application. Without a result callback the
 * failures are collected and thrown as one combined error; with one, every
 * outcome is reported to it as it happens (a failed application as an error
 * that names it, with the reasons nested), a failed application does not throw
 * and is not part of the result, and the applications that were imported are
 * returned. An application whose dependencies or glossary could not be
 * imported is a failed application although the application itself was
 * written.
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

const putApplicationGlossary = jest.fn(async (_args?: any): Promise<any> => ({
  glossary: true,
}));
const actualGlossaryApi = await import('../api/cloud/iga/IgaGlossaryApi');
jest.unstable_mockModule('../api/cloud/iga/IgaGlossaryApi', () => ({
  ...actualGlossaryApi,
  putApplicationGlossary,
}));

const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  debugMessage: jest.fn(),
}));

const { default: ApplicationOps, importApplications } =
  await import('./ApplicationOps');

/** A state that answers every getter with undefined, except for the ones below. */
function mockState(iga = false) {
  const answers: Record<string, unknown> = {
    getRealm: '/alpha',
    getDeploymentType: 'cloud',
    getIsIGA: iga,
    getUseRealmPrefixOnManagedObjects: false,
  };
  return new Proxy(
    {},
    {
      get: (_target, name: string) => () => answers[name],
    }
  ) as any;
}

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

/** two OIDC applications and one bookmark application */
function importData(withGlossary = false): any {
  const glossary = withGlossary ? { glossary: { color: 'red' } } : {};
  return {
    managedApplication: {
      'id-1': {
        _id: 'id-1',
        _provider: { _id: 'provider' },
        _rev: '1',
        name: 'matrix-one',
        ssoEntities: { oidcId: 'client-1' },
        ...glossary,
      },
      'id-2': {
        _id: 'id-2',
        name: 'matrix-two',
        ssoEntities: { oidcId: 'client-2' },
        ...glossary,
      },
      'id-3': { _id: 'id-3', name: 'matrix-three', ...glossary },
    },
  };
}

let failure: Error;

/** the write of the application is rejected */
const failApplication = (applicationId: string, error: Error = failure) =>
  updateManagedObject.mockImplementation(async (args: any) => {
    if (args.id === applicationId) throw error;
    return { _id: args.id, ...args.moData };
  });

/** the dependencies of the application cannot be imported */
const failClient = (clientId: string, error: Error = failure) =>
  importOAuth2Client.mockImplementation(async (args: any) => {
    if (args.clientId === clientId) throw error;
    return {};
  });

const ids = (applications: any[]) => applications.map((it) => it._id);

beforeEach(() => {
  failure = new Error('HTTP 400');
  jest.clearAllMocks();
  importOAuth2Client.mockReset();
  importOAuth2Client.mockResolvedValue({});
  updateManagedObject.mockReset();
  updateManagedObject.mockImplementation(async (args: any) => ({
    _id: args.id,
    ...args.moData,
  }));
  putApplicationGlossary.mockReset();
  putApplicationGlossary.mockResolvedValue({ glossary: true });
});

describe('importApplications', () => {
  test('imports every application with its dependencies, with and without a callback', async () => {
    const plain = await importApplications({
      importData: importData(),
      state: mockState(),
    });
    const reported: any[] = [];
    const withCallback = await importApplications({
      importData: importData(),
      resultCallback: (error, application) =>
        reported.push([error, application]),
      state: mockState(),
    });

    expect(ids(plain)).toEqual(['id-1', 'id-2', 'id-3']);
    expect(ids(withCallback)).toEqual(['id-1', 'id-2', 'id-3']);
    expect(reported.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(ids(reported.map(([, application]) => application))).toEqual([
      'id-1',
      'id-2',
      'id-3',
    ]);
    // two OIDC applications per run
    expect(importOAuth2Client).toHaveBeenCalledTimes(4);
  });

  test('writes the application without provider, revision and glossary and returns the glossary that was written', async () => {
    const result = await importApplications({
      importData: importData(true),
      state: mockState(true),
    });

    const written = updateManagedObject.mock.calls.map(([args]) => args);
    expect(written.map((args) => args.id)).toEqual(['id-1', 'id-2', 'id-3']);
    expect(written[0].moData._provider).toBeUndefined();
    expect(written[0].moData._rev).toBeUndefined();
    expect(written[0].moData.glossary).toBeUndefined();
    expect(putApplicationGlossary).toHaveBeenCalledTimes(3);
    expect(result[0].glossary).toEqual({ glossary: true });
  });

  test('with a callback a failed application is reported by name, with its cause, and the others are imported', async () => {
    failApplication('id-2');
    const outcomes: any[] = [];

    const result = await importApplications({
      importData: importData(),
      resultCallback: (error, application) =>
        outcomes.push([error, application]),
      state: mockState(),
    });

    expect(ids(result)).toEqual(['id-1', 'id-3']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0]).toBeUndefined();
    expect(outcomes[0][1]._id).toBe('id-1');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(
      'Error importing alpha realm application matrix-two'
    );
    expect(outcomes[1][0].originalErrors).toHaveLength(1);
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][0]).toBeUndefined();
    expect(outcomes[2][1]._id).toBe('id-3');
    expect(updateManagedObject).toHaveBeenCalledTimes(3);
  });

  test('an application without a name is named by its id', async () => {
    const data = importData();
    delete data.managedApplication['id-2'].name;
    failApplication('id-2');
    const outcomes: any[] = [];

    await importApplications({
      importData: data,
      resultCallback: (error, application) =>
        outcomes.push([error, application]),
      state: mockState(),
    });

    expect(outcomes[1][0].message).toBe(
      'Error importing alpha realm application id-2'
    );
  });

  test('a dependency that cannot be imported makes the application a failed application, although it was written', async () => {
    failClient('client-1');
    const outcomes: any[] = [];

    const result = await importApplications({
      importData: importData(),
      resultCallback: (error, application) =>
        outcomes.push([error, application]),
      state: mockState(),
    });

    // the application was written ...
    expect(updateManagedObject).toHaveBeenCalledTimes(3);
    // ... but it is reported as failed and is not in the result
    expect(ids(result)).toEqual(['id-2', 'id-3']);
    expect(outcomes[0][1]).toBeUndefined();
    expect(outcomes[0][0].message).toBe(
      'Error importing alpha realm application matrix-one'
    );
    expect(outcomes[0][0].originalErrors).toHaveLength(1);
    expect(outcomes[0][0].originalErrors[0].message).toBe(
      'Error importing alpha realm dependencies'
    );
    expect(rootCause(outcomes[0][0])).toBe(failure);
  });

  test('a glossary that cannot be written makes the application a failed application, although it was written', async () => {
    putApplicationGlossary.mockImplementation(async (args: any) => {
      if (args.applicationId === 'id-3') throw failure;
      return { glossary: true };
    });
    const outcomes: any[] = [];

    const result = await importApplications({
      importData: importData(true),
      resultCallback: (error, application) =>
        outcomes.push([error, application]),
      state: mockState(true),
    });

    expect(updateManagedObject).toHaveBeenCalledTimes(3);
    expect(ids(result)).toEqual(['id-1', 'id-2']);
    expect(outcomes[2][0].message).toBe(
      'Error importing alpha realm application matrix-three'
    );
    expect(outcomes[2][0].originalErrors[0]).toBe(failure);
  });

  test('an application whose dependencies, glossary and write all fail is one failed application with every reason nested, in order', async () => {
    const glossaryFailure = new Error('glossary');
    const writeFailure = new Error('write');
    failClient('client-1');
    putApplicationGlossary.mockImplementation(async (args: any) => {
      if (args.applicationId === 'id-1') throw glossaryFailure;
      return { glossary: true };
    });
    failApplication('id-1', writeFailure);
    const outcomes: any[] = [];

    const result = await importApplications({
      importData: importData(true),
      resultCallback: (error, application) =>
        outcomes.push([error, application]),
      state: mockState(true),
    });

    expect(ids(result)).toEqual(['id-2', 'id-3']);
    expect(outcomes).toHaveLength(3);
    const reasons = outcomes[0][0].originalErrors;
    expect(reasons).toHaveLength(3);
    expect(reasons[0].message).toBe('Error importing alpha realm dependencies');
    expect(rootCause(reasons[0])).toBe(failure);
    expect(reasons[1]).toBe(glossaryFailure);
    expect(rootCause(reasons[2])).toBe(writeFailure);
  });

  test('with a callback and every application failing nothing is thrown and nothing is returned', async () => {
    updateManagedObject.mockRejectedValue(failure);
    const outcomes: any[] = [];

    const result = await importApplications({
      importData: importData(),
      resultCallback: (error, application) =>
        outcomes.push([error, application]),
      state: mockState(),
    });

    expect(result).toEqual([]);
    expect(outcomes.map(([error]) => error.message)).toEqual([
      'Error importing alpha realm application matrix-one',
      'Error importing alpha realm application matrix-two',
      'Error importing alpha realm application matrix-three',
    ]);
    expect(outcomes.every(([, application]) => application === undefined)).toBe(
      true
    );
  });

  test('without a callback every application is tried, then one combined error is thrown with the error of each failure', async () => {
    const glossaryFailure = new Error('glossary');
    const writeFailure = new Error('write');
    failClient('client-1');
    putApplicationGlossary.mockImplementation(async (args: any) => {
      if (args.applicationId === 'id-1') throw glossaryFailure;
      return { glossary: true };
    });
    failApplication('id-3', writeFailure);

    const error: any = await importApplications({
      importData: importData(true),
      state: mockState(true),
    }).catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm applications');
    // the errors as they were raised, in the order in which they happened: no
    // wrapper that names the application
    expect(error.originalErrors).toHaveLength(3);
    expect(error.originalErrors[0].message).toBe(
      'Error importing alpha realm dependencies'
    );
    expect(error.originalErrors[1]).toBe(glossaryFailure);
    expect(error.originalErrors[2].message).toBe(
      'Error updating alpha realm application id-3'
    );
    expect(rootCause(error.originalErrors[2])).toBe(writeFailure);
    expect(updateManagedObject).toHaveBeenCalledTimes(3);
  });

  test('every application is reported exactly once, in order, also when the callback throws', async () => {
    failApplication('id-2');
    const calls: string[] = [];
    const boom = new Error('callback failed');

    const error: any = await importApplications({
      importData: importData(),
      resultCallback: (failed, application) => {
        calls.push(failed ? failed.message : application._id);
        if (application?._id === 'id-1') throw boom;
      },
      state: mockState(),
    }).catch((e) => e);

    // the exception of the callback ends the run; it is not reported back as
    // a failed application
    expect(calls).toEqual(['id-1']);
    expect(rootCause(error)).toBe(boom);
    expect(updateManagedObject).toHaveBeenCalledTimes(1);
  });

  test('without the dependencies option no dependency is imported', async () => {
    await importApplications({
      importData: importData(),
      options: { deps: false },
      state: mockState(),
    });

    expect(importOAuth2Client).not.toHaveBeenCalled();
    expect(updateManagedObject).toHaveBeenCalledTimes(3);
  });

  test('import data without applications still throws, with a callback too', async () => {
    const callback = jest.fn();

    await expect(
      importApplications({
        importData: {} as any,
        resultCallback: callback,
        state: mockState(),
      })
    ).rejects.toBeDefined();
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('importApplications on the facade', () => {
  test('passes the result callback on', async () => {
    failApplication('id-2');
    const callback = jest.fn();

    const result = await ApplicationOps(mockState()).importApplications(
      importData(),
      undefined,
      callback
    );

    expect(ids(result)).toEqual(['id-1', 'id-3']);
    expect(callback).toHaveBeenCalledTimes(3);
    expect((callback.mock.calls[1][0] as any).message).toBe(
      'Error importing alpha realm application matrix-two'
    );
  });

  test('without a callback it throws one combined error as before', async () => {
    failApplication('id-2');

    const error: any = await ApplicationOps(mockState())
      .importApplications(importData(), undefined)
      .catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm applications');
    expect(updateManagedObject).toHaveBeenCalledTimes(3);
  });
});
