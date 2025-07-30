import { URL } from 'url';
import util from 'util';
import { v4 as uuidv4 } from 'uuid';

import { type Readable, Writable } from '../api/ApiTypes';
import { step } from '../api/AuthenticateApi';
import { putSecret } from '../api/cloud/SecretsApi';
import { getConfigEntity, putConfigEntity } from '../api/IdmConfigApi';
import { type OAuth2ClientSkeleton } from '../api/OAuth2ClientApi';
import {
  AccessTokenResponseType,
  clientCredentialsGrant,
} from '../api/OAuth2OIDCApi';
import { OAuth2TrustedJwtIssuerSkeleton } from '../api/OAuth2TrustedJwtIssuerApi';
import {
  readOAuth2Client,
  readOAuth2Clients,
  updateOAuth2Client,
} from '../ops/OAuth2ClientOps';
import { readOAuth2Provider } from '../ops/OAuth2ProviderOps';
import { State } from '../shared/State';
import { printMessage } from '../utils/Console';
import {
  getCurrentRealmManagedUser,
  getCurrentRealmPath,
} from '../utils/ForgeRockUtils';
import { cloneDeep, get, isEqualJson, stringify } from '../utils/JsonUtils';
import { FrodoError } from './FrodoError';
import {
  createJwkRsa,
  createJwks,
  createSignedJwtToken,
  getJwkRsaPublic,
  JwkRsa,
  JwksInterface,
} from './JoseOps';
import { accessTokenRfc7523AuthZGrant } from './OAuth2OidcOps';
import { updateOAuth2TrustedJwtIssuer } from './OAuth2TrustedJwtIssuerOps';
import { getRealmManagedOrganization } from './OrganizationOps';
import templateIpAddresses from './templates/autoaccess/IPAddresses.json';
import templateUserAgents from './templates/autoaccess/UserAgents.json';
import templateUsernames from './templates/autoaccess/Usernames.json';
import GENERIC_EXTENSION_ATTRIBUTES from './templates/cloud/GenericExtensionAttributesTemplate.json';
import OAUTH2_CLIENT from './templates/OAuth2ClientTemplate.json';
import OAUTH2_ISSUER from './templates/OAuth2TrustedJwtIssuerTemplate.json';

export type Admin = {
  generateRfc7523AuthZGrantArtefacts(
    clientId: string,
    iss: string,
    jwk?: JwkRsa,
    sub?: string,
    scope?: string[],
    options?: { save: boolean }
  ): Promise<{
    jwk: JwkRsa;
    jwks: JwksInterface;
    client: OAuth2ClientSkeleton;
    issuer: OAuth2TrustedJwtIssuerSkeleton;
  }>;
  executeRfc7523AuthZGrantFlow(
    clientId: string,
    iss: string,
    jwk: JwkRsa,
    sub: string,
    scope?: string[]
  ): Promise<AccessTokenResponseType>;
  generateRfc7523ClientAuthNArtefacts(
    clientId: string,
    aud?: string,
    jwk?: JwkRsa,
    options?: { save: boolean }
  ): Promise<{
    jwk: JwkRsa;
    jwks: JwksInterface;
    jwt: any;
    client: OAuth2ClientSkeleton;
  }>;
  trainAA(
    apiKey: string,
    apiSecret: string,
    customUsernames?: string[],
    customUserAgents?: string[],
    customIPs?: string[],
    loginsPerUser?: number,
    service?: string
  ): Promise<void>;

  // deprecated

  /**
   * @deprecated Deprecated since v2.0.0. This function may be removed in future versions. Similar functionality has been added to the frodo-cli code base.
   * @group Deprecated
   */
  listOAuth2CustomClients(): Promise<string[]>;
  /**
   * @deprecated Deprecated since v2.0.0. This function may be removed in future versions. Similar functionality has been added to the frodo-cli code base.
   * @group Deprecated
   */
  listOAuth2AdminClients(): Promise<string[]>;
  /**
   * @deprecated Deprecated since v2.0.0. This function may be removed in future versions. Similar functionality has been added to the frodo-cli code base.
   * @group Deprecated
   */
  listNonOAuth2AdminStaticUserMappings(
    showProtected: boolean
  ): Promise<string[]>;
  /**
   * @deprecated Deprecated since v2.0.0. This function may be removed in future versions. Similar functionality has been added to the frodo-cli code base.
   * @group Deprecated
   */
  addAutoIdStaticUserMapping(): Promise<void>;
  /**
   * @deprecated Deprecated since v2.0.0. This function may be removed in future versions. Similar functionality has been added to the frodo-cli code base.
   * @group Deprecated
   */
  grantOAuth2ClientAdminPrivileges(clientId: string): Promise<void>;
  /**
   * @deprecated Deprecated since v2.0.0. This function may be removed in future versions. Similar functionality has been added to the frodo-cli code base.
   * @group Deprecated
   */
  revokeOAuth2ClientAdminPrivileges(clientId: string): Promise<void>;
  /**
   * @deprecated Deprecated since v2.0.0. This function may be removed in future versions. Similar functionality has been added to the frodo-cli code base.
   * @group Deprecated
   */
  createOAuth2ClientWithAdminPrivileges(
    clientId: string,
    clientSecret: string
  ): Promise<void>;
  /**
   * @deprecated Deprecated since v2.0.0. This function may be removed in future versions. Similar functionality has been added to the frodo-cli code base.
   * @group Deprecated
   */
  createLongLivedToken(
    clientId: string,
    clientSecret: string,
    scope: string,
    secret: string | boolean,
    lifetime: number
  ): Promise<any>;
  /**
   * @deprecated Deprecated since v2.0.0. This function may be removed in future versions. Similar functionality has been added to the frodo-cli code base.
   * @group Deprecated
   */
  removeStaticUserMapping(subject: string): Promise<void>;
  /**
   * @deprecated Deprecated since v2.0.0. This function may be removed in future versions. Similar functionality has been added to the frodo-cli code base.
   * @group Deprecated
   */
  hideGenericExtensionAttributes(
    includeCustomized: boolean,
    dryRun: boolean
  ): Promise<void>;
  /**
   * @deprecated Deprecated since v2.0.0. This function may be removed in future versions. Similar functionality has been added to the frodo-cli code base.
   * @group Deprecated
   */
  showGenericExtensionAttributes(
    includeCustomized: boolean,
    dryRun: boolean
  ): Promise<void>;
  /**
   * @deprecated Deprecated since v2.0.0. This function may be removed in future versions. Similar functionality has been added to the frodo-cli code base.
   * @group Deprecated
   */
  repairOrgModel(
    excludeCustomized: boolean,
    extendPermissions: boolean,
    dryRun: boolean
  ): Promise<void>;
};

