/**
 * Unit tests for how two IGA request operations treat the answer "This operation is not available in PingOne Advanced
 * Identity Cloud." (HTTP 403):
 *
 * - deleteOrphanedRequestFormAssignments() passes unassignRequestForm() of the api layer to getResult(),
 * - importRequestTypes() passes patchRequestType() of the api layer to getResult() for a request type that is not
 *   custom.
 *
 * The error that getResult() receives is the raw AxiosError of the api layer: its answer is in `response.status` and
 * `response.data.message`, it has no `httpStatus` and no `httpMessage`. The item that answers so is skipped without a
 * word: the call is still made, the result callback is not called for it, nothing is thrown, and a debug message names
 * it. Every other answer is a failed item that names the item and nests the cause.
 *
 * Real AxiosErrors, the real getResult() and FrodoError are used, only the api layer is faked.
 *
 * Run with:
 *
 *        npm run test:only IgaRequestOps.notAvailable
 *
 * Origin: frodo-lib#957 (bulk exports and imports report per item). No recording and no tenant is needed. All values
 * are made up.
 */
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';
import type { RequestFormAssignment } from '../../../api/cloud/iga/IgaRequestFormApi';
import type { RequestTypeSkeleton } from '../../../api/cloud/iga/IgaRequestTypeApi';
import State from '../../../shared/State';
import { FrodoError } from '../../FrodoError';

const NOT_AVAILABLE =
  'This operation is not available in PingOne Advanced Identity Cloud.';
const GOVERNANCE = 'https://tenant.example.com/iga/governance';

/** The answer of the server, as the api layer raises it: an AxiosError with the response of the server. */
function axiosAnswer(
  url: string,
  method: string,
  status: number,
  data: object | null
): AxiosError {
  const error = new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST'
  );
  error.config = { url, method } as AxiosError['config'];
  error.response = { status, data } as AxiosError['response'];
  return error;
}

const notAvailable = (url: string, method: string) =>
  axiosAnswer(url, method, 403, { code: 403, message: NOT_AVAILABLE });

/** The api layer, faked. What it throws is set per test. */
let unassignAnswers: Record<string, Error>;
let patchAnswers: Record<string, Error>;

const ASSIGNMENTS: RequestFormAssignment[] = [
  { formId: 'form-1', objectId: 'requestType/ghost-a' },
  { formId: 'form-1', objectId: 'requestType/ghost-b' },
  { formId: 'form-1', objectId: 'requestType/ghost-c' },
];

const getRequestFormAssignments = jest.fn(async (_args?: unknown) => [
  ...ASSIGNMENTS,
]);
const unassignRequestForm = jest.fn(
  async ({
    formId,
    objectId,
  }: {
    formId: string;
    objectId: string;
  }): Promise<RequestFormAssignment> => {
    if (unassignAnswers[objectId]) throw unassignAnswers[objectId];
    return { formId, objectId };
  }
);
// no request type exists, so every assignment to one is orphaned
const queryRequestTypes = jest.fn(async (_args?: unknown) => []);
const getRequestType = jest.fn(
  async ({ typeId }: { typeId: string }): Promise<RequestTypeSkeleton> => ({
    id: typeId,
    displayName: typeId,
  })
);
const patchRequestType = jest.fn(
  async ({ typeId }: { typeId: string }): Promise<RequestTypeSkeleton> => {
    if (patchAnswers[typeId]) throw patchAnswers[typeId];
    return { id: typeId, displayName: typeId };
  }
);

const formApi = await import('../../../api/cloud/iga/IgaRequestFormApi');
const typeApi = await import('../../../api/cloud/iga/IgaRequestTypeApi');
jest.unstable_mockModule('../../../api/cloud/iga/IgaRequestFormApi', () => ({
  ...formApi,
  getRequestFormAssignments,
  unassignRequestForm,
}));
jest.unstable_mockModule('../../../api/cloud/iga/IgaRequestTypeApi', () => ({
  ...typeApi,
  queryRequestTypes,
  getRequestType,
  patchRequestType,
}));

const { deleteOrphanedRequestFormAssignments } =
  await import('./IgaRequestFormOps');
const { importRequestTypes } = await import('./IgaRequestTypeOps');

const state = State({});
const debug = jest.fn();
const debugLines = () => debug.mock.calls.map(([message]) => String(message));
const skipLines = () => debugLines().filter((line) => line.includes('skipped'));

beforeEach(() => {
  jest.clearAllMocks();
  unassignAnswers = {};
  patchAnswers = {};
  state.setDebugHandler(debug);
});

afterEach(() => {
  state.setDebugHandler(undefined);
});

const unassignUrl = `${GOVERNANCE}/requestForms/assignments/unassign`;
const objectIds = () =>
  unassignRequestForm.mock.calls.map(([{ objectId }]) => objectId);

