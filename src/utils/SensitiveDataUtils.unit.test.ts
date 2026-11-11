/**
 * Run tests
 *
 *        npm run test:only SensitiveDataUtils.unit
 *
 * The shared lists of sensitive header and field names and the functions that
 * make a printed copy of a header or a body safe. Used by the curl lines of
 * `curlirize` (api/BaseApi.ts) and by the recording filter (utils/PollyUtils.ts).
 */
import { filterRecording } from './PollyUtils';
import {
  isSensitiveFieldName,
  isSensitiveHeaderName,
  redactBody,
  REDACTED,
  redactHeaderValue,
  SENSITIVE_FIELD_NAMES,
  SENSITIVE_HEADER_NAMES,
} from './SensitiveDataUtils';

describe('the lists', () => {
  test('1: the lists are lower case, without duplicates', () => {
    for (const list of [SENSITIVE_HEADER_NAMES, SENSITIVE_FIELD_NAMES]) {
      expect(list.map((name) => name.toLowerCase())).toEqual([...list]);
      expect(new Set(list).size).toBe(list.length);
    }
  });

  test.each([
    'Authorization',
    'AUTHORIZATION',
    'Proxy-Authorization',
    'Cookie',
    'Set-Cookie',
    'X-OpenAM-Password',
    'X-OpenIDM-Password',
    'X-API-Key',
    'x-api-secret',
    'Api-Key',
    'Ocp-Apim-Subscription-Key',
    'X-Auth-Token',
    'iPlanetDirectoryPro',
  ])('2: %s is a sensitive header, in any case', (name) => {
    expect(isSensitiveHeaderName(name)).toBe(true);
    expect(isSensitiveHeaderName(name.toLowerCase())).toBe(true);
    expect(isSensitiveHeaderName(name.toUpperCase())).toBe(true);
  });

  test.each([
    'Content-Type',
    'Accept',
    'Accept-API-Version',
    'User-Agent',
    'X-ForgeRock-TransactionId',
    'X-OpenAM-Username',
    'Host',
    'X-Xsrf-Header',
  ])('3: %s is not a sensitive header', (name) => {
    expect(isSensitiveHeaderName(name)).toBe(false);
  });

  test('4: extra names, for example the header overrides, are sensitive too, in any case', () => {
    expect(isSensitiveHeaderName('X-Gateway-Key', ['x-gateway-KEY'])).toBe(
      true
    );
    expect(isSensitiveHeaderName('X-Gateway-Key', ['X-Other'])).toBe(false);
    expect(isSensitiveHeaderName('X-Gateway-Key')).toBe(false);
  });

  test.each([
    'password',
    'Password',
    'userPassword',
    'userpassword',
    'client_secret',
    'clientSecret',
    'assertion',
    'access_token',
    'id_token',
    'refresh_token',
    'tokenId',
    'accessKey',
    'code_verifier',
    'valueBase64',
    'csrf',
  ])('5: %s is a sensitive field', (name) => {
    expect(isSensitiveFieldName(name)).toBe(true);
  });

  test.each(['userName', 'clientId', 'client_id', 'code', 'scope', 'realm'])(
    '6: %s is not a sensitive field',
    (name) => {
      expect(isSensitiveFieldName(name)).toBe(false);
    }
  );

  // the recording filter masks these on its own, with its own placeholders;
  // what it masks, the shared lists know
  test('7: every header and field the recording filter masks is on the shared lists', () => {
    for (const name of [
      'X-OpenAM-Password',
      'Authorization',
      'X-API-Key',
      'X-API-Secret',
      'Cookie',
      'Set-Cookie',
    ]) {
      expect(isSensitiveHeaderName(name)).toBe(true);
    }
    for (const name of [
      'access_token',
      'id_token',
      'tokenId',
      'accessKey',
      'assertion',
    ]) {
      expect(isSensitiveFieldName(name)).toBe(true);
    }
  });
});

