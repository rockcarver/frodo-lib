/**
 * The stable identity of an error condition (`FrodoError.code`): what it is
 * for, what carries it, and that every code is thrown by the library.
 *
 * Unit test, no recording: nothing here talks to a server.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AxiosError } from 'axios';
import { FRODO_ERROR_CODES, FrodoError } from './FrodoError';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('FrodoError.code', () => {
  test('1: An error has no code unless one is given', () => {
    expect(new FrodoError('plain').code).toBeUndefined();
    expect(new FrodoError('wrapper', new Error('inner')).code).toBeUndefined();
  });

  test('2: The code is the third argument, after the wrapped errors', () => {
    const error = new FrodoError(
      'No valid cached browser-login session exists for this host.',
      null,
      'BROWSER_LOGIN_NO_SESSION'
    );
    expect(error.code).toBe('BROWSER_LOGIN_NO_SESSION');
    expect(error.originalErrors).toEqual([]);
    expect(error.name).toBe('FrodoError');
  });

  test('3: The code does not change the message', () => {
    const error = new FrodoError('the facts', null, 'LOGIN_NO_STORED_PASSWORD');
    expect(error.message).toBe('the facts');
    expect(error.getCombinedMessage()).toBe('the facts');
    expect(error.toString()).toBe('the facts');
  });

  test('4: A wrapper does not copy the code of the error it wraps', () => {
    const inner = new FrodoError('inner', null, 'BROWSER_LOGIN_NO_SESSION');
    const outer = new FrodoError('Error getting tokens', inner);
    expect(outer.code).toBeUndefined();
    expect(outer.originalErrors[0]).toBe(inner);
  });

  test('5: The code of a wrapped FrodoError is not taken for the http code of the wrapper', () => {
    const inner = new FrodoError('inner', null, 'BROWSER_LOGIN_NO_SESSION');
    const outer = new FrodoError('Error getting tokens', inner);
    expect(outer.httpCode).toBeUndefined();
  });

  test('6: The code of a transport error is still the http code of the wrapper', () => {
    const inner = new AxiosError('connect failed', 'ECONNREFUSED');
    const outer = new FrodoError('Error getting tokens', inner);
    expect(outer.httpCode).toBe('ECONNREFUSED');
    expect(outer.code).toBeUndefined();
  });

  describe('a transport error that reports a proxy failure', () => {
    const failure = {
      code: 'PROXY_TUNNEL_REFUSED',
      proxy: { protocol: 'http', host: '127.0.0.1', port: 3128 },
      target: 'https',
      status: 403,
      message:
        'The proxy 127.0.0.1:3128 refused the CONNECT request for an HTTPS target with status 403 (Forbidden).',
    };
    const refused = () =>
      Object.assign(new AxiosError('Request failed with status code 403'), {
        proxyFailure: failure,
      });

    test('6a: The FrodoError that wraps it carries the code of the failure, and the http code stays the transport one', () => {
      const outer = new FrodoError('Error getting server info', refused());
      expect(outer.code).toBe('PROXY_TUNNEL_REFUSED');
      expect(outer.originalErrors[0]).toHaveProperty('proxyFailure', failure);
    });

    test('6b: A code that is given wins over the code of the failure', () => {
      const outer = new FrodoError(
        'Error getting tokens',
        refused(),
        'LOGIN_NO_STORED_PASSWORD'
      );
      expect(outer.code).toBe('LOGIN_NO_STORED_PASSWORD');
    });

    test('6c: A wrapper of a FrodoError still does not copy the code: the one that wraps the transport error has it', () => {
      const inner = new FrodoError('Error getting server info', refused());
      const outer = new FrodoError('Error getting tokens', inner);
      expect(inner.code).toBe('PROXY_TUNNEL_REFUSED');
      expect(outer.code).toBeUndefined();
    });

    test('6d: A failure with a code that is not listed is not taken', () => {
      const unknown = Object.assign(new AxiosError('x'), {
        proxyFailure: { ...failure, code: 'NOT_A_CODE' },
      });
      expect(new FrodoError('x', unknown).code).toBeUndefined();
    });

    test('6e: The facts are printed under the network error, once', () => {
      const text = new FrodoError(
        'Error getting server info',
        refused()
      ).getCombinedMessage();
      expect(text.split(failure.message)).toHaveLength(2);
      expect(text.indexOf('Network error')).toBeLessThan(
        text.indexOf(failure.message)
      );
    });

    test('6f: The first of several errors that carries a failure gives the code', () => {
      const plain = new Error('plain');
      const second = Object.assign(new AxiosError('y'), {
        proxyFailure: { ...failure, code: 'PROXY_UNREACHABLE' },
      });
      const outer = new FrodoError('x', [plain, refused(), second]);
      expect(outer.code).toBe('PROXY_TUNNEL_REFUSED');
    });
  });

  test('7: A caller can list every code', () => {
    expect(FrodoError.codes).toEqual(FRODO_ERROR_CODES);
    expect(FrodoError.codes.length).toBeGreaterThan(0);
  });

  test('8: Codes are upper-case words, each once', () => {
    for (const code of FRODO_ERROR_CODES) {
      expect(code).toMatch(/^[A-Z]+(_[A-Z]+)*$/);
    }
    expect(new Set(FRODO_ERROR_CODES).size).toBe(FRODO_ERROR_CODES.length);
  });

  test('9: Every code is thrown by the library, and none is thrown that is not listed', () => {
    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name))
          sources.push(fs.readFileSync(full, 'utf8'));
      }
    };
    walk(path.resolve(__dirname, '..'));
    // the third argument of `new FrodoError(message, originalErrors, 'CODE')`,
    // or the code of a proxy failure that a request reports (ProxyFailureUtils)
    const thrown = sources.flatMap((source) => [
      ...[...source.matchAll(/,\s+null,\s+'([A-Z]+(?:_[A-Z]+)+)'\s+\)/g)].map(
        (match) => match[1]
      ),
      ...[...source.matchAll(/\bmake\(\s*'(PROXY_[A-Z]+(?:_[A-Z]+)*)'/g)].map(
        (match) => match[1]
      ),
    ]);
    expect([...new Set(thrown)].sort()).toEqual([...FRODO_ERROR_CODES].sort());
  });
});
