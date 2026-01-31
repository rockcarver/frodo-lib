import * as NodeApi from '../../api/NodeApi';
import { state } from '../../index';

export const node1: NodeApi.NodeSkeleton = {
  _id: '67693475-3a58-4e38-bcc6-037b3fe46a58',
  usernameAttribute: 'userName',
  validateInput: false,
  _type: {
    _id: 'ValidatedUsernameNode',
    name: 'Platform Username',
    collection: true,
  },
  _outcomes: [
    {
      id: 'outcome',
      displayName: 'Outcome',
    },
  ],
};

export const node2: NodeApi.NodeSkeleton = {
  _id: '18ffdd4b-41b7-41b3-8248-f4fdfd68423f',
  validateInput: false,
  passwordAttribute: 'password',
  _type: {
    _id: 'ValidatedPasswordNode',
    name: 'Platform Password',
    collection: true,
  },
  _outcomes: [
    {
      id: 'outcome',
      displayName: 'Outcome',
    },
  ],
};

export const node3: NodeApi.NodeSkeleton = {
  _id: 'b726262c-641e-4fa5-b276-98e129b44cd9',
  identityResource: 'managed/user',
  patchAsObject: false,
  ignoredFields: [],
  identityAttribute: 'userName',
  _type: {
    _id: 'PatchObjectNode',
    name: 'Patch Object',
    collection: true,
  },
  _outcomes: [
    {
      id: 'PATCHED',
      displayName: 'Patched',
    },
    {
      id: 'FAILURE',
      displayName: 'Failed',
    },
  ],
};

export const node4: NodeApi.NodeSkeleton = {
  _id: '23bab9d4-1663-450f-8a4b-680f44f54fd6',
  identityResource: 'managed/user',
  _type: {
    _id: 'CreateObjectNode',
    name: 'Create Object',
    collection: true,
  },
  _outcomes: [
    {
      id: 'CREATED',
      displayName: 'Created',
    },
    {
      id: 'FAILURE',
      displayName: 'Failed',
    },
  ],
};

export const node5: NodeApi.NodeSkeleton = {
  _id: '5227de7a-02db-4f25-858e-c8d4f0e0b600',
  attributes: {
    errorMessage: 'An error has occurred!',
  },
  _type: {
    _id: 'SetStateNode',
    name: 'Set State',
    collection: true,
    version: '1.0',
  },
  _outcomes: [
    {
      id: 'outcome',
      displayName: 'outcome',
    },
  ],
};

export const customNode1: NodeApi.CustomNodeSkeleton = {
  _id: 'a605506774a848f7877b4d17a453bd39-1',
  serviceName: 'a605506774a848f7877b4d17a453bd39',
  displayName: 'Has Session - TEST',
  description: 'Checks if the user has a current session.',
  outcomes: ['True', 'False'],
  outputs: [],
  inputs: [],
  script:
    "var SCRIPT_OUTCOMES = {\n    TRUE: 'True',\n    FALSE: 'False'\n}\n\nfunction main() {\n    action.goTo(typeof existingSession === \"undefined\" ? SCRIPT_OUTCOMES.FALSE : SCRIPT_OUTCOMES.TRUE);\n}\n\nmain();\n",
  errorOutcome: false,
  tags: ['utilities'],
  properties: {},
};

