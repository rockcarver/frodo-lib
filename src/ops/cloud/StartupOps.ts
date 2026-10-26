import {
  getStatus,
  initiateRestart,
  RestartStatus,
} from '../../api/cloud/StartupApi';
import { State } from '../../shared/State';
import {
  createProgressIndicator,
  stopProgressIndicator,
} from '../../utils/Console';
import { waitForUpdate } from '../../utils/ForgeRockUtils';
import { readSecrets } from './SecretsOps';
import { readVariables } from './VariablesOps';

export type Startup = {
  /**
   * Check for updates that need applying
   * @returns {Promise<Updates>} true if there are updates that need to be applied, false otherwise
   */
  checkForUpdates(): Promise<Updates>;
  /**
   * Apply updates
   * @param {boolean} wait wait for the operation to complete or not
   * @param {number} timeout timeout in milliseconds
   * @returns {Promise<boolean>} true if successful, false otherwise
   */
  applyUpdates(wait: boolean, timeout?: number): Promise<boolean>;
  /**
   * Get the current restart status of the environment
   * @returns {Promise<RestartStatus>} the current restart status
   */
  readStatus(): Promise<RestartStatus>;
};

export default (state: State): Startup => {
  return {
    /**
     * Check for updates that need applying
     * @returns {Promise<Updates>} true if there are updates that need to be applied, false otherwise
     */
    async checkForUpdates(): Promise<Updates> {
      return checkForUpdates({ state });
    },

    /**
     * Apply updates
     * @param {boolean} wait wait for the operation to complete or not
     * @param {number} timeout timeout in milliseconds
     * @returns {Promise<boolean>} true if successful, false otherwise
     */
    async applyUpdates(wait: boolean, timeout: number = 10 * 60 * 1000) {
      return applyUpdates({
        wait,
        timeout,
        state,
      });
    },

    /**
     * Get the current restart status of the environment
     * @returns {Promise<RestartStatus>} the current restart status
     */
    async readStatus(): Promise<RestartStatus> {
      return readStatus({ state });
    },
  };
};

/**
 * Updates that need to be applied.
 */
export interface Updates {
  /**
   * Array of secrets that need applying
   */
  secrets?: unknown[];
  /**
   * Array of variables that need applying
   */
  variables?: unknown[];
}

/**
 * Get the current restart status of the environment
 * @returns {Promise<RestartStatus>} the current restart status
 */
export async function readStatus({
  state,
}: {
  state: State;
}): Promise<RestartStatus> {
  return getStatus({ state });
}
/**
 * Check for updates that need applying
 * @returns {Promise<boolean>} true if there are updates that need to be applied, false otherwise
 */
export async function checkForUpdates({
  state,
}: {
  state: State;
}): Promise<Updates> {
  const updates: Updates = { secrets: [], variables: [] };
  const indicatorId = createProgressIndicator({
    total: undefined,
    message: `Checking for updates to apply...`,
    type: 'indeterminate',
    state,
  });
  try {
    updates.secrets = (await readSecrets({ state })).filter(
      (secret) => !secret.loaded
    );
    updates.variables = (await readVariables({ state })).filter(
      (variable) => !variable.loaded
    );
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error: ${error.response.data.code} - ${error.response.data.message}`,
      status: 'fail',
      state,
    });
  }
  const updateCount = updates.secrets?.length + updates.variables?.length || 0;
  if (updateCount > 0) {
    stopProgressIndicator({
      id: indicatorId,
      message: `${updateCount} update(s) need to be applied`,
      status: 'success',
      state,
    });
  } else {
    stopProgressIndicator({
      id: indicatorId,
      message: `No updates need to be applied`,
      status: 'success',
      state,
    });
  }
  return updates;
}

/**
 * Apply updates
 * @param {boolean} wait wait for the operation to complete or not
 * @param {number} timeout timeout in milliseconds
 * @returns {Promise<boolean>} true if successful, false otherwise
 */
export async function applyUpdates({
  wait,
  timeout = 10 * 60 * 1000,
  state,
}: {
  wait: boolean;
  timeout?: number;
  state: State;
}): Promise<boolean> {
  return await waitForUpdate({
    initiateUpdate: async () => await initiateRestart({ state }),
    isComplete: async () => {
      const status = await getStatus({ state });
      return {
        status,
        isComplete: RestartStatus.ready === status,
      };
    },
    initialMessage: 'Applying updates...',
    noWaitSuccessMessage:
      'Updates are being applied. Changes may take up to 10 minutes to propagate, during which time you will not be able to make further updates.',
    waitSuccessMessage: (isCompleted, runtime) =>
      `Updates applied in ${Math.round(
        runtime / 1000
      )}s with final status: ${isCompleted.status}`,
    timeoutMessage: (isCompleted, runtime) =>
      `Updates timed out in ${Math.round(
        runtime / 1000
      )}s with final status: ${isCompleted.status}`,
    wait,
    timeout,
    state,
  });
}
