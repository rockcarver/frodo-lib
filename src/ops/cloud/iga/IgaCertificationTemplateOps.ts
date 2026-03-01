import {
  CertificationTemplateDeleteSkeleton,
  CertificationTemplateSkeleton,
  createCertificationTemplate as _createCertificationTemplate,
  deleteCertificationTemplate as _deleteCertificationTemplate,
  getCertificationTemplate,
  putCertificationTemplate,
  searchCertificationTemplates,
} from '../../../api/cloud/iga/IgaCertificationTemplateApi';
import { State } from '../../../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../../../utils/Console';
import {
  getIGANotificationEmailTemplateDependencies,
  getMetadata,
  getResult,
} from '../../../utils/ExportImportUtils';
import {
  EmailTemplateSkeleton,
  importEmailTemplates,
} from '../../EmailTemplateOps';
import { FrodoError } from '../../FrodoError';
import { ExportMetaData, ResultCallback } from '../../OpsTypes';

export type CertificationTemplate = {
  /**
   * Create certification template
   * @param {CertificationTemplateSkeleton} templateData the certification template object
   * @returns {Promise<CertificationTemplateSkeleton>} a promise that resolves to a certification template object
   */
  createCertificationTemplate(
    templateData: CertificationTemplateSkeleton
  ): Promise<CertificationTemplateSkeleton>;
  /**
   * Read certification template
   * @param {string} templateId The certification template id
   * @returns {Promise<CertificationTemplateSkeleton>} a promise that resolves to a certification template object
   */
  readCertificationTemplate(
    templateId: string
  ): Promise<CertificationTemplateSkeleton>;
  /**
   * Read certification template by its name.
   * @param {string} templateName the certification template name
   * @returns {Promise<CertificationTemplateSkeleton>} a promise that resolves to a certification template object
   */
  readCertificationTemplateByName(
    templateName: string
  ): Promise<CertificationTemplateSkeleton>;
  /**
   * Read all certification templates
   * @returns {Promise<CertificationTemplateSkeleton[]>} a promise that resolves to an array of certification template objects
   */
  readCertificationTemplates(): Promise<CertificationTemplateSkeleton[]>;
  /**
   * Export certification template
   * @param {string} templateId the certification template id
   * @param {CertificationTemplateExportOptions} options export options
   * @returns {Promise<CertificationTemplateExportInterface>} a promise that resolves to a certification template export object
   */
  exportCertificationTemplate(
    templateId: string,
    options?: CertificationTemplateExportOptions
  ): Promise<CertificationTemplateExportInterface>;
  /**
   * Export certification template by its name.
   * @param {string} templateName the certification template name
   * @param {CertificationTemplateExportOptions} options export options
   * @returns {Promise<CertificationTemplateExportInterface>} a promise that resolves to a certification template export object
   */
  exportCertificationTemplateByName(
    templateName: string,
    options?: CertificationTemplateExportOptions
  ): Promise<CertificationTemplateExportInterface>;
  /**
   * Export all certification templates
   * @param {CertificationTemplateExportOptions} options export options
   * @param {ResultCallback<CertificationTemplateExportInterface>} resultCallback Optional callback to process individual results
   * @returns {Promise<CertificationTemplateExportInterface>} a promise that resolves to a certification template export object
   */
  exportCertificationTemplates(
    options?: CertificationTemplateExportOptions,
    resultCallback?: ResultCallback<CertificationTemplateExportInterface>
  ): Promise<CertificationTemplateExportInterface>;
  /**
   * Update certification template
   * @param {string} templateId the certification template id
   * @param {CertificationTemplateSkeleton} templateData the certification template object
   * @returns {Promise<CertificationTemplateSkeleton>} a promise that resolves to a certification template object
   */
  updateCertificationTemplate(
    templateId: string,
    templateData: CertificationTemplateSkeleton
  ): Promise<CertificationTemplateSkeleton>;
  /**
   * Import certification templates
   * @param {string} templateId The certification template id. If supplied, only the certification template of that id is imported. Takes priority over templateName if it is provided.
   * @param {string} templateName The certification template name. If supplied, only the certification template of that name is imported.
   * @param {CertificationTemplateExportInterface} importData certification template import data
   * @param {CertificationTemplateImportOptions} options import options
   * @param {ResultCallback<CertificationTemplateSkeleton>} resultCallback Optional callback to process individual results
   * @returns {Promise<CertificationTemplateSkeleton[]>} the imported certification templates
   */
  importCertificationTemplates(
    importData: CertificationTemplateExportInterface,
    templateId?: string,
    templateName?: string,
    options?: CertificationTemplateImportOptions,
    resultCallback?: ResultCallback<CertificationTemplateSkeleton>
  ): Promise<CertificationTemplateSkeleton[]>;
  /**
   * Delete certification template
   * @param {string} templateId the certification template id
   * @returns {Promise<CertificationTemplateDeleteSkeleton>} a promise that resolves to a certification template object
   */
  deleteCertificationTemplate(
    templateId: string
  ): Promise<CertificationTemplateDeleteSkeleton>;
  /**
   * Delete certification template by its name.
   * @param {string} templateName the certification template name
   * @returns {Promise<CertificationTemplateDeleteSkeleton>} a promise that resolves to a certification template object
   */
  deleteCertificationTemplateByName(
    templateName: string
  ): Promise<CertificationTemplateDeleteSkeleton>;
  /**
   * Delete certification templates
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<CertificationTemplateDeleteSkeleton[]>} promise that resolves to an array of certification template objects
   */
  deleteCertificationTemplates(
    resultCallback?: ResultCallback<CertificationTemplateDeleteSkeleton>
  ): Promise<CertificationTemplateDeleteSkeleton[]>;
};

