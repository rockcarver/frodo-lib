import {
  getConfigEntitiesByType,
  getConfigEntity,
  putConfigEntity,
} from './IdmConfigApi';

/**
 * Email template type key used to build the IDM id: 'emailTemplate/<id>'
 */
export const EMAIL_TEMPLATE_TYPE = 'emailTemplate';

/**
 * Get all email templates
 * @returns {Promise} a promise that resolves to an array of email template objects
 */
export async function getEmailTemplates() {
  return getConfigEntitiesByType(EMAIL_TEMPLATE_TYPE);
}

/**
 * Get email template
 * @param {string} templateId id/name of the email template without the type prefix
 * @returns {Promise} a promise that resolves an email template object
 */
export async function getEmailTemplate(templateId) {
  return getConfigEntity(`${EMAIL_TEMPLATE_TYPE}/${templateId}`);
}

/**
 * Put email template
 * @param {string} templateId id/name of the email template without the type prefix
 * @param {Object} templateData email template object
 * @returns {Promise} a promise that resolves to an email template object
 */
export async function putEmailTemplate(templateId, templateData) {
  return putConfigEntity(`${EMAIL_TEMPLATE_TYPE}/${templateId}`, templateData);
}
