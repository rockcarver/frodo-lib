import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/*
 * Checks the decision records in decisions/ with scripts/validate-decision-records.mjs
 * (the same dependency-free script the other Frodo repositories run in CI), and
 * pins what that script enforces with fixtures. See decisions/README.md.
 */

type Files = Record<string, string | null>;
type Validate = (options: { dir: string; requireRepos?: boolean }) => string[];

const SCRIPT = path.resolve(
  process.cwd(),
  'scripts/validate-decision-records.mjs'
);
const RECORDS_DIR = path.resolve(process.cwd(), 'decisions');

let validateDecisionRecords: Validate;

beforeAll(async () => {
  const mod = await import(pathToFileURL(SCRIPT).href);
  validateDecisionRecords = mod.validateDecisionRecords as Validate;
});

const RECORD = (n: number, extra: Record<string, string> = {}): string => {
  const fm: Record<string, any> = {
    status: 'accepted',
    date: '2026-10-24',
    list_decision_makers: ['maintainers'],
    list_repos: ['rockcarver/frodo-cli'],
    ...extra,
  };
  const lines = [
    '---',
    `status: ${fm.status}`,
    `date: ${fm.date}`,
    'decision-makers:',
    ...fm.list_decision_makers.map((x: string) => `  - ${x}`),
    'repos:',
    ...fm.list_repos.map((x: string) => `  - ${x}`),
    '---',
    '',
    `# Record ${n}`,
    '',
    '## Context and problem statement',
    '',
    'Why.',
    '',
    '## Decision',
    '',
    'What.',
    '',
    '## Consequences',
    '',
    'So what.',
    '',
  ];
  return lines.join('\n');
};
const README = (rows: string[]): string =>
  [
    '# Decisions',
    '',
    '| # | Title | Status |',
    '| - | - | - |',
    ...rows,
    '',
  ].join('\n');

function fixture(mutate: (files: Files) => void = () => {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'decisions-'));
  const files: Files = {
    'template.md': '---\nstatus: proposed\n---\n',
    '0001-first-thing.md': RECORD(1),
    '0002-second-thing.md': RECORD(2),
    'README.md': README([
      '| 0001 | [First](0001-first-thing.md) | accepted |',
      '| 0002 | [Second](0002-second-thing.md) | accepted |',
    ]),
  };
  mutate(files);
  for (const [name, text] of Object.entries(files))
    if (text !== null) fs.writeFileSync(path.join(dir, name), text);
  return dir;
}
const check = (
  mutate: (files: Files) => void,
  opts: { requireRepos?: boolean } = {}
): string[] => validateDecisionRecords({ dir: fixture(mutate), ...opts });
const has = (problems: string[], text: string): void => {
  expect(problems.some((p) => p.includes(text))).toBe(true);
};

test('a valid set of records has no problems', () => {
  expect(check(() => {}, { requireRepos: true })).toEqual([]);
});
test('a missing directory is a problem', () =>
  has(
    validateDecisionRecords({ dir: '/nonexistent-decisions-dir' }),
    'does not exist'
  ));
test('README.md and template.md are required', () => {
  has(
    check((f: Files) => {
      f['README.md'] = null;
    }),
    'README.md is missing'
  );
  has(
    check((f: Files) => {
      f['template.md'] = null;
    }),
    'template.md is missing'
  );
});
test('file names must be NNNN-short-title.md', () =>
  has(
    check((f: Files) => {
      f['0003_Bad Name.md'] = RECORD(3);
    }),
    'the name must be NNNN-short-title.md'
  ));
