/**
 * getFailedResponse() reads the answer of the server from the error of a failed request, whether the caller gets the
 * raw AxiosError of the api layer or the FrodoError of an ops function that wraps it (frodo-lib#1033).
 *
 * Run with:
 *
 *        npm run test:only -- FrodoError.getFailedResponse
 */
import { AxiosError } from 'axios';
import { FrodoError, getFailedResponse } from './FrodoError';

function axiosAnswer(status: number): AxiosError {
  const error = new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST'
  );
  error.response = {
    status,
    data: { message: 'sample message' },
    headers: { location: 'https://am.example.com/am/UI/Login' },
  } as AxiosError['response'];
  return error;
}

describe('getFailedResponse', () => {
  test('1: the raw AxiosError gives its own response', () => {
    const cause = axiosAnswer(302);
    expect(getFailedResponse(cause)).toBe(cause.response);
  });

  test('2: a FrodoError that wraps the AxiosError gives the response of the cause', () => {
    const cause = axiosAnswer(404);
    expect(getFailedResponse(new FrodoError('Error reading x', cause))).toBe(
      cause.response
    );
  });

  test('3: a FrodoError that wraps a FrodoError is followed to any depth', () => {
    const cause = axiosAnswer(403);
    const wrapped = new FrodoError(
      'outer',
      new FrodoError('middle', new FrodoError('inner', cause))
    );
    expect(getFailedResponse(wrapped)).toBe(cause.response);
  });

  test('4: only the first original error of each level is followed, like FrodoError.httpStatus', () => {
    const first = new Error('no response here');
    const second = axiosAnswer(500);
    expect(getFailedResponse(new FrodoError('x', [first, second]))).toBe(
      undefined
    );
    const firstWithResponse = axiosAnswer(400);
    expect(
      getFailedResponse(new FrodoError('x', [firstWithResponse, second]))
    ).toBe(firstWithResponse.response);
  });

  test.each([
    ['an error without a response', new Error('connect ECONNRESET')],
    ['a FrodoError without a cause', new FrodoError('nothing wrapped')],
    ['a string', 'failed'],
    ['undefined', undefined],
    ['null', null],
  ])('5: %s gives undefined', (_name, error) => {
    expect(getFailedResponse(error)).toBeUndefined();
  });

  test('6: a cycle of causes ends', () => {
    const a: any = new FrodoError('a');
    const b: any = new FrodoError('b', a);
    a.originalErrors = [b];
    expect(getFailedResponse(a)).toBeUndefined();
  });
});