export default (state: State): Admin => {
  return {
    async generateRfc7523AuthZGrantArtefacts(
      clientId: string,
      iss: string,
      jwk: JwkRsa,
      sub: string,
      scope: string[] = ['fr:am:*', 'fr:idm:*', 'openid'],
      options = { save: false }
    ): Promise<{
      jwk: JwkRsa;
      jwks: JwksInterface;
      client: OAuth2ClientSkeleton;
      issuer: OAuth2TrustedJwtIssuerSkeleton;
    }> {
      return generateRfc7523AuthZGrantArtefacts({
        clientId,
        iss,
        jwk,
        sub,
        scope,
        options,
        state,
      });
    },
    executeRfc7523AuthZGrantFlow(
      clientId: string,
      iss: string,
      jwk: JwkRsa,
      sub: string,
      scope: string[] = ['fr:am:*', 'fr:idm:*', 'openid']
    ): Promise<AccessTokenResponseType> {
      return executeRfc7523AuthZGrantFlow({
        clientId,
        iss,
        jwk,
        sub,
        scope,
        state,
      });
    },
    async generateRfc7523ClientAuthNArtefacts(
      clientId: string,
      aud?: string,
      jwk?: JwkRsa,
      options?: { save: boolean }
    ): Promise<{
      jwk: JwkRsa;
      jwks: JwksInterface;
      jwt: any;
      client: OAuth2ClientSkeleton;
    }> {
      return generateRfc7523ClientAuthNArtefacts({
        clientId,
        aud,
        jwk,
        options,
        state,
      });
    },
    async trainAA(
      apiKey: string,
      apiSecret: string,
      customUsernames?: string[],
      customUserAgents?: string[],
      customIPs?: string[],
      loginsPerUser?: number,
      service?: string
    ): Promise<void> {
      return trainAA({
        apiKey,
        apiSecret,
        customUsernames,
        customUserAgents,
        customIPs,
        loginsPerUser,
        service,
        state,
      });
    },

    // deprecated

    async listOAuth2CustomClients(): Promise<string[]> {
      return listOAuth2CustomClients({ state });
    },
    async listOAuth2AdminClients(): Promise<string[]> {
      return listOAuth2AdminClients({ state });
    },
    async listNonOAuth2AdminStaticUserMappings(
      showProtected: boolean
    ): Promise<string[]> {
      return listNonOAuth2AdminStaticUserMappings({
        showProtected,
        state,
      });
    },
    async addAutoIdStaticUserMapping() {
      return addAutoIdStaticUserMapping({ state });
    },
    async grantOAuth2ClientAdminPrivileges(clientId: string) {
      return grantOAuth2ClientAdminPrivileges({ clientId, state });
    },
    async revokeOAuth2ClientAdminPrivileges(clientId: string) {
      return revokeOAuth2ClientAdminPrivileges({ clientId, state });
    },
    async createOAuth2ClientWithAdminPrivileges(
      clientId: string,
      clientSecret: string
    ) {
      return createOAuth2ClientWithAdminPrivileges({
        clientId,
        clientSecret,
        state,
      });
    },
    async createLongLivedToken(
      clientId: string,
      clientSecret: string,
      scope: string,
      secret: string | boolean,
      lifetime: number
    ) {
      return createLongLivedToken({
        clientId,
        clientSecret,
        scope,
        secret,
        lifetime,
        state,
      });
    },
    async removeStaticUserMapping(subject: string) {
      return removeStaticUserMapping({ subject, state });
    },
    async hideGenericExtensionAttributes(
      includeCustomized: boolean,
      dryRun: boolean
    ) {
      return hideGenericExtensionAttributes({
        includeCustomized,
        dryRun,
        state,
      });
    },
    async showGenericExtensionAttributes(
      includeCustomized: boolean,
      dryRun: boolean
    ) {
      return showGenericExtensionAttributes({
        includeCustomized,
        dryRun,
        state,
      });
    },
    async repairOrgModel(
      excludeCustomized: boolean,
      extendPermissions: boolean,
      dryRun: boolean
    ) {
      return repairOrgModel({
        excludeCustomized,
        extendPermissions,
        dryRun,
        state,
      });
    },
  };
};

const protectedClients = ['ui', 'idm-provisioning'];
const protectedSubjects = ['amadmin', 'autoid-resource-server'];

const privilegedScopes = [
  'am-introspect-all-tokens',
  'fr:idm:*',
  'fr:idc:esv:*',
];
// const privilegedUsers = ['openidm-admin'];
const privilegedRoles = [
  'internal/role/openidm-authorized',
  'internal/role/openidm-admin',
];

const adminScopes = ['fr:idm:*', 'fr:idc:esv:*'];
const adminDefaultScopes = ['fr:idm:*'];
const adminRoles = [
  'internal/role/openidm-authorized',
  'internal/role/openidm-admin',
];
const autoIdRoles = [
  'internal/role/platform-provisioning',
  'internal/role/openidm-authorized',
  'internal/role/openidm-admin',
];

/*
 * List all oauth2 clients, which have a corresponding staticUserMapping
 * in the IDM authentication.json:
  {
    "_id": "authentication",
    "rsFilter": {
      ...
      "staticUserMapping": [
        {
          "subject": "someOauth2ClientID",
          "localUser": "internal/user/openidm-admin",
          "userRoles": "authzRoles/*",
          "roles": [
            "internal/role/openidm-authorized",
            "internal/role/openidm-admin"
          ]
        },
        {
          "subject": "RCSClient",
          "localUser": "internal/user/idm-provisioning"
        }
      ]
    }
  }
 */
export async function listOAuth2CustomClients({
  state,
}: {
  state: State;
}): Promise<string[]> {
  try {
    const clients = await readOAuth2Clients({ state });
    const clientIds = clients
      .map((client) => client._id)
      .filter((client) => !protectedClients.includes(client));
    const authentication = await getConfigEntity({
      entityId: 'authentication',
      state,
    });
    const subjects = authentication.rsFilter.staticUserMapping
      .map((mapping) => mapping.subject)
      .filter((subject) => !protectedSubjects.includes(subject));
    const adminClients = subjects.filter((subject) =>
      clientIds.includes(subject)
    );
    return adminClients;
  } catch (error) {
    throw new FrodoError(`Error listing custom OAuth2 clients`, error);
  }
}

/*
 * List all oauth2 clients, which have the fr:idm:* scope and a 
 * corresponding staticUserMapping in the IDM authentication.json
 * and are assigned admin privileges:
  {
    "_id": "authentication",
    "rsFilter": {
      ...
      "staticUserMapping": [
        {
          "subject": "someOauth2ClientID",
          "localUser": "internal/user/openidm-admin",
          "userRoles": "authzRoles/*",
          "roles": [
            "internal/role/openidm-authorized",
            "internal/role/openidm-admin"
          ]
        }
      ]
    }
  }
 */
