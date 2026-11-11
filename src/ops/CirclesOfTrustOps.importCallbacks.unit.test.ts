import { jest } from '@jest/globals';

/**
 * `importCirclesOfTrust` tries every circle of trust. Without a result
 * callback the failures are collected and thrown as one combined error; with
 * one, every circle of trust that was created or updated is reported to it as
 * it happens, a failed circle of trust is reported as an error that names it,
 * nothing is thrown for it, and a failure to read the entity providers still
 * throws.
 * Mocked unit test: no recordings.
 */

const createCircleOfTrust = jest.fn(async (_args?: any): Promise<any> => ({}));
const getCircleOfTrust = jest.fn(async (_args?: any): Promise<any> => ({}));
const updateCircleOfTrust = jest.fn(async (_args?: any): Promise<any> => ({}));

const actualApi = await import('../api/CirclesOfTrustApi');
jest.unstable_mockModule('../api/CirclesOfTrustApi', () => ({
  ...actualApi,
  createCircleOfTrust,
  getCircleOfTrust,
  updateCircleOfTrust,
}));

const readSaml2EntityIds = jest.fn(async (_args?: any): Promise<any> => [
  'a',
  'b',
  'c',
]);
const actualSaml2Ops = await import('./Saml2Ops');
jest.unstable_mockModule('./Saml2Ops', () => ({
  ...actualSaml2Ops,
  readSaml2EntityIds,
}));

const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  debugMessage: jest.fn(),
}));

const { importCirclesOfTrust } = await import('./CirclesOfTrustOps');

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

const importData = (): any => ({
  saml: {
    cot: {
      cot1: { _id: 'cot1', trustedProviders: ['a|saml2'] },
      cot2: { _id: 'cot2', trustedProviders: ['b|saml2'] },
      cot3: { _id: 'cot3', trustedProviders: ['c|saml2'] },
    },
  },
});

let failure: Error;

beforeEach(() => {
  failure = new Error('HTTP 500');
  createCircleOfTrust.mockReset();
  createCircleOfTrust.mockImplementation(async ({ cotData }: any) => ({
    ...cotData,
    created: true,
  }));
  getCircleOfTrust.mockReset();
  updateCircleOfTrust.mockReset();
  updateCircleOfTrust.mockImplementation(async ({ cotData }: any) => ({
    ...cotData,
    updated: true,
  }));
  readSaml2EntityIds.mockReset();
  readSaml2EntityIds.mockResolvedValue(['a', 'b', 'c']);
});

/** the create of a circle of trust fails */
const failCreate = (cotId: string, error: Error = failure) =>
  createCircleOfTrust.mockImplementation(async ({ cotData }: any) => {
    if (cotData._id === cotId) throw error;
    return { ...cotData, created: true };
  });

/** the create of a circle of trust answers that it exists, with the given trusted providers */
const existing = (cotId: string, trustedProviders: string[]) => {
  createCircleOfTrust.mockImplementation(async ({ cotData }: any) => {
    if (cotData._id === cotId) {
      throw Object.assign(new Error('HTTP 409'), { response: { status: 409 } });
    }
    return { ...cotData, created: true };
  });
  getCircleOfTrust.mockResolvedValue({ _id: cotId, trustedProviders });
};

