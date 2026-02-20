import { EventSkeleton } from '../../api/cloud/iga/IgaEventApi';
import {
  RequestFormAssignment,
  RequestFormSkeleton,
} from '../../api/cloud/iga/IgaRequestFormApi';
import { RequestTypeSkeleton } from '../../api/cloud/iga/IgaRequestTypeApi';
import { WorkflowSkeleton } from '../../api/cloud/iga/IgaWorkflowApi';
import { state } from '../../index';
import {
  deleteDraftWorkflow,
  deletePublishedWorkflow,
  updateWorkflow,
} from '../../ops/cloud/iga/IgaWorkflowOps';
import {
  autoSetupPolly,
  setupPollyRecordingContext,
} from '../../utils/AutoSetupPolly';
import { defaultMatchRequestsBy } from '../../utils/PollyUtils';
import {
  stageEmailTemplate,
  template1,
  template2,
  template3,
  template4,
} from './EmailTemplateSetup';
import { getTestEvent, oldEventIds, stageEvent } from './IgaEventSetup';
import { stageRequestForm } from './IgaRequestFormSetup';
import { stageRequestType } from './IgaRequestTypeSetup';

export function getTestWorkflow(
  id: string,
  name: string,
  isPublished: boolean = false
): WorkflowSkeleton {
  return {
    id,
    name,
    displayName: name,
    description: name,
    childType: false,
    _rev: 0,
    steps: [
      {
        name: 'approvalTask-7e33e73d6763',
        displayName: 'Custom Approval Task',
        type: 'approvalTask',
        approvalTask: {
          nextStep: [
            {
              condition: null,
              outcome: 'APPROVE',
              step: 'fulfillmentTask-7fce35a32915',
            },
            {
              condition: null,
              outcome: 'REJECT',
              step: 'violationTask-50261d9bc712',
            },
          ],
          approvalMode: 'any',
          actors: {
            isExpression: true,
            value:
              "/**\nDefine custom script which returns an array of actors in the following format\n(function() {\n    var content = execution.getVariables();\n    var requestId = content.get('id');\n    var requestIndex = openidm.action('iga/governance/requests/' + requestId, 'GET', {}, {});\n    return [{\n        id: \"managed/user/\" + requestIndex.applicationOwner[0].id,\n        permissions: {\n            approve: true,\n            reject: true,\n            reassign: true,\n            modify: true,\n            comment: true\n        }\n    }];\n})()\n**/\n(\nfunction(){\n   return [];\n}\n)()",
          },
          events: {
            assignment: {
              notification: template1._id,
            },
            reassign: {
              notification: template1._id,
            },
            reminder: {
              notification: template1._id,
              frequency: 4,
              date: {
                isExpression: true,
                value:
                  '(new Date(new Date().getTime()+(4*30*24*60*60*1000))).toISOString()',
              },
            },
            escalation: {
              notification: template1._id,
              date: {
                isExpression: true,
                value:
                  '(new Date(new Date().getTime()+(5*24*60*60*1000))).toISOString()',
              },
              actors: [
                {
                  id: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
                },
              ],
              frequency: 5,
            },
            expiration: {
              action: 'reassign',
              notification: template1._id,
              actors: [
                {
                  id: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
                  permissions: {
                    approve: true,
                    reject: true,
                    reassign: true,
                    modify: true,
                    comment: true,
                  },
                },
                {
                  id: 'managed/role/be68f831-a8f3-42da-93df-84bbc66427f6',
                  permissions: {
                    approve: true,
                    reject: true,
                    reassign: true,
                    modify: true,
                    comment: true,
                  },
                },
                {
                  id: {
                    isExpression: true,
                    value:
                      '"managed/user/" + requestIndex.applicationOwner[0].id',
                  },
                  permissions: {
                    approve: true,
                    reject: true,
                    reassign: true,
                    modify: true,
                    comment: true,
                  },
                },
                {
                  id: {
                    isExpression: true,
                    value: '"managed/user/" + requestIndex.manager.id',
                  },
                  permissions: {
                    approve: true,
                    reject: true,
                    reassign: true,
                    modify: true,
                    comment: true,
                  },
                },
                {
                  id: {
                    isExpression: true,
                    value:
                      '"managed/user/" + ((requestIndex.entitlementOwner && requestIndex.entitlementOwner.length > 0) ? requestIndex.entitlementOwner[0].id : requestIndex.applicationOwner[0].id)',
                  },
                  permissions: {
                    approve: true,
                    reject: true,
                    reassign: true,
                    modify: true,
                    comment: true,
                  },
                },
                {
                  id: {
                    isExpression: true,
                    value:
                      '(function() {\n  var systemSettings = openidm.action("iga/commons/config/iga_access_request", "GET", {}, {});\n  var approver = null;\n  if (requestIndex.roleOwner && requestIndex.roleOwner[0]) {\n    approver = "managed/user/" + requestIndex.roleOwner[0].id;\n  } else if (systemSettings && systemSettings.defaultApprover) {\n    approver = systemSettings.defaultApprover;\n  }\n  return approver;\n})()',
                  },
                  permissions: {
                    approve: true,
                    reject: true,
                    reassign: true,
                    modify: true,
                    comment: true,
                  },
                },
              ],
              date: {
                isExpression: true,
                value: 'content.customExpirationDuration',
              },
            },
          },
        },
        approvalMode: 'any',
      },
      {
        name: 'fulfillmentTask-7fce35a32915',
        displayName: 'Custom Fulfillment Task',
        type: 'fulfillmentTask',
        fulfillmentTask: {
          nextStep: [
            {
              condition: null,
              outcome: 'FULFILL',
              step: 'exclusiveGateway-94bc3d35f3b4',
            },
            {
              condition: null,
              outcome: 'DENY',
              step: 'violationTask-50261d9bc712',
            },
          ],
          approvalMode: 'any',
          actors: {
            isExpression: true,
            value:
              "/**\nDefine custom script which returns an array of actors in the following format\n(function() {\n    var content = execution.getVariables();\n    var requestId = content.get('id');\n    var requestIndex = openidm.action('iga/governance/requests/' + requestId, 'GET', {}, {});\n    return [{\n        id: \"managed/user/\" + requestIndex.applicationOwner[0].id,\n        permissions: {\n            approve: true,\n            reject: true,\n            reassign: true,\n            modify: true,\n            comment: true\n        }\n    }];\n})()\n**/\n(\nfunction(){\n   return [];\n}\n)()",
          },
          events: {
            assignment: {
              notification: template2._id,
            },
            reassign: {
              notification: template2._id,
            },
            reminder: {
              notification: template2._id,
              frequency: 2,
              date: {
                isExpression: true,
                value:
                  '(new Date(new Date().getTime()+(2*30*24*60*60*1000))).toISOString()',
              },
            },
            escalation: {
              notification: template2._id,
              date: {
                isExpression: true,
                value:
                  '(new Date(new Date().getTime()+(5*60*60*1000))).toISOString()',
              },
              actors: [
                {
                  id: 'managed/role/be68f831-a8f3-42da-93df-84bbc66427f6',
                },
              ],
              frequency: 5,
            },
            expiration: {
              action: 'reassign',
              notification: template2._id,
              actors: [
                {
                  id: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
                  permissions: {
                    fulfill: true,
                    reassign: true,
                    deny: true,
                    comment: true,
                    modify: true,
                  },
                },
              ],
              date: {
                isExpression: true,
                value:
                  '(new Date(new Date().getTime()+(7*24*60*60*1000))).toISOString()',
              },
            },
          },
        },
      },
      {
        name: 'exclusiveGateway-94bc3d35f3b4',
        displayName: 'Custom Validation Gateway',
        type: 'scriptTask',
        scriptTask: {
          nextStep: [
            {
              condition: '// This is a validation success\noutcome == true',
              outcome: 'validationSuccess',
              step: 'inclusiveGateway-a6cf9605ce55',
            },
            {
              condition: '// This is a validation failure\noutcome == false',
              outcome: 'validationFailure',
              step: 'violationTask-50261d9bc712',
            },
          ],
          language: 'javascript',
          script: 'logger.info("This is exclusive gateway");',
        },
      },
      {
        name: 'inclusiveGateway-a6cf9605ce55',
        displayName: 'Custom Inclusive Gateway',
        type: 'scriptTask',
        scriptTask: {
          nextStep: [
            {
              condition: '// This is outcome 1\noutcome === 1',
              outcome: 'outcomeOne',
              step: 'scriptTask-493f5ea87636',
            },
            {
              condition: '// This is outcome 2\noutcome === 2',
              outcome: 'outcomeTwo',
              step: 'scriptTask-493f5ea87636',
            },
            {
              condition: '// This is outcome 3\noutcome === 3',
              outcome: 'outcomeThree',
              step: 'violationTask-50261d9bc712',
            },
          ],
          language: 'javascript',
          script: 'logger.info("This is inclusive gateway");',
          gatewayType: 'inclusive',
        },
      },
      {
        name: 'scriptTask-493f5ea87636',
        displayName: 'Custom Script Task',
        type: 'scriptTask',
        scriptTask: {
          nextStep: [
            {
              condition: 'true',
              outcome: 'done',
              step: 'emailTask-2068f5d711c8',
            },
          ],
          language: 'javascript',
          script:
            "/*\nScript nodes are used to invoke APIs or execute business logic.\nYou can invoke governance APIs or IDM APIs.\nSee https://backstage.forgerock.com/docs/idcloud/latest/identity-governance/administration/workflow-configure.html for more details.\n\nScript nodes should return a single value and should have the\nlogic enclosed in a try-catch block.\n\nExample:\ntry {\n  var requestObj = openidm.action('iga/governance/requests/' + requestId, 'GET', {}, {});\n  applicationId = requestObj.application.id;\n}\ncatch (e) {\n  failureReason = 'Validation failed: Error reading request with id ' + requestId;\n}\n*/",
        },
      },
      {
        name: 'violationTask-50261d9bc712',
        displayName: 'Custom Violation Task',
        type: 'violationTask',
        violationTask: {
          nextStep: [
            {
              condition: null,
              outcome: 'REMEDIATE',
              step: null,
            },
            {
              condition: null,
              outcome: 'ALLOW',
              step: null,
            },
            {
              condition: null,
              outcome: 'EXPIRATION',
              step: 'approvalTask-7e33e73d6763',
            },
          ],
          approvalMode: 'any',
          actors: {
            isExpression: true,
            value:
              "/**\nDefine custom script which returns an array of actors in the following format\n(function() {\n    var content = execution.getVariables();\n    var requestId = content.get('id');\n    var requestIndex = openidm.action('iga/governance/requests/' + requestId, 'GET', {}, {});\n    return [{\n        id: \"managed/user/\" + requestIndex.applicationOwner[0].id,\n        permissions: {\n            approve: true,\n            reject: true,\n            reassign: true,\n            modify: true,\n            comment: true\n        }\n    }];\n})()\n**/\n(\nfunction(){\n   return [];\n}\n)()",
          },
          events: {
            assignment: {
              notification: template3._id,
            },
            reassign: {
              notification: template3._id,
            },
            reminder: {
              notification: template3._id,
              frequency: 3,
              date: {
                isExpression: true,
                value:
                  '(new Date(new Date().getTime()+(3*60*60*1000))).toISOString()',
              },
            },
            escalation: {
              notification: template3._id,
              date: {
                isExpression: true,
                value:
                  '(new Date(new Date().getTime()+(5*7*24*60*60*1000))).toISOString()',
              },
              actors: [
                {
                  id: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
                },
              ],
              frequency: 5,
            },
            expiration: {
              action: 'reassign',
              notification: template3._id,
              actors: [
                {
                  id: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
                  permissions: {
                    allow: true,
                    exception: true,
                    remediate: true,
                    reassign: true,
                    comment: true,
                  },
                },
              ],
              date: {
                isExpression: true,
                value:
                  '(new Date(new Date().getTime()+(8*30*24*60*60*1000))).toISOString()',
              },
            },
          },
        },
      },
      {
        name: 'emailTask-2068f5d711c8',
        displayName: 'Custom Email Task',
        type: 'emailTask',
        emailTask: {
          nextStep: [
            {
              condition: null,
              outcome: 'SUCCESS',
              step: 'waitTask-b7fc169ca4eb',
            },
            {
              condition: null,
              outcome: 'FAILED',
              step: 'violationTask-50261d9bc712',
            },
          ],
          to: {
            isExpression: true,
            value: '// This is the to script\n"to@email.com";',
          },
          cc: {
            isExpression: true,
            value: '// This is the cc script\n"cc@email.com";',
          },
          bcc: {
            isExpression: true,
            value: '// This is the bcc script\n"bcc@email.com";',
          },
          object: {
            hello: 'goodbye',
            hi: 'hola',
          },
          templateName: template4._id,
        },
      },
      {
        name: 'waitTask-b7fc169ca4eb',
        displayName: 'Custom Wait Task',
        type: 'waitTask',
        waitTask: {
          nextStep: [
            {
              condition: 'true',
              outcome: 'COMPLETE',
              step: 'approvalTask-363e32acf981',
            },
          ],
          resumeDate: {
            isExpression: true,
            value:
              '(new Date(new Date().getTime()+(5*30*24*60*60*1000))).toISOString()',
          },
        },
      },
      {
        name: 'approvalTask-363e32acf981',
        displayName: 'Custom Approval Task 2',
        type: 'approvalTask',
        approvalTask: {
          nextStep: [
            {
              condition: null,
              outcome: 'APPROVE',
              step: 'fulfillmentTask-29a71d4ab8ed',
            },
            {
              condition: null,
              outcome: 'REJECT',
              step: 'violationTask-50261d9bc712',
            },
          ],
          approvalMode: 'any',
          actors: [
            {
              id: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
              permissions: {
                approve: true,
                reject: true,
                reassign: true,
                modify: true,
                comment: true,
              },
            },
            {
              id: 'managed/role/be68f831-a8f3-42da-93df-84bbc66427f6',
              permissions: {
                approve: true,
                reject: true,
                reassign: true,
                modify: true,
                comment: true,
              },
            },
            {
              id: {
                isExpression: true,
                value: '"managed/user/" + requestIndex.applicationOwner[0].id',
              },
              permissions: {
                approve: true,
                reject: true,
                reassign: true,
                modify: true,
                comment: true,
              },
            },
            {
              id: {
                isExpression: true,
                value: '"managed/user/" + requestIndex.manager.id',
              },
              permissions: {
                approve: true,
                reject: true,
                reassign: true,
                modify: true,
                comment: true,
              },
            },
            {
              id: {
                isExpression: true,
                value:
                  '"managed/user/" + ((requestIndex.entitlementOwner && requestIndex.entitlementOwner.length > 0) ? requestIndex.entitlementOwner[0].id : requestIndex.applicationOwner[0].id)',
              },
              permissions: {
                approve: true,
                reject: true,
                reassign: true,
                modify: true,
                comment: true,
              },
            },
            {
              id: {
                isExpression: true,
                value:
                  '(function() {\n  var systemSettings = openidm.action("iga/commons/config/iga_access_request", "GET", {}, {});\n  var approver = null;\n  if (requestIndex.roleOwner && requestIndex.roleOwner[0]) {\n    approver = "managed/user/" + requestIndex.roleOwner[0].id;\n  } else if (systemSettings && systemSettings.defaultApprover) {\n    approver = systemSettings.defaultApprover;\n  }\n  return approver;\n})()',
              },
              permissions: {
                approve: true,
                reject: true,
                reassign: true,
                modify: true,
                comment: true,
              },
            },
          ],
          events: {
            expiration: {
              date: {
                value:
                  '(new Date(new Date().getTime()+(7*24*60*60*1000))).toISOString()',
              },
            },
          },
        },
        approvalMode: 'any',
      },
      {
        name: 'fulfillmentTask-29a71d4ab8ed',
        displayName: 'Custom Fulfillment Task 2',
        type: 'fulfillmentTask',
        fulfillmentTask: {
          nextStep: [
            {
              condition: null,
              outcome: 'FULFILL',
              step: 'emailTask-881f2975e240',
            },
            {
              condition: null,
              outcome: 'DENY',
              step: 'violationTask-50261d9bc712',
            },
          ],
          approvalMode: 'any',
          actors: [
            {
              id: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
              permissions: {
                fulfill: true,
                reassign: true,
                deny: true,
                comment: true,
                modify: true,
              },
            },
          ],
          events: {
            expiration: {
              date: {
                value: 'content.customExpirationDate',
              },
            },
          },
        },
      },
      {
        name: 'emailTask-881f2975e240',
        displayName: 'Custom Email Task 2',
        type: 'emailTask',
        emailTask: {
          nextStep: [
            {
              condition: null,
              outcome: 'SUCCESS',
              step: 'waitTask-72d593301121',
            },
            {
              condition: null,
              outcome: 'FAILED',
              step: 'violationTask-50261d9bc712',
            },
          ],
          to: 'to@email.com',
          cc: 'cc@email.com',
          bcc: 'bcc@email.com',
          object: {},
          templateName: template4._id,
        },
      },
      {
        name: 'waitTask-72d593301121',
        displayName: 'Custom Wait Task 2',
        type: 'waitTask',
        waitTask: {
          nextStep: [
            {
              condition: 'true',
              outcome: 'COMPLETE',
              step: 'waitTask-b343cc7df7c9',
            },
          ],
          resumeDate: {
            isExpression: true,
            value: 'requestIndex.request.common.startDate',
          },
        },
      },
      {
        name: 'waitTask-b343cc7df7c9',
        displayName: 'Custom Wait Task 3',
        type: 'waitTask',
        waitTask: {
          nextStep: [
            {
              condition: 'true',
              outcome: 'COMPLETE',
              step: 'violationTask-f8066518b46a',
            },
          ],
          resumeDate: {
            isExpression: true,
            value: "content.get('resumeDate')",
          },
        },
      },
      {
        name: 'violationTask-f8066518b46a',
        displayName: 'Custom Violation Task 2',
        type: 'violationTask',
        violationTask: {
          nextStep: [
            {
              condition: null,
              outcome: 'REMEDIATE',
              step: null,
            },
            {
              condition: null,
              outcome: 'ALLOW',
              step: null,
            },
            {
              condition: null,
              outcome: 'EXPIRATION',
              step: 'approvalTask-7e33e73d6763',
            },
          ],
          approvalMode: 'any',
          actors: [
            {
              id: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
              permissions: {
                allow: true,
                exception: true,
                remediate: true,
                reassign: true,
                comment: true,
              },
            },
          ],
          events: {},
        },
      },
    ],
    staticNodes: {
      endNode: {
        x: 826,
        y: 50,
        id: 'endNode',
        name: 'End',
        nodeType: 'SingleInput',
        displayType: 'SingleInput',
        isDroppable: false,
        isDeleteable: false,
        isEditable: false,
        isHovered: false,
        hasError: false,
        displayDetails: {
          icon: 'checkmark',
          variant: 'success',
          value: 'Success',
        },
        _outcomes: [],
        template: null,
        schema: null,
        connections: {},
      },
      startNode: {
        x: 20,
        y: 42,
        id: 'startNode',
        name: 'Start',
        nodeType: 'IconOutcomeNode',
        displayType: 'IconOutcomeNode',
        isDroppable: false,
        isDeleteable: false,
        isEditable: false,
        isHovered: false,
        hasError: false,
        displayDetails: {
          icon: 'play_arrow',
          variant: 'info',
          value: 'Start',
        },
        _outcomes: [
          {
            id: 'start',
            displayName: 'start',
          },
        ],
        template: null,
        schema: null,
        connections: {
          start: 'approvalTask-7e33e73d6763',
        },
      },
      uiConfig: {
        'approvalTask-7e33e73d6763': {
          x: 146.39999389648438,
          y: 15.61250305175781,
          actors: {
            isExpression: true,
            value:
              "/**\nDefine custom script which returns an array of actors in the following format\n(function() {\n    var content = execution.getVariables();\n    var requestId = content.get('id');\n    var requestIndex = openidm.action('iga/governance/requests/' + requestId, 'GET', {}, {});\n    return [{\n        id: \"managed/user/\" + requestIndex.applicationOwner[0].id,\n        permissions: {\n            approve: true,\n            reject: true,\n            reassign: true,\n            modify: true,\n            comment: true\n        }\n    }];\n})()\n**/\n(\nfunction(){\n   return [];\n}\n)()",
          },
          events: {
            escalationDate: 5,
            escalationTimeSpan: 'day(s)',
            escalationType: 'applicationOwner',
            expirationDate: 7,
            expirationTimeSpan: 'hour(s)',
            reminderDate: 4,
            reminderTimeSpan: 'month(s)',
            expirationDateType: 'variable',
            expirationDateVariable: 'customExpirationDuration',
            reassignedActors: [
              {
                id: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
                permissions: {
                  approve: true,
                  reject: true,
                  reassign: true,
                  modify: true,
                  comment: true,
                },
              },
              {
                id: 'managed/role/be68f831-a8f3-42da-93df-84bbc66427f6',
                permissions: {
                  approve: true,
                  reject: true,
                  reassign: true,
                  modify: true,
                  comment: true,
                },
              },
              {
                id: {
                  isExpression: true,
                  value:
                    '"managed/user/" + requestIndex.applicationOwner[0].id',
                },
                permissions: {
                  approve: true,
                  reject: true,
                  reassign: true,
                  modify: true,
                  comment: true,
                },
              },
              {
                id: {
                  isExpression: true,
                  value: '"managed/user/" + requestIndex.manager.id',
                },
                permissions: {
                  approve: true,
                  reject: true,
                  reassign: true,
                  modify: true,
                  comment: true,
                },
              },
              {
                id: {
                  isExpression: true,
                  value:
                    '"managed/user/" + ((requestIndex.entitlementOwner && requestIndex.entitlementOwner.length > 0) ? requestIndex.entitlementOwner[0].id : requestIndex.applicationOwner[0].id)',
                },
                permissions: {
                  approve: true,
                  reject: true,
                  reassign: true,
                  modify: true,
                  comment: true,
                },
              },
              {
                id: {
                  isExpression: true,
                  value:
                    '(function() {\n  var systemSettings = openidm.action("iga/commons/config/iga_access_request", "GET", {}, {});\n  var approver = null;\n  if (requestIndex.roleOwner && requestIndex.roleOwner[0]) {\n    approver = "managed/user/" + requestIndex.roleOwner[0].id;\n  } else if (systemSettings && systemSettings.defaultApprover) {\n    approver = systemSettings.defaultApprover;\n  }\n  return approver;\n})()',
                },
                permissions: {
                  approve: true,
                  reject: true,
                  reassign: true,
                  modify: true,
                  comment: true,
                },
              },
            ],
          },
        },
        'fulfillmentTask-7fce35a32915': {
          x: 145.39999389648438,
          y: 146.6125030517578,
          actors: {
            isExpression: true,
            value:
              "/**\nDefine custom script which returns an array of actors in the following format\n(function() {\n    var content = execution.getVariables();\n    var requestId = content.get('id');\n    var requestIndex = openidm.action('iga/governance/requests/' + requestId, 'GET', {}, {});\n    return [{\n        id: \"managed/user/\" + requestIndex.applicationOwner[0].id,\n        permissions: {\n            approve: true,\n            reject: true,\n            reassign: true,\n            modify: true,\n            comment: true\n        }\n    }];\n})()\n**/\n(\nfunction(){\n   return [];\n}\n)()",
          },
          events: {
            escalationDate: 5,
            escalationTimeSpan: 'hour(s)',
            escalationType: 'applicationOwner',
            expirationDate: 8,
            expirationTimeSpan: 'month(s)',
            reminderDate: 2,
            reminderTimeSpan: 'month(s)',
            expirationDateType: 'duration',
            expirationDateVariable: '',
            reassignedActors: [
              {
                id: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
                permissions: {
                  fulfill: true,
                  reassign: true,
                  deny: true,
                  comment: true,
                  modify: true,
                },
              },
            ],
          },
        },
        'exclusiveGateway-94bc3d35f3b4': {
          x: 145.39999389648438,
          y: 274.6125030517578,
        },
        'inclusiveGateway-a6cf9605ce55': {
          x: 147.39999389648438,
          y: 405.6125030517578,
        },
        'scriptTask-493f5ea87636': {
          x: 148.39999389648438,
          y: 570.6125030517578,
        },
        'violationTask-50261d9bc712': {
          x: 480.3999938964844,
          y: 13.61250305175781,
          actors: {
            isExpression: true,
            value:
              "/**\nDefine custom script which returns an array of actors in the following format\n(function() {\n    var content = execution.getVariables();\n    var requestId = content.get('id');\n    var requestIndex = openidm.action('iga/governance/requests/' + requestId, 'GET', {}, {});\n    return [{\n        id: \"managed/user/\" + requestIndex.applicationOwner[0].id,\n        permissions: {\n            approve: true,\n            reject: true,\n            reassign: true,\n            modify: true,\n            comment: true\n        }\n    }];\n})()\n**/\n(\nfunction(){\n   return [];\n}\n)()",
          },
          events: {
            escalationDate: 5,
            escalationTimeSpan: 'week(s)',
            escalationType: 'applicationOwner',
            expirationDate: 8,
            expirationTimeSpan: 'month(s)',
            reminderDate: 3,
            reminderTimeSpan: 'hour(s)',
            expirationDateType: 'duration',
            expirationDateVariable: '',
            reassignedActors: [
              {
                id: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
                permissions: {
                  allow: true,
                  exception: true,
                  remediate: true,
                  reassign: true,
                  comment: true,
                },
              },
            ],
          },
        },
        'emailTask-2068f5d711c8': {
          x: 150.39999389648438,
          y: 648.812502861023,
        },
        'waitTask-b7fc169ca4eb': {
          x: 148.39999389648438,
          y: 779.812502861023,
          events: {
            resumeDateType: 'duration',
            resumeDateNumber: 5,
            resumeDateTimeSpan: 'month(s)',
          },
        },
        'approvalTask-363e32acf981': {
          x: 478.3999938964844,
          y: 195.6125030517578,
          actors: [
            {
              id: {
                isExpression: false,
                value: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
              },
              type: 'user',
            },
            {
              id: {
                isExpression: false,
                value: 'managed/role/be68f831-a8f3-42da-93df-84bbc66427f6',
              },
              type: 'role',
            },
            {
              id: {
                isExpression: true,
                value: '"managed/user/" + requestIndex.applicationOwner[0].id',
              },
              type: 'applicationOwner',
            },
            {
              id: {
                isExpression: true,
                value: '"managed/user/" + requestIndex.manager.id',
              },
              type: 'manager',
            },
            {
              id: {
                isExpression: true,
                value:
                  '"managed/user/" + ((requestIndex.entitlementOwner && requestIndex.entitlementOwner.length > 0) ? requestIndex.entitlementOwner[0].id : requestIndex.applicationOwner[0].id)',
              },
              type: 'entitlementOwner',
            },
            {
              id: {
                isExpression: true,
                value:
                  '(function() {\n  var systemSettings = openidm.action("iga/commons/config/iga_access_request", "GET", {}, {});\n  var approver = null;\n  if (requestIndex.roleOwner && requestIndex.roleOwner[0]) {\n    approver = "managed/user/" + requestIndex.roleOwner[0].id;\n  } else if (systemSettings && systemSettings.defaultApprover) {\n    approver = systemSettings.defaultApprover;\n  }\n  return approver;\n})()',
              },
              type: 'roleOwner',
            },
          ],
          events: {
            escalationType: 'applicationOwner',
            expirationDateType: 'duration',
            expirationDateVariable: '',
            reassignedActors: [],
            reminderDate: 1,
            escalationDate: 1,
            expirationDate: 7,
            expirationTimeSpan: 'day(s)',
          },
        },
        'fulfillmentTask-29a71d4ab8ed': {
          x: 479.3999938964844,
          y: 334.41250228881836,
          actors: [
            {
              id: {
                isExpression: false,
                value: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
              },
              type: 'user',
            },
          ],
          events: {
            escalationType: 'applicationOwner',
            expirationDateType: 'variable',
            expirationDateVariable: 'customExpirationDate',
            reassignedActors: [],
            reminderDate: 1,
            escalationDate: 1,
            expirationDate: 7,
            expirationTimeSpan: 'day(s)',
          },
        },
        'emailTask-881f2975e240': {
          x: 478.3999938964844,
          y: 474.41250228881836,
        },
        'waitTask-72d593301121': {
          x: 476.3999938964844,
          y: 612.4125022888184,
          events: {
            resumeDateType: 'requestProp',
            resumeDateNumber: 1,
            resumeDateTimeSpan: 'day(s)',
            resumeDateRequestProperty: 'request.common.startDate',
          },
        },
        'waitTask-b343cc7df7c9': {
          x: 476.3999938964844,
          y: 694.4125022888184,
          events: {
            resumeDateType: 'variable',
            resumeDateNumber: 1,
            resumeDateTimeSpan: 'day(s)',
            resumeDateVariable: 'resumeDate',
          },
        },
        'violationTask-f8066518b46a': {
          x: 788.3999938964844,
          y: 613.4125022888184,
          actors: [
            {
              id: {
                isExpression: false,
                value: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
              },
              type: 'user',
            },
          ],
          events: {
            escalationType: 'applicationOwner',
            expirationDateType: 'variable',
            expirationDateVariable: 'taskExpirationDate',
            reassignedActors: [],
          },
        },
      },
    },
    status: isPublished ? 'published' : 'draft',
    mutable: true,
  };
}

