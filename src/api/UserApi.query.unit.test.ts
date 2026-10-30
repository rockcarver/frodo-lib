/**
 * Run tests
 *
 *        npm run test:only UserApi.query
 *
 * The AM users endpoint can be asked for the users that match a CREST filter
 * and for their count, with the attributes to return (cli#1004 offers the
 * users of a classic realm in a picker). The default stays "all users".
 */
import { jest } from '@jest/globals';

const urls: string[] = [];
const get = jest.fn(async (url: string): Promise<any> => {
  urls.push(url);
  return { data: { result: [], resultCount: 0, totalPagedResults: 7 } };
});

const unused = jest.fn();
jest.unstable_mockModule('./BaseApi', () => ({
  generateAmApi: jest.fn(() => ({ get })),
  generateAmAuthApi: unused,
  generateOauth2Api: unused,
  generateIdmApi: unused,
  generateIdmSystemApi: unused,
  generateLogKeysApi: unused,
  generateLogApi: unused,
  generateEnvApi: unused,
  generateGovernanceApi: unused,
  generateWSFedApi: unused,
  generateReleaseApi: unused,
}));

const { getUsers, getUserCount } = await import('./UserApi');
const { default: StateImpl } = await import('../shared/State');

describe('UserApi.getUsers() and getUserCount()', () => {
  const state = StateImpl({ host: 'https://am.example.com/am' });
  state.setRealm('alpha');

  beforeEach(() => {
    urls.length = 0;
  });

  test('0: Methods are implemented', () => {
    expect(getUsers).toBeDefined();
    expect(getUserCount).toBeDefined();
  });

  test('1: getUsers() without arguments asks for all users, as before', async () => {
    await getUsers({ state });
    expect(urls).toEqual([
      'https://am.example.com/am/json/realms/root/realms/alpha/users?_queryFilter=true',
    ]);
  });

  test('2: getUsers() sends the filter encoded and the fields asked for', async () => {
    await getUsers({
      filter: 'username sw "a&b" or sn sw "a&b"',
      fields: ['username', 'givenName', 'sn', 'mail'],
      state,
    });
    expect(urls).toEqual([
      'https://am.example.com/am/json/realms/root/realms/alpha/users?_queryFilter=username%20sw%20%22a%26b%22%20or%20sn%20sw%20%22a%26b%22&_fields=username,givenName,sn,mail',
    ]);
  });

  test('3: getUserCount() without arguments counts all users, as before', async () => {
    await expect(getUserCount({ state })).resolves.toBe(7);
    expect(urls).toEqual([
      'https://am.example.com/am/json/realms/root/realms/alpha/users?_queryFilter=true&_pageSize=0&_totalPagedResultsPolicy=EXACT',
    ]);
  });

  test('4: getUserCount() counts the users that match the filter', async () => {
    await getUserCount({ filter: 'username sw "a"', state });
    expect(urls).toEqual([
      'https://am.example.com/am/json/realms/root/realms/alpha/users?_queryFilter=username%20sw%20%22a%22&_pageSize=0&_totalPagedResultsPolicy=EXACT',
    ]);
  });
});
