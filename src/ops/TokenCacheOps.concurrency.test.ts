/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent TokenCacheOps.concurrency
 *
 * Several real processes use one token cache at the same time (the situation
 * of several MCP server processes next to command line runs). Nothing may be
 * lost, no file may ever be seen half written, and the entry that several
 * writers share must end up with a token of their last round. Real child
 * processes and real file I/O against a scratch directory; runs on every
 * operating system of the cross-platform job.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import { resolve } from 'path';
import StateImpl from '../shared/State';
import { getTokenCacheDir, listCachedSessions } from './TokenCacheOps';

const TMP_DIR = resolve('.', 'test', 'fs_tmp', 'TokenCacheOps.concurrency');
const HOOK = resolve('.', 'test', 'support', 'register-ts.cjs');
const WORKER = resolve('.', 'test', 'support', 'tokenCacheWorker.ts');
const HOST = 'https://openam-concurrency.example.com/am';

type WorkerResult = { id: number; [key: string]: number };

function runWorker(args: object): {
  done: Promise<WorkerResult>;
} {
  const child = spawn(
    process.execPath,
    ['-r', HOOK, WORKER, JSON.stringify(args)],
    {
      cwd: resolve('.'),
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  const done = new Promise<WorkerResult>((resolveDone, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0)
        reject(new Error(`worker exited with ${code}: ${stderr}`));
      else resolveDone(JSON.parse(stdout.trim().split('\n').pop() as string));
    });
  });
  return { done };
}

describe('token cache used by several processes at the same time', () => {
  beforeAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(TMP_DIR, { recursive: true });
    // the master key is created before the processes start; creating it is not
    // what this test is about
    fs.writeFileSync(resolve(TMP_DIR, 'masterkey.key'), 'test-master-key');
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  test('no entry is lost, no file is seen half written, and the shared entry ends up with a token of the last round', async () => {
    const writers = 6;
    const count = 12;
    const cachePath = resolve(TMP_DIR, 'TokenCache.json');
    const stopFile = resolve(TMP_DIR, 'stop');
    const baseExpires = Date.now() + 3_600_000;
    const common = {
      cachePath,
      masterKeyPath: resolve(TMP_DIR, 'masterkey.key'),
      host: HOST,
      count,
      baseExpires,
    };

    const readers = [0, 1].map((id) =>
      runWorker({ ...common, mode: 'read', id: 100 + id, stopFile })
    );
    const writing = Array.from({ length: writers }, (_, id) =>
      runWorker({ ...common, mode: 'write', id })
    );
    const written = await Promise.all(writing.map((w) => w.done));
    fs.writeFileSync(stopFile, '');
    const read = await Promise.all(readers.map((r) => r.done));

    // every save reported success
    for (const result of written) expect(result.saved).toBe(count * 2);
    // no reader ever saw a file that did not parse
    for (const result of read) expect(result.unparsable).toBe(0);

    const state = StateImpl({ host: HOST });
    state.setTokenCachePath(cachePath);
    const sessions = listCachedSessions({ state });
    // each writer's own entries are all there, plus the one entry they share
    expect(sessions).toHaveLength(writers * count + 1);
    const shared = sessions.find((s) => s.subject === 'shared');
    // The shared entry holds a token of the last round of the writers. Which
    // of the last round's tokens wins is not decided: two writers that check
    // the entry at the same moment both write, and the later rename stays.
    // Both tokens are valid, so that costs nothing. What may never happen is
    // that an early token of one writer outlives the last round of the others.
    const lastRound = baseExpires + 1000 + (count - 1) * 100;
    expect(shared?.expires).toBeGreaterThanOrEqual(lastRound);
    expect(shared?.expires).toBeLessThanOrEqual(lastRound + writers - 1);
    // nothing is left behind but entries
    const names = fs.readdirSync(getTokenCacheDir({ state }));
    expect(names.filter((name) => !name.endsWith('.json'))).toEqual([]);
    for (const name of names) {
      expect(() =>
        JSON.parse(
          fs.readFileSync(resolve(getTokenCacheDir({ state }), name), 'utf8')
        )
      ).not.toThrow();
    }
  }, 120000);
});
