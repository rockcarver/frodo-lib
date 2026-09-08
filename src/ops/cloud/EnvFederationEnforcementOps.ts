import {
  FederationEnforcement,
  getFederationEnforcement as _getFederationEnforcement,
  setFederationEnforcement as _setFederationEnforcement,
} from '../../api/cloud/EnvFederationEnforcementApi';
import { State } from '../../shared/State';
import { FrodoError } from '../FrodoError';

// Deliberately given `requiredScopes: []` at the api layer
// (api/cloud/EnvFederationEnforcementApi.ts's call to generateEnvApi())
// rather than a real scope. Access here is gated by AIC's own internal
// admin-role framework (Super Admin, Tenant Admin, Tenant Auditor, Brand
// Admin, and future roles) — an authorization dimension that is not
// currently expressed as an OAuth2 scope at all. The role is carried on a
// teammember's own record as a `groups`/`effectiveGroups` claim (e.g.
// `"groups": ["super-admins"]`), not on the access token. There is no scope
// value that correctly represents "caller must hold the super-admin role."
// A real gate for this module needs a role-based check (read the caller's
// own teammember record's groups/effectiveGroups) instead — open research
// question: can any admin read their own roles, or only a super admin can
// query this? See the `frodo-mcp-phase-g-audience-rename-todo` memory for
// the related discussion.

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
