import { getIdmBaseUrl } from '../utils/ForgeRockUtils';
import StateImpl, { deriveState } from './State';

function parentState() {
  return StateImpl({
    host: 'https://openam-sending.example.com/am',
    realm: 'alpha',
    deploymentType: 'cloud',
  });
}

describe('deriveState()', () => {
  it('answers with its own methods and takes everything else from the parent', () => {
    const parent = parentState();
    const derived = deriveState(parent, {
      getIdmHost: () => 'https://elsewhere.example.com/openidm',
    });
    expect(derived.getIdmHost()).toBe('https://elsewhere.example.com/openidm');
    expect(derived.getHost()).toBe('https://openam-sending.example.com/am');
    expect(derived.getRealm()).toBe('alpha');
    expect(derived.getDeploymentType()).toBe('cloud');
  });

  it('does not change the parent', () => {
    const parent = parentState();
    deriveState(parent, {
      getIdmHost: () => 'https://elsewhere.example.com/openidm',
    });
    expect(parent.getIdmHost()).toBeUndefined();
    expect(getIdmBaseUrl(parent)).toBe(
      'https://openam-sending.example.com/openidm'
    );
  });

  it('sees a token the parent sets or loses afterwards', () => {
    const parent = parentState();
    const derived = deriveState(parent, { getIdmHost: () => 'https://x/y' });
    expect(derived.getBearerToken()).toBeUndefined();
    parent.setBearerTokenMeta({
      access_token: 'first',
      expires_in: 3600,
    } as any);
    expect(derived.getBearerToken()).toBe('first');
    // the refresh of the parent replaces the token the derived state uses
    parent.setBearerTokenMeta({
      access_token: 'refreshed',
      expires_in: 3600,
    } as any);
    expect(derived.getBearerToken()).toBe('refreshed');
    parent.setBearerTokenMeta(undefined);
    expect(derived.getBearerToken()).toBeUndefined();
  });

  it('sees the host the parent has now', () => {
    const parent = parentState();
    const derived = deriveState(parent, {
      getIdmHost: () => `${parent.getHost()}/derived`,
    });
    parent.setHost('https://openam-other.example.com/am');
    expect(derived.getIdmHost()).toBe(
      'https://openam-other.example.com/am/derived'
    );
  });

  it('keeps two derived states apart, also when they are used concurrently', async () => {
    const parent = parentState();
    const one = deriveState(parent, {
      getIdmHost: () => 'https://one.example.com/openidm',
    });
    const two = deriveState(parent, {
      getIdmHost: () => 'https://two.example.com/openidm',
    });
    const read = async (state: typeof parent, delay: number) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return getIdmBaseUrl(state);
    };
    const [fromOne, fromTwo, fromParent] = await Promise.all([
      read(one, 15),
      read(two, 5),
      read(parent, 10),
    ]);
    expect(fromOne).toBe('https://one.example.com/openidm');
    expect(fromTwo).toBe('https://two.example.com/openidm');
    expect(fromParent).toBe('https://openam-sending.example.com/openidm');
  });

  it('calls methods that use this on the derived state', () => {
    const parent = parentState();
    const derived = deriveState(parent, {
      getHost: () => 'https://derived.example.com/am',
    });
    // getTenant is implemented as this.getHost()
    expect(derived.getTenant()).toBe('https://derived.example.com/am');
    expect(parent.getTenant()).toBe('https://openam-sending.example.com/am');
  });
});
