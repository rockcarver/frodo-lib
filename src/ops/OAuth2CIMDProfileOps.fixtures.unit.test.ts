/**
 * Unit tests of the CIMD profile module that run on real answers of a tenant.
 *
 * Run with:
 *
 *        npm run test:only src/ops/OAuth2CIMDProfileOps.fixtures
 *
 * The files in src/test/mocks/OAuth2CIMDProfileApi are answers of an Identity Cloud tenant that offers CIMD profiles
 * (AM 9.0.0), kept in the shape the server sent them, with made-up values and no secret: the single read (wrapped),
 * an item of the list (plain), a profile that was created with the smallest body (what the server completes it with),
 * a sparse profile, and the list of the attribute names that the server accepts. The api layer is replaced by fakes,
 * so the functions that decide on the shape of an answer can be asserted on the real shapes without a recording.
 * The recorded tests of the module (OAuth2CIMDProfileApi.test.ts, OAuth2CIMDProfileOps.test.ts) cover the requests.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';

const getAgentTypes = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
jest.unstable_mockModule('../api/AgentApi', () => ({
  getAgentTypes,
}));

const putCIMDProfile = jest.fn(async (_args?: any): Promise<any> => ({
  status: 200,
  data: {},
}));
jest.unstable_mockModule('../api/OAuth2CIMDProfileApi', () => ({
  getCIMDProfiles: jest.fn(),
  getCIMDProfile: jest.fn(),
  putCIMDProfile,
  deleteCIMDProfile: jest.fn(),
  getCIMDProfileTemplate: jest.fn(),
  getCIMDProfileSchema: jest.fn(),
}));

const { describeInvalidAttributes, putCIMDProfileExact } =
  await import('./OAuth2CIMDProfileOps');
const { default: State } = await import('../shared/State');

const mocks = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../test/mocks/OAuth2CIMDProfileApi'
);
const fixture = (file: string) =>
  JSON.parse(fs.readFileSync(path.resolve(mocks, file), 'utf8'));

// the single read is wrapped, the list is plain; a sparse profile has few attributes, a completed one has them all
const rich = fixture('getCIMDProfile/rich.json');
const minimalCreate = fixture('getCIMDProfile/minimal-create.json');
const sparse = fixture('getCIMDProfile/sparse.json');
const afterImportOfSparseExport = fixture(
  'getCIMDProfile/after-import-of-sparse-export.json'
);
const item = fixture('getCIMDProfiles/item.json');
const itemSparse = fixture('getCIMDProfiles/item-sparse.json');
const validAttributes: string[] = fixture(
  'putCIMDProfile/valid-attributes.json'
);

// the answer of the server to an attribute it does not know, with the list of the ones it does
const invalidAttributeError = () => {
  const error: any = new Error('Request failed with status code 400');
  error.response = {
    status: 400,
    data: {
      code: 400,
      reason: 'Bad Request',
      message: 'Invalid attribute specified.',
      detail: { validAttributes },
    },
  };
  return error;
};

const newState = () => {
  const state = State({});
  state.setHost('https://openam-matrix.example.com/am');
  state.setDeploymentType('cloud');
  state.setRealm('alpha');
  return state;
};

beforeEach(() => {
  putCIMDProfile.mockReset();
});

describe('the real shapes', () => {
  test('the fixtures are the two shapes of the server', () => {
    const wrappedAttributes = (profile: any) =>
      Object.entries(profile)
        .filter(([name]) => !name.startsWith('_'))
        .flatMap(([, group]) => Object.values(group as object))
        .filter(
          (value: any) =>
            value && typeof value === 'object' && 'inherited' in value
        ).length;
    // the single read wraps (almost) every attribute, the list wraps none
    expect(wrappedAttributes(rich)).toBeGreaterThan(60);
    expect(wrappedAttributes(item)).toBe(0);
    expect(wrappedAttributes(sparse)).toBe(5);
    expect(wrappedAttributes(itemSparse)).toBe(0);
    // a profile created with the smallest body is completed by the server, a sparse one is not
    expect(Object.keys(minimalCreate).length).toBeGreaterThan(
      Object.keys(sparse).length
    );
    expect(Object.keys(afterImportOfSparseExport).sort()).toEqual(
      Object.keys(minimalCreate).sort()
    );
  });
});

describe('describeInvalidAttributes() on real answers', () => {
  test('every attribute of a real profile is one the server accepts', () => {
    for (const profile of [rich, item, minimalCreate, sparse, itemSparse]) {
      expect(describeInvalidAttributes(invalidAttributeError(), profile)).toBe(
        ''
      );
    }
  });

  test('an attribute the server does not know is named', () => {
    const profile = {
      ...item,
      cimdConfig: { ...item.cimdConfig, cimdBogus: true },
      notAGroup: { x: 1 },
    };
    expect(describeInvalidAttributes(invalidAttributeError(), profile)).toBe(
      ': the server does not accept the attribute(s) cimdBogus, notAGroup'
    );
  });

  test('the revision is an attribute the server refuses, which the write removes before it sends', () => {
    // the real answer to a body with a '_rev' was this 400, and '_rev' is not on the server's list
    expect(validAttributes).not.toContain('_rev');
    expect(validAttributes).not.toContain('_id');
    expect(validAttributes).toHaveLength(105);
  });
});

describe('putCIMDProfileExact() on real answers', () => {
  test('a complete profile that is created is not written a second time', async () => {
    putCIMDProfile.mockResolvedValueOnce({ status: 201, data: rich });
    const result = await putCIMDProfileExact({
      profileId: 'matrix-complete',
      profileData: item,
      state: newState(),
    });
    // the answer holds no attribute that the list item did not carry
    expect(putCIMDProfile).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ profile: rich, created: true, repaired: false });
  });

  test('a sparse profile that is created is written a second time, with the same body', async () => {
    // the server completes a profile it creates ...
    putCIMDProfile.mockResolvedValueOnce({
      status: 201,
      data: afterImportOfSparseExport,
    });
    // ... and stores a profile it updates exactly as sent
    putCIMDProfile.mockResolvedValueOnce({ status: 200, data: sparse });
    const result = await putCIMDProfileExact({
      profileId: 'matrix-sparse',
      profileData: itemSparse,
      state: newState(),
    });
    expect(putCIMDProfile).toHaveBeenCalledTimes(2);
    expect(putCIMDProfile.mock.calls[1][0]).toEqual(
      putCIMDProfile.mock.calls[0][0]
    );
    expect((putCIMDProfile.mock.calls[1][0] as any).profileData).toEqual(
      itemSparse
    );
    expect(result).toEqual({ profile: sparse, created: true, repaired: true });
  });

  test('a sparse profile that is updated is written once', async () => {
    putCIMDProfile.mockResolvedValueOnce({ status: 200, data: sparse });
    const result = await putCIMDProfileExact({
      profileId: 'matrix-sparse',
      profileData: itemSparse,
      state: newState(),
    });
    expect(putCIMDProfile).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      profile: sparse,
      created: false,
      repaired: false,
    });
  });
});
