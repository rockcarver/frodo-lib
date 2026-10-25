/**
 * Unit tests for updateRemote(), the helper behind every import that reads the
 * remote entity first and writes only when something changed.
 *
 * Run with:
 *
 *        npm run test:only ExportImportUtils.updateRemote
 *
 * Origin: frodo-cli#519 (an import changed the modification date of scripts,
 * policy sets and resource types that had not changed). updateRemote() decides
 * three things, and each has a way to go quietly wrong:
 *
 *   1. Skip: an identical remote entity is not written, so AM does not touch
 *      its modification date. What counts as identical must ignore the
 *      bookkeeping attributes AM adds, or nothing is ever skipped.
 *   2. Update: a different entity is written, and `forceUpdate` writes even an
 *      identical one.
 *   3. Create: only a confirmed "not found" falls through to the create. Any
 *      other failure (a validation error, a permission error) must be thrown
 *      as it is. Before 8e476ff68 every error fell through, and a 400
 *      "Invalid resource type" came back as a 409 "Application already
 *      exists" from the create that followed.
 *
 * The recorded tests of the ops modules cover the not found case of three
 * modules against a real tenant; nothing covered the other failures, and
 * nothing exercised updateRemote() on its own. No recording and no tenant is
 * needed here: the read, update and create functions are fakes.
 */
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';
import { FrodoError } from '../ops/FrodoError';
import State from '../shared/State';
import { updateRemote } from './ExportImportUtils';

type Entity = Record<string, unknown>;

/** An error shaped like what the API layer throws for an HTTP failure. */
function httpError(status: number): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
    undefined,
    undefined,
    { status, statusText: '', headers: {}, config: {} as never, data: {} }
  );
}

function setup(options: { forceUpdate?: boolean } = {}) {
  const state = State({});
  state.setForceUpdate(!!options.forceUpdate);
  const verbose: string[] = [];
  state.setVerboseHandler((message) => verbose.push(String(message)));
  return { state, verbose };
}

const local: Entity = { name: 'My Script', language: 'JAVASCRIPT' };

