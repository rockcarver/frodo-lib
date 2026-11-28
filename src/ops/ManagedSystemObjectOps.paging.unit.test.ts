import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import { failedRequest } from '../test/utils/ErrorWrapping';
import { FrodoError } from './FrodoError';

/**
 * ManagedSystemObjectOps: a page that cannot be read ends the paging loop of the functions that read pages until the
 * cookie is gone (frodo-lib paging loops).
 *
 * The four functions below caught the error of every page request, kept it, and went on with the cookie of the last
 * page that had been read. A page request that fails from the second page on therefore sent the same request again
 * and again and never ended. Now the first failed request ends the loop, and the call throws the error it always
 * threw, with that one cause. A failed request for a page cannot be recorded, so these tests replace ManagedSystemObjectApi.
 * Mocked unit test: there are no recordings and no network.
 *
 * Every answer is scripted. The mock ends any loop that asks more than MAX_REQUESTS times with an empty page, so a
 * loop that does not stop makes a request count fail instead of hanging the run.
 */

const actualManagedSystemObjectApi =
  await import('../api/ManagedSystemObjectApi');
const managedSystemObjectApi = {
  queryManagedSystemObjects: jest.fn<(...args: any[]) => Promise<any>>(),
  queryRelatedManagedSystemObjects: jest.fn<(...args: any[]) => Promise<any>>(),
  patchManagedSystemObject: jest.fn<(...args: any[]) => Promise<any>>(),
  deleteManagedSystemObject: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/ManagedSystemObjectApi', () => ({
  ...actualManagedSystemObjectApi,
  ...managedSystemObjectApi,
}));

const ops = await import('./ManagedSystemObjectOps');

const state = StateImpl({});
state.setRealm('alpha');

const MAX_REQUESTS = 5;

type Page = { result: any[]; pagedResultsCookie: string | null };
type Mock = jest.Mock<(...args: any[]) => Promise<any>>;

/** A page of objects with the given ids, and the cookie that asks for the next page. */
function page(ids: string[], cookie: string | null = null): Page {
  return { result: ids.map((id) => ({ _id: id })), pagedResultsCookie: cookie };
}

/**
 * Answers request k with script[k - 1], and every request after the end of the script with its last entry (a failing
 * page keeps failing, as it does on a tenant). After MAX_REQUESTS requests it answers with an empty page without a
 * cookie, which is what ends a loop that would otherwise repeat the request without end.
 */
function scripted(script: Array<Page | Error>) {
  let requests = 0;
  return async (..._args: any[]): Promise<Page> => {
    requests++;
    if (requests > MAX_REQUESTS) return page([]);
    const answer = script[Math.min(requests, script.length) - 1];
    if (answer instanceof Error) throw answer;
    return answer;
  };
}

/** The `pageCookie` that each request carried, a missing cookie as null. */
function cookiesOf(api: Mock) {
  return api.mock.calls.map((call) => call[0].pageCookie ?? null);
}

/** The `id` of each call of a patch or a delete. */
function idsOf(api: Mock) {
  return api.mock.calls.map((call) => call[0].id);
}

