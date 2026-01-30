import {
  assignRequestForm,
  deleteRequestForm as _deleteRequestForm,
  getRequestForm,
  getRequestFormAssignments,
  putRequestForm,
  queryRequestForms,
  RequestFormSkeleton,
  unassignRequestForm,
} from '../../../api/cloud/iga/IgaRequestFormApi';
import { RequestTypeSkeleton } from '../../../api/cloud/iga/IgaRequestTypeApi';
import { State } from '../../../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../../../utils/Console';
import {
  getMetadata,
  getResult,
  transformScriptArraysToStrings,
  transformScriptStringsToArrays,
} from '../../../utils/ExportImportUtils';
import { FrodoError } from '../../FrodoError';
import { ExportMetaData, ResultCallback } from '../../OpsTypes';
import { exportRequestType, importRequestTypes } from './IgaRequestTypeOps';

export type RequestForm = {
  /**
   * Read request form
   * @param {string} formId The request form id
   * @returns {Promise<RequestFormSkeleton>} a promise that resolves to a request form object
   */
  readRequestForm(formId: string): Promise<RequestFormSkeleton>;
  /**
   * Read request form by its name. Since names are NOT necessarily unique, this method will throw if it finds multiple of the same name.
   * @param {string} formName the request form name
   * @returns {Promise<RequestFormSkeleton>} a promise that resolves to a request form object
   */
  readRequestFormByName(formName: string): Promise<RequestFormSkeleton>;
  /**
   * Read all request forms
   * @returns {Promise<RequestFormSkeleton[]>} a promise that resolves to an array of request form objects
   */
  readRequestForms(): Promise<RequestFormSkeleton[]>;
  /**
   * Export request form
   * @param {string} formId the request form id
   * @param {RequestFormExportOptions} options export options
   * @returns {Promise<RequestFormExportInterface>} a promise that resolves to a request form export object
   */
  exportRequestForm(
    formId: string,
    options?: RequestFormExportOptions
  ): Promise<RequestFormExportInterface>;
  /**
   * Export request form by its name. Since names are NOT necessarily unique, this method will throw if it finds multiple of the same name.
   * @param {string} formName the request form name
   * @param {RequestFormExportOptions} options export options
   * @returns {Promise<RequestFormExportInterface>} a promise that resolves to a request form export object
   */
  exportRequestFormByName(
    formName: string,
    options?: RequestFormExportOptions
  ): Promise<RequestFormExportInterface>;
  /**
   * Export all request forms
   * @param {RequestFormExportOptions} options export options
   * @param {ResultCallback<RequestFormExportInterface>} resultCallback Optional callback to process individual results
   * @returns {Promise<RequestFormExportInterface>} a promise that resolves to a request form export object
   */
  exportRequestForms(
    options?: RequestFormExportOptions,
    resultCallback?: ResultCallback<RequestFormExportInterface>
  ): Promise<RequestFormExportInterface>;
  /**
   * Update request form
   * @param {string} formId the request form id
   * @param {RequestFormSkeleton} formData the request form object
   * @returns {Promise<RequestFormSkeleton>} a promise that resolves to a request form object
   */
  updateRequestForm(
    formId: string,
    formData: RequestFormSkeleton
  ): Promise<RequestFormSkeleton>;
  /**
   * Import request forms
   * @param {string} formId The request form id. If supplied, only the request form of that id is imported. Takes priority over formName if it is provided.
   * @param {string} formName The request form name. If supplied, only the request form(s) of that name is imported.
   * @param {RequestFormExportInterface} importData request form import data
   * @param {RequestFormImportOptions} options import options
   * @param {ResultCallback<RequestFormSkeleton>} resultCallback Optional callback to process individual results
   * @returns {Promise<RequestFormSkeleton[]>} the imported request forms
   */
  importRequestForms(
    importData: RequestFormExportInterface,
    formId?: string,
    formName?: string,
    options?: RequestFormImportOptions,
    resultCallback?: ResultCallback<RequestFormSkeleton>
  ): Promise<RequestFormSkeleton[]>;
  /**
   * Delete request form
   * @param {string} formId the request form id
   * @returns {Promise<RequestFormSkeleton>} a promise that resolves to a request form object
   */
  deleteRequestForm(formId: string): Promise<RequestFormSkeleton>;
  /**
   * Delete request form by its name. Since names are NOT necessarily unique, this method will throw if it finds multiple of the same name.
   * @param {string} formName the request form name
   * @returns {Promise<RequestFormSkeleton>} a promise that resolves to a request form object
   */
  deleteRequestFormByName(formName: string): Promise<RequestFormSkeleton>;
  /**
   * Delete request forms
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<RequestFormSkeleton[]>} promise that resolves to an array of request form objects
   */
  deleteRequestForms(
    resultCallback?: ResultCallback<RequestFormSkeleton>
  ): Promise<RequestFormSkeleton[]>;
};

