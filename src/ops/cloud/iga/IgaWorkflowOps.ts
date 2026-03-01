import { EventSkeleton, queryEvents } from '../../../api/cloud/iga/IgaEventApi';
import {
  getRequestFormAssignments,
  RequestFormSkeleton,
} from '../../../api/cloud/iga/IgaRequestFormApi';
import {
  queryRequestTypes,
  RequestTypeSkeleton,
} from '../../../api/cloud/iga/IgaRequestTypeApi';
import {
  deleteDraftWorkflow as _deleteDraftWorkflow,
  deletePublishedWorkflow as _deletePublishedWorkflow,
  getDraftWorkflow,
  getPublishedWorkflow,
  getWorkflows,
  publishWorkflow as _publishWorkflow,
  putWorkflow,
  WorkflowSkeleton,
} from '../../../api/cloud/iga/IgaWorkflowApi';
import { VariableSkeleton } from '../../../api/cloud/VariablesApi';
import { State } from '../../../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../../../utils/Console';
import {
  getErrorCallback,
  getMetadata,
  getResult,
  objectRecurse,
  transformScriptArraysToStrings,
  transformScriptStringsToArrays,
} from '../../../utils/ExportImportUtils';
import { mergeDeep } from '../../../utils/JsonUtils';
import {
  EmailTemplateSkeleton,
  importEmailTemplates,
  readEmailTemplate,
} from '../../EmailTemplateOps';
import { FrodoError } from '../../FrodoError';
import { ExportMetaData, ResultCallback } from '../../OpsTypes';
import { importVariables, resolveVariable } from '../VariablesOps';
import { importEvents } from './IgaEventOps';
import {
  createRequestFormExportTemplate,
  deleteOrphanedRequestFormAssignments,
  exportRequestForm,
  importRequestForms,
  RequestFormExportInterface,
} from './IgaRequestFormOps';
import { importRequestTypes } from './IgaRequestTypeOps';

export type Workflow = {
  /**
   * Publish an existing draft workflow
   * @param {string} workflowId the workflow id
   * @returns {Promise<WorkflowSkeleton>} a promise that resolves to the published workflow object
   */
  publishWorkflow(workflowId: string): Promise<WorkflowSkeleton>;
  /**
   * Read draft workflow
   * @param {string} workflowId the workflow id
   * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
   */
  readDraftWorkflow(workflowId: string): Promise<WorkflowSkeleton>;
  /**
   * Read published workflow
   * @param {string} workflowId the workflow id
   * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
   */
  readPublishedWorkflow(workflowId: string): Promise<WorkflowSkeleton>;
  /**
   * Read workflow group
   * @param {string} workflowId the workflow id
   * @returns {Promise<WorkflowGroup>} a promise that resolves to a grouped workflow object (contains both draft and published versions)
   */
  readWorkflowGroup(workflowId: string): Promise<WorkflowGroup>;
  /**
   * Read all workflows
   * @returns {Promise<WorkflowSkeleton[]>} a promise that resolves to an array of workflow objects
   */
  readWorkflows(): Promise<WorkflowSkeleton[]>;
  /**
   * Read all workflow groups
   * @returns {Promise<WorkflowGroup[]>} a promise that resolves to an array of grouped workflow objects (contain both draft and published versions)
   */
  readWorkflowGroups(): Promise<WorkflowGroup[]>;
  /**
   * Export workflow
   * @param {string} workflowId the workflow id
   * @param {WorkflowExportOptions} options workflow export options
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<WorkflowExportInterface>} a promise that resolves to a workflow export object
   */
  exportWorkflow(
    workflowId: string,
    options?: WorkflowExportOptions,
    resultCallback?: ResultCallback<WorkflowExportInterface>
  ): Promise<WorkflowExportInterface>;
  /**
   * Export all workflows
   * @param {WorkflowExportOptions} options workflow export options
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<WorkflowExportInterface>} a promise that resolves to a workflow export object
   */
  exportWorkflows(
    options?: WorkflowExportOptions,
    resultCallback?: ResultCallback<WorkflowExportInterface>
  ): Promise<WorkflowExportInterface>;
  /**
   * Update workflow
   * @param {string} workflowId the workflow id
   * @param {WorkflowSkeleton} workflowData the workflow object
   * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
   */
  updateWorkflow(
    workflowId: string,
    workflowData: WorkflowSkeleton
  ): Promise<WorkflowSkeleton>;
  /**
   * Import workflows
   * @param {string} workflowId The workflow id. If supplied, only the workflow of that id is imported.
   * @param {WorkflowExportInterface} importData workflow import data
   * @param {WorkflowImportOptions} options workflow import options
   * @param {ResultCallback<WorkflowSkeleton>} resultCallback Optional callback to process individual results
   * @returns {Promise<WorkflowSkeleton[]>} the imported workflows
   */
  importWorkflows(
    workflowId: string,
    importData: WorkflowExportInterface,
    options?: WorkflowImportOptions,
    resultCallback?: ResultCallback<WorkflowSkeleton>
  ): Promise<WorkflowSkeleton[]>;
  /**
   * Delete draft workflow
   * @param {string} workflowId the workflow id
   * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
   */
  deleteDraftWorkflow(workflowId: string): Promise<WorkflowSkeleton>;
  /**
   * Delete published workflow
   * @param {string} workflowId the workflow id
   * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
   */
  deletePublishedWorkflow(workflowId: string): Promise<WorkflowSkeleton>;
  /**
   * Delete workflows
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<WorkflowSkeleton[]>} promise that resolves to an array of workflow objects
   */
  deleteWorkflows(
    resultCallback?: ResultCallback<WorkflowSkeleton>
  ): Promise<WorkflowSkeleton[]>;
};