/** The error that a call rejects with. */
async function failureOf(call: () => Promise<unknown>): Promise<FrodoError> {
  const error = await call().then(
    () => undefined,
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(FrodoError);
  return error as FrodoError;
}

type Row = {
  name: string;
  operation: 'query' | 'update' | 'delete';
  /** the API function that reads a page */
  request: Mock;
  /** the API function that is called for each object that a page holds (update and delete) */
  work?: Mock;
  /** `pageSize` is passed to the functions that take one (every function of the rows but the delete) */
  call: (pageSize?: number) => Promise<unknown>;
  takesPageSize: boolean;
  /** the message of the error; `done` is the number of objects the call had deleted */
  message: (done: number) => string;
};

const rows: Row[] = [
  {
    name: 'queryManagedSystemObjects',
    operation: 'query',
    request: managedSystemObjectApi.queryManagedSystemObjects,
    takesPageSize: true,
    call: (pageSize) =>
      ops.queryManagedSystemObjects({ type: 'teammember', pageSize, state }),
    message: () => 'Error querying "teammember" objects matching filter "true"',
  },
  {
    name: 'queryRelatedManagedSystemObjects',
    operation: 'query',
    request: managedSystemObjectApi.queryRelatedManagedSystemObjects,
    takesPageSize: true,
    call: (pageSize) =>
      ops.queryRelatedManagedSystemObjects({
        type: 'teammember',
        id: 'u1',
        relationship: 'roles',
        pageSize,
        state,
      }),
    message: () =>
      'Error querying relationship "roles" for "teammember" with id "u1"',
  },
  {
    name: 'updateManagedSystemObjectsProperties',
    operation: 'update',
    request: managedSystemObjectApi.queryManagedSystemObjects,
    work: managedSystemObjectApi.patchManagedSystemObject,
    takesPageSize: true,
    call: (pageSize) =>
      ops.updateManagedSystemObjectsProperties({
        type: 'teammember',
        filter: 'true',
        operations: [
          { operation: 'replace', field: '/accountStatus', value: 'inactive' },
        ],
        pageSize,
        state,
      }),
    message: () => 'Error patching "teammember" objects matching filter "true"',
  },
  {
    name: 'deleteManagedSystemObjects',
    operation: 'delete',
    request: managedSystemObjectApi.queryManagedSystemObjects,
    work: managedSystemObjectApi.deleteManagedSystemObject,
    takesPageSize: false,
    call: () =>
      ops.deleteManagedSystemObjects({
        type: 'teammember',
        filter: 'true',
        state,
      }),
    message: (done) =>
      `Error deleting "teammember" objects matching filter "true". Successfully deleted ${done} objects.`,
  },
];

beforeEach(() => {
  for (const api of Object.values(managedSystemObjectApi)) api.mockReset();
  managedSystemObjectApi.patchManagedSystemObject.mockImplementation(
    async ({ id }: { id: string }) => ({ _id: id, patched: true })
  );
  managedSystemObjectApi.deleteManagedSystemObject.mockImplementation(
    async ({ id }: { id: string }) => ({ _id: id })
  );
});

/** What the call returned for the given ids of the pages it read. */
function expectResult(row: Row, result: unknown, ids: string[]) {
  switch (row.operation) {
    case 'query':
      expect((result as { _id: string }[]).map((object) => object._id)).toEqual(
        ids
      );
      break;
    case 'update':
      expect(result).toEqual(ids.map((id) => ({ _id: id, patched: true })));
      expect(idsOf(row.work)).toEqual(ids);
      break;
    case 'delete':
      expect(result).toBe(ids.length);
      expect(idsOf(row.work)).toEqual(ids);
      break;
  }
}

describe.each(rows)('$name', (row) => {
  test('three pages: everything is returned, patched or deleted in the order of the pages, one request per page, each carrying the cookie of the page before', async () => {
    row.request.mockImplementation(
      scripted([
        page(['u1', 'u2'], 'c1'),
        page(['u3', 'u4'], 'c2'),
        page(['u5']),
      ])
    );

    const result = await row.call();

    expect(row.request).toHaveBeenCalledTimes(3);
    expect(cookiesOf(row.request)).toEqual([null, 'c1', 'c2']);
    expectResult(row, result, ['u1', 'u2', 'u3', 'u4', 'u5']);
  });

  test('one page without a cookie is one request', async () => {
    row.request.mockResolvedValueOnce(page(['u1', 'u2']));

    const result = await row.call();

    expect(row.request).toHaveBeenCalledTimes(1);
    expectResult(row, result, ['u1', 'u2']);
  });

  test('a page that cannot be read ends the loop: the error of the call with that one cause, after two requests, and nothing after the failed page is done', async () => {
    const cause = failedRequest(500);
    row.request.mockImplementation(scripted([page(['u1', 'u2'], 'c1'), cause]));

    const error = await failureOf(row.call);

    expect(error.message).toBe(row.message(2));
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0]).toBe(cause);
    expect(row.request).toHaveBeenCalledTimes(2);
    expect(cookiesOf(row.request)).toEqual([null, 'c1']);
    if (row.work) {
      // the work on the page that was read stays done, and nothing else is started
      expect(idsOf(row.work)).toEqual(['u1', 'u2']);
    }
  });

  test('a first page that cannot be read is one request and one cause', async () => {
    const cause = failedRequest(500);
    row.request.mockImplementation(scripted([cause]));

    const error = await failureOf(row.call);

    expect(error.message).toBe(row.message(0));
    expect(error.originalErrors).toEqual([cause]);
    expect(row.request).toHaveBeenCalledTimes(1);
    if (row.work) expect(row.work).not.toHaveBeenCalled();
  });
});