export async function listOAuth2AdminClients({
  state,
}: {
  state: State;
}): Promise<string[]> {
  try {
    const clients = await readOAuth2Clients({ state });
    const clientIds = clients
      .filter((client) => {
        // printMessage({ message: client, type: 'error', state });
        let isPrivileged = false;
        if (client.coreOAuth2ClientConfig.scopes) {
          (client.coreOAuth2ClientConfig.scopes as Readable<string[]>).forEach(
            (scope) => {
              if (privilegedScopes.includes(scope)) {
                isPrivileged = true;
              }
            }
          );
        }
        return isPrivileged;
      })
      .map((client) => client._id)
      .filter((clientId) => !protectedClients.includes(clientId));
    const authentication = await getConfigEntity({
      entityId: 'authentication',
      state,
    });
    const subjects = authentication.rsFilter.staticUserMapping
      .filter((mapping) => {
        let isPrivileged = false;
        if (mapping.roles) {
          mapping.roles.forEach((role) => {
            if (privilegedRoles.includes(role)) {
              isPrivileged = true;
            }
          });
        }
        return isPrivileged;
      })
      .map((mapping) => mapping.subject)
      .filter((subject) => !protectedSubjects.includes(subject));
    const adminClients = subjects.filter((subject) =>
      clientIds.includes(subject)
    );
    return adminClients;
  } catch (error) {
    throw new FrodoError(`Error listing admin OAuth2 clients`, error);
  }
}

/*
 * List all static user mappings that are not oauth2 clients in authentication.json
 * and are assigned admin privileges:
  {
    "_id": "authentication",
    "rsFilter": {
      ...
        "staticUserMapping": [
            {
                "subject": "amadmin",
                "localUser": "internal/user/openidm-admin",
                "userRoles": "authzRoles/*",
                "roles": [
                    "internal/role/openidm-authorized",
                    "internal/role/openidm-admin"
                ]
            },
            {
                "subject": "idm-provisioning",
                "localUser": "internal/user/idm-provisioning",
                "roles": [
                    "internal/role/platform-provisioning"
                ]
            },
            {
                "subject": "RCSClient",
                "localUser": "internal/user/idm-provisioning"
            },
            {
                "subject": "autoid-resource-server",
                "localUser": "internal/user/idm-provisioning",
                "roles": [
                    "internal/role/platform-provisioning",
                    "internal/role/openidm-authorized",
                    "internal/role/openidm-admin"
                ]
            }
        ]
    }
  }
 */
export async function listNonOAuth2AdminStaticUserMappings({
  showProtected,
  state,
}: {
  showProtected: boolean;
  state: State;
}): Promise<string[]> {
  try {
    const clients = await readOAuth2Clients({ state });
    const clientIds = clients
      .map((client) => client._id)
      .filter((client) => !protectedClients.includes(client));
    const authentication = await getConfigEntity({
      entityId: 'authentication',
      state,
    });
    let subjects = authentication.rsFilter.staticUserMapping
      .filter((mapping) => {
        let isPrivileged = false;
        if (mapping.roles) {
          mapping.roles.forEach((role) => {
            if (privilegedRoles.includes(role)) {
              isPrivileged = true;
            }
          });
        }
        return isPrivileged;
      })
      .map((mapping) => mapping.subject);
    if (!showProtected) {
      subjects = subjects.filter(
        (subject) => !protectedSubjects.includes(subject)
      );
    }
    const adminSubjects = subjects.filter(
      (subject) => !clientIds.includes(subject)
    );
    return adminSubjects;
  } catch (error) {
    throw new FrodoError(
      `Error listing non-oauth2 admin static user mappings`,
      error
    );
  }
}

async function getDynamicClientRegistrationScope({ state }: { state: State }) {
  try {
    const provider = await readOAuth2Provider({ state });
    return provider.clientDynamicRegistrationConfig
      .dynamicClientRegistrationScope;
  } catch (error) {
    throw new FrodoError(
      `Error getting dynamic client registration scope`,
      error
    );
  }
}

async function addAdminScopes({
  clientId,
  client,
  state,
}: {
  clientId: string;
  client: OAuth2ClientSkeleton;
  state: State;
}) {
  try {
    const modClient = client;
    const allAdminScopes = adminScopes.concat([
      await getDynamicClientRegistrationScope({ state }),
    ]);
    let addScopes = [];
    if (
      modClient.coreOAuth2ClientConfig.scopes &&
      (modClient.coreOAuth2ClientConfig.scopes as Writable<string[]>).value
    ) {
      addScopes = allAdminScopes.filter((scope) => {
        let add = false;
        if (
          !(
            modClient.coreOAuth2ClientConfig.scopes as Writable<string[]>
          ).value.includes(scope)
        ) {
          add = true;
        }
        return add;
      });
      (modClient.coreOAuth2ClientConfig.scopes as Writable<string[]>).value = (
        modClient.coreOAuth2ClientConfig.scopes as Writable<string[]>
      ).value.concat(addScopes);
    } else {
      (modClient.coreOAuth2ClientConfig.scopes as Writable<string[]>).value =
        allAdminScopes;
    }
    let addDefaultScope = false;
    if (
      modClient.coreOAuth2ClientConfig.defaultScopes &&
      modClient.coreOAuth2ClientConfig.defaultScopes.value
    ) {
      if (modClient.coreOAuth2ClientConfig.defaultScopes.value.length === 0) {
        addDefaultScope = true;
        modClient.coreOAuth2ClientConfig.defaultScopes.value =
          adminDefaultScopes;
      } else {
        printMessage({
          message: `Client "${clientId}" already has default scopes configured, not adding admin default scope.`,
          state,
        });
      }
    }
    if (addScopes.length > 0 || addDefaultScope) {
      printMessage({
        message: `Adding admin scopes to client "${clientId}"...`,
        state,
      });
    } else {
      printMessage({
        message: `Client "${clientId}" already has admin scopes.`,
        state,
      });
    }
    return modClient;
  } catch (error) {
    throw new FrodoError(
      `Error adding admin scopes to oauth2 client ${clientId}`,
      error
    );
  }
}

