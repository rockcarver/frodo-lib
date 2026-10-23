import * as root from './index';
import type { McpCapabilityDescriptor, TerminalContrastFilter } from './index';

describe('package root exports', () => {
  test('exports only the supported runtime values', () => {
    const actual = Object.keys(root).sort();
    const expected = ['FrodoError', 'frodo', 'state'];
    if (actual.join(',') !== expected.join(',')) {
      throw new Error(
        `Unexpected package root runtime exports: ${actual.join(', ')}. New capabilities belong on the facade (frodo.<domain>...), not at the package root. See CONTRIBUT\u0045.md.`
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