describe('updateRemote()', () => {
  describe('skip an identical remote entity', () => {
    test('returns null and writes nothing when the remote entity is identical', async () => {
      const { state } = setup();
      const readFn = jest.fn(async () => ({ ...local }));
      const updateFn = jest.fn(async () => ({ ...local }));
      const createFn = jest.fn(async () => ({ ...local }));
      const result = await updateRemote({
        type: 'script',
        data: local,
        readFn,
        updateFn,
        createFn,
        state,
      });
      expect(result).toBeNull();
      expect(readFn).toHaveBeenCalledTimes(1);
      expect(updateFn).not.toHaveBeenCalled();
      expect(createFn).not.toHaveBeenCalled();
    });

    // AM stamps these on every write and an export leaves them out (or has old
    // values), so a difference in any of them alone must not cause a write.
    test.each([
      '_id',
      'id',
      '_rev',
      'createdBy',
      'creationDate',
      'lastModifiedBy',
      'lastModifiedDate',
      'lastChangeDate',
      'lastChangedBy',
      'modifiedDate',
      'createdDate',
    ])('ignores %s when comparing', async (attribute) => {
      const { state } = setup();
      const updateFn = jest.fn(async () => ({ ...local }));
      const result = await updateRemote({
        type: 'script',
        data: { ...local, [attribute]: 'value in the file' },
        readFn: async () => ({ ...local, [attribute]: 'value in the tenant' }),
        updateFn,
        state,
      });
      expect(result).toBeNull();
      expect(updateFn).not.toHaveBeenCalled();
    });

    test('ignores bookkeeping attributes that exist on only one side', async () => {
      const { state } = setup();
      const updateFn = jest.fn(async () => ({ ...local }));
      const result = await updateRemote({
        type: 'resource type',
        data: local,
        readFn: async () => ({
          ...local,
          _rev: '42',
          lastModifiedDate: 1790000000000,
          createdBy: 'someone',
        }),
        updateFn,
        state,
      });
      expect(result).toBeNull();
      expect(updateFn).not.toHaveBeenCalled();
    });

    test('also ignores the attributes the caller names', async () => {
      const { state } = setup();
      const updateFn = jest.fn(async () => ({ ...local }));
      const result = await updateRemote({
        type: 'script',
        data: { ...local, exports: { a: 1 } },
        readFn: async () => ({ ...local, exports: { a: 2 } }),
        updateFn,
        ignoreAttributes: ['exports'],
        state,
      });
      expect(result).toBeNull();
      expect(updateFn).not.toHaveBeenCalled();
    });

    test('does not ignore an attribute the caller did not name', async () => {
      const { state } = setup();
      const updateFn = jest.fn(async () => ({ ...local, exports: { a: 1 } }));
      await updateRemote({
        type: 'script',
        data: { ...local, exports: { a: 1 } },
        readFn: async () => ({ ...local, exports: { a: 2 } }),
        updateFn,
        state,
      });
      expect(updateFn).toHaveBeenCalledTimes(1);
    });

    test('says why it skipped in the verbose log', async () => {
      const { state, verbose } = setup();
      await updateRemote({
        type: 'script',
        data: local,
        readFn: async () => ({ ...local }),
        updateFn: async () => ({ ...local }),
        state,
      });
      expect(verbose.join('\n')).toMatch(/Comparing script with remote/);
      expect(verbose.join('\n')).toMatch(
        /Identical script already exists in remote\. Update skipped/
      );
    });
  });

  describe('update a different remote entity', () => {
    test('writes and returns the result when a value differs', async () => {
      const { state } = setup();
      const written = { ...local, language: 'GROOVY' };
      const updateFn = jest.fn(async () => written);
      const result = await updateRemote({
        type: 'script',
        data: written,
        readFn: async () => ({ ...local }),
        updateFn,
        state,
      });
      expect(result).toBe(written);
      expect(updateFn).toHaveBeenCalledTimes(1);
    });

    test('writes when a nested value differs', async () => {
      const { state } = setup();
      const updateFn = jest.fn(async () => ({}));
      await updateRemote({
        type: 'policy set',
        data: { name: 'set', conditions: ['AND', 'OR'] },
        readFn: async () => ({ name: 'set', conditions: ['AND', 'NOT'] }),
        updateFn,
        state,
      });
      expect(updateFn).toHaveBeenCalledTimes(1);
    });

    test('writes when the remote entity has an attribute the data does not', async () => {
      const { state } = setup();
      const updateFn = jest.fn(async () => ({}));
      await updateRemote({
        type: 'script',
        data: local,
        readFn: async () => ({ ...local, description: 'added in the tenant' }),
        updateFn,
        state,
      });
      expect(updateFn).toHaveBeenCalledTimes(1);
    });

    test('writes without comparing when no read function is given', async () => {
      const { state } = setup();
      const updateFn = jest.fn(async () => ({ ...local }));
      const result = await updateRemote({
        type: 'script',
        data: local,
        updateFn,
        state,
      });
      expect(result).toEqual(local);
      expect(updateFn).toHaveBeenCalledTimes(1);
    });

    test('writes when the remote entity cannot be read', async () => {
      const { state, verbose } = setup();
      const updateFn = jest.fn(async () => ({ ...local }));
      const result = await updateRemote({
        type: 'script',
        data: local,
        readFn: async () => {
          throw httpError(500);
        },
        updateFn,
        state,
      });
      expect(result).toEqual(local);
      expect(updateFn).toHaveBeenCalledTimes(1);
      expect(verbose.join('\n')).toMatch(/Unable to compare script/);
    });

    test('forceUpdate writes an identical entity without reading it', async () => {
      const { state } = setup({ forceUpdate: true });
      const readFn = jest.fn(async () => ({ ...local }));
      const updateFn = jest.fn(async () => ({ ...local }));
      const result = await updateRemote({
        type: 'script',
        data: local,
        readFn,
        updateFn,
        state,
      });
      expect(result).toEqual(local);
      expect(readFn).not.toHaveBeenCalled();
      expect(updateFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('create only what is not found', () => {
    const createdEntity = { ...local, created: true };

    test('creates when the update fails with a 404', async () => {
      const { state, verbose } = setup();
      const createFn = jest.fn(async () => createdEntity);
      const result = await updateRemote({
        type: 'policy set',
        data: local,
        updateFn: async () => {
          throw httpError(404);
        },
        createFn,
        state,
      });
      expect(result).toBe(createdEntity);
      expect(createFn).toHaveBeenCalledTimes(1);
      expect(verbose.join('\n')).toMatch(/Attempting create/);
    });

    test('creates when the 404 is wrapped in a FrodoError', async () => {
      const { state } = setup();
      const createFn = jest.fn(async () => createdEntity);
      const result = await updateRemote({
        type: 'ESV secret',
        data: local,
        updateFn: async () => {
          throw new FrodoError('Error updating secret', httpError(404));
        },
        createFn,
        state,
      });
      expect(result).toBe(createdEntity);
      expect(createFn).toHaveBeenCalledTimes(1);
    });

    test('creates a new entity: unreadable and not found, in that order', async () => {
      const { state } = setup();
      const calls: string[] = [];
      const result = await updateRemote({
        type: 'resource type',
        data: local,
        readFn: async () => {
          calls.push('read');
          throw httpError(404);
        },
        updateFn: async () => {
          calls.push('update');
          throw httpError(404);
        },
        createFn: async () => {
          calls.push('create');
          return createdEntity;
        },
        state,
      });
      expect(result).toBe(createdEntity);
      expect(calls).toEqual(['read', 'update', 'create']);
    });

    // The regression this file exists for: the real cause must reach the user.
    test.each([
      ['a validation error', 400],
      ['an authentication error', 401],
      ['a permission error', 403],
      ['a conflict', 409],
      ['a server error', 500],
      ['an unavailable service', 503],
    ])(
      'throws %s (%i) from the update as it is, and does not create',
      async (_what, status) => {
        const { state } = setup();
        const failure = httpError(status);
        const createFn = jest.fn(async () => ({ ...local }));
        await expect(
          updateRemote({
            type: 'policy set',
            data: local,
            updateFn: async () => {
              throw failure;
            },
            createFn,
            state,
          })
        ).rejects.toBe(failure);
        expect(createFn).not.toHaveBeenCalled();
      }
    );

    test('throws a wrapped non-404 error as it is, and does not create', async () => {
      const { state } = setup();
      const failure = new FrodoError('Error updating', httpError(400));
      const createFn = jest.fn(async () => ({ ...local }));
      await expect(
        updateRemote({
          type: 'policy set',
          data: local,
          updateFn: async () => {
            throw failure;
          },
          createFn,
          state,
        })
      ).rejects.toBe(failure);
      expect(createFn).not.toHaveBeenCalled();
    });

    test('throws an error that carries no HTTP status as it is, and does not create', async () => {
      const { state } = setup();
      const failure = new Error('getaddrinfo ENOTFOUND tenant.example.com');
      const createFn = jest.fn(async () => ({ ...local }));
      await expect(
        updateRemote({
          type: 'script',
          data: local,
          updateFn: async () => {
            throw failure;
          },
          createFn,
          state,
        })
      ).rejects.toBe(failure);
      expect(createFn).not.toHaveBeenCalled();
    });

    test('throws the 404 when there is no create function', async () => {
      const { state } = setup();
      const failure = httpError(404);
      await expect(
        updateRemote({
          type: 'script',
          data: local,
          updateFn: async () => {
            throw failure;
          },
          state,
        })
      ).rejects.toBe(failure);
    });

    test('throws the error of the create when the create fails', async () => {
      const { state } = setup();
      const createFailure = httpError(400);
      await expect(
        updateRemote({
          type: 'policy set',
          data: local,
          updateFn: async () => {
            throw httpError(404);
          },
          createFn: async () => {
            throw createFailure;
          },
          state,
        })
      ).rejects.toBe(createFailure);
    });

    test('uses the not found check the caller passes instead of the default', async () => {
      const { state } = setup();
      const createFn = jest.fn(async () => createdEntity);
      const result = await updateRemote({
        type: 'script',
        data: local,
        updateFn: async () => {
          throw httpError(400);
        },
        createFn,
        notFoundCheck: (e) => (e as AxiosError).response?.status === 400,
        state,
      });
      expect(result).toBe(createdEntity);
      expect(createFn).toHaveBeenCalledTimes(1);

      const failure = httpError(404);
      const createFn2 = jest.fn(async () => createdEntity);
      await expect(
        updateRemote({
          type: 'script',
          data: local,
          updateFn: async () => {
            throw failure;
          },
          createFn: createFn2,
          notFoundCheck: () => false,
          state,
        })
      ).rejects.toBe(failure);
      expect(createFn2).not.toHaveBeenCalled();
    });

    test('does not create when the entity was skipped as identical', async () => {
      const { state } = setup();
      const createFn = jest.fn(async () => createdEntity);
      const result = await updateRemote({
        type: 'script',
        data: local,
        readFn: async () => ({ ...local }),
        updateFn: async () => {
          throw httpError(404);
        },
        createFn,
        state,
      });
      expect(result).toBeNull();
      expect(createFn).not.toHaveBeenCalled();
    });
  });
});
