import util from 'util';

import { State } from '../../shared/State';
import { getHostBaseUrl } from '../../utils/ForgeRockUtils';
import { generateEnvApi } from '../BaseApi';

const enforcedPolicyURLTemplate =
  '%s/environment/content-security-policy/enforced';
const reportOnlyPolicyURLTemplate =
  '%s/environment/content-security-policy/report-only';

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

export type DirectiveEnabled = [];

export type DirectiveSource = string;

export type AllFlag = '*';

export type AllowDuplicatesFlag = "'allow-duplicates'";

export type NoneFlag = "'none'";

export type ScriptFlag = "'script'";

export type SelfFlag = "'self'";

export type DirectiveFlag = AllFlag | NoneFlag | SelfFlag | DirectiveSource;

export type DirectiveSourceFlag =
  | 'data:'
  | "'unsafe-inline'"
  | "'unsafe-eval'"
  // | "'strict-dynamic'"
  | "'unsafe-hashes'"
  | DirectiveFlag;

export type SandboxDirectiveFlag =
  | "'allow-forms'"
  | "'allow-same-origin'"
  | "'allow-scripts'"
  | "'allow-popups'"
  // | "'allow-modals'"
  // | "'allow-orientation-lock'"
  | "'allow-pointer-lock'"
  // | "'allow-presentation'"
  // | "'allow-popups-to-escape-sandbox'"
  | "'allow-top-navigation'";

export type RefererDirectiveFlag =
  | "'no-referrer'"
  | "'none-when-downgrade'"
  | "'origin'"
  | "'origin-when-cross-origin'"
  | "'unsafe-url'";

/**
 * Content Security Policy object
 */
export type ContentSecurityPolicy = {
  active: boolean;
  directives: {
    'base-uri'?: DirectiveFlag[];
    'block-all-mixed-content'?: DirectiveEnabled;
    'child-src'?: DirectiveSourceFlag[];
    'connect-src'?: DirectiveSourceFlag[];
    'default-src'?: DirectiveSourceFlag[];
    'font-src'?: DirectiveSourceFlag[];
    'form-action'?: DirectiveFlag[];
    'frame-ancestors'?: DirectiveFlag[];
    'frame-src'?: DirectiveSourceFlag[];
    'img-src'?: DirectiveSourceFlag[];
    'manifest-src'?: DirectiveSourceFlag[];
    'media-src'?: DirectiveSourceFlag[];
    'navigate-to'?: DirectiveFlag[];
    'object-src'?: DirectiveSourceFlag[];
    'plugin-types'?: DirectiveSource[];
    'prefetch-src'?: DirectiveSourceFlag[];
    referrer?: RefererDirectiveFlag[];
    'report-to'?: DirectiveSource;
    'report-uri'?: DirectiveSource;
    'require-trusted-types-for'?: ScriptFlag;
    sandbox?: SandboxDirectiveFlag[];
    'script-src'?: DirectiveSourceFlag[];
    'script-src-attr'?: DirectiveSourceFlag[];
    'script-src-elem'?: DirectiveSourceFlag[];
    'style-src'?: DirectiveSourceFlag[];
    'style-src-attr'?: DirectiveSourceFlag[];
    'style-src-elem'?: DirectiveSourceFlag;
    'trusted-types'?: NoneFlag | AllowDuplicatesFlag;
    'upgrade-insecure-requests'?: DirectiveEnabled;
    'worker-src'?: DirectiveSourceFlag[];
  };
};

/**
 * Get enforced content security policy
 * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object
 */
export async function getEnforcedContentSecurityPolicy({
  state,
}: {
  state: State;
}): Promise<ContentSecurityPolicy> {
  const urlString = util.format(
    enforcedPolicyURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Set enforced content security policy
 * @param {Object} params Parameters object.
 * @param {ContentSecurityPolicy} params.policy ContentSecurityPolicy object
 * @param {State} params.state State object.
 * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object.
 */
export async function setEnforcedContentSecurityPolicy({
  policy,
  state,
}: {
  policy: ContentSecurityPolicy;
  state: State;
}): Promise<ContentSecurityPolicy> {
  const urlString = util.format(
    enforcedPolicyURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).put(urlString, policy, { withCredentials: true });
  return data;
}

/**
 * Get report-only content security policy
 * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object
 */
export async function getReportOnlyContentSecurityPolicy({
  state,
}: {
  state: State;
}): Promise<ContentSecurityPolicy> {
  const urlString = util.format(
    reportOnlyPolicyURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Set report-only content security policy
 * @param {Object} params Parameters object.
 * @param {ContentSecurityPolicy} params.policy ContentSecurityPolicy object
 * @param {State} params.state State object.
 * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a ContentSecurityPolicy object.
 */
export async function setReportOnlyContentSecurityPolicy({
  policy,
  state,
}: {
  policy: ContentSecurityPolicy;
  state: State;
}): Promise<ContentSecurityPolicy> {
  const urlString = util.format(
    reportOnlyPolicyURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).put(urlString, policy, { withCredentials: true });
  return data;
}