export default (state: State): Workflow => {
  return {
    publishWorkflow(workflowId: string): Promise<WorkflowSkeleton> {
      return publishWorkflow({
        workflowId,
        state,
      });
    },
    readDraftWorkflow(workflowId: string): Promise<WorkflowSkeleton> {
      return readDraftWorkflow({
        workflowId,
        state,
      });
    },
    readPublishedWorkflow(workflowId: string): Promise<WorkflowSkeleton> {
      return readPublishedWorkflow({
        workflowId,
        state,
      });
    },
    readWorkflowGroup(workflowId: string): Promise<WorkflowGroup> {
      return readWorkflowGroup({
        workflowId,
        state,
      });
    },
    readWorkflows(): Promise<WorkflowSkeleton[]> {
      return readWorkflows({
        state,
      });
    },
    readWorkflowGroups(): Promise<WorkflowGroup[]> {
      return readWorkflowGroups({
        state,
      });
    },
    exportWorkflow(
      workflowId: string,
      options: WorkflowExportOptions = {
        deps: true,
        useStringArrays: true,
        coords: true,
        includeReadOnly: false,
      }
    ): Promise<WorkflowExportInterface> {
      return exportWorkflow({
        workflowId,
        options,
        state,
      });
    },
    exportWorkflows(
      options: WorkflowExportOptions = {
        deps: true,
        useStringArrays: true,
        coords: true,
        includeReadOnly: false,
      },
      resultCallback: ResultCallback<WorkflowExportInterface> = void 0
    ): Promise<WorkflowExportInterface> {
      return exportWorkflows({
        options,
        resultCallback,
        state,
      });
    },
    updateWorkflow(
      workflowId: string,
      workflowData: WorkflowSkeleton
    ): Promise<WorkflowSkeleton> {
      return updateWorkflow({
        workflowId,
        workflowData,
        state,
      });
    },
    importWorkflows(
      workflowId: string,
      importData: WorkflowExportInterface,
      options: WorkflowImportOptions = {
        deps: true,
      },
      resultCallback: ResultCallback<WorkflowSkeleton> = void 0
    ): Promise<WorkflowSkeleton[]> {
      return importWorkflows({
        workflowId,
        importData,
        options,
        resultCallback,
        state,
      });
    },
    deleteDraftWorkflow(workflowId: string): Promise<WorkflowSkeleton> {
      return deleteDraftWorkflow({
        workflowId,
        state,
      });
    },
    deletePublishedWorkflow(workflowId: string): Promise<WorkflowSkeleton> {
      return deletePublishedWorkflow({
        workflowId,
        state,
      });
    },
    deleteWorkflows(
      resultCallback?: ResultCallback<WorkflowSkeleton>
    ): Promise<WorkflowSkeleton[]> {
      return deleteWorkflows({
        resultCallback,
        state,
      });
    },
  };
};

