/**
 * Run tests
 *
 *        npm run test:only ResultCollector.unit
 *
 * The collecting result callback of the MCP runtime (frodo-lib#957): what it
 * records of the items a bulk function reports, and that it never throws.
 * Unit test: no recordings, no tenant.
 */
import { jest } from '@jest/globals';
import { FrodoError } from '../ops/FrodoError';
import { InsufficientScopeError } from '../ops/RequiredScopesOps';
import {
  createResultCollector,
  MAX_FAILURE_MESSAGE_LENGTH,
  MAX_ITEM_LABEL_LENGTH,
  MAX_RECORDED_FAILURES,
  placeResultCallback,
  redactCredentials,
} from './ResultCollector';

/** An error as `getResult` builds it for a credential that lacks a scope. */
function scopeError(item = 'Workflows'): FrodoError {
  const missing = new InsufficientScopeError(
    "This operation requires scope(s) [fr:iga:*], which the current session's token does not carry (granted: [fr:idm:*]).",
    null,
    'INSUFFICIENT_SCOPE'
  );
  return new FrodoError(
    `Error Exporting ${item}`,
    new FrodoError(`Error reading ${item.toLowerCase()}`, missing),
    'INSUFFICIENT_SCOPE'
  );
}

describe('createResultCollector', () => {
  test('1: no item reported: no results', () => {
    expect(createResultCollector().results()).toBeUndefined();
  });

  test('2: only successes: no results, so the tool result stays as it was', () => {
    const collector = createResultCollector();
    collector.callback(undefined, { _id: 'one' });
    collector.callback(undefined, { _id: 'two' });
    collector.callback(undefined, false);
    expect(collector.results()).toBeUndefined();
  });

  test('3: failures are recorded in the order they were reported, successes are counted', () => {
    const collector = createResultCollector();
    collector.callback(undefined, { _id: 'one' });
    collector.callback(new FrodoError('Error importing journey Second'));
    collector.callback(undefined, { _id: 'three' });
    collector.callback(new FrodoError('Error importing journey First'));
    collector.callback(new Error('plain error'));

    const results = collector.results();
    expect(results?.succeededCount).toBe(2);
    expect(results?.failedCount).toBe(3);
    expect(results?.failures.map((failure) => failure.message)).toEqual([
      'Error importing journey Second',
      'Error importing journey First',
      'plain error',
    ]);
    expect(results?.omittedFailureCount).toBeUndefined();
  });

  test('4: a failure carries the code of the condition, here INSUFFICIENT_SCOPE', () => {
    const collector = createResultCollector();
    collector.callback(scopeError());
    expect(collector.results()?.failures[0]).toMatchObject({
      code: 'INSUFFICIENT_SCOPE',
      item: 'Workflows',
    });
  });

  test('5: the message is the combined message of the nested errors, without a stack', () => {
    const collector = createResultCollector();
    const error = scopeError('Request Types');
    collector.callback(error);

    const { message } = collector.results()?.failures[0] ?? { message: '' };
    expect(message).toBe(error.getCombinedMessage());
    expect(message).toContain('Error Exporting Request Types');
    expect(message).toContain('Error reading request types');
    expect(message).toContain('requires scope(s) [fr:iga:*]');
    expect(message).not.toMatch(/\n\s+at /);
    expect(message).not.toContain('ResultCollector.unit.test');
    expect(message).not.toContain(error.stack ?? '<none>');
  });

  test('6: the code of an error nested in the reported one is found, the code of a transport error is not mistaken for one', () => {
    const collector = createResultCollector();
    collector.callback(
      new FrodoError(
        'Error importing journey Wrapped',
        new FrodoError(
          'Error writing node',
          new InsufficientScopeError('no scope', null, 'INSUFFICIENT_SCOPE')
        )
      )
    );
    const axiosLike = Object.assign(new Error('socket hang up'), {
      name: 'AxiosError',
      code: 'ECONNRESET',
    });
    collector.callback(axiosLike);
    collector.callback(new FrodoError('Error reading agent', axiosLike));
    collector.callback(
      Object.assign(new Error('forged'), { code: 'INSUFFICIENT_SCOPE' })
    );
    // a code that the library does not define is not reported either
    collector.callback(
      new FrodoError('Error with a made-up code', null, 'NOT_A_CODE' as any)
    );

    const { failures } = collector.results() ?? { failures: [] };
    expect(failures[0].code).toBe('INSUFFICIENT_SCOPE');
    expect(failures[1].code).toBeUndefined();
    expect(failures[2].code).toBeUndefined();
    // a plain error is not a FrodoError: its code is not one of the library's
    expect(failures[3].code).toBeUndefined();
    expect(failures[4].code).toBeUndefined();
  });

  test.each([
    ['Error Exporting Mappings', 'Mappings'],
    [
      'Error importing the alpha realm journey Broken',
      'alpha realm journey Broken',
    ],
    [
      "Error deleting mapping 'sourceManagedUser_systemLdapAccounts'",
      'mapping sourceManagedUser_systemLdapAccounts',
    ],
    ['Error importing journey Login: 3 validation errors', 'journey Login'],
    ['Failed to delete agent Gateway', 'agent Gateway'],
    ['Error Importing ESV Secrets\n  Error reading secrets', 'ESV Secrets'],
  ])('7: the item named by %j is %j', (message, item) => {
    const collector = createResultCollector();
    collector.callback(new FrodoError(message));
    expect(collector.results()?.failures[0].item).toBe(item);
  });

  test.each([
    'Journey Needy requires Ghost, which is not installed',
    'This operation requires scope(s) [fr:iga:*]',
    'Error',
    'Error exporting',
    '',
  ])('8: a message that names no item has no item label: %j', (message) => {
    const collector = createResultCollector();
    collector.callback(new FrodoError(message));
    expect(collector.results()?.failures[0].item).toBeUndefined();
  });

  test('9: only the first line of the message names the item', () => {
    const collector = createResultCollector();
    collector.callback(
      new FrodoError('Something failed\nError exporting Hidden')
    );
    expect(collector.results()?.failures[0].item).toBeUndefined();
  });

  describe('limits', () => {
    test('10: the number of recorded failures is capped, all are counted and the rest is reported as omitted', () => {
      const collector = createResultCollector();
      const total = MAX_RECORDED_FAILURES + 70;
      for (let i = 0; i < total; i++) {
        collector.callback(new FrodoError(`Error importing journey J${i}`));
      }
      collector.callback(undefined, { _id: 'fine' });

      const results = collector.results();
      expect(MAX_RECORDED_FAILURES).toBe(50);
      expect(results?.failures).toHaveLength(MAX_RECORDED_FAILURES);
      expect(results?.failedCount).toBe(total);
      expect(results?.omittedFailureCount).toBe(70);
      expect(results?.succeededCount).toBe(1);
      // the first ones are kept, in order
      expect(results?.failures[0].message).toBe('Error importing journey J0');
      expect(results?.failures[49].message).toBe('Error importing journey J49');
    });

    test('11: exactly the cap: nothing is omitted and no omitted count is reported', () => {
      const collector = createResultCollector();
      for (let i = 0; i < MAX_RECORDED_FAILURES; i++) {
        collector.callback(new FrodoError(`Error ${i}`));
      }
      const results = collector.results();
      expect(results?.failures).toHaveLength(MAX_RECORDED_FAILURES);
      expect(results?.omittedFailureCount).toBeUndefined();
      expect('omittedFailureCount' in (results ?? {})).toBe(false);
    });

    test('12: the size of a message and of a label is capped', () => {
      const collector = createResultCollector();
      collector.callback(new FrodoError(`Error importing ${'x'.repeat(5000)}`));
      const [failure] = collector.results()?.failures ?? [];
      expect(MAX_FAILURE_MESSAGE_LENGTH).toBe(1000);
      expect(failure.message).toHaveLength(MAX_FAILURE_MESSAGE_LENGTH);
      expect(failure.message.endsWith('...')).toBe(true);
      expect(failure.item?.length).toBeLessThanOrEqual(MAX_ITEM_LABEL_LENGTH);
      expect(failure.item?.endsWith('...')).toBe(true);
    });

    test('13: a message of many megabytes is cut without being searched through', () => {
      const collector = createResultCollector();
      const started = Date.now();
      collector.callback(new Error(`Bearer ${'a'.repeat(8_000_000)}`));
      collector.callback(new Error('x'.repeat(8_000_000)));
      const failures = collector.results()?.failures ?? [];
      expect(Date.now() - started).toBeLessThan(2000);
      expect(failures[0].message.length).toBeLessThanOrEqual(1000);
      expect(failures[1].message.length).toBeLessThanOrEqual(1000);
    });

    test('14: the limits can be lowered', () => {
      const collector = createResultCollector({
        maxFailures: 2,
        maxMessageLength: 10,
        maxItemLabelLength: 5,
      });
      for (const name of ['one', 'two', 'three']) {
        collector.callback(
          new FrodoError(`Error importing ${name}-abcdefghij`)
        );
      }
      const results = collector.results();
      expect(results?.failures).toHaveLength(2);
      expect(results?.omittedFailureCount).toBe(1);
      expect(results?.failures[0].message).toBe('Error i...');
      expect(results?.failures[0].item).toBe('on...');
    });
  });

  describe('never throws', () => {
    const hostile: [string, unknown][] = [
      ['null error with a result', null],
      ['a string', 'plain text'],
      ['a number', 42],
      ['an object without prototype', Object.create(null)],
      ['a symbol', Symbol('boom')],
      [
        'an object whose toString throws',
        {
          toString: () => {
            throw new Error('toString');
          },
        },
      ],
      [
        'an error whose message getter throws',
        Object.defineProperty(new Error('x'), 'message', {
          get() {
            throw new Error('message');
          },
        }),
      ],
      [
        'a FrodoError whose getCombinedMessage throws',
        Object.assign(new FrodoError('x'), {
          getCombinedMessage() {
            throw new Error('combined');
          },
        }),
      ],
      [
        'a FrodoError whose getCombinedMessage returns not a string',
        Object.assign(new FrodoError('x'), { getCombinedMessage: () => 42 }),
      ],
      [
        'a FrodoError whose code getter throws',
        Object.defineProperty(new FrodoError('x'), 'code', {
          get() {
            throw new Error('code');
          },
        }),
      ],
      [
        'a FrodoError whose originalErrors getter throws',
        Object.defineProperty(new FrodoError('x'), 'originalErrors', {
          get() {
            throw new Error('causes');
          },
        }),
      ],
    ];

    test.each(hostile)('15: %s', (_name, error) => {
      const collector = createResultCollector();
      expect(() =>
        collector.callback(error as FrodoError, 'result')
      ).not.toThrow();
      expect(() => collector.callback(error as FrodoError)).not.toThrow();
      expect(() => collector.results()).not.toThrow();
      // a truthy value is a failure, and is counted whatever it is
      const results = collector.results();
      if (error) {
        expect(results?.failedCount).toBe(2);
        expect(typeof results?.failures[0].message).toBe('string');
      } else {
        expect(results).toBeUndefined();
      }
    });

    test('16: a cycle of nested errors ends, and a deep chain is searched only so far', () => {
      const first = new FrodoError('first');
      const second = new FrodoError('second', first);
      first.originalErrors.push(second);
      const collector = createResultCollector();
      expect(() => collector.callback(first)).not.toThrow();
      expect(collector.results()?.failures[0].code).toBeUndefined();

      // the code at the bottom of a chain longer than the search is not found, and nothing throws
      let deep: FrodoError = new FrodoError(
        'bottom',
        null,
        'INSUFFICIENT_SCOPE'
      );
      for (let i = 0; i < 50; i++) deep = new FrodoError(`level ${i}`, deep);
      expect(() => collector.callback(deep)).not.toThrow();
      expect(collector.results()?.failures[1].code).toBeUndefined();
    });

    test('16b: nothing that goes wrong while a failure is described reaches the function that reported it', () => {
      const collector = createResultCollector();
      const trim = jest
        .spyOn(String.prototype, 'trim')
        .mockImplementation(() => {
          throw new Error('trim');
        });
      let thrown: unknown;
      try {
        collector.callback(new FrodoError('Error importing journey Login'));
      } catch (error) {
        thrown = error;
      } finally {
        trim.mockRestore();
      }
      expect(thrown).toBeUndefined();
      // the failure is counted, and reported as one that is not listed
      expect(collector.results()).toEqual({
        succeededCount: 0,
        failedCount: 1,
        failures: [],
        omittedFailureCount: 1,
      });
    });

    test('17: a callback that is called after the results were read does not change them', () => {
      const collector = createResultCollector();
      collector.callback(new FrodoError('first'));
      const before = collector.results();
      collector.callback(new FrodoError('late'));
      expect(before?.failures).toHaveLength(1);
      expect(before?.failedCount).toBe(1);
      expect(collector.results()?.failedCount).toBe(2);
    });

    test('18: the results can be changed by the reader without changing the collector', () => {
      const collector = createResultCollector();
      collector.callback(new FrodoError('first'));
      const results = collector.results();
      results?.failures.push({ message: 'forged' });
      if (results?.failures[0]) results.failures[0].message = 'changed';
      expect(collector.results()?.failures).toEqual([{ message: 'first' }]);
    });
  });
});

