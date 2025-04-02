import { decode, encode, isBase64Encoded } from './Base64Utils';

export type Recording = {
  request: {
    url: string;
    headers: [{ name: string; value: string }];
    postData: { mimeType: string; text: any };
  };
  response: {
    content: { mimeType: string; text: any };
    cookies: {
      httpOnly: boolean;
      name: string;
      path: string;
      value: string;
    }[];
    headers: [{ name: string; value: string }];
  };
};

export function defaultMatchRequestsBy(protocol: boolean = true) {
  return {
    method: true,
    headers: false, // do not match headers, because "Authorization" header is sent only at recording time
    body: true,
    order: false,
    url: {
      protocol,
      username: false,
      password: false,
      hostname: false, // we will record from different envs but run tests always against `frodo-dev`
      port: false,
      pathname: true,
      query: true,
      hash: true,
    },
  };
}

export function filterRecording(recording: Recording) {
  // proxy request url - proxied requests are recorded as: http://proxy-host:proxy-port/https://host/path
  // e.g. http://127.0.0.1:3128/https://openam-frodo-dev.forgeblocks.com/environment/release
  // to keep recordings the same whether or not a proxy was used, we must remove the proxy from the url
  if (recording.request?.url) {
    recording.request.url = cleanupProxyRequestUrl(recording.request.url);
  }

  // request headers
  if (recording.request?.headers) {
    recording.request.headers.forEach(obfuscateHeader);
  }

  // request post body
  if (recording.request?.postData?.text) {
    obfuscateData(recording.request.postData);
  }

  // response cookies
  if (recording.response?.cookies) {
    for (const cookie of recording.response.cookies) {
      cookie.value = '<cookie>';
    }
  }

  // response headers
  if (recording.response?.headers) {
    recording.response.headers.forEach(obfuscateHeader);
  }

  // response body
  if (recording.response?.content?.text) {
    obfuscateData(recording.response.content);
  }
}

function obfuscateHeader(header: { name: string; value: string }): void {
  if (header.name.toUpperCase() === 'AUTHORIZATION') {
    if (isBase64Encoded(header.value)) {
      header.value = encode('username:password');
    } else {
      header.value = header.value.replace(/Bearer .+/, 'Bearer <bearer token>');
    }
  }
  if (header.name.toUpperCase() === 'X-API-KEY') {
    header.value = '<api key>';
  }
  if (header.name.toUpperCase() === 'X-API-SECRET') {
    header.value = '<api secret>';
  }
  if (header.name.toUpperCase() === 'COOKIE') {
    header.value = header.value.replace(/=[^;]*/g, '=<cookie>');
  }
  if (header.name.toUpperCase() === 'SET-COOKIE') {
    // The first attribute should always be the cookie in this header, so only replace that attribute
    header.value = header.value.replace(/=[^;]*/, '=<cookie>');
  }
}

function obfuscateData(data: { mimeType: string; text: any }): void {
  // JSON content
  if (data.mimeType.startsWith('application/json')) {
    data.text = obfuscateJsonString(data.text);
    // XML content
  } else if (data.mimeType.startsWith('text/xml')) {
    data.text = obfuscateXmlString(data.text);
    // Form data content
  } else if (data.mimeType.startsWith('application/x-www-form-urlencoded')) {
    data.text = data.text.replace(
      /assertion=.+?&/,
      'assertion=<assertion jwt token>&'
    );
  }
}

function obfuscateJsonString(json: string): string {
  try {
    const jsonObj = JSON.parse(json, (key, value) => {
      if (key === 'access_token') return '<access token>';
      if (key === 'id_token') return '<id token>';
      if (key === 'tokenId') return '<token id>';
      if (key === 'accessKey') return '<access key>';
      return value;
    });
    if (jsonObj.result) {
      for (const obj of jsonObj.result) {
        // check for scripts
        if (obj.script) {
          try {
            let script = decode(obj.script);
            script = script.replace(
              /(var .*?(?:Sid|sid|Secret|secret|PhoneNumberFrom) = (?:"|'))(.*?)((?:"|'))/g,
              '$1<secret>$3'
            );
            obj.script = encode(script);
          } catch (error) {
            // ignore
          }
        }
      }
    }
    return JSON.stringify(jsonObj);
  } catch (error) {
    // ignore
  }
}

function obfuscateXmlString(xml: string): string {
  try {
    return xml.replace(
      /<ds:X509Certificate>.+?<\/ds:X509Certificate>/gs,
      `<ds:X509Certificate>${encode('<certificate>')}</ds:X509Certificate>`
    );
  } catch (error) {
    // ignore
  }
}

export function cleanupProxyRequestUrl(url: string): string {
  const re = /https??:\/\//g;
  const results = (url || '').match(re) || [];
  const count = results.length;
  if (count <= 1) return url;
  return url.substring(url.lastIndexOf(results[1]));
}
