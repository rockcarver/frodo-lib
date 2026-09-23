/* eslint-disable no-console */
import path from 'path';

import { EXPIRY_STRATEGY, Polly } from '@pollyjs/core';
import FSPersister from '@pollyjs/persister-fs';
import { MODES } from '@pollyjs/utils';
import { LogLevelDesc } from 'loglevel';

import { State } from '../shared/State';
import { debugMessage, printMessage } from './Console';
import { FrodoNodeHttpAdapter } from './FrodoNodeHttpAdapter';
import {
  orderedMatchRequestsBy,
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

// How long a recorded fixture stays trusted before it's considered stale.
// Defaults to warning only (never breaks a replay run on its own) so that
// responding to an expired fixture is a deliberate re-recording decision,
// not a surprise CI failure; a bulk regeneration pass can opt into the
// 'record' strategy instead by setting FRODO_MOCK_EXPIRY_STRATEGY.
const expiresIn = process.env.FRODO_MOCK_EXPIRES_IN || '90d';
const expiryStrategy = (process.env.FRODO_MOCK_EXPIRY_STRATEGY ||
  'warn') as EXPIRY_STRATEGY;

if (process.env.FRODO_MOCK) {
  Polly.register(FrodoNodeHttpAdapter);
  Polly.register(FSPersister);
  if (process.env.FRODO_MOCK === 'record') {
    mode = MODES.RECORD;
    recordIfMissing = true;
  }
}

// Reads one param out of a application/x-www-form-urlencoded request body
// (the shape every /am/oauth2/* request on this project uses).
function getFormParam(body: string, name: string): string | undefined {
  return new URLSearchParams(body).get(name) ?? undefined;
}

function authenticationMatchRequestsBy(pathname: boolean = true) {
  const matchRequestsBy = orderedMatchRequestsBy(false);
  matchRequestsBy.body = false;
  matchRequestsBy.url.pathname = pathname;
  matchRequestsBy.order = true;
  return matchRequestsBy;
}

// Scopes the shared-login recording dedup (see getSharedAuthRecordingName
// below) to PingOne Advanced Identity Cloud hosts. Classic and forgeops
// hosts keep the original per-command recording name untouched -- their
// e2e fixtures were recorded under that scheme and, unlike cloud, don't yet
// have a live re-recording story to repopulate a renamed shared cassette.
function isCloudHost(host: string): boolean {
  return host.includes('.forgeblocks.com');
}

/**
 * Recording name for the login/session-bootstrap sequence (oauth2 token
 * exchange, /authenticate, and the getSessionInfo call that immediately
 * follows it) on a cloud host. Deliberately independent of
 * getFrodoCommand()'s per-test/argv name: every e2e test that logs in
 * currently re-records an identical login sequence under its own recording,
 * even though the e2e suite reuses one fixed credential per deployment type
 * (see test/e2e/utils/TestConfig.js).
 *
 * Deliberately NOT keyed by host: no recording name anywhere in this file
 * encodes hostname, and matching already ignores it (see
 * authenticationMatchRequestsBy()'s hostname: false) -- this project's own
 * convention is that a recording made against one PingOne AIC dev tenant
 * (e.g. volker-dev) replays fine against another (e.g. frodo-dev), since
 * different developers use different tenants day to day. Keying this by
 * host would silently break that. Only call this for hosts isCloudHost()
 * returns true for.
 */
const SHARED_AUTH_RECORDING_NAME = 'shared/auth';

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
          process.argv[i] === 'pull' ||
          process.argv[i] === 'push' ||
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
  matchRequestsBy = orderedMatchRequestsBy(false),
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
      // Without this, Polly's persister prunes any existing HAR entry that
      // wasn't exercised by the *current* recording session before writing
      // the file back out (@pollyjs/persister's _removeUnusedEntries) -- so
      // a targeted, one-command-at-a-time recording pass silently destroys
      // whatever a previous, unrelated recording pass had already captured
      // under the same recording name (e.g. the shared login cassette, which
      // by design accumulates entries from many separate recording sessions
      // for different credentials/realms). Recordings should only ever be
      // pruned deliberately, not as a side effect of recording something else.
      keepUnusedRequests: true,
      fs: {
        recordingsDir,
      },
    },
    matchRequestsBy,
    expiresIn,
    expiryStrategy,
  });

  for (const host of FRODO_MOCK_HOSTS) {
    if (mode === MODES.RECORD) console.log(`***** Host: ${host}`);
    polly.server.host(host, () => {
      // A test can opt out of the shared cassette (e.g. an "invalid
      // credentials" test that needs its own dedicated FAILURE response for
      // login, not the shared cassette's success response) by setting
      // FRODO_MOCK_DEDICATED_AUTH -- it then falls back to the original,
      // per-command recording name, scoped to that one test/invocation.
      //
      // Separately, while *recording* (mode === RECORD), writing to the
      // shared cassette is opt-IN rather than opt-out, via
      // FRODO_MOCK_REFRESH_SHARED_AUTH. This matters because the shared
      // cassette is order-indexed and shared across every cloud host's
      // tests: replaying it is always safe (this gate is a no-op outside
      // RECORD mode, so every non-recording run keeps deduping against it as
      // normal), but overwriting one entry in it during an unrelated
      // recording session can silently break every *other* test that relies
      // on a different entry at that same order position (confirmed
      // directly -- recording one command against a different credential
      // shape shifted which shared/auth/svcacct entry ten-plus IGA tests
      // replayed against, breaking all of them). Without the gate, an
      // ordinary one-command recording pass (the vast majority of
      // day-to-day recording) still authenticates for real -- the rest of
      // the command needs a genuine session -- but that auth exchange is
      // marked passthrough(): a live, unrecorded call, never persisted
      // anywhere. Recording it into a throwaway per-command bucket instead
      // (like FRODO_MOCK_DEDICATED_AUTH's opt-out does deliberately) would
      // leave dead HAR files behind on every single recording pass, since
      // nothing ever replays from them -- passthrough avoids that clutter
      // entirely. Deliberately refreshing the shared cassette (e.g. after a
      // scope change) still works the same as before by setting
      // FRODO_MOCK_REFRESH_SHARED_AUTH=1 alongside FRODO_MOCK=record.
      // The shared cassette's cached auth responses are replayed regardless
      // of which real tenant/credential recorded them (matching ignores
      // both hostname and body by design). Their *scope* claim, however,
      // has to satisfy assertHasRequiredScope() (RequiredScopesOps.ts),
      // which checks the *current* request's required scopes against
      // whatever's cached -- so a token recorded against a narrowly-scoped
      // credential can spuriously fail scope checks for a test that needs
      // a differently-scoped one, even though the auth itself is otherwise
      // interchangeable. Rather than hand-maintain a superset scope list on
      // the recorded fixtures (which only covers scopes anticipated at
      // recording time), rewrite the cached response's scope to whatever
      // *this* request actually asked for, right before replaying it -- see
      // the beforeReplay handlers below. svcacct requests carry their own
      // scope= directly; the interactive grant negotiates it at the
      // /oauth2/authorize step and the follow-up /oauth2/access_token
      // exchange doesn't repeat it, so that one's captured here and reused.
      let requestedInteractiveScope: string | undefined;
      const dedicatedAuth = !!process.env.FRODO_MOCK_DEDICATED_AUTH;
      const regularRecordingPass =
        mode === MODES.RECORD && !process.env.FRODO_MOCK_REFRESH_SHARED_AUTH;
      const sharedAuthName =
        isCloudHost(host) && !dedicatedAuth && !regularRecordingPass
          ? SHARED_AUTH_RECORDING_NAME
          : undefined;
      const liveNoPersistAuth =
        isCloudHost(host) && !dedicatedAuth && regularRecordingPass;

      polly.server
        .any('/am/oauth2/*')
        .recordingName(sharedAuthName || `${getFrodoCommand({ state })}/oauth2`)
        .passthrough(liveNoPersistAuth)
        .on('request', (req) => {
          req.configure({ matchRequestsBy: authenticationMatchRequestsBy() });
          // /oauth2/access_token is hit by two unrelated grant types that
          // share this exact pathname -- service-account JWT-bearer and the
          // interactive authorization-code exchange. matchRequestsBy ignores
          // the body (it's dynamic -- fresh JWT/PKCE verifier every call), so
          // without this they'd collide on the same shared-cassette slot and
          // silently overwrite each other. Split them by grant type instead.
          if (sharedAuthName && typeof req.body === 'string') {
            const grantVariant = req.body.includes('client_id=service-account')
              ? 'svcacct'
              : 'interactive';
            req.overrideRecordingName(`${sharedAuthName}/${grantVariant}`);
          }
          // Capture the interactive grant's requested scope here (see the
          // comment above sharedAuthName) -- /oauth2/authorize is the only
          // place it's actually carried on this request path.
          if (
            sharedAuthName &&
            req.pathname?.endsWith('/oauth2/authorize') &&
            typeof req.body === 'string'
          ) {
            requestedInteractiveScope = getFormParam(req.body, 'scope');
          }
        })
        .on('beforeReplay', (req, recording: Recording) => {
          if (
            !sharedAuthName ||
            !req.pathname?.endsWith('/oauth2/access_token')
          ) {
            return;
          }
          const requestedScope =
            typeof req.body === 'string' && req.body.includes('scope=')
              ? getFormParam(req.body, 'scope')
              : requestedInteractiveScope;
          if (!requestedScope) return;
          const body = JSON.parse(recording.response.content.text);
          if (typeof body.scope !== 'string') return;
          body.scope = requestedScope;
          recording.response.content.text = JSON.stringify(body);
        });
      polly.server
        .any('/am/json/*')
        .recordingName(`${getFrodoCommand({ state })}/am`);
      const authRoute = polly.server.any([
        '/am/json/*/authenticate',
        '/am/json/*/sessions/?_action=getSessionInfo',
      ]);
      if (sharedAuthName) {
        authRoute.recordingName(sharedAuthName);
      }
      authRoute.passthrough(liveNoPersistAuth);
      authRoute.on('request', (req) => {
        req.configure({
          matchRequestsBy: authenticationMatchRequestsBy(),
        });
      });
      const sessionInfoRoute = polly.server.any(
        '/am/json/*/sessions/?_action=getSessionInfo'
      );
      if (sharedAuthName) {
        sessionInfoRoute.recordingName(sharedAuthName);
      }
      sessionInfoRoute.passthrough(liveNoPersistAuth);
      sessionInfoRoute.on('beforeReplay', (_, recording: Recording) => {
        // Set session expiration to be a day in advance of the current day
        // so it's not expired. AuthenticateOps.ts computes the session's
        // effective expiry as the *earlier* of maxIdleExpirationTime and
        // maxSessionExpirationTime, so both fields must be advanced here —
        // leaving either one at its originally-recorded (long past) value
        // still yields a stale `expires`, which on-demand staleness checks
        // (api/BaseApi.ts's credential resolvers) now correctly detect
        // before every request, triggering a same-session re-login that no
        // replay-mode fixture has a recorded response for.
        const body = JSON.parse(recording.response.content.text);
        const date = new Date();
        date.setDate(date.getDate() + 1);
        body.maxIdleExpirationTime = date.toISOString();
        if (body.maxSessionExpirationTime) {
          const sessionDate = new Date(date);
          sessionDate.setHours(sessionDate.getHours() + 2);
          body.maxSessionExpirationTime = sessionDate.toISOString();
        }
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
        .any(['/iga/*', '/auto/orchestration/*'])
        .recordingName(`${getFrodoCommand({ state })}/iga`);
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
      // Apply host normalization and secret obfuscation before writing HAR files to disk.
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
