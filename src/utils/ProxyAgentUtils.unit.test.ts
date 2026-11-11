/**
 * Unit tests of the proxy agent of the library's HTTP layer (ProxyAgentUtils.ts).
 *
 * Run with:
 *
 *        npm run test:only -- src/utils/ProxyAgentUtils.unit.test.ts
 *
 * No sockets: the agent is asked which proxy it would use for a URL, and how it
 * writes itself. The requests that go through a real proxy are in
 * src/api/BaseApi.proxyErrors.serialization.test.ts.
 */
import type { ClientRequest } from 'http';
import util from 'util';
import { jest } from '@jest/globals';
import { ProxyAgent as LibraryProxyAgent } from 'proxy-agent';
import { ProxyAgent, proxyUrlWithoutUserinfo } from './ProxyAgentUtils';

const REQUEST = {} as ClientRequest;

/** The failure of the call, as the agent's caller sees it. */
async function rejectionOf(call: Promise<unknown>): Promise<any> {
  try {
    await call;
  } catch (error) {
    return error;
  }
  throw new Error('the call was expected to fail, and it succeeded');
}

describe('proxyUrlWithoutUserinfo', () => {
  test.each([
    ['http://user:made-up-pass@127.0.0.1:3128', 'http://127.0.0.1:3128'],
    ['http://user@127.0.0.1:3128', 'http://127.0.0.1:3128'],
    ['http://:made-up-pass@127.0.0.1:3128', 'http://127.0.0.1:3128'],
    [
      'http://user:made-up-pass@proxy.example.com:8080/path?q=1#fragment',
      'http://proxy.example.com:8080',
    ],
    [
      'https://user:made-up-pass@proxy.example.com',
      'https://proxy.example.com',
    ],
    // the default port of the scheme is left out by URL, as it is in a request
    [
      'https://user:made-up-pass@proxy.example.com:443',
      'https://proxy.example.com',
    ],
    ['http://user:made-up-pass@[::1]:3128', 'http://[::1]:3128'],
    ['socks5://user:made-up-pass@127.0.0.1:1080', 'socks5://127.0.0.1:1080'],
    ['foo://user:made-up-pass@127.0.0.1:3128', 'foo://127.0.0.1:3128'],
    ['http://127.0.0.1:3128', 'http://127.0.0.1:3128'],
  ])('%s is written as %s', (url, expected) => {
    expect(proxyUrlWithoutUserinfo(new URL(url))).toBe(expected);
  });
});

