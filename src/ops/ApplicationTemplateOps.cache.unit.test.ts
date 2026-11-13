/**
 * The file cache of the application template catalog, against a loopback
 * server that behaves like the public source: it sends an ETag and a
 * Last-Modified, answers a conditional request with 304 and counts every
 * request with the validators it carried. The real request code and the real
 * file system are used; only the address of the source is changed.
 *
 * Run with:
 *
 *        npm run test:only ApplicationTemplateOps.cache
 */
import fs from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import os from 'os';
import path from 'path';
import { gzipSync } from 'zlib';
import { jest } from '@jest/globals';
import { APP_TEMPLATE_CATALOG_URLS } from '../api/ApplicationTemplateApi';
import StateImpl from '../shared/State';
import {
  listTemplates,
  readCatalog,
  readTemplate,
} from './ApplicationTemplateOps';
import { FrodoError } from './FrodoError';

const MB = 1024 * 1024;
const HOUR = 3_600_000;

type Seen = {
  url: string;
  ifNoneMatch?: string;
  ifModifiedSince?: string;
  authorization?: string;
  cookie?: string;
};

/** What the loopback source answers. */
const source = {
  version: 1,
  mode: 'ok' as 'ok' | 'error500' | 'status404',
  seen: [] as Seen[],
};

const catalogText = (version: number) =>
  JSON.stringify({
    AppTemplates: {
      consumer: {
        Web: {
          '1_0-web': {
            id: 'web',
            templateVersion: '1.0',
            displayName: `Sample Web v${version}`,
          },
        },
      },
      enterprise: {},
    },
  });
const etagOf = (version: number) => `"etag-${version}"`;
const lastModifiedOf = (version: number) =>
  `Thu, 12 Nov 2026 23:3${version}:04 GMT`;

let server: http.Server;
let base: string;
const original = { ...APP_TEMPLATE_CATALOG_URLS };

beforeAll(async () => {
  server = http.createServer((req, res) => {
    source.seen.push({
      url: req.url ?? '',
      ifNoneMatch: req.headers['if-none-match'] as string | undefined,
      ifModifiedSince: req.headers['if-modified-since'] as string | undefined,
      authorization: req.headers.authorization,
      cookie: req.headers.cookie,
    });
    if (source.mode === 'error500') {
      res.writeHead(500);
      res.end('boom');
      return;
    }
    if (source.mode === 'status404') {
      res.writeHead(404);
      res.end('gone');
      return;
    }
    const etag = etagOf(source.version);
    const lastModified = lastModifiedOf(source.version);
    const matches =
      req.headers['if-none-match'] === etag ||
      (!req.headers['if-none-match'] &&
        req.headers['if-modified-since'] === lastModified);
    if (matches) {
      res.writeHead(304, { ETag: etag, 'Last-Modified': lastModified });
      res.end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      ETag: etag,
      'Last-Modified': lastModified,
    });
    res.end(gzipSync(Buffer.from(catalogText(source.version))));
  });
  await new Promise<void>((resolvePromise) =>
    server.listen(0, '127.0.0.1', () => resolvePromise())
  );
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  (APP_TEMPLATE_CATALOG_URLS as any).production =
    `${base}/production/appTemplates.json.gz`;
  (APP_TEMPLATE_CATALOG_URLS as any).development =
    `${base}/development/appTemplates.json.gz`;
});

afterAll(async () => {
  Object.assign(APP_TEMPLATE_CATALOG_URLS, original);
  await new Promise<void>((resolvePromise) =>
    server.close(() => resolvePromise())
  );
});

let directory: string;

beforeEach(() => {
  source.version = 1;
  source.mode = 'ok';
  source.seen = [];
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frodo-template-cache-'));
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(directory, { recursive: true, force: true });
});

/** A state with the cache on, pointed at the test directory. */
function cachingState(dir = directory) {
  const state = StateImpl({});
  state.setUseTemplateCatalogCache(true);
  state.setTemplateCatalogCachePath(dir);
  return state;
}

