import { getUserAgent } from './Version';

describe('Versions', () => {
    test('user agent is compiled from package', () => {
        expect(getUserAgent()).toMatch(/@trivir\/frodo-lib\/[0-9.-]+trivir[0-9.]*/);
    });
});