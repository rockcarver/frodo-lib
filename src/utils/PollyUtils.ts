import { decode, encode, isBase64Encoded } from './Base64Utils';

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

export function filterRecording(recording: {
  request: {
    headers: [{ name: string; value: string }];
    postData: { text: any };
  };
  response: { content: { mimeType: string; text: any } };
}) {
  // request headers
  if (recording.request?.headers) {
    const headers: [{ name: string; value: string }] =
      recording.request.headers;
    headers.map((header) => {
      if (header.name.toUpperCase() === 'AUTHORIZATION') {
        if (isBase64Encoded(header.value)) {
          header.value = encode('username:password');
        } else {
          header.value = header.value.replace(
            /Bearer .+/,
            'Bearer <bearer token>'
          );
        }
      }
      if (header.name.toUpperCase() === 'X-API-KEY') {
        header.value = '<api key>';
      }
      if (header.name.toUpperCase() === 'X-API-SECRET') {
        header.value = '<api secret>';
      }
    });
    recording.request.headers = headers;
  }

  // request post body
  if (recording.request?.postData?.text) {
    let body = recording.request.postData.text;
    body = body.replace(/assertion=.+?&/, 'assertion=<assertion jwt token>&');
    recording.request.postData.text = body;
  }

  // response body
  if (recording.response?.content?.text) {
    let body = recording.response.content.text;
    // JSON content
    if (
      recording.response.content.mimeType === 'application/json;charset=UTF-8'
    ) {
      try {
        const json = JSON.parse(body, (key, value) => {
          if (key === 'access_token') return '<access token>';
          if (key === 'id_token') return '<id token>';
          if (key === 'accessKey') return '<access key>';
          return value;
        });
        if (json.result) {
          for (const obj of json.result) {
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
                //
              }
            }
          }
        }
        body = JSON.stringify(json);
      } catch (error) {
        // ignore
      }
    }
    // Text and XML content
    if (recording.response.content.mimeType === 'text/xml;charset=utf-8') {
      try {
        body = body.replace(
          /<ds:X509Certificate>.+?<\/ds:X509Certificate>/gs,
          `<ds:X509Certificate>${encode('<certificate>')}</ds:X509Certificate>`
        );
      } catch (error) {
        // ignore
      }
    }
    recording.response.content.text = body;
  }
}
