/* eslint-disable no-console */
import { CurlHelper, CurlRedactor } from './lib/CurlHelper';

/**
 * Fallback callback, used only if a caller invokes this module's default
 * export without supplying its own callback. frodo-lib's own real curl-echo
 * path (BaseApi.ts's `curlirize()`) always supplies its own callback, routed
 * through `state`'s `curlirizeHandler` -- this fallback has no `state` in
 * scope (it isn't threaded through the axios interceptor machinery below),
 * so it can't resolve a theme and prints in plain, uncolored text rather
 * than calling frodo-lib's state-aware `printMessage`/`printError` with no
 * state to give them.
 */
function defaultLogCallback(curlResult, err = undefined) {
  const { command } = curlResult;
  if (err) {
    console.error(err);
  } else {
    console.log(command);
  }
}

/**
 * Local change: the request side and the response side are two functions, so
 * that a caller can register the request side before the other request
 * interceptors of an instance. axios runs request interceptors in the reverse
 * order of their registration, and the one that builds the command must run
 * last, when the request holds everything that is going to be sent.
 */
export function curlirizeRequests(
  instance,
  callback = defaultLogCallback,
  redactor: CurlRedactor = {}
) {
  instance.interceptors.request.use(
    (req) => {
      try {
        const curl = new CurlHelper(req, redactor);
        req.curlObject = curl;
        req.curlCommand = curl.generateCommand();
        req.clearCurl = () => {
          delete req.curlObject;
          delete req.curlCommand;
          delete req.clearCurl;
        };
      } catch (err) {
        // Even if the axios middleware is stopped, no error should occur outside.
        callback(null, err);
      } finally {
        if (req.curlirize !== false) {
          callback({
            command: req.curlCommand,
            object: req.curlObject,
          });
        }
        // eslint-disable-next-line no-unsafe-finally
        return req;
      }
    },
    (error) => {
      // Do something with request error
      callback(null, error);
      return Promise.reject(error);
    }
  );
}

export function curlirizeResponses(instance, callback = defaultLogCallback) {
  instance.interceptors.response.use(
    (response) => {
      // Any status code that lie within the range of 2xx cause this function to trigger
      // Do something with response data
      callback({
        response,
      });
      return response;
    },
    (error) => {
      // Any status codes that falls outside the range of 2xx cause this function to trigger
      // Do something with response error
      callback(null, error);
      return Promise.reject(error);
    }
  );
}

export default (
  instance,
  callback = defaultLogCallback,
  redactor: CurlRedactor = {}
) => {
  curlirizeRequests(instance, callback, redactor);
  curlirizeResponses(instance, callback);
};
