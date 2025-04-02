import { Polly } from '@pollyjs/core';
import FSPersister from '@pollyjs/persister-fs';
import { MODES } from '@pollyjs/utils';
import { LogLevelDesc } from 'loglevel';
import path from 'path';
import pollyJest from 'setup-polly-jest';
import { fileURLToPath } from 'url';

import { state } from '../index';
import { getTokens } from '../ops/AuthenticateOps';
import Constants from '../shared/Constants';
import { FrodoNodeHttpAdapter } from './FrodoNodeHttpAdapter';
import { defaultMatchRequestsBy } from './PollyUtils';

const { setupPolly } = pollyJest;

Polly.register(FrodoNodeHttpAdapter);
Polly.register(FSPersister);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let recordIfMissing = false;
let mode = MODES.REPLAY;

// resolve "/home/sandeepc/work/ForgeRock/sources/frodo-lib/esm/api" to
// "/home/sandeepc/work/ForgeRock/sources/frodo-lib/src/test/recordings"
const recordingsDir = __dirname.replace(
  /^(.*\/frodo-\w{3})(.*)$/gi,
  '$1/src/test/mock-recordings'
);

switch (process.env.FRODO_POLLY_MODE) {
  // record mock responses from a real env: `npm run test:record`
  case 'record': {
    setDefaultState();
    if (
      !(await getTokens({
        state,
      }))
    )
      throw new Error(
        `Unable to record mock responses from '${state.getHost()}'`
      );
    mode = MODES.RECORD;
    recordIfMissing = true;
    break;
  }
  // record mock responses from authentication APIs (don't authenticate): `npm run test:record_noauth`
  case 'record_noauth':
    mode = MODES.RECORD;
    recordIfMissing = true;
    break;
  // replay mock responses: `npm test`
  default:
    setDefaultState();
    state.setCookieName('cookieName');
    state.setUserSessionTokenMeta({
      tokenId: 'cookieValue',
      realm: '/realm',
      successUrl: 'url',
      expires: 0,
    });
    break;
}

export function setDefaultState(
  deployment = Constants.CLOUD_DEPLOYMENT_TYPE_KEY
) {
  const classicHostUrl = 'http://openam-frodo-dev.classic.com:8080/am';
  const classicRealm = '/';
  const cloudHostUrl = 'https://openam-frodo-dev.forgeblocks.com/am';
  const cloudRealm = 'alpha';
  switch (process.env.FRODO_DEPLOY || deployment) {
    case Constants.CLASSIC_DEPLOYMENT_TYPE_KEY:
      state.setHost(
        process.env.FRODO_HOST === cloudHostUrl
          ? classicHostUrl
          : process.env.FRODO_HOST || classicHostUrl
      );
      state.setRealm(
        process.env.FRODO_REALM === cloudRealm
          ? classicRealm
          : process.env.FRODO_REALM || classicRealm
      );
      break;
    default:
      state.setHost(process.env.FRODO_HOST || cloudHostUrl);
      state.setRealm(process.env.FRODO_REALM || cloudRealm);
      break;
  }
  state.setDeploymentType(process.env.FRODO_DEPLOY || deployment);
}

export function autoSetupPolly(matchRequestsBy = defaultMatchRequestsBy()) {
  return setupPolly({
    adapters: ['node-http'],
    mode,
    recordIfMissing,
    flushRequestsOnStop: true,
    logLevel: (process.env.FRODO_POLLY_LOG_LEVEL as LogLevelDesc) || 'warn',
    recordFailedRequests: true,
    persister: 'fs',
    persisterOptions: {
      fs: {
        recordingsDir,
      },
    },
    matchRequestsBy,
  });
}
