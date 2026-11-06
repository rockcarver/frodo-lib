/**
 * A process of its own that uses the token cache, for
 * `src/ops/TokenCacheOps.concurrency.test.ts`. Started with `node -r
 * test/support/register-ts.cjs`; takes one JSON argument and prints one JSON
 * line with what it did.
 *
 *  - `write`: saves `count` entries of its own (one per user name) and then
 *    `count` tokens of the entry that every writer shares, each with a later
 *    expiry than the one before.
 *  - `read`: reads every entry file in the cache directory until told to stop
 *    and counts the files that do not parse.
 */
import fs from 'fs';
import path from 'path';
import { getTokenCacheDir, saveToken } from '../../src/ops/TokenCacheOps';
import StateImpl from '../../src/shared/State';

type Args = {
  mode: 'write' | 'read';
  cachePath: string;
  masterKeyPath: string;
  host: string;
  id: number;
  count: number;
  baseExpires: number;
  stopFile?: string;
};

function stateFor(args: Args, username: string) {
  const state = StateImpl({ host: args.host });
  state.setTokenCachePath(args.cachePath);
  state.setMasterKeyPath(args.masterKeyPath);
  state.setUsername(username);
  state.setPassword('password');
  return state;
}

async function write(args: Args) {
  let saved = 0;
  for (let i = 0; i < args.count; i++) {
    const own = await saveToken({
      tokenType: 'userSession',
      token: {
        tokenId: `own-${args.id}-${i}`,
        successUrl: '',
        realm: '/',
        expires: args.baseExpires + i,
      } as any,
      subject: `own-${args.id}-${i}`,
      state: stateFor(args, `own-${args.id}-${i}`),
    });
    const shared = await saveToken({
      tokenType: 'userSession',
      token: {
        tokenId: `shared-${args.id}-${i}`,
        successUrl: '',
        realm: '/',
        // every writer's i-th token expires at a different time, so which one
        // ends up in the entry is decided by the expiry alone
        expires: args.baseExpires + 1000 + i * 100 + args.id,
      } as any,
      subject: 'shared',
      state: stateFor(args, 'shared'),
    });
    if (own) saved++;
    if (shared) saved++;
  }
  return { saved };
}

async function read(args: Args) {
  const directory = getTokenCacheDir({ state: stateFor(args, 'reader') });
  let files = 0;
  let unparsable = 0;
  while (!fs.existsSync(args.stopFile as string)) {
    let names: string[] = [];
    try {
      names = fs.readdirSync(directory);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // not created yet
    }
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      try {
        JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
        files++;
      } catch (error) {
        // a file removed between the listing and the read is not a failure
        if (error.code !== 'ENOENT') unparsable++;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  return { files, unparsable };
}

(async () => {
  const args: Args = JSON.parse(process.argv[2]);
  const result = args.mode === 'write' ? await write(args) : await read(args);
  process.stdout.write(`${JSON.stringify({ id: args.id, ...result })}\n`);
})().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
