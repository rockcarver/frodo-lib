/**
 * Run tests
 *
 *        npm run test:only ConnectionProfileOps.browserLogin
 *
 * Regression coverage for browser-login connection profiles: a real,
 * isolated file I/O round trip (save from one State instance, load into a
 * fresh one — simulating a brand-new CLI process), confirming
 * saveConnectionProfile()/loadConnectionProfileByHost() persist and restore
 * authMode + browserLoginClientId/Scope/RedirectPort correctly, and never
 * persist username/password for such a profile. Parameterized across all
 * three deployment types, since none of ConnectionProfileOps.ts's
 * browser-login handling is deployment-type-conditional.
 */
import fs from 'fs';
import { resolve } from 'path';

// Forces the full, correctly-ordered module graph (via the package barrel)
// to initialize before touching ConnectionProfileOps.ts directly below —
// see ConnectionProfileOps.test.ts's identical import order. Without this,
// a pre-existing circular import between ConnectionProfileOps.ts and
// cloud/ServiceAccountOps.ts (both import SERVICE_ACCOUNT_DEFAULT_SCOPES-
// adjacent modules) hits a TDZ error when this file is imported first.
import '../index';
import {
  loadConnectionProfileByHost,
  saveConnectionProfile,
} from './ConnectionProfileOps';
import StateImpl from '../shared/State';

const TMP_DIR = resolve(
  '.',
  'test',
  'fs_tmp',
  'ConnectionProfileOps.browserLogin'
);

function freshState(host: string, connectionProfilesPath: string) {
  const state = StateImpl({ host });
  state.setConnectionProfilesPath(connectionProfilesPath);
  state.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
  return state;
}

describe('Browser-login connection profile round trip', () => {
  beforeAll(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    // A stable, pre-existing master key avoids DataProtection's own
    // async auto-generate-on-first-use path racing with afterAll's cleanup
    // below — see TokenCacheOps.browserToken.unit.test.ts's identical fix.
    fs.writeFileSync(resolve(TMP_DIR, 'masterkey.key'), 'test-master-key');
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  test.each(['cloud', 'forgeops', 'classic'])(
    '%s: saves and reloads a browser-login profile onto a fresh state, without persisting a username/password',
    async (deploymentType) => {
      const host = `https://openam-${deploymentType}-browserlogin.example.com/am`;
      const connectionProfilesPath = resolve(
        TMP_DIR,
        `${deploymentType}.connections.json`
      );

      const loginState = freshState(host, connectionProfilesPath);
      loginState.setDeploymentType(deploymentType);
      loginState.setAuthMode('interactive');
      loginState.setBrowserLoginClientId('my-browser-client');
      loginState.setBrowserLoginScope('openid fr:idm:*');
      // Shared with the non-interactive synthetic flow's own
      // --login-redirect-uri field.
      loginState.setAdminClientRedirectUri('http://127.0.0.1:51737/callback');

      const saved = await saveConnectionProfile({ host, state: loginState });
      expect(saved).toBe(true);

      const freshProcessState = freshState(host, connectionProfilesPath);
      const loaded = await loadConnectionProfileByHost({
        host,
        state: freshProcessState,
      });

      expect(loaded).toBe(true);
      expect(freshProcessState.getDeploymentType()).toBe(deploymentType);
      expect(freshProcessState.getAuthMode()).toBe('interactive');
      expect(freshProcessState.getBrowserLoginClientId()).toBe(
        'my-browser-client'
      );
      expect(freshProcessState.getBrowserLoginScope()).toBe(
        'openid fr:idm:*'
      );
      expect(freshProcessState.getAdminClientRedirectUri()).toBe(
        'http://127.0.0.1:51737/callback'
      );
      expect(freshProcessState.getUsername()).toBeFalsy();
      expect(freshProcessState.getPassword()).toBeFalsy();
    }
  );
});
