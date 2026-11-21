/**
 * Run tests
 *
 *        npm run test:only ErrorSerialization.login.unit
 *
 * The login of a user with a name and a password sends them in the headers
 * `X-OpenAM-Username` and `X-OpenAM-Password` of its first request. When the
 * server refuses that request, the error that the login raises is written (JSON,
 * inspect, console) as a view, and the value of the password is nowhere in it.
 *
 * The requests go to a server on the loopback interface in this process, with
 * made-up values.
 */
import http from 'http';
import { AddressInfo } from 'net';
import { inspect } from 'util';
import FrodoLib from '../lib/FrodoLib';
import { allForms, MARKER_C } from '../test/utils/SerializationForms';

type Seen = { method: string; url: string; headers: http.IncomingHttpHeaders };

let server: http.Server;
let origin: string;
const seen: Seen[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      seen.push({
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
      });
      res.writeHead(/\/authenticate/.test(req.url ?? '') ? 401 : 200, {
        'content-type': 'application/json',
      });
      res.end(
        JSON.stringify(
          /\/authenticate/.test(req.url ?? '')
            ? {
                code: 401,
                reason: 'Unauthorized',
                message: 'Authentication Failed',
              }
            : { cookieName: 'iPlanetDirectoryPro', domains: [] }
        )
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  seen.length = 0;
});

describe('the login of a user with a name and a password that the server refuses', () => {
  test('1: the first request carries the name and the password in headers', async () => {
    const frodo = FrodoLib({ host: `${origin}/am`, deploymentType: 'classic' });
    frodo.state.setUseTokenCache(false);
    frodo.state.setUsername('admin');
    frodo.state.setPassword(MARKER_C);

    await frodo.login.getTokens(false, false).catch(() => undefined);

    const login = seen.find((request) => /\/authenticate/.test(request.url));
    expect(login?.headers['x-openam-username']).toBe('admin');
    expect(login?.headers['x-openam-password']).toBe(MARKER_C);
  });

  test('2: the error of the login does not write the password in any form', async () => {
    const frodo = FrodoLib({ host: `${origin}/am`, deploymentType: 'classic' });
    frodo.state.setUseTokenCache(false);
    frodo.state.setUsername('admin');
    frodo.state.setPassword(MARKER_C);

    const error = await frodo.login.getTokens(false, false).then(
      () => undefined,
      (caught: unknown) => caught
    );

    expect(error).toBeDefined();
    for (const [form, text] of Object.entries(allForms(error))) {
      if (text.includes(MARKER_C)) {
        throw new Error(`the password is in the form '${form}':\n${text}`);
      }
    }
    expect(inspect(error, { depth: null, showHidden: true })).not.toContain(
      MARKER_C
    );
    // the error says that the login was refused, and which header carried the value
    const written = JSON.stringify(error);
    expect(written).toContain('401');
    expect(written).toContain('X-OpenAM-Password');
    expect(written).toContain('<redacted>');
  });
});
