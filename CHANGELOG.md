# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.18.9-5] - 2023-05-17

## [0.18.9-4] - 2023-04-20

### Fixed

-   \#236: Frodo now properly handles logging in as a tenant admin when admin federation is enabled.

## [0.18.9-3] - 2023-04-18

## [0.18.9-2] - 2023-04-05

## [0.18.9-1] - 2023-03-27

### Fixed

-   rockcarver/frodo-cli#218: Frodo now allows 3 errors when polling for status during a `frodo esv apply` before aborting.

## [0.18.9-0] - 2023-03-23

### Added

-   rockcarver/frodo-cli#213: More debug logging for connection profile lookup by a unique substring. Use --debug to see the additional output. This is not yet a solution for rockcarver/frodo-cli#213 but should help identify the root cause.
-   rockcarver/frodo-cli#216: More debug logging for the 2fa process and proper detection of unsupported webauthn factor.

## [0.18.8] - 2023-02-17

### Added

-   Support for node 19.

## [0.18.7] - 2023-02-16

## [0.18.6] - 2023-02-16

### Changed

-   Updated dependencies.

## [0.18.5] - 2023-02-14

### Fixed

-   rockcarver/frodo-cli#196 and rockcarver/frodo-cli#197: Frodo now properly detects Encore environments as ForgeOps environments and obtains an access token for IDM APIs.

## [0.18.4] - 2023-02-11

### Fixed

-   rockcarver/frodo-cli#195: Backend support to fix issue: `Authenticate.getTokens` API now supports new `forceLoginAsUser` param to force logging in as a user even if a service account is available.

## [0.18.3] - 2023-01-27

### Changed

-   rockcarver/frodo-cli#192: Backend support for better error handling and reporting in frodo-cli

## [0.18.2] - 2023-01-25

### Added

-   rockcarver/frodo-cli#52: Library support for script extract and watch functionality

### Fixed

-   rockcarver/frodo-cli#190: Frodo now properly imports previously exported saml providers.

## [0.18.2-0] - 2023-01-24

## [0.18.1] - 2023-01-20

### Changed

-   Return service account name when calling `ConnectionProfile.getConnectionProfileByHost`.
-   Save missing service account name when calling `ConnectionProfile.saveConnectionProfile`.

### Fixed

-   \#165: Frodo now properly lists saved connections in those circumstances where this wasn't the case.

## [0.18.1-0] - 2023-01-16

### Fixed

-   \#165: Frodo now properly lists saved connections in those circumstances where this wasn't the case. 

## [0.18.0] - 2023-01-13

### Added

-   \#68: Support final implementation of Identity Cloud service accounts. Service accounts are the future way for applications to authenticate to Identity Cloud environments without using a personal tenant admin account. Tenant admins can create any number of service accounts and assign sets of privileges to each account. Frodo Library can create service accounts with the required privileges or can use existing service accounts.

    To create a service account use the new ServiceAccount API:

    ```js
    import { createJwkRsa, createJwks, getJwkRsaPublic } from './JoseOps';
    import { createServiceAccount, isServiceAccountsFeatureAvailable } from './ServiceAccountOps';

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

-   Add support for additional environment variables:

-   `FRODO_SA_ID`: Service account's uuid. If set, must also set `FRODO_SA_JWK`.

-   `FRODO_SA_JWK`: Service account's java web key (jwk) as single-line string. Jwk must contain private key! If set, must also set `FRODO_SA_ID`.

-   `FRODO_AUTHENTICATION_SERVICE=journey`: Specify a login journey for frodo to use.

-   `FRODO_MOCK=1`: Enable mocking. If enabled, frodo-lib replays recorded API responses instead of connecting to a platform instance.

-   `FRODO_POLLY_LOG_LEVEL=info`: Frodo mock engine log level (`trace`, `debug`, `info`, `warn`, `error`, `silent`). This is helpful for troubleshooting the mock capability, only.

    Environment variables added in 0.17.1:

    -   `FRODO_HOST`
    -   `FRODO_REALM`
    -   `FRODO_USERNAME`
    -   `FRODO_PASSWORD`
    -   `FRODO_SA_ID`
    -   `FRODO_SA_JWK`
    -   `FRODO_LOG_KEY`
    -   `FRODO_LOG_SECRET`
    -   `FRODO_DEBUG`

-   Add new `InfoOps` module (exported as `Info`) to obtain details about the connected platform instance.

-   Add support to delete IDM config entities

-   Add function to check RCS status

-   Add mock mode for library to allow unit testing of clients using the library, like frodo-cli. This initial release contains minimal mock data. Enable mock mode using `FRODO_MOCK=1`.

-   Updated list of contributors in package.json

-   More automated tests

### Changed

-   Ongoing refactoring of code base:
    -   Migrate automated tests from ForgeRockApiMockEngine to Polly.js and snapshots.

### Fixed

-   Bug fixes

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

-   \#68: Support upcoming Identity Cloud service accounts. Service accounts are the future way to authenticate to Identity Cloud environments without using a personal tenant admin account. Tenant admins can create any number of service accounts and assign sets of privileges to each account. Frodo Library can create service accounts with the required privileges or can use existing service accounts.

    To create a service account use the new ServiceAccount API:

    ```js
    import { createJwkRsa, createJwks, getJwkRsaPublic } from './JoseOps';
    import { createServiceAccount, isServiceAccountsFeatureAvailable } from './ServiceAccountOps';

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

