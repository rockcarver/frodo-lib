/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent ManagedSystemObjectSchemaOps.perInstanceState
 *
 * A process can hold several instances (the MCP server with several
 * connections, `createInstance` consumers, scripts). The schema of a managed
 * system object type that an instance has read belongs to that instance and to the
 * tenant it is pointed at (lib#1046). These tests read the schemas through two
 * instances that are logged in to two fake tenants which answer differently.
 */
import '../index';
import { startFakeAm, type FakeAm } from '../../test/support/fakeAm';
import FrodoLib from '../lib/FrodoLib';
import { createJwkRsa } from './JoseOps';

const SCHEMA_PATH = '/openidm/schema/managed/svcacct';

const schemaWith = (...properties: string[]) => ({
  type: 'object',
  properties: Object.fromEntries(
    properties.map((p) => [p, { type: 'string' }])
  ),
});

/** The number of times the tenant was asked for the schema (a write to the type is not a read). */
const reads = (fake: FakeAm) =>
  fake.requests.filter((r) => r === `GET ${SCHEMA_PATH}`).length;

const ams: FakeAm[] = [];

async function am(schema: object) {
  const started = await startFakeAm({
    serviceAccountScopes: [{ scope: 'fr:idm:*' }],
    managedSchemas: { svcacct: schema },
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

const propertyNames = (schema: { properties: object }) =>
  Object.keys(schema.properties);

describe('the schemas of managed system object types are kept for each instance (lib#1046)', () => {
  test('1: two tenants that answer differently: each instance reads the schema of its own tenant', async () => {
    const first = await am(schemaWith('givenName'));
    const second = await am(schemaWith('mail', 'sn'));

    const a = await instance(first.host);
    const b = await instance(second.host);

    expect(
      propertyNames(
        await a.idm.managedSystem.schema.readManagedSystemObjectSchema(
          'svcacct'
        )
      )
    ).toEqual(['givenName']);
    expect(
      propertyNames(
        await b.idm.managedSystem.schema.readManagedSystemObjectSchema(
          'svcacct'
        )
      )
    ).toEqual(['mail', 'sn']);
    expect(reads(first)).toBe(1);
    expect(reads(second)).toBe(1);
  });

  test('2: the same in the other order: the tenant that asked first does not answer for the next one', async () => {
    const first = await am(schemaWith('mail', 'sn'));
    const second = await am(schemaWith('givenName'));

    const a = await instance(first.host);
    const b = await instance(second.host);

    expect(
      propertyNames(
        await a.idm.managedSystem.schema.readManagedSystemObjectSchema(
          'svcacct'
        )
      )
    ).toEqual(['mail', 'sn']);
    expect(
      propertyNames(
        await b.idm.managedSystem.schema.readManagedSystemObjectSchema(
          'svcacct'
        )
      )
    ).toEqual(['givenName']);
  });

  test('3: one instance reads the schema once and is handed a copy each time', async () => {
    const tenant = await am(schemaWith('givenName'));
    const a = await instance(tenant.host);

    const first =
      await a.idm.managedSystem.schema.readManagedSystemObjectSchema('svcacct');
    delete first.properties['givenName'];
    const second =
      await a.idm.managedSystem.schema.readManagedSystemObjectSchema('svcacct');

    expect(propertyNames(second)).toEqual(['givenName']);
    expect(reads(tenant)).toBe(1);
  });

  test('4: refreshCache reads the schema again, and the new schema is the one that is kept', async () => {
    const tenant = await am(schemaWith('givenName'));
    const a = await instance(tenant.host);
    await a.idm.managedSystem.schema.readManagedSystemObjectSchema('svcacct');

    tenant.setManagedSchema('svcacct', schemaWith('givenName', 'sn'));
    expect(
      propertyNames(
        await a.idm.managedSystem.schema.readManagedSystemObjectSchema(
          'svcacct'
        )
      )
    ).toEqual(['givenName']);
    expect(
      propertyNames(
        await a.idm.managedSystem.schema.readManagedSystemObjectSchema(
          'svcacct',
          true
        )
      )
    ).toEqual(['givenName', 'sn']);
    expect(
      propertyNames(
        await a.idm.managedSystem.schema.readManagedSystemObjectSchema(
          'svcacct'
        )
      )
    ).toEqual(['givenName', 'sn']);
    expect(reads(tenant)).toBe(2);
  });

  test('5: an instance that is pointed at another host reads the schema of that host', async () => {
    const first = await am(schemaWith('givenName'));
    const second = await am(schemaWith('mail', 'sn'));
    const a = await instance(first.host);
    expect(
      propertyNames(
        await a.idm.managedSystem.schema.readManagedSystemObjectSchema(
          'svcacct'
        )
      )
    ).toEqual(['givenName']);

    a.state.setHost(second.host);

    expect(
      propertyNames(
        await a.idm.managedSystem.schema.readManagedSystemObjectSchema(
          'svcacct'
        )
      )
    ).toEqual(['mail', 'sn']);
    expect(reads(second)).toBe(1);
  });
});
