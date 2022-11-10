export class CurlHelper {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: any;
  constructor(config) {
    this.request = config;
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
      const header = `${property}:${headers[property]}`;
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
      const data =
        typeof this.request.data === 'object' ||
        Object.prototype.toString.call(this.request.data) === '[object Array]'
          ? JSON.stringify(this.request.data)
          : this.request.data;
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
