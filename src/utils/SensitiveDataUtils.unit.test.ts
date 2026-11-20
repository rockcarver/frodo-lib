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
  redactCredentials,
  REDACTED,
  redactHeaderValue,
  redactUrl,
  scrubUrls,
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

describe('redactUrl', () => {
  test.each([
    ['https://am.example.com/am/json/x', 'https://am.example.com/am/json/x'],
    [
      'https://am.example.com/am/json/x?_queryFilter=true&_fields=*',
      'https://am.example.com/am/json/x?_queryFilter=true&_fields=*',
    ],
    ['/relative/path?a=b', '/relative/path?a=b'],
    ['', ''],
  ])('1: %s has nothing to replace', (url, expected) => {
    expect(redactUrl(url)).toBe(expected);
  });

  test('1b: a URL that starts with two slashes has its user info replaced as well', () => {
    expect(redactUrl('//admin:made-up@am.example.com/am?a=b')).toBe(
      '//admin:<redacted>@am.example.com/am?a=b'
    );
    expect(redactUrl('//made-up@am.example.com/am')).toBe(
      '//<redacted>@am.example.com/am'
    );
    expect(redactUrl('//am.example.com/am?access_token=made-up')).toBe(
      '//am.example.com/am?access_token=<redacted>'
    );
  });

  test('2: the password of the user info is replaced, the user name stays', () => {
    expect(redactUrl('https://admin:made-up@am.example.com/am')).toBe(
      'https://admin:<redacted>@am.example.com/am'
    );
    expect(redactUrl('http://admin:a:b@host:8080/x')).toBe(
      'http://admin:<redacted>@host:8080/x'
    );
  });

  test('3: a user info without a colon is replaced as a whole', () => {
    expect(redactUrl('https://made-up-value@am.example.com/am')).toBe(
      'https://<redacted>@am.example.com/am'
    );
  });

  test('4: the sensitive names of the query are replaced, in any case and encoded', () => {
    expect(
      redactUrl(
        'https://am.example.com/x?access_token=made-up&ACCESS_TOKEN=made-up&client%5Fsecret=made-up&code=made-up&keep=1'
      )
    ).toBe(
      'https://am.example.com/x?access_token=<redacted>&ACCESS_TOKEN=<redacted>&client%5Fsecret=<redacted>&code=<redacted>&keep=1'
    );
  });

  test('5: the fragment is replaced the same way (an implicit grant puts its answer there)', () => {
    expect(
      redactUrl('https://app.example.com/cb#access_token=made-up&state=1')
    ).toBe('https://app.example.com/cb#access_token=<redacted>&state=1');
    expect(redactUrl('https://app.example.com/cb?a=1#id_token=made-up')).toBe(
      'https://app.example.com/cb?a=1#id_token=<redacted>'
    );
  });

  test('6: user info, query and fragment together; a query that is empty stays', () => {
    expect(
      redactUrl('https://u:p@h/x?password=made-up&b=2#refresh_token=made-up')
    ).toBe(
      'https://u:<redacted>@h/x?password=<redacted>&b=2#refresh_token=<redacted>'
    );
    expect(redactUrl('https://h/x?')).toBe('https://h/x?');
  });

  test('7: an at sign in the path or the query is not user info', () => {
    expect(redactUrl('https://h/users/a@b.example?mail=a@b.example')).toBe(
      'https://h/users/a@b.example?mail=a@b.example'
    );
  });

  test('8: the user info ends at the last at sign of the authority', () => {
    expect(redactUrl('https://admin:pa@ss@host/path')).toBe(
      'https://admin:<redacted>@host/path'
    );
    expect(redactUrl('https://admin:p@ss@w@rd@host:8080/x?a=b@c')).toBe(
      'https://admin:<redacted>@host:8080/x?a=b@c'
    );
    expect(redactUrl('https://a@b@host')).toBe('https://<redacted>@host');
  });

  test('9: the field of a revocation request is replaced in a query, in a form and in JSON', () => {
    expect(redactUrl('https://h/revoke?token=made-up&a=1')).toBe(
      'https://h/revoke?token=<redacted>&a=1'
    );
    expect(redactBody('token=made-up&token_type_hint=access_token').data).toBe(
      'token=<redacted>&token_type_hint=access_token'
    );
    expect(redactBody({ token: 'made-up' }).found).toBe(true);
    // `code` is too common a name in JSON (a status code, a country code) and is replaced in forms only
    expect(redactBody({ code: 401 }).found).toBe(false);
  });
});

