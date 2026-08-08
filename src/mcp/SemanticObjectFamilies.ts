export const MCP_SEMANTIC_OBJECT_FAMILIES = {
  user: ['user', 'users'],
  group: ['group', 'groups'],
  organization: ['organization', 'organizations', 'org', 'orgs'],
  application: ['application', 'applications', 'app', 'apps'],
} as const;

export type McpSemanticObjectFamily =
  keyof typeof MCP_SEMANTIC_OBJECT_FAMILIES;

export type McpManagedObjectFamilyMatch = {
  family: McpSemanticObjectFamily;
  type: string;
  realm?: string;
};

const FAMILY_BY_ALIAS = new Map<string, McpSemanticObjectFamily>(
  Object.entries(MCP_SEMANTIC_OBJECT_FAMILIES).flatMap(
    ([family, aliases]) =>
      aliases.map(
        (alias) =>
          [alias, family as McpSemanticObjectFamily] as const
      )
  )
);

export function resolveSemanticObjectFamily(
  value?: string
): McpSemanticObjectFamily | undefined {
  return value ? FAMILY_BY_ALIAS.get(value.trim().toLowerCase()) : undefined;
}

export function matchManagedObjectFamily(
  type: string,
  family: McpSemanticObjectFamily
): McpManagedObjectFamilyMatch | undefined {
  const normalizedType = type.trim().toLowerCase();
  if (normalizedType === family) {
    return { family, type };
  }

  const suffix = `_${family}`;
  if (!normalizedType.endsWith(suffix)) {
    return undefined;
  }

  const realm = type.trim().slice(0, -suffix.length);
  return realm ? { family, type, realm } : undefined;
}

export function descriptorPatternsSupportFamily(
  patterns: readonly string[] | undefined,
  family: McpSemanticObjectFamily
): boolean {
  return (patterns ?? []).some((pattern) => {
    const normalizedPattern = pattern.toLowerCase();
    return (
      normalizedPattern === family || normalizedPattern === `*_${family}`
    );
  });
}