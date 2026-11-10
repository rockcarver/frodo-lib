/**
 * Local change to the vendored module (see README.md in the parent folder): the
 * caller can pass a redactor, which sees every header value and the request body
 * before they are written into the command. Without one the command holds the
 * values as they are, as before.
 */
export type CurlRedactor = {
  header?: (name: string, value: any) => any;
  body?: (data: any) => any;
};

export class CurlHelper {
  request: any;
  redactor: CurlRedactor;
  constructor(config, redactor: CurlRedactor = {}) {
    this.request = config;
    this.redactor = redactor;
  }

  getHeaders() {
    let headers = this.request.headers,
      curlHeaders = '';

    // get the headers concerning the appropriate method (defined in the global axios instance)
    // eslint-disable-next-line no-prototype-builtins
    if (headers.hasOwnProperty('common')) {
      headers = this.request.headers[this.request.method];
    }

    // add any custom headers (defined upon calling methods like .get(), .post(), etc.)
    for (const property in this.request.headers) {
      if (
        !['common', 'delete', 'get', 'head', 'patch', 'post', 'put'].includes(
          property
        )
      ) {
        headers[property] = this.request.headers[property];
      }
    }

    for (const property in headers) {
      const value = this.redactor.header
        ? this.redactor.header(property, headers[property])
        : headers[property];
      const header = `${property}:${value}`;
      curlHeaders = `${curlHeaders} -H "${header}"`;
    }

    return curlHeaders.trim();
  }

  getMethod() {
    return `-X ${this.request.method.toUpperCase()}`;
  }

  getBody() {
    if (
      typeof this.request.data !== 'undefined' &&
      this.request.data !== '' &&
      this.request.data !== null &&
      this.request.method.toUpperCase() !== 'GET'
    ) {
      const body = this.redactor.body
        ? this.redactor.body(this.request.data)
        : this.request.data;
      const data =
        typeof body === 'object' ||
        Object.prototype.toString.call(body) === '[object Array]'
          ? JSON.stringify(body)
          : body;
      return `--data '${data}'`.trim();
    } else {
      return '';
    }
  }

  getUrl() {
    if (this.request.baseURL) {
      return this.request.baseURL + '/' + this.request.url;
    }
    return this.request.url;
  }

  getQueryString() {
    let params = '',
      i = 0;

    for (const param in this.request.params) {
      params +=
        i !== 0
          ? `&${param}=${this.request.params[param]}`
          : `?${param}=${this.request.params[param]}`;
      i++;
    }

    return params;
  }

  getBuiltURL() {
    let url = this.getUrl();

    if (this.getQueryString() !== '') {
      url =
        url.charAt(url.length - 1) === '/'
          ? url.substr(0, url.length - 1)
          : url;
      url += this.getQueryString();
    }

    return url.trim();
  }

  generateCommand() {
    return `curl ${this.getMethod()} ${this.getHeaders()} ${this.getBody()} "${this.getBuiltURL()}"`
      .trim()
      .replace(/\s{2,}/g, ' ');
  }
}
