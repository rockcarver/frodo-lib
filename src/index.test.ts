import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as root from './index';
import type { McpCapabilityDescriptor, TerminalContrastFilter } from './index';

const POLICY_FILE = 'CONTRIBUTE.md';

describe('package root exports', () => {
  test('exports only the supported runtime values', () => {
    const actual = Object.keys(root).sort();
    const expected = ['FrodoError', 'frodo', 'state'];
    if (actual.join(',') !== expected.join(',')) {
      throw new Error(
        `Unexpected package root runtime exports: ${actual.join(', ')}. New capabilities belong on the facade (frodo.<domain>...), not at the package root. See ${POLICY_FILE}.`
      );
    }
  });

  test('references an existing policy file from the guard message', () => {
    const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
    const policyFilePath = resolve(repositoryRoot, POLICY_FILE);
    if (!existsSync(policyFilePath)) {
      throw new Error(
        `The package root export guard text points at a missing file: ${POLICY_FILE}.`
      );
    }
  });

  test('preserves type-only exports', () => {
    const types: [
      TerminalContrastFilter | undefined,
      McpCapabilityDescriptor | undefined,
    ] = [undefined, undefined];
    expect(types).toEqual([undefined, undefined]);
  });
});
