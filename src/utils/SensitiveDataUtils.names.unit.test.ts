import { leastCpuMilliseconds } from '../test/utils/CpuTime';
import {
  isSensitiveFieldName,
  isSensitiveHeaderName,
  isSensitiveName,
  normalizeName,
  redactBody,
  redactCredentials,
  SENSITIVE_FIELD_NAMES,
} from './SensitiveDataUtils';

const T = 'ZQXnames0123456789';

/** The spellings of the names of credentials that a body, a configuration or a form may use. */
const SPELLED = [
  'password',
  'Password',
  'PASSWORD',
  'user_password',
  'userPassword',
  'userpassword',
  'newPassword',
  'passwordHash',
  'password_hash',
  'pwd',
  'passwd',
  'pass',
  'passphrase',
  'secret',
  'Secret',
  'secretKey',
  'secret_key',
  'client_secret',
  'clientSecret',
  'client-secret',
  'clientsecret',
  'access_token',
  'accessToken',
  'access-token',
  'Access_Token',
  'ACCESS_TOKEN',
  'id_token',
  'idToken',
  'refresh_token',
  'refreshToken',
  'subject_token',
  'tokenId',
  'tokenid',
  'token',
  'Token',
  'sessionToken',
  'session_token',
  'jwt',
  'JWT',
  'bearer',
  'api_key',
  'apiKey',
  'api-key',
  'x-api-key',
  'X-Api-Key',
  'x_api_key',
  'accessKey',
  'accesskey',
  'private_key',
  'privateKey',
  'authId',
  'authid',
  'assertion',
  'code_verifier',
  'codeVerifier',
  'csrf',
  'credential',
  'credentials',
  'authorization',
  'Authorization',
  'proxy-authorization',
  'cookie',
  'Cookie',
  'set-cookie',
  'x-auth-token',
  'X-Auth-Token',
  'x-openam-password',
  'iPlanetDirectoryPro',
  'valueBase64',
];

const NOT_NAMES = [
  'value',
  'name',
  'user',
  'username',
  'code',
  'status',
  'tokens',
  'passwords',
  'passenger',
  'bypass',
  'compass',
  'secretary',
  'id',
  'key',
  'type',
];

describe('normalizeName', () => {
  test.each([
    ['accessToken', 'accesstoken'],
    ['access-token', 'accesstoken'],
    ['access_token', 'accesstoken'],
    ['ACCESS_TOKEN', 'accesstoken'],
    ['Access.Token', 'accesstoken'],
    ['access token', 'accesstoken'],
    ['X-Api-Key', 'xapikey'],
    ['', ''],
  ])('1: %s is read as %s', (name, expected) => {
    expect(normalizeName(name)).toBe(expected);
  });
});