function addClientCredentialsGrantType({
  clientId,
  client,
  state,
}: {
  clientId: string;
  client: OAuth2ClientSkeleton;
  state: State;
}) {
  try {
    const modClient = client;
    let modified = false;
    if (
      modClient.advancedOAuth2ClientConfig.grantTypes &&
      (modClient.advancedOAuth2ClientConfig.grantTypes as Writable<string[]>)
        .value
    ) {
      if (
        !(
          modClient.advancedOAuth2ClientConfig.grantTypes as Writable<string[]>
        ).value.includes('client_credentials')
      ) {
        modified = true;
        (
          modClient.advancedOAuth2ClientConfig.grantTypes as Writable<string[]>
        ).value.push('client_credentials');
      }
    } else {
      (
        modClient.advancedOAuth2ClientConfig.grantTypes as Writable<string[]>
      ).value = ['client_credentials'];
    }
    (
      modClient.advancedOAuth2ClientConfig.grantTypes as Writable<string[]>
    ).inherited = false;
    if (modified) {
      printMessage({
        message: `Adding client credentials grant type to client "${clientId}"...`,
        state,
      });
    } else {
      printMessage({
        message: `Client "${clientId}" already has client credentials grant type.`,
        state,
      });
    }
    return modClient;
  } catch (error) {
    throw new FrodoError(
      `Error client credentials grant type to oauth2 client ${clientId}`,
      error
    );
  }
}

async function addAdminStaticUserMapping({
  name,
  state,
}: {
  name: string;
  state: State;
}) {
  try {
    const authentication = await getConfigEntity({
      entityId: 'authentication',
      state,
    });
    let needsAdminMapping = true;
    let addRoles = [];
    const mappings = authentication['rsFilter']['staticUserMapping'].map(
      (mapping) => {
        // ignore mappings for other subjects
        if (mapping.subject !== name) {
          return mapping;
        }
        needsAdminMapping = false;
        addRoles = adminRoles.filter((role) => {
          let add = false;
          if (!mapping.roles || !mapping.roles.includes(role)) {
            add = true;
          }
          return add;
        });
        const newMapping = mapping;
        newMapping.roles = newMapping.roles.concat(addRoles);
        return newMapping;
      }
    );
    if (needsAdminMapping) {
      printMessage({
        message: `Creating static user mapping for client "${name}"...`,
        state,
      });
      mappings.push({
        subject: name,
        localUser: 'internal/user/openidm-admin',
        userRoles: 'authzRoles/*',
        roles: adminRoles,
      });
    }
    authentication['rsFilter']['staticUserMapping'] = mappings;
    if (addRoles.length > 0 || needsAdminMapping) {
      printMessage({
        message: `Adding admin roles to static user mapping for client "${name}"...`,
        state,
      });
      await putConfigEntity({
        entityId: 'authentication',
        entityData: authentication,
        state,
      });
    } else {
      printMessage({
        message: `Static user mapping for client "${name}" already has admin roles.`,
        state,
      });
    }
  } catch (error) {
    throw new FrodoError(
      `Error adding admin static user mapping to ${name} - ${error.stack}`,
      error
    );
  }
}

/*
 * Add AutoId static user mapping to authentication.json to enable dashboards and other AutoId-based functionality.
  {
    "_id": "authentication",
    "rsFilter": {
      ...
        "staticUserMapping": [
            ...
            {
                "subject": "autoid-resource-server",
                "localUser": "internal/user/idm-provisioning",
                "roles": [
                    "internal/role/platform-provisioning",
                    "internal/role/openidm-authorized",
                    "internal/role/openidm-admin"
                ]
            }
        ]
    }
  }
 */
export async function addAutoIdStaticUserMapping({ state }: { state: State }) {
  const name = 'autoid-resource-server';
  try {
    const authentication = await getConfigEntity({
      entityId: 'authentication',
      state,
    });
    let needsAdminMapping = true;
    let addRoles = [];
    const mappings = authentication.rsFilter.staticUserMapping.map(
      (mapping) => {
        // ignore mappings for other subjects
        if (mapping.subject !== name) {
          return mapping;
        }
        needsAdminMapping = false;
        addRoles = autoIdRoles.filter((role) => {
          let add = false;
          if (!mapping.roles.includes(role)) {
            add = true;
          }
          return add;
        });
        const newMapping = mapping;
        newMapping.roles = newMapping.roles.concat(addRoles);
        return newMapping;
      }
    );
    if (needsAdminMapping) {
      printMessage({
        message: `Creating static user mapping for AutoId client "${name}"...`,
        state,
      });
      mappings.push({
        subject: name,
        localUser: 'internal/user/idm-provisioning',
        userRoles: 'authzRoles/*',
        roles: autoIdRoles,
      });
    }
    authentication.rsFilter.staticUserMapping = mappings;
    if (addRoles.length > 0 || needsAdminMapping) {
      printMessage({
        message: `Adding required roles to static user mapping for AutoId client "${name}"...`,
        state,
      });
      try {
        await putConfigEntity({
          entityId: 'authentication',
          entityData: authentication,
          state,
        });
      } catch (putConfigEntityError) {
        printMessage({ message: putConfigEntityError, type: 'error', state });
        printMessage({
          message: `Error: ${putConfigEntityError}`,
          type: 'error',
          state,
        });
      }
    } else {
      printMessage({
        message: `Static user mapping for AutoId client "${name}" already has all required roles.`,
        state,
      });
    }
  } catch (error) {
    throw new FrodoError(
      `Error adding static user mapping for AutoId oauth2 client ${name}`,
      error
    );
  }
}

export async function grantOAuth2ClientAdminPrivileges({
  clientId,
  state,
}: {
  clientId: string;
  state: State;
}) {
  let client = await readOAuth2Client({ clientId, state });
  if (
    (client.coreOAuth2ClientConfig.clientName as Readable<string[]>).length ===
    0
  ) {
    client.coreOAuth2ClientConfig.clientName = {
      inherited: false,
      value: [clientId],
    };
  }
  if (
    client.advancedOAuth2ClientConfig.descriptions.value.length === 0 ||
    client.advancedOAuth2ClientConfig.descriptions.value[0].startsWith(
      'Modified by Frodo'
    ) ||
    client.advancedOAuth2ClientConfig.descriptions.value[0].startsWith(
      'Created by Frodo'
    )
  ) {
    client.advancedOAuth2ClientConfig.descriptions.value = [
      `Modified by Frodo on ${new Date().toLocaleString()}`,
    ];
  }
  client = await addAdminScopes({ clientId, client, state });
  client = addClientCredentialsGrantType({ clientId, client, state });
  await updateOAuth2Client({ clientId, clientData: client, state });
  await addAdminStaticUserMapping({ name: clientId, state });
}

