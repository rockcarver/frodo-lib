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
    // the third argument of `new FrodoError(message, originalErrors, 'CODE')`
    const thrown = sources.flatMap((source) =>
      [...source.matchAll(/,\s+null,\s+'([A-Z]+(?:_[A-Z]+)+)'\s+\)/g)].map(
        (match) => match[1]
      )
    );
    expect([...new Set(thrown)].sort()).toEqual([...FRODO_ERROR_CODES].sort());
  });
});
