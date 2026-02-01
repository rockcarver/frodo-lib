import { AxiosError } from 'axios';

export class FrodoError extends Error {
  originalErrors: Error[] = [];
  isHttpError: boolean = false;
  httpCode: string;
  httpStatus: number;
  httpMessage: string;
  httpDetail: string;
  httpErrorText: string;
  httpErrorReason: string;
  httpDescription: string;

  constructor(message: string, originalErrors: Error | Error[] = null) {
    super(message);
    this.name = this.constructor.name;

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }

    if (originalErrors && Array.isArray(originalErrors)) {
      this.originalErrors = originalErrors;
    } else if (originalErrors) {
      this.originalErrors = [originalErrors as Error];
    }

    // determine if http error and set http error fields
    if (originalErrors) {
      const originalError = this.originalErrors[0];
      this.isHttpError = originalError.name === 'AxiosError';
      this.httpCode = originalError['code'];
      this.httpStatus = originalError['response']
        ? originalError['response'].status
        : null;
      this.httpMessage = originalError['response']
        ? originalError['response'].data
          ? originalError['response'].data.message
          : null
        : null;
      this.httpDetail = originalError['response']
        ? originalError['response'].data
          ? originalError['response'].data.detail
          : null
        : null;
      this.httpErrorText = originalError['response']
        ? originalError['response'].data
          ? originalError['response'].data.error
          : null
        : null;
      this.httpErrorReason = originalError['response']
        ? originalError['response'].data
          ? originalError['response'].data.reason
          : null
        : null;
      this.httpDescription = originalError['response']
        ? originalError['response'].data
          ? originalError['response'].data.error_description
          : null
        : null;
    }

    // message = `${message}${this.originalErrors.length ? ` [${this.originalErrors.length} nested error(s)]` : ''}`;

    // super.message = message;
  }

  getOriginalErrors(): Error[] {
    return this.originalErrors;
  }

  getCombinedMessage(level: number = 1): string {
    const indent = '  '.repeat(level);
    let combinedMessage = this.message || '';
    this.originalErrors.forEach((originalError) => {
      switch (originalError.name) {
        case 'FrodoError':
          combinedMessage +=
            `\n${indent}` +
            (originalError as FrodoError).getCombinedMessage(level + 1);
          break;

        case 'AxiosError':
          {
            combinedMessage += `\n${indent}Network error:`;
            combinedMessage += (originalError as AxiosError).config?.url
              ? `\n${indent}  URL: ${(originalError as AxiosError).config.url}`
              : '';
            combinedMessage += (originalError as AxiosError).response?.status
              ? `\n${indent}  Status: ${(originalError as AxiosError).response.status}`
              : '';
            combinedMessage += (originalError as AxiosError).code
              ? `\n${indent}  Code: ${(originalError as AxiosError).code}`
              : '';
            combinedMessage += (originalError as AxiosError).response?.[
              'data'
            ]?.['error']
              ? `\n${indent}  Error: ${(originalError as AxiosError).response?.['data']?.['error']}`
              : '';
            combinedMessage += (originalError as AxiosError).response?.[
              'data'
            ]?.['reason']
              ? `\n${indent}  Reason: ${(originalError as AxiosError).response?.['data']?.['reason']}`
              : '';
            combinedMessage += (originalError as AxiosError).response?.[
              'data'
            ]?.['message']
              ? `\n${indent}  Message: ${(originalError as AxiosError).response?.['data']?.['message']}`
              : '';
            combinedMessage += (originalError as AxiosError).response?.[
              'data'
            ]?.['detail']
              ? `\n${indent}  Detail: ${typeof (originalError as AxiosError).response?.['data']?.['detail'] === 'object' ? JSON.stringify((originalError as AxiosError).response?.['data']?.['detail']) : (originalError as AxiosError).response?.['data']?.['detail']}`
              : '';
            combinedMessage += (originalError as AxiosError).response?.[
              'data'
            ]?.['error_description']
              ? `\n${indent}  Description: ${(originalError as AxiosError).response?.['data']?.['error_description']}`
              : '';
          }
          break;

        default:
          combinedMessage += `\n${indent}` + originalError.message;
          break;
      }
    });
    // if (this.originalErrors.slice(-1))
    //   combinedMessage += '\n  ' + this.originalErrors.slice(-1)[0].stack;
    return combinedMessage;
  }

  toString() {
    return this.getCombinedMessage();
  }
}
