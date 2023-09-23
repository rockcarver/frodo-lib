import NodeHttpAdapter from '@pollyjs/adapter-node-http';
import { Polly } from '@pollyjs/core';
import FSPersister from '@pollyjs/persister-fs';
import { MODES } from '@pollyjs/utils';
import { LogLevelDesc } from 'loglevel';
import path from 'path';
import { fileURLToPath } from 'url';

import { State } from '../shared/State';
import { debugMessage, printMessage } from './Console';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FRODO_MOCK_HOSTS = [
  'https://openam-frodo-dev.forgeblocks.com',
  'https://openam-volker-dev.forgeblocks.com',
  'https://openam-volker-demo.forgeblocks.com',
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
async function scheduleShutdown({
  polly,
  state,
}: {
  polly: Polly;
  state: State;
}) {
  ++ttl;
  while (await countdown(1000)) {
    if (ttl < 4)
      console.log(
        `Polly instance '${getFrodoCommand({ state })}' stopping in ${ttl}s...`
      );
  }
  await polly.stop();
  console.log(`Polly instance '${getFrodoCommand({ state })}' stopped.`);
}

function getFrodoArgsId({ start, state }: { start: number; state: State }) {
  const result: string[] = [];
  const args: string[] = [];
  const params: string[] = [];
  let expectValue = false;
  process.argv
    .filter((_v, i) => i >= start)
    .map((v) => {
      if (v.startsWith('--')) {
        params.push(v.replace('--', ''));
        expectValue = true;
      } else if (v.startsWith('-')) {
        params.push(v.replace('-', ''));
        expectValue = true;
      } else if (expectValue) {
        expectValue = false;
      } else {
        args.push(v);
      }
      return v;
    });
  result.push(`${args.length}`);
  const paramsId = params.join('_');
  if (paramsId) result.push(paramsId);
  const argsId = result.join('_');
  if (mode !== MODES.RECORD)
    debugMessage({
      message: `SetupPollyForFrodoLib.getFrodoArgsId: argsId=${argsId}`,
      state,
    });
  return argsId;
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
function getFrodoCommand({ state }: { state: State }) {
  let cmd = 'unknown';
  try {
    if (mode !== MODES.RECORD)
      debugMessage({
        message: `SetupPollyForFrodoLib.getFrodoCommand: process.argv=${process.argv}`,
        state,
      });
    if (
      !process.argv[1].endsWith('frodo') &&
      !process.argv[1].endsWith('frodo.exe') &&
      !process.argv[1].endsWith('app.js')
    ) {
      cmd =
        path.parse(process.argv[1]).name.replace('-', '/') +
        '/' +
        getFrodoArgsId({ start: 2, state });
    } else {
      cmd = process.argv[2] + '/' + getFrodoArgsId({ start: 3, state });
    }
  } catch (error) {
    printMessage({
      message: `SetupPollyForFrodoLib.getFrodoCommand: ${error}`,
      type: 'error',
      state,
    });
    printMessage({ message: process.argv, type: 'error', state });
    cmd = 'error';
  }
  if (mode !== MODES.RECORD)
    debugMessage({
      message: `SetupPollyForFrodoLib.getFrodoCommand: cmd=${cmd}`,
      state,
    });
  return cmd;
}

export function setupPollyForFrodoLib({
  matchRequestsBy = defaultMatchRequestsBy(),
  state,
}: {
  matchRequestsBy?: any;
  state: State;
}): Polly {
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
        .recordingName(`${getFrodoCommand({ state })}/oauth2`)
        .on('request', (req) => {
          req.configure({ matchRequestsBy: authenticationMatchRequestsBy() });
        });
      polly.server
        .any('/am/json/*')
        .recordingName(`${getFrodoCommand({ state })}/am`);
      polly.server
        .any('/openidm/managed/svcacct')
        .recordingName(`${getFrodoCommand({ state })}/openidm/managed/svcacct`)
        .on('request', (req) => {
          req.configure({ matchRequestsBy: authenticationMatchRequestsBy() });
        });
      polly.server
        .any('/openidm/*')
        .recordingName(`${getFrodoCommand({ state })}/openidm`);
      polly.server
        .any('/environment/*')
        .recordingName(`${getFrodoCommand({ state })}/environment`);
      polly.server
        .any('/keys')
        .recordingName(`${getFrodoCommand({ state })}/keys`)
        .on('request', (req) => {
          req.configure({ matchRequestsBy: authenticationMatchRequestsBy() });
        });
      polly.server
        .any('/monitoring/*')
        .recordingName(`${getFrodoCommand({ state })}/monitoring`);
      polly.server
        .any('/feature')
        .recordingName(`${getFrodoCommand({ state })}/feature`);
      polly.server
        .any('/dashboard/*')
        .recordingName(`${getFrodoCommand({ state })}/dashboard`);
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
    scheduleShutdown({ polly, state });
  } else {
    // only output debug messages if not recording as this polly instance is
    // primarily used by frodo-cli e2e tests, which capture stdout in snapshots.
    // debug messages falsify the snapshot recordings.
    debugMessage({ message: `Polly config:`, state });
    debugMessage({ message: polly.config, state });
  }

  return polly;
}
