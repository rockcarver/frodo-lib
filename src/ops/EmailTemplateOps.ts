import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import {
  deleteConfigEntity,
  getConfigEntity,
  putConfigEntity,
} from '../api/IdmConfigApi';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { FrodoError, isNotFoundError } from './FrodoError';
import {
  AIC_PROTECTED_ENTITIES,
  readConfigEntitiesByType,
} from './IdmConfigOps';
import { ExportMetaData, ResultCallback } from './OpsTypes';

export type EmailTemplate = {
  /**
   * Email template type key used to build the IDM id: 'emailTemplate/<id>'
   */
  EMAIL_TEMPLATE_TYPE: string;
  /**
   * Create an empty email template export template
   * @returns {EmailTemplateExportInterface} an empty email template export template
   */
  createEmailTemplateExportTemplate(): EmailTemplateExportInterface;
  /**
   * Get all email templates
   * @param {boolean} includeDefault Include default email templates if true, false to exclude them. Default: false
   * @returns {Promise<EmailTemplateSkeleton[]>} a promise that resolves to an array of email template objects
   */
  readEmailTemplates(
    includeDefault?: boolean
  ): Promise<EmailTemplateSkeleton[]>;
  /**
   * Get email template
   * @param {string} templateId id/name of the email template without the type prefix
   * @returns {Promise<EmailTemplateSkeleton>} a promise that resolves an email template object
   */
  readEmailTemplate(templateId: string): Promise<EmailTemplateSkeleton>;
  /**
   * Export all email templates. The response can be saved to file as is.
   * @param {boolean} includeDefault Include default email templates if true, false to exclude them. Default: false
   * @returns {Promise<EmailTemplateExportInterface>} Promise resolving to a EmailTemplateExportInterface object.
   */
  exportEmailTemplates(
    includeDefault?: boolean
  ): Promise<EmailTemplateExportInterface>;
  /**
   * Create email template
   * @param {string} templateId id/name of the email template without the type prefix
   * @param {EmailTemplateSkeleton} templateData email template object
   * @returns {Promise<EmailTemplateSkeleton>} a promise that resolves to an email template object
   */
  createEmailTemplate(
    templateId: string,
    templateData: EmailTemplateSkeleton
  ): Promise<EmailTemplateSkeleton>;
  /**
   * Update or create email template
   * @param {string} templateId id/name of the email template without the type prefix
   * @param {EmailTemplateSkeleton} templateData email template object
   * @returns {Promise<EmailTemplateSkeleton>} a promise that resolves to an email template object
   */
  updateEmailTemplate(
    templateId: string,
    templateData: EmailTemplateSkeleton
  ): Promise<EmailTemplateSkeleton>;
  /**
   * Import all email templates. Every email template is tried: a template that cannot be imported does not stop the others.
   * @param {EmailTemplateExportInterface} importData import data
   * @param {ResultCallback<EmailTemplateSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every email template is passed to it as it happens (a failed template as an error that names the template and carries the cause) and a failed template does not throw: the templates that were imported are returned. Without it, the failures are collected and thrown as one error after every template was tried.
   * @returns {Promise<IdObjectSkeletonInterface[]>} a promise resolving to an array of email template objects
   * @throws {FrodoError} If one or more email templates cannot be imported and there is no result callback. The error carries one nested error per failed template.
   */
  importEmailTemplates(
    importData: EmailTemplateExportInterface,
    resultCallback?: ResultCallback<EmailTemplateSkeleton>
  ): Promise<EmailTemplateSkeleton[]>;
  /**
   * Delete all email templates
   * @returns {Promise<EmailTemplateSkeleton[]>} a promise that resolves to an array of email template objects
   */
  deleteEmailTemplates(): Promise<EmailTemplateSkeleton[]>;
  /**
   * Delete email template
   * @param {string} templateId id/name of the email template without the type prefix 'emailTemplate/'
   * @returns {Promise<EmailTemplateSkeleton>} a promise that resolves an email template object
   */
  deleteEmailTemplate(templateId: string): Promise<EmailTemplateSkeleton>;
};

export default (state: State): EmailTemplate => {
  return {
    EMAIL_TEMPLATE_TYPE,
    createEmailTemplateExportTemplate(): EmailTemplateExportInterface {
      return createEmailTemplateExportTemplate({ state });
    },
    async readEmailTemplates(includeDefault: boolean = false): Promise<any> {
      return readEmailTemplates({ includeDefault, state });
    },
    async readEmailTemplate(templateId: string): Promise<any> {
      return readEmailTemplate({ templateId, state });
    },
    async exportEmailTemplates(
      includeDefault: boolean = false
    ): Promise<EmailTemplateExportInterface> {
      return exportEmailTemplates({ includeDefault, state });
    },
    async createEmailTemplate(
      templateId: string,
      templateData: EmailTemplateSkeleton
    ): Promise<any> {
      return createEmailTemplate({ templateId, templateData, state });
    },
    async updateEmailTemplate(
      templateId: string,
      templateData: EmailTemplateSkeleton
    ): Promise<any> {
      return updateEmailTemplate({ templateId, templateData, state });
    },
    importEmailTemplates(
      importData: EmailTemplateExportInterface,
      resultCallback: ResultCallback<EmailTemplateSkeleton> = undefined
    ): Promise<EmailTemplateSkeleton[]> {
      return importEmailTemplates({ importData, resultCallback, state });
    },
    async deleteEmailTemplates(): Promise<EmailTemplateSkeleton[]> {
      return deleteEmailTemplates({ state });
    },
    async deleteEmailTemplate(
      templateId: string
    ): Promise<EmailTemplateSkeleton> {
      return deleteEmailTemplate({ templateId, state });
    },
  };
};

