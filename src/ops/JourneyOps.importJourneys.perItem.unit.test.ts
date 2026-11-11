import { jest } from '@jest/globals';

/**
 * `importJourneys` with a result callback treats every journey as an item of its own (frodo-lib#957).
 *
 * - An invalid journey, a journey that needs a journey that is neither installed nor in the import data, and a journey
 *   that needs a journey of the batch that failed are reported to the callback as errors that name the journey and are
 *   not written; every other journey is imported, in the order of its dependencies; the imported ones are returned.
 * - Failing to list the installed journeys still throws.
 * - Without a callback nothing changes: the batch is rejected before anything is written, and a journey that cannot be
 *   written ends the import with its error. Those tests pin the behaviour that was there before.
 *
 * Mocked unit test: no recordings, no tenant.
 */

const getTreesMock: any = jest.fn();
const putTreeMock: any = jest.fn();
const updateNodeMock: any = jest.fn();
const printMessageMock: any = jest.fn();

jest.unstable_mockModule('../api/TreeApi', () => ({
  deleteTree: jest.fn(),
  getTree: jest.fn(),
  getTrees: getTreesMock,
  getTreesCount: jest.fn(),
  putTree: putTreeMock,
}));

jest.unstable_mockModule('./NodeOps', () => ({
  importCustomNodes: jest.fn(),
  readCustomNode: jest.fn(),
  readNode: jest.fn(),
  readNodes: jest.fn(),
  updateNode: updateNodeMock,
  deleteNode: jest.fn(),
}));

const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  createProgressIndicator: jest.fn(() => 'progress-id'),
  debugMessage: jest.fn(),
  printMessage: printMessageMock,
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
  verboseMessage: jest.fn(),
}));

const { importJourneys } = await import('./JourneyOps');
const { InsufficientScopeError } = await import('./RequiredScopesOps');

const options = { reUuid: false, deps: false };

const state: any = {
  getRealm: () => 'alpha',
  getVerbose: () => false,
  getDeploymentType: () => 'onprem',
  getHost: () => 'https://example.com/am',
  getAmVersion: () => '9.0.0',
  getUsername: () => 'alpha_user',
  getFrodoVersion: () => 'v5.0.0-test',
};

const TERMINAL = '70e691a5-1e33-4ac3-a356-e7b6d60d92e0';

/** A journey without findings that needs the given journeys, by way of an inner journey node each. */
function journeyExport(journeyId: string, needs: string[] = []): any {
  const nodes: Record<string, any> = {
    node: {
      nodeType: 'DecisionNode',
      version: '1.0',
      connections: { done: TERMINAL },
    },
  };
  const nodeConfigs: Record<string, any> = {
    node: {
      _id: 'node',
      _type: { _id: 'DecisionNode', version: '1.0' },
      _outcomes: [{ id: 'done' }],
    },
  };
  needs.forEach((dependency, index) => {
    const nodeId = `inner-${index}`;
    nodes[nodeId] = {
      nodeType: 'InnerTreeEvaluatorNode',
      version: '1.0',
      connections: { true: TERMINAL, false: TERMINAL },
    };
    nodeConfigs[nodeId] = {
      _id: nodeId,
      _type: { _id: 'InnerTreeEvaluatorNode', version: '1.0' },
      _outcomes: [{ id: 'true' }, { id: 'false' }],
      tree: dependency,
    };
  });
  return {
    tree: {
      _id: journeyId,
      entryNodeId: 'node',
      nodes,
      staticNodes: {},
    },
    nodes: nodeConfigs,
    innerNodes: {},
  };
}

/** A journey with a validation error: its entry node does not exist. */
function invalidJourney(journeyId: string, needs: string[] = []): any {
  const journey = journeyExport(journeyId, needs);
  journey.tree.entryNodeId = 'missing-entry';
  return journey;
}

/** The outcomes that the callback saw, in order: `name` for a success, `!name: message` for a failure. */
function recorder() {
  const outcomes: string[] = [];
  const errors: any[] = [];
  const resultCallback = jest.fn((error?: any, result?: any) => {
    if (error) {
      outcomes.push(`!${error.message}`);
      errors.push(error);
    } else {
      outcomes.push(result._id);
    }
  });
  return { outcomes, errors, resultCallback };
}

