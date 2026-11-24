import {
  validateJourneyDependencies,
  validateJourneyExportKeys,
  validateJourneyReferences,
  type JourneyValidationCode,
  type JourneyValidationFinding,
  type JourneyValidationInput,
  type JourneyValidationNode,
} from './JourneyValidationUtils';

/**
 * A finding names the nodes it holds an ID for as the Journey Editor shows
 * them (`node`, `targetNode`, `pageNode`): the name on the card and the title
 * of the node type, read from the export that was validated. The fields that a
 * finding had before, and its message, do not change.
 */

type Journey = JourneyValidationInput;

/**
 * A valid journey. Tree nodes: the Page Node "Login Page" (children "Username"
 * and "Password") and the decision "Check Age". The names of the tree nodes and
 * of the Page Node children come from the tree and the Page Node; the title of
 * the type comes from the node definitions.
 */
function loginJourney(): Journey {
  return {
    tree: {
      _id: 'Login',
      entryNodeId: 'page-1',
      nodes: {
        'page-1': {
          displayName: 'Login Page',
          nodeType: 'PageNode',
          connections: { outcome: 'age-1' },
        },
        'age-1': {
          displayName: 'Check Age',
          nodeType: 'ScriptedDecisionNode',
          connections: { true: 'end', false: 'end' },
        },
      },
      staticNodes: { end: {} },
    },
    nodes: {
      'page-1': {
        _id: 'page-1',
        _type: { _id: 'PageNode', name: 'Page Node', version: '1.0' },
        _outcomes: [{ id: 'outcome' }],
        nodes: [
          {
            _id: 'user-1',
            displayName: 'Username',
            nodeType: 'ValidatedUsernameNode',
          },
          {
            _id: 'pass-1',
            displayName: 'Password',
            nodeType: 'ValidatedPasswordNode',
          },
        ],
      },
      'age-1': {
        _id: 'age-1',
        _type: { _id: 'ScriptedDecisionNode', name: 'Scripted Decision' },
        _outcomes: [{ id: 'true' }, { id: 'false' }],
        script: 'script-1',
      },
    },
    innerNodes: {
      'user-1': {
        _id: 'user-1',
        _type: { _id: 'ValidatedUsernameNode', name: 'Platform Username' },
        _outcomes: [{ id: 'outcome' }],
      },
      'pass-1': {
        _id: 'pass-1',
        _type: { _id: 'ValidatedPasswordNode', name: 'Platform Password' },
        _outcomes: [{ id: 'outcome' }],
      },
    },
  };
}

const isScripted = (node: { _type?: { _id?: string } }) =>
  node._type?._id === 'ScriptedDecisionNode';

/** Every finding of the validation of a journey: references and dependencies. */
function allFindings(journey: Journey): JourneyValidationFinding[] {
  return [
    ...validateJourneyReferences(journey),
    ...validateJourneyDependencies(journey, isScripted),
  ];
}

function findingsOf(
  journey: Journey,
  code: JourneyValidationCode
): JourneyValidationFinding[] {
  return allFindings(journey).filter((finding) => finding.code === code);
}

/** The only finding of a code, with the node of the finding. */
function only(
  journey: Journey,
  code: JourneyValidationCode
): JourneyValidationFinding {
  const findings = findingsOf(journey, code);
  expect(findings).toHaveLength(1);
  return findings[0];
}

/** Add a tree node with its definition. */
function addTreeNode(
  journey: Journey,
  id: string,
  displayName: string | undefined,
  nodeType: string,
  nodeTypeName: string
): void {
  journey.tree.nodes[id] = {
    ...(displayName === undefined ? {} : { displayName }),
    nodeType,
    connections: {},
  };
  journey.nodes[id] = {
    _id: id,
    _type: { _id: nodeType, name: nodeTypeName },
    _outcomes: [],
  };
}