export const workflow1: WorkflowSkeleton = getTestWorkflow(
  'testWorkflow1',
  'test_workflow_1',
  false
);

export const workflow2: WorkflowSkeleton = getTestWorkflow(
  'testWorkflow1',
  'test_workflow_1',
  true
);

export const workflow3: WorkflowSkeleton = getTestWorkflow(
  'testWorkflow2',
  'test_workflow_2',
  false
);

export const workflow4: WorkflowSkeleton = getTestWorkflow(
  'testWorkflow3',
  'test_workflow_3',
  true
);

export const workflow5: WorkflowSkeleton = getTestWorkflow(
  'testWorkflow4',
  'test_workflow_4',
  false
);

export const workflow6: WorkflowSkeleton = getTestWorkflow(
  'testWorkflow4',
  'test_workflow_4',
  true
);

export const workflow7: WorkflowSkeleton = getTestWorkflow(
  'testWorkflow5',
  'test_workflow_5',
  false
);

export const workflow8: WorkflowSkeleton = getTestWorkflow(
  'testWorkflow6',
  'test_workflow_6',
  true
);

export const workflowEvent1: EventSkeleton = getTestEvent({
  id: 'cd753d57-edf4-4f92-aad7-41242253ed9f',
  name: 'test_workflow_event_1',
  type: 'orchestration',
  workflowId: workflow1.id,
});

