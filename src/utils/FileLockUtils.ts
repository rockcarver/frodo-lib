import { randomBytes } from 'crypto';
import fs from 'fs';
import { FrodoError } from '../ops/FrodoError';
import { ensureSecureDirectoryForFile, sleepSync } from './ExportImportUtils';

/**
 * A file that was created more than this long ago and is still locked belongs
 * to a process that died while it held the lock.
 */
const DEFAULT_STALE_MS = 10_000;
/** How long to wait for a lock held by another process. */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * What Windows answers, for a moment and instead of `EEXIST`, when a file is
 * created, opened or removed while another process is deleting it or still has
 * it open: `EPERM` (the file is waiting to be deleted), `EBUSY` (a sharing
 * violation) or `EACCES`. The lock file is created and removed by several
 * processes in quick succession, so a process that should wait can get one of
 * them. On other platforms the same codes are real permission problems.
 */
const WINDOWS_TRANSIENT_CODES = ['EPERM', 'EBUSY', 'EACCES'];

/** How often the release of a lock is tried again when Windows refuses it for a moment. */
const RELEASE_RETRIES = 20;

/**
 * Whether an error is one that Windows answers for a moment and that goes away
 * by itself (see {@link WINDOWS_TRANSIENT_CODES}). Always false on other
 * platforms. The platform is read on every call, not once at load.
 * @param {unknown} error the error of a file operation
 * @returns {boolean} true if waiting and trying again is the right answer
 */
function isTransientOnWindows(error: unknown): boolean {
  return (
    process.platform === 'win32' &&
    WINDOWS_TRANSIENT_CODES.includes((error as NodeJS.ErrnoException)?.code)
  );
}

/** How long to wait before the next try; the same for taking and releasing the lock. */
function backoffMs(attempt: number): number {
  return Math.min(5 + attempt * 5, 50);
}

function isStale(lockFile: string, staleMs: number): boolean {
  try {
    return Date.now() - fs.statSync(lockFile).mtimeMs > staleMs;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // gone already: not stale, the next attempt takes it
    return false;
  }
}

/**
 * Remove the lock file if it is still ours. Not finding it, or finding another
 * owner in it, ends the release. On Windows a refusal that goes away by itself
 * (see {@link WINDOWS_TRANSIENT_CODES}) is tried again with the back-off of
 * taking the lock, a limited number of times; a lock that stays after that, or
 * after any other failure, is taken over by the next process once it is stale.
 * Never throws: it runs after the function, whose result or error it must not
 * replace.
 * @param {string} lockFile the lock file
 * @param {string} owner what this process wrote into the lock file
 */
function releaseLock(lockFile: string, owner: string): void {
  for (let attempt = 0; ; attempt++) {
    try {
      // only remove a lock that is still ours
      if (fs.readFileSync(lockFile, 'utf8') !== owner) return;
      fs.unlinkSync(lockFile);
      return;
    } catch (error) {
      if (attempt >= RELEASE_RETRIES || !isTransientOnWindows(error)) return;
      sleepSync(backoffMs(attempt));
    }
  }
}

/**
 * Run a synchronous function while holding a lock on a file, so that several
 * processes that read, change and write the same file one after the other do
 * not lose each other's changes. The lock is a file next to the target
 * (`<file>.lock`) that is created exclusively; a process that finds it waits
 * and tries again with a short back-off.
 *
 * On Windows a file that another process is deleting, or still has open, can
 * refuse the create with `EPERM`, `EBUSY` or `EACCES` for a moment instead of
 * `EEXIST`. There these codes mean the same as `EEXIST`: wait and try again,
 * until the timeout, and the timeout error names the last code. On other
 * platforms they are real permission problems and are thrown at once.
 *
 * The function must be short and must not wait for anything (no `await`):
 * the lock is released when it returns or throws, and a lock that is older than
 * `staleMs` is taken to belong to a process that died and is removed. Two
 * processes that find the same stale lock at the same moment can both enter;
 * that needs a process that died while holding the lock, and costs what having
 * no lock costs.
 * @param {string} file the file to lock (not the lock file)
 * @param {() => T} critical the work to do while holding the lock
 * @param {object} options optional `timeoutMs` (default 15 s) and `staleMs` (default 10 s)
 * @returns {T} what the function returns
 */
export function withFileLockSync<T>(
  file: string,
  critical: () => T,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    staleMs = DEFAULT_STALE_MS,
  }: { timeoutMs?: number; staleMs?: number } = {}
): T {
  const lockFile = `${file}.lock`;
  const owner = `${process.pid}.${randomBytes(8).toString('hex')}`;
  ensureSecureDirectoryForFile(lockFile);
  const deadline = Date.now() + timeoutMs;
  for (let attempt = 0; ; attempt++) {
    try {
      const fd = fs.openSync(lockFile, 'wx', 0o600);
      try {
        fs.writeSync(fd, owner);
      } finally {
        fs.closeSync(fd);
      }
      break;
    } catch (error) {
      if (error.code !== 'EEXIST' && !isTransientOnWindows(error)) throw error;
      if (isStale(lockFile, staleMs)) {
        let removed = true;
        try {
          fs.unlinkSync(lockFile);
        } catch (unlinkError) {
          // gone already, another process removed it first: try again at once.
          // Windows refusing for a moment: wait like for any other lock
          removed = !isTransientOnWindows(unlinkError);
        }
        if (removed) continue;
      }
      if (Date.now() >= deadline) {
        throw new FrodoError(
          `Timed out after ${timeoutMs} ms waiting for another process to finish writing ${file}.${
            error.code === 'EEXIST'
              ? ''
              : ` The last attempt to create the lock failed with ${error.code}.`
          } If no other frodo process is running, delete ${lockFile}.`
        );
      }
      sleepSync(backoffMs(attempt));
    }
  }
  try {
    return critical();
  } finally {
    releaseLock(lockFile, owner);
  }
}
