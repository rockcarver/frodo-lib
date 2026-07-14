import {
  createEvent as _createEvent,
  deleteEvent as _deleteEvent,
  EventSkeleton,
  getEvent,
  putEvent,
  queryEvents,
} from '../../../api/cloud/iga/IgaEventApi';
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
import { importVariables } from '../VariablesOps';

export type IgaEvent = {
  /**
   * Create event
   * @param {EventSkeleton} eventData the event object
   * @returns {Promise<EventSkeleton>} a promise that resolves to an event object
   */
  createEvent(eventData: EventSkeleton): Promise<EventSkeleton>;
  /**
   * Read Event
   * @param {string} eventId The event id
   * @returns {Promise<EventSkeleton>} A promise that resolves to a event object
   */
  readEvent(eventId: string): Promise<EventSkeleton>;
  /**
   * Read event by its name. Since names are NOT necessarily unique, this method will throw if it finds multiple of the same name.
   * @param {string} eventName the event name
   * @returns {Promise<EventSkeleton>} a promise that resolves to a event object
   */
  readEventByName(eventName: string): Promise<EventSkeleton>;
  /**
   * Read all events
   * @returns {Promise<EventSkeleton[]>} a promise that resolves to an array of event objects
   */
  readEvents(): Promise<EventSkeleton[]>;
  /**
   * Export event
   * @param {string} eventId The event id
   * @param {EventExportOptions} options Export options
   * @returns {Promise<EventExportInterface>} A promise that resolves to a event export object
   */
  exportEvent(
    eventId: string,
    options?: EventExportOptions
  ): Promise<EventExportInterface>;
  /**
   * Export event by its name. Since names are NOT necessarily unique, this method will throw if it finds multiple of the same name.
   * @param {string} eventName the event name
   * @param {EventExportOptions} options export options
   * @returns {Promise<EventExportInterface>} a promise that resolves to a event export object
   */
  exportEventByName(
    eventName: string,
    options?: EventExportOptions
  ): Promise<EventExportInterface>;
  /**
   * Export all events
   * @param {EventExportOptions} options Export options
   * @param {ResultCallback<EventExportInterface>} resultCallback Optional callback to process individual results
   * @returns {Promise<EventExportInterface>} A promise that resolves to a event export object
   */
  exportEvents(
    options?: EventExportOptions,
    resultCallback?: ResultCallback<EventExportInterface>
  ): Promise<EventExportInterface>;
  /**
   * Update event
   * @param {string} eventId The event id
   * @param {EventSkeleton} eventData The event object
   * @returns {Promise<EventSkeleton>} A promise that resolves to a event object
   */
  updateEvent(
    eventId: string,
    eventData: EventSkeleton
  ): Promise<EventSkeleton>;
  /**
   * Import events
   * @param {string} eventId The event id. If supplied, only the event of that id is imported. Takes priority over eventName if it is provided.
   * @param {string} eventName The event name. If supplied, only the event(s) of that name is imported.
   * @param {EventExportInterface} importData Event import data
   * @param {EventImportOptions} options Import options
   * @param {ResultCallback<EventSkeleton>} resultCallback Optional callback to process individual results
   * @returns {Promise<EventSkeleton[]>} The imported events
   */
  importEvents(
    importData: EventExportInterface,
    eventId?: string,
    eventName?: string,
    options?: EventImportOptions,
    resultCallback?: ResultCallback<EventSkeleton>
  ): Promise<EventSkeleton[]>;
  /**
   * Delete event
   * @param {string} eventId The event id
   * @returns {Promise<EventSkeleton>} A promise that resolves to a event object
   */
  deleteEvent(eventId: string): Promise<EventSkeleton>;
  /**
   * Delete event by its name. Since names are NOT necessarily unique, this method will throw if it finds multiple of the same name.
   * @param {string} eventName The event name
   * @returns {Promise<EventSkeleton>} A promise that resolves to a event object
   */
  deleteEventByName(eventName: string): Promise<EventSkeleton>;
  /**
   * Delete events
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<EventSkeleton[]>} A promise that resolves to an array of event objects
   */
  deleteEvents(
    resultCallback?: ResultCallback<EventSkeleton>
  ): Promise<EventSkeleton[]>;
};