const files = (dir = directory, channel = 'production') => ({
  catalog: path.join(dir, `${channel}.json`),
  meta: path.join(dir, `${channel}.meta.json`),
});
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const nameIn = (result: any) =>
  result.catalog.AppTemplates.consumer.Web['1_0-web'].displayName;
const leftovers = (dir = directory) =>
  fs.readdirSync(dir).filter((name) => name.endsWith('.tmp'));

/** Make the kept copy older than `ageMs` by moving the time of its confirmation back. */
function ageCache(ageMs: number, dir = directory) {
  const meta = readJson(files(dir).meta);
  meta.fetchedAt = new Date(Date.now() - ageMs).toISOString();
  fs.writeFileSync(files(dir).meta, JSON.stringify(meta));
}

describe('the cache of the application template catalog', () => {
  test('1: a miss downloads without validators and keeps the decoded catalog and what identifies it', async () => {
    const result = await readCatalog({ state: cachingState() });
    expect(source.seen).toHaveLength(1);
    expect(source.seen[0]).toMatchObject({
      url: '/production/appTemplates.json.gz',
      ifNoneMatch: undefined,
      ifModifiedSince: undefined,
    });
    expect(result.metadata).toMatchObject({
      cache: 'miss',
      cachePath: files().catalog,
      etag: etagOf(1),
      lastModified: lastModifiedOf(1),
      cached: false,
    });
    // the file is the decoded catalog: it can be given to the library as an explicit catalog
    expect(fs.readFileSync(files().catalog, 'utf8')).toBe(catalogText(1));
    expect(readJson(files().meta)).toEqual({
      etag: etagOf(1),
      lastModified: lastModifiedOf(1),
      fetchedAt: result.metadata.fetchedAt,
      url: APP_TEMPLATE_CATALOG_URLS.production,
    });
    expect(leftovers()).toEqual([]);
    const explicit = await readCatalog({
      options: { catalog: fs.readFileSync(files().catalog) },
      state: StateImpl({}),
    });
    expect(nameIn(explicit)).toBe('Sample Web v1');
  });

  test('2: a fresh copy is used with no request at all', async () => {
    await readCatalog({ state: cachingState() });
    source.seen = [];
    const result = await readCatalog({ state: cachingState() });
    expect(source.seen).toEqual([]);
    expect(result.metadata.cache).toBe('fresh');
    expect(result.metadata.cachePath).toBe(files().catalog);
    expect(nameIn(result)).toBe('Sample Web v1');
  });

  test('3: a copy older than maxAgeMs is asked about with its validators; 304 keeps the files and moves the time of the confirmation', async () => {
    await readCatalog({ state: cachingState() });
    ageCache(2 * HOUR);
    const catalogBefore = fs.statSync(files().catalog);
    const metaBefore = readJson(files().meta);
    source.seen = [];
    const result = await readCatalog({ state: cachingState() });
    expect(source.seen).toHaveLength(1);
    expect(source.seen[0]).toMatchObject({
      ifNoneMatch: etagOf(1),
      ifModifiedSince: lastModifiedOf(1),
    });
    expect(result.metadata.cache).toBe('revalidated');
    expect(nameIn(result)).toBe('Sample Web v1');
    // the catalog file is not written again, the meta file has a new time
    expect(fs.statSync(files().catalog).mtimeMs).toBe(catalogBefore.mtimeMs);
    expect(fs.readFileSync(files().catalog, 'utf8')).toBe(catalogText(1));
    const metaAfter = readJson(files().meta);
    expect(Date.parse(metaAfter.fetchedAt)).toBeGreaterThan(
      Date.parse(metaBefore.fetchedAt)
    );
    expect({ ...metaAfter, fetchedAt: '' }).toEqual({
      ...metaBefore,
      fetchedAt: '',
    });
    expect(result.metadata.fetchedAt).toBe(metaAfter.fetchedAt);
    // and now it is fresh again
    source.seen = [];
    await readCatalog({ state: cachingState() });
    expect(source.seen).toEqual([]);
  });

  test('4: maxAgeMs is a per-call option: a copy that is fresh for an hour is stale for 0', async () => {
    await readCatalog({ state: cachingState() });
    source.seen = [];
    const result = await readCatalog({
      options: { maxAgeMs: 0 },
      state: cachingState(),
    });
    expect(source.seen).toHaveLength(1);
    expect(result.metadata.cache).toBe('revalidated');
    await expect(
      readCatalog({ options: { maxAgeMs: -1 }, state: cachingState() })
    ).rejects.toThrow('maxAgeMs must be a number of milliseconds');
    await expect(
      readCatalog({ options: { maxAgeMs: NaN }, state: cachingState() })
    ).rejects.toThrow('maxAgeMs must be a number of milliseconds');
  });

  test('5: a catalog that changed (200) replaces both files', async () => {
    await readCatalog({ state: cachingState() });
    ageCache(2 * HOUR);
    source.version = 2;
    const result = await readCatalog({ state: cachingState() });
    expect(result.metadata).toMatchObject({
      cache: 'refreshed',
      etag: etagOf(2),
      lastModified: lastModifiedOf(2),
    });
    expect(nameIn(result)).toBe('Sample Web v2');
    expect(fs.readFileSync(files().catalog, 'utf8')).toBe(catalogText(2));
    expect(readJson(files().meta)).toMatchObject({
      etag: etagOf(2),
      lastModified: lastModifiedOf(2),
    });
    expect(leftovers()).toEqual([]);
  });

  test('6: a copy without validators is asked about unconditionally', async () => {
    await readCatalog({ state: cachingState() });
    fs.writeFileSync(
      files().meta,
      JSON.stringify({
        fetchedAt: new Date(Date.now() - 2 * HOUR).toISOString(),
        url: APP_TEMPLATE_CATALOG_URLS.production,
      })
    );
    source.seen = [];
    const result = await readCatalog({ state: cachingState() });
    expect(source.seen).toHaveLength(1);
    expect(source.seen[0].ifNoneMatch).toBeUndefined();
    expect(source.seen[0].ifModifiedSince).toBeUndefined();
    expect(result.metadata.cache).toBe('refreshed');
    expect(readJson(files().meta).etag).toBe(etagOf(1));
  });

  test('7: a missing meta file is a copy of unknown age: asked about without validators', async () => {
    await readCatalog({ state: cachingState() });
    fs.rmSync(files().meta);
    source.seen = [];
    const result = await readCatalog({ state: cachingState() });
    expect(source.seen).toHaveLength(1);
    expect(source.seen[0].ifNoneMatch).toBeUndefined();
    expect(result.metadata.cache).toBe('refreshed');
    expect(fs.existsSync(files().meta)).toBe(true);
  });

  test('8: validators that are not safe header values are not sent', async () => {
    await readCatalog({ state: cachingState() });
    const meta = readJson(files().meta);
    meta.etag = '"x"\r\nX-Injected: 1';
    meta.lastModified = 'x'.repeat(300);
    meta.fetchedAt = new Date(Date.now() - 2 * HOUR).toISOString();
    fs.writeFileSync(files().meta, JSON.stringify(meta));
    source.seen = [];
    const result = await readCatalog({ state: cachingState() });
    expect(source.seen).toHaveLength(1);
    expect(source.seen[0].ifNoneMatch).toBeUndefined();
    expect(source.seen[0].ifModifiedSince).toBeUndefined();
    expect(result.metadata.cache).toBe('refreshed');
  });

  test('9: a confirmation time in the future does not make a copy fresh', async () => {
    await readCatalog({ state: cachingState() });
    const meta = readJson(files().meta);
    meta.fetchedAt = new Date(Date.now() + 10 * HOUR).toISOString();
    fs.writeFileSync(files().meta, JSON.stringify(meta));
    source.seen = [];
    const result = await readCatalog({ state: cachingState() });
    expect(source.seen).toHaveLength(1);
    expect(result.metadata.cache).toBe('revalidated');
  });

  test('10: a meta file for another url is ignored', async () => {
    await readCatalog({ state: cachingState() });
    const meta = readJson(files().meta);
    meta.url = 'https://elsewhere.example.com/appTemplates.json.gz';
    fs.writeFileSync(files().meta, JSON.stringify(meta));
    source.seen = [];
    const result = await readCatalog({ state: cachingState() });
    expect(source.seen).toHaveLength(1);
    expect(source.seen[0].ifNoneMatch).toBeUndefined();
    expect(result.metadata.cache).toBe('refreshed');
    expect(readJson(files().meta).url).toBe(
      APP_TEMPLATE_CATALOG_URLS.production
    );
  });

  test('11: refresh asks the source now, with the validators, and ignoreCache downloads without them; both rewrite what changed', async () => {
    await readCatalog({ state: cachingState() });
    source.seen = [];
    const refreshed = await readCatalog({
      options: { refresh: true },
      state: cachingState(),
    });
    expect(source.seen).toHaveLength(1);
    expect(source.seen[0].ifNoneMatch).toBe(etagOf(1));
    expect(refreshed.metadata.cache).toBe('revalidated');

    source.seen = [];
    source.version = 2;
    const forced = await readCatalog({
      options: { ignoreCache: true },
      state: cachingState(),
    });
    expect(source.seen).toHaveLength(1);
    expect(source.seen[0].ifNoneMatch).toBeUndefined();
    expect(source.seen[0].ifModifiedSince).toBeUndefined();
    expect(forced.metadata.cache).toBe('refreshed');
    expect(fs.readFileSync(files().catalog, 'utf8')).toBe(catalogText(2));
  });

  test('12: a second read in the same state does not touch the files or the source', async () => {
    const state = cachingState();
    await readCatalog({ state });
    source.seen = [];
    fs.rmSync(directory, { recursive: true, force: true });
    const again = await readCatalog({ state });
    expect(source.seen).toEqual([]);
    expect(again.metadata.cached).toBe(true);
    expect(nameIn(again)).toBe('Sample Web v1');
  });

  test('13: the channels do not share files', async () => {
    const state = cachingState();
    await readCatalog({ state });
    source.version = 2;
    const development = await readCatalog({
      options: { channel: 'development' },
      state,
    });
    expect(development.metadata.cachePath).toBe(
      files(directory, 'development').catalog
    );
    expect(source.seen.map((s) => s.url)).toEqual([
      '/production/appTemplates.json.gz',
      '/development/appTemplates.json.gz',
    ]);
    expect(fs.readdirSync(directory).sort()).toEqual([
      'development.json',
      'development.meta.json',
      'production.json',
      'production.meta.json',
    ]);
    expect(fs.readFileSync(files().catalog, 'utf8')).toBe(catalogText(1));
    expect(
      fs.readFileSync(files(directory, 'development').catalog, 'utf8')
    ).toBe(catalogText(2));
    expect(readJson(files(directory, 'development').meta).url).toBe(
      APP_TEMPLATE_CATALOG_URLS.development
    );
  });

  test('14: the directory is created, however deep', async () => {
    const deep = path.join(directory, 'a', 'b', 'c');
    await readCatalog({ state: cachingState(deep) });
    expect(fs.existsSync(files(deep).catalog)).toBe(true);
  });
});