export default (state: State): CertificationTemplate => {
  return {
    createCertificationTemplate(
      templateData: CertificationTemplateSkeleton
    ): Promise<CertificationTemplateSkeleton> {
      return createCertificationTemplate({
        templateData,
        state,
      });
    },
    readCertificationTemplate(
      templateId: string
    ): Promise<CertificationTemplateSkeleton> {
      return readCertificationTemplate({
        templateId,
        state,
      });
    },
    readCertificationTemplateByName(
      templateName: string
    ): Promise<CertificationTemplateSkeleton> {
      return readCertificationTemplateByName({
        templateName,
        state,
      });
    },
    readCertificationTemplates(): Promise<CertificationTemplateSkeleton[]> {
      return readCertificationTemplates({
        state,
      });
    },
    exportCertificationTemplate(
      templateId: string,
      options: CertificationTemplateExportOptions = { deps: true }
    ): Promise<CertificationTemplateExportInterface> {
      return exportCertificationTemplate({
        templateId,
        options,
        state,
      });
    },
    exportCertificationTemplateByName(
      templateName: string,
      options: CertificationTemplateExportOptions = { deps: true }
    ): Promise<CertificationTemplateExportInterface> {
      return exportCertificationTemplateByName({
        templateName,
        options,
        state,
      });
    },
    exportCertificationTemplates(
      options: CertificationTemplateExportOptions = { deps: true },
      resultCallback: ResultCallback<CertificationTemplateExportInterface> = void 0
    ): Promise<CertificationTemplateExportInterface> {
      return exportCertificationTemplates({
        options,
        resultCallback,
        state,
      });
    },
    updateCertificationTemplate(
      templateId: string,
      templateData: CertificationTemplateSkeleton
    ): Promise<CertificationTemplateSkeleton> {
      return updateCertificationTemplate({
        templateId,
        templateData,
        state,
      });
    },
    importCertificationTemplates(
      importData: CertificationTemplateExportInterface,
      templateId?: string,
      templateName?: string,
      options: CertificationTemplateImportOptions = { deps: true },
      resultCallback: ResultCallback<CertificationTemplateSkeleton> = void 0
    ): Promise<CertificationTemplateSkeleton[]> {
      return importCertificationTemplates({
        templateId,
        templateName,
        importData,
        options,
        resultCallback,
        state,
      });
    },
    deleteCertificationTemplate(
      templateId: string
    ): Promise<CertificationTemplateDeleteSkeleton> {
      return deleteCertificationTemplate({
        templateId,
        state,
      });
    },
    deleteCertificationTemplateByName(
      templateName: string
    ): Promise<CertificationTemplateDeleteSkeleton> {
      return deleteCertificationTemplateByName({
        templateName,
        state,
      });
    },
    deleteCertificationTemplates(
      resultCallback: ResultCallback<CertificationTemplateDeleteSkeleton> = void 0
    ): Promise<CertificationTemplateDeleteSkeleton[]> {
      return deleteCertificationTemplates({
        resultCallback,
        state,
      });
    },
  };
};

