import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isolatedChildEnv } from '../test/support/runWorkers';

/*
 * Two checks keep the decision records of this repository, each for its own
 * folder (see decisions/README.md):
 *
 * - decisions/ is checked by Record Keeper. Its check of a pull request,
 *   `Records integrity`, judges what a change does to the records; the test
 *   below runs its `validate` on the folder as it is, as a ratchet with a
 *   baseline.
 * - decisions/core/ holds the core records, which bind frodo-lib and frodo-cli
 *   (core 0018). Record Keeper leaves that folder alone (`shared-folder: core`
 *   and `shared-changes: allow` in .github/record-keeper/settings.yml), so
 *   scripts/validate-decision-records.mjs, the dependency-free script that
 *   frodo-cli runs too, is its only check. The rest of this file pins what
 *   that script enforces with fixtures, and pins the weekly drift check of the
 *   core records (.github/scripts/check-core-records-drift.mjs and its
 *   workflow, core 0018).
 */

type Files = Record<string, string | null>;
type CoreOptions = { indexFile: string; repo: string };
type Validate = (options: { dir: string; core?: CoreOptions }) => string[];

const SCRIPT = path.resolve(
  process.cwd(),
  'scripts/validate-decision-records.mjs'
);
const DRIFT_SCRIPT = path.resolve(
  process.cwd(),
  '.github/scripts/check-core-records-drift.mjs'
);
const DRIFT_WORKFLOW = path.resolve(
  process.cwd(),
  '.github/workflows/core-records-drift.yml'
);
const RECORDS_DIR = path.resolve(process.cwd(), 'decisions');
const CORE_DIR = path.join(RECORDS_DIR, 'core');
const KIT = path.resolve(
  process.cwd(),
  '.github/record-keeper/record-keeper.mjs'
);
const SETTINGS = path.resolve(
  process.cwd(),
  '.github/record-keeper/settings.yml'
);

let validateDecisionRecords: Validate;
let drift: any;

beforeAll(async () => {
  const mod = await import(pathToFileURL(SCRIPT).href);
  validateDecisionRecords = mod.validateDecisionRecords as Validate;
  drift = await import(pathToFileURL(DRIFT_SCRIPT).href);
});

const has = (problems: string[], text: string): void => {
  expect(problems.some((p) => p.includes(text))).toBe(true);
};

