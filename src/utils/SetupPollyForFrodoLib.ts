/* eslint-disable no-console */
import { Polly } from '@pollyjs/core';
import FSPersister from '@pollyjs/persister-fs';
import { MODES } from '@pollyjs/utils';
import { LogLevelDesc } from 'loglevel';
import path from 'path';

import { State } from '../shared/State';
import { debugMessage, printMessage } from './Console';
import { FrodoNodeHttpAdapter } from './FrodoNodeHttpAdapter';
import {
  defaultMatchRequestsBy,
  filterRecording,
  Recording,
} from './PollyUtils';

const FRODO_TEST_NAME = process.env.FRODO_TEST_NAME
  ? process.env.FRODO_TEST_NAME
  : null;

const FRODO_MOCK_HOSTS = process.env.FRODO_MOCK_HOSTS
  ? process.env.FRODO_MOCK_HOSTS.split(',')
  : [
      'https://openam-frodo-dev.forgeblocks.com',
      'https://openam-volker-dev.forgeblocks.com',
      'https://openam-volker-demo.forgeblocks.com',
      'https://nightly.gcp.forgeops.com',
      'http://openam-frodo-dev.classic.com:8080',
    ];

let recordIfMissing = false;
let mode = MODES.REPLAY;

const recordingsDir = process.env.FRODO_MOCK_DIR
  ? process.env.FRODO_MOCK_DIR
  : 'test/e2e/mocks';

if (process.env.FRODO_MOCK) {
  Polly.register(FrodoNodeHttpAdapter);
  Polly.register(FSPersister);
  if (process.env.FRODO_MOCK === 'record') {
    mode = MODES.RECORD;
    recordIfMissing = true;
  }
}

function authenticationMatchRequestsBy(pathname: boolean = true) {
  const matchRequestsBy = defaultMatchRequestsBy(false);
  matchRequestsBy.body = false;
  matchRequestsBy.url.pathname = pathname;
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
  const argsId = process.env.FRODO_TEST_NAME
    ? FRODO_TEST_NAME
    : result.join('_');
  if (process.env.FRODO_TEST_NAME) {
    debugMessage({
      message: `FRODO_TEST_NAME=${FRODO_TEST_NAME}`,
      state,
    });
  }
  if (mode !== MODES.RECORD)
    debugMessage({
      message: `SetupPollyForFrodoLib.getFrodoArgsId: argsId=${argsId}`,
      state,
    });
  return argsId;
}

/*
Special case for when cli switches are the same but their values are
different, for example when testing different encodings: generic, pem, base64hmac
*/
function getFrodoArgValue({ name }: { name: string }) {
  let result: string = '';
  let expectValue = false;
  process.argv.map((v) => {
    if (v === name) {
      expectValue = true;
    } else if (expectValue) {
      result = '_' + v;
      expectValue = false;
    }
  });
  return result;
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
      !process.argv[1].endsWith('app.cjs')
    ) {
      cmd =
        path.parse(process.argv[1]).name.replace('-', '/') +
        '/' +
        getFrodoArgsId({ start: 2, state });
    } else {
      cmd = process.argv[2] + '/';
      let i = 3;
      if (cmd === 'info/') {
        cmd += getFrodoArgsId({ start: 3, state });
      } else {
        if (
          process.argv[i] === 'export' ||
          process.argv[i] === 'import' ||
          process.argv[i] === 'list' ||
          process.argv[i] === 'delete' ||
          process.argv[i] === 'count' ||
          process.argv[i] === 'describe' ||
          process.argv[i] === 'enable' ||
          process.argv[i] === 'disable'
        ) {
          cmd += process.argv[i++] + '/';
        }
        let firstParamIndex = process.argv.findIndex((a) => a.startsWith('-'));
        firstParamIndex =
          firstParamIndex === -1 ? process.argv.length : firstParamIndex;
        cmd += process.argv.slice(i, firstParamIndex).join('-');
        if (!cmd.endsWith('/')) {
          cmd += '/';
        }
        cmd += getFrodoArgsId({ start: firstParamIndex, state });
      }
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
  matchRequestsBy = defaultMatchRequestsBy(false),
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
        .any([
          '/am/json/*/authenticate',
          '/am/json/*/sessions/?_action=getSessionInfo',
        ])
        .on('request', (req) => {
          req.configure({
            matchRequestsBy: authenticationMatchRequestsBy(),
          });
        });
      polly.server
        .any('/am/json/*/sessions/?_action=getSessionInfo')
        .on('beforeReplay', (_, recording: Recording) => {
          // Set session expiration to be a day in advance of the current day so it's not expired.
          const body = JSON.parse(recording.response.content.text);
          const date = new Date();
          date.setDate(date.getDate() + 1);
          body.maxIdleExpirationTime = date.toISOString();
          recording.response.content.text = JSON.stringify(body);
        });
      polly.server
        .any('/am/saml2/*')
        .recordingName(`${getFrodoCommand({ state })}/saml2`);
      polly.server
        .any(['/openidm/managed/svcacct', '/openidm/managed/svcacct/*'])
        .recordingName(`${getFrodoCommand({ state })}/openidm/managed/svcacct`)
        .on('request', (req) => {
          req.configure({
            matchRequestsBy: authenticationMatchRequestsBy(false),
          });
        });
      polly.server
        .any('/openidm/*')
        .recordingName(`${getFrodoCommand({ state })}/openidm`);
      polly.server.any('/environment/*').recordingName(
        `${getFrodoCommand({
          state,
        })}${getFrodoArgValue({ name: '--encoding' })}/environment`
      );
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
  polly.server
    .any()
    .on('request', () => {
      if (ttl < timeout) {
        // console.log(`Reset polly stop ttl (${ttl}) to ${timeout}`);
        ttl = timeout;
      }
    })
    .on('beforePersist', (_req, recording) => {
      filterRecording(recording);
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
