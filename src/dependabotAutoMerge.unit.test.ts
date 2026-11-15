import path from 'node:path';
import { pathToFileURL } from 'node:url';

/*
 * Pins the policy of core record 0023 as scripts/dependabot-auto-merge.mjs implements it: which Dependabot pull
 * requests are armed for auto-merge. The decision is made by pure functions (no GitHub, no registry); the network
 * parts are exercised through a fake `fetch`. Names and versions in the fixtures are real names of this repository's
 * dependencies, the dates are made up.
 */

type Meta = {
  name: string;
  version?: string;
  type?: string;
  updateType?: string;
  group?: string;
};
type Change = { key?: string; name: string; version: string };

const SCRIPT = path.resolve(process.cwd(), 'scripts/dependabot-auto-merge.mjs');

let mod: any;
beforeAll(async () => {
  mod = await import(pathToFileURL(SCRIPT).href);
});

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-14T12:00:00Z');
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

const patch = (name: string): Meta => ({
  name,
  updateType: 'version-update:semver-patch',
  group: 'tooling',
});
const minor = (name: string): Meta => ({
  name,
  updateType: 'version-update:semver-minor',
  group: 'tooling',
});
const major = (name: string): Meta => ({
  name,
  updateType: 'version-update:semver-major',
  group: 'tooling',
});

function verdict(over: {
  metadata?: Meta[] | null;
  commitAuthors?: string[];
  isActions?: boolean;
  changes?: Change[] | null;
  times?: Record<string, string>;
}) {
  const changes: Change[] | null =
    'changes' in over ? (over.changes as Change[] | null) : [];
  return mod.decide({
    metadata: 'metadata' in over ? over.metadata : [patch('axios')],
    commitAuthors: over.commitAuthors ?? ['dependabot[bot]'],
    isActions: over.isActions ?? false,
    changes:
      changes === undefined
        ? undefined
        : changes === null
          ? null
          : changes.length
            ? changes
            : [{ name: 'axios', version: '1.21.1' }],
    times: new Map(Object.entries(over.times ?? { 'axios@1.21.1': ago(10) })),
    now: NOW,
  });
}

describe('isManualName: the manual set (Prettier, TypeScript, ESLint and what belongs to them)', () => {
  test.each([
    'prettier',
    'typescript',
    'eslint',
    '@eslint/js',
    'typescript-eslint',
    '@typescript-eslint/parser',
    '@typescript-eslint/eslint-plugin',
    'eslint-plugin-import-x',
    'eslint-config-prettier',
    '@ianvs/prettier-plugin-sort-imports',
    '@types/eslint',
  ])('%s stays manual', (name) => {
    expect(mod.isManualName(name)).toBe(true);
  });
  test.each([
    'axios',
    'jose',
    'rimraf',
    'jest',
    'ts-jest',
    '@jest/globals',
    '@types/node',
    'typedoc',
    'typedoc-plugin-missing-exports',
    'uuid',
    'proxy-agent',
    'prettierx',
    'my-typescripty',
  ])('%s may be armed (by name)', (name) => {
    expect(mod.isManualName(name)).toBe(false);
  });
});