describe('the cache of the application template catalog: files that are not trusted', () => {
  const deepText = (levels: number) =>
    '{"AppTemplates":{"consumer":{"Web":{"1_0-web":{"id":"web","templateVersion":"1.0","deep":' +
    '['.repeat(levels) +
    ']'.repeat(levels) +
    '}}},"enterprise":{}}}';

  test.each([
    ['not JSON', () => '<html>not a catalog</html>'],
    ['empty', () => ''],
    ['the wrong shape', () => JSON.stringify({ hello: 'world' })],
    [
      'an entry that is not a template',
      () =>
        JSON.stringify({
          AppTemplates: { consumer: { Web: { x: null } }, enterprise: {} },
        }),
    ],
    ['20,000 levels deep', () => deepText(20000)],
    ['over the size limit', () => Buffer.alloc(33 * MB, 0x20)],
    ['gzip bombs', () => gzipSync(Buffer.alloc(64 * MB))],
  ])(
    '1: a copy that is %s is a miss and is overwritten',
    async (_name, make) => {
      await readCatalog({ state: cachingState() });
      fs.writeFileSync(files().catalog, make());
      source.seen = [];
      const messages: string[] = [];
      const state = cachingState();
      state.setDebugHandler((message) => messages.push(String(message)));
      const result = await readCatalog({ state });
      // downloaded again, without validators of a copy that cannot be used
      expect(source.seen).toHaveLength(1);
      expect(result.metadata.cache).toBe('miss');
      expect(nameIn(result)).toBe('Sample Web v1');
      expect(fs.readFileSync(files().catalog, 'utf8')).toBe(catalogText(1));
      expect(
        messages.some(
          (m) =>
            m.includes('ApplicationTemplateOps.readCatalog') ||
            m.includes('ApplicationTemplateCatalogCache')
        )
      ).toBe(true);
    }
  );

  test('2: a catalog file that is a directory is a miss', async () => {
    fs.mkdirSync(files().catalog, { recursive: true });
    const result = await readCatalog({ state: cachingState() });
    expect(result.metadata.cache).toBe('miss');
    expect(nameIn(result)).toBe('Sample Web v1');
  });

  test('3: a meta file that is not JSON, or too large, is a missing meta file', async () => {
    for (const content of ['{not json', 'x'.repeat(100 * 1024)]) {
      await readCatalog({ state: cachingState() });
      fs.writeFileSync(files().meta, content);
      source.seen = [];
      const result = await readCatalog({ state: cachingState() });
      expect(source.seen).toHaveLength(1);
      expect(source.seen[0].ifNoneMatch).toBeUndefined();
      expect(result.metadata.cache).toBe('refreshed');
    }
  });

  test('4: display fields that are not text in a copy are dropped, the copy is used', async () => {
    await readCatalog({ state: cachingState() });
    fs.writeFileSync(
      files().catalog,
      JSON.stringify({
        AppTemplates: {
          consumer: {
            Web: {
              '1_0-web': {
                id: 'web',
                templateVersion: '1.0',
                displayName: { en: 'Web' },
              },
            },
          },
          enterprise: {},
        },
      })
    );
    source.seen = [];
    const result = await readCatalog({ state: cachingState() });
    expect(source.seen).toEqual([]);
    expect(result.metadata.cache).toBe('fresh');
    expect(nameIn(result)).toBeUndefined();
  });
});

