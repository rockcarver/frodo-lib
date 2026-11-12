/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent NodeOps.perInstanceState
 *
 * A process can hold several instances (the MCP server with several
 * connections, `createInstance` consumers, scripts). The schema of a node type
 * or a custom node that an instance has read belongs to that instance and to the
 * tenant it is pointed at, and the instance is handed a copy of it (lib#1048).
 * These tests read the schemas through two instances that are logged in to two
 * fake tenants which answer differently.
 */
import '../index';
import { startFakeAm, type FakeAm } from '../../test/support/fakeAm';
import FrodoLib from '../lib/FrodoLib';
import { createJwkRsa } from './JoseOps';

const NODE_TYPE = 'ScriptedDecisionNode';
const CUSTOM_NODE = 'designer-MyCustomNode';

const schemaWith = (...properties: string[]) => ({
  type: 'object',
  properties: Object.fromEntries(
    properties.map((p) => [p, { type: 'string' }])
  ),
});

/** The number of times the tenant was asked for the schema of a node type. */
const reads = (fake: FakeAm, type: string) =>
  fake.requests.filter(
    (r) => r.startsWith('POST ') && r.endsWith(`/nodes/${type}`)
  ).length;

const ams: FakeAm[] = [];

async function am(nodeSchemas: Record<string, object>) {
  const started = await startFakeAm({
    serviceAccountScopes: [{ scope: 'fr:am:*' }],
    nodeSchemas,
  });
  ams.push(started);
  return started;
}

afterEach(async () => {
  await Promise.all(ams.splice(0).map((a) => a.close()));
});

async function instance(host: string) {
  const frodo = FrodoLib({ host, deploymentType: 'cloud' });
  frodo.state.setUseTokenCache(false);
  frodo.state.setServiceAccountId('sa-1');
  frodo.state.setServiceAccountJwk(await createJwkRsa());
  await frodo.login.getTokens();
  return frodo;
}

const propertyNames = (schema: { properties?: object }) =>
  Object.keys(schema.properties ?? {});

describe('the schemas of node types and custom nodes are kept for each instance (lib#1048)', () => {
  test('1: two tenants that answer differently: each instance reads the node type schema of its own tenant', async () => {
    const first = await am({ [NODE_TYPE]: schemaWith('script') });
    const second = await am({ [NODE_TYPE]: schemaWith('outcomes', 'inputs') });
    const a = await instance(first.host);
    const b = await instance(second.host);

    expect(propertyNames(await a.authn.node.readNodeSchema(NODE_TYPE))).toEqual(
      ['script']
    );
    expect(propertyNames(await b.authn.node.readNodeSchema(NODE_TYPE))).toEqual(
      ['outcomes', 'inputs']
    );
    expect(reads(first, NODE_TYPE)).toBe(1);
    expect(reads(second, NODE_TYPE)).toBe(1);
  });

  test('2: the same in the other order: the tenant that asked first does not answer for the next one', async () => {
    const first = await am({ [NODE_TYPE]: schemaWith('outcomes', 'inputs') });
    const second = await am({ [NODE_TYPE]: schemaWith('script') });
    const a = await instance(first.host);
    const b = await instance(second.host);

    expect(propertyNames(await a.authn.node.readNodeSchema(NODE_TYPE))).toEqual(
      ['outcomes', 'inputs']
    );
    expect(propertyNames(await b.authn.node.readNodeSchema(NODE_TYPE))).toEqual(
      ['script']
    );
  });

  test('3: two tenants with a custom node of the same name that differs: each instance reads its own', async () => {
    const first = await am({ [CUSTOM_NODE]: schemaWith('greeting') });
    const second = await am({ [CUSTOM_NODE]: schemaWith('colour', 'size') });
    const a = await instance(first.host);
    const b = await instance(second.host);

    expect(
      propertyNames(await a.authn.node.readCustomNodeSchema('MyCustomNode'))
    ).toEqual(['greeting']);
    expect(
      propertyNames(await b.authn.node.readCustomNodeSchema('MyCustomNode'))
    ).toEqual(['colour', 'size']);
    expect(reads(first, CUSTOM_NODE)).toBe(1);
    expect(reads(second, CUSTOM_NODE)).toBe(1);
  });

  test('4: the same for the custom node in the other order', async () => {
    const first = await am({ [CUSTOM_NODE]: schemaWith('colour', 'size') });
    const second = await am({ [CUSTOM_NODE]: schemaWith('greeting') });
    const a = await instance(first.host);
    const b = await instance(second.host);

    expect(
      propertyNames(await a.authn.node.readCustomNodeSchema('MyCustomNode'))
    ).toEqual(['colour', 'size']);
    expect(
      propertyNames(await b.authn.node.readCustomNodeSchema('MyCustomNode'))
    ).toEqual(['greeting']);
  });

  test('5: one instance reads a schema once and is handed a copy each time, also the first time', async () => {
    const tenant = await am({
      [NODE_TYPE]: schemaWith('script', 'outcomes'),
      [CUSTOM_NODE]: schemaWith('greeting', 'colour'),
    });
    const a = await instance(tenant.host);

    // what the caller gets from the tenant is not what is kept
    const fresh = await a.authn.node.readNodeSchema(NODE_TYPE);
    delete (fresh as { properties: object }).properties['script'];
    // what the caller gets from the cache is a copy too
    const cached = await a.authn.node.readNodeSchema(NODE_TYPE);
    expect(propertyNames(cached)).toEqual(['script', 'outcomes']);
    delete (cached as { properties: object }).properties['outcomes'];
    expect(propertyNames(await a.authn.node.readNodeSchema(NODE_TYPE))).toEqual(
      ['script', 'outcomes']
    );
    expect(reads(tenant, NODE_TYPE)).toBe(1);

    const freshCustom = await a.authn.node.readCustomNodeSchema('MyCustomNode');
    delete (freshCustom as { properties: object }).properties['greeting'];
    const cachedCustom =
      await a.authn.node.readCustomNodeSchema('MyCustomNode');
    expect(propertyNames(cachedCustom)).toEqual(['greeting', 'colour']);
    delete (cachedCustom as { properties: object }).properties['colour'];
    expect(
      propertyNames(await a.authn.node.readCustomNodeSchema('MyCustomNode'))
    ).toEqual(['greeting', 'colour']);
    expect(reads(tenant, CUSTOM_NODE)).toBe(1);
  });

  test('6: refreshCache reads the schema again, and the new schema is the one that is kept', async () => {
    const tenant = await am({
      [NODE_TYPE]: schemaWith('script'),
      [CUSTOM_NODE]: schemaWith('greeting'),
    });
    const a = await instance(tenant.host);
    await a.authn.node.readNodeSchema(NODE_TYPE);
    await a.authn.node.readCustomNodeSchema('MyCustomNode');

    tenant.setNodeSchema(NODE_TYPE, schemaWith('script', 'outcomes'));
    tenant.setNodeSchema(CUSTOM_NODE, schemaWith('greeting', 'colour'));
    expect(propertyNames(await a.authn.node.readNodeSchema(NODE_TYPE))).toEqual(
      ['script']
    );
    expect(
      propertyNames(await a.authn.node.readNodeSchema(NODE_TYPE, '1.0', true))
    ).toEqual(['script', 'outcomes']);
    expect(propertyNames(await a.authn.node.readNodeSchema(NODE_TYPE))).toEqual(
      ['script', 'outcomes']
    );
    expect(reads(tenant, NODE_TYPE)).toBe(2);

    expect(
      propertyNames(await a.authn.node.readCustomNodeSchema('MyCustomNode'))
    ).toEqual(['greeting']);
    expect(
      propertyNames(
        await a.authn.node.readCustomNodeSchema('MyCustomNode', true)
      )
    ).toEqual(['greeting', 'colour']);
    expect(
      propertyNames(await a.authn.node.readCustomNodeSchema('MyCustomNode'))
    ).toEqual(['greeting', 'colour']);
    expect(reads(tenant, CUSTOM_NODE)).toBe(2);
  });

  test('7: an instance that is pointed at another host reads the schema of that host', async () => {
    const first = await am({ [NODE_TYPE]: schemaWith('script') });
    const second = await am({ [NODE_TYPE]: schemaWith('outcomes', 'inputs') });
    const a = await instance(first.host);
    expect(propertyNames(await a.authn.node.readNodeSchema(NODE_TYPE))).toEqual(
      ['script']
    );

    a.state.setHost(second.host);

    expect(propertyNames(await a.authn.node.readNodeSchema(NODE_TYPE))).toEqual(
      ['outcomes', 'inputs']
    );
    expect(reads(second, NODE_TYPE)).toBe(1);
  });

  test('8: a node type at two versions is two entries', async () => {
    const tenant = await am({ [NODE_TYPE]: schemaWith('script') });
    const a = await instance(tenant.host);

    await a.authn.node.readNodeSchema(NODE_TYPE, '1.0');
    await a.authn.node.readNodeSchema(NODE_TYPE, '2.0');
    await a.authn.node.readNodeSchema(NODE_TYPE, '1.0');
    await a.authn.node.readNodeSchema(NODE_TYPE, '2.0');

    expect(reads(tenant, NODE_TYPE)).toBe(2);
  });
});
