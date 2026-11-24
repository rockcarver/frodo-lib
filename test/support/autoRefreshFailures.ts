/**
 * The ways in which the login of a background token refresh can fail, for
 * `src/ops/AuthenticateOps.autoRefreshFailure.unit.test.ts` and the process
 * that it starts (`test/support/autoRefreshWorker.ts`). Each way of failing is made on an
 * instance that has logged in already: from the call on, its next login fails
 * in the way of the failure.
 */
import http from 'http';
import { AddressInfo } from 'net';
import type FrodoLib from '../../src/lib/FrodoLib';

export const FAILURES = [
  'wrong password',
  'token endpoint answers 500',
  'connection refused',
  'thrown string',
  'thrown object without a prototype',
  'thrown object whose toString throws',
] as const;

export type FailureCase = (typeof FAILURES)[number];

/** What the text of the failure in the debug line must hold, by failure. */
export const FAILURE_TEXT: Record<FailureCase, string> = {
  'wrong password': 'Error getting tokens',
  'token endpoint answers 500': 'Error getting tokens',
  'connection refused': 'Error getting tokens',
  'thrown string': 'plain string failure',
  'thrown object without a prototype': 'an error that cannot be shown',
  'thrown object whose toString throws': 'an error that cannot be shown',
};

const THROWN: Partial<Record<FailureCase, () => unknown>> = {
  'thrown string': () => 'plain string failure',
  'thrown object without a prototype': () => Object.create(null),
  'thrown object whose toString throws': () => ({
    toString() {
      throw Object.create(null);
    },
  }),
};

export type BrokenLogin = {
  /** Makes the next login work again. */
  repair(): void;
  /** Ends what the failure needed (a server that answers 500). */
  close(): Promise<void>;
};

/**
 * Makes the next login of the instance fail in the way of the failure. The debug
 * handler of the instance is replaced by one that passes every line to
 * `onDebug` and, for the failures that throw a value of their own, throws it at
 * the start of the login (where `getTokens` has no `try` around it, so that the
 * value reaches the caller as it is).
 * @param {FailureCase} failure how the login fails
 * @param {ReturnType<typeof FrodoLib>} frodo an instance that has logged in
 * @param {(line: string) => void} onDebug receives every debug line
 * @returns {Promise<BrokenLogin>} what repairs the login and ends the helpers
 */
export async function breakLogin(
  failure: FailureCase,
  frodo: ReturnType<typeof FrodoLib>,
  onDebug: (line: string) => void
): Promise<BrokenLogin> {
  const goodHost = frodo.state.getHost();
  const servers: http.Server[] = [];
  const throwing = THROWN[failure];
  let broken = true;
  frodo.state.setDebugHandler((message) => {
    const line =
      typeof message === 'string' ? message : JSON.stringify(message);
    if (
      broken &&
      throwing &&
      line.includes('AuthenticateOps.getTokens: start')
    ) {
      throw throwing();
    }
    onDebug(line);
  });
  const serve = async (answer: boolean) => {
    const server = http.createServer((_request, response) => {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ code: 500, reason: 'Internal Server Error' })
      );
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const port = (server.address() as AddressInfo).port;
    if (!answer) {
      await new Promise<void>((done) => server.close(() => done()));
    } else {
      servers.push(server);
    }
    return `http://127.0.0.1:${port}/am`;
  };
  if (failure === 'wrong password') {
    frodo.state.setPassword('wrong');
  } else if (failure === 'token endpoint answers 500') {
    frodo.state.setHost(await serve(true));
  } else if (failure === 'connection refused') {
    frodo.state.setHost(await serve(false));
  }
  return {
    repair() {
      broken = false;
      frodo.state.setPassword('password');
      frodo.state.setHost(goodHost);
    },
    close: async () => {
      for (const server of servers) {
        server.closeAllConnections();
        await new Promise<void>((done) => server.close(() => done()));
      }
    },
  };
}
