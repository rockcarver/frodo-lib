import { getOAuth2Provider } from '../api/OAuth2ProviderApi';
import { State } from '../shared/State';

export type OAuth2Provider = {
  getOAuth2Provider(): Promise<any>;
};

export default (state: State): OAuth2Provider => {
  return {
    async getOAuth2Provider() {
      return getOAuth2Provider({ state });
    },
  };
};

export { getOAuth2Provider };
