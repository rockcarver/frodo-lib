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

state.default.session.setTenant('https://openam-frodo-dev.forgeblocks.com/am');
state.default.session.setRealm('alpha');

let recordIfMissing = true;
let mode = MODES.REPLAY;

// resolve "/home/sandeepc/work/ForgeRock/sources/frodo-lib/esm/api" to
// "/home/sandeepc/work/ForgeRock/sources/frodo-lib/src/test/recordings"
const recordingsDir = __dirname.replaceAll(
  /^(.*\/frodo-\w{3})(.*)$/gi,
  '$1/src/test/mock-recordings'
);

switch (process.env.FRODO_POLLY_MODE) {
  case 'record':
    mode = MODES.RECORD;
    await getTokens();
    break;
  case 'replay':
    mode = MODES.REPLAY;
    state.default.session.setCookieName('cookieName');
    state.default.session.setCookieValue('cookieValue');
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
        hostname: true,
        port: false,
        pathname: true,
        query: true,
        hash: true,
      },
    },
  });
}
