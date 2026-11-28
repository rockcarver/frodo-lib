import { jest } from '@jest/globals';
import Constants from '../shared/Constants';
import StateImpl from '../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../test/utils/ErrorWrapping';
import { FrodoError } from './FrodoError';

/**
 * OrganizationOps: the loops that read organizations page by page.
 *
 * `readOrganizations` caught the error of every page request and went on with the cookie of the last page that had
 * been read, so a request that fails from the second page on was sent again and again and never ended. Now the
 * first failed request ends the loop and the call throws its error with that one cause. `listOrganizationsTopDown`
 * dropped every page that it read and always returned an empty array. A failed request for a page cannot be recorded,
 * so these tests replace ManagedObjectApi.
 * Mocked unit test: there are no recordings and no network.
 *
 * Every answer is scripted. The mock ends any loop that asks more than MAX_REQUESTS times with an empty page, so a
 * loop that does not stop makes a request count fail instead of hanging the run.
 */

const actualManagedObjectApi = await import('../api/ManagedObjectApi');
const managedObjectApi = {
  queryAllManagedObjectsByType: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/ManagedObjectApi', () => ({
  ...actualManagedObjectApi,
  ...managedObjectApi,
}));

const ops = await import('./OrganizationOps');

const state = StateImpl({});
state.setRealm('alpha');
state.setDeploymentType(Constants.CLOUD_DEPLOYMENT_TYPE_KEY);

const MAX_REQUESTS = 5;

type Page = { result: any[]; pagedResultsCookie: string | null };

/** A page of organizations with the given ids, and the cookie that asks for the next page. */
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

const request = managedObjectApi.queryAllManagedObjectsByType;

/** The `pageCookie` that each request carried, a missing cookie as null. */
function cookiesOf() {
  return request.mock.calls.map((call) => call[0].pageCookie ?? null);
}

beforeEach(() => {
  request.mockReset();
});

describe('readOrganizations', () => {
  test('three pages: every organization in the order of the pages, each request carrying the cookie of the page before', async () => {
    request.mockImplementation(
      scripted([
        page(['o1', 'o2'], 'c1'),
        page(['o3', 'o4'], 'c2'),
        page(['o5']),
      ])
    );

    const organizations = await ops.readOrganizations({ state });

    expect(organizations.map((organization) => organization._id)).toEqual([
      'o1',
      'o2',
      'o3',
      'o4',
      'o5',
    ]);
    expect(request).toHaveBeenCalledTimes(3);
    expect(cookiesOf()).toEqual([null, 'c1', 'c2']);
    expect(request.mock.calls[0][0].type).toBe('alpha_organization');
  });

  test('one page without a cookie is one request', async () => {
    request.mockResolvedValueOnce(page(['o1', 'o2']));

    const organizations = await ops.readOrganizations({ state });

    expect(organizations.map((organization) => organization._id)).toEqual([
      'o1',
      'o2',
    ]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('a page that cannot be read ends the loop: the error of the call with that one cause, after two requests', async () => {
    const cause = failedRequest(500);
    request.mockImplementation(scripted([page(['o1', 'o2'], 'c1'), cause]));

    const error = await ops.readOrganizations({ state }).then(
      () => undefined,
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(FrodoError);
    expect((error as FrodoError).message).toBe('Error reading organizations');
    expect((error as FrodoError).originalErrors).toHaveLength(1);
    expect((error as FrodoError).originalErrors[0]).toBe(cause);
    expect(request).toHaveBeenCalledTimes(2);
    expect(cookiesOf()).toEqual([null, 'c1']);
  });

  test('a first page that cannot be read is one request and one cause', async () => {
    const cause = failedRequest(500);
    request.mockImplementation(scripted([cause]));

    const error = await ops.readOrganizations({ state }).then(
      () => undefined,
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(FrodoError);
    expect((error as FrodoError).message).toBe('Error reading organizations');
    expect((error as FrodoError).originalErrors).toEqual([cause]);
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('listOrganizationsTopDown', () => {
  test('returns the organizations of every page it read, each request carrying the cookie of the page before', async () => {
    request.mockImplementation(
      scripted([page(['o1', 'o2'], 'c1'), page(['o3'])])
    );

    const organizations = await ops.listOrganizationsTopDown({ state });

    expect(organizations.map((organization) => organization._id)).toEqual([
      'o1',
      'o2',
      'o3',
    ]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(cookiesOf()).toEqual([null, 'c1']);
  });

  test('returns the organizations of a single page', async () => {
    request.mockResolvedValueOnce(page(['o1']));

    const organizations = await ops.listOrganizationsTopDown({ state });

    expect(organizations.map((organization) => organization._id)).toEqual([
      'o1',
    ]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('a page that cannot be read ends the loop with the error of the call, after two requests', async () => {
    const cause = failedRequest(500);
    request.mockImplementation(scripted([page(['o1'], 'c1'), cause]));

    await expectWrappedFailure(
      ops.listOrganizationsTopDown({ state }),
      'Error querying organizations',
      cause
    );

    expect(request).toHaveBeenCalledTimes(2);
  });
});
