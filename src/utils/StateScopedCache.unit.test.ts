/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent StateScopedCache
 */
import '../index';
import FrodoLib from '../lib/FrodoLib';
import { createStateScopedCache } from './StateScopedCache';

const stateOf = (host: string) => FrodoLib({ host }).state;

describe('StateScopedCache', () => {
  test('1: a value is kept for the state that set it and for no other state', () => {
    const cache = createStateScopedCache<string>();
    const a = stateOf('https://a.example.com/am');
    const b = stateOf('https://a.example.com/am');

    cache.set(a, 'alpha_user', 'a');

    expect(cache.get(a, 'alpha_user')).toBe('a');
    expect(cache.get(b, 'alpha_user')).toBeUndefined();
  });

  test('2: two caches do not share their values', () => {
    const one = createStateScopedCache<string>();
    const two = createStateScopedCache<string>();
    const a = stateOf('https://a.example.com/am');

    one.set(a, 'alpha_user', 'one');

    expect(two.get(a, 'alpha_user')).toBeUndefined();
  });

  test('3: delete drops the value of that state and keeps the value of another', () => {
    const cache = createStateScopedCache<string>();
    const a = stateOf('https://a.example.com/am');
    const b = stateOf('https://a.example.com/am');
    cache.set(a, 'alpha_user', 'a');
    cache.set(b, 'alpha_user', 'b');

    cache.delete(a, 'alpha_user');

    expect(cache.get(a, 'alpha_user')).toBeUndefined();
    expect(cache.get(b, 'alpha_user')).toBe('b');
  });

  test('4: a state that is pointed at another host starts with nothing, and does not get the old values back', () => {
    const cache = createStateScopedCache<string>();
    const a = stateOf('https://a.example.com/am');
    cache.set(a, 'alpha_user', 'a');

    a.setHost('https://b.example.com/am');
    expect(cache.get(a, 'alpha_user')).toBeUndefined();
    cache.set(a, 'alpha_user', 'b');

    a.setHost('https://a.example.com/am');
    expect(cache.get(a, 'alpha_user')).toBeUndefined();
  });

  test('5: the IDM host decides as well: another IDM host with the same AM host starts with nothing', () => {
    const cache = createStateScopedCache<string>();
    const a = stateOf('https://a.example.com/am');
    cache.set(a, 'alpha_user', 'a');

    a.setIdmHost('https://idm.example.com/openidm');

    expect(cache.get(a, 'alpha_user')).toBeUndefined();
  });

  test('6: a key that is also a property of every object is a key like any other', () => {
    const cache = createStateScopedCache<string>();
    const a = stateOf('https://a.example.com/am');

    expect(cache.get(a, 'constructor')).toBeUndefined();
    expect(cache.get(a, '__proto__')).toBeUndefined();
    cache.set(a, 'constructor', 'kept');
    expect(cache.get(a, 'constructor')).toBe('kept');
  });
});