/**
 * Email template type key used to build the IDM id: 'emailTemplate/<id>'
 */
export const EMAIL_TEMPLATE_TYPE = 'emailTemplate';

export type EmailTemplateSkeleton = IdObjectSkeletonInterface & {
  defaultLocale?: string;
  displayName?: string;
  enabled?: boolean;
  from: string;
  subject: Record<string, string>;
  message?: Record<string, string>;
  html?: Record<string, string>;
};

export interface EmailTemplateExportInterface {
  meta?: ExportMetaData;
  emailTemplate: Record<string, EmailTemplateSkeleton>;
}

export function createEmailTemplateExportTemplate({
  state,
}: {
  state: State;
}): EmailTemplateExportInterface {
  return {
    meta: getMetadata({ state }),
    emailTemplate: {},
  } as EmailTemplateExportInterface;
}

/**
 * Get all email templates
 * @param {boolean} includeDefault Include default email templates if true, false to exclude them. Default: false
 * @returns {Promise<EmailTemplateSkeleton[]>} a promise that resolves to an array of email template objects
 */
export async function readEmailTemplates({
  includeDefault = false,
  state,
}: {
  includeDefault?: boolean;
  state: State;
}): Promise<EmailTemplateSkeleton[]> {
  try {
    const templates = await readConfigEntitiesByType({
      type: EMAIL_TEMPLATE_TYPE,
      includeDefault,
      state,
    });
    return templates as EmailTemplateSkeleton[];
  } catch (error) {
    throw new FrodoError(`Error reading email templates`, error);
  }
}

/**
 * Get email template
 * @param {string} templateId id/name of the email template without the type prefix
 * @returns {Promise<EmailTemplateSkeleton>} a promise that resolves an email template object
 */
