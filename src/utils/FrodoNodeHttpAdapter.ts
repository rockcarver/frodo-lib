import NodeHttpAdapter from '@pollyjs/adapter-node-http';

import { cleanupProxyRequestUrl } from './PollyUtils';

export class FrodoNodeHttpAdapter extends NodeHttpAdapter {
  async onRequest(pollyRequest) {
    pollyRequest.url = cleanupProxyRequestUrl(pollyRequest.url);
    super.onRequest(pollyRequest);
  }
}
