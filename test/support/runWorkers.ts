import { spawn } from 'child_process';
import os from 'os';
import { resolve } from 'path';

const HOOK = resolve('.', 'test', 'support', 'register-ts.cjs');

/**
 * The environment for a process that a test starts: the one of the test, with the home directory (`HOME` and
 * `USERPROFILE`) set to the temporary home that `test/jest-no-real-home.setup.js` made for the test file.
 *
 * A child process started without an `env` gets the environment of the test runner's own process, not the copy that
 * the test sees, and so would look at the real home. Every test that starts a process passes this (or its own `env`).
 * @returns {NodeJS.ProcessEnv} the environment for `spawn`
 */
export function isolatedChildEnv(): NodeJS.ProcessEnv {
  const home = os.homedir();
  return { ...process.env, HOME: home, USERPROFILE: home };
}

/**
 * Start a TypeScript worker script as a process of its own (see
 * `register-ts.cjs`) and resolve with the JSON line it prints.
 */
export function runWorker<T = Record<string, unknown>>(
  script: string,
  args: object
): Promise<T> {
  const child = spawn(
    process.execPath,
    ['-r', HOOK, resolve('.', 'test', 'support', script), JSON.stringify(args)],
    {
      cwd: resolve('.'),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: isolatedChildEnv(),
    }
  );
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  return new Promise<T>((resolveDone, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${script} exited with ${code}: ${stderr}`));
      } else {
        resolveDone(JSON.parse(stdout.trim().split('\n').pop() as string));
      }
    });
  });
}
