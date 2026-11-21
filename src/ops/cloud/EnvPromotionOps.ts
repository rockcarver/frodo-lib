import {
  getLastPromotionReport as _getLastPromotionReport,
  getLockStatus as _getLockStatus,
  getPromotionReport as _getPromotionReport,
  getPromotionReports as _getPromotionReports,
  getPromotionStatus as _getPromotionStatus,
  getProvisionalPromotionReport as _getProvisionalPromotionReport,
  getProvisionalRollbackReport as _getProvisionalRollbackReport,
  lockEnvironment as _lockEnvironment,
  promoteConfiguration as _promoteConfiguration,
  rollbackPromotion as _rollbackPromotion,
  unlockEnvironment as _unlockEnvironment,
  type LockStatus,
  type PromotionReport,
  type PromotionReportStub,
  type PromotionRequestConfig,
  type PromotionResponse,
  type PromotionStatusResponse,
  type RollbackConfig,
  type RollbackResponse,
} from '../../api/cloud/EnvPromotionApi';
import { State } from '../../shared/State';
import { debugMessage } from '../../utils/Console';
import { waitForUpdate } from '../../utils/ForgeRockUtils';
import { FrodoError } from '../FrodoError';

export type EnvPromotion = {
  /**
   * Lock environment.
   * With wait set, the lock status is read first: an environment that is already locked or locking is not asked to lock again, the call waits for the lock and returns its status, whoever started it. That status has the same shape as the status of a lock of your own, with the promotionId of the lock that is held, which may belong to another promotion: do not assume that you own the lock. Without wait, nothing is read first and the lock is requested at once.
   * @param {boolean} wait Whether to wait for the environment to lock; an environment that is already locking is joined. Default: false
   * @param {number} pollInterval Time between status checks in milliseconds. Default: 10000
   * @param {number} timeout Timeout in milliseconds. Default: 15 * 60 * 1000
   * @returns {Promise<LockStatus>} a promise that resolves to a LockStatus object. Throws a FrodoError when the lock ends in an error (its cause carries the status text), or does not finish in time.
   */
  lockEnvironment(
    wait?: boolean,
    pollInterval?: number,
    timeout?: number
  ): Promise<LockStatus>;
  /**
   * Unlock environment.
   * With wait set, the lock status is read first: an environment that is already unlocked or unlocking is not asked to unlock again, the call waits for the unlock and returns its status. Without wait, nothing is read first and the unlock is requested at once.
   * Without a promotion id the id is read from the lock status, and an environment that holds no lock has none: the call then throws instead of returning the status. Pass the promotion id to unlock an environment that may already be unlocked.
   * @param {string} promotionId Optional promotion id. If not specified, will pull it from the environment lock status, which throws when the environment holds no lock
   * @param {boolean} wait Whether to wait for the environment to unlock; an environment that is already unlocking is joined. Default: false
   * @param {number} pollInterval Time between status checks in milliseconds. Default: 10000
   * @param {number} timeout Timeout in milliseconds. Default: 15 * 60 * 1000
   * @returns {Promise<LockStatus>} a promise that resolves to a LockStatus object. Throws a FrodoError when the unlock ends in an error (its cause carries the status text), or does not finish in time.
   */
  unlockEnvironment(
    promotionId?: string,
    wait?: boolean,
    pollInterval?: number,
    timeout?: number
  ): Promise<LockStatus>;
  /**
   * Read lock status
   * @param {boolean} localLockOnly True to show lock status of current environment. Default: false
   * @returns {Promise<LockStatus>} a promise that resolves to a LockStatus object
   */
  readLockStatus(localLockOnly?: boolean): Promise<LockStatus>;
  /**
   * Promote configuration
   * @param {PromotionRequestConfig} config Promotion request config.
   * @param {boolean} wait Whether to wait for the promotion to complete. Default: false
   * @param {number} pollInterval Time between status checks in milliseconds. Default: 10000
   * @param {number} timeout Timeout in milliseconds. Default: 45 * 60 * 1000
   * @returns {Promise<PromotionResponse>} a promise that resolves to a PromotionResponse object.
   */
  promoteConfiguration(
    config: PromotionRequestConfig,
    wait?: boolean,
    pollInterval?: number,
    timeout?: number
  ): Promise<PromotionResponse>;
  /**
   * Read promotion status
   * @returns {Promise<PromotionStatusResponse>} a promise that resolves to a PromotionStatus object
   */
  readPromotionStatus(): Promise<PromotionStatusResponse>;
  /**
   * Read last promotion report
   * @returns {Promise<PromotionReport>} a promise that resolves to a PromotionReport object
   */
  readLastPromotionReport(): Promise<PromotionReport>;
  /**
   * Read promotion report
   * @param {string} reportId Promotion id
   * @returns {Promise<PromotionReport>} a promise that resolves to a PromotionReport object
   */
  readPromotionReport(reportId: string): Promise<PromotionReport>;
  /**
   * Run a provisional report of changes since the last time the lower environment was promoted to the upper environment.
   * The report generated is for informational purposes only and may not reflect all the changes in a full promotion.
   * A dry-run promotion is always recommended prior to a full promotion between environments.
   * @returns {Promise<PromotionReport>} a promise that resolves to a PromotionReport object
   */
  runProvisionalPromotionReport(): Promise<PromotionReport>;
  /**
   * Run a provisional rollback report of changes when we rollback the configuration to the previous promotion.
   * @returns {Promise<PromotionReport>} a promise that resolves to a PromotionReport object
   */
  runProvisionalRollbackReport(): Promise<PromotionReport>;
  /**
   * Read a list of promotion reports in date order.
   * @returns {Promise<PromotionReportStub[]>} a promise that resolves to an array of PromotionReportStub objects
   */
  readPromotionReports(): Promise<PromotionReportStub[]>;
  /**
   * Rollback a promotion
   * @param {RollbackConfig} config Rollback config.
   * @param {boolean} wait Whether to wait for the rollback to complete. Default: false
   * @param {number} pollInterval Time between status checks in milliseconds. Default: 10000
   * @param {number} timeout Timeout in milliseconds. Default: 45 * 60 * 1000
   * @returns {Promise<RollbackResponse>} a promise that resolves to a RollbackResponse object.
   */
  rollbackPromotion(
    config: RollbackConfig,
    wait?: boolean,
    pollInterval?: number,
    timeout?: number
  ): Promise<RollbackResponse>;
};

