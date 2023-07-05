import { getOAuth2Provider } from '../api/OAuth2ProviderApi';
import State from '../shared/State';

export default (state: State) => {
  return {
    async getOAuth2Provider() {
      return getOAuth2Provider({ state });
    },
  };
};

export { getOAuth2Provider };
