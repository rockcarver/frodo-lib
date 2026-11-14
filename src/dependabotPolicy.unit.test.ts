import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/*
 * Pins the shape of .github/dependabot.yml that core record 0023 relies on: the Dependabot group `tooling` is a
 * named list of packages that do not end up in what we ship, and nothing that shipped code imports, nor the bundler
 * that writes it (tsdown), may match one of its patterns (such a package must arrive as a pull request of its own,
 * which a person merges). Also pins the
 * cooldown. dependabot.yml is read with a few lines of text parsing because the repository has no YAML parser among
 * its dependencies; the parts read are the ones that are written in a fixed layout.
 */

const ROOT = process.cwd();
const DEPENDABOT = path.join(ROOT, '.github/dependabot.yml');
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const SCRIPT = path.join(ROOT, 'scripts/dependabot-auto-merge.mjs');
const SOURCEMAP = path.join(ROOT, 'dist/index.js.map');

const text = fs.readFileSync(DEPENDABOT, 'utf8');
const devDependencies = Object.keys(
  JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8')).devDependencies
);

/** The lines of the block that starts with `key:` at `indent` spaces: the lines after it that are indented deeper. */
function block(lines: string[], indent: number, key: string, from = 0) {
  const start = lines.findIndex(
    (l, i) => i >= from && l === `${' '.repeat(indent)}${key}:`
  );
  if (start === -1) return undefined;
  const body: string[] = [];
  for (const l of lines.slice(start + 1)) {
    if (l.trim() === '' || l.trim().startsWith('#')) {
      body.push(l);
      continue;
    }
    if (l.length - l.trimStart().length <= indent) break;
    body.push(l);
  }
  return { start, body };
}

const items = (body: string[]) =>
  body
    .map((l) => /^\s*-\s+"?([^"#]+?)"?\s*$/.exec(l)?.[1])
    .filter((x): x is string => !!x);

const lines = text.split('\n');
const updates = lines
  .map((l, i) => (l.startsWith('  - package-ecosystem:') ? i : -1))
  .filter((i) => i >= 0);
const entry = (ecosystem: string) => {
  const start = updates.find((i) => lines[i].includes(`"${ecosystem}"`));
  const next = updates.find((i) => i > (start ?? 0)) ?? lines.length;
  return lines.slice(start, next);
};
const npm = entry('npm');
const actions = entry('github-actions');

const tooling = block(npm, 6, 'tooling');
const toolingPatterns = items(
  block(tooling?.body ?? [], 8, 'patterns')?.body ?? []
);
const toolingUpdateTypes = items(
  block(tooling?.body ?? [], 8, 'update-types')?.body ?? []
);

/** The packages that write what we ship: they are treated like bundled packages (core record 0023). */
const BUNDLERS = ['tsdown'];

const glob = (pattern: string) =>
  new RegExp(
    `^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`
  );
const matchesTooling = (name: string) =>
  toolingPatterns.some((p) => glob(p).test(name));

/** The packages that shipped code imports: every bare import of the files reachable from src/index.ts. */
function bundledBySource(): Set<string> {
  const seen = new Set<string>();
  const bare = new Set<string>();
  const stack = [path.join(ROOT, 'src/index.ts')];
  const resolveRelative = (from: string, spec: string) => {
    const base = path.resolve(path.dirname(from), spec);
    return [`${base}.ts`, path.join(base, 'index.ts')].find((c) =>
      fs.existsSync(c)
    );
  };
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const code = fs.readFileSync(file, 'utf8');
    for (const m of code.matchAll(
      /(?:from|import|require\()\s*['"]([^'"]+)['"]/g
    )) {
      const spec = m[1];
      if (spec.startsWith('.')) {
        const resolved = resolveRelative(file, spec);
        if (resolved) stack.push(resolved);
      } else if (!spec.startsWith('node:')) {
        bare.add(
          spec.startsWith('@')
            ? spec.split('/').slice(0, 2).join('/')
            : spec.split('/')[0]
        );
      }
    }
  }
  return new Set([...bare].filter((n) => devDependencies.includes(n)));
}

let isManualName: (name: string) => boolean;
let TOOLING_GROUP: string;
beforeAll(async () => {
  const mod: any = await import(pathToFileURL(SCRIPT).href);
  isManualName = mod.isManualName;
  TOOLING_GROUP = mod.TOOLING_GROUP;
});

describe('the Dependabot group `tooling`', () => {
  test('is read from dependabot.yml, minor and patch updates only', () => {
    expect(tooling).toBeDefined();
    expect(toolingPatterns.length).toBeGreaterThan(5);
    expect(toolingUpdateTypes.sort()).toEqual(['minor', 'patch']);
  });
  test('has the name that the auto-merge script arms', () => {
    expect(TOOLING_GROUP).toBe('tooling');
    expect(lines.some((l) => l === `      ${TOOLING_GROUP}:`)).toBe(true);
  });
  test('matches no package that shipped code imports', () => {
    const bundled = [...bundledBySource()];
    expect(bundled.length).toBeGreaterThan(10);
    expect(bundled.filter(matchesTooling)).toEqual([]);
  });
  (fs.existsSync(SOURCEMAP) ? test : test.skip)(
    'matches no package that the build bundled (the sourcemap of dist/ is the authority)',
    () => {
      const map = JSON.parse(fs.readFileSync(SOURCEMAP, 'utf8'));
      const names = new Set<string>();
      for (const source of map.sources as string[]) {
        for (const m of source.matchAll(
          /node_modules\/((?:@[^/]+\/)?[^/]+)/g
        )) {
          names.add(m[1]);
        }
      }
      const bundled = devDependencies.filter((d) => names.has(d));
      expect(bundled.length).toBeGreaterThan(10);
      expect(bundled.filter(matchesTooling)).toEqual([]);
    }
  );
  test('matches no bundler: tsdown writes what we ship, so a person merges its pull request', () => {
    // the name must exist, or this test would pass for a package that was renamed
    expect(devDependencies).toContain('tsdown');
    expect(BUNDLERS.filter(matchesTooling)).toEqual([]);
  });
  test('matches no package of the manual set (Prettier, TypeScript, ESLint and what belongs to them)', () => {
    expect(devDependencies.filter(isManualName).filter(matchesTooling)).toEqual(
      []
    );
  });
  test('has no pattern that matches nothing in devDependencies (a dead pattern)', () => {
    const dead = toolingPatterns.filter(
      (p) => !devDependencies.some((d) => glob(p).test(d))
    );
    expect(dead).toEqual([]);
  });
});

describe('the cooldown', () => {
  test('is 7 days for npm and for GitHub Actions', () => {
    for (const e of [npm, actions]) {
      const cooldown = block(e, 4, 'cooldown');
      expect(cooldown).toBeDefined();
      expect(cooldown?.body.some((l) => l.trim() === 'default-days: 7')).toBe(
        true
      );
    }
  });
  test('excludes our own actions so that they arrive at once', () => {
    const cooldown = block(actions, 4, 'cooldown');
    const exclude = items(
      block(cooldown?.body ?? [], 6, 'exclude')?.body ?? []
    );
    expect(exclude).toEqual(['gearsnlevers/*']);
  });
  test('does not exclude any npm package here (the library has no pin of its own library)', () => {
    const cooldown = block(npm, 4, 'cooldown');
    expect(block(cooldown?.body ?? [], 6, 'exclude')).toBeUndefined();
  });
});