describe('redactHeaderValue()', () => {
  test.each([
    ['Authorization', 'Bearer abc.def', 'Bearer <redacted>'],
    ['authorization', 'bearer abc.def', 'bearer <redacted>'],
    ['Authorization', 'Basic dXNlcjpwdw==', 'Basic <redacted>'],
    ['Authorization', 'DPoP abc', 'DPoP <redacted>'],
    ['Proxy-Authorization', 'Basic dXNlcjpwdw==', 'Basic <redacted>'],
    // a value that is no scheme and a credential is not guessed at
    ['Authorization', 'my secret value', '<redacted>'],
    ['Authorization', 'abc.def', '<redacted>'],
    ['Authorization', 'Bearer', '<redacted>'],
    ['Cookie', 'iPlanetDirectoryPro=abc', 'iPlanetDirectoryPro=<redacted>'],
    ['COOKIE', 'a=1; b=2;c=3', 'a=<redacted>; b=<redacted>; c=<redacted>'],
    ['Cookie', 'a=b=c', 'a=<redacted>'],
    ['Cookie', 'bare', '<redacted>'],
    ['X-API-Key', 'abc', '<redacted>'],
    ['X-Whatever', 'Bearer abc', '<redacted>'],
  ])('1: %s: %s -> %s', (name, value, expected) => {
    expect(redactHeaderValue(name, value)).toBe(expected);
  });

  test('2: an empty value is returned as it is', () => {
    expect(redactHeaderValue('Authorization', '')).toBe('');
    expect(redactHeaderValue('Authorization', undefined)).toBe('');
  });

  test('3: a list of values and a number are masked', () => {
    expect(redactHeaderValue('X-API-Key', ['a', 'b'])).toBe('<redacted>');
    expect(redactHeaderValue('X-API-Key', 12345)).toBe('<redacted>');
  });

  test('4: the placeholder is the one constant', () => {
    expect(REDACTED).toBe('<redacted>');
  });
});

describe('redactBody()', () => {
  test('1: masks credential fields at any depth, in arrays too, and nothing else', () => {
    const body = {
      a: 'keep',
      password: 'made-up-1',
      list: [{ secret: 'made-up-2', n: 1 }, { access_token: 'made-up-3' }],
      deep: { deeper: { clientSecret: 'made-up-4', id: 7 } },
    };
    const { data, found } = redactBody(body);
    expect(found).toBe(true);
    expect(data).toEqual({
      a: 'keep',
      password: REDACTED,
      list: [{ secret: REDACTED, n: 1 }, { access_token: REDACTED }],
      deep: { deeper: { clientSecret: REDACTED, id: 7 } },
    });
  });

  test('2: never changes its input', () => {
    const body = { password: 'made-up', nested: { client_secret: 'made-up' } };
    const copy = JSON.parse(JSON.stringify(body));
    redactBody(body);
    expect(body).toEqual(copy);
  });

  test('3: a body without credentials is returned as the same object', () => {
    const body = { a: 1, b: ['x'] };
    const { data, found } = redactBody(body);
    expect(found).toBe(false);
    expect(data).toBe(body);
  });

  test('4: empty, null and boolean values are not credentials', () => {
    const body = { password: '', secret: null, assertion: true };
    const { data, found } = redactBody(body);
    expect(found).toBe(false);
    expect(data).toBe(body);
  });

  test('5: a number under a credential name is masked', () => {
    expect(redactBody({ password: 123456 }).data).toEqual({
      password: REDACTED,
    });
  });

  test('6: an object under a credential name is searched, not replaced', () => {
    const body = { password: { type: 'string', viewable: false } };
    const { data, found } = redactBody(body);
    expect(found).toBe(false);
    expect(data).toBe(body);
  });

  test('7: the answer to a password callback is masked, the other callbacks stay', () => {
    const body = {
      authId: 'made-up',
      callbacks: [
        { type: 'NameCallback', input: [{ name: 'IDToken1', value: 'demo' }] },
        {
          type: 'PasswordCallback',
          input: [{ name: 'IDToken2', value: 'made-up-password' }],
        },
        {
          type: 'ValidatedCreatePasswordCallback',
          input: [
            { name: 'IDToken1', value: 'made-up-new' },
            { name: 'IDToken2', value: false },
          ],
        },
      ],
    };
    const { data, found } = redactBody(body);
    expect(found).toBe(true);
    expect((data as any).callbacks[0].input[0].value).toBe('demo');
    expect((data as any).callbacks[1].input).toEqual([
      { name: 'IDToken2', value: REDACTED },
    ]);
    expect((data as any).callbacks[2].input).toEqual([
      { name: 'IDToken1', value: REDACTED },
      { name: 'IDToken2', value: false },
    ]);
    expect(JSON.stringify(data)).not.toContain('made-up-');
  });

  test('8: a JSON string is parsed, masked and written compact', () => {
    const { data, found } = redactBody('{ "password": "made-up", "a": 1 }');
    expect(found).toBe(true);
    expect(data).toBe('{"password":"<redacted>","a":1}');
  });

  test('9: a JSON string without credentials is returned unchanged', () => {
    const text = '{ "a":   1 }';
    expect(redactBody(text)).toEqual({ data: text, found: false });
  });

  test('10: a form-encoded string: the credential names are masked, the order and the rest stay', () => {
    const { data, found } = redactBody(
      'assertion=a.b.c&client_id=service-account&grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&scope=fr:idm:*'
    );
    expect(found).toBe(true);
    expect(data).toBe(
      'assertion=<redacted>&client_id=service-account&grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&scope=fr:idm:*'
    );
  });

  test('11: in a form the code of the authorization code grant is masked, in JSON it is not', () => {
    expect(redactBody('grant_type=authorization_code&code=abc').data).toBe(
      'grant_type=authorization_code&code=<redacted>'
    );
    expect(redactBody({ code: 'DE' })).toEqual({
      data: { code: 'DE' },
      found: false,
    });
  });

  test('12: a form name is matched in any case and when it is percent-encoded', () => {
    expect(
      redactBody('Client%5FSecret=abc&PASSWORD=def&password2=ghi').data
    ).toBe('Client%5FSecret=<redacted>&PASSWORD=<redacted>&password2=ghi');
  });

  test('13: a form value that is empty is left alone', () => {
    expect(redactBody('password=&a=b')).toEqual({
      data: 'password=&a=b',
      found: false,
    });
  });

  test('14: text that is neither JSON nor a form is returned as it is', () => {
    for (const text of ['<xml a="b"/>', 'plain text', 'a=b=c', '{broken']) {
      expect(redactBody(text)).toEqual({ data: text, found: false });
    }
  });

  test('15: things that are no plain object are left alone', () => {
    const buffer = Buffer.from('password=abc');
    const date = new Date();
    expect(redactBody(buffer).data).toBe(buffer);
    expect(redactBody(date).data).toBe(date);
    expect(redactBody(undefined)).toEqual({ data: undefined, found: false });
    expect(redactBody(null)).toEqual({ data: null, found: false });
    expect(redactBody(42)).toEqual({ data: 42, found: false });
  });

  test('15b: things that are no plain object stay what they are in a body that is masked', () => {
    const buffer = Buffer.from('made-up');
    const date = new Date(0);
    const { data, found } = redactBody({
      password: 'made-up',
      at: date,
      bytes: buffer,
    });
    expect(found).toBe(true);
    expect((data as any).at).toBe(date);
    expect((data as any).bytes).toBe(buffer);
    expect(JSON.stringify(data)).toContain('"at":"1970-01-01T00:00:00.000Z"');
  });

  test('16: a circular body does not hang or overflow the stack', () => {
    const body: any = { a: 1, password: 'made-up' };
    body.self = body;
    const { found } = redactBody(body);
    expect(found).toBe(true);
  });
});

