import fs from 'fs';
import path from 'path';
import { getVersion } from './Version';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8')
);

describe('index', () => {
  test('get library version', () => {
    const result = getVersion();
    expect(result).toEqual(`${pkg.version}`);
  });
});
