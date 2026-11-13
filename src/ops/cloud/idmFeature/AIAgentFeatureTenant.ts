/**
 * How the diagnosis (and the repair) of the IDM feature `aiagent` reaches a tenant.
 *
 * @remarks
 * The logic of the diagnosis works on this interface, not on HTTP, so a test can replace the tenant with a fake. The
 * implementation for a real tenant ({@link createAIAgentFeatureTenant}) is the only place that makes requests. A request
 * that belongs to a realm runs with the realm of the state switched for the length of the call and put back in a
 * `finally` block, so the caller's realm is the same afterwards whatever happens.
 */
import { getAgentsByType, getAgentTypes } from '../../../api/AgentApi';
import {
  getIdmFeature,
  IdmFeatureActionResponse,
  IdmFeatureInterface,
  validateIdmFeature,
} from '../../../api/cloud/IdmFeatureApi';
import { getSecrets } from '../../../api/cloud/SecretsApi';
import { getConfigEntity } from '../../../api/IdmConfigApi';
import { queryManagedObjects } from '../../../api/ManagedObjectApi';
import {
  getOAuth2Provider,
  OAuth2ProviderSkeleton,
} from '../../../api/OAuth2ProviderApi';
import {
  getSecretStoreMappings,
  getSecretStores,
} from '../../../api/SecretStoreApi';
import { getTree } from '../../../api/TreeApi';
import { State } from '../../../shared/State';
import { getFailedResponse, isNotFoundError } from '../../FrodoError';
import {
  ManagedConfigLike,
  RepoDsConfigLike,
} from './AIAgentFeatureDefinitions';
import { AI_AGENT_FEATURE_ID } from './AIAgentFeatureReference';

/** What a realm's AM says about the AI agent type. */
export type AIAgentGateState = {
  /** `AIAgent` is in the list of agent types of the realm. */
  typeListed: boolean;
  /**
   * The HTTP status of listing the AI agents (`200` open, `501` closed: "OAuth 2.0 for AI Agents is not enabled");
   * null if the request did not get an answer.
   */
  listStatus: number | null;
  /** The number of AI agents AM lists; null if it could not list them. */
  agentCount: number | null;
};

/** One mapping of a realm's secret store: a secret id of AM and the aliases (ESV secret names) it points to. */
export type AIAgentSecretMapping = {
  secretId: string;
  aliases: string[];
};

/** The mappings of one secret store of a realm that is backed by ESV secrets. */
export type AIAgentSecretStoreMappings = {
  storeId: string;
  storeTypeId: string;
  mappings: AIAgentSecretMapping[];
};

/** The reads the diagnosis needs. Every method throws what the request threw. */
export interface AIAgentFeatureTenant {
  /** `GET /openidm/feature/aiagent`. */
  readFeature(): Promise<IdmFeatureInterface>;
  /** `POST /openidm/feature/aiagent?_action=validate`: a dry run, installs nothing. */
  validateFeature(): Promise<IdmFeatureActionResponse>;
  /** `GET /openidm/config/managed`. */
  readManagedConfig(): Promise<ManagedConfigLike>;
  /** `GET /openidm/config/repo.ds`. */
  readRepoDs(): Promise<RepoDsConfigLike>;
  /** The OAuth 2.0 provider of the realm; undefined if the realm has none (HTTP 404). */
  readProvider(realm: string): Promise<OAuth2ProviderSkeleton | undefined>;
  /** True if the realm has an authentication tree of that name. */
  authServiceExists(realm: string, name: string): Promise<boolean>;
  /** What the realm's AM says about the AI agent type. */
  readGate(realm: string): Promise<AIAgentGateState>;
  /** The ids of the ESV secrets of the environment. */
  readEsvSecretIds(): Promise<string[]>;
  /** The mappings of the realm's secret stores that are backed by ESV secrets. */
  readSecretStoreMappings(realm: string): Promise<AIAgentSecretStoreMappings[]>;
  /** The number of IDM objects of the realm's AI agent managed object (`<realm>_aiagent`). */
  countIdmAgents(realm: string): Promise<number>;
}

