/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent FileLockUtils
 *
 * The lock that keeps several processes from changing one file at the same
 * time. Real child processes and real file I/O against a scratch directory;
 * runs on every operating system of the cross-platform job.
 *
 * The second part is about what Windows does that the other systems do not:
 * a file that another process is deleting or has open refuses a create (and a
 * remove) with EPERM, EBUSY or EACCES for a moment instead of answering EEXIST.
 * It stubs the platform and makes the file operations fail the way Windows
 * does, with a fake clock and a recording of the back-off, so it runs the same
 * on every operating system.
 */
import fs from 'fs';
import { resolve } from 'path';
import { jest } from '@jest/globals';
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

  test('8: the same, when creating the lock file is refused for a moment the way Windows does it', async () => {
    const file = resolve(TMP_DIR, 'counter.txt');
    const workers = 6;
    const times = 25;
    const startAt = Date.now() + 3000;
    // every worker has two creates in three refused with EPERM, EBUSY or
    // EACCES; without the retry on Windows each of them ends with an error
    await Promise.all(
      Array.from({ length: workers }, (_, id) =>
        runWorker('fileSafetyWorker.ts', {
          mode: 'count',
          id,
          file,
          times,
          startAt,
          windowsRefusals: true,
        })
      )
    );
    expect(parseInt(fs.readFileSync(file, 'utf8'), 10)).toBe(workers * times);
    expect(fs.existsSync(`${file}.lock`)).toBe(false);
  }, 120000);
});

/*
 * What Windows does that the other systems do not (see the header). The
 * platform is stubbed, the file operations fail on purpose, the clock is a
 * fake one that only the back-off moves, and the back-off is recorded instead
 * of waited for, so each test can say how long the code would have waited.
 */
const REAL_PLATFORM = Object.getOwnPropertyDescriptor(process, 'platform');
const WINDOWS_CODES = ['EPERM', 'EBUSY', 'EACCES'];
const TMP_DIR_PLATFORM = resolve(
  '.',
  'test',
  'fs_tmp',
  'FileLockUtils.platform'
);

function stubPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    ...REAL_PLATFORM,
    value: platform,
  });
}

const FS_ERROR_TEXT: Record<string, string> = {
  EPERM: 'operation not permitted',
  EBUSY: 'resource busy or locked',
  EACCES: 'permission denied',
};

/** An error the way node reports a failed file operation. */
function fsError(code: string, syscall: string, path: string) {
  return Object.assign(
    new Error(
      `${code}: ${FS_ERROR_TEXT[code] ?? 'file operation failed'}, ${syscall} '${path}'`
    ),
    { code, syscall, path }
  );
}

/**
 * A clock that stands still unless the code sleeps, and a record of the sleeps.
 * The clock starts at the real time, so that the age of a real file is right.
 */
function fakeClock() {
  let now = Date.now();
  const sleeps: number[] = [];
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(Atomics, 'wait').mockImplementation(((
    _array: Int32Array,
    _index: number,
    _value: number,
    timeout: number
  ) => {
    sleeps.push(timeout);
    now += timeout;
    return 'timed-out';
  }) as never);
  return { sleeps };
}

/**
 * Make an operation on the lock file fail with the code `codeFor` returns for
 * the call (0, 1, 2, ...); with no code the real operation runs.
 */
function failOnLockFile(
  operation: 'openSync' | 'unlinkSync' | 'readFileSync',
  lockFile: string,
  codeFor: (call: number) => string | undefined
) {
  const real = (fs[operation] as (...args: unknown[]) => unknown).bind(fs);
  let calls = 0;
  jest.spyOn(fs, operation).mockImplementation(((...args: unknown[]) => {
    const isLockFile =
      args[0] === lockFile && (operation !== 'openSync' || args[1] === 'wx');
    const code = isLockFile ? codeFor(calls++) : undefined;
    if (code) throw fsError(code, operation.replace('Sync', ''), lockFile);
    return real(...args);
  }) as never);
  return { calls: () => calls };
}

/** Fail the first `times` calls with `code`. */
const firstCalls = (times: number, code: string) => (call: number) =>
  call < times ? code : undefined;

