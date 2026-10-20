import { jest } from '@jest/globals';
import { AxiosError } from 'axios';
import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import State from '../shared/State';

const protectedIds = [
  'emailTemplate/frResetPassword',
  'emailTemplate/frProfileUpdated',
  'emailTemplate/frPasswordUpdated',
  'emailTemplate/frOnboarding',
  'emailTemplate/frEmailUpdated',
  'emailTemplate/frForgotUsername',
  'emailTemplate/frUsernameUpdated',
];
const customTemplate = { _id: 'emailTemplate/customWelcome', enabled: true };
const realmTemplate = { _id: 'emailTemplate/alpha/frResetPassword' };
const managedConfig = { _id: 'managed', objects: [] };
const configurations = [
  ...protectedIds.map((_id) => ({ _id })),
  customTemplate,
  realmTemplate,
  managedConfig,
];
const getConfigEntities = jest.fn(async () => ({ result: configurations }));
const getConfigEntity = jest.fn(
  async ({
    entityId,
  }: {
    entityId: string;
  }): Promise<IdObjectSkeletonInterface> =>
    configurations.find((c) => c._id === entityId)
);

jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  getConfigEntities,
  getConfigEntity,
  getConfigEntitiesByType: jest.fn(),
  getConfigStubs: jest.fn(),
  putConfigEntity: jest.fn(),
  deleteConfigEntity: jest.fn(),
}));

const { exportConfigEntities } = await import('./IdmConfigOps');

describe('bulk IDM config export', () => {
  const state = State({});

  beforeEach(() => {
    jest.clearAllMocks();
    state.setDeploymentType('cloud');
    getConfigEntity.mockImplementation(async ({ entityId }) => {
      if (protectedIds.includes(entityId)) {
        throw new Error('Protected template must not be read');
      }
      return configurations.find((c) => c._id === entityId);
    });
  });

  test('skips all seven protected AIC templates before reading individual entities', async () => {
    const resultCallback = jest.fn();
    const result = await exportConfigEntities({ resultCallback, state });

    expect(result.idm).toEqual({
      [customTemplate._id]: customTemplate,
      [realmTemplate._id]: realmTemplate,
      [managedConfig._id]: managedConfig,
    });
    expect(getConfigEntity.mock.calls.map(([args]) => args.entityId)).toEqual([
      customTemplate._id,
      realmTemplate._id,
      managedConfig._id,
    ]);
    expect(resultCallback.mock.calls).toEqual([
      [undefined, customTemplate],
      [undefined, realmTemplate],
      [undefined, managedConfig],
    ]);
  });

  test('keeps protected templates excluded when explicitly selected in a bulk export', async () => {
    const result = await exportConfigEntities({
      options: { entitiesToExport: [...protectedIds, customTemplate._id] },
      state,
    });

    expect(result.idm).toEqual({ [customTemplate._id]: customTemplate });
    expect(getConfigEntity).toHaveBeenCalledTimes(1);
    expect(getConfigEntity).toHaveBeenCalledWith({
      entityId: customTemplate._id,
      state,
    });
  });

  test('returns an empty export when only protected templates are selected', async () => {
    const result = await exportConfigEntities({
      options: { entitiesToExport: protectedIds },
      state,
    });

    expect(result.idm).toEqual({});
    expect(getConfigEntity).not.toHaveBeenCalled();
  });

  test.each(['classic', 'forgeops'])(
    'does not exclude the same template IDs on %s deployments',
    async (deploymentType) => {
      state.setDeploymentType(deploymentType);
      getConfigEntity.mockImplementation(async ({ entityId }) =>
        configurations.find((c) => c._id === entityId)
      );

      const result = await exportConfigEntities({ state });

      expect(Object.keys(result.idm)).toEqual(configurations.map((c) => c._id));
      expect(getConfigEntity).toHaveBeenCalledTimes(configurations.length);
    }
  );

  test('continues reporting forbidden errors for non-protected entities', async () => {
    getConfigEntity.mockRejectedValue(
      Object.assign(new AxiosError('Forbidden', 'ERR_BAD_REQUEST'), {
        response: { status: 403, data: { message: 'Forbidden' } },
      })
    );

    await expect(
      exportConfigEntities({
        options: { entitiesToExport: [customTemplate._id] },
        state,
      })
    ).rejects.toMatchObject({
      originalErrors: [expect.objectContaining({ httpStatus: 403 })],
    });
  });
});