export const customNode2: NodeApi.CustomNodeSkeleton = {
  _id: 'aaaa3fb2f5dc42dd9772bedc93898bd8-1',
  serviceName: 'aaaa3fb2f5dc42dd9772bedc93898bd8',
  displayName: 'Display State - TEST',
  description:
    'Debug node that displays the shared and transient state of the journey for debugging purposes.',
  outcomes: ['outcome'],
  outputs: [],
  inputs: [],
  script:
    'var SCRIPT_OUTCOMES = {\n  OUTCOME: "outcome"\n};\n\nfunction main() {\n    if (!callbacks.isEmpty()) {\n        action.goTo(SCRIPT_OUTCOMES.OUTCOME);\n        return;\n    }\n    var keySet = nodeState.keys(); // Java Set<String>\n    var keys = Array.from(keySet); // Make it into JavaScript array\n    debugState = {};\n    for (var i in keys) {\n        var k = new String(keys[i]);\n        var item = nodeState.get(k);\n        if (typeof item === "object") {\n            debugState[k] = nodeState.getObject(k);\n        } else {\n            debugState[k] = nodeState.get(k);\n        }\n    }\n    if (properties.displayFormat === "JSON") {\n        callbacksBuilder.textOutputCallback(0, `<pre style="text-align: left;">${JSON.stringify(debugState, null, 2)}</pre>`);\n        return;\n    }\n    callbacksBuilder.textOutputCallback(0, `<table><tr><td style="border: 1px solid black;">Key</td><td style="border: 1px solid black;">Value</td></tr>${Array.from(Object.keys(debugState).map(k => `<tr><td style="border: 1px solid black;"><pre style="text-align: left;">${k}</pre></td><td style="border: 1px solid black;"><pre style="text-align: left;">${debugState[k]}</pre></td></tr>`))}</table>`);\n}\n\nmain();\n',
  errorOutcome: false,
  tags: ['debug', 'testing'],
  properties: {
    displayFormat: {
      title: 'Display Format',
      description: 'The format in which to display the states.',
      type: 'STRING',
      required: true,
      defaultValue: 'TABLE',
      options: {
        TABLE: 'HTML Table',
        JSON: 'Raw JSON',
      },
      multivalued: false,
    },
  },
};

export const customNode3: NodeApi.CustomNodeSkeleton = {
  _id: 'a6063fb2f5dc42dd9772bedc93898bd8-1',
  serviceName: 'a6063fb2f5dc42dd9772bedc93898bd8',
  displayName: 'ALU - TEST',
  description:
    'Simple ALU that performs basic binary math operations. Expects an "x" and "y" value on the shared state, and will produce a new "z" value on the shared state as output.',
  outcomes: ['Success'],
  outputs: ['z'],
  inputs: ['x', 'y'],
  script:
    'var SCRIPT_OUTCOMES = {\n    SUCCESS: \'Success\'\n};\n\nvar OPERATORS = {\n    ADD: "ADD",\n    SUBTRACT: "SUBTRACT",\n    MULTIPLY: "MULTIPLY",\n    DIVIDE: "DIVIDE"\n}\n\nfunction main() {\n    var a = Number(properties.a);\n    var b = Number(properties.b);\n    switch (properties.operator) {\n        case OPERATORS.ADD:\n            nodeState.putShared("z", a + b);\n            break;\n        case OPERATORS.SUBTRACT:\n            nodeState.putShared("z", a - b);\n            break;\n        case OPERATORS.MULTIPLY:\n            nodeState.putShared("z", a * b);\n            break;\n        case OPERATORS.DIVIDE:\n            if (b == 0) throw new Error("Cannot divide by 0");\n            nodeState.putShared("z", a / b);\n            break;\n        default: throw new Error("Unknown operator.");\n    }\n    action.goTo(SCRIPT_OUTCOMES.SUCCESS);\n}\n\nmain();\n',
  errorOutcome: true,
  tags: ['math', 'utilities'],
  properties: {
    operator: {
      title: 'Operator',
      description: 'The operation to perform.',
      type: 'STRING',
      required: true,
      defaultValue: 'ADD',
      options: {
        ADD: '+',
        MULTIPLY: '*',
        SUBTRACT: '-',
        DIVIDE: '/',
      },
      multivalued: false,
    },
  },
};

