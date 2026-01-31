/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testRunner: 'jest-jasmine2',
  testEnvironment: 'node',
  snapshotResolver: '<rootDir>/snapshotResolve.js',
  testMatch: ['**/?(*.)(test).ts'],
  testTimeout: 120000,
  reporters: [
    'default',
    ['<rootDir>/jest-exception-reporter.mjs', {}]
  ],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }]
  },
};