describe('the state of an authentication flow', () => {
  test('1: authId is a sensitive field, in JSON and in a form, in any case', () => {
    expect(isSensitiveFieldName('authId')).toBe(true);
    expect(
      redactBody({ authId: 'made-up', callbacks: [{ type: 'x' }] }).data
    ).toEqual({ authId: '<redacted>', callbacks: [{ type: 'x' }] });
    expect(redactBody('authId=made-up&a=1').data).toBe('authId=<redacted>&a=1');
  });
});

describe('scrubUrls', () => {
  test('1: every URL of a text is redacted, the rest is kept', () => {
    expect(
      scrubUrls(
        'see (https://u:p@h/x?access_token=made-up&a=1) and <http://h/y?code=made-up#f> then "ftp://h/z"'
      )
    ).toBe(
      'see (https://u:<redacted>@h/x?access_token=<redacted>&a=1) and <http://h/y?code=<redacted>#f> then "ftp://h/z"'
    );
  });

  test('2: a separator without a scheme, and a text without one, are kept', () => {
    for (const text of ['://x', 'a ://b', '1://x', 'no url here', '']) {
      expect(scrubUrls(text)).toBe(text);
    }
  });

  test('3: a scheme is read up to 32 characters before the separator', () => {
    expect(scrubUrls('x.y+z-1://h/p?token=made-up')).toBe(
      'x.y+z-1://h/p?token=<redacted>'
    );
  });

  test('4: a URL without an end ends the text', () => {
    expect(scrubUrls('go to https://h/p?password=made-up')).toBe(
      'go to https://h/p?password=<redacted>'
    );
  });
});

describe('redactCredentials: the edges of a token', () => {
  test.each([
    ['a header of 7 characters and a payload of 4', 'eyJabcd.abcd', true],
    ['a header of 8 characters and a payload of 5', 'eyJabcde.abcde', true],
    ['a header of 6 characters and a payload of 8', 'eyJabc.abcdefgh', false],
    ['a header of 9 characters and a payload of 3', 'eyJabcdef.abc', false],
  ])('1: %s', (_name, text, replaced) => {
    expect(redactCredentials(`x ${text} y`)).toBe(
      replaced ? `x ${REDACTED} y` : `x ${text} y`
    );
  });
});

