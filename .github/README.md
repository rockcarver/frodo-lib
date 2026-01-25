<!-- README.md for GitHub; the one for NPM is ../README.md. -->

# Frodo Library 4.x - @rockcarver/frodo-lib

A hybrid (ESM and CJS) library to manage PingOne Advanced Identity Cloud environments, ForgeOps deployments, and classic deployments.

Frodo-lib powers [frodo-cli](https://github.com/rockcarver/frodo-cli), the command line tool to manage SaaS and self-hosted deployments.

## Quick Nav

- [New 4.x](#new-in-4x)
- [About](#about)
- [Considerations](#considerations)
- [Installing](#installing)
- [Using the library](#using-the-library)
- [Library API docs](#library-api-docs)
- [Request features or report issues](#feature-requests)
- [Contributing](#contributing)
- [Maintaining](#maintaining)

## New In 4.x

Frodo Library 4.0 adds support for [Custom Nodes](https://docs.pingidentity.com/pingoneaic/journeys/node-designer.html), `fr-config-manager` and the latest Node.js versions.

### Custom Nodes - Node Designer

2.x introduces breaking changes to support multiple instances of the library to run concurrently and connect to multiple different Ping Identity Platform instances at the same time. [1.x](https://github.com/rockcarver/frodo-lib/tree/1.x) operates using a global singleton, making it impossible to connect to more than one platform instance at a time.

### FR-Config-Manager

Removing the singleton pattern and introducing multi-instantiability forced a radical redesign of the core library functions while striving to maintain the basic usage pattern. The library is now exposing two main types describing its modules ([Frodo](https://rockcarver.github.io/frodo-lib/types/Reference.Frodo.html)) and state ([State](https://rockcarver.github.io/frodo-lib/types/Reference.State.html)). Each module in turn exports all its collection of functions as a type as well. Exposing the library structure as types enables auto-completion for both JS and TS developers with properly configured IDEs like Visual Studio Code or other and also serves as an abstraction layer between what the library exposes vs what and how it's implemented.

### Node.js Versions

- Added support for Node.js 24 and 25.
- Dropped support for Node.js 18.

## About

### Modules

List of modules that have been updated and/or added by version:

| Module                     | Since | Capabilities |
| -------------------------- | ----- | ------------ |
| frodo.admin                | 1.0.0 | Library of common and complex admin tasks. |
| frodo.agent                | 1.0.0 | Manage web, java, and gateway agents. |
| frodo.am.config            | 3.0.1 | Manage all AM entities that are not otherwise managed in Frodo (chains, modules, tree config, servers, webhooks, etc.) |
| frodo.app                  | 2.0.0 | Manage platform applications and dependencies. |
| frodo.authn.journey        | 1.0.0 | Manage authentication journeys. |
| frodo.authn.node           | 1.0.0 | Manage authentication nodes. |
| frodo.authn.settings       | 2.0.0 | Manage realm-wide authentication settings. |
| frodo.authz.policy         | 1.0.0 | Manage authorization policies and dependencies. |
| frodo.authz.policySet      | 1.0.0 | Manage policy sets and dependencies. |
| frodo.authz.resourceType   | 1.0.0 | Manage resource types and dependencies. |
| frodo.cache                | 2.0.0 | Token cache management exposed through the library but primarily used internally. |
| frodo.cloud.adminFed       | 1.0.0 | Manage PingOne Advanced Identity Cloud admin federation. |
| frodo.cloud.env            | 2.0.3 | Manage PingOne Advanced Identity Cloud environment settings (custom domains, cookie domains, federation enforcement, release, SSO cookie config, etc.). |
| frodo.cloud.env.cert       | 2.0.3 | Manage certificates in PingOne Advanced Identity Cloud |
| frodo.cloud.env.csr        | 2.0.3 | Manage certificate signing requests in PingOne Advanced Identity Cloud |
| frodo.cloud.env.promotion  | 2.0.3 | Manage promotions in PingOne Advanced Identity Cloud |
| frodo.cloud.feature        | 1.0.0 | Obtain info on PingOne Advanced Identity Cloud features. |
| frodo.cloud.log            | 1.0.0 | Access PingOne Advanced Identity Cloud debug and audit logs. |
| frodo.cloud.secret         | 1.0.0 | Mange secrets in PingOne Advanced Identity Cloud. |
| frodo.cloud.serviceAccount | 1.0.0 | Manage service accounts in PingOne Advanced Identity Cloud. |
| frodo.cloud.startup        | 1.0.0 | Apply changes to secrets and variables and restart services in PingOne Advanced Identity Cloud. |
| frodo.cloud.variable       | 1.0.0 | Manage variables in PingOne Advanced Identity Cloud. |
| frodo.config               | 2.0.0 | Manage the whole platform configuration. |
| frodo.conn                 | 1.0.0 | Manage connection profiles. |
| frodo.email.template       | 1.0.0 | Manage email templates (IDM). |
| frodo.idm.config           | 2.0.0 | Manage any IDM configuration object. |
| frodo.idm.connector        | 2.0.0 | Manage IDM connector configuration. |
| frodo.idm.crypto.          | 2.0.0 | Manage IDM connector configuration. |
| frodo.idm.managed          | 1.0.0 | Manage IDM managed object schema (managed.json). |
| frodo.idm.mapping          | 2.0.0 | Manage IDM mappings (sync.json). |
| frodo.idm.organization     | 1.0.0 | Limited Org Model management exposed through the library but primarily used internally. |
| frodo.idm.recon            | 2.0.0 | Read, start, cancel IDM recons. |
| frodo.idm.script           | 2.0.0 | Compile and evaluate IDM scripts. |
| frodo.idm.system           | 2.0.0 | Manage data in connected systems. |
| frodo.info                 | 1.0.0 | Obtain information about the connected instance and authenticated identity. |
| frodo.login                | 1.0.0 | Authenticate and obtain necessary tokens. |
| frodo.oauth2oidc.client    | 1.0.0 | Manage OAuth 2.0 clients. |
| frodo.oauth2oidc.endpoint  | 2.0.0 | Limited OAuth 2.0 grant flows exposed through the library but primarily used internally. |
| frodo.oauth2oidc.external  | 1.0.0 | Manage external OAuth 2.0/OIDC 1.0 (social) identity providers. |
| frodo.oauth2oidc.issuer    | 2.0.0 | Manage trusted OAuth 2.0 JWT issuers. |
| frodo.oauth2oidc.provider  | 1.0.0 | Manage the realm OAuth 2.0 provider. |
| frodo.rawConfig            | 4.0.0 | Export raw IDM configuration. |
| frodo.realm                | 1.0.0 | Manage realms. |
| frodo.role                 | 3.0.1 | Manage Internal Roles. |
| frodo.saml.circlesOfTrust  | 1.0.0 | Manage SAML 2.0 circles of trust. |
| frodo.saml.entityProvider  | 1.0.0 | Manage SAML 2.0 entity providers. |
| frodo.script               | 1.0.0 | Manage access management scripts. |
| frodo.scriptType           | 3.0.1 | Manage access management script types. |
| frodo.secretStore          | 3.0.1 | Manage access management secret stores in classic and forgeops deployments. |
| frodo.server               | 3.0.1 | Manage access management servers in classic and forgeops deployments. |
| frodo.service              | 1.0.0 | Manage access management services. |
| frodo.session              | 2.0.0 | Limited session management exposed through the library but primarily used internally. |
| frodo.site                 | 3.0.1 | Manage access management sites in classic and forgeops deployments. |
| frodo.state                | 1.0.0 | Manage library state. |
| frodo.theme                | 1.0.0 | Manage platform themes (hosted pages). |
| frodo.user                 | 3.0.1 | Manage access management users in classic deployments. |
| frodo.utils.constants      | 1.0.0 | Access relevant library constants. |
| frodo.utils.jose           | 1.0.0 | Jose utility functions exposed through the library but primarily used internally. |
| frodo.utils.json           | 1.0.0 | JSON utility functions exposed through the library but primarily used internally. |
| frodo.utils.version        | 1.0.0 | Utility functions to obtain current library version and available released versions. |

### Secure Token Caching

The library uses a secure token cache, which is active by default. The cache makes it so that when the `frodo.login.getTokens()` method is called, available tokens are updated in `state` from cache and if none are available, they are obtained from the instance configured in `state`. The cache is tokenized and encrypted on disk, so it persists across library instantiations. You can disable the cache by either setting the `FRODO_NO_CACHE` environment variable or by calling `state.setUseTokenCache(false)` from your application.
You can change the default location of the cache file (`~/.frodo/TokenCache.json`) by either setting the `FRODO_TOKEN_CACHE_PATH` environment variable or by calling `state.setTokenCachePath('/path/to/cache.json')`.

### Automatic Token Refresh

The library automatically refreshes session and access tokens before they expire. Combined with the token cache, the library maintains a set of valid tokens in `state` at all times until it is shut down. If you do not want to automatically refresh tokens, set the `autoRefresh` parameter (2nd param) of your `frodo.login.getTokens()` call to `false`.

### Node.js Versions

| Node.js |      frodo-lib 1.x |      frodo-lib 2.x | frodo-lib 3.x.     | ***frodo-lib 4.x*** |      frodo-lib 5.x |
| :-----: | :----------------: | :----------------: | :----------------: | :----------------: | :----------------: |
|   14    | :white_check_mark: | :heavy_minus_sign: | :heavy_minus_sign: | :heavy_minus_sign: | :heavy_minus_sign: |
|   16    | :white_check_mark: | :heavy_minus_sign: | :heavy_minus_sign: | :heavy_minus_sign: | :heavy_minus_sign: |
|   18    | :white_check_mark: | :white_check_mark: | :white_check_mark: | :heavy_minus_sign: | :heavy_minus_sign: |
|   20    | :heavy_minus_sign: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :heavy_minus_sign: |
|   22    | :heavy_minus_sign: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
|   24    | :heavy_minus_sign: | :heavy_minus_sign: | :heavy_minus_sign: | :white_check_mark: | :white_check_mark: |
|   26    | :heavy_minus_sign: | :heavy_minus_sign: | :heavy_minus_sign: | :heavy_minus_sign: | :white_check_mark: |

## Considerations

### Platform Passwords And Secrets

Platform passwords and secrets are configuration values that are stored encrypted as part of platform configuration. Examples are oauth2 client secrets or service account passwords.

Frodo generally doesn't export platform passwords and secrets. The platform supports configuration placeholders and environment secrets and variables allowing administrators to separate the functional configuration from sensitive secrets and variable configuration values. `frodo` assumes administrators take full advantage of these capabilities so that there is no need or expectation that exports include passwords and secrets. However, where the APIs support it, administrators can seed import data with raw secrets and `frodo` will import them.

### Advanced Identity Cloud Environment Secrets And Variables (ESVs)

Frodo supports exporting and importing of ESV secret values. To leave stuartship of secret values with the cloud environment where they belong, frodo always encrypts values using either encryption keys from the source environment (default) or the target environment. Frodo never exports secrets in the clear.

## Installing

### Developer Mode

For those who want to contribute or are just curious about the build process.

- Make sure you have **Node.js 20** or newer (**24** preferred) and npm installed.
- Clone this repo
  ```console
  git clone https://github.com/rockcarver/frodo-lib.git
  ```
- Install dependencies via NPM
  ```console
  cd frodo-lib
  npm ci
  ```

### NPM package

If you are a node developer and want to use frodo-lib as a library for your own applications, you can install the npm package:

- To install the latest version as a dependency for you own application:
  ```console
  npm i @rockcarver/frodo-lib
  ```
- To install the latest pre-release:
  ```console
  npm i @rockcarver/frodo-lib@next
  ```

## Using the library

### Import the library members ([ESM](https://github.com/rockcarver/frodo-lib/blob/b7220de90478dfd3e1bb0d8b9cdcef455cb20b3b/examples/esm/index.js#L1-L6)):

```javascript
import {
  // default instance
  frodo,
  // default state
  state,
} from '@rockcarver/frodo-lib';
```

### Require the library members ([CJS](https://github.com/rockcarver/frodo-lib/blob/b7220de90478dfd3e1bb0d8b9cdcef455cb20b3b/examples/cjs/index.js#L1-L6)):

```javascript
const {
  // default instance
  frodo,
  // default state
  state,
} = require('@rockcarver/frodo-lib');
```

### Use the library

Create a new instance using factory helper function and login as service account ([ESM](https://github.com/rockcarver/frodo-lib/blob/b7220de90478dfd3e1bb0d8b9cdcef455cb20b3b/examples/esm/index.js#L24-L61) | [CJS](https://github.com/rockcarver/frodo-lib/blob/b7220de90478dfd3e1bb0d8b9cdcef455cb20b3b/examples/cjs/index.js#L24-L61)):

```javascript
async function newFactoryHelperServiceAccountLogin() {
  const myFrodo1 = frodo.createInstanceWithServiceAccount(
    host1, // host base URL
    said1, // service account id
    jwk1 // service account jwk as a string
  );

  // destructure default instance for easier use of library functions
  const { getTokens } = myFrodo1.login;
  const { getInfo } = myFrodo1.info;

  // login and obtain tokens
  if (await getTokens()) {
    // obtain and print information about the instance you are connected to
    const info = await getInfo();
    console.log(
      `newFactoryHelperServiceAccountLogin: Logged in to: ${info.host}`
    );
    console.log(
      `newFactoryHelperServiceAccountLogin: Logged in as: ${info.authenticatedSubject}`
    );
    console.log(
      `newFactoryHelperServiceAccountLogin: Using bearer token: \n${info.bearerToken}`
    );
  } else {
    console.log('error getting tokens');
  }
}
newFactoryHelperServiceAccountLogin();
```

Create a new instance using factory helper function and login as admin user ([ESM](https://github.com/rockcarver/frodo-lib/blob/b7220de90478dfd3e1bb0d8b9cdcef455cb20b3b/examples/esm/index.js#L63-L98) | [CJS](https://github.com/rockcarver/frodo-lib/blob/b7220de90478dfd3e1bb0d8b9cdcef455cb20b3b/examples/cjs/index.js#L63-L98)):

```javascript
async function newFactoryHelperAdminLogin() {
  const myFrodo1 = frodo.createInstanceWithAdminAccount(
    host1, // host base URL
    user1, // admin username
    pass1 // admin password
  );

  // destructure default instance for easier use of library functions
  const { getTokens } = myFrodo1.login;
  const { getInfo } = myFrodo1.info;

  // login and obtain tokens
  if (await getTokens()) {
    // obtain and print information about the instance you are connected to
    const info = await getInfo();
    console.log(`newFactoryHelperAdminLogin: Logged in to: ${info.host}`);
    console.log(
      `newFactoryHelperAdminLogin: Logged in as: ${info.authenticatedSubject}`
    );
    console.log(
      `newFactoryHelperAdminLogin: Using bearer token: \n${info.bearerToken}`
    );
  } else {
    console.log('error getting tokens');
  }
}
newFactoryHelperAdminLogin();
```

Create a new instance using factory function and login as service account ([ESM](https://github.com/rockcarver/frodo-lib/blob/b7220de90478dfd3e1bb0d8b9cdcef455cb20b3b/examples/esm/index.js#L100-L135) | [CJS](https://github.com/rockcarver/frodo-lib/blob/b7220de90478dfd3e1bb0d8b9cdcef455cb20b3b/examples/cjs/index.js#L100-L135)):

```javascript
async function newFactoryServiceAccountLogin() {
  const myFrodo2 = frodo.createInstance({
    host: host2, // host base URL
    serviceAccountId: said2, // service account id
    serviceAccountJwk: JSON.parse(jwk2), // service account jwk as a JwkRsa object
  });

  // destructure default instance for easier use of library functions
  const { getTokens } = myFrodo2.login;
  const { getInfo } = myFrodo2.info;

  // login and obtain tokens
  if (await getTokens()) {
    // obtain and print information about the instance you are connected to
    const info = await getInfo();
    console.log(`newFactoryServiceAccountLogin: Logged in to: ${info.host}`);
    console.log(
      `newFactoryServiceAccountLogin: Logged in as: ${info.authenticatedSubject}`
    );
    console.log(
      `newFactoryServiceAccountLogin: Using bearer token: \n${info.bearerToken}`
    );
  } else {
    console.log('error getting tokens');
  }
}
newFactoryServiceAccountLogin();
```

Create a new instance using factory function and login as admin user ([ESM](https://github.com/rockcarver/frodo-lib/blob/b7220de90478dfd3e1bb0d8b9cdcef455cb20b3b/examples/esm/index.js#L137-L168) | [CJS](https://github.com/rockcarver/frodo-lib/blob/b7220de90478dfd3e1bb0d8b9cdcef455cb20b3b/examples/cjs/index.js#L137-L168)):

```javascript
async function newFactoryAdminLogin() {
  const myFrodo2 = frodo.createInstance({
    host: host2, // host base URL
    username: user2, // admin username
    password: pass2, // admin password
  });

  // destructure default instance for easier use of library functions
  const { getTokens } = myFrodo2.login;
  const { getInfo } = myFrodo2.info;

  // login and obtain tokens
  if (await getTokens()) {
    // obtain and print information about the instance you are connected to
    const info = await getInfo();
    console.log(`newFactoryAdminLogin: Logged in to: ${info.host}`);
    console.log(
      `newFactoryAdminLogin: Logged in as: ${info.authenticatedSubject}`
    );
    console.log(
      `newFactoryAdminLogin: Using bearer token: \n${info.bearerToken}`
    );
  } else {
    console.log('error getting tokens');
  }
}
newFactoryAdminLogin();
```

Use default instance and state and login as service account ([ESM](https://github.com/rockcarver/frodo-lib/blob/b7220de90478dfd3e1bb0d8b9cdcef455cb20b3b/examples/esm/index.js#L170-L212) | [CJS](https://github.com/rockcarver/frodo-lib/blob/b7220de90478dfd3e1bb0d8b9cdcef455cb20b3b/examples/cjs/index.js#L170-L212)):

```javascript
async function defaultServiceAccountLogin() {
  // destructure default instance for easier use of library functions
  const { getTokens } = frodo.login;
  const { getInfo } = frodo.info;

  // The default state instance is a singleton. It is best to reset() the state before
  // logging in to avoid interference. In this particular case no previous method in
  // this file is using the default state but it is good practice to call reset() if
  // you are not sure and need a clean state.
  state.reset();

  // host base URL
  state.setHost(host0);
  // service account id
  state.setServiceAccountId(said0);
  // service account jwk as a JwkRsa object
  state.setServiceAccountJwk(JSON.parse(jwk0));

  // login and obtain tokens
  if (await getTokens()) {
    // obtain and print information about the instance you are connected to
    const info = await getInfo();
    console.log(`defaultServiceAccountLogin: Logged in to: ${info.host}`);
    console.log(
      `defaultServiceAccountLogin: Logged in as: ${info.authenticatedSubject}`
    );
    console.log(
      `defaultServiceAccountLogin: Using bearer token: \n${info.bearerToken}`
    );
  } else {
    console.log('error getting tokens');
  }
}
await defaultServiceAccountLogin();
```

Use default instance and state and login as admin user ([ESM](https://github.com/rockcarver/frodo-lib/blob/b7220de90478dfd3e1bb0d8b9cdcef455cb20b3b/examples/esm/index.js#L214-L250) | [CJS](https://github.com/rockcarver/frodo-lib/blob/b7220de90478dfd3e1bb0d8b9cdcef455cb20b3b/examples/cjs/index.js#L214-L250)):

```javascript
async function defaultAdminLogin() {
  // destructure default instance for easier use of library functions
  const { getTokens } = frodo.login;
  const { getInfo } = frodo.info;

  // The default state instance is a singleton. It is best to reset() the state before
  // logging in to avoid interference. In this particular case the previous method in
  // this file is populating the state with a service account login and the admin login
  // could possibly fail.
  state.reset();

  // host base URL
  state.setHost(host0);
  // username of an admin user
  state.setUsername(user0);
  // password of the admin user
  state.setPassword(pass0);

  // login and obtain tokens
  if (await getTokens()) {
    // obtain and print information about the instance you are connected to
    const info = await getInfo();
    console.log(`defaultAdminLogin: Logged in to: ${info.host}`);
    console.log(
      `defaultAdminLogin: Logged in as: ${info.authenticatedSubject}`
    );
    console.log(`defaultAdminLogin: Using bearer token: \n${info.bearerToken}`);
  } else {
    console.log('error getting tokens');
  }
}
await defaultAdminLogin();
```

Check out all the examples in `/path/to/frodo-lib/examples`.

## Library API docs

[Latest library API docs](https://rockcarver.github.io/frodo-lib/)

## Feature requests

Please use the repository's [issues](https://github.com/rockcarver/frodo-lib/issues) to request new features/enhancements or report bugs/issues.

## Contributing

If you would like to contribute to frodo, please refer to the [contributing instructions](https://github.com/rockcarver/frodo-lib/blob/main/CONTRIBUTE.md).

## Maintaining

If you are a maintainer of this repository, please refer to the [pipeline and release process instructions](https://github.com/rockcarver/frodo-lib/blob/main/PIPELINE.md).