describe('the names of credentials, in every spelling', () => {
  test.each(SPELLED)(
    '1: %s is the name of a field or a header that holds a credential',
    (name) => {
      expect(isSensitiveName(name)).toBe(true);
      expect(isSensitiveFieldName(name) || isSensitiveHeaderName(name)).toBe(
        true
      );
    }
  );

  test.each(NOT_NAMES)('2: %s is no such name', (name) => {
    expect(isSensitiveName(name)).toBe(false);
    expect(isSensitiveFieldName(name)).toBe(false);
    expect(isSensitiveHeaderName(name)).toBe(false);
  });

  test.each(SPELLED.filter((name) => isSensitiveFieldName(name)))(
    '3: a body with the field %s has its value replaced',
    (name) => {
      expect(JSON.stringify(redactBody({ [name]: T }).data)).not.toContain(T);
    }
  );

  test.each(SPELLED.filter((name) => !isSensitiveFieldName(name)))(
    '3b: %s is the name of a header: the body rules leave it to the rules of headers',
    (name) => {
      expect(isSensitiveHeaderName(name)).toBe(true);
    }
  );

  test('4: a name that is added to the list is read in every spelling, and is no name again when it is taken away', () => {
    const list = SENSITIVE_FIELD_NAMES as string[];
    expect(isSensitiveFieldName('zq_new_name')).toBe(false);
    list.push('zq_new_name');
    try {
      for (const spelling of [
        'zq_new_name',
        'zqNewName',
        'ZQ-NEW-NAME',
        'zqnewname',
      ]) {
        expect(isSensitiveFieldName(spelling)).toBe(true);
        expect(isSensitiveName(spelling)).toBe(true);
      }
    } finally {
      list.pop();
    }
    expect(isSensitiveFieldName('zqNewName')).toBe(false);
  });

  test('4b: a list whose last name is replaced by another of the same length is read again', () => {
    const list = SENSITIVE_FIELD_NAMES as string[];
    const last = list.length - 1;
    const saved = list[last];
    expect(isSensitiveFieldName('zq_swapped')).toBe(false);
    expect(isSensitiveFieldName(saved)).toBe(true);
    list[last] = 'zq_swapped';
    try {
      expect(isSensitiveFieldName('zqSwapped')).toBe(true);
      expect(isSensitiveFieldName(saved)).toBe(false);
    } finally {
      list[last] = saved;
    }
    expect(isSensitiveFieldName(saved)).toBe(true);
  });

  test.each([
    'token',
    'session_token',
    'api_key',
    'private_key',
    'secret_key',
    'password_hash',
    'passphrase',
    'passwd',
    'pwd',
    'pass',
    'jwt',
    'bearer',
    'credential',
    'credentials',
    'user_password',
    'new_password',
    'old_password',
    'current_password',
    'access_key',
    'token_id',
    'auth_id',
  ])('4c: %s is the name of a field', (name) => {
    expect(isSensitiveFieldName(name)).toBe(true);
    expect(JSON.stringify(redactBody({ [name]: T }).data)).not.toContain(T);
    expect(redactCredentials(`${name}=${T}`)).toBe(`${name}=<redacted>`);
  });

  test('5: the names that the user defines are read in every spelling too', () => {
    expect(isSensitiveHeaderName('X-Custom-Key', ['x_custom_key'])).toBe(true);
    expect(isSensitiveHeaderName('xCustomKey', ['X-Custom-Key'])).toBe(true);
    expect(isSensitiveHeaderName('X-Other', ['X-Custom-Key'])).toBe(false);
  });
});

/** Names of a secret that hold a word of a secret and more: configuration objects, environment variables, command lines. */
const COMPOUND_SECRETS = [
  'dbPassword',
  'adminPassword',
  'smtpPassword',
  'bindPassword',
  'rootPassword',
  'passwordConfirm',
  'confirmPassword',
  'webhookSecret',
  'signingSecret',
  'sharedSecret',
  'githubToken',
  'gitlabToken',
  'authToken',
  'apiToken',
  'bearerToken',
  'slack_token',
  'AWS_SECRET_ACCESS_KEY',
  'DB_PASSWORD',
  'MYSQL_ROOT_PASSWORD',
  'PGPASSWORD',
  'secretAccessKey',
  'oldPwd',
  'db.password',
  'signing-secret',
  'X-Db-Password',
  'smtp_passwd',
  'password_confirmation',
  'passwordConfirmation',
  'password_repeat',
  'passwordRetype',
  'password_confirm',
  'DB_PASS',
  'dbpass',
  'rootPass',
  'adminPass',
  'userPass',
  'bindCredentials',
  'userCredentials',
  'apiPassphrase',
  'secretValue',
  'clientSecretValue',
  'passwordValue',
  'secretToken',
  'apiSecretKey',
  'clientSecretKey',
  'resetToken',
  'inviteToken',
  'verificationToken',
  'personalAccessToken',
  'oauthToken',
  'csrfToken',
  'signingKey',
  'hmacKey',
  'encryptionKey',
  'masterKey',
  'privateKeyPem',
  'licenseKey',
  'Authorization-Token',
  'otp',
  'OTP',
  'pin',
];

/** Names that hold a word of a credential and are no secret: they stay visible. */
const COMPOUND_NOT_SECRETS = [
  'accessKeyId',
  'clientId',
  'tokenType',
  'nextPageToken',
  'pageToken',
  'sortKey',
  'csrfTokenName',
  'isPasswordRequired',
  'passwordPolicy',
  'passwordless',
  'secretary',
  'tokenCount',
  'keyboard',
  'passes',
  'bypass',
  'compass',
  'passthrough',
  'passage',
  'otpLength',
  'pinned',
  'spin',
  'pinCount',
  'credentialsPolicy',
];

