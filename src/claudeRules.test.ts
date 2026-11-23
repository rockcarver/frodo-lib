import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isolatedChildEnv } from '../test/support/runWorkers';

/*
 * Claude Code reads scoped rules from .claude/rules/, GitHub Copilot from
 * .github/instructions/ (core 0026). The instruction files are the one source
 * and every file of .claude/rules/ is a generated twin of one of them, made by
 * scripts/generate-claude-rules.mjs. This test keeps the two folders from
 * drifting, keeps every twin scoped (an unscoped rule loads at launch and costs
 * context in every session) and holds AGENTS.md to its budget and its five laws.
 *
 * It cannot say whether Claude Code matches a pattern: that is checked by
 * opening a session on a matching file (the pull request that added this test
 * says how).
 */

type Generator = {
  COMMAND: string;
  SOURCE_DIR: string;
  TARGET_DIR: string;
  parseInstructionFile: (text: string) => { applyTo: string[]; body: string };
  translateGlob: (glob: string) => string;
  renderRule: (
    text: string,
    options: { source: string; command?: string }
  ) => string;
  syncRules: (root: string, options?: { write?: boolean }) => string[];
};

const ROOT = process.cwd();
const GENERATOR = path.join(ROOT, 'scripts/generate-claude-rules.mjs');
const SOURCE_DIR = '.github/instructions';
const TARGET_DIR = '.claude/rules';
/** The bytes that every session of Claude Code loads: AGENTS.md and the CLAUDE.md that imports it. */
const ALWAYS_LOADED_CEILING = 8000;
const LAW_CEILING = 450;

const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const lf = (text: string) => text.replace(/\r\n/g, '\n');

/** Every file below `dir`, as paths relative to it with `/`, sorted. */
function filesBelow(dir: string, prefix = ''): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? filesBelow(path.join(dir, entry.name), `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`]
    )
    .sort();
}

const sourceNames = filesBelow(path.join(ROOT, SOURCE_DIR)).filter((f) =>
  f.endsWith('.instructions.md')
);

/** The temporary folders that the tests made, removed when the file is done. */
const made: string[] = [];
const makeTemp = (prefix = 'claude-rules-') => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

/** The items of the `paths` list of a twin and the line that follows the front matter. */
function readTwin(text: string) {
  const match = /^---\npaths:\n((?:  - .*\n)+)---\n(.*)\n/.exec(lf(text));
  if (!match) return undefined;
  return {
    paths: match[1]
      .trimEnd()
      .split('\n')
      .map((l) => l.slice(4)),
    header: match[2],
  };
}

let gen: Generator;
beforeAll(async () => {
  gen = (await import(pathToFileURL(GENERATOR).href)) as Generator;
});

describe('parseInstructionFile', () => {
  const file = (applyTo: string) =>
    `---\napplyTo: ${applyTo}\n---\n\n# Title\n`;

  test.each([
    ["'a/b/**/*.ts,c.json'", ['a/b/**/*.ts', 'c.json']],
    ['"a/b"', ['a/b']],
    ['a/b', ['a/b']],
    ["' a/b , c '", ['a/b', 'c']],
  ])('accepts %s', (value, expected) => {
    expect(gen.parseInstructionFile(file(value)).applyTo).toEqual(expected);
  });

  test('ends the front matter at the first closing line, so a horizontal rule of the body stays in the body', () => {
    const text = "---\napplyTo: 'a/b'\n---\n\n# Title\n\nOne\n\n---\n\nTwo\n";
    expect(gen.parseInstructionFile(text)).toEqual({
      applyTo: ['a/b'],
      body: '\n# Title\n\nOne\n\n---\n\nTwo\n',
    });
  });

  test('returns the body unchanged, and reads a CRLF file as LF', () => {
    expect(gen.parseInstructionFile(file("'a/b'")).body).toBe('\n# Title\n');
    expect(
      gen.parseInstructionFile(file("'a/b'").replace(/\n/g, '\r\n')).body
    ).toBe('\n# Title\n');
  });

  test.each([
    ['no front matter', '# Title\n', /no front matter/],
    [
      'a second key',
      "---\napplyTo: 'a/b'\nexcludeAgent: 'code-review'\n---\n",
      /only applyTo.*excludeAgent/,
    ],
    ['another key only', "---\ndescription: 'x'\n---\n", /only applyTo/],
    [
      'a second applyTo line',
      "---\napplyTo: 'a/b'\napplyTo: 'c/d'\n---\n",
      /more than once/,
    ],
    ['no applyTo line', '---\n\n---\n\n# Title\n', /applyTo is missing/],
    ['an empty value', file("''"), /empty/],
    ['a missing value', file(''), /empty/],
    ['an empty item', file("'a/b,,c'"), /empty item/],
    ['a trailing comma', file("'a/b,'"), /empty item/],
    ['a brace', file("'src/**/*.{ts,js}'"), /not translated/],
    ['a negation', file("'!src/a'"), /not translated/],
    ['a bracket', file("'src/[ab].ts'"), /not translated/],
    ['a leading slash', file("'/package.json'"), /starts with a slash/],
  ])('rejects %s', (_name, text, message) => {
    expect(() => gen.parseInstructionFile(text)).toThrow(message);
  });
});