export interface CertificationTemplateExportInterface {
  meta?: ExportMetaData;
  certificationTemplate: Record<string, CertificationTemplateSkeleton>;
  emailTemplate?: Record<string, EmailTemplateSkeleton>;
}

/**
 * Certification template import options
 */
export interface CertificationTemplateImportOptions {
  /**
   * Include any dependencies (email templates).
   */
  deps: boolean;
}

/**
 * Certification template export options
 */
export interface CertificationTemplateExportOptions {
  /**
   * Include any dependencies (email templates).
   */
  deps: boolean;
}

/**
 * Create an empty certification template export template
 * @returns {CertificationTemplateExportInterface} an empty certification template export template
 */
export function createCertificationTemplateExportTemplate({
  state,
}: {
  state: State;
}): CertificationTemplateExportInterface {
  return {
    meta: getMetadata({ state }),
    certificationTemplate: {},
    emailTemplate: {},
  };
}

/**
 * Create certification template
 * @param {CertificationTemplateSkeleton} templateData the certification template object
 * @returns {Promise<CertificationTemplateSkeleton>} a promise that resolves to a certification template object
 */
export async function createCertificationTemplate({
  templateData,
  state,
}: {
  templateData: CertificationTemplateSkeleton;
  state: State;
}): Promise<CertificationTemplateSkeleton> {
  try {
    return await _createCertificationTemplate({ templateData, state });
  } catch (error) {
    throw new FrodoError(
      `Error creating certification template ${templateData.name}`,
      error
    );
  }
}

/**
 * Read certification template
 * @param {string} templateId the certification template id
 * @returns {Promise<CertificationTemplateSkeleton>} a promise that resolves to a certification template object
 */
export async function readCertificationTemplate({
  templateId,
  state,
}: {
  templateId: string;
  state: State;
}): Promise<CertificationTemplateSkeleton> {
  try {
    return await getCertificationTemplate({ templateId, state });
  } catch (error) {
    throw new FrodoError(
      `Error reading certification template ${templateId}`,
      error
    );
  }
}

/**
 * Read certification template by its name.
 * @param {string} templateName the certification template name
 * @returns {Promise<CertificationTemplateSkeleton>} a promise that resolves to a certification template object
 */
export async function readCertificationTemplateByName({
  templateName,
  state,
}: {
  templateName: string;
  state: State;
}): Promise<CertificationTemplateSkeleton> {
  try {
    const templates = await searchCertificationTemplates({
      targetFilter: {
        operator: 'EQUALS',
        operand: {
          targetName: 'name',
          targetValue: templateName,
        },
      },
      state,
    });
    if (templates.length !== 1) {
      throw new FrodoError(
        `Expected to find a single certification template named '${templateName}', but ${templates.length} were found.`
      );
    }
    return templates[0];
  } catch (error) {
    throw new FrodoError(
      `Error reading certification template ${templateName}`,
      error
    );
  }
}

/**
 * Read all certification templates, including those used by IGA events
 * @returns {Promise<CertificationTemplateSkeleton[]>} a promise that resolves to an array of certification template objects
 */
export async function readCertificationTemplates({
  state,
}: {
  state: State;
}): Promise<CertificationTemplateSkeleton[]> {
  try {
    return await searchCertificationTemplates({ state });
  } catch (error) {
    throw new FrodoError(`Error reading certification templates`, error);
  }
}

/**
 * Export certification template
 * @param {string} templateId the certification template id
 * @param {CertificationTemplateExportOptions} options export options
 * @returns {Promise<CertificationTemplateExportInterface>} a promise that resolves to a certification template export object
 */
