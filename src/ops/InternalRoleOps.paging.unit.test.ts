import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../test/utils/ErrorWrapping';

/**
 * InternalRoleOps: the reads of internal roles follow the paged results cookie to the end.
 *
 * `readInternalRoles` and `queryInternalRoles` used to send one request of at most one page and drop the cookie of the
 * answer, so every caller that reads all roles (the export, the delete of all roles, a full export of the
 * configuration) was cut at the size of one page without a word. A cookie, a second page and a failing second page
 * cannot be recorded without a tenant that holds that many roles, so these tests replace InternalObjectApi.
 * Mocked unit test: there are no recordings and no network.
 *
 * Every answer is scripted. The mock ends any loop that asks more than MAX_REQUESTS times with an empty page, so a
 * loop that does not stop makes a request count fail instead of hanging the run.
 */

const actualInternalObjectApi = await import('../api/InternalObjectApi');
const internalObjectApi = {
  queryAllInternalObjectsByType: jest.fn<(...args: any[]) => Promise<any>>(),
  queryInternalObjects: jest.fn<(...args: any[]) => Promise<any>>(),
  deleteInternalObject: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/InternalObjectApi', () => ({
  ...actualInternalObjectApi,
  ...internalObjectApi,
}));

const ops = await import('./InternalRoleOps');

const state = StateImpl({});
state.setRealm('alpha');

const MAX_REQUESTS = 5;

type Page = { result: any[]; pagedResultsCookie: string | null };

