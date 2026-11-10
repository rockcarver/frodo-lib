import { jest } from '@jest/globals';

const readConfigEntitiesByType = jest.fn(
  async (_args?: any): Promise<any[]> => []
);
const deleteConfigEntity = jest.fn(async ({ entityId }: any): Promise<any> => ({
  _id: entityId,
}));
const unused = jest.fn(async (_args?: any): Promise<any> => ({}));
const readMappings = jest.fn(async (_args?: any): Promise<any[]> => []);

jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  deleteConfigEntity,
  getConfigEntitiesByType: unused,
  getConfigEntity: unused,
  patchConfigEntity: unused,
  putConfigEntity: unused,
}));
jest.unstable_mockModule('../api/IdmSystemApi', () => ({
  readSystemStatus: unused,
}));
jest.unstable_mockModule('./IdmConfigOps', () => ({
  readConfigEntitiesByType,
}));
jest.unstable_mockModule('./MappingOps', () => ({
  deleteMapping: unused,
  readMappings,
  updateMapping: unused,
}));
jest.unstable_mockModule('../utils/Console', () => ({
  createProgressIndicator: jest.fn(() => 'progress-id'),
  debugMessage: jest.fn(),
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
}));
jest.unstable_mockModule('../utils/ExportImportUtils', () => ({
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));

const { default: ConnectorOps } = await import('./ConnectorOps');
const { FrodoError } = await import('./FrodoError');

const state = {} as any;
const connectors = ConnectorOps(state);
const connectorData = [
  { _id: 'provisioner.openicf/ldap', enabled: true },
  { _id: 'provisioner.openicf/disabled', enabled: false },
  { _id: 'provisioner.openicf/noFlag' },
];
const nonConnectors = [
  { _id: 'provisioner.openicf.connectorinfoprovider' },
  { _id: 'provisioner.openicf' },
  { _id: 'provisioner.other/ldap', enabled: true },
  {},
  { _id: 123 },
];

beforeEach(() => {
  jest.clearAllMocks();
  readConfigEntitiesByType.mockReset();
  readConfigEntitiesByType.mockResolvedValue([
    nonConnectors[0],
    ...connectorData,
    ...nonConnectors.slice(1),
  ]);
});

describe('readConnectors', () => {
  test('returns only slash-prefixed connectors, regardless of enabled state', async () => {
    expect(await connectors.readConnectors()).toEqual(connectorData);
    expect(readConfigEntitiesByType).toHaveBeenCalledTimes(1);
    expect(readConfigEntitiesByType).toHaveBeenCalledWith({
      type: 'provisioner.openicf',
      state,
    });
  });

  test.each([{ entities: [] }, { entities: nonConnectors }])(
    'returns no connectors for non-connector results: $entities',
    async ({ entities }) => {
      readConfigEntitiesByType.mockResolvedValue(entities);
      expect(await connectors.readConnectors()).toEqual([]);
    }
  );

  test('wraps a failed read in FrodoError', async () => {
    readConfigEntitiesByType.mockRejectedValue(new Error('HTTP 500'));
    await expect(connectors.readConnectors()).rejects.toBeInstanceOf(
      FrodoError
    );
  });
});

describe('exportConnectors', () => {
  test('exports connectors by name without an undefined or info-provider entry', async () => {
    const result = await connectors.exportConnectors();
    expect(result.connector).toEqual({
      ldap: connectorData[0],
      disabled: connectorData[1],
      noFlag: connectorData[2],
    });
    expect(result.connector).not.toHaveProperty('undefined');
    expect(result.connector).not.toHaveProperty(
      'provisioner.openicf.connectorinfoprovider'
    );
  });

  test('exports nothing when only the info provider exists', async () => {
    readConfigEntitiesByType.mockResolvedValue([nonConnectors[0]]);
    expect((await connectors.exportConnectors()).connector).toEqual({});
  });
});

describe('deleteConnectors', () => {
  test.each([false, true])(
    'never deletes the info provider (deep: %s)',
    async (deep) => {
      expect(await connectors.deleteConnectors(deep)).toEqual(
        connectorData.map(({ _id }) => ({ _id }))
      );
      expect(deleteConfigEntity.mock.calls).toEqual(
        connectorData.map(({ _id }) => [{ entityId: _id, state }])
      );
      expect(readMappings.mock.calls).toEqual(
        deep
          ? connectorData.map(({ _id }) => [{ connectorId: _id, state }])
          : []
      );
    }
  );

  test('deletes nothing when only the info provider exists', async () => {
    readConfigEntitiesByType.mockResolvedValue([nonConnectors[0]]);
    expect(await connectors.deleteConnectors()).toEqual([]);
    expect(deleteConfigEntity).not.toHaveBeenCalled();
  });
});
