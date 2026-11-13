/**
 * Live-socket tests for the request that reads the application template
 * catalog. The catalog lives on a public host, not on the tenant, so no
 * credential of the tenant may go with the request: a local loopback server
 * records the headers of what arrives. The same server serves the file as the
 * CDN does, stored compressed and compressed again by the transport.
 *
 * Run with:
 *
 *        npm run test:only ApplicationTemplateApi
 */
import http from 'http';
import { AddressInfo } from 'net';
import { gzipSync } from 'zlib';
import StateImpl from '../shared/State';
import {
  APP_TEMPLATE_CATALOG_MAX_DOWNLOAD_BYTES,
  APP_TEMPLATE_CATALOG_URLS,
  getApplicationTemplateCatalogFile,
} from './ApplicationTemplateApi';

type Received = { headers: http.IncomingHttpHeaders; url?: string };

async function withServer<T>(
  respond: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  run: (base: string, received: Received[]) => Promise<T>
): Promise<T> {
  const received: Received[] = [];
  const server = http.createServer((req, res) => {
    received.push({ headers: req.headers, url: req.url });
    respond(req, res);
  });
  await new Promise<void>((resolvePromise) =>
    server.listen(0, '127.0.0.1', () => resolvePromise())
  );
  try {
    const port = (server.address() as AddressInfo).port;
    return await run(`http://127.0.0.1:${port}`, received);
  } finally {
    await new Promise<void>((resolvePromise, rejectPromise) =>
      server.close((err) => (err ? rejectPromise(err) : resolvePromise()))
    );
  }
}

const catalogJson = JSON.stringify({
  AppTemplates: { consumer: {}, enterprise: {} },
});

/** A state that is logged in to a tenant in every way the library knows. */
function loggedInState() {
  const state = StateImpl({});
  state.setHost('https://openam-matrix.example.com/am');
  state.setCookieName('iPlanetDirectoryPro');
  state.setUserSessionTokenMeta({
    tokenId: 'session-cookie-value',
    expires: Date.now() + 60 * 60 * 1000,
  } as any);
  state.setBearerTokenMeta({
    access_token: 'tenant-bearer-token',
    token_type: 'Bearer',
    scope: 'fr:am:* fr:idm:*',
    expires_in: 3600,
    expires: Date.now() + 60 * 60 * 1000,
  } as any);
  state.setAuthenticationHeaderOverrides({ 'X-Tenant-Secret': 'auth-secret' });
  state.setConfigurationHeaderOverrides({ 'X-Tenant-Config': 'cfg-secret' });
  return state;
}

describe('getApplicationTemplateCatalogFile', () => {
  test('1: names the two catalogs of the CDN in one place', () => {
    expect(APP_TEMPLATE_CATALOG_URLS.production).toBe(
      'https://cdn.forgerock.com/platform/app-templates/appTemplates.json.gz'
    );
    expect(APP_TEMPLATE_CATALOG_URLS.development).toBe(
      'https://cdn.forgerock.com/platform/app-templates-development/appTemplates.json.gz'
    );
  });

  test('2: sends no credential, cookie or header override of the tenant', async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(catalogJson);
      },
      async (base, received) => {
        await getApplicationTemplateCatalogFile({
          url: `${base}/platform/app-templates/appTemplates.json.gz`,
          state: loggedInState(),
        });
        expect(received).toHaveLength(1);
        const headers = received[0].headers;
        expect(received[0].url).toBe(
          '/platform/app-templates/appTemplates.json.gz'
        );
        expect(headers.authorization).toBeUndefined();
        expect(headers.cookie).toBeUndefined();
        expect(headers['x-tenant-secret']).toBeUndefined();
        expect(headers['x-tenant-config']).toBeUndefined();
        expect(JSON.stringify(headers)).not.toMatch(
          /tenant-bearer-token|session-cookie-value|auth-secret|cfg-secret/
        );
        // it does say what it is, as every request of the library does
        expect(headers['user-agent']).toMatch(/frodo/i);
      }
    );
  });

  test('3: returns the bytes of a file that is stored compressed and compressed again by the transport, with the version headers', async () => {
    const stored = gzipSync(Buffer.from(catalogJson));
    await withServer(
      (_req, res) => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          ETag: '"abc123"',
          'Last-Modified': 'Thu, 12 Nov 2026 23:34:04 GMT',
        });
        res.end(gzipSync(stored));
      },
      async (base) => {
        const file = await getApplicationTemplateCatalogFile({
          url: `${base}/appTemplates.json.gz`,
          state: loggedInState(),
        });
        // the transport layer is undone, the stored layer is not
        expect(Buffer.compare(file.data, stored)).toBe(0);
        expect(file.etag).toBe('"abc123"');
        expect(file.lastModified).toBe('Thu, 12 Nov 2026 23:34:04 GMT');
      }
    );
  });

  test('4: leaves a body that is plain JSON unchanged and reports no version headers when there are none', async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(catalogJson);
      },
      async (base) => {
        const file = await getApplicationTemplateCatalogFile({
          url: `${base}/appTemplates.json`,
          state: StateImpl({}),
        });
        expect(file.data.toString('utf8')).toBe(catalogJson);
        expect(file.etag).toBeUndefined();
        expect(file.lastModified).toBeUndefined();
      }
    );
  });

  test('5: rejects on a failing status', async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(404);
        res.end('nope');
      },
      async (base) => {
        await expect(
          getApplicationTemplateCatalogFile({
            url: `${base}/missing.json.gz`,
            state: StateImpl({}),
          })
        ).rejects.toMatchObject({ name: 'AxiosError' });
      }
    );
  });

  test('6: refuses a body over the limit', async () => {
    expect(APP_TEMPLATE_CATALOG_MAX_DOWNLOAD_BYTES).toBe(16 * 1024 * 1024);
    await withServer(
      (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(Buffer.alloc(20 * 1024 * 1024, 0x20));
      },
      async (base) => {
        await expect(
          getApplicationTemplateCatalogFile({
            url: `${base}/big.json`,
            state: StateImpl({}),
          })
        ).rejects.toThrow(/maxContentLength/);
      }
    );
  });

  test('7: refuses a small body that the transport expands over the limit', async () => {
    const bomb = gzipSync(Buffer.alloc(64 * 1024 * 1024));
    expect(bomb.length).toBeLessThan(1024 * 1024);
    await withServer(
      (_req, res) => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
        });
        res.end(bomb);
      },
      async (base) => {
        await expect(
          getApplicationTemplateCatalogFile({
            url: `${base}/bomb.json`,
            state: StateImpl({}),
          })
        ).rejects.toThrow(/maxContentLength/);
      }
    );
  });

  test('8: reads a body that is just under the limit', async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(Buffer.alloc(4 * 1024 * 1024, 0x20));
      },
      async (base) => {
        const file = await getApplicationTemplateCatalogFile({
          url: `${base}/ok.json`,
          state: StateImpl({}),
        });
        expect(file.data.length).toBe(4 * 1024 * 1024);
      }
    );
  });
});
