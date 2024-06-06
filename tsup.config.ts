import { defineConfig } from 'tsup';

export default defineConfig({
  // entryPoints: ['src/index.ts'],
  entry: ['src/**/*.ts'], //include all files under src
  format: ['esm', 'cjs'], // generate cjs and esm files
  dts: true, // generate dts files
  splitting: true,
  sourcemap: true,
  clean: true,
  bundle: true,
  external: [
    // list all the dev dependencies, which do NOT need to be bundled as indicated in package.json (_devDependencies)
    '@jest/globals',
    '@types/esprima',
    '@types/fs-extra',
    '@types/jest',
    '@types/lodash',
    '@types/mock-fs',
    '@types/node',
    '@types/properties-reader',
    '@types/uuid',
    '@typescript-eslint/eslint-plugin',
    '@typescript-eslint/parser',
    'copyfiles',
    'del',
    'eslint',
    'eslint-config-prettier',
    'eslint-plugin-deprecation',
    'eslint-plugin-import',
    'eslint-plugin-jest',
    'eslint-plugin-prettier',
    'eslint-plugin-simple-import-sort',
    'jest',
    'jest-jasmine2',
    'loglevel',
    'map-stream',
    'mock-fs',
    'prettier',
    'rimraf',
    'setup-polly-jest',
    'ts-jest',
    'tsup',
    'typedoc',
    'typedoc-plugin-missing-exports',
    'typescript',
  ],
});
