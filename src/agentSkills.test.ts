import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/*
 * Checks the agent skills in .claude/skills (read by Claude Code and by the
 * GitHub Copilot cloud agent, see AGENTS.md "Procedures") and pins what the
 * check enforces with fixtures. A skill is a how-to; the binding rules stay in
 * decisions/ and .github/instructions/, which a skill links and never restates.
 */

const SKILLS_DIR = '.claude/skills';
const STOP_LINE =
  'Only run when a maintainer asks. If you are a coding agent without the needed access, stop and say so in the issue or pull request.';
const KEYS = ['name', 'description', 'license', 'disable-model-invocation'];
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_NAME = 64;
const MAX_DESCRIPTION = 1000;
const MAX_BODY_LINES = 500;
// Build output and runtime folders a clean clone does not have.
const NOT_IN_GIT = ['dist', 'types', 'node_modules'];
const PATH_LIKE =
  /^\.?[A-Za-z0-9_@-][A-Za-z0-9_.@-]*(?:\/[A-Za-z0-9_.@-]+)+\/?$/;
const FILE_EXTENSION = /\.(?:md|json|mjs|cjs|mts|ts|js|ya?ml)$/;
const UMBRELLA_URL =
  /https:\/\/github\.com\/rockcarver\/frodo\/blob\/main\/docs\/decisions\//;
const UMBRELLA_RECORD = new RegExp(
  `${UMBRELLA_URL.source}(\\d{4}-[a-z0-9-]+\\.md)`,
  'g'
);
const SECRET =
  /(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})/;
const EMAIL =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
const TENANT_HOST = /\.forgeblocks\.com/i;

type FrontMatter =
  { error: string } | { data: Record<string, string>; body: string[] };

function parseFrontMatter(text: string): FrontMatter {
  const lines = text.split('\n');
  if (lines[0] !== '---') {
    return { error: 'must start with a front matter block (---)' };
  }
  const end = lines.indexOf('---', 1);
  if (end < 0) return { error: 'front matter is not closed with ---' };
  const data: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    if (line.trim() === '') continue;
    const kv = line.match(/^([a-z-]+):\s*(.*?)\s*$/);
    if (!kv) return { error: `cannot read front matter line: "${line}"` };
    if (kv[1] in data) return { error: `duplicate key "${kv[1]}"` };
    let value = kv[2];
    const quoted = value.match(/^(["'])(.*)\1$/);
    if (quoted) {
      value = quoted[2];
    } else if (/:\s|\s#/.test(value)) {
      return {
        error: `the value of "${kv[1]}" has ": " or " #" in it and must be quoted`,
      };
    }
    data[kv[1]] = value;
  }
  return { data, body: lines.slice(end + 1) };
}

/** Splits markdown into prose, inline code spans and fenced code lines. */
function splitMarkdown(body: string[]) {
  const prose: string[] = [];
  const code: string[] = [];
  let fenced = false;
  for (const line of body) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      code.push(line);
      continue;
    }
    for (const span of line.matchAll(/`([^`]+)`/g)) code.push(span[1]);
    prose.push(line.replace(/`[^`]+`/g, ''));
  }
  return { prose, code };
}