const PAGE: JourneyValidationNode = {
  id: 'page-1',
  displayName: 'Login Page',
  nodeType: 'PageNode',
  nodeTypeName: 'Page Node',
};
const AGE: JourneyValidationNode = {
  id: 'age-1',
  displayName: 'Check Age',
  nodeType: 'ScriptedDecisionNode',
  nodeTypeName: 'Scripted Decision',
};
const USER: JourneyValidationNode = {
  id: 'user-1',
  displayName: 'Username',
  nodeType: 'ValidatedUsernameNode',
  nodeTypeName: 'Platform Username',
};

interface Case {
  code: JourneyValidationCode;
  name: string;
  mutate: (journey: Journey) => void;
  node?: JourneyValidationNode;
  targetNode?: JourneyValidationNode;
  pageNode?: JourneyValidationNode;
}

const CASES: Case[] = [
  {
    code: 'MISSING_NODE_DEFINITION',
    name: 'the tree names the node, the definition is gone: name and type ID only',
    mutate: (journey) => delete journey.nodes['age-1'],
    node: {
      id: 'age-1',
      displayName: 'Check Age',
      nodeType: 'ScriptedDecisionNode',
    },
  },
  {
    code: 'NODE_ID_MISMATCH',
    name: 'a node definition under another ID',
    mutate: (journey) => (journey.nodes['age-1']._id = 'renamed'),
    node: AGE,
  },
  {
    code: 'NODE_ID_MISMATCH',
    name: 'an inner node definition under another ID: the finding names no Page Node',
    mutate: (journey) => (journey.innerNodes['user-1']._id = 'renamed'),
    node: USER,
  },
  {
    code: 'MISSING_CONNECTION_TARGET',
    name: 'the target does not resolve: no targetNode',
    mutate: (journey) =>
      (journey.tree.nodes['age-1'].connections.true = 'nowhere'),
    node: AGE,
  },
  {
    code: 'MISSING_ENTRY_NODE',
    name: 'the entry node does not resolve: no node',
    mutate: (journey) => (journey.tree.entryNodeId = 'nowhere'),
  },
  {
    code: 'MISSING_INNER_NODE',
    name: 'the inner node is named by the reference of its Page Node',
    mutate: (journey) => delete journey.innerNodes['user-1'],
    node: PAGE,
    targetNode: {
      id: 'user-1',
      displayName: 'Username',
      nodeType: 'ValidatedUsernameNode',
    },
  },
  {
    code: 'UNKNOWN_CONNECTION_OUTCOME',
    name: 'a connection that the node does not declare',
    mutate: (journey) =>
      (journey.tree.nodes['age-1'].connections.maybe = 'end'),
    node: AGE,
  },
  {
    code: 'UNCONNECTED_OUTCOME',
    name: 'a declared outcome without connection',
    mutate: (journey) => delete journey.tree.nodes['age-1'].connections.false,
    node: AGE,
  },
  {
    code: 'UNREACHABLE_NODE',
    name: 'a tree node that nothing leads to',
    mutate: (journey) =>
      addTreeNode(
        journey,
        'lock-1',
        'Account Lockout',
        'ScriptedDecisionNode',
        'Scripted Decision'
      ),
    node: {
      id: 'lock-1',
      displayName: 'Account Lockout',
      nodeType: 'ScriptedDecisionNode',
      nodeTypeName: 'Scripted Decision',
    },
  },
  {
    code: 'UNREFERENCED_INNER_NODE',
    name: 'an inner node that no Page Node holds: only its definition names it',
    mutate: (journey) =>
      (journey.innerNodes['stray-1'] = {
        _id: 'stray-1',
        _type: { _id: 'ValidatedPasswordNode', name: 'Platform Password' },
      }),
    node: {
      id: 'stray-1',
      nodeType: 'ValidatedPasswordNode',
      nodeTypeName: 'Platform Password',
    },
  },
  {
    code: 'UNREPRESENTED_NODE',
    name: 'a node definition that the tree does not hold: only its definition names it',
    mutate: (journey) =>
      (journey.nodes['loose-1'] = {
        _id: 'loose-1',
        _type: { _id: 'ScriptedDecisionNode', name: 'Scripted Decision' },
      }),
    node: {
      id: 'loose-1',
      nodeType: 'ScriptedDecisionNode',
      nodeTypeName: 'Scripted Decision',
    },
  },
  {
    code: 'PAGE_NODE_OUTCOME_MISMATCH',
    name: 'the Page Node lacks the outcome of its last child',
    mutate: (journey) => (journey.nodes['page-1']._outcomes = []),
    node: PAGE,
  },
  {
    code: 'NO_REACHABLE_TERMINAL',
    name: 'the finding names the entry node',
    mutate: (journey) =>
      (journey.tree.nodes['age-1'].connections = {
        true: 'page-1',
        false: 'page-1',
      }),
    node: PAGE,
  },
  {
    code: 'NODE_TYPE_MISMATCH',
    name: 'tree form: the type of the tree entry, the title of the definition',
    mutate: (journey) =>
      (journey.tree.nodes['age-1'].nodeType = 'DecisionNode'),
    node: {
      id: 'age-1',
      displayName: 'Check Age',
      nodeType: 'DecisionNode',
      nodeTypeName: 'Scripted Decision',
    },
  },
  {
    code: 'NODE_TYPE_MISMATCH',
    name: 'Page Node form: the type of the reference, the title of the definition',
    mutate: (journey) =>
      (journey.nodes['page-1'].nodes[0].nodeType = 'ValidatedPasswordNode'),
    node: PAGE,
    targetNode: {
      id: 'user-1',
      displayName: 'Username',
      nodeType: 'ValidatedPasswordNode',
      nodeTypeName: 'Platform Username',
    },
  },
  {
    code: 'INNER_NODE_REFERENCED_BY_MULTIPLE_PAGES',
    name: 'an inner node of two Page Nodes',
    mutate: (journey) => {
      addTreeNode(journey, 'page-2', 'Second Page', 'PageNode', 'Page Node');
      journey.nodes['page-2'].nodes = [
        {
          _id: 'user-1',
          displayName: 'Username',
          nodeType: 'ValidatedUsernameNode',
        },
      ];
    },
    node: USER,
  },
  {
    code: 'NODE_ID_COLLISION',
    name: 'the tree node and its definition name the node, not the inner node of the same ID',
    mutate: (journey) =>
      (journey.innerNodes['age-1'] = {
        _id: 'age-1',
        _type: { _id: 'ValidatedPasswordNode', name: 'Platform Password' },
      }),
    node: AGE,
  },
  {
    code: 'MISSING_SCRIPT_DEPENDENCY',
    name: 'a tree node that uses a script',
    mutate: (journey) => {
      journey.scripts = { other: {} };
      journey.nodes['age-1'].script = 'gone';
    },
    node: AGE,
  },
  {
    code: 'MISSING_EMAIL_TEMPLATE_DEPENDENCY',
    name: 'a tree node that sends a template',
    mutate: (journey) => {
      journey.emailTemplates = { other: {} };
      addTreeNode(
        journey,
        'mail-1',
        'Send Welcome',
        'EmailTemplateNode',
        'Email Template'
      );
      journey.nodes['mail-1'].emailTemplateName = 'gone';
    },
    node: {
      id: 'mail-1',
      displayName: 'Send Welcome',
      nodeType: 'EmailTemplateNode',
      nodeTypeName: 'Email Template',
    },
  },
  {
    code: 'MISSING_THEME_DEPENDENCY',
    name: 'a Page Node of a theme: a tree node has no page',
    mutate: (journey) => {
      journey.themes = [{ _id: 'other' }];
      journey.nodes['page-1'].stage = 'themeId=gone';
    },
    node: PAGE,
  },
  {
    code: 'MISSING_SOCIAL_IDENTITY_PROVIDER_DEPENDENCY',
    name: 'an inner node: the Page Node is named too',
    mutate: (journey) => {
      journey.socialIdentityProviders = { other: {} };
      journey.innerNodes['idp-1'] = {
        _id: 'idp-1',
        _type: { _id: 'SelectIdPNode', name: 'Select Identity Provider' },
        _outcomes: [{ id: 'outcome' }],
        filteredProviders: ['google'],
      };
      journey.nodes['page-1'].nodes.unshift({
        _id: 'idp-1',
        displayName: 'Select IDP',
        nodeType: 'SelectIdPNode',
      });
    },
    node: {
      id: 'idp-1',
      displayName: 'Select IDP',
      nodeType: 'SelectIdPNode',
      nodeTypeName: 'Select Identity Provider',
    },
    pageNode: PAGE,
  },
  {
    code: 'MISSING_SAML_ENTITY_DEPENDENCY',
    name: 'a tree node of a SAML entity: both references name it',
    mutate: (journey) => {
      journey.saml2Entities = { other: { entityId: 'other' } };
      addTreeNode(
        journey,
        'saml-1',
        'Federate',
        'product-Saml2Node',
        'SAML2 Authentication'
      );
      journey.nodes['saml-1'].metaAlias = '/alpha/sp';
      journey.nodes['saml-1'].idpEntityId = 'https://idp.example.com';
    },
    node: {
      id: 'saml-1',
      displayName: 'Federate',
      nodeType: 'product-Saml2Node',
      nodeTypeName: 'SAML2 Authentication',
    },
  },
];