async function removeAdminScopes({
  name,
  client,
  state,
}: {
  name: string;
  client: OAuth2ClientSkeleton;
  state: State;
}) {
  const modClient = client;
  const allAdminScopes = adminScopes.concat([
    await getDynamicClientRegistrationScope({ state }),
  ]);
  let finalScopes = [];
  if (
    modClient.coreOAuth2ClientConfig.scopes &&
    (modClient.coreOAuth2ClientConfig.scopes as Writable<string[]>).value
  ) {
    finalScopes = (
      modClient.coreOAuth2ClientConfig.scopes as Writable<string[]>
    ).value.filter((scope) => !allAdminScopes.includes(scope));
  }
  if (
    (modClient.coreOAuth2ClientConfig.scopes as Writable<string[]>).value
      .length > finalScopes.length
  ) {
    printMessage({
      message: `Removing admin scopes from client "${name}"...`,
      state,
    });
    (modClient.coreOAuth2ClientConfig.scopes as Writable<string[]>).value =
      finalScopes;
  } else {
    printMessage({ message: `Client "${name}" has no admin scopes.`, state });
  }
  let finalDefaultScopes = [];
  if (
    modClient.coreOAuth2ClientConfig.defaultScopes &&
    modClient.coreOAuth2ClientConfig.defaultScopes.value
  ) {
    finalDefaultScopes =
      modClient.coreOAuth2ClientConfig.defaultScopes.value.filter(
        (scope) => !adminDefaultScopes.includes(scope)
      );
  }
  if (
    modClient.coreOAuth2ClientConfig.defaultScopes.value.length >
    finalDefaultScopes.length
  ) {
    printMessage({
      message: `Removing admin default scopes from client "${name}"...`,
      state,
    });
    modClient.coreOAuth2ClientConfig.defaultScopes.value = finalDefaultScopes;
  } else {
    printMessage({
      message: `Client "${name}" has no admin default scopes.`,
      state,
    });
  }
  return modClient;
}

function removeClientCredentialsGrantType({
  clientId,
  client,
  state,
}: {
  clientId: string;
  client: OAuth2ClientSkeleton;
  state: State;
}) {
  const modClient = client;
  let modified = false;
  let finalGrantTypes = [];
  if (
    modClient.advancedOAuth2ClientConfig.grantTypes &&
    (modClient.advancedOAuth2ClientConfig.grantTypes as Writable<string[]>)
      .value
  ) {
    finalGrantTypes = (
      modClient.advancedOAuth2ClientConfig.grantTypes as Writable<string[]>
    ).value.filter((grantType) => grantType !== 'client_credentials');
    modified =
      (modClient.advancedOAuth2ClientConfig.grantTypes as Writable<string[]>)
        .value.length > finalGrantTypes.length;
  }
  if (modified) {
    printMessage({
      message: `Removing client credentials grant type from client "${clientId}"...`,
      state,
    });
    (
      modClient.advancedOAuth2ClientConfig.grantTypes as Writable<string[]>
    ).value = finalGrantTypes;
  } else {
    printMessage({
      message: `Client "${clientId}" does not allow client credentials grant type.`,
      state,
    });
  }
  return modClient;
}

async function removeAdminStaticUserMapping({
  name,
  state,
}: {
  name: string;
  state: State;
}) {
  const authentication = await getConfigEntity({
    entityId: 'authentication',
    state,
  });
  let finalRoles = [];
  let removeMapping = false;
  let modified = false;
  const mappings = authentication.rsFilter.staticUserMapping
    .map((mapping) => {
      // ignore mappings for other subjects
      if (mapping.subject !== name) {
        return mapping;
      }
      finalRoles = mapping.roles.filter((role) => !adminRoles.includes(role));
      const newMapping = mapping;
      removeMapping = finalRoles.length === 0; // if there are no more roles left on this mapping, flag it for removal
      modified = mapping.roles.length > finalRoles.length; // if there were roles removed, set modified flag
      newMapping.roles = finalRoles;
      return newMapping;
    })
    .filter((mapping) => mapping.subject !== name || !removeMapping);
  authentication.rsFilter.staticUserMapping = mappings;
  if (modified || removeMapping) {
    if (removeMapping) {
      printMessage({
        message: `Removing static user mapping for client "${name}"...`,
        state,
      });
    } else {
      printMessage({
        message: `Removing admin roles from static user mapping for client "${name}"...`,
        state,
      });
    }
    try {
      await putConfigEntity({
        entityId: 'authentication',
        entityData: authentication,
        state,
      });
    } catch (putConfigEntityError) {
      printMessage({ message: putConfigEntityError, type: 'error', state });
      printMessage({
        message: `Error: ${putConfigEntityError}`,
        type: 'error',
        state,
      });
    }
  } else {
    printMessage({
      message: `Static user mapping for client "${name}" has no admin roles.`,
      state,
    });
  }
}

export async function revokeOAuth2ClientAdminPrivileges({
  clientId,
  state,
}: {
  clientId: string;
  state: State;
}) {
  let client = await readOAuth2Client({ clientId, state });
  if (
    (client.coreOAuth2ClientConfig.clientName as Readable<string[]>).length ===
    0
  ) {
    client.coreOAuth2ClientConfig.clientName = {
      inherited: false,
      value: [clientId],
    };
  }
  if (
    client.advancedOAuth2ClientConfig.descriptions.value.length === 0 ||
    client.advancedOAuth2ClientConfig.descriptions.value[0].startsWith(
      'Modified by Frodo'
    ) ||
    client.advancedOAuth2ClientConfig.descriptions.value[0].startsWith(
      'Created by Frodo'
    )
  ) {
    client.advancedOAuth2ClientConfig.descriptions.value = [
      `Modified by Frodo on ${new Date().toLocaleString()}`,
    ];
  }
  client = await removeAdminScopes({ name: clientId, client, state });
  client = removeClientCredentialsGrantType({ clientId, client, state });
  await updateOAuth2Client({ clientId, clientData: client, state });
  await removeAdminStaticUserMapping({ name: clientId, state });
}

export async function createOAuth2ClientWithAdminPrivileges({
  clientId,
  clientSecret,
  state,
}: {
  clientId: string;
  clientSecret: string;
  state: State;
}) {
  let client = cloneDeep(OAUTH2_CLIENT);
  client.coreOAuth2ClientConfig.userpassword = clientSecret;
  client.coreOAuth2ClientConfig.clientName.value = [clientId];
  client.advancedOAuth2ClientConfig.descriptions.value = [
    `Created by Frodo on ${new Date().toLocaleString()}`,
  ];
  try {
    client = await addAdminScopes({ clientId, client, state });
    await updateOAuth2Client({ clientId, clientData: client, state });
    await addAdminStaticUserMapping({ name: clientId, state });
  } catch (error) {
    printMessage({
      message: `Error creating oauth2 client: ${error.message}`,
      state,
      type: 'error',
    });
  }
}