describe('the recording filter uses the shared header list', () => {
  function recordingWith(name: string, value: string) {
    return {
      request: { url: 'https://x.example.com/a', headers: [{ name, value }] },
      response: { headers: [] },
    } as any;
  }

  test.each([
    'Proxy-Authorization',
    'X-OpenIDM-Password',
    'Api-Key',
    'Ocp-Apim-Subscription-Key',
    'X-Auth-Token',
  ])('1: %s never reaches a recording', (name) => {
    const recording = recordingWith(name, 'made-up-credential');
    filterRecording(recording, false);
    expect(recording.request.headers[0].value).toBe(REDACTED);
  });

  test('2: the headers it has its own placeholder for keep it', () => {
    const cases: [string, string, string][] = [
      ['X-OpenAM-Password', 'made-up', '<password>'],
      ['X-API-Key', 'made-up', '<api key>'],
      ['X-API-Secret', 'made-up', '<api secret>'],
      ['Authorization', 'Bearer made-up', 'Bearer <bearer token>'],
      ['Cookie', 'iPlanetDirectoryPro=made-up', 'iPlanetDirectoryPro=<cookie>'],
      ['Set-Cookie', 'a=made-up; Path=/', 'a=<cookie>; Path=/'],
    ];
    for (const [name, value, expected] of cases) {
      const recording = recordingWith(name, value);
      filterRecording(recording, false);
      expect(recording.request.headers[0].value).toBe(expected);
    }
  });

  test('3: a header that is not on the list is not touched', () => {
    const recording = recordingWith('Accept', 'application/json');
    filterRecording(recording, false);
    expect(recording.request.headers[0].value).toBe('application/json');
  });
});