/** Every code of the library: adding one without a case here fails the type check. */
const ALL_CODES: Record<JourneyValidationCode, true> = {
  MISSING_NODE_DEFINITION: true,
  NODE_ID_MISMATCH: true,
  MISSING_CONNECTION_TARGET: true,
  MISSING_ENTRY_NODE: true,
  MISSING_INNER_NODE: true,
  UNKNOWN_CONNECTION_OUTCOME: true,
  UNCONNECTED_OUTCOME: true,
  UNREACHABLE_NODE: true,
  UNREFERENCED_INNER_NODE: true,
  UNREPRESENTED_NODE: true,
  PAGE_NODE_OUTCOME_MISMATCH: true,
  NO_REACHABLE_TERMINAL: true,
  NODE_TYPE_MISMATCH: true,
  INNER_NODE_REFERENCED_BY_MULTIPLE_PAGES: true,
  NODE_ID_COLLISION: true,
  TREE_ID_MISMATCH: true,
  MISSING_SCRIPT_DEPENDENCY: true,
  MISSING_EMAIL_TEMPLATE_DEPENDENCY: true,
  MISSING_THEME_DEPENDENCY: true,
  MISSING_SOCIAL_IDENTITY_PROVIDER_DEPENDENCY: true,
  MISSING_SAML_ENTITY_DEPENDENCY: true,
};