/** A page of roles named after the ids, with the cookie that asks for the next page. */
function page(ids: string[], cookie: string | null = null): Page {
  return {
    result: ids.map((id) => ({ _id: id, name: `name-${id}` })),
    pagedResultsCookie: cookie,
  };
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
function cookiesOf(api: jest.Mock<(...args: any[]) => Promise<any>>) {
  return api.mock.calls.map((call) => call[0].pageCookie ?? null);
}

const defaultFields = [
  'condition',
  'description',
  'name',
  'privileges',
  'temporalConstraints',
];

beforeEach(() => {
  for (const api of Object.values(internalObjectApi)) api.mockReset();
});

describe('readInternalRoles follows the cookie to the last page', () => {
  const api = internalObjectApi.queryAllInternalObjectsByType;

  test('three pages: every role in order, one request per page, each carrying the cookie of the page before', async () => {
    api.mockImplementation(
      scripted([
        page(['r1', 'r2'], 'c1'),
        page(['r3', 'r4'], 'c2'),
        page(['r5']),
      ])
    );

    const roles = await ops.readInternalRoles({ state });

    expect(roles.map((role) => role._id)).toEqual([
      'r1',
      'r2',
      'r3',
      'r4',
      'r5',
    ]);
    expect(api).toHaveBeenCalledTimes(3);
    expect(cookiesOf(api)).toEqual([null, 'c1', 'c2']);
    for (const call of api.mock.calls) {
      expect(call[0]).toMatchObject({ type: 'role', fields: defaultFields });
    }
  });

  test('the fields that the caller named are on every request', async () => {
    api.mockImplementation(
      scripted([page(['r1'], 'c1'), page(['r2'], 'c2'), page(['r3'])])
    );

    await ops.readInternalRoles({ fields: ['name'], state });

    expect(api).toHaveBeenCalledTimes(3);
    for (const call of api.mock.calls) {
      expect(call[0].fields).toEqual(['name']);
    }
  });

  test('a last page without roles (the count was a multiple of the page size) ends the read', async () => {
    api.mockImplementation(
      scripted([page(['r1', 'r2'], 'c1'), page(['r3', 'r4'], 'c2'), page([])])
    );

    const roles = await ops.readInternalRoles({ state });

    expect(roles.map((role) => role._id)).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(api).toHaveBeenCalledTimes(3);
  });

  test('one page without a cookie is one request', async () => {
    api.mockResolvedValueOnce(page(['r1', 'r2']));

    const roles = await ops.readInternalRoles({ state });

    expect(roles.map((role) => role._id)).toEqual(['r1', 'r2']);
    expect(api).toHaveBeenCalledTimes(1);
  });

  test('a failing second page ends the read with the error of the read, after two requests', async () => {
    const cause = failedRequest(500);
    api.mockImplementation(scripted([page(['r1'], 'c1'), cause]));

    await expectWrappedFailure(
      ops.readInternalRoles({ state }),
      'Error reading internal roles',
      cause
    );

    expect(api).toHaveBeenCalledTimes(2);
  });
});

describe('queryInternalRoles follows the cookie to the last page', () => {
  const api = internalObjectApi.queryInternalObjects;

  test('three pages: every role in order, the filter and the fields on every request, each carrying the cookie of the page before', async () => {
    api.mockImplementation(
      scripted([
        page(['r1', 'r2'], 'c1'),
        page(['r3', 'r4'], 'c2'),
        page(['r5']),
      ])
    );

    const roles = await ops.queryInternalRoles({
      filter: 'name sw "r"',
      state,
    });

    expect(roles.map((role) => role._id)).toEqual([
      'r1',
      'r2',
      'r3',
      'r4',
      'r5',
    ]);
    expect(api).toHaveBeenCalledTimes(3);
    expect(cookiesOf(api)).toEqual([null, 'c1', 'c2']);
    for (const call of api.mock.calls) {
      expect(call[0]).toMatchObject({
        type: 'role',
        filter: 'name sw "r"',
        fields: defaultFields,
      });
    }
  });

  test('a last page without roles (the count was a multiple of the page size) ends the query', async () => {
    api.mockImplementation(
      scripted([page(['r1', 'r2'], 'c1'), page(['r3', 'r4'], 'c2'), page([])])
    );

    const roles = await ops.queryInternalRoles({ filter: 'true', state });

    expect(roles.map((role) => role._id)).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(api).toHaveBeenCalledTimes(3);
  });

  test('one page without a cookie is one request', async () => {
    api.mockResolvedValueOnce(page(['r1']));

    const roles = await ops.queryInternalRoles({
      filter: 'name eq "r1"',
      state,
    });

    expect(roles.map((role) => role._id)).toEqual(['r1']);
    expect(api).toHaveBeenCalledTimes(1);
  });

  test('a failing second page ends the query with the error of the query, after two requests', async () => {
    const cause = failedRequest(500);
    api.mockImplementation(scripted([page(['r1'], 'c1'), cause]));

    await expectWrappedFailure(
      ops.queryInternalRoles({ filter: 'true', state }),
      'Error querying internal roles with filter true',
      cause
    );

    expect(api).toHaveBeenCalledTimes(2);
  });
});

describe('the functions that read all roles get all of them', () => {
  test('exportInternalRoles exports 1001 roles that arrive in two pages', async () => {
    const first = Array.from({ length: 1000 }, (_, index) => `r${index}`);
    internalObjectApi.queryAllInternalObjectsByType.mockImplementation(
      scripted([page(first, 'c1'), page(['r1000'])])
    );

    const exported = await ops.exportInternalRoles({ state });

    expect(Object.keys(exported.internalRole)).toHaveLength(1001);
    expect(exported.internalRole['r1000']).toMatchObject({
      name: 'name-r1000',
    });
    expect(
      internalObjectApi.queryAllInternalObjectsByType
    ).toHaveBeenCalledTimes(2);
  });

  test('deleteInternalRoles deletes every role of two pages', async () => {
    internalObjectApi.queryAllInternalObjectsByType.mockImplementation(
      scripted([page(['r1', 'r2'], 'c1'), page(['r3'])])
    );
    internalObjectApi.deleteInternalObject.mockImplementation(
      async ({ id }: { id: string }) => ({ _id: id })
    );

    const deleted = await ops.deleteInternalRoles({ state });

    expect(deleted.map((role) => role._id)).toEqual(['r1', 'r2', 'r3']);
    expect(
      internalObjectApi.deleteInternalObject.mock.calls.map(
        (call) => call[0].id
      )
    ).toEqual(['r1', 'r2', 'r3']);
  });

  test('deleteInternalRoles deletes nothing when a page cannot be read, and says so', async () => {
    const cause = failedRequest(500);
    internalObjectApi.queryAllInternalObjectsByType.mockImplementation(
      scripted([page(['r1', 'r2'], 'c1'), cause])
    );

    await expectWrappedFailure(
      ops.deleteInternalRoles({ state }),
      'Error deleting internal roles',
      cause,
      2
    );

    expect(internalObjectApi.deleteInternalObject).not.toHaveBeenCalled();
    expect(
      internalObjectApi.queryAllInternalObjectsByType
    ).toHaveBeenCalledTimes(2);
  });
});
