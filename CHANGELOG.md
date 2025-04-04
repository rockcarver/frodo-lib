# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.1.0] - 2025-04-04

### Added

- New methods on State to allow setting global retry config as an [IAxiosRetryConfig](https://github.com/softonic/axios-retry/blob/4019333df603bf1bb27dae9311a96dd8edbe102b/src/index.ts#L10) object. Default is to have no retry config to maintain current behaviour.

### Fixed

- rockcarver/frodo-cli#477: Frodo Library now properly includes the transformation script for both `Social Provider Handler Node` and `Legacy Social Provider Handler Node`.
- rockcarver/frodo-cli#482: Frodo Library now properly honors the NO_PROXY environment variable in addition to HTTP_PROXY and HTTPS_PROXY.

## [3.0.4-2] - 2025-04-03

## [3.0.4-1] - 2025-04-02

### Added

- New methods on State to allow setting global retry config as an [IAxiosRetryConfig](https://github.com/softonic/axios-retry/blob/4019333df603bf1bb27dae9311a96dd8edbe102b/src/index.ts#L10) object. Default is to have no retry config to maintain current behaviour.

### Fixed

- rockcarver/frodo-cli#477: Frodo Library now properly includes the transformation script for both `Social Provider Handler Node` and `Legacy Social Provider Handler Node`.
- rockcarver/frodo-cli#482: Frodo Library now properly honors the NO_PROXY environment variable in addition to HTTP_PROXY and HTTPS_PROXY.

## [3.0.4-0] - 2025-03-31

## [3.0.3] - 2025-03-11

### Fixed

- rockcarver/frodo-cli#479: Fixes issues introduced by a recent PingOne Advanced Identity Cloud release (16747.0 on 27 Feb 2025) which prevented Frodo from correctly determining the deployment type of `cloud` and led to failures when adding connection profiles and creating service accounts.

## [3.0.2] - 2025-03-10

### Fixed

- rockcarver/frodo-cli#479: Fixes issues introduced by a recent PingOne Advanced Identity Cloud release (16747.0 on 27 Feb 2025) which prevented Frodo from correctly determining the deployment type of `cloud` and led to failures in the `frodo conn save` and `frodo conn add` commands when Frodo was attempting to create service accounts with scopes that are not available in an environment.
- Updated dependencies with vulnerabilities

## [3.0.1] - 2025-01-23

### Changed

- Support for new export options for full config exports. By default, the full exports will now only export "importable" config, i.e. the non-read only config, unless otherwise specified by the read only flag. However, just as it was before, all realms and global config will be exported by default unless otherwise specified by the new flags for realm only and global only.
- Removes duplicate IdP config exported as part of the SocialIdentityProviders service in the full config export since they are already exported separately. The service is still exported, but the nextDescendents field is deleted before returning the full export.

### Added

- New functions to read and import individual config schemas. For example, read or import just the user_role schema from the managed objects entity.

### Fixed

- Improved IdP imports where not including the redirectAfterFormPostURI attribute in the import would cause it to throw an HTTP 500 error.
- Updated dependencies with vulnerabilities

## [3.0.1-7] - 2025-01-22

## [3.0.1-6] - 2025-01-22

## [3.0.1-5] - 2025-01-21

## [3.0.1-4] - 2025-01-21

## [3.0.1-3] - 2025-01-21

## [3.0.1-2] - 2025-01-21

## [3.0.1-1] - 2025-01-21

## [3.0.1-0] - 2024-11-14

## [3.0.0] - 2024-11-05

### Added

- Add governance API factory under `frodo.factory`:

  - `generateGovernanceApi`: Generates a Governance Axios API instance

### Changed

Fixes and improvements to imports and exports:

- Updated comments and type information to be more accurate and fix typos
- Fixed TrustedJWTIssuer exports/imports (since these will be included as part of the full config export/import in the future PR)
- Fixed service imports to work for federation services
- **_BREAKING_**: Updated exports for agents and esv secrets/variables to have a singular instead of plural type (i.e. `agents` => `agent`, `secrets` => `secret`, `variables` => `variable`). The reason for this is to make them more consistent with the rest of the exports which are also singular, and also because secrets plural will be used for exporting AM secret config in the future.
- **_BREAKING_**: For full exports, duplicate config is now deleted from the IDM exports since themes, email templates, and mappings are all handled separately.
- Fixed full imports to only import if the full import config contains the items being imported rather than erroring out.
- Fixed full imports to return the config items that were imported
- Fixed email template imports/exports. For exports, there was a bug with the api where not all email templates were being exported using “emailTemplate” as the type, but it was fixed by using “emailTemplat” as the type instead (not sure why this works, but it’s the best solution I could find to fix the problem).
- Moved functionality for handling env substitution and entity filters from CLI to lib for IDM exports/imports.
- Fixed a few bugs with importing/exporting journeys. The main issue that was found was that if you were importing a journey containing nodes that are not supported by the current deployment (e.g. IDM journey nodes from cloud being imported into a classic deployment of AM), the journey would still be imported. This would cause an error to be thrown on export of the journey preventing it as well as other journeys from being exported on full export. The fix here was to just prevent the import of the journey if this happens by erroring out to prevent those errors from happening on export.
- Fixed a few bugs with script imports to allow each of the 3 types of imports to work (i.e. if scripts are a single unencoded string, if scripts are a single encoded string, and if scripts are a decoded array).

## [2.3.1-0] - 2024-11-05 [YANKED]

## [2.3.0] - 2024-11-01 [YANKED]

## [2.2.1-0] - 2024-10-31

## [2.2.0] - 2024-10-10

### Added

- Expose API factory to developers using Frodo Library to configure AIC, ForgeOps, and PingAM deployments.

  Under `frodo.factory` developers now have access to:

  - `generateAmApi`: Generates an AM Axios API instance
  - `generateOauth2Api`: Generates an OAuth2 Axios API instance
  - `generateIdmApi`: Generates an IDM Axios API instance
  - `generateLogKeysApi`: Generates a LogKeys API Axios instance
  - `generateLogApi`: Generates a Log API Axios instance
  - `generateEnvApi`: Generates an Axios instance for the Identity Cloud Environment API
  - `generateReleaseApi`: Generates a release (Github or Npm) Axios API instance

### Fixed

- rockcarver/frodo-cli#445: Fixed an issue introduced with an update to Advanced Identity Cloud which renamed scopes for an upcoming feature and broke Frodo Library in a number of places.

## [2.1.2-0] - 2024-08-26

### Added

- Improve support for custom platform deployments (non-forgeops or customized forgeops)

  - rockcarver/frodo-cli#429: Added state functions to support custom oauth2 clients for IDM API calls:

    - `state.setAdminClientId(clientId: string): void`
    - `state.getAdminClientId(): string`
    - `state.setAdminRedirectUri(redirectUri: string): void`
    - `state.getAdminRedirectUri(): string`

  - rockcarver/frodo-cli#359: Added state functions to support custom IDM host URLs for all IDM API calls (e.g. platform deployments hosting AM and IDM on/in different DNS hosts/domains):

    - `state.setIdmHost(host: string): void`
    - `state.getIdmHost(): string`

## [2.1.1] - 2024-08-23

### Fixed

- Fixed the issue where the types were not specified correctly for consumers using ESM modules. When attempting to consume frodo with the tsconfig of `NodeNext` for `module` and `moduleResolution`, or `ESNext` for `module` and `Bundler` for `moduleResolution`, it was unable to determine types.

## [2.1.1-0] - 2024-08-23

## [2.1.0] - 2024-08-19

### Added

- Improvements to script handling:

  - Added the option to import scripts by id.
  - Implementing `useStringArrays` in exports and allowing imports to support single-string scripts in addition to string array scripts.

- \#247 - Support for Advanced Identitty Cloud Environment Promotion API (Location in library: `frodo.cloud.env.promotion`)

- \#432 - Support for Advanced Identitty Cloud ESV Count API (Location in library: `frodo.cloud`)

- \#433 - Support for Advanced Identitty Cloud Environment Certificate API (Location in library: `frodo.cloud.env.cert`)

- \#434 - Support for Advanced Identitty Cloud Environment CSR API (Location in library: `frodo.cloud.env.csr`)

- \#435 - Support for Advanced Identitty Cloud Environment Content Security Policy API (Location in library: `frodo.cloud.env`)

- \#436 - Support for Advanced Identitty Cloud Environment Cookie Domains API (Location in library: `frodo.cloud.env`)

- \#437 - Support for Advanced Identitty Cloud Environment Custom Domains API (Location in library: `frodo.cloud.env`)

- \#438 - Support for Advanced Identitty Cloud Environment Federation Enforcement API (Location in library: `frodo.cloud.env`)

- \#439 - Support for Advanced Identitty Cloud Environment Release API (Location in library: `frodo.cloud.env`)

- \#440 - Support for Advanced Identitty Cloud Environment SSO Cookie API (Location in library: `frodo.cloud.env`)

### Fixed

- Fixes to script handling

  - Fixed script imports so that they can correctly import a single script.
  - Make getting library scripts recursive in the event that there are library scripts dependent on other library scripts so that they all get exported.

- \#448: Frodo Library now accepts an additional optional boolean param `wait`, which if provided delays the response until an OSGi service event confirms the change has been consumed by the corresponding service or the request times out, to the following `frodo.idm.config` functions:

  - createConfigEntity
  - updateConfigEntity

- \#450: Mitigated [CVE-2024-39338](https://github.com/advisories/GHSA-8hc4-vh64-cxmj)

- rockcarver/frodo-cli#428: Frodo Library now includes the `loglevel` dependency.

- rockcarver/frodo-cli#430: Frodo now properly supports exporting and importing of the email service with secondary configurations.

## [2.0.4] - 2024-08-19

### Added

- \#247 - Support for Advanced Identitty Cloud Environment Promotion API (Location in library: `frodo.cloud.env.promotion`)

### Changed

- Deprecated old location of ESV Count API `frodo.cloud.esvCount.getEsvCount` and added new location `frodo.cloud.getEsvCount`

## [2.0.4-0] - 2024-08-16

## [2.0.3] - 2024-08-13

### Added

- \#435 - Support for Advanced Identitty Cloud Environment Content Security Policy API (Location in library: `frodo.cloud.env`)
- \#436 - Support for Advanced Identitty Cloud Environment Cookie Domains API (Location in library: `frodo.cloud.env`)
- \#437 - Support for Advanced Identitty Cloud Environment Custom Domains API (Location in library: `frodo.cloud.env`)
- \#438 - Support for Advanced Identitty Cloud Environment Federation Enforcement API (Location in library: `frodo.cloud.env`)
- \#439 - Support for Advanced Identitty Cloud Environment Release API (Location in library: `frodo.cloud.env`)
- \#440 - Support for Advanced Identitty Cloud Environment SSO Cookie API (Location in library: `frodo.cloud.env`)

### Fixed

- \#448: Frodo Library now accepts an additional optional boolean param `wait`, which if provided delays the response until an OSGi service event confirms the change has been consumed by the corresponding service or the request times out, to the following `frodo.idm.config` functions:

  - createConfigEntity
  - updateConfigEntity

- \#450: Mitigated [CVE-2024-39338](https://github.com/advisories/GHSA-8hc4-vh64-cxmj)

## [2.0.2] - 2024-08-06

### Added

- \#432 - Support for Advanced Identitty Cloud ESV Count API (Location in library: `frodo.cloud.esvCount`)
- \#433 - Support for Advanced Identitty Cloud Environment Certificate API (Location in library: `frodo.cloud.env.cert`)
- \#434 - Support for Advanced Identitty Cloud Environment CSR API (Location in library: `frodo.cloud.env.csr`)

### Fixed

- rockcarver/frodo-cli#428: Frodo Library now includes the `loglevel` dependency.

## [2.0.1] - 2024-08-05

### Fixed

- rockcarver/frodo-cli#430: Frodo now properly supports exporting and importing of the email service with secondary configurations.

## [2.0.1-2] - 2024-08-05

### Fixed

- rockcarver/frodo-cli#430: Frodo now properly supports exporting and importing of the email service with secondary configurations.

## [2.0.1-1] - 2024-07-26

## [2.0.1-0] - 2024-07-25

## [2.0.0] - 2024-07-19

### Changed

#### Multi-Instantiability

2.x introduces breaking changes to support multiple instances of the library to run concurrently and connect to multiple different Ping Identity Platform instances at the same time. [1.x](https://github.com/rockcarver/frodo-lib/tree/1.x) operates using a global singleton, making it impossible to connect to more than one platform instance at a time.

#### New Library Structure

Removing the singleton pattern and introducing multi-instantiability forced a radical redesign of the core library functions while striving to maintain the basic usage pattern. The library is now exposing two main types describing its modules ([Frodo](https://rockcarver.github.io/frodo-lib/types/Reference.Frodo.html)) and state ([State](https://rockcarver.github.io/frodo-lib/types/Reference.State.html)). Each module in turn exports all its collection of functions as a type as well. Exposing the library structure as types enables auto-completion for both JS and TS developers with properly configured IDEs like Visual Studio Code or other and also serves as an abstraction layer between what the library exposes vs what and how it's implemented.

#### New `FrodoError` Class

All the errors thrown by the library are of the class `FrodoError`, introduced in 2.x. The new error class addresses the following challenges of earlier library versions:

- Allows applications using the library to determine if the error originated in the library or is an unexpected and unhandled error from deeper down the stack.

- Nesting of errors:

  When the library throws because it caught an error thrown deeper down the stack, it wraps the caught `Error` in a `FrodoError`.

- Nesting of arrays of errors

  The library supports many operation that require a number of actions to occur in a row or in parallel. Often these operations are REST API calls and any of those calls may fail for any reason. To preserve status of every operation, `FrodoError` can also wrap an array of errors, each of which may be another instance of `FrodoError` wrapping an individual or an array of errors.

- Provides a stack-like combined error message concatenating the messages of all wrapped errors and nested errors.

- Includes standardized fields to surface network errors in case the `Error` on top of the stack is an `AxiosError`.

- The new `printError` function recognizes `FrodoError` and prints a uniformly formatted expression of the error including an interpretation of the fields for network stack errors.

#### New Modules

The following modules have been updated and/or added since [1.x](https://github.com/rockcarver/frodo-lib/tree/1.x):

| Module                     | Since | Capabilities                                                                                    |
| -------------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| frodo.admin                | 1.0.0 | Library of common and complex admin tasks.                                                      |
| frodo.agent                | 1.0.0 | Manage web, java, and gateway agents.                                                           |
| frodo.app                  | 2.0.0 | Manage platform applications and dependencies.                                                  |
| frodo.authn.journey        | 1.0.0 | Manage authentication journeys.                                                                 |
| frodo.authn.node           | 1.0.0 | Manage authentication nodes.                                                                    |
| frodo.authn.settings       | 2.0.0 | Manage realm-wide authentication settings.                                                      |
| frodo.authz.policy         | 1.0.0 | Manage authorization policies and dependencies.                                                 |
| frodo.authz.policySet      | 1.0.0 | Manage policy sets and dependencies.                                                            |
| frodo.authz.resourceType   | 1.0.0 | Manage resource types and dependencies.                                                         |
| frodo.cache                | 2.0.0 | Token cache management exposed through the library but primarily used internally.               |
| frodo.cloud.adminFed       | 1.0.0 | Manage PingOne Advanced Identity Cloud admin federation.                                        |
| frodo.cloud.feature        | 1.0.0 | Obtain info on PingOne Advanced Identity Cloud features.                                        |
| frodo.cloud.log            | 1.0.0 | Access PingOne Advanced Identity Cloud debug and audit logs.                                    |
| frodo.cloud.secret         | 1.0.0 | Mange secrets in PingOne Advanced Identity Cloud.                                               |
| frodo.cloud.serviceAccount | 1.0.0 | Manage service accounts in PingOne Advanced Identity Cloud.                                     |
| frodo.cloud.startup        | 1.0.0 | Apply changes to secrets and variables and restart services in PingOne Advanced Identity Cloud. |
| frodo.cloud.variable       | 1.0.0 | Manage variables in PingOne Advanced Identity Cloud.                                            |
| frodo.conn                 | 1.0.0 | Manage connection profiles.                                                                     |
| frodo.config               | 2.0.0 | Manage the whole platform configuration.                                                        |
| frodo.email.template       | 1.0.0 | Manage email templates (IDM).                                                                   |
| frodo.idm.config           | 2.0.0 | Manage any IDM configuration object.                                                            |
| frodo.idm.connector        | 2.0.0 | Manage IDM connector configuration.                                                             |
| frodo.idm.managed          | 1.0.0 | Manage IDM managed object schema (managed.json).                                                |
| frodo.idm.mapping          | 2.0.0 | Manage IDM mappings (sync.json).                                                                |
| frodo.idm.organization     | 1.0.0 | Limited Org Model management exposed through the library but primarily used internally.         |
| frodo.idm.recon            | 2.0.0 | Read, start, cancel IDM recons.                                                                 |
| frodo.idm.system           | 2.0.0 | Manage data in connected systems.                                                               |
| frodo.info                 | 1.0.0 | Obtain information about the connected instance and authenticated identity.                     |
| frodo.login                | 1.0.0 | Authenticate and obtain necessary tokens.                                                       |
| frodo.oauth2oidc.client    | 1.0.0 | Manage OAuth 2.0 clients.                                                                       |
| frodo.oauth2oidc.endpoint  | 2.0.0 | Limited OAuth 2.0 grant flows exposed through the library but primarily used internally.        |
| frodo.oauth2oidc.external  | 1.0.0 | Manage external OAuth 2.0/OIDC 1.0 (social) identity providers.                                 |
| frodo.oauth2oidc.issuer    | 2.0.0 | Manage trusted OAuth 2.0 JWT issuers.                                                           |
| frodo.oauth2oidc.provider  | 1.0.0 | Manage the realm OAuth 2.0 provider.                                                            |
| frodo.realm                | 1.0.0 | Manage realms.                                                                                  |
| frodo.saml.circlesOfTrust  | 1.0.0 | Manage SAML 2.0 circles of trust.                                                               |
| frodo.saml.entityProvider  | 1.0.0 | Manage SAML 2.0 entity providers.                                                               |
| frodo.script               | 1.0.0 | Manage access management scripts.                                                               |
| frodo.service              | 1.0.0 | Manage access management services.                                                              |
| frodo.session              | 2.0.0 | Limited session management exposed through the library but primarily used internally.           |
| frodo.state                | 1.0.0 | Manage library state.                                                                           |
| frodo.theme                | 1.0.0 | Manage platform themes (hosted pages).                                                          |
| frodo.utils.constants      | 1.0.0 | Access relevant library constants.                                                              |
| frodo.utils.jose           | 1.0.0 | Jose utility functions exposed through the library but primarily used internally.               |
| frodo.utils.json           | 1.0.0 | JSON utility functions exposed through the library but primarily used internally.               |
| frodo.utils.version        | 1.0.0 | Utility functions to obtain current library version and available released versions.            |

#### Secure Token Caching

The 2.x version of the library uses a secure token cache, which is active by default. The cache makes it so that when the `frodo.login.getTokens()` method is called, available tokens are updated in `state` from cache and if none are available, they are obtained from the instance configured in `state`. The cache is tokenized and encrypted on disk, so it persists across library instantiations. You can disable the cache by either setting the `FRODO_NO_CACHE` environment variable or by calling `state.setUseTokenCache(false)` from your application.
You can change the default location of the cache file (`~/.frodo/TokenCache.json`) by either setting the `FRODO_TOKEN_CACHE_PATH` environment variable or by calling `state.setTokenCachePath('/path/to/cache.json')`.

#### Automatic Token Refresh

The 2.x version of the library automatically refreshes session and access tokens before they expire. Combined with the new token cache, the library will maintain a set of valid tokens in `state` at all times until it is shut down. If you do not want to automatically refresh tokens, set the `autoRefresh` parameter (2nd param) of your `frodo.login.getTokens()` call to `false`.

#### Node.js Versions

- Dropped support for Node.js 14 and 16.
- Kept supporting Node.js 18.
- Added support for Node.js 20 and 22.

| Node.js |    frodo-lib 1.x   | **_frodo-lib 2.x_** |    frodo-lib 3.x   |
| :-----: | :----------------: | :-----------------: | :----------------: |
|    14   | :white_check_mark: |  :heavy_minus_sign: | :heavy_minus_sign: |
|    16   | :white_check_mark: |  :heavy_minus_sign: | :heavy_minus_sign: |
|    18   | :white_check_mark: |  :white_check_mark: | :heavy_minus_sign: |
|    20   | :heavy_minus_sign: |  :white_check_mark: | :white_check_mark: |
|    22   | :heavy_minus_sign: |  :white_check_mark: | :white_check_mark: |
|    24   | :heavy_minus_sign: |  :heavy_minus_sign: | :white_check_mark: |

### Considerations

#### Platform Passwords And Secrets

Platform passwords and secrets are configuration values that are stored encrypted as part of platform configuration. Examples are oauth2 client secrets or service account passwords.

Frodo generally doesn't export platform passwords and secrets. The platform supports configuration placeholders and environment secrets and variables allowing administrators to separate the functional configuration from sensitive secrets and variable configuration values. `frodo` assumes administrators take full advantage of these capabilities so that there is no need or expectation that exports include passwords and secrets. However, where the APIs support it, administrators can seed import data with raw secrets and `frodo` will import them.

#### Advanced Identity Cloud Environment Secrets And Variables (ESVs)

Frodo supports exporting and importing of ESV secret values. To leave stuartship of secret values with the cloud environment where they belong, frodo always encrypts values using either encryption keys from the source environment (default) or the target environment. Frodo never exports secrets in the clear.

## [2.0.0-96] - 2024-07-17

## [2.0.0-95] - 2024-07-15

## [2.0.0-94] - 2024-07-12

## [2.0.0-93] - 2024-07-10

## [2.0.0-92] - 2024-07-10

### Added

- rockcarver/frodo-cli#404: Frodo now saves the allowInsecureConnection state option in connection profiles.

### Fixed

- rockcarver/frodo-cli#400: Frodo now properly honors the allowInsecureConnection state option and allows connecting to platform instances using self-signed certificates.

## [2.0.0-91] - 2024-07-05

## [2.0.0-90] - 2024-07-05

## [2.0.0-89] - 2024-06-27

### Added

- Frodo now supports exporting (and importing) of ESV secret values. To leave stuartship of secret values with the cloud environment where they belong, frodo will always encrypt values using either encryption keys from the source environment (default) or the target environment (export option). Frodo will never export secrets in the clear. However, frodo supports importing clear values (as well as importing encrypted values).
- \#387: Support import of ESVs (variables and secrets)
- \#394: Support for `base64aes` encoding for ESV secrets

## [2.0.0-88] - 2024-06-21

### Changed

- Pipeline hygene

## [2.0.0-87] - 2024-06-20

### Changed

- \#417: Added support for node 22
- \#363: Updated information in README

## [2.0.0-86] - 2024-06-19

### Changed

- \#402: Library scripts are now treated as dependencies during script and journey exports and imports.

## [2.0.0-85] - 2024-06-11

### Changed

- Updated dependencies
- Updated examples

## [2.0.0-84] - 2024-06-11

### Changed

- Updated dependencies, in particular axios
- Pipeline changes

## [2.0.0-83] - 2024-05-20

### Fixed

- \#409: Importing applications does not import required mappings

## [2.0.0-82] - 2024-05-15

## [2.0.0-81] - 2024-05-14

## [2.0.0-80] - 2024-05-07

## [2.0.0-79] - 2024-05-02

## [2.0.0-78] - 2024-05-02

## [2.0.0-77] - 2024-04-09

### Fixed

- Improved filtering out secrets from recordings

## [2.0.0-76] - 2024-04-08

### Fixed

- \#392: Implemented error handling pattern for methods with unusual amounts of REST calls like `frodo.config.exportFullConfiguration` and `frodo.config.importFullConfiguration`

## [2.0.0-75] - 2024-03-29

### Fixed

- \#397: Service accounts now use the proper scopes when created using the `frodo conn save` command

## [2.0.0-74] - 2024-03-23

### Fixed

- \#391: Frodo now creates service accounts with all allowed scopes:
  - `fr:am:*`
  - `fr:idc:analytics:*`
  - `fr:autoaccess:*`
  - `fr:idc:certificate:*`
  - `fr:idc:certificate:read`
  - `fr:idc:content-security-policy:*`
  - `fr:idc:custom-domain:*`
  - `fr:idc:esv:*`
  - `fr:idc:esv:read`
  - `fr:idc:esv:restart`
  - `fr:idc:esv:update`
  - `fr:idm:*`
  - `fr:iga:*`
  - `fr:idc:promotion:*`
  - `fr:idc:release:*`
  - `fr:idc:sso-cookie:*`

## [2.0.0-73] - 2024-03-22

### Fixed

- \#393: Frodo now again properly imports oauth2 clients exported from an older AM version without provider overrides.
- \#390: Frodo now uses its own error type `FrodoError` for all ops layer errors.

## [2.0.0-72] - 2024-02-10

## [2.0.0-71] - 2024-02-05

## [2.0.0-70] - 2024-02-01

### Changed

- Pipeline changes

## [2.0.0-69] - 2024-02-01

### Changed

- Pipeline changes

## [2.0.0-68] - 2024-01-31

## [2.0.0-67] - 2024-01-21

## [2.0.0-66] - 2024-01-20

## [2.0.0-65] - 2024-01-20

### Added

- rockcarver/frodo-cli#360: Frodo now saves the deployment type in connection profiles.

## [2.0.0-64] - 2024-01-16

## [2.0.0-63] - 2024-01-15

### Fixed

- Polly recording names can have an optional cli parameter value as well

## [2.0.0-62] - 2024-01-13

## [2.0.0-61] - 2024-01-12

## [2.0.0-60] - 2024-01-08

### Added

- Added tests for Saml export with and without deps

### Fixed

- Saml metadata is no more considered a dependency and will always be exportd

## [2.0.0-59] - 2024-01-05

## [2.0.0-58] - 2024-01-02

## [2.0.0-57] - 2023-12-22

## [2.0.0-56] - 2023-12-22

## [2.0.0-55] - 2023-12-19

## [2.0.0-54] - 2023-12-06

## [2.0.0-53] - 2023-12-01

## [2.0.0-52] - 2023-11-29

## [2.0.0-51] - 2023-11-26

## [2.0.0-50] - 2023-11-22

## [2.0.0-49] - 2023-11-21

## [2.0.0-48] - 2023-11-04

### Added

- rockcarver/frodo-cli#217: Support for authentication settings through new `frodo.authn.settings` module.

## [2.0.0-47] - 2023-11-02

### Added

- \#53: Frodo Library now uses a file-based secure token cache to persist session and access tokens for re-use. The cached tokens are protected by the credential that was used to obtain them. Session tokens are encrypted using the hashed password as the master key, access tokens are encrypted using the hashed JWK private key as the master key. Therefore only users and processes with the correct credentials can access the tokens in the cache.

  - There is a new TokenCache module with accessible functions for frodo clients (like frodo-cli) to use.
  - The State module has been extended to host meta data like expiration time for sessions and tokens and a new boolean field indicating if the library should make use of the new token cache or not: `state.getUseTokenCache(): boolean` and `state.setUseTokenCache(useTokenCache: boolean): void`.
  - The new default behavior is to always use the new token cache.

- \#340: Frodo Library now autotomatically refreshes expired session and access tokens.

  - The new default behavior is to automatically refresh tokens. However, if an application prefers to handle that on its own, it can call the `frodo.login.getTokens()` functino with a new `autoRefresh: boolean` parameter.

### Fixed

- rockcarver/frodo-cli#316: Frodo Library now properly exports scripts referenced by the `Device Match` node if the `Use Custom Matching Script` option is selected.

## [2.0.0-46] - 2023-10-25

## [2.0.0-45] - 2023-10-23

## [2.0.0-44] - 2023-10-21

## [2.0.0-43] - 2023-10-19

## [2.0.0-42] - 2023-10-18

## [2.0.0-41] - 2023-10-17

## [2.0.0-40] - 2023-10-17

## [2.0.0-39] - 2023-10-14

## [2.0.0-38] - 2023-10-14

## [2.0.0-37] - 2023-10-11

## [2.0.0-36] - 2023-10-11

## [2.0.0-35] - 2023-10-07

## [2.0.0-34] - 2023-09-30

## [2.0.0-33] - 2023-09-29

## [2.0.0-32] - 2023-09-28

## [2.0.0-31] - 2023-09-26

## [2.0.0-30] - 2023-09-26

## [2.0.0-29] - 2023-09-25

## [2.0.0-28] - 2023-09-25

## [2.0.0-27] - 2023-09-22

## [2.0.0-26] - 2023-09-08

## [2.0.0-25] - 2023-09-02

## [2.0.0-24] - 2023-08-28

## [2.0.0-23] - 2023-08-28

## [2.0.0-22] - 2023-08-17

## [2.0.0-21] - 2023-08-16

## [2.0.0-20] - 2023-08-01

## [2.0.0-19] - 2023-07-31

## [2.0.0-18] - 2023-07-18

### Fixed

- \#272: Frodo now supports the `expressionType` property when creating ESV variables in Identity Cloud.

## [2.0.0-17] - 2023-07-18

## [2.0.0-16] - 2023-07-17

## [2.0.0-15] - 2023-07-13

## [2.0.0-14] - 2023-07-12

## [2.0.0-13] - 2023-07-08

### Added

- Usage examples in /path/to/frodo-lib/examples
  - ESM - Sample code is using ECMAScript modules
  - CJS - Sample code is using CommonJS modules

### Changed

- Fix import/require resolution issues for library users. Developers using the library can now:

  - ESM:

    Member style import any other modules from the library:

    ```javascript
    import { frodo, state, FrodoLib } from '@rockcarver/frodo-lib';
    ```

  - CJS:

    Member style require any other modules from the library"

    ```javascript
    const { frodo, state, FrodoLib } = require('@rockcarver/frodo-lib');
    ```

## [2.0.0-12] - 2023-07-05

## [2.0.0-11] - 2023-07-05

## [2.0.0-10] - 2023-06-29

## [2.0.0-9] - 2023-06-23

## [2.0.0-8] - 2023-06-22

## [2.0.0-7] - 2023-06-22

### Added

- rockcarver/frodo-cli#251: Support for Identity Cloud admin federation configuration through new module `AdminFederation`.

## [2.0.0-6] - 2023-06-21

## [2.0.0-5] - 2023-06-16

## [2.0.0-4] - 2023-06-15

## [2.0.0-3] - 2023-06-14

## [2.0.0-2] - 2023-06-12

## [2.0.0-1] - 2023-06-08

## [1.1.0] - 2023-06-30

### Added

- rockcarver/frodo-cli#251: Support for Identity Cloud admin federation configuration through new module `AdminFederation`.

## [1.0.1-1] - 2023-06-28

## [1.0.1-0] - 2023-06-22

### Added

- rockcarver/frodo-cli#251: Support for Identity Cloud admin federation configuration through new module `AdminFederation`.

## [1.0.0] - 2023-06-05

### Changed

- Promote Frodo Library 0.19.2 to 1.0.0.

## [0.19.2] - 2023-05-25

### Changed

- \#248: Frodo Library now exports all essential log api functions through the LogOps module export `Log`.

## [0.19.1] - 2023-05-21

### Added

- Support for authorization policies, policy sets, and resource types through new exported modules:
  - ResourceType
  - PolicySet
  - Policy

### Changed

- Updated dependencies
- rockcarver/frodo-cli#213: More debug logging for connection profile lookup by a unique substring. Use --debug to see the additional output. This is not yet a solution for rockcarver/frodo-cli#213 but should help identify the root cause.
- rockcarver/frodo-cli#216: More debug logging for the 2fa process and proper detection of unsupported webauthn factor.

### Fixed

- \#236: Frodo now properly handles logging in as a tenant admin when admin federation is enabled.
- \#225: Always output original log event JSON in tailLogs function (`frodo logs tail` command in the cli)
- rockcarver/frodo-cli#218: Frodo now allows 3 errors when polling for status during a `frodo esv apply` before aborting.

## [0.19.0] - 2023-05-21

### Added

- Support for authorization policies, policy sets, and resource types through new exported modules:
  - ResourceType
  - PolicySet
  - Policy

### Changed

- Updated dependencies
- rockcarver/frodo-cli#213: More debug logging for connection profile lookup by a unique substring. Use --debug to see the additional output. This is not yet a solution for rockcarver/frodo-cli#213 but should help identify the root cause.
- rockcarver/frodo-cli#216: More debug logging for the 2fa process and proper detection of unsupported webauthn factor.

### Fixed

- \#236: Frodo now properly handles logging in as a tenant admin when admin federation is enabled.
- \#225: Always output original log event JSON in tailLogs function (`frodo logs tail` command in the cli)
- rockcarver/frodo-cli#218: Frodo now allows 3 errors when polling for status during a `frodo esv apply` before aborting.

## [0.18.9-7] - 2023-05-21

## [0.18.9-6] - 2023-05-17

## [0.18.9-5] - 2023-05-17

## [0.18.9-4] - 2023-04-20

### Fixed

- \#236: Frodo now properly handles logging in as a tenant admin when admin federation is enabled.

## [0.18.9-3] - 2023-04-18

## [0.18.9-2] - 2023-04-05

## [0.18.9-1] - 2023-03-27

### Fixed

- rockcarver/frodo-cli#218: Frodo now allows 3 errors when polling for status during a `frodo esv apply` before aborting.

## [0.18.9-0] - 2023-03-23

### Changed

- rockcarver/frodo-cli#213: More debug logging for connection profile lookup by a unique substring. Use --debug to see the additional output. This is not yet a solution for rockcarver/frodo-cli#213 but should help identify the root cause.
- rockcarver/frodo-cli#216: More debug logging for the 2fa process and proper detection of unsupported webauthn factor.

## [0.18.8] - 2023-02-17

### Added

- Support for node 19.

## [0.18.7] - 2023-02-16

## [0.18.6] - 2023-02-16

### Changed

- Updated dependencies.

## [0.18.5] - 2023-02-14

### Fixed

- rockcarver/frodo-cli#196 and rockcarver/frodo-cli#197: Frodo now properly detects Encore environments as ForgeOps environments and obtains an access token for IDM APIs.

## [0.18.4] - 2023-02-11

### Fixed

- rockcarver/frodo-cli#195: Backend support to fix issue: `Authenticate.getTokens` API now supports new `forceLoginAsUser` param to force logging in as a user even if a service account is available.

## [0.18.3] - 2023-01-27

### Changed

- rockcarver/frodo-cli#192: Backend support for better error handling and reporting in frodo-cli

## [0.18.2] - 2023-01-25

### Added

- rockcarver/frodo-cli#52: Library support for script extract and watch functionality

### Fixed

- rockcarver/frodo-cli#190: Frodo now properly imports previously exported saml providers.

## [0.18.2-0] - 2023-01-24

## [0.18.1] - 2023-01-20

### Changed

- Return service account name when calling `ConnectionProfile.getConnectionProfileByHost`.
- Save missing service account name when calling `ConnectionProfile.saveConnectionProfile`.

### Fixed

- \#165: Frodo now properly lists saved connections in those circumstances where this wasn't the case.

## [0.18.1-0] - 2023-01-16

### Fixed

- \#165: Frodo now properly lists saved connections in those circumstances where this wasn't the case.

## [0.18.0] - 2023-01-13

### Added

- \#68: Support final implementation of Identity Cloud service accounts. Service accounts are the future way for applications to authenticate to Identity Cloud environments without using a personal tenant admin account. Tenant admins can create any number of service accounts and assign sets of privileges to each account. Frodo Library can create service accounts with the required privileges or can use existing service accounts.

  To create a service account use the new ServiceAccount API:

  ```js
  import { createJwkRsa, createJwks, getJwkRsaPublic } from './JoseOps';
  import {
    createServiceAccount,
    isServiceAccountsFeatureAvailable,
  } from './ServiceAccountOps';

  // check if the tenant supports service accounts
  if (isServiceAccountsFeatureAvailable()) {
    const name = 'sa';
    const description = 'service account';
    const accountStatus = 'Active';
    const scopes = ['fr:am:*', 'fr:idm:*', 'fr:idc:esv:*'];
    // create a java web key (JWK) using RSA
    const jwk = await createJwkRsa();
    // extract only the public key as a JWK from the full JWK
    const publicJwk = await getJwkRsaPublic(jwk);
    // create a java wek key set (JWKS) from the public JWK
    const jwks = await createJwks(publicJwk);
    // create service account
    const payload = await ServiceAccount.createServiceAccount(
      name,
      description,
      accountStatus,
      scopes,
      jwks
    );
    // uuid of new service account if creation succeeded
    const saId = payload._id;
  }
  ```

  To use a service account set the following state variables:

  ```js
  import { state } from '@rockcarver/frodo-lib';

  // setting both, id and jwk, instruct the library to use the service account
  state.setServiceAccountId(saId);
  state.setServiceAccountJwk(jwk);
  ```

- Add support for additional environment variables:

- `FRODO_SA_ID`: Service account's uuid. If set, must also set `FRODO_SA_JWK`.

- `FRODO_SA_JWK`: Service account's java web key (jwk) as single-line string. Jwk must contain private key! If set, must also set `FRODO_SA_ID`.

- `FRODO_AUTHENTICATION_SERVICE=journey`: Specify a login journey for frodo to use.

- `FRODO_MOCK=1`: Enable mocking. If enabled, frodo-lib replays recorded API responses instead of connecting to a platform instance.

- `FRODO_POLLY_LOG_LEVEL=info`: Frodo mock engine log level (`trace`, `debug`, `info`, `warn`, `error`, `silent`). This is helpful for troubleshooting the mock capability, only.

  Environment variables added in 0.17.1:

  - `FRODO_HOST`
  - `FRODO_REALM`
  - `FRODO_USERNAME`
  - `FRODO_PASSWORD`
  - `FRODO_SA_ID`
  - `FRODO_SA_JWK`
  - `FRODO_LOG_KEY`
  - `FRODO_LOG_SECRET`
  - `FRODO_DEBUG`

- Add new `InfoOps` module (exported as `Info`) to obtain details about the connected platform instance.

- Add support to delete IDM config entities

- Add function to check RCS status

- Add mock mode for library to allow unit testing of clients using the library, like frodo-cli. This initial release contains minimal mock data. Enable mock mode using `FRODO_MOCK=1`.

- Updated list of contributors in package.json

- More automated tests

### Changed

- Ongoing refactoring of code base:
  - Migrate automated tests from ForgeRockApiMockEngine to Polly.js and snapshots.

### Fixed

- Bug fixes

## [0.17.8-3] - 2023-01-12

## [0.17.8-2] - 2023-01-12

## [0.17.8-1] - 2023-01-12

## [0.17.8-0] - 2023-01-11

## [0.17.7] - 2023-01-11

## [0.17.6] - 2023-01-09

## [0.17.5] - 2023-01-07

## [0.17.5-0] - 2023-01-07

## [0.17.4] - 2023-01-05

## [0.17.3] - 2022-12-30

## [0.17.2] - 2022-12-26

## [0.17.2-0] - 2022-12-21

## [0.17.1] - 2022-12-18

### Added

- \#68: Support upcoming Identity Cloud service accounts. Service accounts are the future way to authenticate to Identity Cloud environments without using a personal tenant admin account. Tenant admins can create any number of service accounts and assign sets of privileges to each account. Frodo Library can create service accounts with the required privileges or can use existing service accounts.

  To create a service account use the new ServiceAccount API:

  ```js
  import { createJwkRsa, createJwks, getJwkRsaPublic } from './JoseOps';
  import {
    createServiceAccount,
    isServiceAccountsFeatureAvailable,
  } from './ServiceAccountOps';

  // check if the tenant supports service accounts
  if (isServiceAccountsFeatureAvailable()) {
    const name = 'sa';
    const description = 'service account';
    const accountStatus = 'Active';
    const scopes = ['fr:am:*', 'fr:idm:*', 'fr:idc:esv:*'];
    // create a java web key (JWK) using RSA
    const jwk = await createJwkRsa();
    // extract only the public key as a JWK from the full JWK
    const publicJwk = await getJwkRsaPublic(jwk);
    // create a java wek key set (JWKS) from the public JWK
    const jwks = await createJwks(publicJwk);
    // create service account
    const payload = await ServiceAccount.createServiceAccount(
      name,
      description,
      accountStatus,
      scopes,
      jwks
    );
    // uuid of new service account if creation succeeded
    const saId = payload._id;
  }
  ```

  To use a service account set the following state variables:

  ```js
  import { state } from '@rockcarver/frodo-lib';

  // setting both, id and jwk, instruct the library to use the service account
  state.setServiceAccountId(saId);
  state.setServiceAccountJwk(jwk);
  ```

- \#154: Frodo-specific transaction id in all API requests: `frodo-<random uuid>`

- Support AM realm and global services.

  ```js
  import { Service } from '@rockcarver/frodo-lib';

  const {
    createServiceExportTemplate,
    deleteFullServices,
    deleteFullService,
    getListOfServices,
    getFullServices,
    exportServices,
    exportService,
    importServices,
    importService,
  } = Service;
  ```

- Support import IDM configuration.

  ```js
  import { Idm } from '@rockcarver/frodo-lib';

  const { putConfigEntity } = Idm;
  ```

- \#139: Support for Agents / Gateways.

  ```js
  import { Agent } from '@rockcarver/frodo-lib';

  const {
    AGENT_TYPE_IG,
    AGENT_TYPE_JAVA,
    AGENT_TYPE_WEB,
    createAgentExportTemplate,
    getAgents,
    getIdentityGatewayAgents,
    getJavaAgents,
    getWebAgents,
    exportAgents,
    exportIdentityGatewayAgents,
    exportJavaAgents,
    exportWebAgents,
    exportAgent,
    exportIdentityGatewayAgent,
    exportJavaAgent,
    exportWebAgent,
    importAgents,
    importIdentityGatewayAgents,
    importJavaAgents,
    importWebAgents,
    importAgent,
    importIdentityGatewayAgent,
    importJavaAgent,
    importWebAgent,
  } = Agent;
  ```

- \#180: Allow all connection parameters to be supplied using environment variables for secure CI/CD:

  - `FRODO_HOST`
  - `FRODO_REALM`
  - `FRODO_USERNAME`
  - `FRODO_PASSWORD`
  - `FRODO_SA_ID`
  - `FRODO_SA_JWK`
  - `FRODO_LOG_KEY`
  - `FRODO_LOG_SECRET`
  - `FRODO_DEBUG`

- \#141: Add curlirizer support for troubleshooting. The library can output curl commands for every REST API call it makes. Clients can use this functionality by registering a curlirize handler and enabling the feature:

  ```js
  import { state } from '@rockcarver/frodo-lib';

  /**
   * Output a curlirize message
   * @param {string} message the message
   */
  export function curlirizeMessage(message) {
    if (!message) return;
    console.error(message['brightBlue']);
  }

  state.setCurlirizeHandler(curlirizeMessage);
  ```

- Added new `raw` Saml2 API functions that use the classic (pre 7.0.0) SAML REST APIs. This allows Frodo to export and import SAML entity providers from pre 7 platform instances.

  ```js
  import { Saml2 } from '@rockcarver/frodo-lib';

  const { getRawProviders, getRawProvider, putRawProvider } = Saml2;
  ```

- More automated tests

### Changed

- rockcarver/frodo-cli#110: Migrate from .frodorc to Connections.json
- Adjust default output:
  - rockcarver/frodo-cli#109: Suppress am version output
  - rockcarver/frodo-cli#102: Verbosity of connection string used
  - rockcarver/frodo-cli#106: Handle non-unique connection name used in cli
- Ongoing refactoring of code base:
  - \#133: Move cli functions from frodo-lib to frodo-cli
  - Refactored Email Template and Theme functionality in lib to remove fs operations from frodo-lib
- Updated package dependencies

### Fixed

- \#194: Default realm is not properly detected and leading to errors
- \#137: Error fetching logs with txId

## [0.17.0] - 2022-12-18 [YANKED]

## [0.16.2-20] - 2022-12-17

## [0.16.2-19] - 2022-12-14

## [0.16.2-18] - 2022-12-14

## [0.16.2-17] - 2022-12-13

## [0.16.2-16] - 2022-12-12

## [0.16.2-15] - 2022-12-10

## [0.16.2-14] - 2022-12-01

## [0.16.2-13] - 2022-11-26

## [0.16.2-12] - 2022-11-26

## [0.16.2-11] - 2022-11-22

- \#154: Add frodo specific transactionId to all API requests
- rockcarver/frodo-cli#110: Migrate from .frodorc to Connections.json
- Refactored Email Template and Theme functionality in lib to remove fs operations

## [0.16.2-10] - 2022-11-22

## [0.16.2-9] - 2022-11-21

## [0.16.2-8] - 2022-11-16

## [0.16.2-7] - 2022-11-16

## [0.16.2-6] - 2022-11-11

## [0.16.2-5] - 2022-11-10

## [0.16.2-0] - 2022-11-10

## [0.16.2-4] - 2022-11-09

## [0.16.2-3] - 2022-11-09

## [0.16.2-2] - 2022-10-28

## [0.16.2-1] - 2022-10-24

### Fixed

- \#137: Error fetching logs with txId
- rockcarver/frodo-cli#109: Suppress am version output
- rockcarver/frodo-cli#102: Verbosity of connection string used
- rockcarver/frodo-cli#106: Handle non-unique connection name used in cli

## [0.16.2-0] - 2022-10-22

## [0.16.1] - 2022-10-19

### Fixed

- rockcarver/frodo-cli#95: Error tailing logs with txId

## [0.16.1] - 2022-10-18

### Changed

- Changelog entry update to trigger minor release

## [0.16.0] - 2022-10-18

### Added

- Ability to fetch historical logs from ID Cloud

## [0.15.2] - 2022-10-17

### Added

- fileByIdTreeExportResolver now supports resolving journey files from subdirectories.

## [0.15.1] - 2022-10-16

### Added

- Backend support for rockcarver/frodo-cli#86:
  - Added field and getters/setters for outputFile to session
  - Added function to append text to file to ExportImportUtils.ts

## [0.15.0] - 2022-10-14

### Added

- rockcarver/frodo-cli#82: Added version update checking

### Changed

- Exposed more api layer modules

## [0.14.2-0] - 2022-10-11

### Added

- rockcarver/frodo-cli#82: Added version update checking

## [0.14.1] - 2022-10-11

### Changed

- Release name is now prefixed with `Frodo Libray` for clarity in notifications.

### Added

- rockcarver/frodo-cli#70: Added ability to create custom logging noise filters
- \#119, #121: Library modules can now produce verbose output Embedding code has to register a verboseHandler and enable verbose flag in session.
- \#120, #122: Library modules can now produce debug output. Embedding code has to register a debugHandler and enable debug flag in session.

### Fixed

- \#116: Frodo now properly imports themes.

## [0.14.0] - 2022-10-11

### Added

- rockcarver/frodo-cli#70: Added ability to create custom logging noise filters
- \#119, #121: Library modules can now produce verbose output Embedding code has to register a verboseHandler and enable verbose flag in session.
- \#120, #122: Library modules can now produce debug output. Embedding code has to register a debugHandler and enable debug flag in session.

### Fixed

- \#116: Frodo now properly imports themes.

## [0.13.2-0] - 2022-10-04

### Added

- rockcarver/frodo-cli#70: Added ability to create custom logging noise filters

## [0.13.1] - 2022-10-04

### Fixed

- \#113: Frodo now properly enables and disables journeys.

## [0.13.0] - 2022-10-04

### Added

- \#110: Added `enableJourney` and `disableJourney` funtions to `JourneyOps.ts` in support of new `frodo-cli` commands `frodo journey enable` and `frodo journey disable`

### Fixed

- \#109: Autonomous Access nodes are now properly classified as `premium` and `cloud`.

## [0.12.7] - 2022-10-02

### Changed

- \#107: Frodo now sets identityResource on import when the target is ID Cloud or ForgeOps but the import file was exported from a classic deployment
- Better journey import resiliency by handling `400 - invalid attribute` errors and retrying without the attributes. This is necessary to import journeys exported from a different version requiring different configuration options. Use the `--verbose` parameter to see when invalid attributes are being removed on import.

## [0.12.6] - 2022-09-30

### Added

- \#104: Enhanced `frodo journey describe` command to include more details

## [0.12.5] - 2022-09-29

### Fixed

- \#98: Frodo now properly runs `frodo idm export -A -D ./idm <host>` command
- \#100: Frodo now properly handles nested realms when specified as `/parent/child`
- \#101: Frodo now properly sets the identity resource when the realm was specified with a leading slash
- \#102: Frodo now properly replaces existing themes on import when the realm was specified with a leading slash

## [0.12.5-0] - 2022-09-19

## [0.12.4] - 2022-09-17

### Added

- Frodo now allows two new parameters when adding a connection profile:

  \--authentication-service [service] Name of the authentication service/tree to use.

  \--authentication-header-overrides [headers] Map of headers: {"host":"am.example.com:8081"}.

  These parameters are currently only supported in the `frodo conn add` command and the configuration elements will be automatically applied to commands issued using that connection profile.

      % frodo conn add https://platform.example.com:9443/am username password --authentication-service ldapService --authentication-header-overrides '{"host":"am.example.com:8081"}' -k
      ForgeOps deployment detected.
      Connected to ForgeRock Access Management 7.2.0 Build 64ef7ebc01ed3df1a1264d7b0400351bc101361f (2022-June-27 08:15)
      Saving creds in /Users/vscheuber/.frodo/.frodorc...
      Updating connection profile https://platform.example.com:9443/am
      Advanced setting: Authentication Service: ldapService
      Advanced setting: Authentication Header Overrides:
      { host: 'am.example.com:8081' }
      %

  After the connection profile is created with the additional parameters, the environment can be accessed as usual. In this case it requires the `-k` parameter for every command, as the environment uses a self-signed certificate.

      % frodo journey list platform alpha -k
      ForgeOps deployment detected.
      Connected to ForgeRock Access Management 7.2.0 Build 64ef7ebc01ed3df1a1264d7b0400351bc101361f (2022-June-27 08:15)
      Listing journeys in realm "alpha"...
      Agent
      Example
      Facebook-ProvisionIDMAccount
      Google-AnonymousUser
      Google-DynamicAccountCreation
      HmacOneTimePassword
      PersistentCookie
      PlatformForgottenUsername
      PlatformLogin
      PlatformProgressiveProfile
      PlatformRegistration
      PlatformResetPassword
      PlatformUpdatePassword
      RetryLimit
      %

### Fixed

- \#94: Frodo can now connect to improperly configured platform instances

## [0.12.3] - 2022-09-16

### Fixed

- \#92: `frodo email template list <host>` now runs properly

## [0.12.2] - 2022-09-15

### Added

- More unit and regression tests

### Changed

- Typify code and restructure api and ops layers for library use. As frodo-lib prepares to be a real library for backend use, some of the existing functions will change to cater to that new role. This is an ongoing effort over the next few patch and minor releases.

### Fixed

- \#33: Describing all journeys in a realm (`frodo journey describe <host>`) now runs properly
- \#69: AM version is now included in export meta data. This will help identify if an export is suitable for import into a target environment based on both origin and target versions.
- \#70: AM version is now stored properly in session storage
- \#71: Importing applications into Catalyst demo environments now works properly
- \#78: `frodo journey list -l <host>` now runs properly
- \#80: `frodo idp export -A <host>` now runs properly
- \#83: `frodo saml export -A <host>` now runs properly
- \#85: `frodo journey export -A <host>` now runs properly
- \#90: Exporting journeys from bravo realm of a cloud tenant now works properly

## [0.12.2-10] - 2022-09-15

## [0.12.2-9] - 2022-09-13

## [0.12.2-8] - 2022-09-12

## [0.12.2-7] - 2022-09-12

## [0.12.2-6] - 2022-09-12

## [0.12.2-5] - 2022-09-09

## [0.12.2-4] - 2022-09-09

## [0.12.2-3] - 2022-09-09

## [0.12.2-2] - 2022-09-09

## [0.12.2-1] - 2022-09-08

## [0.12.2-0] - 2022-09-02

## [0.12.1] - 2022-08-27

### Changed

- \#4: New status and progress framework (reworked Console.js to be client-independent)

### Fixed

- \#22: Fixed a pipeline issue that broke `frodo-cli` binary builds.

## [0.12.1-0] - 2022-08-27 [YANKED]

## [0.12.0] - 2022-08-27 [YANKED]

## [0.11.1-8] - 2022-08-27

### Changed

- \#19: `frodo-lib` is now a typescript project.

## [0.11.1-7] - 2022-08-21

## [0.11.1-6] - 2022-08-21

## [0.11.1-5] - 2022-08-21

## [0.11.1-4] - 2022-08-21

### Changed

- \#10: `frodo-lib` is now a hybrid npm package supporting both ES modules and CommonJS modules.

## [0.11.1-3] - 2022-08-18

## [0.11.1-2] - 2022-08-18

## [0.11.1-1] - 2022-08-18

## [0.11.1-0] - 2022-08-17

## [0.11.0] - 2022-08-16

### Changed

- \#1: Split frodo into frodo-lib and frodo-cli
- \#5: Removed all cli artifacts
- \#2: Made frodo-lib a true library
- \#3: Updated pipeline to build the library package

## [0.10.4] - 2022-08-13

### Added

- \#376: Frodo is now being published as an npm package: @rockcarver/frodo-cli.
- \#317: Binary archive names now include the release version.
- \#369: Added backwards compatibilty with node 16 and 14. Binaries are still built using the latest node version (18). Smoke tests run against all supported versions (18, 16, 14).

### Fixed

- \#368: Progress bar no longer overrides verbose output on journey import.

## [0.10.3] - 2022-08-13 [YANKED]

## [0.10.2] - 2022-08-13 [YANKED]

## [0.10.1] - 2022-08-13 [YANKED]

## [0.10.0] - 2022-08-13 [YANKED]

## [0.9.3-7] - 2022-08-13 [YANKED]

## [0.9.3-6] - 2022-08-13 [YANKED]

## [0.9.3-5] - 2022-08-13 [YANKED]

## [0.9.3-4] - 2022-08-13 [YANKED]

## [0.9.3-3] - 2022-08-13 [YANKED]

## [0.9.3-2] - 2022-08-13 [YANKED]

## [0.9.3-1] - 2022-08-13 [YANKED]

## [0.9.3-0] - 2022-08-12 [YANKED]

## [0.9.2] - 2022-08-11

### Added

- \#205: Added `--no-deps` option to `journey export`/`import` commands. This allows users to omit all external dependencies from a journey export and/or import. One use case where this comes in handy is when using frodo as a CI/CD tool to extract and deploy individual configuration artifacts and it is desirable to not mingle multiple types of configuration in a single file but keep each type of configuration in its own file for version and change control.
- Added `--verbose` option to `journey export` command.
- \#341: Added initial smoke tests to validate basic functionality.

### Changed

- \#363: Frodo now performs dependency resolution and reports unresolved dependencies on single journey imports.
- \#364: Frodo now uses a spinner and no longer a progress bar to indicate progress on single journey imports.
- Internal restructuring (#158, #159, #164, #165)
- Updated PIPELINE.md with latest pipeline changes

### Fixed

- \#359: Frodo now properly exports themes from forgeops deployments.
- \#362: Frodo now properly imports journeys with email templates.
- \#357: Frodo no longer throws an error and exits occasionally when running the `frodo log tail` command.
- \#355: Frodo now properly imports social IDPs into 7.1 environments when using the `frodo journey import` command.
- \#353: Frodo now properly imports social IDPs when using the `frodo journey import` command.
- \#351: Frodo now properly shows IDM messages using the `frodo logs tail` command.
- \#349: Frodo now properly exports journeys from classic deployments

## [0.9.2-12] - 2022-08-09

### Fixed

- \#359: Frodo now properly exports themes from forgeops deployments.

## [0.9.2-11] - 2022-08-09

### Changed

- \#363: Frodo now performs dependency resolution and reports unresolved dependencies on single journey imports.
- \#364: Frodo now uses a spinner and no longer a progress bar to indicate progress on single journey imports.

### Fixed

- \#362: Frodo now properly imports journeys with email templates.

## [0.9.2-10] - 2022-08-05

### Fixed

- \#357: Frodo no longer throws an error and exits occasionally when running the `frodo log tail` command.

## [0.9.2-9] - 2022-07-30

### Fixed

- \#355: Frodo now properly imports social IDPs into 7.1 environments when using the `frodo journey import` command.

## [0.9.2-8] - 2022-07-28

### Fixed

- \#353: Frodo now properly imports social IDPs when using the `frodo journey import` command.

## [0.9.2-7] - 2022-07-28

### Fixed

- \#351: Frodo now properly shows IDM messages using the `frodo logs tail` command.

## [0.9.2-6] - 2022-07-27

### Fixed

- \#349: Frodo now properly exports journeys from classic deployments

## [0.9.2-5] - 2022-07-23

### Changed

- Internal restructuring (#158, #159, #164, #165)

## [0.9.2-4] - 2022-07-22

### Added

- \#341: Added initial smoke tests to validate basic functionality

### Changed

- Updated PIPELINE.md with latest pipeline changes

## [0.9.2-3] - 2022-07-22 [YANKED]

## [0.9.2-2] - 2022-07-22 [YANKED]

## [0.9.2-1] - 2022-07-22 [YANKED]

## [0.9.2-0] - 2022-07-22 [YANKED]

## [0.9.1] - 2022-07-21

### Added

- \#311: Added explicit support for network proxies (`HTTPS_PROXY=<protocol>://<host>:<port>`)
  Frodo now supports using system enviroment variable `HTTPS_PROXY` (and `HTTP_PROXY`) to connect through a network proxy.

### Changed

- Changes to `frodo realm describe` command:
  - The realm argument now exclusively determines the realm
  - Removed `-n`/`--name` parameter
- Internal restructuring (#167)

### Fixed

- \#329: Fixed help info for `esv apply` command
- \#335: Fixed error when running `idm list` command
- \#338: Frodo now successfully authenticates with or without using a proxy

## [0.9.1-1] - 2022-07-21

### Fixed

- \#338: Frodo now successfully authenticates with or without using a proxy

## [0.9.1-0] - 2022-07-21 [YANKED]

## [0.9.0] - 2022-07-21 [YANKED]

## [0.8.2] - 2022-07-17

### Changed

- Changed `idm` sub-commands to align with other commands:
  - The sub-commands `export`, `exportAll`, and `exportAllRaw` have been collapsed into one: `export`
    - `idm export -A` (`--all-separate`) is now the way to export all idm configuration.
      - Options `-e` and `-E` select old `exportAll` functionality with variable replacement and filtering
      - Omitting options `-e` and `-E`, selects the old `exportAllRaw` functionality without variable replacement and without filtering
  - Renamed sample resource files for `idm export` command:
    - `<frodo home>/resources/sampleEntitiesFile.json`
    - `<frodo home>/resources/sampleEnvFile.env`
  - The `-N`/`--name` option of the count command has been renamed to `-m`/`--managed-object`
- Internal restructuring (#137)

### Fixed

- \#325: Frodo now gracefully reports and skips node types causing errors during pruning
- \#331: Frodo now correctly counts managed objects when using the `idm count` command

## [0.8.2-1] - 2022-07-16

### Fixed

- \#325: Frodo now gracefully reports and skips node types causing errors during pruning

## [0.8.2-0] - 2022-07-16 [YANKED]

## [0.8.1] - 2022-07-15

### Added

- New `-l`/`--long` option to script list command

### Changed

- Changed default behavior of `frodo conn add` to validate connection details by default and renamed parameter from `--validate` to `--no-validate` to allow disabling validation
- Internal restructuring (#169)

### Fixed

- \#324: Frodo now includes themes assigned at journey level in journey exports

## [0.8.1-0] - 2022-07-14 [YANKED]

## [0.8.0] - 2022-07-13

### Added

- \#320: Frodo now identifies itself through the User-Agent header `<name>/<version>` (e.g. `frodo/0.7.1-1`)

### Changed

- Renamed `realm details` to `realm describe` but registered `realm details` as an alias for backwards compatibility
- Changes to application command
  - Renamed command to `app` but registered `application` as an alias for backwards compatibility
  - Renamed option `-i`/`--id` to `-i`/`--app-id`. Short version is not impacted by rename.
- Internal restructuring (#133, #134, #141 #142, #146)

### Fixed

- \#319: frodo admin create-oauth2-client-with-admin-privileges --llt properly handles name collisions

## [0.7.1-1] - 2022-07-11

## [0.7.1-0] - 2022-07-10

## [0.7.0] - 2022-07-10

### Added

- CHANGELOG.md
- `conn describe` command to describe connection profiles
  - `--show-secrets` option to `conn describe` command to show clear-text secrets
- `--validate` option to `conn add` command to validate credentials before adding

### Changed

- Adapted true semantic versioning
- Pipeline changes
  - Automated updating changelog using keep a changelog format in CHANGELOG.md
  - Automated version bump (SemVer format) using PR comments to trigger prerelease, patch, minor, or major bumps
  - Automated release notes extraction from CHANGELOG.md
  - Automated GitHub release creation
  - Renamed frodo.yml to pipeline.yml
- Renamed connections command to `conn` with aliases `connection` and `connections` for backwards compatibility
- Internal restructuring (#160, #135)

### Fixed

- \#280: Fixed missing -k/--insecure param in application sub-commands #280
- \#310: No longer storing connection profiles unless explicitly instructed to

## [0.6.4-4] - 2022-07-10 [YANKED]

## [0.6.4-3] - 2022-07-09 [YANKED]

## [0.6.4-2] - 2022-07-09 [YANKED]

## [0.6.4-1] - 2022-07-09 [YANKED]

## [0.6.4-0] - 2022-07-09 [YANKED]

## [0.6.3] - 2022-07-08 [YANKED]

## 0.6.3-alpha.1 - 0.6.3-alpha.51 [YANKED]

## 0.6.2 [YANKED]

## 0.6.1 alpha 26 - 2022-06-28

### Changed

- Changed archive step of Windows binary build to use 7zip

## 0.6.1 alpha 22 - 0.6.1 alpha 25 [YANKED]

## 0.6.1 alpha 21 - 2022-06-27

### Added

- Added theme delete command
- Theme list e2e tests
- Theme delete e2e tests
- Added esv command
  - esv secret - Manage secrets.
  - esv variable - Manage variables.
  - esv apply - Apply pending changes.
- Updated all dependencies to the latest versions

### Changed

- Moved secret command under new esv command

## 0.6.1 alpha 20 - 2022-06-23

### Added

- Added journey delete command
- journey list e2e tests
- journey delete e2e tests

### Changed

- Allow progressbar output to be captured in redirects

### Fixed

- Journey import fixes
- Journey export bug fix
- Fix theme import issues when using /alpha or /bravo instead of alpha or bravo
- Fix admin create-oauth2-client-with-admin-privileges command

## 0.6.1 alpha 19 - 2022-06-14

### Added

- First stab at e2e testing of journey command
- saml command enhancements

### Fixed

- Detect and remove invalid tree attributes on import
- Fixed issue where overriding deployment type would fail to detect the default realm
- Fix theme import -A

## 0.6.1 alpha 18 - 2022-06-10

### Added

- \--txid parameter with the logs commands to filter log output by transactionId

### Fixed

- Bug in idm exportAllRaw

## 0.6.1 alpha 17 - 2022-06-08

### Added

- New saml command to manage entity providers and circles of trust

### Changed

- Updates to journey export/import commands
  - Support for social identity providers
  - Support for themes
  - Support for SAML entity providers
  - Support for SAML circles of trust
  - Breaking changes in journey sub-commands
    - export
      - \-t/--tree renamed to -i/--journey-id
    - import
      - \-t/--tree renamed to -i/--journey-id
      - \-i/--journey-id is now only used to select the journey to import if there are multiple journeys in the import file
      - \-n (No re-UUID) removed
      - new flag --re-uuid with inversed behavior of removed -n flag. Frodo by default no longer generates new UUIDs for nodes on import
- Scalability enhancements to journey prune command. The changes allow the prune command to scale to many thousands of orphaned node configuration objects in an AM instance
- Updated readme
- Miscellaneous bug fixes

## 0.6.1 alpha 14 - 0.6.1 alpha 16 [YANKED]

## 0.6.1 alpha 13 - 2022-05-20

### Added

- New script command to export and import scripts
- New email_templates command to manage email templates
- New application command to export and import oauth2 clients
- New realm command to manage realms
- New secret command to manage Identity Cloud secrets
- New theme command to manage hosted pages UI themes
- New admin command to perform advanced administrative tasks
- Encrypt the password value in the connection profile
- Added progress bars/spinners for long running operations
- Added version option -v, --version
- Auto provisioning of log API keys
- Added initial unit testing

### Changed

- Improved performance of journey command (multi-threading)
- Consolidated settings under one folder (~/.frodo)
- Proposed new code formatting (prettier) and style (eslint) rules
- Updated readme
- Update to node 18

### Fixed

- Fixed problem with adding connection profiles
- Miscellaneous bug fixes

[unreleased]: https://github.com/rockcarver/frodo-lib/compare/v3.1.0...HEAD
[3.1.0]: https://github.com/rockcarver/frodo-lib/compare/v3.0.4-2...v3.1.0
[3.0.4-2]: https://github.com/rockcarver/frodo-lib/compare/v3.0.4-1...v3.0.4-2
[3.0.4-1]: https://github.com/rockcarver/frodo-lib/compare/v3.0.4-0...v3.0.4-1
[3.0.4-0]: https://github.com/rockcarver/frodo-lib/compare/v3.0.3...v3.0.4-0
[3.0.3]: https://github.com/rockcarver/frodo-lib/compare/v3.0.2...v3.0.3
[3.0.2]: https://github.com/rockcarver/frodo-lib/compare/v3.0.1...v3.0.2
[3.0.1]: https://github.com/rockcarver/frodo-lib/compare/v3.0.1-7...v3.0.1
[3.0.1-7]: https://github.com/rockcarver/frodo-lib/compare/v3.0.1-6...v3.0.1-7
[3.0.1-6]: https://github.com/rockcarver/frodo-lib/compare/v3.0.1-5...v3.0.1-6
[3.0.1-5]: https://github.com/rockcarver/frodo-lib/compare/v3.0.1-4...v3.0.1-5
[3.0.1-4]: https://github.com/rockcarver/frodo-lib/compare/v3.0.1-3...v3.0.1-4
[3.0.1-3]: https://github.com/rockcarver/frodo-lib/compare/v3.0.1-2...v3.0.1-3
[3.0.1-2]: https://github.com/rockcarver/frodo-lib/compare/v3.0.1-1...v3.0.1-2
[3.0.1-1]: https://github.com/rockcarver/frodo-lib/compare/v3.0.1-0...v3.0.1-1
[3.0.1-0]: https://github.com/rockcarver/frodo-lib/compare/v3.0.0...v3.0.1-0
[3.0.0]: https://github.com/rockcarver/frodo-lib/compare/v2.3.1-0...v3.0.0
[2.3.1-0]: https://github.com/rockcarver/frodo-lib/compare/v2.3.0...v2.3.1-0
[2.3.0]: https://github.com/rockcarver/frodo-lib/compare/v2.2.1-0...v2.3.0
[2.2.1-0]: https://github.com/rockcarver/frodo-lib/compare/v2.2.0...v2.2.1-0
[2.2.0]: https://github.com/rockcarver/frodo-lib/compare/v2.1.2-0...v2.2.0
[2.1.2-0]: https://github.com/rockcarver/frodo-lib/compare/v2.1.1...v2.1.2-0
[2.1.1]: https://github.com/rockcarver/frodo-lib/compare/v2.1.1-0...v2.1.1
[2.1.1-0]: https://github.com/rockcarver/frodo-lib/compare/v2.1.0...v2.1.1-0
[2.1.0]: https://github.com/rockcarver/frodo-lib/compare/v2.0.4...v2.1.0
[2.0.4]: https://github.com/rockcarver/frodo-lib/compare/v2.0.4-0...v2.0.4
[2.0.4-0]: https://github.com/rockcarver/frodo-lib/compare/v2.0.3...v2.0.4-0
[2.0.3]: https://github.com/rockcarver/frodo-lib/compare/v2.0.2...v2.0.3
[2.0.2]: https://github.com/rockcarver/frodo-lib/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/rockcarver/frodo-lib/compare/v2.0.1-2...v2.0.1
[2.0.1-2]: https://github.com/rockcarver/frodo-lib/compare/v2.0.1-1...v2.0.1-2
[2.0.1-1]: https://github.com/rockcarver/frodo-lib/compare/v2.0.1-0...v2.0.1-1
[2.0.1-0]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0...v2.0.1-0
[2.0.0]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-96...v2.0.0
[2.0.0-96]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-95...v2.0.0-96
[2.0.0-95]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-94...v2.0.0-95
[2.0.0-94]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-93...v2.0.0-94
[2.0.0-93]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-92...v2.0.0-93
[2.0.0-92]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-91...v2.0.0-92
[2.0.0-91]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-90...v2.0.0-91
[2.0.0-90]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-89...v2.0.0-90
[2.0.0-89]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-88...v2.0.0-89
[2.0.0-88]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-87...v2.0.0-88
[2.0.0-87]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-86...v2.0.0-87
[2.0.0-86]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-85...v2.0.0-86
[2.0.0-85]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-84...v2.0.0-85
[2.0.0-84]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-83...v2.0.0-84
[2.0.0-83]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-82...v2.0.0-83
[2.0.0-82]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-81...v2.0.0-82
[2.0.0-81]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-80...v2.0.0-81
[2.0.0-80]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-79...v2.0.0-80
[2.0.0-79]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-78...v2.0.0-79
[2.0.0-78]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-77...v2.0.0-78
[2.0.0-77]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-76...v2.0.0-77
[2.0.0-76]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-75...v2.0.0-76
[2.0.0-75]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-74...v2.0.0-75
[2.0.0-74]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-73...v2.0.0-74
[2.0.0-73]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-72...v2.0.0-73
[2.0.0-72]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-71...v2.0.0-72
[2.0.0-71]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-70...v2.0.0-71
[2.0.0-70]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-69...v2.0.0-70
[2.0.0-69]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-68...v2.0.0-69
[2.0.0-68]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-67...v2.0.0-68
[2.0.0-67]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-66...v2.0.0-67
[2.0.0-66]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-65...v2.0.0-66
[2.0.0-65]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-64...v2.0.0-65
[2.0.0-64]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-63...v2.0.0-64
[2.0.0-63]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-62...v2.0.0-63
[2.0.0-62]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-61...v2.0.0-62
[2.0.0-61]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-60...v2.0.0-61
[2.0.0-60]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-59...v2.0.0-60
[2.0.0-59]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-58...v2.0.0-59
[2.0.0-58]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-57...v2.0.0-58
[2.0.0-57]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-56...v2.0.0-57
[2.0.0-56]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-55...v2.0.0-56
[2.0.0-55]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-54...v2.0.0-55
[2.0.0-54]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-53...v2.0.0-54
[2.0.0-53]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-52...v2.0.0-53
[2.0.0-52]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-51...v2.0.0-52
[2.0.0-51]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-50...v2.0.0-51
[2.0.0-50]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-49...v2.0.0-50
[2.0.0-49]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-48...v2.0.0-49
[2.0.0-48]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-47...v2.0.0-48
[2.0.0-47]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-46...v2.0.0-47
[2.0.0-46]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-45...v2.0.0-46
[2.0.0-45]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-44...v2.0.0-45
[2.0.0-44]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-43...v2.0.0-44
[2.0.0-43]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-42...v2.0.0-43
[2.0.0-42]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-41...v2.0.0-42
[2.0.0-41]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-40...v2.0.0-41
[2.0.0-40]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-39...v2.0.0-40
[2.0.0-39]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-38...v2.0.0-39
[2.0.0-38]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-37...v2.0.0-38
[2.0.0-37]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-36...v2.0.0-37
[2.0.0-36]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-35...v2.0.0-36
[2.0.0-35]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-34...v2.0.0-35
[2.0.0-34]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-33...v2.0.0-34
[2.0.0-33]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-32...v2.0.0-33
[2.0.0-32]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-31...v2.0.0-32
[2.0.0-31]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-30...v2.0.0-31
[2.0.0-30]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-29...v2.0.0-30
[2.0.0-29]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-28...v2.0.0-29
[2.0.0-28]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-27...v2.0.0-28
[2.0.0-27]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-26...v2.0.0-27
[2.0.0-26]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-25...v2.0.0-26
[2.0.0-25]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-24...v2.0.0-25
[2.0.0-24]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-23...v2.0.0-24
[2.0.0-23]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-22...v2.0.0-23
[2.0.0-22]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-21...v2.0.0-22
[2.0.0-21]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-20...v2.0.0-21
[2.0.0-20]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-19...v2.0.0-20
[2.0.0-19]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-18...v2.0.0-19
[2.0.0-18]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-17...v2.0.0-18
[2.0.0-17]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-16...v2.0.0-17
[2.0.0-16]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-15...v2.0.0-16
[2.0.0-15]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-14...v2.0.0-15
[2.0.0-14]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-13...v2.0.0-14
[2.0.0-13]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-12...v2.0.0-13
[2.0.0-12]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-11...v2.0.0-12
[2.0.0-11]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-10...v2.0.0-11
[2.0.0-10]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-9...v2.0.0-10
[2.0.0-9]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-8...v2.0.0-9
[2.0.0-8]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-7...v2.0.0-8
[2.0.0-7]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-6...v2.0.0-7
[2.0.0-6]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-5...v2.0.0-6
[2.0.0-5]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-4...v2.0.0-5
[2.0.0-4]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-3...v2.0.0-4
[2.0.0-3]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-2...v2.0.0-3
[2.0.0-2]: https://github.com/rockcarver/frodo-lib/compare/v2.0.0-1...v2.0.0-2
[2.0.0-1]: https://github.com/rockcarver/frodo-lib/compare/v0.19.2...v2.0.0-1
[1.1.0]: https://github.com/rockcarver/frodo-lib/compare/v1.0.1-1...v1.1.0
[1.0.1-1]: https://github.com/rockcarver/frodo-lib/compare/v1.0.1-0...v1.0.1-1
[1.0.1-0]: https://github.com/rockcarver/frodo-lib/compare/v1.0.0...v1.0.1-0
[1.0.0]: https://github.com/rockcarver/frodo-lib/compare/v0.19.2...v1.0.0
[0.19.2]: https://github.com/rockcarver/frodo-lib/compare/v0.19.1...v0.19.2
[0.19.1]: https://github.com/rockcarver/frodo-lib/compare/v0.19.0...v0.19.1
[0.19.0]: https://github.com/rockcarver/frodo-lib/compare/v0.18.9-7...v0.19.0
[0.18.9-7]: https://github.com/rockcarver/frodo-lib/compare/v0.18.9-6...v0.18.9-7
[0.18.9-6]: https://github.com/rockcarver/frodo-lib/compare/v0.18.9-5...v0.18.9-6
[0.18.9-5]: https://github.com/rockcarver/frodo-lib/compare/v0.18.9-4...v0.18.9-5
[0.18.9-4]: https://github.com/rockcarver/frodo-lib/compare/v0.18.9-3...v0.18.9-4
[0.18.9-3]: https://github.com/rockcarver/frodo-lib/compare/v0.18.9-2...v0.18.9-3
[0.18.9-2]: https://github.com/rockcarver/frodo-lib/compare/v0.18.9-1...v0.18.9-2
[0.18.9-1]: https://github.com/rockcarver/frodo-lib/compare/v0.18.9-0...v0.18.9-1
[0.18.9-0]: https://github.com/rockcarver/frodo-lib/compare/v0.18.8...v0.18.9-0
[0.18.8]: https://github.com/rockcarver/frodo-lib/compare/v0.18.7...v0.18.8
[0.18.7]: https://github.com/rockcarver/frodo-lib/compare/v0.18.6...v0.18.7
[0.18.6]: https://github.com/rockcarver/frodo-lib/compare/v0.18.5...v0.18.6
[0.18.5]: https://github.com/rockcarver/frodo-lib/compare/v0.18.4...v0.18.5
[0.18.4]: https://github.com/rockcarver/frodo-lib/compare/v0.18.3...v0.18.4
[0.18.3]: https://github.com/rockcarver/frodo-lib/compare/v0.18.2...v0.18.3
[0.18.2]: https://github.com/rockcarver/frodo-lib/compare/v0.18.2-0...v0.18.2
[0.18.2-0]: https://github.com/rockcarver/frodo-lib/compare/v0.18.1...v0.18.2-0
[0.18.1]: https://github.com/rockcarver/frodo-lib/compare/v0.18.1-0...v0.18.1
[0.18.1-0]: https://github.com/rockcarver/frodo-lib/compare/v0.18.0...v0.18.1-0
[0.18.0]: https://github.com/rockcarver/frodo-lib/compare/v0.17.8-3...v0.18.0
[0.17.8-3]: https://github.com/rockcarver/frodo-lib/compare/v0.17.8-2...v0.17.8-3
[0.17.8-2]: https://github.com/rockcarver/frodo-lib/compare/v0.17.8-1...v0.17.8-2
[0.17.8-1]: https://github.com/rockcarver/frodo-lib/compare/v0.17.8-0...v0.17.8-1
[0.17.8-0]: https://github.com/rockcarver/frodo-lib/compare/v0.17.7...v0.17.8-0
[0.17.7]: https://github.com/rockcarver/frodo-lib/compare/v0.17.6...v0.17.7
[0.17.6]: https://github.com/rockcarver/frodo-lib/compare/v0.17.5...v0.17.6
[0.17.5]: https://github.com/rockcarver/frodo-lib/compare/v0.17.5-0...v0.17.5
[0.17.5-0]: https://github.com/rockcarver/frodo-lib/compare/v0.17.4...v0.17.5-0
[0.17.4]: https://github.com/rockcarver/frodo-lib/compare/v0.17.3...v0.17.4
[0.17.3]: https://github.com/rockcarver/frodo-lib/compare/v0.17.2...v0.17.3
[0.17.2]: https://github.com/rockcarver/frodo-lib/compare/v0.17.2-0...v0.17.2
[0.17.2-0]: https://github.com/rockcarver/frodo-lib/compare/v0.17.1...v0.17.2-0
[0.17.1]: https://github.com/rockcarver/frodo-lib/compare/v0.17.0...v0.17.1
[0.17.0]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-20...v0.17.0
[0.16.2-20]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-19...v0.16.2-20
[0.16.2-19]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-18...v0.16.2-19
[0.16.2-18]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-17...v0.16.2-18
[0.16.2-17]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-16...v0.16.2-17
[0.16.2-16]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-15...v0.16.2-16
[0.16.2-15]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-14...v0.16.2-15
[0.16.2-14]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-13...v0.16.2-14
[0.16.2-13]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-12...v0.16.2-13
[0.16.2-12]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-11...v0.16.2-12
[0.16.2-11]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-10...v0.16.2-11
[0.16.2-10]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-9...v0.16.2-10
[0.16.2-9]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-8...v0.16.2-9
[0.16.2-8]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-7...v0.16.2-8
[0.16.2-7]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-6...v0.16.2-7
[0.16.2-6]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-5...v0.16.2-6
[0.16.2-5]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-0...v0.16.2-5
[0.16.2-0]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-4...v0.16.2-0
[0.16.2-4]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-3...v0.16.2-4
[0.16.2-3]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-2...v0.16.2-3
[0.16.2-2]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-1...v0.16.2-2
[0.16.2-1]: https://github.com/rockcarver/frodo-lib/compare/v0.16.2-0...v0.16.2-1
[0.16.2-0]: https://github.com/rockcarver/frodo-lib/compare/v0.16.1...v0.16.2-0
[0.16.1]: https://github.com/rockcarver/frodo-lib/compare/v0.16.0...v0.16.1
[0.16.0]: https://github.com/rockcarver/frodo-lib/compare/v0.15.3-0...v0.16.0
[0.15.3-0]: https://github.com/rockcarver/frodo-lib/compare/v0.15.2...v0.15.3-0
[0.15.2]: https://github.com/rockcarver/frodo-lib/compare/v0.15.1...v0.15.2
[0.15.1]: https://github.com/rockcarver/frodo-lib/compare/v0.15.0...v0.15.1
[0.15.0]: https://github.com/rockcarver/frodo-lib/compare/v0.14.2-0...v0.15.0
[0.14.2-0]: https://github.com/rockcarver/frodo-lib/compare/v0.14.1...v0.14.2-0
[0.14.1]: https://github.com/rockcarver/frodo-lib/compare/v0.14.0...v0.14.1
[0.14.0]: https://github.com/rockcarver/frodo-lib/compare/v0.13.2-0...v0.14.0
[0.13.2-0]: https://github.com/rockcarver/frodo-lib/compare/v0.13.1...v0.13.2-0
[0.13.1]: https://github.com/rockcarver/frodo-lib/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/rockcarver/frodo-lib/compare/v0.12.7...v0.13.0
[0.12.7]: https://github.com/rockcarver/frodo-lib/compare/v0.12.6...v0.12.7
[0.12.6]: https://github.com/rockcarver/frodo-lib/compare/v0.12.5...v0.12.6
[0.12.5]: https://github.com/rockcarver/frodo-lib/compare/v0.12.5-0...v0.12.5
[0.12.5-0]: https://github.com/rockcarver/frodo-lib/compare/v0.12.4...v0.12.5-0
[0.12.4]: https://github.com/rockcarver/frodo-lib/compare/v0.12.3...v0.12.4
[0.12.3]: https://github.com/rockcarver/frodo-lib/compare/v0.12.2...v0.12.3
[0.12.2]: https://github.com/rockcarver/frodo-lib/compare/v0.12.2-10...v0.12.2
[0.12.2-10]: https://github.com/rockcarver/frodo-lib/compare/v0.12.2-9...v0.12.2-10
[0.12.2-9]: https://github.com/rockcarver/frodo-lib/compare/v0.12.2-8...v0.12.2-9
[0.12.2-8]: https://github.com/rockcarver/frodo-lib/compare/v0.12.2-7...v0.12.2-8
[0.12.2-7]: https://github.com/rockcarver/frodo-lib/compare/v0.12.2-6...v0.12.2-7
[0.12.2-6]: https://github.com/rockcarver/frodo-lib/compare/v0.12.2-5...v0.12.2-6
[0.12.2-5]: https://github.com/rockcarver/frodo-lib/compare/v0.12.2-4...v0.12.2-5
[0.12.2-4]: https://github.com/rockcarver/frodo-lib/compare/v0.12.2-3...v0.12.2-4
[0.12.2-3]: https://github.com/rockcarver/frodo-lib/compare/v0.12.2-2...v0.12.2-3
[0.12.2-2]: https://github.com/rockcarver/frodo-lib/compare/v0.12.2-1...v0.12.2-2
[0.12.2-1]: https://github.com/rockcarver/frodo-lib/compare/v0.12.2-0...v0.12.2-1
[0.12.2-0]: https://github.com/rockcarver/frodo-lib/compare/v0.12.1...v0.12.2-0
[0.12.1]: https://github.com/rockcarver/frodo-lib/compare/v0.12.1-0...v0.12.1
[0.12.1-0]: https://github.com/rockcarver/frodo-lib/compare/v0.12.0...v0.12.1-0
[0.12.0]: https://github.com/rockcarver/frodo-lib/compare/v0.11.1-8...v0.12.0
[0.11.1-8]: https://github.com/rockcarver/frodo-lib/compare/v0.11.1-7...v0.11.1-8
[0.11.1-7]: https://github.com/rockcarver/frodo-lib/compare/v0.11.1-6...v0.11.1-7
[0.11.1-6]: https://github.com/rockcarver/frodo-lib/compare/v0.11.1-5...v0.11.1-6
[0.11.1-5]: https://github.com/rockcarver/frodo-lib/compare/v0.11.1-4...v0.11.1-5
[0.11.1-4]: https://github.com/rockcarver/frodo-lib/compare/v0.11.1-3...v0.11.1-4
[0.11.1-3]: https://github.com/rockcarver/frodo-lib/compare/v0.11.1-2...v0.11.1-3
[0.11.1-2]: https://github.com/rockcarver/frodo-lib/compare/v0.11.1-1...v0.11.1-2
[0.11.1-1]: https://github.com/rockcarver/frodo-lib/compare/v0.11.1-0...v0.11.1-1
[0.11.1-0]: https://github.com/rockcarver/frodo-lib/compare/v0.10.4...v0.11.1-0
[0.10.4]: https://github.com/rockcarver/frodo/compare/v0.10.3...v0.10.4
[0.10.3]: https://github.com/rockcarver/frodo/compare/v0.10.3-0...v0.10.3
[0.10.3-0]: https://github.com/rockcarver/frodo/compare/v0.10.2...v0.10.3-0
[0.10.2]: https://github.com/rockcarver/frodo/compare/v0.10.2-0...v0.10.2
[0.10.2-0]: https://github.com/rockcarver/frodo/compare/v0.10.1...v0.10.2-0
[0.10.1]: https://github.com/rockcarver/frodo/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/rockcarver/frodo/compare/v0.9.3-7...v0.10.0
[0.9.3-7]: https://github.com/rockcarver/frodo/compare/v0.9.3-6...v0.9.3-7
[0.9.3-6]: https://github.com/rockcarver/frodo/compare/v0.9.3-5...v0.9.3-6
[0.9.3-5]: https://github.com/rockcarver/frodo/compare/v0.9.3-4...v0.9.3-5
[0.9.3-4]: https://github.com/rockcarver/frodo/compare/v0.9.3-3...v0.9.3-4
[0.9.3-3]: https://github.com/rockcarver/frodo/compare/v0.9.3-2...v0.9.3-3
[0.9.3-2]: https://github.com/rockcarver/frodo/compare/v0.9.3-1...v0.9.3-2
[0.9.3-1]: https://github.com/rockcarver/frodo/compare/v0.9.3-0...v0.9.3-1
[0.9.3-0]: https://github.com/rockcarver/frodo/compare/v0.9.2...v0.9.3-0
[0.9.2]: https://github.com/rockcarver/frodo/compare/v0.9.2-12...v0.9.2
[0.9.2-12]: https://github.com/rockcarver/frodo/compare/v0.9.2-11...v0.9.2-12
[0.9.2-11]: https://github.com/rockcarver/frodo/compare/v0.9.2-10...v0.9.2-11
[0.9.2-10]: https://github.com/rockcarver/frodo/compare/v0.9.2-9...v0.9.2-10
[0.9.2-9]: https://github.com/rockcarver/frodo/compare/v0.9.2-8...v0.9.2-9
[0.9.2-8]: https://github.com/rockcarver/frodo/compare/v0.9.2-7...v0.9.2-8
[0.9.2-7]: https://github.com/rockcarver/frodo/compare/v0.9.2-6...v0.9.2-7
[0.9.2-6]: https://github.com/rockcarver/frodo/compare/v0.9.2-5...v0.9.2-6
[0.9.2-5]: https://github.com/rockcarver/frodo/compare/v0.9.2-4...v0.9.2-5
[0.9.2-4]: https://github.com/rockcarver/frodo/compare/v0.9.2-3...v0.9.2-4
[0.9.2-3]: https://github.com/rockcarver/frodo/compare/v0.9.2-2...v0.9.2-3
[0.9.2-2]: https://github.com/rockcarver/frodo/compare/v0.9.2-1...v0.9.2-2
[0.9.2-1]: https://github.com/rockcarver/frodo/compare/v0.9.2-0...v0.9.2-1
[0.9.2-0]: https://github.com/rockcarver/frodo/compare/v0.9.1...v0.9.2-0
[0.9.1]: https://github.com/rockcarver/frodo/compare/v0.9.1-1...v0.9.1
[0.9.1-1]: https://github.com/rockcarver/frodo/compare/v0.9.1-0...v0.9.1-1
[0.9.1-0]: https://github.com/rockcarver/frodo/compare/v0.9.0...v0.9.1-0
[0.9.0]: https://github.com/rockcarver/frodo/compare/v0.8.2...v0.9.0
[0.8.2]: https://github.com/rockcarver/frodo/compare/v0.8.2-1...v0.8.2
[0.8.2-1]: https://github.com/rockcarver/frodo/compare/v0.8.2-0...v0.8.2-1
[0.8.2-0]: https://github.com/rockcarver/frodo/compare/v0.8.1...v0.8.2-0
[0.8.1]: https://github.com/rockcarver/frodo/compare/v0.8.1-0...v0.8.1
[0.8.1-0]: https://github.com/rockcarver/frodo/compare/v0.8.0...v0.8.1-0
[0.8.0]: https://github.com/rockcarver/frodo/compare/v0.7.1-1...v0.8.0
[0.7.1-1]: https://github.com/rockcarver/frodo/compare/v0.7.1-0...v0.7.1-1
[0.7.1-0]: https://github.com/rockcarver/frodo/compare/v0.7.0...v0.7.1-0
[0.7.0]: https://github.com/rockcarver/frodo/compare/v0.6.4-4...v0.7.0
[0.6.4-4]: https://github.com/rockcarver/frodo/compare/v0.6.4-3...v0.6.4-4
[0.6.4-3]: https://github.com/rockcarver/frodo/compare/v0.6.4-2...v0.6.4-3
[0.6.4-2]: https://github.com/rockcarver/frodo/compare/v0.6.4-1...v0.6.4-2
[0.6.4-1]: https://github.com/rockcarver/frodo/compare/v0.6.4-0...v0.6.4-1
[0.6.4-0]: https://github.com/rockcarver/frodo/compare/v0.6.3...v0.6.4-0
[0.6.3]: https://github.com/rockcarver/frodo/compare/v0.6.3-alpha.51...v0.6.3
[0.6.3-alpha.51]: https://github.com/rockcarver/frodo/compare/6137b8b19f1c22af40af5afbf7a2e6c5a95b61cb...v0.6.3-alpha.51
