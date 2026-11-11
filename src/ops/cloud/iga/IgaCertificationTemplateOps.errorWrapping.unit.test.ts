import { jest } from '@jest/globals';
import StateImpl, { type State } from '../../../shared/State';
import { expectWrappedFailure } from '../../../test/utils/ErrorWrapping';

/**
 * IgaCertificationTemplateOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * The export functions keep the promise of the function that prepares the export in a variable and return it
 * from the try block. Without `await` a failure of the preparation skips the catch. Every export row makes the preparation
 * fail after a successful read.
 * Mocked unit test: IgaCertificationTemplateApi is replaced, there are no recordings and no network.
 */

const actualIgaCertificationTemplateApi =
  await import('../../../api/cloud/iga/IgaCertificationTemplateApi');
const igaCertificationTemplateApi = {
  getCertificationTemplate: jest.fn<(...args: any[]) => Promise<any>>(),
  searchCertificationTemplates: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule(
  '../../../api/cloud/iga/IgaCertificationTemplateApi',
  () => ({
    ...actualIgaCertificationTemplateApi,
    ...igaCertificationTemplateApi,
  })
);

const ops = await import('./IgaCertificationTemplateOps');

function resetMocks() {
  for (const api of Object.values(igaCertificationTemplateApi)) api.mockReset();
}

type ExportRow = {
  name: string;
  call: (state: State) => Promise<unknown>;
  api?: ReturnType<typeof jest.fn<(...args: any[]) => Promise<any>>>;
  message: string;
  arrange?: () => void;
};

const exportCases: ExportRow[] = [
  {
    name: 'exportCertificationTemplate',
    call: (state: State) =>
      ops.exportCertificationTemplate({
        templateId: 'template-1',
        options: { deps: true, includeEventTemplates: false },
        state,
      }),
    api: igaCertificationTemplateApi.getCertificationTemplate,
    message: 'Error exporting certification template template-1',
    arrange: () => {
      igaCertificationTemplateApi.getCertificationTemplate.mockResolvedValue({
        id: 'template-1',
        name: 'sample-template',
      });
    },
  },
  {
    name: 'exportCertificationTemplateByName',
    call: (state: State) =>
      ops.exportCertificationTemplateByName({
        templateName: 'sample-template',
        state,
      }),
    api: igaCertificationTemplateApi.searchCertificationTemplates,
    message: 'Error exporting certification template sample-template',
    arrange: () => {
      igaCertificationTemplateApi.searchCertificationTemplates.mockResolvedValue(
        [{ id: 'template-1', name: 'sample-template' }]
      );
    },
  },
];

describe('IgaCertificationTemplateOps: a failure while an export is prepared ends as a FrodoError', () => {
  beforeEach(resetMocks);

  // The preparation of the export (an async function) fails because the metadata of the export cannot be read from
  // the state; the read before it succeeds.
  test.each(exportCases)('$name', async ({ call, api, message, arrange }) => {
    const cause = new Error('sample metadata failure');
    const failing = StateImpl({});
    failing.setRealm('alpha');
    failing.getFrodoVersion = () => {
      throw cause;
    };
    arrange?.();
    await expectWrappedFailure(call(failing), message, cause);
    if (api) expect(api).toHaveBeenCalledTimes(1);
  });
});