export async function exportCertificationTemplate({
  templateId,
  options = { deps: true },
  state,
}: {
  templateId: string;
  options: CertificationTemplateExportOptions;
  state: State;
}): Promise<CertificationTemplateExportInterface> {
  try {
    debugMessage({
      message: `IgaCertificationTemplateOps.exportCertificationTemplate: start`,
      state,
    });
    const templateData = await readCertificationTemplate({
      templateId,
      state,
    });
    const exportData = prepareCertificationTemplateForExport({
      templateData,
      options,
      state,
    });
    debugMessage({
      message: `IgaCertificationTemplateOps.exportCertificationTemplate: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting certification template ${templateId}`,
      error
    );
  }
}

/**
 * Export certification template by its name.
 * @param {string} templateName the certification template name
 * @param {CertificationTemplateExportOptions} options export options
 * @returns {Promise<CertificationTemplateExportInterface>} a promise that resolves to a certification template export object
 */
export async function exportCertificationTemplateByName({
  templateName,
  options = { deps: true },
  state,
}: {
  templateName: string;
  options?: CertificationTemplateExportOptions;
  state: State;
}): Promise<CertificationTemplateExportInterface> {
  try {
    debugMessage({
      message: `IgaCertificationTemplateOps.exportCertificationTemplateByName: start`,
      state,
    });
    const templateData = await readCertificationTemplateByName({
      templateName,
      state,
    });
    const exportData = prepareCertificationTemplateForExport({
      templateData,
      options,
      state,
    });
    debugMessage({
      message: `IgaCertificationTemplateOps.exportCertificationTemplateByName: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting certification template ${templateName}`,
      error
    );
  }
}

/**
 * Export all certification templates
 * @param {CertificationTemplateExportOptions} options export options
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<CertificationTemplateExportInterface>} a promise that resolves to a certification template export object
 */
export async function exportCertificationTemplates({
  options = { deps: true },
  resultCallback = void 0,
  state,
}: {
  options?: CertificationTemplateExportOptions;
  resultCallback?: ResultCallback<CertificationTemplateExportInterface>;
  state: State;
}): Promise<CertificationTemplateExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({
      message: `IgaCertificationTemplateOps.exportCertificationTemplates: start`,
      state,
    });
    const templates = await readCertificationTemplates({ state });
    indicatorId = createProgressIndicator({
      total: templates.length,
      message: 'Exporting certification templates...',
      state,
    });
    const exportData = createCertificationTemplateExportTemplate({ state });
    for (const templateData of templates) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting certification template ${templateData.name}...`,
        state,
      });
      const templateExport = await getResult(
        resultCallback,
        `Error exporting certification template ${templateData.name}`,
        prepareCertificationTemplateForExport,
        {
          templateData,
          options,
          state,
        }
      );
      if (templateExport) {
        Object.assign(
          exportData.certificationTemplate,
          templateExport.certificationTemplate
        );
        Object.assign(exportData.emailTemplate, templateExport.emailTemplate);
      }
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${templates.length} certification templates`,
      status: 'success',
      state,
    });
    debugMessage({
      message: `IgaCertificationTemplateOps.exportCertificationTemplates: end`,
      state,
    });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting certification templates`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting certification templates`, error);
  }
}

/**
 * Update certification template
 * @param {string} templateId the certification template id
 * @param {CertificationTemplateSkeleton} templateData the certification template object
 * @returns {Promise<CertificationTemplateSkeleton>} a promise that resolves to a certification template object
 */
