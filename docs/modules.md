[Frodo Library - v2.0.0-13](README.md) / Exports

# Frodo Library - v2.0.0-13

## Table of contents

### Modules

- [Reference](modules/Reference.md)

### Type Aliases

- [Admin](modules.md#admin)
- [AdminFederation](modules.md#adminfederation)
- [Agent](modules.md#agent)
- [Authenticate](modules.md#authenticate)
- [CirclesOfTrust](modules.md#circlesoftrust)
- [ConnectionProfile](modules.md#connectionprofile)
- [Constants](modules.md#constants)
- [EmailTemplate](modules.md#emailtemplate)
- [ExportImport](modules.md#exportimport)
- [Feature](modules.md#feature)
- [Frodo](modules.md#frodo)
- [Idm](modules.md#idm)
- [Idp](modules.md#idp)
- [Info](modules.md#info)
- [Journey](modules.md#journey)
- [Log](modules.md#log)
- [ManagedObject](modules.md#managedobject)
- [Node](modules.md#node)
- [OAuth2Client](modules.md#oauth2client)
- [OAuth2Oidc](modules.md#oauth2oidc)
- [OAuth2Provider](modules.md#oauth2provider)
- [Organization](modules.md#organization)
- [Policy](modules.md#policy)
- [PolicySet](modules.md#policyset)
- [Realm](modules.md#realm)
- [ResourceType](modules.md#resourcetype)
- [Saml2](modules.md#saml2)
- [Script](modules.md#script)
- [Secret](modules.md#secret)
- [Service](modules.md#service)
- [ServiceAccount](modules.md#serviceaccount)
- [Startup](modules.md#startup)
- [State](modules.md#state)
- [Theme](modules.md#theme)
- [Variable](modules.md#variable)
- [Version](modules.md#version)

### Variables

- [frodo](modules.md#frodo-1)
- [state](modules.md#state-1)

### Functions

- [FrodoLib](modules.md#frodolib)
- [createInstanceWithAdminAccount](modules.md#createinstancewithadminaccount)
- [createInstanceWithServiceAccount](modules.md#createinstancewithserviceaccount)

## Type Aliases

### Admin

Ƭ **Admin**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `addAutoIdStaticUserMapping` | () => `Promise`<`void`\> |
| `createLongLivedToken` | (`clientId`: `string`, `clientSecret`: `string`, `scope`: `string`, `secret`: `string` \| `boolean`, `lifetime`: `number`) => `Promise`<`any`\> |
| `createOAuth2ClientWithAdminPrivileges` | (`clientId`: `string`, `clientSecret`: `string`) => `Promise`<`void`\> |
| `grantOAuth2ClientAdminPrivileges` | (`clientId`: `string`) => `Promise`<`void`\> |
| `hideGenericExtensionAttributes` | (`includeCustomized`: `boolean`, `dryRun`: `boolean`) => `Promise`<`void`\> |
| `listNonOAuth2AdminStaticUserMappings` | (`showProtected`: `boolean`) => `Promise`<`any`\> |
| `listOAuth2AdminClients` | () => `Promise`<`any`\> |
| `listOAuth2CustomClients` | () => `Promise`<`any`\> |
| `removeStaticUserMapping` | (`subject`: `string`) => `Promise`<`void`\> |
| `repairOrgModel` | (`excludeCustomized`: `boolean`, `extendPermissions`: `boolean`, `dryRun`: `boolean`) => `Promise`<`void`\> |
| `revokeOAuth2ClientAdminPrivileges` | (`clientId`: `string`) => `Promise`<`void`\> |
| `showGenericExtensionAttributes` | (`includeCustomized`: `boolean`, `dryRun`: `boolean`) => `Promise`<`void`\> |

#### Defined in

[ops/AdminOps.ts:24](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/AdminOps.ts#L24)

___

### AdminFederation

Ƭ **AdminFederation**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `createAdminFederationExportTemplate` | () => [`AdminFederationExportInterface`](interfaces/Reference.AdminFederationExportInterface.md) |
| `deleteAdminFederationProvider` | (`providerId`: `string`) => `Promise`<[`SocialIdpSkeleton`](modules/Reference.md#socialidpskeleton)\> |
| `exportAdminFederationProvider` | (`providerId`: `string`) => `Promise`<[`AdminFederationExportInterface`](interfaces/Reference.AdminFederationExportInterface.md)\> |
| `exportAdminFederationProviders` | () => `Promise`<[`AdminFederationExportInterface`](interfaces/Reference.AdminFederationExportInterface.md)\> |
| `getAdminFederationProvider` | (`providerId`: `string`) => `Promise`<[`SocialIdpSkeleton`](modules/Reference.md#socialidpskeleton)\> |
| `getAdminFederationProviders` | () => `Promise`<[`SocialIdpSkeleton`](modules/Reference.md#socialidpskeleton)[]\> |
| `importAdminFederationProvider` | (`providerId`: `string`, `importData`: [`AdminFederationExportInterface`](interfaces/Reference.AdminFederationExportInterface.md)) => `Promise`<[`SocialIdpSkeleton`](modules/Reference.md#socialidpskeleton)\> |
| `importAdminFederationProviders` | (`importData`: [`AdminFederationExportInterface`](interfaces/Reference.AdminFederationExportInterface.md)) => `Promise`<[`SocialIdpSkeleton`](modules/Reference.md#socialidpskeleton)[]\> |
| `importFirstAdminFederationProvider` | (`importData`: [`AdminFederationExportInterface`](interfaces/Reference.AdminFederationExportInterface.md)) => `Promise`<[`SocialIdpSkeleton`](modules/Reference.md#socialidpskeleton)\> |
| `putProviderByTypeAndId` | (`providerType`: `string`, `providerId`: `string`, `providerData`: [`SocialIdpSkeleton`](modules/Reference.md#socialidpskeleton)) => `Promise`<[`SocialIdpSkeleton`](modules/Reference.md#socialidpskeleton)\> |

#### Defined in

[ops/cloud/AdminFederationOps.ts:16](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/cloud/AdminFederationOps.ts#L16)

___

### Agent

Ƭ **Agent**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `createAgentExportTemplate` | () => [`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md) |
| `deleteAgent` | (`agentId`: `string`) => `Promise`<`void`\> |
| `deleteAgents` | () => `Promise`<`void`\> |
| `deleteIdentityGatewayAgent` | (`agentId`: `string`) => `Promise`<`void`\> |
| `deleteIdentityGatewayAgents` | () => `Promise`<`void`\> |
| `deleteJavaAgent` | (`agentId`: `string`) => `Promise`<`void`\> |
| `deleteJavaAgents` | () => `Promise`<`void`\> |
| `deleteWebAgent` | (`agentId`: `string`) => `Promise`<`void`\> |
| `deleteWebAgents` | () => `Promise`<`void`\> |
| `exportAgent` | (`agentId`: `string`) => `Promise`<[`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)\> |
| `exportAgents` | () => `Promise`<[`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)\> |
| `exportIdentityGatewayAgent` | (`agentId`: `string`) => `Promise`<[`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)\> |
| `exportIdentityGatewayAgents` | () => `Promise`<[`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)\> |
| `exportJavaAgent` | (`agentId`: `string`) => `Promise`<[`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)\> |
| `exportJavaAgents` | () => `Promise`<[`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)\> |
| `exportWebAgent` | (`agentId`: `string`) => `Promise`<[`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)\> |
| `exportWebAgents` | () => `Promise`<[`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)\> |
| `getAgent` | (`agentId`: `string`) => `Promise`<`any`\> |
| `getAgentByTypeAndId` | (`agentType`: [`AgentType`](modules/Reference.md#agenttype), `agentId`: `string`) => `Promise`<`any`\> |
| `getAgents` | () => `Promise`<[`AgentSkeleton`](modules/Reference.md#agentskeleton)[]\> |
| `getIdentityGatewayAgent` | (`gatewayId`: `string`) => `Promise`<`any`\> |
| `getIdentityGatewayAgents` | () => `Promise`<`any`\> |
| `getJavaAgent` | (`agentId`: `string`) => `Promise`<`any`\> |
| `getJavaAgents` | () => `Promise`<`any`\> |
| `getWebAgent` | (`agentId`: `string`) => `Promise`<`any`\> |
| `getWebAgents` | () => `Promise`<`any`\> |
| `importAgent` | (`agentId`: `string`, `importData`: [`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)) => `Promise`<`any`\> |
| `importAgents` | (`importData`: [`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)) => `Promise`<`void`\> |
| `importIdentityGatewayAgent` | (`agentId`: `string`, `importData`: [`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)) => `Promise`<`any`\> |
| `importIdentityGatewayAgents` | (`importData`: [`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)) => `Promise`<`void`\> |
| `importJavaAgent` | (`agentId`: `string`, `importData`: [`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)) => `Promise`<`any`\> |
| `importJavaAgents` | (`importData`: [`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)) => `Promise`<`void`\> |
| `importWebAgent` | (`agentId`: `string`, `importData`: [`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)) => `Promise`<`any`\> |
| `importWebAgents` | (`importData`: [`AgentExportInterface`](interfaces/Reference.AgentExportInterface.md)) => `Promise`<`void`\> |
| `putIdentityGatewayAgent` | (`gatewayId`: `string`, `gatewayData`: [`AgentSkeleton`](modules/Reference.md#agentskeleton)) => `Promise`<`any`\> |
| `putJavaAgent` | (`agentId`: `string`, `agentData`: [`AgentSkeleton`](modules/Reference.md#agentskeleton)) => `Promise`<`any`\> |
| `putWebAgent` | (`agentId`: `string`, `agentData`: [`AgentSkeleton`](modules/Reference.md#agentskeleton)) => `Promise`<`any`\> |

#### Defined in

[ops/AgentOps.ts:15](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/AgentOps.ts#L15)

___

### Authenticate

Ƭ **Authenticate**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `getAccessTokenForServiceAccount` | (`saId?`: `string`, `saJwk?`: [`JwkRsa`](modules/Reference.md#jwkrsa)) => `Promise`<`string`\> |
| `getTokens` | (`forceLoginAsUser?`: `boolean`) => `Promise`<`boolean`\> |

#### Defined in

[ops/AuthenticateOps.ts:18](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/AuthenticateOps.ts#L18)

___

### CirclesOfTrust

Ƭ **CirclesOfTrust**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `createCircleOfTrust` | (`cotData`: [`CircleOfTrustSkeleton`](modules/Reference.md#circleoftrustskeleton)) => `Promise`<`any`\> |
| `createCirclesOfTrustExportTemplate` | () => [`CirclesOfTrustExportInterface`](interfaces/Reference.CirclesOfTrustExportInterface.md) |
| `exportCircleOfTrust` | (`cotId`: `string`) => `Promise`<[`CirclesOfTrustExportInterface`](interfaces/Reference.CirclesOfTrustExportInterface.md)\> |
| `exportCirclesOfTrust` | () => `Promise`<[`CirclesOfTrustExportInterface`](interfaces/Reference.CirclesOfTrustExportInterface.md)\> |
| `getCircleOfTrust` | (`cotId`: `string`) => `Promise`<`any`\> |
| `getCirclesOfTrust` | () => `Promise`<`any`\> |
| `importCircleOfTrust` | (`cotId`: `string`, `importData`: [`CirclesOfTrustExportInterface`](interfaces/Reference.CirclesOfTrustExportInterface.md)) => `Promise`<`any`\> |
| `importCirclesOfTrust` | (`importData`: [`CirclesOfTrustExportInterface`](interfaces/Reference.CirclesOfTrustExportInterface.md)) => `Promise`<`any`[]\> |
| `importFirstCircleOfTrust` | (`importData`: [`CirclesOfTrustExportInterface`](interfaces/Reference.CirclesOfTrustExportInterface.md)) => `Promise`<`any`\> |

#### Defined in

[ops/CirclesOfTrustOps.ts:13](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/CirclesOfTrustOps.ts#L13)

___

### ConnectionProfile

Ƭ **ConnectionProfile**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `addNewServiceAccount` | () => `Promise`<[`IdObjectSkeletonInterface`](interfaces/Reference.IdObjectSkeletonInterface.md)\> |
| `deleteConnectionProfile` | (`host`: `string`) => `void` |
| `findConnectionProfiles` | (`connectionProfiles`: [`ConnectionsFileInterface`](interfaces/Reference.ConnectionsFileInterface.md), `host`: `string`) => [`SecureConnectionProfileInterface`](interfaces/Reference.SecureConnectionProfileInterface.md)[] |
| `getConnectionProfile` | () => `Promise`<[`ConnectionProfileInterface`](interfaces/Reference.ConnectionProfileInterface.md)\> |
| `getConnectionProfileByHost` | (`host`: `string`) => `Promise`<[`ConnectionProfileInterface`](interfaces/Reference.ConnectionProfileInterface.md)\> |
| `getConnectionProfilesPath` | () => `string` |
| `initConnectionProfiles` | () => `Promise`<`void`\> |
| `saveConnectionProfile` | (`host`: `string`) => `Promise`<`boolean`\> |

#### Defined in

[ops/ConnectionProfileOps.ts:17](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/ConnectionProfileOps.ts#L17)

___

### Constants

Ƭ **Constants**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `CLASSIC_DEPLOYMENT_TYPE_KEY` | `string` |
| `CLOUD_DEPLOYMENT_TYPE_KEY` | `string` |
| `DEFAULT_REALM_KEY` | `string` |
| `DEPLOYMENT_TYPES` | `string`[] |
| `DEPLOYMENT_TYPE_REALM_MAP` | { `classic`: `string` ; `cloud`: `string` ; `forgeops`: `string`  } |
| `DEPLOYMENT_TYPE_REALM_MAP.classic` | `string` |
| `DEPLOYMENT_TYPE_REALM_MAP.cloud` | `string` |
| `DEPLOYMENT_TYPE_REALM_MAP.forgeops` | `string` |
| `FORGEOPS_DEPLOYMENT_TYPE_KEY` | `string` |
| `FRODO_CONNECTION_PROFILES_PATH_KEY` | `string` |
| `FRODO_MASTER_KEY_KEY` | `string` |
| `FRODO_MASTER_KEY_PATH_KEY` | `string` |
| `FRODO_METADATA_ID` | `string` |

#### Defined in

[shared/Constants.ts:1](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/Constants.ts#L1)

___

### EmailTemplate

Ƭ **EmailTemplate**: `Object`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `EMAIL_TEMPLATE_TYPE` | `string` | Email template type key used to build the IDM id: 'emailTemplate/<id>' |
| `getEmailTemplate` | (`templateId`: `string`) => `Promise`<`any`\> | Get email template |
| `getEmailTemplates` | () => `Promise`<`any`\> | Get all email templates |
| `putEmailTemplate` | (`templateId`: `string`, `templateData`: [`EmailTemplateSkeleton`](modules/Reference.md#emailtemplateskeleton)) => `Promise`<`any`\> | Put email template |

#### Defined in

[ops/EmailTemplateOps.ts:12](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/EmailTemplateOps.ts#L12)

___

### ExportImport

Ƭ **ExportImport**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `appendTextToFile` | (`data`: `string`, `filename`: `string`) => `void` |
| `convertBase64TextToArray` | (`b64text`: `string`) => `any`[] |
| `convertBase64UrlTextToArray` | (`b64UTF8Text`: `string`) => `any`[] |
| `convertTextArrayToBase64` | (`textArray`: `string`[]) => `string` |
| `convertTextArrayToBase64Url` | (`textArray`: `string`[]) => `any` |
| `findFilesByName` | (`fileName`: `string`, `fast?`: `boolean`, `path?`: `string`) => `string`[] |
| `getMetadata` | () => [`ExportMetaData`](interfaces/Reference.ExportMetaData.md) |
| `getRealmString` | () => `string` |
| `getTypedFilename` | (`name`: `string`, `type`: `string`, `suffix?`: `string`) => `string` |
| `getWorkingDirectory` | () => `string` |
| `readFilesRecursive` | (`directory`: `string`) => `Promise`<`string`[]\> |
| `saveJsonToFile` | (`data`: `object`, `filename`: `string`, `includeMeta?`: `boolean`) => `boolean` |
| `saveToFile` | (`type`: `string`, `data`: `object`, `identifier`: `string`, `filename`: `string`) => `void` |
| `titleCase` | (`input`: `string`) => `string` |
| `validateImport` | (`metadata`: `any`) => `boolean` |

#### Defined in

[ops/utils/ExportImportUtils.ts:16](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/utils/ExportImportUtils.ts#L16)

___

### Feature

Ƭ **Feature**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `getFeatures` | () => `Promise`<[`FeatureInterface`](interfaces/Reference.FeatureInterface.md)[]\> |
| `hasFeature` | (`featureId`: `string`) => `Promise`<`boolean`\> |

#### Defined in

[ops/cloud/FeatureOps.ts:8](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/cloud/FeatureOps.ts#L8)

___

### Frodo

Ƭ **Frodo**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `admin` | [`Admin`](modules.md#admin) |
| `agent` | [`Agent`](modules.md#agent) |
| `authn` | { `journey`: [`Journey`](modules.md#journey) ; `node`: [`Node`](modules.md#node)  } |
| `authn.journey` | [`Journey`](modules.md#journey) |
| `authn.node` | [`Node`](modules.md#node) |
| `authz` | { `policy`: [`Policy`](modules.md#policy) ; `policySet`: [`PolicySet`](modules.md#policyset) ; `resourceType`: [`ResourceType`](modules.md#resourcetype)  } |
| `authz.policy` | [`Policy`](modules.md#policy) |
| `authz.policySet` | [`PolicySet`](modules.md#policyset) |
| `authz.resourceType` | [`ResourceType`](modules.md#resourcetype) |
| `cloud` | { `adminFed`: [`AdminFederation`](modules.md#adminfederation) ; `feature`: [`Feature`](modules.md#feature) ; `log`: [`Log`](modules.md#log) ; `secret`: [`Secret`](modules.md#secret) ; `serviceAccount`: [`ServiceAccount`](modules.md#serviceaccount) ; `startup`: [`Startup`](modules.md#startup) ; `variable`: [`Variable`](modules.md#variable)  } |
| `cloud.adminFed` | [`AdminFederation`](modules.md#adminfederation) |
| `cloud.feature` | [`Feature`](modules.md#feature) |
| `cloud.log` | [`Log`](modules.md#log) |
| `cloud.secret` | [`Secret`](modules.md#secret) |
| `cloud.serviceAccount` | [`ServiceAccount`](modules.md#serviceaccount) |
| `cloud.startup` | [`Startup`](modules.md#startup) |
| `cloud.variable` | [`Variable`](modules.md#variable) |
| `conn` | [`ConnectionProfile`](modules.md#connectionprofile) |
| `email` | { `template`: [`EmailTemplate`](modules.md#emailtemplate)  } |
| `email.template` | [`EmailTemplate`](modules.md#emailtemplate) |
| `idm` | { `config`: [`Idm`](modules.md#idm) ; `managed`: [`ManagedObject`](modules.md#managedobject) ; `organization`: [`Organization`](modules.md#organization)  } |
| `idm.config` | [`Idm`](modules.md#idm) |
| `idm.managed` | [`ManagedObject`](modules.md#managedobject) |
| `idm.organization` | [`Organization`](modules.md#organization) |
| `info` | [`Info`](modules.md#info) |
| `login` | [`Authenticate`](modules.md#authenticate) |
| `oauth2oidc` | { `client`: [`OAuth2Client`](modules.md#oauth2client) ; `endpoint`: [`OAuth2Oidc`](modules.md#oauth2oidc) ; `external`: [`Idp`](modules.md#idp) ; `provider`: [`OAuth2Provider`](modules.md#oauth2provider)  } |
| `oauth2oidc.client` | [`OAuth2Client`](modules.md#oauth2client) |
| `oauth2oidc.endpoint` | [`OAuth2Oidc`](modules.md#oauth2oidc) |
| `oauth2oidc.external` | [`Idp`](modules.md#idp) |
| `oauth2oidc.provider` | [`OAuth2Provider`](modules.md#oauth2provider) |
| `realm` | [`Realm`](modules.md#realm) |
| `saml2` | { `circlesOfTrust`: [`CirclesOfTrust`](modules.md#circlesoftrust) ; `entityProvider`: [`Saml2`](modules.md#saml2)  } |
| `saml2.circlesOfTrust` | [`CirclesOfTrust`](modules.md#circlesoftrust) |
| `saml2.entityProvider` | [`Saml2`](modules.md#saml2) |
| `script` | [`Script`](modules.md#script) |
| `service` | [`Service`](modules.md#service) |
| `state` | [`State`](modules.md#state) |
| `theme` | [`Theme`](modules.md#theme) |
| `utils` | [`Utils`](modules/Reference.md#utils) & { `constants`: [`Constants`](modules.md#constants) ; `impex`: [`ExportImport`](modules.md#exportimport) ; `jose`: [`Jose`](modules/Reference.md#jose) ; `script`: [`ScriptValidation`](modules/Reference.md#scriptvalidation) ; `version`: [`Version`](modules.md#version)  } |

#### Defined in

[lib/FrodoLib.ts:53](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/lib/FrodoLib.ts#L53)

___

### Idm

Ƭ **Idm**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `getAllConfigEntities` | () => `Promise`<`any`\> |
| `getConfigEntitiesByType` | (`type`: `string`) => `Promise`<`any`\> |
| `getConfigEntity` | (`entityId`: `string`) => `Promise`<`any`\> |
| `putConfigEntity` | (`entityId`: `string`, `entityData`: `string` \| [`NoIdObjectSkeletonInterface`](interfaces/Reference.NoIdObjectSkeletonInterface.md)) => `Promise`<`any`\> |
| `queryAllManagedObjectsByType` | (`type`: `string`, `fields`: `string`[], `pageCookie`: `string`) => `Promise`<[`PagedResult`](modules/Reference.md#pagedresult)<[`IdObjectSkeletonInterface`](interfaces/Reference.IdObjectSkeletonInterface.md)\>\> |
| `testConnectorServers` | () => `Promise`<[`ConnectorServerStatusInterface`](interfaces/Reference.ConnectorServerStatusInterface.md)[]\> |

#### Defined in

[ops/IdmOps.ts:19](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/IdmOps.ts#L19)

___

### Idp

Ƭ **Idp**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `deleteSocialProvider` | (`providerId`: `string`) => `Promise`<`unknown`\> |
| `exportSocialProvider` | (`providerId`: `string`) => `Promise`<[`SocialProviderExportInterface`](interfaces/Reference.SocialProviderExportInterface.md)\> |
| `exportSocialProviders` | () => `Promise`<[`SocialProviderExportInterface`](interfaces/Reference.SocialProviderExportInterface.md)\> |
| `getSocialIdentityProviders` | () => `Promise`<`any`\> |
| `getSocialProvider` | (`providerId`: `string`) => `Promise`<`any`\> |
| `importFirstSocialProvider` | (`importData`: [`SocialProviderExportInterface`](interfaces/Reference.SocialProviderExportInterface.md)) => `Promise`<`boolean`\> |
| `importSocialProvider` | (`providerId`: `string`, `importData`: [`SocialProviderExportInterface`](interfaces/Reference.SocialProviderExportInterface.md)) => `Promise`<`boolean`\> |
| `importSocialProviders` | (`importData`: [`SocialProviderExportInterface`](interfaces/Reference.SocialProviderExportInterface.md)) => `Promise`<`boolean`\> |
| `putProviderByTypeAndId` | (`providerType`: `string`, `providerId`: `string`, `providerData`: [`SocialIdpSkeleton`](modules/Reference.md#socialidpskeleton)) => `Promise`<`any`\> |

#### Defined in

[ops/IdpOps.ts:28](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/IdpOps.ts#L28)

___

### Info

Ƭ **Info**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `getInfo` | () => `Promise`<[`PlatformInfo`](modules/Reference.md#platforminfo)\> |

#### Defined in

[ops/InfoOps.ts:7](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/InfoOps.ts#L7)

___

### Journey

Ƭ **Journey**: `Object`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `fileByIdTreeExportResolver` | [`TreeExportResolverInterface`](interfaces/Reference.TreeExportResolverInterface.md) | Tree export resolver used to resolve a tree id/name to a full export of that tree from individual `treename.journey.json` export files. **`Param`** id/name of the tree to resolve |
| `onlineTreeExportResolver` | [`TreeExportResolverInterface`](interfaces/Reference.TreeExportResolverInterface.md) | Default tree export resolver used to resolve a tree id/name to a full export w/o dependencies of that tree from a platform instance. **`Param`** id/name of the tree to resolve |
| `createFileParamTreeExportResolver` | (`file`: `string`) => [`TreeExportResolverInterface`](interfaces/Reference.TreeExportResolverInterface.md) | Factory that creates a tree export resolver used to resolve a tree id to a full export of that tree from a multi-tree export file. |
| `createMultiTreeExportTemplate` | () => [`MultiTreeExportInterface`](interfaces/Reference.MultiTreeExportInterface.md) | Create an empty multi tree export template |
| `createSingleTreeExportTemplate` | () => [`SingleTreeExportInterface`](interfaces/Reference.SingleTreeExportInterface.md) | Create an empty single tree export template |
| `deleteJourney` | (`journeyId`: `string`, `options`: { `deep`: `boolean` ; `progress?`: `boolean` ; `verbose`: `boolean`  }) => `Promise`<[`DeleteJourneyStatus`](modules/Reference.md#deletejourneystatus)\> | Delete a journey |
| `deleteJourneys` | (`options`: { `deep`: `boolean` ; `verbose`: `boolean`  }) => `Promise`<[`DeleteJourneysStatus`](modules/Reference.md#deletejourneysstatus)\> | Delete all journeys |
| `disableJourney` | (`journeyId`: `string`) => `Promise`<`boolean`\> | Disable a journey |
| `enableJourney` | (`journeyId`: `string`) => `Promise`<`boolean`\> | Enable a journey |
| `exportJourney` | (`treeId`: `string`, `options?`: [`TreeExportOptions`](interfaces/Reference.TreeExportOptions.md)) => `Promise`<[`SingleTreeExportInterface`](interfaces/Reference.SingleTreeExportInterface.md)\> | Create export data for a tree/journey with all its nodes and dependencies. The export data can be written to a file as is. |
| `findOrphanedNodes` | () => `Promise`<[`NodeSkeleton`](modules/Reference.md#nodeskeleton)[]\> | Find all node configuration objects that are no longer referenced by any tree |
| `getJourney` | (`journeyId`: `string`) => `Promise`<[`TreeSkeleton`](modules/Reference.md#treeskeleton)\> | Get a journey/tree without all its nodes and dependencies. |
| `getJourneyClassification` | (`journey`: [`SingleTreeExportInterface`](interfaces/Reference.SingleTreeExportInterface.md)) => [`JourneyClassificationType`](modules/Reference.md#journeyclassificationtype)[] | Get a journey's classifications, which can be one or multiple of: - standard: can run on any instance of a ForgeRock platform - cloud: utilize nodes, which are exclusively available in the ForgeRock Identity Cloud - premium: utilizes nodes, which come at a premium - custom: utilizes nodes not included in the ForgeRock platform release |
| `getJourneys` | () => `Promise`<[`TreeSkeleton`](modules/Reference.md#treeskeleton)[]\> | Get all the journeys/trees without all their nodes and dependencies. |
| `getNodeRef` | (`nodeObj`: [`NodeSkeleton`](modules/Reference.md#nodeskeleton), `singleTreeExport`: [`SingleTreeExportInterface`](interfaces/Reference.SingleTreeExportInterface.md)) => [`NodeRefSkeletonInterface`](interfaces/Reference.NodeRefSkeletonInterface.md) \| [`InnerNodeRefSkeletonInterface`](interfaces/Reference.InnerNodeRefSkeletonInterface.md) | Get the node reference obbject for a node object. Node reference objects are used in a tree flow definition and within page nodes to reference nodes. Among other things, node references contain all the non-configuration meta data that exists for readaility, like the x/y coordinates of the node and the display name chosen by the tree designer. The dislay name is the only intuitive link between the graphical representation of the tree and the node configurations that make up the tree. |
| `getTreeDescendents` | (`treeExport`: [`SingleTreeExportInterface`](interfaces/Reference.SingleTreeExportInterface.md), `resolveTreeExport`: [`TreeExportResolverInterface`](interfaces/Reference.TreeExportResolverInterface.md), `resolvedTreeIds?`: `string`[]) => `Promise`<[`TreeDependencyMapInterface`](interfaces/Reference.TreeDependencyMapInterface.md)\> | Get tree dependencies (all descendent inner trees) |
| `importAllJourneys` | (`treesMap`: [`MultiTreeExportInterface`](interfaces/Reference.MultiTreeExportInterface.md), `options`: [`TreeImportOptions`](interfaces/Reference.TreeImportOptions.md)) => `Promise`<`void`\> | Helper to import multiple trees from a tree map |
| `importJourney` | (`treeObject`: [`SingleTreeExportInterface`](interfaces/Reference.SingleTreeExportInterface.md), `options`: [`TreeImportOptions`](interfaces/Reference.TreeImportOptions.md)) => `Promise`<`boolean`\> | Helper to import a tree with all dependencies from a `SingleTreeExportInterface` object (typically read from a file) |
| `isCloudOnlyJourney` | (`journey`: [`SingleTreeExportInterface`](interfaces/Reference.SingleTreeExportInterface.md)) => `boolean` | Analyze if a journey contains any cloud-only nodes considering the detected or the overridden version. |
| `isCustomJourney` | (`journey`: [`SingleTreeExportInterface`](interfaces/Reference.SingleTreeExportInterface.md)) => `boolean` | Analyze if a journey contains any custom nodes considering the detected or the overridden version. |
| `isPremiumJourney` | (`journey`: [`SingleTreeExportInterface`](interfaces/Reference.SingleTreeExportInterface.md)) => `boolean` | Analyze if a journey contains any premium nodes considering the detected or the overridden version. |
| `removeOrphanedNodes` | (`orphanedNodes`: [`NodeSkeleton`](modules/Reference.md#nodeskeleton)[]) => `Promise`<`unknown`[]\> | Remove orphaned nodes |
| `resolveDependencies` | (`installedJorneys`: `any`, `journeyMap`: `any`, `unresolvedJourneys`: `any`, `resolvedJourneys`: `any`, `index?`: `number`) => `Promise`<`void`\> | Resolve journey dependencies |

#### Defined in

[ops/JourneyOps.ts:75](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/JourneyOps.ts#L75)

___

### Log

Ƭ **Log**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `createLogApiKey` | (`keyName`: `string`) => `Promise`<[`LogApiKey`](modules/Reference.md#logapikey)\> |
| `deleteLogApiKey` | (`keyId`: `string`) => `Promise`<[`LogApiKey`](modules/Reference.md#logapikey)\> |
| `deleteLogApiKeys` | () => `Promise`<[`LogApiKey`](modules/Reference.md#logapikey)[]\> |
| `fetch` | (`source`: `string`, `startTs`: `string`, `endTs`: `string`, `cookie`: `string`) => `Promise`<[`PagedResult`](modules/Reference.md#pagedresult)<[`LogEventSkeleton`](modules/Reference.md#logeventskeleton)\>\> |
| `getDefaultNoiseFilter` | () => `string`[] |
| `getLogApiKey` | (`keyId`: `string`) => `Promise`<[`LogApiKey`](modules/Reference.md#logapikey)\> |
| `getLogApiKeys` | () => `Promise`<[`LogApiKey`](modules/Reference.md#logapikey)[]\> |
| `getLogSources` | () => `Promise`<`string`[]\> |
| `resolveLevel` | (`level`: `string` \| `number`) => `string`[] |
| `resolvePayloadLevel` | (`log`: [`LogEventSkeleton`](modules/Reference.md#logeventskeleton)) => `string` |
| `tail` | (`source`: `string`, `cookie`: `string`) => `Promise`<[`PagedResult`](modules/Reference.md#pagedresult)<[`LogEventSkeleton`](modules/Reference.md#logeventskeleton)\>\> |

#### Defined in

[ops/cloud/LogOps.ts:18](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/cloud/LogOps.ts#L18)

___

### ManagedObject

Ƭ **ManagedObject**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `resolveFullName` | (`type`: `string`, `id`: `string`) => `Promise`<`string`\> |
| `resolveUserName` | (`type`: `string`, `id`: `string`) => `Promise`<`string` \| `number` \| `boolean` \| `object`\> |

#### Defined in

[ops/ManagedObjectOps.ts:5](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/ManagedObjectOps.ts#L5)

___

### Node

Ƭ **Node**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `findOrphanedNodes` | () => `Promise`<`unknown`[]\> |
| `getNodeClassification` | (`nodeType`: `string`) => [`NodeClassificationType`](modules/Reference.md#nodeclassificationtype)[] |
| `isCloudOnlyNode` | (`nodeType`: `string`) => `boolean` |
| `isCustomNode` | (`nodeType`: `string`) => `boolean` |
| `isPremiumNode` | (`nodeType`: `string`) => `boolean` |
| `removeOrphanedNodes` | (`orphanedNodes`: [`NodeSkeleton`](modules/Reference.md#nodeskeleton)[]) => `Promise`<[`NodeSkeleton`](modules/Reference.md#nodeskeleton)[]\> |

#### Defined in

[ops/NodeOps.ts:18](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/NodeOps.ts#L18)

___

### OAuth2Client

Ƭ **OAuth2Client**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `deleteOAuth2Client` | (`clientId`: `string`) => `Promise`<[`OAuth2ClientSkeleton`](modules/Reference.md#oauth2clientskeleton)\> |
| `exportOAuth2Client` | (`clientId`: `string`, `options?`: [`OAuth2ClientExportOptions`](interfaces/Reference.OAuth2ClientExportOptions.md)) => `Promise`<[`OAuth2ClientExportInterface`](interfaces/Reference.OAuth2ClientExportInterface.md)\> |
| `exportOAuth2Clients` | (`options?`: [`OAuth2ClientExportOptions`](interfaces/Reference.OAuth2ClientExportOptions.md)) => `Promise`<[`OAuth2ClientExportInterface`](interfaces/Reference.OAuth2ClientExportInterface.md)\> |
| `getOAuth2Client` | (`clientId`: `string`) => `Promise`<[`OAuth2ClientSkeleton`](modules/Reference.md#oauth2clientskeleton)\> |
| `getOAuth2Clients` | () => `Promise`<[`OAuth2ClientSkeleton`](modules/Reference.md#oauth2clientskeleton)[]\> |
| `importFirstOAuth2Client` | (`importData`: [`OAuth2ClientExportInterface`](interfaces/Reference.OAuth2ClientExportInterface.md), `options?`: [`OAuth2ClientImportOptions`](interfaces/Reference.OAuth2ClientImportOptions.md)) => `Promise`<`any`\> |
| `importOAuth2Client` | (`clientId`: `string`, `importData`: [`OAuth2ClientExportInterface`](interfaces/Reference.OAuth2ClientExportInterface.md), `options?`: [`OAuth2ClientImportOptions`](interfaces/Reference.OAuth2ClientImportOptions.md)) => `Promise`<`any`\> |
| `importOAuth2Clients` | (`importData`: [`OAuth2ClientExportInterface`](interfaces/Reference.OAuth2ClientExportInterface.md), `options?`: [`OAuth2ClientImportOptions`](interfaces/Reference.OAuth2ClientImportOptions.md)) => `Promise`<`unknown`[]\> |
| `putOAuth2Client` | (`clientId`: `string`, `clientData`: [`OAuth2ClientSkeleton`](modules/Reference.md#oauth2clientskeleton)) => `Promise`<[`OAuth2ClientSkeleton`](modules/Reference.md#oauth2clientskeleton)\> |

#### Defined in

[ops/OAuth2ClientOps.ts:20](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/OAuth2ClientOps.ts#L20)

___

### OAuth2Oidc

Ƭ **OAuth2Oidc**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `accessToken` | (`amBaseUrl`: `string`, `data`: `any`, `config`: `AxiosRequestConfig`<`any`\>) => `Promise`<`AxiosResponse`<`any`, `any`\>\> |
| `authorize` | (`amBaseUrl`: `string`, `data`: `string`, `config`: `AxiosRequestConfig`<`any`\>) => `Promise`<`AxiosResponse`<`any`, `any`\>\> |
| `clientCredentialsGrant` | (`amBaseUrl`: `string`, `clientId`: `string`, `clientSecret`: `string`, `scope`: `string`) => `Promise`<`any`\> |
| `getTokenInfo` | (`amBaseUrl`: `string`, `config`: `AxiosRequestConfig`<`any`\>) => `Promise`<`any`\> |

#### Defined in

[ops/OAuth2OidcOps.ts:10](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/OAuth2OidcOps.ts#L10)

___

### OAuth2Provider

Ƭ **OAuth2Provider**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `getOAuth2Provider` | () => `Promise`<`any`\> |

#### Defined in

[ops/OAuth2ProviderOps.ts:4](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/OAuth2ProviderOps.ts#L4)

___

### Organization

Ƭ **Organization**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `getOrganizations` | () => `Promise`<`any`[]\> |
| `getRealmManagedOrganization` | () => `string` |

#### Defined in

[ops/OrganizationOps.ts:5](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/OrganizationOps.ts#L5)

___

### Policy

Ƭ **Policy**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `deletePolicy` | (`policyId`: `string`) => `Promise`<`any`\> |
| `exportPolicies` | (`options?`: [`PolicyExportOptions`](interfaces/Reference.PolicyExportOptions.md)) => `Promise`<[`PolicyExportInterface`](interfaces/Reference.PolicyExportInterface.md)\> |
| `exportPoliciesByPolicySet` | (`policySetName`: `string`, `options?`: [`PolicyExportOptions`](interfaces/Reference.PolicyExportOptions.md)) => `Promise`<[`PolicyExportInterface`](interfaces/Reference.PolicyExportInterface.md)\> |
| `exportPolicy` | (`policyId`: `string`, `options?`: [`PolicyExportOptions`](interfaces/Reference.PolicyExportOptions.md)) => `Promise`<[`PolicyExportInterface`](interfaces/Reference.PolicyExportInterface.md)\> |
| `getPolicies` | () => `Promise`<[`PolicySkeleton`](modules/Reference.md#policyskeleton)[]\> |
| `getPoliciesByPolicySet` | (`policySetId`: `string`) => `Promise`<[`PolicySkeleton`](modules/Reference.md#policyskeleton)[]\> |
| `getPolicy` | (`policyId`: `string`) => `Promise`<[`PolicySkeleton`](modules/Reference.md#policyskeleton)\> |
| `importFirstPolicy` | (`importData`: [`PolicyExportInterface`](interfaces/Reference.PolicyExportInterface.md), `options?`: [`PolicyImportOptions`](interfaces/Reference.PolicyImportOptions.md)) => `Promise`<[`PolicySkeleton`](modules/Reference.md#policyskeleton)\> |
| `importPolicies` | (`importData`: [`PolicyExportInterface`](interfaces/Reference.PolicyExportInterface.md), `options?`: [`PolicyImportOptions`](interfaces/Reference.PolicyImportOptions.md)) => `Promise`<[`PolicySkeleton`](modules/Reference.md#policyskeleton)[]\> |
| `importPolicy` | (`policyId`: `string`, `importData`: [`PolicyExportInterface`](interfaces/Reference.PolicyExportInterface.md), `options?`: [`PolicyImportOptions`](interfaces/Reference.PolicyImportOptions.md)) => `Promise`<[`PolicySkeleton`](modules/Reference.md#policyskeleton)\> |
| `putPolicy` | (`policyId`: `string`, `policyData`: [`PolicySkeleton`](modules/Reference.md#policyskeleton)) => `Promise`<`any`\> |

#### Defined in

[ops/PolicyOps.ts:25](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/PolicyOps.ts#L25)

___

### PolicySet

Ƭ **PolicySet**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `createPolicySet` | (`policySetData`: [`PolicySetSkeleton`](modules/Reference.md#policysetskeleton)) => `Promise`<`any`\> |
| `deletePolicySet` | (`policySetName`: `string`) => `Promise`<`any`\> |
| `exportPolicySet` | (`policySetName`: `string`, `options?`: [`PolicySetExportOptions`](interfaces/Reference.PolicySetExportOptions.md)) => `Promise`<[`PolicySetExportInterface`](interfaces/Reference.PolicySetExportInterface.md)\> |
| `exportPolicySets` | (`options?`: [`PolicySetExportOptions`](interfaces/Reference.PolicySetExportOptions.md)) => `Promise`<[`PolicySetExportInterface`](interfaces/Reference.PolicySetExportInterface.md)\> |
| `getPolicySet` | (`policySetName`: `string`) => `Promise`<[`PolicySetSkeleton`](modules/Reference.md#policysetskeleton)\> |
| `getPolicySets` | () => `Promise`<[`PolicySetSkeleton`](modules/Reference.md#policysetskeleton)[]\> |
| `importFirstPolicySet` | (`importData`: [`PolicySetExportInterface`](interfaces/Reference.PolicySetExportInterface.md), `options?`: [`PolicySetImportOptions`](interfaces/Reference.PolicySetImportOptions.md)) => `Promise`<`any`\> |
| `importPolicySet` | (`policySetName`: `string`, `importData`: [`PolicySetExportInterface`](interfaces/Reference.PolicySetExportInterface.md), `options?`: [`PolicySetImportOptions`](interfaces/Reference.PolicySetImportOptions.md)) => `Promise`<`any`\> |
| `importPolicySets` | (`importData`: [`PolicySetExportInterface`](interfaces/Reference.PolicySetExportInterface.md), `options?`: [`PolicySetImportOptions`](interfaces/Reference.PolicySetImportOptions.md)) => `Promise`<`any`\> |
| `updatePolicySet` | (`policySetData`: [`PolicySetSkeleton`](modules/Reference.md#policysetskeleton)) => `Promise`<`any`\> |

#### Defined in

[ops/PolicySetOps.ts:28](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/PolicySetOps.ts#L28)

___

### Realm

Ƭ **Realm**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `addCustomDomain` | (`realmName`: `string`, `domain`: `string`) => `Promise`<`any`\> |
| `getRealmByName` | (`realmName`: `string`) => `Promise`<`any`\> |
| `getRealms` | () => `Promise`<`any`\> |
| `putRealm` | (`realmId`: `string`, `realmData`: `object`) => `Promise`<`any`\> |
| `removeCustomDomain` | (`realmName`: `string`, `domain`: `string`) => `Promise`<`any`\> |

#### Defined in

[ops/RealmOps.ts:5](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/RealmOps.ts#L5)

___

### ResourceType

Ƭ **ResourceType**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `deleteResourceType` | (`resourceTypeUuid`: `string`) => `Promise`<`any`\> |
| `deleteResourceTypeByName` | (`resourceTypeName`: `string`) => `Promise`<[`ResourceTypeSkeleton`](modules/Reference.md#resourcetypeskeleton)\> |
| `exportResourceType` | (`resourceTypeUuid`: `string`) => `Promise`<[`ResourceTypeExportInterface`](interfaces/Reference.ResourceTypeExportInterface.md)\> |
| `exportResourceTypeByName` | (`resourceTypeName`: `string`) => `Promise`<[`ResourceTypeExportInterface`](interfaces/Reference.ResourceTypeExportInterface.md)\> |
| `exportResourceTypes` | () => `Promise`<[`ResourceTypeExportInterface`](interfaces/Reference.ResourceTypeExportInterface.md)\> |
| `getResourceType` | (`resourceTypeUuid`: `string`) => `Promise`<`any`\> |
| `getResourceTypeByName` | (`resourceTypeName`: `string`) => `Promise`<[`ResourceTypeSkeleton`](modules/Reference.md#resourcetypeskeleton)\> |
| `getResourceTypes` | () => `Promise`<[`ResourceTypeSkeleton`](modules/Reference.md#resourcetypeskeleton)[]\> |
| `importFirstResourceType` | (`importData`: [`ResourceTypeExportInterface`](interfaces/Reference.ResourceTypeExportInterface.md)) => `Promise`<`any`\> |
| `importResourceType` | (`resourceTypeUuid`: `string`, `importData`: [`ResourceTypeExportInterface`](interfaces/Reference.ResourceTypeExportInterface.md)) => `Promise`<`any`\> |
| `importResourceTypeByName` | (`resourceTypeName`: `string`, `importData`: [`ResourceTypeExportInterface`](interfaces/Reference.ResourceTypeExportInterface.md)) => `Promise`<`any`\> |
| `importResourceTypes` | (`importData`: [`ResourceTypeExportInterface`](interfaces/Reference.ResourceTypeExportInterface.md)) => `Promise`<`any`[]\> |
| `updateResourceType` | (`resourceTypeUuid`: `string`, `resourceTypeData`: [`ResourceTypeSkeleton`](modules/Reference.md#resourcetypeskeleton)) => `Promise`<[`ResourceTypeSkeleton`](modules/Reference.md#resourcetypeskeleton)\> |

#### Defined in

[ops/ResourceTypeOps.ts:15](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/ResourceTypeOps.ts#L15)

___

### Saml2

Ƭ **Saml2**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `deleteSaml2Provider` | (`entityId`: `string`) => `Promise`<[`Saml2ProviderSkeleton`](modules/Reference.md#saml2providerskeleton)\> |
| `deleteSaml2Providers` | () => `Promise`<[`Saml2ProviderSkeleton`](modules/Reference.md#saml2providerskeleton)[]\> |
| `exportSaml2Provider` | (`entityId`: `string`) => `Promise`<[`Saml2ExportInterface`](interfaces/Reference.Saml2ExportInterface.md)\> |
| `exportSaml2Providers` | () => `Promise`<[`Saml2ExportInterface`](interfaces/Reference.Saml2ExportInterface.md)\> |
| `getProviderByLocationAndId` | (`location`: `string`, `entityId64`: `string`) => `Promise`<`any`\> |
| `getProviderMetadata` | (`entityId`: `string`) => `Promise`<`any`\> |
| `getProviderMetadataUrl` | (`entityId`: `string`) => `string` |
| `getSaml2Provider` | (`entityId`: `string`) => `Promise`<[`Saml2ProviderSkeleton`](modules/Reference.md#saml2providerskeleton)\> |
| `getSaml2ProviderStub` | (`entityId`: `string`) => `Promise`<[`Saml2ProviderStub`](modules/Reference.md#saml2providerstub)\> |
| `getSaml2ProviderStubs` | () => `Promise`<[`Saml2ProviderStub`](modules/Reference.md#saml2providerstub)[]\> |
| `importSaml2Provider` | (`entityId`: `string`, `importData`: [`Saml2ExportInterface`](interfaces/Reference.Saml2ExportInterface.md)) => `Promise`<`boolean`\> |
| `importSaml2Providers` | (`importData`: [`Saml2ExportInterface`](interfaces/Reference.Saml2ExportInterface.md)) => `Promise`<[`MultiOpStatusInterface`](interfaces/Reference.MultiOpStatusInterface.md)\> |

#### Defined in

[ops/Saml2Ops.ts:36](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/Saml2Ops.ts#L36)

___

### Script

Ƭ **Script**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `deleteScript` | (`scriptId`: `string`) => `Promise`<`any`\> |
| `exportScript` | (`scriptId`: `string`) => `Promise`<[`ScriptExportInterface`](interfaces/Reference.ScriptExportInterface.md)\> |
| `exportScriptByName` | (`scriptName`: `string`) => `Promise`<[`ScriptExportInterface`](interfaces/Reference.ScriptExportInterface.md)\> |
| `exportScripts` | () => `Promise`<[`ScriptExportInterface`](interfaces/Reference.ScriptExportInterface.md)\> |
| `getScript` | (`scriptId`: `string`) => `Promise`<`any`\> |
| `getScriptByName` | (`scriptName`: `string`) => `Promise`<[`ScriptSkeleton`](modules/Reference.md#scriptskeleton)\> |
| `getScripts` | () => `Promise`<[`ScriptSkeleton`](modules/Reference.md#scriptskeleton)[]\> |
| `importScripts` | (`scriptName`: `string`, `importData`: [`ScriptExportInterface`](interfaces/Reference.ScriptExportInterface.md), `reUuid?`: `boolean`, `validate?`: `boolean`) => `Promise`<`boolean`\> |
| `putScript` | (`scriptId`: `string`, `scriptData`: [`ScriptSkeleton`](modules/Reference.md#scriptskeleton)) => `Promise`<`boolean`\> |

#### Defined in

[ops/ScriptOps.ts:27](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/ScriptOps.ts#L27)

___

### Secret

Ƭ **Secret**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `createNewVersionOfSecret` | (`secretId`: `string`, `value`: `string`) => `Promise`<`any`\> |
| `deleteSecret` | (`secretId`: `string`) => `Promise`<`any`\> |
| `deleteVersionOfSecret` | (`secretId`: `string`, `version`: `string`) => `Promise`<`any`\> |
| `getSecret` | (`secretId`: `string`) => `Promise`<`any`\> |
| `getSecretVersions` | (`secretId`: `string`) => `Promise`<`any`\> |
| `getSecrets` | () => `Promise`<`any`\> |
| `getVersionOfSecret` | (`secretId`: `string`, `version`: `string`) => `Promise`<`any`\> |
| `putSecret` | (`secretId`: `string`, `value`: `string`, `description`: `string`, `encoding?`: `string`, `useInPlaceholders?`: `boolean`) => `Promise`<`any`\> |
| `setSecretDescription` | (`secretId`: `string`, `description`: `string`) => `Promise`<`any`\> |
| `setStatusOfVersionOfSecret` | (`secretId`: `string`, `version`: `string`, `status`: [`VersionOfSecretStatus`](modules/Reference.md#versionofsecretstatus)) => `Promise`<`any`\> |

#### Defined in

[ops/cloud/SecretsOps.ts:16](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/cloud/SecretsOps.ts#L16)

___

### Service

Ƭ **Service**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `createServiceExportTemplate` | () => [`ServiceExportInterface`](interfaces/Reference.ServiceExportInterface.md) |
| `deleteFullService` | (`serviceId`: `string`, `globalConfig?`: `boolean`) => `Promise`<`void`\> |
| `deleteFullServices` | (`globalConfig?`: `boolean`) => `Promise`<`void`\> |
| `exportService` | (`serviceId`: `string`, `globalConfig?`: `boolean`) => `Promise`<[`ServiceExportInterface`](interfaces/Reference.ServiceExportInterface.md)\> |
| `exportServices` | (`globalConfig?`: `boolean`) => `Promise`<[`ServiceExportInterface`](interfaces/Reference.ServiceExportInterface.md)\> |
| `getFullServices` | (`globalConfig?`: `boolean`) => `Promise`<[`FullService`](interfaces/Reference.FullService.md)[]\> |
| `getListOfServices` | (`globalConfig?`: `boolean`) => `Promise`<[`ServiceListItem`](interfaces/Reference.ServiceListItem.md)[]\> |
| `importService` | (`serviceId`: `string`, `importData`: [`ServiceExportInterface`](interfaces/Reference.ServiceExportInterface.md), `clean`: `boolean`, `globalConfig?`: `boolean`) => `Promise`<[`AmServiceSkeleton`](modules/Reference.md#amserviceskeleton)\> |
| `importServices` | (`importData`: [`ServiceExportInterface`](interfaces/Reference.ServiceExportInterface.md), `clean`: `boolean`, `globalConfig?`: `boolean`) => `Promise`<[`AmServiceSkeleton`](modules/Reference.md#amserviceskeleton)[]\> |

#### Defined in

[ops/ServiceOps.ts:15](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/ServiceOps.ts#L15)

___

### ServiceAccount

Ƭ **ServiceAccount**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `createServiceAccount` | (`name`: `string`, `description`: `string`, `accountStatus`: ``"Active"`` \| ``"Inactive"``, `scopes`: `string`[], `jwks`: [`JwksInterface`](interfaces/Reference.JwksInterface.md)) => `Promise`<[`IdObjectSkeletonInterface`](interfaces/Reference.IdObjectSkeletonInterface.md)\> |
| `getServiceAccount` | (`serviceAccountId`: `string`) => `Promise`<[`ServiceAccountType`](modules/Reference.md#serviceaccounttype)\> |
| `isServiceAccountsFeatureAvailable` | () => `Promise`<`boolean`\> |

#### Defined in

[ops/cloud/ServiceAccountOps.ts:12](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/cloud/ServiceAccountOps.ts#L12)

___

### Startup

Ƭ **Startup**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `applyUpdates` | (`wait`: `boolean`, `timeout?`: `number`) => `Promise`<`boolean`\> |
| `checkForUpdates` | () => `Promise`<[`Updates`](interfaces/Reference.Updates.md)\> |

#### Defined in

[ops/cloud/StartupOps.ts:15](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/cloud/StartupOps.ts#L15)

___

### State

Ƭ **State**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `getAllowInsecureConnection` | () => `boolean` |
| `getAmVersion` | () => `string` |
| `getAuthenticationHeaderOverrides` | () => `Record`<`string`, `string`\> |
| `getAuthenticationService` | () => `string` |
| `getBearerToken` | () => `string` |
| `getConnectionProfilesPath` | () => `string` |
| `getCookieName` | () => `string` |
| `getCookieValue` | () => `string` |
| `getCreateProgressHandler` | () => (`type`: `string`, `total?`: `number`, `message?`: `string`) => `void` |
| `getCurlirize` | () => `boolean` |
| `getCurlirizeHandler` | () => (`message`: `string`) => `void` |
| `getDebug` | () => `boolean` |
| `getDebugHandler` | () => (`message`: `string` \| `object`) => `void` |
| `getDeploymentType` | () => `string` |
| `getDirectory` | () => `string` |
| `getFeatures` | () => [`FeatureInterface`](interfaces/Reference.FeatureInterface.md)[] |
| `getFrodoVersion` | () => `string` |
| `getHost` | () => `string` |
| `getLogApiKey` | () => `string` |
| `getLogApiSecret` | () => `string` |
| `getMasterKeyPath` | () => `string` |
| `getOutputFile` | () => `string` |
| `getPassword` | () => `string` |
| `getPrintHandler` | () => (`message`: `string` \| `object`, `type?`: `string`, `newline?`: `boolean`) => `void` |
| `getRealm` | () => `string` |
| `getServiceAccountId` | () => `string` |
| `getServiceAccountJwk` | () => [`JwkRsa`](modules/Reference.md#jwkrsa) |
| `getStopProgressHandler` | () => (`message`: `string`, `status?`: `string`) => `void` |
| `getTenant` | () => `string` |
| `getUpdateProgressHandler` | () => (`message`: `string`) => `void` |
| `getUseBearerTokenForAmApis` | () => `boolean` |
| `getUsername` | () => `string` |
| `getVerbose` | () => `boolean` |
| `getVerboseHandler` | () => (`message`: `string` \| `object`) => `void` |
| `setAllowInsecureConnection` | (`allowInsecureConnection`: `boolean`) => `void` |
| `setAmVersion` | (`version`: `string`) => `void` |
| `setAuthenticationHeaderOverrides` | (`overrides`: `Record`<`string`, `string`\>) => `void` |
| `setAuthenticationService` | (`service`: `string`) => `void` |
| `setBearerToken` | (`token`: `string`) => `void` |
| `setConnectionProfilesPath` | (`path`: `string`) => `void` |
| `setCookieName` | (`name`: `string`) => `void` |
| `setCookieValue` | (`value`: `string`) => `void` |
| `setCreateProgressHandler` | (`handler`: (`type`: `string`, `total?`: `number`, `message?`: `string`) => `void`) => `void` |
| `setCurlirize` | (`curlirize`: `boolean`) => `void` |
| `setCurlirizeHandler` | (`handler`: (`message`: `string`) => `void`) => `void` |
| `setDebug` | (`debug`: `boolean`) => `void` |
| `setDebugHandler` | (`handler`: (`message`: `string` \| `object`) => `void`) => `void` |
| `setDeploymentType` | (`type`: `string`) => `void` |
| `setDirectory` | (`directory`: `string`) => `void` |
| `setFeatures` | (`features`: [`FeatureInterface`](interfaces/Reference.FeatureInterface.md)[]) => `void` |
| `setFrodoVersion` | (`version`: `string`) => `void` |
| `setHost` | (`host`: `string`) => `void` |
| `setLogApiKey` | (`key`: `string`) => `void` |
| `setLogApiSecret` | (`secret`: `string`) => `void` |
| `setMasterKeyPath` | (`path`: `string`) => `void` |
| `setOutputFile` | (`file`: `string`) => `void` |
| `setPassword` | (`password`: `string`) => `void` |
| `setPrintHandler` | (`handler`: (`message`: `string` \| `object`, `type?`: `string`, `newline?`: `boolean`) => `void`) => `void` |
| `setRealm` | (`realm`: `string`) => `void` |
| `setServiceAccountId` | (`uuid`: `string`) => `void` |
| `setServiceAccountJwk` | (`jwk`: [`JwkRsa`](modules/Reference.md#jwkrsa)) => `void` |
| `setStopProgressHandler` | (`handler`: (`message`: `string`, `status?`: `string`) => `void`) => `void` |
| `setTenant` | (`tenant`: `string`) => `void` |
| `setUpdateProgressHandler` | (`handler`: (`message`: `string`) => `void`) => `void` |
| `setUseBearerTokenForAmApis` | (`useBearerTokenForAmApis`: `boolean`) => `void` |
| `setUsername` | (`username`: `string`) => `void` |
| `setVerbose` | (`verbose`: `boolean`) => `void` |
| `setVerboseHandler` | (`handler`: (`message`: `string` \| `object`) => `void`) => `void` |

#### Defined in

[shared/State.ts:13](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L13)

___

### Theme

Ƭ **Theme**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `deleteTheme` | (`themeId`: `string`, `realm?`: `string`) => `Promise`<[`ThemeSkeleton`](modules/Reference.md#themeskeleton)\> |
| `deleteThemeByName` | (`themeName`: `string`, `realm?`: `string`) => `Promise`<[`ThemeSkeleton`](modules/Reference.md#themeskeleton)\> |
| `deleteThemes` | (`realm?`: `string`) => `Promise`<[`ThemeSkeleton`](modules/Reference.md#themeskeleton)[]\> |
| `getTheme` | (`themeId`: `string`, `realm?`: `string`) => `Promise`<[`ThemeSkeleton`](modules/Reference.md#themeskeleton)\> |
| `getThemeByName` | (`themeName`: `string`, `realm?`: `string`) => `Promise`<[`ThemeSkeleton`](modules/Reference.md#themeskeleton)\> |
| `getThemes` | () => `Promise`<[`ThemeSkeleton`](modules/Reference.md#themeskeleton)[]\> |
| `putTheme` | (`themeId`: `string`, `themeData`: [`ThemeSkeleton`](modules/Reference.md#themeskeleton), `realm?`: `string`) => `Promise`<[`ThemeSkeleton`](modules/Reference.md#themeskeleton)\> |
| `putThemeByName` | (`themeName`: `string`, `themeData`: [`ThemeSkeleton`](modules/Reference.md#themeskeleton), `realm?`: `string`) => `Promise`<[`ThemeSkeleton`](modules/Reference.md#themeskeleton)\> |
| `putThemes` | (`themeMap`: `Map`<`string`, [`ThemeSkeleton`](modules/Reference.md#themeskeleton)\>) => `Promise`<`Map`<`string`, [`ThemeSkeleton`](modules/Reference.md#themeskeleton)\>\> |

#### Defined in

[ops/ThemeOps.ts:9](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/ThemeOps.ts#L9)

___

### Variable

Ƭ **Variable**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `deleteVariable` | (`variableId`: `string`) => `Promise`<`any`\> |
| `getVariable` | (`variableId`: `string`) => `Promise`<`any`\> |
| `getVariables` | () => `Promise`<`any`\> |
| `putVariable` | (`variableId`: `string`, `value`: `string`, `description`: `string`) => `Promise`<`any`\> |
| `setVariableDescription` | (`variableId`: `string`, `description`: `string`) => `Promise`<`any`\> |

#### Defined in

[ops/cloud/VariablesOps.ts:10](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/cloud/VariablesOps.ts#L10)

___

### Version

Ƭ **Version**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `getAllVersions` | (`endpoints`: { `base`: `string` ; `path`: `string`  }[]) => `Promise`<`PromiseSettledResult`<`any`\>[]\> |
| `getVersion` | () => `string` |

#### Defined in

[ops/utils/VersionUtils.ts:8](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/utils/VersionUtils.ts#L8)

## Variables

### frodo

• `Const` **frodo**: [`Frodo`](modules.md#frodo)

Default FrodoLib instance

#### Defined in

[lib/Frodo.ts:7](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/lib/Frodo.ts#L7)

___

### state

• `Const` **state**: [`State`](modules.md#state) = `frodo.state`

Default State instance

#### Defined in

[lib/Frodo.ts:12](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/lib/Frodo.ts#L12)

## Functions

### FrodoLib

▸ **FrodoLib**(`config?`): [`Frodo`](modules.md#frodo)

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | [`StateInterface`](interfaces/Reference.StateInterface.md) |

#### Returns

[`Frodo`](modules.md#frodo)

#### Defined in

[lib/FrodoLib.ts:122](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/lib/FrodoLib.ts#L122)

___

### createInstanceWithAdminAccount

▸ **createInstanceWithAdminAccount**(`host`, `username`, `password`, `realm?`, `deploymentType?`, `allowInsecureConnection?`, `debug?`, `curlirize?`): [`Frodo`](modules.md#frodo)

Factory helper to create a frodo instance ready for logging in with an admin user account

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `host` | `string` | `undefined` | host base URL, e.g. 'https://openam-my-tenant.forgeblocks.com/am' |
| `username` | `string` | `undefined` | admin account username |
| `password` | `string` | `undefined` | admin account password |
| `realm` | `string` | `undefined` | (optional) override default realm |
| `deploymentType` | `string` | `undefined` | (optional) override deployment type ('cloud', 'forgeops', or 'classic') |
| `allowInsecureConnection` | `boolean` | `false` | (optional) allow insecure connection |
| `debug` | `boolean` | `false` | (optional) enable debug output |
| `curlirize` | `boolean` | `false` | (optional) enable output of all library REST calls as curl commands |

#### Returns

[`Frodo`](modules.md#frodo)

FrodoLib instance

#### Defined in

[lib/Frodo.ts:62](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/lib/Frodo.ts#L62)

___

### createInstanceWithServiceAccount

▸ **createInstanceWithServiceAccount**(`host`, `serviceAccountId`, `serviceAccountJwkStr`, `realm?`, `deploymentType?`, `allowInsecureConnection?`, `debug?`, `curlirize?`): [`Frodo`](modules.md#frodo)

Factory helper to create a frodo instance ready for logging in with a service account

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `host` | `string` | `undefined` | host base URL, e.g. 'https://openam-my-tenant.forgeblocks.com/am' |
| `serviceAccountId` | `string` | `undefined` | service account uuid |
| `serviceAccountJwkStr` | `string` | `undefined` | service account JWK as stringified JSON |
| `realm` | `string` | `undefined` | (optional) override default realm |
| `deploymentType` | `string` | `undefined` | (optional) override deployment type ('cloud', 'forgeops', or 'classic') |
| `allowInsecureConnection` | `boolean` | `false` | (optional) allow insecure connection |
| `debug` | `boolean` | `false` | (optional) enable debug output |
| `curlirize` | `boolean` | `false` | (optional) enable output of all library REST calls as curl commands |

#### Returns

[`Frodo`](modules.md#frodo)

FrodoLib instance

#### Defined in

[lib/Frodo.ts:26](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/lib/Frodo.ts#L26)
