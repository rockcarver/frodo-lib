import { jest } from '@jest/globals';

/**
 * `importResourceTypes` takes an optional result callback (frodo-lib#957). With it, the
 * outcome of every resource type is passed to it once, as it happens: a resource type that was
 * imported as the resource type, a resource type that could not be imported as an error that
 * names it and carries the cause. A failed resource type does not stop the others, is not part
 * of the result, and the function does not throw for it. Without a callback nothing changes:
 * one combined error is thrown after every resource type was tried.
 * `exportResourceTypes` reads the list and nothing per resource type, so it has no item that
 * can fail and takes no callback.
 * Mocked unit test: no recordings.
 */

const getResourceType = jest.fn(async (_args?: any): Promise<any> => {
  throw Object.assign(new Error('not found'), { response: { status: 404 } });
});
const putResourceType = jest.fn(async (args?: any): Promise<any> => ({
  ...args.resourceTypeData,
}));
const createResourceType = jest.fn(async (args?: any): Promise<any> => ({
  ...args.resourceTypeData,
}));
const getResourceTypes = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const actualResourceTypesApi = await import('../api/ResourceTypesApi');
jest.unstable_mockModule('../api/ResourceTypesApi', () => ({
  ...actualResourceTypesApi,
  getResourceTypes,
  getResourceType,
  putResourceType,
  createResourceType,
}));

const {
  default: ResourceTypeOps,
  exportResourceTypes,
  importResourceTypes,
} = await import('./ResourceTypeOps');
const { default: State } = await import('../shared/State');

const state = State({});
state.setRealm('alpha');

const resourceType = (uuid: string, name = `type ${uuid}`): any => ({
  _id: uuid,
  uuid,
  name,
});

const importData = (): any => ({
  resourcetype: {
    'rt-a': resourceType('rt-a'),
    'rt-b': resourceType('rt-b'),
    'rt-c': resourceType('rt-c'),
  },
});

/** The messages of an error and of everything nested in it. */
function messagesOf(error: any): string {
  return [error?.message, ...(error?.originalErrors ?? []).map(messagesOf)]
    .filter(Boolean)
    .join(' | ');
}

type Outcome = { error?: any; result?: any };
let outcomes: Outcome[];
const callback = (error?: any, result?: any) =>
  outcomes.push({ error, result });

/** Writing resource type b fails. */
const failTypeB = () =>
  putResourceType.mockImplementation(async (args: any) => {
    if (args.resourceTypeUuid === 'rt-b')
      throw new Error('resource type b: HTTP 500');
    return { ...args.resourceTypeData };
  });

beforeEach(() => {
  outcomes = [];
  for (const mock of [getResourceType, putResourceType, createResourceType]) {
    mock.mockClear();
  }
  getResourceType.mockImplementation(async () => {
    throw Object.assign(new Error('not found'), { response: { status: 404 } });
  });
  putResourceType.mockImplementation(async (args: any) => ({
    ...args.resourceTypeData,
  }));
});

describe('exportResourceTypes', () => {
  test('reads the list once and nothing per resource type, so there is no item that can fail', async () => {
    getResourceTypes.mockResolvedValue({
      result: [resourceType('rt-a'), resourceType('rt-b')],
    });
    getResourceType.mockClear();

    const exportData = await exportResourceTypes({ state });

    expect(Object.keys(exportData.resourcetype)).toEqual(['rt-a', 'rt-b']);
    expect(getResourceTypes).toHaveBeenCalledTimes(1);
    expect(getResourceType).not.toHaveBeenCalled();
  });
});

describe('importResourceTypes', () => {
  test('without a callback: imports every resource type', async () => {
    const response = await importResourceTypes({
      importData: importData(),
      state,
    });

    expect(response.map((r) => r.uuid)).toEqual(['rt-a', 'rt-b', 'rt-c']);
  });

  test('with a callback: reports every resource type once, in order, and returns the same as without', async () => {
    const plain = await importResourceTypes({
      importData: importData(),
      state,
    });

    const response = await importResourceTypes({
      importData: importData(),
      resultCallback: callback,
      state,
    });

    expect(response).toEqual(plain);
    expect(outcomes.map((o) => o.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map((o) => o.result?.uuid)).toEqual([
      'rt-a',
      'rt-b',
      'rt-c',
    ]);
  });

  test('with a callback: a resource type that needs no update is reported as it is in the import data and is not in the result', async () => {
    const data = importData();
    getResourceType.mockImplementation(async (args: any) => {
      if (args.resourceTypeUuid === 'rt-a')
        return { ...data.resourcetype['rt-a'], _rev: '4' };
      throw Object.assign(new Error('not found'), {
        response: { status: 404 },
      });
    });

    const response = await importResourceTypes({
      importData: data,
      resultCallback: callback,
      state,
    });

    expect(response.map((r) => r.uuid)).toEqual(['rt-b', 'rt-c']);
    expect(outcomes.map((o) => o.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes[0].result?.uuid).toBe('rt-a');
    expect(putResourceType).toHaveBeenCalledTimes(2);
  });

  test('with a callback: a resource type that cannot be written is a failed item that names it, the others are imported, the function does not throw', async () => {
    failTypeB();

    const response = await importResourceTypes({
      importData: importData(),
      resultCallback: callback,
      state,
    });

    expect(response.map((r) => r.uuid)).toEqual(['rt-a', 'rt-c']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].result?.uuid).toBe('rt-a');
    expect(outcomes[2].result?.uuid).toBe('rt-c');
    expect(outcomes[1].result).toBeUndefined();
    expect(outcomes[1].error.message).toBe(
      'Error importing alpha realm resource type type rt-b (rt-b)'
    );
    expect(outcomes[1].error.originalErrors).toHaveLength(1);
    expect(messagesOf(outcomes[1].error)).toContain(
      'resource type b: HTTP 500'
    );
  });

  test('with a callback: every resource type failing reports every resource type, returns an empty result and does not throw', async () => {
    putResourceType.mockRejectedValue(new Error('HTTP 500'));

    const response = await importResourceTypes({
      importData: importData(),
      resultCallback: callback,
      state,
    });

    expect(response).toEqual([]);
    expect(outcomes).toHaveLength(3);
    expect(outcomes.every((o) => o.error && !o.result)).toBe(true);
    expect(
      outcomes.map((o) => /\((rt-[abc])\)$/.exec(o.error.message)?.[1])
    ).toEqual(['rt-a', 'rt-b', 'rt-c']);
  });

  test('with a callback: a resource type without a name is named by its uuid', async () => {
    const data = importData();
    delete data.resourcetype['rt-b'].name;
    failTypeB();

    await importResourceTypes({
      importData: data,
      resultCallback: callback,
      state,
    });

    expect(outcomes[1].error.message).toBe(
      'Error importing alpha realm resource type rt-b'
    );
  });

  test('without a callback: the failures are thrown as one combined error after every resource type was tried', async () => {
    failTypeB();

    const error: any = await importResourceTypes({
      importData: importData(),
      state,
    }).catch((e) => e);

    // unchanged: the combined error with the raw error nested
    expect(error.message).toBe('Error importing alpha realm resource types');
    expect(error.originalErrors).toHaveLength(1);
    expect(messagesOf(error)).toContain('resource type b: HTTP 500');
    expect(putResourceType).toHaveBeenCalledTimes(3);
  });

  test('the facade passes the callback on', async () => {
    await ResourceTypeOps(state).importResourceTypes(importData(), callback);

    expect(outcomes.map((o) => o.result?.uuid)).toEqual([
      'rt-a',
      'rt-b',
      'rt-c',
    ]);
  });
});
