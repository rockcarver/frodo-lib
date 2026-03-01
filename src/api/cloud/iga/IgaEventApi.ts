import util from 'util';

import { State } from '../../../shared/State';
import { getApiSearchAll } from '../../../utils/ExportImportUtils';
import { getHostOnlyUrl } from '../../../utils/ForgeRockUtils';
import { Metadata } from '../../ApiTypes';
import { generateGovernanceApi } from '../../BaseApi';
import { CertificationTemplateSkeleton } from './IgaCertificationTemplateApi';

const eventEndpointURLTemplate = '%s/iga/governance/event';
const eventURLTemplate = eventEndpointURLTemplate + '/%s';
const createEventURLTemplate = eventEndpointURLTemplate + '?_action=create';

const apiVersion = 'protocol=2.1,resource=1.0';

const getApiConfig = () => {
  return {
    apiVersion,
  };
};

export type EventType = 'certification' | 'orchestration';

export type ConditionGroupOperator = 'and' | 'or';

export type ConditionOperator =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'not_equals'
  | 'starts_with'
  | 'ends_with'
  | 'gte'
  | 'gt'
  | 'lt'
  | 'lte';

export type ConditionFilter = {
  [k in ConditionGroupOperator]?: (
    | ConditionFilter
    | {
        [k in ConditionOperator]?: {
          left?: string | { literal: string | number };
          right?: string | { literal: string | number };
          search_string?: string | { literal: string | number };
          in_string?: string | { literal: string | number };
          prefix?: string | { literal: string | number };
          suffix?: string | { literal: string | number };
          value?: string | { literal: string | number };
        };
      }
  )[];
};

export interface EventOwner {
  id: string;
  userName: string;
  mail: string;
  givenName: string;
  sn: string;
}

export interface EventSkeleton {
  name: string;
  description: string;
  owners: EventOwner[];
  entityType: 'user';
  mutationType: 'create' | 'update';
  condition: {
    version?: string;
    filter?: ConditionFilter;
  };
  action: {
    type: EventType;
    // For certification types. These are just a certification template. If the certification template gets deleted for the event, only the id of it remains.
    template?: { id: string } | CertificationTemplateSkeleton;
    // The following are unique to 'orchestration' (workflow) types. Name is the workflow id of the associated workflow
    name?: string;
    parameters?: Record<string, string>;
  };
  status: 'active' | 'inactive';
  metadata?: Metadata;
  id: string;
  _rev?: number;
}

/**
 * Get Event
 * @param {string} eventId The Event id
 * @returns {Promise<EventSkeleton>} A promise that resolves to a Event object
 */
export async function getEvent({
  eventId,
  state,
}: {
  eventId: string;
  state: State;
}): Promise<EventSkeleton> {
  const urlString = util.format(
    eventURLTemplate,
    getHostOnlyUrl(state.getHost()),
    eventId
  );
  const { data } = await generateGovernanceApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Query events
 * @param {string} queryFilter The query filter to query with. Default: 'true'
 * @returns {Promise<EventSkeletonWrapper>} A promise that resolves to a wrapper for returned Event objects
 */
export async function queryEvents({
  queryFilter = 'true',
  state,
}: {
  queryFilter?: string;
  state: State;
}): Promise<EventSkeleton[]> {
  const urlString = util.format(
    eventEndpointURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  return await getApiSearchAll<EventSkeleton>({
    url: urlString,
    queryFilter,
    state,
  });
}

/**
 * Create event
 * @param {EventSkeleton} eventData The event data
 * @returns {Promise<EventSkeleton>} A promise that resolves to a event object
 */
export async function createEvent({
  eventData,
  state,
}: {
  eventData: EventSkeleton;
  state: State;
}): Promise<EventSkeleton> {
  const urlString = util.format(
    createEventURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateGovernanceApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, eventData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put event
 * @param {string} eventId The event id
 * @param {EventSkeleton} eventData The event data
 * @returns {Promise<EventSkeleton>} A promise that resolves to a event object
 */
export async function putEvent({
  eventId,
  eventData,
  state,
}: {
  eventId: string;
  eventData: EventSkeleton;
  state: State;
}): Promise<EventSkeleton> {
  const urlString = util.format(
    eventURLTemplate,
    getHostOnlyUrl(state.getHost()),
    eventId
  );
  const { data } = await generateGovernanceApi({
    resource: getApiConfig(),
    state,
  }).put(urlString, eventData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete event
 * @param {string} eventId The event id
 * @returns {Promise<EventSkeleton>} A promise that resolves to a event object
 */
export async function deleteEvent({
  eventId,
  state,
}: {
  eventId: string;
  state: State;
}): Promise<EventSkeleton> {
  const urlString = util.format(
    eventURLTemplate,
    getHostOnlyUrl(state.getHost()),
    eventId
  );
  const { data } = await generateGovernanceApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
