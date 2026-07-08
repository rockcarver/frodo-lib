/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 *    Telemetry only supports one exporter configuration at a time, so tests
 *    are structured as complete lifecycle workflows. Each test creates its
 *    own telemetry configuration and cleans it up before the next test runs.
 * 
 * 1. Record API responses
 *
 *    Tests:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record TelemetryOps
 *
 *
 * 2. Update snapshots
 *
 *        FRODO_DEBUG=1 npm run test:update TelemetryOps
 *
 * 3. Test your changes
 *
 *        FRODO_DEBUG=1 npm run test:only TelemetryOps
 */

import { state } from '../../index';
import * as TelemetryOps from './TelemetryOps';
import * as TestData from '../../test/setup/TelemetrySetup';
import { TelemetryExporters, TelemetryExporterCategory } from '../../api/cloud/TelemetryApi';


describe('TelemetryOps', () => {
  TestData.setup();

  describe('Telemetry lifecycle', () => {
    async function testTelemetryLifecycle(exporters: TelemetryExporters, category?: TelemetryExporterCategory, exporterId?: string) {
      
      const importResponse = await TelemetryOps.importTelemetry({
        category,
        exporterId,
        importData: {
          telemetry: exporters,
        },
        state,
      });

      expect(importResponse).toHaveLength(1);
      
      if (exporterId) expect(importResponse[0].id).toBe(exporterId);

      expect(importResponse).toMatchSnapshot();

      const exportResponse = await TelemetryOps.exportTelemetry({
        category,
        exporterId,
        state,
      });

      expect(exportResponse).toMatchSnapshot({
        meta: expect.any(Object),
      });

      const updatedEndpoint = 'https://updated.example.com/v1/logs'
     
      if (category) {
        
        const updated = {
          ...(exporters[category]?.[0]),
          endpoint: updatedEndpoint,
        };

        const updateResponse = await TelemetryOps.updateTelemetry({
          category,
          exporterId: updated.id,
          exporterData: updated,
          state,
        });
        
        expect(updateResponse.endpoint).toBe(updated.endpoint);
        expect(updateResponse).toMatchSnapshot();
      }
      

      const readResponse = await TelemetryOps.readTelemetry({
        state,
      });

      if (category) {
        expect(readResponse[category][0].endpoint).toBe(
          updatedEndpoint
        );
      }

      expect(readResponse).toMatchSnapshot();

      const deleteResponse = await TelemetryOps.deleteTelemetry({
        category,
        exporterId,
        state,
      });

      expect(deleteResponse).toMatchSnapshot();
     }

    test('Test methods are defined', () =>  {
      expect(TelemetryOps.importTelemetry).toBeDefined();
      expect(TelemetryOps.exportTelemetry).toBeDefined();
      expect(TelemetryOps.updateTelemetry).toBeDefined();
      expect(TelemetryOps.readTelemetry).toBeDefined();
      expect(TelemetryOps.deleteTelemetry).toBeDefined();
    })

    test('Import, export, update, read, and delete OTLP exporter by category', async () => {
      await testTelemetryLifecycle({
        otlp: [TestData.otlpExporter1],
        splunk: []
      }, "otlp");
    });

    test('Import, export, update, read, and delete Splunk exporter by ID', async () => {
      await testTelemetryLifecycle({
        otlp: [],
        splunk: [TestData.splunkExporter1]
      }, "splunk", TestData.splunkExporter1.id);
    });

    test('Import, export, update, read, and delete otlp exporter by ID', async () => {
      await testTelemetryLifecycle({
        otlp: [TestData.otlpExporter2],
        splunk: []
      }, "otlp", TestData.otlpExporter2.id);
    });

    test('Import, export, update, read, and delete Splunk exporter by category', async () => {
      await testTelemetryLifecycle({
        otlp: [],
        splunk: [TestData.splunkExporter2]
      }, "splunk");
    });

    test('Import, export, update, read, and delete all exporters', async () => {
      await testTelemetryLifecycle({
        otlp: [TestData.otlpExporter3],
        splunk: []
      });
    });
  });
});

  