describe('the cache of the application template catalog: writes', () => {
  test('1: a directory that cannot be written does not fail the read', async () => {
    // a plain file where the directory should be
    const blocker = path.join(directory, 'blocker');
    fs.writeFileSync(blocker, 'x');
    const messages: string[] = [];
    const state = cachingState(blocker);
    state.setDebugHandler((message) => messages.push(String(message)));
    const result = await readCatalog({ state });
    expect(nameIn(result)).toBe('Sample Web v1');
    expect(result.metadata.cache).toBe('miss');
    expect(messages.some((m) => m.includes('could not be written'))).toBe(true);
  });

  test('2: a failed write leaves the old file intact and no temporary file, and no validators are written for a copy that was not', async () => {
    await readCatalog({ state: cachingState() });
    ageCache(2 * HOUR);
    const metaBefore = fs.readFileSync(files().meta, 'utf8');
    source.version = 2;
    // the rename of the catalog fails, the rename of the meta file would work
    const real = fs.renameSync;
    const rename = jest.spyOn(fs, 'renameSync').mockImplementation(((
      from: any,
      to: any
    ) => {
      if (String(to) === files().catalog) {
        throw Object.assign(new Error('disk is full'), { code: 'ENOSPC' });
      }
      return real(from, to);
    }) as any);
    const messages: string[] = [];
    const state = cachingState();
    state.setDebugHandler((message) => messages.push(String(message)));
    const result = await readCatalog({ state });
    rename.mockRestore();
    // the read still worked, from the new download
    expect(nameIn(result)).toBe('Sample Web v2');
    // the old copy and its validators are as they were
    expect(fs.readFileSync(files().catalog, 'utf8')).toBe(catalogText(1));
    expect(fs.readFileSync(files().meta, 'utf8')).toBe(metaBefore);
    expect(leftovers()).toEqual([]);
    expect(messages.some((m) => m.includes('disk is full'))).toBe(true);
  });

  test('3: a reader never sees a partial file: the file is replaced by a rename', async () => {
    await readCatalog({ state: cachingState() });
    ageCache(2 * HOUR);
    source.version = 2;
    const renames: string[][] = [];
    const real = fs.renameSync;
    jest.spyOn(fs, 'renameSync').mockImplementation(((from: any, to: any) => {
      renames.push([String(from), String(to)]);
      return real(from, to);
    }) as any);
    await readCatalog({ state: cachingState() });
    const toCatalog = renames.find(([, to]) => to === files().catalog);
    expect(toCatalog).toBeDefined();
    // the temporary file is in the same directory, so the rename is atomic
    expect(path.dirname(toCatalog[0])).toBe(directory);
    expect(toCatalog[0]).toMatch(/\.tmp$/);
  });
});