export default (state: State): EnvPromotion => {
  return {
    async lockEnvironment(
      wait: boolean = false,
      pollInterval: number = 10000,
      timeout: number = 15 * 60 * 1000
    ): Promise<LockStatus> {
      return lockEnvironment({ wait, pollInterval, timeout, state });
    },
    async unlockEnvironment(
      promotionId?: string,
      wait: boolean = false,
      pollInterval: number = 10000,
      timeout: number = 15 * 60 * 1000
    ): Promise<LockStatus> {
      return unlockEnvironment({
        promotionId,
        wait,
        pollInterval,
        timeout,
        state,
      });
    },
    async readLockStatus(localLockOnly: boolean = false): Promise<LockStatus> {
      return readLockStatus({ localLockOnly, state });
    },
    async promoteConfiguration(
      config: PromotionRequestConfig,
      wait: boolean = false,
      pollInterval: number = 10000,
      timeout: number = 45 * 60 * 1000
    ): Promise<PromotionResponse> {
      return promoteConfiguration({
        config,
        wait,
        pollInterval,
        timeout,
        state,
      });
    },
    async readPromotionStatus(): Promise<PromotionStatusResponse> {
      return readPromotionStatus({ state });
    },
    async readLastPromotionReport(): Promise<PromotionReport> {
      return readLastPromotionReport({ state });
    },
    async readPromotionReport(reportId: string): Promise<PromotionReport> {
      return readPromotionReport({ reportId, state });
    },
    async runProvisionalPromotionReport(): Promise<PromotionReport> {
      return runProvisionalPromotionReport({ state });
    },
    async runProvisionalRollbackReport(): Promise<PromotionReport> {
      return runProvisionalRollbackReport({ state });
    },
    async readPromotionReports(): Promise<PromotionReportStub[]> {
      return readPromotionReports({ state });
    },
    async rollbackPromotion(
      config: RollbackConfig,
      wait: boolean = false,
      pollInterval: number = 10000,
      timeout: number = 45 * 60 * 1000
    ): Promise<RollbackResponse> {
      return rollbackPromotion({ config, wait, pollInterval, timeout, state });
    },
  };
};

