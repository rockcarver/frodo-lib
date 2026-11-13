/*
 * Keeps the real home directory out of the tests.
 *
 * Why this exists:
 * - Code of the library puts files under the home directory of the user:
 *   `~/.frodo` holds the connection profiles, the master key, the token cache
 *   and, with the cache on, the application template catalog. A test that
 *   reaches such a default path (because it enabled a cache and set no
 *   directory, or because the code that was meant to pass its directory on
 *   regressed) writes into the files of whoever runs the tests, and may read
 *   or change real ones. A synthetic catalog was found in a real
 *   `~/.frodo/AppTemplates` that way.
 * - Changing `process.env.HOME` inside a test does not help: jest gives a test
 *   its own copy of `process.env`, and `os.homedir()` asks the operating system
 *   (on Windows `USERPROFILE`, elsewhere `HOME`) and never sees that copy. So
 *   `os.homedir()` is replaced.
 *
 * What this does, before each test file:
 * - Creates a fresh temporary directory and makes `os.homedir()` return it.
 *   The replacement is a plain function, not a jest mock, so a test that calls
 *   `jest.restoreAllMocks()` does not undo it; a test that spies on
 *   `os.homedir()` itself gets this replacement back when it restores.
 * - Sets `HOME` and `USERPROFILE` in the environment of the test to the same
 *   directory, for code that reads them directly.
 * - Keeps the real home in FRODO_TEST_REAL_HOME, for the one test that checks
 *   that nothing reaches it (src/utils/NoRealHome.guard.unit.test.ts), and the
 *   temporary one in FRODO_TEST_HOME.
 *
 * After the test file it puts everything back and removes the directory.
 *
 * A test that needs files under the home writes them under `os.homedir()`; a
 * test of a default path asserts on the path it gets, which is inside the
 * temporary home. A test that must not see this (there is none today) can set
 * its own `os.homedir`.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

// the function that was there before, also when an earlier test file of this
// worker did not get to put it back
const current = os.homedir;
const originalHomedir = current.frodoTestOriginal || current;

const testHome = fs.mkdtempSync(
  path.join(fs.realpathSync(os.tmpdir()), 'frodo-test-home-')
);

const replacement = () => testHome;
replacement.frodoTestOriginal = originalHomedir;

const saved = {
  HOME: process.env.HOME,
  USERPROFILE: process.env.USERPROFILE,
  FRODO_TEST_HOME: process.env.FRODO_TEST_HOME,
  FRODO_TEST_REAL_HOME: process.env.FRODO_TEST_REAL_HOME,
};

process.env.FRODO_TEST_REAL_HOME = originalHomedir.call(os);
process.env.FRODO_TEST_HOME = testHome;
process.env.HOME = testHome;
process.env.USERPROFILE = testHome;
os.homedir = replacement;

afterAll(() => {
  os.homedir = originalHomedir;
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  fs.rmSync(testHome, { recursive: true, force: true, maxRetries: 3 });
});
