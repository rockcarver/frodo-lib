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
import { FrodoError } from './FrodoError';
import {
  AIC_PROTECTED_ENTITIES,
  readConfigEntitiesByType,
} from './IdmConfigOps';
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
  readEmailTemplates(
    onlyVisibleTemplates?: boolean
  ): Promise<EmailTemplateSkeleton[]>;
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
   * Import all email templates
   * @param {EmailTemplateExportInterface} importData import data
   * @returns {Promise<IdObjectSkeletonInterface[]>} a promise resolving to an array of email template objects
   */
  importEmailTemplates(
    importData: EmailTemplateExportInterface
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
    async readEmailTemplates(onlyVisibleTemplates?): Promise<any> {
      return readEmailTemplates({ state, onlyVisibleTemplates });
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
    importEmailTemplates(
      importData: EmailTemplateExportInterface
    ): Promise<EmailTemplateSkeleton[]> {
      return importEmailTemplates({ importData, state });
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
  onlyVisibleTemplates,
}: {
  state: State;
  onlyVisibleTemplates?: boolean;
}): Promise<EmailTemplateSkeleton[]> {
  try {
    const templates = await readConfigEntitiesByType({
      type: EMAIL_TEMPLATE_TYPE,
      state,
      onlyVisibleTemplates,
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
    return getConfigEntity({
      entityId: `${EMAIL_TEMPLATE_TYPE}/${templateId}`,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error reading email template ${templateId}`, error);
  }
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
  try {
    debugMessage({
      message: `EmailTemplateOps.exportEmailTemplates: start`,
      state,
    });
    const exportData = createEmailTemplateExportTemplate({ state });
    const emailTemplates = await readEmailTemplates({ state });
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
 * Import email templates.
 * @param {EmailTemplateExportInterface} importData email template import data.
 * @returns {Promise<SocialIdpSkeleton[]>} a promise resolving to an array of email template objects
 */
export async function importEmailTemplates({
  importData,
  state,
}: {
  importData: EmailTemplateExportInterface;
  state: State;
}): Promise<EmailTemplateSkeleton[]> {
  debugMessage({
    message: `EmailTemplateOps.importEmailTemplates: start`,
    state,
  });
  const response = [];
  const errors = [];
  for (const templateId of Object.keys(importData.emailTemplate)) {
    try {
      debugMessage({
        message: `EmailTemplateOps.importEmailTemplates: ${templateId}`,
        state,
      });
      response.push(
        await updateEmailTemplate({
          templateId,
          templateData: importData.emailTemplate[templateId],
          state,
        })
      );
    } catch (e) {
      if (
        // protected entities (e.g. root realm email templates)
        !(
          state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY &&
          AIC_PROTECTED_ENTITIES.includes(
            `${EMAIL_TEMPLATE_TYPE}/${templateId}`
          ) &&
          e.httpStatus === 403 &&
          e.httpCode === 'ERR_BAD_REQUEST'
        )
      ) {
        errors.push(e);
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
