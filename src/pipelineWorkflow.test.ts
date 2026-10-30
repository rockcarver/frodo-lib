import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/*
 * Pins how .github/workflows/pipeline.yml uses the change classifier
 * (.github/scripts/classify-changes.sh): the required check names stay the
 * same, the "Detect code changes" step fails safe, the "Validate guidance" job
 * covers every test that reads a guidance file, and "Test gate" fails when
 * guidance was expected and did not succeed. It runs the real shell of the
 * "Test gate" step and of the classify step with the workflow expressions
 * filled in. Core 0012 and core 0016, PIPELINE.md.
 */

const ROOT = process.cwd();
const WORKFLOW = fs.readFileSync(
  path.join(ROOT, '.github/workflows/pipeline.yml'),
  'utf8'
);
const CLASSIFIER = path.join(ROOT, '.github/scripts/classify-changes.sh');

const bash = spawnSync('bash', ['--version']);
const bashTest = bash.status === 0 ? test : test.skip;

/** The text of one job, from its key to the next job. */
function job(id: string): string {
  const lines = WORKFLOW.split('\n');
  const start = lines.findIndex((l) => l === `  ${id}:`);
  if (start < 0) throw new Error(`pipeline.yml has no job "${id}"`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

/** The value of a key of the job itself (four spaces of indent). */
function jobField(id: string, key: string): string | undefined {
  const m = job(id).match(new RegExp(`^ {4}${key}:[ \\t]*(.*)$`, 'm'));
  return m?.[1].trim();
}

/** The shell of the `run: |` block of the step with this name, dedented. */
function stepScript(id: string, stepName: string): string {
  const lines = job(id).split('\n');
  const at = lines.findIndex((l) => l.trim() === `- name: ${stepName}`);
  if (at < 0) throw new Error(`job "${id}" has no step "${stepName}"`);
  const run = lines.findIndex((l, i) => i > at && /^\s+run: \|\s*$/.test(l));
  if (run < 0) throw new Error(`step "${stepName}" has no run block`);
  const indent = lines[run].match(/^\s*/)![0].length + 2;
  const body: string[] = [];
  for (let i = run + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() !== '' && line.match(/^\s*/)![0].length < indent) break;
    body.push(line.slice(indent));
  }
  return body.join('\n');
}

/** Fills the `${{ ... }}` expressions of a script from a table. */
function fill(script: string, values: Record<string, string>): string {
  return script.replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr: string) => {
    if (!(expr in values)) {
      throw new Error(`the test does not know the expression ${expr}`);
    }
    return values[expr];
  });
}

describe('pipeline.yml', () => {
  test('has no paths-ignore on the pull request trigger (record 0012)', () => {
    const on = WORKFLOW.slice(
      WORKFLOW.indexOf('\non:'),
      WORKFLOW.indexOf('\njobs:')
    );
    const pr = on.slice(on.indexOf('  pull_request:'), on.indexOf('  push:'));
    expect(pr).toContain('pull_request:');
    expect(
      pr
        .split('\n')
        .filter((l) => !l.trim().startsWith('#'))
        .join('\n')
    ).not.toContain('paths-ignore');
  });

  test('keeps the check names that branch protection requires', () => {
    // Renaming one of these needs a ruleset change (record 0012).
    expect(jobField('build', 'name')).toBe('Build');
    expect(jobField('test-gate', 'name')).toBe("'Test gate'");
    expect(jobField('test-cross-platform', 'name')).toBe(
      "'Cross-Platform Tests (Credential File Permissions)'"
    );
    expect(jobField('test-cross-platform-gate', 'name')).toBe(
      "'Cross-Platform gate'"
    );
    expect(jobField('changes', 'name')).toBe("'Detect code changes'");
    expect(jobField('guidance', 'name')).toBe("'Validate guidance'");
  });
});

