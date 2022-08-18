import fs from 'fs';
import { ConnectionProfile, Authenticate, state } from '../../src/index.js';

export default async function setup(globalConfig) {
  let run = globalConfig.nonFlagArgs.length === -1;
  for (const arg of globalConfig.nonFlagArgs) {
    if (arg.indexOf('e2e') > -1) run = true;
  }
  if (run) {
    console.log('----- begin e2e global setup -----');

    // make sure we have connectivity
    try {
      state.default.session.setTenant(
        process.env.FRODO_HOST || 'https://openam-frodo-dev.forgeblocks.com/am'
      );
      state.default.session.setRealm(process.env.FRODO_REALM || 'alpha');
      state.default.session.setUsername(
        process.env.FRODO_USER || 'volker.scheuber@forgerock.com'
      );
      state.default.session.setPassword(
        process.env.FRODO_PASSWORD || '99Luftballons!'
      );

      await ConnectionProfile.saveConnectionProfile();
      await Authenticate.getTokens();
      if (
        state.default.session.getCookieName() &&
        state.default.session.getCookieValue() &&
        state.default.session.getBearerToken()
      ) {
        console.log(`successfully obtained session from frodo-dev`);
      } else {
        console.dir(state.default.session.raw);
        throw new Error('cannot get session from frodo-dev');
      }
    } catch (error) {
      console.log(`cannot get session from frodo-dev: ${error}`);
      console.dir(error);
      throw new Error('cannot get session from frodo-dev');
    }

    console.log('----- end e2e global setup -----');
  }
}

/*
{
  bail: 0,
  changedFilesWithAncestor: false,
  changedSince: undefined,
  collectCoverage: false,
  collectCoverageFrom: [],
  collectCoverageOnlyFrom: undefined,
  coverageDirectory: '/Users/vscheuber/Projects/frodo/coverage',
  coverageProvider: 'babel',
  coverageReporters: [ 'json', 'text', 'lcov', 'clover' ],
  coverageThreshold: undefined,
  detectLeaks: false,
  detectOpenHandles: false,
  errorOnDeprecated: false,
  expand: false,
  filter: undefined,
  findRelatedTests: false,
  forceExit: false,
  globalSetup: '/Users/vscheuber/Projects/frodo/test/global/global-setup.js',
  globalTeardown: undefined,
  json: false,
  lastCommit: false,
  listTests: false,
  logHeapUsage: false,
  maxConcurrency: 5,
  maxWorkers: 15,
  noSCM: undefined,
  noStackTrace: false,
  nonFlagArgs: [ 'e2e' ],
  notify: false,
  notifyMode: 'failure-change',
  onlyChanged: false,
  onlyFailures: false,
  outputFile: undefined,
  passWithNoTests: false,
  projects: [],
  replname: undefined,
  reporters: undefined,
  rootDir: '/Users/vscheuber/Projects/frodo',
  runTestsByPath: false,
  silent: undefined,
  skipFilter: false,
  snapshotFormat: undefined,
  testFailureExitCode: 1,
  testNamePattern: undefined,
  testPathPattern: 'e2e',
  testResultsProcessor: undefined,
  testSequencer: '/Users/vscheuber/Projects/frodo/node_modules/@jest/test-sequencer/build/index.js',
  testTimeout: undefined,
  updateSnapshot: 'new',
  useStderr: false,
  verbose: true,
  watch: false,
  watchAll: false,
  watchPlugins: undefined,
  watchman: true
}
*/
