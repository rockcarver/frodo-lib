import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'], //include all files under src
  format: ['esm', 'cjs'], // generate cjs and esm files
  dts: true, // generate dts files
  splitting: true,
  sourcemap: true,
  clean: true,
  bundle: true,
  legacyOutput: false,
  // Injected as a literal at bundle time so frodo-cli (and anyone else
  // consuming this build) can verify which frodo-lib build they're
  // actually running, rather than trusting file mtimes or on-disk content
  // that a packaging step might not have picked up. See getLibBuildTimestamp
  // in shared/Version.ts.
  define: {
    __LIB_BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
  external: [
    // list all the dev dependencies, which do NOT need to be bundled as indicated in package.json (_devDependencies)
    '@jest/globals',
    '@types/esprima',
    '@types/fs-extra',
    '@types/jest',
    '@types/lodash',
    '@types/mock-fs',
    '@types/node',
    '@types/node-forge',
    '@types/properties-reader',
    '@types/uuid',
    '@typescript-eslint/eslint-plugin',
    '@typescript-eslint/parser',
    'copyfiles',
    'del',
    'eslint',
    'eslint-config-prettier',
    'eslint-plugin-import',
    'eslint-plugin-jest',
    'eslint-plugin-prettier',
    'eslint-plugin-simple-import-sort',
    'jest',
    'jest-jasmine2',
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
