/**
 * Unit tests for the error of `enableAIAgentFeature`.
 *
 * Run with:
 *
 *        npm run test:only EnvAIAgentOps.unit
 *
 * Origin: frodo-lib#1060. The enable action answered a generic HTTP 500 whose cause was only in the platform's logs.
 * The error has to keep the HTTP status and the `x-forgerock-transactionid` of the response, which is how the request
 * is found there.
 */
import { jest } from '@jest/globals';
import { AxiosError, AxiosHeaders } from 'axios';

const enableApi = jest.fn(async (_args?: any): Promise<any> => ({}));
jest.unstable_mockModule('../../api/cloud/EnvAIAgentApi', () => ({
  enableAIAgentFeature: enableApi,
}));

const { enableAIAgentFeature } = await import('./EnvAIAgentOps');
const { getTransactionId } = await import('../FrodoError');
const state = {} as any;

function failure(status: number, headers: any) {
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_RESPONSE',
    {
      url: 'https://tenant.example.com/environment/aiagent?_action=enable',
    } as never,
    undefined,
    {
      status,
      statusText: '',
      headers,
      config: {} as never,
      data: {
        code: status,
        reason: 'Internal Server Error',
        message: 'failed',
      },
    }
  );
}

beforeEach(() => enableApi.mockReset());

describe('enableAIAgentFeature', () => {
  test('returns what the action answered', async () => {
    enableApi.mockResolvedValue({});
    await expect(enableAIAgentFeature({ state })).resolves.toEqual({});
  });

  test('keeps the status and the transaction id of a failed response', async () => {
    enableApi.mockRejectedValue(
      failure(
        500,
        new AxiosHeaders({ 'X-ForgeRock-TransactionId': 'abc-123/0' })
      )
    );
    const error = await enableAIAgentFeature({ state }).catch((e) => e);
    expect(error.name).toBe('FrodoError');
    expect(error.message).toBe('Error enabling AI agent feature');
    expect(error.httpStatus).toBe(500);
    expect(error.httpTransactionId).toBe('abc-123/0');
    expect(error.getCombinedMessage()).toContain('Status: 500');
    expect(error.getCombinedMessage()).toContain('Transaction id: abc-123/0');
  });

  test('reads the header from a plain object of headers too', async () => {
    enableApi.mockRejectedValue(
      failure(500, { 'x-forgerock-transactionid': 'plain-1' })
    );
    const error = await enableAIAgentFeature({ state }).catch((e) => e);
    expect(error.httpTransactionId).toBe('plain-1');
  });

  test('a response without the header leaves the property out', async () => {
    enableApi.mockRejectedValue(failure(500, {}));
    const error = await enableAIAgentFeature({ state }).catch((e) => e);
    expect(error.httpStatus).toBe(500);
    expect('httpTransactionId' in error).toBe(false);
    expect(error.getCombinedMessage()).not.toContain('Transaction id');
  });

  test('an error without a response (network) has no status and no transaction id', async () => {
    enableApi.mockRejectedValue(new Error('socket hang up'));
    const error = await enableAIAgentFeature({ state }).catch((e) => e);
    expect(error.httpStatus).toBeNull();
    expect('httpTransactionId' in error).toBe(false);
  });
});

describe('getTransactionId', () => {
  test('finds the header through wrapped errors, at any depth', async () => {
    enableApi.mockRejectedValue(
      failure(500, { 'x-forgerock-transactionid': 'deep-1' })
    );
    const inner = await enableAIAgentFeature({ state }).catch((e) => e);
    const { FrodoError } = await import('../FrodoError');
    const outer = new FrodoError('outer', new FrodoError('middle', inner));
    expect(getTransactionId(outer)).toBe('deep-1');
  });

  test('is undefined for anything that carries no response', () => {
    expect(getTransactionId(undefined)).toBeUndefined();
    expect(getTransactionId('x')).toBeUndefined();
    expect(getTransactionId(new Error('x'))).toBeUndefined();
  });
});
