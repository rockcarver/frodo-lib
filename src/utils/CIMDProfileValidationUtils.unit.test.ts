/**
 * Unit tests of the offline validation of a CIMD profile.
 *
 * Run with:
 *
 *        npm run test:only src/utils/CIMDProfileValidationUtils.unit
 *
 * Origin: frodo-lib#1020. The inputs are the cases of a probe of a Cloud development tenant (AM 9.0.0, 2026-11-10, about
 * 110 requests): what the server refuses on a write (all `400`) must be an `error` finding with a specific reason, what
 * it accepts although it is dubious (all `201`) a `warning`, or no finding at all where the probe found nothing to
 * say. Hosts and ids are made up. No request is made, no tenant and no recording is used (the one recording that is
 * read, the schema, only pins the built-in values to what the server listed).
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, test } from '@jest/globals';
import {
  CIMD_GRANT_TYPES,
  CIMD_METADATA_DENY_LIST_FIELDS,
  CIMD_STATUS_VALUES,
  CIMD_SUBJECT_TYPES,
  CIMD_TOKEN_ENDPOINT_AUTH_METHODS,
  matchesWildcardPattern,
  validateCIMDProfile,
  type CIMDProfileFinding,
  type CIMDProfileFindingCode,
} from './CIMDProfileValidationUtils';

const URL_PATTERNS = '/cimdConfig/cimdClientIdUrlPatterns';

/** A profile with the given patterns and the other attributes of the groups. */
function profile(
  patterns: unknown,
  groups: Record<string, Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    cimdConfig: { cimdClientIdUrlPatterns: patterns },
    ...groups,
  };
}

const findingsOf = (
  data: unknown,
  others?: unknown[],
  schema?: unknown
): CIMDProfileFinding[] =>
  validateCIMDProfile({ profileData: data, otherProfiles: others, schema });
const codesOf = (findings: CIMDProfileFinding[]): string[] =>
  findings.map((finding) => finding.code);
const only = (findings: CIMDProfileFinding[], code: CIMDProfileFindingCode) =>
  findings.filter((finding) => finding.code === code);