describe('parseDependabotMetadata', () => {
  const group = [
    'build(deps-dev): bump the dev-minor-patch group across 1 directory with 2 updates',
    '',
    'Bumps the dev-minor-patch group with 2 updates in the / directory.',
    '',
    '---',
    'updated-dependencies:',
    '- dependency-name: axios',
    '  dependency-version: 1.21.1',
    '  dependency-type: direct:development',
    '  update-type: version-update:semver-patch',
    '  dependency-group: dev-minor-patch',
    '- dependency-name: "@types/node"',
    '  dependency-version: 26.6.4',
    '  dependency-type: direct:development',
    '  update-type: version-update:semver-minor',
    '  dependency-group: dev-minor-patch',
    '...',
    '',
    'Signed-off-by: dependabot[bot] <support@github.com>',
  ].join('\n');

  test('reads every updated dependency, quoted scoped names included', () => {
    expect(mod.parseDependabotMetadata(group)).toEqual([
      {
        name: 'axios',
        version: '1.21.1',
        type: 'direct:development',
        updateType: 'version-update:semver-patch',
        group: 'dev-minor-patch',
      },
      {
        name: '@types/node',
        version: '26.6.4',
        type: 'direct:development',
        updateType: 'version-update:semver-minor',
        group: 'dev-minor-patch',
      },
    ]);
  });
  test('a single update has no group', () => {
    const one = [
      'bump prettier',
      '',
      '---',
      'updated-dependencies:',
      '- dependency-name: prettier',
      '  dependency-version: 3.10.0',
      '  dependency-type: direct:development',
      '  update-type: version-update:semver-minor',
      '...',
    ].join('\n');
    expect(mod.parseDependabotMetadata(one)).toEqual([
      {
        name: 'prettier',
        version: '3.10.0',
        type: 'direct:development',
        updateType: 'version-update:semver-minor',
      },
    ]);
  });
  test.each([
    ['a message without the block', 'fix: a human commit'],
    ['an empty message', ''],
    ['a block without a dependency', 'x\n---\nupdated-dependencies:\n...\n'],
  ])('%s gives null', (_label, message) => {
    expect(mod.parseDependabotMetadata(message)).toBeNull();
  });
  test('text right after the closing marker is not read', () => {
    const upToMarker = group.slice(0, group.indexOf('...') + 3);
    const msg = `${upToMarker}\n- dependency-name: sneaky\n  update-type: version-update:semver-patch`;
    expect(mod.parseDependabotMetadata(msg).map((d: Meta) => d.name)).toEqual([
      'axios',
      '@types/node',
    ]);
  });
});

describe('the update type of an indirect dependency is read from the title', () => {
  test.each([
    [
      'chore(deps): bump follow-redirects from 1.16.1 to 1.16.2',
      'version-update:semver-patch',
    ],
    [
      'build(deps): bump qs from 6.16.2 to 6.17.0',
      'version-update:semver-minor',
    ],
    [
      'build(deps): bump uuid from 13.1.0 to 14.0.2',
      'version-update:semver-major',
    ],
    [
      'chore(deps): bump x from 1.0.0-beta.1 to 1.0.0-beta.2',
      'version-update:semver-prerelease',
    ],
    [
      'chore(deps): bump x from v2.3.4 to v2.3.5',
      'version-update:semver-patch',
    ],
    ['chore(deps): bump x from 1.2.3 to 1.2.4.', 'version-update:semver-patch'],
  ])('%s', (title, expected) => {
    expect(mod.updateTypeFromTitle(title)).toBe(expected);
  });
  test.each([
    [
      'a title without versions',
      'build(deps-dev): bump the dev-minor-patch group with 3 updates',
    ],
    [
      'a version that is not semantic',
      'chore(deps): bump x from 2026.1 to 2026.2',
    ],
    ['no title', ''],
  ])('%s gives undefined', (_label, title) => {
    expect(mod.updateTypeFromTitle(title)).toBeUndefined();
  });
  test('withUpdateTypes fills in a single dependency and nothing else', () => {
    const title = 'chore(deps): bump follow-redirects from 1.16.1 to 1.16.2';
    expect(mod.withUpdateTypes([{ name: 'follow-redirects' }], title)).toEqual([
      { name: 'follow-redirects', updateType: 'version-update:semver-patch' },
    ]);
    // a stated type is kept, even if the title says something else
    expect(
      mod.withUpdateTypes(
        [{ name: 'x', updateType: 'version-update:semver-major' }],
        title
      )
    ).toEqual([{ name: 'x', updateType: 'version-update:semver-major' }]);
    // several dependencies: not guessed
    const two = [{ name: 'a' }, { name: 'b' }];
    expect(mod.withUpdateTypes(two, title)).toEqual(two);
    expect(mod.withUpdateTypes(null, title)).toBeNull();
  });
});

