import { jest } from '@jest/globals';

/**
 * `importSites` tries every site. Without a result callback the failures are
 * collected and thrown as one combined error; with one, every outcome is
 * reported to it as it happens (a failed site as an error that names it, with
 * the cause nested), a failed site does not throw and is not part of the
 * result, and the sites that were imported are returned. A site that the
 * filter leaves out is not reported. Mocked unit test: no recordings.
 */

const putSite = jest.fn(async (args?: any): Promise<any> => ({
  _id: args?.siteId,
  url: args?.siteData?.url,
}));
const actualApi = await import('../../api/classic/SiteApi');
jest.unstable_mockModule('../../api/classic/SiteApi', () => ({
  ...actualApi,
  putSite,
}));

const { default: SiteOps, importSites } = await import('./SiteOps');

const state = {
  getRealm: () => 'alpha',
  getDebugHandler: () => undefined,
  getDeploymentType: () => 'classic',
} as any;

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

function importData(): any {
  return {
    site: {
      'site-1': { _id: 'site-1', url: 'https://one.example.com' },
      'site-2': { _id: 'site-2', url: 'https://two.example.com' },
      'site-3': { _id: 'site-3', url: 'https://three.example.com' },
    },
  };
}

let failure: Error;

/** the write of the site is rejected */
const failSite = (siteId: string, error: Error = failure) =>
  putSite.mockImplementation(async (args: any) => {
    if (args.siteId === siteId) throw error;
    return { _id: args.siteId, url: args.siteData.url };
  });

const ids = (sites: any[]) => sites.map((it) => it._id);

beforeEach(() => {
  failure = new Error('HTTP 400');
  jest.clearAllMocks();
  putSite.mockReset();
  putSite.mockImplementation(async (args: any) => ({
    _id: args.siteId,
    url: args.siteData.url,
  }));
});

describe('importSites', () => {
  test('imports every site, with and without a callback', async () => {
    const plain = await importSites({ importData: importData(), state });
    const reported: any[] = [];
    const withCallback = await importSites({
      importData: importData(),
      resultCallback: (error, site) => reported.push([error, site]),
      state,
    });

    expect(ids(plain)).toEqual(['site-1', 'site-2', 'site-3']);
    expect(ids(withCallback)).toEqual(['site-1', 'site-2', 'site-3']);
    expect(reported.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(ids(reported.map(([, site]) => site))).toEqual([
      'site-1',
      'site-2',
      'site-3',
    ]);
  });

  test('with a callback a failed site is reported by name, with its cause, and the others are imported', async () => {
    failSite('site-2');
    const outcomes: any[] = [];

    const result = await importSites({
      importData: importData(),
      resultCallback: (error, site) => outcomes.push([error, site]),
      state,
    });

    expect(ids(result)).toEqual(['site-1', 'site-3']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0]).toBeUndefined();
    expect(outcomes[0][1]._id).toBe('site-1');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe('Error importing site site-2');
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][0]).toBeUndefined();
    expect(outcomes[2][1]._id).toBe('site-3');
    expect(putSite).toHaveBeenCalledTimes(3);
  });

  test('with a callback and every site failing nothing is thrown and nothing is returned', async () => {
    putSite.mockRejectedValue(failure);
    const outcomes: any[] = [];

    const result = await importSites({
      importData: importData(),
      resultCallback: (error, site) => outcomes.push([error, site]),
      state,
    });

    expect(result).toEqual([]);
    expect(outcomes.map(([error]) => error.message)).toEqual([
      'Error importing site site-1',
      'Error importing site site-2',
      'Error importing site site-3',
    ]);
    expect(outcomes.every(([, site]) => site === undefined)).toBe(true);
  });

  test('without a callback every site is tried, then one combined error is thrown with the error of each failure', async () => {
    putSite.mockImplementation(async (args: any) => {
      if (args.siteId !== 'site-2') throw failure;
      return { _id: args.siteId };
    });

    const error: any = await importSites({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing sites');
    // the errors as the write raised them: no wrapper that names the item
    expect(error.originalErrors).toHaveLength(2);
    expect(error.originalErrors[0]).toBe(failure);
    expect(error.originalErrors[1]).toBe(failure);
    expect(putSite).toHaveBeenCalledTimes(3);
  });

  test('the filter by id leaves the others out, and they are not reported', async () => {
    const outcomes: any[] = [];

    const result = await importSites({
      importData: importData(),
      siteId: 'site-2',
      resultCallback: (error, site) => outcomes.push([error, site]),
      state,
    });

    expect(ids(result)).toEqual(['site-2']);
    expect(outcomes).toHaveLength(1);
    expect(putSite).toHaveBeenCalledTimes(1);
  });

  test('the filter by url leaves the others out, and they are not reported', async () => {
    const outcomes: any[] = [];

    const result = await importSites({
      importData: importData(),
      siteUrl: 'https://three.example.com',
      resultCallback: (error, site) => outcomes.push([error, site]),
      state,
    });

    expect(ids(result)).toEqual(['site-3']);
    expect(outcomes).toHaveLength(1);
    expect(putSite).toHaveBeenCalledTimes(1);
  });

  test('every site is reported exactly once, in order, also when the callback throws', async () => {
    failSite('site-2');
    const calls: string[] = [];
    const boom = new Error('callback failed');

    const error: any = await importSites({
      importData: importData(),
      resultCallback: (failed, site) => {
        calls.push(failed ? failed.message : site._id);
        if (site?._id === 'site-1') throw boom;
      },
      state,
    }).catch((e) => e);

    // the exception of the callback ends the run; it is not reported back as
    // a failed site
    expect(calls).toEqual(['site-1']);
    expect(rootCause(error)).toBe(boom);
    expect(putSite).toHaveBeenCalledTimes(1);
  });

  test('import data without sites still throws, with a callback too', async () => {
    const callback = jest.fn();

    await expect(
      importSites({
        importData: {} as any,
        resultCallback: callback,
        state,
      })
    ).rejects.toBeDefined();
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('importSites on the facade', () => {
  test('passes the result callback on', async () => {
    failSite('site-2');
    const callback = jest.fn();

    const result = await SiteOps(state).importSites(
      importData(),
      undefined,
      undefined,
      callback
    );

    expect(ids(result)).toEqual(['site-1', 'site-3']);
    expect(callback).toHaveBeenCalledTimes(3);
    expect((callback.mock.calls[1][0] as any).message).toBe(
      'Error importing site site-2'
    );
  });

  test('without a callback it throws one combined error as before', async () => {
    failSite('site-2');

    const error: any = await SiteOps(state)
      .importSites(importData())
      .catch((e) => e);

    expect(error.message).toBe('Error importing sites');
    expect(putSite).toHaveBeenCalledTimes(3);
  });
});
