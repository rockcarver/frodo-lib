/**
 * Live-socket tests for readFeatures() and hasFeature().
 *
 * Run with:
 *
 *        npm run test:only FeatureOps.unit
 *
 * A local loopback HTTP server (no Polly) answers the feature request.
 *
 * readFeatures() tells the truth: an empty list means that the tenant has no features, a refused or failed read
 * is a FrodoError (frodo-lib#1085), and a failed read is not kept. hasFeature() is the tolerant gate: it answers
 * false when the list cannot be read, says why in the debug output and does not ask again for the same host.
 */
import http from 'http';
import { AddressInfo } from 'net';
import StateImpl from '../../shared/State';
import { FrodoError } from '../FrodoError';
import { hasFeature, readFeatures } from './FeatureOps';

type Answer = { status: number; body: unknown };

const FEATURES = {
  result: [
    {
      _id: 'service-accounts',
      installedVersion: 'v1',
      availableVersions: ['v1'],
    },
    { _id: 'iga', availableVersions: ['v1'] },
  ],
};

/** A server whose answer can be changed between calls; counts the requests. */
async function startServer(answer: () => Answer) {
  const requests: string[] = [];
  const server = http.createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    const { status, body } = answer();
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolvePromise) =>
    server.listen(0, '127.0.0.1', () => resolvePromise())
  );
  const port = (server.address() as AddressInfo).port;
  const stateFor = (host = `http://127.0.0.1:${port}/am`) => {
    const state = StateImpl({});
    state.setHost(host);
    state.setCookieName('iPlanetDirectoryPro');
    state.setUserSessionTokenMeta({
      tokenId: 'session-cookie-value',
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    return state;
  };
  return {
    requests,
    port,
    stateFor,
    close: () =>
      new Promise<void>((resolvePromise, rejectPromise) =>
        server.close((err) => (err ? rejectPromise(err) : resolvePromise()))
      ),
  };
}

describe('readFeatures()', () => {
  test('1: lists the features of the tenant (an empty list is a tenant without features)', async () => {
    const srv = await startServer(() => ({ status: 200, body: FEATURES }));
    try {
      const features = await readFeatures({ state: srv.stateFor() });
      expect(features.map((f) => f._id)).toEqual(['service-accounts', 'iga']);
    } finally {
      await srv.close();
    }
    const empty = await startServer(() => ({
      status: 200,
      body: { result: [] },
    }));
    try {
      expect(await readFeatures({ state: empty.stateFor() })).toEqual([]);
    } finally {
      await empty.close();
    }
  });

  test('2: a refused read (403) throws a FrodoError that carries the HTTP status', async () => {
    const srv = await startServer(() => ({
      status: 403,
      body: { message: 'denied' },
    }));
    try {
      const state = srv.stateFor();
      let thrown: unknown;
      try {
        await readFeatures({ state });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(FrodoError);
      const error = thrown as FrodoError;
      expect(error.message).toBe('Error reading the features');
      expect(error.getCombinedMessage()).toContain('403');
      expect(
        (error.originalErrors[0] as { response?: { status?: number } }).response
          ?.status
      ).toBe(403);
    } finally {
      await srv.close();
    }
  });

  test('3: a failed read is not kept as an empty list: the next call asks again and can succeed', async () => {
    let answer: Answer = { status: 403, body: { message: 'denied' } };
    const srv = await startServer(() => answer);
    try {
      const state = srv.stateFor();
      await expect(readFeatures({ state })).rejects.toBeInstanceOf(FrodoError);
      expect(state.getFeatures()).toBeUndefined();
      await expect(readFeatures({ state })).rejects.toBeInstanceOf(FrodoError);
      expect(srv.requests).toHaveLength(2);
      answer = { status: 200, body: FEATURES };
      const features = await readFeatures({ state });
      expect(features).toHaveLength(2);
      expect(srv.requests).toHaveLength(3);
    } finally {
      await srv.close();
    }
  });

  test('4: a successful read is kept: the second call makes no request', async () => {
    const srv = await startServer(() => ({ status: 200, body: FEATURES }));
    try {
      const state = srv.stateFor();
      await readFeatures({ state });
      await readFeatures({ state });
      expect(srv.requests).toHaveLength(1);
    } finally {
      await srv.close();
    }
  });

  test('5: a server error (500) also throws', async () => {
    const srv = await startServer(() => ({
      status: 500,
      body: { message: 'boom' },
    }));
    try {
      await expect(
        readFeatures({ state: srv.stateFor() })
      ).rejects.toBeInstanceOf(FrodoError);
    } finally {
      await srv.close();
    }
  });
});

describe('hasFeature()', () => {
  test('6: answers true for a feature in the list and false for one that is not', async () => {
    const srv = await startServer(() => ({ status: 200, body: FEATURES }));
    try {
      const state = srv.stateFor();
      expect(await hasFeature({ featureId: 'service-accounts', state })).toBe(
        true
      );
      expect(await hasFeature({ featureId: 'nothing', state })).toBe(false);
      expect(srv.requests).toHaveLength(1);
    } finally {
      await srv.close();
    }
  });

  test('7: a refused read (403) answers false, says why in the debug output and does not throw', async () => {
    const srv = await startServer(() => ({
      status: 403,
      body: { message: 'denied' },
    }));
    try {
      const state = srv.stateFor();
      const debug: string[] = [];
      state.setDebugHandler((message) => debug.push(String(message)));
      expect(await hasFeature({ featureId: 'service-accounts', state })).toBe(
        false
      );
      const text = debug.join('\n');
      expect(text).toContain('could not read the feature list');
      expect(text).toContain('HTTP 403');
      expect(text).toContain('denied');
    } finally {
      await srv.close();
    }
  });

  test('8: after a failed read it does not ask again for the same host, and readFeatures still tells the truth', async () => {
    const srv = await startServer(() => ({
      status: 403,
      body: { message: 'denied' },
    }));
    try {
      const state = srv.stateFor();
      expect(await hasFeature({ featureId: 'iga', state })).toBe(false);
      expect(await hasFeature({ featureId: 'service-accounts', state })).toBe(
        false
      );
      expect(srv.requests).toHaveLength(1);
      // the failure was not stored as an empty list
      expect(state.getFeatures()).toBeUndefined();
      await expect(readFeatures({ state })).rejects.toBeInstanceOf(FrodoError);
    } finally {
      await srv.close();
    }
  });

  test('9: a changed host is asked again (the memory of a failed read belongs to one host)', async () => {
    const refusing = await startServer(() => ({
      status: 403,
      body: { message: 'denied' },
    }));
    const serving = await startServer(() => ({ status: 200, body: FEATURES }));
    try {
      const state = refusing.stateFor();
      expect(await hasFeature({ featureId: 'service-accounts', state })).toBe(
        false
      );
      state.setHost(`http://127.0.0.1:${serving.port}/am`);
      expect(await hasFeature({ featureId: 'service-accounts', state })).toBe(
        true
      );
      expect(refusing.requests).toHaveLength(1);
      expect(serving.requests).toHaveLength(1);
    } finally {
      await refusing.close();
      await serving.close();
    }
  });
});
