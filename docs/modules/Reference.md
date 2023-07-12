[Frodo Library - v2.0.0-13](../README.md) / [Exports](../modules.md) / Reference

# Module: Reference

## Table of contents

### Interfaces

- [AdminFederationExportInterface](../interfaces/Reference.AdminFederationExportInterface.md)
- [AgentExportInterface](../interfaces/Reference.AgentExportInterface.md)
- [CirclesOfTrustExportInterface](../interfaces/Reference.CirclesOfTrustExportInterface.md)
- [ConnectionProfileInterface](../interfaces/Reference.ConnectionProfileInterface.md)
- [ConnectionsFileInterface](../interfaces/Reference.ConnectionsFileInterface.md)
- [ConnectorServerStatusInterface](../interfaces/Reference.ConnectorServerStatusInterface.md)
- [EnvInfoInterface](../interfaces/Reference.EnvInfoInterface.md)
- [ExportMetaData](../interfaces/Reference.ExportMetaData.md)
- [FeatureInterface](../interfaces/Reference.FeatureInterface.md)
- [FullService](../interfaces/Reference.FullService.md)
- [IdObjectSkeletonInterface](../interfaces/Reference.IdObjectSkeletonInterface.md)
- [InnerNodeRefSkeletonInterface](../interfaces/Reference.InnerNodeRefSkeletonInterface.md)
- [JwkInterface](../interfaces/Reference.JwkInterface.md)
- [JwksInterface](../interfaces/Reference.JwksInterface.md)
- [MultiOpStatusInterface](../interfaces/Reference.MultiOpStatusInterface.md)
- [MultiTreeExportInterface](../interfaces/Reference.MultiTreeExportInterface.md)
- [NoIdObjectSkeletonInterface](../interfaces/Reference.NoIdObjectSkeletonInterface.md)
- [NodeRefSkeletonInterface](../interfaces/Reference.NodeRefSkeletonInterface.md)
- [OAuth2ClientExportInterface](../interfaces/Reference.OAuth2ClientExportInterface.md)
- [OAuth2ClientExportOptions](../interfaces/Reference.OAuth2ClientExportOptions.md)
- [OAuth2ClientImportOptions](../interfaces/Reference.OAuth2ClientImportOptions.md)
- [PlatformInfoInterface](../interfaces/Reference.PlatformInfoInterface.md)
- [PolicyExportInterface](../interfaces/Reference.PolicyExportInterface.md)
- [PolicyExportOptions](../interfaces/Reference.PolicyExportOptions.md)
- [PolicyImportOptions](../interfaces/Reference.PolicyImportOptions.md)
- [PolicySetExportInterface](../interfaces/Reference.PolicySetExportInterface.md)
- [PolicySetExportOptions](../interfaces/Reference.PolicySetExportOptions.md)
- [PolicySetImportOptions](../interfaces/Reference.PolicySetImportOptions.md)
- [ResourceTypeExportInterface](../interfaces/Reference.ResourceTypeExportInterface.md)
- [Saml2ExportInterface](../interfaces/Reference.Saml2ExportInterface.md)
- [ScriptExportInterface](../interfaces/Reference.ScriptExportInterface.md)
- [ScriptHook](../interfaces/Reference.ScriptHook.md)
- [SecureConnectionProfileInterface](../interfaces/Reference.SecureConnectionProfileInterface.md)
- [ServiceAccountPayloadInterface](../interfaces/Reference.ServiceAccountPayloadInterface.md)
- [ServiceExportInterface](../interfaces/Reference.ServiceExportInterface.md)
- [ServiceListItem](../interfaces/Reference.ServiceListItem.md)
- [ServiceNextDescendent](../interfaces/Reference.ServiceNextDescendent.md)
- [SingleTreeExportInterface](../interfaces/Reference.SingleTreeExportInterface.md)
- [SocialProviderExportInterface](../interfaces/Reference.SocialProviderExportInterface.md)
- [StateInterface](../interfaces/Reference.StateInterface.md)
- [TreeDependencyMapInterface](../interfaces/Reference.TreeDependencyMapInterface.md)
- [TreeExportOptions](../interfaces/Reference.TreeExportOptions.md)
- [TreeExportResolverInterface](../interfaces/Reference.TreeExportResolverInterface.md)
- [TreeImportOptions](../interfaces/Reference.TreeImportOptions.md)
- [UiConfigInterface](../interfaces/Reference.UiConfigInterface.md)
- [Updates](../interfaces/Reference.Updates.md)