export default (state: State): IgaEvent => {
  return {
    createEvent(eventData: EventSkeleton): Promise<EventSkeleton> {
      return createEvent({
        eventData,
        state,
      });
    },
    readEvent(eventId: string): Promise<EventSkeleton> {
      return readEvent({
        eventId,
        state,
      });
    },
    readEventByName(eventName: string): Promise<EventSkeleton> {
      return readEventByName({
        eventName,
        state,
      });
    },
    readEvents(): Promise<EventSkeleton[]> {
      return readEvents({
        state,
      });
    },
    exportEvent(
      eventId: string,
      options: EventExportOptions = { deps: true }
    ): Promise<EventExportInterface> {
      return exportEvent({
        eventId,
        options,
        state,
      });
    },
    exportEventByName(
      eventName: string,
      options: EventExportOptions = { deps: true }
    ): Promise<EventExportInterface> {
      return exportEventByName({
        eventName,
        options,
        state,
      });
    },
    exportEvents(
      options: EventExportOptions = { deps: true },
      resultCallback: ResultCallback<EventExportInterface> = void 0
    ): Promise<EventExportInterface> {
      return exportEvents({
        options,
        resultCallback,
        state,
      });
    },
    updateEvent(
      eventId: string,
      eventData: EventSkeleton
    ): Promise<EventSkeleton> {
      return updateEvent({
        eventId,
        eventData,
        state,
      });
    },
    importEvents(
      importData: EventExportInterface,
      eventId?: string,
      eventName?: string,
      options: EventImportOptions = { deps: true },
      resultCallback: ResultCallback<EventSkeleton> = void 0
    ): Promise<EventSkeleton[]> {
      return importEvents({
        eventId,
        eventName,
        importData,
        options,
        resultCallback,
        state,
      });
    },
    deleteEvent(eventId: string): Promise<EventSkeleton> {
      return deleteEvent({
        eventId,
        state,
      });
    },
    deleteEventByName(eventName: string): Promise<EventSkeleton> {
      return deleteEventByName({
        eventName,
        state,
      });
    },
    deleteEvents(
      resultCallback: ResultCallback<EventSkeleton> = void 0
    ): Promise<EventSkeleton[]> {
      return deleteEvents({
        resultCallback,
        state,
      });
    },
  };
};

export interface EventExportInterface {
  meta?: ExportMetaData;
  event: Record<string, EventSkeleton>;
  emailTemplate?: Record<string, EmailTemplateSkeleton>;
  variable: Record<string, VariableSkeleton>;
}
/**
 * Event import options
 */
export interface EventImportOptions {
  /**
   * Include any dependencies (e.g. email templates).
   */
  deps: boolean;
}

/**
 * Event export options
 */
export interface EventExportOptions {
  /**
   * Include any dependencies (e.g. email templates).
   */
  deps: boolean;
}

/**
 * Create an empty event export template
 * @returns {EventExportInterface} an empty event export template
 */
export function createEventExportTemplate({
  state,
}: {
  state: State;
}): EventExportInterface {
  return {
    meta: getMetadata({ state }),
    event: {},
    emailTemplate: {},
    variable: {},
  };
}

/**
 * Create event
 * @param {EventSkeleton} eventData the event object
 * @returns {Promise<EventSkeleton>} a promise that resolves to an event object
 */
export async function createEvent({
  eventData,
  state,
}: {
  eventData: EventSkeleton;
  state: State;
}): Promise<EventSkeleton> {
  try {
    return await _createEvent({ eventData, state });
  } catch (error) {
    throw new FrodoError(`Error creating event ${eventData.name}`, error);
  }
}

/**
 * Read Event
 * @param {string} eventId The event id
 * @returns {Promise<EventSkeleton>} A promise that resoves to a event object
 */
export async function readEvent({
  eventId,
  state,
}: {
  eventId: string;
  state: State;
}): Promise<EventSkeleton> {
  try {
    return await getEvent({ eventId, state });
  } catch (error) {
    throw new FrodoError(`Error reading event ${eventId}`, error);
  }
}

/**
 * Read event by its name. Since names are NOT necessarily unique, this method will throw if it finds multiple of the same name.
 * @param {string} eventName the event name
 * @returns {Promise<EventSkeleton>} a promise that resolves to a event object
 */
export async function readEventByName({
  eventName,
  state,
}: {
  eventName: string;
  state: State;
}): Promise<EventSkeleton> {
  try {
    const events = await queryEvents({
      queryFilter: `name eq "${eventName}"`,
      state,
    });
    if (events.length !== 1) {
      throw new FrodoError(
        `Expected to find a single event named '${eventName}', but ${events.length} were found.`
      );
    }
    return events[0];
  } catch (error) {
    throw new FrodoError(`Error reading event ${eventName}`, error);
  }
}