describe('the "Detect code changes" job', () => {
  test('uses the classifier script and no inline allowlist', () => {
    const script = stepScript('changes', 'Classify changed files');
    expect(script).toContain('bash .github/scripts/classify-changes.sh');
    expect(script).not.toContain('safe=');
    expect(script).not.toMatch(/grep -E/);
  });

  test('asks the files API for both names of a renamed file', () => {
    expect(stepScript('changes', 'Classify changed files')).toContain(
      '.filename, (.previous_filename // empty)'
    );
  });

  test('takes the classifier from the base commit, with least privilege', () => {
    const block = job('changes');
    expect(block).toContain('ref: ${{ github.event.pull_request.base.sha }}');
    expect(block).toContain(
      'sparse-checkout: .github/scripts/classify-changes.sh'
    );
    expect(block).toContain('persist-credentials: false');
    expect(block).toMatch(
      /permissions:\n {6}contents: read\n {6}pull-requests: read\n/
    );
    expect(block).toContain('code: ${{ steps.classify.outputs.code }}');
    expect(block).toContain('guidance: ${{ steps.classify.outputs.guidance }}');
  });

  describe('classify step', () => {
    const script = stepScript('changes', 'Classify changed files');

    function run(options: {
      event: string;
      files?: string[];
      ghFails?: boolean;
      withClassifier?: boolean;
      classifierBody?: string;
    }): Record<string, string> {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'classify-step-'));
      try {
        fs.mkdirSync(path.join(dir, 'bin'));
        fs.writeFileSync(
          path.join(dir, 'bin', 'gh'),
          '#!/usr/bin/env bash\n[ -z "${GH_FAKE_FAIL:-}" ] || exit 1\nprintf "%s\\n" "${GH_FAKE_FILES}"\n',
          { mode: 0o755 }
        );
        if (options.withClassifier !== false) {
          fs.mkdirSync(path.join(dir, '.github/scripts'), { recursive: true });
          if (options.classifierBody !== undefined) {
            fs.writeFileSync(
              path.join(dir, '.github/scripts/classify-changes.sh'),
              options.classifierBody
            );
          } else {
            fs.copyFileSync(
              CLASSIFIER,
              path.join(dir, '.github/scripts/classify-changes.sh')
            );
          }
        }
        const output = path.join(dir, 'output');
        fs.writeFileSync(output, '');
        const result = spawnSync('bash', ['-e', '-c', script], {
          cwd: dir,
          encoding: 'utf8',
          env: {
            PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`,
            GITHUB_OUTPUT: output,
            GH_TOKEN: 'x',
            EVENT: options.event,
            PR: '1',
            REPO: 'o/r',
            GH_FAKE_FILES: (options.files ?? []).join('\n'),
            ...(options.ghFails ? { GH_FAKE_FAIL: '1' } : {}),
          },
        });
        expect(result.status).toBe(0);
        return Object.fromEntries(
          fs
            .readFileSync(output, 'utf8')
            .split('\n')
            .filter((l) => l !== '')
            .map((l) => l.split('='))
        );
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }

    bashTest('passes the classifier result on for a pull request', () => {
      expect(
        run({ event: 'pull_request', files: ['decisions/0014-x.md'] })
      ).toEqual({ code: 'false', guidance: 'true' });
      expect(
        run({ event: 'pull_request', files: ['src/a.ts', 'AGENTS.md'] })
      ).toEqual({ code: 'true', guidance: 'true' });
    });

    bashTest('counts every event that is not a pull request as code', () => {
      for (const event of ['push', 'workflow_dispatch', 'release']) {
        expect(run({ event, files: ['decisions/0014-x.md'] })).toEqual({
          code: 'true',
          guidance: 'false',
        });
      }
    });

    bashTest('counts an API error as code', () => {
      expect(run({ event: 'pull_request', ghFails: true })).toEqual({
        code: 'true',
        guidance: 'false',
      });
    });

    bashTest('counts a missing classifier as code', () => {
      // The pull request that adds the script runs against a base without it.
      expect(
        run({
          event: 'pull_request',
          files: ['decisions/0014-x.md'],
          withClassifier: false,
        })
      ).toEqual({ code: 'true', guidance: 'false' });
    });

    bashTest('counts a failing classifier as code', () => {
      expect(
        run({
          event: 'pull_request',
          files: ['decisions/0014-x.md'],
          classifierBody: '#!/usr/bin/env bash\necho code=false\nexit 3\n',
        })
      ).toEqual({ code: 'true', guidance: 'false' });
    });
  });
});

describe('the "Validate guidance" job', () => {
  const block = job('guidance');
  const listed = (
    block.match(/^\s+src\/[A-Za-z0-9_.-]+\.test\.ts\s*\\?$/gm) ?? []
  )
    .map((l) => l.replace(/[\s\\]/g, ''))
    .sort();

  test('runs when the classifier asks for it, and only on that', () => {
    expect(jobField('guidance', 'needs')).toBe('[changes]');
    expect(jobField('guidance', 'if')).toBe(
      "needs.changes.outputs.guidance == 'true'"
    );
  });

  test('runs a fixed list of tests by path and builds nothing', () => {
    expect(block).toContain('npm run test:only -- --runTestsByPath');
    expect(block).not.toContain('npm run build');
    expect(listed.length).toBeGreaterThan(0);
    for (const file of listed) {
      expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
    }
  });

  test('lists every test that reads a guidance file', () => {
    // A test that reads records, skills, AGENTS.md, CONTRIBUTE.md and the like
    // validates files the code filter treats as non-code: it must run in this
    // job (record 0016). Add the test to the job, and its kind of file to
    // GUIDANCE in .github/scripts/classify-changes.sh.
    const readsGuidance =
      /(?:AGENTS|CLAUDE|CONTRIBUTE|PIPELINE|BUILD-ENV|MIGRATION|README|RECORD_REPLAY)\.md|['"`/]decisions['"`/]|\.claude\/|\.github\/instructions/;
    const readsFiles = /from 'node:fs|from 'fs'|require\('(?:node:)?fs/;
    const own = ['src/classifyChanges.test.ts', 'src/pipelineWorkflow.test.ts'];
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), {
        withFileTypes: true,
      })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (
            entry.name !== 'mock-recordings' &&
            entry.name !== 'node_modules'
          ) {
            walk(rel);
          }
        } else if (entry.name.endsWith('.test.ts') && !own.includes(rel)) {
          const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
          if (readsFiles.test(text) && readsGuidance.test(text))
            found.push(rel);
        }
      }
    };
    walk('src');
    expect(found.sort()).toEqual(listed);
  });

  test('is a dependency of Test gate, which is the required check', () => {
    expect(jobField('test-gate', 'needs')).toBe(
      '[build, changes, test, guidance]'
    );
  });
});

