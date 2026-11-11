import type { ClientRequest } from 'http';
import { STATUS_CODES } from 'http';

/**
 * What a request that goes through a proxy says about the proxy when it fails.
 *
 * A proxy that refuses the tunnel or cannot be reached produces errors that do
 * not name it: `connect ECONNREFUSED 10.1.2.3:3128` reads as if the tenant were
 * down, and a 407 reads as if the tenant wanted credentials. The library knows
 * better, because it decided to send the request through the proxy. So it
 * states the facts (which proxy, what it did, whether the target was HTTP or
 * HTTPS) as `proxyFailure` on the error, and gives each kind of failure a
 * stable code that `FrodoError` carries. How to fix it is advice in the words
 * of one interface and stays with the caller (core 0001).
 *
 * "A proxy was used for this request" is not looked up again here. The proxy
 * agent decides it for every request, with the variables and `NO_PROXY` it
 * reads at that moment, and the `ProxyAgent` of ProxyAgentUtils records that
 * decision for the request it was made for ({@link noteProxyDecision}). A failure is a proxy failure only when the
 * proxy is certain to be the peer that failed:
 *
 * - The proxy answered the CONNECT request of an HTTPS target with a status
 *   other than 200 (`proxyConnect` event of the agent), or answered a request
 *   for an HTTP target with 407.
 * - The connection to the proxy failed before the proxy answered: the request
 *   never got a socket, and the only connection that was being made is the
 *   one to the proxy.
 * - The proxy closed the connection of a request for an HTTP target. The
 *   library talks only to the proxy there.
 *
 * What happens after the proxy has answered the CONNECT request with 200 is
 * between the library and the target, and is never a proxy failure; nor is a
 * request that was sent on a tunnel that an earlier request opened, or one to
 * a target that is on `NO_PROXY`.
 */

/**
 * The codes of the proxy failures, each a `FrodoError.code`. They are listed in
 * `FRODO_ERROR_CODES` (src/ops/FrodoError.ts) and follow the rule there: never
 * renamed, never reused.
 */
export const PROXY_FAILURE_CODES = [
  /** A proxy answered 407: it wants credentials the request did not carry, or did not accept the ones it carried. */
  'PROXY_AUTHENTICATION_REQUIRED',
  /** A proxy answered the CONNECT request for an HTTPS target with a status other than 200 and 407. */
  'PROXY_TUNNEL_REFUSED',
  /** The connection to a proxy was refused: nothing listens at its address. */
  'PROXY_CONNECTION_REFUSED',
  /** A proxy closed the connection before it answered. */
  'PROXY_CONNECTION_CLOSED',
  /** A proxy could not be reached: its name does not resolve, there is no route to it, or the connection attempt timed out. */
  'PROXY_UNREACHABLE',
] as const;

export type ProxyFailureCode = (typeof PROXY_FAILURE_CODES)[number];

/** The facts about a failure of a proxy, as `proxyFailure` of the error of a request. */
export type ProxyFailure = {
  /** The stable identity of the failure. */
  code: ProxyFailureCode;
  /** The proxy the request was sent through. Credentials, path and query of its URL are never kept. */
  proxy: { protocol: 'http' | 'https'; host: string; port: number };
  /** What the request was for: a CONNECT tunnel to an HTTPS target, or a request to an HTTP target. */
  target: 'http' | 'https';
  /** The status the proxy answered with. Present for the failures that are an answer. */
  status?: number;
  /** The `Proxy-Authenticate` header of the answer, if it had one. */
  authenticate?: string;
  /** The code of the socket error that showed the failure (`ECONNREFUSED`), if there is one. */
  cause?: string;
  /** The facts as a sentence for a person. */
  message: string;
};

type ProxyUse = {
  proxy: ProxyFailure['proxy'];
  target: ProxyFailure['target'];
  /** The answer of the proxy to the CONNECT request of this request, once it has come. */
  connect?: { status: number; authenticate?: string };
};

/** The proxy that was chosen for a request, by the request. Entries go with their request. */
const uses = new WeakMap<object, ProxyUse>();

const MAX_FIELD_LENGTH = 200;

