import * as IgaRequestTypeApi from '../../api/cloud/iga/IgaRequestTypeApi';
import { RequestTypeSchemas } from '../../api/cloud/iga/IgaRequestTypeApi';
import { state } from '../../index';
import * as IgaRequestTypeOps from '../../ops/cloud/iga/IgaRequestTypeOps';
import {
  autoSetupPolly,
  setupPollyRecordingContext,
} from '../../utils/AutoSetupPolly';

const EXAMPLE_SCHEMAS: RequestTypeSchemas = {
  common: [
    {
      _meta: {
        type: 'system',
        displayName: 'commonRequest',
        properties: {
          justification: {
            isRequired: false,
            isInternal: true,
            display: {
              name: 'Justification',
              isVisible: true,
              order: 3,
              description: 'The reason for the request',
            },
          },
          externalRequestId: {
            isRequired: false,
            isInternal: true,
            isChangable: false,
            display: {
              name: 'External Request ID',
              isVisible: true,
              order: 4,
              description: 'The external ID for the request',
            },
          },
          requestIdPrefix: {
            isRequired: false,
            isInternal: true,
            display: {
              name: 'Request ID prefix',
              isVisible: true,
              order: 5,
              description: 'Prefix for the request ID',
            },
          },
          isDraft: {
            isRequired: false,
            isInternal: true,
          },
          priority: {
            isRequired: false,
            display: {
              name: 'Priority',
              isVisible: true,
              order: 6,
              description: 'The priority of the reqeust',
            },
            text: {
              defaultValue: 'low',
            },
          },
          expiryDate: {
            isRequired: false,
            isInternal: true,
            display: {
              name: 'Request expiration date',
              isVisible: true,
              order: 7,
              description:
                'User provided date on which the request will cancel',
            },
          },
          context: {
            isRequired: false,
            isInternal: true,
            isMultiValue: false,
            display: {
              name: 'Context',
              isVisible: true,
              order: 1,
              description: 'The context of the request',
            },
          },
          workflowId: {
            isRequired: false,
            isInternal: true,
            isChangable: false,
            display: {
              name: 'BPMN workflow ID',
              isVisible: true,
              order: 7,
              description: 'The ID key of the BPMN workflow',
            },
          },
          startDate: {
            isRequired: false,
            isInternal: true,
            display: {
              name: 'Start date',
              isVisible: true,
              order: 8,
              description: 'Start date of the grant',
            },
          },
          endDate: {
            isRequired: false,
            isInternal: true,
            display: {
              name: 'End date',
              isVisible: true,
              order: 8,
              description: 'End date of the grant',
            },
          },
          blob: {
            isRequired: false,
            isInternal: true,
          },
        },
      },
      properties: {
        justification: {
          type: 'text',
        },
        externalRequestId: {
          type: 'text',
        },
        requestIdPrefix: {
          type: 'text',
        },
        isDraft: {
          type: 'boolean',
        },
        priority: {
          type: 'text',
        },
        expiryDate: {
          type: 'text',
        },
        context: {
          type: 'object',
        },
        workflowId: {
          type: 'text',
        },
        startDate: {
          type: 'text',
        },
        endDate: {
          type: 'text',
        },
        blob: {
          type: 'object',
        },
      },
    },
  ],
  custom: [
    {
      _meta: {
        type: 'system',
        properties: {
          stringOne: {
            display: {
              name: 'String 1',
              isVisible: true,
              order: 1,
            },
            isRequired: true,
            isInternal: false,
            isMultiValue: true,
          },
          stringTwo: {
            display: {
              name: 'String 2',
              isVisible: true,
              order: 2,
            },
            isRequired: false,
            isInternal: false,
            isMultiValue: false,
          },
          numberOne: {
            display: {
              name: 'Number 1',
              isVisible: true,
              order: 3,
            },
            isRequired: true,
            isInternal: false,
            isMultiValue: true,
          },
          numberTwo: {
            display: {
              name: 'Number 2',
              isVisible: true,
              order: 4,
            },
            isRequired: false,
            isInternal: false,
            isMultiValue: false,
          },
          booleanOne: {
            display: {
              name: 'Boolean 1',
              isVisible: true,
              order: 5,
            },
            isRequired: true,
            isInternal: false,
            isMultiValue: true,
          },
          booleanTwo: {
            display: {
              name: 'Boolean 2',
              isVisible: true,
              order: 6,
            },
            isRequired: false,
            isInternal: false,
            isMultiValue: false,
          },
          objectOne: {
            display: {
              name: 'Object 1',
              isVisible: true,
              order: 7,
            },
            isRequired: true,
            isInternal: false,
            isMultiValue: true,
          },
          objectTwo: {
            display: {
              name: 'Object 2',
              isVisible: true,
              order: 8,
            },
            isRequired: false,
            isInternal: false,
            isMultiValue: false,
          },
        },
      },
      properties: {
        stringOne: {
          type: 'text',
        },
        stringTwo: {
          type: 'text',
        },
        numberOne: {
          type: 'number',
        },
        numberTwo: {
          type: 'number',
        },
        booleanOne: {
          type: 'boolean',
        },
        booleanTwo: {
          type: 'boolean',
        },
        objectOne: {
          type: 'object',
        },
        objectTwo: {
          type: 'object',
        },
      },
    },
  ],
};

