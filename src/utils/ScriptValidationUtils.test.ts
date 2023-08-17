import StateImpl, { State } from '../shared/State';
import { areScriptHooksValid } from './ScriptValidationUtils';

const state: State = StateImpl({});

describe('areScriptHooksValid', () => {
  it('should return false when there is an invalid script', () => {
    const jsonData = {
      script: {
        type: 'text/javascript',
        source: 'invalid javascript',
      },
    };
    expect(areScriptHooksValid({ jsonData, state })).toBe(false);
  });

  it('should return true when there is a valid script', () => {
    const jsonData = {
      script: {
        type: 'text/javascript',
        source: 'console.log("Hello World");',
      },
    };
    expect(areScriptHooksValid({ jsonData, state })).toBe(true);
  });

  it('should return true when there is no script', () => {
    const jsonData = {
      script: {
        type: 'text/javascript',
      },
    };
    expect(areScriptHooksValid({ jsonData, state })).toBe(true);
  });
});
