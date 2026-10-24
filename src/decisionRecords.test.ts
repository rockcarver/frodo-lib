import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/*
 * Checks the decision records in decisions/ and the core records in
 * decisions/core/ with scripts/validate-decision-records.mjs (the same
 * dependency-free script the other Frodo repositories run in CI), pins what
 * that script enforces with fixtures, and pins the weekly drift check of the
 * core records (.github/scripts/check-core-records-drift.mjs and its workflow,
 * core 0018). See decisions/README.md.
 */

type Files = Record<string, string | null>;
type CoreOptions = { indexFile: string; repo: string };
type Validate = (options: {
  dir: string;
  requireRepos?: boolean;
  core?: CoreOptions;
}) => string[];

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

let validateDecisionRecords: Validate;
let drift: any;

beforeAll(async () => {
  const mod = await import(pathToFileURL(SCRIPT).href);
  validateDecisionRecords = mod.validateDecisionRecords as Validate;
  drift = await import(pathToFileURL(DRIFT_SCRIPT).href);
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
