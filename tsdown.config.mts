import { defineConfig } from 'tsdown';

const devDeps = [
  '@jest/globals',
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
];

const baseConfig = {
  entry: ['src/index.ts'],
  target: 'es2022',
  dts: { resolver: "oxc" },
  sourcemap: true,
  clean: true,
  platform: 'node',
  fixedExtension: false, // keep dist/index.js (cjs) + dist/index.mjs (esm)
  define: {
    __LIB_BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
  deps: { neverBundle: devDeps },
};

// ESM build: splitting on (tsdown default), mirrors tsup esmConfig.
const esmConfig = {
  ...baseConfig,
  format: 'esm',
};

// CJS build: no code splitting, mirrors tsup cjsConfig (splitting: false).
const cjsConfig = {
  ...baseConfig,
  format: 'cjs',
  outputOptions: {
    codeSplitting: false,
  },
};

export default [esmConfig, cjsConfig];
