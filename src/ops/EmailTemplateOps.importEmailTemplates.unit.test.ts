import { jest } from '@jest/globals';

/**
 * `importEmailTemplates` tries every email template. Without a result callback
 * a template that cannot be imported does not stop the others and the function
 * throws one error after all of them were tried. With a result callback the
 * outcome of every template is passed to it as it happens (a failed template as
 * an error that names it and carries the cause), nothing is thrown for a failed
 * template and the templates that were imported are returned. A protected
 * template that Identity Cloud refuses is skipped without a word, in both modes.
 * Mocked unit test: no recordings.
 */

const getConfigEntity = jest.fn(async (_args?: any): Promise<any> => ({}));
const putConfigEntity = jest.fn(
  async (args?: any): Promise<any> => args.entityData
);
const deleteConfigEntity = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  getConfigEntity,
  putConfigEntity,
  deleteConfigEntity,
}));

jest.unstable_mockModule('./IdmConfigOps', () => ({
  AIC_PROTECTED_ENTITIES: ['emailTemplate/frOnboarding'],
  readConfigEntitiesByType: jest.fn(async (_args?: any): Promise<any[]> => []),
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

const { default: EmailTemplateOps, importEmailTemplates } =
  await import('./EmailTemplateOps');
const { FrodoError } = await import('./FrodoError');

let deploymentType: string;
const state = {
  getRealm: () => 'alpha',
  getDeploymentType: () => deploymentType,
} as any;

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

/** What axios rejects with for a response with the given status. */
const httpError = (status: number) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    name: 'AxiosError',
    code: 'ERR_BAD_REQUEST',
    response: { status, data: { message: `HTTP ${status}` } },
  });

const template = (name: string) => ({
  _id: `emailTemplate/${name}`,
  enabled: true,
  from: 'noreply@example.com',
  subject: { en: name },
  message: { en: `<p>${name}</p>` },
});

/** Import data with the given email templates. */
function importDataOf(...names: string[]): any {
  return {
    emailTemplate: Object.fromEntries(names.map((n) => [n, template(n)])),
  };
}

let written: string[];
let failures: Map<string, Error>;

beforeEach(() => {
  jest.clearAllMocks();
  deploymentType = 'classic';
  written = [];
  failures = new Map();
  putConfigEntity.mockReset();
  putConfigEntity.mockImplementation(async ({ entityId, entityData }: any) => {
    written.push(entityId);
    if (failures.has(entityId)) throw failures.get(entityId);
    return entityData;
  });
});

const idsOf = (result: any[]) => result.map((it) => it._id);

describe('importEmailTemplates, without a result callback', () => {
  test('imports every template and returns them', async () => {
    const result = await importEmailTemplates({
      importData: importDataOf('a', 'b'),
      state,
    });

    expect(idsOf(result)).toEqual(['emailTemplate/a', 'emailTemplate/b']);
    expect(written).toEqual(['emailTemplate/a', 'emailTemplate/b']);
  });

  test('tries every template when one fails, then throws one error with one nested error per failed template', async () => {
    const failure = httpError(500);
    failures.set('emailTemplate/b', failure);

    const error: any = await importEmailTemplates({
      importData: importDataOf('a', 'b', 'c'),
      state,
    }).catch((e) => e);

    expect(written).toEqual([
      'emailTemplate/a',
      'emailTemplate/b',
      'emailTemplate/c',
    ]);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error importing email templates');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      'Error updating email template b'
    );
    expect(rootCause(error)).toBe(failure);
  });

  test('names every failed template, in the order they were tried', async () => {
    failures.set('emailTemplate/a', httpError(500));
    failures.set('emailTemplate/c', httpError(400));

    const error: any = await importEmailTemplates({
      importData: importDataOf('a', 'b', 'c'),
      state,
    }).catch((e) => e);

    expect(error.originalErrors.map((e: any) => e.message)).toEqual([
      'Error updating email template a',
      'Error updating email template c',
    ]);
  });

  test('throws when the import data has no email templates object', async () => {
    await expect(
      importEmailTemplates({ importData: {} as any, state })
    ).rejects.toThrow();
    expect(written).toEqual([]);
  });
});

