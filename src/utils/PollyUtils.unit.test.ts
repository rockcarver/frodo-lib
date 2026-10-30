/**
 * Run tests
 *
 *        npm run test:only PollyUtils.unit
 *
 * Unit tests of the host handling of recordings: a recording made against any
 * tenant must replay against any host (decision record 0010), so every host in
 * a recorded URL, request header and response header becomes the default one.
 */
import { filterRecording, obfuscateHostsString } from './PollyUtils';

const DEFAULT_HOST = 'openam-frodo-dev.forgeblocks.com';

describe('obfuscateHostsString()', () => {
  test('0: Method is implemented', () => {
    expect(obfuscateHostsString).toBeDefined();
  });

  test('1: Replaces the host of a URL and keeps scheme, path and query', () => {
    expect(
      obfuscateHostsString('https://tenant.example.com/am/json?a=1&b=2', 'x.io')
    ).toBe('https://x.io/am/json?a=1&b=2');
  });

  test('2: Replaces the port together with the host', () => {
    expect(obfuscateHostsString('http://localhost:8080/am', 'x.io')).toBe(
      'http://x.io/am'
    );
  });

  test('3: Replaces every URL in a string', () => {
    expect(
      obfuscateHostsString(
        'see https://a.example.com/x and http://b.example.org/y',
        'x.io'
      )
    ).toBe('see https://x.io/x and http://x.io/y');
  });

  test('4: Stops at whitespace and at a closing bracket or parenthesis', () => {
    expect(
      obfuscateHostsString(
        '(https://a.example.com) [https://b.example.com]',
        'x.io'
      )
    ).toBe('(https://x.io) [https://x.io]');
  });

  test('5: Leaves a string without a URL unchanged', () => {
    expect(
      obfuscateHostsString('no url here, just host.example.com', 'x.io')
    ).toBe('no url here, just host.example.com');
  });
});

describe('filterRecording() hosts', () => {
  function entry() {
    return {
      request: {
        url: 'https://my-tenant.forgeblocks.com/environment/release',
        headers: [
          { name: 'host', value: 'my-tenant.forgeblocks.com' },
          { name: 'referer', value: 'https://my-tenant.forgeblocks.com/login' },
          { name: 'accept', value: 'application/json' },
        ],
      },
      response: {
        headers: [
          { name: 'location', value: 'https://my-tenant.forgeblocks.com/next' },
          { name: 'content-type', value: 'application/json' },
        ],
      },
    } as any;
  }

  test('1: Makes the URL and the request and response headers use the default host', () => {
    const recording = entry();
    filterRecording(recording);
    expect(recording.request.url).toBe(
      `https://${DEFAULT_HOST}/environment/release`
    );
    expect(recording.request.headers).toEqual([
      { name: 'host', value: DEFAULT_HOST },
      { name: 'referer', value: `https://${DEFAULT_HOST}/login` },
      { name: 'accept', value: 'application/json' },
    ]);
    expect(recording.response.headers).toEqual([
      { name: 'location', value: `https://${DEFAULT_HOST}/next` },
      { name: 'content-type', value: 'application/json' },
    ]);
  });

  test('2: Keeps the hosts when asked not to use the default host', () => {
    const recording = entry();
    filterRecording(recording, false);
    expect(recording.request.url).toBe(
      'https://my-tenant.forgeblocks.com/environment/release'
    );
    expect(recording.request.headers[1].value).toBe(
      'https://my-tenant.forgeblocks.com/login'
    );
    expect(recording.response.headers[0].value).toBe(
      'https://my-tenant.forgeblocks.com/next'
    );
  });

  test('3: Filters every entry of a HAR document', () => {
    const har = { log: { entries: [entry(), entry()] } } as any;
    filterRecording(har);
    for (const e of har.log.entries) {
      expect(e.request.url).toContain(DEFAULT_HOST);
      expect(e.response.headers[0].value).toContain(DEFAULT_HOST);
    }
  });
});
