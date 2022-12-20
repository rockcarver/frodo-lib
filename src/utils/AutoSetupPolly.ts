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

state.setHost(
  process.env.FRODO_HOST || 'https://openam-frodo-dev.forgeblocks.com/am'
);
state.setRealm(process.env.FRODO_REALM || 'alpha');

let recordIfMissing = true;
let mode = MODES.REPLAY;

// resolve "/home/sandeepc/work/ForgeRock/sources/frodo-lib/esm/api" to
// "/home/sandeepc/work/ForgeRock/sources/frodo-lib/src/test/recordings"
const recordingsDir = __dirname.replace(
  /^(.*\/frodo-\w{3})(.*)$/gi,
  '$1/src/test/mock-recordings'
);

switch (process.env.FRODO_POLLY_MODE) {
  case 'record': {
    mode = MODES.RECORD;
    if (!(await getTokens()))
      throw new Error(
        `Unable to record mock responses from '${state.getHost()}'`
      );
    break;
  }
  case 'replay':
    mode = MODES.REPLAY;
    state.setCookieName('cookieName');
    state.setCookieValue('cookieValue');
    break;
  case 'offline':
    mode = MODES.REPLAY;
    recordIfMissing = false;
    break;
}

export default function autoSetupPolly() {
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
    matchRequestsBy: {
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
    },
  });
}