/**
 * A promotion or rollback is finished once the status is neither running nor
 * in the middle of locking or unlocking the environments (a promotion that
 * unlocks afterwards ends in an unlocking state).
 */
function isPromotionFinished(
  promotionStatus: PromotionStatusResponse
): boolean {
  return !['RUNNING', 'LOCKING', 'UNLOCKING'].includes(promotionStatus.status);
}

/**
 * Read the lock status before a lock or unlock request, to find out whether
 * the environment is already where the request would take it. A status that
 * cannot be read does not end the call: the request is sent as it would be
 * without the check, and the answer to the request decides.
 */
async function readLockStatusBeforeRequest(
  state: State
): Promise<LockStatus | undefined> {
  try {
    return await readLockStatus({ state });
  } catch (error) {
    debugMessage({
      message: `Could not read the lock status before the request, sending the request anyway: ${error.message}`,
      state,
    });
    return undefined;
  }
}

/**
 * What a failed lock or unlock carries as its cause: the error that stopped
 * it, or else the text of the status when the tenant answered 'error'.
 */
function lockFailureCause(
  cause: Error | undefined,
  lockStatus: LockStatus | undefined
): Error | undefined {
  if (cause) return cause;
  return lockStatus?.result === 'error'
    ? new Error(lockStatus.description)
    : undefined;
}

/**
 * Lock environment.
 *
 * With wait set, the lock status is read first: an environment that is already
 * locked or locking is not asked to lock again, the call waits for the lock and
 * returns its status, whoever started it. That status has the same shape as the
 * status of a lock of your own, with the promotionId of the lock that is held,
 * which may belong to another promotion: do not assume that you own the lock.
 * A status that cannot be read does not end the call: the lock is requested as
 * it would be without the check.
 *
 * Without wait, nothing is read first and the lock is requested at once.
 * @param {boolean} wait Whether to wait for the environment to lock; an environment that is already locking is joined. Default: false
 * @param {number} pollInterval Time between status checks in milliseconds. Default: 10000
 * @param {number} timeout Timeout in milliseconds. Default: 15 * 60 * 1000
 * @returns {Promise<LockStatus>} a promise that resolves to a LockStatus object. Throws a FrodoError when the lock ends in an error (its cause carries the status text), or does not finish in time.
 */
export async function lockEnvironment({
  wait = false,
  pollInterval = 10000,
  timeout = 15 * 60 * 1000,
  state,
}: {
  wait?: boolean;
  pollInterval?: number;
  timeout?: number;
  state: State;
}): Promise<LockStatus> {
  let lockStatus: LockStatus;
  let cause: Error;
  const success = await waitForUpdate({
    initiateUpdate: async () => {
      // Without wait the lock is requested whatever the tenant says; with wait
      // an environment that is already locked or locking is joined.
      lockStatus = wait ? await readLockStatusBeforeRequest(state) : undefined;
      if (
        !lockStatus ||
        (lockStatus.result !== 'locked' && lockStatus.result !== 'locking')
      )
        lockStatus = await _lockEnvironment({ state });
      return {
        status: lockStatus.description,
        isComplete: ['locked', 'error'].includes(lockStatus.result),
        isError: lockStatus.result === 'error',
      };
    },
    isComplete: async () => {
      lockStatus = await readLockStatus({ state });
      return {
        status: lockStatus.description,
        isComplete: ['locked', 'error'].includes(lockStatus.result),
        isError: lockStatus.result === 'error',
      };
    },
    initialMessage: 'Initiating environment lock...',
    noWaitSuccessMessage: 'Environment lock initiated.',
    waitSuccessMessage: (_, runtime) =>
      `Environment locked after ${Math.round(runtime / 1000)}s`,
    timeoutMessage: (isCompleted, runtime) =>
      `Environment lock timed out after ${Math.round(
        runtime / 1000
      )}s with final message: ${isCompleted.status}`,
    errorMessage: (isCompleted, runtime) =>
      `Environment lock error (elapsed time: ${Math.round(
        runtime / 1000
      )}s): ${isCompleted.status}`,
    wait,
    timeout,
    pollInterval,
    onError: (error) => (cause = error as Error),
    state,
  });
  if (!success) {
    throw new FrodoError(
      'Error locking environment',
      lockFailureCause(cause, lockStatus)
    );
  }
  return lockStatus;
}

