/**
 * Live-socket test for readFeatures().
 *
 * Run with:
 *
 *        npm run test:only FeatureOps.unit
 *
 * A local loopback HTTP server (no Polly) answers the feature request with an
 * error: readFeatures() still returns no features, since the list is optional
 * information, but the debug output must say why.
 */
import http from 'http';
import { AddressInfo } from 'net';
import StateImpl from '../../shared/State';
import { readFeatures } from './FeatureOps';

describe('readFeatures()', () => {
  test('1: a failed read yields no features and says why in the debug output', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'denied' }));
    });
    await new Promise<void>((resolvePromise) =>
      server.listen(0, '127.0.0.1', () => resolvePromise())
    );
    try {
      const port = (server.address() as AddressInfo).port;
      const state = StateImpl({});
      state.setHost(`http://127.0.0.1:${port}/am`);
      state.setCookieName('iPlanetDirectoryPro');
      state.setUserSessionTokenMeta({
        tokenId: 'session-cookie-value',
        expires: Date.now() + 60 * 60 * 1000,
      } as any);
      const debug: string[] = [];
      state.setDebugHandler((message) => debug.push(String(message)));

      const features = await readFeatures({ state });

      expect(features).toEqual([]);
      expect(debug.join('\n')).toContain('could not read the feature list');
      expect(debug.join('\n')).toContain('HTTP 403');
      expect(debug.join('\n')).toContain('denied');
    } finally {
      await new Promise<void>((resolvePromise, rejectPromise) =>
        server.close((err) => (err ? rejectPromise(err) : resolvePromise()))
      );
    }
  });
});
