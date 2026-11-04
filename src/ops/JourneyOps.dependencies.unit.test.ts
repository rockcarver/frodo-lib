import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { validateJourneyDependencies } from '../utils/JourneyValidationUtils';
import {
  hasScriptDependency,
  type SingleTreeExportInterface,
} from './JourneyOps';

function journeyExports(value: unknown): SingleTreeExportInterface[] {
  if (typeof value === 'string') {
    if (!/^\s*[{[]/.test(value)) {
      return [];
    }
    try {
      return journeyExports(JSON.parse(value));
    } catch {
      return [];
    }
  }
  if (!value || typeof value !== 'object') {
    return [];
  }
  if ('tree' in value && 'nodes' in value) {
    return [value as SingleTreeExportInterface];
  }
  return Object.values(value).flatMap(journeyExports);
}

function fixtureExports(directory: string): {
  file: string;
  journey: SingleTreeExportInterface;
}[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      return fixtureExports(file);
    }
    if (!/\.(json|har)$/.test(entry.name)) {
      return [];
    }
    return journeyExports(JSON.parse(readFileSync(file, 'utf8'))).map(
      (journey) => ({ file: relative(process.cwd(), file), journey })
    );
  });
}

const exports = fixtureExports(join(process.cwd(), 'src/test'));
const knownProviderWarnings = {
  FrodoTestJourney3: {
    providers: ['google', 'facebook', 'azure'],
    nodeId: 'e165f3c7-babc-43be-8b3c-e99f1e735908',
    pageNodeId: 'ab9f607b-0f87-4e46-972d-fa726cd1c8f0',
  },
  FrodoTestJourney4: {
    providers: ['adfs', 'github'],
    nodeId: '39214bc4-beb9-466b-bec8-d36f4031f0ad',
    pageNodeId: 'fbb62b61-346d-45f4-98bf-bfa56a71bbb0',
  },
  FrodoTestJourney5: {
    providers: ['google', 'facebook', 'azure'],
    nodeId: 'ff1ee52f-ac32-4f80-ac92-c3b28788708b',
    pageNodeId: 'da49467f-a848-4e41-a175-5a0502c5d2af',
  },
};

describe('journey export dependency fixture sweep', () => {
  test('finds the journey import fixtures', () => {
    expect(exports.length).toBeGreaterThanOrEqual(15);
  });

  test.each(exports)(
    '$file: $journey.tree._id has no unexpected dependency warnings',
    ({ file, journey }) => {
      const findings = validateJourneyDependencies(
        journey,
        hasScriptDependency
      );
      const expected = knownProviderWarnings[journey.tree._id];
      if (expected && file.endsWith(`/${journey.tree._id}.journey.json`)) {
        expect(findings).toEqual(
          expected.providers.map((dependencyId: string) =>
            expect.objectContaining({
              code: 'MISSING_SOCIAL_IDENTITY_PROVIDER_DEPENDENCY',
              severity: 'warning',
              journeyId: journey.tree._id,
              nodeId: expected.nodeId,
              pageNodeId: expected.pageNodeId,
              dependencyType: 'socialIdentityProvider',
              dependencyId,
            })
          )
        );
      } else {
        expect(findings).toEqual([]);
      }
    }
  );
});