/**
 * Unlock environment.
 *
 * With wait set, the lock status is read first: an environment that is already
 * unlocked or unlocking is not asked to unlock again, the call waits for the
 * unlock and returns its status. A status that cannot be read does not end the
 * call: the unlock is requested as it would be without the check.
 *
 * Without wait, nothing is read first and the unlock is requested at once.
 *
 * Without a promotion id the id is read from the lock status, and an
 * environment that holds no lock has none: the call then throws instead of
 * returning the status. Pass the promotion id to unlock an environment that may
 * already be unlocked.
 * @param {string} promotionId Optional promotion id. If not specified, will pull it from the environment lock status, which throws when the environment holds no lock
 * @param {boolean} wait Whether to wait for the environment to unlock; an environment that is already unlocking is joined. Default: false
 * @param {number} pollInterval Time between status checks in milliseconds. Default: 10000
 * @param {number} timeout Timeout in milliseconds. Default: 15 * 60 * 1000
 * @returns {Promise<LockStatus>} a promise that resolves to a LockStatus object. Throws a FrodoError when the unlock ends in an error (its cause carries the status text), or does not finish in time.
 */
export async function unlockEnvironment({
  promotionId,
  wait = false,
  pollInterval = 10000,
  timeout = 15 * 60 * 1000,
  state,
}: {
  promotionId?: string;
  wait?: boolean;
  pollInterval?: number;
  timeout?: number;
  state: State;
}): Promise<LockStatus> {
  // the status that gave the promotion id is also the status before the request
  let statusBeforeRequest: LockStatus | undefined;
  if (!promotionId) {
    try {
      statusBeforeRequest = await readLockStatus({ state });
      promotionId = statusBeforeRequest.promotionId;
    } catch (e) {
      throw new FrodoError(
        'Failed to get promotion id to unlock environment.',
        e
      );
    }
    if (!promotionId) {
      throw new FrodoError(
        'Failed to get promotion id to unlock environment: the environment has no lock to release.'
      );
    }
  }
  let lockStatus: LockStatus;
  let cause: Error;
  const success = await waitForUpdate({
    initiateUpdate: async () => {
      // Without wait the unlock is requested whatever the tenant says; with
      // wait an environment that is already unlocked or unlocking is joined.
      lockStatus = wait
        ? (statusBeforeRequest ?? (await readLockStatusBeforeRequest(state)))
        : undefined;
      if (
        !lockStatus ||
        (lockStatus.result !== 'unlocked' && lockStatus.result !== 'unlocking')
      )
        lockStatus = await _unlockEnvironment({ promotionId, state });
      return {
        status: lockStatus.description,
        isComplete: ['unlocked', 'error'].includes(lockStatus.result),
        isError: lockStatus.result === 'error',
      };
    },
    isComplete: async () => {
      lockStatus = await readLockStatus({ state });
      // unlocked or failed: any other state (still unlocking, or not yet
      // started) is not the end of the unlock
      return {
        status: lockStatus.description,
        isComplete: ['unlocked', 'error'].includes(lockStatus.result),
        isError: lockStatus.result === 'error',
      };
    },
    initialMessage: 'Initiating environment unlock...',
    noWaitSuccessMessage: 'Environment unlock initiated.',
    waitSuccessMessage: (_, runtime) =>
      `Environment unlocked after ${Math.round(runtime / 1000)}s`,
    timeoutMessage: (isCompleted, runtime) =>
      `Environment unlock timed out after ${Math.round(
        runtime / 1000
      )}s with final message: ${isCompleted.status}`,
    errorMessage: (isCompleted, runtime) =>
      `Environment unlock error (elapsed time: ${Math.round(
        runtime / 1000
      )}s): ${isCompleted.status}`,
    wait,
    timeout,
    pollInterval,
    onError: (error) => (cause = error as Error),
    state,
  });
  if (!success) {
    throw new FrodoError(
      'Error unlocking environment',
      lockFailureCause(cause, lockStatus)
    );
  }
  return lockStatus;
}

/**
 * Read lock status
 * @param {boolean} localLockOnly True to show lock status of current environment. Default: false
 * @returns {Promise<LockStatus>} a promise that resolves to a LockStatus object
 */
