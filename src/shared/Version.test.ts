import { getUserAgent } from './Version';

describe('Versions', () => {
    test('user agent is compiled from package', () => {
        expect(getUserAgent()).toMatch(/@rockcarver\/frodo-lib\/[0-9.-]+/);
    });
});