export const workflowEvent2: EventSkeleton = getTestEvent({
  id: '77289308-a995-4282-b29b-1bb2f2a774a4',
  name: 'test_workflow_event_2',
  type: 'orchestration',
  workflowId: workflow3.id,
});

export const workflowEvent3: EventSkeleton = getTestEvent({
  id: '1184fba3-8c94-4cf5-a5cc-396c8205c2bb',
  name: 'test_workflow_event_3',
  type: 'orchestration',
  workflowId: workflow6.id,
});

export const workflowRequestType1: RequestTypeSkeleton = {
  id: 'e9dcd66e-1388-4872-9790-66df2f44deef',
  displayName: 'test_workflow_request_type_1',
  workflow: {
    id: workflow1.id,
  },
};

export const workflowRequestType2: RequestTypeSkeleton = {
  id: 'e77b5ad2-50c8-4f8f-9aea-e565d667d058',
  displayName: 'test_workflow_request_type_2',
  workflow: {
    id: workflow3.id,
  },
};

export const workflowRequestType3: RequestTypeSkeleton = {
  id: '97dc909a-55f1-41df-8840-d6c774ca6dac',
  displayName: 'test_workflow_request_type_3',
  workflow: {
    id: workflow4.id,
  },
};

export const workflowRequestType4: RequestTypeSkeleton = {
  id: '3eb082e7-68f2-409f-9423-26e771259dc8',
  displayName: 'test_workflow_request_type_4',
  workflow: {
    id: workflow6.id,
  },
};

