<!-- README.md for GitHub; the one for NPM is ../README.md. -->

# Frodo Library - @rockcarver/frodo-lib

ForgeROck DO library, frodo-lib, a library to manage ForgeRock Identity Cloud tenants, ForgeOps deployments, and classic deployments.

Frodo-lib powers [frodo-cli](https://github.com/rockcarver/frodo-cli), the command line tool to manage ForgeRock deployments.

## Quick Nav

- [Features](#features)
- [Limitations](#limitations)
- [Installing](#installing)
- [Request features or report issues](#feature-requests)
- [Contributing](#contributing)
- [Maintaining](#maintaining)

## Features

Frodo allows an administrator to easily connect to and manage any number of Identity Cloud tenants, ForgeOps deployment instances, or classic deployment instances from the command line. The following tasks are currently supported:

- User mode

  Install and run pre-compiled single binaries without any dependencies for MacOS, Windows, and Linux.

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

- Make sure you have Node.js v18 (the version used by developers) or newer and npm.
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
  npm i --save @rockcarver/frodo-lib
  ```
- To install the latest pre-release:
  ```console
  npm i @rockcarver/frodo-lib@next
  ```

## Feature requests

Please use the repository's [issues](https://github.com/rockcarver/frodo-lib/issues) to request new features/enhancements or report bugs/issues.

## Contributing

If you would like to contribute to frodo, please refer to the [contributing instructions](../docs/CONTRIBUTE.md).

## Maintaining

If you are a maintainer of this repository, please refer to the [pipeline and release process instructions](../docs/PIPELINE.md).