describe('the lockfile', () => {
  test('lockEntryName is the part after the last node_modules/', () => {
    expect(mod.lockEntryName('node_modules/axios')).toBe('axios');
    expect(mod.lockEntryName('node_modules/@types/node')).toBe('@types/node');
    expect(mod.lockEntryName('node_modules/rimraf/node_modules/glob')).toBe(
      'glob'
    );
    expect(mod.lockEntryName('node_modules/a/node_modules/@scope/b')).toBe(
      '@scope/b'
    );
    expect(mod.lockEntryName('')).toBe('');
    expect(mod.lockEntryName('packages/workspace')).toBe('');
  });

  const lock = (entries: Record<string, any>) => ({ packages: entries });

  test('lockChanges lists new and changed entries of the head, direct and transitive', () => {
    const base = lock({
      '': { name: 'x' },
      'node_modules/axios': { version: '1.21.0' },
      'node_modules/jose': { version: '6.2.14' },
      'node_modules/rimraf': { version: '6.1.3' },
      'node_modules/gone': { version: '1.0.0' },
    });
    const head = lock({
      '': { name: 'x' },
      'node_modules/axios': { version: '1.21.1' },
      'node_modules/jose': { version: '6.2.14' },
      'node_modules/rimraf': { version: '6.1.4' },
      'node_modules/rimraf/node_modules/glob': { version: '14.0.5' },
      'node_modules/@scope/new': { version: '2.0.0' },
    });
    expect(mod.lockChanges(base, head)).toEqual([
      { key: 'node_modules/axios', name: 'axios', version: '1.21.1' },
      { key: 'node_modules/rimraf', name: 'rimraf', version: '6.1.4' },
      {
        key: 'node_modules/rimraf/node_modules/glob',
        name: 'glob',
        version: '14.0.5',
      },
      { key: 'node_modules/@scope/new', name: '@scope/new', version: '2.0.0' },
    ]);
  });
  test('removed entries, links, entries without a version and an identical lock give no change', () => {
    const base = lock({ 'node_modules/a': { version: '1.0.0' } });
    expect(mod.lockChanges(base, base)).toEqual([]);
    expect(
      mod.lockChanges(
        lock({}),
        lock({
          'node_modules/linked': { link: true, version: '1.0.0' },
          'node_modules/noversion': {},
        })
      )
    ).toEqual([]);
    expect(mod.lockChanges(undefined, undefined)).toEqual([]);
  });
});

describe('the registry', () => {
  test('registryUrl encodes the slash of a scoped name', () => {
    expect(mod.registryUrl('axios')).toBe('https://registry.npmjs.org/axios');
    expect(mod.registryUrl('@types/node')).toBe(
      'https://registry.npmjs.org/@types%2fnode'
    );
  });

  const doc = (times: Record<string, string>) => ({
    ok: true,
    status: 200,
    json: async () => ({ time: times }),
  });

  test('fetchPublishTimes asks once per package and keeps the publish time of each version', async () => {
    const asked: string[] = [];
    const fetchImpl = async (url: string) => {
      asked.push(url);
      return doc({ '1.21.1': ago(10), '1.21.0': ago(40) });
    };
    const times = await mod.fetchPublishTimes(
      [
        { name: 'axios', version: '1.21.1' },
        { name: 'axios', version: '1.21.0' },
      ],
      fetchImpl
    );
    expect(asked).toEqual(['https://registry.npmjs.org/axios']);
    expect(times.get('axios@1.21.1')).toBe(ago(10));
    expect(times.get('axios@1.21.0')).toBe(ago(40));
  });
  test('a failing registry, a throwing fetch and a missing version leave the version unknown', async () => {
    let calls = 0;
    const fetchImpl = async (url: string) => {
      calls++;
      if (url.endsWith('/down'))
        return { ok: false, status: 503, json: async () => ({}) };
      if (url.endsWith('/boom')) throw new Error('network');
      return doc({ '1.0.0': ago(10) });
    };
    const times = await mod.fetchPublishTimes(
      [
        { name: 'down', version: '1.0.0' },
        { name: 'boom', version: '1.0.0' },
        { name: 'there', version: '1.0.0' },
        { name: 'there', version: '9.9.9' },
      ],
      fetchImpl
    );
    expect(times.has('down@1.0.0')).toBe(false);
    expect(times.has('boom@1.0.0')).toBe(false);
    expect(times.has('there@9.9.9')).toBe(false);
    expect(times.get('there@1.0.0')).toBe(ago(10));
    expect(calls).toBe(3 + 3 + 1); // a failing package is tried three times, then given up
  });
});