export default (state: State): RequestForm => {
  return {
    readRequestForm(formId: string): Promise<RequestFormSkeleton> {
      return readRequestForm({
        formId,
        state,
      });
    },
    readRequestFormByName(formName: string): Promise<RequestFormSkeleton> {
      return readRequestFormByName({
        formName,
        state,
      });
    },
    readRequestForms(): Promise<RequestFormSkeleton[]> {
      return readRequestForms({
        state,
      });
    },
    exportRequestForm(
      formId: string,
      options: RequestFormExportOptions = { deps: true, useStringArrays: true }
    ): Promise<RequestFormExportInterface> {
      return exportRequestForm({
        formId,
        options,
        state,
      });
    },
    exportRequestFormByName(
      formName: string,
      options: RequestFormExportOptions = { deps: true, useStringArrays: true }
    ): Promise<RequestFormExportInterface> {
      return exportRequestFormByName({
        formName,
        options,
        state,
      });
    },
    exportRequestForms(
      options: RequestFormExportOptions = { deps: true, useStringArrays: true },
      resultCallback: ResultCallback<RequestFormExportInterface> = void 0
    ): Promise<RequestFormExportInterface> {
      return exportRequestForms({
        options,
        resultCallback,
        state,
      });
    },
    updateRequestForm(
      formId: string,
      formData: RequestFormSkeleton
    ): Promise<RequestFormSkeleton> {
      return updateRequestForm({
        formId,
        formData,
        state,
      });
    },
    importRequestForms(
      importData: RequestFormExportInterface,
      formId?: string,
      formName?: string,
      options: RequestFormImportOptions = { deps: true },
      resultCallback: ResultCallback<RequestFormSkeleton> = void 0
    ): Promise<RequestFormSkeleton[]> {
      return importRequestForms({
        formId,
        formName,
        importData,
        options,
        resultCallback,
        state,
      });
    },
    deleteRequestForm(formId: string): Promise<RequestFormSkeleton> {
      return deleteRequestForm({
        formId,
        state,
      });
    },
    deleteRequestFormByName(formName: string): Promise<RequestFormSkeleton> {
      return deleteRequestFormByName({
        formName,
        state,
      });
    },
    deleteRequestForms(
      resultCallback: ResultCallback<RequestFormSkeleton> = void 0
    ): Promise<RequestFormSkeleton[]> {
      return deleteRequestForms({
        resultCallback,
        state,
      });
    },
  };
};

export interface RequestFormExportInterface {
  meta?: ExportMetaData;
  requestForm: Record<string, RequestFormSkeleton>;
  requestType?: Record<string, RequestTypeSkeleton>;
}

/**
 * Request form import options
 */
export interface RequestFormImportOptions {
  /**
   * Include any dependencies (request types).
   */
  deps: boolean;
}

/**
 * Request form export options
 */
export interface RequestFormExportOptions {
  /**
   * Include any dependencies (request types).
   */
  deps: boolean;
  /**
   * Use string arrays to store script code
   */
  useStringArrays: boolean;
}

