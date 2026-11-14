/**
 * A process of its own that says which home directory it sees, for
 * `src/utils/NoRealHome.workers.unit.test.ts`. Started with `node -r
 * test/support/register-ts.cjs` like the other workers; prints one JSON line.
 */
import os from 'os';

process.stdout.write(
  `${JSON.stringify({
    homedir: os.homedir(),
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
  })}\n`
);
