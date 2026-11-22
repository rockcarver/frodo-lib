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
  fixedExtension: false, // one ES module build: dist/index.mjs and dist/index.d.mts
  define: {
    __LIB_BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
  deps: { neverBundle: devDeps, onlyBundle: false },
  // Silence the INEFFECTIVE_DYNAMIC_IMPORT warning: FrodoLib.ts is both
  // statically imported (index.ts, mcp/*) and dynamically imported
  // (SecretsOps.ts). That split is intentional (the lazy SecretsOps import
  // breaks the SecretsOps<->FrodoLib cycle), and in a single-entry bundle
  // the warning's suggestion (move to another chunk) doesn't apply anyway.
  inputOptions: {
    onwarn: (warning, warn) => {
      if (warning.code === 'INEFFECTIVE_DYNAMIC_IMPORT') return;
      warn(warning);
    },
  },
};

// One ES module build. A CommonJS program loads it with require() (Node.js 22.12
// or later); scripts/postbuild-dist.cjs adds dist/index.d.cts and hardens the
// one createRequire line. See decisions/0020-frodo-lib-ships-one-es-module-build-that-commonjs-programs-can-require.md
const esmConfig = {
  ...baseConfig,
  format: 'esm',
};

export default [esmConfig];
