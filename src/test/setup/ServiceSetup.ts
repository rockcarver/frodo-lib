
import { state } from '../../index';
import { type FullService } from '../../api/ServiceApi';
import {
  deleteFullService,
  putFullService,
} from '../../ops/ServiceOps';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';

export const service1: FullService = {
  _id: '',
  _type: {
    _id: 'audit',
    collection: false,
    name: 'Audit Logging',
  },
  auditEnabled: true,
  blacklistFieldFilters: [],
  whitelistFieldFilters: [],
  nextDescendents: [
    {
      _id: 'CSV',
      _type: {
        _id: 'CSV',
        collection: true,
        name: 'CSV',
      },
      commonHandler: {
        enabled: true,
        topics: ['access', 'activity', 'config', 'authentication'],
      },
      commonHandlerPlugin: {
        handlerFactory:
          'org.forgerock.openam.audit.events.handlers.CsvAuditEventHandlerFactory',
      },
      csvBuffering: {
        bufferingAutoFlush: false,
        bufferingEnabled: true,
      },
      csvConfig: {
        location: '%BASE_DIR%/var/audit/',
      },
      csvFileRetention: {
        retentionMaxDiskSpaceToUse: '-1',
        retentionMaxNumberOfHistoryFiles: '1',
        retentionMinFreeSpaceRequired: '-1',
      },
      csvFileRotation: {
        rotationEnabled: true,
        rotationFileSuffix: '-yyyy.MM.dd-HH.mm.ss',
        rotationInterval: '-1',
        rotationMaxFileSize: '100000000',
        rotationTimes: ['42', '60'],
      },
      csvSecurity: {
        securityEnabled: false,
        securityFilename: 'i edited this to hide it.jks',
        securitySignatureInterval: '900',
      },
    },
    {
      _id: 'JSON',
      _type: {
        _id: 'JSON',
        collection: true,
        name: 'JSON',
      },
      commonHandler: {
        enabled: true,
        topics: ['access', 'activity', 'config', 'authentication'],
      },
      commonHandlerPlugin: {
        handlerFactory:
          'org.forgerock.openam.audit.events.handlers.JsonAuditEventHandlerFactory',
      },
      jsonBuffering: {
        bufferingMaxSize: '100000',
        bufferingWriteInterval: '5',
      },
      jsonConfig: {
        elasticsearchCompatible: false,
        location: '%BASE_DIR%/var/audit/',
        rotationRetentionCheckInterval: '5',
      },
      jsonFileRetention: {
        retentionMaxDiskSpaceToUse: '-1',
        retentionMaxNumberOfHistoryFiles: '1',
        retentionMinFreeSpaceRequired: '-1',
      },
      jsonFileRotation: {
        rotationEnabled: true,
        rotationFileSuffix: '-yyyy.MM.dd-HH.mm.ss',
        rotationInterval: '-1',
        rotationMaxFileSize: '100000000',
        rotationTimes: ['42', '60'],
      },
    },
  ],
};

export const service2: FullService = {
  _id: '',
  _type: {
    _id: 'pingOneWorkerService',
    collection: false,
    name: 'PingOne Worker Service',
  },
  enabled: true,
  nextDescendents: [
    {
      _id: 'Worker 1',
      _type: {
        _id: 'workers',
        collection: true,
        name: 'PingOne Worker',
      },
      apiUrl: 'https://api.pingone.com/v1',
      authUrl: 'https://auth.pingone.com',
      clientId: 'client id',
      clientSecretPurpose: 'secret',
      environmentId: 'environment id',
    },
    {
      _id: 'Worker 2',
      _type: {
        _id: 'workers',
        collection: true,
        name: 'PingOne Worker',
      },
      apiUrl: 'https://api.pingone.com/v1',
      authUrl: 'https://auth.pingone.com',
      clientId: 'client id',
      clientSecretPurpose: 'secret',
      environmentId: 'environment id',
    },
  ],
};

export const service3: FullService = {
  _id: '',
  _type: {
    _id: 'httpclient',
    collection: false,
    name: 'Http Client Service',
  },
  core: {
    enabled: false,
  },
  nextDescendents: [],
};

export async function stageService(
  service: FullService,
  createNew = false
) {
  const serviceId = service._type._id;

  try {
    await deleteFullService({
      serviceId,
      globalConfig: false,
      state,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  } finally {
    if (createNew) {
      await putFullService({
        serviceId,
        fullServiceData: service,
        clean: false,
        globalConfig: false,
        state,
      });
    }
  }
}

export function setup() {
  const ctx = autoSetupPolly();

  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording, true, state);
      });
    }
  });

  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageService(service1, true);
      await stageService(service2, true);
      await stageService(service3, true);
    }
  });

  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageService(service1);
      await stageService(service2);
      await stageService(service3);
    }
  });
}
