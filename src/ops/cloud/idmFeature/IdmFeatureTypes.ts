/**
 * Types of the diagnosis and the repair of an IDM tenant-configuration feature
 * (`frodo.cloud.idmFeature.diagnoseIdmFeature`, `planIdmFeatureRepair`, `repairIdmFeature`).
 */

/**
 * How serious a finding is.
 * - `error`: the feature does not work, or a repair is needed for it to work.
 * - `warning`: advisory; the feature may work. A warning is repaired only when it says it is `repairable`: white space
 *   that only makes the registry read "not installed", which a repair normalises.
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
   * Put the customizations back after the repair. Default: false.
   *
   * A repair that has to align definitions with the original (the enable action installs the feature internally and
   * must not run on definitions that are present but not equal) leaves them aligned, so that the registry reads the
   * feature installed. A customization is a title or an extra mapping property that somebody set on purpose; with this
   * option the repair puts those back at the end, and the registry then reads "not installed" again, because it
   * compares the definitions byte for byte. White space is never put back: it adds no configuration and no function.
   */
  restoreCustomizations?: boolean;
  /**
   * The authentication service an OAuth 2.0 provider without a password grant authentication service is given.
   * Default: `Login`, the one the providers of healthy tenants use. It has to exist as an authentication tree in the
   * realm.
   */
  authService?: string;
};

/**
 * One difference between a definition of the feature in the tenant and the original, as a plan or a result reports it.
 * Plain data, so a caller can show it and keep it.
 */
export type IdmFeatureDefinitionChange = {
  /** The configuration object the definition is in. */
  config: 'managed' | 'repo.ds';
  /** The managed object name (`managed`) or the mapping key such as `managed/alpha_aiagent` (`repo.ds`). */
  object: string;
  /** Where in the object, for people: `schema.title`, `onDelete.source`. */
  location: string;
  /** `changed`: both have it and the values differ. `extra`: only the tenant has it. `missing`: only the original has it. */
  kind: 'missing' | 'extra' | 'changed';
  /** `whitespace` differs from the original only in white space; `title` and `extra-mapping-property` are customizations. */
  class: 'whitespace' | 'title' | 'extra-mapping-property';
  /** The value in the tenant; absent if the tenant lacks it. Long values are not shortened: this is the data to restore from. */
  tenantValue?: unknown;
  /** The value in the original; absent if the original lacks it. */
  originalValue?: unknown;
};

/** A customization (a title or an extra mapping property) and what a repair does with it. */
export type IdmFeatureCustomization = IdmFeatureDefinitionChange & {
  /**
   * `replaced`: the repair writes the original and leaves it, so that the registry reads the feature installed.
   * `put-back`: the repair writes the original and puts the customization back at the end (`restoreCustomizations`);
   * the registry then reads "not installed", because it compares the definitions byte for byte.
   */
  outcome: 'replaced' | 'put-back';
};

/** What a step of a repair does. */
export type IdmFeatureRepairStepId =
  /** delete a mapping of the realm's secret store whose alias is no ESV secret */
  | 'delete-secret-mapping'
  /** create the OAuth 2.0 provider of a realm from the server's template */
  | 'create-provider'
  /** set the password grant authentication service of a provider that has none */
  | 'set-auth-service'
  /** write the original over drifted definitions (white space, customizations): the enable action is then safe, and the registry reads installed */
  | 'align-definitions'
  /** run the environment action that enables AI agents */
  | 'enable'
  /** poll until AM accepts AI agents in the realms; only if the repair is asked to wait */
  | 'wait-for-gate'
  /** put the customizations (titles, extra mapping properties) back; only if the repair is asked to */
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
    /** The `_id` of the mapping as the read returned it (the id it has in the URL); absent when the read returned none. */
    _id?: string;
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
 *
 * The plan holds the raw backup of the tenant configuration (see {@link IdmFeatureRepairBackup}); handle it like the
 * configuration itself. A plan is plain data and `repairIdmFeature` does not trust it: what it writes is taken from the
 * shipped original definitions and from the tenant as it is read at that moment, and a plan that does not match them is
 * refused.
 */
export type IdmFeatureRepairPlan = {
  featureId: string;
  /** The options the plan was made with (defaults filled in). */
  options: { restoreCustomizations: boolean; authService: string };
  /** The diagnosis the plan is made from. */
  diagnosis: IdmFeatureDiagnosis;
  /**
   * The differences from the original that the plan aligns and that are only white space: normalised, never put back.
   * Empty if the plan aligns nothing.
   */
  normalised: IdmFeatureDefinitionChange[];
  /**
   * The customizations the plan replaces by the original, each with what happens to it: `replaced` (it stays
   * replaced) or `put-back` (the plan puts it back at the end, because `restoreCustomizations` is set). Empty if the
   * plan aligns nothing or finds no customization. What a person may want to restore is in `tenantValue`.
   */
  customizations: IdmFeatureCustomization[];
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
  /** The white space this run normalised (it aligned it with the original and did not put it back). */
  normalised: IdmFeatureDefinitionChange[];
  /**
   * The customizations this run replaced by the original, each with its outcome: `replaced` (it is not in the tenant
   * any more; `tenantValue` is what it was) or `put-back` (the run put it back, `restoreCustomizations`).
   */
  customizations: IdmFeatureCustomization[];
};