function isRepoPath(root: string, token: string): boolean {
  if (/[<>{}*$~=:|]|NNNN|:\/\//.test(token) || !PATH_LIKE.test(token)) {
    return false;
  }
  const first = token.replace(/^\.\//, '').split('/')[0];
  if (NOT_IN_GIT.includes(first)) return false;
  return fs.existsSync(path.join(root, first)) || FILE_EXTENSION.test(token);
}

/** Returns a list of problems, empty when every skill is valid. */
function checkSkills(root: string): string[] {
  const problems: string[] = [];
  const skillsDir = path.join(root, SKILLS_DIR);
  if (!fs.existsSync(skillsDir)) return [`${SKILLS_DIR} does not exist`];

  const pkgFile = path.join(root, 'package.json');
  const scripts: Record<string, string> = fs.existsSync(pkgFile)
    ? JSON.parse(fs.readFileSync(pkgFile, 'utf8')).scripts || {}
    : {};
  const agentsFile = path.join(root, 'AGENTS.md');
  const agents = fs.existsSync(agentsFile)
    ? fs.readFileSync(agentsFile, 'utf8')
    : '';
  const recordsDir = path.join(root, 'decisions');
  const records = fs.existsSync(recordsDir) ? fs.readdirSync(recordsDir) : [];

  const dirs = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  if (dirs.length === 0) problems.push(`${SKILLS_DIR} has no skill folders`);

  for (const dir of dirs) {
    const where = `${SKILLS_DIR}/${dir}`;
    const fail = (msg: string) => problems.push(`${where}: ${msg}`);
    const file = path.join(skillsDir, dir, 'SKILL.md');
    if (!fs.existsSync(file)) {
      fail('SKILL.md is missing');
      continue;
    }
    const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const fm = parseFrontMatter(text);
    if ('error' in fm) {
      fail(fm.error);
      continue;
    }
    const { data, body } = fm;

    for (const key of Object.keys(data)) {
      if (key === 'allowed-tools') {
        fail(
          '"allowed-tools" is not allowed: a skill must not pre-approve tools'
        );
      } else if (!KEYS.includes(key)) {
        fail(`unknown front matter key "${key}"`);
      }
    }
    if (!data.name) fail('missing front matter key "name"');
    else if (data.name !== dir) {
      fail(`name "${data.name}" must equal the folder name "${dir}"`);
    } else if (!NAME.test(data.name) || data.name.length > MAX_NAME) {
      fail(
        `name must be lower case letters, digits and single hyphens, at most ${MAX_NAME} characters`
      );
    }
    if (!data.description) fail('missing or empty "description"');
    else if (data.description.length > MAX_DESCRIPTION) {
      fail(`description is longer than ${MAX_DESCRIPTION} characters`);
    }
    const bodyLines = body.filter((l, i, a) => i < a.length - 1 || l !== '');
    if (bodyLines.length >= MAX_BODY_LINES) {
      fail(
        `body has ${bodyLines.length} lines, keep it under ${MAX_BODY_LINES}`
      );
    }

    const manual = data['disable-model-invocation'];
    if (manual !== undefined && manual !== 'true' && manual !== 'false') {
      fail('"disable-model-invocation" must be true or false');
    }
    if (manual === 'true') {
      const first = body.find((l) => l.trim() !== '') ?? '';
      if (first.replace(/\*\*/g, '').trim() !== STOP_LINE) {
        fail(`a manual skill must start with the line: ${STOP_LINE}`);
      }
    }
    if (agents && !agents.includes(dir)) {
      fail('AGENTS.md does not name this skill under "Procedures"');
    }
    if (!agents) fail('AGENTS.md is missing or empty');

    const { prose, code } = splitMarkdown(body);
    const everything = [...prose, ...code].join('\n');

    for (const m of everything.matchAll(/\bnpm run ([A-Za-z0-9:_-]+)/g)) {
      if (!(m[1] in scripts))
        fail(`"npm run ${m[1]}" is not a script in package.json`);
    }

    const tokens = new Set<string>();
    for (const chunk of code) {
      for (const raw of chunk.split(/\s+/)) {
        tokens.add(raw.replace(/^["'([]+|["',;.)\]]+$/g, ''));
      }
    }
    for (const token of tokens) {
      if (isRepoPath(root, token) && !fs.existsSync(path.join(root, token))) {
        fail(`"${token}" is not a path in this repository`);
      }
    }
    for (const line of prose) {
      for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = m[1].split('#')[0];
        if (!target || /^[a-z]+:/i.test(target)) continue;
        if (!fs.existsSync(path.resolve(skillsDir, dir, target))) {
          fail(`the link "${m[1]}" does not point at a file`);
        }
      }
    }

    for (const m of text
      .replace(/https?:\/\/\S+/g, '')
      .matchAll(/decisions\/(\d{4})\b/g)) {
      if (!records.some((r) => r.startsWith(`${m[1]}-`))) {
        fail(`cites decisions/${m[1]}, which does not exist`);
      }
    }
    for (const m of text.matchAll(/umbrella (?:decision|record) (\d{4})/g)) {
      // Both repositories number their records from 0001: a bare number is ambiguous.
      const linked = new RegExp(
        `\\[[^\\]]*umbrella (?:decision|record) ${m[1]}[^\\]]*\\]\\(${UMBRELLA_URL.source}${m[1]}-`
      );
      if (!linked.test(text)) {
        fail(`cites umbrella record ${m[1]} without linking it`);
      }
    }
    for (const m of text.matchAll(UMBRELLA_RECORD)) {
      if (!agents.includes(m[0])) {
        fail(
          `links the umbrella record ${m[1]}, which AGENTS.md does not list`
        );
      }
    }

    if (SECRET.test(text)) fail('looks like it contains a credential');
    if (EMAIL.test(text)) fail('contains an e-mail address');
    if (TENANT_HOST.test(text)) fail('names a tenant host');
  }
  return problems;
}

const SKILL = (extra: Record<string, string> = {}, body = 'Do it.\n') => {
  const fm: Record<string, string> = {
    name: 'do-things',
    description: 'Do things. Use when you must do things.',
    ...extra,
  };
  return [
    '---',
    ...Object.entries(fm).map(([k, v]) => `${k}: ${v}`),
    '---',
    '',
    '# Do things',
    '',
    body,
  ].join('\n');
};

type Files = Record<string, string | null>;

const made: string[] = [];
afterAll(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function fixture(mutate: (files: Files) => void = () => {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-'));
  made.push(root);
  const files: Files = {
    'package.json': JSON.stringify({
      scripts: { build: 'x', 'test:only': 'y' },
    }),
    'AGENTS.md': 'Procedures: do-things\n',
    'decisions/0001-first.md': '# one\n',
    'src/real.ts': 'export {};\n',
    '.claude/skills/do-things/SKILL.md': SKILL(),
  };
  mutate(files);
  for (const [name, text] of Object.entries(files)) {
    if (text === null) continue;
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  return root;
}
const check = (mutate: (files: Files) => void): string[] =>
  checkSkills(fixture(mutate));
const skill = (content: string) => (f: Files) => {
  f['.claude/skills/do-things/SKILL.md'] = content;
};
const has = (problems: string[], text: string): void => {
  expect(problems.some((p) => p.includes(text))).toBe(true);
};

test('a valid skill has no problems', () => {
  expect(check(() => {})).toEqual([]);
});
test('the skills folder must exist and hold skills', () => {
  has(checkSkills('/nonexistent-skills-root'), 'does not exist');
  has(
    check((f) => {
      f['.claude/skills/do-things/SKILL.md'] = null;
      f['.claude/skills/.gitkeep'] = '';
    }),
    'has no skill folders'
  );
});
test('every skill folder needs a SKILL.md', () =>
  has(
    check((f) => {
      f['.claude/skills/other/notes.md'] = 'x';
    }),
    'SKILL.md is missing'
  ));
test('front matter is required and strict', () => {
  has(check(skill('# no front matter\n')), 'must start with a front matter');
  has(check(skill('---\nname: do-things\n# never closed\n')), 'is not closed');
  has(check(skill(SKILL({ name: 'do-things\nname: again' }))), 'duplicate key');
  has(
    check(skill(SKILL({ license: 'MIT', owner: 'me' }))),
    'unknown front matter key'
  );
  has(
    check(skill(SKILL({ 'allowed-tools': 'Bash' }))),
    'must not pre-approve tools'
  );
  has(
    check(skill(SKILL({ description: 'Use when: you must' }))),
    'must be quoted'
  );
  expect(check(skill(SKILL({ description: '"Use when: you must"' })))).toEqual(
    []
  );
});
test('the name equals the folder and is lower case with hyphens', () => {
  has(
    check(skill(SKILL({ name: 'other-name' }))),
    'must equal the folder name'
  );
  has(
    check((f) => {
      f['.claude/skills/Do_Things/SKILL.md'] = SKILL({ name: 'Do_Things' });
    }),
    'lower case letters'
  );
  has(
    check(skill(SKILL().replace('name: do-things\n', ''))),
    'missing front matter key "name"'
  );
});
test('the name is at most 64 characters', () => {
  const long = (n: number) => (f: Files) => {
    const name = 'a'.repeat(n);
    f['AGENTS.md'] = `Procedures: ${name}\n`;
    f['.claude/skills/do-things/SKILL.md'] = null;
    f[`.claude/skills/${name}/SKILL.md`] = SKILL({ name });
  };
  has(check(long(65)), 'at most 64 characters');
  expect(check(long(64))).toEqual([]);
});
test('the description is present and short enough', () => {
  has(
    check(skill(SKILL().replace(/description: .*\n/, ''))),
    'missing or empty "description"'
  );
  has(
    check(skill(SKILL({ description: 'a'.repeat(1001) }))),
    'longer than 1000'
  );
  expect(check(skill(SKILL({ description: 'a'.repeat(1000) })))).toEqual([]);
});
test('the body stays under 500 lines', () => {
  // SKILL() puts a blank line, a title and a blank line above the body text.
  has(check(skill(SKILL({}, 'line\n'.repeat(497)))), 'keep it under 500');
  expect(check(skill(SKILL({}, 'line\n'.repeat(496))))).toEqual([]);
});
test('Windows line endings are accepted', () => {
  expect(check(skill(SKILL().replace(/\n/g, '\r\n')))).toEqual([]);
});
test('a manual skill starts with the stop line', () => {
  const manual = (first: string) =>
    skill(
      [
        '---',
        'name: do-things',
        'description: Do things.',
        'disable-model-invocation: true',
        '---',
        '',
        first,
        '',
        '# Do things',
        '',
      ].join('\n')
    );
  expect(check(manual(`**${STOP_LINE}**`))).toEqual([]);
  expect(check(manual(STOP_LINE))).toEqual([]);
  has(check(manual('# Do things')), 'must start with the line');
  has(
    check(skill(SKILL({ 'disable-model-invocation': 'yes' }))),
    'must be true or false'
  );
});
test('AGENTS.md names every skill', () => {
  has(
    check((f) => {
      f['AGENTS.md'] = 'Procedures: something else\n';
    }),
    'AGENTS.md does not name this skill'
  );
  has(
    check((f) => {
      f['AGENTS.md'] = null;
    }),
    'AGENTS.md is missing'
  );
});
test('npm scripts a skill mentions must exist', () => {
  expect(
    check(skill(SKILL({}, 'Run `npm run test:only -- x`, then npm test.\n')))
  ).toEqual([]);
  has(
    check(skill(SKILL({}, '```console\nnpm run frobnicate\n```\n'))),
    '"npm run frobnicate" is not a script'
  );
});
test('paths and links must point at files that exist', () => {
  expect(
    check(
      skill(
        SKILL(
          {},
          'See `src/real.ts` and [AGENTS](../../../AGENTS.md#x), `dist/index.js`, `origin/main`, `src/<Name>Api.ts`, `src/**/*.ts`, `decisions/NNNN-x.md`, https://example.com/a/b.md.\n'
        )
      )
    )
  ).toEqual([]);
  has(
    check(skill(SKILL({}, 'See `nowhere/gone.md`.\n'))),
    '"nowhere/gone.md" is not a path'
  );
  has(
    check(skill(SKILL({}, 'See `src/gone.ts`.\n'))),
    '"src/gone.ts" is not a path'
  );
  has(
    check(skill(SKILL({}, '```console\ncat decisions/0009-gone.md\n```\n'))),
    '"decisions/0009-gone.md" is not a path'
  );
  has(
    check(skill(SKILL({}, 'See [guide](../../../GONE.md).\n'))),
    'does not point at a file'
  );
});
test('cited records must exist and umbrella records must be listed', () => {
  has(
    check(skill(SKILL({}, 'See decisions/0007.\n'))),
    'decisions/0007, which does not exist'
  );
  expect(check(skill(SKILL({}, 'See decisions/0001.\n')))).toEqual([]);
  const url =
    'https://github.com/rockcarver/frodo/blob/main/docs/decisions/0002-a-thing.md';
  has(
    check(skill(SKILL({}, `See [it](${url}).\n`))),
    'which AGENTS.md does not list'
  );
  expect(
    check((f) => {
      f['AGENTS.md'] = `Procedures: do-things. ${url}\n`;
      skill(SKILL({}, `See [it](${url}).\n`))(f);
    })
  ).toEqual([]);
});
test('an umbrella record is cited with a link, not a bare number', () => {
  const url =
    'https://github.com/rockcarver/frodo/blob/main/docs/decisions/0002-a-thing.md';
  const listed = (body: string) => (f: Files) => {
    f['AGENTS.md'] = `Procedures: do-things. ${url}\n`;
    skill(SKILL({}, body))(f);
  };
  expect(check(listed(`See [umbrella decision 0002](${url}).\n`))).toEqual([]);
  has(
    check(listed(`See umbrella decision 0002 (${url}).\n`)),
    'cites umbrella record 0002 without linking it'
  );
  has(
    check(listed(`See [umbrella decision 0003](${url}).\n`)),
    'cites umbrella record 0003 without linking it'
  );
  has(
    check(
      listed(
        `See umbrella decision 0002 and [umbrella decision 0003](${url}).\n`
      )
    ),
    'cites umbrella record 0002 without linking it'
  );
});
test('skills are public: no credentials, e-mail addresses or tenant hosts', () => {
  has(check(skill(SKILL({}, `token ghp_${'a'.repeat(30)}\n`))), 'credential');
  has(check(skill(SKILL({}, 'ask someone@example.org\n'))), 'e-mail address');
  has(
    check(skill(SKILL({}, 'host https://openam-x.forgeblocks.com/am\n'))),
    'names a tenant host'
  );
});

test('the agent skills of this repository are valid', () => {
  expect(checkSkills(process.cwd())).toEqual([]);
});
