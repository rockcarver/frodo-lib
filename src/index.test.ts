import fs from 'fs';
import path from 'path';
import { getVersion } from '.';

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')
);

describe('index', () => {
  test('get library version', () => {
    const result = getVersion();
    expect(result).toEqual(`v${pkg.version}`);
  });
});