-   \#154: Frodo-specific transaction id in all API requests: `frodo-<random uuid>`

-   Support AM realm and global services.

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

-   Support import IDM configuration.

    ```js
    import { Idm } from '@rockcarver/frodo-lib';

    const { putConfigEntity } = Idm;
    ```

-   \#139: Support for Agents / Gateways.

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

-   \#180: Allow all connection parameters to be supplied using environment variables for secure CI/CD:
    -   `FRODO_HOST`
    -   `FRODO_REALM`
    -   `FRODO_USERNAME`
    -   `FRODO_PASSWORD`
    -   `FRODO_SA_ID`
    -   `FRODO_SA_JWK`
    -   `FRODO_LOG_KEY`
    -   `FRODO_LOG_SECRET`
    -   `FRODO_DEBUG`

-   \#141: Add curlirizer support for troubleshooting. The library can output curl commands for every REST API call it makes. Clients can use this functionality by registering a curlirize handler and enabling the feature:

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

-   Added new `raw` Saml2 API functions that use the classic (pre 7.0.0) SAML REST APIs. This allows Frodo to export and import SAML entity providers from pre 7 platform instances.

    ```js
    import { Saml2 } from '@rockcarver/frodo-lib';

    const {
        getRawProviders,
        getRawProvider,
        putRawProvider,
    } = Saml2;
    ```

-   More automated tests

### Changed

-   rockcarver/frodo-cli#110: Migrate from .frodorc to Connections.json
-   Adjust default output:
    -   rockcarver/frodo-cli#109: Suppress am version output
    -   rockcarver/frodo-cli#102: Verbosity of connection string used
    -   rockcarver/frodo-cli#106: Handle non-unique connection name used in cli
-   Ongoing refactoring of code base:
    -   \#133: Move cli functions from frodo-lib to frodo-cli
    -   Refactored Email Template and Theme functionality in lib to remove fs operations from frodo-lib
-   Updated package dependencies

### Fixed

-   \#194: Default realm is not properly detected and leading to errors
-   \#137: Error fetching logs with txId

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

-   \#154: Add frodo specific transactionId to all API requests
-   rockcarver/frodo-cli#110: Migrate from .frodorc to Connections.json
-   Refactored Email Template and Theme functionality in lib to remove fs operations

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

-   \#137: Error fetching logs with txId
-   rockcarver/frodo-cli#109: Suppress am version output
-   rockcarver/frodo-cli#102: Verbosity of connection string used
-   rockcarver/frodo-cli#106: Handle non-unique connection name used in cli

## [0.16.2-0] - 2022-10-22

## [0.16.1] - 2022-10-19

### Fixed

-   rockcarver/frodo-cli#95: Error tailing logs with txId

## [0.16.1] - 2022-10-18

### Changed

-   Changelog entry update to trigger minor release

## [0.16.0] - 2022-10-18

### Added

-   Ability to fetch historical logs from ID Cloud

## [0.15.2] - 2022-10-17

### Added

