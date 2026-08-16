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
 * - ForgeOps (`forgeops`) runs AM and IDM as separately versioned components,
 *   each with its own docset (`pingam`, `pingidm`), so a single docs target
 *   can't be resolved without knowing which component a given question is
 *   about. Rather than guess, `resolveDocsContext` returns both components'
 *   docs targets plus `domainRouting` — a lookup from frodo's own top-level
 *   capability domain (the `frodo.<domain>...` namespace a skill's `domain`
 *   field already reports, e.g. `'realm'`, `'idm'`, `'authn'`) to which
 *   component owns it, built from the actual API generator (`generateAmApi`
 *   vs `generateIdmApi`) each domain's operations call under the hood.
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

/** Returned when a docs target cannot be resolved. */
export type McpDocsContextUnresolved = {
  product: null;
  unresolved: true;
  reason: string;
};

/**
 * Which product's docs own a given top-level frodo capability domain (the
 * `frodo.<domain>...` namespace, e.g. `'realm'`, `'idm'`, `'authn'`):
 *
 * - `'am'` / `'idm'`: operations under this domain call that component's API
 *   exclusively (verified against the actual `generateAmApi`/`generateIdmApi`
 *   call sites, not inferred from the domain's name — several domain names
 *   are misleading, e.g. `user` is AM's identity-store users REST resource,
 *   not IDM managed users, which live under `idm.managed` instead).
 * - `'both'`: the domain spans both components (e.g. whole-tenant config
 *   export/import), so a single product can't be chosen for it.
 * - `'cloud-only'`: an Advanced Identity Cloud SaaS feature with no ForgeOps
 *   equivalent at all (ESVs, IGA, promotion, service accounts, ...).
 * - `'n/a'`: an internal/client-side helper with no corresponding product
 *   documentation (HTTP client factory, local utility functions, connection
 *   profile and token cache management).
 */
export type McpDocsDomainProduct = 'am' | 'idm' | 'both' | 'cloud-only' | 'n/a';

/**
 * Verified domain → product mapping for every top-level frodo capability
 * domain, derived from which API generator (`generateAmApi`/
 * `generateAmAuthApi`/`generateOauth2Api` vs `generateIdmApi`) that domain's
 * operations call. Domains not listed here default to `'both'` in
 * {@link classifyDomainProduct} — an unclassified domain should prompt
 * checking both docsets rather than silently guessing one.
 */
export const FORGEOPS_DOMAIN_PRODUCT_MAP: Record<string, McpDocsDomainProduct> =
  {
    admin: 'am',
    agent: 'am',
    am: 'am',
    app: 'am',
    authn: 'am',
    authz: 'am',
    cache: 'n/a',
    cloud: 'cloud-only',
    config: 'both',
    conn: 'n/a',
    email: 'idm',
    factory: 'n/a',
    idm: 'idm',
    info: 'both',
    login: 'am',
    oauth2oidc: 'am',
    rawConfig: 'both',
    realm: 'am',
    role: 'idm',
    saml2: 'am',
    script: 'am',
    scriptType: 'am',
    server: 'am',
    secretStore: 'am',
    service: 'am',
    session: 'am',
    site: 'am',
    theme: 'idm',
    user: 'am',
    utils: 'n/a',
  };

/**
 * Classifies a top-level frodo capability domain by which product's docs own
 * it. Falls back to `'both'` for anything not in
 * {@link FORGEOPS_DOMAIN_PRODUCT_MAP} — an unrecognized domain should never
 * be silently routed to one product's docs.
 */
export function classifyDomainProduct(domain: string): McpDocsDomainProduct {
  return FORGEOPS_DOMAIN_PRODUCT_MAP[domain] ?? 'both';
}

/** A resolved forgeops docs target: independently versioned AM and IDM docsets, plus domain routing. */
export type McpDocsContextForgeops = {
  deploymentType: 'forgeops';
  am: McpDocsContext | McpDocsContextUnresolved;
  idm: McpDocsContext | McpDocsContextUnresolved;
  domainRouting: Record<string, McpDocsDomainProduct>;
  notes: string;
};

const PINGONEAIC_LLMS_TXT_URL =
  'https://docs.pingidentity.com/pingoneaic/llms.txt';
const PINGAM_LLMS_TXT_URL = 'https://docs.pingidentity.com/pingam/llms.txt';
const PINGIDM_LLMS_TXT_URL = 'https://docs.pingidentity.com/pingidm/llms.txt';

/**
 * Extracts a `major.minor` docs-version segment from frodo-lib's raw AM or
 * IDM version string. Both `state.getAmVersion()` and `state.getIdmVersion()`
 * are already clean semantic versions (e.g. `"7.5.0"`, `"8.1.0"`, populated
 * via `AuthenticateOps.getSemanticVersion()` at login time) rather than raw
 * build strings, so this mostly just drops the patch segment (e.g. `"7.5.0"`
 * → `"7.5"`) to match docs.pingidentity.com's two-segment version paths. It
 * also treats frodo-lib's own "version unknown" sentinel (`"0.0.0"`) as
 * unresolved rather than a literal docs version.
 *
 * @param rawVersion Raw value from `state.getAmVersion()` or `state.getIdmVersion()`.
 * @returns The `major.minor` segment, or `undefined` if unset, unparseable,
 *   or the unknown-version sentinel.
 */