describe('the records of decisions/ (Record Keeper)', () => {
  /**
   * The problems that Record Keeper's `validate` reports for decisions/ and
   * that are accepted until a record supersedes each of them: three records
   * have the status `deprecated`, and V-19 says that a record ends only by a
   * successor. They were left as they were when Record Keeper was adopted; a
   * record that supersedes each of them gives it the status `superseded by
   * NNNN`, and `validate` stops reporting it.
   *
   * This is a ratchet. The test fails on any problem that is not in this list,
   * and it fails as well when an entry of this list no longer occurs, so the
   * entry is removed in the pull request that supersedes its record and the
   * list only gets shorter. Never add an entry to make a run green.
   */
  const BASELINE = [
    'decisions/0011-terminal-and-colour-code-in-the-library.md: [V-19] has the status deprecated; a record ends only by a successor',
    'decisions/0012-lower-layers-import-upward.md: [V-19] has the status deprecated; a record ends only by a successor',
    'decisions/0013-smaller-inconsistencies-with-the-documented-conventions.md: [V-19] has the status deprecated; a record ends only by a successor',
  ];

  /** The value of a single-valued key of the settings file of Record Keeper. */
  const setting = (key: string): string => {
    const m = fs
      .readFileSync(SETTINGS, 'utf8')
      .match(new RegExp(`^${key}:\\s*(\\S+)`, 'm'));
    if (!m) throw new Error(`${key} is not set in ${SETTINGS}`);
    return m[1];
  };

  /**
   * Runs `validate` of Record Keeper in `cwd` on the folder and the shared
   * folder that the settings name, and returns its problems, one for each line,
   * without the line that counts them.
   */
  function kitValidate(cwd: string): {
    status: number | null;
    problems: string[];
    count: string;
  } {
    const folder = setting('folder');
    const result = spawnSync(
      process.execPath,
      [KIT, 'validate', folder, '--shared-folder', setting('shared-folder')],
      { cwd, encoding: 'utf8', env: isolatedChildEnv() }
    );
    const lines = `${result.stdout}${result.stderr}`
      .split(/\r?\n/)
      .filter((l) => l !== '');
    const countLine = new RegExp(`^${folder}: (\\d+) problems?$`);
    const problems = lines.filter((l) => !countLine.test(l));
    const count = lines.find((l) => countLine.test(l)) ?? '';
    return { status: result.status, problems, count };
  }

  /** Splits the problems into those that the baseline does not hold and the entries of the baseline that did not occur. */
  function ratchet(problems: string[], baseline: string[]) {
    const left = [...baseline];
    const added: string[] = [];
    for (const problem of problems) {
      const at = left.indexOf(problem);
      if (at < 0) added.push(problem);
      else left.splice(at, 1);
    }
    return { added, gone: left };
  }

  /** A copy of decisions/ in a folder of its own, for a test that damages it. */
  function copyOfRecords(mutate: (root: string) => void = () => {}): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-decisions-'));
    fs.cpSync(RECORDS_DIR, path.join(root, setting('folder')), {
      recursive: true,
    });
    mutate(root);
    return root;
  }

  test('the settings send decisions/ to the kit and leave decisions/core/ to the script', () => {
    expect(setting('folder')).toBe('decisions');
    expect(setting('shared-changes')).toBe('allow');
    // The folder that the kit leaves alone is the one that the checks below judge.
    expect(
      path.relative(process.cwd(), CORE_DIR).split(path.sep).join('/')
    ).toBe(`${setting('folder')}/${setting('shared-folder')}`);
  });

  test('the kit finds no problem in decisions/ that the baseline does not hold', () => {
    const { status, problems, count } = kitValidate(process.cwd());
    expect(count).toBe(`decisions: ${problems.length} problems`);
    expect(status).toBe(problems.length === 0 ? 0 : 1);
    expect(ratchet(problems, BASELINE).added).toEqual([]);
  });

  test('every entry of the baseline is still a problem: remove it when its record is superseded', () => {
    const { problems } = kitValidate(process.cwd());
    expect(ratchet(problems, BASELINE).gone).toEqual([]);
  });

  test('the ratchet reports a problem that is not in the baseline, and an entry that no longer occurs', () => {
    const extra = 'decisions/0099-x.md: [V-24] does not start with a title';
    expect(ratchet([...BASELINE, extra], BASELINE)).toEqual({
      added: [extra],
      gone: [],
    });
    expect(ratchet(BASELINE.slice(1), BASELINE)).toEqual({
      added: [],
      gone: [BASELINE[0]],
    });
    // The same problem twice is one entry and one more problem.
    expect(ratchet([BASELINE[0], BASELINE[0]], [BASELINE[0]])).toEqual({
      added: [BASELINE[0]],
      gone: [],
    });
    expect(ratchet(BASELINE, BASELINE)).toEqual({ added: [], gone: [] });
  });

  test('a record without a title is a new problem, and a baseline entry that the kit does not report is left over', () => {
    const whole = kitValidate(copyOfRecords());
    expect(ratchet(whole.problems, BASELINE)).toEqual({
      added: [],
      gone: [],
    });

    const untitled = kitValidate(
      copyOfRecords((root) => {
        const file = path.join(
          root,
          'decisions',
          '0001-every-special-capability-has-a-reviewed-risk-entry.md'
        );
        fs.writeFileSync(
          file,
          fs.readFileSync(file, 'utf8').replace(/^# .*\n/m, '')
        );
      })
    );
    expect(untitled.status).toBe(1);
    const { added, gone } = ratchet(untitled.problems, BASELINE);
    expect(gone).toEqual([]);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatch(/0001-.*\[V-24\]/);

    // An entry of the baseline whose problem the kit no longer reports.
    const vanished =
      'decisions/0010-recordings-replay-against-any-host.md: [V-19] has the status deprecated; a record ends only by a successor';
    expect(ratchet(whole.problems, [...BASELINE, vanished]).gone).toEqual([
      vanished,
    ]);
  });
});

