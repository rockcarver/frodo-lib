import { state } from '../index';
import fs from 'fs';
import path from 'path';
import { getBuildTimestamp, getVersion } from './VersionUtils';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
);

describe('index', () => {
  test('get library version', () => {
    const result = getVersion({ state });
    expect(result).toEqual(`${pkg.version}`);
  });

  test('get library build timestamp falls back to a clear placeholder when not running from a tsup build', () => {
    // Under ts-jest, no bundler ever substitutes __LIB_BUILD_TIMESTAMP__, so
    // this exercises the exact fallback path a real (non-bundled) caller
    // would hit if the identifier were ever left unguarded.
    const result = getBuildTimestamp({ state });
    expect(result).toEqual('unknown (running from source, not a tsup build)');
  });
});
