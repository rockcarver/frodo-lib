import os from 'os';
import path from 'path';

export type FrodoUtils = {
  /**
   * Get the Frodo home directory path.
   * @returns {string} absolute path to the Frodo home directory
   */
  getFrodoHome(): string;
  /**
   * Helper function that returns a promise after a specified time. Used for sleeping Frodo execution.
   * @param {number} ms Number of milliseconds to sleep
   * @returns {Promise<void>} The promise that is fulfilled after the specified number of milliseconds
   */
  sleep(ms: number): Promise<void>;
};

export default (): FrodoUtils => {
  return {
    getFrodoHome(): string {
      return getFrodoHome();
    },
    sleep(ms: number): Promise<void> {
      return sleep(ms);
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

/**
 * Helper function that returns a promise after a specified time. Used for sleeping Frodo execution.
 * @param {number} ms Number of milliseconds to sleep
 * @returns {Promise<void>} The promise that is fulfilled after the specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