describe.each(rows.filter((row) => row.operation === 'delete'))(
  '$name: a failed delete of an object',
  (row) => {
    test('is one more cause of the call and does not stop the next page from being read', async () => {
      const cause = failedRequest(500);
      row.request.mockImplementation(
        scripted([page(['u1', 'u2'], 'c1'), page(['u3'])])
      );
      row.work.mockImplementation(async ({ id }: { id: string }) => {
        if (id === 'u2') throw cause;
        return { _id: id };
      });

      const error = await failureOf(row.call);

      expect(error.message).toBe(row.message(2));
      expect(error.originalErrors).toHaveLength(1);
      expect(error.originalErrors[0]).toBeInstanceOf(FrodoError);
      expect(error.originalErrors[0].message).toBe(
        'Error deleting managed teammember object (u2)'
      );
      expect((error.originalErrors[0] as FrodoError).originalErrors).toEqual([
        cause,
      ]);
      expect(row.request).toHaveBeenCalledTimes(2);
      expect(idsOf(row.work)).toEqual(['u1', 'u2', 'u3']);
    });
  }
);

describe.each(rows.filter((row) => row.operation === 'update'))(
  '$name: a failed patch of an object',
  (row) => {
    test('is one more cause of the call, does not stop the rest of its page, and does not stop the next page from being read', async () => {
      const cause = failedRequest(500);
      row.request.mockImplementation(
        scripted([page(['u1', 'u2'], 'c1'), page(['u3'])])
      );
      row.work.mockImplementation(async ({ id }: { id: string }) => {
        if (id === 'u1') throw cause;
        return { _id: id, patched: true };
      });

      const error = await failureOf(row.call);

      expect(error.message).toBe(row.message(0));
      expect(error.originalErrors).toEqual([cause]);
      expect(row.request).toHaveBeenCalledTimes(2);
      expect(cookiesOf(row.request)).toEqual([null, 'c1']);
      // the failed object is the first of its page: the others of that page and of the next page are patched
      expect(idsOf(row.work)).toEqual(['u1', 'u2', 'u3']);
    });
  }
);

describe.each(rows.filter((row) => row.takesPageSize))(
  '$name: the page size',
  (row) => {
    test('of the call reaches every page request', async () => {
      row.request.mockImplementation(
        scripted([page(['u1'], 'c1'), page(['u2'], 'c2'), page(['u3'])])
      );

      await row.call(25);

      expect(row.request.mock.calls.map((call) => call[0].pageSize)).toEqual([
        25, 25, 25,
      ]);
    });

    test('is the default page size of the API when the call gives none', async () => {
      row.request.mockImplementation(
        scripted([page(['u1'], 'c1'), page(['u2'])])
      );

      await row.call();

      expect(row.request.mock.calls.map((call) => call[0].pageSize)).toEqual([
        actualManagedSystemObjectApi.DEFAULT_PAGE_SIZE,
        actualManagedSystemObjectApi.DEFAULT_PAGE_SIZE,
      ]);
    });
  }
);
