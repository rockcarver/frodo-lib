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

function lockOwner(lockFile: string): string | undefined {
  try {
    return fs.readFileSync(lockFile, 'utf8');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return undefined;
  }
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
 * Run a synchronous function while holding a lock on a file, so that several
 * processes that read, change and write the same file one after the other do
 * not lose each other's changes. The lock is a file next to the target
 * (`<file>.lock`) that is created exclusively; a process that finds it waits
 * and tries again with a short back-off.
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
      if (error.code !== 'EEXIST') throw error;
      if (isStale(lockFile, staleMs)) {
        try {
          fs.unlinkSync(lockFile);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (unlinkError) {
          // another process removed it first
        }
        continue;
      }
      if (Date.now() >= deadline) {
        throw new FrodoError(
          `Timed out after ${timeoutMs} ms waiting for another process to finish writing ${file}. If no other frodo process is running, delete ${lockFile}.`
        );
      }
      sleepSync(Math.min(5 + attempt * 5, 50));
    }
  }
  try {
    return critical();
  } finally {
    // only remove a lock that is still ours
    if (lockOwner(lockFile) === owner) {
      try {
        fs.unlinkSync(lockFile);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // nothing to remove
      }
    }
  }
}
