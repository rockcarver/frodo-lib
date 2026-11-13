/**
 * The repair of the IDM feature `aiagent`: a plan that says what would be written, and its execution.
 *
 * @remarks
 * The order of the steps is the order in which they are safe (see frodo-lib#1060):
 * 1. delete the mappings of the realm's secret store that point to ESV secrets that do not exist (AM cannot read the AI
 *    agents of a realm whose secrets it cannot load);
 * 2. create a missing OAuth 2.0 provider from the server's template, or give a provider the password grant
 *    authentication service it lacks (the platform's write of the provider is refused without one);
 * 3. align definitions that differ cosmetically from the original, when the enable action has to run: that action
 *    installs the IDM feature internally, and an install on definitions that are present but not equal would add them a
 *    second time;
 * 4. run the enable action, and only if the registry then reads installed;
 * 5. optionally wait for AM to accept AI agents, which can need minutes;
 * 6. put the aligned definitions back, unless the caller keeps them aligned;
 * 7. diagnose again.
 *
 * Every write is read back and compared with what was written; a difference stops the run. A step also checks that the
 * tenant still looks as it did when the plan was made, so an old plan is not applied to a changed tenant. If a step
 * fails after definitions were aligned, they are put back before the error is thrown.
 */
import { FrodoError } from '../../FrodoError';
import {
  AIAgentDefinitionDifference,
  applyDifferences,
  compareAIAgentDefinitions,
  confirmDifferences,
  differencesNotOnSide,
  ManagedConfigLike,
  RepoDsConfigLike,
} from './AIAgentFeatureDefinitions';
import {
  DEFAULT_PASSWORD_GRANT_AUTH_SERVICE,
  describeFailure,
  diagnoseAIAgentFeature,
  isUnset,
} from './AIAgentFeatureDiagnose';
import {
  AI_AGENT_FEATURE_ID,
  AI_AGENT_FEATURE_REALMS,
  AI_AGENT_FEATURE_REFERENCE_VERSION,
} from './AIAgentFeatureReference';
import { AIAgentFeatureRepairTenant } from './AIAgentFeatureTenant';
import {
  IdmFeatureDiagnosis,
  IdmFeatureRepairBackup,
  IdmFeatureRepairBlocker,
  IdmFeatureRepairExecutionOptions,
  IdmFeatureRepairOptions,
  IdmFeatureRepairPlan,
  IdmFeatureRepairResult,
  IdmFeatureRepairStep,
  IdmFeatureRepairStepResult,
} from './IdmFeatureTypes';

/** How long the repair waits for the AM gate by default, in milliseconds (20 minutes). */
export const DEFAULT_GATE_TIMEOUT = 1_200_000;

/** How long the repair waits between two looks at the AM gate, in milliseconds. */
export const GATE_POLL_INTERVAL = 10_000;

/** The clock of a repair; a test replaces it. */
export type RepairClock = {
  now(): number;
  sleep(ms: number): Promise<void>;
};

const realClock: RepairClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

type Json = Record<string, unknown>;
const clone = <T>(value: T): T =>
  value === undefined ? value : JSON.parse(JSON.stringify(value));

const emptyBackup = (): IdmFeatureRepairBackup => ({
  feature: null,
  managed: null,
  repoDs: null,
  providers: {},
  idmObjects: {},
  secretStoreMappings: [],
});

/** The finding of IDM AI agents that AM does not list: a symptom, reported and never repaired. */
const DATA_FINDING_ID = 'agents-without-am-entry';

/** The conditions whose repair needs the enable action. */
const ENABLE_FINDINGS = [
  'gate-closed',
  'provider-ai-agents-disabled',
  'provider-missing',
];

/**
 * Plan the repair of the feature `aiagent`: diagnose it, decide what to write and read what would be overwritten.
 * Writes nothing.
 * @param {AIAgentFeatureRepairTenant} tenant the tenant
 * @param {IdmFeatureRepairOptions} options see {@link IdmFeatureRepairOptions}
 * @returns {Promise<IdmFeatureRepairPlan>} the plan
 */
