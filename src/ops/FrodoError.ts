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
      const error = this.originalErrors[0];
      this.isHttpError = error.name === 'AxiosError';
      this.httpCode = error['code'];
      this.httpStatus = error['response'] ? error['response'].status : null;
      this.httpMessage = error['response']
        ? error['response'].data
          ? error['response'].data.message
          : null
        : null;
      this.httpDetail = error['response']
        ? error['response'].data
          ? error['response'].data.detail
          : null
        : null;
      this.httpErrorText = error['response']
        ? error['response'].data
          ? error['response'].data.error
          : null
        : null;
      this.httpErrorReason = error['response']
        ? error['response'].data
          ? error['response'].data.reason
          : null
        : null;
      this.httpDescription = error['response']
        ? error['response'].data
          ? error['response'].data.error_description
          : null
        : null;
    }
  }

  getOriginalErrors(): Error[] {
    return this.originalErrors;
  }

  getCombinedMessage(): string {
    let combinedMessage = this.message || '';
    this.originalErrors.forEach((error) => {
      switch (error.name) {
        case 'FrodoError':
          combinedMessage +=
            '\n  ' + (error as FrodoError).getCombinedMessage();
          break;

        case 'AxiosError':
          {
            combinedMessage += '\n  HTTP client error';
            combinedMessage += this.httpStatus
              ? `\n    URL: ${error['config']['url']}`
              : '';
            combinedMessage += this.httpStatus
              ? `\n    Status: ${this.httpStatus}`
              : '';
            combinedMessage += this.httpCode
              ? `\n    Code: ${this.httpCode}`
              : '';
            combinedMessage += this.httpErrorText
              ? `\n    Error: ${this.httpErrorText}`
              : '';
            combinedMessage += this.httpErrorReason
              ? `\n    Reason: ${this.httpErrorReason}`
              : '';
            combinedMessage += this.httpMessage
              ? `\n    Message: ${this.httpMessage}`
              : '';
            combinedMessage += this.httpDetail
              ? `\n    Detail: ${typeof this.httpDetail === 'object' ? JSON.stringify(this.httpDetail) : this.httpDetail}`
              : '';
            combinedMessage += this.httpDescription
              ? `\n    Description: ${this.httpDescription}`
              : '';
          }
          break;

        default:
          combinedMessage += '\n  ' + error.message;
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