describe('"Test gate"', () => {
  const script = stepScript(
    'test-gate',
    'Fail if any test matrix leg or the guidance job did not succeed'
  );
  type Case = {
    build: string;
    changes: string;
    code: string;
    wanted: string;
    test: string;
    guidance: string;
  };
  const OK: Case = {
    build: 'success',
    changes: 'success',
    code: 'true',
    wanted: 'false',
    test: 'success',
    guidance: 'skipped',
  };

  function gate(c: Case): number {
    const filled = fill(script, {
      'needs.build.result': c.build,
      'needs.changes.result': c.changes,
      'needs.changes.outputs.code': c.code,
      'needs.changes.outputs.guidance': c.wanted,
      'needs.test.result': c.test,
      'needs.guidance.result': c.guidance,
    });
    const run = spawnSync('bash', ['-e', '-c', filled], { encoding: 'utf8' });
    return run.status ?? -1;
  }

  const NON_CODE: Partial<Case> = { code: 'false', test: 'skipped' };
  const WANTED: Partial<Case> = { wanted: 'true', guidance: 'success' };

  const table: [string, Partial<Case>, boolean][] = [
    ['code, nothing for guidance', {}, true],
    ['code and guidance both pass', { ...WANTED }, true],
    ['code, guidance fails', { ...WANTED, guidance: 'failure' }, false],
    [
      'code, guidance skipped although wanted',
      { ...WANTED, guidance: 'skipped' },
      false,
    ],
    ['code, tests fail', { test: 'failure' }, false],
    ['code, tests cancelled', { test: 'cancelled' }, false],
    ['code, tests skipped', { test: 'skipped' }, false],
    ['non-code, nothing for guidance', { ...NON_CODE }, true],
    ['non-code, guidance passes', { ...NON_CODE, ...WANTED }, true],
    [
      'non-code, guidance fails',
      { ...NON_CODE, ...WANTED, guidance: 'failure' },
      false,
    ],
    [
      'non-code, guidance cancelled',
      { ...NON_CODE, ...WANTED, guidance: 'cancelled' },
      false,
    ],
    [
      'non-code, guidance skipped although wanted',
      { ...NON_CODE, ...WANTED, guidance: 'skipped' },
      false,
    ],
    [
      'non-code, guidance ran although not wanted',
      { ...NON_CODE, guidance: 'success' },
      false,
    ],
    ['non-code, tests ran', { code: 'false' }, false],
    ['non-code, build fails', { ...NON_CODE, build: 'failure' }, false],
    ['non-code, build skipped', { ...NON_CODE, build: 'skipped' }, false],
    ['change detection fails', { changes: 'failure' }, false],
    ['change detection skipped', { changes: 'skipped' }, false],
    [
      'change detection fails, non-code',
      { ...NON_CODE, ...WANTED, changes: 'failure' },
      false,
    ],
  ];
  test.each(table)('%s', (_what, override, passes) => {
    if (bash.status !== 0) return;
    expect(gate({ ...OK, ...override }) === 0).toBe(passes);
  });
});

