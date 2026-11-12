import { type AgentSkeleton } from '../../api/AgentApi';

/**
 * Routing of the `agent` section of an export to the modules that own a type.
 *
 * A configuration type that has a module of its own (and an export key of its
 * own) is handled by that module alone. An export made before that was
 * enforced, or an `agent export` file of the 4.x line, can still hold such an
 * object in the `agent` section. This module decides, without any request,
 * where each object of the section is written on import: whatever is not owned
 * by a module stays in `agent`, and the rest goes to the section of its module.
 */

/**
 * The agent type ids that have a module of their own, with the key of the
 * module's section in a full export (`realm.<realm>.<key>`).
 */
export const AGENT_SECTION_ROUTES: Record<string, string> = {
  CIMDProfile: 'cimdProfile',
  TrustedJwtIssuer: 'trustedJwtIssuer',
};

/**
 * The agent copy of an object that a module's section has as well.
 */
export type SkippedAgentCopy = {
  /** the id of the object */
  id: string;
  /** the key of the module's section that holds the copy that is kept */
  key: string;
};

export type RoutedAgentSection = {
  /**
   * The `agent` section without the objects that a module owns. `undefined`
   * when the section is absent, or when it held only such objects (there is
   * nothing left for the generic agent import to do).
   */
  agent: Record<string, AgentSkeleton> | undefined;
  /**
   * The section of each module (by its export key): the module's own section
   * extended with the objects of the `agent` section that it owns and that the
   * module's section does not have. A key is only present if the realm data
   * has the module's section or an object was routed to it.
   */
  routed: Record<string, Record<string, any>>;
  /**
   * The copies in the `agent` section that were dropped because the module's
   * section has the object (the module's copy wins).
   */
  skipped: SkippedAgentCopy[];
};

/**
 * Find the key of the module section that owns an agent object.
 * @param {unknown} agent an object of the `agent` section
 * @returns {string | undefined} the export key of the owner, or undefined if the generic agent code owns the object
 */
function routeOf(agent: unknown): string | undefined {
  const typeId = (agent as AgentSkeleton | undefined)?._type?._id;
  return typeof typeId === 'string' &&
    Object.prototype.hasOwnProperty.call(AGENT_SECTION_ROUTES, typeId)
    ? AGENT_SECTION_ROUTES[typeId]
    : undefined;
}

/**
 * Route the objects of the `agent` section of one realm of an export to the
 * modules that own their type. A pure function: it makes no request and does not
 * modify its argument (the objects of the sections are shared with the result,
 * not copied).
 * @param {object} realmData the sections of one realm of an export (`realm.<realm>`), or the data of a module import
 * @returns {RoutedAgentSection} where each object is written
 */
export function routeAgentSection(
  realmData: Record<string, any> | undefined
): RoutedAgentSection {
  const data = realmData ?? {};
  const routed: Record<string, Record<string, any>> = {};
  for (const key of new Set(Object.values(AGENT_SECTION_ROUTES))) {
    if (data[key]) routed[key] = { ...data[key] };
  }
  const agentSection: Record<string, AgentSkeleton> | undefined = data.agent;
  if (!agentSection) {
    return { agent: undefined, routed, skipped: [] };
  }

  const remaining: [string, AgentSkeleton][] = [];
  const skipped: SkippedAgentCopy[] = [];
  const added: Record<string, [string, AgentSkeleton][]> = {};
  for (const [id, agent] of Object.entries(agentSection)) {
    const key = routeOf(agent);
    if (!key) {
      remaining.push([id, agent]);
    } else if (
      data[key] &&
      Object.prototype.hasOwnProperty.call(data[key], id)
    ) {
      skipped.push({ id, key });
    } else {
      (added[key] ??= []).push([id, agent]);
    }
  }
  for (const [key, entries] of Object.entries(added)) {
    routed[key] = Object.fromEntries([
      ...Object.entries(routed[key] ?? {}),
      ...entries,
    ]);
  }

  const nothingLeft =
    remaining.length === 0 && Object.keys(agentSection).length > 0;
  return {
    agent: nothingLeft ? undefined : Object.fromEntries(remaining),
    routed,
    skipped,
  };
}
