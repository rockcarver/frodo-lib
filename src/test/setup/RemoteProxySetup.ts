import { state } from '../../index';
import { createConfigEntity, deleteConfigEntity } from '../../ops/IdmConfigOps';
import * as RemoteProxyOps from '../../ops/RemoteProxyOps';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';

const { REMOTE_PROXY_TYPE } = RemoteProxyOps;

// The receiving tenants below do not exist: the proxies only have to be
// stored and read back. The secrets are placeholders of ESVs that do not exist.

/**
 * Staged before the recording, read and exported by the tests
 */
export const proxy1Id = 'FrodoTestRemoteProxy1';
export const proxy1: RemoteProxyOps.RemoteProxySkeleton = {
  enabled: true,
  authType: 'bearer',
  instanceUrl: 'https://frodo-test-one.example.com/openidm/',
  clientId: 'idmprovisioning',
  clientSecret: '&{esv.frodo.test.remoteproxy.one.secret}',
  scope: ['fr:idm:*'],
  tokenEndpoint:
    'https://frodo-test-one.example.com/am/oauth2/realms/root/realms/alpha/access_token',
  tokenEndpointAuthMethod: 'client_secret_post',
  scopeDelimiter: ' ',
};

/**
 * Created by a test
 */
export const proxy2Id = 'FrodoTestRemoteProxy2';
export const proxy2: RemoteProxyOps.RemoteProxySkeleton = {
  enabled: true,
  authType: 'basic',
  instanceUrl: 'https://frodo-test-two.example.com/openidm/',
  userName: 'frodo-test-proxy-user',
  password: '&{esv.frodo.test.remoteproxy.two.password}',
};

/**
 * Imported and then deleted by tests
 */
export const proxy3Id = 'FrodoTestRemoteProxy3';
export const proxy3: RemoteProxyOps.RemoteProxySkeleton = {
  enabled: false,
  authType: 'bearer',
  instanceUrl: 'https://frodo-test-three.example.com/openidm/',
  clientId: 'idmprovisioning',
  clientSecret: '&{esv.frodo.test.remoteproxy.three.secret}',
  scope: ['fr:idm:*'],
  tokenEndpoint:
    'https://frodo-test-three.example.com/am/oauth2/realms/root/realms/alpha/access_token',
  tokenEndpointAuthMethod: 'client_secret_post',
  scopeDelimiter: ' ',
};

export async function stageRemoteProxy(
  proxyId: string,
  proxy?: RemoteProxyOps.RemoteProxySkeleton,
  createNew = false
) {
  const entityId = `${REMOTE_PROXY_TYPE}/${proxyId}`;
  try {
    await deleteConfigEntity({
      entityId,
      state,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  } finally {
    if (createNew) {
      await createConfigEntity({
        entityId,
        entityData: proxy,
        state,
      });
    }
  }
}

export function setup() {
  const ctx = autoSetupPolly();

  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        // Filter recordings
        filterRecording(recording, true, state);
      });
    }
  });

  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageRemoteProxy(proxy1Id, proxy1, true);
      await stageRemoteProxy(proxy2Id);
      await stageRemoteProxy(proxy3Id);
    }
  });

  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageRemoteProxy(proxy1Id);
      await stageRemoteProxy(proxy2Id);
      await stageRemoteProxy(proxy3Id);
    }
  });
}
