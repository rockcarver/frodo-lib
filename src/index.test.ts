import * as root from './index';
import type { McpCapabilityDescriptor, TerminalContrastFilter } from './index';

describe('package root exports', () => {
  test('exports only the supported runtime values', () => {
    expect(Object.keys(root).sort()).toEqual(['FrodoError', 'frodo', 'state']);
  });

  test('preserves type-only exports', () => {
    const types: [
      TerminalContrastFilter | undefined,
      McpCapabilityDescriptor | undefined,
    ] = [undefined, undefined];
    expect(types).toEqual([undefined, undefined]);
  });
});
