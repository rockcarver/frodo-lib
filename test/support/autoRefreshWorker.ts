/**
 * A process of its own whose background token refresh fails, for
 * `src/ops/AuthenticateOps.autoRefreshFailure.unit.test.ts`. Started with
 * `node -r test/support/register-ts.cjs`; takes one JSON argument (`kind`) and
 * prints one JSON line with what it saw.
 *
 * The process logs in to a fake AM of its own with a session that has 25.5
 * seconds to live, so that the refresh timer runs half a second later, breaks
 * the next login as the kind says, and waits until the refresh has failed. A
 * listener for `unhandledRejection` on the process counts the rejections that
 * nobody handled: the refresh of a timer must never leave one.
 */
import FrodoLib from '../../src/lib/FrodoLib';
import { breakLogin, type FailureKind } from './autoRefreshFailures';
import { startFakeAm } from './fakeAm';

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function main(kind: FailureKind) {
  const rejections: string[] = [];
  process.on('unhandledRejection', (reason) => {
    let text: string;
    try {
      text = `${reason}`;
    } catch {
      text = 'a value that cannot be shown';
    }
    rejections.push(text);
  });
  const am = await startFakeAm({ sessionLifetimeMs: 25_500 });
  const frodo = FrodoLib({ host: am.host, deploymentType: 'classic' });
  frodo.state.setUseTokenCache(false);
  frodo.state.setUsername('someone');
  frodo.state.setPassword('password');
  const debug: string[] = [];
  const printed: { message: unknown; type: string }[] = [];
  frodo.state.setPrintHandler((message, type) =>
    printed.push({ message, type })
  );
  await frodo.login.getTokens();
  const timerArmed = frodo.state.getAutoRefreshTimer() !== undefined;
  const broken = await breakLogin(kind, frodo, (line) => debug.push(line));
  const failed = () =>
    debug.filter((line) => line.includes('token auto-refresh failed')).length;
  for (let waited = 0; failed() < 1 && waited < 10_000; waited += 50) {
    await sleep(50);
  }
  // time for a rejection that nobody handled to be reported
  await sleep(300);
  broken.repair();
  const result = {
    kind,
    timerArmed,
    failedLines: failed(),
    rejections,
    printed,
    loginsAtTheEnd: am.logins(),
  };
  await broken.close();
  await am.close();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(0);
}

main(JSON.parse(process.argv[2]).kind as FailureKind).catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