export async function createLongLivedToken({
  clientId,
  clientSecret,
  scope,
  secret,
  lifetime,
  state,
}: {
  clientId: string;
  clientSecret: string;
  scope: string;
  secret: string | boolean;
  lifetime: number;
  state: State;
}) {
  // get oauth2 client
  const client = await readOAuth2Client({ clientId, state });
  client.userpassword = clientSecret;
  // remember current lifetime
  const rememberedLifetime =
    (client.coreOAuth2ClientConfig.accessTokenLifetime as Readable<number>) ||
    3600;
  // set long token lifetime
  client.coreOAuth2ClientConfig.accessTokenLifetime = {
    inherited: false,
    value: lifetime,
  };
  await updateOAuth2Client({ clientId, clientData: client, state });
  const response = await clientCredentialsGrant({
    amBaseUrl: state.getHost(),
    clientId,
    clientSecret,
    scope,
    state,
  });
  const expires = new Date().getTime() + 1000 * response.expires_in;
  response['expires_on'] = new Date(expires).toLocaleString();
  // reset token lifetime
  client.coreOAuth2ClientConfig.accessTokenLifetime = {
    inherited: false,
    value: rememberedLifetime,
  };
  await updateOAuth2Client({ clientId, clientData: client, state });
  // create secret with token as value
  if (secret) {
    const description = 'Long-lived admin token';
    try {
      await putSecret({
        secretId: secret as string,
        value: response.access_token,
        description,
        state,
      });
      response['secret'] = secret;
    } catch (error) {
      if (
        get(error, ['response', 'data', 'code']) === 400 &&
        get(error, ['response', 'data', 'message']) ===
          'Failed to create secret, the secret already exists'
      ) {
        const newSecret = `${secret}-${expires}`;
        printMessage({
          message: `esv '${secret}' already exists, using ${newSecret}`,
          type: 'warn',
          state,
        });
        await putSecret({
          secretId: newSecret,
          value: response.access_token,
          description,
          state,
        });
        response['secret'] = newSecret;
      }
    }
    delete response.access_token;
  }
  return response;
}

export async function removeStaticUserMapping({
  subject,
  state,
}: {
  subject: string;
  state: State;
}) {
  const authentication = await getConfigEntity({
    entityId: 'authentication',
    state,
  });
  let removeMapping = false;
  const mappings = authentication.rsFilter.staticUserMapping.filter(
    (mapping) => {
      // find the subject and flag it
      if (mapping.subject === subject) {
        removeMapping = true;
      }
      // ignore mappings for other subjects
      return mapping.subject !== subject;
    }
  );
  authentication.rsFilter.staticUserMapping = mappings;
  if (removeMapping) {
    printMessage({
      message: `Removing static user mapping for subject "${subject}"...`,
      state,
    });
    try {
      await putConfigEntity({
        entityId: 'authentication',
        entityData: authentication,
        state,
      });
    } catch (putConfigEntityError) {
      printMessage({ message: putConfigEntityError, type: 'error', state });
      printMessage({
        message: `Error: ${putConfigEntityError}`,
        type: 'error',
        state,
      });
    }
  } else {
    printMessage({
      message: `No static user mapping for subject "${subject}" found.`,
      state,
    });
  }
}

export async function hideGenericExtensionAttributes({
  includeCustomized,
  dryRun,
  state,
}: {
  includeCustomized: boolean;
  dryRun: boolean;
  state: State;
}) {
  const managed = await getConfigEntity({ entityId: 'managed', state });
  const propertyNames = Object.keys(GENERIC_EXTENSION_ATTRIBUTES);
  const updatedObjects = managed.objects.map((object) => {
    // ignore all other objects
    if (object.name !== getCurrentRealmManagedUser({ state })) {
      return object;
    }
    propertyNames.forEach((name) => {
      if (
        isEqualJson(
          GENERIC_EXTENSION_ATTRIBUTES[name],
          object.schema.properties[name],
          ['viewable', 'usageDescription']
        ) ||
        includeCustomized
      ) {
        if (object.schema.properties[name].viewable) {
          printMessage({ message: `${name}: hide`, state });
          // eslint-disable-next-line no-param-reassign
          object.schema.properties[name].viewable = false;
        } else {
          printMessage({ message: `${name}: ignore (already hidden)`, state });
        }
      } else {
        printMessage({ message: `${name}: skip (customized)`, state });
      }
    });
    return object;
  });
  managed.objects = updatedObjects;
  if (dryRun) {
    printMessage({ message: 'Dry-run only. Changes are not saved.', state });
  } else {
    try {
      await putConfigEntity({
        entityId: 'managed',
        entityData: managed,
        state,
      });
    } catch (putConfigEntityError) {
      printMessage({ message: putConfigEntityError, type: 'error', state });
      printMessage({
        message: `Error: ${putConfigEntityError}`,
        type: 'error',
        state,
      });
    }
  }
}

export async function showGenericExtensionAttributes({
  includeCustomized,
  dryRun,
  state,
}: {
  includeCustomized: boolean;
  dryRun: boolean;
  state: State;
}) {
  const managed = await getConfigEntity({ entityId: 'managed', state });
  const propertyNames = Object.keys(GENERIC_EXTENSION_ATTRIBUTES);
  const updatedObjects = managed.objects.map((object) => {
    // ignore all other objects
    if (object.name !== getCurrentRealmManagedUser({ state })) {
      return object;
    }
    propertyNames.forEach((name) => {
      if (
        isEqualJson(
          GENERIC_EXTENSION_ATTRIBUTES[name],
          object.schema.properties[name],
          ['viewable', 'usageDescription']
        ) ||
        includeCustomized
      ) {
        if (!object.schema.properties[name].viewable) {
          printMessage({ message: `${name}: show`, state });
          // eslint-disable-next-line no-param-reassign
          object.schema.properties[name].viewable = true;
        } else {
          printMessage({ message: `${name}: ignore (already showing)`, state });
        }
      } else {
        printMessage({ message: `${name}: skip (customized)`, state });
      }
    });
    return object;
  });
  managed.objects = updatedObjects;
  if (dryRun) {
    printMessage({ message: 'Dry-run only. Changes are not saved.', state });
  } else {
    try {
      await putConfigEntity({
        entityId: 'managed',
        entityData: managed,
        state,
      });
    } catch (putConfigEntityError) {
      printMessage({ message: putConfigEntityError, type: 'error', state });
      printMessage({
        message: `Error: ${putConfigEntityError}`,
        type: 'error',
        state,
      });
    }
  }
}

