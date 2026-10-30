import { spawnSync } from 'node:child_process';
import path from 'node:path';

/*
 * Pins .github/scripts/classify-changes.sh, the classifier behind the
 * "Detect code changes" job of .github/workflows/pipeline.yml (core 0012 and
 * core 0016, PIPELINE.md). The script can only skip work, never hide it, so
 * most cases here are about what must count as code.
 */

const SCRIPT = path.resolve(
  process.cwd(),
  '.github/scripts/classify-changes.sh'
);

const bash = spawnSync('bash', ['--version']);
// Every CI runner and every macOS or Linux checkout has bash; a Windows checkout may not.
const bashTest = bash.status === 0 ? test : test.skip;

type Result = { code: boolean; guidance: boolean; stdout: string };

function classify(files: string[], trailingNewline = true): Result {
  const input =
    files.join('\n') + (trailingNewline && files.length ? '\n' : '');
  const run = spawnSync('bash', [SCRIPT], { input, encoding: 'utf8' });
  if (run.status !== 0) {
    throw new Error(`classifier exited with ${run.status}: ${run.stderr}`);
  }
  const lines = run.stdout.split('\n').filter((l) => l !== '');
  const out: Record<string, string> = {};
  for (const line of lines) {
    const [key, value] = line.split('=');
    out[key] = value;
  }
  expect(lines).toHaveLength(2);
  expect(['true', 'false']).toContain(out.code);
  expect(['true', 'false']).toContain(out.guidance);
  return {
    code: out.code === 'true',
    guidance: out.guidance === 'true',
    stdout: run.stdout,
  };
}