/**
 * Create an empty request form export template
 * @returns {RequestFormExportInterface} an empty request form export template
 */
export function createRequestFormExportTemplate({
  state,
}: {
  state: State;
}): RequestFormExportInterface {
  return {
    meta: getMetadata({ state }),
    requestForm: {},
    requestType: {},
  };
}

/**
 * Read request form
 * @param {string} formId the request form id
 * @returns {Promise<RequestFormSkeleton>} a promise that resolves to a request form object
 */
export async function readRequestForm({
  formId,
  state,
}: {
  formId: string;
  state: State;
}): Promise<RequestFormSkeleton> {
  try {
    return await getRequestForm({ formId, state });
  } catch (error) {
    throw new FrodoError(`Error reading request form ${formId}`, error);
  }
}

/**
 * Read request form by its name. Since names are NOT necessarily unique, this method will throw if it finds multiple of the same name.
 * @param {string} formName the request form name
 * @returns {Promise<RequestFormSkeleton>} a promise that resolves to a request form object
 */
export async function readRequestFormByName({
  formName,
  state,
}: {
  formName: string;
  state: State;
}): Promise<RequestFormSkeleton> {
  try {
    const forms = await queryRequestForms({
      queryFilter: `name eq "${formName}"`,
      state,
    });
    if (forms.length !== 1) {
      throw new FrodoError(
        `Expected to find a single request form named '${formName}', but ${forms.length} were found.`
      );
    }
    return forms[0];
  } catch (error) {
    throw new FrodoError(`Error reading request form ${formName}`, error);
  }
}

/**
 * Read all request forms
 * @returns {Promise<RequestFormSkeleton[]>} a promise that resolves to an array of request form objects
 */
export async function readRequestForms({
  state,
}: {
  state: State;
}): Promise<RequestFormSkeleton[]> {
  try {
    return await queryRequestForms({ state });
  } catch (error) {
    throw new FrodoError(`Error reading request forms`, error);
  }
}

/**
 * Export request form
 * @param {string} formId the request form id
 * @param {RequestFormExportOptions} options export options
 * @returns {Promise<RequestFormExportInterface>} a promise that resolves to a request form export object
 */
export async function exportRequestForm({
  formId,
  options = { deps: true, useStringArrays: true },
  state,
}: {
  formId: string;
  options: RequestFormExportOptions;
  state: State;
}): Promise<RequestFormExportInterface> {
  try {
    debugMessage({
      message: `IgaRequestFormOps.exportRequestForm: start`,
      state,
    });
    const form = await readRequestForm({
      formId,
      state,
    });
    const exportData = prepareFormForExport({
      form,
      options,
      state,
    });
    debugMessage({
      message: `IgaRequestFormOps.exportRequestForm: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting request form ${formId}`, error);
  }
}

/**
 * Export request form by its name. Since names are NOT necessarily unique, this method will throw if it finds multiple of the same name.
 * @param {string} formName the request form name
 * @param {RequestFormExportOptions} options export options
 * @returns {Promise<RequestFormExportInterface>} a promise that resolves to a request form export object
 */
export async function exportRequestFormByName({
  formName,
  options = { deps: true, useStringArrays: true },
  state,
}: {
  formName: string;
  options?: RequestFormExportOptions;
  state: State;
}): Promise<RequestFormExportInterface> {
  try {
    debugMessage({
      message: `IgaRequestFormOps.exportRequestFormByName: start`,
      state,
    });
    const form = await readRequestFormByName({
      formName,
      state,
    });
    const exportData = prepareFormForExport({
      form,
      options,
      state,
    });
    debugMessage({
      message: `IgaRequestFormOps.exportRequestFormByName: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting request form ${formName}`, error);
  }
}

/**
 * Export all request forms
 * @param {RequestFormExportOptions} options export options
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<RequestFormExportInterface>} a promise that resolves to a request form export object
 */
export async function exportRequestForms({
  options = { deps: true, useStringArrays: true },
  resultCallback = void 0,
  state,
}: {
  options?: RequestFormExportOptions;
  resultCallback?: ResultCallback<RequestFormExportInterface>;
  state: State;
}): Promise<RequestFormExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({
      message: `IgaRequestFormOps.exportRequestForms: start`,
      state,
    });
    const forms = await readRequestForms({ state });
    indicatorId = createProgressIndicator({
      total: forms.length,
      message: 'Exporting request forms...',
      state,
    });
    const exportData = createRequestFormExportTemplate({ state });
    for (const form of forms) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting request form ${form.name}...`,
        state,
      });
      const formExport = await getResult(
        resultCallback,
        `Error exporting request form ${form.name}`,
        prepareFormForExport,
        {
          form,
          options,
          state,
        }
      );
      if (formExport) {
        Object.assign(exportData.requestForm, formExport.requestForm);
        Object.assign(exportData.requestType, formExport.requestType);
      }
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${forms.length} request forms`,
      status: 'success',
      state,
    });
    debugMessage({
      message: `IgaRequestFormOps.exportRequestForms: end`,
      state,
    });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting request forms`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting request forms`, error);
  }
}