async function repairOrgModelUser({
  dryRun,
  state,
}: {
  dryRun: boolean;
  state: State;
}) {
  const managed = await getConfigEntity({ entityId: 'managed', state });
  const RDVPs = ['memberOfOrgIDs'];
  let repairData = false;
  const updatedObjects = managed.objects.map((object) => {
    // ignore all other objects
    if (object.name !== getCurrentRealmManagedUser({ state })) {
      return object;
    }
    printMessage({ message: `${object.name}: checking...`, state });
    RDVPs.forEach((name) => {
      if (!object.schema.properties[name].queryConfig.flattenProperties) {
        printMessage({
          message: `- ${name}: repairing - needs flattening`,
          type: 'warn',
          state,
        });
        // eslint-disable-next-line no-param-reassign
        object.schema.properties[name].queryConfig.flattenProperties = true;
        repairData = true;
      } else {
        printMessage({ message: `- ${name}: OK`, state });
      }
    });
    return object;
  });
  managed.objects = updatedObjects;
  if (!dryRun) {
    try {
      await putConfigEntity({
        entityId: 'managed',
        entityData: managed,
        state,
      });
    } catch (putConfigEntityError) {
      printMessage({ message: putConfigEntityError, type: 'error', state });
      printMessage({
        message: `Error: ${putConfigEntityError}`,
        type: 'error',
        state,
      });
    }
  }
  return repairData;
}

async function repairOrgModelOrg({
  dryRun,
  state,
}: {
  dryRun: boolean;
  state: State;
}) {
  const managed = await getConfigEntity({ entityId: 'managed', state });
  const RDVPs = [
    'adminIDs',
    'ownerIDs',
    'parentAdminIDs',
    'parentOwnerIDs',
    'parentIDs',
  ];
  let repairData = false;
  const updatedObjects = managed.objects.map((object) => {
    // ignore all other objects
    if (object.name !== getRealmManagedOrganization({ state })) {
      return object;
    }
    printMessage({ message: `${object.name}: checking...`, state });
    RDVPs.forEach((name) => {
      if (!object.schema.properties[name].queryConfig.flattenProperties) {
        printMessage({
          message: `- ${name}: repairing - needs flattening`,
          type: 'warn',
          state,
        });
        // eslint-disable-next-line no-param-reassign
        object.schema.properties[name].queryConfig.flattenProperties = true;
        repairData = true;
      } else {
        printMessage({ message: `- ${name}: OK`, state });
      }
    });
    return object;
  });
  managed.objects = updatedObjects;
  if (!dryRun) {
    try {
      await putConfigEntity({
        entityId: 'managed',
        entityData: managed,
        state,
      });
    } catch (putConfigEntityError) {
      printMessage({ message: putConfigEntityError, type: 'error', state });
      printMessage({
        message: `Error: ${putConfigEntityError}`,
        type: 'error',
        state,
      });
    }
  }
  return repairData;
}

async function repairOrgModelData(dryRun = false) {
  if (!dryRun) {
    // const rootOrgs = await findRootOrganizations();
  }
}

async function extendOrgModelPermissins(dryRun = false) {
  if (!dryRun) {
    // const rootOrgs = await findRootOrganizations();
  }
}

export async function repairOrgModel({
  excludeCustomized,
  extendPermissions,
  dryRun,
  state,
}: {
  excludeCustomized: boolean;
  extendPermissions: boolean;
  dryRun: boolean;
  state: State;
}) {
  let repairData = false;
  repairData = repairData || (await repairOrgModelUser({ dryRun, state }));
  repairData = repairData || (await repairOrgModelOrg({ dryRun, state }));
  if (excludeCustomized) {
    //
  }
  if (repairData) {
    await repairOrgModelData(dryRun);
  }
  if (extendPermissions) {
    await extendOrgModelPermissins(dryRun);
  }
  if (dryRun) {
    printMessage({
      message: 'Dry-run only. Changes are not saved.',
      type: 'warn',
      state,
    });
  }
}

export function getUniqueValues(values: string[]): string[] {
  return [...new Set(values)].filter((it) => it);
}

export function pickRandomValue(values: string[]): string {
  const finalValues = values.filter((it) => it);
  return finalValues[Math.floor(Math.random() * finalValues.length)];
}

export function pickRandomNumber(max: number): number {
  return Math.ceil(Math.random() * max);
}

export function pickRandomValues(values: string[], picks: number): string[] {
  const finalValues = values.filter((it) => it);
  const result: string[] = [];
  for (let i = 0; i < picks; i++) {
    result.push(finalValues[Math.floor(Math.random() * finalValues.length)]);
  }
  return result;
}

export function pickRandomUsername(customUsernames: string[] = []): string {
  const finalUsernames = getUniqueValues(
    customUsernames.concat(templateUsernames)
  );
  return pickRandomValue(finalUsernames);
}

export function pickRandomUserAgent(customUserAgents: string[] = []): string {
  const finalUserAgents = getUniqueValues(
    customUserAgents.concat(templateUserAgents)
  );
  return pickRandomValue(finalUserAgents);
}