/*
 * The release publishes to npm first and the "Release" job pushes the version
 * commit afterwards. A push to the branch while the tests ran makes that push
 * fail with the package already published (npm refuses a second publish of the
 * version), so the first step of "npm-release" stops the run while nothing is
 * published yet. PIPELINE.md, "Release Model".
 */
describe('the "npm-release" job', () => {
  const GUARD = 'Refuse to publish when the branch has moved';
  const DISPATCHED = '1111111111111111111111111111111111111111';
  const MOVED = '2222222222222222222222222222222222222222';

  /** The names (or actions) of the steps of a job, in order. */
  function stepNames(id: string): string[] {
    return job(id)
      .split('\n')
      .filter((l) => /^ {6}- (name|uses): /.test(l))
      .map((l) => l.replace(/^ {6}- (name|uses): /, ''));
  }

  /** Runs the shell of the guard step with a stand-in for the `gh` CLI. */
  function runGuard(options: { branchAt?: string; apiFails?: boolean }) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-guard-'));
    const calls = path.join(dir, 'calls.txt');
    const stub = options.apiFails
      ? `#!/bin/sh\necho "$@" >> "${calls}"\necho 'gh: HTTP 502' >&2\nexit 1\n`
      : `#!/bin/sh\necho "$@" >> "${calls}"\necho "${options.branchAt}"\n`;
    fs.writeFileSync(path.join(dir, 'gh'), stub, { mode: 0o755 });
    const result = spawnSync('bash', ['-c', stepScript('npm-release', GUARD)], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        GITHUB_REPOSITORY: 'owner/repo',
        DISPATCHED_SHA: DISPATCHED,
        DISPATCHED_REF: 'refs/heads/main',
      },
    });
    const asked = fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8') : '';
    fs.rmSync(dir, { recursive: true, force: true });
    return { ...result, asked };
  }

  test('asks whether the branch has moved, as its first step and before it publishes', () => {
    const names = stepNames('npm-release');
    expect(names[0]).toBe(GUARD);
    expect(names).toContain('Publish package');
    expect(names.indexOf(GUARD)).toBeLessThan(names.indexOf('Publish package'));
  });

  bashTest(
    'lets the release go on when the branch is where it was dispatched from',
    () => {
      const result = runGuard({ branchAt: DISPATCHED });
      expect(result.status).toBe(0);
      expect(result.asked).toContain('repos/owner/repo/git/ref/heads/main');
    }
  );

  bashTest(
    'stops the release when the branch has moved, and says nothing was published',
    () => {
      const result = runGuard({ branchAt: MOVED });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('::error::');
      expect(result.stdout).toContain(MOVED);
      expect(result.stdout).toContain(DISPATCHED);
      expect(result.stdout).toContain('Nothing was published');
    }
  );

  bashTest(
    'stops the release when the branch cannot be read (it fails closed)',
    () => {
      const result = runGuard({ apiFails: true });
      expect(result.status).not.toBe(0);
    }
  );
});