// This is bare minimum needed to create a request type
export const requestType1: IgaRequestTypeApi.RequestTypeSkeleton = {
  displayName: 'test_request_type_1',
  id: '5f80166a-d551-47f2-8110-8bc0e093d2cc',
  workflow: {},
};

export const requestType2: IgaRequestTypeApi.RequestTypeSkeleton = {
  displayName: 'test_request_type_2',
  description: 'This is a test request type',
  id: '625251d2-c5e0-4d49-b38e-e5ce1a0b5972',
  notModifiableProperties: [],
  workflow: {
    id: 'testWorkflow',
  },
  schemas: EXAMPLE_SCHEMAS,
  custom: true,
  validation: {
    source: [
      '//Example validation script',
      'var validation = {"errors" : [], "comments" : []};',
      'if (',
      '  systemSettings.settings.requireRequestJustification === true',
      '  && (request.common.justification == undefined',
      "  || request.common.justification.trim() == '')) {",
      '  validation.errors.push("Justification is required");',
      '}',
      'validation;',
    ],
  },
};

// This is one of the non-custom request types. You can modify non-custom request types if they look something like this
export const requestType3: IgaRequestTypeApi.RequestTypeSkeleton = {
  id: 'createEntitlement',
  displayName: 'Create Entitlement',
  schemas: {
    common: ['/requestSchema/iga/commonRequest'],
    entitlement: ['/requestSchema/iga/createEntitlement'],
  },
  workflow: {
    id: 'CreateEntitlement',
    type: 'bpmn',
  },
  validation: {
    source:
      'var validation = {"errors" : [], "comments" : []};if(object.requester.id.startsWith("managed/user/")){var userId = object.requester.id.split(\'/\');try{var application = openidm.action("iga/governance/application/" + request.entitlement.applicationId, \'GET\', {}, {"endUserId": userId[2]});if(!application.permissions.createEntitlement){validation.errors.push("User does not have permission to create this entitlement.");}}catch(e){validation.errors.push("User does not have permission to create this entitlement.")}}if(systemSettings.settings.requireRequestJustification === true && (request.common.justification == undefined || request.common.justification.trim() == "")){validation.errors.push("Justification is required");}validation;',
  },
  notModifiableProperties: [
    'entitlement.applicationId',
    'entitlement.objectType',
  ],
  customValidation: null,
};

export const requestType4: IgaRequestTypeApi.RequestTypeSkeleton = {
  displayName: 'test_request_type_4',
  description: 'This is a test request type',
  id: '16356e2b-b98c-474c-98e3-e69d49cde401',
  notModifiableProperties: [],
  workflow: {},
  schemas: {},
  validation: {},
};

export const requestType5: IgaRequestTypeApi.RequestTypeSkeleton = {
  displayName: 'test_request_type_5',
  description: 'This is a test request type',
  id: 'b3e850f0-60c2-4138-be11-a08b17cde29f',
  notModifiableProperties: [],
  workflow: {
    id: 'hello',
  },
  schemas: EXAMPLE_SCHEMAS,
  custom: true,
  validation: {
    source:
      '//Example validation script\nvar validation = {"errors" : [], "comments" : []};\nif (\n  systemSettings.settings.requireRequestJustification === true\n  && (request.common.justification == undefined\n  || request.common.justification.trim() == \'\')) {\n  validation.errors.push("Justification is required");\n}\nvalidation;',
  },
};

export const requestType6: IgaRequestTypeApi.RequestTypeSkeleton = {
  displayName: 'test_request_type_6',
  description: 'This is a test request type',
  id: '701666c0-3e45-4e59-a208-239ffca35934',
  notModifiableProperties: [],
  workflow: {},
  schemas: EXAMPLE_SCHEMAS,
  custom: true,
  validation: {
    source:
      '//Example validation script\nvar validation = {"errors" : [], "comments" : []};\nif (\n  systemSettings.settings.requireRequestJustification === true\n  && (request.common.justification == undefined\n  || request.common.justification.trim() == \'\')) {\n  validation.errors.push("Justification is required");\n}\nvalidation;',
  },
};

export async function stageRequestType(
  type: IgaRequestTypeApi.RequestTypeSkeleton,
  createNew = false
) {
  try {
    await IgaRequestTypeOps.deleteRequestType({
      typeId: type.id,
      state,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  } finally {
    if (createNew) {
      await IgaRequestTypeOps.createRequestType({
        typeData: type,
        state,
      });
    }
  }
}

export function setup() {
  const ctx = autoSetupPolly();
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      setupPollyRecordingContext(ctx);
    }
  });
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // setup requestType1 - delete if exists
      await stageRequestType(requestType1);
      // setup requestType2 - delete if exists, then create
      await stageRequestType(requestType2, true);
      // setup requestType3 - delete if exists, then create
      await stageRequestType(requestType3, true);
      // setup requestType4 - delete if exists
      await stageRequestType(requestType4);
      // setup requestType5 - delete if exists, then create
      await stageRequestType(requestType5, true);
      // setup requestType6 - delete if exists, then create
      await stageRequestType(requestType6, true);
    }
  });
  // in recording mode, delete test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageRequestType(requestType1);
      await stageRequestType(requestType2);
      await stageRequestType(requestType3);
      await stageRequestType(requestType4);
      await stageRequestType(requestType5);
      await stageRequestType(requestType6);
    }
  });
}
