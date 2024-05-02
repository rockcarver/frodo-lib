import pkg from '../../package.json';

export const getUserAgent = () => `${pkg.name}/${pkg.version}`;

export const getPackageVersion = () => `v${pkg.version} [${process.version}]`;

export const getVersionFromPackage = () => pkg.version;
