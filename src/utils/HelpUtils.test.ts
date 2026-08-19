import { helpMetadata } from '../lib/Help';

/**
 * These assertions exercise generate-help.mjs indirectly via its generated
 * output (Help.ts), since the generator itself is a build-time .mjs script
 * outside the jest/ts-jest pipeline. Each case pins down a known signature so
 * a regression in the depth-aware required-flag parser is caught here rather
 * than silently shipping wrong parameter contracts to frodo shell/MCP.
 */
describe('generate-help required flag', () => {
  function findDoc(typeName: string, methodName: string) {
    const doc = helpMetadata.find(
      (d) => d.typeName === typeName && d.methodName === methodName
    );
    if (!doc) {
      throw new Error(`No help entry found for ${typeName}.${methodName}`);
    }
    return doc;
  }

  function requiredMap(typeName: string, methodName: string) {
    return Object.fromEntries(
      findDoc(typeName, methodName).params.map((p) => [p.name, p.required])
    );
  }

  test('readScripts(filter?: ScriptFilter) marks filter optional', () => {
    expect(requiredMap('Script', 'readScripts')).toEqual({ filter: false });
  });

  test('getLibraryScriptNames(scriptObj: ScriptSkeleton) marks scriptObj required', () => {
    expect(requiredMap('Script', 'getLibraryScriptNames')).toEqual({
      scriptObj: true,
    });
  });

  test('createScript(scriptId, scriptName, scriptData) marks all params required', () => {
    expect(requiredMap('Script', 'createScript')).toEqual({
      scriptId: true,
      scriptName: true,
      scriptData: true,
    });
  });

  test('deleteScripts(resultCallback?, filter?) marks both params optional', () => {
    expect(requiredMap('Script', 'deleteScripts')).toEqual({
      resultCallback: false,
      filter: false,
    });
  });
});