describe('importCirclesOfTrust', () => {
  test('imports every circle of trust without a callback', async () => {
    const responses = await importCirclesOfTrust({
      importData: importData(),
      state,
    });

    expect(responses.map((it: any) => it._id)).toEqual([
      'cot1',
      'cot2',
      'cot3',
    ]);
  });

  test('with a callback every circle of trust is reported once, in order, as the circle that was written', async () => {
    const outcomes: any[] = [];

    const responses = await importCirclesOfTrust({
      importData: importData(),
      resultCallback: (error, cot) => outcomes.push([error, cot]),
      state,
    });

    expect(outcomes).toHaveLength(3);
    expect(outcomes.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map(([, cot]) => cot._id)).toEqual([
      'cot1',
      'cot2',
      'cot3',
    ]);
    expect(outcomes.every(([, cot]) => cot.created)).toBe(true);
    expect(responses).toHaveLength(3);
    expect(responses[1]).toBe(outcomes[1][1]);
  });

  test('with a callback a failed circle of trust is reported with its name, the others are imported, nothing is thrown', async () => {
    failCreate('cot2');
    const outcomes: any[] = [];

    const responses = await importCirclesOfTrust({
      importData: importData(),
      resultCallback: (error, cot) => outcomes.push([error, cot]),
      state,
    });

    expect(createCircleOfTrust).toHaveBeenCalledTimes(3);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][1]._id).toBe('cot1');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(
      'Error importing alpha realm circle of trust cot2'
    );
    expect(messagesOf(outcomes[1][0])).toContain(
      'Error creating alpha realm circle of trust cot2'
    );
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][1]._id).toBe('cot3');
    expect(responses.map((it: any) => it._id)).toEqual(['cot1', 'cot3']);
  });

  test('with a callback every failure is reported once when all circles of trust fail', async () => {
    createCircleOfTrust.mockRejectedValue(failure);
    const errors: any[] = [];
    const successes: any[] = [];

    const responses = await importCirclesOfTrust({
      importData: importData(),
      resultCallback: (error, cot) =>
        error ? errors.push(error) : successes.push(cot),
      state,
    });

    expect(successes).toEqual([]);
    expect(errors.map((error) => error.message)).toEqual([
      'Error importing alpha realm circle of trust cot1',
      'Error importing alpha realm circle of trust cot2',
      'Error importing alpha realm circle of trust cot3',
    ]);
    expect(responses).toEqual([]);
  });

  test('without a callback every circle of trust is tried and the failures are thrown as one combined error', async () => {
    failCreate('cot2');

    const error: any = await importCirclesOfTrust({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(createCircleOfTrust).toHaveBeenCalledTimes(3);
    expect(error.message).toBe('Error importing alpha realm circles of trust');
    expect(error.originalErrors).toHaveLength(1);
    // the error of the circle itself, as before
    expect(error.originalErrors[0].message).toBe(
      'Error creating alpha realm circle of trust cot2'
    );
    expect(rootCause(error)).toBe(failure);
  });

  test('a failure to read the entity providers still throws, with and without a callback', async () => {
    readSaml2EntityIds.mockRejectedValue(new Error('HTTP 500'));
    const callback = jest.fn();

    const withCallback: any = await importCirclesOfTrust({
      importData: importData(),
      resultCallback: callback,
      state,
    }).catch((e) => e);
    const without: any = await importCirclesOfTrust({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(withCallback.message).toBe(
      'Error importing alpha realm circles of trust'
    );
    expect(without.message).toBe(
      'Error importing alpha realm circles of trust'
    );
    expect(callback).not.toHaveBeenCalled();
    expect(createCircleOfTrust).not.toHaveBeenCalled();
  });

  test('a circle of trust that exists is updated and reported once, as the updated circle', async () => {
    existing('cot2', ['a|saml2']);
    const outcomes: any[] = [];

    const responses = await importCirclesOfTrust({
      importData: importData(),
      resultCallback: (error, cot) => outcomes.push([error, cot]),
      state,
    });

    expect(outcomes).toHaveLength(3);
    expect(outcomes[1][0]).toBeUndefined();
    expect(outcomes[1][1].updated).toBe(true);
    expect(outcomes[1][1].trustedProviders.sort()).toEqual([
      'a|saml2',
      'b|saml2',
    ]);
    expect(responses).toHaveLength(3);
  });

  test('a failed update of a circle of trust that exists is a failed circle', async () => {
    existing('cot2', ['a|saml2']);
    updateCircleOfTrust.mockRejectedValue(failure);
    const outcomes: any[] = [];

    const responses = await importCirclesOfTrust({
      importData: importData(),
      resultCallback: (error, cot) => outcomes.push([error, cot]),
      state,
    });

    expect(outcomes).toHaveLength(3);
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(
      'Error importing alpha realm circle of trust cot2'
    );
    expect(responses.map((it: any) => it._id)).toEqual(['cot1', 'cot3']);
  });

  test('a circle of trust that exists and has every trusted provider already is neither reported nor returned', async () => {
    existing('cot2', ['b|saml2']);
    const outcomes: any[] = [];

    const responses = await importCirclesOfTrust({
      importData: importData(),
      resultCallback: (error, cot) => outcomes.push([error, cot]),
      state,
    });

    expect(updateCircleOfTrust).not.toHaveBeenCalled();
    expect(outcomes.map(([, cot]) => cot._id)).toEqual(['cot1', 'cot3']);
    expect(responses.map((it: any) => it._id)).toEqual(['cot1', 'cot3']);
  });

  test('a circle of trust that the entity provider filter leaves out is neither imported nor reported', async () => {
    const outcomes: any[] = [];

    const responses = await importCirclesOfTrust({
      entityProviders: ['b'],
      importData: importData(),
      resultCallback: (error, cot) => outcomes.push([error, cot]),
      state,
    });

    expect(createCircleOfTrust).toHaveBeenCalledTimes(1);
    expect(outcomes.map(([, cot]) => cot._id)).toEqual(['cot2']);
    expect(responses.map((it: any) => it._id)).toEqual(['cot2']);
  });

  test('an exception of the callback is not reported to the callback as a failed circle', async () => {
    const callback = jest.fn((_error?: any, _cot?: any) => {
      throw new Error('callback bug');
    });

    const error: any = await importCirclesOfTrust({
      importData: importData(),
      resultCallback: callback,
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm circles of trust');
    expect(rootCause(error).message).toBe('callback bug');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeUndefined();
  });
});

describe('the facade', () => {
  test('importCirclesOfTrust passes the callback on', async () => {
    const { default: CirclesOfTrust } = await import('./CirclesOfTrustOps');
    failCreate('cot2');
    const outcomes: any[] = [];

    await CirclesOfTrust(state).importCirclesOfTrust(
      importData(),
      [],
      (error, cot) => outcomes.push([error, cot])
    );

    expect(outcomes).toHaveLength(3);
    expect(outcomes[1][0].message).toBe(
      'Error importing alpha realm circle of trust cot2'
    );
  });
});