export async function readLockStatus({
  localLockOnly = false,
  state,
}: {
  localLockOnly?: boolean;
  state: State;
}): Promise<LockStatus> {
  try {
    const response = await _getLockStatus({ localLockOnly, state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error reading lock status`, error);
  }
}

/**
 * Promote configuration
 * @param {PromotionRequestConfig} config Promotion request config.
 * @param {boolean} wait Whether to wait for the promotion to complete. Default: false
 * @param {number} pollInterval Time between status checks in milliseconds. Default: 10000
 * @param {number} timeout Timeout in milliseconds. Default: 45 * 60 * 1000
 * @returns {Promise<PromotionResponse>} a promise that resolves to a PromotionResponse object.
 */
export async function promoteConfiguration({
  config,
  wait = false,
  pollInterval = 10000,
  timeout = 45 * 60 * 1000,
  state,
}: {
  config: PromotionRequestConfig;
  wait?: boolean;
  pollInterval?: number;
  timeout?: number;
  state: State;
}): Promise<PromotionResponse> {
  let response: PromotionResponse;
  let cause: Error;
  const operation = config.dryRun ? 'Dry-run promotion' : 'Promotion';
  const isComplete = async () => {
    const promotionStatus = await readPromotionStatus({ state });
    return {
      status: promotionStatus.message,
      isComplete: isPromotionFinished(promotionStatus),
      isError: promotionStatus.status === 'ERROR',
    };
  };
  const success = await waitForUpdate({
    initiateUpdate: async () => {
      // If wait is false, we'll attempt to promote regardless of whether the tenant is already being promoted or not
      const promotionStatus = wait
        ? await readPromotionStatus({ state })
        : undefined;
      if (
        !promotionStatus ||
        promotionStatus.type !== 'promotion' ||
        promotionStatus.status !== 'RUNNING'
      )
        response = await _promoteConfiguration({ config, state });
      return wait
        ? await isComplete()
        : {
            isComplete: true,
            isError: false,
          };
    },
    isComplete,
    initialMessage: `Initiating ${operation.toLowerCase()}...`,
    noWaitSuccessMessage: `${operation} in progress.`,
    updateMessage: (isCompleted, runtime) =>
      `${operation} in progress (elapsed time: ${Math.round(
        runtime / 1000
      )}s): ${isCompleted.status}`,
    waitSuccessMessage: (isCompleted, runtime) =>
      `${operation} completed in ${Math.round(
        runtime / 1000
      )}s with final message: ${isCompleted.status}`,
    timeoutMessage: (isCompleted, runtime) =>
      `${operation} timed out after ${Math.round(
        runtime / 1000
      )}s with final message: ${isCompleted.status}`,
    errorMessage: (isCompleted, runtime) =>
      `${operation} error (elapsed time: ${Math.round(
        runtime / 1000
      )}s): ${isCompleted.status}`,
    wait,
    timeout,
    pollInterval,
    onError: (error) => (cause = error as Error),
    state,
  });
  if (!success) {
    throw new FrodoError('Error promoting configuration', cause);
  }
  return response;
}

/**
 * Read promotion status
 * @returns {Promise<PromotionStatusResponse>} a promise that resolves to a PromotionStatus object
 */
export async function readPromotionStatus({
  state,
}: {
  state: State;
}): Promise<PromotionStatusResponse> {
  try {
    const response = await _getPromotionStatus({ state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error reading promotion status`, error);
  }
}

/**
 * Read last promotion report
 * @returns {Promise<PromotionReport>} a promise that resolves to a PromotionReport object
 */
export async function readLastPromotionReport({
  state,
}: {
  state: State;
}): Promise<PromotionReport> {
  try {
    const report = await _getLastPromotionReport({ state });
    return report;
  } catch (error) {
    throw new FrodoError(`Error reading last promotion report`, error);
  }
}

/**
 * Read promotion report
 * @param {string} reportId Promotion id
 * @returns {Promise<PromotionReport>} a promise that resolves to a PromotionReport object
 */
export async function readPromotionReport({
  reportId,
  state,
}: {
  reportId: string;
  state: State;
}): Promise<PromotionReport> {
  try {
    const report = await _getPromotionReport({ reportId, state });
    return report;
  } catch (error) {
    throw new FrodoError(`Error reading promotion report ${reportId}`, error);
  }
}

/**
 * Run a provisional report of changes since the last time the lower environment was promoted to the upper environment.
 * The report generated is for informational purposes only and may not reflect all the changes in a full promotion.
 * A dry-run promotion is always recommended prior to a full promotion between environments.
 * @returns {Promise<PromotionReport>} a promise that resolves to a PromotionReport object
 */
export async function runProvisionalPromotionReport({
  state,
}: {
  state: State;
}): Promise<PromotionReport> {
  try {
    const report = await _getProvisionalPromotionReport({ state });
    return report;
  } catch (error) {
    throw new FrodoError(`Error reading provisional promotion report`, error);
  }
}

/**
 * Run a provisional rollback report of changes when we rollback the configuration to the previous promotion.
 * @returns {Promise<PromotionReport>} a promise that resolves to a PromotionReport object
 */
export async function runProvisionalRollbackReport({
  state,
}: {
  state: State;
}): Promise<PromotionReport> {
  try {
    const report = await _getProvisionalRollbackReport({ state });
    return report;
  } catch (error) {
    throw new FrodoError(`Error reading provisional rollback report`, error);
  }
}

/**
 * Read a list of promotion reports in date order.
 * @returns {Promise<PromotionReportStub[]>} a promise that resolves to an array of PromotionReportStub objects
 */
export async function readPromotionReports({
  state,
}: {
  state: State;
}): Promise<PromotionReportStub[]> {
  try {
    const reports = await _getPromotionReports({ state });
    return reports;
  } catch (error) {
    throw new FrodoError(`Error reading promotion reports`, error);
  }
}

/**
 * Rollback a promotion
 * @param {RollbackConfig} config Rollback config.
 * @param {boolean} wait Whether to wait for the rollback to complete. Default: false
 * @param {number} pollInterval Time between status checks in milliseconds. Default: 10000
 * @param {number} timeout Timeout in milliseconds. Default: 45 * 60 * 1000
 * @returns {Promise<RollbackResponse>} a promise that resolves to a RollbackResponse object.
 */
export async function rollbackPromotion({
  config,
  wait = false,
  pollInterval = 10000,
  timeout = 45 * 60 * 1000,
  state,
}: {
  config: RollbackConfig;
  wait?: boolean;
  pollInterval?: number;
  timeout?: number;
  state: State;
}): Promise<RollbackResponse> {
  let response: RollbackResponse;
  let cause: Error;
  const isComplete = async () => {
    const promotionStatus = await readPromotionStatus({ state });
    return {
      status: promotionStatus.message,
      isComplete: isPromotionFinished(promotionStatus),
      isError: promotionStatus.status === 'ERROR',
    };
  };
  const success = await waitForUpdate({
    initiateUpdate: async () => {
      // If wait is false, we'll attempt to rollback regardless of whether the tenant is already being rolled back or not
      const promotionStatus = wait
        ? await readPromotionStatus({ state })
        : undefined;
      if (
        !promotionStatus ||
        promotionStatus.type !== 'rollback' ||
        promotionStatus.status !== 'RUNNING'
      )
        response = await _rollbackPromotion({ config, state });
      return wait
        ? await isComplete()
        : {
            isComplete: true,
            isError: false,
          };
    },
    isComplete,
    initialMessage: `Initiating rollback...`,
    noWaitSuccessMessage: `Rollback in progress.`,
    updateMessage: (isCompleted, runtime) =>
      `Rollback in progress (elapsed time: ${Math.round(
        runtime / 1000
      )}s): ${isCompleted.status}`,
    waitSuccessMessage: (isCompleted, runtime) =>
      `Rollback completed in ${Math.round(
        runtime / 1000
      )}s with final message: ${isCompleted.status}`,
    timeoutMessage: (isCompleted, runtime) =>
      `Rollback timed out after ${Math.round(
        runtime / 1000
      )}s with final message: ${isCompleted.status}`,
    errorMessage: (isCompleted, runtime) =>
      `Rollback error (elapsed time: ${Math.round(
        runtime / 1000
      )}s): ${isCompleted.status}`,
    wait,
    timeout,
    pollInterval,
    onError: (error) => (cause = error as Error),
    state,
  });
  if (!success) {
    throw new FrodoError(
      config.promotionDescription
        ? `Error rolling back promotion '${config.promotionDescription}'`
        : 'Error rolling back promotion',
      cause
    );
  }
  return response;
}
