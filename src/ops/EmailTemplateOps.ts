import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import {
  deleteConfigEntity,
  getConfigEntity,
  putConfigEntity,
} from '../api/IdmConfigApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { readConfigEntitiesByType } from './IdmConfigOps';
import { ExportMetaData } from './OpsTypes';

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
   * @returns {Promise<EmailTemplateSkeleton[]>} a promise that resolves to an array of email template objects
   */
  readEmailTemplates(): Promise<EmailTemplateSkeleton[]>;
  /**
   * Get email template
   * @param {string} templateId id/name of the email template without the type prefix
   * @returns {Promise<EmailTemplateSkeleton>} a promise that resolves an email template object
   */
  readEmailTemplate(templateId: string): Promise<EmailTemplateSkeleton>;
  /**
   * Export all email templates. The response can be saved to file as is.
   * @returns {Promise<EmailTemplateExportInterface>} Promise resolving to a EmailTemplateExportInterface object.
   */
  exportEmailTemplates(): Promise<EmailTemplateExportInterface>;
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

  // Deprecated

  /**
   * Get all email templates
   * @returns {Promise<EmailTemplateSkeleton[]>} a promise that resolves to an array of email template objects
   * @deprecated since v2.0.0 use {@link EmailTemplate.readEmailTemplates | readEmailTemplates} instead
   * ```javascript
   * readEmailTemplates(): Promise<EmailTemplateSkeleton[]>
   * ```
   * @group Deprecated
   */
  getEmailTemplates(): Promise<EmailTemplateSkeleton[]>;
  /**
   * Get email template
   * @param {string} templateId id/name of the email template without the type prefix
   * @returns {Promise<EmailTemplateSkeleton>} a promise that resolves an email template object
   * @deprecated since v2.0.0 use {@link EmailTemplate.readEmailTemplate | readEmailTemplate} instead
   * ```javascript
   * readEmailTemplate(templateId: string): Promise<EmailTemplateSkeleton>
   * ```
   * @group Deprecated
   */
  getEmailTemplate(templateId: string): Promise<EmailTemplateSkeleton>;
  /**
   * Put email template
   * @param {string} templateId id/name of the email template without the type prefix
   * @param {Object} templateData email template object
   * @returns {Promise<EmailTemplateSkeleton>} a promise that resolves to an email template object
   * @deprecated since v2.0.0 use {@link EmailTemplate.updateEmailTemplate | updateEmailTemplate} or {@link EmailTemplate.createEmailTemplate | createEmailTemplate} instead
   * ```javascript
   * updateEmailTemplate(templateId: string, templateData: EmailTemplateSkeleton): Promise<EmailTemplateSkeleton>
   * createEmailTemplate(templateId: string, templateData: EmailTemplateSkeleton): Promise<EmailTemplateSkeleton>
   * ```
   * @group Deprecated
   */
  putEmailTemplate(
    templateId: string,
    templateData: EmailTemplateSkeleton
  ): Promise<EmailTemplateSkeleton>;
};

export default (state: State): EmailTemplate => {
  return {
    EMAIL_TEMPLATE_TYPE,
    createEmailTemplateExportTemplate(): EmailTemplateExportInterface {
      return createEmailTemplateExportTemplate({ state });
    },
    async readEmailTemplates(): Promise<any> {
      return readEmailTemplates({ state });
    },
    async readEmailTemplate(templateId: string): Promise<any> {
      return readEmailTemplate({ templateId, state });
    },
    async exportEmailTemplates(): Promise<EmailTemplateExportInterface> {
      return exportEmailTemplates({ state });
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
    async deleteEmailTemplates(): Promise<EmailTemplateSkeleton[]> {
      return deleteEmailTemplates({ state });
    },
    async deleteEmailTemplate(
      templateId: string
    ): Promise<EmailTemplateSkeleton> {
      return deleteEmailTemplate({ templateId, state });
    },

    // Deprecated

    async getEmailTemplates() {
      return readEmailTemplates({ state });
    },
    async getEmailTemplate(templateId: string) {
      return readEmailTemplate({ templateId, state });
    },
    async putEmailTemplate(
      templateId: string,
      templateData: EmailTemplateSkeleton
    ) {
      return updateEmailTemplate({ templateId, templateData, state });
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
 * @returns {Promise<EmailTemplateSkeleton[]>} a promise that resolves to an array of email template objects
 */
export async function readEmailTemplates({
  state,
}: {
  state: State;
}): Promise<EmailTemplateSkeleton[]> {
  const templates = await readConfigEntitiesByType({
    type: EMAIL_TEMPLATE_TYPE,
    state,
  });
  return templates as EmailTemplateSkeleton[];
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
  return getConfigEntity({
    entityId: `${EMAIL_TEMPLATE_TYPE}/${templateId}`,
    state,
  });
}

/**
 * Export all email templates. The response can be saved to file as is.
 * @returns {Promise<EmailTemplateExportInterface>} Promise resolving to a EmailTemplateExportInterface object.
 */
export async function exportEmailTemplates({
  state,
}: {
  state: State;
}): Promise<EmailTemplateExportInterface> {
  debugMessage({
    message: `EmailTemplateOps.exportEmailTemplates: start`,
    state,
  });
  const exportData = createEmailTemplateExportTemplate({ state });
  const emailTemplates = await readEmailTemplates({ state });
  createProgressIndicator({
    total: emailTemplates.length,
    message: 'Exporting email templates...',
    state,
  });
  for (const emailTemplate of emailTemplates) {
    const templateId = emailTemplate._id.replace(`${EMAIL_TEMPLATE_TYPE}/`, '');
    updateProgressIndicator({
      message: `Exporting email template ${templateId}`,
      state,
    });
    exportData.emailTemplate[templateId] = emailTemplate;
  }
  stopProgressIndicator({
    message: `Exported ${emailTemplates.length} email templates.`,
    state,
  });
  debugMessage({
    message: `EmailTemplateOps.exportEmailTemplates: end`,
    state,
  });
  return exportData;
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
  }
  throw new Error(`Email template ${templateId} already exists!`);
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
  return putConfigEntity({
    entityId: `${EMAIL_TEMPLATE_TYPE}/${templateId}`,
    entityData: templateData,
    state,
  });
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
  debugMessage({
    message: `EmailTemplateOps.deleteEmailTemplates: start`,
    state,
  });
  const result: EmailTemplateSkeleton[] = [];
  const templates = await readEmailTemplates({ state });
  for (const template of templates) {
    debugMessage({
      message: `EmailTemplateOps.deleteEmailTemplates: '${template['_id']}'`,
      state,
    });
    result.push(
      await deleteConfigEntity({
        entityId: template['_id'],
        state,
      })
    );
  }
  debugMessage({
    message: `EmailTemplateOps.deleteEmailTemplates: end`,
    state,
  });
  return result;
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
  return deleteConfigEntity({
    entityId: `${EMAIL_TEMPLATE_TYPE}/${templateId}`,
    state,
  });
}