describe('the compound names of a secret: a name that ends in a word of a secret', () => {
  test.each(COMPOUND_SECRETS)('1: %s is the name of a secret', (name) => {
    expect(isSensitiveName(name)).toBe(true);
    expect(isSensitiveFieldName(name)).toBe(true);
    // the header names are a list of their own, and the same ending rule
    expect(isSensitiveHeaderName(name)).toBe(
      /(password|passwd|pwd|secret|passphrase|credentials)$/.test(
        normalizeName(name)
      )
    );
    expect(JSON.stringify(redactBody({ [name]: T }).data)).not.toContain(T);
  });

  test.each(COMPOUND_NOT_SECRETS)('2: %s stays visible', (name) => {
    expect(isSensitiveName(name)).toBe(false);
    expect(isSensitiveFieldName(name)).toBe(false);
    expect(isSensitiveHeaderName(name)).toBe(false);
    expect(JSON.stringify(redactBody({ [name]: T }).data)).toContain(T);
  });

  test.each(['password', 'passwd', 'pwd', 'secret'])(
    '3: a name that ends in %s, in any case and with any separator, is the name of a secret',
    (word) => {
      for (const name of [
        `x${word}`,
        `X_${word.toUpperCase()}`,
        `my-${word}`,
        `my.${word}`,
        `my ${word}`,
      ]) {
        expect([name, isSensitiveName(name)]).toEqual([name, true]);
      }
    }
  );

  test('4: a word of a secret in the middle of a name is no ending', () => {
    for (const name of [
      'passwordLength',
      'secretNumber',
      'pwdFile',
      'secrets',
    ]) {
      expect([name, isSensitiveName(name)]).toEqual([name, false]);
    }
  });
});