describe('translateGlob', () => {
  test.each([
    ['src/cli/**/*.ts', 'src/cli/**/*.ts'],
    ['src/index.ts', 'src/index.ts'],
    ['test/**', 'test/**'],
    ['.github/README.md', '.github/README.md'],
    ['scripts/**', 'scripts/**'],
    ['.github/**', '.github/**'],
    ['package.json', '/package.json'],
    ['MIGRATION.md', '/MIGRATION.md'],
    ['*.md', '/*.md'],
  ])('%s becomes %s', (glob, expected) => {
    expect(gen.translateGlob(glob)).toBe(expected);
  });
});

describe('renderRule', () => {
  const options = {
    source: '.github/instructions/a.instructions.md',
    command: 'node scripts/x.mjs',
  };
  const source =
    "---\napplyTo: 'src/a/**/*.ts,package.json'\n---\n\n# A rule\n\n- **Keep** it `short`.\n";

  test('writes the paths, one double quoted item each, the header, and the body as it is', () => {
    expect(gen.renderRule(source, options)).toBe(
      [
        '---',
        'paths:',
        '  - "src/a/**/*.ts"',
        '  - "/package.json"',
        '---',
        '<!-- Generated: do not edit. Source: .github/instructions/a.instructions.md. Regenerate with: node scripts/x.mjs -->',
        '',
        '# A rule',
        '',
        '- **Keep** it `short`.',
        '',
      ].join('\n')
    );
  });

  test('gives the LF twin for a CRLF source', () => {
    expect(gen.renderRule(source.replace(/\n/g, '\r\n'), options)).toBe(
      gen.renderRule(source, options)
    );
  });

  test('names the command of this repository by default', () => {
    expect(gen.COMMAND).toBe('node scripts/generate-claude-rules.mjs');
    expect(gen.renderRule(source, { source: options.source })).toContain(
      `Regenerate with: ${gen.COMMAND} -->`
    );
  });
});