/** The sleeps of the back-off (5, 10, 15 ... 50 ms, then 50 ms) for `count` tries. */
const backoff = (count: number) =>
  Array.from({ length: count }, (_, attempt) => Math.min(5 + attempt * 5, 50));

function catchError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('withFileLockSync: what Windows answers while another process deletes or holds the lock file', () => {
  const file = resolve(TMP_DIR_PLATFORM, 'data.json');
  const lockFile = `${file}.lock`;

  beforeEach(() => {
    fs.rmSync(TMP_DIR_PLATFORM, { recursive: true, force: true });
    fs.mkdirSync(TMP_DIR_PLATFORM, { recursive: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(process, 'platform', REAL_PLATFORM);
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR_PLATFORM, { recursive: true, force: true });
  });

  /** The lock of a process that died long ago. */
  function leaveStaleLock() {
    fs.writeFileSync(lockFile, 'dead-process');
    const longAgo = new Date(Date.now() - 60_000);
    fs.utimesSync(lockFile, longAgo, longAgo);
  }

  describe('taking the lock', () => {
    test.each(WINDOWS_CODES)(
      '1: on Windows a create that fails twice with %s is tried again, and the function runs once',
      (code) => {
        stubPlatform('win32');
        const { sleeps } = fakeClock();
        const create = failOnLockFile(
          'openSync',
          lockFile,
          firstCalls(2, code)
        );
        const critical = jest.fn(() => 'ran');
        expect(withFileLockSync(file, critical)).toBe('ran');
        expect(critical).toHaveBeenCalledTimes(1);
        expect(create.calls()).toBe(3);
        // the same back-off as for a lock that is held
        expect(sleeps).toEqual([5, 10]);
        expect(fs.existsSync(lockFile)).toBe(false);
      }
    );

    test('2: on Windows the lock file holds the owner while the function runs, also after refused creates', () => {
      stubPlatform('win32');
      fakeClock();
      failOnLockFile('openSync', lockFile, firstCalls(2, 'EBUSY'));
      let owner: string | undefined;
      withFileLockSync(file, () => {
        owner = fs.readFileSync(lockFile, 'utf8');
      });
      expect(owner).toMatch(/^\d+\.[0-9a-f]{16}$/);
      expect(fs.existsSync(lockFile)).toBe(false);
    });

    test.each(WINDOWS_CODES)(
      '3: on Windows a create that fails with %s until the deadline ends in a timeout error that names it',
      (code) => {
        stubPlatform('win32');
        const { sleeps } = fakeClock();
        const create = failOnLockFile('openSync', lockFile, () => code);
        const critical = jest.fn();
        const error = catchError(() =>
          withFileLockSync(file, critical, { timeoutMs: 1000 })
        );
        expect(error).toBeInstanceOf(FrodoError);
        expect((error as FrodoError).message).toBe(
          `Timed out after 1000 ms waiting for another process to finish writing ${file}. The last attempt to create the lock failed with ${code}. If no other frodo process is running, delete ${lockFile}.`
        );
        expect(critical).not.toHaveBeenCalled();
        // it waited with the usual back-off, up to the timeout and not beyond
        expect(sleeps.slice(0, 12)).toEqual([
          5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 50, 50,
        ]);
        const waited = sleeps.reduce((sum, ms) => sum + ms, 0);
        expect(waited).toBeGreaterThanOrEqual(1000);
        expect(waited - sleeps[sleeps.length - 1]).toBeLessThan(1000);
        expect(create.calls()).toBe(sleeps.length + 1);
        // nothing of ours is left behind
        expect(fs.existsSync(lockFile)).toBe(false);
      }
    );

    test('4: the timeout error names the code of the last attempt, not of the first', () => {
      stubPlatform('win32');
      fakeClock();
      failOnLockFile('openSync', lockFile, (call) =>
        call === 0 ? 'EPERM' : call === 1 ? 'EEXIST' : 'EBUSY'
      );
      const error = catchError(() =>
        withFileLockSync(file, () => 'never', { timeoutMs: 100 })
      );
      expect((error as FrodoError).message).toContain(
        'failed with EBUSY. If no other'
      );
      expect((error as FrodoError).message).not.toContain('EPERM');
    });

    test('4b: it gives up as soon as the timeout has passed, not one wait later', () => {
      stubPlatform('win32');
      const { sleeps } = fakeClock();
      failOnLockFile('openSync', lockFile, () => 'EPERM');
      // 5 + 10 + ... + 50 is exactly 275 ms
      catchError(() =>
        withFileLockSync(file, () => 'never', { timeoutMs: 275 })
      );
      expect(sleeps).toEqual(backoff(10));
    });

    test('4c: with no options it waits 15 seconds for the lock', () => {
      stubPlatform('win32');
      const { sleeps } = fakeClock();
      failOnLockFile('openSync', lockFile, () => 'EBUSY');
      const error = catchError(() => withFileLockSync(file, () => 'never'));
      expect((error as FrodoError).message).toContain(
        'Timed out after 15000 ms'
      );
      const waited = sleeps.reduce((sum, ms) => sum + ms, 0);
      expect(waited).toBeGreaterThanOrEqual(15_000);
      expect(waited - sleeps[sleeps.length - 1]).toBeLessThan(15_000);
    });

    test.each([
      [9_000, false],
      [11_000, true],
    ])(
      '4d: with no options a lock that is %i ms old is taken over: %s',
      (age, takenOver) => {
        stubPlatform('win32');
        fakeClock();
        fs.writeFileSync(lockFile, 'someone-else');
        const past = new Date(Date.now() - age);
        fs.utimesSync(lockFile, past, past);
        const error = catchError(() =>
          withFileLockSync(file, () => 'ran', { timeoutMs: 100 })
        );
        expect(error === undefined).toBe(takenOver);
      }
    );

    test.each(['ENOSPC', 'EMFILE', 'ENOENT', 'EISDIR'])(
      '5: on Windows %s is not one of the codes to wait for and is thrown at once',
      (code) => {
        stubPlatform('win32');
        const { sleeps } = fakeClock();
        const create = failOnLockFile('openSync', lockFile, () => code);
        const error = catchError(() => withFileLockSync(file, () => 'never'));
        expect((error as NodeJS.ErrnoException).code).toBe(code);
        expect(error).not.toBeInstanceOf(FrodoError);
        expect(create.calls()).toBe(1);
        expect(sleeps).toEqual([]);
      }
    );

    describe.each(['linux', 'darwin'] as NodeJS.Platform[])(
      'on %s',
      (platform) => {
        test.each(WINDOWS_CODES)(
          '6: %s is a real permission problem and is thrown at once, without waiting',
          (code) => {
            stubPlatform(platform);
            const { sleeps } = fakeClock();
            const create = failOnLockFile('openSync', lockFile, () => code);
            const critical = jest.fn();
            const error = catchError(() => withFileLockSync(file, critical));
            expect((error as NodeJS.ErrnoException).code).toBe(code);
            expect((error as Error).message).toBe(
              `${code}: ${FS_ERROR_TEXT[code]}, open '${lockFile}'`
            );
            expect(error).not.toBeInstanceOf(FrodoError);
            expect(create.calls()).toBe(1);
            expect(sleeps).toEqual([]);
            expect(critical).not.toHaveBeenCalled();
          }
        );
      }
    );

    describe.each(['win32', 'linux'] as NodeJS.Platform[])(
      'on %s',
      (platform) => {
        test('7: a lock that is held is waited for, and the timeout error is the one it always was', () => {
          stubPlatform(platform);
          const { sleeps } = fakeClock();
          fs.writeFileSync(lockFile, 'someone-else');
          const error = catchError(() =>
            withFileLockSync(file, () => 'never', {
              timeoutMs: 1000,
              staleMs: 60_000,
            })
          );
          expect(error).toBeInstanceOf(FrodoError);
          expect((error as FrodoError).message).toBe(
            `Timed out after 1000 ms waiting for another process to finish writing ${file}. If no other frodo process is running, delete ${lockFile}.`
          );
          expect(sleeps.slice(0, 12)).toEqual([
            5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 50, 50,
          ]);
          expect(sleeps).toHaveLength(25);
          // the other process's lock is untouched
          expect(fs.readFileSync(lockFile, 'utf8')).toBe('someone-else');
        });

        test('8: a create that fails with EEXIST twice is tried again, and the function runs once', () => {
          stubPlatform(platform);
          const { sleeps } = fakeClock();
          const create = failOnLockFile(
            'openSync',
            lockFile,
            firstCalls(2, 'EEXIST')
          );
          expect(withFileLockSync(file, () => 'ran')).toBe('ran');
          expect(create.calls()).toBe(3);
          expect(sleeps).toEqual([5, 10]);
        });
      }
    );
  });

  describe('taking over a stale lock', () => {
    test('9: on Windows a refused create is judged like EEXIST: a stale lock is removed and taken at once', () => {
      stubPlatform('win32');
      const { sleeps } = fakeClock();
      leaveStaleLock();
      const create = failOnLockFile(
        'openSync',
        lockFile,
        firstCalls(1, 'EPERM')
      );
      expect(withFileLockSync(file, () => 'ran', { staleMs: 10_000 })).toBe(
        'ran'
      );
      expect(create.calls()).toBe(2);
      expect(sleeps).toEqual([]);
      expect(fs.existsSync(lockFile)).toBe(false);
    });

    test.each(WINDOWS_CODES)(
      '10: on Windows a stale lock that cannot be removed for a moment (%s) is waited for, not retried in a tight loop',
      (code) => {
        stubPlatform('win32');
        const { sleeps } = fakeClock();
        leaveStaleLock();
        const remove = failOnLockFile(
          'unlinkSync',
          lockFile,
          firstCalls(2, code)
        );
        let removedBeforeRunning = -1;
        expect(
          withFileLockSync(
            file,
            () => {
              removedBeforeRunning = remove.calls();
              return 'ran';
            },
            { staleMs: 10_000 }
          )
        ).toBe('ran');
        // two refusals and the removal that worked, with the back-off between them
        expect(removedBeforeRunning).toBe(3);
        expect(sleeps).toEqual([5, 10]);
      }
    );

    test('11: on Windows a stale lock that can never be removed ends in the timeout error, not in an endless loop', () => {
      stubPlatform('win32');
      const { sleeps } = fakeClock();
      leaveStaleLock();
      // after 100 tries the removal works, so that a loop without a deadline
      // ends here and the test reports it instead of hanging
      const remove = failOnLockFile(
        'unlinkSync',
        lockFile,
        firstCalls(100, 'EPERM')
      );
      const error = catchError(() =>
        withFileLockSync(file, () => 'never', {
          timeoutMs: 1000,
          staleMs: 10_000,
        })
      );
      expect(error).toBeInstanceOf(FrodoError);
      expect((error as FrodoError).message).toContain(
        'Timed out after 1000 ms'
      );
      expect(sleeps).toHaveLength(25);
      expect(remove.calls()).toBe(26);
    });

    test('12: on Windows a stale lock that another process removed first is not waited for', () => {
      stubPlatform('win32');
      const { sleeps } = fakeClock();
      leaveStaleLock();
      const realUnlink = fs.unlinkSync.bind(fs);
      jest.spyOn(fs, 'unlinkSync').mockImplementationOnce(((path: string) => {
        realUnlink(path);
        throw fsError('ENOENT', 'unlink', path);
      }) as never);
      expect(withFileLockSync(file, () => 'ran', { staleMs: 10_000 })).toBe(
        'ran'
      );
      expect(sleeps).toEqual([]);
    });

    test('13: on Linux a stale lock that cannot be removed is tried again at once, as it always was', () => {
      stubPlatform('linux');
      const { sleeps } = fakeClock();
      leaveStaleLock();
      const remove = failOnLockFile(
        'unlinkSync',
        lockFile,
        firstCalls(2, 'EBUSY')
      );
      let removedBeforeRunning = -1;
      withFileLockSync(
        file,
        () => {
          removedBeforeRunning = remove.calls();
        },
        { staleMs: 10_000 }
      );
      expect(removedBeforeRunning).toBe(3);
      expect(sleeps).toEqual([]);
    });
  });

  describe('releasing the lock', () => {
    test.each(WINDOWS_CODES)(
      '14: on Windows a removal that fails twice with %s is tried again, and the lock is gone',
      (code) => {
        stubPlatform('win32');
        const { sleeps } = fakeClock();
        const remove = failOnLockFile(
          'unlinkSync',
          lockFile,
          firstCalls(2, code)
        );
        expect(withFileLockSync(file, () => 'ran')).toBe('ran');
        expect(remove.calls()).toBe(3);
        expect(sleeps).toEqual([5, 10]);
        expect(fs.existsSync(lockFile)).toBe(false);
      }
    );

    test.each(WINDOWS_CODES)(
      '15: on Windows reading the owner of the lock that fails twice with %s is tried again, and the lock is gone',
      (code) => {
        stubPlatform('win32');
        const { sleeps } = fakeClock();
        // the only read of the lock file is the check of the owner on release
        const read = failOnLockFile(
          'readFileSync',
          lockFile,
          firstCalls(2, code)
        );
        expect(withFileLockSync(file, () => 'ran')).toBe('ran');
        expect(read.calls()).toBe(3);
        expect(sleeps).toEqual([5, 10]);
        expect(fs.existsSync(lockFile)).toBe(false);
      }
    );

    test('16: on Windows a lock that cannot be removed is given up after a limited number of tries, and the result of the function is still returned', () => {
      stubPlatform('win32');
      const { sleeps } = fakeClock();
      const remove = failOnLockFile('unlinkSync', lockFile, () => 'EPERM');
      expect(withFileLockSync(file, () => 'ran')).toBe('ran');
      expect(remove.calls()).toBe(21);
      expect(sleeps).toEqual(backoff(20));
      // it stays, and is taken over once it is stale
      expect(fs.existsSync(lockFile)).toBe(true);
    });

    test('17: on Windows the error of the function is still the error that is thrown when the lock cannot be removed', () => {
      stubPlatform('win32');
      fakeClock();
      failOnLockFile('unlinkSync', lockFile, () => 'EBUSY');
      expect(() =>
        withFileLockSync(file, () => {
          throw new Error('inside');
        })
      ).toThrow('inside');
    });

    test('18: on Windows a lock that someone else took over is not removed, and not waited for', () => {
      stubPlatform('win32');
      const { sleeps } = fakeClock();
      const remove = failOnLockFile('unlinkSync', lockFile, () => undefined);
      withFileLockSync(file, () => {
        fs.writeFileSync(lockFile, 'new-owner');
      });
      expect(remove.calls()).toBe(0);
      expect(sleeps).toEqual([]);
      expect(fs.readFileSync(lockFile, 'utf8')).toBe('new-owner');
    });

    test('19: on Windows a lock that is already gone is not waited for', () => {
      stubPlatform('win32');
      const { sleeps } = fakeClock();
      const remove = failOnLockFile('unlinkSync', lockFile, () => undefined);
      withFileLockSync(file, () => {
        fs.rmSync(lockFile);
      });
      expect(remove.calls()).toBe(0);
      expect(sleeps).toEqual([]);
    });

    test('20: on Windows a removal that fails with a code to give up on is not tried again', () => {
      stubPlatform('win32');
      const { sleeps } = fakeClock();
      const remove = failOnLockFile('unlinkSync', lockFile, () => 'EISDIR');
      expect(withFileLockSync(file, () => 'ran')).toBe('ran');
      expect(remove.calls()).toBe(1);
      expect(sleeps).toEqual([]);
    });

    describe.each(['linux', 'darwin'] as NodeJS.Platform[])(
      'on %s',
      (platform) => {
        test.each(WINDOWS_CODES)(
          '21: a removal that fails with %s is not tried again and does not fail the function',
          (code) => {
            stubPlatform(platform);
            const { sleeps } = fakeClock();
            const remove = failOnLockFile('unlinkSync', lockFile, () => code);
            expect(withFileLockSync(file, () => 'ran')).toBe('ran');
            expect(remove.calls()).toBe(1);
            expect(sleeps).toEqual([]);
          }
        );
      }
    );
  });
});
