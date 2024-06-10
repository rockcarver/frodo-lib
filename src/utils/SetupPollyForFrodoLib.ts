/* eslint-disable no-console */
import NodeHttpAdapter from '@pollyjs/adapter-node-http';
import { Polly } from '@pollyjs/core';
import FSPersister from '@pollyjs/persister-fs';
import { MODES } from '@pollyjs/utils';
import { LogLevelDesc } from 'loglevel';
import path from 'path';

import { State } from '../shared/State';
import { decode, encode, isBase64Encoded } from './Base64Utils';
import { debugMessage, printMessage } from './Console';

const FRODO_MOCK_HOSTS = process.env.FRODO_MOCK_HOSTS
  ? process.env.FRODO_MOCK_HOSTS.split(',')
  : [
      'https://openam-frodo-dev.forgeblocks.com',
      'https://openam-volker-dev.forgeblocks.com',
      'https://openam-volker-demo.forgeblocks.com',
      'https://nightly.gcp.forgeops.com',
    ];

let recordIfMissing = false;
let mode = MODES.REPLAY;

const recordingsDir = process.env.FRODO_MOCK_DIR
  ? process.env.FRODO_MOCK_DIR
  : 'test/e2e/mocks';

if (process.env.FRODO_MOCK) {
  Polly.register(NodeHttpAdapter);
  Polly.register(FSPersister);
  if (process.env.FRODO_MOCK === 'record') {
    mode = MODES.RECORD;
    recordIfMissing = true;
  }
}

function defaultMatchRequestsBy() {
  return {
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
  };
}

function authenticationMatchRequestsBy() {
  const matchRequestsBy = defaultMatchRequestsBy();
  matchRequestsBy['body'] = false;
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

function filterRecording(recording: {
  request: {
    headers: [{ name: string; value: string }];
    postData: { text: any };
  };
  response: { content: { mimeType: string; text: any } };
}) {
  // request headers
  if (recording.request?.headers) {
    const headers: [{ name: string; value: string }] =
      recording.request.headers;
    headers.map((header) => {
      if (header.name.toUpperCase() === 'AUTHORIZATION') {
        if (isBase64Encoded(header.value)) {
          header.value = encode('username:password');
        } else {
          header.value = header.value.replace(
            /Bearer .+/,
            'Bearer <bearer token>'
          );
        }
      }
      if (header.name.toUpperCase() === 'X-API-KEY') {
        header.value = '<api key>';
      }
      if (header.name.toUpperCase() === 'X-API-SECRET') {
        header.value = '<api secret>';
      }
    });
    recording.request.headers = headers;
  }

  // request post body
  if (recording.request?.postData?.text) {
    let body = recording.request.postData.text;
    body = body.replace(/assertion=.+?&/, 'assertion=<assertion jwt token>&');
    recording.request.postData.text = body;
  }

  // response body
  if (recording.response?.content?.text) {
    let body = recording.response.content.text;
    // JSON content
    if (
      recording.response.content.mimeType === 'application/json;charset=UTF-8'
    ) {
      try {
        const json = JSON.parse(body);
        if (json['access_token']) json['access_token'] = '<access token>';
        if (json['id_token']) json['id_token'] = '<id token>';
        if (json.accessKey) json.accessKey = '<access key>';
        if (json.result) {
          for (const obj of json.result) {
            // check for scripts
            if (obj.script) {
              try {
                let script = decode(obj.script);
                script = script.replace(
                  /(var .*?(?:Sid|sid|Secret|secret|PhoneNumberFrom) = (?:"|'))(.*?)((?:"|'))/g,
                  '$1<secret>$3'
                );
                obj.script = encode(script);
              } catch (error) {
                //
              }
            }
          }
        }
        body = JSON.stringify(json);
      } catch (error) {
        // ignore
      }
    }
    // Text and XML content
    if (recording.response.content.mimeType === 'text/xml;charset=utf-8') {
      try {
        body = body.replace(
          /<ds:X509Certificate>.+?<\/ds:X509Certificate>/gs,
          `<ds:X509Certificate>${encode('<certificate>')}</ds:X509Certificate>`
        );
      } catch (error) {
        // ignore
      }
    }
    recording.response.content.text = body;
  }
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
        .any('/am/saml2/*')
        .recordingName(`${getFrodoCommand({ state })}/saml2`);
      polly.server
        .any('/openidm/managed/svcacct')
        .recordingName(`${getFrodoCommand({ state })}/openidm/managed/svcacct`)
        .on('request', (req) => {
          req.configure({ matchRequestsBy: authenticationMatchRequestsBy() });
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