describe('credentials in a message', () => {
  const failureOf = (message: string) => {
    const collector = createResultCollector();
    collector.callback(new FrodoError(message));
    return collector.results()?.failures[0].message ?? '';
  };

  const sampleJwt =
    'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJkZW1vLXVzZXIifQ.c2lnbmF0dXJlLWRlbW8';

  test.each([
    [
      'a bearer token',
      'Request failed: Bearer abcdefgh12345678ijkl',
      'abcdefgh12345678ijkl',
    ],
    ['a json web token', `token ${sampleJwt} was rejected`, sampleJwt],
    [
      'an authorization header',
      'Authorization: Bearer demo-token-value-0001',
      'demo-token-value-0001',
    ],
    [
      'a basic authorization header',
      'authorization: Basic ZGVtbzpkZW1v',
      'ZGVtbzpkZW1v',
    ],
    [
      'a cookie header',
      'cookie: iPlanetDirectoryPro=demo-session-id',
      'demo-session-id',
    ],
    [
      'a password in a form body',
      'POST failed grant_type=password&password=hunter2&client_id=x',
      'hunter2',
    ],
    [
      'a client secret in a query',
      'GET /token?client_secret=demo-secret-value&scope=a',
      'demo-secret-value',
    ],
    [
      'a password in json',
      'body {"userName":"demo","password":"hunter2"}',
      'hunter2',
    ],
    [
      'an access token in json',
      "body {'access_token': 'demo-access-token'}",
      'demo-access-token',
    ],
    [
      'the password of a url',
      'connect https://demo-user:hunter2@host.example.com/am failed',
      'hunter2',
    ],
    [
      'a private key',
      '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq\n-----END PRIVATE KEY-----',
      'MIIEvQIBADANBgkq',
    ],
    [
      'an rsa private key without its end line',
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA',
      'MIIEowIBAAKCAQEA',
    ],
    [
      'a refresh token',
      'refresh_token: demo-refresh-token',
      'demo-refresh-token',
    ],
  ])('19: %s is replaced', (_name, message, credential) => {
    const recorded = failureOf(message);
    expect(recorded).not.toContain(credential);
    expect(recorded).toContain('<redacted>');
  });

  test('20: what is not a credential is kept, also near a credential name', () => {
    const message =
      "Error Exporting ESV Secrets\n  Error reading secrets\n    This operation requires scope(s) [fr:idc:esv:read], which the current session's token does not carry (granted: [fr:idm:*]).\n    Network error:\n      URL: https://openam-demo.example.com/environment/secrets?_pageSize=100\n      Status: 403";
    expect(failureOf(message)).toBe(message);
  });

  test('21: redactCredentials keeps the scheme of a bearer token and the name of a field', () => {
    expect(redactCredentials('Authorization: Bearer abcdefgh12345678')).toBe(
      'Authorization: <redacted>'
    );
    expect(redactCredentials('Bearer abcdefgh12345678')).toBe(
      'Bearer <redacted>'
    );
    expect(redactCredentials('a=1&password=x&b=2')).toBe(
      'a=1&password=<redacted>&b=2'
    );
    expect(redactCredentials('https://u:p@h.example.com/x')).toBe(
      'https://u:<redacted>@h.example.com/x'
    );
  });

  test('22: a credential in the cause of the error is replaced too', () => {
    const collector = createResultCollector();
    collector.callback(
      new FrodoError(
        'Error importing agent',
        new Error(
          'refused: password=hunter2 for https://x:topsecret@h.example.com'
        )
      )
    );
    const { message } = collector.results()?.failures[0] ?? { message: '' };
    expect(message).toContain('Error importing agent');
    expect(message).not.toContain('hunter2');
    expect(message).not.toContain('topsecret');
  });
});

