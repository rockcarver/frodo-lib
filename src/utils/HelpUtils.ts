import { helpMetadata, type MethodHelpDoc } from '../lib/Help';

export type HelpUtils = {
  /**
   * Get all generated help metadata entries.
   * @returns {MethodHelpDoc[]} help metadata entries
   */
  getHelpMetadata(): MethodHelpDoc[];
  /**
   * Get generated help metadata entries by method name.
   * @param {string} methodName method name
   * @returns {MethodHelpDoc[]} matching help metadata entries
   */
  getHelpMetadataByMethod(methodName: string): MethodHelpDoc[];
};

export default (): HelpUtils => {
  return {
    getHelpMetadata(): MethodHelpDoc[] {
      return getHelpMetadata();
    },
    getHelpMetadataByMethod(methodName: string): MethodHelpDoc[] {
      return getHelpMetadataByMethod(methodName);
    },
  };
};

export function getHelpMetadata(): MethodHelpDoc[] {
  return helpMetadata;
}

export function getHelpMetadataByMethod(methodName: string): MethodHelpDoc[] {
  return helpMetadata.filter((doc) => doc.methodName === methodName);
}
