/**
 * Run tests
 *
 *        npm run test:only ServiceOps.putFullService.notFound
 *
 * putFullService() with `clean` deletes the service first and ignores the answer "404 Not Found", because there is
 * nothing to clean when the service does not exist yet; every other failure ends the import (frodo-lib#1033). The
 * delete goes through deleteFullService(), which wraps a failed request in a FrodoError, so the answer must be read
 * from the wrapped error as well as from the raw one.
 *
 * Mocked unit test: only the api layer is replaced, no recordings, no tenant.
 */
import { jest } from '@jest/globals';

const deleteService = jest.fn(async (_args?: any): Promise<any> => ({}));
const getServiceDescendents = jest.fn(async (_args?: any): Promise<any> => []);
const putService = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/ServiceApi', () => ({
  deleteService,
  deleteServiceNextDescendent: jest.fn(),
  getListOfServices: jest.fn(),
  getService: jest.fn(),
  getServiceDescendents,
  putService,
  putServiceNextDescendent: jest.fn(),
}));

const { putFullService } = await import('./ServiceOps');
const { default: StateImpl } = await import('../shared/State');

const state = StateImpl({});
state.setRealm('alpha');

/** An error as axios raises it for a response. */
function answer(status: number, message: string) {
  const error: any = new Error(`Request failed with status code ${status}`);
  error.name = 'AxiosError';
  error.response = { status, data: { message } };
  return error;
}

const fullServiceData: any = {
  _id: 'sample',
  _type: { _id: 'sample', name: 'Sample', collection: false },
  setting: 'value',
};

beforeEach(() => {
  deleteService.mockReset();
  getServiceDescendents.mockReset();
  getServiceDescendents.mockResolvedValue([]);
  putService.mockReset();
  putService.mockImplementation(async ({ serviceData }: any) => serviceData);
});

describe('putFullService with clean', () => {
  test('1: a service that does not exist yet (404 Not Found) is nothing to clean, the import goes on', async () => {
    deleteService.mockRejectedValue(answer(404, 'Not Found'));

    await putFullService({
      serviceId: 'sample',
      fullServiceData,
      clean: true,
      state,
    });

    expect(deleteService).toHaveBeenCalledTimes(1);
    expect(putService).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['a 404 with another message', answer(404, 'Something else')],
    ['a 403', answer(403, 'Forbidden')],
    ['a 500', answer(500, 'Server error')],
  ])('2: %s ends the import with the error', async (_name, failure) => {
    deleteService.mockRejectedValue(failure);

    await expect(
      putFullService({
        serviceId: 'sample',
        fullServiceData,
        clean: true,
        state,
      })
    ).rejects.toMatchObject({
      name: 'FrodoError',
      originalErrors: [
        expect.objectContaining({
          message: "Error deleting service 'sample' before import",
        }),
      ],
    });
    expect(putService).not.toHaveBeenCalled();
  });
});