describe('the cache of the application template catalog: when the source fails', () => {
  test('1: a copy is used when the source answers 500, and the result says so', async () => {
    await readCatalog({ state: cachingState() });
    ageCache(2 * HOUR);
    source.mode = 'error500';
    const result = await readCatalog({ state: cachingState() });
    expect(result.metadata.cache).toBe('stale-after-error');
    expect(result.metadata.cacheError).toMatch(/500/);
    expect(nameIn(result)).toBe('Sample Web v1');
    // the copy and its validators are left alone
    expect(fs.readFileSync(files().catalog, 'utf8')).toBe(catalogText(1));
  });

  test('2: a copy is used when the source cannot be reached', async () => {
    await readCatalog({ state: cachingState() });
    ageCache(2 * HOUR);
    // a port nothing listens on
    const closed = http.createServer();
    await new Promise<void>((r) => closed.listen(0, '127.0.0.1', () => r()));
    const port = (closed.address() as AddressInfo).port;
    await new Promise<void>((r) => closed.close(() => r()));
    (APP_TEMPLATE_CATALOG_URLS as any).production =
      `http://127.0.0.1:${port}/x`;
    try {
      // the meta file is for the url of the working source: give it the dead one
      const meta = readJson(files().meta);
      meta.url = `http://127.0.0.1:${port}/x`;
      fs.writeFileSync(files().meta, JSON.stringify(meta));
      const result = await readCatalog({ state: cachingState() });
      expect(result.metadata.cache).toBe('stale-after-error');
      expect(result.metadata.cacheError).toBeDefined();
      expect(nameIn(result)).toBe('Sample Web v1');
    } finally {
      (APP_TEMPLATE_CATALOG_URLS as any).production =
        `${base}/production/appTemplates.json.gz`;
    }
  });

  test('3: a 404 is not a reason to use the old copy', async () => {
    await readCatalog({ state: cachingState() });
    ageCache(2 * HOUR);
    source.mode = 'status404';
    const error = await readCatalog({ state: cachingState() }).catch((e) => e);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toContain(
      'Error reading the application template catalog'
    );
  });

  test('4: ignoreCache means a fresh download: a failure is an error, not the old copy', async () => {
    await readCatalog({ state: cachingState() });
    source.mode = 'error500';
    await expect(
      readCatalog({ options: { ignoreCache: true }, state: cachingState() })
    ).rejects.toThrow('Error reading the application template catalog');
  });

  test('5: without a copy a failure is an error', async () => {
    source.mode = 'error500';
    await expect(readCatalog({ state: cachingState() })).rejects.toThrow(
      'Error reading the application template catalog'
    );
  });
});