describe('tooYoung: the age test', () => {
  const changes = [{ name: 'a', version: '1.0.0' }];
  test.each([
    ['older than 7 days', 7.5, false],
    ['exactly 7 days', 7, false],
    ['just under 7 days', 6.99, true],
    ['one day', 1, true],
  ])('%s', (_label, days, young) => {
    const failing = mod.tooYoung(
      changes,
      new Map([['a@1.0.0', ago(days)]]),
      NOW
    );
    expect(failing.length === 1).toBe(young);
  });
  test('an unknown or unreadable publish time fails, with no age', () => {
    expect(mod.tooYoung(changes, new Map(), NOW)).toEqual([
      { name: 'a', version: '1.0.0', ageDays: null },
    ]);
    expect(
      mod.tooYoung(changes, new Map([['a@1.0.0', 'not a date']]), NOW)
    ).toEqual([{ name: 'a', version: '1.0.0', ageDays: null }]);
  });
  test('the same version listed twice is reported once, and the age is shown in days', () => {
    const failing = mod.tooYoung(
      [
        { name: 'a', version: '1.0.0' },
        { name: 'a', version: '1.0.0' },
      ],
      new Map([['a@1.0.0', ago(3.2)]]),
      NOW
    );
    expect(failing).toEqual([{ name: 'a', version: '1.0.0', ageDays: 3.2 }]);
  });
});

