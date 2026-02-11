import util from 'util';

import { State } from '../../../shared/State';
import { postApiSearchAll } from '../../../utils/ExportImportUtils';
import { getHostOnlyUrl } from '../../../utils/ForgeRockUtils';
import { Metadata, SearchTargetFilterOperation } from '../../ApiTypes';
import { generateGovernanceApi } from '../../BaseApi';

const certificationTemplatesEndpointURLTemplate =
  '%s/iga/governance/certification/template';
const searchCertificationTemplatesURLTemplate =
  certificationTemplatesEndpointURLTemplate + '/search';
const certificationTemplateURLTemplate =
  certificationTemplatesEndpointURLTemplate + '/%s';

export type CertificationTemplateType =
  | 'identity'
  | 'entitlement'
  | 'entitlementComposition'
  | 'roleMembership'
  | 'role-definition'
  | 'application';

export interface UserInfo {
  id: string;
  mail: string;
  userName: string;
  givenName: string;
  sn: string;
}

export interface RoleInfo {
  id: string;
  name: string;
}

export interface EmailTemplateNotificationEvent {
  notification: string;
  frequency?: number;
  includeActor?: boolean;
  includeManager?: boolean;
  day?: number;
  action?: string;
  actors?: { type: string; id: string }[];
}

export type ObjectInfo = UserInfo | RoleInfo;

export interface CertificationTemplateSkeleton {
  id: string;
  status: 'pending' | 'active';
  name: string;
  description: string;
  isEventBased: boolean;
  stagingEnabled: boolean;
  // This is a scheduled job object
  schedule?: {
    _id: string;
    enabled: boolean;
    persisted: boolean;
    recoverable: boolean;
    misfirePolicy: 'fireAndProceed' | 'doNothing';
    schedule: string | null;
    repeatInterval: number;
    repeatCount: number;
    type: 'simple' | 'cron';
    invokeService: string;
    invokeContext: {
      script: {
        globals: {
          scanType?: string;
          templateId?: string;
        };
        type: 'text/javascript';
        source: string;
      };
      numberOfThreads?: number;
      scan?: {
        object: string;
        taskState: {
          started: string;
          completed: string;
        };
        _queryFilter: string;
      };
    };
    invokeLogLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';
    startTime: string | null;
    endTime: string | null;
    concurrentExecution: boolean;
    previousRunDate: string | null;
    nextRunDate: string | null;
    triggers: object[];
  } | null;
  skipInactiveCertifiers: boolean;
  allowSelfCertification: boolean;
  selfCertificationRule: 'none' | 'restricted' | 'all';
  enableForward: boolean;
  enableReassign: boolean;
  exceptionDuration: number;
  allowBulkCertify: boolean;
  allowPartialSignoff: boolean;
  remediationRule: string | null;
  initializeRule: string;
  finalizeRule: string;
  certificationType: CertificationTemplateType;
  ownerId: string;
  stageDuration: number;
  expirationAction: string | null;
  expirationActionDelay: number;
  expirationReassignee: string | null;
  defaultCertifierId: string | null;
  assignmentNotification: string | null;
  assignmentNotificationIncludeManager: boolean;
  reassignNotification: string | null;
  expirationNotification: string | null;
  reminderNotification: string | null;
  reminderFrequency: number | null;
  escalationNotification: string | null;
  escalationFrequency: number | null;
  escalationOwner: string | null;
  remediationDelay: number;
  excludeConditionalAccess: boolean;
  excludeRoleBasedAccess: boolean;
  scheduleId?: string;
  metadata?: Metadata;
  reassignPermissions: {
    certify: boolean;
    comment: boolean;
    claim: boolean;
    delegate: boolean;
    exception: boolean;
    forward: boolean;
    reassign: boolean;
    reset: boolean;
    revoke: boolean;
    save: boolean;
    signoff: boolean;
  };
  stages: {
    certifierId: string | null;
    certifierType:
      | 'user'
      | 'custom'
      | 'organization'
      | 'manager'
      | 'authzGroup';
    certifierScript: string | null;
    certifierPath: string | null;
    certifierInfo?: ObjectInfo;
  }[];
  targetFilter: {
    type: (
      | 'accountGrant'
      | 'entitlementGrant'
      | 'roleMembership'
      | 'AccountGrant'
      | 'ResourceGrant'
      | 'entitlement'
    )[];
    user?: SearchTargetFilterOperation;
    application?: SearchTargetFilterOperation;
    account: SearchTargetFilterOperation;
    memberOfOrg: string[];
    entitlement?: SearchTargetFilterOperation;
    role?: SearchTargetFilterOperation;
    decision: SearchTargetFilterOperation;
  };
  requireJustification: {
    revoke: boolean;
    exceptionAllowed: boolean;
  };
  uiConfig: {
    columnConfig: {
      accounts?: string[];
      entitlements?: string[];
      roles?: string[];
    };
  };
  events: {
    assignment?: EmailTemplateNotificationEvent;
    reassign?: EmailTemplateNotificationEvent;
    reminder?: EmailTemplateNotificationEvent;
    escalation?: EmailTemplateNotificationEvent;
    expirationNotification?: EmailTemplateNotificationEvent;
  };
  ownerInfo: UserInfo;
  defaultCertifierInfo: UserInfo;
  expirationReassigneeInfo?: UserInfo;
  escalationOwnerInfo?: UserInfo;
  expirationNotificationDay: number;
  // These attributes are unique to IGA event certification templates
  templateEventType?: string;
  parameters?: {
    id: string;
    displayName: string;
    type: string;
  }[];
}

