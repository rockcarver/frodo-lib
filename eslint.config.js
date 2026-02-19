const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const tsConfigs = compat
  .config({
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.ts'],
        },
      },
    },
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
      requireConfigFile: false,
      project: './tsconfig.json',
    },
    plugins: ['prettier', 'jest', '@typescript-eslint', 'import'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-deprecated': 'warn',
      'prettier/prettier': ['warn'],
      'dot-notation': 'off',
      'no-console': 'warn',
      'no-underscore-dangle': 'off',
      'no-restricted-syntax': ['error', 'LabeledStatement', 'WithStatement'],
      'no-multi-str': 'off',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          'newlines-between': 'always',
        },
      ],
    },
    env: {
      jest: true,
      'jest/globals': true,
      node: true,
    },
  })
  .map((config) => ({
    ...config,
    files: ['src/**/*.ts'],
  }));

module.exports = [
  {
    ignores: ['types', 'cjs', 'esm', 'src/**/*.test.ts', 'src/**/*.test_.ts', 'tsup.config.ts'],
  },
  ...tsConfigs,
];