-   fileByIdTreeExportResolver now supports resolving journey files from subdirectories.

## [0.15.1] - 2022-10-16

### Added

-   Backend support for rockcarver/frodo-cli#86:
    -   Added field and getters/setters for outputFile to session
    -   Added function to append text to file to ExportImportUtils.ts

## [0.15.0] - 2022-10-14

### Added

-   rockcarver/frodo-cli#82: Added version update checking

### Changed

-   Exposed more api layer modules

## [0.14.2-0] - 2022-10-11

### Added

-   rockcarver/frodo-cli#82: Added version update checking

## [0.14.1] - 2022-10-11

### Changed

-   Release name is now prefixed with `Frodo Libray` for clarity in notifications.

### Added

-   rockcarver/frodo-cli#70: Added ability to create custom logging noise filters
-   \#119, #121: Library modules can now produce verbose output Embedding code has to register a verboseHandler and enable verbose flag in session.
-   \#120, #122: Library modules can now produce debug output. Embedding code has to register a debugHandler and enable debug flag in session.

### Fixed

-   \#116: Frodo now properly imports themes.

## [0.14.0] - 2022-10-11

### Added

-   rockcarver/frodo-cli#70: Added ability to create custom logging noise filters
-   \#119, #121: Library modules can now produce verbose output Embedding code has to register a verboseHandler and enable verbose flag in session.
-   \#120, #122: Library modules can now produce debug output. Embedding code has to register a debugHandler and enable debug flag in session.

### Fixed

-   \#116: Frodo now properly imports themes.

## [0.13.2-0] - 2022-10-04

### Added

-   rockcarver/frodo-cli#70: Added ability to create custom logging noise filters

## [0.13.1] - 2022-10-04

### Fixed

-   \#113: Frodo now properly enables and disables journeys.

## [0.13.0] - 2022-10-04

### Added

-   \#110: Added `enableJourney` and `disableJourney` funtions to `JourneyOps.ts` in support of new `frodo-cli` commands `frodo journey enable` and `frodo journey disable`

### Fixed

-   \#109: Autonomous Access nodes are now properly classified as `premium` and `cloud`.

## [0.12.7] - 2022-10-02

### Changed

-   \#107: Frodo now sets identityResource on import when the target is ID Cloud or ForgeOps but the import file was exported from a classic deployment
-   Better journey import resiliency by handling `400 - invalid attribute` errors and retrying without the attributes. This is necessary to import journeys exported from a different version requiring different configuration options. Use the `--verbose` parameter to see when invalid attributes are being removed on import.

## [0.12.6] - 2022-09-30

### Added

-   \#104: Enhanced `frodo journey describe` command to include more details

## [0.12.5] - 2022-09-29

### Fixed

-   \#98: Frodo now properly runs `frodo idm export -A -D ./idm <host>` command
-   \#100: Frodo now properly handles nested realms when specified as `/parent/child`
-   \#101: Frodo now properly sets the identity resource when the realm was specified with a leading slash
-   \#102: Frodo now properly replaces existing themes on import when the realm was specified with a leading slash

## [0.12.5-0] - 2022-09-19

## [0.12.4] - 2022-09-17

### Added

-   Frodo now allows two new parameters when adding a connection profile:

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

-   \#94: Frodo can now connect to improperly configured platform instances

## [0.12.3] - 2022-09-16

### Fixed

-   \#92: `frodo email template list <host>` now runs properly

## [0.12.2] - 2022-09-15

### Added

-   More unit and regression tests

### Changed

-   Typify code and restructure api and ops layers for library use. As frodo-lib prepares to be a real library for backend use, some of the existing functions will change to cater to that new role. This is an ongoing effort over the next few patch and minor releases.

### Fixed

-   \#33: Describing all journeys in a realm (`frodo journey describe <host>`) now runs properly
-   \#69: AM version is now included in export meta data. This will help identify if an export is suitable for import into a target environment based on both origin and target versions.
-   \#70: AM version is now stored properly in session storage
-   \#71: Importing applications into Catalyst demo environments now works properly
-   \#78: `frodo journey list -l <host>` now runs properly
-   \#80: `frodo idp export -A <host>` now runs properly
-   \#83: `frodo saml export -A <host>` now runs properly
-   \#85: `frodo journey export -A <host>` now runs properly
-   \#90: Exporting journeys from bravo realm of a cloud tenant now works properly

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

