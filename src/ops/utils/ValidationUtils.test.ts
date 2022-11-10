import { validateScriptHooks } from './ValidationUtils';

describe('validateScriptHooks', () => {
  it('should return false when there is an invalid script', () => {
    const jsonData = {
      script: {
        type: 'text/javascript',
        source: 'invalid javascript',
      },
    };
    expect(validateScriptHooks(jsonData)).toBe(false);
  });

  it('should return true when there is a valid script', () => {
    const jsonData = {
      script: {
        type: 'text/javascript',
        source: 'console.log("Hello World");',
      },
    };
    expect(validateScriptHooks(jsonData)).toBe(true);
  });

  it('should return true when there is no script', () => {
    const jsonData = {
      script: {
        type: 'text/javascript',
      },
    };
    expect(validateScriptHooks(jsonData)).toBe(true);
  });
});
