/**
 * The diagnosis of the IDM feature `aiagent`: read-only, it finds out why the feature reads as not installed or does
 * not work.
 *
 * @remarks
 * What the platform does (all observed on Advanced Identity Cloud tenants in 2026-11, see frodo-lib#1060):
 * - The feature registry (`GET /openidm/feature/aiagent`) is derived, not stored. `installedVersion` is "1" exactly
 *   when every definition the feature writes equals the original. A trailing newline, a changed title or one extra
 *   mapping property makes it read null (see {@link compareAIAgentDefinitions}).
 * - The AM endpoint for AI agents answers `501 OAuth 2.0 for AI Agents is not enabled` until the environment action
 *   `POST /environment/aiagent?_action=enable` has made the platform write the OAuth 2.0 provider of every realm. That
 *   write fails (and the action answers a generic 500) if a provider has no password grant authentication service or
 *   does not exist. Once it succeeds the gate can need minutes to open.
 * - AM reads and creates the identity of an AI agent through IDM and needs the secrets of the realm for it. A mapping
 *   in the realm's ESV secret store that points to an ESV secret that does not exist stops AM from loading the realm's
 *   secrets: AI agents then are not listed and every create answers `500 AI Agent: Failed to create agent identity`.
 */
import { getFailedResponse } from '../../FrodoError';
import {
  AIAgentDefinitionComparison,
  AIAgentDefinitionDifference,
  compareAIAgentDefinitions,
} from './AIAgentFeatureDefinitions';
import {
  AI_AGENT_FEATURE_ID,
  AI_AGENT_FEATURE_REFERENCE,
  AI_AGENT_FEATURE_REFERENCE_VERSION,
} from './AIAgentFeatureReference';
import { AIAgentFeatureTenant } from './AIAgentFeatureTenant';
import { IdmFeatureDiagnosis, IdmFeatureFinding } from './IdmFeatureTypes';

/** The authentication service the OAuth 2.0 providers of healthy tenants use for the password grant. */
export const DEFAULT_PASSWORD_GRANT_AUTH_SERVICE = 'Login';

/** How many definitions the feature writes (the operations of the feature patch). */
export const AI_AGENT_FEATURE_OPERATIONS = 26;

/** The value AM shows for an unset authentication service. */
const EMPTY_VALUE = '[Empty]';

/** The state of one realm that has the AI agent managed objects. */
export type AIAgentRealmDiagnosis = {
  realm: string;
  /** undefined: the realm has no OAuth 2.0 provider. */
  provider?: { [key: string]: unknown };
  providerRead: boolean;
  gateOpen?: boolean;
  gateKnown: boolean;
  /** True if the enable action has to run for this realm to work. */
  needsEnable: boolean;
};

/** The words of an error for a finding: its status and the first line of its message. */
export function describeFailure(error: unknown): {
  httpStatus?: number;
  message: string;
} {
  const status = getFailedResponse(error)?.status;
  const message = String((error as Error)?.message ?? error).split('\n')[0];
  return {
    ...(typeof status === 'number' ? { httpStatus: status } : {}),
    message,
  };
}

/** A string that is empty, unset or AM's placeholder for unset. */
export function isUnset(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' &&
      (value.trim() === '' || value === EMPTY_VALUE))
  );
}

/** A reduced view of the differences for the details of a finding. */
function summarise(differences: AIAgentDefinitionDifference[]) {
  return differences.map((difference) => ({
    config: difference.config,
    object: difference.object,
    location: difference.location,
    kind: difference.kind,
    cosmetic: difference.cosmetic,
    ...(difference.cosmeticClass
      ? { cosmeticClass: difference.cosmeticClass }
      : {}),
    ...('expected' in difference ? { expected: difference.expected } : {}),
    ...('actual' in difference ? { actual: difference.actual } : {}),
  }));
}

/**
 * Diagnose the feature `aiagent` in the tenant behind `tenant`.
 *
 * Only reads. A read that fails (other than the first one, the registry) becomes a finding `check-failed` and the
 * diagnosis goes on with what it can still read.
 * @param {AIAgentFeatureTenant} tenant the reads of the tenant
 * @returns {Promise<IdmFeatureDiagnosis>} the diagnosis
 */