describe('ProxyAgent', () => {
  describe('how the agent is written', () => {
    test('JSON.stringify writes its name, alone and inside an object', () => {
      const agent = new ProxyAgent();
      expect(JSON.stringify(agent)).toBe('"[ProxyAgent]"');
      expect(JSON.stringify({ httpAgent: agent })).toBe(
        '{"httpAgent":"[ProxyAgent]"}'
      );
    });

    test('util.inspect writes its name, whatever the depth and with every property shown', () => {
      const agent = new ProxyAgent();
      expect(util.inspect(agent)).toBe('[ProxyAgent]');
      expect(util.inspect(agent, { depth: null, showHidden: true })).toBe(
        '[ProxyAgent]'
      );
      expect(util.inspect({ httpAgent: agent })).toBe(
        '{ httpAgent: [ProxyAgent] }'
      );
    });

    test('it still holds what it needs: it is a proxy-agent ProxyAgent with the options it was made with', () => {
      const agent = new ProxyAgent({ keepAlive: false, maxSockets: 7 });
      expect(agent).toBeInstanceOf(LibraryProxyAgent);
      expect(agent.connectOpts).toEqual({ keepAlive: false, maxSockets: 7 });
      expect(agent.cache).toBeDefined();
      expect(typeof agent.connect).toBe('function');
    });
  });

  describe('the proxy it chooses for a request', () => {
    test('is the one the environment names, with the semantics of proxy-from-env', async () => {
      const saved = new Map<string, string | undefined>();
      const names = [
        'HTTP_PROXY',
        'http_proxy',
        'HTTPS_PROXY',
        'https_proxy',
        'ALL_PROXY',
        'all_proxy',
        'NO_PROXY',
        'no_proxy',
      ];
      for (const name of names) {
        saved.set(name, process.env[name]);
        delete process.env[name];
      }
      try {
        const agent = new ProxyAgent();
        process.env.HTTP_PROXY = 'http://user:made-up-pass@127.0.0.1:3128';
        process.env.HTTPS_PROXY = 'http://127.0.0.1:3129';
        await expect(
          agent.getProxyForUrl('http://example.com/am', REQUEST)
        ).resolves.toBe('http://user:made-up-pass@127.0.0.1:3128');
        await expect(
          agent.getProxyForUrl('https://example.com/am', REQUEST)
        ).resolves.toBe('http://127.0.0.1:3129');

        // the lower case name wins over the upper case one
        process.env.http_proxy = 'http://127.0.0.1:3130';
        await expect(
          agent.getProxyForUrl('http://example.com/am', REQUEST)
        ).resolves.toBe('http://127.0.0.1:3130');

        // a host named in NO_PROXY is not proxied
        process.env.NO_PROXY = 'example.com';
        expect(
          await agent.getProxyForUrl('http://example.com/am', REQUEST)
        ).toBeFalsy();
        expect(
          await agent.getProxyForUrl('http://other.example.org/am', REQUEST)
        ).toBe('http://127.0.0.1:3130');
      } finally {
        for (const [name, value] of saved) {
          if (value === undefined) delete process.env[name];
          else process.env[name] = value;
        }
      }
    });

    test('is the one a function in the options returns, called with the URL and the request', async () => {
      const decide = jest.fn(async () => 'http://127.0.0.1:3128');
      const agent = new ProxyAgent({ getProxyForUrl: decide });

      await expect(
        agent.getProxyForUrl('http://example.com/am', REQUEST)
      ).resolves.toBe('http://127.0.0.1:3128');
      expect(decide).toHaveBeenCalledTimes(1);
      expect(decide).toHaveBeenCalledWith('http://example.com/am', REQUEST);
    });

    test('is asked as proxy-agent asks it: as a method of the agent', async () => {
      let receiver: unknown;
      const agent = new ProxyAgent({
        getProxyForUrl: function (this: unknown) {
          receiver = this;
          return 'http://127.0.0.1:3128';
        },
      });

      await agent.getProxyForUrl('http://example.com/am', REQUEST);

      expect(receiver).toBe(agent);
    });

    test.each(['', undefined])(
      'is none when the function returns %p: the request goes direct',
      async (answer) => {
        const agent = new ProxyAgent({
          getProxyForUrl: () => answer as unknown as string,
        });
        expect(
          await agent.getProxyForUrl('http://example.com/am', REQUEST)
        ).toBe(answer);
      }
    );

    test.each([
      'http',
      'https',
      'HTTP',
      'socks',
      'socks4',
      'socks4a',
      'socks5',
      'socks5h',
      'pac+data',
      'pac+file',
      'pac+ftp',
      'pac+http',
      'pac+https',
    ])(
      'a %s proxy URL is passed on as it is, with its credentials',
      async (scheme) => {
        const proxy = `${scheme}://user:made-up-pass@127.0.0.1:3128`;
        const agent = new ProxyAgent({ getProxyForUrl: () => proxy });
        await expect(
          agent.getProxyForUrl('http://example.com/am', REQUEST)
        ).resolves.toBe(proxy);
      }
    );

    test.each(['foo', 'ftp', 'socks6', 'ws', 'direct'])(
      'a %s proxy URL is refused, and the message holds the scheme, host and port only',
      async (scheme) => {
        const agent = new ProxyAgent({
          getProxyForUrl: () =>
            `${scheme}://user:made-up-pass@127.0.0.1:3128/path?q=1#fragment`,
        });
        const error = await rejectionOf(
          agent.getProxyForUrl('http://example.com/am', REQUEST)
        );
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe(
          `Unsupported protocol for proxy URL: ${scheme}://127.0.0.1:3128`
        );
        expect(Object.keys(error)).toEqual([]);
      }
    );

    test.each(['http://user:made-up-pass@', 'http://', 'not a url'])(
      'the URL %p cannot be parsed: it is refused, and the error does not keep it',
      async (proxy) => {
        const agent = new ProxyAgent({ getProxyForUrl: () => proxy });
        const error = await rejectionOf(
          agent.getProxyForUrl('http://example.com/am', REQUEST)
        );
        expect(error).toBeInstanceOf(TypeError);
        expect(error.message).toBe('Invalid proxy URL');
        // the TypeError of `new URL()` has the input as a property
        expect(Object.keys(error)).toEqual([]);
        expect(
          util.inspect(error, { depth: null, showHidden: true })
        ).not.toContain('made-up-pass');
      }
    );
  });
});
