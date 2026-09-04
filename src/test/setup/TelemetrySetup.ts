import { state } from '../../index';
import {
  autoSetupPolly,
  setupPollyRecordingContext,
} from '../../utils/AutoSetupPolly';
import { orderedMatchRequestsBy } from '../../utils/PollyUtils';
import * as TelemetryOps from '../../ops/cloud/TelemetryOps';
import {
  OtlpExporterSkeleton,
  SplunkExporterSkeleton,
} from '../../api/cloud/TelemetryApi';

export const otlpExporter1: OtlpExporterSkeleton = {
  id: 'frodo-test-otlp-1',
  endpoint: 'https://example.com/v1/logs',
  sources: ['am-access'],
  type: 'HTTP',
  encoding: 'JSON',
};
export const otlpExporter2: OtlpExporterSkeleton = {
  id: 'frodo-test-otlp-2',
  endpoint: 'https://example.com/v1/logs',
  sources: ['idm-everything'],
  type: 'HTTP',
  encoding: 'PROTO',
};
export const otlpExporter3: OtlpExporterSkeleton = {
  id: 'frodo-test-otlp-3',
  endpoint: 'https://example.com/v1/logs',
  sources: ['am-everything'],
  type: 'HTTP',
  encoding: 'JSON',
};

export const splunkExporter1: SplunkExporterSkeleton = {
  id: 'frodo-test-splunk-1',
  endpoint: 'https://example.com:8088',
  sources: ['am-access'],
  token: 'test-token-1',
};
export const splunkExporter2: SplunkExporterSkeleton = {
  id: 'frodo-test-splunk-2',
  endpoint: 'https://example.com:8088',
  sources: ['idm-everything'],
  token: 'test-token-2',
};
export function setup() {
  const ctx = autoSetupPolly(orderedMatchRequestsBy());

  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      setupPollyRecordingContext(ctx);
    }
  });

  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // Always start clean
      await TelemetryOps.deleteTelemetry({
        state,
      });
    }
  });

  afterEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await TelemetryOps.deleteTelemetry({
        state,
      });
    }
  });
}
