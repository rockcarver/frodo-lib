import pkg from '../../package.json';

export const getUserAgent = () => `${pkg.name}/${pkg.version}`;

export const getPackageVersion = () => `v${pkg.version} [${process.version}]`;

export const getVersionFromPackage = () => pkg.version;

declare const __LIB_BUILD_TIMESTAMP__: string;

/**
 * ISO 8601 timestamp of when this frodo-lib bundle was built, substituted as
 * a literal by tsup's `define` at bundle time (see tsup.config.ts). This is
 * the only reliable way to tell whether a running process actually picked up
 * a given source change — a packaging step downstream (e.g. frodo-cli's
 * bundling of frodo-lib, or pkg's binary packaging) can silently produce a
 * stale artifact despite every file on disk looking current. Falls back to
 * an explicit placeholder when running from raw TypeScript source (ts-jest,
 * ts-node) rather than a tsup build, since no bundler ever substitutes the
 * identifier there.
 */
export const getLibBuildTimestamp = (): string =>
  typeof __LIB_BUILD_TIMESTAMP__ !== 'undefined'
    ? __LIB_BUILD_TIMESTAMP__
    : 'unknown (running from source, not a tsup build)';
