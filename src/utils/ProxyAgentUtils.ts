import { inspect } from 'util';
import {
  ProxyAgent as BaseProxyAgent,
  proxies,
  ProxyAgentOptions,
} from 'proxy-agent';

/**
 * The proxy agent of the library's HTTP layer.
 *
 * The URL of a proxy can carry a user name and a password
 * (`http://user:password@host`), and http-proxy-agent has no other way to
 * receive them, so the agents that proxy-agent makes for a proxy keep that URL.
 * The config of a request refers to the shared agent, and axios puts the config
 * on the error of a failed request. The config has to keep the agent: a request
 * that is sent again (retry, renewal of a credential) is sent with the config
 * of the first one.
 *
 * What this module does about it:
 *
 * - The agent writes itself as `[ProxyAgent]` for `JSON.stringify` and for
 *   `util.inspect`, so an error no longer holds the agents' proxy URLs. What the
 *   agent uses is not changed.
 * - A proxy URL with a scheme that proxy-agent has no agent for is refused with
 *   the message proxy-agent uses for it, but with the scheme, host and port of
 *   the URL only (proxy-agent prints the whole URL). A proxy URL that cannot be
 *   parsed is refused without the URL, which the `TypeError` of `new URL()`
 *   would keep as a property.
 */

/** What an agent is named when it is serialised or inspected. */
const SUMMARY = '[ProxyAgent]';

/**
 * A proxy URL as a message names it: scheme, host and port. The user name,
 * password, path, query and fragment of the URL are left out.
 * @param {URL} proxy the URL of the proxy
 * @returns {string} for example `http://127.0.0.1:3128`
 */
export function proxyUrlWithoutUserinfo(proxy: URL): string {
  return `${proxy.protocol}//${proxy.host}`;
}

/**
 * Check the proxy that was chosen for a request.
 * @param {string | undefined} proxy the proxy URL, empty if the request goes direct
 * @returns {string | undefined} the proxy URL, unchanged
 * @throws {Error} if the URL cannot be parsed or its scheme is not supported
 */
function assertSupportedProxy(proxy: string | undefined): string | undefined {
  if (!proxy) return proxy;
  let url: URL;
  try {
    url = new URL(proxy);
  } catch {
    throw new TypeError('Invalid proxy URL');
  }
  if (!Object.keys(proxies).includes(url.protocol.replace(':', ''))) {
    throw new Error(
      `Unsupported protocol for proxy URL: ${proxyUrlWithoutUserinfo(url)}`
    );
  }
  return proxy;
}

/**
 * The agent for requests that may go through a proxy named by the environment
 * (HTTP_PROXY, HTTPS_PROXY, ALL_PROXY, NO_PROXY and their lower case names).
 * It is proxy-agent's `ProxyAgent`; which proxy a request uses, and which
 * requests use none, is decided exactly as before.
 */
export class ProxyAgent extends BaseProxyAgent {
  constructor(options?: ProxyAgentOptions) {
    super(options);
    const decide = this.getProxyForUrl;
    this.getProxyForUrl = async (url, req) =>
      assertSupportedProxy(await decide.call(this, url, req));
  }

  toJSON(): string {
    return SUMMARY;
  }

  [inspect.custom](): string {
    return SUMMARY;
  }
}