-   \#4: New status and progress framework (reworked Console.js to be client-independent)

### Fixed

-   \#22: Fixed a pipeline issue that broke `frodo-cli` binary builds.

## [0.12.1-0] - 2022-08-27 [YANKED]

## [0.12.0] - 2022-08-27 [YANKED]

## [0.11.1-8] - 2022-08-27

### Changed

-   \#19: `frodo-lib` is now a typescript project.

## [0.11.1-7] - 2022-08-21

## [0.11.1-6] - 2022-08-21

## [0.11.1-5] - 2022-08-21

## [0.11.1-4] - 2022-08-21

### Changed

-   \#10: `frodo-lib` is now a hybrid npm package supporting both ES modules and CommonJS modules.

## [0.11.1-3] - 2022-08-18

## [0.11.1-2] - 2022-08-18

## [0.11.1-1] - 2022-08-18

## [0.11.1-0] - 2022-08-17

## [0.11.0] - 2022-08-16

### Changed

-   \#1: Split frodo into frodo-lib and frodo-cli
-   \#5: Removed all cli artifacts
-   \#2: Made frodo-lib a true library
-   \#3: Updated pipeline to build the library package

## [0.10.4] - 2022-08-13

### Added

-   \#376: Frodo is now being published as an npm package: @rockcarver/frodo-cli.
-   \#317: Binary archive names now include the release version.
-   \#369: Added backwards compatibilty with node 16 and 14. Binaries are still built using the latest node version (18). Smoke tests run against all supported versions (18, 16, 14).

### Fixed

-   \#368: Progress bar no longer overrides verbose output on journey import.

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

-   \#205: Added `--no-deps` option to `journey export`/`import` commands. This allows users to omit all external dependencies from a journey export and/or import. One use case where this comes in handy is when using frodo as a CI/CD tool to extract and deploy individual configuration artifacts and it is desirable to not mingle multiple types of configuration in a single file but keep each type of configuration in its own file for version and change control.
-   Added `--verbose` option to `journey export` command.
-   \#341: Added initial smoke tests to validate basic functionality.

### Changed

