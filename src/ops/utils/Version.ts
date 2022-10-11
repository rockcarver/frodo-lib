import fs from 'fs';
import axios, { AxiosProxyConfig } from 'axios';
import path from 'path';

import { fileURLToPath } from 'url';

const timeout = 30000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8')
);
const userAgent = `${pkg.name}/${pkg.version}`;

export function getVersion() {
  return `${pkg.version}`;
}

function getProxy(): AxiosProxyConfig | false {
  if (process.env.HTTPS_PROXY || process.env.https_proxy) return false;
  return null;
}

function generateApi(baseURL, requestOverride = {}) {
  const requestDetails = {
    baseURL: baseURL,
    timeout,
    headers: {
      'User-Agent': userAgent,
      'Content-Type': 'application/json',
    },
    ...requestOverride,
    proxy: getProxy(),
  };

  const request = axios.create(requestDetails);

  return request;
}

export async function getAllVersions(endpoints) {
  //   const versionInfo = [];
  const reqPromises = [];
  endpoints.forEach((item) => {
    // reqPromises.push(item);
    reqPromises.push(generateApi(item.base).get(item.path));
  });
  const result = await Promise.allSettled(reqPromises);
  return result;
}
