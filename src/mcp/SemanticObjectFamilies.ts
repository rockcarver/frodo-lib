import { distance } from 'fastest-levenshtein';

import { normalizeSemanticIdentifier } from './SemanticIdentifiers';

export const MCP_SEMANTIC_OBJECT_SYNONYMS: Readonly<Record<string, string>> = {
  identity: 'user',
  identities: 'user',
  people: 'user',
  person: 'user',
};

export const MCP_AMBIGUOUS_OBJECT_CONCEPTS: Readonly<
  Record<string, readonly string[]>
> = {
  entitlement: ['assignment', 'role', 'aiagentprivilege'],
  entitlements: ['assignment', 'role', 'aiagentprivilege'],
};

export type McpSemanticObjectFamily = string;

export type McpManagedObjectFamilyMatch = {
  family: McpSemanticObjectFamily;
  type: string;
  realm?: string;
};

export type McpSemanticObjectFamilyResolution =
  | { status: 'resolved'; family: McpSemanticObjectFamily }
  | { status: 'ambiguous'; candidates: McpSemanticObjectFamily[] }
  | { status: 'unresolved'; candidates: McpSemanticObjectFamily[] };

type FamilyCandidate = {
  family: McpSemanticObjectFamily;
  normalized: string;
};

export function normalizeSemanticObjectFamily(value: string): string {
  return normalizeSemanticIdentifier(value).join('');
}

export function discoverManagedObjectFamilies(
  managedObjectTypes: readonly string[]
): McpSemanticObjectFamily[] {
  return [
    ...new Set(
      managedObjectTypes.map((type) => {
        const separator = type.indexOf('_');
        return (
          separator >= 0 ? type.slice(separator + 1) : type
        ).toLowerCase();
      })
    ),
  ].sort();
}

export function resolveSemanticObjectFamily(
  value: string | undefined,
  managedObjectTypes: readonly string[] = []
): McpSemanticObjectFamilyResolution {
  if (!value?.trim()) return { status: 'unresolved', candidates: [] };

  const normalizedInput = normalizeSemanticObjectFamily(value);
  const candidates = buildFamilyCandidates(managedObjectTypes);
  const exactCandidate = candidates.find(
    (candidate) => candidate.normalized === normalizedInput
  );
  if (exactCandidate) {
    return { status: 'resolved', family: exactCandidate.family };
  }

  const ambiguous = MCP_AMBIGUOUS_OBJECT_CONCEPTS[value.trim().toLowerCase()];
  if (ambiguous) {
    const available = ambiguous.filter((family) =>
      managedObjectTypes.some((type) => matchManagedObjectFamily(type, family))
    );
    return {
      status: 'ambiguous',
      candidates: available.length > 0 ? available : [...ambiguous],
    };
  }

  const synonym = MCP_SEMANTIC_OBJECT_SYNONYMS[value.trim().toLowerCase()];
  const requested = synonym ?? normalizedInput;
  if (candidates.length === 0) {
    return { status: 'resolved', family: requested };
  }

  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(requested, candidate.normalized),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.family.localeCompare(right.family)
    );
  if (ranked.length === 0) {
    return {
      status: 'unresolved',
      candidates: closestCandidates(requested, candidates),
    };
  }

  const best = ranked.filter(
    (candidate) => candidate.score === ranked[0].score
  );
  if (best.length > 1) {
    return {
      status: 'ambiguous',
      candidates: best.map((candidate) => candidate.family),
    };
  }
  return { status: 'resolved', family: ranked[0].family };
}

export function matchManagedObjectFamily(
  type: string,
  family: McpSemanticObjectFamily
): McpManagedObjectFamilyMatch | undefined {
  const normalizedType = type.trim().toLowerCase();
  const normalizedFamily = family.trim().toLowerCase();
  if (normalizedType === normalizedFamily) {
    return { family: normalizedFamily, type };
  }

  const suffix = `_${normalizedFamily}`;
  if (!normalizedType.endsWith(suffix)) return undefined;

  const realm = type.trim().slice(0, -suffix.length);
  return realm ? { family: normalizedFamily, type, realm } : undefined;
}

export function descriptorPatternsSupportFamily(
  patterns: readonly string[] | undefined,
  family: McpSemanticObjectFamily
): boolean {
  return (patterns ?? []).some((pattern) => {
    const normalizedPattern = pattern.toLowerCase();
    return (
      normalizedPattern === '*' ||
      normalizedPattern === family ||
      normalizedPattern === `*_${family}`
    );
  });
}

function buildFamilyCandidates(
  managedObjectTypes: readonly string[]
): FamilyCandidate[] {
  const candidates = new Map<string, FamilyCandidate>();
  for (const type of managedObjectTypes) {
    const parts = type.trim().toLowerCase().split('_').filter(Boolean);
    for (let index = 0; index < parts.length; index += 1) {
      const family = parts.slice(index).join('_');
      const normalized = normalizeSemanticObjectFamily(family);
      candidates.set(normalized, { family, normalized });
    }
  }
  return [...candidates.values()];
}

function scoreCandidate(requested: string, candidate: string): number {
  if (requested === candidate) return 100;
  if (requested.length >= 3 && candidate.startsWith(requested)) {
    return 80 - Math.min(candidate.length - requested.length, 20);
  }
  const editDistance = distance(requested, candidate);
  const maximumDistance = Math.max(1, Math.floor(candidate.length * 0.2));
  return editDistance <= maximumDistance ? 60 - editDistance : 0;
}

function closestCandidates(
  requested: string,
  candidates: readonly FamilyCandidate[]
): McpSemanticObjectFamily[] {
  return [...candidates]
    .sort(
      (left, right) =>
        distance(requested, left.normalized) -
          distance(requested, right.normalized) ||
        left.family.localeCompare(right.family)
    )
    .slice(0, 3)
    .map((candidate) => candidate.family);
}
