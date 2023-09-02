import { CurlHelper } from './lib/CurlHelper';

function defaultLogCallback(curlResult, err = undefined) {
  const { command } = curlResult;
  if (err) {
    console.error(err);
  } else {
    console.info(command);
  }
}

export default (instance, callback = defaultLogCallback) => {
  instance.interceptors.request.use(
    (req) => {
      try {
        const curl = new CurlHelper(req);
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
};
