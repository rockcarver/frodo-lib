import path from 'path';
import { fileURLToPath } from 'url';
import pollyJest from 'setup-polly-jest';
import { Polly } from '@pollyjs/core';
import { MODES } from '@pollyjs/utils';
import NodeHttpAdapter from '@pollyjs/adapter-node-http';
import FSPersister from '@pollyjs/persister-fs';
import { getTokens } from '../ops/AuthenticateOps';
import { state } from '../index';

const { setupPolly } = pollyJest;
Polly.register(NodeHttpAdapter);
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
    state.setHost(
      process.env.FRODO_HOST || 'https://openam-frodo-dev.forgeblocks.com/am'
    );
    state.setRealm(process.env.FRODO_REALM || 'alpha');
    if (!(await getTokens()))
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
    state.setHost(
      process.env.FRODO_HOST || 'https://openam-frodo-dev.forgeblocks.com/am'
    );
    state.setRealm(process.env.FRODO_REALM || 'alpha');
    state.setCookieName('cookieName');
    state.setCookieValue('cookieValue');
    break;
}

export function defaultMatchRequestsBy() {
  return JSON.parse(
    JSON.stringify({
      method: true,
      headers: false, // do not match headers, because "Authorization" header is sent only at recording time
      body: true,
      order: false,
      url: {
        protocol: true,
        username: false,
        password: false,
        hostname: false, // we will record from different envs but run tests always against `frodo-dev`
        port: false,
        pathname: true,
        query: true,
        hash: true,
      },
    })
  );
}

export function autoSetupPolly(matchRequestsBy = defaultMatchRequestsBy()) {
  return setupPolly({
    adapters: ['node-http'],
    mode,
    recordIfMissing,
    flushRequestsOnStop: true,
    logLevel: 'warn',
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