describe('placeResultCallback', () => {
  const callback = () => undefined;

  test('23: puts the callback at its position, after the arguments that were given', () => {
    expect(placeResultCallback(['a'], 1, callback)).toEqual(['a', callback]);
  });

  test('24: fills the gap before the position with undefined', () => {
    const placed = placeResultCallback([], 3, callback);
    expect(placed).toHaveLength(4);
    expect(placed.slice(0, 3)).toEqual([undefined, undefined, undefined]);
    expect(Object.keys(placed)).toEqual(['0', '1', '2', '3']);
    expect(placed[3]).toBe(callback);
  });

  test.each([[undefined], [null], [{}], ['x'], [0], [false]])(
    '25: replaces %p, which an MCP payload put there and is not a function',
    (value) => {
      expect(placeResultCallback([value], 0, callback)[0]).toBe(callback);
    }
  );

  test('26: keeps a function that a host passed in process', () => {
    const own = () => undefined;
    expect(placeResultCallback(['a', own], 1, callback)[1]).toBe(own);
  });

  test('27: leaves the other arguments where they are, also after the position', () => {
    expect(
      placeResultCallback([{ a: 1 }, undefined, 'filter'], 1, callback)
    ).toEqual([{ a: 1 }, callback, 'filter']);
  });

  test('28: does not change the arguments it is given', () => {
    const args = ['a'];
    placeResultCallback(args, 2, callback);
    expect(args).toEqual(['a']);
  });
});
