import { parseScript } from 'esprima';
import { ScriptSkeleton } from '../../api/ApiTypes';
import { decode } from '../../api/utils/Base64';
import { printMessage } from './Console';
import State from '../../shared/State';

export type ScriptValidation = {
  validateScriptHooks(jsonData: object): boolean;
  findAllScriptHooks(
    jsonData: object,
    scriptHooksArray?: ScriptHook[]
  ): ScriptHook[];
  validateScript(script: ScriptSkeleton): boolean;
  validateScriptDecoded(scriptSkeleton: ScriptSkeleton): boolean;
  isValidJs(javascriptSource: string): boolean;
};

export default (state: State) => {
  return {
    validateScriptHooks(jsonData: object): boolean {
      return validateScriptHooks({ jsonData, state });
    },

    findAllScriptHooks(
      jsonData: object,
      scriptHooksArray: ScriptHook[] = []
    ): ScriptHook[] {
      return findAllScriptHooks(jsonData, scriptHooksArray);
    },

    validateScript(script: ScriptSkeleton): boolean {
      return validateScript(script, state);
    },

    validateScriptDecoded(scriptSkeleton: ScriptSkeleton): boolean {
      return validateScriptDecoded({ scriptSkeleton, state });
    },

    isValidJs(javascriptSource: string) {
      return isValidJs({ javascriptSource, state });
    },
  };
};

export interface ScriptHook {
  type: 'text/javascript';
  source?: string;
}

export function validateScriptHooks({
  jsonData,
  state,
}: {
  jsonData: object;
  state: State;
}): boolean {
  const scriptHooks = findAllScriptHooks(jsonData);

  for (const scriptHook of scriptHooks) {
    if (!('source' in scriptHook)) {
      continue;
    }

    if (!isValidJs({ javascriptSource: scriptHook.source, state })) {
      return false;
    }
  }

  return true;
}

function findAllScriptHooks(
  jsonData: unknown,
  scriptHooksArray: ScriptHook[] = []
): ScriptHook[] {
  if (typeof jsonData !== 'object' || jsonData === null) {
    return scriptHooksArray;
  }

  for (const key in jsonData) {
    const item = jsonData[key];
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    if ('type' in item && item.type === 'text/javascript') {
      scriptHooksArray.push(item);
    } else {
      findAllScriptHooks(item, scriptHooksArray);
    }
  }

  return scriptHooksArray;
}

export function validateScript(script: ScriptSkeleton, state: State): boolean {
  const scriptRaw = decode(script.script as string);

  if (script.language === 'JAVASCRIPT') {
    return isValidJs({ javascriptSource: scriptRaw, state });
  }
  return true;
}

export function validateScriptDecoded({
  scriptSkeleton,
  state,
}: {
  scriptSkeleton: ScriptSkeleton;
  state: State;
}): boolean {
  if (!Array.isArray(scriptSkeleton.script)) {
    return false;
  }
  if (scriptSkeleton.language === 'JAVASCRIPT') {
    const script = scriptSkeleton.script.join('\n');
    return isValidJs({ javascriptSource: script, state });
  }
  return true;
}

export function isValidJs({
  javascriptSource,
  state,
}: {
  javascriptSource: string;
  state: State;
}) {
  try {
    parseScript(javascriptSource);
    return true;
  } catch (e) {
    printMessage({
      message: `Invalid JavaScript: ${e.message}`,
      type: 'error',
      state,
    });

    return false;
  }
}