describe('the cache of the application template catalog: air-gapped mode', () => {
  test('1: the kept copy is used with no request, whatever its age', async () => {
    await readCatalog({ state: cachingState() });
    ageCache(400 * 24 * HOUR);
    source.seen = [];
    const state = cachingState();
    state.setAirGapped(true);
    for (const options of [
      {},
      { refresh: true },
      { ignoreCache: true },
      { maxAgeMs: 0 },
    ]) {
      const result = await readCatalog({ options, state });
      expect(result.metadata).toMatchObject({
        cache: 'offline',
        cachePath: files().catalog,
      });
      expect(nameIn(result)).toBe('Sample Web v1');
    }
    expect(source.seen).toEqual([]);
  });

  test('2: without a copy the error has the code AIR_GAPPED and nothing is requested', async () => {
    const state = cachingState();
    state.setAirGapped(true);
    const error = await readCatalog({ state }).catch((e) => e);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.code).toBe('AIR_GAPPED');
    expect(source.seen).toEqual([]);
    expect(fs.existsSync(directory) && fs.readdirSync(directory)).toEqual([]);
  });

  test.each([
    ['not JSON', () => 'nope'],
    ['20,000 levels deep', () => '['.repeat(20000) + ']'.repeat(20000)],
    ['over the size limit', () => Buffer.alloc(33 * MB, 0x20)],
  ])('3: a copy that is %s is not used', async (_name, make) => {
    await readCatalog({ state: cachingState() });
    fs.writeFileSync(files().catalog, make());
    source.seen = [];
    const state = cachingState();
    state.setAirGapped(true);
    await expect(readCatalog({ state })).rejects.toMatchObject({
      code: 'AIR_GAPPED',
    });
    expect(source.seen).toEqual([]);
  });

  test('4: with the cache off, air-gapped mode refuses as before even if files exist', async () => {
    await readCatalog({ state: cachingState() });
    const state = StateImpl({});
    state.setTemplateCatalogCachePath(directory);
    state.setAirGapped(true);
    await expect(readCatalog({ state })).rejects.toMatchObject({
      code: 'AIR_GAPPED',
    });
  });

  test('5: a catalog file without a meta file is used offline', async () => {
    await readCatalog({ state: cachingState() });
    fs.rmSync(files().meta);
    const state = cachingState();
    state.setAirGapped(true);
    const result = await readCatalog({ state });
    expect(result.metadata.cache).toBe('offline');
    expect(Number.isFinite(Date.parse(result.metadata.fetchedAt))).toBe(true);
  });

  test('6: a url the caller names is not cached and is not affected by the copy', async () => {
    await readCatalog({ state: cachingState() });
    const state = cachingState();
    state.setAirGapped(true);
    const result = await readCatalog({
      options: { url: `${base}/other/appTemplates.json.gz` },
      state,
    });
    expect(result.metadata).toMatchObject({ cache: 'disabled' });
    expect(result.metadata.cachePath).toBeUndefined();
    expect(source.seen.at(-1).url).toBe('/other/appTemplates.json.gz');
  });
});