export async function planAIAgentFeatureRepair(
  tenant: AIAgentFeatureRepairTenant,
  options: IdmFeatureRepairOptions = {}
): Promise<IdmFeatureRepairPlan> {
  const keepAligned = options.keepAligned === true;
  const authService =
    options.authService || DEFAULT_PASSWORD_GRANT_AUTH_SERVICE;
  const diagnosis = await diagnoseAIAgentFeature(tenant);
  const base = {
    featureId: AI_AGENT_FEATURE_ID,
    options: { keepAligned, authService },
    diagnosis,
  };
  const errors = diagnosis.findings.filter(
    (finding) => finding.severity === 'error'
  );
  // the data finding reports a symptom (IDM holds AI agents that AM does not list); the library never repairs it, and it does
  // not keep the causes it can repair from being repaired
  const blockers: IdmFeatureRepairBlocker[] = errors
    .filter((finding) => !finding.repairable && finding.id !== DATA_FINDING_ID)
    .map((finding) => ({ id: finding.id, message: finding.message }));
  if (blockers.length) {
    return {
      ...base,
      repairable: false,
      blockers,
      steps: [],
      backup: emptyBackup(),
    };
  }
  const actionable = errors.filter((finding) => finding.repairable);
  if (!actionable.length) {
    return {
      ...base,
      repairable: true,
      blockers: [],
      steps: [],
      backup: emptyBackup(),
    };
  }

  const ofId = (id: string) =>
    actionable.filter((finding) => finding.id === id);
  const steps: IdmFeatureRepairStep[] = [];
  const mappingsToDelete: IdmFeatureRepairBackup['secretStoreMappings'] = [];

  // 1. the secrets of the realms
  for (const finding of ofId('secret-mappings-dangling')) {
    const realm = String(finding.details.realm);
    for (const mapping of finding.details.mappings as {
      storeId: string;
      storeTypeId: string;
      secretId: string;
      aliases: string[];
    }[]) {
      mappingsToDelete.push({ realm, ...mapping });
      steps.push({
        id: 'delete-secret-mapping',
        realm,
        writes: true,
        description: `Delete the mapping ${mapping.secretId} (alias ${mapping.aliases.join(', ')}) from the secret store ${mapping.storeId} of the realm ${realm}: it points to no ESV secret.`,
        details: { ...mapping },
      });
    }
  }

  // 2. the OAuth 2.0 providers
  const needsAuthService: string[] = [];
  for (const finding of ofId('provider-missing')) {
    const realm = String(finding.details.realm);
    needsAuthService.push(realm);
    steps.push({
      id: 'create-provider',
      realm,
      writes: true,
      description: `Create the OAuth 2.0 provider of the realm ${realm} from the server's template, with the password grant authentication service ${authService}.`,
      details: { authService },
    });
  }
  for (const finding of ofId('provider-auth-service-not-set')) {
    const realm = String(finding.details.realm);
    needsAuthService.push(realm);
    steps.push({
      id: 'set-auth-service',
      realm,
      writes: true,
      description: `Set the password grant authentication service of the OAuth 2.0 provider of the realm ${realm} to ${authService}.`,
      details: { authService },
    });
  }
  for (const realm of needsAuthService) {
    let exists: boolean;
    try {
      exists = await tenant.authServiceExists(realm, authService);
    } catch (error) {
      blockers.push({
        id: 'authentication-service-unchecked',
        message: `Whether the realm ${realm} has the authentication service ${authService} could not be checked: ${describeFailure(error).message}`,
      });
      continue;
    }
    if (!exists) {
      blockers.push({
        id: 'authentication-service-missing',
        message: `The realm ${realm} has no authentication tree named ${authService}, so a provider cannot be given it as its password grant authentication service.`,
      });
    }
  }

  // 3.-6. the enable action and what makes it safe
  const enableRealms = [
    ...new Set(
      actionable
        .filter((finding) => ENABLE_FINDINGS.includes(finding.id))
        .map((finding) => String(finding.details.realm))
    ),
  ];
  const needsEnable = enableRealms.length > 0;
  const registryInstalled =
    diagnosis.installedVersion === AI_AGENT_FEATURE_REFERENCE_VERSION;

  // what would be overwritten, and the differences to align: both from one read
  const managed = (await tenant.readManagedConfig()) as ManagedConfigLike;
  const repoDs = (await tenant.readRepoDs()) as RepoDsConfigLike;
  const comparison = compareAIAgentDefinitions(managed, repoDs);
  const cosmetic = comparison.differences.filter(
    (difference) => difference.cosmetic
  );
  let aligns: AIAgentDefinitionDifference[] = [];
  if (needsEnable && !registryInstalled) {
    if (!cosmetic.length) {
      blockers.push({
        id: 'registry-unexplained',
        message:
          'The enable action installs the feature internally and is not safe while the registry reads not installed for a reason the library does not know.',
      });
    } else {
      aligns = cosmetic;
    }
  }
  if (blockers.length) {
    return {
      ...base,
      repairable: false,
      blockers,
      steps: [],
      backup: emptyBackup(),
    };
  }

  if (aligns.length) {
    const where = aligns.map(
      (difference) =>
        `${difference.object}${difference.location ? ` ${difference.location}` : ''}`
    );
    steps.push({
      id: 'align-definitions',
      writes: true,
      description: `Write the original over ${aligns.length} cosmetically drifted definition(s) (${where.join('; ')}), so that the enable action does not add the feature a second time.`,
      details: { differences: clone(aligns) },
    });
  }
  if (needsEnable) {
    steps.push({
      id: 'enable',
      writes: true,
      description: `Run the enable action of the environment; the platform installs the feature internally and writes the OAuth 2.0 provider of every realm (needed for ${enableRealms.join(', ')}).`,
      details: { realms: enableRealms },
    });
    steps.push({
      id: 'wait-for-gate',
      writes: false,
      description: `Wait until AM accepts AI agents in ${enableRealms.join(', ')} (only if asked to wait; it can need minutes).`,
      details: { realms: enableRealms },
    });
  }
  if (aligns.length && !keepAligned) {
    steps.push({
      id: 'restore-definitions',
      writes: true,
      description: `Put the ${aligns.length} customised definition(s) back as they were.`,
      details: { differences: clone(aligns) },
    });
  }
  steps.push({
    id: 'diagnose',
    writes: false,
    description: 'Diagnose the feature again.',
    details: {},
  });

  // the backup: what the steps overwrite or delete, as the tenant returns it
  const backup: IdmFeatureRepairBackup = {
    feature: await tenant.readFeature(),
    managed: clone(managed),
    repoDs: clone(repoDs),
    providers: {},
    idmObjects: {},
    secretStoreMappings: mappingsToDelete,
  };
  for (const realm of comparison.realms) {
    backup.providers[realm] = (await tenant.readProvider(realm)) ?? null;
    for (const type of [`${realm}_aiagent`, `${realm}_aiagentprivilege`]) {
      backup.idmObjects[type] = await tenant.readIdmObjects(type);
    }
  }

  return { ...base, repairable: true, blockers: [], steps, backup };
}