describe('scrubUrls: a password that holds a character that ends a URL in running text', () => {
  // the user info ends at the last at sign of its authority, and the authority ends at a slash, a question
  // mark, a number sign, a backslash, white space, a quote or an angle bracket: a password may hold the rest
  test.each([
    ['an ampersand', 'http://u:ZQX&pw9876@h2.example/x'],
    ['a comma', 'http://px:ZQX,pw9876@10.0.0.1:3128'],
    ['a semicolon', 'jdbc:mysql://svc:ZQX;pw9876@db.internal/x'],
    ['a brace', 'ldap://cn:ZQX}pw9876@ldap.example'],
    ['a bar', 'ftp://f:ZQX|pw9876@ftp.example/'],
    ['a parenthesis', 'http://u:ZQX)pw9876@h.example/x'],
    ['a bracket', 'http://u:ZQX]pw9876@h.example/x'],
    ['an opening parenthesis and a bracket', 'http://u:ZQX([pw9876@h.example'],
    ['all of them', 'http://u:ZQX&,;|)]}pw9876@h.example:8443/x?y=1'],
    ['an at sign and a comma', 'http://u:ZQX@,pw9876@h.example'],
    ['in a list of a text', 'proxies: [http://px:ZQX,pw9876@10.0.0.1:3128]'],
    ['in parentheses', '(see ldap://cn:ZQX}pw9876@ldap.example)'],
    ['in a JSON string', '{"url":"http://u:ZQX;pw9876@h.example/x"}'],
  ])('1: %s in the password: it is replaced', (_name, text) => {
    const scrubbed = scrubUrls(text);
    expect(scrubbed).not.toMatch(/ZQX|pw9876/);
    expect(scrubbed).toContain('<redacted>');
  });

  test('2: a URL that is joined to another one ends in front of it, and the two are read as their own', () => {
    expect(
      scrubUrls('http://u:ZQX&a@h1,http://v:ZQY;b@h2 http://w:ZQZ)c@h3')
    ).toBe(
      'http://u:<redacted>@h1,http://v:<redacted>@h2 http://w:<redacted>@h3'
    );
  });

  test('2b: a joined second URL ends the first one, whatever its password holds', () => {
    expect(scrubUrls('http://u:ZQX)pw9876@h1,http://v:ZQY]b@h2 end')).toBe(
      'http://u:<redacted>@h1,http://v:<redacted>@h2 end'
    );
    expect(scrubUrls('http://u:ZQX]pw9876@h1;http://v:y@h2/p?code=x')).toBe(
      'http://u:<redacted>@h1;http://v:<redacted>@h2/p?code=<redacted>'
    );
  });

  test('3a: a closing parenthesis ends the body of a URL: what follows it is not read as part of its query', () => {
    expect(scrubUrls('(http://h/y?code=made-up) end')).toBe(
      '(http://h/y?code=<redacted>) end'
    );
  });

  test('3: a URL that is closed by a parenthesis or a bracket keeps its text: only the user info is replaced', () => {
    expect(
      scrubUrls('(see http://u:ZQXpw@h.example/x) and [http://h/y] after')
    ).toBe('(see http://u:<redacted>@h.example/x) and [http://h/y] after');
    expect(scrubUrls('a (http://h.example) b:c@d')).toBe(
      'a (http://h.example) b:<redacted>@d'
    );
  });

  test('3b: the path and the query of a URL whose user info holds such a character are redacted as those of any URL', () => {
    expect(
      scrubUrls('http://u:ZQX)pw9876@h.example/x?access_token=made-up&a=1 end')
    ).toBe('http://u:<redacted>@h.example/x?access_token=<redacted>&a=1 end');
    expect(scrubUrls('[http://u:ZQX]pw@h.example?code=made-up] end')).toBe(
      '[http://u:<redacted>@h.example?code=<redacted>] end'
    );
  });

  test('4: 30,000 random passwords, drawn from what a URL allows in its user info, in random surroundings: none is kept', () => {
    let seed = 20261119;
    const next = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return ((seed >>> 0) % 1e9) / 1e9;
    };
    const pick = (list: string[]) => list[Math.floor(next() * list.length)];
    const ALNUM = [
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    ];
    const EXTRA = [...'@:!$%-._~*+,;=&[]()^|{}'];
    const password = () => {
      let text = 'ZQ';
      for (let i = 6 + Math.floor(next() * 14); i > 0; i--) {
        text += pick(next() < 0.25 ? EXTRA : ALNUM);
      }
      return `${text}z9`;
    };
    const users = ['admin', 'u', 'svc-account', 'hostuser', 'a.b', 'U1234567'];
    const hosts = [
      'host.example',
      'h',
      '127.0.0.1:8080',
      '[::1]:9000',
      'a-b.c.example:443',
      'localhost',
    ];
    const schemes = [
      'http',
      'https',
      'ftp',
      'ldap',
      'ssh',
      'jdbc:mysql',
      'custom+x',
      'HTTP',
    ];
    const lefts = [
      '',
      'error: ',
      '"url":"',
      "url='",
      'proxy ',
      '(',
      '[',
      '{"a":"',
      'at ',
      'GET ',
      '<',
      'to\n',
      '=',
      ', ',
    ];
    const rights = [
      '',
      '/',
      '/path?x=1',
      '"',
      "'",
      ' and more',
      ')',
      ']',
      '\nnext line',
      ', next',
      '>',
      '.',
      ' mail bob@example.com',
      '/a/b#frag',
      ':8080/x',
    ];
    const kept: string[] = [];
    for (let i = 0; i < 30000; i++) {
      const secret = password();
      const text = `${pick(lefts)}${pick(schemes)}://${pick(users)}:${secret}@${pick(hosts)}${pick(rights)}`;
      if (redactCredentials(text).includes(secret)) kept.push(text);
    }
    expect(kept.slice(0, 5)).toEqual([]);
    expect(kept).toHaveLength(0);
  });
});

