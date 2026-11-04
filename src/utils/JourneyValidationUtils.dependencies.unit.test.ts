import { jest } from '@jest/globals';
import {
  validateJourneyDependencies,
  type JourneyValidationFinding,
  type JourneyValidationInput,
} from './JourneyValidationUtils';

const cases = [
  {
    dependencyType: 'script',
    code: 'MISSING_SCRIPT_DEPENDENCY',
    node: { _type: { _id: 'ScriptedDecisionNode' }, script: 'referenced' },
    section: 'scripts',
    complete: { referenced: {} },
    incomplete: { other: {} },
    empty: {},
  },
  ...['EmailSuspendNode', 'EmailTemplateNode'].map((nodeType) => ({
    dependencyType: 'emailTemplate',
    code: 'MISSING_EMAIL_TEMPLATE_DEPENDENCY',
    node: { _type: { _id: nodeType }, emailTemplateName: 'referenced' },
    section: 'emailTemplates',
    complete: { referenced: {} },
    incomplete: { other: {} },
    empty: {},
  })),
  ...['{"themeId":"referenced"}', 'themeId=referenced'].map((stage) => ({
    dependencyType: 'theme',
    code: 'MISSING_THEME_DEPENDENCY',
    node: { _type: { _id: 'PageNode' }, stage },
    section: 'themes',
    complete: [{ _id: 'referenced' }],
    incomplete: [{ _id: 'other' }],
    empty: [],
  })),
  {
    dependencyType: 'socialIdentityProvider',
    code: 'MISSING_SOCIAL_IDENTITY_PROVIDER_DEPENDENCY',
    node: {
      _type: { _id: 'SelectIdPNode' },
      filteredProviders: ['referenced'],
    },
    section: 'socialIdentityProviders',
    complete: { referenced: {} },
    incomplete: { other: {} },
    empty: {},
  },
  ...[{ metaAlias: '/alpha/referenced' }, { idpEntityId: 'referenced' }].map(
    (reference) => ({
      dependencyType: 'saml2Entity',
      code: 'MISSING_SAML_ENTITY_DEPENDENCY',
      node: { _type: { _id: 'product-Saml2Node' }, ...reference },
      section: 'saml2Entities',
      complete: { encodedId: { entityId: 'referenced' } },
      incomplete: { referenced: { entityId: 'other' } },
      empty: {},
    })
  ),
];

