[Frodo Library - v2.0.0-13](../README.md) / [Exports](../modules.md) / [Reference](../modules/Reference.md) / Saml2ExportInterface

# Interface: Saml2ExportInterface

[Reference](../modules/Reference.md).Saml2ExportInterface

## Table of contents

### Properties

- [meta](Reference.Saml2ExportInterface.md#meta)
- [saml](Reference.Saml2ExportInterface.md#saml)
- [script](Reference.Saml2ExportInterface.md#script)

## Properties

### meta

• `Optional` **meta**: [`ExportMetaData`](Reference.ExportMetaData.md)

#### Defined in

[ops/OpsTypes.ts:88](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/OpsTypes.ts#L88)

___

### saml

• **saml**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `hosted` | `Record`<`string`, [`Saml2ProviderSkeleton`](../modules/Reference.md#saml2providerskeleton)\> |
| `metadata` | `Record`<`string`, `string`[]\> |
| `remote` | `Record`<`string`, [`Saml2ProviderSkeleton`](../modules/Reference.md#saml2providerskeleton)\> |

#### Defined in

[ops/OpsTypes.ts:90](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/OpsTypes.ts#L90)

___

### script

• **script**: `Record`<`string`, [`ScriptSkeleton`](../modules/Reference.md#scriptskeleton)\>

#### Defined in

[ops/OpsTypes.ts:89](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/OpsTypes.ts#L89)