describe('classify-changes.sh', () => {
  describe('files that are not code', () => {
    const nonCode: [string, string][] = [
      ['a decision record', 'decisions/0014-a-new-rule.md'],
      ['the records index', 'decisions/README.md'],
      ['a skill', '.claude/skills/build-the-lib/SKILL.md'],
      [
        'a file next to a skill',
        '.claude/skills/review-a-copilot-pr/mutate.mjs',
      ],
      ['an instruction file', '.github/instructions/tests.instructions.md'],
      ['the agent entry point', 'AGENTS.md'],
      ['the Claude entry point', 'CLAUDE.md'],
      ['the contributor guide', 'CONTRIBUTE.md'],
      ['another root Markdown file', 'PIPELINE.md'],
      ['generated docs', 'docs/classes/Foo.html'],
      ['the licence', 'LICENSE'],
      ['an issue template', '.github/ISSUE_TEMPLATE/bug.yml'],
      ['a file in the Issue Concierge folder', '.github/issue-concierge/scope.md'],
      ['the aw settings', '.github/aw/actions-lock.json'],
      ['the concierge pin', '.github/issue-concierge.yml'],
      ['a concierge script', '.github/scripts/janitor.mjs'],
      ['a workflow', '.github/workflows/janitor.yml'],
      ['a workflow definition', '.github/workflows/plan-worker.md'],
      ['CODEOWNERS', '.github/CODEOWNERS'],
      ['the dependabot config', '.github/dependabot.yml'],
      ['the Copilot instructions', '.github/copilot-instructions.md'],
    ];
    test.each(nonCode)('%s is not code', (_what, file) => {
      if (bash.status !== 0) return;
      expect(classify([file]).code).toBe(false);
    });

    bashTest('a pull request of only non-code files is not code', () => {
      expect(
        classify([
          'decisions/0014-x.md',
          '.claude/skills/a/SKILL.md',
          'AGENTS.md',
          '.github/workflows/janitor.yml',
        ]).code
      ).toBe(false);
    });
  });

  describe('files that are code', () => {
    const code: [string, string][] = [
      ['a source file', 'src/ops/JourneyOps.ts'],
      ['a test file', 'src/agentSkills.test.ts'],
      ['a recording', 'src/test/mock-recordings/a/recording.har'],
      ['package.json', 'package.json'],
      ['the lockfile', 'package-lock.json'],
      ['a build script', 'scripts/generate-help.mjs'],
      ['the record validator', 'scripts/validate-decision-records.mjs'],
      ['a build config', 'tsdown.config.mts'],
      ['the pipeline', '.github/workflows/pipeline.yml'],
      ['the classifier itself', '.github/scripts/classify-changes.sh'],
      ['a file the allowlist does not name', 'examples/demo.ts'],
      ['a root file that is not Markdown', 'jest.config.js'],
      ['a file that only starts like the licence', 'LICENSE.js'],
      ['a file that only starts like docs', 'docsify.config.js'],
      ['a file that only starts like decisions', 'decisions.ts'],
      ['a Markdown file in a source folder', 'src/utils/README.md'],
      ['a file in an unlisted hidden folder', '.claude/settings.json'],
      ['a nested pipeline file', 'x/.github/workflows/pipeline.yml'],
      ['a workflow that is not YAML or Markdown', '.github/workflows/run.sh'],
      ['a workflow in a subfolder', '.github/workflows/sub/a.yml'],
      ['an unlisted .github folder', '.github/actions/setup/action.yml'],
    ];
    test.each(code)('%s is code', (_what, file) => {
      if (bash.status !== 0) return;
      expect(classify([file]).code).toBe(true);
    });

    bashTest(
      'one code file among non-code files makes the pull request code',
      () => {
        const files = ['decisions/0014-x.md', 'AGENTS.md', 'src/a.ts'];
        expect(classify(files).code).toBe(true);
        expect(classify([...files].reverse()).code).toBe(true);
      }
    );

    bashTest('the pipeline and the classifier count as code among docs', () => {
      expect(
        classify(['README.md', '.github/workflows/pipeline.yml']).code
      ).toBe(true);
      expect(
        classify(['README.md', '.github/scripts/classify-changes.sh']).code
      ).toBe(true);
    });

    bashTest('a rename counts under both names', () => {
      // The files API lists the old name too: moving code into docs/ is code.
      expect(classify(['docs/Foo.md', 'src/Foo.ts']).code).toBe(true);
      expect(classify(['src/Foo.ts', 'docs/Foo.md']).code).toBe(true);
      expect(classify(['docs/a.md', 'docs/b.md']).code).toBe(false);
    });
  });

  describe('unknown input counts as code', () => {
    bashTest('an empty list', () => {
      expect(classify([]).code).toBe(true);
      expect(classify([''], false).code).toBe(true);
    });

    bashTest('blank lines are ignored', () => {
      const run = spawnSync('bash', [SCRIPT], {
        input: '\n\nAGENTS.md\n\n',
        encoding: 'utf8',
      });
      expect(run.stdout).toBe('code=false\nguidance=true\n');
    });

    bashTest('3000 or more entries, the cap of the files API', () => {
      const docs = (n: number) =>
        Array.from({ length: n }, (_, i) => `docs/f${i}.html`);
      expect(classify(docs(2999)).code).toBe(false);
      expect(classify(docs(3000)).code).toBe(true);
      expect(classify(docs(3001)).code).toBe(true);
    });

    bashTest('a last line without a newline is still read', () => {
      expect(classify(['src/a.ts'], false).code).toBe(true);
      expect(classify(['docs/a.md', 'src/a.ts'], false).code).toBe(true);
      expect(classify(['docs/a.md', 'docs/b.md'], false).code).toBe(false);
    });

    bashTest('names with spaces and special characters', () => {
      expect(classify(['docs/a b.md']).code).toBe(false);
      expect(classify(['src/a b.ts']).code).toBe(true);
      expect(
        classify(["docs/it's.md", 'docs/a$b.md', 'docs/(x).md']).code
      ).toBe(false);
    });
  });

  describe('guidance', () => {
    const guidance: [string, string][] = [
      ['a decision record', 'decisions/0014-a-new-rule.md'],
      ['a core decision record', 'decisions/core/0019-a-new-rule.md'],
      ['the records template', 'decisions/template.md'],
      [
        'the core records drift check',
        '.github/scripts/check-core-records-drift.mjs',
      ],
      [
        'the core records drift workflow',
        '.github/workflows/core-records-drift.yml',
      ],
      ['a skill', '.claude/skills/build-the-lib/SKILL.md'],
      ['an instruction file', '.github/instructions/tests.instructions.md'],
      ['AGENTS.md', 'AGENTS.md'],
      ['CLAUDE.md', 'CLAUDE.md'],
      ['CONTRIBUTE.md', 'CONTRIBUTE.md'],
      ['any root Markdown file', 'BUILD-ENV.md'],
    ];
    test.each(guidance)('%s needs the guidance job', (_what, file) => {
      if (bash.status !== 0) return;
      expect(classify([file]).guidance).toBe(true);
    });

    const noGuidance: [string, string][] = [
      ['a source file', 'src/ops/JourneyOps.ts'],
      ['the pipeline', '.github/workflows/pipeline.yml'],
      ['a concierge workflow', '.github/workflows/janitor.yml'],
      ['another concierge script', '.github/scripts/janitor.mjs'],
      ['the concierge pin', '.github/issue-concierge.yml'],
      ['generated docs', 'docs/classes/Foo.html'],
      ['the licence', 'LICENSE'],
      ['a Markdown file in a source folder', 'src/utils/README.md'],
      ['a Markdown file in a nested docs folder', 'docs/readme.md'],
    ];
    test.each(noGuidance)('%s does not', (_what, file) => {
      if (bash.status !== 0) return;
      expect(classify([file]).guidance).toBe(false);
    });

    bashTest('is independent of the code result', () => {
      expect(classify(['AGENTS.md'])).toMatchObject({
        code: false,
        guidance: true,
      });
      expect(classify(['AGENTS.md', 'src/a.ts'])).toMatchObject({
        code: true,
        guidance: true,
      });
      expect(classify(['src/a.ts'])).toMatchObject({
        code: true,
        guidance: false,
      });
      expect(classify(['.github/workflows/janitor.yml'])).toMatchObject({
        code: false,
        guidance: false,
      });
    });

    bashTest('one guidance file among others is enough', () => {
      expect(
        classify(['docs/a.html', 'LICENSE', 'decisions/0014-x.md']).guidance
      ).toBe(true);
    });

    bashTest('the classifier prints exactly two lines', () => {
      expect(classify(['AGENTS.md']).stdout).toBe(
        'code=false\nguidance=true\n'
      );
      expect(classify(['src/a.ts']).stdout).toBe('code=true\nguidance=false\n');
    });
  });
});
