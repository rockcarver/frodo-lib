import path from 'path';
import { fileURLToPath } from 'url';
import {
  brotliCompressSync,
  brotliDecompressSync,
  deflateSync,
  gunzipSync,
  gzipSync,
  inflateSync,
} from 'zlib';

import { Polly } from '@pollyjs/core';
import FSPersister from '@pollyjs/persister-fs';
import { MODES } from '@pollyjs/utils';
import { LogLevelDesc } from 'loglevel';
import pollyJest from 'setup-polly-jest';

import { FrodoError, state } from '../index';
import { getTokens } from '../ops/AuthenticateOps';
import Constants from '../shared/Constants';
import { FrodoNodeHttpAdapter } from './FrodoNodeHttpAdapter';
import { defaultMatchRequestsBy, filterRecording } from './PollyUtils';

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
  deployment = Constants.CLOUD_DEPLOYMENT_TYPE_KEY,
  resetState = false
) {
  // To reset the state if recording multiple tests where previous state can conflict
  if (resetState) {
    state.setCookieName(undefined);
    state.setUserSessionTokenMeta(undefined);
    state.setUsername(undefined);
    state.setPassword(undefined);
    state.setBearerTokenMeta(undefined);
    state.setServiceAccountId(undefined);
    state.setServiceAccountJwk(undefined);
    state.setServiceAccountScope(undefined);
  }
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

export function setupPollyRecordingContext(
  ctx,
  idReplacementStrategies?: {
    pathToObj: string[];
    identifier: string;
    testObjs: object[];
    oldObjIds: Map<string, string>;
    namesWhereMultipleRequestsMade: string[];
  }[],
  keepResponsesCompressed: boolean = false
): void {
  ctx.polly.server.any().on('beforePersist', (_req, recording) => {
    // Filter recordings
    filterRecording(recording, true, state);
    // Replace ids
    if (idReplacementStrategies) {
      for (const strategy of idReplacementStrategies) {
        for (const obj of strategy.testObjs) {
          const id = obj[strategy.identifier];
          const oldId = strategy.oldObjIds.get(id);
          if (oldId) {
            recording.request.url = recording.request.url.replaceAll(id, oldId);
            if (recording.request.postData)
              recording.request.postData.text =
                recording.request.postData.text.replaceAll(id, oldId);
            recording.response.content.text =
              recording.response.content.text.replaceAll(id, oldId);
          }
        }
      }
    }
  });
  if (!idReplacementStrategies) return;
  // Normalize id's from created ids to test ids
  ctx.polly.config.matchRequestsBy.url.pathname = (path) => {
    for (const strategy of idReplacementStrategies) {
      const id = strategy.oldObjIds.keys().find((k) => path.endsWith(k));
      if (!id) continue;
      path = path.replaceAll(id, strategy.oldObjIds.get(id));
    }
    return path;
  };
  ctx.polly.config.matchRequestsBy.body = (bodyString) => {
    for (const strategy of idReplacementStrategies) {
      const id = getIdFromPath(
        JSON.parse(bodyString),
        strategy.identifier,
        strategy.pathToObj
      );
      const value = strategy.oldObjIds.get(id);
      if (!value) continue;
      bodyString = bodyString.replaceAll(id, value);
    }
    return bodyString;
  };
  ctx.polly.server.any().on('beforeResponse', (req, res) => {
    let responseBody;
    try {
      responseBody = JSON.parse(res.body);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // Ignore if the response body is not JSON data
      return;
    }
    // Based on all recordings so far, any compressed response is base64 encoded and chunked using br encoding, so I assume the response is compressed when it's encoded and chunked.
    const isCompressed =
      res.encoding === 'base64' &&
      res.headers['transfer-encoding'] === 'chunked';
    if (isCompressed) {
      const buffer = Buffer.concat(
        responseBody.map((chunk) => Buffer.from(chunk, 'base64'))
      );
      let decompressedBuffer;
      switch (res.headers['content-encoding']) {
        // Should only ever be br encoded, but there are a few other common ones just in case
        case 'br':
          decompressedBuffer = brotliDecompressSync(buffer);
          break;
        case 'gzip':
          decompressedBuffer = gunzipSync(buffer);
          break;
        case 'deflate':
          decompressedBuffer = inflateSync(buffer);
          break;
        default:
          throw new FrodoError(
            `setupPollyRecordingContext (AutoSetupPolly.ts): Unsupported content-encoding '${res.headers['content-encoding']}'`
          );
      }
      responseBody = JSON.parse(decompressedBuffer.toString('utf8'));
    }
    let responseBodyString = JSON.stringify(responseBody);
    for (const strategy of idReplacementStrategies) {
      const ids = [];
      const pathId = strategy.oldObjIds
        .keys()
        .find((k) => req.pathname.endsWith(k));
      if (pathId) {
        ids.push(pathId);
      } else {
        const bodyId = getIdFromPath(
          responseBody,
          strategy.identifier,
          strategy.pathToObj
        );
        if (bodyId) {
          ids.push(bodyId);
        } else if (
          Array.isArray(responseBody.result) &&
          responseBody.result.length > 0 &&
          // For cases when multiple requests are made, we ignore
          strategy.namesWhereMultipleRequestsMade.every(
            (n) => !req.body.includes(n) && !req.identifiers.url.includes(n)
          )
        ) {
          for (const data of responseBody.result) {
            const dataId = getIdFromPath(
              data,
              strategy.identifier,
              strategy.pathToObj
            );
            if (dataId) ids.push(dataId);
          }
        }
      }
      for (const id of ids) {
        const value = strategy.oldObjIds.get(id);
        if (value) {
          responseBodyString = responseBodyString.replaceAll(id, value);
        }
      }
    }
    // Set the new body
    if (keepResponsesCompressed && isCompressed) {
      const buffer = Buffer.from(responseBodyString, 'utf8');
      let compressedBuffer;
      switch (res.headers['content-encoding']) {
        case 'br':
          compressedBuffer = brotliCompressSync(buffer);
          break;
        case 'gzip':
          compressedBuffer = gzipSync(buffer);
          break;
        case 'deflate':
          compressedBuffer = deflateSync(buffer);
          break;
        default:
          throw new FrodoError(
            `setupPollyRecordingContext (AutoSetupPolly.ts): Unsupported content-encoding '${res.headers['content-encoding']}'`
          );
      }
      // We just use a single chunk here, no reason to split it up
      res.body = JSON.stringify([compressedBuffer.toString('base64')]);
    } else {
      res.body = responseBodyString;
      // Remove any indication that the response is compressed
      res.encoding = undefined;
      delete res.headers['content-encoding'];
      delete res.headers['transfer-encoding'];
    }
  });
}

function getIdFromPath(
  obj: object,
  identifier: string,
  path: string[]
): string | null {
  let id = obj;
  path = [...path, identifier];
  for (let i = 0; i < path.length; ++i) {
    if (typeof id !== 'object' || id === null) return null;
    id = id[path[i]];
  }
  return typeof id === 'string' ? id : null;
}