describe('a finding names its nodes as the editor shows them', () => {
  test('the journey of the cases is valid', () => {
    expect(allFindings(loginJourney())).toEqual([]);
  });

  test('every code that holds a node ID has a case (TREE_ID_MISMATCH holds none)', () => {
    expect([...new Set(CASES.map((testCase) => testCase.code))].sort()).toEqual(
      Object.keys(ALL_CODES)
        .filter((code) => code !== 'TREE_ID_MISMATCH')
        .sort()
    );
  });

  test.each(CASES)('$code: $name', (testCase) => {
    const journey = loginJourney();
    testCase.mutate(journey);

    const findings = findingsOf(journey, testCase.code);

    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      expect({
        node: finding.node,
        targetNode: finding.targetNode,
        pageNode: finding.pageNode,
      }).toStrictEqual({
        node: testCase.node,
        targetNode: testCase.targetNode,
        pageNode: testCase.pageNode,
      });
      // a node that is not described has no key at all
      for (const key of ['node', 'targetNode', 'pageNode'] as const) {
        if (!testCase[key]) {
          expect(finding).not.toHaveProperty(key);
        }
      }
      // the object describes the node that the ID field names
      expect(finding.node?.id).toBe(finding.node && finding.nodeId);
      expect(finding.targetNode?.id).toBe(
        finding.targetNode && finding.targetNodeId
      );
      expect(finding.pageNode?.id).toBe(finding.pageNode && finding.pageNodeId);
    }
  });

  test('TREE_ID_MISMATCH holds no node ID and no node', () => {
    const findings = validateJourneyExportKeys({ other: loginJourney() });
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('TREE_ID_MISMATCH');
    for (const key of ['node', 'targetNode', 'pageNode']) {
      expect(findings[0]).not.toHaveProperty(key);
    }
  });

  test('a finding of a valid journey does not exist, so nothing is described', () => {
    expect(validateJourneyReferences(loginJourney())).toEqual([]);
    expect(
      validateJourneyDependencies(loginJourney(), isScripted)
    ).toStrictEqual([]);
  });
});

