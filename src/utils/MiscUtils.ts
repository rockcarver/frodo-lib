import { lstat, readdir, readFile } from 'fs/promises';
import { join } from 'path';

/**
 * find all (nested) files in a directory
 *
 * @param baseDirectory directory to search
 * @param childDirectory subdirectory to search
 * @returns list of files
 */
export async function readFiles(
  baseDirectory: string,
  childDirectory = ''
): Promise<
  {
    path: string;
    content: string;
  }[]
> {
  const targetDirectory = join(baseDirectory, childDirectory);
  const directoryItems = await readdir(targetDirectory);
  const childPaths = directoryItems.map((item) => join(childDirectory, item));

  const filePathsNested = await Promise.all(
    childPaths.map(async (childPath) => {
      const path = join(baseDirectory, childPath);
      const isDirectory = (await lstat(path)).isDirectory();

      if (isDirectory) {
        return readFiles(baseDirectory, childPath);
      }

      return {
        path: childPath,
        content: await readFile(path, 'utf8'),
      };
    })
  );

  return filePathsNested.flat();
}

/*
 * Parse a URL into its components and make them easily accessible by name
 *
 * Use in a Scripte Decision Node Script as follows:
 * var referer = parseUrl(requestHeaders.get("referer").get(0));
 * var origin = referer.origin;
 *
 * e.g.: https://openam-volker-dev.forgeblocks.com/am/XUI/?realm=/bravo&authIndexType=service&authIndexValue=InitiateOwnerClaim#/
 * {
 *     hash: '#/',
 *     host: 'openam-volker-dev.forgeblocks.com',
 *     hostname: 'openam-volker-dev.forgeblocks.com',
 *     href: 'https://openam-volker-dev.forgeblocks.com/am/XUI/?realm=/bravo&authIndexType=service&authIndexValue=InitiateOwnerClaim#/',
 *     origin: 'https://openam-volker-dev.forgeblocks.com',
 *     pathname: '/am/XUI/',
 *     port: '',
 *     protocol: 'https',
 *     search: '?realm=/bravo&authIndexType=service&authIndexValue=InitiateOwnerClaim',
 *     username: '',
 *     password: '',
 *     searchParam: {
 *         realm: '/bravo',
 *         authIndexType: 'service',
 *         authIndexValue: 'InitiateOwnerClaim'
 *     }
 * }
 */
export function parseUrl(href) {
  const m = href.match(
      /^(([^:/?#]+):?(?:\/\/((?:([^/?#:]*):([^/?#:]*)@)?([^/?#:]*)(?::([^/?#:]*))?)))?([^?#]*)(\?[^#]*)?(#.*)?$/
    ),
    r = {
      hash: m[10] || '',
      host: m[3] || '',
      hostname: m[6] || '',
      href: m[0] || '',
      origin: m[1] || '',
      pathname: m[8] || (m[1] ? '/' : ''),
      port: m[7] || '',
      protocol: m[2] || '',
      search: m[9] || '',
      username: m[4] || '',
      password: m[5] || '',
      searchParam: {}, // { realm: '/bravo',
      //   authIndexType: 'service',
      //   authIndexValue: 'InitiateOwnerClaim' }
    };
  if (r.protocol.length == 2) {
    r.protocol = 'file:///' + r.protocol.toUpperCase();
    r.origin = r.protocol + '//' + r.host;
  }
  if (r.search.length > 2) {
    const query = r.search.indexOf('?') === 0 ? r.search.substr(1) : r.search;
    const vars = query.split('&');
    for (let i = 0; i < vars.length; i++) {
      const pair = vars[i].split('=');
      r.searchParam[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
    }
  }
  r.href = r.origin + r.pathname + r.search + r.hash;
  return r;
}

/**
 * Check if a string is a valid URL
 * @param {string} urlString input string to be evaluated
 * @returns {boolean} true if a valid URL, false otherwise
 */
export function isValidUrl(urlString: string): boolean {
  try {
    return Boolean(new URL(urlString));
  } catch (error) {
    return false;
  }
}