export async function diagnoseAIAgentFeature(
  tenant: AIAgentFeatureTenant
): Promise<IdmFeatureDiagnosis> {
  const feature = await tenant.readFeature();
  const installedVersion = feature.installedVersion ?? null;
  const availableVersions = feature.availableVersions ?? [];
  const findings: IdmFeatureFinding[] = [];
  const add = (
    id: string,
    severity: IdmFeatureFinding['severity'],
    message: string,
    repairable: boolean,
    details: Record<string, unknown> = {}
  ) => findings.push({ id, severity, message, repairable, details });
  const checkFailed = (check: string, error: unknown, realm?: string) =>
    add(
      'check-failed',
      'warning',
      `The check ${check}${realm ? ` for the realm ${realm}` : ''} could not be made: ${describeFailure(error).message}`,
      false,
      { check, ...(realm ? { realm } : {}), ...describeFailure(error) }
    );
  const result = (): IdmFeatureDiagnosis => ({
    featureId: AI_AGENT_FEATURE_ID,
    supported: true,
    installedVersion,
    availableVersions,
    findings,
  });

  // the reference describes one version; another version cannot be compared with it
  const latest = availableVersions[availableVersions.length - 1];
  const effectiveVersion = installedVersion ?? latest;
  if (effectiveVersion !== AI_AGENT_FEATURE_REFERENCE_VERSION) {
    add(
      'version-unsupported',
      'error',
      `The feature is at version ${effectiveVersion ?? 'unknown'} and the definitions this library knows are those of version ${AI_AGENT_FEATURE_REFERENCE_VERSION}, so the tenant cannot be compared with them.`,
      false,
      {
        installedVersion,
        availableVersions,
        referenceVersion: AI_AGENT_FEATURE_REFERENCE_VERSION,
      }
    );
    return result();
  }
  const installed = installedVersion === AI_AGENT_FEATURE_REFERENCE_VERSION;

  // what the registry's own check says
  let failures: string[] = [];
  let validateMessage: string | undefined;
  try {
    const validation = await tenant.validateFeature();
    failures = Array.isArray(validation.failures) ? validation.failures : [];
    validateMessage = validation.message;
  } catch (error) {
    checkFailed('validate', error);
  }
  const definitionsFound = failures.length;
  add(
    installed ? 'registry-installed' : 'registry-not-installed',
    installed ? 'info' : 'warning',
    installed
      ? `The registry reports version ${installedVersion} installed.`
      : 'The registry reports no installed version.',
    false,
    {
      installedVersion,
      availableVersions,
      ...(validateMessage ? { validateMessage } : {}),
      // a healthy tenant lists every one of the feature's operations as "already present"
      validateFailures: definitionsFound,
      operations: AI_AGENT_FEATURE_OPERATIONS,
    }
  );

  // the definitions
  let comparison: AIAgentDefinitionComparison | undefined;
  try {
    const managed = await tenant.readManagedConfig();
    const repoDs = await tenant.readRepoDs();
    comparison = compareAIAgentDefinitions(
      managed,
      repoDs,
      AI_AGENT_FEATURE_REFERENCE
    );
  } catch (error) {
    checkFailed('definitions', error);
  }

  if (comparison && !comparison.present) {
    add(
      'feature-not-installed',
      'info',
      'The tenant has none of the definitions of the feature: it was never installed, there is nothing to repair.',
      false
    );
    return result();
  }

  // the realms
  const realms: AIAgentRealmDiagnosis[] = [];
  const realmFindings: IdmFeatureFinding[] = [];
  const addRealm = (
    id: string,
    severity: IdmFeatureFinding['severity'],
    message: string,
    repairable: boolean,
    details: Record<string, unknown>
  ) => realmFindings.push({ id, severity, message, repairable, details });
  let esvSecretIds: string[] | undefined;
  let esvFailed = false;

  for (const realm of comparison?.realms ?? []) {
    const state: AIAgentRealmDiagnosis = {
      realm,
      providerRead: false,
      gateKnown: false,
      needsEnable: false,
    };
    realms.push(state);

    // the OAuth 2.0 provider
    try {
      const provider = await tenant.readProvider(realm);
      state.providerRead = true;
      state.provider = provider as { [key: string]: unknown } | undefined;
      if (!provider) {
        state.needsEnable = true;
        addRealm(
          'provider-missing',
          'error',
          `The realm ${realm} has no OAuth 2.0 provider, so the platform cannot enable AI agents there.`,
          true,
          { realm }
        );
      } else {
        const authService = (
          provider as {
            advancedOAuth2Config?: { passwordGrantAuthService?: unknown };
          }
        ).advancedOAuth2Config?.passwordGrantAuthService;
        if (isUnset(authService)) {
          state.needsEnable = true;
          addRealm(
            'provider-auth-service-not-set',
            'error',
            `The OAuth 2.0 provider of the realm ${realm} has no password grant authentication service; the platform's write of the provider is refused without one and the enable action then fails with a generic 500.`,
            true,
            { realm, expected: DEFAULT_PASSWORD_GRANT_AUTH_SERVICE }
          );
        } else {
          try {
            if (!(await tenant.authServiceExists(realm, String(authService)))) {
              addRealm(
                'provider-auth-service-unknown',
                'warning',
                `The password grant authentication service ${String(authService)} of the OAuth 2.0 provider of the realm ${realm} is not an authentication tree of that realm.`,
                false,
                { realm, authService }
              );
            }
          } catch (error) {
            checkFailed('authentication service', error, realm);
          }
        }
        const config = (
          provider as {
            aiAgentsConfig?: {
              aiAgentsEnabled?: boolean;
              aiAgentsIdentityObjectName?: string;
              aiAgentsPrivilegeObjectName?: string;
            };
          }
        ).aiAgentsConfig;
        if (config?.aiAgentsEnabled !== true) {
          state.needsEnable = true;
          addRealm(
            'provider-ai-agents-disabled',
            'error',
            `AI agents are not enabled in the OAuth 2.0 provider of the realm ${realm}.`,
            true,
            { realm, aiAgentsEnabled: config?.aiAgentsEnabled ?? null }
          );
        } else {
          const expected = {
            aiAgentsIdentityObjectName: `managed/${realm}_aiagent`,
            aiAgentsPrivilegeObjectName: `managed/${realm}_aiagentprivilege`,
          };
          const actual = {
            aiAgentsIdentityObjectName: config.aiAgentsIdentityObjectName,
            aiAgentsPrivilegeObjectName: config.aiAgentsPrivilegeObjectName,
          };
          if (JSON.stringify(expected) !== JSON.stringify(actual)) {
            addRealm(
              'provider-ai-agents-config',
              'warning',
              `The OAuth 2.0 provider of the realm ${realm} names other managed objects for AI agents than the ones the feature installs.`,
              false,
              { realm, expected, actual }
            );
          }
        }
      }
    } catch (error) {
      checkFailed('OAuth 2.0 provider', error, realm);
    }

    // the AM gate
    let amAgents: number | null = null;
    try {
      const gate = await tenant.readGate(realm);
      state.gateKnown = true;
      amAgents = gate.agentCount;
      state.gateOpen = gate.typeListed && gate.listStatus === 200;
      if (state.gateOpen) {
        addRealm(
          'gate-open',
          'info',
          `AM accepts AI agents in the realm ${realm}.`,
          false,
          { realm, agents: gate.agentCount }
        );
      } else if (!gate.typeListed || gate.listStatus === 501) {
        state.needsEnable = true;
        addRealm(
          'gate-closed',
          'error',
          `AM does not accept AI agents in the realm ${realm}: the agent type AIAgent ${gate.typeListed ? 'is listed' : 'is not listed'} and listing AI agents answers ${gate.listStatus ?? 'nothing'}.`,
          true,
          {
            realm,
            typeListed: gate.typeListed,
            listStatus: gate.listStatus,
          }
        );
      } else {
        state.gateKnown = false;
        addRealm(
          'gate-check-failed',
          'warning',
          `Listing AI agents in the realm ${realm} answered ${gate.listStatus ?? 'nothing'}, so the gate could not be judged.`,
          false,
          { realm, listStatus: gate.listStatus }
        );
      }
    } catch (error) {
      checkFailed('AM gate', error, realm);
    }

    // IDM objects without an AM entry
    let idmAgents: number | undefined;
    try {
      idmAgents = await tenant.countIdmAgents(realm);
    } catch (error) {
      checkFailed('IDM AI agent objects', error, realm);
    }
    const dataSymptom =
      state.gateOpen === true &&
      amAgents !== null &&
      idmAgents !== undefined &&
      idmAgents > amAgents;

    // the secrets of the realm
    try {
      if (!esvSecretIds && !esvFailed) {
        try {
          esvSecretIds = await tenant.readEsvSecretIds();
        } catch (error) {
          esvFailed = true;
          checkFailed('ESV secrets', error);
        }
      }
      if (esvSecretIds) {
        const known = new Set(esvSecretIds);
        const dangling: {
          storeId: string;
          storeTypeId: string;
          secretId: string;
          aliases: string[];
        }[] = [];
        for (const store of await tenant.readSecretStoreMappings(realm)) {
          for (const mapping of store.mappings) {
            // an alias names an ESV secret, with or without the prefix esv-
            const resolves = mapping.aliases.some(
              (alias) => known.has(alias) || known.has(`esv-${alias}`)
            );
            if (!resolves) {
              dangling.push({
                storeId: store.storeId,
                storeTypeId: store.storeTypeId,
                secretId: mapping.secretId,
                aliases: mapping.aliases,
              });
            }
          }
        }
        if (dangling.length) {
          addRealm(
            'secret-mappings-dangling',
            dataSymptom ? 'error' : 'warning',
            dataSymptom
              ? `${dangling.length} mapping(s) in the secret store of the realm ${realm} point to ESV secrets that do not exist; AM cannot load the secrets of the realm and so cannot read the AI agents IDM holds.`
              : `${dangling.length} mapping(s) in the secret store of the realm ${realm} point to ESV secrets that do not exist; where AM cannot load the secrets of a realm it cannot read or create AI agents.`,
            dataSymptom,
            { realm, mappings: dangling }
          );
        }
      }
    } catch (error) {
      checkFailed('secret store mappings', error, realm);
    }

    if (dataSymptom) {
      addRealm(
        'agents-without-am-entry',
        'error',
        `IDM holds ${idmAgents} AI agent object(s) in the realm ${realm} and AM lists ${amAgents}.`,
        false,
        { realm, idmAgents, amAgents }
      );
    }
  }

  // the definitions finding depends on whether the enable action has to run
  if (comparison) {
    const differences = comparison.differences;
    const structural = differences.filter((difference) => !difference.cosmetic);
    const cosmetic = differences.filter((difference) => difference.cosmetic);
    const needsEnable = realms.some((realm) => realm.needsEnable);
    if (installed) {
      if (differences.length) {
        add(
          'definitions-differ-from-reference',
          'info',
          `The registry reports the feature installed although ${differences.length} definition(s) differ from the original of version ${AI_AGENT_FEATURE_REFERENCE_VERSION}; the registry's own check takes precedence.`,
          false,
          { differences: summarise(differences) }
        );
      }
    } else {
      if (structural.length) {
        add(
          'definitions-structural-drift',
          'error',
          `${structural.length} definition(s) of the feature are missing or differ from the original in more than white space, a title or an extra mapping property.`,
          false,
          { differences: summarise(structural) }
        );
      }
      if (cosmetic.length) {
        add(
          'definitions-cosmetic-drift',
          needsEnable ? 'error' : 'warning',
          needsEnable
            ? `${cosmetic.length} definition(s) of the feature differ from the original only cosmetically; that is why the registry reads not installed, and it must not run the enable action, which installs the feature internally, until they are aligned.`
            : `${cosmetic.length} definition(s) of the feature differ from the original only cosmetically; that is why the registry reads not installed. AI agents are not affected.`,
          needsEnable && structural.length === 0,
          { differences: summarise(cosmetic) }
        );
      }
      if (!differences.length) {
        add(
          'registry-unexplained',
          'warning',
          'The registry reports no installed version although every definition equals the original; the cause is not one this library knows.',
          false
        );
      }
    }
  }

  findings.push(...realmFindings);
  return result();
}