const written = () =>
  putTreeMock.mock.calls.map(([args]: any[]) => args.treeId);

/** The messages of an error and everything nested in it. */
function messagesOf(error: any): string[] {
  return [error.message, ...(error.originalErrors ?? []).flatMap(messagesOf)];
}

beforeEach(() => {
  jest.clearAllMocks();
  getTreesMock.mockReset();
  getTreesMock.mockResolvedValue({ result: [] });
  putTreeMock.mockReset();
  putTreeMock.mockImplementation(
    async ({ treeData }: { treeData: any }) => treeData
  );
  updateNodeMock.mockReset();
  updateNodeMock.mockResolvedValue({});
});

describe('importJourneys with a result callback', () => {
  test('imports every journey, reports each once as it is imported and returns them', async () => {
    const { outcomes, resultCallback } = recorder();

    const imported = await importJourneys({
      importData: {
        trees: {
          One: journeyExport('One'),
          Two: journeyExport('Two'),
          Three: journeyExport('Three'),
        },
      },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual(['One', 'Two', 'Three']);
    expect(resultCallback).toHaveBeenCalledTimes(3);
    expect(imported.map((tree) => tree._id)).toEqual(['One', 'Two', 'Three']);
    expect(written()).toEqual(['One', 'Two', 'Three']);
  });

  test('an invalid journey is a failed item that names it; the others are imported and returned', async () => {
    const { outcomes, errors, resultCallback } = recorder();

    const imported = await importJourneys({
      importData: {
        trees: {
          First: journeyExport('First'),
          Broken: invalidJourney('Broken'),
          Last: journeyExport('Last'),
        },
      },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual([
      '!Error importing the alpha realm journey Broken',
      'First',
      'Last',
    ]);
    expect(imported.map((tree) => tree._id)).toEqual(['First', 'Last']);
    expect(written()).toEqual(['First', 'Last']);
    // the cause is nested and says what is wrong with the journey
    expect(errors[0].originalErrors).toHaveLength(1);
    expect(errors[0].originalErrors[0].message).toContain("journey 'Broken'");
    expect(errors[0].originalErrors[0].message).toContain(
      '[MISSING_ENTRY_NODE]'
    );
  });

  test('every journey invalid: all are failed items, nothing is written, nothing is returned', async () => {
    const { outcomes, resultCallback } = recorder();

    const imported = await importJourneys({
      importData: {
        trees: { A: invalidJourney('A'), B: invalidJourney('B') },
      },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual([
      '!Error importing the alpha realm journey A',
      '!Error importing the alpha realm journey B',
    ]);
    expect(imported).toEqual([]);
    expect(putTreeMock).not.toHaveBeenCalled();
  });

  test('a journey is named by its key in the import data when its tree id differs', async () => {
    const { outcomes, errors, resultCallback } = recorder();
    const mismatched = invalidJourney('RealId');

    await importJourneys({
      importData: {
        trees: { WrongKey: mismatched, Fine: journeyExport('Fine') },
      },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual([
      '!Error importing the alpha realm journey WrongKey',
      'Fine',
    ]);
    expect(messagesOf(errors[0]).join(' | ')).toContain('[MISSING_ENTRY_NODE]');
  });

  test('a key that differs from the tree id is only a warning: the journey is imported under its tree id', async () => {
    const { outcomes, resultCallback } = recorder();

    await importJourneys({
      importData: { trees: { WrongKey: journeyExport('RealId') } },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual(['RealId']);
  });

  test('a missing dependency is a failed item that names the journey and the dependency; the others are imported', async () => {
    const { outcomes, errors, resultCallback } = recorder();

    const imported = await importJourneys({
      importData: {
        trees: {
          Needy: journeyExport('Needy', ['Ghost']),
          Fine: journeyExport('Fine'),
        },
      },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual([
      '!Error importing the alpha realm journey Needy',
      'Fine',
    ]);
    expect(imported.map((tree) => tree._id)).toEqual(['Fine']);
    expect(messagesOf(errors[0]).join(' | ')).toContain(
      'Journey Needy requires Ghost, which is not installed'
    );
    expect(written()).toEqual(['Fine']);
  });

  test('several missing dependencies are all named', async () => {
    const { errors, resultCallback } = recorder();

    await importJourneys({
      importData: {
        trees: { Needy: journeyExport('Needy', ['Ghost', 'Spirit']) },
      },
      options,
      resultCallback,
      state,
    });

    expect(messagesOf(errors[0]).join(' | ')).toContain(
      'requires Ghost, Spirit, which are not installed'
    );
  });

  test('only what is neither installed nor in the import data is named as missing', async () => {
    getTreesMock.mockResolvedValue({ result: [{ _id: 'Installed' }] });
    const { errors, resultCallback } = recorder();

    await importJourneys({
      importData: {
        trees: {
          Needy: journeyExport('Needy', ['Installed', 'Inner', 'Ghost']),
          Inner: journeyExport('Inner'),
        },
      },
      options,
      resultCallback,
      state,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].originalErrors[0].message).toBe(
      'Journey Needy requires Ghost, which is not installed and cannot be imported from the import data'
    );
  });

  test('a dependency that is installed is no missing dependency', async () => {
    getTreesMock.mockResolvedValue({ result: [{ _id: 'Installed' }] });
    const { outcomes, resultCallback } = recorder();

    await importJourneys({
      importData: { trees: { Needy: journeyExport('Needy', ['Installed']) } },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual(['Needy']);
  });

  test('the dependency order is kept: an inner journey is written before the journey that needs it', async () => {
    const { outcomes, resultCallback } = recorder();

    await importJourneys({
      importData: {
        trees: {
          Outer: journeyExport('Outer', ['Middle']),
          Middle: journeyExport('Middle', ['Inner']),
          Inner: journeyExport('Inner'),
        },
      },
      options,
      resultCallback,
      state,
    });

    expect(written()).toEqual(['Inner', 'Middle', 'Outer']);
    expect(outcomes).toEqual(['Inner', 'Middle', 'Outer']);
  });

  test('a journey that needs an invalid journey of the batch fails as well, naming the inner journey, and is not written', async () => {
    const { outcomes, errors, resultCallback } = recorder();

    const imported = await importJourneys({
      importData: {
        trees: {
          Outer: journeyExport('Outer', ['Inner']),
          Inner: invalidJourney('Inner'),
          Other: journeyExport('Other'),
        },
      },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual([
      '!Error importing the alpha realm journey Inner',
      'Other',
      '!Error importing the alpha realm journey Outer',
    ]);
    expect(messagesOf(errors[1]).join(' | ')).toContain(
      'Journey Outer requires Inner, which could not be imported'
    );
    expect(imported.map((tree) => tree._id)).toEqual(['Other']);
    expect(written()).toEqual(['Other']);
  });

  test('it fails as well when the invalid inner journey is installed in the realm', async () => {
    getTreesMock.mockResolvedValue({ result: [{ _id: 'Inner' }] });
    const { outcomes, resultCallback } = recorder();

    await importJourneys({
      importData: {
        trees: {
          Outer: journeyExport('Outer', ['Inner']),
          Inner: invalidJourney('Inner'),
        },
      },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual([
      '!Error importing the alpha realm journey Inner',
      '!Error importing the alpha realm journey Outer',
    ]);
    expect(putTreeMock).not.toHaveBeenCalled();
  });

  test('a journey that needs an inner journey that could not be written fails as well, without being attempted', async () => {
    putTreeMock.mockImplementation(async ({ treeData }: { treeData: any }) => {
      if (treeData._id === 'Inner') throw new Error('HTTP 500');
      return treeData;
    });
    const { outcomes, errors, resultCallback } = recorder();

    const imported = await importJourneys({
      importData: {
        trees: {
          Outer: journeyExport('Outer', ['Inner']),
          Inner: journeyExport('Inner'),
          Other: journeyExport('Other'),
        },
      },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual([
      '!Error importing the alpha realm journey Inner',
      'Other',
      '!Error importing the alpha realm journey Outer',
    ]);
    expect(messagesOf(errors[0])).toContain('HTTP 500');
    expect(messagesOf(errors[1]).join(' | ')).toContain(
      'Journey Outer requires Inner, which could not be imported'
    );
    expect(imported.map((tree) => tree._id)).toEqual(['Other']);
    // the outer journey was never attempted
    expect(written()).toEqual(['Inner', 'Other']);
  });

  test('the failure passes on through every level: a journey that needs a journey that needs a failed one fails too', async () => {
    const { outcomes, resultCallback } = recorder();

    await importJourneys({
      importData: {
        trees: {
          Top: journeyExport('Top', ['Middle']),
          Middle: journeyExport('Middle', ['Bottom']),
          Bottom: invalidJourney('Bottom'),
        },
      },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual([
      '!Error importing the alpha realm journey Bottom',
      '!Error importing the alpha realm journey Middle',
      '!Error importing the alpha realm journey Top',
    ]);
    expect(putTreeMock).not.toHaveBeenCalled();
  });

  test('a journey that needs a journey with a missing dependency fails with it and is reported once', async () => {
    const { outcomes, errors, resultCallback } = recorder();

    await importJourneys({
      importData: {
        trees: {
          Outer: journeyExport('Outer', ['Needy']),
          Needy: journeyExport('Needy', ['Ghost']),
        },
      },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual([
      '!Error importing the alpha realm journey Outer',
      '!Error importing the alpha realm journey Needy',
    ]);
    expect(messagesOf(errors[0]).join(' | ')).toContain(
      'Journey Outer requires Needy, which is not installed'
    );
    expect(messagesOf(errors[1]).join(' | ')).toContain(
      'Journey Needy requires Ghost, which is not installed'
    );
  });

  test('a journey that is invalid and has a missing dependency is reported once, for the validation errors', async () => {
    const { outcomes, errors, resultCallback } = recorder();

    await importJourneys({
      importData: { trees: { Both: invalidJourney('Both', ['Ghost']) } },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual(['!Error importing the alpha realm journey Both']);
    expect(messagesOf(errors[0]).join(' | ')).toContain('[MISSING_ENTRY_NODE]');
  });

  test('a journey that cannot be written is a failed item and the others are still imported', async () => {
    putTreeMock.mockImplementation(async ({ treeData }: { treeData: any }) => {
      if (treeData._id === 'Failing') throw new Error('HTTP 500');
      return treeData;
    });
    const { outcomes, resultCallback } = recorder();

    const imported = await importJourneys({
      importData: {
        trees: {
          First: journeyExport('First'),
          Failing: journeyExport('Failing'),
          Last: journeyExport('Last'),
        },
      },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual([
      'First',
      '!Error importing the alpha realm journey Failing',
      'Last',
    ]);
    expect(imported.map((tree) => tree._id)).toEqual(['First', 'Last']);
  });

  test('a journey that cannot be written for lack of a scope is a failed item with the code', async () => {
    putTreeMock.mockImplementation(async ({ treeData }: { treeData: any }) => {
      if (treeData._id === 'Failing') {
        throw new InsufficientScopeError(
          'This operation requires scope(s) [fr:am:*]',
          null,
          'INSUFFICIENT_SCOPE'
        );
      }
      return treeData;
    });
    const { errors, resultCallback } = recorder();

    const imported = await importJourneys({
      importData: {
        trees: {
          Failing: journeyExport('Failing'),
          Last: journeyExport('Last'),
        },
      },
      options,
      resultCallback,
      state,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe(
      'Error importing the alpha realm journey Failing'
    );
    expect(errors[0].code).toBe('INSUFFICIENT_SCOPE');
    expect(imported.map((tree) => tree._id)).toEqual(['Last']);
  });

  test('failing to list the installed journeys still throws, and nothing is reported', async () => {
    getTreesMock.mockRejectedValue(new Error('HTTP 500'));
    const { resultCallback } = recorder();

    const error: any = await importJourneys({
      importData: {
        trees: {
          Broken: invalidJourney('Broken'),
          Fine: journeyExport('Fine'),
        },
      },
      options,
      resultCallback,
      state,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect(messagesOf(error).join(' | ')).toContain('HTTP 500');
    expect(resultCallback).not.toHaveBeenCalled();
    expect(putTreeMock).not.toHaveBeenCalled();
  });

  test('without validation an invalid journey is imported, but a missing dependency is still a failed item', async () => {
    const { outcomes, resultCallback } = recorder();

    await importJourneys({
      importData: {
        trees: {
          Broken: invalidJourney('Broken'),
          Needy: journeyExport('Needy', ['Ghost']),
        },
      },
      options: { ...options, validate: false },
      resultCallback,
      state,
    });

    expect(outcomes).toEqual([
      '!Error importing the alpha realm journey Needy',
      'Broken',
    ]);
  });

  test('warnings are printed as without a callback', async () => {
    const warned = journeyExport('Warned');
    warned.nodes.node._outcomes.push({ id: 'unconnected' });
    const importData = () => ({
      trees: { Warned: warned, Broken: invalidJourney('Broken') },
    });
    const warnings = () =>
      printMessageMock.mock.calls
        .map(([args]: any[]) => args)
        .filter((args: any) => args.type === 'warn')
        .map((args: any) => args.message);

    await importJourneys({ importData: importData(), options, state }).catch(
      () => undefined
    );
    const withoutCallback = warnings();
    printMessageMock.mockClear();
    await importJourneys({
      importData: importData(),
      options,
      resultCallback: jest.fn(),
      state,
    });
    const withCallback = warnings();

    expect(withoutCallback.length).toBeGreaterThan(0);
    expect(withCallback).toEqual(withoutCallback);
  });
});

describe('importJourneys without a result callback', () => {
  test('an invalid journey rejects the whole batch before anything is written (unchanged)', async () => {
    const error: any = await importJourneys({
      importData: {
        trees: {
          Fine: journeyExport('Fine'),
          Broken: invalidJourney('Broken'),
        },
      },
      options,
      state,
    }).catch((e) => e);

    expect(error.message).toContain(
      "Error importing alpha realm journey 'Broken':\n  - [MISSING_ENTRY_NODE] Broken:"
    );
    expect(error.originalErrors).toEqual([]);
    expect(getTreesMock).not.toHaveBeenCalled();
    expect(putTreeMock).not.toHaveBeenCalled();
  });

  test('a missing dependency rejects the whole batch with the combined message before anything is written (unchanged)', async () => {
    const error: any = await importJourneys({
      importData: {
        trees: {
          Fine: journeyExport('Fine'),
          Needy: journeyExport('Needy', ['Ghost']),
        },
      },
      options,
      state,
    }).catch((e) => e);

    expect(error.message).toBe(
      '1 alpha realm journeys with unresolved dependencies:\n  - Needy requires Ghost'
    );
    expect(putTreeMock).not.toHaveBeenCalled();
  });

  test('a journey that cannot be written ends the import: the later journeys are not attempted (unchanged)', async () => {
    putTreeMock.mockImplementation(async ({ treeData }: { treeData: any }) => {
      if (treeData._id === 'Failing') throw new Error('HTTP 500');
      return treeData;
    });

    const error: any = await importJourneys({
      importData: {
        trees: {
          First: journeyExport('First'),
          Failing: journeyExport('Failing'),
          Last: journeyExport('Last'),
        },
      },
      options,
      state,
    }).catch((e) => e);

    expect(error.message).toBe(
      'Error importing the alpha realm journey Failing'
    );
    expect(written()).toEqual(['First', 'Failing']);
  });

  test('returns the imported journeys (unchanged)', async () => {
    const imported = await importJourneys({
      importData: {
        trees: { One: journeyExport('One'), Two: journeyExport('Two') },
      },
      options,
      state,
    });

    expect(imported.map((tree) => tree._id)).toEqual(['One', 'Two']);
  });
});
