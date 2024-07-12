# Contribute to frodo

Any direct commits to the repository are not allowed. Pull requests (PR) are most welcome. Please fork this repo and develop and test in that fork. Once you feel ready, please create a PR. For any major changes, please open an [issue](https://github.com/rockcarver/frodo/issues) first to discuss what and why you'd like to change.

## Developing

### Forking this repo

Please refer to these couple of excellent resources for getting started with forking the repo and contributing to github open source projects in general. These are great reads not only for someone new to this, even regular github contributors may find some great tidbits of information.

- [https://github.com/firstcontributions/first-contributions](https://github.com/firstcontributions/first-contributions)
  Also take a look at [Additional material](https://github.com/firstcontributions/first-contributions/blob/master/additional-material/git_workflow_scenarios/additional-material.md) towards the end, as there are some good tips on that page.

OR

- [https://www.dataschool.io/how-to-contribute-on-github/](https://www.dataschool.io/how-to-contribute-on-github/)

### Prerequisites

- Node.js 18 or later, 20 or 22 recommended
- npm (included with Node.js)
- A GUI editor is highly recommended. The current developers use [VSCode](https://code.visualstudio.com/), but you are welcome to use others, like [Atom](https://atom.io/) or [Sublime](https://www.sublimetext.com/), etc. The repository contains configuration files for VSCode's [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and [prettier](https://prettier.io/) add-ons, which will automatically lint the code and apply coding styles when using VSCode. The same files may work for other editors with similar add-ons, but this has not been tested.

### Clone the repo and install dependencies

```console
git clone https://github.com/rockcarver/frodo-lib.git
cd frodo-lib
npm ci
```

### Build

```console
npm run build
```

### Develop

To automatically build as you develop, use:

```console
npm run dev
```

### Before submitting a PR

Before you submit a PR, make sure your code follows the frodo code formatting conventions and all the existing and your new unit tests are passing.

```console
npm run lint
npm test
```

### Code structure and conventions

Frodo Library adheres to the following folder and file structure:

```preformated
├── dist                     Build output. CommonJS files go here.
│   ├── esm                  Build output. ESM files go here.
├── docs                     Typedoc generated documentation.
├── examples                 Sample code how to use the library.
├── resources                Resource files.
├── src                      Source files.
│   ├── api                  Api layer modules. Abstraction of platform
│   │   │                    REST APIs.
│   │   └── cloud            Cloud api layer modules.
│   ├── ext                  External modules, which cannot be consumed
│   │                        as npm packages.
│   ├── lib                  Home of FrodoLib.ts.
│   ├── ops                  Ops layer modules. This is the library layer.
│   │   │                    Business logic goes here.
│   │   ├── cloud            Cloud ops layer modules.
│   │   └── templates        Templates of different object types and schema.
│   ├── shared               Shared modules.
│   ├── test                 Unit tests and test resources.
│   │   ├── mock-recordings  Mock recordings (Polly.js).
│   │   ├── mocks            Old mock engine and mock files still in use
│   │   │                    for come tests.
│   │   └── snapshots        Snapshot files (Jest).
│   └── utils                Utility modules.
└── types                    Type definitions.
```

#### Code conventions

Most of Frodo Library's functionality is manipulating configuration of a Ping (formerly: ForgeRock) Identity Platform instance. Most of the configuration is stored in configuration and other objects, which can be managed individually.

To create a good and consistent developer experience for library users, library developers should follow these conventions:

##### Managing objects - CRUDQ

Adopt CRUDQ naming for object manipulation:

| Action | Examples                      | Comments                                                 |
| ------ | ----------------------------- | -------------------------------------------------------- |
| create | createJourney                 | Create should fail if object already exists.             |
| read   | readJourney readJourneys      | Read one or all objects of a kind.                       |
| update | updateJourney                 | Update object if it already exists, create it otherwise. |
| delete | deleteJourney, deleteJourneys | Delete one or all objects of a kind.                     |
| query  | queryJourneys                 | Query objects.                                           |

##### Managing properties

Use getters and setters for property manipulation.

| Action | Examples              | Comments                                              |
| ------ | --------------------- | ----------------------------------------------------- |
| get    | getJourneyDescription | Retrieve an individual property of an object.         |
| set    | setJourneyDescription | Set the value of an individual property of an object. |

##### Managing status

Some objects support status. Avoid using getters and setters for status if possible.

| Action  | Examples       | Comments                |
| ------- | -------------- | ----------------------- |
| enable  | enableJourney  | Enable a configuration. |
| disable | disableJourney | Disable a configuration |

##### Everything else

Pick meaningful function names. It's OK for them to be long, as long as they convey their purpose.
