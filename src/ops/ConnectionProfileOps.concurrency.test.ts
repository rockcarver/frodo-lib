/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent ConnectionProfileOps.concurrency
 *
 * Several real processes save connection profiles into one file at the same
 * time (several MCP servers and command line runs that log in with a saved
 * profile). The file holds every saved connection and its credentials, so no
 * profile may be lost, the file may never be seen half written, and the master
 * key that encrypts the credentials must be one key even when several
 * processes need it before it exists. Real child processes and real file I/O
 * against a scratch directory; runs on every operating system of the
 * cross-platform job.
 */
import fs from 'fs';
import { resolve } from 'path';
import { runWorker } from '../../test/support/runWorkers';
import StateImpl from '../shared/State';
import DataProtection from '../utils/DataProtection';

const TMP_DIR = resolve(
  '.',
  'test',
  'fs_tmp',
  'ConnectionProfileOps.concurrency'
);

describe('connection profiles and master key used by several processes at the same time', () => {
  beforeEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(TMP_DIR, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  test('1: every profile that a process saves is in the file afterwards, and the file is never left half written', async () => {
    const file = resolve(TMP_DIR, 'Connections.json');
    const masterKeyPath = resolve(TMP_DIR, 'masterkey.key');
    // the key exists beforehand; creating it is test 2
    fs.writeFileSync(masterKeyPath, 'test-master-key');
    // A file with many profiles takes longer to read, change and write, which
    // is what makes processes that save at the same moment overlap.
    const existing = {};
    for (let i = 0; i < 400; i++) {
      existing[`https://openam-existing-${i}.example.com/am`] = {
        deploymentType: 'classic',
        username: `existing-${i}`,
        encodedPassword: 'x'.repeat(200),
      };
    }
    fs.writeFileSync(file, JSON.stringify(existing, null, 2));
    const workers = 6;
    const times = 8;
    const startAt = Date.now() + 3000;
    // a reader that parses the file all the time would see a torn write
    const stopFile = resolve(TMP_DIR, 'stop');
    let unparsable = 0;
    let reads = 0;
    const reader = setInterval(() => {
      try {
        JSON.parse(fs.readFileSync(file, 'utf8'));
        reads++;
      } catch (error) {
        if (error.code !== 'ENOENT') unparsable++;
      }
    }, 2);
    try {
      const results = await Promise.all(
        Array.from({ length: workers }, (_, id) =>
          runWorker<{ saved: number }>('fileSafetyWorker.ts', {
            mode: 'profile',
            id,
            file,
            masterKeyPath,
            times,
            startAt,
          })
        )
      );
      for (const result of results) expect(result.saved).toBe(times);
    } finally {
      clearInterval(reader);
      fs.rmSync(stopFile, { force: true });
    }

    expect(unparsable).toBe(0);
    expect(reads).toBeGreaterThan(0);
    const profiles = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(Object.keys(profiles)).toHaveLength(400 + workers * times);
    for (let id = 0; id < workers; id++) {
      for (let i = 0; i < times; i++) {
        const profile =
          profiles[`https://openam-worker-${id}-${i}.example.com/am`];
        expect(profile.username).toBe(`user-${id}-${i}`);
        // the password of each profile is readable with the one key
        const dataProtection = new DataProtection({
          pathToMasterKey: masterKeyPath,
          state: StateImpl({ host: 'https://unused.example.com/am' }),
        });
        expect(await dataProtection.decrypt(profile.encodedPassword)).toBe(
          `password-${id}-${i}`
        );
      }
    }
    // nothing is left behind but the file
    expect(fs.readdirSync(TMP_DIR).sort()).toEqual([
      'Connections.json',
      'masterkey.key',
    ]);
  }, 180000);

  test('2: processes that need the master key before it exists end up with one key, and everything they encrypted can be decrypted', async () => {
    const workers = 8;
    // several rounds, each with a key that does not exist yet
    for (let round = 0; round < 3; round++) {
      const masterKeyPath = resolve(TMP_DIR, `round-${round}`, 'masterkey.key');
      const startAt = Date.now() + 3000;
      const results = await Promise.all(
        Array.from({ length: workers }, (_, id) =>
          runWorker<{ encrypted: string }>('fileSafetyWorker.ts', {
            mode: 'masterKey',
            id,
            file: '',
            masterKeyPath,
            times: 1,
            startAt,
          })
        )
      );
      const dataProtection = new DataProtection({
        pathToMasterKey: masterKeyPath,
        state: StateImpl({ host: 'https://unused.example.com/am' }),
      });
      for (const result of results) {
        expect(await dataProtection.decrypt(result.encrypted)).toEqual({
          secret: `from-${result.id}`,
        });
      }
      // only the key is left
      expect(fs.readdirSync(resolve(TMP_DIR, `round-${round}`))).toEqual([
        'masterkey.key',
      ]);
    }
  }, 180000);
});
