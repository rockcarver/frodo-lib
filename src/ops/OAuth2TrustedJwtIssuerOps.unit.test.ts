import { jest } from '@jest/globals';
import type { OAuth2TrustedJwtIssuerSkeleton } from '../api/OAuth2TrustedJwtIssuerApi';
import { getHelpMetadataByMethod } from '../utils/HelpUtils';
import { FrodoError, isNotFoundError } from './FrodoError';
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
  default: OAuth2TrustedJwtIssuerOps,
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
    getAmVersion: () => '7.5.0',
    getUsername: () => 'matrix-admin',
    getFrodoVersion: () => '5.0.0-test',
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

const CLOUD_ONLY_MESSAGE =
  'This operation is not available in PingOne Advanced Identity Cloud.';

/** What the api layer rejects with when a request fails. */
function requestError(status: number, message: string) {
  return { response: { status, data: { message } } };
}

/** Run a call that must reject and return what it rejected with. */
async function rejection(call: () => Promise<unknown>): Promise<FrodoError> {
  return call().then(
    () => {
      throw new Error('expected a rejection');
    },
    (error) => error
  );
}

beforeEach(() => {
  printed.length = 0;
  getOAuth2TrustedJwtIssuers.mockReset();
  getOAuth2TrustedJwtIssuer.mockReset();
  deleteOAuth2TrustedJwtIssuerApi.mockReset();
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

describe('readOAuth2TrustedJwtIssuers', () => {
  test('passes the list through', async () => {
    const issuers = [sampleIssuer('matrix-one'), sampleIssuer('matrix-two')];
    getOAuth2TrustedJwtIssuers.mockResolvedValue({ result: issuers });

    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    await expect(ops.readOAuth2TrustedJwtIssuers()).resolves.toBe(issuers);
    expect(getOAuth2TrustedJwtIssuers).toHaveBeenCalledWith({
      state: expect.anything(),
    });
  });

  test('the Cloud root realm (403 with the Cloud message) has no issuers', async () => {
    getOAuth2TrustedJwtIssuers.mockRejectedValue(
      requestError(403, CLOUD_ONLY_MESSAGE)
    );
    const ops = OAuth2TrustedJwtIssuerOps(
      mockState({ realm: '/', deployment: 'cloud' })
    );
    await expect(ops.readOAuth2TrustedJwtIssuers()).resolves.toEqual([]);
  });

  test.each([
    ['a 403 with another message', requestError(403, 'Forbidden')],
    ['a 500', requestError(500, 'Server Error')],
    // Characterisation: unlike the generic agent reads there is no type list
    // here, so a deployment that does not know the type fails.
    ['a 404', requestError(404, 'Not Found')],
  ])(
    '%s is an error that names the realm and keeps the cause',
    async (_name, failure) => {
      getOAuth2TrustedJwtIssuers.mockRejectedValue(failure);
      const ops = OAuth2TrustedJwtIssuerOps(mockState({ realm: 'alpha' }));

      const error = await rejection(() => ops.readOAuth2TrustedJwtIssuers());
      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe('Error reading alpha realm trusted issuers');
      expect(error.originalErrors[0]).toBe(failure);
    }
  );
});

describe('readOAuth2TrustedJwtIssuer', () => {
  test('passes the issuer through', async () => {
    const issuer = sampleIssuer('matrix-one');
    getOAuth2TrustedJwtIssuer.mockResolvedValue(issuer);

    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    await expect(ops.readOAuth2TrustedJwtIssuer('matrix-one')).resolves.toBe(
      issuer
    );
    expect(getOAuth2TrustedJwtIssuer).toHaveBeenCalledWith({
      id: 'matrix-one',
      state: expect.anything(),
    });
  });

  test('a failure names the issuer and keeps the cause', async () => {
    const failure = requestError(404, 'Not Found');
    getOAuth2TrustedJwtIssuer.mockRejectedValue(failure);

    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const error = await rejection(() =>
      ops.readOAuth2TrustedJwtIssuer('matrix-one')
    );
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(
      'Error reading alpha realm trusted issuer matrix-one'
    );
    expect(error.originalErrors[0]).toBe(failure);
    expect(isNotFoundError(error)).toBe(true);
  });
});

describe('createOAuth2TrustedJwtIssuer', () => {
  test('an existing issuer is "already exists!" and nothing is written', async () => {
    getOAuth2TrustedJwtIssuer.mockResolvedValue(sampleIssuer('matrix-one'));

    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const error = await rejection(() =>
      ops.createOAuth2TrustedJwtIssuer('matrix-one', sampleIssuer('matrix-one'))
    );
    expect(error.message).toBe(
      'alpha realm trusted issuer matrix-one already exists!'
    );
    expect(putOAuth2TrustedJwtIssuer).not.toHaveBeenCalled();
  });

  test('a 404 on the existence check writes the issuer once', async () => {
    getOAuth2TrustedJwtIssuer.mockRejectedValue(requestError(404, 'Not Found'));
    const issuer = sampleIssuer('matrix-one');

    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    await expect(
      ops.createOAuth2TrustedJwtIssuer('matrix-one', issuer)
    ).resolves.toBe(issuer);
    expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(1);
    expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledWith({
      id: 'matrix-one',
      issuerData: issuer,
      state: expect.anything(),
    });
  });

  test('another failure of the existence check is not "does not exist": nothing is written', async () => {
    getOAuth2TrustedJwtIssuer.mockRejectedValue(
      requestError(500, 'Server Error')
    );

    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const error = await rejection(() =>
      ops.createOAuth2TrustedJwtIssuer('matrix-one', sampleIssuer('matrix-one'))
    );
    expect(error.message).toBe(
      'Error checking if alpha realm trusted issuer matrix-one already exists'
    );
    expect(putOAuth2TrustedJwtIssuer).not.toHaveBeenCalled();
  });

  test('a failing write is an error that names the issuer', async () => {
    getOAuth2TrustedJwtIssuer.mockRejectedValue(requestError(404, 'Not Found'));
    putOAuth2TrustedJwtIssuer.mockRejectedValue(
      requestError(500, 'Server Error')
    );

    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const error = await rejection(() =>
      ops.createOAuth2TrustedJwtIssuer('matrix-one', sampleIssuer('matrix-one'))
    );
    expect(error.message).toBe(
      'Error creating alpha realm trusted issuer matrix-one'
    );
  });
});

describe('updateOAuth2TrustedJwtIssuer', () => {
  test('passes the answer of the server through', async () => {
    const answer = { ...sampleIssuer('matrix-one'), _rev: '-2' };
    putOAuth2TrustedJwtIssuer.mockResolvedValue(answer);

    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    await expect(
      ops.updateOAuth2TrustedJwtIssuer('matrix-one', sampleIssuer('matrix-one'))
    ).resolves.toBe(answer);
    expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(1);
    expect(putOAuth2TrustedJwtIssuer.mock.calls[0][0].id).toBe('matrix-one');
  });

  test('a 400 with another message is an error, not a retry', async () => {
    const failure = requestError(400, 'Invalid attribute value syntax');
    putOAuth2TrustedJwtIssuer.mockRejectedValue(failure);

    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const error = await rejection(() =>
      ops.updateOAuth2TrustedJwtIssuer('matrix-one', sampleIssuer('matrix-one'))
    );
    expect(error.message).toBe(
      'Error updating alpha realm trusted issuer matrix-one'
    );
    expect(error.originalErrors[0]).toBe(failure);
    expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(1);
  });
});

describe('deleteOAuth2TrustedJwtIssuer', () => {
  test('returns what the api layer returns', async () => {
    const deleted = sampleIssuer('matrix-issuer');
    deleteOAuth2TrustedJwtIssuerApi.mockResolvedValue(deleted);

    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    await expect(
      ops.deleteOAuth2TrustedJwtIssuer('matrix-issuer')
    ).resolves.toBe(deleted);
    expect(deleteOAuth2TrustedJwtIssuerApi).toHaveBeenCalledWith({
      id: 'matrix-issuer',
      state: expect.anything(),
    });
  });

  test('a failed delete rejects with a FrodoError that names the realm and the issuer and keeps the cause', async () => {
    const failure = requestError(404, 'Not Found');
    deleteOAuth2TrustedJwtIssuerApi.mockRejectedValue(failure);

    const ops = OAuth2TrustedJwtIssuerOps(mockState({ realm: 'alpha' }));
    const error = await rejection(() =>
      ops.deleteOAuth2TrustedJwtIssuer('matrix-issuer')
    );

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(
      'Error deleting alpha realm trusted issuer matrix-issuer'
    );
    expect(error.originalErrors[0]).toBe(failure);
    expect(error.httpStatus).toBe(404);
    expect(isNotFoundError(error)).toBe(true);
  });

  test('the message names the realm of the state', async () => {
    deleteOAuth2TrustedJwtIssuerApi.mockRejectedValue(
      requestError(500, 'Server Error')
    );
    const ops = OAuth2TrustedJwtIssuerOps(
      mockState({ realm: '/', deployment: 'forgeops' })
    );
    await expect(
      ops.deleteOAuth2TrustedJwtIssuer('zion-issuer')
    ).rejects.toThrow('Error deleting / realm trusted issuer zion-issuer');
  });
});

describe('deleteOAuth2TrustedJwtIssuers', () => {
  test('deletes every issuer and returns them when nothing fails', async () => {
    getOAuth2TrustedJwtIssuers.mockResolvedValue({
      result: [{ _id: 'matrix-one' }, { _id: 'matrix-two' }],
    });
    deleteOAuth2TrustedJwtIssuerApi.mockImplementation(
      async ({ id }: { id: string }) => ({ _id: id })
    );

    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    await expect(ops.deleteOAuth2TrustedJwtIssuers()).resolves.toEqual([
      { _id: 'matrix-one' },
      { _id: 'matrix-two' },
    ]);
  });

  test('one failing delete of two: the error names the failed issuer, the other one is deleted', async () => {
    getOAuth2TrustedJwtIssuers.mockResolvedValue({
      result: [{ _id: 'matrix-one' }, { _id: 'matrix-two' }],
    });
    const failure = requestError(500, 'Server Error');
    deleteOAuth2TrustedJwtIssuerApi.mockImplementation(
      async ({ id }: { id: string }) => {
        if (id === 'matrix-one') throw failure;
        return { _id: id };
      }
    );

    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const error = await rejection(() => ops.deleteOAuth2TrustedJwtIssuers());

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error deleting alpha realm trusted issuers');
    expect(error.originalErrors).toHaveLength(1);
    const nested = error.originalErrors[0] as FrodoError;
    expect(nested).toBeInstanceOf(FrodoError);
    expect(nested.message).toBe(
      'Error deleting alpha realm trusted issuer matrix-one'
    );
    expect(nested.originalErrors[0]).toBe(failure);
    // The delete went on after the failure.
    expect(deleteOAuth2TrustedJwtIssuerApi).toHaveBeenCalledTimes(2);
  });

  test('a failure to read the issuers is an error and nothing is deleted', async () => {
    getOAuth2TrustedJwtIssuers.mockRejectedValue(
      requestError(500, 'Server Error')
    );
    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const error = await rejection(() => ops.deleteOAuth2TrustedJwtIssuers());
    expect(error.message).toBe('Error deleting alpha realm trusted issuers');
    expect(deleteOAuth2TrustedJwtIssuerApi).not.toHaveBeenCalled();
  });
});

describe('exportOAuth2TrustedJwtIssuers', () => {
  test('keys the issuers by id and adds the metadata', async () => {
    const one = sampleIssuer('matrix-one');
    const two = sampleIssuer('matrix-two');
    getOAuth2TrustedJwtIssuers.mockResolvedValue({ result: [one, two] });

    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const exported = await ops.exportOAuth2TrustedJwtIssuers();

    expect(Object.keys(exported.trustedJwtIssuer)).toEqual([
      'matrix-one',
      'matrix-two',
    ]);
    expect(exported.trustedJwtIssuer['matrix-one']).toEqual(one);
    expect(exported.meta).toMatchObject({
      origin: 'https://openam-matrix.example.com/am',
      exportedBy: 'matrix-admin',
    });
  });

  test('a realm without issuers gives an empty export', async () => {
    getOAuth2TrustedJwtIssuers.mockResolvedValue({ result: [] });
    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const exported = await ops.exportOAuth2TrustedJwtIssuers();
    expect(exported.trustedJwtIssuer).toEqual({});
    expect(exported.meta).toBeDefined();
  });

  test('the options that have no effect do not change the result', async () => {
    getOAuth2TrustedJwtIssuers.mockResolvedValue({
      result: [sampleIssuer('matrix-one')],
    });
    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const plain = await ops.exportOAuth2TrustedJwtIssuers();
    const withOptions = await ops.exportOAuth2TrustedJwtIssuers({
      useStringArrays: false,
      deps: false,
    });
    expect(withOptions.trustedJwtIssuer).toEqual(plain.trustedJwtIssuer);
  });

  test('a failure to read is an error that names the realm', async () => {
    const failure = requestError(500, 'Server Error');
    getOAuth2TrustedJwtIssuers.mockRejectedValue(failure);
    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const error = await rejection(() => ops.exportOAuth2TrustedJwtIssuers());
    expect(error.message).toBe('Error exporting alpha realm trusted issuers');
    expect(error.originalErrors[0].message).toBe(
      'Error reading alpha realm trusted issuers'
    );
  });
});

describe('exportOAuth2TrustedJwtIssuer', () => {
  test('exports the one issuer', async () => {
    const issuer = sampleIssuer('matrix-one');
    getOAuth2TrustedJwtIssuer.mockResolvedValue(issuer);

    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const exported = await ops.exportOAuth2TrustedJwtIssuer('matrix-one');
    expect(exported.trustedJwtIssuer).toEqual({ 'matrix-one': issuer });
    expect(exported.meta).toBeDefined();
  });

  test('a failure names the issuer', async () => {
    getOAuth2TrustedJwtIssuer.mockRejectedValue(requestError(404, 'Not Found'));
    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const error = await rejection(() =>
      ops.exportOAuth2TrustedJwtIssuer('matrix-one')
    );
    expect(error.message).toBe(
      'Error exporting alpha realm trusted issuer matrix-one'
    );
    expect(isNotFoundError(error)).toBe(true);
  });
});

describe('importOAuth2TrustedJwtIssuer', () => {
  test('writes only the issuer with that id', async () => {
    const importData = sampleExport('matrix-one', 'matrix-two', 'matrix-three');
    const ops = OAuth2TrustedJwtIssuerOps(mockState());

    await ops.importOAuth2TrustedJwtIssuer('matrix-two', importData);

    expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(1);
    expect(putOAuth2TrustedJwtIssuer.mock.calls[0][0].id).toBe('matrix-two');
  });

  test('an id that the data does not hold is "not found in import data!" and nothing is written', async () => {
    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const error = await rejection(() =>
      ops.importOAuth2TrustedJwtIssuer(
        'zion-issuer',
        sampleExport('matrix-one')
      )
    );
    expect(error.message).toBe(
      'Trusted issuer zion-issuer not found in import data!'
    );
    expect(putOAuth2TrustedJwtIssuer).not.toHaveBeenCalled();
  });

  test('a failing write is an error that names the issuer', async () => {
    putOAuth2TrustedJwtIssuer.mockRejectedValue(
      requestError(500, 'Server Error')
    );
    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const error = await rejection(() =>
      ops.importOAuth2TrustedJwtIssuer('matrix-one', sampleExport('matrix-one'))
    );
    expect(error.message).toBe(
      'Error importing alpha realm trusted issuer matrix-one'
    );
    expect(error.originalErrors).toHaveLength(1);
  });
});

describe('importFirstOAuth2TrustedJwtIssuer', () => {
  test('writes the first issuer only', async () => {
    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    await ops.importFirstOAuth2TrustedJwtIssuer(
      sampleExport('matrix-one', 'matrix-two')
    );
    expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(1);
    expect(putOAuth2TrustedJwtIssuer.mock.calls[0][0].id).toBe('matrix-one');
  });

  test('empty import data is "No trusted issuers found in import data!"', async () => {
    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const error = await rejection(() =>
      ops.importFirstOAuth2TrustedJwtIssuer({ trustedJwtIssuer: {} })
    );
    expect(error.message).toBe('No trusted issuers found in import data!');
    expect(putOAuth2TrustedJwtIssuer).not.toHaveBeenCalled();
  });

  test('a failing write is an error', async () => {
    putOAuth2TrustedJwtIssuer.mockRejectedValue(
      requestError(500, 'Server Error')
    );
    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const error = await rejection(() =>
      ops.importFirstOAuth2TrustedJwtIssuer(sampleExport('matrix-one'))
    );
    expect(error.message).toBe(
      'Error importing first alpha realm trusted issuer'
    );
  });
});

describe('importOAuth2TrustedJwtIssuers', () => {
  test('writes every issuer and returns the answers in order', async () => {
    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const result = await ops.importOAuth2TrustedJwtIssuers(
      sampleExport('matrix-one', 'matrix-two')
    );
    expect(putOAuth2TrustedJwtIssuer.mock.calls.map(([a]) => a.id)).toEqual([
      'matrix-one',
      'matrix-two',
    ]);
    expect(result.map((issuer) => issuer._id)).toEqual([
      'matrix-one',
      'matrix-two',
    ]);
  });

  test('a failing write does not stop the others: one error with one nested error per failure', async () => {
    const failure = requestError(500, 'Server Error');
    putOAuth2TrustedJwtIssuer.mockImplementation(async (args: any) => {
      if (args.id === 'matrix-one') throw failure;
      return args.issuerData;
    });
    const ops = OAuth2TrustedJwtIssuerOps(mockState());

    const error = await rejection(() =>
      ops.importOAuth2TrustedJwtIssuers(
        sampleExport('matrix-one', 'matrix-two')
      )
    );

    expect(error.message).toBe('Error importing alpha realm trusted issuers');
    expect(error.originalErrors).toHaveLength(1);
    // since the result callback: the error of an item names the import and
    // keeps the error of the update as its cause
    expect(error.originalErrors[0].message).toBe(
      'Error importing alpha realm trusted issuer matrix-one'
    );
    expect(error.originalErrors[0].originalErrors[0].message).toBe(
      'Error updating alpha realm trusted issuer matrix-one'
    );
    expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(2);
  });
});

describe('createOAuth2TrustedJwtIssuerExportTemplate', () => {
  test('has the metadata and no issuers', () => {
    const ops = OAuth2TrustedJwtIssuerOps(mockState());
    const template = ops.createOAuth2TrustedJwtIssuerExportTemplate();
    expect(template.trustedJwtIssuer).toEqual({});
    expect(template.meta).toMatchObject({
      origin: 'https://openam-matrix.example.com/am',
      exportTool: expect.any(String),
    });
  });
});

describe('deployment shapes', () => {
  // The module has no code that depends on the deployment type or on the
  // realm; the loop pins that it stays so. Realm names in messages are the
  // last element of the realm path ("/" for the root realm).
  test.each([
    ['cloud', 'alpha', 'alpha'],
    ['cloud', '/bravo', 'bravo'],
    ['classic', '/', '/'],
    ['forgeops', '/', '/'],
    ['forgeops', '/parent/child', 'child'],
  ])('%s, realm %s', async (deployment, realm, realmName) => {
    const state = mockState({ deployment, realm });
    const ops = OAuth2TrustedJwtIssuerOps(state);
    const issuer = sampleIssuer('matrix-one');

    // read
    getOAuth2TrustedJwtIssuers.mockResolvedValue({ result: [issuer] });
    await expect(ops.readOAuth2TrustedJwtIssuers()).resolves.toEqual([issuer]);
    // export
    const exported = await ops.exportOAuth2TrustedJwtIssuers();
    expect(Object.keys(exported.trustedJwtIssuer)).toEqual(['matrix-one']);
    // create: a 404 on the check, then one write
    getOAuth2TrustedJwtIssuer.mockRejectedValue(requestError(404, 'Not Found'));
    await ops.createOAuth2TrustedJwtIssuer('matrix-one', issuer);
    expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(1);
    // import
    await ops.importOAuth2TrustedJwtIssuers(sampleExport('matrix-two'));
    expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(2);
    // every request got the state of the caller
    for (const [args] of putOAuth2TrustedJwtIssuer.mock.calls) {
      expect(args.state).toBe(state);
    }
    // an error names the realm
    deleteOAuth2TrustedJwtIssuerApi.mockRejectedValue(
      requestError(500, 'Server Error')
    );
    await expect(
      ops.deleteOAuth2TrustedJwtIssuer('matrix-one')
    ).rejects.toThrow(
      `Error deleting ${realmName} realm trusted issuer matrix-one`
    );
  });

  test('the Cloud root realm: the list is empty, an export is empty, a delete of all is empty', async () => {
    getOAuth2TrustedJwtIssuers.mockRejectedValue(
      requestError(403, CLOUD_ONLY_MESSAGE)
    );
    const ops = OAuth2TrustedJwtIssuerOps(
      mockState({ deployment: 'cloud', realm: '/' })
    );
    await expect(ops.readOAuth2TrustedJwtIssuers()).resolves.toEqual([]);
    const exported = await ops.exportOAuth2TrustedJwtIssuers();
    expect(exported.trustedJwtIssuer).toEqual({});
    await expect(ops.deleteOAuth2TrustedJwtIssuers()).resolves.toEqual([]);
    expect(deleteOAuth2TrustedJwtIssuerApi).not.toHaveBeenCalled();
  });
});

describe('the result callback of the bulk functions', () => {
  /** A callback that records what it is called with. */
  function recorder() {
    const calls: { error?: FrodoError; result?: any }[] = [];
    const callback = jest.fn((error?: FrodoError, result?: any) => {
      calls.push({ error, result });
    });
    return { calls, callback };
  }

  describe('deleteOAuth2TrustedJwtIssuers', () => {
    const one = { _id: 'matrix-one' };
    const two = { _id: 'matrix-two' };
    const three = { _id: 'matrix-three' };

    beforeEach(() => {
      getOAuth2TrustedJwtIssuers.mockResolvedValue({
        result: [one, two, three],
      });
    });

    test('reports every issuer once, a failed one as an error that names it and keeps the cause; nothing throws; the others are still deleted', async () => {
      const failure = requestError(500, 'Server Error');
      deleteOAuth2TrustedJwtIssuerApi.mockImplementation(
        async ({ id }: { id: string }) => {
          if (id === 'matrix-two') throw failure;
          return { _id: id };
        }
      );
      const { calls, callback } = recorder();
      const ops = OAuth2TrustedJwtIssuerOps(mockState());

      const result = await ops.deleteOAuth2TrustedJwtIssuers(callback);

      expect(result).toEqual([one, three]);
      expect(deleteOAuth2TrustedJwtIssuerApi).toHaveBeenCalledTimes(3);
      expect(calls).toHaveLength(3);
      expect(calls[0]).toEqual({ error: undefined, result: one });
      expect(calls[1].result).toBeUndefined();
      expect(calls[1].error).toBeInstanceOf(FrodoError);
      expect(calls[1].error.message).toBe(
        'Error deleting alpha realm trusted issuer matrix-two'
      );
      expect(calls[1].error.originalErrors[0]).toBe(failure);
      expect(calls[2]).toEqual({ error: undefined, result: three });
    });

    test('without a callback every issuer is tried and the failures are thrown as one error with one nested error each', async () => {
      deleteOAuth2TrustedJwtIssuerApi.mockImplementation(
        async ({ id }: { id: string }) => {
          if (id !== 'matrix-two') throw requestError(500, 'Server Error');
          return { _id: id };
        }
      );
      const ops = OAuth2TrustedJwtIssuerOps(mockState());

      const error = await rejection(() => ops.deleteOAuth2TrustedJwtIssuers());

      expect(error.message).toBe('Error deleting alpha realm trusted issuers');
      expect(error.originalErrors.map((e) => e.message)).toEqual([
        'Error deleting alpha realm trusted issuer matrix-one',
        'Error deleting alpha realm trusted issuer matrix-three',
      ]);
      expect(deleteOAuth2TrustedJwtIssuerApi).toHaveBeenCalledTimes(3);
    });

    test('a failure to read the issuers throws also with a callback, and the callback is not called', async () => {
      getOAuth2TrustedJwtIssuers.mockRejectedValue(
        requestError(500, 'Server Error')
      );
      const { callback } = recorder();
      const ops = OAuth2TrustedJwtIssuerOps(mockState());

      const error = await rejection(() =>
        ops.deleteOAuth2TrustedJwtIssuers(callback)
      );

      expect(error.message).toBe('Error deleting alpha realm trusted issuers');
      expect(callback).not.toHaveBeenCalled();
      expect(deleteOAuth2TrustedJwtIssuerApi).not.toHaveBeenCalled();
    });

    test('a realm without issuers: no request, no callback, empty result', async () => {
      getOAuth2TrustedJwtIssuers.mockResolvedValue({ result: [] });
      const { callback } = recorder();
      const ops = OAuth2TrustedJwtIssuerOps(mockState());
      await expect(
        ops.deleteOAuth2TrustedJwtIssuers(callback)
      ).resolves.toEqual([]);
      expect(callback).not.toHaveBeenCalled();
      expect(deleteOAuth2TrustedJwtIssuerApi).not.toHaveBeenCalled();
    });
  });

  describe('importOAuth2TrustedJwtIssuers', () => {
    test('reports every issuer once, a failed one as an error that names it; nothing throws; the others are still imported', async () => {
      const failure = requestError(500, 'Server Error');
      putOAuth2TrustedJwtIssuer.mockImplementation(async (args: any) => {
        if (args.id === 'matrix-two') throw failure;
        return args.issuerData;
      });
      const importData = sampleExport(
        'matrix-one',
        'matrix-two',
        'matrix-three'
      );
      const before = copy(importData);
      const { calls, callback } = recorder();
      const ops = OAuth2TrustedJwtIssuerOps(mockState());

      const result = await ops.importOAuth2TrustedJwtIssuers(
        importData,
        undefined,
        callback
      );

      expect(result.map((issuer) => issuer._id)).toEqual([
        'matrix-one',
        'matrix-three',
      ]);
      expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(3);
      expect(calls).toHaveLength(3);
      expect(calls[0].error).toBeUndefined();
      expect(calls[0].result._id).toBe('matrix-one');
      expect(calls[1].result).toBeUndefined();
      expect(calls[1].error.message).toBe(
        'Error importing alpha realm trusted issuer matrix-two'
      );
      // the cause chain: the import, the update, the request
      expect(calls[1].error.originalErrors[0].message).toBe(
        'Error updating alpha realm trusted issuer matrix-two'
      );
      expect(calls[1].error.originalErrors[0].originalErrors[0]).toBe(failure);
      expect(calls[2].error).toBeUndefined();
      expect(calls[2].result._id).toBe('matrix-three');
      // the data passed in is as it was
      expect(importData).toEqual(before);
    });

    test('without a callback every issuer is tried and the failures are thrown as one error with one nested error each', async () => {
      putOAuth2TrustedJwtIssuer.mockImplementation(async (args: any) => {
        if (args.id !== 'matrix-two') throw requestError(500, 'Server Error');
        return args.issuerData;
      });
      const ops = OAuth2TrustedJwtIssuerOps(mockState());

      const error = await rejection(() =>
        ops.importOAuth2TrustedJwtIssuers(
          sampleExport('matrix-one', 'matrix-two', 'matrix-three')
        )
      );

      expect(error.message).toBe('Error importing alpha realm trusted issuers');
      expect(error.originalErrors.map((e) => e.message)).toEqual([
        'Error importing alpha realm trusted issuer matrix-one',
        'Error importing alpha realm trusted issuer matrix-three',
      ]);
      expect(putOAuth2TrustedJwtIssuer).toHaveBeenCalledTimes(3);
    });

    test.each([
      ['no issuers', { trustedJwtIssuer: {} }],
      ['no trustedJwtIssuer key', {}],
    ])('import data with %s is an empty import', async (_name, importData) => {
      const { callback } = recorder();
      const ops = OAuth2TrustedJwtIssuerOps(mockState());

      await expect(
        ops.importOAuth2TrustedJwtIssuers(
          importData as OAuth2TrustedJwtIssuerExportInterface,
          undefined,
          callback
        )
      ).resolves.toEqual([]);
      expect(putOAuth2TrustedJwtIssuer).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('exportOAuth2TrustedJwtIssuers', () => {
    test('reports every issuer of the export once, in order', async () => {
      const one = sampleIssuer('matrix-one');
      const two = sampleIssuer('matrix-two');
      getOAuth2TrustedJwtIssuers.mockResolvedValue({ result: [one, two] });
      const { calls, callback } = recorder();
      const ops = OAuth2TrustedJwtIssuerOps(mockState());

      const exported = await ops.exportOAuth2TrustedJwtIssuers(
        undefined,
        callback
      );

      expect(calls).toEqual([
        { error: undefined, result: one },
        { error: undefined, result: two },
      ]);
      expect(Object.keys(exported.trustedJwtIssuer)).toEqual([
        'matrix-one',
        'matrix-two',
      ]);
    });

    test('a failure to read throws also with a callback, and the callback is not called', async () => {
      getOAuth2TrustedJwtIssuers.mockRejectedValue(
        requestError(500, 'Server Error')
      );
      const { callback } = recorder();
      const ops = OAuth2TrustedJwtIssuerOps(mockState());

      const error = await rejection(() =>
        ops.exportOAuth2TrustedJwtIssuers(undefined, callback)
      );

      expect(error.message).toBe('Error exporting alpha realm trusted issuers');
      expect(callback).not.toHaveBeenCalled();
    });

    test('the Cloud root realm reports nothing', async () => {
      getOAuth2TrustedJwtIssuers.mockRejectedValue(
        requestError(403, CLOUD_ONLY_MESSAGE)
      );
      const { callback } = recorder();
      const ops = OAuth2TrustedJwtIssuerOps(
        mockState({ realm: '/', deployment: 'cloud' })
      );
      const exported = await ops.exportOAuth2TrustedJwtIssuers(
        undefined,
        callback
      );
      expect(exported.trustedJwtIssuer).toEqual({});
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