/** A tenant that no longer looks as it did when the plan was made, or a plan that does not match the reference. */
class StalePlanError extends Error {}

/** A look at the AM gate that the tenant refuses (HTTP 401 or 403): waiting longer will not help. */
class GateRefusedError extends Error {
  constructor(realm: string, status: number, what: string) {
    super(
      `Looking at whether AM accepts AI agents in the realm ${realm} is refused (HTTP ${status}: ${what}); the wait is stopped.`
    );
  }
}

function sameKeys(sent: Json, back: Json | undefined): boolean {
  return (
    !!back &&
    Object.keys(sent)
      .filter((key) => !key.startsWith('_'))
      .every((key) => key in back)
  );
}

/**
 * Run a plan.
 * @param {AIAgentFeatureRepairTenant} tenant the tenant
 * @param {IdmFeatureRepairPlan} plan the plan of `planAIAgentFeatureRepair`
 * @param {IdmFeatureRepairExecutionOptions} options see {@link IdmFeatureRepairExecutionOptions}
 * @param {RepairClock} clock the clock; a test replaces it
 * @returns {Promise<IdmFeatureRepairResult>} what was done; throws a FrodoError when a step fails
 */
export async function repairAIAgentFeature(
  tenant: AIAgentFeatureRepairTenant,
  plan: IdmFeatureRepairPlan,
  options: IdmFeatureRepairExecutionOptions = {},
  clock: RepairClock = realClock
): Promise<IdmFeatureRepairResult> {
  if (!plan.repairable) {
    throw new Error(
      `The plan cannot be run: ${plan.blockers.map((blocker) => blocker.message).join(' ')}`
    );
  }
  const wait = options.wait === true;
  const timeout =
    typeof options.timeout === 'number' && options.timeout >= 0
      ? options.timeout
      : DEFAULT_GATE_TIMEOUT;
  const { authService, keepAligned } = plan.options;
  const results: IdmFeatureRepairStepResult[] = [];
  let diagnosis: IdmFeatureDiagnosis | undefined;
  let aligned = false;
  /**
   * The differences as the tenant held them when the definitions were aligned in this run, with the original taken from
   * the shipped reference: what a restore puts back. Never taken from the plan.
   */
  let alignedDifferences: AIAgentDefinitionDifference[] | undefined;
  /** The configurations (`managed`, `repo.ds`) that a write of the alignment succeeded for in this run. */
  const alignedConfigs = new Set<'managed' | 'repo.ds'>();
  /** The configurations that were put back. */
  const restoredConfigs = new Set<'managed' | 'repo.ds'>();
  /** A write of the alignment failed and the tenant could not be read to find out whether it took effect. */
  let alignmentUncertain = false;
  let restoreTried = false;
  /** The restore step of the plan ran or was skipped (so nothing is left to settle at the end). */
  let restoreHandled = false;
  let esvSecretIds: Set<string> | undefined;

  const report = (
    step: IdmFeatureRepairStep,
    status: IdmFeatureRepairStepResult['status'],
    message: string
  ) => {
    const result = { step, status, message };
    results.push(result);
    try {
      options.resultCallback?.(result);
    } catch {
      // a callback that throws must not stop a repair half way
    }
  };

  const readBoth = async () => ({
    managed: (await tenant.readManagedConfig()) as ManagedConfigLike,
    repoDs: (await tenant.readRepoDs()) as RepoDsConfigLike,
  });

  /** Write the managed and repo.ds configuration the differences touch, read both back, check the side. */
  const writeDifferences = async (
    differences: AIAgentDefinitionDifference[],
    side: 'expected' | 'actual',
    written?: Set<'managed' | 'repo.ds'>
  ) => {
    const { managed, repoDs } = await readBoth();
    const newManaged = clone(managed);
    const newRepoDs = clone(repoDs);
    applyDifferences(newManaged, newRepoDs, differences, side);
    if (differences.some((difference) => difference.config === 'managed')) {
      await tenant.putManagedConfig(newManaged);
      written?.add('managed');
    }
    if (differences.some((difference) => difference.config === 'repo.ds')) {
      await tenant.putRepoDs(newRepoDs);
      written?.add('repo.ds');
    }
    const back = await readBoth();
    const off = differencesNotOnSide(
      back.managed,
      back.repoDs,
      differences,
      side
    );
    if (off.length) {
      throw new Error(
        `The tenant does not hold what was written for ${off.map((difference) => `${difference.object} ${difference.location}`.trim()).join('; ')}`
      );
    }
    if (
      (back.managed.objects ?? []).length !== (managed.objects ?? []).length
    ) {
      throw new Error(
        'The number of managed objects changed while the definitions were written'
      );
    }
  };

  /** Why the definitions could not be put back, if that was tried and failed. */
  let restoreFailure: unknown;

  /** The aligned differences of the configurations the alignment reached: what there is to put back. */
  const writtenDifferences = () =>
    (alignedDifferences ?? []).filter((difference) =>
      alignedConfigs.has(difference.config)
    );

  /** What the alignment reached and the restore has not put back (yet). */
  const remainingDifferences = () =>
    writtenDifferences().filter(
      (difference) => !restoredConfigs.has(difference.config)
    );

  /**
   * After a failed write of the alignment, the tenant says which configurations are aligned, not the answer of the
   * write: a write can be applied and its answer lost (a timeout, a dropped connection). If the tenant cannot be read
   * either, both configurations are taken as possibly aligned: putting the original values back is then the safe thing.
   */
  const learnWhatWasWritten = async (
    differences: AIAgentDefinitionDifference[]
  ) => {
    try {
      const { managed, repoDs } = await readBoth();
      for (const config of ['managed', 'repo.ds'] as const) {
        const own = differences.filter((one) => one.config === config);
        if (
          own.length &&
          differencesNotOnSide(managed, repoDs, own, 'expected').length <
            own.length
        ) {
          alignedConfigs.add(config);
        }
      }
    } catch {
      for (const difference of differences)
        alignedConfigs.add(difference.config);
      alignmentUncertain = true;
    }
  };

  const restore = async () => {
    restoreTried = true;
    const toPutBack = writtenDifferences();
    // nothing was aligned, nothing to put back (and no pointless write of an unchanged configuration)
    for (const config of ['managed', 'repo.ds'] as const) {
      const own = toPutBack.filter(
        (difference) => difference.config === config
      );
      if (!own.length) continue;
      try {
        await writeDifferences(own, 'actual');
        restoredConfigs.add(config);
      } catch (error) {
        restoreFailure = error;
        throw error;
      }
    }
  };

  const restoreStepOf = (): IdmFeatureRepairStep =>
    plan.steps.find((one) => one.id === 'restore-definitions') ?? {
      id: 'restore-definitions',
      description: 'Put the customised definitions back.',
      writes: true,
      details: {},
    };

  /**
   * The definitions this run aligned are put back, unless the caller keeps them aligned: decided by what the run did
   * and by `keepAligned`, not by the steps the plan still has. Reported as a step of the result. Returns why the
   * definitions could not be put back, if that was tried and failed.
   */
  const settleDefinitions = async (
    after: 'a failure' | 'the last step'
  ): Promise<unknown> => {
    if (!aligned || restoreTried || restoreHandled) return undefined;
    restoreHandled = true;
    // nothing was aligned: there is nothing to put back and nothing to keep aligned
    if (!writtenDifferences().length) return undefined;
    const restoreStep = restoreStepOf();
    if (keepAligned) {
      report(
        restoreStep,
        'skipped',
        `The definitions stay aligned with the original, as asked; the registry reads version ${AI_AGENT_FEATURE_REFERENCE_VERSION} installed while they do.`
      );
      return undefined;
    }
    try {
      await restore();
      report(
        restoreStep,
        'done',
        after === 'a failure'
          ? 'Put the customised definitions back after the failure.'
          : 'Put the customised definitions back (the plan had no step for it).'
      );
    } catch (failure) {
      report(
        restoreStep,
        'failed',
        `Could not put the customised definitions back: ${describeFailure(failure).message}`
      );
      return failure;
    }
    return undefined;
  };

  /** The error for definitions that could not be put back: it says in which state the tenant is, and names them. */
  const notPutBack = (
    what: string,
    cause: unknown,
    restoreError: unknown
  ): FrodoError => {
    const remaining = remainingDifferences();
    const named = remaining.map((difference) =>
      `${difference.object} ${difference.location}`.trim()
    );
    const all = new Set((alignedDifferences ?? []).map((one) => one.config));
    const still = new Set(remaining.map((one) => one.config));
    const state =
      still.size < all.size
        ? `partly aligned with the original (${[...still].map((one) => `config/${one}`).join(' and ')} only)`
        : alignmentUncertain
          ? 'possibly still aligned with the original (a write of the alignment failed and the configuration could not be read back)'
          : 'still aligned with the original';
    return new FrodoError(
      `Error repairing IDM feature ${AI_AGENT_FEATURE_ID}: ${what} The definitions are ${state} and were not put back (${named.join('; ')}); the backup of the plan holds the customised values.`,
      restoreError === cause
        ? (cause as Error)
        : [cause as Error, restoreError as Error]
    );
  };

  /** A realm of a step is one the feature is installed for: a plan is data that somebody can have edited. */
  const assertRealm = (realm: unknown): string => {
    if (typeof realm !== 'string' || !AI_AGENT_FEATURE_REALMS.includes(realm)) {
      throw new StalePlanError(
        `The plan names the realm ${String(realm)}, which the feature is not installed for; it is refused.`
      );
    }
    return realm;
  };

  /** The authentication service a provider is given exists in the realm: it is not taken on the plan's word. */
  const assertAuthService = async (realm: string) => {
    if (typeof authService !== 'string' || !authService) {
      throw new StalePlanError(
        'The plan names no authentication service; it is refused.'
      );
    }
    if (!(await tenant.authServiceExists(realm, authService))) {
      throw new Error(
        `The realm ${realm} has no authentication tree named ${authService}; the provider is not written.`
      );
    }
  };

  const readEsvSecrets = async () =>
    (esvSecretIds ??= new Set(await tenant.readEsvSecretIds()));

  const run = async (
    step: IdmFeatureRepairStep
  ): Promise<{
    status: IdmFeatureRepairStepResult['status'];
    message: string;
  }> => {
    const realm = [
      'delete-secret-mapping',
      'create-provider',
      'set-auth-service',
    ].includes(step.id)
      ? assertRealm(step.realm)
      : (step.realm as string);
    switch (step.id) {
      case 'delete-secret-mapping': {
        // the plan names the mapping; the type of the store is read from the tenant, not taken from the plan
        const { storeId, secretId } = step.details as {
          storeId: string;
          secretId: string;
        };
        const find = async () => {
          for (const store of await tenant.readSecretStoreMappings(realm)) {
            if (store.storeId !== storeId) continue;
            const mapping = store.mappings.find(
              (one) => one.secretId === secretId
            );
            if (mapping) return { mapping, storeTypeId: store.storeTypeId };
          }
          return undefined;
        };
        const current = await find();
        if (!current) {
          return {
            status: 'skipped',
            message: `The mapping ${secretId} is not in the secret store ${storeId} of the realm ${realm} any more.`,
          };
        }
        const known = await readEsvSecrets();
        if (
          current.mapping.aliases.some(
            (alias) => known.has(alias) || known.has(`esv-${alias}`)
          )
        ) {
          throw new StalePlanError(
            `The mapping ${secretId} points to an ESV secret that exists now; the plan is out of date.`
          );
        }
        await tenant.deleteSecretMapping(
          realm,
          storeId,
          current.storeTypeId,
          secretId
        );
        if (await find()) {
          throw new Error(
            `The mapping ${secretId} is still in the secret store ${storeId} after it was deleted.`
          );
        }
        return {
          status: 'done',
          message: `Deleted the mapping ${secretId} from the secret store ${storeId} of the realm ${realm}.`,
        };
      }

      case 'create-provider': {
        if (await tenant.readProvider(realm)) {
          throw new StalePlanError(
            `The realm ${realm} has an OAuth 2.0 provider now; the plan is out of date.`
          );
        }
        await assertAuthService(realm);
        const body = clone(await tenant.readProviderTemplate(realm)) as Json;
        delete body._id;
        delete body._rev;
        body.advancedOAuth2Config = {
          ...((body.advancedOAuth2Config as Json) ?? {}),
          passwordGrantAuthService: authService,
        };
        await tenant.putProvider(realm, body as never);
        const back = (await tenant.readProvider(realm)) as Json | undefined;
        if (
          (back?.advancedOAuth2Config as Json | undefined)
            ?.passwordGrantAuthService !== authService ||
          !sameKeys(body, back)
        ) {
          throw new Error(
            `The OAuth 2.0 provider of the realm ${realm} does not read back as it was written.`
          );
        }
        return {
          status: 'done',
          message: `Created the OAuth 2.0 provider of the realm ${realm} with the password grant authentication service ${authService}.`,
        };
      }

      case 'set-auth-service': {
        const current = (await tenant.readProvider(realm)) as Json | undefined;
        if (!current) {
          throw new StalePlanError(
            `The realm ${realm} has no OAuth 2.0 provider any more; the plan is out of date.`
          );
        }
        const have = (current.advancedOAuth2Config as Json | undefined)
          ?.passwordGrantAuthService;
        if (!isUnset(have)) {
          return {
            status: 'skipped',
            message: `The OAuth 2.0 provider of the realm ${realm} has the password grant authentication service ${String(have)} already.`,
          };
        }
        await assertAuthService(realm);
        const body = clone(current);
        delete body._id;
        delete body._rev;
        body.advancedOAuth2Config = {
          ...((body.advancedOAuth2Config as Json) ?? {}),
          passwordGrantAuthService: authService,
        };
        await tenant.putProvider(realm, body as never);
        const back = (await tenant.readProvider(realm)) as Json | undefined;
        if (
          (back?.advancedOAuth2Config as Json | undefined)
            ?.passwordGrantAuthService !== authService ||
          !sameKeys(body, back)
        ) {
          throw new Error(
            `The OAuth 2.0 provider of the realm ${realm} does not read back as it was written.`
          );
        }
        return {
          status: 'done',
          message: `Set the password grant authentication service of the realm ${realm} to ${authService}.`,
        };
      }

      case 'align-definitions': {
        const planned = step.details.differences;
        if (!Array.isArray(planned) || !planned.length) {
          throw new StalePlanError(
            'The plan names no definition to align; it is refused.'
          );
        }
        const { managed, repoDs } = await readBoth();
        // what is written is what the shipped reference says, found by a fresh comparison; the plan only says where
        const { fresh, problems } = confirmDifferences(
          planned as AIAgentDefinitionDifference[],
          managed,
          repoDs
        );
        if (problems.length) {
          throw new StalePlanError(
            `The plan does not match the tenant and the original definitions and is refused (${problems.join('; ')}).`
          );
        }
        alignedDifferences = fresh;
        aligned = true; // from the first write on, a failure puts the definitions back
        try {
          await writeDifferences(fresh, 'expected', alignedConfigs);
        } catch (error) {
          await learnWhatWasWritten(fresh);
          throw error;
        }
        const feature = await tenant.readFeature();
        if (feature.installedVersion !== AI_AGENT_FEATURE_REFERENCE_VERSION) {
          throw new Error(
            `The registry reads version ${feature.installedVersion ?? 'none'} after the definitions were aligned, not ${AI_AGENT_FEATURE_REFERENCE_VERSION}; the enable action is not run.`
          );
        }
        return {
          status: 'done',
          message: `Aligned ${fresh.length} definition(s); the registry reads version ${AI_AGENT_FEATURE_REFERENCE_VERSION} installed.`,
        };
      }

      case 'enable': {
        // the guard: the enable action installs the feature internally
        const feature = await tenant.readFeature();
        if (feature.installedVersion !== AI_AGENT_FEATURE_REFERENCE_VERSION) {
          throw new Error(
            `The enable action is not run: the registry reads version ${feature.installedVersion ?? 'none'}, not ${AI_AGENT_FEATURE_REFERENCE_VERSION}, so the definitions of the feature are not known to be equal to the original and an install could add them a second time.`
          );
        }
        await tenant.enableFeature();
        return {
          status: 'done',
          message:
            'The enable action answered. AM can need minutes before it accepts AI agents.',
        };
      }

      case 'wait-for-gate': {
        if (!wait) {
          return {
            status: 'skipped',
            message:
              'Not waiting for AM to accept AI agents; it can need minutes. Diagnose the feature again later.',
          };
        }
        const realms = (step.details.realms as unknown[]).map(assertRealm);
        const start = clock.now();
        let pending = [...realms];
        // the last thing that went wrong while looking, per realm; a look that works clears it
        const lastError: Record<string, string> = {};
        for (;;) {
          const stillClosed: string[] = [];
          for (const one of pending) {
            try {
              const gate = await tenant.readGate(one);
              delete lastError[one];
              if (gate.listStatus === 401 || gate.listStatus === 403) {
                throw new GateRefusedError(
                  one,
                  gate.listStatus,
                  'listing AI agents'
                );
              }
              if (gate.typeListed && gate.listStatus === 200) continue;
              // an answer that is neither open nor the closed gate (501, 404) is a problem to report if it lasts
              if (
                typeof gate.listStatus === 'number' &&
                ![200, 404, 501].includes(gate.listStatus)
              ) {
                lastError[one] =
                  `listing AI agents answered ${gate.listStatus}`;
              }
              stillClosed.push(one);
            } catch (error) {
              if (error instanceof GateRefusedError) throw error;
              const failure = describeFailure(error);
              if (failure.httpStatus === 401 || failure.httpStatus === 403) {
                throw new GateRefusedError(
                  one,
                  failure.httpStatus,
                  failure.message
                );
              }
              // anything else can pass: keep looking, and say what went wrong if the time runs out
              lastError[one] =
                `${failure.httpStatus ? `HTTP ${failure.httpStatus}: ` : ''}${failure.message}`;
              stillClosed.push(one);
            }
          }
          pending = stillClosed;
          if (!pending.length) {
            return {
              status: 'done',
              message: `AM accepts AI agents in ${realms.join(', ')}.`,
            };
          }
          const left = timeout - (clock.now() - start);
          if (left <= 0) {
            const errors = Object.entries(lastError).map(
              ([one, message]) => `${one}: ${message}`
            );
            return {
              status: 'failed',
              message: `AM does not accept AI agents in ${pending.join(', ')} after ${Math.round(timeout / 1000)} seconds. It can need more time; diagnose the feature again later.${errors.length ? ` The last error while looking: ${errors.join('; ')}.` : ''}`,
            };
          }
          await clock.sleep(Math.min(GATE_POLL_INTERVAL, left));
        }
      }

      case 'restore-definitions': {
        restoreHandled = true;
        // the values to put back were read from the tenant when the alignment started in this run, not from the plan
        if (!writtenDifferences().length) {
          return {
            status: 'skipped',
            message:
              'The definitions were not aligned in this run: there is nothing to put back.',
          };
        }
        if (restoreTried) {
          return {
            status: 'skipped',
            message: 'The customised definitions were put back already.',
          };
        }
        if (keepAligned) {
          return {
            status: 'skipped',
            message: `The definitions stay aligned with the original, as asked; the registry reads version ${AI_AGENT_FEATURE_REFERENCE_VERSION} installed while they do.`,
          };
        }
        await restore();
        return {
          status: 'done',
          message: 'Put the customised definitions back.',
        };
      }

      case 'diagnose': {
        diagnosis = await diagnoseAIAgentFeature(tenant);
        const errorCount = diagnosis.findings.filter(
          (finding) => finding.severity === 'error'
        ).length;
        return {
          status: 'done',
          message: errorCount
            ? `${errorCount} error finding(s) remain.`
            : 'No error finding remains.',
        };
      }

      default:
        throw new Error(`Unknown step ${String(step.id)}`);
    }
  };

  for (const step of plan.steps) {
    try {
      const outcome = await run(step);
      report(step, outcome.status, outcome.message);
    } catch (error) {
      report(step, 'failed', describeFailure(error).message);
      // the step that failed was the restore itself, or the definitions are put back now
      const restoreError =
        restoreFailure ?? (await settleDefinitions('a failure'));
      if (restoreError) throw notPutBack(step.description, error, restoreError);
      throw new FrodoError(
        `Error repairing IDM feature ${AI_AGENT_FEATURE_ID}: ${step.description}${
          alignedDifferences && alignedConfigs.size === 0
            ? ' The definitions were not changed: the tenant does not hold what the alignment wrote.'
            : ''
        }`,
        error as Error
      );
    }
  }

  // a plan whose restore step was taken out still gets its definitions put back (or reported as kept aligned)
  const restoredBefore = restoreTried;
  const restoreError = await settleDefinitions('the last step');
  if (restoreError) {
    throw notPutBack(restoreStepOf().description, restoreError, restoreError);
  }
  if (restoreTried && !restoredBefore) {
    diagnosis = await diagnoseAIAgentFeature(tenant);
  }
  diagnosis ??= await diagnoseAIAgentFeature(tenant);
  return {
    featureId: AI_AGENT_FEATURE_ID,
    completed: results.every((result) => result.status !== 'failed'),
    results,
    diagnosis,
  };
}