/**
 * Read all events
 * @returns {Promise<EventSkeleton[]>} a promise that resolves to an array of event objects
 */
export async function readEvents({
  state,
}: {
  state: State;
}): Promise<EventSkeleton[]> {
  try {
    return await queryEvents({ state });
  } catch (error) {
    throw new FrodoError(`Error reading events`, error);
  }
}

/**
 * Export event
 * @param {string} eventId the event id
 * @param {EventExportOptions} options export options
 * @returns {Promise<EventExportInterface>} a promise that resolves to a event export object
 */
export async function exportEvent({
  eventId,
  options = { deps: true },
  state,
}: {
  eventId: string;
  options: EventExportOptions;
  state: State;
}): Promise<EventExportInterface> {
  try {
    debugMessage({
      message: `IgaEventOps.exportEvent: start`,
      state,
    });
    const eventData = await readEvent({
      eventId,
      state,
    });
    const exportData = prepareEventForExport({
      eventData,
      options,
      state,
    });
    debugMessage({
      message: `IgaEventOps.exportEvent: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting event ${eventId}`, error);
  }
}
/**
 * Export event by its name. Since names are NOT necessarily unique, this method will throw if it finds multiple of the same name.
 * @param {string} eventName the event name
 * @param {EventExportOptions} options export options
 * @returns {Promise<EventExportInterface>} a promise that resolves to a event export object
 */
export async function exportEventByName({
  eventName,
  options = { deps: true },
  state,
}: {
  eventName: string;
  options?: EventExportOptions;
  state: State;
}): Promise<EventExportInterface> {
  try {
    debugMessage({
      message: `IgaEventOps.exportEventByName: start`,
      state,
    });
    const eventData = await readEventByName({
      eventName,
      state,
    });
    const exportData = prepareEventForExport({
      eventData,
      options,
      state,
    });
    debugMessage({
      message: `IgaEventOps.exportEventByName: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting event ${eventName}`, error);
  }
}

/**
 * Export all events
 * @param {EventExportOptions} options Export options
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<EventExportInterface>} a promise that resolves to a event export object
 */
export async function exportEvents({
  options = { deps: true },
  resultCallback = void 0,
  state,
}: {
  options?: EventExportOptions;
  resultCallback?: ResultCallback<EventExportInterface>;
  state: State;
}): Promise<EventExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({
      message: `IgaEventOps.exportEvents: start`,
      state,
    });
    const events = await readEvents({ state });
    indicatorId = createProgressIndicator({
      total: events.length,
      message: 'Exporting events...',
      state,
    });
    const exportData = createEventExportTemplate({ state });
    for (const eventData of events) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting event ${eventData.name}...`,
        state,
      });
      const eventExport = await getResult(
        resultCallback,
        `Error exporting event ${eventData.name}`,
        prepareEventForExport,
        {
          eventData,
          options,
          state,
        }
      );
      if (eventExport) {
        Object.assign(exportData.event, eventExport.event);
        Object.assign(exportData.emailTemplate, eventExport.emailTemplate);
        Object.assign(exportData.variable, eventExport.variable);
      }
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${events.length} events`,
      status: 'success',
      state,
    });
    debugMessage({
      message: `IgaEventOps.exportEvents: end`,
      state,
    });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting events`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting events`, error);
  }
}

/**
 * Update event
 * @param {string} eventId the event id
 * @param {EventSkeleton} eventData the event object
 * @returns {Promise<EventSkeleton>} a promise that resolves to a event object
 */
