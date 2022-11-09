# External Dependencies Ingested For Transpilation

This folder contains packages we would usually simply declare as a dependency but can't due to the nature of their packaging. Our binary build process relies on [pkg](https://github.com/vercel/pkg), which only supports CommonJS (CJS) modules.
Most modules we depend on are CommonJS or jybrid modules but then there are a few exceptions of modules that are ECMA Script Modules (ESM) only, which pkg cannot package.

To recognize and respect authorship we track these packages here and can break them back out as external dependencies once pkg adds full support for ESM or the package author decides to provide a CJS or hybrid (ESM/CJS) package, or the Frodo team decides to no longer provide binary packages.

## [Axios Curlirize 1.3.7](https://github.com/anthonygauthier/axios-curlirize/tree/release/pre-es-native-modules)

This module is an axios third-party module to log any axios request as a curl command in the console. It was originally posted as a suggestion on the axios repository, but since we believed it wasn't in the scope of axios to release such feature, we decided to make it as an independent module.