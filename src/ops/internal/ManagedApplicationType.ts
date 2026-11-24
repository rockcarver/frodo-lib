import constants from '../../shared/Constants';
import { State } from '../../shared/State';
import { debugMessage } from '../../utils/Console';

/**
 * The name of the managed object type that holds the application records of
 * one realm: `<realm>_application` on Cloud (and on ForgeOps with realm
 * prefixes, outside the root realm), `application` otherwise. The realm is
 * named by the caller, so the applications of every realm can be read without
 * switching the active realm.
 * @param {string} params.realmName name of the realm, the last component of its path (`alpha`), `/` for the root realm
 * @param {State} params.state the state
 * @returns {string} the managed object type of the application records of the realm
 */
export function getManagedApplicationTypeOfRealm({
  realmName,
  state,
}: {
  realmName: string;
  state: State;
}): string {
  let realmManagedApp = 'application';
  if (
    state.getDeploymentType() === constants.CLOUD_DEPLOYMENT_TYPE_KEY ||
    (state.getUseRealmPrefixOnManagedObjects() === true && realmName !== '/')
  ) {
    realmManagedApp = `${realmName}_application`;
    debugMessage({
      message: `DeploymentType === cloud or UseRealmPrefixOnManagedObjects is true, returning '${realmManagedApp}'`,
      state: state,
    });
  }
  return realmManagedApp;
}
