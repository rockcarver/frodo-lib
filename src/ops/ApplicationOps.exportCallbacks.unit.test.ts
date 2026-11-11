import { jest } from '@jest/globals';

/**
 * `exportApplications` tries every application. Without a result callback the
 * failures are collected and thrown as one combined error; with one, every
 * outcome is reported to it as it happens (a failed application as an error
 * that names it), a failed application does not throw and is not part of the
 * export, and a failure to read the applications still throws.
 * Mocked unit test: no recordings.
 */

const exportOAuth2Client = jest.fn(async (_args?: any): Promise<any> => ({}));
jest.unstable_mockModule('./OAuth2ClientOps', () => ({
  deleteOAuth2Client: jest.fn(),
  exportOAuth2Client,
  getOAuth2ClientScriptReferences: jest.fn(() => []),
  importOAuth2Client: jest.fn(),
  readOAuth2Client: jest.fn(),
}));

const readManagedObjects = jest.fn(async (_args?: any): Promise<any> => []);
jest.unstable_mockModule('./ManagedObjectOps', () => ({
  createManagedObject: jest.fn(),
  deleteManagedObject: jest.fn(),
  queryManagedObjects: jest.fn(),
  readManagedObject: jest.fn(),
  readManagedObjects,
  updateManagedObject: jest.fn(),
}));

const getApplicationGlossary = jest.fn(async (_args?: any): Promise<any> => ({
  glossary: true,
}));
const actualGlossaryApi = await import('../api/cloud/iga/IgaGlossaryApi');
jest.unstable_mockModule('../api/cloud/iga/IgaGlossaryApi', () => ({
  ...actualGlossaryApi,
  getApplicationGlossary,
}));

const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  createProgressIndicator: jest.fn(() => 'progress-id'),
  debugMessage: jest.fn(),
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
}));

