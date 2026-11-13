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