/** The same profile in the wrapped shape of a single read: every attribute as { inherited: false, value }. */
function wrapped(plain: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(plain)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !key.startsWith('_')
    ) {
      out[key] = Object.fromEntries(
        Object.entries(value).map(([name, v]) => [
          name,
          { inherited: false, value: v },
        ])
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** A profile that gives no finding. */
const CLEAN = profile(['https://agents.example.invalid/clients/*'], {
  cimdConfig: {
    cimdClientIdUrlPatterns: ['https://agents.example.invalid/clients/*'],
    cimdMetadataDenyList: ['redirect_uris', 'scope'],
    cimdSsrfProtectionEnabled: true,
  },
  coreOAuth2ClientConfig: {
    status: 'Active',
    accessTokenLifetime: 3600,
    redirectionUris: ['https://agents.example.invalid/callback'],
  },
  advancedOAuth2ClientConfig: {
    tokenEndpointAuthMethod: 'private_key_jwt',
    subjectType: 'public',
    grantTypes: ['authorization_code', 'refresh_token'],
    responseTypes: ['code'],
  },
});

describe('validateCIMDProfile', () => {
  describe('1: a clean profile, the input, the shapes', () => {
    test('1.1: a clean profile gives no finding', () => {
      expect(findingsOf(CLEAN)).toEqual([]);
    });

    test('1.2: the plain and the wrapped shape give the same findings', () => {
      const dubious = profile(
        ['https://*/*', 'http://x.invalid/*', 'https://agents.example.invalid'],
        {
          cimdConfig: {
            cimdClientIdUrlPatterns: [
              'https://*/*',
              'http://x.invalid/*',
              'https://agents.example.invalid',
            ],
            cimdMetadataDenyList: ['redirect_uri'],
            cimdSsrfProtectionEnabled: false,
          },
          coreOAuth2ClientConfig: { status: 'Gone', accessTokenLifetime: -5 },
          advancedOAuth2ClientConfig: {
            tokenEndpointAuthMethod: 'client_secret_basic',
          },
        }
      );
      const plain = findingsOf(dubious);
      expect(plain.length).toBeGreaterThan(6);
      expect(findingsOf(wrapped(dubious))).toEqual(plain);
    });

    test('1.3: the input is not modified', () => {
      const input = JSON.parse(
        JSON.stringify(
          profile(
            ['https://*/*', 'http://x.invalid/*', 'https://a.invalid/*'],
            {
              cimdConfig: {
                cimdClientIdUrlPatterns: [
                  'https://*/*',
                  'http://x.invalid/*',
                  'https://a.invalid/*',
                ],
                cimdMetadataDenyList: ['SCOPE'],
              },
            }
          )
        )
      );
      const others = [profile(['https://a.invalid/*'])];
      const before = JSON.stringify([input, others]);
      const freeze = (value: unknown): unknown => {
        if (value && typeof value === 'object') {
          Object.values(value).forEach(freeze);
          Object.freeze(value);
        }
        return value;
      };
      freeze(input);
      freeze(others);
      expect(() => findingsOf(input, others)).not.toThrow();
      expect(JSON.stringify([input, others])).toBe(before);
    });

    test.each([
      ['undefined', undefined],
      ['null', null],
      ['a number', 42],
      ['a string', 'https://a.invalid/*'],
      ['an array', []],
      ['an empty object', {}],
    ])('1.4: %s is reported, not thrown', (_name, input) => {
      const findings = findingsOf(input);
      expect(codesOf(findings)).toEqual(['PATTERNS_REQUIRED']);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].path).toBe(URL_PATTERNS);
    });

    test('1.5: a profile that makes the reading itself fail does not make the function throw', () => {
      const hostile = {
        get cimdConfig(): unknown {
          throw new Error('no');
        },
      };
      expect(() => findingsOf(hostile)).not.toThrow();
      expect(Array.isArray(findingsOf(hostile))).toBe(true);
      const circular: Record<string, unknown> = { cimdConfig: {} };
      (circular.cimdConfig as Record<string, unknown>).cimdClientIdUrlPatterns =
        [circular];
      expect(() => findingsOf(circular)).not.toThrow();
    });

    test('1.6: every finding has a code, a severity, a message and a JSON pointer', () => {
      const findings = findingsOf(
        profile(['https://*/*', 'nope'], {
          cimdConfig: {
            cimdClientIdUrlPatterns: ['https://*/*', 'nope'],
            cimdSsrfProtectionEnabled: false,
          },
        })
      );
      expect(findings.length).toBeGreaterThan(2);
      for (const finding of findings) {
        expect(['error', 'warning']).toContain(finding.severity);
        expect(finding.message.length).toBeGreaterThan(10);
        expect(finding.path).toMatch(/^\/[^ ]*$/);
      }
    });
  });

  describe('2: what the server refuses (errors)', () => {
    describe('2.1: the patterns are required', () => {
      test.each([
        ['no cimdConfig', { coreOAuth2ClientConfig: { status: 'Active' } }],
        ['a cimdConfig without patterns', { cimdConfig: {} }],
        ['empty patterns', profile([])],
        ['null patterns', profile(null)],
        [
          '{ inherited: true } on the patterns (the server stores no patterns)',
          { cimdConfig: { cimdClientIdUrlPatterns: { inherited: true } } },
        ],
        [
          '{ inherited: true, value } on the patterns',
          {
            cimdConfig: {
              cimdClientIdUrlPatterns: {
                inherited: true,
                value: ['https://a.invalid/x/*'],
              },
            },
          },
        ],
        [
          'wrapped empty patterns',
          {
            cimdConfig: {
              cimdClientIdUrlPatterns: { inherited: false, value: [] },
            },
          },
        ],
      ])('%s', (_name, data) => {
        const findings = findingsOf(data);
        expect(only(findings, 'PATTERNS_REQUIRED')).toEqual([
          expect.objectContaining({ severity: 'error', path: URL_PATTERNS }),
        ]);
        expect(only(findings, 'PATTERN_SYNTAX')).toEqual([]);
      });
    });

    describe('2.2: a pattern the server refuses', () => {
      test.each([
        ['a string instead of a list', 'https://a.invalid/*', URL_PATTERNS],
        ['a number instead of a list', 42, URL_PATTERNS],
        ['an object instead of a list', { a: 1 }, URL_PATTERNS],
      ])('2.2.1: %s', (_name, value, where) => {
        const findings = only(findingsOf(profile(value)), 'PATTERN_SYNTAX');
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ severity: 'error', path: where });
        expect(findings[0].message).toContain('list of strings');
      });

      test.each([
        ['an empty entry', ''],
        ['a blank entry', '   '],
        ['a number', 42],
        ['null', null],
        ['an object', {}],
        ['http://', 'http://a.invalid/*'],
        ['upper case HTTPS://', 'HTTPS://a.invalid/*'],
        ['ftp://', 'ftp://a.invalid/*'],
        ['no scheme', 'a.invalid/*'],
        ['the entry * alone', '*'],
        ['https:// alone', 'https://'],
        ['an empty host', 'https:///clients/*'],
        ['an empty host with a port', 'https://:443/clients/*'],
        ['a space in the host', 'https://a b.invalid/*'],
        ['a space before the entry', ' https://a.invalid/*'],
        ['a space after the entry', 'https://a.invalid/* '],
        ['a host with non-ASCII characters', 'https://exämple.invalid/*'],
        ['a wildcard port', 'https://a.invalid:*/*'],
      ])('2.2.2: %s', (_name, entry) => {
        const findings = only(
          findingsOf(profile(['https://ok.example.invalid/x/*', entry])),
          'PATTERN_SYNTAX'
        );
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({
          severity: 'error',
          path: `${URL_PATTERNS}/1`,
        });
      });

      test('2.2.3: the message says why', () => {
        const message = (entry: string) =>
          only(findingsOf(profile([entry])), 'PATTERN_SYNTAX')[0].message;
        expect(message('http://a.invalid/*')).toContain('https://');
        expect(message('https://:443/x')).toContain('empty host');
        expect(message('https://a.invalid:*/x')).toContain('wildcard');
        expect(message('https://exämple.invalid/*')).toContain('ASCII');
        expect(message(' https://a.invalid/*')).toContain('white space');
      });
    });

    describe('2.3: the metadata deny list', () => {
      test.each([
        ['upper case SCOPE', 'SCOPE'],
        ['the singular redirect_uri', 'redirect_uri'],
        ['client_secret', 'client_secret'],
        ['an empty string', ''],
        ['a number', 7],
      ])('2.3.1: %s', (_name, entry) => {
        const findings = only(
          findingsOf(
            profile(['https://a.invalid/x/*'], {
              cimdConfig: {
                cimdClientIdUrlPatterns: ['https://a.invalid/x/*'],
                cimdMetadataDenyList: ['scope', entry],
              },
            })
          ),
          'DENY_LIST_UNKNOWN_FIELD'
        );
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({
          severity: 'error',
          path: '/cimdConfig/cimdMetadataDenyList/1',
        });
      });

      test('2.3.2: the message of redirect_uri names redirect_uris, the one of SCOPE says lower case', () => {
        const message = (entry: string) =>
          only(
            findingsOf(
              profile(['https://a.invalid/x/*'], {
                cimdConfig: {
                  cimdClientIdUrlPatterns: ['https://a.invalid/x/*'],
                  cimdMetadataDenyList: [entry],
                },
              })
            ),
            'DENY_LIST_UNKNOWN_FIELD'
          )[0].message;
        expect(message('redirect_uri')).toContain('redirect_uris');
        expect(message('SCOPE')).toContain('lower case');
      });

      test('2.3.3: a string instead of a list is a value type error', () => {
        const findings = findingsOf(
          profile(['https://a.invalid/x/*'], {
            cimdConfig: {
              cimdClientIdUrlPatterns: ['https://a.invalid/x/*'],
              cimdMetadataDenyList: 'scope',
            },
          })
        );
        expect(codesOf(findings)).toEqual(['VALUE_TYPE']);
        expect(findings[0].path).toBe('/cimdConfig/cimdMetadataDenyList');
      });

      test('2.3.4: duplicates and all 36 entries are accepted without a finding', () => {
        const base = (list: string[]) =>
          findingsOf(
            profile(['https://a.invalid/x/*'], {
              cimdConfig: {
                cimdClientIdUrlPatterns: ['https://a.invalid/x/*'],
                cimdMetadataDenyList: list,
              },
              coreOAuth2ClientConfig: {
                redirectionUris: ['https://a.invalid/cb'],
              },
            })
          );
        expect(base(['scope', 'scope', 'jwks'])).toEqual([]);
        expect(CIMD_METADATA_DENY_LIST_FIELDS).toHaveLength(36);
        expect(base(CIMD_METADATA_DENY_LIST_FIELDS)).toEqual([]);
      });
    });

    test('2.4: the SSRF switch as a string is a value type error', () => {
      const findings = findingsOf(
        profile(['https://a.invalid/x/*'], {
          cimdConfig: {
            cimdClientIdUrlPatterns: ['https://a.invalid/x/*'],
            cimdSsrfProtectionEnabled: 'true',
          },
        })
      );
      expect(findings).toEqual([
        expect.objectContaining({
          code: 'VALUE_TYPE',
          severity: 'error',
          path: '/cimdConfig/cimdSsrfProtectionEnabled',
        }),
      ]);
    });

    test.each([
      ['status Gone', { coreOAuth2ClientConfig: { status: 'Gone' } }, 'status'],
      [
        'status active in lower case',
        { coreOAuth2ClientConfig: { status: 'active' } },
        'status',
      ],
      [
        'an unknown subjectType',
        { advancedOAuth2ClientConfig: { subjectType: 'confidential' } },
        'subjectType',
      ],
    ])('2.5: %s', (_name, groups, attribute) => {
      const findings = only(
        findingsOf(profile(['https://a.invalid/x/*'], groups)),
        'ENUM_VALUE'
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].path).toMatch(new RegExp(`/${attribute}$`));
    });

    test.each([
      ['client_secret_basic'],
      ['client_secret_post'],
      ['client_secret_jwt'],
      ['something_else'],
      [''],
    ])('2.6: the token endpoint authentication method %p', (method) => {
      const findings = only(
        findingsOf(
          profile(['https://a.invalid/x/*'], {
            advancedOAuth2ClientConfig: { tokenEndpointAuthMethod: method },
          })
        ),
        'AUTH_METHOD_NOT_ALLOWED'
      );
      expect(findings).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: '/advancedOAuth2ClientConfig/tokenEndpointAuthMethod',
        }),
      ]);
      expect(findings[0].message).toContain('private_key_jwt');
    });

    test.each([
      ['a negative number', -1],
      ['a negative string', '-10'],
      ['a non-numeric string', 'forever'],
      ['null', null],
      ['a boolean', true],
      ['not a finite number', Infinity],
    ])('2.7: an access token lifetime that is %s', (_name, lifetime) => {
      const findings = only(
        findingsOf(
          profile(['https://a.invalid/x/*'], {
            coreOAuth2ClientConfig: { accessTokenLifetime: lifetime },
          })
        ),
        'LIFETIME_INVALID'
      );
      expect(findings).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: '/coreOAuth2ClientConfig/accessTokenLifetime',
        }),
      ]);
    });

    test('2.7b: the other token lifetimes are checked, a zero, a number and a numeric string are not errors', () => {
      const findings = findingsOf(
        profile(['https://a.invalid/x/*'], {
          coreOAuth2ClientConfig: {
            authorizationCodeLifetime: -1,
            refreshTokenLifetime: 'x',
            accessTokenLifetime: 0,
          },
        })
      );
      expect(only(findings, 'LIFETIME_INVALID').map((f) => f.path)).toEqual([
        '/coreOAuth2ClientConfig/authorizationCodeLifetime',
        '/coreOAuth2ClientConfig/refreshTokenLifetime',
      ]);
      expect(
        findingsOf(
          profile(['https://a.invalid/x/*'], {
            coreOAuth2ClientConfig: {
              accessTokenLifetime: '3600',
              refreshTokenLifetime: 604800,
            },
          })
        )
      ).toEqual([]);
    });

    test('2.8: a wildcard in a redirect URI', () => {
      const findings = findingsOf(
        profile(['https://a.invalid/x/*'], {
          coreOAuth2ClientConfig: {
            redirectionUris: [
              'https://a.invalid/ok',
              'https://*.a.invalid/callback',
            ],
          },
        })
      );
      expect(findings).toEqual([
        expect.objectContaining({
          code: 'REDIRECT_URI_WILDCARD',
          severity: 'error',
          path: '/coreOAuth2ClientConfig/redirectionUris/1',
        }),
      ]);
    });

    test('2.9: attributes the server does not accept', () => {
      const findings = only(
        findingsOf({
          ...profile(['https://a.invalid/x/*']),
          userpassword: 'x',
          _rev: '1',
          madeUp: 1,
          coreOAuth2ClientConfig: { client_secret: 'x', status: 'Active' },
        }),
        'UNKNOWN_ATTRIBUTE'
      );
      expect(findings.map((f) => f.path).sort()).toEqual([
        '/_rev',
        '/coreOAuth2ClientConfig/client_secret',
        '/madeUp',
        '/userpassword',
      ]);
      // the server refuses all four, but the library removes _rev before it sends a profile: a warning, so that a profile
      // that was read from a tenant (it carries _rev) has no error
      expect(
        findings
          .filter((f) => f.path !== '/_rev')
          .every((f) => f.severity === 'error')
      ).toBe(true);
      expect(findings.find((f) => f.path === '/_rev')).toMatchObject({
        severity: 'warning',
      });
      expect(findings.find((f) => f.path === '/_rev')?.message).toContain(
        'removes it before it sends'
      );
      // _id and _type are members of every profile
      expect(
        findingsOf({
          ...profile(['https://a.invalid/x/*']),
          _id: 'p',
          _type: { _id: 'CIMDProfile', name: 'CIMD Profile', collection: true },
        })
      ).toEqual([]);
    });

    test('2.10: a group that is not an object', () => {
      const findings = findingsOf({
        cimdConfig: { cimdClientIdUrlPatterns: ['https://a.invalid/x/*'] },
        coreOAuth2ClientConfig: 'Active',
      });
      expect(findings).toEqual([
        expect.objectContaining({
          code: 'VALUE_TYPE',
          path: '/coreOAuth2ClientConfig',
        }),
      ]);
    });
  });

  describe('3: what the server accepts although it should not be accepted unnoticed (warnings)', () => {
    const one = (entry: string, code: CIMDProfileFindingCode) =>
      only(findingsOf(profile([entry])), code);

    test.each([
      ['a whole-host wildcard', 'https://*/*'],
      ['a wildcard subdomain', 'https://*.example.invalid/*'],
    ])('3.1: %s', (_name, entry) => {
      const findings = one(entry, 'PATTERN_WHOLE_HOST_WILDCARD');
      expect(findings).toEqual([
        expect.objectContaining({
          severity: 'warning',
          path: `${URL_PATTERNS}/0`,
        }),
      ]);
    });

    test.each([
      ['a pattern with no path', 'https://a.invalid'],
      ['a pattern with a root path only', 'https://a.invalid/'],
    ])('3.2: %s', (_name, entry) => {
      expect(one(entry, 'PATTERN_NO_PATH')).toHaveLength(1);
      expect(one(entry, 'PATTERN_NO_PATH')[0].severity).toBe('warning');
    });

    test.each([
      ['a query string', 'https://a.invalid/x?y=1'],
      ['a fragment', 'https://a.invalid/x#frag'],
      ['user info', 'https://user@a.invalid/x/*'],
    ])('3.3: %s', (_name, entry) => {
      expect(one(entry, 'PATTERN_QUERY_FRAGMENT_USERINFO')).toHaveLength(1);
    });

    test.each([
      ['a dot segment', 'https://a.invalid/x/./y'],
      ['a double dot segment', 'https://a.invalid/x/../y/*'],
    ])('3.4: %s', (_name, entry) => {
      expect(one(entry, 'PATTERN_DOT_SEGMENTS')).toHaveLength(1);
    });

    test.each([
      ['localhost', 'https://localhost/x/*'],
      ['127.0.0.1', 'https://127.0.0.1/x/*'],
      ['an IPv4 literal', 'https://10.0.0.7/x/*'],
      ['an IPv6 literal', 'https://[::1]/x/*'],
      ['a port out of range', 'https://a.invalid:99999/x/*'],
    ])('3.5: %s', (_name, entry) => {
      const findings = one(entry, 'PATTERN_LOCAL_ADDRESS');
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('warning');
    });

    test('3.5b: accepted without a finding: port 443, an upper-case host, a long pattern, 300 entries', () => {
      expect(findingsOf(profile(['https://a.invalid:443/x/*']))).toEqual([]);
      expect(findingsOf(profile(['https://A.Example.INVALID/x/*']))).toEqual(
        []
      );
      expect(
        findingsOf(profile([`https://a.invalid/${'x'.repeat(9000)}`]))
      ).toEqual([]);
      const many = Array.from(
        { length: 300 },
        (_v, i) => `https://host${i}.example.invalid/clients/*`
      );
      expect(findingsOf(profile(many))).toEqual([]);
      expect(
        findingsOf(profile(many.slice(0, 50).concat(['https://a.invalid/x/*'])))
      ).toEqual([]);
    });

    test('3.6: the same pattern twice', () => {
      const findings = only(
        findingsOf(
          profile([
            'https://a.invalid/x/*',
            'https://b.invalid/x/*',
            'https://a.invalid/x/*',
          ])
        ),
        'PATTERN_DUPLICATE'
      );
      expect(findings).toEqual([
        expect.objectContaining({
          severity: 'warning',
          path: `${URL_PATTERNS}/2`,
        }),
      ]);
      expect(findings[0].message).toContain('entry 0');
    });

    test.each([
      ['false', false],
      ['null', null],
    ])('3.7: the SSRF protection is %s', (_name, value) => {
      const findings = findingsOf(
        profile(['https://a.invalid/x/*'], {
          cimdConfig: {
            cimdClientIdUrlPatterns: ['https://a.invalid/x/*'],
            cimdSsrfProtectionEnabled: value,
          },
        })
      );
      expect(findings).toEqual([
        expect.objectContaining({
          code: 'SSRF_PROTECTION_DISABLED',
          severity: 'warning',
          path: '/cimdConfig/cimdSsrfProtectionEnabled',
        }),
      ]);
    });

    test('3.7b: an inherited SSRF switch reads as absent: no finding', () => {
      expect(
        findingsOf({
          cimdConfig: {
            cimdClientIdUrlPatterns: ['https://a.invalid/x/*'],
            cimdSsrfProtectionEnabled: { inherited: true, value: false },
          },
        })
      ).toEqual([]);
    });

    test('3.8: redirect_uris on the deny list while the profile has no redirect URI', () => {
      const deny = (extra: Record<string, unknown> = {}) =>
        findingsOf(
          profile(['https://a.invalid/x/*'], {
            cimdConfig: {
              cimdClientIdUrlPatterns: ['https://a.invalid/x/*'],
              cimdMetadataDenyList: ['redirect_uris'],
            },
            ...extra,
          })
        );
      expect(deny()).toEqual([
        expect.objectContaining({
          code: 'REDIRECT_URIS_DENIED_BUT_EMPTY',
          severity: 'warning',
          path: '/cimdConfig/cimdMetadataDenyList',
        }),
      ]);
      expect(
        codesOf(deny({ coreOAuth2ClientConfig: { redirectionUris: [] } }))
      ).toEqual(['REDIRECT_URIS_DENIED_BUT_EMPTY']);
      expect(
        deny({
          coreOAuth2ClientConfig: { redirectionUris: ['https://a.invalid/cb'] },
        })
      ).toEqual([]);
    });

    test.each([
      ['an unknown value', 'made_up_grant'],
      ['password', 'password'],
    ])('3.9: the grant type %s', (_name, grant) => {
      const findings = findingsOf(
        profile(['https://a.invalid/x/*'], {
          advancedOAuth2ClientConfig: {
            grantTypes: ['authorization_code', grant],
          },
        })
      );
      expect(findings).toEqual([
        expect.objectContaining({
          code: 'GRANT_TYPE_UNKNOWN',
          severity: 'warning',
          path: '/advancedOAuth2ClientConfig/grantTypes/1',
        }),
      ]);
    });

    test('3.10: an http:// redirect URI', () => {
      const findings = findingsOf(
        profile(['https://a.invalid/x/*'], {
          coreOAuth2ClientConfig: { redirectionUris: ['http://a.invalid/cb'] },
        })
      );
      expect(findings).toEqual([
        expect.objectContaining({
          code: 'REDIRECT_URI_NOT_HTTPS',
          severity: 'warning',
          path: '/coreOAuth2ClientConfig/redirectionUris/0',
        }),
      ]);
    });

    test('3.11: accepted without a finding: empty grant types, empty response types, private_key_jwt, status Inactive', () => {
      expect(
        findingsOf(
          profile(['https://a.invalid/x/*'], {
            coreOAuth2ClientConfig: { status: 'Inactive' },
            advancedOAuth2ClientConfig: {
              grantTypes: [],
              responseTypes: [],
              tokenEndpointAuthMethod: 'private_key_jwt',
            },
          })
        )
      ).toEqual([]);
    });
  });

  describe('4: the patterns of the other profiles', () => {
    const others = [
      { _id: 'other-a', ...profile(['https://a.invalid/clients/*']) },
      { _id: 'other-b', ...profile(['https://b.invalid/x/*']) },
      { _id: 'other-wide', ...profile(['https://c.invalid/*']) },
    ];
    const overlaps = (patterns: string[], list: unknown[] = others) =>
      only(findingsOf(profile(patterns), list), 'PATTERN_OVERLAPS_PROFILE');

    test('4.1: an identical pattern', () => {
      const findings = overlaps(['https://a.invalid/clients/*']);
      expect(findings).toEqual([
        expect.objectContaining({
          severity: 'warning',
          path: `${URL_PATTERNS}/0`,
        }),
      ]);
      expect(findings[0].message).toContain('identical to');
      expect(findings[0].message).toContain('other-a');
      expect(findings[0].message).toContain('invalid_client');
    });

    test('4.2: a pattern inside a pattern of another profile (a sub-path)', () => {
      const findings = overlaps(['https://c.invalid/deeper/path/*']);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('inside');
      expect(findings[0].message).toContain('other-wide');
    });

    test('4.3: a pattern around a pattern of another profile (a super-set)', () => {
      const findings = overlaps(['https://b.invalid/*']);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('around');
      expect(findings[0].message).toContain('other-b');
    });

    test('4.4: disjoint patterns give no finding', () => {
      expect(
        overlaps(['https://d.invalid/x/*', 'https://a.invalid/other/*'])
      ).toEqual([]);
    });

    test('4.5: without the other profiles the overlap checks do not run', () => {
      expect(
        only(
          findingsOf(profile(['https://a.invalid/clients/*'])),
          'PATTERN_OVERLAPS_PROFILE'
        )
      ).toEqual([]);
    });

    test('4.6: a profile does not overlap itself (the same _id is skipped)', () => {
      expect(
        only(
          findingsOf(
            { _id: 'other-a', ...profile(['https://a.invalid/clients/*']) },
            others
          ),
          'PATTERN_OVERLAPS_PROFILE'
        )
      ).toEqual([]);
    });

    test('4.7: the other profiles may be wrapped, malformed or without patterns', () => {
      const messy = [
        null,
        'x',
        { _id: 'no-patterns' },
        {
          _id: 'wrapped',
          cimdConfig: {
            cimdClientIdUrlPatterns: {
              inherited: false,
              value: ['https://e.invalid/x/*'],
            },
          },
        },
        {
          _id: 'inherited',
          cimdConfig: { cimdClientIdUrlPatterns: { inherited: true } },
        },
        {
          _id: 'mixed',
          cimdConfig: {
            cimdClientIdUrlPatterns: [1, null, 'https://f.invalid/x/*'],
          },
        },
      ];
      expect(
        overlaps(['https://e.invalid/x/*', 'https://f.invalid/x/*'], messy).map(
          (f) => f.path
        )
      ).toEqual([`${URL_PATTERNS}/0`, `${URL_PATTERNS}/1`]);
    });

    test('4.8: the closest relation of a pattern to one profile is reported once', () => {
      const list = [
        {
          _id: 'x',
          ...profile(['https://g.invalid/*', 'https://g.invalid/a/*']),
        },
      ];
      const findings = overlaps(['https://g.invalid/a/*'], list);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('identical to');
    });

    test('4.9: the wildcard matcher', () => {
      expect(
        matchesWildcardPattern('https://a.invalid/*', 'https://a.invalid/x/y')
      ).toBe(true);
      expect(
        matchesWildcardPattern('https://a.invalid/*', 'https://a.invalid/')
      ).toBe(true);
      expect(
        matchesWildcardPattern('https://a.invalid/x', 'https://a.invalid/x/y')
      ).toBe(false);
      expect(matchesWildcardPattern('*', 'anything')).toBe(true);
      expect(matchesWildcardPattern('a*b*c', 'axxbyyc')).toBe(true);
      expect(matchesWildcardPattern('a*b*c', 'axxbyy')).toBe(false);
      expect(matchesWildcardPattern('**', '')).toBe(true);
      expect(matchesWildcardPattern('a', '')).toBe(false);
      // many wildcards on a long text must not be slow
      const start = Date.now();
      matchesWildcardPattern('*a*a*a*a*a*a*a*a*b', 'a'.repeat(5000));
      expect(Date.now() - start).toBeLessThan(500);
    });
  });

  describe('5: with and without the schema', () => {
    const schema = {
      type: 'object',
      properties: {
        cimdConfig: {
          properties: {
            cimdClientIdUrlPatterns: {},
            cimdSsrfProtectionEnabled: {},
            cimdMetadataDenyList: { items: { enum: ['scope', 'jwks'] } },
          },
        },
        coreOAuth2ClientConfig: {
          properties: {
            status: { enum: ['Active', 'Inactive', 'Suspended'] },
            accessTokenLifetime: {},
            redirectionUris: {},
          },
        },
        advancedOAuth2ClientConfig: {
          properties: {
            tokenEndpointAuthMethod: { enum: ['none', 'client_secret_basic'] },
            subjectType: { enum: ['public'] },
            grantTypes: { items: { enum: ['authorization_code'] } },
          },
        },
      },
    };
    const withSchema = (groups: Record<string, Record<string, unknown>>) =>
      findingsOf(profile(['https://a.invalid/x/*'], groups), undefined, schema);
    const withoutSchema = (groups: Record<string, Record<string, unknown>>) =>
      findingsOf(profile(['https://a.invalid/x/*'], groups));

    test('5.1: the deny list entries come from the schema when it is supplied', () => {
      const groups = {
        cimdConfig: {
          cimdClientIdUrlPatterns: ['https://a.invalid/x/*'],
          cimdMetadataDenyList: ['scope', 'client_name'],
        },
        coreOAuth2ClientConfig: { redirectionUris: ['https://a.invalid/cb'] },
      };
      expect(codesOf(withSchema(groups))).toEqual(['DENY_LIST_UNKNOWN_FIELD']);
      expect(withSchema(groups)[0].path).toBe(
        '/cimdConfig/cimdMetadataDenyList/1'
      );
      expect(withoutSchema(groups)).toEqual([]);
    });

    test('5.2: the allowed values of status, subjectType and the authentication method come from the schema', () => {
      const groups = {
        coreOAuth2ClientConfig: { status: 'Suspended' },
        advancedOAuth2ClientConfig: {
          subjectType: 'pairwise',
          tokenEndpointAuthMethod: 'client_secret_basic',
        },
      };
      expect(codesOf(withSchema(groups))).toEqual(['ENUM_VALUE']);
      expect(withSchema(groups)[0].path).toBe(
        '/advancedOAuth2ClientConfig/subjectType'
      );
      // without the schema the library values apply: Suspended is no status, pairwise is a subject type, and
      // client_secret_basic is refused
      expect(
        withoutSchema(groups)
          .map((f) => `${f.code} ${f.path}`)
          .sort()
      ).toEqual([
        'AUTH_METHOD_NOT_ALLOWED /advancedOAuth2ClientConfig/tokenEndpointAuthMethod',
        'ENUM_VALUE /coreOAuth2ClientConfig/status',
      ]);
    });

    test('5.3: the grant types come from the schema', () => {
      const groups = {
        advancedOAuth2ClientConfig: {
          grantTypes: ['authorization_code', 'refresh_token'],
        },
      };
      expect(codesOf(withSchema(groups))).toEqual(['GRANT_TYPE_UNKNOWN']);
      expect(withoutSchema(groups)).toEqual([]);
    });

    test('5.4: an attribute that the schema does not have is an error, and only with the schema', () => {
      const groups = {
        coreOAuth2ClientConfig: { madeUpAttribute: 1, status: 'Active' },
      };
      expect(withSchema(groups)).toEqual([
        expect.objectContaining({
          code: 'UNKNOWN_ATTRIBUTE',
          severity: 'error',
          path: '/coreOAuth2ClientConfig/madeUpAttribute',
        }),
      ]);
      expect(withoutSchema(groups)).toEqual([]);
    });

    test('5.5: a schema without the enum falls back to the library values, a malformed schema is ignored', () => {
      const groups = { coreOAuth2ClientConfig: { status: 'Gone' } };
      for (const bad of [
        {},
        { properties: null },
        'x',
        null,
        { properties: { coreOAuth2ClientConfig: 7 } },
      ]) {
        expect(
          codesOf(
            findingsOf(
              profile(['https://a.invalid/x/*'], groups),
              undefined,
              bad
            )
          )
        ).toEqual(['ENUM_VALUE']);
      }
    });

    test('5.6: the values the library knows are the values of the recorded schema (AM 9.0.0)', () => {
      const root = path.resolve(
        path.dirname(new URL(import.meta.url).pathname),
        '../test/mock-recordings/OAuth2CIMDProfileApi_4244252888'
      );
      const found: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (
            entry.name === 'recording.har' &&
            /getCIMDProfileSchema/.test(full)
          )
            found.push(full);
        }
      };
      walk(root);
      expect(found.length).toBeGreaterThan(0);
      const har = JSON.parse(fs.readFileSync(found[0], 'utf8'));
      const entry = har.log.entries.find((e: any) =>
        /schema/.test(e.request.url)
      );
      const recorded = JSON.parse(entry.response.content.text);
      const enumOf = (group: string, name: string) => {
        const p = recorded.properties[group].properties[name];
        return p.enum ?? p.items.enum;
      };
      expect(CIMD_METADATA_DENY_LIST_FIELDS).toEqual(
        enumOf('cimdConfig', 'cimdMetadataDenyList')
      );
      expect(CIMD_STATUS_VALUES).toEqual(
        enumOf('coreOAuth2ClientConfig', 'status')
      );
      expect(CIMD_SUBJECT_TYPES).toEqual(
        enumOf('advancedOAuth2ClientConfig', 'subjectType')
      );
      expect(CIMD_TOKEN_ENDPOINT_AUTH_METHODS).toEqual(
        enumOf('advancedOAuth2ClientConfig', 'tokenEndpointAuthMethod')
      );
      expect(CIMD_GRANT_TYPES).toEqual(
        enumOf('advancedOAuth2ClientConfig', 'grantTypes')
      );
      // and the recorded schema itself gives no finding for a clean profile
      expect(findingsOf(CLEAN, undefined, recorded)).toEqual([]);
    });
  });

  describe('6: real answers of a tenant', () => {
    const mocks = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      '../test/mocks/OAuth2CIMDProfileApi'
    );
    const fixture = (file: string) =>
      JSON.parse(fs.readFileSync(path.resolve(mocks, file), 'utf8'));

    test.each([
      'getCIMDProfile/rich.json',
      'getCIMDProfile/minimal-create.json',
      'getCIMDProfile/sparse.json',
      'getCIMDProfiles/item.json',
      'getCIMDProfiles/item-sparse.json',
    ])('6.1: %s (a profile as the server stored it) gives no error', (file) => {
      const findings = findingsOf(fixture(file));
      expect(findings.filter((f) => f.severity === 'error')).toEqual([]);
    });
  });

  describe('7: the wording', () => {
    test('7.1: no message names an option, a command or an environment variable of a caller', () => {
      const findings = findingsOf(
        profile(
          [
            'https://*/*',
            'http://x',
            'https://a.invalid',
            'https://localhost/x?y#z',
            'https://h:*/x',
          ],
          {
            cimdConfig: {
              cimdClientIdUrlPatterns: [
                'https://*/*',
                'http://x',
                'https://a.invalid',
                'https://localhost/x?y#z',
                'https://h:*/x',
              ],
              cimdMetadataDenyList: ['redirect_uri', 'redirect_uris'],
              cimdSsrfProtectionEnabled: false,
            },
            coreOAuth2ClientConfig: {
              status: 'x',
              accessTokenLifetime: -1,
              redirectionUris: ['http://a/*'],
            },
            advancedOAuth2ClientConfig: {
              tokenEndpointAuthMethod: 'x',
              subjectType: 'x',
              grantTypes: ['x'],
            },
          }
        ),
        [{ _id: 'o', ...profile(['https://a.invalid']) }]
      );
      expect(new Set(codesOf(findings)).size).toBeGreaterThan(12);
      for (const finding of findings) {
        expect(finding.message).not.toMatch(
          /(^|\s)--?[a-z]|frodo |conn save|FRODO_|\bcli\b/i
        );
      }
    });
  });
});
