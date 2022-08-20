import fs from 'fs';
import { getVersion } from '.';

const pkg = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url))
);

describe('index', () => {
  test('get library version', () => {
    const result = getVersion();
    expect(result).toEqual(`v${pkg.version}`);
  });
});
