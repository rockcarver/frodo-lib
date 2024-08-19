import util from 'util';

import { State } from '../../shared/State';
import { getHostBaseUrl } from '../../utils/ForgeRockUtils';
import { generateEnvApi } from '../BaseApi';

const promotionURLTemplate = '%s/environment/promotion';
const lockEnvURLTemplate = `${promotionURLTemplate}/lock`;
const unlockEnvByIdURLTemplate = `${lockEnvURLTemplate}/%s`;
const lockStatusURLTemplate = `${lockEnvURLTemplate}/state`;
const promoteEnvURLTemplate = `${promotionURLTemplate}/promote`;
const rollbackURLTemplate = `${promotionURLTemplate}/rollback`;
const reportURLTemplate = `${promotionURLTemplate}/report`;
const reportByIdURLTemplate = `${reportURLTemplate}/%s`;
const provisionalPromotionReportURLTemplate = `${reportURLTemplate}/provisional`;
const provisionalRollbackReportURLTemplate = `${provisionalPromotionReportURLTemplate}-rollback`;
const reportsURLTemplate = `${promotionURLTemplate}/reports`;

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * Lock response
 */
export type LockResponse = {
  description: string;
  promotionId: string;
  result: string;
};

/**
 * Lock status
 */
export type LockStatus = {
  description: string;
  lowerEnv: {
    promotionId: string;
    proxyState: string;
    state: string;
  };
  promotionId: string;
  result: 'unlocked' | 'locking' | 'unlocking' | 'locked' | 'error';
  upperEnv: {
    promotionId: string;
    proxyState: string;
    state: string;
  };
};

/**
 * Promotion request config
 */
export type PromotionRequestConfig = {
  dryRun: boolean;
  ignoreEncryptedSecrets: boolean;
  promoter: string;
  promotionDescription: string;
  unlockEnvironmentsAfterPromotion: boolean;
  zendeskTicketReference: string;
};

/**
 * Promotion response
 */
export type PromotionResponse = {
  result: string;
};

export type PromotionType = 'promotion' | 'rollback';

/**
 * Promotion status
 */
export type PromotionStatus = {
  blockingError: boolean;
  encryptedSecrets: string[];
  globalLock: string; //'LOCKED';
  message: string;
  missingESVs: string[];
  promotionId: string;
  status: string; //'READY';
  timeStamp: string;
  type: PromotionType;
};

export type PromotionConfigChange = {
  name: string;
  realm: string;
  uid: string;
};

export type PromotionConfig = {
  configChange: {
    added: PromotionConfigChange[];
    deleted: PromotionConfigChange[];
    modified: PromotionConfigChange[];
  };
  configItem: string;
};

export type PromotionReport = {
  createdDate: string;
  dryRun: boolean;
  missingESVs: string[];
  previouslyIgnoredEncryptedSecrets: string[];
  promoter: string;
  promotionDescription: string;
  promotionId: string;
  report: {
    AMConfig: PromotionConfig[];
    IDMConfig: PromotionConfig[];
  };
  reportId: string;
  reportName: string;
  type: PromotionType;
};

export type PromotionReportStub = {
  createdDate: '2022-01-19T13:04:00Z';
  dryRun: true;
  promotionId: '7575f185-cd0b-4823-b8b1-f677895291d4';
  reportId: 'd19e140-8325-4669-b9f3-1cd82784e24e';
  type: 'rollback';
};

/**
 * Rollback request
 */
export type RollbackConfig = {
  promoter: string;
  promotionDescription: string;
  unlockEnvironmentsAfterPromotion: boolean;
  zendeskTicketReference: string;
};

/**
 * Rollback response
 */
export type RollbackResponse = {
  result: string;
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
  const urlString = util.format(
    lockEnvURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, {}, { withCredentials: true });
  return data;
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
  const urlString = util.format(
    unlockEnvByIdURLTemplate,
    getHostBaseUrl(state.getHost()),
    promotionId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get lock status
 * @returns {Promise<LockStatus>} a promise that resolves to a LockStatus object
 */
export async function getLockStatus({
  state,
}: {
  state: State;
}): Promise<LockStatus> {
  const urlString = util.format(
    lockStatusURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
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
  const urlString = util.format(
    lockEnvURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, config, { withCredentials: true });
  return data;
}

/**
 * Get promotion status
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<PromotionStatus>} a promise that resolves to a PromotionStatus object
 */
export async function getPromotionStatus({
  state,
}: {
  state: State;
}): Promise<PromotionStatus> {
  const urlString = util.format(
    promoteEnvURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get last promotion report
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<PromotionReport>} a promise that resolves to a PromotionReport object
 */
export async function getLastPromotionReport({
  state,
}: {
  state: State;
}): Promise<PromotionReport> {
  const urlString = util.format(
    reportURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get promotion report
 * @param {Object} params Parameters object.
 * @param {string} params.reportId Promotion id
 * @param {State} params.state State object.
 * @returns {Promise<PromotionReport>} a promise that resolves to a PromotionReport object
 */
export async function getPromotionReport({
  reportId,
  state,
}: {
  reportId: string;
  state: State;
}): Promise<PromotionReport> {
  const urlString = util.format(
    reportByIdURLTemplate,
    getHostBaseUrl(state.getHost()),
    reportId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get a provisional report of changes since the last time the lower environment was promoted to the upper environment.
 * The report generated is for informational purposes only and may not reflect all the changes in a full promotion.
 * A dry-run promotion is always recommended prior to a full promotion between environments.
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<PromotionReport>} a promise that resolves to a PromotionReport object
 */
export async function getProvisionalPromotionReport({
  state,
}: {
  state: State;
}): Promise<PromotionReport> {
  const urlString = util.format(
    provisionalPromotionReportURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get a provisional rollback report of changes when we rollback the configuration to the previous promotion.
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<PromotionReport>} a promise that resolves to a PromotionReport object
 */
export async function getProvisionalRollbackReport({
  state,
}: {
  state: State;
}): Promise<PromotionReport> {
  const urlString = util.format(
    provisionalRollbackReportURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get a list of promotion reports in date order.
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<PromotionReportStub[]>} a promise that resolves to an array of PromotionReportStub objects
 */
export async function getPromotionReports({
  state,
}: {
  state: State;
}): Promise<PromotionReportStub[]> {
  const urlString = util.format(
    reportsURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
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
  const urlString = util.format(
    rollbackURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, config, { withCredentials: true });
  return data;
}
