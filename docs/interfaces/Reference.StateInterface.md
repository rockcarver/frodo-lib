[Frodo Library - v2.0.0-13](../README.md) / [Exports](../modules.md) / [Reference](../modules/Reference.md) / StateInterface

# Interface: StateInterface

[Reference](../modules/Reference.md).StateInterface

## Table of contents

### Properties

- [allowInsecureConnection](Reference.StateInterface.md#allowinsecureconnection)
- [amVersion](Reference.StateInterface.md#amversion)
- [authenticationHeaderOverrides](Reference.StateInterface.md#authenticationheaderoverrides)
- [authenticationService](Reference.StateInterface.md#authenticationservice)
- [bearerToken](Reference.StateInterface.md#bearertoken)
- [connectionProfilesPath](Reference.StateInterface.md#connectionprofilespath)
- [cookieName](Reference.StateInterface.md#cookiename)
- [cookieValue](Reference.StateInterface.md#cookievalue)
- [createProgressHandler](Reference.StateInterface.md#createprogresshandler)
- [curlirize](Reference.StateInterface.md#curlirize)
- [curlirizeHandler](Reference.StateInterface.md#curlirizehandler)
- [debug](Reference.StateInterface.md#debug)
- [debugHandler](Reference.StateInterface.md#debughandler)
- [deploymentType](Reference.StateInterface.md#deploymenttype)
- [directory](Reference.StateInterface.md#directory)
- [features](Reference.StateInterface.md#features)
- [frodoVersion](Reference.StateInterface.md#frodoversion)
- [host](Reference.StateInterface.md#host)
- [logApiKey](Reference.StateInterface.md#logapikey)
- [logApiSecret](Reference.StateInterface.md#logapisecret)
- [masterKeyPath](Reference.StateInterface.md#masterkeypath)
- [outputFile](Reference.StateInterface.md#outputfile)
- [password](Reference.StateInterface.md#password)
- [printHandler](Reference.StateInterface.md#printhandler)
- [realm](Reference.StateInterface.md#realm)
- [serviceAccountId](Reference.StateInterface.md#serviceaccountid)
- [serviceAccountJwk](Reference.StateInterface.md#serviceaccountjwk)
- [stopProgressHandler](Reference.StateInterface.md#stopprogresshandler)
- [updateProgressHandler](Reference.StateInterface.md#updateprogresshandler)
- [useBearerTokenForAmApis](Reference.StateInterface.md#usebearertokenforamapis)
- [username](Reference.StateInterface.md#username)
- [verbose](Reference.StateInterface.md#verbose)
- [verboseHandler](Reference.StateInterface.md#verbosehandler)

## Properties

### allowInsecureConnection

• `Optional` **allowInsecureConnection**: `boolean`

#### Defined in

[shared/State.ts:373](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L373)

___

### amVersion

• `Optional` **amVersion**: `string`

#### Defined in

[shared/State.ts:392](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L392)

___

### authenticationHeaderOverrides

• `Optional` **authenticationHeaderOverrides**: `Record`<`string`, `string`\>

#### Defined in

[shared/State.ts:375](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L375)

___

### authenticationService

• `Optional` **authenticationService**: `string`

#### Defined in

[shared/State.ts:376](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L376)

___

### bearerToken

• `Optional` **bearerToken**: `string`

#### Defined in

[shared/State.ts:387](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L387)

___

### connectionProfilesPath

• `Optional` **connectionProfilesPath**: `string`

#### Defined in

[shared/State.ts:395](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L395)

___

### cookieName

• `Optional` **cookieName**: `string`

#### Defined in

[shared/State.ts:378](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L378)

___

### cookieValue

• `Optional` **cookieValue**: `string`

#### Defined in

[shared/State.ts:379](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L379)

___

### createProgressHandler

• `Optional` **createProgressHandler**: (`type`: `string`, `total?`: `number`, `message?`: `string`) => `void`

#### Type declaration

▸ (`type`, `total?`, `message?`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `string` |
| `total?` | `number` |
| `message?` | `string` |

##### Returns

`void`

#### Defined in

[shared/State.ts:411](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L411)

___

### curlirize

• `Optional` **curlirize**: `boolean`

#### Defined in

[shared/State.ts:410](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L410)

___

### curlirizeHandler

• `Optional` **curlirizeHandler**: (`message`: `string`) => `void`

#### Type declaration

▸ (`message`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `message` | `string` |

##### Returns

`void`

#### Defined in

[shared/State.ts:409](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L409)

___

### debug

• `Optional` **debug**: `boolean`

#### Defined in

[shared/State.ts:408](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L408)

___

### debugHandler

• `Optional` **debugHandler**: (`message`: `string` \| `object`) => `void`

#### Type declaration

▸ (`message`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `message` | `string` \| `object` |

##### Returns

`void`

#### Defined in

[shared/State.ts:407](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L407)

___

### deploymentType

• `Optional` **deploymentType**: `string`

#### Defined in

[shared/State.ts:372](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L372)

___

### directory

• `Optional` **directory**: `string`

#### Defined in

[shared/State.ts:398](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L398)

___

### features

• `Optional` **features**: [`FeatureInterface`](Reference.FeatureInterface.md)[]

#### Defined in

[shared/State.ts:381](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L381)

___

### frodoVersion

• `Optional` **frodoVersion**: `string`

#### Defined in

[shared/State.ts:393](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L393)

___

### host

• `Optional` **host**: `string`

#### Defined in

[shared/State.ts:368](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L368)

___

### logApiKey

• `Optional` **logApiKey**: `string`

#### Defined in

[shared/State.ts:389](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L389)

___

### logApiSecret

• `Optional` **logApiSecret**: `string`

#### Defined in

[shared/State.ts:390](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L390)

___

### masterKeyPath

• `Optional` **masterKeyPath**: `string`

#### Defined in

[shared/State.ts:396](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L396)

___

### outputFile

• `Optional` **outputFile**: `string`

#### Defined in

[shared/State.ts:397](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L397)

___

### password

• `Optional` **password**: `string`

#### Defined in

[shared/State.ts:370](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L370)

___

### printHandler

• `Optional` **printHandler**: (`message`: `string` \| `object`, `type?`: `string`, `newline?`: `boolean`) => `void`

#### Type declaration

▸ (`message`, `type?`, `newline?`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `message` | `string` \| `object` |
| `type?` | `string` |
| `newline?` | `boolean` |

##### Returns

`void`

#### Defined in

[shared/State.ts:400](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L400)

___

### realm

• `Optional` **realm**: `string`

#### Defined in

[shared/State.ts:371](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L371)

___

### serviceAccountId

• `Optional` **serviceAccountId**: `string`

#### Defined in

[shared/State.ts:383](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L383)

___

### serviceAccountJwk

• `Optional` **serviceAccountJwk**: [`JwkRsa`](../modules/Reference.md#jwkrsa)

#### Defined in

[shared/State.ts:384](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L384)

___

### stopProgressHandler

• `Optional` **stopProgressHandler**: (`message`: `string`, `status?`: `string`) => `void`

#### Type declaration

▸ (`message`, `status?`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `message` | `string` |
| `status?` | `string` |

##### Returns

`void`

#### Defined in

[shared/State.ts:417](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L417)

___

### updateProgressHandler

• `Optional` **updateProgressHandler**: (`message`: `string`) => `void`

#### Type declaration

▸ (`message`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `message` | `string` |

##### Returns

`void`

#### Defined in

[shared/State.ts:416](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L416)

___

### useBearerTokenForAmApis

• `Optional` **useBearerTokenForAmApis**: `boolean`

#### Defined in

[shared/State.ts:386](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L386)

___

### username

• `Optional` **username**: `string`

#### Defined in

[shared/State.ts:369](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L369)

___

### verbose

• `Optional` **verbose**: `boolean`

#### Defined in

[shared/State.ts:406](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L406)

___

### verboseHandler

• `Optional` **verboseHandler**: (`message`: `string` \| `object`) => `void`

#### Type declaration

▸ (`message`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `message` | `string` \| `object` |

##### Returns

`void`

#### Defined in

[shared/State.ts:405](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/shared/State.ts#L405)
