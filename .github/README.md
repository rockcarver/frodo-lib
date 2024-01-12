<!-- README.md for GitHub; the one for NPM is ../README.md. -->

# Frodo Library 2.x - @rockcarver/frodo-lib

ForgeROck DO library, frodo-lib, a hybrid (ESM and CJS) library to manage ForgeRock Identity Cloud tenants, ForgeOps deployments, and classic deployments.

Frodo-lib powers [frodo-cli](https://github.com/rockcarver/frodo-cli), the command line tool to manage ForgeRock deployments.

## Quick Nav

- [New in 2.x](#new-in-2x)
- [Features](#features)
- [Limitations](#limitations)
- [Installing](#installing)
- [Using the library](#using-the-library)
- [Library API docs](#library-api-docs)
- [Request features or report issues](#feature-requests)
- [Contributing](#contributing)
- [Maintaining](#maintaining)

## New In 2.x

2.x introduces breaking changes to support multiple instances of the library to run concurrently and connect to multiple different ForgeRock Identity Platform instances at the same time. [1.x](https://github.com/rockcarver/frodo-lib/tree/1.x) operates using a global singleton, making it impossible to connect to more than one platform instance at a time.

## Features

Frodo allows an administrator to easily connect to and manage any number of Identity Cloud tenants, ForgeOps deployment instances, or classic deployment instances from the command line. The following tasks are currently supported:

- Manage journeys/trees.

  Export, import and pruning of journeys. Frodo handles referenced scripts and email templates.

- Manage applications.

  List, export, and import applications (OAuth2 clients).

- Manage connection profiles.

  Saving and reading credentials (for multiple ForgeRock deployments) from a configuration file.

- Manage email templates.

  List, export, and import email templates.

- Manage IDM configuration.

  Export of IDM configuration. Import is coming.

- Print versions and tokens.

  Obtain ForgeRock session token and admin access_tokens for a ForgeRock Identity Cloud or platform (ForgeOps) deployment

- View Identity Cloud logs.

  List available log sources and tail them.

- Manage realms.

  List realms and show realm details. Allow adding and removing of custom DNS names.

- Manage scripts.

  List, export, and import scripts.

- Manage Identity Cloud environment specific variables and secrets.

  List and view details of secrets and variables in Identity Cloud.

- Platform admin tasks.

  Common tasks administrators need to perform daily that are tedious and repetitive. Advanced tasks, which used to be involved and potentially dangerous if performed manually, now made easy and safe.

  - Create an oauth2 client with admin privileges.
  - Get an access token using client credentials grant type.
  - List oauth2 clients with admin privileges.
  - Grant an oauth2 client admin privileges.
  - Revoke admin privileges from an oauth2 client.
  - List oauth2 clients with custom privileges.
  - List all subjects of static user mappings that are not oauth2 clients.
  - Remove a subject's static user mapping.
  - Add AutoId static user mapping to enable dashboards and other AutoId-based functionality.
  - Hide generic extension attributes.
  - Show generic extension attributes.
  - Repair org model (beta).

## Limitations

`frodo` can't export passwords (including API secrets, etc), so these need to be manually added back to imported configuration or alternatively, edit the export file to add the missing fields before importing.

## Installing

### Developer Mode

For those who want to contribute or are just curious about the build process.

- Make sure you have Node.js v16 or newer (v18 or v19 preferred) and npm.
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

### Import the library members (ESM):

```javascript
import {
  // default instance
  frodo,
  // default state
  state,
} from '@rockcarver/frodo-lib';
```

### Require the library members (CJS):

```javascript
const {
  // default instance
  frodo,
  // default state
  state,
} = require('@rockcarver/frodo-lib');
```

### Use the library

Create a new instance using factory helper function and login as service account:

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

Create a new instance using factory helper function and login as admin user:

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

Create a new instance using factory function and login as service account:

```javascript
async function newFactoryServiceAccountLogin() {
  console.log(
    `\n********** BEGIN ********** newFactoryServiceAccountLogin **********`
  );
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
  console.log(
    `********** END ************ newFactoryServiceAccountLogin **********\n`
  );
}
newFactoryServiceAccountLogin();
```

Create a new instance using factory function and login as admin user:

```javascript
async function newFactoryAdminLogin() {
  console.log(`\n********** BEGIN ********** newFactoryAdminLogin **********`);
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
  console.log(`********** END ************ newFactoryAdminLogin **********\n`);
}
newFactoryAdminLogin();
```

Use default instance and state and login as service account:

```javascript
async function defaultServiceAccountLogin() {
  console.log(
    `\n********** BEGIN ********** defaultServiceAccountLogin **********`
  );
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
  console.log(
    `********** END ************ defaultServiceAccountLogin **********\n`
  );
}
await defaultServiceAccountLogin();
```

Use default instance and state and login as admin user

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
