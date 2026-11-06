import { spawn } from 'child_process';
import { resolve } from 'path';

const HOOK = resolve('.', 'test', 'support', 'register-ts.cjs');

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
    { cwd: resolve('.'), stdio: ['ignore', 'pipe', 'pipe'] }
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