export interface CertificationTemplateDeleteSkeleton {
  indexName: string;
  indices: {
    latest: string;
  };
}

/**
 * Get certification template
 * @param {string} templateId The certification template id
 * @returns {Promise<CertificationTemplateSkeleton>} A promise that resolves to a certification template object
 */
export async function getCertificationTemplate({
  templateId,
  state,
}: {
  templateId: string;
  state: State;
}): Promise<CertificationTemplateSkeleton> {
  const urlString = util.format(
    certificationTemplateURLTemplate,
    getHostOnlyUrl(state.getHost()),
    templateId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get all certification templates, excluding those used by IGA events.
 * @returns {Promise<CertificationTemplateSkeleton[]>} A promise that resolves to an array of certification template objects
 */
export async function getCertificationTemplates({
  state,
}: {
  state: State;
}): Promise<CertificationTemplateSkeleton[]> {
  const urlString = util.format(
    certificationTemplatesEndpointURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Search all certification templates, including those used by IGA events.
 * @param {SearchTargetFilterOperation} targetFilter Optional filter to filter the search results. If no filter supplied, will return all
 * @returns {Promise<CertificationTemplateSkeleton[]>} a promise that resolves to an object containing an array of certification template objects
 */
export async function searchCertificationTemplates({
  targetFilter,
  state,
}: {
  targetFilter?: SearchTargetFilterOperation;
  state: State;
}): Promise<CertificationTemplateSkeleton[]> {
  const urlString = util.format(
    searchCertificationTemplatesURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  return await postApiSearchAll({
    url: urlString,
    targetFilter,
    state,
  });
}

/**
 * Create certification template
 * @param {CertificationTemplateSkeleton} templateData The certification template data
 * @returns {Promise<CertificationTemplateSkeleton>} A promise that resolves to a certification template object
 */
export async function createCertificationTemplate({
  templateData,
  state,
}: {
  templateData: CertificationTemplateSkeleton;
  state: State;
}): Promise<CertificationTemplateSkeleton> {
  const urlString = util.format(
    certificationTemplatesEndpointURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).post(urlString, templateData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put certification template
 * @param {string} templateId The certification template id
 * @param {CertificationTemplateSkeleton} templateData The certification template data
 * @returns {Promise<CertificationTemplateSkeleton>} A promise that resolves to a certification template object
 */
export async function putCertificationTemplate({
  templateId,
  templateData,
  state,
}: {
  templateId: string;
  templateData: CertificationTemplateSkeleton;
  state: State;
}): Promise<CertificationTemplateSkeleton> {
  const urlString = util.format(
    certificationTemplateURLTemplate,
    getHostOnlyUrl(state.getHost()),
    templateId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).put(urlString, templateData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete certification template
 * @param {string} templateId The certification template id
 * @returns {Promise<CertificationTemplateDeleteSkeleton>} A promise that resolves to a certification template object
 */
export async function deleteCertificationTemplate({
  templateId,
  state,
}: {
  templateId: string;
  state: State;
}): Promise<CertificationTemplateDeleteSkeleton> {
  const urlString = util.format(
    certificationTemplateURLTemplate,
    getHostOnlyUrl(state.getHost()),
    templateId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
