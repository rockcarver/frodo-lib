/**
 * Verifies docs-target resolution: which product, whether it's versioned, and
 * (for versioned products) which version — including the specific failure
 * modes this module exists to avoid (AIC's version-lookahead, self-managed's
 * stale-index problem).
 */

import { parseAmDocsVersion, resolveDocsContext } from './DocsContext';

describe('parseAmDocsVersion', () => {
  test('extracts major.minor from state.getAmVersion()\'s clean semantic version string', () => {
    expect(parseAmDocsVersion('7.5.0')).toBe('7.5');
    expect(parseAmDocsVersion('8.1.2')).toBe('8.1');
  });

  test('returns undefined for missing or unparseable input', () => {
    expect(parseAmDocsVersion(undefined)).toBeUndefined();
    expect(parseAmDocsVersion('')).toBeUndefined();
    expect(parseAmDocsVersion('not a version')).toBeUndefined();
  });

  test('treats the "0.0.0" unknown-version sentinel as unresolved', () => {
    expect(parseAmDocsVersion('0.0.0')).toBeUndefined();
  });
});

describe('resolveDocsContext', () => {
  test('cloud always resolves to the unversioned pingoneaic docset, ignoring any reported version', () => {
    const result = resolveDocsContext('cloud', '9.0.0');
    expect(result).toMatchObject({
      product: 'pingoneaic',
      versioned: false,
      llmsTxtUrl: 'https://docs.pingidentity.com/pingoneaic/llms.txt',
    });
    expect((result as { version?: string }).version).toBeUndefined();
    // The whole point: a version that runs ahead of any public release must
    // never leak into the resolved context.
    expect(JSON.stringify(result)).not.toContain('9.0.0');
  });

  test('classic resolves to a versioned pingam target when a version is available', () => {
    const result = resolveDocsContext('classic', '7.5.0');
    expect(result).toMatchObject({
      product: 'pingam',
      versioned: true,
      version: '7.5',
      llmsTxtUrl: 'https://docs.pingidentity.com/pingam/llms.txt',
    });
    expect((result as { notes: string }).notes).toContain('7.5');
  });

  test('classic is explicitly unresolved (not a silent guess) when no version is available', () => {
    const result = resolveDocsContext('classic', undefined);
    expect(result).toEqual({
      product: null,
      unresolved: true,
      reason: expect.stringContaining('could not be determined'),
    });
  });

  test('forgeops is explicitly unresolved, not silently mapped to either product', () => {
    const result = resolveDocsContext('forgeops', '7.5.0');
    expect(result).toEqual({
      product: null,
      unresolved: true,
      reason: expect.stringContaining('forgeops'),
    });
  });

  test('an unknown deployment type is explicitly unresolved', () => {
    const result = resolveDocsContext(undefined, undefined);
    expect(result).toEqual({
      product: null,
      unresolved: true,
      reason: expect.stringContaining('unknown'),
    });
  });
});
