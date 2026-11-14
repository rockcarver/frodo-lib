/*
 * The second test file of `src/utils/NoRealHome.cleanup.unit.test.ts` (see `noRealHomeFixtureAsks.cjs`): it never asks
 * for the home, so the guard must not have made the directory, neither while the test runs nor afterwards.
 */
const fs = require('fs');
const path = require('path');

test('never asks for the home and records whether the directory exists', () => {
  const named = process.env.FRODO_TEST_HOME;
  fs.writeFileSync(
    path.join(process.env.GUARD_FIXTURE_OUT, 'quiet.json'),
    JSON.stringify({ named, existsDuringTest: fs.existsSync(named) })
  );
});
