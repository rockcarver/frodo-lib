import path from 'path';
import { fileURLToPath } from 'url';
import { Polly } from '@pollyjs/core';
import { MODES } from '@pollyjs/utils';
import NodeHttpAdapter from '@pollyjs/adapter-node-http';
import FSPersister from '@pollyjs/persister-fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FRODO_MOCK_HOSTS = [
  'https://openam-frodo-dev.forgeblocks.com',
  'https://openam-service-accounts.forgeblocks.com',
  'https://openam-volker-dev.forgeblocks.com',
];

let recordIfMissing = false;
let mode = MODES.REPLAY;

// resolve "/home/sandeepc/work/ForgeRock/sources/frodo-lib/esm/api" to
// "/home/sandeepc/work/ForgeRock/sources/frodo-lib/src/test/recordings"
const recordingsDir = __dirname.replace(
  /^(.*\/frodo-\w{3})(.*)$/gi,
  '$1/mocks'
);

if (process.env.FRODO_MOCK) {
  Polly.register(NodeHttpAdapter);
  Polly.register(FSPersister);
  if (process.env.FRODO_MOCK === 'record') {
    mode = MODES.RECORD;
    recordIfMissing = true;
  }
}

function defaultMatchRequestsBy() {
  return JSON.parse(
    JSON.stringify({
      method: true,
      headers: false, // do not match headers, because "Authorization" header is sent only at recording time
      body: true,
      order: false,
      url: {
        protocol: false,
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

function authenticationMatchRequestsBy() {
  const matchRequestsBy = defaultMatchRequestsBy();
  matchRequestsBy.body = false;
  matchRequestsBy.order = true;
  return matchRequestsBy;
}

// returns a delayed promise
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// performs a specific (mathematical) operation every "ms" (milliseconds)
async function countdown(i, ms) {
  await delay(ms);
  return --i;
}

async function scheduleShutdown(polly: Polly, i = 30) {
  ++i;
  while ((i = await countdown(i, 1000)))
    console.log(`Polly stopping in ${i}s...`);
  await polly.stop();
  console.log(`Polly stopped.`);
}

export function setupPollyForFrodoLib(
  matchRequestsBy = defaultMatchRequestsBy()
): Polly {
  const polly = new Polly('default');

  polly.configure({
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

  for (const host of FRODO_MOCK_HOSTS) {
    if (mode === MODES.RECORD) console.log(`***** Host: ${host}`);
    polly.server.host(host, () => {
      polly.server
        .any('/am/oauth2/*')
        .recordingName('oauth2')
        .on('request', (req) => {
          req.configure({ matchRequestsBy: authenticationMatchRequestsBy() });
        });
      polly.server.any('/am/json/*').recordingName('am');
      polly.server.any('/openidm/*').recordingName('openidm');
      polly.server.any('/environment/*').recordingName('environment');
      polly.server.any('/monitoring/*').recordingName('monitoring');
      polly.server.any('/feature').recordingName('feature');
      polly.server.any('/dashboard/*').recordingName('dashboard');
    });
  }
  polly.server.host('https://api.github.com', () => {
    polly.server.any('/*').recordingName('github');
  });
  polly.server.host('https://registry.npmjs.org', () => {
    polly.server.any('/*').recordingName('npmjs');
  });

  if (mode === MODES.RECORD) scheduleShutdown(polly, 60);

  return polly;
}
