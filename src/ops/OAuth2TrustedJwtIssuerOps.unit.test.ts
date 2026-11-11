import { jest } from '@jest/globals';
import type { OAuth2TrustedJwtIssuerSkeleton } from '../api/OAuth2TrustedJwtIssuerApi';
import { getHelpMetadataByMethod } from '../utils/HelpUtils';
import type { OAuth2TrustedJwtIssuerExportInterface } from './OAuth2TrustedJwtIssuerOps';

/**
 * Unit tests for the trusted JWT issuer ops module. The api layer is replaced
 * by mocks; no recording, no tenant.
 */

const getOAuth2TrustedJwtIssuers = jest.fn(
  async (_args?: any): Promise<any> => ({ result: [] })
);
const getOAuth2TrustedJwtIssuer = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const putOAuth2TrustedJwtIssuer = jest.fn(
  async (args?: any): Promise<any> => args.issuerData
);
const deleteOAuth2TrustedJwtIssuerApi = jest.fn(
  async (_args?: any): Promise<any> => ({})
);

jest.unstable_mockModule('../api/OAuth2TrustedJwtIssuerApi', () => ({
  deleteOAuth2TrustedJwtIssuer: deleteOAuth2TrustedJwtIssuerApi,
  getOAuth2TrustedJwtIssuer,
  getOAuth2TrustedJwtIssuers,
  putOAuth2TrustedJwtIssuer,
}));

const {
  importFirstOAuth2TrustedJwtIssuer,
  importOAuth2TrustedJwtIssuer,
  importOAuth2TrustedJwtIssuers,
  updateOAuth2TrustedJwtIssuer,
} = await import('./OAuth2TrustedJwtIssuerOps');

const printed: { message: any; type: string }[] = [];

function mockState({
  realm = 'alpha',
  deployment = 'cloud',
  verbose = false,
  debug = false,
} = {}) {
  return {
    getRealm: () => realm,
    getHost: () => 'https://openam-matrix.example.com/am',
    getDebugHandler: () => undefined,
    getPrintHandler: () => (message: any, type: string) =>
      printed.push({ message, type }),
    getVerbose: () => verbose,
    getDebug: () => debug,
    getDeploymentType: () => deployment,
    getAuthMode: () => 'noninteractive',
    getUseBearerTokenForAmApis: () => false,
  } as any;
}

function sampleIssuer(id = 'matrix-issuer'): OAuth2TrustedJwtIssuerSkeleton {
  return {
    _id: id,
    _rev: '-1',
    _provider: { _id: 'matrix-provider' },
    _type: {
      _id: 'TrustedJwtIssuer',
      name: 'OAuth2 Trusted JWT Issuer',
      collection: true,
    },
    issuer: `https://idp-${id}.matrix.example.com`,
    allowedSubjects: ['neo', 'trinity'],
    jwkSet: '{"keys":[]}',
  } as OAuth2TrustedJwtIssuerSkeleton;
}

