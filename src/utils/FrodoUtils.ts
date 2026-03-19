import os from 'os';
import path from 'path';

export type FrodoUtils = {
  /**
   * Get the Frodo home directory path.
   * @returns {string} absolute path to the Frodo home directory
   */
  getFrodoHome(): string;
};

export default (): FrodoUtils => {
  return {
    getFrodoHome(): string {
      return getFrodoHome();
    },
  };
};

/**
 * Get the Frodo home directory path in an OS-independent way.
 * @returns {string} absolute path to the Frodo home directory
 */
export function getFrodoHome(): string {
  return path.join(os.homedir(), '.frodo');
}