export interface WorkflowGroup {
  draft?: null | WorkflowSkeleton;
  published?: null | WorkflowSkeleton;
}

export type WorkflowGroups = Record<string, WorkflowGroup>;

export interface WorkflowExportInterface {
  meta?: ExportMetaData;
  workflow: WorkflowGroups;
  emailTemplate: Record<string, EmailTemplateSkeleton>;
  event: Record<string, EventSkeleton>;
  requestForm: Record<string, RequestFormSkeleton>;
  requestType: Record<string, RequestTypeSkeleton>;
  variable: Record<string, VariableSkeleton>;
}

/**
 * Workflow import options
 */
export interface WorkflowImportOptions {
  /**
   * Include any dependencies (email templates).
   */
  deps: boolean;
}

/**
 * Workflow export options
 */
export interface WorkflowExportOptions {
  /**
   * Include any dependencies (email templates, request forms, request types, events).
   */
  deps: boolean;
  /**
   * Use string arrays to store script code
   */
  useStringArrays: boolean;
  /**
   * Include x and y coordinate positions of the workflow nodes.
   */
  coords: boolean;
  /**
   * Export the read only (non-mutable) workflows
   */
  includeReadOnly: boolean;
}

/**
 * Create an empty workflow export template
 * @returns {WorkflowExportInterface} an empty workflow export template
 */
export function createWorkflowExportTemplate({
  state,
}: {
  state: State;
}): WorkflowExportInterface {
  return {
    meta: getMetadata({ state }),
    workflow: {},
    emailTemplate: {},
    event: {},
    requestForm: {},
    requestType: {},
    variable: {},
  };
}

/**
 * Publish an existing draft workflow
 * @param {string} workflowId the workflow id
 * @returns {Promise<WorkflowSkeleton>} a promise that resolves to the published workflow object
 */
export async function publishWorkflow({
  workflowId,
  state,
}: {
  workflowId: string;
  state: State;
}): Promise<WorkflowSkeleton> {
  try {
    const draftWorkflow = await readDraftWorkflow({ workflowId, state });
    return await _publishWorkflow({ workflowData: draftWorkflow, state });
  } catch (error) {
    throw new FrodoError(
      `Error publishing draft workflow ${workflowId}`,
      error
    );
  }
}

/**
 * Read draft workflow
 * @param {string} workflowId the workflow id
 * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
 */
export async function readDraftWorkflow({
  workflowId,
  state,
}: {
  workflowId: string;
  state: State;
}): Promise<WorkflowSkeleton> {
  try {
    return await getDraftWorkflow({ workflowId, state });
  } catch (error) {
    throw new FrodoError(`Error reading draft workflow ${workflowId}`, error);
  }
}

/**
 * Read published workflow
 * @param {string} workflowId the workflow id
 * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
 */
export async function readPublishedWorkflow({
  workflowId,
  state,
}: {
  workflowId: string;
  state: State;
}): Promise<WorkflowSkeleton> {
  try {
    return await getPublishedWorkflow({ workflowId, state });
  } catch (error) {
    throw new FrodoError(
      `Error reading published workflow ${workflowId}`,
      error
    );
  }
}

/**
 * Read workflow group
 * @param {string} workflowId the workflow id
 * @returns {Promise<WorkflowGroup>} a promise that resolves to a grouped workflow object (contains both draft and published versions)
 */
export async function readWorkflowGroup({
  workflowId,
  state,
}: {
  workflowId: string;
  state: State;
}): Promise<WorkflowGroup> {
  try {
    return Object.values(
      await readGroupedWorkflows({ workflowId, includeReadOnly: true, state })
    )[0];
  } catch (error) {
    throw new FrodoError(`Error reading workflow groups`, error);
  }
}

/**
 * Read all workflows
 * @returns {Promise<WorkflowSkeleton[]>} a promise that resolves to an array of workflow objects
 */
