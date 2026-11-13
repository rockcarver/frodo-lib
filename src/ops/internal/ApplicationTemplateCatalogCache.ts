import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { State } from '../../shared/State';
import { debugMessage } from '../../utils/Console';
import { renameWithRetrySync } from '../../utils/ExportImportUtils';
import { getFrodoHome } from '../../utils/FrodoUtils';
import { isSafeHeaderValue } from '../../utils/HeaderValueUtils';

/**
 * The files of the cache of the application template catalog, one pair for
 * each channel of the public source:
 *
 * - `<dir>/<channel>.json` holds the decoded catalog, exactly the JSON that
 *   the source delivered, so a copy of it can be handed to the library as an
 *   explicit catalog on a machine that cannot reach the source;
 * - `<dir>/<channel>.meta.json` holds what identifies that copy: `etag` and
 *   `lastModified` (the validators for a conditional request), `fetchedAt` (when
 *   the source last confirmed the copy) and `url`.
 *
 * Both files are read as untrusted input: whoever can write to the directory
 * can change them, so the catalog goes through the same size limits, depth
 * check and shape validation as a download, and the validators are only sent
 * as request headers when they are safe header values. Writes are atomic and
 * best effort.
 */
export type CatalogCacheMeta = {
  etag?: string;
  lastModified?: string;
  /** When the source last confirmed the copy (ISO 8601). */
  fetchedAt: string;
  url: string;
};

/** The most that a meta file may be, in bytes. It holds four short fields. */
const MAX_META_BYTES = 64 * 1024;

/**
 * The directory of the cache: the one set on the state, otherwise the folder
 * `AppTemplates` in the Frodo home directory, the way the token cache finds its
 * file.
 * @param {State} state library state
 * @returns {string} the directory
 */
export function getCatalogCacheDirectory({ state }: { state: State }): string {
  return (
    state.getTemplateCatalogCachePath() ||
    path.join(getFrodoHome(), 'AppTemplates')
  );
}

/**
 * The names of the two files of a channel
 * @param {string} directory the cache directory
 * @param {string} channel a channel of the public source (`production` or `development`)
 * @returns {{ catalog: string; meta: string }} the paths
 */
export function getCatalogCacheFiles(
  directory: string,
  channel: string
): { catalog: string; meta: string } {
  return {
    catalog: path.join(directory, `${channel}.json`),
    meta: path.join(directory, `${channel}.meta.json`),
  };
}

/**
 * Read a file that is not trusted: nothing over the limit is read, and any
 * failure is a miss.
 * @returns {Buffer | undefined} the content, or undefined if the file is missing, too big or unreadable
 */
export function readLimitedFile({
  file,
  maxBytes,
  state,
}: {
  file: string;
  maxBytes: number;
  state: State;
}): Buffer | undefined {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return undefined;
    if (stat.size > maxBytes) {
      debugMessage({
        message: `ApplicationTemplateCatalogCache: ${file} is larger than ${maxBytes} bytes, ignored`,
        state,
      });
      return undefined;
    }
    return fs.readFileSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      debugMessage({
        message: `ApplicationTemplateCatalogCache: ${file} cannot be read, ignored: ${(error as Error).message}`,
        state,
      });
    }
    return undefined;
  }
}

/**
 * Read the meta file of a cached catalog. A meta file that is missing,
 * unreadable, not JSON, for another url, or without a valid `fetchedAt` is a
 * miss; a validator that is not safe to send as a header is left out.
 * @returns {CatalogCacheMeta | undefined} the meta data, or undefined
 */
export function readCatalogCacheMeta({
  file,
  url,
  state,
}: {
  file: string;
  url: string;
  state: State;
}): CatalogCacheMeta | undefined {
  const bytes = readLimitedFile({ file, maxBytes: MAX_META_BYTES, state });
  if (!bytes) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    debugMessage({
      message: `ApplicationTemplateCatalogCache: ${file} is not JSON, ignored`,
      state,
    });
    return undefined;
  }
  const meta = parsed as Record<string, unknown>;
  if (
    !meta ||
    typeof meta !== 'object' ||
    Array.isArray(meta) ||
    meta.url !== url ||
    typeof meta.fetchedAt !== 'string' ||
    !Number.isFinite(Date.parse(meta.fetchedAt))
  ) {
    debugMessage({
      message: `ApplicationTemplateCatalogCache: ${file} does not describe ${url}, ignored`,
      state,
    });
    return undefined;
  }
  return {
    ...(isSafeHeaderValue(meta.etag) && { etag: meta.etag }),
    ...(isSafeHeaderValue(meta.lastModified) && {
      lastModified: meta.lastModified,
    }),
    fetchedAt: meta.fetchedAt,
    url,
  };
}

/**
 * Write a file so that no reader ever sees a partial file: the data goes to a
 * uniquely named temporary file in the same directory, which is then renamed
 * over the target. The directory is created if needed. A failed write leaves the
 * old file as it was and no temporary file behind.
 * @param {string} file the target file
 * @param {string} data the content
 */
export function writeFileAtomicSync(file: string, data: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporary, data, { flag: 'wx' });
    renameWithRetrySync(temporary, file);
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (unlinkError) {
      // nothing left to remove
    }
    throw error;
  }
}

/**
 * Write a file of the cache. Best effort: a failure is a debug message and
 * never fails the read that wanted the cache.
 * @returns {boolean} true if the file was written
 */
export function tryWriteCacheFile({
  file,
  data,
  state,
}: {
  file: string;
  data: string;
  state: State;
}): boolean {
  try {
    writeFileAtomicSync(file, data);
    return true;
  } catch (error) {
    debugMessage({
      message: `ApplicationTemplateCatalogCache: ${file} could not be written: ${(error as Error).message}`,
      state,
    });
    return false;
  }
}