describe('importEmailTemplates, with a result callback', () => {
  test('passes every imported template to it, once and in order, and returns them', async () => {
    const callback = jest.fn();

    const result = await importEmailTemplates({
      importData: importDataOf('a', 'b'),
      resultCallback: callback,
      state,
    });

    expect(idsOf(result)).toEqual(['emailTemplate/a', 'emailTemplate/b']);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls.map((call: any[]) => call[0])).toEqual([
      undefined,
      undefined,
    ]);
    expect(callback.mock.calls.map((call: any[]) => call[1]._id)).toEqual([
      'emailTemplate/a',
      'emailTemplate/b',
    ]);
  });

  test('a failed template goes to it as an error that names it, the others are imported and returned, nothing is thrown', async () => {
    const failure = httpError(500);
    failures.set('emailTemplate/b', failure);
    const callback = jest.fn();

    const result = await importEmailTemplates({
      importData: importDataOf('a', 'b', 'c'),
      resultCallback: callback,
      state,
    });

    expect(written).toEqual([
      'emailTemplate/a',
      'emailTemplate/b',
      'emailTemplate/c',
    ]);
    expect(idsOf(result)).toEqual(['emailTemplate/a', 'emailTemplate/c']);
    expect(callback).toHaveBeenCalledTimes(3);
    const [okA, failed, okC] = callback.mock.calls as any[];
    expect(okA[0]).toBeUndefined();
    expect(okA[1]._id).toBe('emailTemplate/a');
    expect(failed[1]).toBeUndefined();
    expect(failed[0]).toBeInstanceOf(FrodoError);
    expect(failed[0].message).toBe('Error importing email template b');
    expect(failed[0].originalErrors[0].message).toBe(
      'Error updating email template b'
    );
    expect(rootCause(failed[0])).toBe(failure);
    expect(okC[0]).toBeUndefined();
    expect(okC[1]._id).toBe('emailTemplate/c');
  });

  test('reports every template as failed and returns nothing when all fail', async () => {
    failures.set('emailTemplate/a', httpError(500));
    failures.set('emailTemplate/b', httpError(500));
    const callback = jest.fn();

    const result = await importEmailTemplates({
      importData: importDataOf('a', 'b'),
      resultCallback: callback,
      state,
    });

    expect(result).toEqual([]);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls.map((call: any[]) => call[0].message)).toEqual([
      'Error importing email template a',
      'Error importing email template b',
    ]);
    expect(callback.mock.calls.every((call) => call[1] === undefined)).toBe(
      true
    );
  });

  test('still throws when the import data has no email templates object', async () => {
    const callback = jest.fn();

    await expect(
      importEmailTemplates({
        importData: {} as any,
        resultCallback: callback,
        state,
      })
    ).rejects.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });

  test('an exception of the callback is not taken for a failed import and not reported a second time', async () => {
    const callback = jest.fn((_error?: any, _result?: any) => {
      throw new Error('callback failed');
    });

    await expect(
      importEmailTemplates({
        importData: importDataOf('a', 'b'),
        resultCallback: callback,
        state,
      })
    ).rejects.toThrow('callback failed');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeUndefined();
    expect(written).toEqual(['emailTemplate/a']);
  });
});

describe('importEmailTemplates, a protected template that Identity Cloud refuses', () => {
  beforeEach(() => {
    deploymentType = 'cloud';
    failures.set('emailTemplate/frOnboarding', httpError(403));
  });

  test('is skipped without a word without a callback, and the others are imported', async () => {
    const result = await importEmailTemplates({
      importData: importDataOf('a', 'frOnboarding', 'b'),
      state,
    });

    expect(idsOf(result)).toEqual(['emailTemplate/a', 'emailTemplate/b']);
    expect(written).toEqual([
      'emailTemplate/a',
      'emailTemplate/frOnboarding',
      'emailTemplate/b',
    ]);
  });

  test('is skipped without a word with a callback: neither a result nor an error', async () => {
    const callback = jest.fn();

    const result = await importEmailTemplates({
      importData: importDataOf('a', 'frOnboarding', 'b'),
      resultCallback: callback,
      state,
    });

    expect(idsOf(result)).toEqual(['emailTemplate/a', 'emailTemplate/b']);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls.map((call: any[]) => call[0])).toEqual([
      undefined,
      undefined,
    ]);
  });

  test('is a failure when the refusal is not a 403', async () => {
    failures.set('emailTemplate/frOnboarding', httpError(500));
    const callback = jest.fn();

    await importEmailTemplates({
      importData: importDataOf('frOnboarding'),
      resultCallback: callback,
      state,
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].message).toBe(
      'Error importing email template frOnboarding'
    );
  });

  test('is a failure on a deployment that is not Identity Cloud', async () => {
    deploymentType = 'classic';
    const callback = jest.fn();

    await importEmailTemplates({
      importData: importDataOf('frOnboarding'),
      resultCallback: callback,
      state,
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].message).toBe(
      'Error importing email template frOnboarding'
    );
  });
});

describe('importEmailTemplates on the facade', () => {
  test('passes the result callback on', async () => {
    failures.set('emailTemplate/a', httpError(500));
    const callback = jest.fn();

    const result = await EmailTemplateOps(state).importEmailTemplates(
      importDataOf('a', 'b'),
      callback
    );

    expect(idsOf(result)).toEqual(['emailTemplate/b']);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls[0][0].message).toBe(
      'Error importing email template a'
    );
  });

  test('without a callback it throws one combined error as before', async () => {
    failures.set('emailTemplate/a', httpError(500));

    const error: any = await EmailTemplateOps(state)
      .importEmailTemplates(importDataOf('a', 'b'))
      .catch((e) => e);

    expect(error.message).toBe('Error importing email templates');
    expect(written).toEqual(['emailTemplate/a', 'emailTemplate/b']);
  });
});
