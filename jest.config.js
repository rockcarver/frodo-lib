/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testRunner: 'jest-jasmine2',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/jest-no-ambient-proxy.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/test/jest-polly-replay-integrity.setup.js'],
  snapshotResolver: '<rootDir>/snapshotResolve.js',
  testMatch: ['**/?(*.)(test).ts'],
  testTimeout: 180000,
  reporters: [
    'default',
    ['<rootDir>/jest-exception-reporter.mjs', {}]
  ],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }]
  },
};