/**
 * Update request form
 * @param {string} formId the request form id
 * @param {RequestFormSkeleton} formData the request form object
 * @returns {Promise<RequestFormSkeleton>} a promise that resolves to a request form object
 */
export async function updateRequestForm({
  formId,
  formData,
  state,
}: {
  formId: string;
  formData: RequestFormSkeleton;
  state: State;
}): Promise<RequestFormSkeleton> {
  try {
    const formDataCopy = { ...formData };
    delete formDataCopy.assignments;
    transformScriptArraysToStrings(formDataCopy.form);
    return await putRequestForm({
      formId,
      formData: formDataCopy,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error updating request form '${formId}'`, error);
  }
}

/**
 * Import request forms
 * @param {string} formId The request form id. If supplied, only the request form of that id is imported. Takes priority over formName if it is provided.
 * @param {string} formName The request form name. If supplied, only the request form(s) of that name is imported.
 * @param {RequestFormExportInterface} importData request form import data
 * @param {RequestFormImportOptions} options import options
 * @param {ResultCallback<RequestFormSkeleton>} resultCallback Optional callback to process individual results
 * @returns {Promise<RequestFormSkeleton[]>} the imported request forms
 */
export async function importRequestForms({
  formId,
  formName,
  importData,
  options = { deps: true },
  resultCallback = void 0,
  state,
}: {
  formId?: string;
  formName?: string;
  importData: RequestFormExportInterface;
  options?: RequestFormImportOptions;
  resultCallback?: ResultCallback<RequestFormSkeleton>;
  state: State;
}): Promise<RequestFormSkeleton[]> {
  debugMessage({
    message: `IgaRequestFormOps.importRequestForms: start`,
    state,
  });
  // Import request type dependencies
  if (
    options.deps &&
    importData.requestType &&
    Object.keys(importData.requestType).length
  ) {
    try {
      await importRequestTypes({
        //@ts-expect-error Since we ensure requestType exists before this, we can ignore the error
        importData,
        options: { onlyCustom: false },
        state,
      });
    } catch (e) {
      if (resultCallback) {
        resultCallback(e, undefined);
      } else {
        throw new FrodoError(`Error importing request type dependencies`, e);
      }
    }
  }
  // Import request forms
  const response = [];
  for (const existingId of Object.keys(importData.requestForm)) {
    const form = importData.requestForm[existingId];
    const shouldNotImport =
      (formId && formId !== form.id) || (formName && formName !== form.name);
    if (shouldNotImport) continue;
    const result = await getResult(
      resultCallback,
      `Error importing request form ${form.name}`,
      updateRequestForm,
      {
        formId: form.id,
        formData: form,
        state,
      }
    );
    if (!result) continue;
    try {
      // Import assignments
      if (form.assignments && form.assignments.length) {
        for (const assignment of form.assignments) {
          await assignRequestForm({
            formId: assignment.formId,
            objectId: assignment.objectId,
            state,
          });
        }
      }
      // Get all assignments in case there are others not included in the import
      result.assignments = await getRequestFormAssignments({
        formId: form.id,
        state,
      });
    } catch (e) {
      if (resultCallback) {
        resultCallback(e, undefined);
      } else {
        throw new FrodoError(
          `Error importing assignments for request form ${form.name}`,
          e
        );
      }
    }
    response.push(result);
  }
  debugMessage({ message: `IgaRequestFormOps.importRequestForms: end`, state });
  return response;
}

/**
 * Delete request form
 * @param {string} formId the request form id
 * @returns {Promise<RequestFormSkeleton>} a promise that resolves to a request form object
 */
export async function deleteRequestForm({
  formId,
  state,
}: {
  formId: string;
  state: State;
}): Promise<RequestFormSkeleton> {
  try {
    const assignments = await getRequestFormAssignments({ formId, state });
    for (const assignment of assignments) {
      await unassignRequestForm({
        formId: assignment.formId,
        objectId: assignment.objectId,
        state,
      });
    }
    const result = await _deleteRequestForm({ formId, state });
    result.assignments = assignments;
    return result;
  } catch (error) {
    throw new FrodoError(`Error deleting request form ${formId}`, error);
  }
}

/**
 * Delete request form by its name. Since names are NOT necessarily unique, this method will throw if it finds multiple of the same name.
 * @param {string} formName the request form name
 * @returns {Promise<RequestFormSkeleton>} a promise that resolves to a request form object
 */
export async function deleteRequestFormByName({
  formName,
  state,
}: {
  formName: string;
  state: State;
}): Promise<RequestFormSkeleton> {
  try {
    const requestForm = await readRequestFormByName({
      formName,
      state,
    });
    return await deleteRequestForm({
      formId: requestForm.id,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error deleting request form ${formName}`, error);
  }
}

/**
 * Delete request forms
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<RequestFormSkeleton[]>} promise that resolves to an array of request form objects
 */
export async function deleteRequestForms({
  resultCallback = void 0,
  state,
}: {
  resultCallback?: ResultCallback<RequestFormSkeleton>;
  state: State;
}): Promise<RequestFormSkeleton[]> {
  const forms = await readRequestForms({ state });
  const deletedRequestForms = [];
  for (const form of forms) {
    const result = await getResult(
      resultCallback,
      `Error deleting request form ${form.id}`,
      deleteRequestForm,
      { formId: form.id, state }
    );
    if (result) {
      deletedRequestForms.push(result);
    }
  }
  return deletedRequestForms;
}

/**
 * Helper that prepares a form for export
 * @param {RequestFormSkeleton} form the request form data
 * @param {RequestFormExportOptions} options export options
 * @returns {RequestFormExportInterface} the request form export object
 */
async function prepareFormForExport({
  form,
  options,
  state,
}: {
  form: RequestFormSkeleton;
  options: RequestFormExportOptions;
  state: State;
}): Promise<RequestFormExportInterface> {
  const exportData = createRequestFormExportTemplate({ state });
  form.assignments = await getRequestFormAssignments({
    formId: form.id,
    state,
  });
  if (options.deps && form.type === 'request') {
    exportData.requestType = Object.fromEntries(
      (
        await Promise.all(
          form.assignments
            .filter((a) => a.objectId.startsWith('requestType/'))
            .map((a) =>
              exportRequestType({
                typeId: a.objectId.split('/').pop(),
                options: {
                  useStringArrays: options.useStringArrays,
                  onlyCustom: false,
                },
                state,
              })
            )
        )
      ).flatMap((r) => Object.entries(r.requestType))
    );
  }
  if (options.useStringArrays) {
    transformScriptStringsToArrays(form.form);
  }
  exportData.requestForm[form.id] = form;
  return exportData;
}
