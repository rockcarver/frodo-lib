import pluralize from 'pluralize';

export const MCP_SEMANTIC_TERM_SYNONYMS: Readonly<Record<string, string>> = {
  org: 'organization',
};

/**
 * Converts a technical identifier or natural-language phrase into canonical
 * semantic terms while preserving enough structure for catalog matching.
 */
export function normalizeSemanticIdentifier(value: string): string[] {
  return [
    ...new Set(
      value
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .toLowerCase()
        .split(/[^a-z0-9*]+/)
        .filter(Boolean)
        .map((term) => {
          const singular = pluralize.singular(term);
          return MCP_SEMANTIC_TERM_SYNONYMS[singular] ?? singular;
        })
    ),
  ];
}

export type McpSemanticIdentifierMatch = {
  identifier: string;
  matchedTerms: string[];
  score: number;
};

/**
 * Ranks live catalog identifiers against one or more semantic phrases and
 * returns every identifier tied for the best positive score.
 */
export function matchSemanticIdentifiers(
  phrases: readonly string[],
  identifiers: readonly string[]
): McpSemanticIdentifierMatch[] {
  const requestedTerms = new Set(
    phrases.flatMap((phrase) => normalizeSemanticIdentifier(phrase))
  );
  if (requestedTerms.size === 0) return [];

  const ranked = identifiers
    .map((identifier) => {
      const identifierTerms = normalizeSemanticIdentifier(identifier);
      const matchedTerms = identifierTerms.filter((term) =>
        requestedTerms.has(term)
      );
      const completeMatch = matchedTerms.length === identifierTerms.length;
      return {
        identifier,
        matchedTerms,
        score:
          matchedTerms.length * 100 +
          Math.round((matchedTerms.length / identifierTerms.length) * 50) +
          (completeMatch ? 50 : 0),
      };
    })
    .filter((match) => match.matchedTerms.length > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.identifier.localeCompare(right.identifier)
    );
  if (ranked.length === 0) return [];
  return ranked.filter((match) => match.score === ranked[0].score);
}