describe('decide: a Dependabot pull request is armed only under the policy', () => {
  test('an old patch update of an ordinary package is armed', () => {
    expect(verdict({})).toMatchObject({ arm: true, retryLater: false });
  });
  test('a minor update is armed too', () => {
    expect(verdict({ metadata: [minor('jose')] }).arm).toBe(true);
  });
  test('a group of ordinary packages is armed when every version is old enough', () => {
    const v = verdict({
      metadata: [patch('axios'), minor('jose'), patch('rimraf')],
      changes: [
        { name: 'axios', version: '1.21.1' },
        { name: 'jose', version: '6.2.17' },
        { name: 'glob', version: '14.0.5' },
      ],
      times: {
        'axios@1.21.1': ago(8),
        'jose@6.2.17': ago(9),
        'glob@14.0.5': ago(7),
      },
    });
    expect(v).toMatchObject({ arm: true });
  });
  test('a young transitive version holds a group back although every direct update is old, and the next look may pass', () => {
    const v = verdict({
      metadata: [patch('rimraf')],
      changes: [
        { name: 'rimraf', version: '6.1.4' },
        { name: 'glob', version: '14.0.5' },
      ],
      times: { 'rimraf@6.1.4': ago(11), 'glob@14.0.5': ago(3.2) },
    });
    expect(v.arm).toBe(false);
    expect(v.retryLater).toBe(true);
    expect(v.reasons).toEqual(['glob@14.0.5: 3.2 days old, less than 7']);
  });
  test('an unknown publish time holds it back (the registry could not be read)', () => {
    const v = verdict({ times: {} });
    expect(v).toMatchObject({ arm: false, retryLater: true });
    expect(v.reasons[0]).toMatch(/publish time unknown/);
  });
  test('a major update is never armed, and no later look changes that', () => {
    const v = verdict({ metadata: [major('axios')] });
    expect(v).toMatchObject({ arm: false, retryLater: false });
    expect(v.reasons[0]).toMatch(/not a patch or minor update/);
  });
  test.each([
    'prettier',
    'typescript-eslint',
    'eslint-plugin-import-x',
    '@eslint/js',
  ])('%s is never armed, whatever its age', (name) => {
    const v = verdict({ metadata: [patch(name)] });
    expect(v).toMatchObject({ arm: false, retryLater: false });
    expect(v.reasons[0]).toMatch(/manual set/);
  });
  test('one manual package keeps a whole group manual', () => {
    expect(
      verdict({ metadata: [patch('axios'), minor('eslint-plugin-import-x')] })
        .arm
    ).toBe(false);
  });
  test('no metadata, no arming', () => {
    const v = verdict({ metadata: null });
    expect(v.arm).toBe(false);
    expect(v.reasons[0]).toMatch(/no Dependabot metadata/);
  });
  test.each([
    ['a commit by a person', ['dependabot[bot]', 'someone']],
    ['a commit without a known author', ['dependabot[bot]', '']],
    ['no commits found', []],
  ])('%s keeps it manual', (_label, authors) => {
    const v = verdict({ commitAuthors: authors });
    expect(v.arm).toBe(false);
    expect(v.reasons[0]).toMatch(/commits not made by Dependabot/);
  });
  test('an npm pull request without a lockfile change is not armed', () => {
    const v = verdict({ changes: null });
    expect(v.arm).toBe(false);
    expect(v.reasons[0]).toMatch(/no change of package-lock.json/);
  });
  test('a bundled package, in a pull request of its own, is never armed: a person merges it', () => {
    const v = verdict({
      metadata: [{ ...patch('axios'), group: undefined }],
    });
    expect(v).toMatchObject({ arm: false, retryLater: false });
    expect(v.reasons[0]).toMatch(/not in the tooling group/);
  });
  test('a GitHub Action is never armed either (no group, no lockfile)', () => {
    const v = verdict({
      metadata: [{ ...minor('actions/checkout'), group: undefined }],
      changes: null,
    });
    expect(v).toMatchObject({ arm: false, retryLater: false });
    expect(v.reasons[0]).toMatch(/not in the tooling group/);
  });
  test('another Dependabot group is not the tooling group', () => {
    expect(
      verdict({ metadata: [{ ...patch('axios'), group: 'dev-minor-patch' }] })
        .arm
    ).toBe(false);
  });
  test('one package outside the group keeps a whole group manual', () => {
    expect(
      verdict({
        metadata: [patch('rimraf'), { ...patch('axios'), group: undefined }],
      }).arm
    ).toBe(false);
  });
  test.each([
    ['patch', patch('actions/checkout')],
    ['minor', minor('actions/checkout')],
    ['major', major('actions/checkout')],
  ])(
    'a GitHub Actions %s update is never armed: a person merges it',
    (_label, dep) => {
      const v = verdict({ metadata: [dep], isActions: true, changes: null });
      expect(v.arm).toBe(false);
      expect(v.retryLater).toBe(false);
      expect(v.reasons).toContain('GitHub Actions update: a person merges it');
    }
  );
  test('a GitHub Actions update is not armed even when everything else would pass', () => {
    const v = verdict({
      metadata: [patch('actions/setup-node')],
      isActions: true,
      changes: [{ name: 'axios', version: '1.21.1' }],
      times: { 'axios@1.21.1': ago(30) },
    });
    expect(v.arm).toBe(false);
    expect(v.retryLater).toBe(false);
  });
  test('reasons of a permanent refusal win over the age: it is not retried', () => {
    const v = verdict({
      metadata: [major('axios')],
      times: {},
    });
    expect(v.retryLater).toBe(false);
  });
});

describe('permanentRefusals: what no later look can change', () => {
  const ok = {
    metadata: [patch('rimraf')],
    commitAuthors: ['dependabot[bot]'],
  };
  test('a tooling patch update by Dependabot has none', () => {
    expect(mod.permanentRefusals(ok)).toEqual([]);
  });
  test('every reason is listed, not only the first', () => {
    const reasons = mod.permanentRefusals({
      metadata: [
        {
          name: 'eslint-plugin-import-x',
          updateType: 'version-update:semver-major',
        },
      ],
      commitAuthors: ['dependabot[bot]', 'someone'],
    });
    expect(reasons).toHaveLength(4);
  });
  test('the name of the tooling group is the one of dependabot.yml', () => {
    expect(mod.TOOLING_GROUP).toBe('tooling');
  });
});
