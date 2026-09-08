import { randomBytes, timingSafeEqual } from 'crypto';
import http, { IncomingMessage, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { URL } from 'url';

import { AxiosError } from 'axios';

import { DeviceAuthorizationResponseType } from '../api/OAuth2OIDCApi';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { decodeJwtPayload } from '../utils/JwtUtils';
import { createPkcePair } from '../utils/PkceUtils';
import { FrodoError } from './FrodoError';
import {
  accessToken,
  type AccessTokenMetaType,
  deviceAuthorizationRequest,
} from './OAuth2OidcOps';

/**
 * Matches `aic-mcp-server`'s interactive-flow timeout: long enough for a
 * human to complete MFA/passkey/federation steps, short enough not to leave
 * an abandoned listener or polling loop running indefinitely.
 */
export const DEFAULT_INTERACTIVE_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

const DEFAULT_CALLBACK_PATH = '/callback';

/**
 * Info handed to the caller-supplied {@link BrowserLoginPromptHandler} so it
 * can present the login step however is appropriate for its environment.
 */
export type BrowserLoginPrompt = {
  /** Set for the loopback-redirect (authorization code + PKCE) flow. */
  authorizeUrl?: string;
  /** Set for the device-authorization flow. */
  userCode?: string;
  /** Set for the device-authorization flow. */
  verificationUri?: string;
  /** When to stop waiting for the user to complete this step. */
  expiresAt: Date;
};

/**
 * Presents an interactive login step to a human. frodo-lib never opens a
 * browser or prints to a terminal itself — the caller (frodo-cli, an MCP
 * server host, a test) decides how to surface `prompt` and is responsible
 * for getting the user to `prompt.authorizeUrl` or `prompt.verificationUri`.
 */
export type BrowserLoginPromptHandler = (
  prompt: BrowserLoginPrompt
) => void | Promise<void>;

export type LoopbackCallbackResult = {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
};

export type LoopbackResultPage = {
  success?: string;
  failure?: string;
};

export type LoopbackRedirectListener = {
  /** The exact redirect_uri to use in the authorize request. */
  redirectUri: string;
  /** The loopback port the listener bound to. */
  port: number;
  /** Await the single inbound redirect, or reject on timeout. */
  waitForCallback(timeoutMs?: number): Promise<LoopbackCallbackResult>;
  /** Stop listening. Safe to call more than once. */
  close(): void;
};

/**
 * Generate a fresh CSRF `state` nonce for an OAuth2 authorization request.
 */
export function generateStateNonce(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * Start a short-lived, loopback-only (`127.0.0.1`) HTTP listener that
 * catches exactly one OAuth2 authorization_code redirect and validates the
 * returned `state` parameter against `expectedState` with a constant-time
 * comparison before resolving.
 *
 * @remarks
 * Mirrors the loopback-redirect pattern `aic-mcp-server` and `gcloud auth
 * login` both use: a real browser is directed here by the authorization
 * server, not by this process, so the listener only ever needs to accept
 * one inbound request before shutting itself down. Binds an OS-assigned
 * ephemeral port by default; pass `preferredPort` for an OAuth2 client
 * whose redirect URI is registered against one fixed port.
 */
export async function startLoopbackRedirectListener({
  preferredPort,
  redirectHost = '127.0.0.1',
  callbackPath = DEFAULT_CALLBACK_PATH,
  expectedState,
  resultPage,
  state,
}: {
  preferredPort?: number;
  /**
   * Hostname to advertise in `redirectUri` (the listener always binds the
   * loopback interface regardless of this value). Some OAuth2 clients'
   * registered redirect URIs require the literal string `localhost` rather
   * than `127.0.0.1` — pass `'localhost'` to match one of those exactly.
   */
  redirectHost?: string;
  callbackPath?: string;
  expectedState: string;
  resultPage?: LoopbackResultPage;
  state?: State;
}): Promise<LoopbackRedirectListener> {
  let resolveCallback: (result: LoopbackCallbackResult) => void;
  let rejectCallback: (error: Error) => void;
  const callbackPromise = new Promise<LoopbackCallbackResult>(
    (resolve, reject) => {
      resolveCallback = resolve;
      rejectCallback = reject;
    }
  );
  // swallow an unhandled-rejection warning if waitForCallback() is never
  // awaited (e.g. the caller times out via a different mechanism first)
  callbackPromise.catch(() => undefined);

  const server = http.createServer((req, res) => {
    handleLoopbackRequest({
      req,
      res,
      callbackPath,
      expectedState,
      resultPage,
      resolveCallback,
      state,
    });
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(preferredPort ?? 0, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
  } catch (error) {
    throw new FrodoError(
      `Error starting local browser-login redirect listener`,
      error
    );
  }

  const { port } = server.address() as AddressInfo;
  const redirectUri = `http://${redirectHost}:${port}${callbackPath}`;

  let closed = false;
  const close = (): void => {
    if (!closed) {
      closed = true;
      server.close();
    }
  };

  return {
    redirectUri,
    port,
    close,
    async waitForCallback(
      timeoutMs: number = DEFAULT_INTERACTIVE_LOGIN_TIMEOUT_MS
    ): Promise<LoopbackCallbackResult> {
      const timeoutHandle = setTimeout(() => {
        rejectCallback(
          new FrodoError(
            `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for the browser login to complete.`
          )
        );
      }, timeoutMs);
      timeoutHandle.unref?.();
      try {
        return await callbackPromise;
      } finally {
        clearTimeout(timeoutHandle);
        close();
      }
    },
  };
}

/**
 * Drive a full interactive OAuth2 authorization_code + PKCE login: open a
 * loopback listener, build the `/oauth2/authorize` URL a real browser should
 * be sent to, hand it to `promptHandler`, wait for the redirect, and
 * exchange the returned code for a token.
 *
 * @remarks
 * Deployment-agnostic — the caller supplies `clientId`/`scope`/redirect
 * shape, which differ per deployment type and per candidate OAuth2 client
 * (see `AuthenticateOps.ts`'s deployment-specific `getTokensInteractive`
 * branches). Unlike `AuthenticateOps.ts`'s existing synthetic PKCE flow
 * (`getAuthCode`/`getFreshUserBearerToken`), this never POSTs to
 * `/oauth2/authorize` itself — the authorize step is driven by the human
 * in a real browser, and this process only ever sees the resulting
 * redirect.
 */
export async function runInteractiveAuthorizationCodeFlow({
  clientId,
  scope,
  redirectHost,
  callbackPath,
  preferredPort,
  redirectUri: redirectUriOverride,
  promptHandler,
  timeoutMs = DEFAULT_INTERACTIVE_LOGIN_TIMEOUT_MS,
  state,
}: {
  clientId: string;
  scope: string;
  redirectHost?: string;
  callbackPath?: string;
  preferredPort?: number;
  /**
   * A complete, literal redirect URI to use verbatim instead of
   * constructing one from `redirectHost`/`callbackPath`/`preferredPort` —
   * for an OAuth2 client registered with an exact-match redirect URI (no
   * wildcard/pattern support), where even a functionally-equivalent
   * reconstruction could fail validation (a URL parser normalizes a bare
   * `http://localhost:3000` into `http://localhost:3000/`, for instance,
   * which is a different string than what a client might be registered
   * with). When given, its port is used for the local listener (still
   * bound, as always, to `127.0.0.1` regardless of the advertised
   * hostname) and its path for the listener's inbound request matching;
   * `redirectHost`/`callbackPath`/`preferredPort` are ignored. The literal
   * string itself — never a reconstruction — is what's sent as
   * `redirect_uri` to both the authorize call and the token exchange.
   */
  redirectUri?: string;
  promptHandler: BrowserLoginPromptHandler;
  timeoutMs?: number;
  state: State;
}): Promise<AccessTokenMetaType> {
  const { verifier, challenge, method } = createPkcePair();
  const expectedState = generateStateNonce();

  let overridePort = preferredPort;
  let overrideCallbackPath = callbackPath;
  if (redirectUriOverride) {
    let parsed: URL;
    try {
      parsed = new URL(redirectUriOverride);
    } catch (error) {
      throw new FrodoError(
        `Invalid browser-login redirect URI "${redirectUriOverride}" — must be a full, absolute URL (e.g. "http://localhost:3000").`,
        error
      );
    }
    overridePort = parsed.port ? Number(parsed.port) : undefined;
    overrideCallbackPath = parsed.pathname;
  }

  const listener = await startLoopbackRedirectListener({
    preferredPort: overridePort,
    redirectHost,
    callbackPath: overrideCallbackPath,
    expectedState,
    state,
  });

  // Never reconstructed from the listener's own host/port/path once an
  // override is given — see redirectUri's own comment above.
  const redirectUri = redirectUriOverride ?? listener.redirectUri;

  try {
    const authorizeUrl = new URL(`${state.getHost()}/oauth2/authorize`);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('scope', scope);
    authorizeUrl.searchParams.set('state', expectedState);
    authorizeUrl.searchParams.set('code_challenge', challenge);
    authorizeUrl.searchParams.set('code_challenge_method', method);

    const expiresAt = new Date(Date.now() + timeoutMs);
    await promptHandler({ authorizeUrl: authorizeUrl.toString(), expiresAt });

    const callback = await listener.waitForCallback(timeoutMs);
    if (callback.error || !callback.code) {
      throw new FrodoError(
        `Browser login failed: ${callback.error ?? 'no authorization code returned'}${
          callback.errorDescription ? ` (${callback.errorDescription})` : ''
        }`
      );
    }

    return await accessToken({
      amBaseUrl: state.getHost(),
      data: `client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&grant_type=authorization_code&code=${encodeURIComponent(callback.code)}&code_verifier=${verifier}`,
      config: {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
      state,
    });
  } finally {
    listener.close();
  }
}

/**
 * Exchange a subject token for a new, narrower-scoped token via RFC 8693
 * Token Exchange (`grant_type=urn:ietf:params:oauth:grant-type:token-exchange`).
 *
 * @remarks
 * Confirmed against a real AIC tenant as the mechanism that unlocks AM
 * REST API access for an interactively-obtained token: the primary
 * token from `runInteractiveAuthorizationCodeFlow` is rejected by AM
 * directly, but a token exchanged through the client named in the
 * primary token's own `may_act` claim is accepted. When `exchangeClientId`
 * is not supplied, it's read from `subjectToken`'s decoded `may_act.client_id`
 * claim — do not hardcode a single exchange client, since different
 * deployments (or a future Ping-side change) may name a different one.
 * The resulting token is typically extremely short-lived (tens of seconds)
 * and must never be cached — mint a fresh one immediately before each
 * AM-domain call that needs it.
 */
export async function exchangeTokenForScope({
  subjectToken,
  scope,
  exchangeClientId,
  state,
}: {
  subjectToken: string;
  scope: string;
  exchangeClientId?: string;
  state: State;
}): Promise<AccessTokenMetaType> {
  const clientId = exchangeClientId ?? readMayActClientId(subjectToken);
  if (!clientId) {
    throw new FrodoError(
      `Cannot exchange token for scope '${scope}': no exchangeClientId was provided and the subject token carries no 'may_act' claim naming one.`
    );
  }
  return accessToken({
    amBaseUrl: state.getHost(),
    data: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:token-exchange')}&subject_token=${encodeURIComponent(subjectToken)}&subject_token_type=${encodeURIComponent('urn:ietf:params:oauth:token-type:access_token')}&requested_token_type=${encodeURIComponent('urn:ietf:params:oauth:token-type:access_token')}&scope=${encodeURIComponent(scope)}&client_id=${encodeURIComponent(clientId)}`,
    config: {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
    state,
  });
}

/**
 * Refreshes a browser-login primary token via a plain `grant_type=refresh_token`
 * exchange — the on-demand counterpart to a fresh interactive login, used
 * only when the primary token's response actually included a refresh token
 * (confirmed empirically: cloud's `AICMCPClient`/`AICMCPExchangeClient` never
 * return one today, so this path exists for the sub-flows/deployment types
 * that do return one, not as a universal assumption). Public-client exchange
 * (no client secret), matching how the primary interactive login itself
 * authenticates. Never call this for the short-lived RFC 8693-exchanged
 * AM-domain token — that one is mint-and-discard by design and never has a
 * refresh token to begin with.
 */
export async function refreshBrowserBearerToken({
  state,
}: {
  state: State;
}): Promise<AccessTokenMetaType> {
  const refreshToken = state.getRefreshToken();
  const clientId = state.getBrowserLoginClientId();
  if (!refreshToken) {
    throw new FrodoError(
      `Cannot refresh browser-login token: no refresh token is available on this session.`
    );
  }
  return accessToken({
    amBaseUrl: state.getHost(),
    data: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=${encodeURIComponent(clientId)}`,
    config: {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
    state,
  });
}

/** Reads the `may_act.client_id` claim off a decoded access token, if present. */
function readMayActClientId(jwt: string): string | undefined {
  try {
    const payload = decodeJwtPayload(jwt);
    const mayAct = payload['may_act'] as { client_id?: string } | undefined;
    return mayAct?.client_id;
  } catch {
    return undefined;
  }
}

function handleLoopbackRequest({
  req,
  res,
  callbackPath,
  expectedState,
  resultPage,
  resolveCallback,
  state,
}: {
  req: IncomingMessage;
  res: ServerResponse;
  callbackPath: string;
  expectedState: string;
  resultPage?: LoopbackResultPage;
  resolveCallback: (result: LoopbackCallbackResult) => void;
  state?: State;
}): void {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  // an empty callbackPath means "redirect_uri has no path component", which
  // a real request always normalizes to '/'
  const expectedPathname = callbackPath === '' ? '/' : callbackPath;
  if (url.pathname !== expectedPathname) {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get('code') ?? undefined;
  const receivedState = url.searchParams.get('state') ?? undefined;
  const error = url.searchParams.get('error') ?? undefined;
  const errorDescription =
    url.searchParams.get('error_description') ?? undefined;

  // An error redirect isn't guaranteed to echo `state` back, so treat the
  // error itself as authoritative rather than failing state validation too.
  const stateOk = error
    ? true
    : constantTimeEquals(receivedState, expectedState);
  const originOk = isSameOriginIfPresent(req);

  if (state) {
    debugMessage({
      message: `BrowserAuthenticateOps.handleLoopbackRequest: received callback [stateOk=${stateOk}, originOk=${originOk}, error=${error ?? 'none'}]`,
      state,
    });
  }

  if (!originOk || !stateOk) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderResultPage({ success: false, resultPage }));
    resolveCallback({
      error: error ?? 'state_mismatch',
      errorDescription:
        errorDescription ??
        'The login callback could not be verified. Please try again.',
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(renderResultPage({ success: !error, resultPage }));
  resolveCallback({ code, state: receivedState, error, errorDescription });
}

/** True unless a present `Origin`/`Referer` header points somewhere other than this loopback listener. */
function isSameOriginIfPresent(req: IncomingMessage): boolean {
  const originOrReferer = req.headers['origin'] || req.headers['referer'];
  if (!originOrReferer) {
    return true;
  }
  try {
    const url = new URL(String(originOrReferer));
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  } catch {
    return false;
  }
}

function constantTimeEquals(
  received: string | undefined,
  expected: string
): boolean {
  const receivedBuffer = Buffer.from(received ?? '', 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

function renderResultPage({
  success,
  resultPage,
}: {
  success: boolean;
  resultPage?: LoopbackResultPage;
}): string {
  if (success && resultPage?.success) {
    return resultPage.success;
  }
  if (!success && resultPage?.failure) {
    return resultPage.failure;
  }
  const title = success ? 'Login complete' : 'Login failed';
  const body = success
    ? 'You can close this window and return to the terminal.'
    : 'Something went wrong during login. You can close this window and return to the terminal.';
  const closeScript = success
    ? '<script>setTimeout(() => window.close(), 3000);</script>'
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><p>${body}</p>${closeScript}</body></html>`;
}

/**
 * Drive an OAuth2 Device Authorization Grant (RFC 8628), PKCE-protected the
 * same way `aic-mcp-server` layers PKCE on top of its own device flow: the
 * verifier/challenge are generated once, the challenge is sent on the
 * device-code request, and the verifier is redeemed on the token poll.
 *
 * @remarks
 * Deployment-agnostic — the caller supplies `clientId`/`scope`, which
 * differ per deployment type (see `AuthenticateOps.ts`'s deployment-specific
 * `getTokensInteractive` branches). `state.getHost()` supplies the AM base
 * URL for both the device-code and token endpoints.
 */
export async function startDeviceAuthorizationFlow({
  clientId,
  scope,
  promptHandler,
  timeoutMs = DEFAULT_INTERACTIVE_LOGIN_TIMEOUT_MS,
  state,
}: {
  clientId: string;
  scope: string;
  promptHandler: BrowserLoginPromptHandler;
  timeoutMs?: number;
  state: State;
}): Promise<AccessTokenMetaType> {
  const { verifier, challenge, method } = createPkcePair();
  const formConfig = {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  };

  const start: DeviceAuthorizationResponseType =
    await deviceAuthorizationRequest({
      amBaseUrl: state.getHost(),
      data: `client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scope)}&code_challenge=${challenge}&code_challenge_method=${method}`,
      config: formConfig,
      state,
    });

  const expiresAt = new Date(
    Date.now() + Math.min(start.expires_in, timeoutMs / 1000) * 1000
  );
  await promptHandler({
    userCode: start.user_code,
    verificationUri: start.verification_uri_complete ?? start.verification_uri,
    expiresAt,
  });

  let intervalMs = (start.interval ?? 5) * 1000;
  const deadline = expiresAt.getTime();

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    try {
      return await accessToken({
        amBaseUrl: state.getHost(),
        data: `client_id=${encodeURIComponent(clientId)}&grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:device_code')}&device_code=${encodeURIComponent(start.device_code)}&code_verifier=${verifier}`,
        config: formConfig,
        state,
      });
    } catch (error) {
      const errorCode = extractOAuthErrorCode(error);
      if (errorCode === 'authorization_pending') {
        continue;
      }
      if (errorCode === 'slow_down') {
        intervalMs += 5000;
        continue;
      }
      throw error;
    }
  }
  throw new FrodoError(
    `Device login timed out before it was approved. Please try again.`
  );
}

function extractOAuthErrorCode(error: unknown): string | undefined {
  if (error instanceof FrodoError) {
    const original = error.originalErrors[0] as AxiosError | undefined;
    const data = original?.response?.data as { error?: string } | undefined;
    return data?.error;
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
