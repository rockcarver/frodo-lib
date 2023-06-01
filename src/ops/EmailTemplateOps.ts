import { EmailTemplateSkeleton } from '../api/ApiTypes';
import {
  getConfigEntitiesByType,
  getConfigEntity,
  putConfigEntity,
} from '../api/IdmConfigApi';
import State from '../shared/State';

/**
 * Email template type key used to build the IDM id: 'emailTemplate/<id>'
 */
export const EMAIL_TEMPLATE_TYPE = 'emailTemplate';

/**
 * Get all email templates
 * @returns {Promise} a promise that resolves to an array of email template objects
 */
export async function getEmailTemplates({ state }: { state: State }) {
  return getConfigEntitiesByType({ type: EMAIL_TEMPLATE_TYPE, state });
}

/**
 * Get email template
 * @param {string} templateId id/name of the email template without the type prefix
 * @returns {Promise} a promise that resolves an email template object
 */
export async function getEmailTemplate({
  templateId,
  state,
}: {
  templateId: string;
  state: State;
}) {
  return getConfigEntity({
    entityId: `${EMAIL_TEMPLATE_TYPE}/${templateId}`,
    state,
  });
}

/**
 * Put email template
 * @param {string} templateId id/name of the email template without the type prefix
 * @param {Object} templateData email template object
 * @returns {Promise} a promise that resolves to an email template object
 */
export async function putEmailTemplate({
  templateId,
  templateData,
  state,
}: {
  templateId: string;
  templateData: EmailTemplateSkeleton;
  state: State;
}) {
  return putConfigEntity({
    entityId: `${EMAIL_TEMPLATE_TYPE}/${templateId}`,
    entityData: templateData,
    state,
  });
}
