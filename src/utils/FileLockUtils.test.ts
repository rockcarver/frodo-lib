/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent FileLockUtils
 *
 * The lock that keeps several processes from changing one file at the same
 * time. Real child processes and real file I/O against a scratch directory;
 * runs on every operating system of the cross-platform job.
 */
import fs from 'fs';
import { resolve } from 'path';
import { runWorker } from '../../test/support/runWorkers';
import { FrodoError } from '../ops/FrodoError';
import { withFileLockSync } from './FileLockUtils';

const TMP_DIR = resolve('.', 'test', 'fs_tmp', 'FileLockUtils');

describe('withFileLockSync', () => {
  beforeEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(TMP_DIR, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  test('1: runs the function, returns what it returns and leaves no lock behind', () => {
    const file = resolve(TMP_DIR, 'data.json');
    const result = withFileLockSync(file, () => {
      // while the function runs the lock exists
      expect(fs.existsSync(`${file}.lock`)).toBe(true);
      return 42;
    });
    expect(result).toBe(42);
    expect(fs.existsSync(`${file}.lock`)).toBe(false);
  });

  test('2: releases the lock when the function throws, and the error is the function’s own', () => {
    const file = resolve(TMP_DIR, 'data.json');
    expect(() =>
      withFileLockSync(file, () => {
        throw new Error('inside');
      })
    ).toThrow('inside');
    expect(fs.existsSync(`${file}.lock`)).toBe(false);
  });

  test('3: creates the directory of the file when it does not exist', () => {
    const file = resolve(TMP_DIR, 'deep', 'er', 'data.json');
    expect(withFileLockSync(file, () => 'ok')).toBe('ok');
  });

  test('4: a lock that is held and not stale makes it wait, and give up with an error that names the lock file', () => {
    const file = resolve(TMP_DIR, 'data.json');
    fs.writeFileSync(`${file}.lock`, 'someone-else');
    const started = Date.now();
    let error: unknown;
    try {
      withFileLockSync(file, () => 'never', {
        timeoutMs: 200,
        staleMs: 60_000,
      });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(FrodoError);
    expect((error as FrodoError).message).toContain(`${file}.lock`);
    expect(Date.now() - started).toBeGreaterThanOrEqual(200);
    // the other process's lock is untouched
    expect(fs.readFileSync(`${file}.lock`, 'utf8')).toBe('someone-else');
  });

  test('5: a lock that is older than the stale limit belongs to a dead process and is taken over', () => {
    const file = resolve(TMP_DIR, 'data.json');
    fs.writeFileSync(`${file}.lock`, 'dead-process');
    const longAgo = new Date(Date.now() - 60_000);
    fs.utimesSync(`${file}.lock`, longAgo, longAgo);
    expect(withFileLockSync(file, () => 'ran', { staleMs: 10_000 })).toBe(
      'ran'
    );
    expect(fs.existsSync(`${file}.lock`)).toBe(false);
  });

  test('6: a lock that someone else took over meanwhile is not removed', () => {
    const file = resolve(TMP_DIR, 'data.json');
    withFileLockSync(file, () => {
      // our lock was judged stale and replaced by another process
      fs.writeFileSync(`${file}.lock`, 'new-owner');
    });
    expect(fs.readFileSync(`${file}.lock`, 'utf8')).toBe('new-owner');
  });

  test('7: processes that read, change and write one file at the same time lose none of their changes', async () => {
    const file = resolve(TMP_DIR, 'counter.txt');
    const workers = 6;
    const times = 25;
    const startAt = Date.now() + 3000;
    await Promise.all(
      Array.from({ length: workers }, (_, id) =>
        runWorker('fileSafetyWorker.ts', {
          mode: 'count',
          id,
          file,
          times,
          startAt,
        })
      )
    );
    expect(parseInt(fs.readFileSync(file, 'utf8'), 10)).toBe(workers * times);
    expect(fs.existsSync(`${file}.lock`)).toBe(false);
  }, 120000);
});
