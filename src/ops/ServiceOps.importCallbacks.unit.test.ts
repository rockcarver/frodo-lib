import { jest } from '@jest/globals';

/**
 * `importServices` tries every service. Without a result callback the failures
 * are collected and thrown as one combined error; with one, every service that
 * was saved is reported to it as it happens, a failed service is reported as an
 * error that names it, nothing is thrown for it, and the services that could
 * be saved are returned.
 * Mocked unit test: no recordings.
 */

const putService = jest.fn(async (_args?: any): Promise<any> => ({}));
const putServiceNextDescendent = jest.fn(
  async (_args?: any): Promise<any> => ({})
);

const actualApi = await import('../api/ServiceApi');
jest.unstable_mockModule('../api/ServiceApi', () => ({
  ...actualApi,
  putService,
  putServiceNextDescendent,
}));

const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  debugMessage: jest.fn(),
}));

const { importServices } = await import('./ServiceOps');

const state = {
  getRealm: () => 'alpha',
  getDeploymentType: () => 'cloud',
} as any;

/** The messages of an error and of everything nested in it. */
function messagesOf(error: any): string {
  return [error?.message, ...(error?.originalErrors ?? []).map(messagesOf)]
    .filter(Boolean)
    .join(' | ');
}

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

/** three services of the realm, one global service and one of another realm (which is neither imported by default nor reported) */
const importData = (): any => ({
  service: {
    one: { _id: 'one', location: 'alpha' },
    two: { _id: 'two', location: 'alpha' },
    three: { _id: 'three', location: 'alpha' },
    glob: { _id: 'glob', location: 'global' },
    other: { _id: 'other', location: 'bravo' },
  },
});

const realmOptions = { clean: false, global: false, realm: true };

let failure: Error;

beforeEach(() => {
  failure = new Error('HTTP 400');
  putService.mockReset();
  putService.mockImplementation(async ({ serviceId, globalConfig }: any) => ({
    _id: serviceId,
    saved: true,
    globalConfig,
  }));
  putServiceNextDescendent.mockReset();
});

/** the service cannot be saved */
const failService = (serviceId: string) =>
  putService.mockImplementation(async (args: any) => {
    if (args.serviceId === serviceId) throw failure;
    return { _id: args.serviceId, saved: true };
  });

