import { jest } from '@jest/globals';

const getManagedObjectSchemaApi = jest.fn(
  async (_args?: any): Promise<any> => ({ properties: {} })
);
const getManagedObjectSchemaPropertyApi = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const putManagedObjectSchemaPropertyApi = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const deleteManagedObjectSchemaPropertyApi = jest.fn(
  async (_args?: any): Promise<any> => ({})
);

jest.unstable_mockModule('../api/ManagedObjectApi', () => ({
  deleteManagedObjectSchemaProperty: deleteManagedObjectSchemaPropertyApi,
  getManagedObjectSchema: getManagedObjectSchemaApi,
  getManagedObjectSchemaProperty: getManagedObjectSchemaPropertyApi,
  putManagedObjectSchemaProperty: putManagedObjectSchemaPropertyApi,
}));

const {
  readManagedObjectSchema,
  readManagedObjectSchemaProperty,
  updateManagedObjectSchemaProperty,
  removeManagedObjectSchemaProperty,
} = await import('./ManagedObjectSchemaOps');

function mockStateWithDebug(deploymentType: string) {
  return {
    getDeploymentType: () => deploymentType,
    getDebugHandler: () => undefined,
  } as any;
}

describe('managed object schema property CRUD (Cloud-only v2 schema API)', () => {
  beforeEach(() => {
    getManagedObjectSchemaPropertyApi.mockReset();
    getManagedObjectSchemaPropertyApi.mockResolvedValue({
      type: 'string',
    });
    putManagedObjectSchemaPropertyApi.mockReset();
    putManagedObjectSchemaPropertyApi.mockResolvedValue({ type: 'string' });
    deleteManagedObjectSchemaPropertyApi.mockReset();
    deleteManagedObjectSchemaPropertyApi.mockResolvedValue({
      type: 'string',
    });
    getManagedObjectSchemaApi.mockReset();
  });

  test('readManagedObjectSchemaProperty calls the v2 API on Cloud', async () => {
    const state = mockStateWithDebug('cloud');
    const result = await readManagedObjectSchemaProperty({
      type: 'alpha_user',
      propertyName: 'custom_merchantId',
      state,
    });
    expect(result).toEqual({ type: 'string' });
    expect(getManagedObjectSchemaPropertyApi).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alpha_user',
        propertyName: 'custom_merchantId',
      })
    );
  });

  test.each(['forgeops', 'classic'])(
    'readManagedObjectSchemaProperty refuses on %s without calling the API',
    async (deploymentType) => {
      const state = mockStateWithDebug(deploymentType);
      await expect(
        readManagedObjectSchemaProperty({
          type: 'alpha_user',
          propertyName: 'custom_merchantId',
          state,
        })
      ).rejects.toMatchObject({
        originalErrors: [expect.objectContaining({ message: expect.stringMatching(/Cloud/) })],
      });
      expect(getManagedObjectSchemaPropertyApi).not.toHaveBeenCalled();
    }
  );

  test('updateManagedObjectSchemaProperty writes on Cloud and invalidates the schema cache', async () => {
    const state = mockStateWithDebug('cloud');
    getManagedObjectSchemaApi.mockResolvedValueOnce({
      properties: { custom_merchantId: { type: 'string', version: 1 } },
    });
    const before = await readManagedObjectSchema({
      type: 'alpha_user_update_cache_test',
      state,
    });
    expect(before.properties['custom_merchantId']).toEqual({
      type: 'string',
      version: 1,
    });

    await updateManagedObjectSchemaProperty({
      type: 'alpha_user_update_cache_test',
      propertyName: 'custom_merchantId',
      propertyData: { type: 'string' },
      state,
    });
    expect(putManagedObjectSchemaPropertyApi).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alpha_user_update_cache_test',
        propertyName: 'custom_merchantId',
        propertyData: { type: 'string' },
      })
    );

    // Cache must be invalidated: a subsequent readManagedObjectSchema call
    // re-fetches instead of returning the pre-update cached value.
    getManagedObjectSchemaApi.mockResolvedValueOnce({
      properties: { custom_merchantId: { type: 'string', version: 2 } },
    });
    const after = await readManagedObjectSchema({
      type: 'alpha_user_update_cache_test',
      refreshCache: false,
      state,
    });
    expect(after.properties['custom_merchantId']).toEqual({
      type: 'string',
      version: 2,
    });
    expect(getManagedObjectSchemaApi).toHaveBeenCalledTimes(2);
  });

  test.each(['forgeops', 'classic'])(
    'updateManagedObjectSchemaProperty refuses on %s without calling the API',
    async (deploymentType) => {
      const state = mockStateWithDebug(deploymentType);
      await expect(
        updateManagedObjectSchemaProperty({
          type: 'alpha_user',
          propertyName: 'custom_merchantId',
          propertyData: { type: 'string' },
          state,
        })
      ).rejects.toMatchObject({
        originalErrors: [expect.objectContaining({ message: expect.stringMatching(/Cloud/) })],
      });
      expect(putManagedObjectSchemaPropertyApi).not.toHaveBeenCalled();
    }
  );

  test('removeManagedObjectSchemaProperty writes on Cloud and invalidates the schema cache', async () => {
    const state = mockStateWithDebug('cloud');
    getManagedObjectSchemaApi.mockResolvedValueOnce({
      properties: { custom_merchantId: { type: 'string', version: 1 } },
    });
    await readManagedObjectSchema({ type: 'alpha_user_remove_cache_test', state });

    await removeManagedObjectSchemaProperty({
      type: 'alpha_user_remove_cache_test',
      propertyName: 'custom_merchantId',
      state,
    });
    expect(deleteManagedObjectSchemaPropertyApi).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alpha_user_remove_cache_test',
        propertyName: 'custom_merchantId',
      })
    );

    getManagedObjectSchemaApi.mockResolvedValueOnce({ properties: {} });
    await readManagedObjectSchema({ type: 'alpha_user_remove_cache_test', state });
    expect(getManagedObjectSchemaApi).toHaveBeenCalledTimes(2);
  });

  test.each(['forgeops', 'classic'])(
    'removeManagedObjectSchemaProperty refuses on %s without calling the API',
    async (deploymentType) => {
      const state = mockStateWithDebug(deploymentType);
      await expect(
        removeManagedObjectSchemaProperty({
          type: 'alpha_user',
          propertyName: 'custom_merchantId',
          state,
        })
      ).rejects.toMatchObject({
        originalErrors: [expect.objectContaining({ message: expect.stringMatching(/Cloud/) })],
      });
      expect(deleteManagedObjectSchemaPropertyApi).not.toHaveBeenCalled();
    }
  );
});
