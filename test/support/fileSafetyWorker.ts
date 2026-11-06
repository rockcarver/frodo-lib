/**
 * A process of its own that uses a shared file, for the tests that start
 * several of them at once (`src/utils/FileLockUtils.test.ts`,
 * `src/ops/ConnectionProfileOps.concurrency.test.ts`). Started with
 * `node -r test/support/register-ts.cjs`; takes one JSON argument and prints
 * one JSON line with what it did.
 *
 *  - `count`: adds one to the number in a file `times` times, each time under
 *    the lock and without any other protection.
 *  - `profile`: saves a connection profile of its own `times` times into one
 *    shared profiles file.
 *  - `masterKey`: encrypts something with a master key that does not exist yet
 *    (the first process to get there creates it) and reports what it read.
 */
// the library entry first: loading its parts one by one, as CommonJS, trips over
// import cycles that the bundle and the test runner resolve in their own order
import '../../src/index';
import fs from 'fs';
import { saveConnectionProfile } from '../../src/ops/ConnectionProfileOps';
import { createJwkRsa } from '../../src/ops/JoseOps';
import StateImpl from '../../src/shared/State';
import DataProtection from '../../src/utils/DataProtection';
import { withFileLockSync } from '../../src/utils/FileLockUtils';

type Args = {
  mode: 'count' | 'profile' | 'masterKey';
  id: number;
  file: string;
  masterKeyPath?: string;
  times: number;
  /** epoch ms: all workers wait for it, so that they start at the same moment */
  startAt?: number;
};

function count(args: Args) {
  for (let i = 0; i < args.times; i++) {
    withFileLockSync(args.file, () => {
      const value = fs.existsSync(args.file)
        ? parseInt(fs.readFileSync(args.file, 'utf8'), 10)
        : 0;
      fs.writeFileSync(args.file, `${value + 1}`);
    });
  }
  return { done: args.times };
}

async function profile(args: Args) {
  let saved = 0;
  for (let i = 0; i < args.times; i++) {
    const host = `https://openam-worker-${args.id}-${i}.example.com/am`;
    const state = StateImpl({ host });
    state.setConnectionProfilesPath(args.file);
    state.setMasterKeyPath(args.masterKeyPath);
    state.setDeploymentType('classic');
    state.setUsername(`user-${args.id}-${i}`);
    state.setPassword(`password-${args.id}-${i}`);
    if (await saveConnectionProfile({ host, state })) saved++;
  }
  return { saved };
}

async function masterKey(args: Args) {
  const state = StateImpl({ host: 'https://openam-master-key.example.com/am' });
  const dataProtection = new DataProtection({
    pathToMasterKey: args.masterKeyPath,
    state,
  });
  const encrypted = await dataProtection.encrypt({ secret: `from-${args.id}` });
  return { encrypted };
}

(async () => {
  const args: Args = JSON.parse(process.argv[2]);
  // wait for the common start, so that the processes really run together
  while (args.startAt && Date.now() < args.startAt) {
    // busy wait: a timer would wake the processes up at different moments
  }
  const result =
    args.mode === 'count'
      ? count(args)
      : args.mode === 'profile'
        ? await profile(args)
        : await masterKey(args);
  process.stdout.write(`${JSON.stringify({ id: args.id, ...result })}\n`);
})().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