export const workflowRequestType5: RequestTypeSkeleton = {
  id: 'af4a6f84-f9a9-4f8d-82ae-649639debabc',
  displayName: 'test_workflow_request_type_5',
  workflow: {},
};

const formId1 = 'fa1a5e72-d803-4879-bc2a-07a5da3d8ee9';

const workflowAssignment1: RequestFormAssignment = {
  formId: formId1,
  objectId: `workflow/${workflow1.id}/node/approvalTask-7e33e73d6763`,
};

const workflowAssignment2: RequestFormAssignment = {
  formId: formId1,
  objectId: `workflow/${workflow3.id}/node/approvalTask-7e33e73d6763`,
};

const workflowAssignment3: RequestFormAssignment = {
  formId: formId1,
  objectId: `workflow/${workflow4.id}/node/approvalTask-7e33e73d6763`,
};

const workflowAssignment4: RequestFormAssignment = {
  formId: formId1,
  objectId: `workflow/${workflow6.id}/node/approvalTask-7e33e73d6763`,
};

export const workflowRequestForm1: RequestFormSkeleton = {
  id: formId1,
  name: 'test_workflow_request_form_1',
  type: 'applicationRequest',
  description: 'This is a test application request form',
  categories: {
    applicationType: null,
    objectType: 'Group',
    operation: 'create',
  },
  form: {},
  assignments: [
    workflowAssignment1,
    workflowAssignment2,
    workflowAssignment3,
    workflowAssignment4,
  ],
};