function extractDocsMajorMinor(
  rawVersion: string | undefined
): string | undefined {
  if (!rawVersion || rawVersion === '0.0.0') return undefined;
  const match = rawVersion.match(/^(\d+)\.(\d+)/);
  return match ? `${match[1]}.${match[2]}` : undefined;
}

/** @see extractDocsMajorMinor */
export function parseAmDocsVersion(
  rawAmVersion: string | undefined
): string | undefined {
  return extractDocsMajorMinor(rawAmVersion);
}

/** @see extractDocsMajorMinor */
export function parseIdmDocsVersion(
  rawIdmVersion: string | undefined
): string | undefined {
  return extractDocsMajorMinor(rawIdmVersion);
}

function resolveVersionedAmDocs(
  rawAmVersion: string | undefined
): McpDocsContext | McpDocsContextUnresolved {
  const version = parseAmDocsVersion(rawAmVersion);
  if (!version) {
    return {
      product: null,
      unresolved: true,
      reason: 'AM version could not be determined from state.getAmVersion().',
    };
  }
  return {
    product: 'pingam',
    versioned: true,
    version,
    llmsTxtUrl: PINGAM_LLMS_TXT_URL,
    notes: `AM ${version}. The llms.txt index above is itself unversioned and only reflects whichever version is currently latest on the docs site, not necessarily this deployment's — match a page by title, then rewrite the version segment in the matched URL to ${version} before fetching (e.g. .../pingam/8.1/setup/x.md -> .../pingam/${version}/setup/x.md). If the rewritten URL 404s, this exact version may not have a published doc tree; you may fall back to the index's own (newer) version, but say explicitly that it may not be an exact match rather than presenting it as authoritative for ${version}.`,
  };
}

function resolveVersionedIdmDocs(
  rawIdmVersion: string | undefined
): McpDocsContext | McpDocsContextUnresolved {
  const version = parseIdmDocsVersion(rawIdmVersion);
  if (!version) {
    return {
      product: null,
      unresolved: true,
      reason:
        'IDM version could not be determined from state.getIdmVersion() (IDM may have been unreachable at login).',
    };
  }
  return {
    product: 'pingidm',
    versioned: true,
    version,
    llmsTxtUrl: PINGIDM_LLMS_TXT_URL,
    notes: `IDM ${version}. The llms.txt index above is itself unversioned and only reflects whichever version is currently latest on the docs site, not necessarily this deployment's — match a page by title, then rewrite the version segment in the matched URL to ${version} before fetching (e.g. .../pingidm/7.5/objects/x.md -> .../pingidm/${version}/objects/x.md). If the rewritten URL 404s, this exact version may not have a published doc tree; you may fall back to the index's own (newer) version, but say explicitly that it may not be an exact match rather than presenting it as authoritative for ${version}.`,
  };
}

/**
 * Resolves the docs target for a deployment, given its type and (for
 * self-managed AM/IDM) its raw version string(s).
 *
 * @param deploymentType Active deployment type, or `undefined` if unknown.
 * @param rawAmVersion Raw value from `state.getAmVersion()`, consulted for
 *   `classic` and `forgeops` deployments.
 * @param rawIdmVersion Raw value from `state.getIdmVersion()`, consulted only
 *   for `forgeops` deployments (classic has no IDM component; cloud ignores
 *   component versions by design).
 * @returns A resolved docs context, or an explicit unresolved result — never
 *   a guess.
 */
export function resolveDocsContext(
  deploymentType: McpDeploymentType | undefined,
  rawAmVersion?: string,
  rawIdmVersion?: string
): McpDocsContext | McpDocsContextUnresolved | McpDocsContextForgeops {
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
    const amDocs = resolveVersionedAmDocs(rawAmVersion);
    if (amDocs.product === null) {
      return {
        product: null,
        unresolved: true,
        reason: `Deployment type is classic (self-managed AM) but its version could not be determined from state.getAmVersion().`,
      };
    }
    return amDocs;
  }

  if (deploymentType === 'forgeops') {
    return {
      deploymentType: 'forgeops',
      am: resolveVersionedAmDocs(rawAmVersion),
      idm: resolveVersionedIdmDocs(rawIdmVersion),
      domainRouting: FORGEOPS_DOMAIN_PRODUCT_MAP,
      notes:
        "ForgeOps runs AM and IDM as separately versioned components with independent docsets (see `am` and `idm` above). Pick between them by looking up the capability's own `domain` field (the `frodo.<domain>...` top-level namespace, e.g. 'realm', 'idm', 'authn') in `domainRouting`: 'am' or 'idm' means that component's docs exclusively; 'both' (config, info, rawConfig) means the operation spans both, so check both docsets or narrow by the specific field in question; 'cloud-only' (cloud.*) means the feature is Advanced Identity Cloud SaaS-only and has no ForgeOps equivalent or documentation at all; 'n/a' (factory, utils, conn, cache) means an internal/client-side helper with no product documentation. A domain missing from `domainRouting` defaults to 'both' — never assume a single product for it.",
    };
  }

  return {
    product: null,
    unresolved: true,
    reason: deploymentType
      ? `No documentation resolution implemented yet for deployment type '${deploymentType}'.`
      : 'Deployment type is unknown, so a documentation target cannot be resolved yet.',
  };
}