describe('the message still quotes every node ID of the finding', () => {
  // the words of a finding are made from the message by replacing the quoted
  // IDs; a message that stopped quoting an ID would lose the name
  test.each(CASES)('$code: $name', (testCase) => {
    const journey = loginJourney();
    testCase.mutate(journey);

    for (const finding of findingsOf(journey, testCase.code)) {
      for (const id of [
        finding.nodeId,
        finding.targetNodeId,
        finding.pageNodeId,
      ]) {
        if (id !== undefined) {
          expect(finding.message).toContain(`'${id}'`);
        }
      }
    }
  });
});

describe('the fields that a finding had do not change', () => {
  test('a finding keeps its fields, in their order, and gets the new ones last', () => {
    const journey = loginJourney();
    delete journey.innerNodes['user-1'];

    const finding = only(journey, 'MISSING_INNER_NODE');

    expect(finding).toStrictEqual({
      code: 'MISSING_INNER_NODE',
      severity: 'error',
      journeyId: 'Login',
      message:
        "Page Node 'page-1' references missing inner node 'user-1' (ValidatedUsernameNode)",
      nodeId: 'page-1',
      targetNodeId: 'user-1',
      node: PAGE,
      targetNode: {
        id: 'user-1',
        displayName: 'Username',
        nodeType: 'ValidatedUsernameNode',
      },
    });
    expect(Object.keys(finding)).toEqual([
      'code',
      'severity',
      'journeyId',
      'message',
      'nodeId',
      'targetNodeId',
      'node',
      'targetNode',
    ]);
  });

  test('a dependency finding keeps its fields and gets node and pageNode', () => {
    const journey = loginJourney();
    const testCase = CASES.find(
      (candidate) =>
        candidate.code === 'MISSING_SOCIAL_IDENTITY_PROVIDER_DEPENDENCY'
    );
    testCase.mutate(journey);

    expect(
      only(journey, 'MISSING_SOCIAL_IDENTITY_PROVIDER_DEPENDENCY')
    ).toStrictEqual({
      code: 'MISSING_SOCIAL_IDENTITY_PROVIDER_DEPENDENCY',
      severity: 'warning',
      journeyId: 'Login',
      message:
        "Node 'idp-1' in Page Node 'page-1' references socialIdentityProvider 'google' missing from the export",
      nodeId: 'idp-1',
      pageNodeId: 'page-1',
      dependencyType: 'socialIdentityProvider',
      dependencyId: 'google',
      node: testCase.node,
      pageNode: PAGE,
    });
  });

  test('the journey that is validated is not changed', () => {
    for (const testCase of CASES) {
      const journey = loginJourney();
      testCase.mutate(journey);
      const before = JSON.stringify(journey);

      expect(allFindings(journey).length).toBeGreaterThan(0);

      expect(JSON.stringify(journey)).toBe(before);
    }
  });

  test('the index of a journey is built once, and only when there is a finding', () => {
    // the keys of the tree nodes are listed by every check once and by the
    // index once: a count that grows with the findings is an index per finding
    const countKeyListings = (journey: Journey): number => {
      let listings = 0;
      journey.tree.nodes = new Proxy(journey.tree.nodes, {
        ownKeys: (target) => {
          listings++;
          return Reflect.ownKeys(target);
        },
      });
      validateJourneyReferences(journey);
      return listings;
    };
    const none = loginJourney();
    const one = loginJourney();
    one.tree.nodes['age-1'].connections.maybe = 'end';
    const many = loginJourney();
    for (const outcome of ['a', 'b', 'c', 'd', 'e', 'f']) {
      many.tree.nodes['age-1'].connections[outcome] = 'end';
    }

    const [noFinding, oneFinding, sixFindings] = [none, one, many].map(
      countKeyListings
    );

    expect(validateJourneyReferences(many)).toHaveLength(6);
    expect(oneFinding).toBe(noFinding + 1);
    expect(sixFindings).toBe(oneFinding);
  });
});

