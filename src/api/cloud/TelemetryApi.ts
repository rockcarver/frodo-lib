import util from 'util';

import { State } from '../../shared/State';
import { getHostOnlyUrl } from '../../utils/ForgeRockUtils';
import { generateEnvApi } from '../BaseApi';

const telemetryURLTemplate = '%s/environment/telemetry';
const logExporterURLTemplate = '%s/environment/telemetry/%s/%s';

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => ({
  apiVersion,
});

export type LogSource =
  | 'am-access'
  | 'am-activity'
  | 'am-authentication'
  | 'am-config'
  | 'am-core'
  | 'am-everything'
  | 'environment-access'
  | 'idm-access'
  | 'idm-activity'
  | 'idm-authentication'
  | 'idm-config'
  | 'idm-core'
  | 'idm-recon'
  | 'idm-sync'
  | 'idm-everything'
  | 'ws-activity'
  | 'ws-config'
  | 'ws-core'
  | 'ws-everything';

export type OtlpExporterType = 'HTTP' | 'GRPC';

export type OtlpExporterEncoding = 'JSON' | 'PROTO';

export type OtlpBasicAuth = {
  username: string;
  password: string;
};

export type LogExporterSkeleton = {
  id: string;
  endpoint: string;
  sources: string[];
};

export type TelemetryExporterCategory = 'otlp' | 'splunk';

export type OtlpExporterSkeleton = LogExporterSkeleton & {
  type: OtlpExporterType;
  encoding?: OtlpExporterEncoding;
  headers?: Record<string, string>;
  basicAuth?: OtlpBasicAuth;
};

export type SplunkExporterSkeleton = LogExporterSkeleton & {
  index?: string;
  token: string;
};
export type TelemetryExporters = {
  otlp: OtlpExporterSkeleton[];
  splunk: SplunkExporterSkeleton[];
};
/**
 * Get telemetry exporters
 * @returns {Promise<TelemetryExporters>} promise resolving to telemetry exporters
 */
export async function getTelemetryExporters({
  state,
}: {
  state: State;
}): Promise<TelemetryExporters> {
  const urlString = util.format(
    telemetryURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}
/**
 * Create or update an OTLP or Splunk log exporter
 * @param {TelemetryExporterCategory} category exporter category ('otlp' or 'splunk')
 * @param {string} exporterId exporter id
 * @param {LogExporterSkeleton} exporterData exporter config, matching type indicated by category
 * @returns {Promise<LogExporterSkeleton>} promise resolving to the created/updated exporter
 */
export async function putTelemetryExporter({
  category,
  exporterId,
  exporterData,
  state,
}: {
  category: TelemetryExporterCategory;
  exporterId: string;
  exporterData: LogExporterSkeleton;
  state: State;
}): Promise<LogExporterSkeleton> {
  const urlString = util.format(
    logExporterURLTemplate,
    getHostOnlyUrl(state.getHost()),
    category,
    exporterId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).put(urlString, exporterData, {
    withCredentials: true,
  });
  return data;
}
/**
 * Delete a telemetry exporter
 * @param {TelemetryExporterCategory} category exporter category ('otlp' or 'splunk')
 * @param {string} exporterId exporter id
 * @returns {Promise<LogExporterSkeleton>} promise resolving when the exporter has been deleted
 */
export async function deleteTelemetryExporter({
  category,
  exporterId,
  state,
}: {
  category: TelemetryExporterCategory;
  exporterId: string;
  state: State;
}): Promise<LogExporterSkeleton> {
  const urlString = util.format(
    logExporterURLTemplate,
    getHostOnlyUrl(state.getHost()),
    category,
    exporterId
  );

  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });

  return data;
}
