/**
 * Argument contracts of the capability registry.
 *
 * @remarks
 * A capability descriptor is derived from the TSDoc `@param` tags of its
 * method (see `Help.ts`, which is generated from them). A method whose TSDoc
 * has no `@param` tag gets an empty parameter contract, and the runtime then
 * forwards the whole `namedArgs` object as ONE argument; a method whose TSDoc
 * names the parameters in another order, under other names or leaves one out
 * gets its named arguments in the wrong positions or not at all. These tests
 * pin that the parameter names of every descriptor equal the names of the
 * signature in the order of the signature, with no baseline and no
 * exemption list, and they pin the contract of the capabilities that were
 * repaired against the real signature.
 */

import { frodo } from '../lib/FrodoLib';
import { getHelpMetadataByMethod } from '../utils/HelpUtils';
import { CAPABILITY_META, resolveCapabilityMeta } from './CapabilityMetadata';
import { applyCapabilityPolicy, MCP_POLICY_PRESETS } from './CapabilityPolicy';
import { buildCapabilityInventory } from './CapabilityRegistry';
import type { McpCapabilityParameter } from './CapabilityTypes';

/** Trailing callbacks that a JSON payload cannot carry and the runtime supplies. */
const TRAILING_CALLBACKS = ['resultCallback', 'leftOutCallback'];

/** A parameter as the signature in the `export type` block declares it. */
type SignatureParameter = {
  name: string;
  optional: boolean;
  /** Type text; an object literal type is `object`. */
  type: string;
};

/**
 * Reads the parameters of a signature: splits the text between the outer
 * parentheses at the commas of the top level, ignoring commas inside brackets,
 * braces, generics and function types (`=>` does not close a generic).
 *
 * @param signature signature text as written in the `export type` block
 * @returns parameters in declaration order, without a trailing callback
 */
