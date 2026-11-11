/**
 * Run tests
 *
 *        npm run test:only CapabilityRegistry.resultCollector
 *
 * Guard for the collecting result callback of the MCP runtime (frodo-lib#957).
 *
 * A bulk function of the facade takes a `resultCallback`, which an MCP caller
 * cannot send. The runtime must pass a collector in its place, or the function
 * throws at the first failed item and the caller loses the readable part. This
 * walks every capability of the registry, finds the functions that take a
 * result callback from the source of the facade function itself (not from the
 * metadata that is under test), and drives each one through the real runtime:
 * the function must receive a callback at the position where it takes it, and
 * what it reports to that callback must come back in the tool result. A new
 * function with a result callback is covered without a list to extend; a new
 * function that the runtime would not give a collector to fails here.
 * Unit test: no recordings, no tenant.
 */
import { frodo } from '../lib/FrodoLib';
import { FrodoError } from '../ops/FrodoError';
import { getHelpMetadataByMethod } from '../utils/HelpUtils';
import {
  buildCapabilityInventory,
  findResultCallbackPosition,
} from './CapabilityRegistry';
import type { McpCapabilityDescriptor } from './CapabilityTypes';
import { buildToolManifest } from './ToolManifest';
import { createToolRuntime } from './ToolRuntime';

/**
 * The parameter names of a function, read from its source: the text between
 * the first parenthesis and its matching one, split at the commas outside of
 * brackets, up to the default value.
 */
function parameterNamesOf(fn: (...args: any[]) => unknown): string[] {
  const source = fn.toString();
  const open = source.indexOf('(');
  if (open === -1) {
    return [];
  }
  let depth = 0;
  let current = '';
  const parts: string[] = [];
  for (let i = open; i < source.length; i++) {
    const char = source[i];
    if (char === '(' || char === '[' || char === '{') depth++;
    if (char === ')' || char === ']' || char === '}') depth--;
    if (depth === 0) {
      break;
    }
    if (depth === 1 && char === ',') {
      parts.push(current);
      current = '';
    } else if (!(i === open)) {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current);
  }
  return parts.map((part) => part.trim().split('=')[0].trim());
}

function resolveMethod(root: any, capability: McpCapabilityDescriptor) {
  let node = root;
  for (const segment of capability.modulePath) {
    node = node?.[segment];
  }
  const method = node?.[capability.methodName];
  return typeof method === 'function' ? method : undefined;
}

const READ_ONLY = ['count', 'read', 'list', 'search'];

type Walk = {
  /** The capabilities whose facade function takes a result callback. */
  covered: string[];
  /** What is wrong with them. */
  gaps: string[];
};

/**
 * Checks, for every capability of `root`, that the runtime gives the facade
 * function a collecting callback where it takes its result callback.
 */
async function walkCapabilities(
  root: any,
  capabilities: McpCapabilityDescriptor[]
): Promise<Walk> {
  const walk: Walk = { covered: [], gaps: [] };
  for (const capability of capabilities) {
    const method = resolveMethod(root, capability);
    if (!method) {
      continue;
    }
    const names = parameterNamesOf(method);
    const position = names.indexOf('resultCallback');
    if (position === -1) {
      continue;
    }
    walk.covered.push(capability.id);

    const found = findResultCallbackPosition(capability.methodName);
    if (found !== position) {
      walk.gaps.push(
        `${capability.id}: the function takes its result callback at ${position}, the registry finds ${found}`
      );
    }
    const last = position === names.length - 1;
    if (
      last &&
      (capability.parameters ?? []).some((it) => it.name === 'resultCallback')
    ) {
      walk.gaps.push(
        `${capability.id}: the descriptor offers the result callback to MCP callers`
      );
    }

    // drive the real runtime against a function that reports one failed item
    const seen: { args?: unknown[] } = {};
    const stub: any = { login: { getTokens: async () => undefined } };
    let node = stub;
    for (const segment of capability.modulePath) {
      node = node[segment] = {};
    }
    node[capability.methodName] = async (...args: unknown[]) => {
      seen.args = args;
      const callback = args[position];
      if (typeof callback === 'function') {
        callback(new FrodoError('Error exporting something'));
      }
      return undefined;
    };
    const runtime = createToolRuntime(
      buildToolManifest([capability]),
      [capability],
      {} as any,
      { resolveFrodoForRequest: () => stub }
    );
    const mode = capability.argumentMode;
    const result = await runtime
      .executeTool({
        toolName: READ_ONLY.includes(capability.operationType)
          ? 'frodo_dispatch_read_only'
          : 'frodo_dispatch',
        arguments: {
          skillId: capability.id,
          ...(mode === 'named'
            ? { namedArgs: {} }
            : mode === 'none'
              ? {}
              : { positionalArgs: [] }),
        },
        context: { auth: { mode: 'state-config', config: {} } } as any,
      })
      .catch((error: Error) => error);
    if (result instanceof Error) {
      walk.gaps.push(
        `${capability.id}: could not be driven with empty arguments: ${result.message}`
      );
    } else if (typeof seen.args?.[position] !== 'function') {
      walk.gaps.push(
        `${capability.id}: the runtime passes no callback at position ${position} (it passed ${JSON.stringify(seen.args)})`
      );
    } else if (result.itemResults?.failedCount !== 1 || !result.partial) {
      walk.gaps.push(
        `${capability.id}: what the function reports to its result callback is not in the tool result`
      );
    }
  }
  return walk;
}

