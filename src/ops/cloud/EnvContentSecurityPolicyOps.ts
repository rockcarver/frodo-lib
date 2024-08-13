import {
  ContentSecurityPolicy,
  getEnforcedContentSecurityPolicy as _getEnforcedContentSecurityPolicy,
  getReportOnlyContentSecurityPolicy as _getReportOnlyContentSecurityPolicy,
  setEnforcedContentSecurityPolicy as _setEnforcedContentSecurityPolicy,
  setReportOnlyContentSecurityPolicy as _setReportOnlyContentSecurityPolicy,
} from '../../api/cloud/EnvContentSecurityPolicyApi';
import { State } from '../../shared/State';
import { FrodoError } from '../FrodoError';

export type EnvContentSecurityPolicy = {
  /**
   * Read enforced content security policy
   * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object
   */
  readEnforcedContentSecurityPolicy(): Promise<ContentSecurityPolicy>;
  /**
   * Update enforced content security policy
   * @param {ContentSecurityPolicy} policy ContentSecurityPolicy object
   * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object.
   */
  updateEnforcedContentSecurityPolicy(
    policy: ContentSecurityPolicy
  ): Promise<ContentSecurityPolicy>;
  /**
   * Read report-only content security policy
   * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object
   */
  readReportOnlyContentSecurityPolicy(): Promise<ContentSecurityPolicy>;
  /**
   * Update report-only content security policy
   * @param {ContentSecurityPolicy} policy ContentSecurityPolicy object
   * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object.
   */
  updateReportOnlyContentSecurityPolicy(
    policy: ContentSecurityPolicy
  ): Promise<ContentSecurityPolicy>;
};

export default (state: State): EnvContentSecurityPolicy => {
  return {
    async readEnforcedContentSecurityPolicy(): Promise<ContentSecurityPolicy> {
      return readEnforcedContentSecurityPolicy({ state });
    },
    async updateEnforcedContentSecurityPolicy(
      policy: ContentSecurityPolicy
    ): Promise<ContentSecurityPolicy> {
      return updateEnforcedContentSecurityPolicy({ policy, state });
    },
    async readReportOnlyContentSecurityPolicy(): Promise<ContentSecurityPolicy> {
      return readReportOnlyContentSecurityPolicy({ state });
    },
    async updateReportOnlyContentSecurityPolicy(
      policy: ContentSecurityPolicy
    ): Promise<ContentSecurityPolicy> {
      return updateReportOnlyContentSecurityPolicy({ policy, state });
    },
  };
};

/**
 * Read enforced content security policy
 * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object
 */
export async function readEnforcedContentSecurityPolicy({
  state,
}: {
  state: State;
}): Promise<ContentSecurityPolicy> {
  try {
    const policy = await _getEnforcedContentSecurityPolicy({ state });
    return policy;
  } catch (error) {
    throw new FrodoError(
      `Error reading enforced content security policy`,
      error
    );
  }
}

/**
 * Update enforced content security policy
 * @param {Object} params Parameters object.
 * @param {ContentSecurityPolicy} params.policy ContentSecurityPolicy object
 * @param {State} params.state State object.
 * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object.
 */
export async function updateEnforcedContentSecurityPolicy({
  policy,
  state,
}: {
  policy: ContentSecurityPolicy;
  state: State;
}): Promise<ContentSecurityPolicy> {
  try {
    const result = await _setEnforcedContentSecurityPolicy({ policy, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error updating enforced content security policy`,
      error
    );
  }
}

/**
 * Enable enforced content security policy
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object.
 */
export async function enableEnforcedContentSecurityPolicy({
  state,
}: {
  state: State;
}): Promise<ContentSecurityPolicy> {
  try {
    const policy = await readEnforcedContentSecurityPolicy({ state });
    policy.active = true;
    const result = await _setEnforcedContentSecurityPolicy({ policy, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error enabling enforced content security policy`,
      error
    );
  }
}

/**
 * Enable enforced content security policy
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object.
 */
export async function disableEnforcedContentSecurityPolicy({
  state,
}: {
  state: State;
}): Promise<ContentSecurityPolicy> {
  try {
    const policy = await readEnforcedContentSecurityPolicy({ state });
    policy.active = false;
    const result = await _setEnforcedContentSecurityPolicy({ policy, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error disabling enforced content security policy`,
      error
    );
  }
}

/**
 * Read report-only content security policy
 * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object
 */
export async function readReportOnlyContentSecurityPolicy({
  state,
}: {
  state: State;
}): Promise<ContentSecurityPolicy> {
  try {
    const policy = await _getReportOnlyContentSecurityPolicy({ state });
    return policy;
  } catch (error) {
    throw new FrodoError(
      `Error reading report-only content security policy`,
      error
    );
  }
}

/**
 * Update report-only content security policy
 * @param {Object} params Parameters object.
 * @param {ContentSecurityPolicy} params.policy ContentSecurityPolicy object
 * @param {State} params.state State object.
 * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object.
 */
export async function updateReportOnlyContentSecurityPolicy({
  policy,
  state,
}: {
  policy: ContentSecurityPolicy;
  state: State;
}): Promise<ContentSecurityPolicy> {
  try {
    const result = await _setReportOnlyContentSecurityPolicy({ policy, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error updating report-only content security policy`,
      error
    );
  }
}

/**
 * Enable report-only content security policy
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object.
 */
export async function enableReportOnlyContentSecurityPolicy({
  state,
}: {
  state: State;
}): Promise<ContentSecurityPolicy> {
  try {
    const policy = await readReportOnlyContentSecurityPolicy({ state });
    policy.active = true;
    const result = await _setReportOnlyContentSecurityPolicy({ policy, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error enabling report-only content security policy`,
      error
    );
  }
}

/**
 * Enable report-ony content security policy
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object.
 */
export async function disableReportOnlyContentSecurityPolicy({
  state,
}: {
  state: State;
}): Promise<ContentSecurityPolicy> {
  try {
    const policy = await readReportOnlyContentSecurityPolicy({ state });
    policy.active = false;
    const result = await _setReportOnlyContentSecurityPolicy({ policy, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error disabling report-only content security policy`,
      error
    );
  }
}