describe('redactCredentials', () => {
  test.each([
    [
      'a three part token',
      'assertion eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl rejected',
      'assertion <redacted> rejected',
    ],
    [
      'a token without a signature',
      'got eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0. back',
      'got <redacted> back',
    ],
    [
      'a two part token',
      'got eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0 back',
      'got <redacted> back',
    ],
    [
      'a token after other parts of a dotted run',
      'id=host.eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.sig!',
      'id=host.<redacted>!',
    ],
    [
      'a token in quotes',
      '"x":"eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.sig"',
      '"x":"<redacted>"',
    ],
    [
      'a token after a hyphen',
      'kid x-eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.c2ln done',
      'kid x-<redacted> done',
    ],
    [
      'a token after an underscore',
      'kid_eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.c2ln',
      'kid_<redacted>',
    ],
    [
      'a token after letters',
      'abceyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.c2ln',
      'abc<redacted>',
    ],
    [
      'a token after a hyphen, with a header of several kilobytes (a certificate chain)',
      `kid-${Buffer.from(JSON.stringify({ alg: 'RS256', x5c: ['A'.repeat(3000)] })).toString('base64url')}.eyJzdWIiOiJ4In0.c2ln`,
      'kid-<redacted>',
    ],
    [
      'a token after a hyphen, without a signature, in quotes',
      '"kid":"x-eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0."',
      '"kid":"x-<redacted>"',
    ],
    [
      'a quoted value that is not closed (the text was cut)',
      'a {"password":"made-up-value-that-is-cut',
      'a {"password":"<redacted>"',
    ],
    [
      'a value that a JSON text inside a string writes with escaped quotes',
      '{"echoed":"{\\"password\\":\\"made-up\\",\\"b\\":1}"}',
      '{"echoed":"{\\"password\\":\\"<redacted>\\",\\"b\\":1}"}',
    ],
    [
      'a value with escaped quotes that is not closed (the text was cut)',
      'a {\\"password\\":\\"made-up-value-that-is-cut',
      'a {\\"password\\":\\"<redacted>\\"',
    ],
    [
      'a single quoted value that is not closed (the text was cut)',
      "a {'client_secret':'made-up-value-that-is-cut",
      "a {'client_secret':'<redacted>'",
    ],
    [
      'a single quoted value with an escaped quote',
      "{'password':'ab\\'cd','next':'e'}",
      "{'password':'<redacted>','next':'e'}",
    ],
    [
      'a quoted value with an escaped quote',
      '{"password":"ab\\"cd","next":"e"}',
      '{"password":"<redacted>","next":"e"}',
    ],
    [
      'the password of the user info of a host, without a scheme',
      'connect admin:made-up@host.example.com failed',
      'connect admin:<redacted>@host.example.com failed',
    ],
    [
      'a password with an at sign, up to the last at sign of the host',
      'dial admin:p@ssw0rd-ZQX@host.example now',
      'dial admin:<redacted>@host.example now',
    ],
    [
      'a password with an at sign, after two slashes',
      '//admin:p@ssw0rd-ZQX@host.example/x',
      '//admin:<redacted>@host.example/x',
    ],
    ['a short password with an at sign', 'u:p@ss@h', 'u:<redacted>@h'],
    [
      'an at sign in the path is not the end of the user info',
      'admin:p@host.example/x@y',
      'admin:<redacted>@host.example/x@y',
    ],
    [
      'a quote ends the authority: two fields are two user infos',
      '{"u":"x:y@h","v":"p:q@z"}',
      '{"u":"x:<redacted>@h","v":"p:<redacted>@z"}',
    ],
    [
      'white space ends the authority, an address of a mail after it stays',
      'u:p@h.example and bob@example.com wrote',
      'u:<redacted>@h.example and bob@example.com wrote',
    ],
    [
      'a question mark ends the authority',
      'a:b@h?c=d@f',
      'a:<redacted>@h?c=d@f',
    ],
    [
      'the answer to a password callback, an input with a name of its own',
      '{"type":"PasswordCallback","output":[{"name":"prompt","value":"Password"}],"input":[{"name":"pw","value":"made-up"}]}',
      '{"type":"PasswordCallback","output":[{"name":"prompt","value":"<redacted>"}],"input":[{"name":"pw","value":"<redacted>"}]}',
    ],
    [
      'the answer to a password callback, the value before the name',
      '{"type":"PasswordCallback","input":[{"value":"made-up","name":"IDToken2"}]}',
      '{"type":"PasswordCallback","input":[{"value":"<redacted>","name":"IDToken2"}]}',
    ],
    [
      'the answer to a password callback, a key between the name and the value',
      '{"type":"PasswordCallback","input":[{"name":"IDToken2","note":1,"value":"made-up"}]}',
      '{"type":"PasswordCallback","input":[{"name":"IDToken2","note":1,"value":"<redacted>"}]}',
    ],
    [
      'the answer to a password callback, the type after the input',
      '{"input":[{"name":"pw","value":"made-up"}],"type":"ValidatedCreatePasswordCallback"}',
      '{"input":[{"name":"pw","value":"<redacted>"}],"type":"ValidatedCreatePasswordCallback"}',
    ],
    [
      'the answer to a password callback, pretty printed',
      '{\n  "type": "PasswordCallback",\n  "input": [\n    {\n      "value": "made-up",\n      "name": "x"\n    }\n  ]\n}',
      '{\n  "type": "PasswordCallback",\n  "input": [\n    {\n      "value": "<redacted>",\n      "name": "x"\n    }\n  ]\n}',
    ],
    [
      'the answer to a password callback, as a JSON text inside a string writes it',
      '{\\"type\\":\\"PasswordCallback\\",\\"input\\":[{\\"value\\":\\"made-up\\"}]}',
      '{\\"type\\":\\"PasswordCallback\\",\\"input\\":[{\\"value\\":\\"<redacted>\\"}]}',
    ],
    [
      'the input of an IDToken10 and an IDToken12',
      '[{"name":"IDToken10","value":"made-up"},{"name":"IDToken12","value":"made-up"}]',
      '[{"name":"IDToken10","value":"<redacted>"},{"name":"IDToken12","value":"<redacted>"}]',
    ],
    [
      'the input of a callback, as a JSON text writes it',
      '{"type":"PasswordCallback","input":[{"name":"IDToken2","value":"made-up"}]}',
      '{"type":"PasswordCallback","input":[{"name":"IDToken2","value":"<redacted>"}]}',
    ],
    [
      'the input of a callback, as a JSON text inside a string writes it',
      '{\\"input\\":[{\\"name\\":\\"IDToken2\\",\\"value\\":\\"made-up\\"}]}',
      '{\\"input\\":[{\\"name\\":\\"IDToken2\\",\\"value\\":\\"<redacted>\\"}]}',
    ],
    [
      'the input of a callback in single quotes, cut',
      "[{'name': 'IDToken1', 'value': 'adm",
      "[{'name': 'IDToken1', 'value': '<redacted>'",
    ],
    [
      'a password with two at signs',
      'admin:a@b@c@host.example/x?m=a@b',
      'admin:<redacted>@host.example/x?m=a@b',
    ],
    [
      'the password of the user info of an address in brackets',
      'dial admin:made-up@[::1]:8080 now',
      'dial admin:<redacted>@[::1]:8080 now',
    ],
    [
      'the password of the user info of an address in brackets that holds colons',
      '//admin:made-up@[2001:db8::1]/path',
      '//admin:<redacted>@[2001:db8::1]/path',
    ],
    [
      'the password of the user info of a URL that starts with two slashes',
      'see //admin:made-up@host.example.com/path now',
      'see //admin:<redacted>@host.example.com/path now',
    ],
    [
      'the password of the user info of a host in quotes',
      '{"url":"admin:made-up@host.example.com:8080"}',
      '{"url":"admin:<redacted>@host.example.com:8080"}',
    ],
    [
      'an opaque value after Bearer',
      'Authorization: Bearer 0123456789abcdef0123456789abcdef0123456789abcdef',
      'Authorization: <redacted>',
    ],
    [
      'an opaque value after access_token=',
      'access_token=0123456789abcdef0123456789abcdef0123456789abcdef&x=1',
      'access_token=<redacted>&x=1',
    ],
    [
      'an opaque value after assertion=',
      'assertion=0123456789abcdef0123456789abcdef0123456789abcdef',
      'assertion=<redacted>',
    ],
  ])('1: %s is redacted', (_name, text, expected) => {
    expect(redactCredentials(text)).toBe(expected);
  });

  test.each([
    'eyJ',
    'eyJabc',
    'eyJ.example.com',
    'eyJabcd.abc',
    'the eyJ prefix of a token',
    'version 1.2.3 of host.example.com',
    'a.b.c.d.e',
    'eyJabcdefgh',
    'xeyJabcdefgh.abcdefgh',
    // a word that holds eyJ is no token: its header does not decode as JSON
    'monkeyJumping.Over',
    'surveyJobsList.Status',
    'keyJson.parseValue',
    'kid_eyJabcdefgh.abcdefgh.abcdefgh',
    // a value in a text that has no password callback in it is a value of the text
    '{"name":"prompt","value":"Password"}',
    '{"output":[{"name":"prompt","value":"User Name"}]}',
    '{"name":"timeout","value":"30"}',
    // a bearer value of seven characters is a word, of eight it is a value
    'Bearer abcdefg',
    // the digest of an image is no user info: what stands before it is a name and a tag
    'docker pull registry.example.com/team/image:1.2.3@sha256:0123456789abcdef0123456789abcdef',
    'image:tag@sha512:0123456789abcdef',
    // an at sign after a space, a slash or a quote is not part of the user info
    'a:b @c.example and d:e/@f.example',
    'image:tag@md5:0123456789abcdef',
    // an address of a mail and a host without user info are no user info with a password
    'write to john@example.com or mailto:john@example.com',
    'host.example.com:8080 and user@host.example.com',
    'a: b@ c and @host and user:@host and user:pass@ x',
    'Bearer short',
    'no value after access_token',
  ])('2: "%s" is not a token and is left alone', (text) => {
    expect(redactCredentials(text)).toBe(text);
  });

  // the same table as the one of the CLI (McpResultScrub.test.js): URLs joined by a character
  // that is no part of an authority
  test.each([
    ['a comma', 'proxy=http://a:SECRET1@x,http://b:SECRET2@y'],
    ['a semicolon', 'http://u:SECRET1@h1;http://c:SECRET2@h2'],
    ['a bar', 'http://u:SECRET1@h1|http://c:SECRET2@h2'],
    ['parentheses', '(http://u:SECRET1@h1)(http://c:SECRET2@h2)'],
    ['brackets', '[http://u:SECRET1@h1][http://c:SECRET2@h2]'],
    ['braces', '{http://u:SECRET1@h1}{http://c:SECRET2@h2}'],
    ['an ampersand', 'a=http://u:SECRET1@h&b=http://c:SECRET2@h2'],
    [
      'a comma and another scheme',
      'http://u:SECRET1@h1,https://c:SECRET2@h2:8443/path',
    ],
    ['a comma and a path', 'http://u:SECRET1@h1/x,http://c:SECRET2@h2/y'],
    ['a space', 'http://u:SECRET1@h1 http://c:SECRET2@h2'],
    ['a quote', '"http://u:SECRET1@h1""http://c:SECRET2@h2"'],
    [
      'three URLs',
      'http://u:SECRET1@h1,http://v:SECRET2@h2;http://w:SECRET3@h3',
    ],
  ])('1c: URLs joined by %s: every password is replaced', (_name, text) => {
    const redacted = redactCredentials(text);
    expect(redacted).not.toMatch(/SECRET\d/);
    expect(redacted.match(/<redacted>/g)).toHaveLength(
      text.match(/SECRET\d/g)?.length ?? 0
    );
  });

  test('1d: a value of eight characters after Bearer is replaced, one of seven is not', () => {
    expect(redactCredentials('Bearer abcdefg')).toBe('Bearer abcdefg');
    expect(redactCredentials('Bearer abcdefgh')).toBe('Bearer <redacted>');
    expect(redactCredentials('Bearer abcdefghi')).toBe('Bearer <redacted>');
  });

  test('1b: two tokens in one run of dotted parts are replaced, each', () => {
    expect(
      redactCredentials(
        'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.sig.eyJhbGciOiJub25lIn1.eyJzdWIiOiJ4In1.sig2'
      )
    ).toBe('<redacted>.<redacted>');
    expect(
      redactCredentials(
        'a.eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.sig.b.eyJhbGciOiJub25lIn1.eyJzdWIiOiJ4In1.'
      )
    ).toBe('a.<redacted>.b.<redacted>');
  });

  test('2b: Bearer and eight characters of a value are redacted, as the collector of the runtime has always done', () => {
    expect(redactCredentials('send Bearer endpoint-1 now')).toBe(
      'send Bearer <redacted> now'
    );
  });

  test('3: a private key, the user info of a URL and a named value are redacted', () => {
    expect(
      redactCredentials(
        'a -----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY----- b https://u:p@h/ password=made-up'
      )
    ).toBe('a <redacted> b https://u:<redacted>@h/ password=<redacted>');
  });
});
