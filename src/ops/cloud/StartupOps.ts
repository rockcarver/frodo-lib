import {
  createProgressIndicator,
  updateProgressIndicator,
  stopProgressIndicator,
} from '../utils/Console';
import { getSecrets } from '../../api/cloud/SecretsApi';
import {
  getStatus,
  initiateRestart,
  RestartStatus,
} from '../../api/cloud/StartupApi';
import { getVariables } from '../../api/cloud/VariablesApi';

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
 * Check for updates that need applying
 * @returns {Promise<boolean>} true if there are updates that need to be applied, false otherwise
 */
export async function checkForUpdates(): Promise<Updates> {
  const updates: Updates = { secrets: [], variables: [] };
  createProgressIndicator(
    undefined,
    `Checking for updates to apply...`,
    'indeterminate'
  );
  try {
    updates.secrets = (await getSecrets()).result.filter(
      (secret: { loaded: unknown }) => !secret.loaded
    );
    updates.variables = (await getVariables()).result.filter(
      (variable: { loaded: unknown }) => !variable.loaded
    );
  } catch (error) {
    stopProgressIndicator(
      `Error: ${error.response.data.code} - ${error.response.data.message}`,
      'fail'
    );
  }
  const updateCount = updates.secrets?.length + updates.variables?.length || 0;
  if (updateCount > 0) {
    stopProgressIndicator(
      `${updateCount} update(s) need to be applied`,
      'success'
    );
  } else {
    stopProgressIndicator(`No updates need to be applied`, 'success');
  }
  return updates;
}

/**
 * Apply updates
 * @param {boolean} wait wait for the operation to complete or not
 * @param {number} timeout timeout in milliseconds
 * @returns {Promise<boolean>} true if successful, false otherwise
 */
export async function applyUpdates(wait: boolean, timeout = 10 * 60 * 1000) {
  createProgressIndicator(undefined, `Applying updates...`, 'indeterminate');
  try {
    let status = await initiateRestart();
    if (wait) {
      const start = new Date().getTime();
      let runtime = 0;
      let errors = 0;
      const maxErrors = 3;
      while (
        status !== RestartStatus.ready &&
        start + timeout > new Date().getTime()
      ) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        try {
          status = await getStatus();

          // reset errors after successful status call
          if (errors) errors = 0;

          runtime = new Date().getTime() - start;
          updateProgressIndicator(`${status} (${Math.round(runtime / 1000)}s)`);
        } catch (error) {
          errors++;
          if (errors > maxErrors) {
            throw error;
          }
          runtime = new Date().getTime() - start;
          updateProgressIndicator(
            `${error.message} - retry ${errors}/${maxErrors} (${Math.round(
              runtime / 1000
            )}s)`
          );
        }
      }
      if (runtime < timeout) {
        stopProgressIndicator(
          `Updates applied in ${Math.round(
            runtime / 1000
          )}s with final status: ${status}`,
          'success'
        );
        return true;
      } else {
        stopProgressIndicator(
          `Updates timed out after ${Math.round(
            runtime / 1000
          )}s with final status: ${status}`,
          'warn'
        );
        return false;
      }
    } else {
      stopProgressIndicator(
        `Updates are being applied. Changes may take up to 10 minutes to propagate, during which time you will not be able to make further updates.`,
        'success'
      );
      return true;
    }
  } catch (error) {
    stopProgressIndicator(
      `Error: ${error.response?.data?.code || error} - ${
        error.response?.data?.message
      }`,
      'fail'
    );
    return false;
  }
}