const LIB = 'rockcarver/frodo-lib';
const CORE_ROW = (
  n: number,
  file: string,
  status = 'accepted',
  applies = 'repository-wide'
): string =>
  `| [core ${String(n).padStart(4, '0')}](core/${file}) | Title | ${status} | ${applies} |`;

const CORE_RECORD = (n: number, extra: string[] = []): string =>
  [
    '---',
    'status: accepted',
    'date: 2026-10-24',
    'decision-makers:',
    '  - maintainers',
    ...extra,
    'repos:',
    '  - rockcarver/frodo-cli',
    '  - rockcarver/frodo-lib',
    '---',
    '',
    `# Core record ${n}`,
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
  ].join('\n');

const CORE_INDEX = (rows: string[]): string =>
  [
    '# Decisions',
    '',
    'See [core 0001](core/0001-first-thing.md) for the rule.',
    '',
    '## Core decisions',
    '',
    '| Number | Title | Status | Applies to |',
    '| - | - | - | - |',
    ...rows,
    '',
  ].join('\n');

/** A decisions/ folder with core/ records and an index, as in this repository. */
function coreFixture(mutate: (files: Files) => void = () => {}): CoreOptions & {
  dir: string;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-decisions-'));
  const files: Files = {
    'core/0001-first-thing.md': CORE_RECORD(1),
    'core/0002-second-thing.md': CORE_RECORD(2, [
      'applies-to:',
      '  - src/ops/**',
      '  - package.json',
    ]),
    'README.md': CORE_INDEX([
      CORE_ROW(1, '0001-first-thing.md'),
      CORE_ROW(
        2,
        '0002-second-thing.md',
        'accepted',
        '`src/ops/**`, `package.json`'
      ),
    ]),
  };
  mutate(files);
  for (const [name, text] of Object.entries(files)) {
    if (text === null) continue;
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  return {
    dir: path.join(root, 'core'),
    indexFile: path.join(root, 'README.md'),
    repo: LIB,
  };
}
const checkCore = (mutate: (files: Files) => void, repo = LIB): string[] => {
  const { dir, indexFile } = coreFixture(mutate);
  return validateDecisionRecords({ dir, core: { indexFile, repo } });
};

describe('core records', () => {
  test('a valid core folder has no problems, with no README.md or template.md in it', () => {
    expect(checkCore(() => {})).toEqual([]);
  });
  test('a missing folder is a problem', () =>
    has(
      validateDecisionRecords({
        dir: '/nonexistent-decisions-dir',
        core: { indexFile: path.join(RECORDS_DIR, 'README.md'), repo: LIB },
      }),
      'does not exist'
    ));
  test("a call without the core options is refused, because decisions/ is the kit's", () =>
    has(
      validateDecisionRecords({ dir: RECORDS_DIR }),
      'checks core records only'
    ));
  test('file names must be NNNN-short-title.md', () =>
    has(
      checkCore((f: Files) => {
        f['core/0003_Bad Name.md'] = CORE_RECORD(3);
      }),
      'the name must be NNNN-short-title.md'
    ));
  test('front matter is required and strict', () => {
    const first = (mutate: (text: string) => string) => (f: Files) => {
      f['core/0001-first-thing.md'] = mutate(CORE_RECORD(1));
    };
    has(
      checkCore(first(() => 'no front matter\n')),
      'must start with a front matter block'
    );
    has(
      checkCore(first((t) => t.replace('status: accepted\n', ''))),
      'missing front matter key "status"'
    );
    has(
      checkCore(
        first((t) => t.replace('date: 2026-10-24', 'date: 2026-02-30'))
      ),
      'real YYYY-MM-DD date'
    );
    has(
      checkCore(first((t) => t.replace('status: accepted', 'status: maybe'))),
      'must be one of'
    );
    has(
      checkCore(
        first((t) =>
          t.replace('date: 2026-10-24\n', 'date: 2026-10-24\nowner: me\n')
        )
      ),
      'unknown front matter key'
    );
    has(
      checkCore(
        first((t) =>
          t.replace(
            'decision-makers:\n  - maintainers',
            'decision-makers: maintainers'
          )
        )
      ),
      'must be a list'
    );
    has(
      checkCore(
        first((t) =>
          t.replace('status: accepted', 'status: accepted\nstatus: proposed')
        )
      ),
      'duplicate key'
    );
    // Record Keeper's keys are not core keys: a core record has no seal and no supersedes.
    has(
      checkCore(
        first((t) =>
          t.replace(
            'date: 2026-10-24\n',
            'date: 2026-10-24\nseal: sha256-g1:0\n'
          )
        )
      ),
      'unknown front matter key "seal"'
    );
  });
  test('superseded records must name an existing, different record', () => {
    const sup = (to: string) => (f: Files) => {
      f['core/0001-first-thing.md'] = CORE_RECORD(1).replace(
        'status: accepted',
        `status: superseded by ${to}`
      );
      f['README.md'] = CORE_INDEX([
        CORE_ROW(1, '0001-first-thing.md', `superseded by ${to}`),
        CORE_ROW(
          2,
          '0002-second-thing.md',
          'accepted',
          '`src/ops/**`, `package.json`'
        ),
      ]);
    };
    expect(checkCore(sup('0002'))).toEqual([]);
    has(checkCore(sup('0009')), 'which does not exist');
    has(checkCore(sup('0001')), 'cannot supersede itself');
  });
  test('the body needs a title and the three sections in order, each with content', () => {
    const first = (mutate: (text: string) => string) => (f: Files) => {
      f['core/0001-first-thing.md'] = mutate(CORE_RECORD(1));
    };
    has(
      checkCore(first((t) => t.replace('# Core record 1', 'Core record 1'))),
      'must start with a "# Title"'
    );
    has(
      checkCore(first((t) => t.replace('## Decision', '## Outcome'))),
      'unknown section'
    );
    has(
      checkCore(first((t) => t.replace(/## Consequences[\s\S]*/, ''))),
      'missing section "## Consequences"'
    );
    expect(
      checkCore(
        first(
          (t) =>
            t +
            '\n## Known deviations\n\nSee 0002.\n\n## Alternatives considered\n\nNone.\n'
        )
      )
    ).toEqual([]);
    has(
      checkCore(
        first((t) =>
          t.replace(
            '## Consequences',
            '## Known deviations\n\nEarly.\n\n## Consequences'
          )
        )
      ),
      'out of order'
    );
    has(
      checkCore(
        first((t) =>
          t.replace(
            '## Decision\n\nWhat.\n\n## Consequences\n\nSo what.\n',
            '## Consequences\n\nSo what.\n\n## Decision\n\nWhat.\n'
          )
        )
      ),
      'out of order'
    );
    has(checkCore(first((t) => t.replace('What.', ''))), 'is empty');
  });
  test('records stay short and carry no credentials', () => {
    has(
      checkCore((f: Files) => {
        f['core/0001-first-thing.md'] = CORE_RECORD(1) + 'filler\n'.repeat(70);
      }),
      'longer than'
    );
    has(
      checkCore((f: Files) => {
        f['core/0001-first-thing.md'] =
          CORE_RECORD(1) + 'token ghp_' + 'a'.repeat(30) + '\n';
      }),
      'credential'
    );
  });
  test('the index file must exist', () => {
    const { dir, indexFile } = coreFixture();
    has(
      validateDecisionRecords({
        dir,
        core: { indexFile: indexFile + '.missing', repo: LIB },
      }),
      'is missing'
    );
  });
  test('numbers are contiguous from 0001 and never used twice', () => {
    has(
      checkCore((f: Files) => {
        f['core/0002-second-thing.md'] = null;
        f['core/0003-third-thing.md'] = CORE_RECORD(3);
        f['README.md'] = CORE_INDEX([
          CORE_ROW(1, '0001-first-thing.md'),
          CORE_ROW(3, '0003-third-thing.md'),
        ]);
      }),
      'contiguous'
    );
    has(
      checkCore((f: Files) => {
        f['core/0001-other-thing.md'] = CORE_RECORD(1);
      }),
      'used twice'
    );
  });
  test('a core record must name its repositories', () => {
    has(
      checkCore((f: Files) => {
        f['core/0001-first-thing.md'] = CORE_RECORD(1).replace(
          /repos:\n {2}- rockcarver\/frodo-cli\n {2}- rockcarver\/frodo-lib\n/,
          ''
        );
      }),
      'missing front matter key "repos"'
    );
    has(
      checkCore((f: Files) => {
        f['core/0001-first-thing.md'] = CORE_RECORD(1).replace(
          '- rockcarver/frodo-cli',
          '- someone-else/frodo-cli'
        );
      }),
      'must look like rockcarver/'
    );
    has(
      checkCore((f: Files) => {
        f['core/0001-first-thing.md'] = CORE_RECORD(1)
          .replace('  - rockcarver/frodo-cli\n', '')
          .replace('rockcarver/frodo-lib', 'rockcarver/homebrew-frodo-cli');
      }),
      'at least one repository that keeps core records'
    );
  });
  test('a record that does not bind this repository says so in its index row', () => {
    const tap = (f: Files, row: string) => {
      f['core/0002-second-thing.md'] = CORE_RECORD(2).replace(
        'rockcarver/frodo-lib',
        'rockcarver/homebrew-frodo-cli'
      );
      f['README.md'] = CORE_INDEX([CORE_ROW(1, '0001-first-thing.md'), row]);
    };
    expect(
      checkCore((f: Files) =>
        tap(
          f,
          CORE_ROW(2, '0002-second-thing.md').replace(
            'Title',
            'Title (binds the tap, not this repository)'
          )
        )
      )
    ).toEqual([]);
    has(
      checkCore((f: Files) => tap(f, CORE_ROW(2, '0002-second-thing.md'))),
      'must say "not this repository"'
    );
  });
  test('the index lists every core record with status and applies-to, and nothing else', () => {
    has(
      checkCore((f: Files) => {
        f['README.md'] = CORE_INDEX([CORE_ROW(1, '0001-first-thing.md')]);
      }),
      'no row linking core/0002-second-thing.md'
    );
    has(
      checkCore((f: Files) => {
        f['README.md'] = CORE_INDEX([
          CORE_ROW(1, '0001-first-thing.md', 'proposed'),
          CORE_ROW(
            2,
            '0002-second-thing.md',
            'accepted',
            '`src/ops/**`, `package.json`'
          ),
        ]);
      }),
      'does not show the status'
    );
    has(
      checkCore((f: Files) => {
        f['README.md'] = CORE_INDEX([
          CORE_ROW(1, '0001-first-thing.md'),
          CORE_ROW(2, '0002-second-thing.md', 'accepted', '`src/ops/**`'),
        ]);
      }),
      'does not show applies-to `package.json`'
    );
    has(
      checkCore((f: Files) => {
        f['README.md'] = CORE_INDEX([
          CORE_ROW(1, '0001-first-thing.md', 'accepted', '`src/**`'),
          CORE_ROW(
            2,
            '0002-second-thing.md',
            'accepted',
            '`src/ops/**`, `package.json`'
          ),
        ]);
      }),
      'must say "repository-wide"'
    );
    has(
      checkCore((f: Files) => {
        f['README.md'] = CORE_INDEX([
          CORE_ROW(1, '0001-first-thing.md'),
          CORE_ROW(
            2,
            '0002-second-thing.md',
            'accepted',
            '`src/ops/**`, `package.json`'
          ),
          CORE_ROW(3, '0003-ghost.md'),
        ]);
      }),
      'which does not exist'
    );
  });
  test('a sentence that links a record is not its index row', () => {
    has(
      checkCore((f: Files) => {
        f['README.md'] = [
          '# Decisions',
          '',
          'See [core 0001](core/0001-first-thing.md), [core 0002](core/0002-second-thing.md).',
          '',
        ].join('\n');
      }),
      'no row linking core/0001-first-thing.md'
    );
  });
  test('a relative link in a core record must point at a file of core/', () => {
    expect(
      checkCore((f: Files) => {
        f['core/0001-first-thing.md'] =
          CORE_RECORD(1) +
          '\nSee [two](0002-second-thing.md) and [web](https://example.org/x).\n';
      })
    ).toEqual([]);
    has(
      checkCore((f: Files) => {
        f['core/0001-first-thing.md'] =
          CORE_RECORD(1) + '\nSee [gone](0009-gone.md).\n';
      }),
      'does not point at a file'
    );
  });
  test('the core records of this repository are valid and indexed', () => {
    expect(
      validateDecisionRecords({
        dir: CORE_DIR,
        core: { indexFile: path.join(RECORDS_DIR, 'README.md'), repo: LIB },
      })
    ).toEqual([]);
  });
  test('core records are numbered from 0001 and 0018 is the one that created them', () => {
    const names = fs.readdirSync(CORE_DIR).filter((n) => n.endsWith('.md'));
    expect(names.length).toBeGreaterThanOrEqual(18);
    expect(names).toContain(
      '0018-core-decision-records-are-kept-in-each-repository.md'
    );
  });
});

describe('a Known deviations section is a status note (core 0018)', () => {
  const read = (...parts: string[]): string =>
    fs.readFileSync(path.resolve(process.cwd(), ...parts), 'utf8');
  const rule18 = read(
    'decisions/core/0018-core-decision-records-are-kept-in-each-repository.md'
  );
  const readme = read('decisions/README.md');

  test('core 0018 lets the pull request that fixes a deviation edit or remove it, without a new record', () => {
    expect(rule18).toMatch(/status note, not part of the decision/);
    expect(rule18).toMatch(
      /tracking issue and the commit it was written against/
    );
    expect(rule18).toMatch(
      /added, edited or removed, without a new record, in the pull request that fixes the deviation or opens its tracking issue/
    );
    expect(rule18).toMatch(/Nothing else in an accepted record changes\./);
    expect(rule18).toMatch(/The one exception is a Known deviations section/);
  });
  test('the README rule names the exception and links core 0018', () => {
    const line =
      readme
        .split('\n')
        .find((l) => l.startsWith('- An accepted record is not edited')) ?? '';
    expect(line).toMatch(
      /except for typos and for a `Known deviations` section/
    );
    expect(line).toMatch(
      /\]\(core\/0018-core-decision-records-are-kept-in-each-repository\.md\)/
    );
  });
  test('the README index row of core 0018 says so in its rule sentence', () => {
    const row =
      readme.split('\n').find((l) => /^\|\s*\[core 0018\]\(/.test(l)) ?? '';
    expect(row).toMatch(/Known deviations section is a status note/);
  });
  test('the record-a-core-decision skill states the exception, with a link to core 0018', () => {
    const skill = read('.claude/skills/record-a-core-decision/SKILL.md');
    expect(skill).toMatch(
      /Never edit an accepted core record, except its `## Known deviations` section/
    );
    expect(skill).toMatch(
      /may be added, edited or removed, without a new record, in the pull request that fixes the deviation or opens its tracking issue/
    );
    expect(skill).toMatch(
      /saying so in the description \(\[core 0018\]\(\.\.\/\.\.\/\.\.\/decisions\/core\/0018-core-decision-records-are-kept-in-each-repository\.md\)\)/
    );
  });
  test('the review skill does not call every edit of a record wrong', () => {
    const review = read('.claude/skills/review-a-copilot-pr/SKILL.md');
    expect(review).toMatch(
      /except for typos and for a Known deviations section/
    );
  });
});

describe('core records drift check', () => {
  const tmp = (files: Record<string, string>): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'core-drift-'));
    for (const [name, text] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), text);
    }
    return dir;
  };
  const quiet = () => {
    const out: string[] = [];
    return {
      io: {
        log: (m: string) => out.push(m),
        error: (m: string) => out.push(m),
      },
      out,
    };
  };

  test('the blob id is the one git computes', () => {
    expect(drift.blobSha('hello\n')).toBe(
      'ce013625030ba8dba906f756967f9e9ca394464a'
    );
  });
  test('each code repository names the other as its sibling', () => {
    expect(drift.siblingOf('rockcarver/frodo-lib')).toBe(
      'rockcarver/frodo-cli'
    );
    expect(drift.siblingOf('rockcarver/frodo-cli')).toBe(
      'rockcarver/frodo-lib'
    );
    expect(drift.siblingOf('rockcarver/frodo')).toBeUndefined();
    expect(drift.CORE_DIRS['rockcarver/frodo-lib']).toBe('decisions/core');
    expect(drift.CORE_DIRS['rockcarver/frodo-cli']).toBe('docs/decisions/core');
  });
  test('identical folders have no differences', () => {
    const same = { 'a.md': 'x', 'b.md': 'y' };
    expect(
      drift.compareFolders({
        local: drift.readFolder(tmp(same)),
        remote: drift.readFolder(tmp(same)),
        self: 'a',
        sibling: 'b',
      })
    ).toEqual([]);
  });
  test('a changed, a missing and an extra file are each a difference', () => {
    const problems: string[] = drift.compareFolders({
      local: drift.readFolder(tmp({ 'a.md': 'x', 'b.md': 'y' })),
      remote: drift.readFolder(tmp({ 'a.md': 'changed', 'c.md': 'z' })),
      self: 'lib',
      sibling: 'cli',
    });
    has(problems, 'a.md differs between lib and cli');
    has(problems, 'b.md is in lib but missing in cli');
    has(problems, 'c.md is in cli but missing in lib');
    expect(problems).toHaveLength(3);
  });
  test('only files count, not subfolders', () => {
    const dir = tmp({ 'a.md': 'x' });
    fs.mkdirSync(path.join(dir, 'sub'));
    expect(Object.keys(drift.readFolder(dir))).toEqual(['a.md']);
  });
  test('the sibling folder is read from the GitHub API with its blob ids', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const remote = await drift.readRemoteFolder({
      repo: 'rockcarver/frodo-cli',
      dir: 'docs/decisions/core',
      ref: 'main',
      token: 'secret-token',
      fetchImpl: async (
        url: string,
        init: { headers: Record<string, string> }
      ) => {
        calls.push({ url, headers: init.headers });
        return {
          ok: true,
          status: 200,
          json: async () => [
            { type: 'file', name: 'a.md', sha: 'aaa' },
            { type: 'dir', name: 'sub', sha: 'bbb' },
          ],
        };
      },
    });
    expect(remote).toEqual({ 'a.md': 'aaa' });
    expect(calls[0].url).toBe(
      'https://api.github.com/repos/rockcarver/frodo-cli/contents/docs/decisions/core?ref=main'
    );
    expect(calls[0].headers.authorization).toBe('Bearer secret-token');
  });
  test('an API error is reported, with a hint when the rate limit is used up', async () => {
    const failing = (status: number, remaining?: string) => async () => ({
      ok: false,
      status,
      headers: { get: () => remaining },
    });
    await expect(
      drift.readRemoteFolder({ repo: 'r/x', dir: 'd', fetchImpl: failing(404) })
    ).rejects.toThrow('answered 404');
    await expect(
      drift.readRemoteFolder({
        repo: 'r/x',
        dir: 'd',
        fetchImpl: failing(403, '0'),
      })
    ).rejects.toThrow('set GITHUB_TOKEN');
  });
  test('run exits 0 for identical folders, 1 for drift and 2 when it cannot run', async () => {
    const mine = tmp({ 'a.md': 'x' });
    const same = tmp({ 'a.md': 'x' });
    const other = tmp({ 'a.md': 'y' });
    const base = ['--self', 'rockcarver/frodo-lib', '--local', mine];
    let q = quiet();
    expect(await drift.run([...base, '--sibling-dir', same], {}, q.io)).toBe(0);
    q = quiet();
    expect(await drift.run([...base, '--sibling-dir', other], {}, q.io)).toBe(
      1
    );
    has(q.out, '::error::a.md differs');
    q = quiet();
    expect(await drift.run(['--self', 'rockcarver/frodo'], {}, q.io)).toBe(2);
    has(q.out, 'must be one of');
    q = quiet();
    expect(
      await drift.run(
        [
          '--self',
          'rockcarver/frodo-lib',
          '--local',
          '/nonexistent-core',
          '--sibling-dir',
          same,
        ],
        {},
        q.io
      )
    ).toBe(2);
    has(q.out, '/nonexistent-core does not exist');
    q = quiet();
    expect(
      await drift.run([...base, '--sibling-dir', '/nonexistent-core'], {}, q.io)
    ).toBe(2);
    has(q.out, 'could not read the core records of rockcarver/frodo-cli');
  });
  test('without options it uses GITHUB_REPOSITORY and the GitHub API, and never the network in tests', async () => {
    const mine = drift.readFolder(CORE_DIR);
    const requested: string[] = [];
    const answer = (entries: Record<string, string>) => async (url: string) => {
      requested.push(url);
      return {
        ok: true,
        status: 200,
        json: async () =>
          Object.entries(entries).map(([name, sha]) => ({
            type: 'file',
            name,
            sha,
          })),
      };
    };
    const env = { GITHUB_REPOSITORY: LIB, GITHUB_TOKEN: 'x' };
    let q = quiet();
    expect(await drift.run([], env, q.io, answer(mine))).toBe(0);
    expect(requested).toEqual([
      'https://api.github.com/repos/rockcarver/frodo-cli/contents/docs/decisions/core?ref=main',
    ]);
    q = quiet();
    expect(
      await drift.run([], env, q.io, answer({ ...mine, '0099-extra.md': 'x' }))
    ).toBe(1);
    has(q.out, '0099-extra.md is in rockcarver/frodo-cli but missing in');
    expect(await drift.run([], {}, quiet().io, answer(mine))).toBe(2);
  });

  describe('the weekly workflow', () => {
    const workflow = fs.readFileSync(DRIFT_WORKFLOW, 'utf8');
    test('runs weekly and by hand, read-only, and opens no issue', () => {
      expect(workflow).toMatch(/^on:\n {2}schedule:\n {4}- cron: /m);
      expect(workflow).toContain('workflow_dispatch:');
      expect(workflow).toMatch(/^permissions:\n {2}contents: read\n/m);
      expect(workflow).not.toMatch(/(issues|pull-requests|contents): write/);
      expect(workflow).not.toMatch(/gh issue|createIssue|issues\.create/);
    });
    test('pins every action to a commit', () => {
      const uses = [...workflow.matchAll(/^\s*(?:- )?uses:\s*(\S+)/gm)].map(
        (m) => m[1]
      );
      expect(uses.length).toBeGreaterThan(0);
      for (const u of uses) expect(u).toMatch(/@[0-9a-f]{40}$/);
    });
    test('runs the drift script with the workflow token', () => {
      expect(workflow).toContain(
        'run: node .github/scripts/check-core-records-drift.mjs'
      );
      expect(workflow).toContain('GITHUB_TOKEN: ${{ github.token }}');
    });
  });
});
