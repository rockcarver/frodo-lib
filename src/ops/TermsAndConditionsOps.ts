import {
  restGetTermsAndConditions,
  TermsAndConditions,
} from '../api/TermsAndConditionsApi';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { FrodoError } from './FrodoError';

export type Terms = {
  exportTermsAndConditions(): Promise<TermsAndConditions>;
};

export default (state: State): Terms => {
  return {
    exportTermsAndConditions() {
      return exportTermsAndConditions({ state });
    },
  };
};

/**
 * Export all terms and conditions. The response can be saved to file as is.
 * @returns Promise resolving to a ThemeExportInterface object.
 */
export async function exportTermsAndConditions({
  state,
}: {
  state: State;
}): Promise<TermsAndConditions> {
  try {
    debugMessage({
      message: `TermsAndConditions.exportTermsAndConditions: start`,
      state,
    });
    const terms = await restGetTermsAndConditions({ state });
    debugMessage({
      message: `TermsAndConditions.exportTermsAndConditions: end`,
      state,
    });
    return terms;
  } catch (error) {
    throw new FrodoError(`Error reading terms`, error);
  }
}
