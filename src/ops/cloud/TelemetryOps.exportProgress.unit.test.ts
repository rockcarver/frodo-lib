/**
 * Run tests
 *
 *        npm run test:only TelemetryOps.exportProgress
 *
 * Unit tests of how exportTelemetry() ends its progress indicator when it
 * fails: no recordings, no tenant. exportTelemetry() creates its indicator
 * after it has read the exporters, so a tenant that does not let the
 * credential read them makes it fail before there is an indicator. The
 * failure must reach the caller as the error it is, with no call to stop an
 * indicator that does not exist.
 */
import { jest } from '@jest/globals';
import StateImpl from '../../shared/State';

const getTelemetryExportersMock = jest.fn<any>();
const actualTelemetryApi = await import('../../api/cloud/TelemetryApi');
jest.unstable_mockModule('../../api/cloud/TelemetryApi', () => ({
  ...actualTelemetryApi,
  getTelemetryExporters: getTelemetryExportersMock,
}));
const { exportTelemetry } = await import('./TelemetryOps');

function newState() {
  const create = jest.fn<any>(() => 'indicator-1');
  const update = jest.fn<any>();
  const stop = jest.fn<any>();
  const state = StateImpl({});
  state.setCreateProgressHandler(create);
  state.setUpdateProgressHandler(update);
  state.setStopProgressHandler(stop);
  state.setDebugHandler(() => undefined);
  return { state, create, update, stop };
}

describe('exportTelemetry() progress indicator', () => {
  beforeEach(() => getTelemetryExportersMock.mockReset());

  test('1: a failure before the indicator exists is the error the caller gets, and no indicator is stopped', async () => {
    getTelemetryExportersMock.mockRejectedValue(new Error('403 Forbidden'));
    const { state, create, update, stop } = newState();

    await expect(exportTelemetry({ state })).rejects.toMatchObject({
      name: 'FrodoError',
      message: 'Error exporting telemetry',
    });

    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  test('2: a failure after the indicator was created stops that indicator as failed', async () => {
    getTelemetryExportersMock.mockResolvedValue({
      otlp: [
        { id: 'exporter-1', endpoint: 'https://example.com', sources: [] },
      ],
      splunk: [],
    });
    const { state, create, update, stop } = newState();
    update.mockImplementation(() => {
      throw new Error('cannot update');
    });

    await expect(exportTelemetry({ state })).rejects.toMatchObject({
      name: 'FrodoError',
      message: 'Error exporting telemetry',
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(
      'indicator-1',
      'Error exporting telemetry exporters',
      'fail'
    );
  });

  test('3: an indicator that cannot be created is the error the caller gets', async () => {
    getTelemetryExportersMock.mockResolvedValue({ otlp: [], splunk: [] });
    const { state, create, stop } = newState();
    create.mockImplementation(() => {
      throw new Error('cannot create');
    });

    const error: any = await exportTelemetry({ state }).catch((e) => e);

    expect(error.name).toBe('FrodoError');
    expect(error.originalErrors.map((e: Error) => e.message)).toEqual([
      'cannot create',
    ]);
    expect(stop).not.toHaveBeenCalled();
  });

  test('4: a successful export stops its indicator once, with the id it got', async () => {
    getTelemetryExportersMock.mockResolvedValue({
      otlp: [
        { id: 'exporter-1', endpoint: 'https://example.com', sources: [] },
      ],
      splunk: [],
    });
    const { state, update, stop } = newState();

    const exported = await exportTelemetry({ state });

    expect(exported.telemetry.otlp).toHaveLength(1);
    expect(update).toHaveBeenCalledWith(
      'indicator-1',
      'Exporting telemetry exporter exporter-1'
    );
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(
      'indicator-1',
      'Exported 1 telemetry exporters.',
      'none'
    );
  });
});
