import {
  compileScript as _compileScript,
  evaluateScript as _evaluateScript,
} from '../api/IdmScriptApi';
import { State } from '../shared/State';
import { FrodoError } from './FrodoError';

export type IdmScript = {
  /**
   * Compile a JS script
   * @returns {Promise<string | object>} a promise resolving to 'true' or an error message
   */
  compileScript(script: string): Promise<string | object>;
  /**
   * Run a JS script
   * @returns {Promise<SystemStatusInterface[]>} a promise resolving to the script result
   */
  evaluateScript(
    script: string,
    globals?: { [key: string]: any }
  ): Promise<any>;
};

export default (state: State): IdmScript => {
  return {
    async compileScript(script: string): Promise<string | object> {
      return compileScript({ script, state });
    },
    async evaluateScript(
      script: string,
      globals: { [key: string]: any } = {}
    ): Promise<any> {
      return evaluateScript({ script, globals, state });
    },
  };
};

export async function compileScript({
  script,
  state,
}: {
  script: string;
  state: State;
}): Promise<string | object> {
  try {
    const response = await _compileScript({ script, state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error compiling script`, error);
  }
}

export async function evaluateScript({
  script,
  globals = {},
  state,
}: {
  script: string;
  globals?: { [key: string]: any };
  state: State;
}): Promise<any> {
  try {
    const response = await _evaluateScript({ script, globals, state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error evaluating script`, error);
  }
}
