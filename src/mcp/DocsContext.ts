/**
 * Resolves which Ping documentation docset (and version, where applicable) an
 * MCP session's active deployment should be pointed at.
 *
 * @remarks
 * Ping publishes every docs page as a Markdown alternate (swap `.html` for
 * `.md`, or send `Accept: text/markdown`) and a per-product discovery index at
 * `docs.pingidentity.com/{product}/llms.txt` — a flat title-to-URL list an
 * agent can match a question against directly. That fetch-and-match mechanism
 * is generic and needs no logic of its own; what does need logic is picking
 * the right `{product}` and, for versioned products, the right version —
 * getting either wrong doesn't fail loudly, it silently serves plausible but
 * wrong documentation:
 *
 * - Advanced Identity Cloud (`cloud`) is continuously deployed and reports
 *   internal component versions (e.g. an AM version) that run ahead of any
 *   public release. Treating that as a docs version would produce a 404 at
 *   best. The correct behavior is to ignore it entirely and always resolve to
 *   the unversioned `pingoneaic` docset.
 * - Self-managed AM (`classic`) is genuinely versioned, but
 *   `docs.pingidentity.com/pingam/llms.txt` is itself unversioned — it only
 *   ever indexes whichever version is currently latest on the docs site, not
 *   necessarily the one this deployment runs. Verified live: older
 *   version-pinned page trees stay reachable at their own path even once
 *   superseded (e.g. `.../pingam/7.5/...` resolves cleanly with `8.1`
 *   current), so the fix is to rewrite the version segment in a matched page
 *   URL to the deployment's actual version rather than trust whatever the
 *   index links to.
 * - ForgeOps is not yet resolvable: it needs the same versioned treatment on
 *   both the AM and IDM side, chosen by the question's domain. `state` now
 *   tracks an IDM version (best-effort, `undefined` if IDM was unreachable at
 *   login) alongside the existing AM version, but the domain-routing logic to
 *   pick AM vs. IDM per question is still deferred.
 */

import { McpDeploymentType } from './CapabilityTypes';

/** Docs product slugs this resolver knows about. */
export type McpDocsProduct = 'pingoneaic' | 'pingam' | 'pingidm';

/**
 * A resolved docs target: which product, whether it's versioned, and (for
 * versioned products) which version — plus the discovery index URL and
 * guidance on how to use it correctly.
 */
export type McpDocsContext = {
  product: McpDocsProduct;
  versioned: boolean;
  /** Present only when `versioned` is true and a version could be determined. */
  version?: string;
  /** Always the unversioned per-product discovery index — never version-scoped. */
  llmsTxtUrl: string;
  /** Usage guidance specific to this product/version combination. */
  notes: string;
};

/** Returned when the active deployment's docs target cannot be resolved. */
export type McpDocsContextUnresolved = {
  product: null;
  unresolved: true;
  reason: string;
};

const PINGONEAIC_LLMS_TXT_URL =
  'https://docs.pingidentity.com/pingoneaic/llms.txt';
const PINGAM_LLMS_TXT_URL = 'https://docs.pingidentity.com/pingam/llms.txt';

/**
 * Extracts a `major.minor` docs-version segment from frodo-lib's raw AM
 * version string. `state.getAmVersion()` is already a clean semantic version
 * (e.g. `"7.5.0"`, populated by `AuthenticateOps.getSemanticVersion()` at
 * login time) rather than a raw build string, so this mostly just drops the
 * patch segment (e.g. `"7.5.0"` → `"7.5"`) to match docs.pingidentity.com's
 * two-segment version paths. It also treats frodo-lib's own "version unknown"
 * sentinel (`"0.0.0"`) as unresolved rather than a literal docs version.
 *
 * @param rawAmVersion Raw value from `state.getAmVersion()`.
 * @returns The `major.minor` segment, or `undefined` if unset, unparseable,
 *   or the unknown-version sentinel.
 */
export function parseAmDocsVersion(
  rawAmVersion: string | undefined
): string | undefined {
  if (!rawAmVersion || rawAmVersion === '0.0.0') return undefined;
  const match = rawAmVersion.match(/^(\d+)\.(\d+)/);
  return match ? `${match[1]}.${match[2]}` : undefined;
}

/**
 * Resolves the docs target for a deployment, given its type and (for
 * self-managed AM) its raw version string.
 *
 * @param deploymentType Active deployment type, or `undefined` if unknown.
 * @param rawAmVersion Raw value from `state.getAmVersion()`, only consulted
 *   for `classic` deployments.
 * @returns A resolved docs context, or an explicit unresolved result — never
 *   a guess.
 */
export function resolveDocsContext(
  deploymentType: McpDeploymentType | undefined,
  rawAmVersion?: string
): McpDocsContext | McpDocsContextUnresolved {
  if (deploymentType === 'cloud') {
    return {
      product: 'pingoneaic',
      versioned: false,
      llmsTxtUrl: PINGONEAIC_LLMS_TXT_URL,
      notes:
        "Advanced Identity Cloud is continuously deployed and effectively versionless. Ignore any internally-reported component version (e.g. an AM version) when resolving documentation — it does not correspond to a public docs version and may run ahead of any public release. Fetch this llms.txt, match a page by title, then fetch that page's .md URL directly; there is no version segment to rewrite.",
    };
  }

  if (deploymentType === 'classic') {
    const version = parseAmDocsVersion(rawAmVersion);
    if (!version) {
      return {
        product: null,
        unresolved: true,
        reason:
          'Deployment type is classic (self-managed AM) but its version could not be determined from state.getAmVersion().',
      };
    }
    return {
      product: 'pingam',
      versioned: true,
      version,
      llmsTxtUrl: PINGAM_LLMS_TXT_URL,
      notes: `Self-managed AM ${version}. The llms.txt index above is itself unversioned and only reflects whichever version is currently latest on the docs site, not necessarily this deployment's — match a page by title, then rewrite the version segment in the matched URL to ${version} before fetching (e.g. .../pingam/8.1/setup/x.md -> .../pingam/${version}/setup/x.md). If the rewritten URL 404s, this exact version may not have a published doc tree; you may fall back to the index's own (newer) version, but say explicitly that it may not be an exact match rather than presenting it as authoritative for ${version}.`,
    };
  }

  return {
    product: null,
    unresolved: true,
    reason: deploymentType
      ? `No documentation resolution implemented yet for deployment type '${deploymentType}'. ForgeOps needs AM+IDM domain routing (which product a given question belongs to), still deferred even though both AM and IDM versions are now tracked.`
      : 'Deployment type is unknown, so a documentation target cannot be resolved yet.',
  };
}