describe('where a node is looked up', () => {
  test('a tree node is named by the tree entry, before any other node of the same ID', () => {
    const journey = loginJourney();
    // a Page Node child and an inner node definition with the ID of the tree node
    journey.nodes['page-1'].nodes.push({
      _id: 'age-1',
      displayName: 'Some Child',
      nodeType: 'ValidatedPasswordNode',
    });
    journey.innerNodes['age-1'] = {
      _id: 'age-1',
      _type: { _id: 'ValidatedPasswordNode', name: 'Platform Password' },
    };

    expect(only(journey, 'NODE_ID_COLLISION').node).toStrictEqual(AGE);
  });

  test('an inner node is named by its Page Node reference, before its definition', () => {
    const journey = loginJourney();
    // the reference declares another type than the definition has
    journey.nodes['page-1'].nodes[0].nodeType = 'ValidatedPasswordNode';

    expect(only(journey, 'NODE_TYPE_MISMATCH').targetNode).toStrictEqual({
      id: 'user-1',
      displayName: 'Username',
      nodeType: 'ValidatedPasswordNode',
      nodeTypeName: 'Platform Username',
    });
  });

  test('a node with a definition only is named by the definition', () => {
    const journey = loginJourney();
    journey.innerNodes['stray-1'] = {
      _id: 'stray-1',
      _type: { _id: 'ValidatedPasswordNode', name: 'Platform Password' },
    };

    expect(only(journey, 'UNREFERENCED_INNER_NODE').node).toStrictEqual({
      id: 'stray-1',
      nodeType: 'ValidatedPasswordNode',
      nodeTypeName: 'Platform Password',
    });
  });

  test('the type of a tree entry without a node type is the type of its definition', () => {
    const journey = loginJourney();
    addTreeNode(
      journey,
      'lock-1',
      'Account Lockout',
      'ScriptedDecisionNode',
      'Scripted Decision'
    );
    delete journey.tree.nodes['lock-1'].nodeType;

    expect(only(journey, 'UNREACHABLE_NODE').node).toStrictEqual({
      id: 'lock-1',
      displayName: 'Account Lockout',
      nodeType: 'ScriptedDecisionNode',
      nodeTypeName: 'Scripted Decision',
    });
  });

  test('the title of the type of a legacy inner node comes from innernodes', () => {
    const journey = loginJourney();
    journey.innernodes = journey.innerNodes;
    delete journey.innerNodes;
    journey.nodes['page-1'].nodes[0].nodeType = 'ValidatedPasswordNode';

    expect(only(journey, 'NODE_TYPE_MISMATCH').targetNode).toMatchObject({
      id: 'user-1',
      nodeTypeName: 'Platform Username',
    });
  });

  test('the title of the type of an inner node comes from innernodes when both spellings are populated', () => {
    const journey = loginJourney();
    journey.emailTemplates = { other: {} };
    journey.innernodes = {
      'legacy-1': {
        _id: 'legacy-1',
        _type: { _id: 'EmailTemplateNode', name: 'Email Template' },
        emailTemplateName: 'gone',
      },
    };
    journey.nodes['page-1'].nodes.unshift({
      _id: 'legacy-1',
      displayName: 'Send Welcome',
      nodeType: 'EmailTemplateNode',
    });

    const finding = only(journey, 'MISSING_EMAIL_TEMPLATE_DEPENDENCY');

    expect(finding.node).toStrictEqual({
      id: 'legacy-1',
      displayName: 'Send Welcome',
      nodeType: 'EmailTemplateNode',
      nodeTypeName: 'Email Template',
    });
    expect(finding.pageNode).toStrictEqual(PAGE);
  });

  test('an ID that resolves nowhere has no object, and the validation does not throw', () => {
    // the keys of Object.prototype are no nodes
    for (const missing of ['nowhere', 'constructor', 'toString']) {
      const journey = loginJourney();
      journey.tree.nodes['age-1'].connections.true = missing;

      const finding = only(journey, 'MISSING_CONNECTION_TARGET');

      expect(finding.targetNodeId).toBe(missing);
      expect(finding).not.toHaveProperty('targetNode');
      expect(finding.node).toStrictEqual(AGE);
    }
  });

  test('a journey without nodes and without definitions is validated', () => {
    const findings = validateJourneyReferences({ tree: { _id: 'Empty' } });

    expect(findings.map((finding) => finding.code)).toEqual([
      'MISSING_ENTRY_NODE',
    ]);
    expect(findings[0]).not.toHaveProperty('node');
  });
});