describe('the generator on a temporary tree', () => {
  const SOURCES: Record<string, string> = {
    'a.instructions.md': "---\napplyTo: 'src/a/**/*.ts'\n---\n\n# A\n",
    'b.instructions.md': "---\napplyTo: 'package.json,test/**'\n---\n\n# B\n",
  };

  /** A tree with the sources and, when `generated`, the twins that the generator wrote for them. */
  function tree(sources: Record<string, string> = SOURCES, generated = true) {
    const root = makeTemp();
    fs.mkdirSync(path.join(root, SOURCE_DIR), { recursive: true });
    for (const [name, text] of Object.entries(sources)) {
      fs.mkdirSync(path.dirname(path.join(root, SOURCE_DIR, name)), {
        recursive: true,
      });
      fs.writeFileSync(path.join(root, SOURCE_DIR, name), text);
    }
    if (generated) gen.syncRules(root, { write: true });
    return root;
  }

  const run = (root: string, ...args: string[]) => {
    const result = spawnSync(
      process.execPath,
      [GENERATOR, ...args, '--root', root],
      { encoding: 'utf8', env: isolatedChildEnv() }
    );
    return { status: result.status, out: result.stdout + result.stderr };
  };

  test('--check exits 0 when every twin is what its source generates', () => {
    const root = tree();
    expect(run(root, '--check')).toMatchObject({ status: 0 });
    expect(filesBelow(path.join(root, TARGET_DIR))).toEqual(
      Object.keys(SOURCES)
    );
  });

  test('--check exits 1 and names a twin that was edited by one byte', () => {
    const root = tree();
    const twin = path.join(root, TARGET_DIR, 'a.instructions.md');
    fs.writeFileSync(twin, fs.readFileSync(twin, 'utf8').replace('# A', '# a'));
    const { status, out } = run(root, '--check');
    expect(status).toBe(1);
    expect(out).toContain(`${TARGET_DIR}/a.instructions.md: differs`);
    expect(out).not.toContain('b.instructions.md');
    expect(out).toContain(gen.COMMAND);
  });

  test('--check exits 1 for a twin that is stale after its source changed', () => {
    const root = tree();
    fs.writeFileSync(
      path.join(root, SOURCE_DIR, 'b.instructions.md'),
      "---\napplyTo: 'package.json'\n---\n\n# B\n"
    );
    const { status, out } = run(root, '--check');
    expect(status).toBe(1);
    expect(out).toContain(`${TARGET_DIR}/b.instructions.md: differs`);
  });

  test('--check exits 1 for a missing twin', () => {
    const root = tree();
    fs.rmSync(path.join(root, TARGET_DIR, 'b.instructions.md'));
    const { status, out } = run(root, '--check');
    expect(status).toBe(1);
    expect(out).toContain(`${TARGET_DIR}/b.instructions.md: missing`);
  });

  test('--check exits 1 for a file in the rules folder that has no source, also in a subfolder', () => {
    const root = tree();
    fs.mkdirSync(path.join(root, TARGET_DIR, 'sub'));
    fs.writeFileSync(path.join(root, TARGET_DIR, 'x.md'), '# x\n');
    fs.writeFileSync(path.join(root, TARGET_DIR, 'sub', 'y.md'), '# y\n');
    const { status, out } = run(root, '--check');
    expect(status).toBe(1);
    expect(out).toContain(`${TARGET_DIR}/x.md: has no source`);
    expect(out).toContain(`${TARGET_DIR}/sub/y.md: has no source`);
  });

  test('--check exits 1 and names the source it cannot read', () => {
    const root = tree();
    fs.writeFileSync(
      path.join(root, SOURCE_DIR, 'a.instructions.md'),
      "---\napplyTo: 'src/{a,b}/**'\n---\n"
    );
    const { status, out } = run(root, '--check');
    expect(status).toBe(1);
    expect(out).toContain('not translated');
  });

  test('--check accepts a twin that a Windows checkout turned into CRLF', () => {
    const root = tree();
    const twin = path.join(root, TARGET_DIR, 'a.instructions.md');
    fs.writeFileSync(
      twin,
      fs.readFileSync(twin, 'utf8').replace(/\n/g, '\r\n')
    );
    expect(run(root, '--check')).toMatchObject({ status: 0 });
  });

  test('writes the missing and changed twins, removes the orphans and says so, and leaves nothing for --check', () => {
    const root = tree(SOURCES, false);
    fs.mkdirSync(path.join(root, TARGET_DIR), { recursive: true });
    fs.writeFileSync(path.join(root, TARGET_DIR, 'orphan.md'), '# orphan\n');
    const { status, out } = run(root);
    expect(status).toBe(0);
    expect(out).toContain('written or removed');
    expect(out).toContain(`${TARGET_DIR}/orphan.md: has no source`);
    expect(fs.existsSync(path.join(root, TARGET_DIR, 'orphan.md'))).toBe(false);
    expect(filesBelow(path.join(root, TARGET_DIR))).toEqual(
      Object.keys(SOURCES)
    );
    expect(run(root, '--check')).toMatchObject({ status: 0 });
  });

  test('gives a source in a subfolder a twin in the same subfolder, and reports a stale or orphan one there', () => {
    const root = tree({
      ...SOURCES,
      'sub/c.instructions.md': "---\napplyTo: 'src/c/**'\n---\n\n# C\n",
    });
    expect(filesBelow(path.join(root, TARGET_DIR))).toEqual([
      ...Object.keys(SOURCES),
      'sub/c.instructions.md',
    ]);
    expect(
      fs.readFileSync(
        path.join(root, TARGET_DIR, 'sub/c.instructions.md'),
        'utf8'
      )
    ).toContain(`Source: ${SOURCE_DIR}/sub/c.instructions.md.`);
    expect(run(root, '--check')).toMatchObject({ status: 0 });
    fs.rmSync(path.join(root, TARGET_DIR, 'sub/c.instructions.md'));
    const { status, out } = run(root, '--check');
    expect(status).toBe(1);
    expect(out).toContain(`${TARGET_DIR}/sub/c.instructions.md: missing`);
  });

  test('checks when it is started through a symlinked folder, where argv[1] is not the real path', () => {
    const root = tree();
    fs.appendFileSync(path.join(root, SOURCE_DIR, 'a.instructions.md'), 'x');
    const link = path.join(makeTemp('claude-rules-link-'), 'scripts');
    fs.symlinkSync(path.dirname(GENERATOR), link, 'junction');
    const result = spawnSync(
      process.execPath,
      [path.join(link, path.basename(GENERATOR)), '--check', '--root', root],
      { encoding: 'utf8', env: isolatedChildEnv() }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${TARGET_DIR}/a.instructions.md: differs`);
  });

  test('ignores a file of the instructions folder that is not an instruction file', () => {
    const root = tree({ ...SOURCES, 'README.md': '# not a source\n' });
    expect(filesBelow(path.join(root, TARGET_DIR))).toEqual(
      Object.keys(SOURCES)
    );
    expect(run(root, '--check')).toMatchObject({ status: 0 });
  });
});

describe('the twins of this repository', () => {
  const twins = filesBelow(path.join(ROOT, TARGET_DIR));

  test('are exactly the instruction files, by name', () => {
    expect(sourceNames.length).toBeGreaterThan(0);
    expect(twins).toEqual(sourceNames);
  });

  test('are what the generator makes of their sources (run `npm run generate-claude-rules`)', () => {
    expect(gen.syncRules(ROOT)).toEqual([]);
    for (const name of sourceNames) {
      const source = `${SOURCE_DIR}/${name}`;
      expect(lf(read(`${TARGET_DIR}/${name}`))).toBe(
        gen.renderRule(read(source), { source })
      );
    }
  });

  test.each(sourceNames)(
    '%s is scoped and says that it is generated',
    (name) => {
      const twin = readTwin(read(`${TARGET_DIR}/${name}`));
      expect(twin).toBeDefined();
      expect(twin!.paths.length).toBeGreaterThan(0);
      for (const item of twin!.paths) {
        expect(item).toMatch(/^"[^"\s{}![\]][^"{}![\]]*"$/);
        expect(item).not.toMatch(/^"\*/);
      }
      expect(twin!.header).toBe(
        `<!-- Generated: do not edit. Source: ${SOURCE_DIR}/${name}. Regenerate with: ${gen.COMMAND} -->`
      );
    }
  );

  test('anchor a name without a slash at the root', () => {
    const paths = readTwin(
      read(`${TARGET_DIR}/dependencies.instructions.md`)
    )!.paths;
    expect(paths).toContain('"/package.json"');
    expect(paths).not.toContain('"package.json"');
  });

  test.each(sourceNames)(
    '%s links to files that exist, the same files as its source',
    (name) => {
      const links = [
        ...read(`${TARGET_DIR}/${name}`).matchAll(/\]\(([^)\s]+)\)/g),
      ]
        .map((m) => m[1].split('#')[0])
        .filter((l) => l !== '' && !/^[a-z][a-z0-9+.-]*:/i.test(l));
      // A link to a sibling instruction file reaches the sibling twin, which has the same name.
      const asSource = (file: string) =>
        file.replace(path.join(ROOT, TARGET_DIR), path.join(ROOT, SOURCE_DIR));
      for (const link of links) {
        const fromTwin = path.resolve(
          ROOT,
          TARGET_DIR,
          path.dirname(name),
          link
        );
        expect(fs.existsSync(fromTwin)).toBe(true);
        expect(asSource(fromTwin)).toBe(
          path.resolve(ROOT, SOURCE_DIR, path.dirname(name), link)
        );
      }
    }
  );

  test('can be regenerated with the npm script that AGENTS.md, CONTRIBUTE.md and the github-files rule name', () => {
    const scripts = JSON.parse(read('package.json')).scripts;
    expect(scripts['generate-claude-rules']).toBe(
      'node scripts/generate-claude-rules.mjs'
    );
    for (const file of [
      'AGENTS.md',
      'CONTRIBUTE.md',
      `${SOURCE_DIR}/github-files.instructions.md`,
    ]) {
      expect(read(file)).toContain('npm run generate-claude-rules');
    }
  });

  test('import nothing: no file of the rules or AGENTS.md has an @ import line', () => {
    for (const file of [
      'AGENTS.md',
      ...sourceNames.map((n) => `${TARGET_DIR}/${n}`),
    ]) {
      expect(read(file)).not.toMatch(/^@\S+\.md\s*$/m);
    }
    expect(
      read('CLAUDE.md')
        .split('\n')
        .filter((l) => l.startsWith('@'))
    ).toEqual(['@AGENTS.md']);
  });
});

describe('AGENTS.md', () => {
  const agents = read('AGENTS.md');
  const laws = (
    agents.split(/^## The five laws that get broken most$/m)[1] ?? ''
  )
    .split(/^## /m)[0]
    .split('\n')
    .filter((l) => /^\d+\. /.test(l));

  test('opens with five numbered laws, each with its reason and its check, in 450 bytes at most', () => {
    expect(agents.split(/^## /m)[1]).toMatch(
      /^The five laws that get broken most/
    );
    expect(laws).toHaveLength(5);
    laws.forEach((law, i) => {
      expect(law).toMatch(new RegExp(`^${i + 1}\\. \\*\\*`));
      expect(law).toContain(' Why: ');
      expect(law).toContain(' Check: ');
      expect(Buffer.byteLength(law)).toBeLessThanOrEqual(LAW_CEILING);
    });
  });

  test.each([
    [
      1,
      /accepted record is binding.*stop and say so.*adds or supersedes a record/,
    ],
    [2, /CHANGELOG\.md/],
    [3, /snapshot or a recording.*never write or edit a recording by hand/],
    [4, /`frodo` facade/],
    [5, /`dependencies`.*stays empty.*a new package needs a maintainer's yes/],
  ])('law %i keeps its subject', (number, subject) => {
    expect(laws[number - 1]).toMatch(subject);
  });

  test('keeps the rule that a maintainer is the last lever', () => {
    expect(agents).toContain(
      'core/0002-a-maintainer-stays-the-last-lever-on-agent-work.md'
    );
  });

  test('says how to answer which instruction files were loaded', () => {
    expect(agents).toMatch(
      /If asked which instruction files you loaded, list AGENTS\.md and each rule that has been loaded into your context this session; do not guess\./
    );
  });

  test('says where Claude Code reads its scoped rules, and never that it reads the instruction folder', () => {
    expect(agents).toContain('.claude/rules/');
    expect(agents).not.toMatch(/Claude[^.\n]*\.github\/instructions/);
  });

  test(`stays within ${ALWAYS_LOADED_CEILING} bytes together with CLAUDE.md, which every session loads`, () => {
    expect(
      Buffer.byteLength(agents) + Buffer.byteLength(read('CLAUDE.md'))
    ).toBeLessThanOrEqual(ALWAYS_LOADED_CEILING);
  });
});
