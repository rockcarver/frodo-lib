import util from 'util';

import { State } from '../shared/State';
import { getIdmBaseUrl } from '../utils/ForgeRockUtils';
import { IdObjectSkeletonInterface } from './ApiTypes';
import { generateIdmApi } from './BaseApi';

const getTermsUrl = '%s/config/selfservice.terms';

export interface TermsAndConditions extends IdObjectSkeletonInterface {
  active: string;
  uiConfig: {
    buttonText: string;
    displayName: string;
    purpose: string;
  };
  versions: Array<{
    createDate: string;
    termsTranslations: {
      [language: string]: string;
    };
    version: string;
  }>;
}

/**
 * Get terms and conditions
 * @returns {Promise<TermsAndConditions>} a promise that resolves to terms and conditions
 */
export async function restGetTermsAndConditions({ state }: { state: State }) {
  const urlString = util.format(getTermsUrl, getIdmBaseUrl(state));
  const { data } = await generateIdmApi({ state }).get(urlString);
  return data;
}