describe('what is left out', () => {
  test.each([
    ['missing', undefined],
    ['empty', ''],
    ['blank', '  \t '],
  ])(
    'a display name that is %s is absent, not an empty string',
    (_, displayName) => {
      const journey = loginJourney();
      addTreeNode(
        journey,
        'lock-1',
        displayName,
        'ScriptedDecisionNode',
        'Scripted Decision'
      );

      const node = only(journey, 'UNREACHABLE_NODE').node;

      expect(node).toStrictEqual({
        id: 'lock-1',
        nodeType: 'ScriptedDecisionNode',
        nodeTypeName: 'Scripted Decision',
      });
      expect(node).not.toHaveProperty('displayName');
    }
  );

  test('a blank title of the node type is absent', () => {
    const journey = loginJourney();
    addTreeNode(journey, 'lock-1', 'Account Lockout', 'LockNode', ' ');

    expect(only(journey, 'UNREACHABLE_NODE').node).toStrictEqual({
      id: 'lock-1',
      displayName: 'Account Lockout',
      nodeType: 'LockNode',
    });
  });

  test('a name of the tenant goes through unchanged, with its quotes and control characters', () => {
    const name = 'Say "hi" \u001b[31m and \'bye\'';
    const journey = loginJourney();
    addTreeNode(
      journey,
      'lock-1',
      name,
      'ScriptedDecisionNode',
      'Scripted Decision'
    );

    const finding = only(journey, 'UNREACHABLE_NODE');

    expect(finding.node.displayName).toBe(name);
    expect(finding.message).toBe(
      "Tree node 'lock-1' is not reachable from the entry node"
    );
  });
});