describe('the cache of the application template catalog: what it does not cover', () => {
  test('1: it is off unless the state turns it on, and nothing is written then', async () => {
    const state = StateImpl({});
    state.setTemplateCatalogCachePath(directory);
    const result = await readCatalog({ state });
    expect(result.metadata.cache).toBe('disabled');
    expect(result.metadata.cachePath).toBeUndefined();
    expect(fs.readdirSync(directory)).toEqual([]);
    expect(StateImpl({}).getUseTemplateCatalogCache()).toBe(false);
  });

  test('2: an explicit catalog and a url the caller names never write a cache', async () => {
    const state = cachingState();
    await readCatalog({ options: { catalog: catalogText(1) }, state });
    await readCatalog({
      options: { url: `${base}/mine/appTemplates.json.gz` },
      state,
    });
    await readCatalog({
      options: { url: `${base}/mine/appTemplates.json.gz`, refresh: true },
      state,
    });
    expect(fs.readdirSync(directory)).toEqual([]);
    // and the url is asked about without validators every time it is refreshed
    expect(source.seen.every((s) => s.ifNoneMatch === undefined)).toBe(true);
  });

  test('3: two states with different paths and flags do not affect each other', async () => {
    const other = fs.mkdtempSync(
      path.join(os.tmpdir(), 'frodo-template-cache-')
    );
    try {
      const a = cachingState(directory);
      const b = cachingState(other);
      const off = StateImpl({});
      await readCatalog({ state: a });
      expect(fs.existsSync(files(other).catalog)).toBe(false);
      source.version = 2;
      await readCatalog({ state: b });
      expect(fs.readFileSync(files(directory).catalog, 'utf8')).toBe(
        catalogText(1)
      );
      expect(fs.readFileSync(files(other).catalog, 'utf8')).toBe(
        catalogText(2)
      );
      const result = await readCatalog({ state: off });
      expect(result.metadata.cache).toBe('disabled');
      expect(a.getTemplateCatalogCachePath()).toBe(directory);
      expect(b.getTemplateCatalogCachePath()).toBe(other);
      expect(off.getTemplateCatalogCachePath()).toBeUndefined();
      a.setUseTemplateCatalogCache(false);
      expect(b.getUseTemplateCatalogCache()).toBe(true);
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  test('4: the default directory is the Frodo home folder AppTemplates', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'frodo-template-home-'));
    jest.spyOn(os, 'homedir').mockReturnValue(home);
    try {
      const state = StateImpl({});
      state.setUseTemplateCatalogCache(true);
      const result = await readCatalog({ state });
      expect(result.metadata.cachePath).toBe(
        path.join(home, '.frodo', 'AppTemplates', 'production.json')
      );
      expect(fs.existsSync(result.metadata.cachePath)).toBe(true);
    } finally {
      jest.restoreAllMocks();
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('5: the requests carry no credential of the tenant, with or without validators', async () => {
    const state = cachingState();
    state.setHost('https://openam-matrix.example.com/am');
    state.setCookieName('iPlanetDirectoryPro');
    state.setUserSessionTokenMeta({
      tokenId: 'session-cookie-value',
      expires: Date.now() + HOUR,
    } as any);
    state.setBearerTokenMeta({
      access_token: 'tenant-bearer-token',
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 3600,
      expires: Date.now() + HOUR,
    } as any);
    state.setAuthenticationHeaderOverrides({
      'X-Tenant-Secret': 'auth-secret',
    });
    // a download, a conditional request and an unconditional one
    await readCatalog({ state });
    await readCatalog({ options: { refresh: true }, state });
    await readCatalog({ options: { ignoreCache: true }, state });
    expect(source.seen).toHaveLength(3);
    expect(source.seen[1].ifNoneMatch).toBe(etagOf(1));
    for (const request of source.seen) {
      expect(request.authorization).toBeUndefined();
      expect(request.cookie).toBeUndefined();
    }
  });

  test('6: listTemplates and readTemplate use the cache too', async () => {
    const state = cachingState();
    const items = await listTemplates({
      options: { includeOverrides: false },
      state,
    });
    expect(items.map((i) => i.templateId)).toEqual(['1_0-web']);
    source.seen = [];
    const found = await readTemplate({
      application: { templateName: 'web', templateVersion: '1.0' },
      options: { includeOverrides: false },
      state: cachingState(),
    });
    expect(source.seen).toEqual([]);
    expect(found.catalog.cache).toBe('fresh');
    expect(found.found).toBe(true);
  });
});