describe('validateJourneyDependencies', () => {
  describe.each(cases)('$dependencyType: $node', (entry) => {
    function journey(section: unknown): JourneyValidationInput {
      return {
        tree: { _id: 'Login' },
        nodes: { node: entry.node },
        [entry.section]: section,
      };
    }

    const scriptPredicate = jest.fn(
      (node: JourneyValidationInput['nodes'][string]) =>
        node._type?._id === 'ScriptedDecisionNode'
    );

    test('accepts a complete section', () => {
      expect(
        validateJourneyDependencies(journey(entry.complete), scriptPredicate)
      ).toEqual([]);
    });

    test('warns on a missing dependency with its type, ID and referencing node', () => {
      expect(
        validateJourneyDependencies(journey(entry.incomplete), scriptPredicate)
      ).toEqual([
        expect.objectContaining({
          code: entry.code,
          severity: 'warning',
          journeyId: 'Login',
          nodeId: 'node',
          dependencyType: entry.dependencyType,
          dependencyId: 'referenced',
          message: expect.stringContaining('referenced'),
        }),
      ]);
    });

    test('skips empty and absent sections', () => {
      scriptPredicate.mockClear();
      expect(
        validateJourneyDependencies(journey(entry.empty), scriptPredicate)
      ).toEqual([]);
      expect(
        validateJourneyDependencies(
          { tree: { _id: 'Login' }, nodes: { node: entry.node } },
          scriptPredicate
        )
      ).toEqual([]);
      expect(scriptPredicate).not.toHaveBeenCalled();
    });

    test.each(['innerNodes', 'innernodes'])(
      'identifies the referencing inner node and its Page Node in %s',
      (section) => {
        const input = journey(entry.incomplete);
        input[section] = input.nodes;
        input.nodes = {
          page: { _type: { _id: 'PageNode' }, nodes: [{ _id: 'node' }] },
        };
        expect(validateJourneyDependencies(input, scriptPredicate)).toEqual([
          expect.objectContaining({ nodeId: 'node', pageNodeId: 'page' }),
        ]);
      }
    );
  });

  test('ignores placeholders, ESVs, inactive scripts and unrelated node types', () => {
    const input: JourneyValidationInput = {
      tree: { _id: 'Login' },
      nodes: {
        placeholder: {
          _type: { _id: 'ScriptedDecisionNode' },
          script: '[Empty]',
        },
        esv: {
          _type: { _id: 'EmailSuspendNode' },
          emailTemplateName: '&{esv.email.template}',
        },
        otherEsv: {
          _type: { _id: 'EmailTemplateNode' },
          emailTemplateName: '&{esv.other.template}',
        },
        inactive: { _type: { _id: 'DeviceMatchNode' }, script: 'inactive' },
        unrelated: {
          _type: { _id: 'OtherNode' },
          script: 'inactive',
          emailTemplateName: 'unused',
          filteredProviders: ['unused'],
          stage: 'themeId=unused',
          metaAlias: '/alpha/unused',
          idpEntityId: 'unused',
        },
      },
      scripts: { other: {} },
      emailTemplates: { other: {} },
      themes: [{ _id: 'other' }],
      socialIdentityProviders: { other: {} },
      saml2Entities: { other: { entityId: 'other' } },
    };
    expect(
      validateJourneyDependencies(
        input,
        (node) => node._type?._id === 'ScriptedDecisionNode'
      )
    ).toEqual([]);
  });

  test.each(['', 'not JSON', '{}', 'null', '{"themeId":null}'])(
    'ignores a stage without a theme ID: %s',
    (stage) => {
      expect(
        validateJourneyDependencies(
          {
            tree: {},
            nodes: { page: { _type: { _id: 'PageNode' }, stage } },
            themes: [{ _id: 'other' }],
          },
          () => false
        )
      ).toEqual([]);
    }
  );

  test.each(['{"themeId":"Named Theme"}', 'themeId=Named Theme'])(
    'accepts themes referenced by name as the exporter does: %s',
    (stage) => {
      expect(
        validateJourneyDependencies(
          {
            tree: {},
            nodes: { page: { _type: { _id: 'PageNode' }, stage } },
            themes: [{ _id: 'theme-id', name: 'Named Theme' }],
          },
          () => false
        )
      ).toEqual([]);
    }
  );

  test('checks both inner-node section spellings when both are populated', () => {
    const findings = validateJourneyDependencies(
      {
        tree: {},
        innerNodes: {
          modern: {
            _type: { _id: 'EmailTemplateNode' },
            emailTemplateName: 'modern',
          },
        },
        innernodes: {
          legacy: {
            _type: { _id: 'EmailTemplateNode' },
            emailTemplateName: 'legacy',
          },
        },
        emailTemplates: { other: {} },
      },
      () => false
    );
    expect(findings.map((finding) => finding.dependencyId).sort()).toEqual([
      'legacy',
      'modern',
    ]);
  });

  test('reports both SAML entity references independently', () => {
    const findings: JourneyValidationFinding[] = validateJourneyDependencies(
      {
        tree: {},
        nodes: {
          saml: {
            _type: { _id: 'product-Saml2Node' },
            metaAlias: '/root/alpha/sp',
            idpEntityId: 'https://idp.example.com',
          },
        },
        saml2Entities: { other: { entityId: 'other' } },
      },
      () => false
    );
    expect(findings.map((finding) => finding.dependencyId)).toEqual([
      'sp',
      'https://idp.example.com',
    ]);
  });
});
