import { jest } from '@jest/globals';

/**
 * `findJourneyReferences` hands its sources and the start of its failure
 * message to the shared fail-closed helper of the reference lookups. The tests
 * of the lookup itself pin what comes after that start (the nested messages)
 * and the answer; this one pins the start of the message and the order of the
 * sources, which a caller reads. Pure unit test: the helper is replaced by a
 * spy, nothing is read.
 */

const findReferencesInSources = jest.fn(
  async (_params?: any): Promise<unknown[]> => []
);
const actualReferenceLookup = await import('./internal/ReferenceLookup');
jest.unstable_mockModule('./internal/ReferenceLookup', () => ({
  ...actualReferenceLookup,
  findReferencesInSources,
}));

const { findJourneyReferences } = await import('./JourneyOps');

const state = { getRealm: () => '/alpha' } as any;

beforeEach(() => {
  findReferencesInSources.mockClear();
});

describe('findJourneyReferences hands the lookup to the shared helper', () => {
  test('with the start of the failure message that names the realm and the journey', async () => {
    await findJourneyReferences({ journeyId: 'Login', state });
    expect(findReferencesInSources).toHaveBeenCalledTimes(1);
    const params = findReferencesInSources.mock.calls[0][0];
    expect(params.failure).toBe(
      'Error finding references to alpha realm journey Login'
    );
    expect(params.id).toBe('Login');
    expect(params.state).toBe(state);
  });

  test('with every source, in the order of the result, under the label that an error names', async () => {
    await findJourneyReferences({ journeyId: 'Login', state });
    const sources = findReferencesInSources.mock.calls[0][0].sources;
    expect(sources.map(({ source, label }: any) => [source, label])).toEqual([
      ['journey', 'journeys and their nodes'],
      ['authentication-settings', 'authentication settings'],
      ['self-service-trees', 'self-service journey settings'],
      ['oauth2-provider', 'OAuth2 provider settings'],
      ['oauth2-client', 'OAuth2 clients'],
      ['saml2-provider', 'SAML service providers'],
      ['ai-agent', 'AI agents'],
      ['agent-group', 'agent groups'],
      ['cimd-profile', 'CIMD profiles'],
      ['theme', 'themes'],
      ['policy', 'policies'],
    ]);
  });

  test('not for a blank journey id, which is refused first', async () => {
    await expect(
      findJourneyReferences({ journeyId: ' ', state })
    ).rejects.toThrow(
      'Error finding references to a journey in the alpha realm: the journey id is empty'
    );
    expect(findReferencesInSources).not.toHaveBeenCalled();
  });
});
