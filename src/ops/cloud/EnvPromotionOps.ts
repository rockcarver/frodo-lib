import {
  getLastPromotionReport as _getLastPromotionReport,
  getLockStatus as _getLockStatus,
  getPromotionReport as _getPromotionReport,
  getPromotionReports as _getPromotionReports,
  getPromotionStatus as _getPromotionStatus,
  getProvisionalPromotionReport as _getProvisionalPromotionReport,
  getProvisionalRollbackReport as _getProvisionalRollbackReport,
  lockEnvironment as _lockEnvironment,
  type LockResponse,
  type LockStatus,
  promoteConfiguration as _promoteConfiguration,
  type PromotionReport,
  type PromotionReportStub,
  type PromotionRequestConfig,
  type PromotionResponse,
  type PromotionStatus,
  type RollbackConfig,
  rollbackPromotion as _rollbackPromotion,
  type RollbackResponse,
  unlockEnvironment as _unlockEnvironment,
} from '../../api/cloud/EnvPromotionApi';
import { State } from '../../shared/State';
import { FrodoError } from '../FrodoError';

export type EnvPromotion = {
  /**
   * Lock environment
   * @returns {Promise<LockResponse>} a promise that resolves to a LockResponse object.
   */
  lockEnvironment(): Promise<LockResponse>;
  /**
   * Unlock environment
   * @param {string} promotionId Promotion id.
   * @returns {Promise<LockResponse>} a promise that resolves to a LockResponse object
   */
  unlockEnvironment(promotionId: string): Promise<LockResponse>;
  /**
   * Read lock status
   * @returns {Promise<LockStatus>} a promise that resolves to a LockStatus object
   */
  readLockStatus(): Promise<LockStatus>;
  /**
   * Promote configuration
   * @param {PromotionRequestConfig} config Promotion request config
   * @returns {Promise<PromotionResponse>} a promise that resolves to a PromotionResponse object.
   */
  promoteConfiguration(
    config: PromotionRequestConfig
  ): Promise<PromotionResponse>;
  /**
   * Read promotion status
   * @returns {Promise<PromotionStatus>} a promise that resolves to a PromotionStatus object
   */
  readPromotionStatus(): Promise<PromotionStatus>;
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
   * @param {RollbackConfig} config Rollback config
   * @returns {Promise<RollbackResponse>} a promise that resolves to a RollbackResponse object.
   */
  rollbackPromotion(config: RollbackConfig): Promise<RollbackResponse>;
};

export default (state: State): EnvPromotion => {
  return {
    async lockEnvironment(): Promise<LockResponse> {
      return lockEnvironment({ state });
    },
    async unlockEnvironment(promotionId: string): Promise<LockResponse> {
      return unlockEnvironment({ promotionId, state });
    },
    async readLockStatus(): Promise<LockStatus> {
      return readLockStatus({ state });
    },
    async promoteConfiguration(
      config: PromotionRequestConfig
    ): Promise<PromotionResponse> {
      return promoteConfiguration({ config, state });
    },
    async readPromotionStatus(): Promise<PromotionStatus> {
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
    async rollbackPromotion(config: RollbackConfig): Promise<RollbackResponse> {
      return rollbackPromotion({ config, state });
    },
  };
};

/**
 * Lock environment
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<LockResponse>} a promise that resolves to a LockResponse object.
 */
export async function lockEnvironment({
  state,
}: {
  state: State;
}): Promise<LockResponse> {
  try {
    const response = await _lockEnvironment({ state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error locking environment`, error);
  }
}

/**
 * Unlock environment
 * @param {Object} params Parameters object.
 * @param {string} params.promotionId Promotion id.
 * @param {State} params.state State object.
 * @returns {Promise<LockResponse>} a promise that resolves to a LockResponse object
 */
export async function unlockEnvironment({
  promotionId,
  state,
}: {
  promotionId: string;
  state: State;
}): Promise<LockResponse> {
  try {
    const response = await _unlockEnvironment({ promotionId, state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error unlocking environment`, error);
  }
}

/**
 * Read lock status
 * @returns {Promise<LockStatus>} a promise that resolves to a LockStatus object
 */
export async function readLockStatus({
  state,
}: {
  state: State;
}): Promise<LockStatus> {
  try {
    const response = await _getLockStatus({ state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error reading lock status`, error);
  }
}

/**
 * Promote configuration
 * @param {Object} params Parameters object.
 * @param {PromotionRequestConfig} params.config Promotion request config
 * @param {State} params.state State object.
 * @returns {Promise<PromotionResponse>} a promise that resolves to a PromotionResponse object.
 */
export async function promoteConfiguration({
  config,
  state,
}: {
  config: PromotionRequestConfig;
  state: State;
}): Promise<PromotionResponse> {
  try {
    const response = await _promoteConfiguration({ config, state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error promoting configuration`, error);
  }
}

/**
 * Read promotion status
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<PromotionStatus>} a promise that resolves to a PromotionStatus object
 */
export async function readPromotionStatus({
  state,
}: {
  state: State;
}): Promise<PromotionStatus> {
  try {
    const response = await _getPromotionStatus({ state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error reading promotion status`, error);
  }
}

/**
 * Read last promotion report
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
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
 * @param {Object} params Parameters object.
 * @param {string} params.reportId Promotion id
 * @param {State} params.state State object.
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
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
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
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
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
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
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
 * @param {Object} params Parameters object.
 * @param {RollbackConfig} params.config Rollback config
 * @param {State} params.state State object.
 * @returns {Promise<RollbackResponse>} a promise that resolves to a RollbackResponse object.
 */
export async function rollbackPromotion({
  config,
  state,
}: {
  config: RollbackConfig;
  state: State;
}): Promise<RollbackResponse> {
  try {
    const response = await _rollbackPromotion({ config, state });
    return response;
  } catch (error) {
    throw new FrodoError(
      `Error rolling back promotion '${config.promotionDescription}'`,
      error
    );
  }
}
