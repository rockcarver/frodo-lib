import {
  FederationEnforcement,
  getFederationEnforcement as _getFederationEnforcement,
  setFederationEnforcement as _setFederationEnforcement,
} from '../../api/cloud/EnvFederationEnforcementApi';
import { State } from '../../shared/State';
import { FrodoError } from '../FrodoError';

export type EnvFederationEnforcement = {
  /**
   * Read federation enforcement configuration
   * @returns {Promise<FederationEnforcement>} a promise that resolves to a FederationEnforcement object
   */
  readFederationEnforcement(): Promise<FederationEnforcement>;
  /**
   * Update federation enforcement configuration
   * @param {FederationEnforcement} config FederationEnforcement object
   * @returns {Promise<FederationEnforcement>} a promise that resolves to a FederationEnforcement object.
   */
  updateFederationEnforcement(
    config: FederationEnforcement
  ): Promise<FederationEnforcement>;
  /**
   * Enforce federation for a group of admins
   * @param {EnforcementGroup} group Group of admins to enforce federation for
   * @returns {Promise<FederationEnforcement>} a promise that resolves to a FederationEnforcement object.
   */
  enforceFederationFor(group: EnforcementGroup): Promise<FederationEnforcement>;
};

export default (state: State): EnvFederationEnforcement => {
  return {
    async readFederationEnforcement(): Promise<FederationEnforcement> {
      return readFederationEnforcement({ state });
    },
    async updateFederationEnforcement(
      config: FederationEnforcement
    ): Promise<FederationEnforcement> {
      return updateFederationEnforcement({ config, state });
    },
    async enforceFederationFor(
      group: EnforcementGroup
    ): Promise<FederationEnforcement> {
      return enforceFederationFor({ group, state });
    },
  };
};

/**
 * Read federation enforcement configuration
 * @returns {Promise<FederationEnforcement>} a promise that resolves to a FederationEnforcement object
 */
export async function readFederationEnforcement({
  state,
}: {
  state: State;
}): Promise<FederationEnforcement> {
  try {
    const domains = await _getFederationEnforcement({ state });
    return domains;
  } catch (error) {
    throw new FrodoError(
      `Error reading federation enforcement configuration`,
      error
    );
  }
}

/**
 * Update federation enforcement configuration
 * @param {Object} params Parameters object.
 * @param {FederationEnforcement} params.config FederationEnforcement object
 * @param {State} params.state State object.
 * @returns {Promise<FederationEnforcement>} a promise that resolves to a FederationEnforcement object.
 */
export async function updateFederationEnforcement({
  config,
  state,
}: {
  config: FederationEnforcement;
  state: State;
}): Promise<FederationEnforcement> {
  try {
    const result = await _setFederationEnforcement({ config, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error updating federation enforcement configuration`,
      error
    );
  }
}

export enum EnforcementGroup {
  Nobody = 'none',
  TenantAdmins = 'non-global',
  AllAdmins = 'all',
}

/**
 * Update federation enforcement configuration
 * @param {Object} params Parameters object.
 * @param {EnforcementGroup} params.group Group of admins to enforce federation for
 * @param {State} params.state State object.
 * @returns {Promise<FederationEnforcement>} a promise that resolves to a FederationEnforcement object.
 */
export async function enforceFederationFor({
  group,
  state,
}: {
  group: EnforcementGroup;
  state: State;
}): Promise<FederationEnforcement> {
  try {
    const result = await _setFederationEnforcement({
      config: { groups: group },
      state,
    });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error updating federation enforcement configuration`,
      error
    );
  }
}