describe('every function of the facade that takes a result callback', () => {
  const capabilities = buildCapabilityInventory(frodo, { includeUtils: false });

  test('1: gets a collecting callback from the runtime where it takes it, and what it reports comes back', async () => {
    const { covered, gaps } = await walkCapabilities(frodo, capabilities);

    expect(gaps).toEqual([]);
    // the walk is not empty: these are bulk functions of every family, among them the full export
    expect(covered).toEqual(
      expect.arrayContaining([
        'config.exportFullConfiguration',
        'config.importFullConfiguration',
        'authn.journey.exportJourneys',
        'authn.journey.importJourneys',
        'script.exportScripts',
        'script.deleteScripts',
        'idm.mapping.importMappings',
        'service.getFullServices',
      ])
    );
    expect(covered.length).toBeGreaterThan(40);
  });

  test('2: is found from the signature that Help.ts is generated from, at the position of the parameter', () => {
    const disagreements: string[] = [];
    for (const capability of capabilities) {
      const method = resolveMethod(frodo, capability);
      if (!method) continue;
      const position = parameterNamesOf(method).indexOf('resultCallback');
      const documented = getHelpMetadataByMethod(capability.methodName)[0]
        ?.params.map((param) => param.name)
        .indexOf('resultCallback');
      if (position !== -1 && documented !== position) {
        disagreements.push(
          `${capability.id}: ${position} in the source, ${documented} in Help.ts`
        );
      }
      if (position === -1 && documented !== undefined && documented !== -1) {
        disagreements.push(
          `${capability.id}: Help.ts has a result callback the function does not`
        );
      }
    }
    expect(disagreements).toEqual([]);
  });

  test('3: a trailing one is never offered to an MCP caller, whatever the metadata says', () => {
    const offered = capabilities
      .filter((capability) => {
        const method = resolveMethod(frodo, capability);
        const names = method ? parameterNamesOf(method) : [];
        return names[names.length - 1] === 'resultCallback';
      })
      .filter((capability) =>
        (capability.parameters ?? []).some(
          (parameter) => parameter.name === 'resultCallback'
        )
      )
      .map((capability) => capability.id);
    expect(offered).toEqual([]);
  });
});

describe('the guard itself', () => {
  test('4: a new function with a result callback that the registry knows nothing about is reported', async () => {
    // not in Help.ts: Help.ts is regenerated from the TSDoc of the public type, and a function that
    // is missing there would silently get no collector
    const root = {
      widget: {
        async exportWidgets(options: unknown, resultCallback: unknown) {
          return [options, resultCallback];
        },
        async readWidget(id: string) {
          return id;
        },
      },
    };
    const capabilities = buildCapabilityInventory(root as any);
    expect(capabilities.map((it) => it.id)).toEqual([
      'widget.exportWidgets',
      'widget.readWidget',
    ]);

    const { covered, gaps } = await walkCapabilities(root, capabilities);

    expect(covered).toEqual(['widget.exportWidgets']);
    expect(gaps).toEqual([
      'widget.exportWidgets: the function takes its result callback at 1, the registry finds undefined',
      expect.stringContaining(
        'widget.exportWidgets: the runtime passes no callback at position 1'
      ),
    ]);
  });

  test('5: a function that the registry knows is not reported', async () => {
    const root = {
      script: {
        // the parameters of the facade function, in the order of Help.ts
        async exportScripts(options: unknown, resultCallback: unknown) {
          return [options, resultCallback];
        },
      },
    };
    const capabilities = buildCapabilityInventory(root as any);

    const { covered, gaps } = await walkCapabilities(root, capabilities);

    expect(covered).toEqual(['script.exportScripts']);
    expect(gaps).toEqual([]);
  });

  test('6: a function whose parameters are read from a default value with parentheses', () => {
    async function bulk(
      options = Object.assign({}, { a: [1, 2] }),
      resultCallback = void 0
    ) {
      return [options, resultCallback];
    }
    expect(parameterNamesOf(bulk)).toEqual(['options', 'resultCallback']);
    expect(parameterNamesOf(() => undefined)).toEqual([]);
  });
});