describe('importServices', () => {
  test('imports the services of the realm and the global ones without a callback', async () => {
    const result = await importServices({
      importData: importData(),
      options: { clean: false, global: false, realm: false },
      state,
    });

    expect(result.map((service: any) => service._id)).toEqual([
      'one',
      'two',
      'three',
      'glob',
    ]);
  });

  test('with a callback every service that was saved is reported once, in order, as the service that was saved', async () => {
    const outcomes: any[] = [];

    const result = await importServices({
      importData: importData(),
      options: realmOptions,
      resultCallback: (error, service) => outcomes.push([error, service]),
      state,
    });

    // realm: true imports every service of the file into the realm
    expect(outcomes).toHaveLength(5);
    expect(outcomes.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map(([, service]) => service._id)).toEqual([
      'one',
      'two',
      'three',
      'glob',
      'other',
    ]);
    expect(outcomes.every(([, service]) => service.saved)).toBe(true);
    expect(result[1]).toBe(outcomes[1][1]);
  });

  test('a service that does not belong to the target is neither saved nor reported', async () => {
    const outcomes: any[] = [];

    const result = await importServices({
      importData: importData(),
      options: { clean: false, global: false, realm: false },
      resultCallback: (error, service) => outcomes.push([error, service]),
      state,
    });

    expect(outcomes.map(([, service]) => service._id)).toEqual([
      'one',
      'two',
      'three',
      'glob',
    ]);
    expect(result).toHaveLength(4);
    expect(putService).toHaveBeenCalledTimes(4);
  });

  test('with a callback a failed service is reported with its name, the others are saved, nothing is thrown', async () => {
    failService('two');
    const outcomes: any[] = [];

    const result = await importServices({
      importData: importData(),
      options: { clean: false, global: false, realm: false },
      resultCallback: (error, service) => outcomes.push([error, service]),
      state,
    });

    expect(putService).toHaveBeenCalledTimes(4);
    expect(outcomes).toHaveLength(4);
    expect(outcomes[0][1]._id).toBe('one');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe('Error importing service two');
    expect(messagesOf(outcomes[1][0])).toContain(
      'Error putting alpha realm full service config two'
    );
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][1]._id).toBe('three');
    expect(result.map((service: any) => service._id)).toEqual([
      'one',
      'three',
      'glob',
    ]);
  });

  test('with a callback every failure is reported once when all services fail', async () => {
    putService.mockRejectedValue(failure);
    const errors: any[] = [];
    const successes: any[] = [];

    const result = await importServices({
      importData: importData(),
      options: { clean: false, global: false, realm: false },
      resultCallback: (error, service) =>
        error ? errors.push(error) : successes.push(service),
      state,
    });

    expect(successes).toEqual([]);
    expect(errors.map((error) => error.message)).toEqual([
      'Error importing service one',
      'Error importing service two',
      'Error importing service three',
      'Error importing service glob',
    ]);
    expect(result).toEqual([]);
  });

  test('without a callback every service is tried and the failures are thrown as one combined error', async () => {
    failService('two');

    const error: any = await importServices({
      importData: importData(),
      options: { clean: false, global: false, realm: false },
      state,
    }).catch((e) => e);

    expect(putService).toHaveBeenCalledTimes(4);
    expect(error.message).toBe('Error importing services');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      'Error putting alpha realm full service configs'
    );
    // the error of the service itself, as before
    expect(error.originalErrors[0].originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].originalErrors[0].message).toBe(
      'Error putting alpha realm full service config two'
    );
    expect(rootCause(error)).toBe(failure);
  });

  test('a failure to put a descendent of a service is a failed service', async () => {
    putServiceNextDescendent.mockRejectedValue(failure);
    const data = importData();
    data.service.two.nextDescendents = [{ _id: 'child', _type: { _id: 't' } }];
    const outcomes: any[] = [];

    await importServices({
      importData: data,
      options: { clean: false, global: false, realm: false },
      resultCallback: (error, service) => outcomes.push([error, service]),
      state,
    });

    expect(outcomes).toHaveLength(4);
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe('Error importing service two');
    expect(messagesOf(outcomes[1][0])).toContain("descendent 'child'");
  });

  test('import data that cannot be read still throws, with and without a callback', async () => {
    const callback = jest.fn();

    const withCallback: any = await importServices({
      importData: {} as any,
      options: realmOptions,
      resultCallback: callback,
      state,
    }).catch((e) => e);
    const without: any = await importServices({
      importData: {} as any,
      options: realmOptions,
      state,
    }).catch((e) => e);

    expect(withCallback.message).toBe('Error importing services');
    expect(without.message).toBe('Error importing services');
    expect(callback).not.toHaveBeenCalled();
  });

  test('an exception of the callback is not reported to the callback as a failed service', async () => {
    const callback = jest.fn((_error?: any, _service?: any) => {
      throw new Error('callback bug');
    });

    const error: any = await importServices({
      importData: importData(),
      options: { clean: false, global: false, realm: false },
      resultCallback: callback,
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing services');
    expect(rootCause(error).message).toBe('callback bug');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeUndefined();
  });
});

describe('the facade', () => {
  test('importServices passes the callback on', async () => {
    const { default: Service } = await import('./ServiceOps');
    failService('two');
    const outcomes: any[] = [];

    await Service(state).importServices(
      importData(),
      { clean: false, global: false, realm: false },
      (error, service) => outcomes.push([error, service])
    );

    expect(outcomes).toHaveLength(4);
    expect(outcomes[1][0].message).toBe('Error importing service two');
  });
});
