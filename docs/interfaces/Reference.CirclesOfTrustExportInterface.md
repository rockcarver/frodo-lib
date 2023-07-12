[Frodo Library - v2.0.0-13](../README.md) / [Exports](../modules.md) / [Reference](../modules/Reference.md) / CirclesOfTrustExportInterface

# Interface: CirclesOfTrustExportInterface

[Reference](../modules/Reference.md).CirclesOfTrustExportInterface

## Table of contents

### Properties

- [meta](Reference.CirclesOfTrustExportInterface.md#meta)
- [saml](Reference.CirclesOfTrustExportInterface.md#saml)
- [script](Reference.CirclesOfTrustExportInterface.md#script)

## Properties

### meta

• `Optional` **meta**: [`ExportMetaData`](Reference.ExportMetaData.md)

#### Defined in

[ops/OpsTypes.ts:77](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/OpsTypes.ts#L77)

___

### saml

• **saml**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `cot` | `Record`<`string`, [`CircleOfTrustSkeleton`](../modules/Reference.md#circleoftrustskeleton)\> |
| `hosted` | `Record`<`string`, [`Saml2ProviderSkeleton`](../modules/Reference.md#saml2providerskeleton)\> |
| `metadata` | `Record`<`string`, `string`[]\> |
| `remote` | `Record`<`string`, [`Saml2ProviderSkeleton`](../modules/Reference.md#saml2providerskeleton)\> |

#### Defined in

[ops/OpsTypes.ts:79](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/OpsTypes.ts#L79)

___

### script

• **script**: `Record`<`string`, [`ScriptSkeleton`](../modules/Reference.md#scriptskeleton)\>

#### Defined in

[ops/OpsTypes.ts:78](https://github.com/vscheuber/frodo-lib/blob/114bd67/src/ops/OpsTypes.ts#L78)
