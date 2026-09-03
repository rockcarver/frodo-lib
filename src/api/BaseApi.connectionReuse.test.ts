/**
 * Live-socket tests for the BaseApi outbound connection keep-alive.
 *
 * Run with:
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent BaseApi.connectionReuse
 *
 * These cells use a local loopback HTTP server (no Polly) to verify real
 * socket behavior:
 *   1. two sequential axios calls through the lib's shared agents reuse a
 *      single TCP connection when keep-alive is on;
 *   2. a short-lived Node process that makes one call through the lib's agent
 *      path and then exits naturally is not held open by free keep-alive
 *      sockets (verified empirically on Node v24 — see CHANGELOG).
 *
 * The opt-out and exit cells spawn a fresh Node process against the built
 * CJS dist bundle because FRODO_NO_KEEPALIVE is evaluated at module load time
 * and the jest worker already has the module graph loaded. They use async
 * spawn (not spawnSync) so the jest-hosted loopback server can serve while
 * the child runs.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import { resolve } from 'path';

import { generateAmApi } from './BaseApi';
import StateImpl from '../shared/State';

const REPO_ROOT = resolve('.');
const TMP_DIR = resolve('.', 'test', 'fs_tmp');
const DIST_ENTRY = resolve('.', 'dist', 'index.js');
const CHILD_SCRIPT = resolve(TMP_DIR, 'BaseApi.keepalive-child.cjs');

function createServer(): Promise<http.Server> {
  return new Promise((resolvePromise) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });
    server.listen(0, '127.0.0.1', () => resolvePromise(server));
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    server.close((err) => (err ? rejectPromise(err) : resolvePromise()));
  });
}

interface ChildResult {
  code: number;
  stdout: string;
}

function runChild(
  timeoutMs: number = 30000,
  env: NodeJS.ProcessEnv = process.env
): Promise<ChildResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [CHILD_SCRIPT], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(
        new Error(`child timed out after ${timeoutMs}ms; stdout=${stdout}`)
      );
    }, timeoutMs);
    child.stdout.on('data', (d) => {
      stdout += String(d);
    });
    child.stderr.on('data', (d) => {
      stderr += String(d);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolvePromise({ code: code ?? -1, stdout });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      rejectPromise(err);
    });
    void stderr;
  });
}

describe('BaseApi real-socket connection reuse (loopback)', () => {
  test('two sequential calls through the shared agents reuse one TCP connection', async () => {
    let serverConnections = 0;
    const server = await createServer();
    server.on('connection', () => {
      serverConnections++;
    });
    const port = (server.address() as AddressInfo).port;
    try {
      const state = StateImpl({});
      const request = generateAmApi({
        resource: {},
        requestOverride: { baseURL: `http://127.0.0.1:${port}` },
        state,
      });
      const res1 = await request.get('/');
      const res2 = await request.get('/');
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(serverConnections).toBe(1);
    } finally {
      await closeServer(server);
    }
  });
});

describe('BaseApi short-lived-process behavior (loopback, child process)', () => {
  beforeAll(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  });

  afterAll(() => {
    try {
      fs.unlinkSync(CHILD_SCRIPT);
    } catch (error) {
      // ignore
    }
  });

  test('FRODO_NO_KEEPALIVE=1 makes two sequential calls use two TCP connections', async () => {
    let serverConnections = 0;
    const server = await createServer();
    server.on('connection', () => {
      serverConnections++;
    });
    const port = (server.address() as AddressInfo).port;
    const script = `
const { frodo } = require('${DIST_ENTRY}');
const instance = frodo.createInstance({});
instance.state.setHost('http://127.0.0.1:${port}');
instance.state.setBearerTokenMeta({ access_token: 'test-token', token_type: 'Bearer', expires_in: 3600, scope: 'test' });
instance.state.setDeploymentType('classic');
(async () => {
  // two sequential public-API calls through the same instance share its agents
  try { await instance.info.getInfo(); } catch (e) { /* response content irrelevant */ }
  try { await instance.info.getInfo(); } catch (e) { /* response content irrelevant */ }
  console.log('TWO_CALLS_DONE');
})();
`;
    fs.writeFileSync(CHILD_SCRIPT, script);
    try {
      const result = await runChild(30000, {
        ...process.env,
        FRODO_NO_KEEPALIVE: '1',
      });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('TWO_CALLS_DONE');
      expect(serverConnections).toBe(2);
    } finally {
      await closeServer(server);
    }
  }, 60000);

  test('a one-shot process making one call through the lib agents exits promptly', async () => {
    const server = await createServer();
    const port = (server.address() as AddressInfo).port;
    const script = `
const { frodo } = require('${DIST_ENTRY}');
const instance = frodo.createInstance({});
instance.state.setHost('http://127.0.0.1:${port}');
instance.state.setBearerTokenMeta({ access_token: 'test-token', token_type: 'Bearer', expires_in: 3600, scope: 'test' });
instance.state.setDeploymentType('classic');
const t0 = Date.now();
(async () => {
  try {
    await instance.info.getInfo();
  } catch (e) {
    // any HTTP response exercises the agents; only transport-level failures
    // fail. frodo wraps errors, so inspect the whole error chain.
    const messages = [];
    let cursor = e;
    while (cursor) {
      messages.push(String(cursor.message || cursor));
      cursor = cursor.originalErrors ? cursor.originalErrors[0] : cursor.cause;
    }
    const all = messages.join(' | ');
    if (!/status code|401|403|404|405|ECONN|EPROTO|JSON|Unexpected token/.test(all)) {
      console.error('UNEXPECTED: ' + all);
      process.exit(1);
    }
  }
  console.log('CALL_DONE ' + (Date.now() - t0));
})();
`;
    fs.writeFileSync(CHILD_SCRIPT, script);
    try {
      const started = Date.now();
      const result = await runChild();
      const elapsed = Date.now() - started;
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('CALL_DONE');
      // A hung process would hit the child timeout; normal Node startup plus
      // one loopback call completes well under 10s.
      expect(elapsed).toBeLessThan(10000);
    } finally {
      await closeServer(server);
    }
  }, 60000);
});
