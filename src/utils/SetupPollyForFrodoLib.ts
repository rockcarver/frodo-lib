import path from 'path';
import { fileURLToPath } from 'url';
import { Polly } from '@pollyjs/core';
import { MODES } from '@pollyjs/utils';
import NodeHttpAdapter from '@pollyjs/adapter-node-http';
import FSPersister from '@pollyjs/persister-fs';
import { LogLevelDesc } from 'loglevel';
import { debugMessage, printMessage } from '../ops/utils/Console';

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

async function countdown(ms) {
  await delay(ms);
  return --ttl;
}

const timeout = 15;
let ttl = timeout;
async function scheduleShutdown(polly: Polly) {
  ++ttl;
  while (await countdown(1000)) {
    if (ttl < 4)
      console.log(
        `Polly instance '${getFrodoCommand()}' stopping in ${ttl}s...`
      );
  }
  await polly.stop();
  console.log(`Polly instance '${getFrodoCommand()}' stopped.`);
}

/*
argv:
[
  '/Users/vscheuber/.nvm/versions/node/v18.7.0/bin/node',
  '/usr/local/bin/frodo',
  'journey',
  'list',
  '-l',
  'https://openam-volker-dev.forgeblocks.com/am',
  'alpha',
  'volker.scheuber@forgerock.com',
  'Sup3rS3cr3t!'
]
argv:
[
  '/Users/vscheuber/.nvm/versions/node/v18.7.0/bin/node',
  '/Users/vscheuber/Projects/frodo-cli/esm/cli/journey/journey-list.js',
  '-l',
  'https://openam-volker-dev.forgeblocks.com/am',
  'alpha',
  'volker.scheuber@forgerock.com',
  'Sup3rS3cr3t!'
]
*/
function getFrodoCommand() {
  try {
    if (mode !== MODES.RECORD)
      debugMessage(
        `SetupPollyForFrodoLib.getFrodoCommand: process.argv=${process.argv}`
      );
    if (
      !process.argv[1].endsWith('frodo') &&
      !process.argv[1].endsWith('frodo.exe') &&
      !process.argv[1].endsWith('app.js')
    ) {
      return path.parse(process.argv[1]).name.replace('-', '/');
    }
    return process.argv[2];
  } catch (error) {
    printMessage(`SetupPollyForFrodoLib.getFrodoCommand: ${error}`, 'error');
    printMessage(process.argv, 'error');
    return 'error';
  }
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

  for (const host of FRODO_MOCK_HOSTS) {
    if (mode === MODES.RECORD) console.log(`***** Host: ${host}`);
    polly.server.host(host, () => {
      polly.server
        .any('/am/oauth2/*')
        .recordingName(`${getFrodoCommand()}/oauth2`)
        .on('request', (req) => {
          req.configure({ matchRequestsBy: authenticationMatchRequestsBy() });
        });
      polly.server.any('/am/json/*').recordingName(`${getFrodoCommand()}/am`);
      polly.server
        .any('/openidm/*')
        .recordingName(`${getFrodoCommand()}/openidm`);
      polly.server
        .any('/environment/*')
        .recordingName(`${getFrodoCommand()}/environment`);
      polly.server
        .any('/monitoring/*')
        .recordingName(`${getFrodoCommand()}/monitoring`);
      polly.server
        .any('/feature')
        .recordingName(`${getFrodoCommand()}/feature`);
      polly.server
        .any('/dashboard/*')
        .recordingName(`${getFrodoCommand()}/dashboard`);
    });
  }
  polly.server.host('https://api.github.com', () => {
    polly.server.any('/*').recordingName(`github`);
  });
  polly.server.host('https://registry.npmjs.org', () => {
    polly.server.any('/*').recordingName(`npmjs`);
  });
  polly.server.any().on('request', () => {
    if (ttl < timeout) {
      // console.log(`Reset polly stop ttl (${ttl}) to ${timeout}`);
      ttl = timeout;
    }
  });

  if (mode === MODES.RECORD) {
    scheduleShutdown(polly);
  } else {
    // only output debug messages if not recording as this polly instance is
    // primarily used by frodo-cli e2e tests, which capture stdout in snapshots.
    // debug messages falsify the snapshot recordings.
    debugMessage(`Polly config:`);
    debugMessage(polly.config);
  }

  return polly;
}