test('numbers must be unique and contiguous', () => {
  has(
    check((f: Files) => {
      f['0001-other-thing.md'] = RECORD(1);
    }),
    'used twice'
  );
  has(
    check((f: Files) => {
      f['0004-gap.md'] = RECORD(4);
    }),
    'contiguous'
  );
});
test('front matter is required and strict', () => {
  has(
    check((f: Files) => {
      f['0001-first-thing.md'] = 'no front matter\n';
    }),
    'must start with a front matter block'
  );
  has(
    check((f: Files) => {
      f['0001-first-thing.md'] = RECORD(1).replace('status: accepted\n', '');
    }),
    'missing front matter key "status"'
  );
  has(
    check((f: Files) => {
      f['0001-first-thing.md'] = RECORD(1).replace(
        'date: 2026-10-24',
        'date: 2026-02-30'
      );
    }),
    'real YYYY-MM-DD date'
  );
  has(
    check((f: Files) => {
      f['0001-first-thing.md'] = RECORD(1).replace(
        'status: accepted',
        'status: maybe'
      );
    }),
    'must be one of'
  );
  has(
    check((f: Files) => {
      f['0001-first-thing.md'] = RECORD(1).replace(
        'date: 2026-10-24\n',
        'date: 2026-10-24\nowner: me\n'
      );
    }),
    'unknown front matter key'
  );
  has(
    check((f: Files) => {
      f['0001-first-thing.md'] = RECORD(1).replace(
        'decision-makers:\n  - maintainers',
        'decision-makers: maintainers'
      );
    }),
    'must be a list'
  );
  has(
    check((f: Files) => {
      f['0001-first-thing.md'] = RECORD(1).replace(
        'status: accepted',
        'status: accepted\nstatus: proposed'
      );
    }),
    'duplicate key'
  );
});
test('repos is required only when asked', () => {
  const noRepos = (f: Files) => {
    f['0001-first-thing.md'] = RECORD(1).replace(
      'repos:\n  - rockcarver/frodo-cli\n',
      ''
    );
  };
  expect(check(noRepos)).toEqual([]);
  has(
    check(noRepos, { requireRepos: true }),
    'missing front matter key "repos"'
  );
});
test('superseded records must name an existing, different record', () => {
  const sup = (to: string) => (f: Files) => {
    f['0001-first-thing.md'] = RECORD(1, { status: `superseded by ${to}` });
    f['README.md'] = README([
      `| 0001 | [First](0001-first-thing.md) | superseded by ${to} |`,
      '| 0002 | [Second](0002-second-thing.md) | accepted |',
    ]);
  };
  expect(check(sup('0002'))).toEqual([]);
  has(check(sup('0009')), 'which does not exist');
  has(check(sup('0001')), 'cannot supersede itself');
});
test('the body needs a title and the three sections in order, each with content', () => {
  has(
    check((f: Files) => {
      f['0001-first-thing.md'] = RECORD(1).replace('# Record 1', 'Record 1');
    }),
    'must start with a "# Title"'
  );
  has(
    check((f: Files) => {
      f['0001-first-thing.md'] = RECORD(1).replace('## Decision', '## Outcome');
    }),
    'unknown section'
  );
  has(
    check((f: Files) => {
      f['0001-first-thing.md'] = RECORD(1).replace(
        /## Consequences[\s\S]*/,
        ''
      );
    }),
    'missing section "## Consequences"'
  );
  expect(
    check((f: Files) => {
      f['0001-first-thing.md'] =
        RECORD(1) +
        '\n## Known deviations\n\nSee 0002.\n\n## Alternatives considered\n\nNone.\n';
    })
  ).toEqual([]);
  has(
    check((f: Files) => {
      f['0001-first-thing.md'] = RECORD(1).replace(
        '## Consequences',
        '## Known deviations\n\nEarly.\n\n## Consequences'
      );
    }),
    'out of order'
  );
  has(
    check((f: Files) => {
      f['0001-first-thing.md'] = RECORD(1).replace(
        '## Decision\n\nWhat.\n\n## Consequences\n\nSo what.\n',
        '## Consequences\n\nSo what.\n\n## Decision\n\nWhat.\n'
      );
    }),
    'out of order'
  );
  has(
    check((f: Files) => {
      f['0001-first-thing.md'] = RECORD(1).replace('What.', '');
    }),
    'is empty'
  );
});
test('records stay short and carry no credentials', () => {
  has(
    check((f: Files) => {
      f['0001-first-thing.md'] = RECORD(1) + 'filler\n'.repeat(70);
    }),
    'longer than'
  );
  has(
    check((f: Files) => {
      f['0001-first-thing.md'] =
        RECORD(1) + 'token ghp_' + 'a'.repeat(30) + '\n';
    }),
    'credential'
  );
});
test('the README index lists every record with its status and nothing else', () => {
  has(
    check((f: Files) => {
      f['README.md'] = README([
        '| 0001 | [First](0001-first-thing.md) | accepted |',
      ]);
    }),
    'no row linking 0002-second-thing.md'
  );
  has(
    check((f: Files) => {
      f['README.md'] = README([
        '| 0001 | [First](0001-first-thing.md) | proposed |',
        '| 0002 | [Second](0002-second-thing.md) | accepted |',
      ]);
    }),
    'does not show the status'
  );
  has(
    check((f: Files) => {
      f['README.md'] = README([
        '| 0001 | [First](0001-first-thing.md) | accepted |',
        '| 0002 | [Second](0002-second-thing.md) | accepted |',
        '| 0003 | [Ghost](0003-ghost.md) | accepted |',
      ]);
    }),
    'which does not exist'
  );
});

test('the decision records of this repository are valid', () => {
  expect(validateDecisionRecords({ dir: RECORDS_DIR })).toEqual([]);
});
