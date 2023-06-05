import { parseScript } from 'esprima';
import { ScriptSkeleton } from '../../api/ApiTypes';
import { decode } from '../../api/utils/Base64';
import { printMessage } from './Console';

interface ScriptHook {
  type: 'text/javascript';
  source?: string;
}

export function validateScriptHooks(jsonData: object): boolean {
  const scriptHooks = findAllScriptHooks(jsonData);

  for (const scriptHook of scriptHooks) {
    if (!('source' in scriptHook)) {
      continue;
    }

    if (!isValidJs(scriptHook.source)) {
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

export function validateScript(script: ScriptSkeleton): boolean {
  const scriptRaw = decode(script.script);

  if (script.language === 'JAVASCRIPT') {
    return isValidJs(scriptRaw);
  }
  return true;
}

export function validateScriptDecoded(scriptSkeleton: ScriptSkeleton): boolean {
  if (!Array.isArray(scriptSkeleton.script)) {
    return false;
  }
  if (scriptSkeleton.language === 'JAVASCRIPT') {
    const script = scriptSkeleton.script.join('\n');
    return isValidJs(script);
  }
  return true;
}

export function isValidJs(javascriptSource: string) {
  try {
    parseScript(javascriptSource);
    return true;
  } catch (e) {
    printMessage(`Invalid JavaScript: ${e.message}`, 'error');

    return false;
  }
}