export async function readWorkflows({
  state,
}: {
  state: State;
}): Promise<WorkflowSkeleton[]> {
  try {
    const { result } = await getWorkflows({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading workflows`, error);
  }
}

/**
 * Read all workflow groups
 * @returns {Promise<WorkflowGroup[]>} a promise that resolves to an array of grouped workflow objects (contain both draft and published versions)
 */
export async function readWorkflowGroups({
  state,
}: {
  state: State;
}): Promise<WorkflowGroup[]> {
  try {
    return Object.values(
      await readGroupedWorkflows({ includeReadOnly: true, state })
    );
  } catch (error) {
    throw new FrodoError(`Error reading workflow groups`, error);
  }
}

/**
 * Export workflow
 * @param {string} workflowId the workflow id
 * @param {WorkflowExportOptions} options workflow export options
 * @returns {Promise<WorkflowExportInterface>} a promise that resolves to a workflow export object
 */
export async function exportWorkflow({
  workflowId,
  options = {
    deps: true,
    useStringArrays: true,
    coords: true,
    includeReadOnly: false,
  },
  state,
}: {
  workflowId: string;
  options?: WorkflowExportOptions;
  state: State;
}): Promise<WorkflowExportInterface> {
  try {
    debugMessage({ message: `IgaWorkflowOps.exportWorkflow: start`, state });
    const exportData = getWorkflowExport({
      workflowId,
      options,
      state,
    });
    debugMessage({ message: `IgaWorkflowOps.exportWorkflow: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting workflow ${workflowId}`, error);
  }
}

/**
 * Export all workflows
 * @param {WorkflowExportOptions} options workflow export options
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<WorkflowExportInterface>} a promise that resolves to a workflow export object
 */
export async function exportWorkflows({
  options = {
    deps: true,
    useStringArrays: true,
    coords: true,
    includeReadOnly: false,
  },
  resultCallback = void 0,
  state,
}: {
  options?: WorkflowExportOptions;
  resultCallback: ResultCallback<WorkflowExportInterface>;
  state: State;
}): Promise<WorkflowExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({ message: `IgaWorkflowOps.exportWorkflows: start`, state });
    let exportData: WorkflowExportInterface;
    if (!resultCallback) {
      // This is a simpler/faster way to export everything in one go
      indicatorId = createProgressIndicator({
        type: 'indeterminate',
        total: 0,
        message: 'Exporting workflows...',
        state,
      });
      exportData = await getWorkflowExport({
        options,
        state,
      });
    } else {
      // For result callbacks we must do each export individually
      const workflows = await readWorkflows({ state });
      indicatorId = createProgressIndicator({
        total: workflows.length,
        message: `Exporting workflows...`,
        state,
      });
      exportData = createWorkflowExportTemplate({ state });
      for (const workflow of workflows) {
        updateProgressIndicator({
          id: indicatorId,
          message: `Exporting ${workflow.status} workflow ${workflow.id}`,
          state,
        });
        const singleExport = await getResult(
          resultCallback,
          undefined,
          exportWorkflow,
          {
            workflowId: workflow.id,
            options,
            state,
          }
        );
        if (singleExport) {
          // Merge in export with full export
          exportData = mergeDeep(exportData, singleExport);
        }
      }
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${Object.keys(exportData.workflow).length} workflows`,
      status: 'success',
      state,
    });
    debugMessage({ message: `IgaWorkflowOps.exportWorkflows: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting workflows`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting workflows`, error);
  }
}

/**
 * Update workflow
 * @param {string} workflowId the workflow id
 * @param {WorkflowSkeleton} workflowData the workflow object
 * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
 */
export async function updateWorkflow({
  workflowId,
  workflowData,
  state,
}: {
  workflowId: string;
  workflowData: WorkflowSkeleton;
  state: State;
}): Promise<WorkflowSkeleton> {
  try {
    transformScriptArraysToStrings(workflowData);
    return await (
      workflowData.status === 'published' ? _publishWorkflow : putWorkflow
    )({ workflowId, workflowData, state });
  } catch (error) {
    throw new FrodoError(`Error updating workflow '${workflowId}'`, error);
  }
}

/**
 * Import workflows
 * @param {string} workflowId The workflow id. If supplied, only the workflow of that id is imported.
 * @param {WorkflowExportInterface} importData workflow import data
 * @param {WorkflowImportOptions} options workflow import options
 * @param {ResultCallback<WorkflowSkeleton>} resultCallback Optional callback to process individual results
 * @returns {Promise<WorkflowSkeleton[]>} the imported workflows
 */
export async function importWorkflows({
  workflowId,
  importData,
  options = {
    deps: true,
  },
  resultCallback,
  state,
}: {
  workflowId?: string;
  importData: WorkflowExportInterface;
  options?: WorkflowImportOptions;
  resultCallback?: ResultCallback<WorkflowSkeleton>;
  state: State;
}): Promise<WorkflowSkeleton[]> {
  debugMessage({ message: `IgaWorkflowOps.importWorkflows: start`, state });
  const errorCallback = getErrorCallback(resultCallback);
  const response = [];
  // Import dependencies first
  if (options.deps) {
    // Import variables
    if (importData.variable && Object.keys(importData.variable).length > 0) {
      await getResult(
        errorCallback,
        'Error importing ESV variable dependencies',
        importVariables,
        {
          importData,
          state,
        }
      );
    }
    // Import email templates
    if (
      importData.emailTemplate &&
      Object.keys(importData.emailTemplate).length > 0
    ) {
      await getResult(
        errorCallback,
        'Error importing email template dependencies',
        importEmailTemplates,
        {
          importData,
          state,
        }
      );
    }
    // Import request types
    if (
      importData.requestType &&
      Object.keys(importData.requestType).length > 0
    ) {
      await getResult(
        errorCallback,
        'Error importing request type dependencies',
        importRequestTypes,
        {
          importData,
          options: { onlyCustom: false },
          state,
        }
      );
    }
    // Import request forms
    if (
      importData.requestForm &&
      Object.keys(importData.requestForm).length > 0
    ) {
      await getResult(
        errorCallback,
        'Error importing request form dependencies',
        importRequestForms,
        {
          importData,
          options: { deps: false },
          state,
        }
      );
    }
    // Import events
    if (importData.event && Object.keys(importData.event).length > 0) {
      await getResult(
        errorCallback,
        'Error importing event dependencies',
        importEvents,
        {
          importData,
          options: { deps: false },
          state,
        }
      );
    }
  }
  // Read server workflows in the event we need to update coordinates
  // Note that if workflowId is undefined, it will get all workflows
  const serverWorkflows = await readGroupedWorkflows({
    workflowId,
    state,
  });
  for (const existingId of Object.keys(importData.workflow)) {
    try {
      const workflow = importData.workflow[existingId];
      const shouldNotImportWorkflow =
        (!workflow.draft && !workflow.published) ||
        (workflow.draft &&
          (!workflow.draft.mutable ||
            (workflowId && workflowId !== workflow.draft.id))) ||
        (workflow.published &&
          (!workflow.published.mutable ||
            (workflowId && workflowId !== workflow.published.id)));
      if (shouldNotImportWorkflow) continue;
      debugMessage({
        message: `IgaWorkflowOps.importWorkflows: Importing workflow ${existingId}`,
        state,
      });
      // Import workflows
      // Get the draft workflow if it exists and we don't have it, since it will be deleted when we publish the published one, this way we can restore the draft version after.
      // Note that we don't need to worry about request form assignments here, because when it deletes the draft, it doesn't delete the assignments (they are temporarily orphaned until we re-import the draft).
      if (!workflow.draft) {
        workflow.draft = serverWorkflows[workflow.published.id]?.draft;
      }
      // Import published first because publishing ends up deleting the draft workflow if it exists
      if (workflow.published) {
        fillCoordinates(
          workflow.published,
          serverWorkflows[workflow.published.id]?.published
        );
        const result = await updateWorkflow({
          workflowId: workflow.published.id,
          workflowData: workflow.published,
          state,
        });
        if (resultCallback) {
          resultCallback(undefined, result);
        }
        response.push(result);
      }
      if (workflow.draft) {
        fillCoordinates(
          workflow.draft,
          serverWorkflows[workflow.draft.id]?.draft
        );
        const result = await updateWorkflow({
          workflowId: workflow.draft.id,
          workflowData: workflow.draft,
          state,
        });
        if (resultCallback) {
          resultCallback(undefined, result);
        }
        response.push(result);
      }
    } catch (e) {
      if (resultCallback) {
        resultCallback(e, undefined);
      } else {
        throw new FrodoError(`Error importing workflow '${existingId}'`, e);
      }
    }
  }
  // We want to delete any orphaned assignments that could be caused as a result of the import (since relevant nodes could have been deleted from the workflow(s))
  // Note that if workflowId is undefined, then it will delete all orphaned workflow assignments
  await deleteOrphanedRequestFormAssignments({
    workflowId,
    onlyWorkflow: true,
    resultCallback: errorCallback,
    state,
  });
  debugMessage({ message: `IgaWorkflowOps.importWorkflows: end`, state });
  return response;
}

/**
 * Delete draft workflow
 * @param {string} workflowId the workflow id
 * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
 */
export async function deleteDraftWorkflow({
  workflowId,
  state,
}: {
  workflowId: string;
  state: State;
}): Promise<WorkflowSkeleton> {
  try {
    const deletedWorkflow = await _deleteDraftWorkflow({ workflowId, state });
    await deleteOrphanedRequestFormAssignments({
      workflowId,
      state,
    });
    return deletedWorkflow;
  } catch (error) {
    throw new FrodoError(`Error deleting draft workflow ${workflowId}`, error);
  }
}

/**
 * Delete published workflow
 * @param {string} workflowId the workflow id
 * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
 */
export async function deletePublishedWorkflow({
  workflowId,
  state,
}: {
  workflowId: string;
  state: State;
}): Promise<WorkflowSkeleton> {
  try {
    const deletedWorkflow = await _deletePublishedWorkflow({
      workflowId,
      state,
    });
    await deleteOrphanedRequestFormAssignments({
      workflowId,
      state,
    });
    return deletedWorkflow;
  } catch (error) {
    throw new FrodoError(
      `Error deleting published workflow ${workflowId}`,
      error
    );
  }
}

/**
 * Delete workflows
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<WorkflowSkeleton[]>} promise that resolves to an array of workflow objects
 */
export async function deleteWorkflows({
  resultCallback,
  state,
}: {
  resultCallback?: ResultCallback<WorkflowSkeleton>;
  state: State;
}): Promise<WorkflowSkeleton[]> {
  const workflows = await readWorkflows({ state });
  const deletedWorkflows = [];
  for (const workflow of workflows) {
    const result: WorkflowSkeleton = await getResult(
      resultCallback,
      `Error deleting workflow ${workflow.id}`,
      workflow.status === 'published'
        ? deletePublishedWorkflow
        : deleteDraftWorkflow,
      { workflowId: workflow.id, state }
    );
    if (result) {
      deletedWorkflows.push(result);
    }
  }
  return deletedWorkflows;
}

// Helper functions

/**
 * Gets email template dependencies for the provided workflows
 *
 * @param {Record<string, object>} workflows The workflows to get the email dependencies of
 * @param {Record<string, VariableSkeleton>} variables The variable object that caches resolved variables
 * @param {FrodoError[]} errors the errors encountered while getting the dependencies
 * @returns {EmailTemplateSkeleton[]} The array of email template dependencies
 */
async function getWorkflowEmailTemplateDependencies({
  workflows,
  variables,
  errors = [],
  state,
}: {
  workflows: WorkflowGroups;
  variables: Record<string, VariableSkeleton>;
  errors: FrodoError[];
  state: State;
}): Promise<EmailTemplateSkeleton[]> {
  const emailTemplateIds = new Set<string>();
  objectRecurse(workflows, async (o) => {
    let emailTemplateName;
    if (typeof o.notification === 'string') emailTemplateName = o.notification;
    if (typeof o.templateName === 'string') emailTemplateName = o.templateName;
    if (emailTemplateName) {
      emailTemplateIds.add(
        await resolveVariable({
          input: o.notification,
          variables,
          state,
        })
      );
    }
  });
  return (
    await Promise.allSettled(
      [...emailTemplateIds].map((id) =>
        readEmailTemplate({
          templateId: id,
          state,
        })
      )
    )
  )
    .filter((p) => {
      if (p.status === 'fulfilled' && p.value) return true;
      if (p.status === 'rejected') {
        errors.push(new FrodoError(p.reason));
      }
      return false;
    })
    .map((p) => (p as PromiseFulfilledResult<EmailTemplateSkeleton>).value);
}

/**
 * Get request forms/types workflow dependencies
 * @param {WorkflowGroups} workflows The workflows to get the request forms/types of
 * @param {WorkflowExportOptions} options workflow export options
 * @param {FrodoError[]} errors the errors encountered while getting the dependencies
 * @returns {RequestFormExportInterface} The exported dependencies of requestForms and requestTypes
 */
async function getWorkflowRequestFormAndTypeDependencies({
  workflows,
  options = {
    deps: true,
    useStringArrays: true,
    coords: true,
    includeReadOnly: false,
  },
  errors = [],
  state,
}: {
  workflows: WorkflowGroups;
  options?: WorkflowExportOptions;
  errors?: FrodoError[];
  state: State;
}): Promise<RequestFormExportInterface> {
  let results = createRequestFormExportTemplate({ state });
  for (const workflowId of Object.keys(workflows)) {
    // Step 1: Get all request forms and their request type dependencies
    try {
      const formExportPromises = await Promise.allSettled(
        (
          await getRequestFormAssignments({
            workflowId,
            state,
          })
        ).map((a) =>
          exportRequestForm({
            formId: a.formId,
            options: { deps: true, useStringArrays: options.useStringArrays },
            state,
          })
        )
      );
      for (const formExportPromise of formExportPromises) {
        if (formExportPromise.status === 'rejected') {
          errors.push(new FrodoError(formExportPromise.reason));
          continue;
        }
        if (
          formExportPromise.status === 'fulfilled' &&
          formExportPromise.value
        ) {
          results = mergeDeep(results, formExportPromise.value);
        }
      }
    } catch (e) {
      errors.push(
        new FrodoError(
          `Error exporting request form dependencies for workflow '${workflowId}'`,
          e
        )
      );
    }
    // Step 2: Get all request types that reference the workflow that haven't already been exported
    try {
      for (const t of await queryRequestTypes({
        // This query only works if the workflow ID is all lowercase (probably because workflow IDs are case insensitive)
        queryFilter: `workflow/id eq "${workflowId.toLowerCase()}"`,
        state,
      })) {
        results.requestType[t.id] = t;
      }
    } catch (e) {
      errors.push(
        new FrodoError(
          `Error exporting request type dependencies for workflow '${workflowId}'`,
          e
        )
      );
    }
  }
  return results;
}

/**
 * Get event workflow dependencies
 * @param {WorkflowGroups} workflows The workflows to get the request forms/types of
 * @param {FrodoError[]} errors the errors encountered while getting the dependencies
 * @returns {EventSkeleton[]} The exported dependencies of requestForms and requestTypes
 */
async function getEventDependencies({
  workflows,
  errors = [],
  state,
}: {
  workflows: WorkflowGroups;
  errors?: FrodoError[];
  state: State;
}): Promise<EventSkeleton[]> {
  try {
    return (
      await queryEvents({
        // Must use 'co ""' since 'pr' amd 'eq "*"' do not work for this type of query filter
        queryFilter: 'action.name co ""',
        state,
      })
    ).filter((e) => e.action.name in workflows);
  } catch (e) {
    errors.push(e);
  }
  return [];
}

/**
 * Gets workflow export if id is provided, or all workflow exports if no id provided
 *
 * @param {string} workflowId the workflow id
 * @param {WorkflowExportOptions} options workflow export options
 * @returns {Promise<WorkflowExportInterface>} a promise that resolves to a workflow export object
 */
async function getWorkflowExport({
  workflowId,
  options = {
    deps: true,
    useStringArrays: true,
    coords: true,
    includeReadOnly: false,
  },
  state,
}: {
  workflowId?: string;
  options?: WorkflowExportOptions;
  state: State;
}): Promise<WorkflowExportInterface> {
  const exportData = createWorkflowExportTemplate({ state });
  exportData.workflow = await readGroupedWorkflows({
    workflowId,
    includeReadOnly: options.includeReadOnly,
    state,
  });
  if (
    workflowId &&
    !exportData.workflow[workflowId].draft &&
    !exportData.workflow[workflowId].published
  ) {
    throw new FrodoError(`Workflow '${workflowId}' not found.`);
  }
  if (options.useStringArrays)
    transformScriptStringsToArrays(exportData.workflow);
  if (!options.coords) removeCoordinates(exportData.workflow);
  if (options.deps) {
    const errors = [];
    // Get request forms/types
    const requestPromise = getWorkflowRequestFormAndTypeDependencies({
      workflows: exportData.workflow,
      options,
      errors,
      state,
    }).then((requests) => {
      exportData.requestForm = requests.requestForm;
      exportData.requestType = requests.requestType;
    });
    // Get email templates
    const variables: Record<string, VariableSkeleton> = {};
    const emailTemplatePromise = getWorkflowEmailTemplateDependencies({
      workflows: exportData.workflow,
      variables,
      errors,
      state,
    }).then((templates) => {
      exportData.emailTemplate = Object.fromEntries(
        templates.map((e) => [e._id.split('/')[1], e])
      );
    });
    // Get events
    const eventPromise = getEventDependencies({
      workflows: exportData.workflow,
      errors,
      state,
    }).then((events) => {
      exportData.event = Object.fromEntries(events.map((e) => [e.id, e]));
    });
    // Await promises
    await requestPromise;
    await emailTemplatePromise;
    await eventPromise;
    // Add variables to export
    exportData.variable = variables;
    if (errors.length) {
      throw new FrodoError(
        'Errors occurred while exporting workflow dependencies',
        errors
      );
    }
  }
  return exportData;
}

/**
 * Helper that reads workflows (both draft and published) into a grouped object by id. If id is provided, only returns the workflows for the specified id.
 *
 * @param {string} workflowId the workflow id
 * @param {boolean} includeReadOnly get the read only (non-mutable) workflows
 * @returns {Promise<WorkflowExportInterface>} a promise that resolves to a grouped object containing all draft/published workflows per id
 */
export async function readGroupedWorkflows({
  workflowId,
  includeReadOnly = false,
  state,
}: {
  workflowId?: string;
  includeReadOnly?: boolean;
  state: State;
}): Promise<WorkflowGroups> {
  if (!workflowId) {
    return (await readWorkflows({ state }))
      .filter((w) => includeReadOnly || w.mutable)
      .reduce((flows, flow) => {
        if (!flows[flow.id]) flows[flow.id] = { draft: null, published: null };
        flows[flow.id][flow.status] = flow;
        return flows;
      }, {});
  }
  const workflow: WorkflowGroup = { draft: null, published: null };
  try {
    workflow.draft = await getDraftWorkflow({ workflowId, state });
  } catch (e) {
    if (e.response?.status !== 404)
      throw new FrodoError(`Error reading draft workflow ${workflowId}`, e);
  }
  try {
    workflow.published = await getPublishedWorkflow({ workflowId, state });
  } catch (e) {
    if (e.response?.status !== 404)
      throw new FrodoError(`Error reading published workflow ${workflowId}`, e);
  }
  return { [workflowId]: workflow };
}

/**
 * Removes any found x/y coordinates in the object or its children
 *
 * @param {any} obj The object to remove coordinates from
 */
function removeCoordinates(obj: any) {
  objectRecurse(obj, (o) => {
    if (typeof o.x === 'number' || typeof o.y === 'number') {
      delete o.x;
      delete o.y;
    }
  });
}

/**
 * Helper to fill missing coordinates in a workflow with coordinates from the server
 *
 * @param {WorkflowSkeleton} workflow The workflow to fill in missing coordinates
 * @param {WorkflowSkeleton} serverWorkflow The server workflow to get missing coordinates from
 */
function fillCoordinates(
  workflow: WorkflowSkeleton,
  serverWorkflow: WorkflowSkeleton
) {
  // If export is missing coordinates, and server doesn't have a workflow, we just import as is since the server will fill the coordinates with default values automatically.
  if (!serverWorkflow) return;
  const nodesToCompare = [
    [workflow.staticNodes.startNode, serverWorkflow.staticNodes.startNode],
    [workflow.staticNodes.endNode, serverWorkflow.staticNodes.endNode],
    ...Object.entries(workflow.staticNodes.uiConfig).map(([id, node]) => [
      node,
      serverWorkflow.staticNodes.uiConfig[id],
    ]),
  ];
  for (const [node, serverNode] of nodesToCompare) {
    if (!serverNode) continue;
    if (!node.x) node.x = serverNode.x;
    if (!node.y) node.y = serverNode.y;
  }
}