const formId2 = '9e3fc668-4e96-4b03-9605-38b830bea26c';

const workflowAssignment5: RequestFormAssignment = {
  formId: formId2,
  objectId: `workflow/${workflow2.id}/node/fulfillmentTask-7fce35a32915`,
};

const workflowAssignment6: RequestFormAssignment = {
  formId: formId2,
  objectId: `workflow/${workflow3.id}/node/fulfillmentTask-7fce35a32915`,
};

export const workflowRequestForm2: RequestFormSkeleton = {
  id: formId2,
  name: 'test_workflow_request_form_2',
  type: 'request',
  description: 'This is a test request form',
  categories: {
    applicationType: null,
    objectType: null,
    operation: 'create',
  },
  form: {},
  assignments: [
    {
      formId: formId2,
      objectId: 'requestType/' + workflowRequestType5.id,
    },
    workflowAssignment5,
    workflowAssignment6,
  ],
};

const allEvents = [workflowEvent1, workflowEvent2, workflowEvent3];

export async function stageWorkflow(
  workflow: WorkflowSkeleton,
  createNew = false,
  deleteAll = false
) {
  if (deleteAll) {
    // We want to attempt to delete the opposite one if "deleteAll" is true
    try {
      await (
        workflow.status === 'draft'
          ? deletePublishedWorkflow
          : deleteDraftWorkflow
      )({
        workflowId: workflow.id,
        state,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // ignore
    }
  }
  try {
    await (
      workflow.status === 'published'
        ? deletePublishedWorkflow
        : deleteDraftWorkflow
    )({
      workflowId: workflow.id,
      state,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  } finally {
    if (createNew) {
      await updateWorkflow({
        workflowId: workflow.id,
        workflowData: workflow,
        state,
      });
    }
  }
}

export function setup() {
  // We need order to be true for workflows because on import all we need to read all workflows twice, once before import, once after, so order is important
  const ctx = autoSetupPolly({ ...defaultMatchRequestsBy(), order: true });

  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      setupPollyRecordingContext(ctx, [
        {
          pathToObj: [],
          identifier: 'id',
          testObjs: allEvents,
          oldObjIds: oldEventIds,
          namesWhereMultipleRequestsMade: [],
        },
      ]);
    }
  });

  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageEmailTemplate(template1, true);
      await stageEmailTemplate(template2, true);
      await stageEmailTemplate(template3, true);
      await stageEmailTemplate(template4, true);
      // Published workflows must be created first, otherwise it ends up deleting the draft one
      await stageWorkflow(workflow2, true);
      await stageWorkflow(workflow1, true);
      await stageWorkflow(workflow3);
      await stageWorkflow(workflow4);
      // Published workflows must be created first, otherwise it ends up deleting the draft one
      await stageWorkflow(workflow6, true);
      await stageWorkflow(workflow5, true);
      await stageWorkflow(workflow7, true, true);
      await stageWorkflow(workflow8, true);
      await stageRequestType(workflowRequestType5, true);
      await stageRequestForm(workflowRequestForm1, true);
      await stageRequestForm(workflowRequestForm2, true);
      await stageEvent(workflowEvent1, true);
      await stageEvent(workflowEvent2);
      await stageEvent(workflowEvent3, true);
      await stageRequestType(workflowRequestType1, true);
      await stageRequestType(workflowRequestType2);
      await stageRequestType(workflowRequestType3);
      await stageRequestType(workflowRequestType4, true);
    }
  });

  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageRequestType(workflowRequestType1);
      await stageRequestType(workflowRequestType2);
      await stageRequestType(workflowRequestType3);
      await stageRequestType(workflowRequestType4);
      await stageEvent(workflowEvent1);
      await stageEvent(workflowEvent2);
      await stageEvent(workflowEvent3);
      await stageRequestForm(workflowRequestForm1);
      await stageRequestForm(workflowRequestForm2);
      await stageRequestType(workflowRequestType5);
      await stageWorkflow(workflow1);
      await stageWorkflow(workflow2);
      await stageWorkflow(workflow3);
      await stageWorkflow(workflow4);
      await stageWorkflow(workflow5);
      await stageWorkflow(workflow6);
      await stageWorkflow(workflow7, false, true);
      await stageWorkflow(workflow8);
      await stageEmailTemplate(template1);
      await stageEmailTemplate(template2);
      await stageEmailTemplate(template3);
      await stageEmailTemplate(template4);
    }
  });
}
