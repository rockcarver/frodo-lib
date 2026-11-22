// A canary for projects that run Jest in CommonJS mode against the real package. It is NOT part of
// `npm run test:packed`: it needs Jest installed in the consumer folder (network) and its result depends on the
// Jest release. Expected today: it fails in Jest's default mode ("Must use import to load ES Module") and passes
// with NODE_OPTIONS=--experimental-vm-modules on Node.js 24.9 or later with Jest 30. A change of that result is
// news about Jest, not a defect of the package.
const PKG = '@rockcarver/frodo-lib';

describe('CommonJS consumer of the package under Jest', () => {
  test('destructured require', () => {
    const { frodo, state } = require(PKG);
    expect(typeof frodo.login.getTokens).toBe('function');
    state.setHost('https://openam-matrix.example.com/am');
    expect(state.getHost()).toBe('https://openam-matrix.example.com/am');
  });

  test('FrodoError', () => {
    const { FrodoError } = require(PKG);
    expect(new FrodoError('x')).toBeInstanceOf(Error);
  });

  test('spyOn a nested method', () => {
    const { frodo } = require(PKG);
    const spy = jest
      .spyOn(frodo.login, 'getTokens')
      .mockResolvedValue('stubbed');
    return frodo.login.getTokens().then((result) => {
      expect(result).toBe('stubbed');
      spy.mockRestore();
    });
  });

  test('jest.mock with a factory never loads the module', () => {
    jest.resetModules();
    jest.doMock(PKG, () => ({ frodo: { fake: true } }));
    expect(require(PKG).frodo.fake).toBe(true);
    jest.dontMock(PKG);
  });

  test('requireActual', () => {
    const lib = jest.requireActual(PKG);
    expect(typeof lib.frodo).toBe('object');
  });

  test('dynamic import()', async () => {
    const lib = await import(PKG);
    expect(typeof lib.frodo).toBe('object');
  });
});
