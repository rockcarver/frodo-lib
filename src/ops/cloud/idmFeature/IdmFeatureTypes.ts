/**
 * Types of the diagnosis and the repair of an IDM tenant-configuration feature
 * (`frodo.cloud.idmFeature.diagnoseIdmFeature`, `planIdmFeatureRepair`, `repairIdmFeature`).
 */

/**
 * How serious a finding is.
 * - `error`: the feature does not work, or a repair is needed for it to work.
 * - `warning`: cosmetic or advisory; the feature may work. A warning is never repaired.
 * - `info`: a fact about a healthy part of the feature.
 */
export type IdmFeatureFindingSeverity = 'error' | 'warning' | 'info';

/**
 * One thing the diagnosis of an IDM feature found.
 *
 * The `id` names the condition and is stable, so a caller can switch on it. A condition that exists per realm is
 * reported once per realm, with the realm in `details.realm`.
 */
export type IdmFeatureFinding = {
  /** Stable id of the condition, for example `definitions-cosmetic-drift` or `gate-closed`. */
  id: string;
  severity: IdmFeatureFindingSeverity;
  /** A sentence that states the fact; it never names a command line option. */
  message: string;
  /** True if `planIdmFeatureRepair` can repair this condition. */
  repairable: boolean;
  /** The facts behind the finding (realm, differences, aliases, status codes); plain data. */
  details: Record<string, unknown>;
};

/**
 * The result of `diagnoseIdmFeature`.
 */
export type IdmFeatureDiagnosis = {
  /** The id of the feature that was diagnosed. */
  featureId: string;
  /**
   * False if the library has no diagnosis for this feature. Such a result has no findings: the feature is not
   * judged, only its registry entry is reported.
   */
  supported: boolean;
  /** The version the registry reports as installed; null if it reports none (or the feature is unknown). */
  installedVersion: string | null;
  /** The versions the registry lists as available. */
  availableVersions: string[];
  findings: IdmFeatureFinding[];
};

/**
 * Options of `planIdmFeatureRepair`.
 */
export type IdmFeatureRepairOptions = {
  /**
   * Leave the definitions aligned with the original after the repair. Default: false. A repair that has to align
   * definitions to be able to run the enable action puts them back as they were at the end; the registry then reads
   * "not installed" again if they were customised.
   */
  keepAligned?: boolean;
  /**
   * The authentication service an OAuth 2.0 provider without a password grant authentication service is given.
   * Default: `Login`, the one the providers of healthy tenants use. It has to exist as an authentication tree in the
   * realm.
   */
  authService?: string;
};

/** What a step of a repair does. */
export type IdmFeatureRepairStepId =
  /** delete a mapping of the realm's secret store whose alias is no ESV secret */
  | 'delete-secret-mapping'
  /** create the OAuth 2.0 provider of a realm from the server's template */
  | 'create-provider'
  /** set the password grant authentication service of a provider that has none */
  | 'set-auth-service'
  /** write the original over cosmetically drifted definitions, so that the enable action is safe */
  | 'align-definitions'
  /** run the environment action that enables AI agents */
  | 'enable'
  /** poll until AM accepts AI agents in the realms; only if the repair is asked to wait */
  | 'wait-for-gate'
  /** put the customised definitions back */
  | 'restore-definitions'
  /** diagnose the feature again */
  | 'diagnose';

/** One step of a repair plan. */
export type IdmFeatureRepairStep = {
  id: IdmFeatureRepairStepId;
  /** A sentence that says what the step does and to what. */
  description: string;
  /** The realm the step works in, if it works in one. */
  realm?: string;
  /** True if the step changes something in the tenant. */
  writes: boolean;
  /** What the step writes (no secret values): the mapping, the attribute, the differences. */
  details: Record<string, unknown>;
};

/**
 * What a repair would overwrite or delete, as the tenant returned it, so that a caller can keep it before anything is
 * written. The library writes no file: the caller keeps the backup, and it protects it like the configuration it is (an
 * OAuth 2.0 provider holds settings that are not meant to be shared).
 */
export type IdmFeatureRepairBackup = {
  /** The registry entry of the feature. */
  feature: unknown;
  /** `config/managed` */
  managed: unknown;
  /** `config/repo.ds` */
  repoDs: unknown;
  /** The OAuth 2.0 provider of each realm that has the feature's managed objects; null if the realm has none. */
  providers: Record<string, unknown>;
  /** The IDM objects of the managed object types `<realm>_aiagent` and `<realm>_aiagentprivilege`, by type. */
  idmObjects: Record<string, unknown[]>;
  /** The secret store mappings the plan deletes. */
  secretStoreMappings: {
    realm: string;
    storeId: string;
    storeTypeId: string;
    secretId: string;
    aliases: string[];
  }[];
};

/** Why a repair cannot be planned. */
export type IdmFeatureRepairBlocker = {
  /** Stable id: the id of the finding that blocks, or `authentication-service-missing`, `registry-unexplained`. */
  id: string;
  message: string;
};

/**
 * The result of `planIdmFeatureRepair`: what a repair would do. Nothing has been written.
 */
export type IdmFeatureRepairPlan = {
  featureId: string;
  /** The options the plan was made with (defaults filled in). */
  options: { keepAligned: boolean; authService: string };
  /** The diagnosis the plan is made from. */
  diagnosis: IdmFeatureDiagnosis;
  /**
   * False if something blocks the repair (see `blockers`); the plan then has no steps and no backup data. True with no
   * steps means there is nothing to repair.
   */
  repairable: boolean;
  blockers: IdmFeatureRepairBlocker[];
  /** In the order they run. */
  steps: IdmFeatureRepairStep[];
  backup: IdmFeatureRepairBackup;
};

/** Options of `repairIdmFeature`. */
export type IdmFeatureRepairExecutionOptions = {
  /**
   * Poll until AM accepts AI agents in the realms the repair enabled, and return as soon as it does. Default: false.
   * Without it the repair returns after the enable action answered and the gate may still be closed; it can need
   * minutes to open.
   */
  wait?: boolean;
  /** How long to wait for the gate, in milliseconds. Default: 1,200,000 (20 minutes). */
  timeout?: number;
  /** Called with the result of each step as soon as it is known. An error it throws is ignored. */
  resultCallback?: (result: IdmFeatureRepairStepResult) => void;
};

/** The result of one step. */
export type IdmFeatureRepairStepResult = {
  step: IdmFeatureRepairStep;
  /** `done`; `skipped` (nothing to do, or the step is not asked for); `failed` (it did not reach its goal). */
  status: 'done' | 'skipped' | 'failed';
  message: string;
};

/** The result of `repairIdmFeature`. */
export type IdmFeatureRepairResult = {
  featureId: string;
  /** True if every step reached its goal, including the gate being open if the repair waited for it. */
  completed: boolean;
  results: IdmFeatureRepairStepResult[];
  /** The diagnosis after the repair. */
  diagnosis: IdmFeatureDiagnosis;
};
