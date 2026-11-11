import { AGENT_SECTION_ROUTES, routeAgentSection } from './AgentSectionRouting';

/**
 * Unit tests for the routing of the agent section of an export. A pure
 * function: no request, no mock.
 */

function issuer(
  id: string,
  issuerUrl = `https://idp-${id}.matrix.example.com`
) {
  return {
    _id: id,
    _type: {
      _id: 'TrustedJwtIssuer',
      name: 'OAuth2 Trusted JWT Issuer',
      collection: true,
    },
    issuer: issuerUrl,
  };
}

function webAgent(id: string) {
  return {
    _id: id,
    _type: { _id: 'WebAgent', name: 'Web Agent', collection: true },
  };
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe('AGENT_SECTION_ROUTES', () => {
  test('the trusted JWT issuer is routed to its own export key', () => {
    expect(AGENT_SECTION_ROUTES.TrustedJwtIssuer).toBe('trustedJwtIssuer');
  });
});

describe('routeAgentSection', () => {
  test('both keys with the same id: the module copy wins and the agent copy is listed as skipped', () => {
    const realm = {
      agent: {
        'matrix-one': issuer('matrix-one', 'https://agent-copy.example.com'),
      },
      trustedJwtIssuer: {
        'matrix-one': issuer('matrix-one', 'https://module-copy.example.com'),
      },
    };

    const routing = routeAgentSection(realm);

    expect(routing.routed.trustedJwtIssuer).toEqual({
      'matrix-one': issuer('matrix-one', 'https://module-copy.example.com'),
    });
    expect(routing.skipped).toEqual([
      { id: 'matrix-one', key: 'trustedJwtIssuer' },
    ]);
    // nothing is left for the generic agent import
    expect(routing.agent).toBeUndefined();
  });

  test('an issuer that only the agent section has is routed to the module', () => {
    const routing = routeAgentSection({
      agent: { 'matrix-one': issuer('matrix-one') },
    });

    expect(routing.routed.trustedJwtIssuer).toEqual({
      'matrix-one': issuer('matrix-one'),
    });
    expect(routing.skipped).toEqual([]);
    expect(routing.agent).toBeUndefined();
  });

  test('an issuer that only the module section has stays where it is', () => {
    const routing = routeAgentSection({
      trustedJwtIssuer: { 'matrix-one': issuer('matrix-one') },
    });

    expect(routing.routed.trustedJwtIssuer).toEqual({
      'matrix-one': issuer('matrix-one'),
    });
    expect(routing.skipped).toEqual([]);
    // there was no agent section
    expect(routing.agent).toBeUndefined();
  });

  test('two different ids in the two sections are both written', () => {
    const routing = routeAgentSection({
      agent: { 'matrix-two': issuer('matrix-two') },
      trustedJwtIssuer: { 'matrix-one': issuer('matrix-one') },
    });

    expect(Object.keys(routing.routed.trustedJwtIssuer)).toEqual([
      'matrix-one',
      'matrix-two',
    ]);
    expect(routing.skipped).toEqual([]);
  });

  test('other agent types stay in the agent section, untouched and in order', () => {
    const routing = routeAgentSection({
      agent: {
        'zion-web': webAgent('zion-web'),
        'matrix-one': issuer('matrix-one'),
        'zion-web-2': webAgent('zion-web-2'),
      },
      trustedJwtIssuer: { 'matrix-one': issuer('matrix-one') },
    });

    expect(routing.agent).toEqual({
      'zion-web': webAgent('zion-web'),
      'zion-web-2': webAgent('zion-web-2'),
    });
    expect(Object.keys(routing.agent)).toEqual(['zion-web', 'zion-web-2']);
  });

  test('an entry without a type stays in the agent section', () => {
    const noType = { _id: 'mystery' };
    const routing = routeAgentSection({
      agent: { mystery: noType, 'matrix-one': issuer('matrix-one') },
    });

    expect(routing.agent).toEqual({ mystery: noType });
    expect(Object.keys(routing.routed.trustedJwtIssuer)).toEqual([
      'matrix-one',
    ]);
  });

  test('an entry that is not an object, and a type named like an Object property, stay in the agent section', () => {
    const odd = {
      nothing: null,
      text: 'x',
      proto: { _id: 'proto', _type: { _id: 'constructor' } },
    };
    const routing = routeAgentSection({ agent: odd } as any);

    expect(routing.agent).toEqual(odd);
    expect(routing.routed).toEqual({});
  });

  test('both keys with different content: the module copy is the one kept', () => {
    const routing = routeAgentSection({
      agent: { a: issuer('a', 'https://agent-copy.example.com') },
      trustedJwtIssuer: { a: issuer('a', 'https://module-copy.example.com') },
    });

    expect(routing.routed.trustedJwtIssuer.a.issuer).toBe(
      'https://module-copy.example.com'
    );
  });

  test('the argument is not modified', () => {
    const realm = {
      agent: {
        'zion-web': webAgent('zion-web'),
        'matrix-one': issuer('matrix-one'),
        'matrix-two': issuer('matrix-two'),
      },
      trustedJwtIssuer: { 'matrix-one': issuer('matrix-one') },
      script: { s1: { _id: 's1' } },
    };
    const before = copy(realm);

    const routing = routeAgentSection(realm);
    // the result can be changed without touching the argument
    delete routing.routed.trustedJwtIssuer['matrix-two'];
    routing.skipped.pop();
    delete routing.agent['zion-web'];

    expect(realm).toEqual(before);
  });

  test('an agent section that is empty stays empty and is not "nothing left"', () => {
    const routing = routeAgentSection({ agent: {} });
    expect(routing.agent).toEqual({});
    expect(routing.routed).toEqual({});
  });

  test('no data, no sections', () => {
    expect(routeAgentSection(undefined)).toEqual({
      agent: undefined,
      routed: {},
      skipped: [],
    });
    expect(routeAgentSection({})).toEqual({
      agent: undefined,
      routed: {},
      skipped: [],
    });
  });

  test('an empty module section is kept as a section, so that a step that ran before still runs', () => {
    const routing = routeAgentSection({ trustedJwtIssuer: {} });
    expect(routing.routed.trustedJwtIssuer).toEqual({});
  });
});