export async function readEmailTemplate({
  templateId,
  state,
}: {
  templateId: string;
  state: State;
}): Promise<EmailTemplateSkeleton> {
  try {
    return await getConfigEntity({
      entityId: `${EMAIL_TEMPLATE_TYPE}/${templateId}`,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error reading email template ${templateId}`, error);
  }
}

/**
 * Export all email templates. The response can be saved to file as is.
 * @param {boolean} includeDefault Include default email templates if true, false to exclude them. Default: false
 * @returns {Promise<EmailTemplateExportInterface>} Promise resolving to a EmailTemplateExportInterface object.
 */
export async function exportEmailTemplates({
  includeDefault = false,
  state,
}: {
  includeDefault: boolean;
  state: State;
}): Promise<EmailTemplateExportInterface> {
  try {
    debugMessage({
      message: `EmailTemplateOps.exportEmailTemplates: start`,
      state,
    });
    const exportData = createEmailTemplateExportTemplate({ state });
    const emailTemplates = await readEmailTemplates({ includeDefault, state });
    const indicatorId = createProgressIndicator({
      total: emailTemplates.length,
      message: 'Exporting email templates...',
      state,
    });
    for (const emailTemplate of emailTemplates) {
      const templateId = emailTemplate._id.replace(
        `${EMAIL_TEMPLATE_TYPE}/`,
        ''
      );
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting email template ${templateId}`,
        state,
      });
      exportData.emailTemplate[templateId] = emailTemplate;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${emailTemplates.length} email templates.`,
      state,
    });
    debugMessage({
      message: `EmailTemplateOps.exportEmailTemplates: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting email templates`, error);
  }
}

/**
 * Create email template
 * @param {string} templateId id/name of the email template without the type prefix
 * @param {EmailTemplateSkeleton} templateData email template object
 * @returns {Promise<EmailTemplateSkeleton>} a promise that resolves to an email template object
 */
export async function createEmailTemplate({
  templateId,
  templateData,
  state,
}: {
  templateId: string;
  templateData: EmailTemplateSkeleton;
  state: State;
}): Promise<EmailTemplateSkeleton> {
  debugMessage({
    message: `EmailTemplateOps.createEmailTemplate: start`,
    state,
  });
  try {
    await readEmailTemplate({
      templateId,
      state,
    });
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw new FrodoError(
        `Error checking if email template ${templateId} already exists`,
        error
      );
    }
    try {
      const result = await putConfigEntity({
        entityId: `${EMAIL_TEMPLATE_TYPE}/${templateId}`,
        entityData: templateData,
        state,
      });
      debugMessage({
        message: `EmailTemplateOps.createEmailTemplate: end`,
        state,
      });
      return result as EmailTemplateSkeleton;
    } catch (error) {
      throw new FrodoError(
        `Error creating email template ${templateId}`,
        error
      );
    }
  }
  throw new FrodoError(`Email template ${templateId} already exists!`);
}

/**
 * Update or create email template
 * @param {string} templateId id/name of the email template without the type prefix
 * @param {EmailTemplateSkeleton} templateData email template object
 * @returns {Promise<EmailTemplateSkeleton>} a promise that resolves to an email template object
 */
export async function updateEmailTemplate({
  templateId,
  templateData,
  state,
}: {
  templateId: string;
  templateData: EmailTemplateSkeleton;
  state: State;
}): Promise<EmailTemplateSkeleton> {
  try {
    const template = await putConfigEntity({
      entityId: `${EMAIL_TEMPLATE_TYPE}/${templateId}`,
      entityData: templateData,
      state,
    });
    return template as EmailTemplateSkeleton;
  } catch (error) {
    throw new FrodoError(`Error updating email template ${templateId}`, error);
  }
}

/**
 * Import all email templates. Every email template is tried: a template that cannot be imported does not stop the others.
 * @param {EmailTemplateExportInterface} importData email template import data.
 * @param {ResultCallback<EmailTemplateSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every email template is passed to it as it happens (a failed template as an error that names the template and carries the cause) and a failed template does not throw: the templates that were imported are returned. Without it, the failures are collected and thrown as one error after every template was tried.
 * @returns {Promise<SocialIdpSkeleton[]>} a promise resolving to an array of email template objects
 * @throws {FrodoError} If one or more email templates cannot be imported and there is no result callback. The error carries one nested error per failed template.
 */
export async function importEmailTemplates({
  importData,
  resultCallback = undefined,
  state,
}: {
  importData: EmailTemplateExportInterface;
  resultCallback?: ResultCallback<EmailTemplateSkeleton>;
  state: State;
}): Promise<EmailTemplateSkeleton[]> {
  debugMessage({
    message: `EmailTemplateOps.importEmailTemplates: start`,
    state,
  });
  const response = [];
  const errors = [];
  for (const templateId of Object.keys(importData.emailTemplate)) {
    let imported: EmailTemplateSkeleton;
    let failed = false;
    let failure: any;
    try {
      debugMessage({
        message: `EmailTemplateOps.importEmailTemplates: ${templateId}`,
        state,
      });
      imported = await updateEmailTemplate({
        templateId,
        templateData: importData.emailTemplate[templateId],
        state,
      });
    } catch (e) {
      failed = true;
      failure = e;
    }
    // the callback is called outside the try: an exception of the callback must
    // not be taken for a failed import and reported a second time
    if (!failed) {
      response.push(imported);
      if (resultCallback) resultCallback(undefined, imported);
    } else if (
      // protected entities (e.g. root realm email templates)
      !(
        state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY &&
        AIC_PROTECTED_ENTITIES.includes(
          `${EMAIL_TEMPLATE_TYPE}/${templateId}`
        ) &&
        failure.httpStatus === 403 &&
        failure.httpCode === 'ERR_BAD_REQUEST'
      )
    ) {
      if (resultCallback) {
        resultCallback(
          new FrodoError(
            `Error importing email template ${templateId}`,
            failure
          ),
          undefined
        );
      } else {
        errors.push(failure);
      }
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing email templates`, errors);
  }
  debugMessage({
    message: `EmailTemplateOps.importEmailTemplates: end`,
    state,
  });
  return response;
}

/**
 * Delete all email templates
 * @returns {Promise<EmailTemplateSkeleton[]>} a promise that resolves to an array of email template objects
 */
export async function deleteEmailTemplates({
  state,
}: {
  state: State;
}): Promise<EmailTemplateSkeleton[]> {
  const errors: Error[] = [];
  try {
    debugMessage({
      message: `EmailTemplateOps.deleteEmailTemplates: start`,
      state,
    });
    const result: EmailTemplateSkeleton[] = [];
    const templates = await readEmailTemplates({ state });
    for (const template of templates) {
      try {
        debugMessage({
          message: `EmailTemplateOps.deleteEmailTemplates: '${template['_id']}'`,
          state,
        });
        result.push(
          (await deleteConfigEntity({
            entityId: template['_id'],
            state,
          })) as EmailTemplateSkeleton
        );
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error deleting email templates`, errors);
    }
    debugMessage({
      message: `EmailTemplateOps.deleteEmailTemplates: end`,
      state,
    });
    return result;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error deleting email templates`, error);
  }
}

/**
 * Delete email template
 * @param {string} templateId id/name of the email template without the type prefix 'emailTemplate/'
 * @returns {Promise<EmailTemplateSkeleton>} a promise that resolves an email template object
 */
export async function deleteEmailTemplate({
  templateId,
  state,
}: {
  templateId: string;
  state: State;
}): Promise<EmailTemplateSkeleton> {
  try {
    const template = await deleteConfigEntity({
      entityId: `${EMAIL_TEMPLATE_TYPE}/${templateId}`,
      state,
    });
    return template as EmailTemplateSkeleton;
  } catch (error) {
    throw new FrodoError(`Error deleting email template ${templateId}`, error);
  }
}
