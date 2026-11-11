import { jest } from '@jest/globals';

/**
 * `exportCirclesOfTrust` and the two answers that a tenant gives when it cannot hand out circles of trust:
 *
 * - "This operation is not available in PingOne Advanced Identity Cloud." (HTTP 403) exports none and throws nothing;
 *   a debug message names the skipped operation and the request, so the calls can be audited.
 * - A credential that lacks a scope is a failure: the function throws, and the code INSUFFICIENT_SCOPE is found in the
 *   error chain. Through the shared helper that the full configuration export uses, the failure is an item that the
 *   result callback gets.
 *
 * Mocked unit test: no recordings, no tenant.
 */

const getCirclesOfTrust = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));

const actualApi = await import('../api/CirclesOfTrustApi');
jest.unstable_mockModule('../api/CirclesOfTrustApi', () => ({
  ...actualApi,
  getCirclesOfTrust,
}));

const debugMessage = jest.fn();
const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  createProgressIndicator: jest.fn(() => 'progress-id'),
  debugMessage,
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
}));

const actualExportImportUtils = await import('../utils/ExportImportUtils');
jest.unstable_mockModule('../utils/ExportImportUtils', () => ({
  ...actualExportImportUtils,
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));

const { exportCirclesOfTrust } = await import('./CirclesOfTrustOps');
const { exportWithErrorHandling } = await import('../utils/ExportImportUtils');
const { InsufficientScopeError } = await import('./RequiredScopesOps');

const state = {
  getRealm: () => 'alpha',
  getDeploymentType: () => 'cloud',
  getDebugHandler: () => undefined,
} as any;

/** What the api layer raises when the cloud says that the operation is not available. */
function notAvailable(): Error {
  return Object.assign(new Error('Forbidden'), {
    name: 'AxiosError',
    config: {
      url: 'https://example.com/am/json/realms/root/realms/alpha/realm-config/federation/circlesoftrust',
      method: 'get',
    },
    response: {
      status: 403,
      data: {
        message:
          'This operation is not available in PingOne Advanced Identity Cloud.',
      },
    },
  });
}

function missingScope(): Error {
  return new InsufficientScopeError(
    'This operation requires scope(s) [fr:am:*], which the current session does not carry.',
    null,
    'INSUFFICIENT_SCOPE'
  );
}

/** The error and every error nested in it. */
function chainOf(error: any): any[] {
  return [error, ...(error?.originalErrors ?? []).flatMap(chainOf)];
}

beforeEach(() => {
  jest.clearAllMocks();
  getCirclesOfTrust.mockReset();
  getCirclesOfTrust.mockImplementation(async () => ({ result: [] }));
});

describe('exportCirclesOfTrust when the operation is not available in the cloud', () => {
  beforeEach(() => {
    getCirclesOfTrust.mockImplementation(async () => {
      throw notAvailable();
    });
  });

  test('exports none and throws nothing', async () => {
    const exported = await exportCirclesOfTrust({ state });

    expect(exported.saml.cot).toEqual({});
  });

  test('writes one debug message that names the operation and the request', async () => {
    await exportCirclesOfTrust({ state });

    const skipped = debugMessage.mock.calls
      .map(([args]: any[]) => String(args.message))
      .filter((message) => message.includes('skipped'));
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toContain('CirclesOfTrustOps.exportCirclesOfTrust');
    expect(skipped[0]).toContain('circles of trust');
    expect(skipped[0]).toContain(
      'not available in PingOne Advanced Identity Cloud'
    );
    expect(skipped[0]).toContain(
      'GET https://example.com/am/json/realms/root/realms/alpha/realm-config/federation/circlesoftrust'
    );
    expect(
      debugMessage.mock.calls.every(([args]: any[]) => args.state === state)
    ).toBe(true);
  });

  test('through the shared helper it is a success with an empty export, reported once', async () => {
    const resultCallback = jest.fn();

    const exported = await exportWithErrorHandling(
      exportCirclesOfTrust,
      { state },
      'Circle of Trusts',
      resultCallback
    );

    expect(exported?.saml.cot).toEqual({});
    expect(resultCallback).toHaveBeenCalledTimes(1);
    expect(resultCallback).toHaveBeenCalledWith(undefined, exported);
  });
});

describe('exportCirclesOfTrust when the credential lacks a scope', () => {
  beforeEach(() => {
    getCirclesOfTrust.mockImplementation(async () => {
      throw missingScope();
    });
  });

  test('throws an error that names the realm and carries the cause and the code', async () => {
    const error: any = await exportCirclesOfTrust({ state }).catch((e) => e);

    expect(error.message).toBe('Error exporting alpha realm circles of trust');
    expect(chainOf(error).some((e) => e.code === 'INSUFFICIENT_SCOPE')).toBe(
      true
    );
    expect(
      chainOf(error).some((e) => e instanceof InsufficientScopeError)
    ).toBe(true);
  });

  test('writes no skip message', async () => {
    await exportCirclesOfTrust({ state }).catch(() => undefined);

    expect(
      debugMessage.mock.calls.filter(([args]: any[]) =>
        String(args.message).includes('skipped')
      )
    ).toHaveLength(0);
  });

  test('through the shared helper it is a failed item: the callback gets one error that names the item, with the code', async () => {
    const resultCallback = jest.fn();

    const exported = await exportWithErrorHandling(
      exportCirclesOfTrust,
      { state },
      'Circle of Trusts',
      resultCallback
    );

    expect(exported).toBeNull();
    expect(resultCallback).toHaveBeenCalledTimes(1);
    const [error, value] = resultCallback.mock.calls[0] as [any, unknown];
    expect(error.message).toBe('Error Exporting Circle of Trusts');
    expect(error.code).toBe('INSUFFICIENT_SCOPE');
    expect(chainOf(error).length).toBeGreaterThan(2);
    expect(value).toBeUndefined();
  });

  test('through the shared helper without a callback it is thrown', async () => {
    const error: any = await exportWithErrorHandling(
      exportCirclesOfTrust,
      { state },
      'Circle of Trusts'
    ).catch((e) => e);

    expect(error.message).toBe('Error Exporting Circle of Trusts');
    expect(error.code).toBe('INSUFFICIENT_SCOPE');
  });
});

describe('exportCirclesOfTrust when the read fails for another reason', () => {
  test('a 403 with another message throws', async () => {
    getCirclesOfTrust.mockImplementation(async () => {
      throw Object.assign(new Error('Forbidden'), {
        name: 'AxiosError',
        response: { status: 403, data: { message: 'Forbidden' } },
      });
    });

    const error: any = await exportCirclesOfTrust({ state }).catch((e) => e);

    expect(error.message).toBe('Error exporting alpha realm circles of trust');
    expect(error.originalErrors).toHaveLength(1);
  });
});