-   \#363: Frodo now performs dependency resolution and reports unresolved dependencies on single journey imports.
-   \#364: Frodo now uses a spinner and no longer a progress bar to indicate progress on single journey imports.
-   Internal restructuring (#158, #159, #164, #165)
-   Updated PIPELINE.md with latest pipeline changes

### Fixed

-   \#359: Frodo now properly exports themes from forgeops deployments.
-   \#362: Frodo now properly imports journeys with email templates.
-   \#357: Frodo no longer throws an error and exits occasionally when running the `frodo log tail` command.
-   \#355: Frodo now properly imports social IDPs into 7.1 environments when using the `frodo journey import` command.
-   \#353: Frodo now properly imports social IDPs when using the `frodo journey import` command.
-   \#351: Frodo now properly shows IDM messages using the `frodo logs tail` command.
-   \#349: Frodo now properly exports journeys from classic deployments

## [0.9.2-12] - 2022-08-09

### Fixed

-   \#359: Frodo now properly exports themes from forgeops deployments.

## [0.9.2-11] - 2022-08-09

### Changed

-   \#363: Frodo now performs dependency resolution and reports unresolved dependencies on single journey imports.
-   \#364: Frodo now uses a spinner and no longer a progress bar to indicate progress on single journey imports.

### Fixed

-   \#362: Frodo now properly imports journeys with email templates.

## [0.9.2-10] - 2022-08-05

### Fixed

-   \#357: Frodo no longer throws an error and exits occasionally when running the `frodo log tail` command.

## [0.9.2-9] - 2022-07-30

### Fixed

-   \#355: Frodo now properly imports social IDPs into 7.1 environments when using the `frodo journey import` command.

## [0.9.2-8] - 2022-07-28

### Fixed

-   \#353: Frodo now properly imports social IDPs when using the `frodo journey import` command.

## [0.9.2-7] - 2022-07-28

### Fixed

-   \#351: Frodo now properly shows IDM messages using the `frodo logs tail` command.

## [0.9.2-6] - 2022-07-27

### Fixed

-   \#349: Frodo now properly exports journeys from classic deployments

## [0.9.2-5] - 2022-07-23

### Changed

-   Internal restructuring (#158, #159, #164, #165)

## [0.9.2-4] - 2022-07-22

### Added

-   \#341: Added initial smoke tests to validate basic functionality

### Changed

-   Updated PIPELINE.md with latest pipeline changes

## [0.9.2-3] - 2022-07-22 [YANKED]

## [0.9.2-2] - 2022-07-22 [YANKED]

## [0.9.2-1] - 2022-07-22 [YANKED]

## [0.9.2-0] - 2022-07-22 [YANKED]

## [0.9.1] - 2022-07-21

### Added

-   \#311: Added explicit support for network proxies (`HTTPS_PROXY=<protocol>://<host>:<port>`)
    Frodo now supports using system enviroment variable `HTTPS_PROXY` (and `HTTP_PROXY`) to connect through a network proxy.

### Changed

-   Changes to `frodo realm describe` command:
    -   The realm argument now exclusively determines the realm
    -   Removed `-n`/`--name` parameter
-   Internal restructuring (#167)

### Fixed

-   \#329: Fixed help info for `esv apply` command
-   \#335: Fixed error when running `idm list` command
-   \#338: Frodo now successfully authenticates with or without using a proxy

## [0.9.1-1] - 2022-07-21

### Fixed

-   \#338: Frodo now successfully authenticates with or without using a proxy

## [0.9.1-0] - 2022-07-21 [YANKED]

## [0.9.0] - 2022-07-21 [YANKED]

## [0.8.2] - 2022-07-17

### Changed

-   Changed `idm` sub-commands to align with other commands:
    -   The sub-commands `export`, `exportAll`, and `exportAllRaw` have been collapsed into one: `export`
        -   `idm export -A` (`--all-separate`) is now the way to export all idm configuration.
            -   Options `-e` and `-E` select old `exportAll` functionality with variable replacement and filtering
            -   Omitting options `-e` and `-E`, selects the old `exportAllRaw` functionality without variable replacement and without filtering
    -   Renamed sample resource files for `idm export` command:
        -   `<frodo home>/resources/sampleEntitiesFile.json`
        -   `<frodo home>/resources/sampleEnvFile.env`
    -   The `-N`/`--name` option of the count command has been renamed to `-m`/`--managed-object`
-   Internal restructuring (#137)

### Fixed

-   \#325: Frodo now gracefully reports and skips node types causing errors during pruning
-   \#331: Frodo now correctly counts managed objects when using the `idm count` command

## [0.8.2-1] - 2022-07-16

### Fixed

-   \#325: Frodo now gracefully reports and skips node types causing errors during pruning

## [0.8.2-0] - 2022-07-16 [YANKED]

## [0.8.1] - 2022-07-15

### Added

-   New `-l`/`--long` option to script list command

### Changed

-   Changed default behavior of `frodo conn add` to validate connection details by default and renamed parameter from `--validate` to `--no-validate` to allow disabling validation
-   Internal restructuring (#169)

### Fixed

-   \#324: Frodo now includes themes assigned at journey level in journey exports

## [0.8.1-0] - 2022-07-14 [YANKED]

## [0.8.0] - 2022-07-13

### Added

-   \#320: Frodo now identifies itself through the User-Agent header `<name>/<version>` (e.g. `frodo/0.7.1-1`)

### Changed

-   Renamed `realm details` to `realm describe` but registered `realm details` as an alias for backwards compatibility
-   Changes to application command
    -   Renamed command to `app` but registered `application` as an alias for backwards compatibility
    -   Renamed option `-i`/`--id` to `-i`/`--app-id`. Short version is not impacted by rename.
-   Internal restructuring (#133, #134, #141 #142, #146)

### Fixed

-   \#319: frodo admin create-oauth2-client-with-admin-privileges --llt properly handles name collisions

## [0.7.1-1] - 2022-07-11

## [0.7.1-0] - 2022-07-10

## [0.7.0] - 2022-07-10

### Added

-   CHANGELOG.md
-   `conn describe` command to describe connection profiles
    -   `--show-secrets` option to `conn describe` command to show clear-text secrets
-   `--validate` option to `conn add` command to validate credentials before adding

### Changed

-   Adapted true semantic versioning
-   Pipeline changes
    -   Automated updating changelog using keep a changelog format in CHANGELOG.md
    -   Automated version bump (SemVer format) using PR comments to trigger prerelease, patch, minor, or major bumps
    -   Automated release notes extraction from CHANGELOG.md
    -   Automated GitHub release creation
    -   Renamed frodo.yml to pipeline.yml
-   Renamed connections command to `conn` with aliases `connection` and `connections` for backwards compatibility
-   Internal restructuring (#160, #135)

### Fixed

-   \#280: Fixed missing -k/--insecure param in application sub-commands #280
-   \#310: No longer storing connection profiles unless explicitly instructed to

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

-   Changed archive step of Windows binary build to use 7zip

## 0.6.1 alpha 22 - 0.6.1 alpha 25 [YANKED]

## 0.6.1 alpha 21 - 2022-06-27

### Added

-   Added theme delete command
-   Theme list e2e tests
-   Theme delete e2e tests
-   Added esv command
    -   esv secret - Manage secrets.
    -   esv variable - Manage variables.
    -   esv apply - Apply pending changes.
-   Updated all dependencies to the latest versions

### Changed

-   Moved secret command under new esv command

## 0.6.1 alpha 20 - 2022-06-23

### Added

-   Added journey delete command
-   journey list e2e tests
-   journey delete e2e tests

### Changed

-   Allow progressbar output to be captured in redirects

### Fixed

-   Journey import fixes
-   Journey export bug fix
-   Fix theme import issues when using /alpha or /bravo instead of alpha or bravo
-   Fix admin create-oauth2-client-with-admin-privileges command

## 0.6.1 alpha 19 - 2022-06-14

### Added

-   First stab at e2e testing of journey command
-   saml command enhancements

### Fixed

-   Detect and remove invalid tree attributes on import
-   Fixed issue where overriding deployment type would fail to detect the default realm
-   Fix theme import -A

## 0.6.1 alpha 18 - 2022-06-10

### Added

-   \--txid parameter with the logs commands to filter log output by transactionId

### Fixed

-   Bug in idm exportAllRaw

## 0.6.1 alpha 17 - 2022-06-08

### Added

-   New saml command to manage entity providers and circles of trust

### Changed

-   Updates to journey export/import commands
    -   Support for social identity providers
    -   Support for themes
    -   Support for SAML entity providers
    -   Support for SAML circles of trust
    -   Breaking changes in journey sub-commands
        -   export
            -   \-t/--tree renamed to -i/--journey-id
        -   import
            -   \-t/--tree renamed to -i/--journey-id
            -   \-i/--journey-id is now only used to select the journey to import if there are multiple journeys in the import file
            -   \-n (No re-UUID) removed
            -   new flag --re-uuid with inversed behavior of removed -n flag. Frodo by default no longer generates new UUIDs for nodes on import
-   Scalability enhancements to journey prune command. The changes allow the prune command to scale to many thousands of orphaned node configuration objects in an AM instance
-   Updated readme
-   Miscellaneous bug fixes

## 0.6.1 alpha 14 - 0.6.1 alpha 16 [YANKED]

## 0.6.1 alpha 13 - 2022-05-20

### Added

-   New script command to export and import scripts
-   New email_templates command to manage email templates
-   New application command to export and import oauth2 clients
-   New realm command to manage realms
-   New secret command to manage Identity Cloud secrets
-   New theme command to manage hosted pages UI themes
-   New admin command to perform advanced administrative tasks
-   Encrypt the password value in the connection profile
-   Added progress bars/spinners for long running operations
-   Added version option -v, --version
-   Auto provisioning of log API keys
-   Added initial unit testing

### Changed

-   Improved performance of journey command (multi-threading)
-   Consolidated settings under one folder (~/.frodo)
-   Proposed new code formatting (prettier) and style (eslint) rules
-   Updated readme
-   Update to node 18

### Fixed

-   Fixed problem with adding connection profiles
-   Miscellaneous bug fixes

[Unreleased]: https://github.com/rockcarver/frodo-lib/compare/v0.18.9-5...HEAD

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