export function pickRandomIPAddress(customIPs: string[] = []): string {
  const finalIPs = getUniqueValues(customIPs.concat(templateIpAddresses));
  return pickRandomValue(finalIPs);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// generate auto access sample data
export async function trainAA({
  apiKey,
  apiSecret,
  customUsernames = [],
  customUserAgents = [],
  customIPs = [],
  loginsPerUser = 100,
  service = 'Frodo-Train-AA',
  state,
}: {
  apiKey: string;
  apiSecret: string;
  customUsernames?: string[];
  customUserAgents?: string[];
  customIPs?: string[];
  loginsPerUser?: number;
  service?: string;
  state: State;
}): Promise<void> {
  printMessage({
    message: `loginsPerUser: ${loginsPerUser}`,
    state,
  });
  const usernames = getUniqueValues(customUsernames.concat(templateUsernames));
  for (let i = 0; i < 200; i++) {
    const username = usernames[i];
    const numDevices = pickRandomNumber(5);
    const ipAddresses = pickRandomValues(
      customIPs.concat(templateIpAddresses),
      numDevices
    );
    const ipAgentMap = {};
    for (let j = 0; j < numDevices; j++) {
      ipAgentMap[ipAddresses[j]] = pickRandomValue(
        customUserAgents.concat(templateUserAgents)
      );
    }
    const requests = [];
    for (let j = 0; j < loginsPerUser; j++) {
      const ipAddress = pickRandomValue(ipAddresses);
      const userAgent = ipAgentMap[ipAddress];
      const config = {
        headers: {
          'User-Agent': userAgent,
          'X-Forwarded-For': ipAddress,
          'X-OpenAM-Username': username,
          'X-API-KEY': apiKey,
          'X-API-SECRET': apiSecret,
        },
      };
      requests.push(
        step({
          body: {},
          config,
          realm: state.getRealm(),
          service,
          state,
        })
          .then((response) => {
            printMessage({
              message: `${username},${ipAddress},${userAgent},${
                'tokenId' in response ? 'OK' : 'NOK'
              }`,
              state,
            });
          })
          .catch((error) => {
            printMessage({
              message: `${username},${ipAddress},${userAgent},${error.message}`,
              state,
            });
          })
      );
      await Promise.allSettled(requests);
      // try {
      //   const response = await step({
      //     body: {},
      //     config,
      //     realm: state.getRealm(),
      //     service,
      //     state,
      //   });
      //   printMessage({
      //     message: `${username},${ipAddress},${userAgent},${
      //       response.tokenId ? 'OK' : 'NOK'
      //     }`,
      //     state,
      //   });
      // } catch (error) {
      //   printMessage({
      //     message: `${username},${ipAddress},${userAgent},${error.message}`,
      //     state,
      //   });
      // }
    }
  }
}

function getAccessTokenUrl(state: State) {
  const accessTokenUrlTemplate = '%s/oauth2%s/access_token';
  const accessTokenURL = util.format(
    accessTokenUrlTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const url = new URL(accessTokenURL);
  const urlWithPort = `${url.protocol}//${url.host}:${
    url.port ? url.port : url.protocol === 'https:' ? '443' : '80'
  }${url.pathname}`;
  return urlWithPort;
}

export async function generateRfc7523AuthZGrantArtefacts({
  clientId,
  iss,
  jwk = null,
  sub = null,
  scope = ['fr:am:*', 'fr:idm:*', 'openid'],
  options = { save: false },
  state,
}: {
  clientId: string;
  iss: string;
  jwk?: JwkRsa;
  sub?: string;
  scope?: string[];
  options?: { save: boolean };
  state: State;
}): Promise<{
  jwk: JwkRsa;
  jwks: JwksInterface;
  client: OAuth2ClientSkeleton;
  issuer: OAuth2TrustedJwtIssuerSkeleton;
}> {
  if (!jwk) {
    jwk = await createJwkRsa();
  }

  // create header and payload
  const jwks = createJwks(await getJwkRsaPublic(jwk));

  // create oauth2 client
  const clientData: OAuth2ClientSkeleton = cloneDeep(OAUTH2_CLIENT);
  clientData.coreOAuth2ClientConfig.clientName = {
    inherited: false,
    value: [clientId],
  };
  clientData.coreOAuth2ClientConfig.scopes = {
    inherited: false,
    value: scope,
  };
  clientData.coreOAuth2ClientConfig.clientType = {
    inherited: false,
    value: 'Public',
  };
  clientData.advancedOAuth2ClientConfig.grantTypes = {
    inherited: false,
    value: ['urn:ietf:params:oauth:grant-type:jwt-bearer'],
  };
  clientData.advancedOAuth2ClientConfig.isConsentImplied = {
    inherited: false,
    value: true,
  };
  clientData.advancedOAuth2ClientConfig.tokenEndpointAuthMethod = {
    inherited: false,
    value: 'none',
  };
  clientData.signEncOAuth2ClientConfig.publicKeyLocation = {
    inherited: false,
    value: 'jwks',
  };
  clientData.signEncOAuth2ClientConfig.jwkSet = {
    inherited: false,
    value: JSON.stringify(jwks),
  };
  if (options.save) {
    await updateOAuth2Client({ clientId, clientData, state });
  }

  // create trusted issuer
  const issuerData: OAuth2TrustedJwtIssuerSkeleton = cloneDeep(OAUTH2_ISSUER);
  issuerData._id = clientId + '-issuer';
  issuerData.issuer = {
    inherited: false,
    value: iss,
  };
  issuerData.allowedSubjects = {
    inherited: false,
    value: sub ? [sub] : [],
  };
  issuerData.jwkSet = {
    inherited: false,
    value: stringify(jwks),
  };
  if (options.save) {
    await updateOAuth2TrustedJwtIssuer({
      issuerId: issuerData._id,
      issuerData,
      state,
    });
  }

  return {
    jwk,
    jwks,
    client: clientData,
    issuer: issuerData,
  };
}

export async function executeRfc7523AuthZGrantFlow({
  clientId,
  iss,
  jwk,
  sub,
  scope = ['fr:am:*', 'fr:idm:*', 'openid'],
  state,
}: {
  clientId: string;
  iss: string;
  jwk: JwkRsa;
  sub: string;
  scope?: string[];
  state: State;
}): Promise<AccessTokenResponseType> {
  // create header and payload
  const payload = {
    iss,
    sub,
    aud: getAccessTokenUrl(state),

    // Cross platform way of setting JWT expiry time 3 minutes in the future, expressed as number of seconds since EPOCH
    exp: Math.floor(new Date().getTime() / 1000 + 180),

    // A unique ID for the JWT which is required when requesting the openid scope
    jti: uuidv4(),
  };

  // create and sign JWT
  const jwt = await createSignedJwtToken(payload, jwk);

  // get access token
  return accessTokenRfc7523AuthZGrant({ clientId, jwt, scope, state });
}

export async function generateRfc7523ClientAuthNArtefacts({
  clientId,
  aud = null,
  jwk = null,
  options = {
    save: false,
  },
  state,
}: {
  clientId: string;
  aud?: string;
  jwk?: JwkRsa;
  options?: { save: boolean };
  state: State;
}): Promise<{
  jwk: JwkRsa;
  jwks: JwksInterface;
  jwt: any;
  client: OAuth2ClientSkeleton;
}> {
  if (!jwk) {
    jwk = await createJwkRsa();
  }

  // create header and payload
  const jwks = createJwks(await getJwkRsaPublic(jwk));
  const sub = clientId;
  const iss = clientId;
  if (!aud) {
    aud = getAccessTokenUrl(state);
  }

  const payload = {
    iss,
    sub,
    aud,
    exp: 60 * 5,
  };

  // create and sign JWT
  const jwt = createSignedJwtToken(payload, jwk);

  // create oauth2 client
  const clientData: OAuth2ClientSkeleton = cloneDeep(OAUTH2_CLIENT);
  clientData.coreOAuth2ClientConfig.clientType = {
    inherited: false,
    value: 'Confidential',
  };
  clientData.advancedOAuth2ClientConfig.grantTypes = {
    inherited: false,
    value: ['client_credentials'],
  };
  clientData.advancedOAuth2ClientConfig.isConsentImplied = {
    inherited: false,
    value: false,
  };
  clientData.advancedOAuth2ClientConfig.tokenEndpointAuthMethod = {
    inherited: false,
    value: 'private_key_jwt',
  };
  clientData.signEncOAuth2ClientConfig.publicKeyLocation = {
    inherited: false,
    value: 'jwks',
  };
  clientData.signEncOAuth2ClientConfig.jwkSet = {
    inherited: false,
    value: JSON.stringify(jwks),
  };
  if (options.save) {
    await updateOAuth2Client({ clientId, clientData, state });
  }

  return {
    jwk,
    jwks,
    jwt,
    client: clientData,
  };
}

// suggested by John K.
// export async function removeRealmNameFromManagedObjectLabels() {}
// export async function addRealmNameToManagedObjectLabels() {}
// export async function cleanUpPostmanArtifacts() {}
// export async function createSampleThemes() {}