/** A header value as one printable line of bounded length. */
function oneLine(value: unknown): string | undefined {
  const text = (Array.isArray(value) ? value.join(', ') : value) as unknown;
  if (typeof text !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex -- control characters of a header must not reach a terminal
  const line = text.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  if (!line) return undefined;
  return line.length > MAX_FIELD_LENGTH
    ? `${line.slice(0, MAX_FIELD_LENGTH)}...`
    : line;
}

/**
 * Remember which proxy the agent chose for a request, and what it answered to
 * the CONNECT request of an HTTPS target. Called by the `ProxyAgent` of
 * ProxyAgentUtils with the answer of its decision for the request.
 *
 * Only an HTTP or HTTPS proxy is recorded: the failures of a SOCKS proxy or a
 * PAC file are not told apart here. The agent hands over the proxy URL
 * without its user info (`proxyUrlWithoutUserinfo`), so the credentials of the
 * proxy never get here; whatever else a URL carries is dropped again below.
 * @param {ClientRequest} req the request the decision was made for
 * @param {string} url the URL of the request, as the agent saw it
 * @param {string} proxy the proxy URL the agent chose, without user info; empty if the request goes direct
 */
export function noteProxyDecision(
  req: ClientRequest,
  url: string,
  proxy: string | undefined
): void {
  uses.delete(req);
  if (!proxy) return;
  try {
    const proxyUrl = new URL(proxy);
    const protocol = proxyUrl.protocol === 'https:' ? 'https' : 'http';
    if (proxyUrl.protocol !== 'http:' && proxyUrl.protocol !== 'https:') return;
    const secure = /^(https|wss):$/.test(new URL(url).protocol);
    const use: ProxyUse = {
      proxy: {
        protocol,
        host: proxyUrl.hostname,
        port: Number(proxyUrl.port) || (protocol === 'https' ? 443 : 80),
      },
      target: secure ? 'https' : 'http',
    };
    uses.set(req, use);
    if (secure) {
      // the agent emits this when the proxy has answered the CONNECT request
      req.once(
        'proxyConnect',
        (connect: {
          statusCode?: number;
          headers?: Record<string, unknown>;
        }) => {
          if (typeof connect?.statusCode !== 'number') return;
          use.connect = {
            status: connect.statusCode,
            authenticate: oneLine(connect.headers?.['proxy-authenticate']),
          };
        }
      );
    }
  } catch {
    // a proxy URL that cannot be read is the agent's to report
  }
}

/** The socket-level errors of a connection that is being made to the proxy, by what they say about it. */
const REFUSED_CODES = ['ECONNREFUSED'];
const CLOSED_CODES = ['ECONNRESET', 'EPIPE'];
const UNREACHABLE_CODES = [
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ETIMEDOUT',
];
/** What the agent says when the proxy closes the connection before its answer to CONNECT. */
const ENDED_BEFORE_CONNECT_ANSWER =
  'Proxy connection ended before receiving CONNECT response';

/** The request the error is about, below the layer that follows redirects. */
function requestOf(error: any): ClientRequest | undefined {
  const request = error?.request;
  return request?._currentRequest ?? request ?? undefined;
}

function sentence(failure: Omit<ProxyFailure, 'message'>): string {
  const { code, proxy, target, status, authenticate, cause } = failure;
  const where = `The proxy ${proxy.host}:${proxy.port}`;
  const targetName = target === 'https' ? 'an HTTPS target' : 'an HTTP target';
  const asked =
    target === 'https'
      ? `the CONNECT request for ${targetName}`
      : `the request for ${targetName}`;
  const causeText = cause ? ` (${cause})` : '';
  switch (code) {
    case 'PROXY_AUTHENTICATION_REQUIRED':
    case 'PROXY_TUNNEL_REFUSED': {
      const text = status ? STATUS_CODES[status] : undefined;
      return (
        `${where} refused ${asked} with status ${status}` +
        `${text ? ` (${text})` : ''}.` +
        `${authenticate ? ` Proxy-Authenticate: ${authenticate}` : ''}`
      );
    }
    case 'PROXY_CONNECTION_REFUSED':
      return `${where} refused the connection${causeText}; the request was for ${targetName}.`;
    case 'PROXY_CONNECTION_CLOSED':
      return `${where} closed the connection before it answered ${asked}${causeText}.`;
    case 'PROXY_UNREACHABLE':
      return `${where} could not be reached${causeText}; the request was for ${targetName}.`;
  }
}

/**
 * Say whether the error of a request is a failure of the proxy the request was
 * sent through, and which.
 * @param {unknown} error the error a request failed with
 * @returns {ProxyFailure | undefined} the facts, or undefined if the failure is not certain to be the proxy's
 */
export function describeProxyFailure(error: unknown): ProxyFailure | undefined {
  const request = requestOf(error);
  if (!request) return undefined;
  const use = uses.get(request);
  if (!use) return undefined;
  const { proxy, target } = use;
  const response = (error as any).response;
  const rawCode = (error as any).code;
  const cause =
    typeof rawCode === 'string' && /^[A-Z0-9_]{3,40}$/.test(rawCode)
      ? rawCode
      : undefined;
  const message = String((error as any).message ?? '');

  const make = (
    code: ProxyFailureCode,
    extra: Partial<ProxyFailure> = {}
  ): ProxyFailure => {
    // only the facts that are known: a field is never present and empty
    const known = Object.fromEntries(
      Object.entries(extra).filter(([, value]) => value !== undefined)
    );
    const facts = { code, proxy, target, ...known };
    return { ...facts, message: sentence(facts) };
  };

  // What went wrong with the connection to the proxy, for a request that never got a socket
  const connecting = (): ProxyFailure | undefined => {
    if (cause && REFUSED_CODES.includes(cause))
      return make('PROXY_CONNECTION_REFUSED', { cause });
    if (cause && CLOSED_CODES.includes(cause))
      return make('PROXY_CONNECTION_CLOSED', { cause });
    if (!cause && target === 'https' && message === ENDED_BEFORE_CONNECT_ANSWER)
      return make('PROXY_CONNECTION_CLOSED');
    if (cause && UNREACHABLE_CODES.includes(cause))
      return make('PROXY_UNREACHABLE', { cause });
    return undefined;
  };

  if (target === 'https') {
    if (use.connect) {
      const { status, authenticate } = use.connect;
      // 2xx: a tunnel to the target, and what happens in it is the target's
      if (status >= 200 && status < 300) return undefined;
      if (status === 407)
        return make('PROXY_AUTHENTICATION_REQUIRED', { status, authenticate });
      return make('PROXY_TUNNEL_REFUSED', { status, authenticate });
    }
    // No answer to CONNECT. A request with a socket was sent on a tunnel that
    // an earlier request opened. One without a socket failed while its
    // connection was being made, and the only peer of that is the proxy.
    if (request.socket) return undefined;
    return connecting();
  }

  // An HTTP target: the library talks to the proxy and to nobody else
  if (response) {
    // 407 is the status of a proxy; any other status could be the target's
    return response.status === 407
      ? make('PROXY_AUTHENTICATION_REQUIRED', {
          status: 407,
          authenticate: oneLine(response.headers?.['proxy-authenticate']),
        })
      : undefined;
  }
  if (!request.socket) return connecting();
  if (cause && CLOSED_CODES.includes(cause))
    return make('PROXY_CONNECTION_CLOSED', { cause });
  return undefined;
}

/**
 * Add the facts about a proxy failure to the error of a request, as
 * `proxyFailure`, which `FrodoError.getCombinedMessage()` prints under the
 * error's own message and `FrodoError` takes its `code` from. The error's own
 * message, code and response stay as they were. An error that is not a failure
 * of the proxy is left alone. Never throws.
 * @param {unknown} error the error a request failed with
 */
export function attachProxyFailure(error: unknown): void {
  try {
    if (!error || typeof error !== 'object') return;
    if ((error as { proxyFailure?: unknown }).proxyFailure) return;
    const failure = describeProxyFailure(error);
    if (failure)
      (error as { proxyFailure?: ProxyFailure }).proxyFailure = failure;
  } catch {
    // the facts are a courtesy, the original error is what counts
  }
}
