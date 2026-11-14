/*
 * A test file for `src/utils/NoRealHome.cleanup.unit.test.ts`, which runs jest on it (and on
 * `noRealHomeFixtureQuiet.cjs`) with the guard of `test/jest-no-real-home.setup.js` and then looks at what is left.
 * It asks for the home, which makes the temporary directory, writes a file there and records what it saw in the
 * directory named by GUARD_FIXTURE_OUT. Plain CommonJS and not matched by the repository's `testMatch`, so a normal
 * run never starts it.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

test('asks for the home and records what the guard did', () => {
  const named = process.env.FRODO_TEST_HOME;
  const home = os.homedir();
  fs.writeFileSync(path.join(home, 'marker'), 'x');
  fs.writeFileSync(
    path.join(process.env.GUARD_FIXTURE_OUT, 'asks.json'),
    JSON.stringify({ named, home, existsDuringTest: fs.existsSync(home) })
  );
});