export const customNode4: NodeApi.CustomNodeSkeleton = {
  _id: 'a15e2efb3deb4d4ea338c74a6440b69f-1',
  serviceName: 'a15e2efb3deb4d4ea338c74a6440b69f',
  displayName: 'Vector ALU - TEST',
  description:
    'Simple ALU that performs basic binary vector math operations. Outputs the result onto the shared state with key "c".',
  outcomes: ['Success'],
  outputs: ['c'],
  inputs: [],
  script:
    'var SCRIPT_OUTCOMES = {\n    SUCCESS: \'Success\'\n};\n\nvar OPERATORS = {\n    ADD: "ADD",\n    SUBTRACT: "SUBTRACT",\n    DOT: "DOT",\n    CROSS: "CROSS"\n}\n\nfunction add(a, b) {\n    return a.map((v, i) => v + b[i]);\n}\n\nfunction subtract(a, b) {\n    return a.map((v, i) => v - b[i]);\n}\n\nfunction dot(a, b) {\n    return a.reduce((sum, v, i) => sum + v * b[i], 0);\n}\n\nfunction cross(a, b) {\n    return [\n        a[1] * b[2] - a[2] * b[1],\n        a[2] * b[0] - a[0] * b[2],\n        a[0] * b[1] - a[1] * b[0]\n    ];\n}\n\nfunction main() {\n    if (properties.a.length !== properties.b.length) throw new Error("Vectors not the same dimension.");\n    switch (properties.operator) {\n        case OPERATORS.ADD:\n            nodeState.putShared("c", add(properties.a, properties.b));\n            break;\n        case OPERATORS.SUBTRACT:\n            nodeState.putShared("c", subtract(properties.a, properties.b));\n            break;\n        case OPERATORS.DOT:\n            nodeState.putShared("c", dot(properties.a, properties.b));\n            break;\n        case OPERATORS.CROSS:\n            if (properties.a.length !== 3) throw new Error("Vectors not dimension 3 for cross product");\n            nodeState.putShared("c", cross(properties.a, properties.b));\n            break;\n        default: throw new Error("Unknown operator.");\n    }\n    action.goTo(SCRIPT_OUTCOMES.SUCCESS);\n}\n\nmain();\n',
  errorOutcome: true,
  tags: ['math', 'vector', 'utilities'],
  properties: {
    a: {
      title: 'A',
      description: 'Left vector operand',
      type: 'NUMBER',
      required: true,
      defaultValue: [1, 2, 3],
      multivalued: true,
    },
    b: {
      title: 'B',
      description: 'Right vector operand',
      type: 'NUMBER',
      required: true,
      defaultValue: [4, 5, 6],
      multivalued: true,
    },
    operator: {
      title: 'Operator',
      description: 'The binary operation to perform on the vectors.',
      type: 'STRING',
      required: true,
      defaultValue: 'DOT',
      options: {
        ADD: '+',
        CROSS: 'X',
        DOT: '.',
        SUBTRACT: '-',
      },
      multivalued: false,
    },
  },
};

export async function stageNode(node: NodeApi.NodeSkeleton, createNew = false) {
  try {
    await NodeApi.deleteNode({
      nodeId: node._id,
      nodeType: node._type._id,
      state,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  } finally {
    if (createNew) {
      await NodeApi.putNode({
        nodeId: node._id,
        nodeType: node._type._id,
        nodeData: node,
        state,
      });
    }
  }
}

export async function stageCustomNode(
  customNode: NodeApi.CustomNodeSkeleton,
  createNew = false
) {
  try {
    await NodeApi.deleteCustomNode({
      nodeId: customNode._id,
      state,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  } finally {
    if (createNew) {
      await NodeApi.createCustomNode({
        nodeData: customNode,
        state,
      });
    }
  }
}

export function setup() {
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // setup node1 - delete if exists, then create
      await stageNode(node1, true);
      // setup node2 - delete if exists
      await stageNode(node2);
      // setup node3 - delete if exists, then create
      await stageNode(node3, true);
      // setup node4 - delete if exists, then create
      await stageNode(node4, true);
      // setup node5 - delete if exists
      await stageNode(node5);
      // setup customNode1 - delete if exists, then create
      await stageCustomNode(customNode1, true);
      // setup customNode2 - delete if exists, then create
      await stageCustomNode(customNode2, true);
      // setup customNode3 - delete if exists
      await stageCustomNode(customNode3);
      // setup customNode4 - delete if exists, then create
      await stageCustomNode(customNode4, true);
    }
  });

  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageNode(node1);
      await stageNode(node2);
      await stageNode(node3);
      await stageNode(node4);
      await stageNode(node5);
      await stageCustomNode(customNode1);
      await stageCustomNode(customNode2);
      await stageCustomNode(customNode3);
      await stageCustomNode(customNode4);
    }
  });
}