describe('nodes that cannot be told apart by name and type', () => {
  /** Two Page Nodes named "Login Page", the second one without a connection to it. */
  function twoLoginPages(): Journey {
    const journey = loginJourney();
    addTreeNode(journey, 'page-2', 'Login Page', 'PageNode', 'Page Node');
    journey.nodes['page-2'].nodes = [
      {
        _id: 'user-2',
        displayName: 'Phone',
        nodeType: 'ValidatedUsernameNode',
      },
    ];
    journey.nodes['page-2']._outcomes = [{ id: 'outcome' }];
    journey.innerNodes['user-2'] = {
      _id: 'user-2',
      _type: { _id: 'ValidatedUsernameNode', name: 'Platform Username' },
      _outcomes: [{ id: 'outcome' }],
    };
    return journey;
  }

  test('two Page Nodes with the same name are both ambiguous, also the one without a finding', () => {
    const journey = twoLoginPages();

    const finding = only(journey, 'UNREACHABLE_NODE');

    expect(finding.nodeId).toBe('page-2');
    expect(finding.node).toStrictEqual({
      id: 'page-2',
      displayName: 'Login Page',
      nodeType: 'PageNode',
      nodeTypeName: 'Page Node',
      ambiguous: true,
    });
    // the twin has a finding of its own: it is marked as well
    journey.nodes['page-1']._outcomes = [];
    expect(only(journey, 'PAGE_NODE_OUTCOME_MISMATCH').node).toStrictEqual({
      ...PAGE,
      ambiguous: true,
    });
  });

  test('a node that is the only one of its name and type has no ambiguous key', () => {
    const journey = twoLoginPages();
    journey.tree.nodes['age-1'].connections.true = 'nowhere';

    const finding = only(journey, 'MISSING_CONNECTION_TARGET');

    expect(finding.node).toStrictEqual(AGE);
    expect(finding.node).not.toHaveProperty('ambiguous');
  });

  test('the same name with another node type is no tie', () => {
    const journey = loginJourney();
    addTreeNode(journey, 'age-2', 'Check Age', 'DecisionNode', 'Decision');

    expect(only(journey, 'UNREACHABLE_NODE').node).toStrictEqual({
      id: 'age-2',
      displayName: 'Check Age',
      nodeType: 'DecisionNode',
      nodeTypeName: 'Decision',
    });
  });

  test('the same node type with another name is no tie', () => {
    const journey = loginJourney();
    addTreeNode(
      journey,
      'age-2',
      'Check Country',
      'ScriptedDecisionNode',
      'Scripted Decision'
    );

    expect(only(journey, 'UNREACHABLE_NODE').node).not.toHaveProperty(
      'ambiguous'
    );
  });

  test('a tree node and a Page Node child with the same name and type are a tie, also when the definition of the child is gone', () => {
    const journey = loginJourney();
    addTreeNode(
      journey,
      'user-tree',
      'Username',
      'ValidatedUsernameNode',
      'Platform Username'
    );
    delete journey.innerNodes['user-1'];

    expect(only(journey, 'UNREACHABLE_NODE').node).toStrictEqual({
      ...USER,
      id: 'user-tree',
      ambiguous: true,
    });
    expect(only(journey, 'MISSING_INNER_NODE').targetNode).toStrictEqual({
      id: 'user-1',
      displayName: 'Username',
      nodeType: 'ValidatedUsernameNode',
      ambiguous: true,
    });
  });

  test('one inner node that two Page Nodes hold is no tie with itself', () => {
    const journey = loginJourney();
    addTreeNode(journey, 'page-2', 'Second Page', 'PageNode', 'Page Node');
    journey.nodes['page-2'].nodes = [
      {
        _id: 'user-1',
        displayName: 'Username',
        nodeType: 'ValidatedUsernameNode',
      },
    ];

    const node = only(journey, 'INNER_NODE_REFERENCED_BY_MULTIPLE_PAGES').node;

    expect(node).toStrictEqual(USER);
    expect(node).not.toHaveProperty('ambiguous');
  });

  test('a tree node that a Page Node holds as well is counted once', () => {
    const journey = loginJourney();
    journey.nodes['page-1'].nodes.push({
      _id: 'age-1',
      displayName: 'Check Age',
      nodeType: 'ScriptedDecisionNode',
    });
    journey.tree.nodes['age-1'].connections.maybe = 'end';

    const node = only(journey, 'UNKNOWN_CONNECTION_OUTCOME').node;

    expect(node).toStrictEqual(AGE);
    expect(node).not.toHaveProperty('ambiguous');
  });

  test('nodes without a name are never ambiguous: the ID tells them apart', () => {
    const journey = loginJourney();
    addTreeNode(journey, 'lock-1', undefined, 'LockNode', 'Lock');
    addTreeNode(journey, 'lock-2', undefined, 'LockNode', 'Lock');

    const nodes = findingsOf(journey, 'UNREACHABLE_NODE').map(
      (finding) => finding.node
    );

    expect(nodes).toStrictEqual([
      { id: 'lock-1', nodeType: 'LockNode', nodeTypeName: 'Lock' },
      { id: 'lock-2', nodeType: 'LockNode', nodeTypeName: 'Lock' },
    ]);
  });

  test('the Page Node of a dependency finding is ambiguous when its name and type are shared', () => {
    const journey = twoLoginPages();
    const social = CASES.find(
      (candidate) =>
        candidate.code === 'MISSING_SOCIAL_IDENTITY_PROVIDER_DEPENDENCY'
    );
    social.mutate(journey);

    const finding = only(
      journey,
      'MISSING_SOCIAL_IDENTITY_PROVIDER_DEPENDENCY'
    );

    expect(finding.pageNode).toStrictEqual({ ...PAGE, ambiguous: true });
    expect(finding.node).not.toHaveProperty('ambiguous');
  });
});