describe('deleteOrphanedRequestFormAssignments()', () => {
  test('unassigns every orphaned assignment and reports each', async () => {
    const resultCallback = jest.fn();

    const result = await deleteOrphanedRequestFormAssignments({
      resultCallback,
      state,
    });

    expect(result).toEqual(ASSIGNMENTS);
    expect(resultCallback.mock.calls).toEqual(
      ASSIGNMENTS.map((a) => [undefined, a])
    );
    expect(skipLines()).toEqual([]);
  });

  test('skips the assignment that answers 403 "not available in PingOne Advanced Identity Cloud": the call is made, the callback is not told, nothing is thrown, a debug message names it', async () => {
    unassignAnswers['requestType/ghost-b'] = notAvailable(unassignUrl, 'post');
    const resultCallback = jest.fn();

    await deleteOrphanedRequestFormAssignments({ resultCallback, state });

    // the unassign of the assignment is still sent, and the assignments after it are still unassigned
    expect(objectIds()).toEqual(ASSIGNMENTS.map((a) => a.objectId));
    expect(resultCallback.mock.calls).toEqual([
      [undefined, ASSIGNMENTS[0]],
      [undefined, ASSIGNMENTS[2]],
    ]);
    const lines = skipLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Error deleting orphaned assignment');
    expect(lines[0]).toContain(
      'not available in PingOne Advanced Identity Cloud'
    );
    expect(lines[0]).toContain(`[POST ${unassignUrl}]`);
  });

  test('skips the assignment without a callback too: nothing is thrown', async () => {
    unassignAnswers['requestType/ghost-a'] = notAvailable(unassignUrl, 'post');

    await expect(
      deleteOrphanedRequestFormAssignments({ state })
    ).resolves.toBeDefined();

    expect(objectIds()).toHaveLength(3);
    expect(skipLines()).toHaveLength(1);
  });

  test.each([
    [
      'a 403 with another message',
      () =>
        axiosAnswer(unassignUrl, 'post', 403, {
          code: 403,
          message: 'Forbidden',
        }),
    ],
    ['a 403 without a body', () => axiosAnswer(unassignUrl, 'post', 403, null)],
    [
      'a 500 with the "not available" message',
      () =>
        axiosAnswer(unassignUrl, 'post', 500, {
          code: 500,
          message: NOT_AVAILABLE,
        }),
    ],
  ])(
    '%s is a failed item: the callback is told, it nests the cause, the others are still unassigned',
    async (_answer, makeCause) => {
      const cause = makeCause();
      unassignAnswers['requestType/ghost-b'] = cause;
      const resultCallback = jest.fn();

      await deleteOrphanedRequestFormAssignments({ resultCallback, state });

      expect(objectIds()).toHaveLength(3);
      const failures = resultCallback.mock.calls.filter(([error]) => error);
      expect(failures).toHaveLength(1);
      const [error] = failures[0] as [FrodoError];
      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe('Error deleting orphaned assignment');
      expect(error.originalErrors[0]).toBe(cause);
      expect(skipLines()).toEqual([]);
    }
  );
});

describe('importRequestTypes() of a request type that is not custom', () => {
  const importData = {
    requestType: {
      'type-a': { id: 'type-a', displayName: 'Type A', custom: false },
      'type-b': { id: 'type-b', displayName: 'Type B', custom: false },
      'type-c': { id: 'type-c', displayName: 'Type C', custom: false },
    },
  } as unknown as Parameters<typeof importRequestTypes>[0]['importData'];
  const patchUrl = (typeId: string) => `${GOVERNANCE}/requestTypes/${typeId}`;
  const patched = () =>
    patchRequestType.mock.calls.map(([{ typeId }]) => typeId);

  test('patches every request type and reports each', async () => {
    const resultCallback = jest.fn();

    const result = await importRequestTypes({
      importData,
      resultCallback,
      state,
    });

    expect(patched()).toEqual(['type-a', 'type-b', 'type-c']);
    expect(result.map((r) => r.id)).toEqual(['type-a', 'type-b', 'type-c']);
    expect(skipLines()).toEqual([]);
  });

  test('skips the request type that answers 403 "not available in PingOne Advanced Identity Cloud": the patch is sent, the callback is not told, nothing is thrown, a debug message names it', async () => {
    patchAnswers['type-b'] = notAvailable(patchUrl('type-b'), 'patch');
    const resultCallback = jest.fn();

    const result = await importRequestTypes({
      importData,
      resultCallback,
      state,
    });

    expect(patched()).toEqual(['type-a', 'type-b', 'type-c']);
    expect(result.map((r) => r.id)).toEqual(['type-a', 'type-c']);
    expect(resultCallback.mock.calls.map(([error]) => error)).toEqual([
      undefined,
      undefined,
    ]);
    const lines = skipLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Error importing request type Type B');
    expect(lines[0]).toContain(
      'not available in PingOne Advanced Identity Cloud'
    );
    expect(lines[0]).toContain(`[PATCH ${patchUrl('type-b')}]`);
  });

  test('skips the request type without a callback too: nothing is thrown', async () => {
    patchAnswers['type-a'] = notAvailable(patchUrl('type-a'), 'patch');

    const result = await importRequestTypes({ importData, state });

    expect(result.map((r) => r.id)).toEqual(['type-b', 'type-c']);
    expect(skipLines()).toHaveLength(1);
  });

  test.each([
    [
      'a 403 with another message',
      () =>
        axiosAnswer(patchUrl('type-b'), 'patch', 403, {
          code: 403,
          message: 'Forbidden',
        }),
    ],
    [
      'a 403 without a body',
      () => axiosAnswer(patchUrl('type-b'), 'patch', 403, null),
    ],
    [
      'a 500 with the "not available" message',
      () =>
        axiosAnswer(patchUrl('type-b'), 'patch', 500, {
          code: 500,
          message: NOT_AVAILABLE,
        }),
    ],
  ])(
    '%s is a failed item: the callback is told, it names the request type and nests the cause',
    async (_answer, makeCause) => {
      const cause = makeCause();
      patchAnswers['type-b'] = cause;
      const resultCallback = jest.fn();

      const result = await importRequestTypes({
        importData,
        resultCallback,
        state,
      });

      expect(result.map((r) => r.id)).toEqual(['type-a', 'type-c']);
      const failures = resultCallback.mock.calls.filter(([error]) => error);
      expect(failures).toHaveLength(1);
      const [error] = failures[0] as [FrodoError];
      expect(error.message).toBe('Error importing request type Type B');
      expect(error.originalErrors[0]).toBe(cause);
      expect(skipLines()).toEqual([]);
    }
  );
});