describe('redactCredentials: the compound names in a text', () => {
  test.each(COMPOUND_SECRETS.filter((name) => !/[ .]/.test(name)))(
    '1: %s is read in `name=value`, `name: value`, `export name=value` and as a flag',
    (name) => {
      for (const text of [
        `${name}=${T}`,
        `${name}: ${T}`,
        `export ${name}=${T}`,
        `--${name}=${T}`,
        `--${name} ${T}`,
        `"${name}": "${T}"`,
        `${name} => ${T}`,
      ]) {
        const written = redactCredentials(text);
        expect([text, written.includes(T)]).toEqual([text, false]);
        expect(written).toContain('<redacted>');
      }
    }
  );

  test.each([
    ['user[password]=', 'user[password]=<redacted>'],
    ['password[0]=', 'password[0]=<redacted>'],
    ['smtp.password=', 'smtp.password=<redacted>'],
    ['user.password: ', 'user.password: <redacted>'],
    ['user[password_confirmation]=', 'user[password_confirmation]=<redacted>'],
    ['user[passwordConfirmation]=', 'user[passwordConfirmation]=<redacted>'],
    ['user[password][confirm]=', 'user[password][confirm]=<redacted>'],
    [
      'user[password][confirmation]=',
      'user[password][confirmation]=<redacted>',
    ],
    ['user[password_confirm]=', 'user[password_confirm]=<redacted>'],
    ['config[db][password]=', 'config[db][password]=<redacted>'],
    ['a[0][1].password=', 'a[0][1].password=<redacted>'],
    ['user[password][a-b]=', 'user[password][a-b]=<redacted>'],
    [
      `user[password][${'x'.repeat(16)}]=`,
      `user[password][${'x'.repeat(16)}]=<redacted>`,
    ],
    ['--client-secret ', '--client-secret <redacted>'],
    ['--password ', '--password <redacted>'],
    [
      'mysql --user root --password ',
      'mysql --user root --password <redacted>',
    ],
  ])('2: %s is read', (prefix, expected) => {
    expect(redactCredentials(`${prefix}${T}`)).toBe(expected);
  });

  test('3: a flag value in quotes is replaced as a whole', () => {
    expect(redactCredentials(`--password "a b ${T}" --verbose`)).toBe(
      '--password <redacted> --verbose'
    );
    expect(redactCredentials(`--password '${T} x'`)).toBe(
      '--password <redacted>'
    );
  });

  test.each(COMPOUND_NOT_SECRETS)(
    '4: %s, with a value, is left as it is',
    (name) => {
      for (const text of [`${name}=${T}`, `${name}: ${T}`, `--${name} ${T}`]) {
        expect(redactCredentials(text)).toBe(text);
      }
    }
  );

  test.each([
    ['a single letter option: -p', `-p ${T}`],
    ['a single letter option without a blank: -p', `-p${T}`],
    ['a flag that is followed by a flag', '--password --verbose'],
    ['a flag with no value', 'run --password'],
    ['a flag whose name goes on', `--password-policy ${T}`],
    ['a flag whose name goes on in letters', `--passwords ${T}`],
    ['a flag that is no name of a secret', `--port ${T}`],
    [
      'a name that ends in a word of a secret and is followed by a word',
      `the password ${T} was rejected`,
    ],
    [
      'a word before the name that ends in a letter of the word',
      `compass=${T}`,
    ],
    ['a name with a dot after the word', `password.length=${T}`],
    [
      'a name in brackets that is no name of a secret',
      `user[name][first]=${T}`,
    ],
    [
      'a name in brackets that is no name of a secret, after a colon',
      `a[b][c]: ${T}`,
    ],
    [
      'a bracket that holds more than a word',
      `password[${'x'.repeat(40)}]=${T}`,
    ],
    ['a bracket that holds 17 characters', `password[${'x'.repeat(17)}]=${T}`],
  ])('5: %s is left as it is', (_name, text) => {
    expect(redactCredentials(text)).toBe(text);
  });

  test.each([
    [
      'an escaped line break',
      `line one\\npassword=${T}`,
      'line one\\npassword=<redacted>',
    ],
    ['an escaped tab', `a\\tdbPassword: ${T}`, 'a\\tdbPassword: <redacted>'],
    [
      'an escaped carriage return',
      `a\\rPGPASSWORD=${T}`,
      'a\\rPGPASSWORD=<redacted>',
    ],
    [
      'an escaped carriage return and a name of the lists',
      `a\\rtoken=${T}`,
      'a\\rtoken=<redacted>',
    ],
    ['an escaped tab and a flag', `a\\t--token ${T}`, 'a\\t--token <redacted>'],
    [
      'an escaped tab and a flag with =',
      `a\\t--client-secret=${T}`,
      'a\\t--client-secret=<redacted>',
    ],
    [
      'an escaped line break and a name of the lists',
      `{\\nAccessKey=${T}`,
      '{\\nAccessKey=<redacted>',
    ],
  ])('4b: %s in front of the name', (_name, text, expected) => {
    expect(redactCredentials(text)).toBe(expected);
  });

  test.each([
    [
      'an escaped line break in front of a word that is no name',
      `a\\ncompass=${T}`,
    ],
    ['another escape in front of a name of the lists', `a\\qtoken=${T}`],
    ['a letter t in front of a flag', `at--token ${T}`],
    ['a hyphen in front of a name of the lists', `a-token=${T}`],
  ])('4c: %s is left as it is', (_name, text) => {
    expect(redactCredentials(text)).toBe(text);
  });

  test('5b: a sentence before an equals sign is no name of a form field: only the value is replaced', () => {
    const text = `ERROR: login failed password=${T} user=admin`;
    expect(redactBody(text)).toEqual({ data: text, found: false });
    expect(redactCredentials(text)).toBe(
      'ERROR: login failed password=<redacted> user=admin'
    );
    // a form body is read as before, also with a compound name
    expect(redactBody(`user=a&dbPassword=${T}&x=1`).data).toBe(
      'user=a&dbPassword=<redacted>&x=1'
    );
    expect(redactBody(`user=a&db%20password=${T}`).data).toBe(
      'user=a&db%20password=<redacted>'
    );
  });

  test('6: the text with the name in the middle of a long word costs its length', () => {
    for (const text of [
      'a'.repeat(1 << 20),
      'a-'.repeat(1 << 19),
      'a.'.repeat(1 << 19),
      `${'a'.repeat(1 << 20)}password`,
      '-'.repeat(1 << 20),
      `--${'a'.repeat(1 << 20)} x`,
      'password '.repeat(1 << 17),
    ]) {
      expect(
        leastCpuMilliseconds(() => redactCredentials(text), 1000)
      ).toBeLessThan(1000);
    }
  });
});

