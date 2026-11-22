/**
 * Run tests
 *
 *        npm run test:only -- SetupPollyForFrodoLib.argv
 *
 * A recording is named after the command line of the program. The library takes a copy of
 * the command line when it is loaded and hands it to setupPollyForFrodoLib (see
 * src/api/BaseApi.ts), because the setup runs a moment later and the program may have
 * changed `process.argv` in between. These cells give the setup a command line that is not
 * the live one and read the names it gives to its routes: every branch of the name
 * (a script, `frodo` and `app.cjs`, the value of --encoding) must come from the given
 * command line, and without one from `process.argv`.
 *
 * No recordings and no network: Polly is a fake that keeps the recording names.
 */
import path from 'path';
import { jest } from '@jest/globals';
import StateImpl from '../shared/State';

const names: string[] = [];

function route(): any {
  const chain: any = {
    recordingName: (name: string) => {
      names.push(name);
      return chain;
    },
    passthrough: () => chain,
    on: () => chain,
  };
  return chain;
}

class FakePolly {
  static register = jest.fn();
  config = {};
  configure = jest.fn();
  server = {
    host: (_host: string, setup: () => void) => setup(),
    any: () => route(),
  };
}

jest.unstable_mockModule('@pollyjs/core', () => ({
  Polly: FakePolly,
  EXPIRY_STRATEGY: {},
}));

const saved = {
  FRODO_MOCK: process.env.FRODO_MOCK,
  FRODO_MOCK_HOSTS: process.env.FRODO_MOCK_HOSTS,
  FRODO_TEST_NAME: process.env.FRODO_TEST_NAME,
  FRODO_MOCK_DEPLOYMENT: process.env.FRODO_MOCK_DEPLOYMENT,
};
process.env.FRODO_MOCK = '1';
process.env.FRODO_MOCK_HOSTS = 'http://127.0.0.1:1';
delete process.env.FRODO_TEST_NAME;
delete process.env.FRODO_MOCK_DEPLOYMENT;

const { setupPollyForFrodoLib } = await import('./SetupPollyForFrodoLib');

/** The recording names of the routes that are made from the command line. */
function recordingNames(argv?: string[]): string[] {
  names.length = 0;
  setupPollyForFrodoLib({ state: StateImpl({}), argv });
  return names.filter((name) => name !== 'github' && name !== 'npmjs');
}

describe('setupPollyForFrodoLib names its recordings after the command line it is given', () => {
  afterAll(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test('1: a script, and the live command line is not read', () => {
    const live = path.parse(process.argv[1]).name.replace('-', '/');
    const given = recordingNames([
      'node',
      '/work/mytool-run.js',
      'one',
      '--flag',
      'x',
    ]);
    expect(given).toContain('mytool/run/1_flag/am');
    expect(given.every((name) => name.startsWith('mytool/run/1_flag/'))).toBe(
      true
    );
    expect(given.some((name) => name.startsWith(`${live}/`))).toBe(false);
  });

  test.each(['frodo', 'frodo.exe', 'app.cjs'])(
    '2: the command of a CLI program started as %s',
    (entry) => {
      const given = recordingNames([
        'node',
        `/work/${entry}`,
        'agent',
        'ai',
        'list',
        '-i',
        'x',
      ]);
      expect(given).toContain('agent/ai-list/0_i/am');
      expect(given.every((name) => name.startsWith('agent/ai-list/'))).toBe(
        true
      );
    }
  );

  test('3: a verb of a CLI program', () => {
    const given = recordingNames([
      'node',
      '/work/app.cjs',
      'journey',
      'export',
      '--all',
    ]);
    expect(given).toContain('journey/export/0_all/am');
  });

  test('4: the value of --encoding names the recording of the environment routes', () => {
    const given = recordingNames([
      'node',
      '/work/mytool.js',
      '--encoding',
      'pem',
    ]);
    expect(given).toContain('mytool/0_encoding_pem/environment');
  });

  test('5: without a command line the live one is used, also after a call that was given one', () => {
    recordingNames(['node', '/work/other.js']);
    const live = path.parse(process.argv[1]).name.replace('-', '/');
    const given = recordingNames();
    expect(given.length).toBeGreaterThan(0);
    expect(given.every((name) => name.startsWith(`${live}/`))).toBe(true);
  });
});
