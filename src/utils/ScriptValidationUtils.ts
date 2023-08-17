import { parseScript } from 'esprima';

import { type ScriptSkeleton } from '../api/ScriptApi';
import { State } from '../shared/State';
import { decode } from './Base64Utils';
import { printMessage } from './Console';

export type ScriptValidation = {
  validateScriptHooks(jsonData: object): void;
  validateScript(scriptData: ScriptSkeleton): void;
  validateJs(javascriptSource: string): void;
  areScriptHooksValid(jsonData: object): boolean;
  isScriptValid(scriptData: ScriptSkeleton): boolean;
  isValidJs(javascriptSource: string): boolean;
};

export default (state: State): ScriptValidation => {
  return {
    validateScriptHooks(jsonData: object): void {
      validateScriptHooks({ jsonData });
    },
    validateScript(scriptData: ScriptSkeleton): void {
      validateScript({ scriptData });
    },
    validateJs(javascriptSource: string): void {
      validateJs({ javascriptSource });
    },
    areScriptHooksValid(jsonData: object): boolean {
      return areScriptHooksValid({ jsonData, state });
    },
    isScriptValid(scriptData: ScriptSkeleton): boolean {
      return isScriptValid({ scriptData, state });
    },
    isValidJs(javascriptSource: string): boolean {
      return isValidJs({ javascriptSource, state });
    },
  };
};

export interface ScriptHook {
  type: 'text/javascript';
  source?: string;
}

function findAllScriptHooks(
  jsonData: any,
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

export function validateScriptHooks({ jsonData }: { jsonData: object }): void {
  const scriptHooks = findAllScriptHooks(jsonData);

  for (const scriptHook of scriptHooks) {
    if (!('source' in scriptHook)) {
      continue;
    }

    validateJs({ javascriptSource: scriptHook.source });
  }
}

export function validateScript({
  scriptData,
}: {
  scriptData: ScriptSkeleton;
}): void {
  if (scriptData.language === 'JAVASCRIPT') {
    const script = Array.isArray(scriptData.script)
      ? scriptData.script.join('\n')
      : decode(scriptData.script as string);
    validateJs({ javascriptSource: script });
  }
}

export function validateJs({ javascriptSource }: { javascriptSource: string }) {
  parseScript(javascriptSource);
  return true;
}

export function areScriptHooksValid({
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

export function isScriptValid({
  scriptData,
  state,
}: {
  scriptData: ScriptSkeleton;
  state: State;
}): boolean {
  if (scriptData.language === 'JAVASCRIPT') {
    const script = Array.isArray(scriptData.script)
      ? scriptData.script.join('\n')
      : decode(scriptData.script as string);
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