describe('redactCredentials: a name and its value in a text', () => {
  test.each([
    ['pwd=' + T, 'pwd=<redacted>'],
    ['passwd=' + T, 'passwd=<redacted>'],
    ['pass: ' + T, 'pass: <redacted>'],
    ['password => ' + T, 'password => <redacted>'],
    ['password=>' + T, 'password=><redacted>'],
    ['"pwd":"' + T + '"', '"pwd":"<redacted>"'],
    ['accessToken=' + T, 'accessToken=<redacted>'],
    ['access-token: ' + T, 'access-token: <redacted>'],
    ['client-secret=' + T, 'client-secret=<redacted>'],
    ['ACCESS_TOKEN=' + T, 'ACCESS_TOKEN=<redacted>'],
    ['token=' + T, 'token=<redacted>'],
    ['api_key: ' + T, 'api_key: <redacted>'],
    ['apiKey=' + T, 'apiKey=<redacted>'],
    ['X_API_KEY: ' + T, 'X_API_KEY: <redacted>'],
    ['privateKey = ' + T, 'privateKey = <redacted>'],
    ['credentials: ' + T, 'credentials: <redacted>'],
    ['user_password=' + T, 'user_password=<redacted>'],
    ['passwordHash=' + T, 'passwordHash=<redacted>'],
    ['password_hash=' + T, 'password_hash=<redacted>'],
    ['new_password=' + T, 'new_password=<redacted>'],
    ['old_password=' + T, 'old_password=<redacted>'],
    ['current_password=' + T, 'current_password=<redacted>'],
    ['access_key=' + T, 'access_key=<redacted>'],
    ['token_id=' + T, 'token_id=<redacted>'],
    ['auth_id=' + T, 'auth_id=<redacted>'],
    ['session_token=' + T, 'session_token=<redacted>'],
    ['private_key=' + T, 'private_key=<redacted>'],
    ['secret_key=' + T, 'secret_key=<redacted>'],
    ['passphrase=' + T, 'passphrase=<redacted>'],
    ['jwt=' + T, 'jwt=<redacted>'],
    ['bearer: ' + T, 'bearer: <redacted>'],
    ['credential=' + T, 'credential=<redacted>'],
  ])('1: %s is replaced', (text, expected) => {
    expect(redactCredentials(text)).toBe(expected);
  });

  test.each([
    'passed: 3 tests',
    'bypass=1',
    'compass: north',
    'tokens=abc',
    'the password',
    'password',
    'pass the salt',
    'a password is needed',
  ])('2: "%s" is left as it is', (text) => {
    expect(redactCredentials(text)).toBe(text);
  });
});

describe('redactCredentials: Basic and a base64 text that holds a user name and a password', () => {
  const login = Buffer.from(`admin:${T}`).toString('base64');

  const encode = (text: string) =>
    Buffer.from(text, 'latin1').toString('base64');

  test.each([
    [`Basic ${login}`, 'Basic <redacted>'],
    [`sent basic ${login} and failed`, 'sent basic <redacted> and failed'],
    [`BASIC ${login}`, 'BASIC <redacted>'],
    [`Basic\t${login}.`, 'Basic <redacted>.'],
    // 10 characters of base64 are enough, and 8 are the least
    ['Basic dXNlcjpwdw==', 'Basic <redacted>'],
    [`Basic ${encode('ab:cde')}`, 'Basic <redacted>'],
    [`Basic ${encode('user:pa ss')}`, 'Basic <redacted>'],
    [`Basic ${encode('user:pa\u00e9ss')}`, 'Basic <redacted>'],
  ])('1: %s', (text, expected) => {
    expect(redactCredentials(text)).toBe(expected);
  });

  test.each([
    'Basic authentication failed',
    'Basic configuration of the host',
    'Basic abcdefgh',
    'Basic /////////',
    'basic 12345678',
    // a base64 text of less than 8 characters is not looked at
    `Basic ${encode('u:p')}`,
    `Basic ${encode('ab:c')}`,
    `unbasic ${login}`,
    `xbasic ${login}`,
    `Basic ${encode('no colon here at all')}`,
    `Basic ${encode('user:pass\u0001word')}`,
    `Basic ${encode('user:pass\u001fword')}`,
    `Basic ${encode('user:pass\u007fword')}`,
    `Basic ${encode('user:pass\u0000word')}`,
  ])(
    '2: "%s" is a word, or decodes to no login, and is left as it is',
    (text) => {
      expect(redactCredentials(text)).toBe(text);
    }
  );

  test('3: the line of a header is replaced as before', () => {
    expect(
      redactCredentials(
        `Authorization: Basic ${Buffer.from(`u:${T}`).toString('base64')}`
      )
    ).toBe('Authorization: <redacted>');
  });

  test('4: a megabyte of base64 text after Basic, and many Basic words, cost their length', () => {
    const big = `Basic ${'A'.repeat(1 << 20)}`;
    const many = 'Basic abcdefgh '.repeat(60_000);
    const spaces = `Basic${' '.repeat(1 << 20)}x`;
    for (const text of [big, many, spaces]) {
      expect(
        leastCpuMilliseconds(() => redactCredentials(text), 1000)
      ).toBeLessThan(1000);
    }
  });
});
