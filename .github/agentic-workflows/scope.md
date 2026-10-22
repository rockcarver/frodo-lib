# Project scope

Read by the issue gate's scope check (Repo Concierge). The check is off for a repository without this file.

## Purpose

Frodo Library (`@rockcarver/frodo-lib`) is a hybrid (ESM and CJS) TypeScript library to manage PingOne Advanced Identity Cloud environments, ForgeOps deployments and classic deployments. It powers frodo-cli, including the capability metadata and registry behind the CLI's MCP server.

## In scope

- Reading, creating, updating, deleting, listing, exporting and importing platform configuration through the `frodo` facade: authentication journeys and nodes, scripts, OAuth2 and OIDC clients and providers, SAML, agents, applications, authorization policies, IDM configuration (managed objects, mappings, connectors, organizations), themes, email templates, realms, roles, services, IGA workflows and more
- Connection and authentication handling (service accounts, user credentials, access tokens, browser login), state and connection profiles
- Advanced Identity Cloud environment features: ESV secrets and variables, log access, promotion, certificates, startup, features
- Import and export formats, validation and the tooling these need (for example journey reference validation)
- The capability metadata and registry that frodo-cli's MCP server exposes
- Type definitions, documentation, the migration guide, tests, and the build and release pipeline of this library

## Out of scope

<!-- Every item here can close an issue automatically as not planned. Keep the list short and specific. -->

- Managing other vendors' identity platforms, such as Okta, Auth0, Keycloak or Microsoft Entra ID. Frodo manages the Ping Identity platform.
- Exporting ESV secret values unencrypted. Frodo always encrypts exported ESV secret values and leaves secrets with the environment they belong to.

## Needs a maintainer

- Support for Ping products other than Advanced Identity Cloud, ForgeOps and classic (PingAM, PingIDM) deployments
- Exporting platform passwords or other stored secret values. Frodo generally does not export them; administrators are expected to use configuration placeholders and ESVs.
- Installing, provisioning or upgrading the platform itself, as opposed to managing its configuration
- A graphical or web user interface
- Supporting Node.js versions outside the CI matrix

## Where to go instead

- Secrets: use ESVs and configuration placeholders so exports do not need the secret values (see "Considerations" in the README).