export async function updateCertificationTemplate({
  templateId,
  templateData,
  state,
}: {
  templateId: string;
  templateData: CertificationTemplateSkeleton;
  state: State;
}): Promise<CertificationTemplateSkeleton> {
  try {
    return await putCertificationTemplate({
      templateId,
      templateData: templateData,
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error updating certification template '${templateId}'`,
      error
    );
  }
}

/**
 * Import certification templates
 * @param {string} templateId The certification template id. If supplied, only the certification template of that id is imported. Takes priority over templateName if it is provided.
 * @param {string} templateName The certification template name. If supplied, only the certification template(s) of that name is imported.
 * @param {CertificationTemplateExportInterface} importData certification template import data
 * @param {CertificationTemplateImportOptions} options import options
 * @param {ResultCallback<CertificationTemplateSkeleton>} resultCallback Optional callback to process individual results
 * @returns {Promise<CertificationTemplateSkeleton[]>} the imported certification templates
 */
export async function importCertificationTemplates({
  templateId,
  templateName,
  importData,
  options = { deps: true },
  resultCallback = void 0,
  state,
}: {
  templateId?: string;
  templateName?: string;
  importData: CertificationTemplateExportInterface;
  options?: CertificationTemplateImportOptions;
  resultCallback?: ResultCallback<CertificationTemplateSkeleton>;
  state: State;
}): Promise<CertificationTemplateSkeleton[]> {
  debugMessage({
    message: `IgaCertificationTemplateOps.importCertificationTemplates: start`,
    state,
  });
  // Import email template dependencies
  if (
    options.deps &&
    importData.emailTemplate &&
    Object.keys(importData.emailTemplate).length
  ) {
    try {
      await importEmailTemplates({
        //@ts-expect-error Since we ensure emailTemplate exists before this, we can ignore the error
        importData,
        state,
      });
    } catch (e) {
      if (resultCallback) {
        resultCallback(e, undefined);
      } else {
        throw new FrodoError(`Error importing email template dependencies`, e);
      }
    }
  }
  // Import certification templates
  const response = [];
  for (const existingId of Object.keys(importData.certificationTemplate)) {
    const templateData = importData.certificationTemplate[existingId];
    try {
      const shouldNotImport =
        (templateId && templateId !== templateData.id) ||
        (templateName && templateName !== templateData.name);
      if (shouldNotImport) continue;
      let result;
      try {
        result = await putCertificationTemplate({
          templateId: templateData.id,
          templateData,
          state,
        });
      } catch (error) {
        if (
          error.response?.status === 404 &&
          error.response?.data?.message &&
          error.response.data.message.startsWith('Cannot find template with id')
        ) {
          result = await createCertificationTemplate({
            templateData: templateData,
            state,
          });
        } else {
          throw error;
        }
      }
      if (resultCallback) {
        resultCallback(undefined, result);
      }
      response.push(result);
    } catch (e) {
      if (resultCallback) {
        resultCallback(e, undefined);
      } else {
        throw new FrodoError(
          `Error importing certification template '${templateData.name}'`,
          e
        );
      }
    }
  }
  debugMessage({
    message: `IgaCertificationTemplateOps.importCertificationTemplates: end`,
    state,
  });
  return response;
}

/**
 * Delete certification template
 * @param {string} templateId the certification template id
 * @returns {Promise<CertificationTemplateDeleteSkeleton>} a promise that resolves to a certification template object
 */
export async function deleteCertificationTemplate({
  templateId,
  state,
}: {
  templateId: string;
  state: State;
}): Promise<CertificationTemplateDeleteSkeleton> {
  try {
    return await _deleteCertificationTemplate({ templateId, state });
  } catch (error) {
    throw new FrodoError(
      `Error deleting certification template ${templateId}`,
      error
    );
  }
}

/**
 * Delete certification template by its name.
 * @param {string} templateName the certification template name
 * @returns {Promise<CertificationTemplateDeleteSkeleton>} a promise that resolves to a certification template object
 */
export async function deleteCertificationTemplateByName({
  templateName,
  state,
}: {
  templateName: string;
  state: State;
}): Promise<CertificationTemplateDeleteSkeleton> {
  try {
    const templateData = await readCertificationTemplateByName({
      templateName,
      state,
    });
    return await deleteCertificationTemplate({
      templateId: templateData.id,
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error deleting certification template ${templateName}`,
      error
    );
  }
}

/**
 * Delete certification templates
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<CertificationTemplateDeleteSkeleton[]>} promise that resolves to an array of certification template objects
 */
export async function deleteCertificationTemplates({
  resultCallback = void 0,
  state,
}: {
  resultCallback?: ResultCallback<CertificationTemplateDeleteSkeleton>;
  state: State;
}): Promise<CertificationTemplateDeleteSkeleton[]> {
  const templates = await readCertificationTemplates({ state });
  const deletedCertificationTemplates = [];
  for (const templateData of templates) {
    const result = await getResult(
      resultCallback,
      `Error deleting certification template ${templateData.id}`,
      deleteCertificationTemplate,
      { templateId: templateData.id, state }
    );
    if (result) {
      deletedCertificationTemplates.push(result);
    }
  }
  return deletedCertificationTemplates;
}

/**
 * Helper that prepares a certification template for export
 * @param {CertificationTemplateSkeleton} templateData the certification template data
 * @param {CertificationTemplateExportOptions} options export options
 * @returns {CertificationTemplateExportInterface} the certification template export object
 */
async function prepareCertificationTemplateForExport({
  templateData,
  options,
  state,
}: {
  templateData: CertificationTemplateSkeleton;
  options: CertificationTemplateExportOptions;
  state: State;
}): Promise<CertificationTemplateExportInterface> {
  const exportData = createCertificationTemplateExportTemplate({ state });
  if (options.deps) {
    const templates = await getIGANotificationEmailTemplateDependencies(
      templateData,
      state
    );
    exportData.emailTemplate = Object.fromEntries(
      templates.map((e) => {
        return [e._id.split('/').pop(), e];
      })
    );
  }
  exportData.certificationTemplate[templateData.id] = templateData;
  return exportData;
}