### Type Aliases

- [AdminFederationConfigSkeleton](Reference.md#adminfederationconfigskeleton)
- [AgentSkeleton](Reference.md#agentskeleton)
- [AgentType](Reference.md#agenttype)
- [AmServiceSkeleton](Reference.md#amserviceskeleton)
- [AmServiceType](Reference.md#amservicetype)
- [CircleOfTrustSkeleton](Reference.md#circleoftrustskeleton)
- [DeleteJourneyStatus](Reference.md#deletejourneystatus)
- [DeleteJourneysStatus](Reference.md#deletejourneysstatus)
- [EmailTemplateSkeleton](Reference.md#emailtemplateskeleton)
- [GatewayAgentType](Reference.md#gatewayagenttype)
- [JavaAgentType](Reference.md#javaagenttype)
- [Jose](Reference.md#jose)
- [JourneyClassificationType](Reference.md#journeyclassificationtype)
- [JwkRsa](Reference.md#jwkrsa)
- [JwkRsaPublic](Reference.md#jwkrsapublic)
- [LogApiKey](Reference.md#logapikey)
- [LogEventPayloadSkeleton](Reference.md#logeventpayloadskeleton)
- [LogEventSkeleton](Reference.md#logeventskeleton)
- [NodeClassificationType](Reference.md#nodeclassificationtype)
- [NodeSkeleton](Reference.md#nodeskeleton)
- [OAuth2ClientSkeleton](Reference.md#oauth2clientskeleton)
- [PagedResult](Reference.md#pagedresult)
- [PlatformInfo](Reference.md#platforminfo)
- [PolicyCondition](Reference.md#policycondition)
- [PolicyConditionType](Reference.md#policyconditiontype)
- [PolicySetSkeleton](Reference.md#policysetskeleton)
- [PolicySkeleton](Reference.md#policyskeleton)
- [ReadableStrings](Reference.md#readablestrings)
- [ResourceTypeSkeleton](Reference.md#resourcetypeskeleton)
- [Saml2ProiderLocation](Reference.md#saml2proiderlocation)
- [Saml2ProviderSkeleton](Reference.md#saml2providerskeleton)
- [Saml2ProviderStub](Reference.md#saml2providerstub)
- [ScriptContext](Reference.md#scriptcontext)
- [ScriptLanguage](Reference.md#scriptlanguage)
- [ScriptSkeleton](Reference.md#scriptskeleton)
- [ScriptValidation](Reference.md#scriptvalidation)
- [ServiceAccountType](Reference.md#serviceaccounttype)
- [SocialIdpSkeleton](Reference.md#socialidpskeleton)
- [ThemeSkeleton](Reference.md#themeskeleton)
- [TreeSkeleton](Reference.md#treeskeleton)
- [Utils](Reference.md#utils)
- [VersionOfSecretStatus](Reference.md#versionofsecretstatus)
- [WebAgentType](Reference.md#webagenttype)
- [WritableStrings](Reference.md#writablestrings)

## Type Aliases

### AdminFederationConfigSkeleton

Ƭ **AdminFederationConfigSkeleton**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & { `groups`: { `claim`: `string` ; `mappings`: { `super-admins`: `string`[] ; `tenant-admins`: `string`[]  }  }  }

#### Defined in

[api/ApiTypes.ts:31](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L31)

___

### AgentSkeleton

Ƭ **AgentSkeleton**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & { `_type`: [`AmServiceType`](Reference.md#amservicetype)  }

#### Defined in

[api/ApiTypes.ts:198](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L198)

___

### AgentType

Ƭ **AgentType**: [`GatewayAgentType`](Reference.md#gatewayagenttype) \| [`JavaAgentType`](Reference.md#javaagenttype) \| [`WebAgentType`](Reference.md#webagenttype)

#### Defined in

[api/ApiTypes.ts:196](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L196)

___

### AmServiceSkeleton

Ƭ **AmServiceSkeleton**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & { `[key: string]`: `any`; `_type`: [`AmServiceType`](Reference.md#amservicetype)  }

#### Defined in

[api/ApiTypes.ts:174](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L174)

___

### AmServiceType

Ƭ **AmServiceType**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & { `name`: `string`  }

#### Defined in

[api/ApiTypes.ts:63](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L63)

___

### CircleOfTrustSkeleton

Ƭ **CircleOfTrustSkeleton**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & { `_type`: [`AmServiceType`](Reference.md#amservicetype) ; `status`: `string` ; `trustedProviders`: `string`[]  }

#### Defined in

[api/ApiTypes.ts:271](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L271)

___

### DeleteJourneyStatus

Ƭ **DeleteJourneyStatus**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `nodes` | { `status?`: `string`  } |
| `nodes.status?` | `string` |
| `status` | `string` |

#### Defined in

[ops/JourneyOps.ts:2387](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/JourneyOps.ts#L2387)

___

### DeleteJourneysStatus

Ƭ **DeleteJourneysStatus**: `Object`

#### Index signature

▪ [k: `string`]: [`DeleteJourneyStatus`](Reference.md#deletejourneystatus)

#### Defined in

[ops/JourneyOps.ts:2605](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/JourneyOps.ts#L2605)

___

### EmailTemplateSkeleton

Ƭ **EmailTemplateSkeleton**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & { `defaultLocale?`: `string` ; `displayName?`: `string` ; `enabled?`: `boolean` ; `from`: `string` ; `html?`: `Record`<`string`, `string`\> ; `message?`: `Record`<`string`, `string`\> ; `subject`: `Record`<`string`, `string`\>  }

#### Defined in

[api/ApiTypes.ts:202](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L202)

___

### GatewayAgentType

Ƭ **GatewayAgentType**: ``"IdentityGatewayAgent"``

#### Defined in

[api/ApiTypes.ts:193](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L193)

___

### JavaAgentType

Ƭ **JavaAgentType**: ``"J2EEAgent"``

#### Defined in

[api/ApiTypes.ts:194](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L194)

___

### Jose

Ƭ **Jose**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `createJwkRsa` | () => `Promise`<[`JwkRsa`](Reference.md#jwkrsa)\> |
| `createJwks` | (...`keys`: [`JwkInterface`](../interfaces/Reference.JwkInterface.md)[]) => [`JwksInterface`](../interfaces/Reference.JwksInterface.md) |
| `createSignedJwtToken` | (`payload`: `string` \| `object`, `jwkJson`: [`JwkRsa`](Reference.md#jwkrsa)) => `Promise`<`any`\> |
| `getJwkRsaPublic` | (`jwkJson`: [`JwkRsa`](Reference.md#jwkrsa)) => `Promise`<[`JwkRsaPublic`](Reference.md#jwkrsapublic)\> |
| `verifySignedJwtToken` | (`jwt`: `string`, `jwkJson`: [`JwkRsaPublic`](Reference.md#jwkrsapublic)) => `Promise`<`any`\> |

#### Defined in

[ops/JoseOps.ts:4](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/JoseOps.ts#L4)

___

### JourneyClassificationType

Ƭ **JourneyClassificationType**: ``"standard"`` \| ``"custom"`` \| ``"cloud"`` \| ``"premium"``

#### Defined in

[ops/OpsTypes.ts:121](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/OpsTypes.ts#L121)

___

### JwkRsa

Ƭ **JwkRsa**: [`JwkInterface`](../interfaces/Reference.JwkInterface.md) & { `d`: `string` ; `dp`: `string` ; `dq`: `string` ; `e`: `string` ; `n`: `string` ; `p`: `string` ; `q`: `string` ; `qi`: `string`  }

#### Defined in

[ops/JoseOps.ts:49](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/JoseOps.ts#L49)

___

### JwkRsaPublic

Ƭ **JwkRsaPublic**: [`JwkInterface`](../interfaces/Reference.JwkInterface.md) & { `e`: `string` ; `n`: `string`  }

#### Defined in

[ops/JoseOps.ts:60](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/JoseOps.ts#L60)

___

### LogApiKey

Ƭ **LogApiKey**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `api_key_id` | `string` |
| `api_key_secret?` | `string` |
| `created_at` | `string` |
| `name` | `string` |

#### Defined in

[api/ApiTypes.ts:286](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L286)

___

### LogEventPayloadSkeleton

Ƭ **LogEventPayloadSkeleton**: [`NoIdObjectSkeletonInterface`](../interfaces/Reference.NoIdObjectSkeletonInterface.md) & { `context`: `string` ; `level`: `string` ; `logger`: `string` ; `mdc`: { `transactionId`: `string`  } ; `message`: `string` ; `thread`: `string` ; `timestamp`: `string` ; `transactionId`: `string`  }

#### Defined in

[api/ApiTypes.ts:293](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L293)

___

### LogEventSkeleton

Ƭ **LogEventSkeleton**: [`NoIdObjectSkeletonInterface`](../interfaces/Reference.NoIdObjectSkeletonInterface.md) & { `payload`: `string` \| [`LogEventPayloadSkeleton`](Reference.md#logeventpayloadskeleton) ; `source`: `string` ; `timestamp`: `string` ; `type`: `string`  }

#### Defined in

[api/ApiTypes.ts:306](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L306)

___

### NodeClassificationType

Ƭ **NodeClassificationType**: ``"standard"`` \| ``"custom"`` \| ``"cloud"`` \| ``"premium"``

#### Defined in

[ops/OpsTypes.ts:115](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/OpsTypes.ts#L115)

___

### NodeSkeleton

Ƭ **NodeSkeleton**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & { `_type`: [`AmServiceType`](Reference.md#amservicetype) ; `identityResource?`: `string` ; `nodes?`: [`InnerNodeRefSkeletonInterface`](../interfaces/Reference.InnerNodeRefSkeletonInterface.md)[] ; `tree?`: `string`  }

#### Defined in

[api/ApiTypes.ts:67](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L67)

___

### OAuth2ClientSkeleton

Ƭ **OAuth2ClientSkeleton**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & { `_type`: [`AmServiceType`](Reference.md#amservicetype) ; `advancedOAuth2ClientConfig?`: { `[k: string]`: `string` \| `number` \| `boolean` \| `string`[] \| `object` \| `undefined`; `descriptions`: { `inherited`: `boolean` ; `value`: `string`[]  } ; `grantTypes?`: [`ReadableStrings`](Reference.md#readablestrings) \| [`WritableStrings`](Reference.md#writablestrings)  } ; `coreOAuth2ClientConfig?`: { `[k: string]`: `string` \| `number` \| `boolean` \| `string`[] \| `object` \| `undefined`; `accessTokenLifetime?`: { `inherited`: `boolean` ; `value`: `number`  } ; `clientName?`: { `inherited`: `boolean` ; `value`: `string`[]  } ; `defaultScopes?`: { `[k: string]`: `string` \| `number` \| `boolean` \| `string`[] \| `object` \| `undefined`; `value`: `string`[]  } ; `scopes?`: [`ReadableStrings`](Reference.md#readablestrings) \| [`WritableStrings`](Reference.md#writablestrings) ; `userpassword?`: `string`  } ; `coreOpenIDClientConfig?`: { `[k: string]`: `string` \| `number` \| `boolean` \| `string`[] \| `object` \| `undefined`;  } ; `coreUmaClientConfig?`: { `[k: string]`: `string` \| `number` \| `boolean` \| `string`[] \| `object` \| `undefined`;  } ; `overrideOAuth2ClientConfig?`: { `[k: string]`: `string` \| `number` \| `boolean` \| `string`[] \| `object` \| `undefined`;  } ; `signEncOAuth2ClientConfig?`: { `[k: string]`: `string` \| `number` \| `boolean` \| `string`[] \| `object` \| `undefined`;  }  }

#### Defined in

[api/ApiTypes.ts:133](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L133)

___

### PagedResult

Ƭ **PagedResult**<`Result`\>: `Object`

#### Type parameters

| Name |
| :------ |
| `Result` |

#### Type declaration

| Name | Type |
| :------ | :------ |
| `pagedResultsCookie` | `string` |
| `remainingPagedResults` | `number` |
| `result` | `Result`[] |
| `resultCount` | `number` |
| `totalPagedResults` | `number` |
| `totalPagedResultsPolicy` | ``"EXACT"`` |

#### Defined in

[api/ApiTypes.ts:277](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L277)

___

### PlatformInfo

Ƭ **PlatformInfo**: [`PlatformInfoInterface`](../interfaces/Reference.PlatformInfoInterface.md) & `Partial`<[`EnvInfoInterface`](../interfaces/Reference.EnvInfoInterface.md)\>

#### Defined in

[ops/InfoOps.ts:37](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/InfoOps.ts#L37)

___

### PolicyCondition

Ƭ **PolicyCondition**: [`NoIdObjectSkeletonInterface`](../interfaces/Reference.NoIdObjectSkeletonInterface.md) & { `condition?`: [`PolicyCondition`](Reference.md#policycondition) ; `conditions?`: [`PolicyCondition`](Reference.md#policycondition)[] ; `type`: [`PolicyConditionType`](Reference.md#policyconditiontype)  }

#### Defined in

[api/ApiTypes.ts:111](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L111)

___

### PolicyConditionType

Ƭ **PolicyConditionType**: ``"Script"`` \| ``"AMIdentityMembership"`` \| ``"IPv6"`` \| ``"IPv4"`` \| ``"SimpleTime"`` \| ``"LEAuthLevel"`` \| ``"LDAPFilter"`` \| ``"AuthScheme"`` \| ``"Session"`` \| ``"AND"`` \| ``"AuthenticateToRealm"`` \| ``"ResourceEnvIP"`` \| ``"Policy"`` \| ``"OAuth2Scope"`` \| ``"SessionProperty"`` \| ``"OR"`` \| ``"Transaction"`` \| ``"NOT"`` \| ``"AuthLevel"`` \| ``"AuthenticateToService"``

#### Defined in

[api/ApiTypes.ts:89](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L89)

___

### PolicySetSkeleton

Ƭ **PolicySetSkeleton**: [`NoIdObjectSkeletonInterface`](../interfaces/Reference.NoIdObjectSkeletonInterface.md) & { `name`: `string` ; `resourceTypeUuids`: `string`[]  }

#### Defined in

[api/ApiTypes.ts:79](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L79)

___

### PolicySkeleton

Ƭ **PolicySkeleton**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & { `applicationName`: `string` ; `condition?`: [`PolicyCondition`](Reference.md#policycondition) ; `name`: `string` ; `resourceTypeUuid`: `string`  }

#### Defined in

[api/ApiTypes.ts:117](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L117)

___

### ReadableStrings

Ƭ **ReadableStrings**: `string`[]

#### Defined in

[api/ApiTypes.ts:126](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L126)

___

### ResourceTypeSkeleton

Ƭ **ResourceTypeSkeleton**: [`NoIdObjectSkeletonInterface`](../interfaces/Reference.NoIdObjectSkeletonInterface.md) & { `name`: `string` ; `uuid`: `string`  }

#### Defined in

[api/ApiTypes.ts:84](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L84)

___

### Saml2ProiderLocation

Ƭ **Saml2ProiderLocation**: ``"hosted"`` \| ``"remote"``

#### Defined in

[api/ApiTypes.ts:254](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L254)

___

### Saml2ProviderSkeleton

Ƭ **Saml2ProviderSkeleton**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & { `attributeQueryProvider`: `unknown` ; `entityId`: `string` ; `entityLocation`: [`Saml2ProiderLocation`](Reference.md#saml2proiderlocation) ; `identityProvider`: `unknown` ; `serviceProvider`: `unknown` ; `xacmlPolicyEnforcementPoint`: `unknown`  }

#### Defined in

[api/ApiTypes.ts:262](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L262)

___

### Saml2ProviderStub

Ƭ **Saml2ProviderStub**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & { `entityId`: `string` ; `location`: [`Saml2ProiderLocation`](Reference.md#saml2proiderlocation) ; `roles`: `string`[]  }

#### Defined in

[api/ApiTypes.ts:256](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L256)

___

### ScriptContext

Ƭ **ScriptContext**: ``"OAUTH2_ACCESS_TOKEN_MODIFICATION"`` \| ``"AUTHENTICATION_CLIENT_SIDE"`` \| ``"AUTHENTICATION_TREE_DECISION_NODE"`` \| ``"AUTHENTICATION_SERVER_SIDE"`` \| ``"SOCIAL_IDP_PROFILE_TRANSFORMATION"`` \| ``"OAUTH2_VALIDATE_SCOPE"`` \| ``"CONFIG_PROVIDER_NODE"`` \| ``"OAUTH2_AUTHORIZE_ENDPOINT_DATA_PROVIDER"`` \| ``"OAUTH2_EVALUATE_SCOPE"`` \| ``"POLICY_CONDITION"`` \| ``"OIDC_CLAIMS"`` \| ``"SAML2_IDP_ADAPTER"`` \| ``"SAML2_IDP_ATTRIBUTE_MAPPER"`` \| ``"OAUTH2_MAY_ACT"``

#### Defined in

[api/ApiTypes.ts:225](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L225)

___

### ScriptLanguage

Ƭ **ScriptLanguage**: ``"GROOVY"`` \| ``"JAVASCRIPT"``

#### Defined in

[api/ApiTypes.ts:223](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L223)

___

### ScriptSkeleton

Ƭ **ScriptSkeleton**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & { `context`: [`ScriptContext`](Reference.md#scriptcontext) ; `createdBy`: `string` ; `creationDate`: `number` ; `default`: `boolean` ; `description`: `string` ; `language`: [`ScriptLanguage`](Reference.md#scriptlanguage) ; `lastModifiedBy`: `string` ; `lastModifiedDate`: `number` ; `name`: `string` ; `script`: `string` \| `string`[]  }

#### Defined in

[api/ApiTypes.ts:241](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L241)

___

### ScriptValidation

Ƭ **ScriptValidation**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `findAllScriptHooks` | (`jsonData`: `object`, `scriptHooksArray?`: [`ScriptHook`](../interfaces/Reference.ScriptHook.md)[]) => [`ScriptHook`](../interfaces/Reference.ScriptHook.md)[] |
| `isValidJs` | (`javascriptSource`: `string`) => `boolean` |
| `validateScript` | (`script`: [`ScriptSkeleton`](Reference.md#scriptskeleton)) => `boolean` |
| `validateScriptDecoded` | (`scriptSkeleton`: [`ScriptSkeleton`](Reference.md#scriptskeleton)) => `boolean` |
| `validateScriptHooks` | (`jsonData`: `object`) => `boolean` |

#### Defined in

[ops/utils/ScriptValidationUtils.ts:7](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/utils/ScriptValidationUtils.ts#L7)

___

### ServiceAccountType

Ƭ **ServiceAccountType**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & [`ServiceAccountPayloadInterface`](../interfaces/Reference.ServiceAccountPayloadInterface.md)

#### Defined in

[ops/cloud/ServiceAccountOps.ts:99](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/cloud/ServiceAccountOps.ts#L99)

___

### SocialIdpSkeleton

Ƭ **SocialIdpSkeleton**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & { `_type`: [`AmServiceType`](Reference.md#amservicetype) ; `enabled`: `boolean`  }

#### Defined in

[api/ApiTypes.ts:74](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L74)

___

### ThemeSkeleton

Ƭ **ThemeSkeleton**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & { `isDefault`: `boolean` ; `linkedTrees`: `string`[] ; `name`: `string`  }

#### Defined in

[api/ApiTypes.ts:212](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L212)

___

### TreeSkeleton

Ƭ **TreeSkeleton**: [`IdObjectSkeletonInterface`](../interfaces/Reference.IdObjectSkeletonInterface.md) & { `enabled?`: `boolean` ; `entryNodeId`: `string` ; `identityResource?`: `string` ; `nodes`: `Record`<`string`, [`NodeRefSkeletonInterface`](../interfaces/Reference.NodeRefSkeletonInterface.md)\> ; `uiConfig?`: [`UiConfigInterface`](../interfaces/Reference.UiConfigInterface.md)  }

#### Defined in

[api/ApiTypes.ts:55](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L55)

___

### Utils

Ƭ **Utils**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `applyNameCollisionPolicy` | (`name`: `string`) => `string` |
| `cloneDeep` | (`obj`: `object`) => `object` |
| `decodeB64` | (`input`: `string`) => `string` |
| `decodeB64Url` | (`input`: `string`) => `string` |
| `encodeB64` | (`input`: `string`, `padding`: `boolean`) => `string` |
| `encodeB64Url` | (`input`: `string`) => `string` |
| `getRealmManagedUser` | () => `string` |
| `getRealmName` | (`realm`: `string`) => `string` |
| `isEqualJson` | (`obj1`: `object`, `obj2`: `object`, `ignoreKeys?`: `string`[]) => `boolean` |
| `isValidUrl` | (`urlString`: `string`) => `boolean` |
| `readFiles` | (`baseDirectory`: `string`, `childDirectory?`: `string`) => `Promise`<{ `content`: `string` ; `path`: `string`  }[]\> |
| `substituteEnvParams` | (`input`: `string`, `reader`: `Reader`) => `string` |
| `unSubstituteEnvParams` | (`input`: `string`, `reader`: `Reader`) => `string` |

#### Defined in

[ops/utils/OpsUtils.ts:13](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/utils/OpsUtils.ts#L13)

___

### VersionOfSecretStatus

Ƭ **VersionOfSecretStatus**: ``"DISABLED"`` \| ``"ENABLED"``

#### Defined in

[api/ApiTypes.ts:124](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L124)

___

### WebAgentType

Ƭ **WebAgentType**: ``"WebAgent"``

#### Defined in

[api/ApiTypes.ts:195](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L195)

___

### WritableStrings

Ƭ **WritableStrings**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `inherited` | `boolean` |
| `value` | `string`[] |

#### Defined in

[api/ApiTypes.ts:128](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/api/ApiTypes.ts#L128)
