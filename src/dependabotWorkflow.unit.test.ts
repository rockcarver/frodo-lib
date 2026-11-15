import fs from 'node:fs';
import path from 'node:path';

/*
 * Pins the properties of .github/workflows/dependabot-auto-merge.yml that the policy of core record 0023 relies on.
 * The policy itself (which pull request is armed) is implemented and tested by the shared action
 * https://github.com/gearsnlevers/dependabot-auto-merge-action; this repository keeps what only it can check: that
 * the workflow calls that action the way the record needs (the action pinned by its full commit SHA, the token only
 * in that step with minimal permissions, nothing of a pull request checked out or run, a guard on the actor, a
 * dry run for the first call after a new pin). The workflow is read as text because the repository has no YAML
 * parser among its dependencies.
 */

const WORKFLOW = path.resolve(
  process.cwd(),
  '.github/workflows/dependabot-auto-merge.yml'
);
const text = fs.readFileSync(WORKFLOW, 'utf8');
/** The workflow without its comments: what GitHub reads. */
const code = text
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n');

describe('the workflow that arms auto-merge keeps the properties that the policy relies on', () => {
  test('no substring test of package names is left', () => {
    expect(text).not.toMatch(
      /contains\(\s*steps\.metadata\.outputs\.dependency-names/
    );
    expect(text).not.toMatch(
      /dependency-names,\s*'(eslint|prettier|typescript)'/
    );
  });

  test('it runs for pull requests, daily and by hand, and a pull request only for Dependabot', () => {
    expect(code).toMatch(/pull_request:/);
    expect(code).toMatch(/schedule:\s*\n\s*- cron:/);
    expect(code).toMatch(/workflow_dispatch:/);
    expect(code).toContain(
      "github.event_name != 'pull_request' || (github.actor == 'dependabot[bot]'"
    );
  });

  test('it does not run for the pull requests that move the pin of the action (the new version must be read first)', () => {
    expect(code).toContain(
      "!startsWith(github.head_ref, 'dependabot/github_actions/')"
    );
  });

  test('it calls the shared action, pinned by its full commit SHA with the version as a comment', () => {
    const calls = code
      .split('\n')
      .filter((line) =>
        line.includes('gearsnlevers/dependabot-auto-merge-action')
      );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(
      /uses:\s+gearsnlevers\/dependabot-auto-merge-action@[0-9a-f]{40}\s+# v\d+\.\d+\.\d+\s*$/
    );
  });

  test('every action it uses is pinned to a commit', () => {
    const uses = code.split('\n').filter((line) => line.includes('uses:'));
    expect(uses.length).toBeGreaterThan(0);
    for (const line of uses) {
      expect(line).toMatch(/@[0-9a-f]{40}\s+#/);
    }
  });

  test('it checks nothing out and runs no shell code: no code of a pull request is ever executed with the token', () => {
    expect(code).not.toMatch(/actions\/checkout/);
    expect(code).not.toMatch(/^\s*run:/m);
    expect(code).not.toMatch(/pull_request_target/);
  });

  test('the token reaches only the step that calls the action, with minimal permissions', () => {
    expect(code.match(/GITHUB_TOKEN/g)).toHaveLength(1);
    expect(code).toMatch(
      /github-token:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/
    );
    expect(code).toMatch(
      /permissions:\s*\n\s*contents: write\s*\n\s*pull-requests: write/
    );
  });

  test('a manual run can be a dry run, which the action gets as `dry-run`, and the default is to arm', () => {
    expect(code).toMatch(
      /workflow_dispatch:\s*\n\s*inputs:\s*\n\s*dry-run:\s*\n(?:\s+.*\n)*?\s+type: boolean\s*\n\s+default: false/
    );
    expect(code).toMatch(
      /dry-run:\s*\$\{\{\s*inputs\.dry-run \|\| 'false'\s*\}\}/
    );
  });

  test('the pull request number is passed, and empty for the daily sweep and a manual run', () => {
    expect(code).toMatch(
      /pull-request:\s*\$\{\{\s*github\.event\.pull_request\.number\s*\}\}/
    );
  });
});