/** The secret store type whose mappings point to ESV secrets. */
export const ESV_SECRET_STORE_TYPE = 'GoogleSecretManagerSecretStoreProvider';

/**
 * The tenant behind a state.
 * @param {State} state the state of a library user that is logged in to the tenant
 * @returns {AIAgentFeatureTenant} the reads of the diagnosis, as requests to that tenant
 */
export function createAIAgentFeatureTenant(state: State): AIAgentFeatureTenant {
  /** Run `call` with the state on `realm`; the caller's realm is put back afterwards. */
  async function inRealm<T>(realm: string, call: () => Promise<T>): Promise<T> {
    const previous = state.getRealm();
    state.setRealm(realm);
    try {
      return await call();
    } finally {
      state.setRealm(previous);
    }
  }

  return {
    readFeature: () => getIdmFeature({ featureId: AI_AGENT_FEATURE_ID, state }),
    validateFeature: () =>
      validateIdmFeature({ featureId: AI_AGENT_FEATURE_ID, state }),
    readManagedConfig: async () =>
      (await getConfigEntity({
        entityId: 'managed',
        state,
      })) as ManagedConfigLike,
    readRepoDs: async () =>
      (await getConfigEntity({
        entityId: 'repo.ds',
        state,
      })) as RepoDsConfigLike,

    readProvider: (realm) =>
      inRealm(realm, async () => {
        try {
          return await getOAuth2Provider({ state });
        } catch (error) {
          if (isNotFoundError(error)) return undefined;
          throw error;
        }
      }),

    authServiceExists: (realm, name) =>
      inRealm(realm, async () => {
        try {
          await getTree({ id: name, state });
          return true;
        } catch (error) {
          if (isNotFoundError(error)) return false;
          throw error;
        }
      }),

    readGate: (realm) =>
      inRealm(realm, async () => {
        const types = await getAgentTypes({ state });
        const typeListed = (types?.result ?? []).some(
          (type) => type._id === 'AIAgent'
        );
        try {
          const agents = await getAgentsByType({ agentType: 'AIAgent', state });
          return {
            typeListed,
            listStatus: 200,
            agentCount:
              typeof agents?.resultCount === 'number'
                ? agents.resultCount
                : (agents?.result ?? []).length,
          };
        } catch (error) {
          const status = getFailedResponse(error)?.status;
          // a refused list (501 while the gate is closed) is an answer; anything without a status is not
          if (typeof status !== 'number') throw error;
          return { typeListed, listStatus: status, agentCount: null };
        }
      }),

    readEsvSecretIds: async () => {
      const secrets = await getSecrets({ state });
      return (secrets?.result ?? []).map((secret) => secret._id);
    },

    readSecretStoreMappings: (realm) =>
      inRealm(realm, async () => {
        const stores = await getSecretStores({ globalConfig: false, state });
        const found: AIAgentSecretStoreMappings[] = [];
        for (const store of stores?.result ?? []) {
          const storeTypeId = (store as { _type?: { _id?: string } })._type
            ?._id;
          if (storeTypeId !== ESV_SECRET_STORE_TYPE) continue;
          const mappings = await getSecretStoreMappings({
            secretStoreId: store._id,
            secretStoreTypeId: storeTypeId,
            globalConfig: false,
            state,
          });
          found.push({
            storeId: store._id,
            storeTypeId,
            mappings: (mappings?.result ?? []).map((mapping) => ({
              secretId: mapping.secretId,
              aliases: mapping.aliases ?? [],
            })),
          });
        }
        return found;
      }),

    countIdmAgents: async (realm) => {
      let count = 0;
      let cookie: string | undefined;
      do {
        const page = await queryManagedObjects({
          type: `${realm}_aiagent`,
          filter: 'true',
          fields: ['_id'],
          pageCookie: cookie,
          state,
        });
        count += (page?.result ?? []).length;
        cookie = page?.pagedResultsCookie || undefined;
      } while (cookie);
      return count;
    },
  };
}