const actualExportImportUtils = await import('../utils/ExportImportUtils');
jest.unstable_mockModule('../utils/ExportImportUtils', () => ({
  ...actualExportImportUtils,
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));

const { exportApplications } = await import('./ApplicationOps');

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

/** The messages of an error and of everything nested in it. */
function messagesOf(error: any): string {
  return [error?.message, ...(error?.originalErrors ?? []).map(messagesOf)]
    .filter(Boolean)
    .join(' | ');
}

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

/** three OIDC applications and one bookmark application */
const applications = () => [
  { _id: 'id-1', name: 'matrix-one', ssoEntities: { oidcId: 'client-1' } },
  { _id: 'id-2', name: 'matrix-two', ssoEntities: { oidcId: 'client-2' } },
  { _id: 'id-3', name: 'matrix-three', ssoEntities: { oidcId: 'client-3' } },
  { _id: 'id-4', name: 'matrix-four' },
];

let failure: Error;

beforeEach(() => {
  failure = new Error('HTTP 404');
  jest.clearAllMocks();
  readManagedObjects.mockReset();
  readManagedObjects.mockImplementation(async () => applications());
  exportOAuth2Client.mockReset();
  exportOAuth2Client.mockImplementation(async ({ clientId }: any) => ({
    application: { [clientId]: { _id: clientId } },
    script: { [`script-of-${clientId}`]: { _id: `script-of-${clientId}` } },
  }));
  getApplicationGlossary.mockReset();
  getApplicationGlossary.mockResolvedValue({ glossary: true });
});

/** the dependency of an application cannot be exported */
const failClient = (clientId: string) =>
  exportOAuth2Client.mockImplementation(async (args: any) => {
    if (args.clientId === clientId) throw failure;
    return {
      application: { [args.clientId]: { _id: args.clientId } },
      script: {},
    };
  });

const options = { deps: true, useStringArrays: true };

describe('exportApplications', () => {
  test('exports the applications with their dependencies, without a callback', async () => {
    const exported = await exportApplications({ options, state: mockState() });

    expect(Object.keys(exported.managedApplication)).toEqual([
      'id-1',
      'id-2',
      'id-3',
      'id-4',
    ]);
    expect(Object.keys((exported as any).application)).toEqual([
      'client-1',
      'client-2',
      'client-3',
    ]);
  });

  test('with a callback every application is reported once, in order, as the application that was read', async () => {
    const outcomes: any[] = [];

    const exported = await exportApplications({
      options,
      resultCallback: (error, application) =>
        outcomes.push([error, application]),
      state: mockState(),
    });

    expect(outcomes).toHaveLength(4);
    expect(outcomes.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map(([, application]) => application._id)).toEqual([
      'id-1',
      'id-2',
      'id-3',
      'id-4',
    ]);
    expect(outcomes[1][1]).toBe(exported.managedApplication['id-2']);
  });

  test('with a callback a failed application is reported with its name and is not exported, the others are, nothing is thrown', async () => {
    failClient('client-2');
    const outcomes: any[] = [];

    const exported = await exportApplications({
      options,
      resultCallback: (error, application) =>
        outcomes.push([error, application]),
      state: mockState(),
    });

    expect(exportOAuth2Client).toHaveBeenCalledTimes(3);
    expect(outcomes).toHaveLength(4);
    expect(outcomes[0][1]._id).toBe('id-1');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(
      'Error exporting alpha realm application matrix-two'
    );
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][1]._id).toBe('id-3');
    expect(outcomes[3][1]._id).toBe('id-4');
    expect(Object.keys(exported.managedApplication)).toEqual([
      'id-1',
      'id-3',
      'id-4',
    ]);
  });

  test('with a callback every failure is reported once when all applications with dependencies fail', async () => {
    exportOAuth2Client.mockRejectedValue(failure);
    const errors: any[] = [];
    const successes: any[] = [];

    const exported = await exportApplications({
      options,
      resultCallback: (error, application) =>
        error ? errors.push(error) : successes.push(application),
      state: mockState(),
    });

    expect(errors.map((error) => error.message)).toEqual([
      'Error exporting alpha realm application matrix-one',
      'Error exporting alpha realm application matrix-two',
      'Error exporting alpha realm application matrix-three',
    ]);
    // the bookmark application has no dependency and cannot fail
    expect(successes.map((application) => application._id)).toEqual(['id-4']);
    expect(Object.keys(exported.managedApplication)).toEqual(['id-4']);
  });

  test('without a callback every application is tried and the failures are thrown as one combined error', async () => {
    failClient('client-2');

    const error: any = await exportApplications({
      options,
      state: mockState(),
    }).catch((e) => e);

    expect(exportOAuth2Client).toHaveBeenCalledTimes(3);
    expect(error.message).toBe('Error exporting alpha realm applications');
    expect(error.originalErrors).toHaveLength(1);
    // the error of the dependencies, as before
    expect(error.originalErrors[0].message).toBe(
      'Error exporting alpha realm dependencies'
    );
    expect(rootCause(error)).toBe(failure);
  });

  test('an application without its glossary is a failed application', async () => {
    getApplicationGlossary.mockImplementation(
      async ({ applicationId }: any) => {
        if (applicationId === 'id-3') throw failure;
        return { glossary: true };
      }
    );
    const outcomes: any[] = [];

    const exported = await exportApplications({
      options: { deps: false, useStringArrays: true },
      resultCallback: (error, application) =>
        outcomes.push([error, application]),
      state: mockState(true),
    });

    expect(outcomes).toHaveLength(4);
    expect(outcomes[2][1]).toBeUndefined();
    expect(outcomes[2][0].message).toBe(
      'Error exporting alpha realm application matrix-three'
    );
    expect(rootCause(outcomes[2][0])).toBe(failure);
    expect(Object.keys(exported.managedApplication)).toEqual([
      'id-1',
      'id-2',
      'id-4',
    ]);
  });

  test('an application whose glossary and dependencies both fail is one failed application with both reasons', async () => {
    getApplicationGlossary.mockRejectedValue(failure);
    exportOAuth2Client.mockRejectedValue(new Error('HTTP 500'));
    const outcomes: any[] = [];

    await exportApplications({
      options,
      resultCallback: (error, application) =>
        outcomes.push([error, application]),
      state: mockState(true),
    });

    expect(outcomes).toHaveLength(4);
    expect(outcomes[0][0].originalErrors).toHaveLength(2);
    expect(messagesOf(outcomes[0][0])).toContain('HTTP 404');
    expect(messagesOf(outcomes[0][0])).toContain('HTTP 500');
  });

  test('does not read the dependencies when they are not asked for', async () => {
    const exported = await exportApplications({
      options: { deps: false, useStringArrays: true },
      state: mockState(),
    });

    expect(exportOAuth2Client).not.toHaveBeenCalled();
    expect(Object.keys(exported.managedApplication)).toHaveLength(4);
  });

  test('a failure to read the applications still throws, with and without a callback', async () => {
    readManagedObjects.mockRejectedValue(new Error('HTTP 500'));
    const callback = jest.fn();

    const withCallback: any = await exportApplications({
      options,
      resultCallback: callback,
      state: mockState(),
    }).catch((e) => e);
    const without: any = await exportApplications({
      options,
      state: mockState(),
    }).catch((e) => e);

    expect(withCallback.message).toBe(
      'Error exporting alpha realm applications'
    );
    expect(without.message).toBe('Error exporting alpha realm applications');
    expect(callback).not.toHaveBeenCalled();
  });

  test('an exception of the callback is not reported to the callback as a failed application', async () => {
    const callback = jest.fn((_error?: any, _application?: any) => {
      throw new Error('callback bug');
    });

    const error: any = await exportApplications({
      options,
      resultCallback: callback,
      state: mockState(),
    }).catch((e) => e);

    expect(error.message).toBe('Error exporting alpha realm applications');
    expect(rootCause(error).message).toBe('callback bug');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeUndefined();
  });
});

describe('the facade', () => {
  test('exportApplications passes the callback on', async () => {
    const { default: Application } = await import('./ApplicationOps');
    failClient('client-2');
    const outcomes: any[] = [];

    await Application(mockState()).exportApplications(
      options,
      (error, application) => outcomes.push([error, application])
    );

    expect(outcomes).toHaveLength(4);
    expect(outcomes[1][0].message).toBe(
      'Error exporting alpha realm application matrix-two'
    );
  });
});
