import util from 'util';

import { State } from '../shared/State';
import { getIdmBaseUrl } from '../utils/ForgeRockUtils';
import { IdObjectSkeletonInterface } from './ApiTypes';
import { generateIdmApi } from './BaseApi';

const apiVersion = 'resource=1.0';
const apiConfig = { headers: { 'Accept-API-Version': apiVersion } };

const reconUrlTemplate = '%s/recon';
const reconByIdUrlTemplate = '%s/recon/%s';
const startReconUrlTemplate = '%s/recon?_action=recon&mapping=%s';
const startReconByIdUrlTemplate = '%s/recon?_action=reconById&mapping=%s&id=%s';
const cancelReconUrlTemplate = '%s/recon/%s?_action=cancel';

export type ReconType = IdObjectSkeletonInterface & {
  mapping: string;
  state: 'SUCCESS' | string;
  stage: 'COMPLETED_SUCCESS' | string;
  stageDescription: string;
  progress: {
    source: { existing: { processed: number; total: string } };
    target: {
      existing: { processed: number; total: string };
      created: number;
      unchanged: number;
      updated: number;
      deleted: number;
    };
    links: { existing: { processed: number; total: string }; created: number };
  };
  situationSummary: {
    SOURCE_IGNORED: number;
    TARGET_CHANGED: number;
    SOURCE_TARGET_CONFLICT: number;
    FOUND_ALREADY_LINKED: number;
    UNQUALIFIED: number;
    ABSENT: number;
    TARGET_IGNORED: number;
    MISSING: number;
    ALL_GONE: number;
    UNASSIGNED: number;
    AMBIGUOUS: number;
    CONFIRMED: number;
    LINK_ONLY: number;
    SOURCE_MISSING: number;
    FOUND: number;
  };
  statusSummary: { SUCCESS: number; FAILURE: number };
  durationSummary: {
    sourceQuery: {
      min: number;
      max: number;
      mean: number;
      count: number;
      sum: number;
      stdDev: number;
    };
    auditLog: {
      min: number;
      max: number;
      mean: number;
      count: number;
      sum: number;
      stdDev: number;
    };
    defaultPropertyMapping: {
      min: number;
      max: number;
      mean: number;
      count: number;
      sum: number;
      stdDev: number;
    };
    sourceLinkQuery: {
      min: number;
      max: number;
      mean: number;
      count: number;
      sum: number;
      stdDev: number;
    };
    updateTargetObject: {
      min: number;
      max: number;
      mean: number;
      count: number;
      sum: number;
      stdDev: number;
    };
    propertyMappingScript: {
      min: number;
      max: number;
      mean: number;
      count: number;
      sum: number;
      stdDev: number;
    };
    updateLastSync: {
      min: number;
      max: number;
      mean: number;
      count: number;
      sum: number;
      stdDev: number;
    };
    targetObjectQuery: {
      min: number;
      max: number;
      mean: number;
      count: number;
      sum: number;
      stdDev: number;
    };
    sourcePhase: {
      min: number;
      max: number;
      mean: number;
      count: number;
      sum: number;
      stdDev: number;
    };
  };
  parameters: {
    sourceIds: [string];
    sourceQuery: {
      resourceName: string;
      _queryFilter: string;
      _fields: string;
    };
    targetQuery: {
      resourceName: string;
      queryFilter: string;
      _fields: string;
    };
  };
  started: string;
  ended: string;
  duration: number;
  sourceProcessedByNode: object;
};

export type ReconStatusType = IdObjectSkeletonInterface & {
  state: 'ACTIVE' | string;
  action: 'cancel' | string;
  status: 'INITIATED' | string;
};

export async function getRecons({
  state,
}: {
  state: State;
}): Promise<ReconType[]> {
  const urlString = util.format(reconUrlTemplate, getIdmBaseUrl(state));
  const { data } = await generateIdmApi({
    requestOverride: apiConfig,
    state,
  }).get(urlString);
  return data;
}

export async function getRecon({
  reconId,
  state,
}: {
  reconId: string;
  state: State;
}): Promise<ReconType> {
  const urlString = util.format(
    reconByIdUrlTemplate,
    getIdmBaseUrl(state),
    reconId
  );
  const { data } = await generateIdmApi({
    requestOverride: apiConfig,
    state,
  }).get(urlString);
  return data;
}

export async function startRecon({
  mappingName,
  state,
}: {
  mappingName: string;
  state: State;
}): Promise<ReconStatusType> {
  const urlString = util.format(
    startReconUrlTemplate,
    getIdmBaseUrl(state),
    mappingName
  );
  const { data } = await generateIdmApi({
    requestOverride: apiConfig,
    state,
  }).post(urlString);
  return data;
}

export async function startReconById({
  mappingName,
  objectId,
  state,
}: {
  mappingName: string;
  objectId: string;
  state: State;
}): Promise<ReconStatusType> {
  const urlString = util.format(
    startReconByIdUrlTemplate,
    getIdmBaseUrl(state),
    mappingName,
    objectId
  );
  const { data } = await generateIdmApi({
    requestOverride: apiConfig,
    state,
  }).post(urlString);
  return data;
}

export async function cancelRecon({
  reconId,
  state,
}: {
  reconId: string;
  state: State;
}): Promise<ReconStatusType> {
  const urlString = util.format(
    cancelReconUrlTemplate,
    getIdmBaseUrl(state),
    reconId
  );
  const { data } = await generateIdmApi({
    requestOverride: apiConfig,
    state,
  }).post(urlString);
  return data;
}
