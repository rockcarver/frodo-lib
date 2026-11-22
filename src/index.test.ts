import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as root from './index';
import type { McpCapabilityDescriptor, TerminalContrastFilter } from './index';

const POLICY_FILE = 'CONTRIBUTE.md';
const INTEROP_RECORD =
  'https://github.com/rockcarver/frodo-lib/blob/main/decisions/0020-frodo-lib-ships-one-es-module-build-that-commonjs-programs-can-require.md';

describe('package root exports', () => {
  test('exports only the supported runtime values and the one interoperability slot', () => {
    const actual = Object.keys(root).sort();
    const expected = ['FrodoError', 'frodo', 'module.exports', 'state'];
    if (actual.join(',') !== expected.join(',')) {
      throw new Error(
        `Unexpected package root runtime exports: ${actual.join(', ')}. New capabilities belong on the facade (frodo.<domain>...), not at the package root. See ${POLICY_FILE}. The one allowed addition is the 'module.exports' slot that require() returns (${INTEROP_RECORD}).`
      );
    }
  });

  test("the 'module.exports' slot is a plain, mutable object", () => {
    const slot = root['module.exports'];
    expect(Object.getPrototypeOf(slot)).toBe(Object.prototype);
    expect(Object.isFrozen(slot)).toBe(false);
    expect(Object.isSealed(slot)).toBe(false);
    expect(Object.isExtensible(slot)).toBe(true);
    expect(slot.hasOwnProperty('frodo')).toBe(true);
    expect(String(slot)).toBe('[object Object]');
  });

  test("the 'module.exports' slot holds the named exports and nothing else", () => {
    const slot = root['module.exports'];
    expect(Object.keys(slot).sort()).toEqual(['FrodoError', 'frodo', 'state']);
    expect(slot.FrodoError).toBe(root.FrodoError);
    expect(slot.frodo).toBe(root.frodo);
    expect(slot.state).toBe(root.state);
  });

  test("changing the 'module.exports' slot does not change the named exports", () => {
    const slot = root['module.exports'] as Record<string, unknown>;
    const original = { ...slot };
    const stub = { stub: true };
    try {
      slot.frodo = stub;
      expect(slot.frodo).toBe(stub);
      Object.defineProperty(slot, 'state', { value: stub, configurable: true });
      expect(slot.state).toBe(stub);
      delete slot.FrodoError;
      expect('FrodoError' in slot).toBe(false);
      expect(root.frodo).not.toBe(stub);
      expect(root.state).not.toBe(stub);
      expect(typeof root.FrodoError).toBe('function');
    } finally {
      Object.assign(slot, original);
    }
  });

  test('references an existing policy file and an existing record from the guard message', () => {
    const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
    const policyFilePath = resolve(repositoryRoot, POLICY_FILE);
    if (!existsSync(policyFilePath)) {
      throw new Error(
        `The package root export guard text points at a missing file: ${POLICY_FILE}.`
      );
    }
    const recordFile = INTEROP_RECORD.split('/').pop() as string;
    if (!existsSync(resolve(repositoryRoot, 'decisions', recordFile))) {
      throw new Error(
        `The package root export guard text points at a missing record: decisions/${recordFile}.`
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
