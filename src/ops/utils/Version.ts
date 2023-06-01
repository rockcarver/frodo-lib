import fs from 'fs';
import path from 'path';
import { generateReleaseApi } from '../../api/BaseApi';

import { fileURLToPath } from 'url';
import State from '../../shared/State';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8')
);
// const userAgent = `${pkg.name}/${pkg.version}`;

export function getVersion() {
  return `${pkg.version}`;
}

export async function getAllVersions({
  endpoints,
  state,
}: {
  endpoints;
  state: State;
}) {
  const reqPromises = [];
  endpoints.forEach((item) => {
    reqPromises.push(
      generateReleaseApi({ baseUrl: item.base, state }).get(item.path)
    );
  });
  const result = await Promise.allSettled(reqPromises);
  return result;
}