function sampleExport(...ids: string[]): OAuth2TrustedJwtIssuerExportInterface {
  const trustedJwtIssuer: Record<string, OAuth2TrustedJwtIssuerSkeleton> = {};
  for (const id of ids) trustedJwtIssuer[id] = sampleIssuer(id);
  return { trustedJwtIssuer };
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/** The 400 of a server that does not know an attribute of the body. */
function invalidAttributeError(validAttributes: string[]) {
  return {
    response: {
      status: 400,
      data: {
        code: 400,
        message: 'Invalid attribute specified.',
        detail: { validAttributes: [...validAttributes] },
      },
    },
  };
}

const VALID_ATTRIBUTES = [
  'issuer',
  'allowedSubjects',
  'jwksUri',
  'jwkSet',
  'consentedScopesClaim',
  'resourceOwnerIdentityClaim',
  'jwksCacheTimeout',
  'jwkStoreCacheMissCacheTime',
];

beforeEach(() => {
  printed.length = 0;
  putOAuth2TrustedJwtIssuer.mockReset();
  putOAuth2TrustedJwtIssuer.mockImplementation(
    async (args?: any) => args.issuerData
  );
});

describe('the module does not modify what the caller hands in', () => {
  test('importOAuth2TrustedJwtIssuer(id)', async () => {
    const importData = sampleExport('matrix-one', 'matrix-two');
    const before = copy(importData);

    await importOAuth2TrustedJwtIssuer({
      issuerId: 'matrix-two',
      importData,
      state: mockState(),
    });

    expect(importData).toEqual(before);
    expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(1);
    const sent = putOAuth2TrustedJwtIssuer.mock.calls[0][0].issuerData;
    expect(sent._id).toBe('matrix-two');
    expect(sent).not.toHaveProperty('_rev');
    expect(sent).not.toHaveProperty('_provider');
  });

  test('importFirstOAuth2TrustedJwtIssuer', async () => {
    const importData = sampleExport('matrix-one', 'matrix-two');
    const before = copy(importData);

    await importFirstOAuth2TrustedJwtIssuer({
      importData,
      state: mockState(),
    });

    expect(importData).toEqual(before);
    expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(1);
    const sent = putOAuth2TrustedJwtIssuer.mock.calls[0][0].issuerData;
    expect(sent._id).toBe('matrix-one');
    expect(sent).not.toHaveProperty('_rev');
    expect(sent).not.toHaveProperty('_provider');
  });

  test('importOAuth2TrustedJwtIssuers', async () => {
    const importData = sampleExport('matrix-one', 'matrix-two');
    const before = copy(importData);

    await importOAuth2TrustedJwtIssuers({ importData, state: mockState() });

    expect(importData).toEqual(before);
    expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(2);
    for (const [args] of putOAuth2TrustedJwtIssuer.mock.calls) {
      expect(args.issuerData).not.toHaveProperty('_rev');
      expect(args.issuerData).not.toHaveProperty('_provider');
    }
  });

  test('an export object imported twice sends the same two bodies', async () => {
    const importData = sampleExport('matrix-one');
    const state = mockState();

    await importOAuth2TrustedJwtIssuers({ importData, state });
    await importOAuth2TrustedJwtIssuers({ importData, state });

    const [first, second] = putOAuth2TrustedJwtIssuer.mock.calls.map(
      ([args]) => args
    );
    expect(second).toEqual(first);
    expect(first.issuerData).toEqual({
      ...sampleIssuer('matrix-one'),
      _rev: undefined,
      _provider: undefined,
    });
    // The first import left the object as the second one needs it.
    expect(importData).toEqual(sampleExport('matrix-one'));
  });

  test('updateOAuth2TrustedJwtIssuer', async () => {
    const issuerData = sampleIssuer();
    const before = copy(issuerData);

    await updateOAuth2TrustedJwtIssuer({
      issuerId: 'matrix-issuer',
      issuerData,
      state: mockState(),
    });

    expect(issuerData).toEqual(before);
  });
});

describe('the retry after "Invalid attribute specified."', () => {
  test('sends the cleaned copy once and the caller keeps the rejected attribute', async () => {
    const failure = invalidAttributeError(VALID_ATTRIBUTES);
    putOAuth2TrustedJwtIssuer.mockRejectedValueOnce(failure);
    const issuerData = sampleIssuer();
    const before = copy(issuerData);

    await updateOAuth2TrustedJwtIssuer({
      issuerId: 'matrix-issuer',
      issuerData,
      state: mockState(),
    });

    // the caller's object is as it was, and so is the answer of the server
    expect(issuerData).toEqual(before);
    expect(failure.response.data.detail.validAttributes).toEqual(
      VALID_ATTRIBUTES
    );
    expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(2);
    const first = putOAuth2TrustedJwtIssuer.mock.calls[0][0].issuerData;
    const second = putOAuth2TrustedJwtIssuer.mock.calls[1][0].issuerData;
    expect(first).toBe(issuerData);
    expect(second).not.toBe(issuerData);
    // the attributes of nested objects that the server does not list are
    // gone from the copy (_id is always kept)
    expect(second._type).toEqual({ _id: 'TrustedJwtIssuer' });
    expect(second.issuer).toBe(issuerData.issuer);
  });

  test('says which attribute it removes, whatever the verbosity', async () => {
    putOAuth2TrustedJwtIssuer.mockRejectedValueOnce(
      invalidAttributeError(VALID_ATTRIBUTES)
    );

    await updateOAuth2TrustedJwtIssuer({
      issuerId: 'matrix-issuer',
      issuerData: sampleIssuer(),
      state: mockState({ verbose: false, debug: false }),
    });

    const warnings = printed.filter((p) => p.type === 'warn');
    expect(warnings.map((w) => w.message)).toEqual([
      expect.stringContaining('matrix-issuer: _type.name'),
      expect.stringContaining('matrix-issuer: _type.collection'),
    ]);
  });

  test('does not take the elements of an array for attributes and does not fail on null', async () => {
    putOAuth2TrustedJwtIssuer.mockRejectedValueOnce(
      invalidAttributeError(VALID_ATTRIBUTES)
    );
    const issuerData = {
      ...sampleIssuer(),
      jwksUri: null,
      allowedSubjects: ['neo', 'trinity'],
    } as OAuth2TrustedJwtIssuerSkeleton;

    await updateOAuth2TrustedJwtIssuer({
      issuerId: 'matrix-issuer',
      issuerData,
      state: mockState(),
    });

    expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(2);
    const second = putOAuth2TrustedJwtIssuer.mock.calls[1][0].issuerData;
    expect(second.allowedSubjects).toEqual(['neo', 'trinity']);
    expect(second.jwksUri).toBeNull();
  });

  test('a failing second request is an error that names the issuer', async () => {
    const failure = invalidAttributeError(VALID_ATTRIBUTES);
    putOAuth2TrustedJwtIssuer.mockRejectedValue(failure);

    await expect(
      updateOAuth2TrustedJwtIssuer({
        issuerId: 'matrix-issuer',
        issuerData: sampleIssuer(),
        state: mockState(),
      })
    ).rejects.toThrow(
      'Error updating alpha realm trusted issuer matrix-issuer'
    );
    expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(2);
  });
});

describe('the generated help describes issuers, not OAuth2 clients', () => {
  test.each([
    'importOAuth2TrustedJwtIssuer',
    'importFirstOAuth2TrustedJwtIssuer',
    'importOAuth2TrustedJwtIssuers',
  ])('%s', (methodName) => {
    const docs = getHelpMetadataByMethod(methodName);
    expect(docs).toHaveLength(1);
    expect(docs[0].description).toMatch(/trusted jwt issuer/i);
    expect(JSON.stringify(docs[0])).not.toMatch(/client/i);
  });

  test('the options that have no effect say so', () => {
    for (const methodName of [
      'exportOAuth2TrustedJwtIssuers',
      'exportOAuth2TrustedJwtIssuer',
      'importOAuth2TrustedJwtIssuer',
      'importFirstOAuth2TrustedJwtIssuer',
      'importOAuth2TrustedJwtIssuers',
    ]) {
      const [doc] = getHelpMetadataByMethod(methodName);
      const options = doc.params.find((p) => p.name === 'options');
      expect(options?.required).toBe(false);
      expect(options?.description).toMatch(/deprecated, has no effect/);
    }
  });

  test('the export methods are documented as promises', () => {
    for (const methodName of [
      'exportOAuth2TrustedJwtIssuers',
      'exportOAuth2TrustedJwtIssuer',
    ]) {
      const [doc] = getHelpMetadataByMethod(methodName);
      expect(doc.returns).toMatch(/^\{Promise</);
    }
  });
});
