/**
 * Run tests
 *
 *        npm run test:only ToolRuntime.mappingReferences
 *
 * The reference lookup of mappings takes one name or a list of names in the
 * same parameter. The tool runtime holds no schema for it (the parameter says
 * `string | string[]`), so a positional call passes either value to the method
 * as it is, through the read-only dispatch. No tenant and no recording: the
 * method behind the capability is a fake that records its arguments.
 */
import { jest } from '@jest/globals';
import { frodo } from '../lib/FrodoLib';
import { createMcpService, type McpService } from './McpService';

type Handler = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

const ID = 'idm.mapping.findMappingReferences';

let service: McpService;
let currentFake: unknown;

beforeAll(() => {
  service = createMcpService(frodo, {
    policyPreset: 'admin',
    inventoryOptions: { includeUtils: false },
    runtimeOptions: {
      resolveFrodoForRequest: () => currentFake as never,
    },
  });
});

function fakeInstance(id: string, handler: Handler): unknown {
  const path = id.split('.');
  const methodName = path.pop() as string;
  const root: Record<string, unknown> = {
    login: { getTokens: jest.fn(async () => undefined) },
    state: { getDeploymentType: () => 'cloud' },
  };
  let node = root;
  for (const segment of path) {
    node[segment] = (node[segment] as Record<string, unknown>) ?? {};
    node = node[segment] as Record<string, unknown>;
  }
  node[methodName] = handler;
  return root;
}

async function readOnlyDispatch(
  id: string,
  handler: Handler,
  args: Record<string, unknown>,
  toolName = 'frodo_dispatch_read_only'
) {
  currentFake = fakeInstance(id, handler);
  return service.executeTool({
    toolName,
    arguments: { skillId: id, ...args },
    context: { auth: { mode: 'state-config', config: {} } },
  });
}

describe(`${ID} through the read-only dispatch`, () => {
  const id = ID;
  test('is offered, as a read-only search', () => {
    const descriptor = service.capabilities.find((c) => c.id === id);
    expect(descriptor).toMatchObject({
      operationType: 'search',
      mutating: false,
      argumentMode: 'positional',
    });
  });

  test('one name reaches the method as a string', async () => {
    const handler: Handler = jest.fn(async () => []);
    await readOnlyDispatch(id, handler, { positionalArgs: ['a-mapping'] });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]).toEqual(['a-mapping']);
  });

  test('a list of names reaches the method as a list', async () => {
    const handler: Handler = jest.fn(async () => ({
      references: {},
      unreadable: [],
    }));
    await readOnlyDispatch(id, handler, {
      positionalArgs: [['a-mapping', 'another-mapping']],
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]).toEqual([['a-mapping', 'another-mapping']]);
  });

  test('the answer of the method is the answer of the call', async () => {
    const answer = { references: { 'a-mapping': [] }, unreadable: ['mapping'] };
    const handler: Handler = jest.fn(async () => answer);
    const result = await readOnlyDispatch(id, handler, {
      positionalArgs: [['a-mapping']],
    });
    expect(JSON.stringify(result)).toContain('unreadable');
  });

  test('the write dispatch refuses it, as it refuses every search: the lookup is for the read-only dispatch', async () => {
    const handler: Handler = jest.fn(async () => []);
    await expect(
      readOnlyDispatch(
        id,
        handler,
        { positionalArgs: ['a-mapping'] },
        'frodo_dispatch'
      )
    ).rejects.toThrow(
      "'frodo_dispatch' is for mutating operations. Use 'frodo_dispatch_read_only' for 'search'."
    );
    expect(handler).not.toHaveBeenCalled();
  });
});
