import { state } from '../../index';
import fs from 'fs';
import path from 'path';
import { getVersion } from './VersionUtils';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8')
);

describe('index', () => {
  test('get library version', () => {
    const result = getVersion({ state });
    expect(result).toEqual(`${pkg.version}`);
  });
});