function signatureParameters(signature: string): SignatureParameter[] {
  const open = signature.indexOf('(');
  if (open === -1) return [];
  let depth = 0;
  let close = -1;
  for (let i = open; i < signature.length; i++) {
    if (signature[i] === '(') depth++;
    if (signature[i] === ')') {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  const text = signature.slice(open + 1, close);
  const parts: string[] = [];
  let level = 0;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const arrow = ch === '>' && text[i - 1] === '=';
    if ('({[<'.includes(ch)) level++;
    if (')}]>'.includes(ch) && !arrow) level--;
    if (ch === ',' && level === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  const parameters = parts.map((part): SignatureParameter => {
    const match = part.trim().match(/^(\w+)(\?)?\s*:\s*([\s\S]*)$/);
    const type = (match?.[3] ?? '').trim();
    return {
      name: match?.[1] ?? '',
      optional: !!match?.[2],
      type: type.startsWith('{') ? 'object' : type,
    };
  });
  while (
    parameters.length > 0 &&
    TRAILING_CALLBACKS.includes(parameters[parameters.length - 1].name)
  ) {
    parameters.pop();
  }
  return parameters;
}

/** Parameter names of a signature, in declaration order. */
function signatureParameterNames(signature: string): string[] {
  return signatureParameters(signature).map(({ name }) => name);
}

/**
 * Parameters of a signature that a descriptor leaves out on purpose besides
 * the trailing callbacks, as `<capability id>.<parameter name>`, each with the
 * reason.
 */
const NOT_EXPOSED: Record<string, string> = {
  'login.getTokens.credentialOverride':
    'selects which credential the call uses: a caller must not choose it, so it is documented in the signature and left out of the arguments of the capability',
};

/**
 * Compares the parameters a descriptor declares with the signature.
 *
 * @param declared parameters of the descriptor
 * @param signatureNames parameter names of the signature, in order, without a trailing callback
 * @param notExposed names of signature parameters the descriptor leaves out on purpose
 * @returns `undefined` when they agree, otherwise a description of the first difference
 */
function contractDifference(
  declared: McpCapabilityParameter[],
  signatureNames: string[],
  notExposed: string[] = []
): string | undefined {
  const expected = signatureNames.filter((name) => !notExposed.includes(name));
  const ordered = [...declared].sort(
    (left, right) => (left.position ?? 0) - (right.position ?? 0)
  );
  const names = ordered.map(({ name }) => name);
  if (names.join(',') !== expected.join(',')) {
    return `descriptor [${names.join(', ')}] but signature [${expected.join(', ')}]`;
  }
  for (const parameter of ordered) {
    // A named call is mapped to the position of the parameter: it has to be
    // the position the signature has, also when a parameter before it is left
    // out of the descriptor.
    const position = signatureNames.indexOf(parameter.name);
    if (parameter.position !== position) {
      return `${parameter.name} is at position ${parameter.position} but the signature has it at ${position}`;
    }
  }
  return undefined;
}

describe('capability argument contracts', () => {
  const inventory = buildCapabilityInventory(frodo, { includeUtils: false });
  const byId = new Map(
    inventory.map((capability) => [capability.id, capability])
  );

  test('signatureParameterNames reads the shapes the signatures use', () => {
    expect(signatureParameterNames('f(): Promise<void>')).toEqual([]);
    expect(
      signatureParameterNames(
        'f( script: string, globals?: { [key: string]: any } ): Promise<any>'
      )
    ).toEqual(['script', 'globals']);
    expect(
      signatureParameterNames(
        'f(a: Map<string, number>, cb: (x: string, y: number) => void, b?: string[]): void'
      )
    ).toEqual(['a', 'cb', 'b']);
    expect(
      signatureParameterNames(
        'f(id: string, resultCallback: ResultCallback<X>): Promise<void>'
      )
    ).toEqual(['id']);
  });

  test('signatureParameters reads the optional marker and the type', () => {
    expect(
      signatureParameters(
        'f( script: string, globals?: { [key: string]: any }, list?: string[], cfg: Map<string, number> ): Promise<any>'
      )
    ).toEqual([
      { name: 'script', optional: false, type: 'string' },
      { name: 'globals', optional: true, type: 'object' },
      { name: 'list', optional: true, type: 'string[]' },
      { name: 'cfg', optional: false, type: 'Map<string, number>' },
    ]);
  });

  test('contractDifference compares names in signature order and positions', () => {
    const parameter = (
      name: string,
      position: number
    ): McpCapabilityParameter => ({
      name,
      type: 'string',
      required: true,
      position,
    });
    const signature = ['importData', 'globalConfig', 'options'];
    expect(
      contractDifference(
        [
          parameter('importData', 0),
          parameter('globalConfig', 1),
          parameter('options', 2),
        ],
        signature
      )
    ).toBeUndefined();
    // another order, the way the TSDoc of agent.importAgents had it
    expect(
      contractDifference(
        [
          parameter('globalConfig', 0),
          parameter('importData', 1),
          parameter('options', 2),
        ],
        signature
      )
    ).toMatch(/descriptor \[globalConfig, importData, options\]/);
    // a malformed name, the way the TSDoc of idm.crypto.decryptMap had it
    expect(contractDifference([parameter('{{', 0)], ['value'])).toMatch(
      /descriptor \[\{\{\]/
    );
    // a parameter missing from the end, and an extra one
    expect(
      contractDifference(
        [parameter('importData', 0), parameter('globalConfig', 1)],
        signature
      )
    ).toMatch(/signature \[importData, globalConfig, options\]/);
    expect(
      contractDifference([parameter('importData', 0)], ['importData'])
    ).toBeUndefined();
    expect(
      contractDifference(
        [parameter('importData', 0), parameter('extra', 1)],
        ['importData']
      )
    ).toMatch(/descriptor \[importData, extra\]/);
    // a parameter left out on purpose is not expected, and the others keep
    // the position of the signature
    expect(
      contractDifference(
        [parameter('a', 0), parameter('c', 2)],
        ['a', 'b', 'c'],
        ['b']
      )
    ).toBeUndefined();
    expect(
      contractDifference(
        [parameter('a', 0), parameter('c', 1)],
        ['a', 'b', 'c'],
        ['b']
      )
    ).toMatch(/c is at position 1 but the signature has it at 2/);
    // the same names in another case or an extra parameter are differences
    expect(
      contractDifference([parameter('Value', 0)], ['value'])
    ).toBeDefined();
  });

  test('the parameter names of every descriptor equal the names of its signature, in order', () => {
    // Zero tolerance, no baseline: the contract of a capability is the TSDoc
    // `@param` list of its method, and the runtime maps a named call to the
    // positions and the names of that list (frodo-cli#1373). So the names of
    // the descriptor, in position order, have to be the names of the
    // signature that the generator read from the `export type` block (the
    // same text `required` comes from), apart from the parameters that the
    // metadata leaves out on purpose (the trailing callbacks that a JSON
    // payload cannot carry, and the entries of NOT_EXPOSED below).
    const violations: string[] = [];
    for (const capability of inventory) {
      const docs = getHelpMetadataByMethod(capability.methodName);
      if (docs.length === 0) {
        // A method without a help entry has no parameters in its contract
        // either, and nothing here can tell what its signature is: that is
        // the defect too, not an exemption.
        violations.push(`${capability.id}: no help entry`);
        continue;
      }
      const signatureNames = signatureParameterNames(docs[0].signature);
      // What the TSDoc lists is what the descriptor is derived from: every
      // parameter of the signature, also the one that is not offered to an MCP
      // caller, has a tag, in the order of the signature.
      const documented = docs[0].params.map(({ name }) => name);
      while (
        documented.length > signatureNames.length &&
        TRAILING_CALLBACKS.includes(documented[documented.length - 1])
      ) {
        documented.pop();
      }
      if (documented.join(',') !== signatureNames.join(',')) {
        violations.push(
          `${capability.id}: TSDoc [${documented.join(', ')}] but signature [${signatureNames.join(', ')}]`
        );
      }
      const notExposed = [
        ...(resolveCapabilityMeta(capability.id)?.excludeParameters ?? []),
      ];
      const difference = contractDifference(
        capability.parameters ?? [],
        signatureNames,
        notExposed
      );
      if (difference) violations.push(`${capability.id}: ${difference}`);
    }
    expect(violations.sort()).toEqual([]);
  });

  test('only the trailing callbacks and the entries of NOT_EXPOSED are left out of a descriptor', () => {
    // A parameter that the metadata excludes is an argument that an MCP
    // caller cannot set, so each one has to be named here with its reason.
    // A trailing callback is not a JSON value; there is no other kind of
    // exclusion in the metadata.
    const excluded: string[] = [];
    for (const [id, meta] of Object.entries(CAPABILITY_META)) {
      for (const name of meta.excludeParameters ?? []) {
        if (!TRAILING_CALLBACKS.includes(name)) {
          excluded.push(`${id}.${name}`);
        }
      }
    }
    expect(excluded.sort()).toEqual(Object.keys(NOT_EXPOSED).sort());
    for (const [id, reason] of Object.entries(NOT_EXPOSED)) {
      expect(reason.length).toBeGreaterThan(20);
      expect(id.split('.').length).toBeGreaterThan(2);
    }
  });

  describe('the capabilities that had no contract', () => {
    // The contract of each of the 17, written out as `name?: type` in the order
    // of the signature of the facade type (`?` for an optional parameter, an
    // object literal type is `object`). It is stated here on purpose, not read
    // from the descriptor or from the generated help: a parameter that becomes
    // required, optional or of another type has to change this table too.
    const REPAIRED_CONTRACTS: Record<string, string[]> = {
      'admin.executeRfc7523AuthZGrantFlow': [
        'clientId: string',
        'iss: string',
        'jwk: JwkRsa',
        'sub: string',
        'scope?: string[]',
      ],
      'admin.generateRfc7523AuthZGrantArtefacts': [
        'clientId: string',
        'iss: string',
        'jwk?: JwkRsa',
        'sub?: string',
        'scope?: string[]',
        'options?: object',
      ],
      'admin.generateRfc7523ClientAuthNArtefacts': [
        'clientId: string',
        'aud?: string',
        'jwk?: JwkRsa',
        'options?: object',
      ],
      'admin.trainAA': [
        'apiKey: string',
        'apiSecret: string',
        'customUsernames?: string[]',
        'customUserAgents?: string[]',
        'customIPs?: string[]',
        'loginsPerUser?: number',
        'service?: string',
      ],
      'authz.policySet.createPolicySet': [
        'policySetData: PolicySetSkeleton',
        'policySetName?: string',
      ],
      'authz.policySet.deletePolicySet': ['policySetName: string'],
      'cloud.env.readServiceAccountScopes': ['flatten?: boolean'],
      'idm.crypto.decrypt': ['value: any'],
      'idm.script.compileScript': ['script: string'],
      'idm.script.evaluateScript': ['script: string', 'globals?: object'],
      'idm.system.readSystemStatus': ['systemName: string'],
      'oauth2oidc.endpoint.accessToken': [
        'amBaseUrl: string',
        'data: any',
        'config: AxiosRequestConfig',
      ],
      'oauth2oidc.endpoint.accessTokenRfc7523AuthZGrant': [
        'clientId: string',
        'jwt: string',
        'scope: string[]',
        'config?: AxiosRequestConfig',
      ],
      'oauth2oidc.endpoint.authorize': [
        'amBaseUrl: string',
        'data: string',
        'config: AxiosRequestConfig',
      ],
      'oauth2oidc.endpoint.clientCredentialsGrant': [
        'amBaseUrl: string',
        'clientId: string',
        'clientSecret: string',
        'scope: string',
      ],
      'oauth2oidc.endpoint.deviceAuthorizationRequest': [
        'amBaseUrl: string',
        'data: string',
        'config: AxiosRequestConfig',
      ],
      'oauth2oidc.endpoint.getTokenInfo': [
        'amBaseUrl: string',
        'config: AxiosRequestConfig',
      ],
    };

    test.each(Object.entries(REPAIRED_CONTRACTS))(
      '%s declares name, position, type and required flag of the signature',
      (id, contract) => {
        const capability = byId.get(id);
        expect(capability).toBeDefined();
        const declared = [...(capability?.parameters ?? [])]
          .sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
          .map(
            ({ name, required, type }) =>
              `${name}${required ? '' : '?'}: ${type}`
          );
        expect(declared).toEqual(contract);
        expect(
          (capability?.parameters ?? [])
            .map(({ position }) => position)
            .sort((left, right) => (left ?? 0) - (right ?? 0))
        ).toEqual(contract.map((_, position) => position));
      }
    );

    test.each(Object.entries(REPAIRED_CONTRACTS))(
      '%s: the signature of the facade type is the one the table states',
      (id, contract) => {
        const capability = byId.get(id);
        const signature = getHelpMetadataByMethod(
          capability?.methodName ?? ''
        )[0].signature;
        expect(
          signatureParameters(signature).map(
            ({ name, optional, type }) =>
              `${name}${optional ? '?' : ''}: ${type}`
          )
        ).toEqual(contract);
      }
    );
  });

  describe('idm.script.evaluateScript and idm.script.compileScript', () => {
    test('evaluateScript takes a string script and an optional globals object', () => {
      const descriptor = byId.get('idm.script.evaluateScript');
      expect(
        descriptor?.parameters?.map(({ name, type, required, position }) => ({
          name,
          type,
          required,
          position,
        }))
      ).toEqual([
        { name: 'script', type: 'string', required: true, position: 0 },
        { name: 'globals', type: 'object', required: false, position: 1 },
      ]);
      expect(descriptor?.parameters?.[0].schema).toEqual({ type: 'string' });
      expect(descriptor?.parameters?.[1].schema).toEqual({
        type: 'object',
        additionalProperties: true,
      });
    });

    test('compileScript takes a string script', () => {
      const descriptor = byId.get('idm.script.compileScript');
      expect(
        descriptor?.parameters?.map(({ name, type, required }) => ({
          name,
          type,
          required,
        }))
      ).toEqual([{ name: 'script', type: 'string', required: true }]);
      expect(descriptor?.parameters?.[0].schema).toEqual({ type: 'string' });
    });

    test('the classification of both is unchanged', () => {
      expect(byId.get('idm.script.evaluateScript')).toMatchObject({
        operationType: 'special',
        mutating: true,
        destructive: true,
        riskClass: 'critical',
      });
      expect(byId.get('idm.script.compileScript')).toMatchObject({
        operationType: 'special',
        mutating: false,
        destructive: false,
        riskClass: 'medium',
      });
      expect(CAPABILITY_META['idm.script.evaluateScript']).toMatchObject({
        mutating: true,
        destructive: true,
        riskClass: 'critical',
      });
    });

    test('evaluateScript is exposed by the admin preset only', () => {
      const exposed = (preset: keyof typeof MCP_POLICY_PRESETS) =>
        applyCapabilityPolicy(inventory, MCP_POLICY_PRESETS[preset]).some(
          (capability) => capability.id === 'idm.script.evaluateScript'
        );
      expect(exposed('read-only')).toBe(false);
      expect(exposed('agentic')).toBe(false);
      expect(exposed('standard')).toBe(false);
      expect(exposed('admin')).toBe(true);
    });
  });

  describe('cloud.log.fetch and cloud.log.tail', () => {
    test('fetch needs a source and a time window, the cookie, the transaction id and the filter are optional', () => {
      const descriptor = byId.get('cloud.log.fetch');
      expect(
        descriptor?.parameters?.map(({ name, required }) => ({
          name,
          required,
        }))
      ).toEqual([
        { name: 'source', required: true },
        { name: 'startTs', required: true },
        { name: 'endTs', required: true },
        { name: 'cookie', required: false },
        { name: 'txid', required: false },
        { name: 'filter', required: false },
      ]);
      expect(descriptor?.supportsPaging).toBe(true);
    });

    test('tail needs a source, the cookie is optional', () => {
      const descriptor = byId.get('cloud.log.tail');
      expect(
        descriptor?.parameters?.map(({ name, required }) => ({
          name,
          required,
        }))
      ).toEqual([
        { name: 'source', required: true },
        { name: 'cookie', required: false },
      ]);
      expect(descriptor?.supportsPaging).toBe(true);
    });
  });
});