export async function updateEvent({
  eventId,
  eventData,
  state,
}: {
  eventId: string;
  eventData: EventSkeleton;
  state: State;
}): Promise<EventSkeleton> {
  try {
    return await putEvent({
      eventId,
      eventData,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error updating event '${eventId}'`, error);
  }
}

/**
 * Import events
 * @param {string} eventId The event id. If supplied, only the event of that id is imported. Takes priority over eventName if it is provided.
 * @param {string} eventName The event name. If supplied, only the event(s) of that name is imported.
 * @param {EventExportInterface} importData event import data
 * @param {EventImportOptions} options import options
 * @param {ResultCallback<EventSkeleton>} resultCallback Optional callback to process individual results
 * @returns {Promise<EventSkeleton[]>} the imported events
 */
export async function importEvents({
  eventId,
  eventName,
  importData,
  options = { deps: true },
  resultCallback = void 0,
  state,
}: {
  eventId?: string;
  eventName?: string;
  importData: EventExportInterface;
  options?: EventImportOptions;
  resultCallback?: ResultCallback<EventSkeleton>;
  state: State;
}): Promise<EventSkeleton[]> {
  debugMessage({
    message: `IgaEventOps.importEvents: start`,
    state,
  });
  const errorCallback = getErrorCallback(resultCallback);
  // Import variable dependencies
  if (
    options.deps &&
    importData.variable &&
    Object.keys(importData.variable).length > 0
  ) {
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
  // Import email template dependencies
  if (
    options.deps &&
    importData.emailTemplate &&
    Object.keys(importData.emailTemplate).length
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
  const response = [];
  for (const existingId of Object.keys(importData.event)) {
    const eventData = importData.event[existingId];
    try {
      const shouldNotImport =
        (eventId && eventId !== eventData.id) ||
        (eventName && eventName !== eventData.name);
      if (shouldNotImport) continue;
      let result;
      try {
        result = await putEvent({
          eventId: eventData.id,
          eventData,
          state,
        });
      } catch (error) {
        if (
          error.response?.status === 404 &&
          error.response?.data?.message &&
          error.response.data.message.startsWith('Cannot find event with id')
        ) {
          result = await createEvent({
            eventData,
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
        throw new FrodoError(`Error importing event '${eventData.name}'`, e);
      }
    }
  }
  debugMessage({ message: `IgaEventOps.importEvents: end`, state });
  return response;
}

/**
 * Delete event
 * @param {string} eventId the event id
 * @returns {Promise<EventSkeleton>} a promise that resolves to a event object
 */
export async function deleteEvent({
  eventId,
  state,
}: {
  eventId: string;
  state: State;
}): Promise<EventSkeleton> {
  try {
    return await _deleteEvent({ eventId, state });
  } catch (error) {
    throw new FrodoError(`Error deleting event ${eventId}`, error);
  }
}

/**
 * Delete event by its name. Since names are NOT necessarily unique, this method will throw if it finds multiple of the same name.
 * @param {string} eventName the event name
 * @returns {Promise<EventSkeleton>} a promise that resolves to a event object
 */
export async function deleteEventByName({
  eventName,
  state,
}: {
  eventName: string;
  state: State;
}): Promise<EventSkeleton> {
  try {
    const event = await readEventByName({
      eventName,
      state,
    });
    return await deleteEvent({
      eventId: event.id,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error deleting event ${eventName}`, error);
  }
}

/**
 * Delete events
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<EventSkeleton[]>} promise that resolves to an array of event objects
 */
export async function deleteEvents({
  resultCallback = void 0,
  state,
}: {
  resultCallback?: ResultCallback<EventSkeleton>;
  state: State;
}): Promise<EventSkeleton[]> {
  const events = await readEvents({ state });
  const deletedEvents = [];
  for (const event of events) {
    const result = await getResult(
      resultCallback,
      `Error deleting event ${event.id}`,
      deleteEvent,
      { eventId: event.id, state }
    );
    if (result) {
      deletedEvents.push(result);
    }
  }
  return deletedEvents;
}

/**
 * Helper that prepares a event for export
 * @param {EventSkeleton} eventData the event data
 * @param {EventExportOptions} options export options
 * @returns {EventExportInterface} the event export object
 */
async function prepareEventForExport({
  eventData,
  options,
  state,
}: {
  eventData: EventSkeleton;
  options: EventExportOptions;
  state: State;
}): Promise<EventExportInterface> {
  const exportData = createEventExportTemplate({ state });
  if (options.deps) {
    const errors = [];
    const variables: Record<string, VariableSkeleton> = {};
    const templates = await getIGANotificationEmailTemplateDependencies(
      eventData.action?.template,
      variables,
      errors,
      state
    );
    exportData.emailTemplate = Object.fromEntries(
      templates.map((e) => {
        return [e._id.split('/').pop(), e];
      })
    );
    exportData.variable = variables;
    if (errors.length) {
      throw new FrodoError(
        'Errors occurred while exporting event dependencies',
        errors
      );
    }
  }
  exportData.event[eventData.id] = eventData;
  return exportData;
}
