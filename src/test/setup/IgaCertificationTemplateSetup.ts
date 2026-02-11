import {
  CertificationTemplateSkeleton,
  CertificationTemplateType,
} from '../../api/cloud/iga/IgaCertificationTemplateApi';
import { state } from '../../index';
import * as IgaCertificationTemplateOps from '../../ops/cloud/iga/IgaCertificationTemplateOps';
import { EMAIL_TEMPLATE_TYPE } from '../../ops/EmailTemplateOps';
import {
  autoSetupPolly,
  setupPollyRecordingContext,
} from '../../utils/AutoSetupPolly';
import { stageEmailTemplate, template1 } from './EmailTemplateSetup';

export function getTestCertificationTemplate(
  id: string,
  name: string,
  type: CertificationTemplateType,
  emailTemplate: string = '',
  isEvent: boolean = false
): CertificationTemplateSkeleton {
  const template: CertificationTemplateSkeleton = {
    status: isEvent ? 'active' : 'pending',
    name,
    description: 'Test certification template description',
    isEventBased: false,
    stagingEnabled: false,
    skipInactiveCertifiers: false,
    allowSelfCertification: true,
    selfCertificationRule: 'restricted',
    enableForward: true,
    enableReassign: true,
    reassignPermissions: {
      certify: true,
      comment: true,
      claim: true,
      delegate: true,
      exception: true,
      forward: true,
      reassign: true,
      reset: true,
      revoke: true,
      save: true,
      signoff: true,
    },
    exceptionDuration: 730,
    allowBulkCertify: true,
    allowPartialSignoff: true,
    remediationRule: 'BasicRevocation',
    initializeRule: '',
    finalizeRule: '',
    certificationType: type,
    ownerId: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
    stageDuration: 1095,
    expirationAction: 'reassign',
    expirationActionDelay: 0,
    expirationReassignee: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
    stages: [
      {
        certifierType: 'user',
        certifierId: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
        certifierScript: null,
        certifierPath: null,
        certifierInfo: {
          givenName: 'Preston',
          id: '0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
          mail: 'test@test.com',
          sn: 'Test',
          userName: 'PrestonIGATestUser',
        },
      },
    ],
    defaultCertifierId: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
    assignmentNotification: emailTemplate || null,
    assignmentNotificationIncludeManager: false,
    reassignNotification: emailTemplate || null,
    expirationNotification: emailTemplate || null,
    reminderNotification: emailTemplate || null,
    reminderFrequency: 1095,
    escalationNotification: emailTemplate || null,
    escalationFrequency: 1095,
    escalationOwner: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
    remediationDelay: 1825,
    targetFilter: {
      type: [],
      user: {
        operator: 'EQUALS',
        operand: {
          targetName: 'id',
          targetValue: '{{IGA_PARAM_userId_IGA_PARAM}}',
        },
      },
      application: {
        operator: 'OR',
        operand: [],
      },
      account: {
        operator: 'ALL',
        operand: [],
      },
      memberOfOrg: [],
      entitlement: {
        operator: 'AND',
        operand: [
          {
            operator: 'CONTAINS',
            operand: {
              targetName: 'glossary.description',
              targetValue: 'a',
            },
          },
          {
            operator: 'EQUALS',
            operand: {
              targetName: 'glossary.entitlementType',
              targetValue: 'b',
            },
          },
          {
            operator: 'OR',
            operand: [
              {
                operator: 'STARTS_WITH',
                operand: {
                  targetName: 'displayName',
                  targetValue: 'c',
                },
              },
              {
                operator: 'OR',
                operand: [
                  {
                    operator: 'ENDS_WITH',
                    operand: {
                      targetName: 'glossary.parentEntitlement',
                      targetValue: 'd',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      role: {
        operator: 'OR',
        operand: [
          {
            operator: 'EXISTS',
            operand: {
              targetName: 'glossary.Test User',
              targetValue: 'managed/user/645363b3-7cbb-47a3-bf93-d96c59c387d9',
            },
          },
          {
            operator: 'EQUALS',
            operand: {
              targetName: 'glossary.Test User',
              targetValue: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
            },
          },
          {
            operator: 'NOT',
            operand: [
              {
                operator: 'EQUALS',
                operand: {
                  targetName: 'glossary.Test User',
                  targetValue:
                    'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
                },
              },
            ],
          },
          {
            operator: 'AND',
            operand: [
              {
                operator: 'EQUALS',
                operand: {
                  targetName: 'glossary.Test Boolean',
                  targetValue: true,
                },
              },
              {
                operator: 'EQUALS',
                operand: {
                  targetName: 'glossary.Test Boolean',
                  targetValue: 'False',
                },
              },
            ],
          },
          {
            operator: 'OR',
            operand: [
              {
                operator: 'GTE',
                operand: {
                  targetName: 'glossary.Test Integer',
                  targetValue: 1,
                },
              },
              {
                operator: 'GT',
                operand: {
                  targetName: 'glossary.Test Integer',
                  targetValue: 2,
                },
              },
              {
                operator: 'LTE',
                operand: {
                  targetName: 'glossary.Test Integer',
                  targetValue: 3,
                },
              },
              {
                operator: 'LT',
                operand: {
                  targetName: 'glossary.Test Integer',
                  targetValue: 4,
                },
              },
            ],
          },
          {
            operator: 'OR',
            operand: [
              {
                operator: 'EQUALS',
                operand: {
                  targetName: 'glossary.Test Organization',
                  targetValue:
                    'managed/organization/ddebad91-eb40-4ae0-8bc0-4578c07098a5',
                },
              },
            ],
          },
          {
            operator: 'OR',
            operand: [
              {
                operator: 'CONTAINS',
                operand: {
                  targetName: 'glossary.Test String',
                  targetValue: 'a',
                },
              },
              {
                operator: 'EQUALS',
                operand: {
                  targetName: 'glossary.Test String',
                  targetValue: 'b',
                },
              },
              {
                operator: 'STARTS_WITH',
                operand: {
                  targetName: 'glossary.Test String',
                  targetValue: 'c',
                },
              },
              {
                operator: 'ENDS_WITH',
                operand: {
                  targetName: 'glossary.Test String',
                  targetValue: 'd',
                },
              },
            ],
          },
          {
            operator: 'OR',
            operand: [
              {
                operator: 'EQUALS',
                operand: {
                  targetName: 'glossary.Test Role',
                  targetValue:
                    'managed/role/be68f831-a8f3-42da-93df-84bbc66427f6',
                },
              },
            ],
          },
          {
            operator: 'OR',
            operand: [
              {
                operator: 'EQUALS',
                operand: {
                  targetName: 'glossary.Test Date',
                  targetValue: '2026-02-12',
                },
              },
            ],
          },
        ],
      },
      decision: {
        operator: 'AND',
        operand: [
          {
            operator: 'CONTAINS',
            operand: {
              targetName: 'campaignId',
              targetValue: 'a',
            },
          },
          {
            operator: 'EQUALS',
            operand: {
              targetName: 'status',
              targetValue: 'b',
            },
          },
          {
            operator: 'OR',
            operand: [
              {
                operator: 'STARTS_WITH',
                operand: {
                  targetName: 'decision',
                  targetValue: 'c',
                },
              },
              {
                operator: 'EXISTS',
                operand: {
                  targetName: 'completionDate',
                  targetValue: '',
                },
              },
            ],
          },
        ],
      },
    },
    excludeConditionalAccess: true,
    excludeRoleBasedAccess: true,
    expirationNotificationDay: 30,
    requireJustification: {
      revoke: true,
      exceptionAllowed: true,
    },
    uiConfig: {
      columnConfig: {
        accounts: [
          'user.user',
          'application.application',
          'review.flags',
          'review.comments',
          'account.displayName',
          'account.account',
          'application.description',
          'user.city',
        ],
        entitlements: [
          'user.user',
          'application.application',
          'entitlement.entitlement',
          'account.account',
          'review.flags',
          'review.comments',
          'user.city',
          'user.cn',
          'application.glossary.sensitive',
          'account.displayName',
          'entitlement.displayName',
        ],
        roles: [
          'role.role',
          'user.user',
          'review.flags',
          'review.comments',
          'user.city',
          'role.glossary.Test Integer',
        ],
      },
    },
    events: {
      ...(emailTemplate && {
        assignment: {
          notification: emailTemplate,
        },
        reassign: {
          notification: emailTemplate,
        },
        reminder: {
          notification: emailTemplate,
          frequency: 1095,
          includeActor: true,
          includeManager: false,
        },
        escalation: {
          notification: emailTemplate,
          frequency: 1095,
          actors: [
            {
              type: 'user',
              id: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
            },
          ],
          action: 'notification',
        },
        expirationNotification: {
          notification: emailTemplate,
          day: 30,
          includeActor: true,
          includeManager: false,
        },
      }),
    },
    ownerInfo: {
      givenName: 'Preston',
      id: '0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
      mail: 'test@test.com',
      sn: 'Test',
      userName: 'PrestonIGATestUser',
    },
    defaultCertifierInfo: {
      givenName: 'Preston',
      id: '0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
      mail: 'test@test.com',
      sn: 'Test',
      userName: 'PrestonIGATestUser',
    },
    expirationReassigneeInfo: {
      givenName: 'Preston',
      id: '0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
      mail: 'test@test.com',
      sn: 'Test',
      userName: 'PrestonIGATestUser',
    },
    escalationOwnerInfo: {
      givenName: 'Preston',
      id: '0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
      mail: 'test@test.com',
      sn: 'Test',
      userName: 'PrestonIGATestUser',
    },
    id,
    ...(!isEvent && {
      schedule: {
        _id: 'templateSchedule' + id.replaceAll('-', ''),
        enabled: true,
        persisted: true,
        recoverable: false,
        misfirePolicy: 'fireAndProceed',
        schedule: null,
        repeatInterval: 946080000000,
        repeatCount: -1,
        type: 'simple',
        invokeService: 'org.forgerock.openidm.script',
        invokeContext: {
          script: {
            globals: {
              scanType: 'scheduledCertification',
              templateId: id,
            },
            type: 'text/javascript',
            source:
              "/**\n * Script to be placed in IDM script directory to handle the generation of an authorization header\n * for the scheduler and running of IDM calls to the IGA API.\n *\n *\n * IDM Scheduler allows for the passage in of variables inside of the globals object of the script definition.\n * These variables are not declared within this script, but can be referenced anyway.  They are as follows:\n *\n * scanType (required) - The type of IGA scan being run\n * reconApplication -    For type 'recon' only, the application information to run a recon for\n * additionalMappings -  For type 'recon' only, the application recon accepts additional mappings to the /reconcileAll endpoint\n * incremental -         For type 'recon' only, the application recon can be run full (default) or incremental\n * templateId -          For type 'scheduledCertification' only, the ID of the template that will be used to generate the certification\n * policyId -            For type 'scheduledPolicyScan' only, the ID of the policy that will be scanned\n */\n\nrun();\n\nfunction run() {\n\n    if (!scanType) {\n        logger.warn(\"IGA: Global script variable 'scanType' is not defined.\");\n        return;\n    }\n    else {\n        logger.debug(\"IGA: Script execution of scan type \" + scanType);\n    }\n\n\n    // Get path of IGA API call\n    var path = getApiPath(scanType);\n    if (!path) {\n        logger.warn(\"IGA: No path defined for scanType: \" + scanType);\n        return;\n    }\n\n    // Check contents of certain scans and make any adjustments\n    if (scanType === 'recon') {\n        let application = null;\n\n        try {\n            // Safety check on variable presence\n            application = reconApplication;\n        }\n        catch (e) {\n            logger.warn(\"IGA: Required application not provided for scanType: \" + scanType);\n            return;\n        }\n        path = path + '/' + application.id + '/reconcileAll';\n\n        var isIncremental = false;\n        try {\n            isIncremental = incremental && incremental === true;\n        }\n        catch (e) {\n            // If not provided treat as not-incremental\n        }\n\n        if (isIncremental) {\n            path += '?incremental=true';\n        }\n    }\n\n    // Get authorization header to allow call to be made from IDM\n    var date = new Date().toUTCString();\n    var header = getAuthorizationHeaderForSchedule(date);\n    if (!header) {\n        logger.warn(\"IGA: Could not generate authorization header.\");\n        return;\n    }\n\n    // Get request body and make call\n    var body = getRequestBody(scanType)\n    makeExternalCall(path, body, date, header)\n}\n\nfunction makeExternalCall(path, body, date, authorizationHeader) {\n    logger.debug(\"IGA: Calling endpoint \" + path);\n    logger.debug(\"IGA: Sending payload \" + JSON.stringify(body));\n    var params = {\n        url: 'http://iga-api.fr-auto.svc.cluster.local:3005/' + path,\n        method: 'POST',\n        headers : {\n        Date : date,\n        Authorization : authorizationHeader\n        },\n        contentType: 'application/json',\n        body: JSON.stringify(body),\n      }\n\n    var result = openidm.action(\"external/rest\", \"call\", params);\n    logger.debug(\"IGA: Result of endpoint \" + path + \": \" + JSON.stringify(result));\n    return result;\n}\n\nfunction getApiPath(type) {\n    switch(type) {\n    case 'creation':\n        return 'iga/governance/certification/scan/creation';\n    case 'refresh':\n        return 'iga/governance/refreshAllItems';\n    case 'recon':\n        return 'iga/governance/applications';\n    case 'decisionExpiration':\n        return 'iga/governance/certification/items/scan/expiration';\n    case 'decisionRemediation':\n        return 'iga/governance/certification/items/scan/remediation';\n    case 'escalationNotification':\n        return 'iga/governance/certification/scan/escalationNotification';\n    case 'expirationNotification':\n        return 'iga/governance/certification/scan/expirationNotification';\n    case 'reminderNotification':\n        return 'iga/governance/certification/scan/reminderNotification';\n    case 'scheduledCertification':\n        return 'iga/governance/certification';\n    case 'requestEscalation' :\n        return 'iga/governance/requests/scan/escalation'\n    case 'requestReminder' :\n        return 'iga/governance/requests/scan/reminder'\n    case 'requestExpiration' :\n        return 'iga/governance/requests/scan/expiration'\n    case 'scheduledPolicyScan':\n        return 'iga/governance/policy/' + policyId + '/scan';\n    case 'violationEscalation' :\n        return 'iga/governance/violation/scan/escalation'\n    case 'violationReminder' :\n        return 'iga/governance/violation/scan/reminder'\n    case 'violationExpiration' :\n        return 'iga/governance/violation/scan/expiration'\n    case 'violationException' :\n        return 'iga/governance/violation/scan/exception'\n    case 'scheduledRecon':\n        return '';\n    case 'processEvents':\n        return 'iga/governance/event?_action=process'\n    case 'autoIdTraining':\n        return 'iga/governance/jobs/autoIdTraining?_action=trigger'\n    case 'autoIdRecommendation':\n        return 'iga/governance/jobs/autoIdRecommendation?_action=trigger'\n    case 'requestScheduled':\n        return 'iga/governance/requests/scan/scheduled';\n    case 'notificationTaskProcess':\n        return 'iga/governance/notification/task?_action=process'\n    default:\n        return null;\n    }\n}\n\nfunction getRequestBody(type) {\n    switch(type) {\n    case 'scheduledCertification':\n        return {\n            templateId: templateId\n        }\n    case 'recon':\n        var mappings = {};\n        // Check for passed in script var additional mappings, if present\n        try {\n            mappings = additionalMappings;\n        }\n        catch (e) {\n\n        }\n        return mappings;\n    default:\n        return {};\n    }\n}\n\nfunction getAuthorizationHeaderForSchedule(date) {\n    const mac = javax.crypto.Mac.getInstance(\"HmacSHA256\");\n    var secret =java.lang.System.getenv(\"AUTONOMOUS_ACCESS_SIGNATURE_SECRET_KEY\");\n    var algorithm =java.lang.System.getenv(\"AUTONOMOUS_ACCESS_SIGNATURE_ALGORITHM\");\n    var secretBytes =  new java.lang.String(secret).getBytes(java.nio.charset.StandardCharsets.UTF_8);// convert to bytes\n    var secretKeySpec = new javax.crypto.spec.SecretKeySpec(secretBytes,\n                        \"HmacSHA256\");\n    mac.init(secretKeySpec);\n    const currentDateTimeString =  \"date: \" + date + \"\\n\";\n\n    var signedHash = mac.doFinal(new java.lang.String(currentDateTimeString).getBytes(java.nio.charset.StandardCharsets.UTF_8));\n    var base64Hash = java.util.Base64.getEncoder().encodeToString(signedHash);\n    const authorizationHeader = `Signature keyId=\"service1-hmac\",algorithm=\"${algorithm}\",headers=\"date \", signature=\"${base64Hash}\"`;\n    return authorizationHeader;\n}\n",
          },
        },
        invokeLogLevel: 'info',
        startTime: '2026-02-10T19:34Z',
        endTime: '2026-02-10T19:35Z',
        concurrentExecution: false,
        triggers: [
          {
            calendar: null,
            group: 'scheduler-service-group',
            jobKey:
              'scheduler-service-group.templateSchedule' +
              id.replaceAll('-', ''),
            name: 'trigger-templateSchedule' + id.replaceAll('-', ''),
            nodeId: null,
            previousState: null,
            serialized: {
              type: 'SimpleTriggerImpl',
              calendarName: null,
              complete: false,
              description: null,
              endTime: 1770752100000,
              fireInstanceId: null,
              group: 'scheduler-service-group',
              jobDataMap: {
                'scheduler.invokeService': 'org.forgerock.openidm.script',
                'scheduler.config-name':
                  'scheduler-templateSchedule' + id.replaceAll('-', ''),
                'scheduler.invokeContext': {
                  script: {
                    globals: {
                      scanType: 'scheduledCertification',
                      templateId: id,
                    },
                    type: 'text/javascript',
                    source:
                      "/**\n * Script to be placed in IDM script directory to handle the generation of an authorization header\n * for the scheduler and running of IDM calls to the IGA API.\n *\n *\n * IDM Scheduler allows for the passage in of variables inside of the globals object of the script definition.\n * These variables are not declared within this script, but can be referenced anyway.  They are as follows:\n *\n * scanType (required) - The type of IGA scan being run\n * reconApplication -    For type 'recon' only, the application information to run a recon for\n * additionalMappings -  For type 'recon' only, the application recon accepts additional mappings to the /reconcileAll endpoint\n * incremental -         For type 'recon' only, the application recon can be run full (default) or incremental\n * templateId -          For type 'scheduledCertification' only, the ID of the template that will be used to generate the certification\n * policyId -            For type 'scheduledPolicyScan' only, the ID of the policy that will be scanned\n */\n\nrun();\n\nfunction run() {\n\n    if (!scanType) {\n        logger.warn(\"IGA: Global script variable 'scanType' is not defined.\");\n        return;\n    }\n    else {\n        logger.debug(\"IGA: Script execution of scan type \" + scanType);\n    }\n\n\n    // Get path of IGA API call\n    var path = getApiPath(scanType);\n    if (!path) {\n        logger.warn(\"IGA: No path defined for scanType: \" + scanType);\n        return;\n    }\n\n    // Check contents of certain scans and make any adjustments\n    if (scanType === 'recon') {\n        let application = null;\n\n        try {\n            // Safety check on variable presence\n            application = reconApplication;\n        }\n        catch (e) {\n            logger.warn(\"IGA: Required application not provided for scanType: \" + scanType);\n            return;\n        }\n        path = path + '/' + application.id + '/reconcileAll';\n\n        var isIncremental = false;\n        try {\n            isIncremental = incremental && incremental === true;\n        }\n        catch (e) {\n            // If not provided treat as not-incremental\n        }\n\n        if (isIncremental) {\n            path += '?incremental=true';\n        }\n    }\n\n    // Get authorization header to allow call to be made from IDM\n    var date = new Date().toUTCString();\n    var header = getAuthorizationHeaderForSchedule(date);\n    if (!header) {\n        logger.warn(\"IGA: Could not generate authorization header.\");\n        return;\n    }\n\n    // Get request body and make call\n    var body = getRequestBody(scanType)\n    makeExternalCall(path, body, date, header)\n}\n\nfunction makeExternalCall(path, body, date, authorizationHeader) {\n    logger.debug(\"IGA: Calling endpoint \" + path);\n    logger.debug(\"IGA: Sending payload \" + JSON.stringify(body));\n    var params = {\n        url: 'http://iga-api.fr-auto.svc.cluster.local:3005/' + path,\n        method: 'POST',\n        headers : {\n        Date : date,\n        Authorization : authorizationHeader\n        },\n        contentType: 'application/json',\n        body: JSON.stringify(body),\n      }\n\n    var result = openidm.action(\"external/rest\", \"call\", params);\n    logger.debug(\"IGA: Result of endpoint \" + path + \": \" + JSON.stringify(result));\n    return result;\n}\n\nfunction getApiPath(type) {\n    switch(type) {\n    case 'creation':\n        return 'iga/governance/certification/scan/creation';\n    case 'refresh':\n        return 'iga/governance/refreshAllItems';\n    case 'recon':\n        return 'iga/governance/applications';\n    case 'decisionExpiration':\n        return 'iga/governance/certification/items/scan/expiration';\n    case 'decisionRemediation':\n        return 'iga/governance/certification/items/scan/remediation';\n    case 'escalationNotification':\n        return 'iga/governance/certification/scan/escalationNotification';\n    case 'expirationNotification':\n        return 'iga/governance/certification/scan/expirationNotification';\n    case 'reminderNotification':\n        return 'iga/governance/certification/scan/reminderNotification';\n    case 'scheduledCertification':\n        return 'iga/governance/certification';\n    case 'requestEscalation' :\n        return 'iga/governance/requests/scan/escalation'\n    case 'requestReminder' :\n        return 'iga/governance/requests/scan/reminder'\n    case 'requestExpiration' :\n        return 'iga/governance/requests/scan/expiration'\n    case 'scheduledPolicyScan':\n        return 'iga/governance/policy/' + policyId + '/scan';\n    case 'violationEscalation' :\n        return 'iga/governance/violation/scan/escalation'\n    case 'violationReminder' :\n        return 'iga/governance/violation/scan/reminder'\n    case 'violationExpiration' :\n        return 'iga/governance/violation/scan/expiration'\n    case 'violationException' :\n        return 'iga/governance/violation/scan/exception'\n    case 'scheduledRecon':\n        return '';\n    case 'processEvents':\n        return 'iga/governance/event?_action=process'\n    case 'autoIdTraining':\n        return 'iga/governance/jobs/autoIdTraining?_action=trigger'\n    case 'autoIdRecommendation':\n        return 'iga/governance/jobs/autoIdRecommendation?_action=trigger'\n    case 'requestScheduled':\n        return 'iga/governance/requests/scan/scheduled';\n    case 'notificationTaskProcess':\n        return 'iga/governance/notification/task?_action=process'\n    default:\n        return null;\n    }\n}\n\nfunction getRequestBody(type) {\n    switch(type) {\n    case 'scheduledCertification':\n        return {\n            templateId: templateId\n        }\n    case 'recon':\n        var mappings = {};\n        // Check for passed in script var additional mappings, if present\n        try {\n            mappings = additionalMappings;\n        }\n        catch (e) {\n\n        }\n        return mappings;\n    default:\n        return {};\n    }\n}\n\nfunction getAuthorizationHeaderForSchedule(date) {\n    const mac = javax.crypto.Mac.getInstance(\"HmacSHA256\");\n    var secret =java.lang.System.getenv(\"AUTONOMOUS_ACCESS_SIGNATURE_SECRET_KEY\");\n    var algorithm =java.lang.System.getenv(\"AUTONOMOUS_ACCESS_SIGNATURE_ALGORITHM\");\n    var secretBytes =  new java.lang.String(secret).getBytes(java.nio.charset.StandardCharsets.UTF_8);// convert to bytes\n    var secretKeySpec = new javax.crypto.spec.SecretKeySpec(secretBytes,\n                        \"HmacSHA256\");\n    mac.init(secretKeySpec);\n    const currentDateTimeString =  \"date: \" + date + \"\\n\";\n\n    var signedHash = mac.doFinal(new java.lang.String(currentDateTimeString).getBytes(java.nio.charset.StandardCharsets.UTF_8));\n    var base64Hash = java.util.Base64.getEncoder().encodeToString(signedHash);\n    const authorizationHeader = `Signature keyId=\"service1-hmac\",algorithm=\"${algorithm}\",headers=\"date \", signature=\"${base64Hash}\"`;\n    return authorizationHeader;\n}\n",
                  },
                },
                'schedule.config': {
                  enabled: true,
                  persisted: true,
                  recoverable: false,
                  misfirePolicy: 'fireAndProceed',
                  schedule: null,
                  repeatInterval: 946080000000,
                  repeatCount: -1,
                  type: 'simple',
                  invokeService: 'org.forgerock.openidm.script',
                  invokeContext: {
                    script: {
                      globals: {
                        scanType: 'scheduledCertification',
                        templateId: id,
                      },
                      type: 'text/javascript',
                      source:
                        "/**\n * Script to be placed in IDM script directory to handle the generation of an authorization header\n * for the scheduler and running of IDM calls to the IGA API.\n *\n *\n * IDM Scheduler allows for the passage in of variables inside of the globals object of the script definition.\n * These variables are not declared within this script, but can be referenced anyway.  They are as follows:\n *\n * scanType (required) - The type of IGA scan being run\n * reconApplication -    For type 'recon' only, the application information to run a recon for\n * additionalMappings -  For type 'recon' only, the application recon accepts additional mappings to the /reconcileAll endpoint\n * incremental -         For type 'recon' only, the application recon can be run full (default) or incremental\n * templateId -          For type 'scheduledCertification' only, the ID of the template that will be used to generate the certification\n * policyId -            For type 'scheduledPolicyScan' only, the ID of the policy that will be scanned\n */\n\nrun();\n\nfunction run() {\n\n    if (!scanType) {\n        logger.warn(\"IGA: Global script variable 'scanType' is not defined.\");\n        return;\n    }\n    else {\n        logger.debug(\"IGA: Script execution of scan type \" + scanType);\n    }\n\n\n    // Get path of IGA API call\n    var path = getApiPath(scanType);\n    if (!path) {\n        logger.warn(\"IGA: No path defined for scanType: \" + scanType);\n        return;\n    }\n\n    // Check contents of certain scans and make any adjustments\n    if (scanType === 'recon') {\n        let application = null;\n\n        try {\n            // Safety check on variable presence\n            application = reconApplication;\n        }\n        catch (e) {\n            logger.warn(\"IGA: Required application not provided for scanType: \" + scanType);\n            return;\n        }\n        path = path + '/' + application.id + '/reconcileAll';\n\n        var isIncremental = false;\n        try {\n            isIncremental = incremental && incremental === true;\n        }\n        catch (e) {\n            // If not provided treat as not-incremental\n        }\n\n        if (isIncremental) {\n            path += '?incremental=true';\n        }\n    }\n\n    // Get authorization header to allow call to be made from IDM\n    var date = new Date().toUTCString();\n    var header = getAuthorizationHeaderForSchedule(date);\n    if (!header) {\n        logger.warn(\"IGA: Could not generate authorization header.\");\n        return;\n    }\n\n    // Get request body and make call\n    var body = getRequestBody(scanType)\n    makeExternalCall(path, body, date, header)\n}\n\nfunction makeExternalCall(path, body, date, authorizationHeader) {\n    logger.debug(\"IGA: Calling endpoint \" + path);\n    logger.debug(\"IGA: Sending payload \" + JSON.stringify(body));\n    var params = {\n        url: 'http://iga-api.fr-auto.svc.cluster.local:3005/' + path,\n        method: 'POST',\n        headers : {\n        Date : date,\n        Authorization : authorizationHeader\n        },\n        contentType: 'application/json',\n        body: JSON.stringify(body),\n      }\n\n    var result = openidm.action(\"external/rest\", \"call\", params);\n    logger.debug(\"IGA: Result of endpoint \" + path + \": \" + JSON.stringify(result));\n    return result;\n}\n\nfunction getApiPath(type) {\n    switch(type) {\n    case 'creation':\n        return 'iga/governance/certification/scan/creation';\n    case 'refresh':\n        return 'iga/governance/refreshAllItems';\n    case 'recon':\n        return 'iga/governance/applications';\n    case 'decisionExpiration':\n        return 'iga/governance/certification/items/scan/expiration';\n    case 'decisionRemediation':\n        return 'iga/governance/certification/items/scan/remediation';\n    case 'escalationNotification':\n        return 'iga/governance/certification/scan/escalationNotification';\n    case 'expirationNotification':\n        return 'iga/governance/certification/scan/expirationNotification';\n    case 'reminderNotification':\n        return 'iga/governance/certification/scan/reminderNotification';\n    case 'scheduledCertification':\n        return 'iga/governance/certification';\n    case 'requestEscalation' :\n        return 'iga/governance/requests/scan/escalation'\n    case 'requestReminder' :\n        return 'iga/governance/requests/scan/reminder'\n    case 'requestExpiration' :\n        return 'iga/governance/requests/scan/expiration'\n    case 'scheduledPolicyScan':\n        return 'iga/governance/policy/' + policyId + '/scan';\n    case 'violationEscalation' :\n        return 'iga/governance/violation/scan/escalation'\n    case 'violationReminder' :\n        return 'iga/governance/violation/scan/reminder'\n    case 'violationExpiration' :\n        return 'iga/governance/violation/scan/expiration'\n    case 'violationException' :\n        return 'iga/governance/violation/scan/exception'\n    case 'scheduledRecon':\n        return '';\n    case 'processEvents':\n        return 'iga/governance/event?_action=process'\n    case 'autoIdTraining':\n        return 'iga/governance/jobs/autoIdTraining?_action=trigger'\n    case 'autoIdRecommendation':\n        return 'iga/governance/jobs/autoIdRecommendation?_action=trigger'\n    case 'requestScheduled':\n        return 'iga/governance/requests/scan/scheduled';\n    case 'notificationTaskProcess':\n        return 'iga/governance/notification/task?_action=process'\n    default:\n        return null;\n    }\n}\n\nfunction getRequestBody(type) {\n    switch(type) {\n    case 'scheduledCertification':\n        return {\n            templateId: templateId\n        }\n    case 'recon':\n        var mappings = {};\n        // Check for passed in script var additional mappings, if present\n        try {\n            mappings = additionalMappings;\n        }\n        catch (e) {\n\n        }\n        return mappings;\n    default:\n        return {};\n    }\n}\n\nfunction getAuthorizationHeaderForSchedule(date) {\n    const mac = javax.crypto.Mac.getInstance(\"HmacSHA256\");\n    var secret =java.lang.System.getenv(\"AUTONOMOUS_ACCESS_SIGNATURE_SECRET_KEY\");\n    var algorithm =java.lang.System.getenv(\"AUTONOMOUS_ACCESS_SIGNATURE_ALGORITHM\");\n    var secretBytes =  new java.lang.String(secret).getBytes(java.nio.charset.StandardCharsets.UTF_8);// convert to bytes\n    var secretKeySpec = new javax.crypto.spec.SecretKeySpec(secretBytes,\n                        \"HmacSHA256\");\n    mac.init(secretKeySpec);\n    const currentDateTimeString =  \"date: \" + date + \"\\n\";\n\n    var signedHash = mac.doFinal(new java.lang.String(currentDateTimeString).getBytes(java.nio.charset.StandardCharsets.UTF_8));\n    var base64Hash = java.util.Base64.getEncoder().encodeToString(signedHash);\n    const authorizationHeader = `Signature keyId=\"service1-hmac\",algorithm=\"${algorithm}\",headers=\"date \", signature=\"${base64Hash}\"`;\n    return authorizationHeader;\n}\n",
                    },
                  },
                  invokeLogLevel: 'info',
                  startTime: '2026-02-10T19:34Z',
                  endTime: '2026-02-10T19:35Z',
                  concurrentExecution: false,
                  configAlias: null,
                },
                'scheduler.invokeLogLevel': 'info',
              },
              jobGroup: 'scheduler-service-group',
              jobName: 'templateSchedule' + id.replaceAll('-', ''),
              misfireInstruction: 1,
              name: 'trigger-templateSchedule' + id.replaceAll('-', ''),
              nextFireTime: 1770752040000,
              previousFireTime: null,
              priority: 5,
              repeatCount: -1,
              repeatInterval: 946080000000,
              startTime: 1770752040000,
              timesTriggered: 0,
              volatility: false,
            },
            state: 'NORMAL',
            _id:
              'scheduler-service-group.trigger-templateSchedule' +
              id.replaceAll('-', ''),
          },
        ],
        previousRunDate: null,
        nextRunDate: '2026-02-10T19:34:00.000Z',
      },
    }),
    ...(isEvent && {
      templateEventType: 'user',
      parameters: [
        {
          id: 'userId',
          displayName: 'ID of user this campaign will target',
          type: 'string',
        },
        {
          id: 'eventName',
          displayName: 'Name of the event triggering this campaign',
          type: 'string',
        },
        {
          id: 'userDisplayName',
          displayName: 'Display friendly name of user this campaign targets',
          type: 'string',
        },
      ],
    }),
  };
  if (type === 'entitlementComposition') {
    template.targetFilter.type.push('entitlement');
  }
  if (type !== 'entitlement' && type !== 'roleMembership') {
    template.targetFilter.type.push('accountGrant');
    template.targetFilter.type.push('AccountGrant');
  }
  if (type !== 'entitlement') {
    template.targetFilter.type.push('roleMembership');
  }
  if (type !== 'roleMembership') {
    template.targetFilter.type.push('entitlementGrant');
    template.targetFilter.type.push('ResourceGrant');
  }
  return template;
}

// certification
export const certificationTemplate1: CertificationTemplateSkeleton =
  getTestCertificationTemplate(
    '236e8908-642a-4684-be00-c69bba999053',
    'test_certification_1',
    'identity'
  );

// certification w/ email templates
export const certificationTemplate2: CertificationTemplateSkeleton =
  getTestCertificationTemplate(
    'f52d6c57-68d6-4fa2-82cc-4f924a81a574',
    'test_certification_2',
    'entitlement',
    `${EMAIL_TEMPLATE_TYPE}/${template1._id}`
  );

// certification w/ email templates
export const certificationTemplate3: CertificationTemplateSkeleton =
  getTestCertificationTemplate(
    '7b0ef8e5-0fd5-45f1-88fb-138f63e0fed1',
    'test_certification_3',
    'entitlementComposition',
    `${EMAIL_TEMPLATE_TYPE}/${template1._id}`
  );

// certification w/ email templates
export const certificationTemplate4: CertificationTemplateSkeleton =
  getTestCertificationTemplate(
    'fb2b9e9d-373d-49ea-9fcf-3d388d1613b7',
    'test_certification_4',
    'roleMembership',
    `${EMAIL_TEMPLATE_TYPE}/${template1._id}`
  );

// event certification
export const certificationTemplate5: CertificationTemplateSkeleton =
  getTestCertificationTemplate(
    '3a10e1ce-1c9d-48b3-9e7e-7ea8094cf9f4',
    'test_certification_5',
    'identity',
    undefined,
    true
  );

// certification
export const certificationTemplate6: CertificationTemplateSkeleton =
  getTestCertificationTemplate(
    'a0a41b41-9a72-4da8-a1f4-9c2dca60d9b8',
    'test_certification_6',
    'identity'
  );

// event certification
export const certificationTemplate7: CertificationTemplateSkeleton =
  getTestCertificationTemplate(
    'df115033-5ecd-4111-83ee-b16a30204570',
    'test_certification_7',
    'identity',
    undefined,
    true
  );

const allCertificationTemplates = [
  certificationTemplate1,
  certificationTemplate2,
  certificationTemplate3,
  certificationTemplate4,
  certificationTemplate5,
  certificationTemplate6,
  certificationTemplate7,
];

const oldIds = new Map<string, string>();

export async function stageCertificationTemplate(
  templateData: CertificationTemplateSkeleton,
  createNew = false
) {
  try {
    await IgaCertificationTemplateOps.deleteCertificationTemplateByName({
      templateName: templateData.name,
      state,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  } finally {
    if (createNew) {
      // Since it's not possible to create a certification template with a specified ID, we must use the new id for recording the tests.
      const oldId = templateData.id;
      templateData.id = (
        await IgaCertificationTemplateOps.createCertificationTemplate({
          templateData,
          state,
        })
      ).id;
      // We store the old id for after the tests are finished running to update the recordings to use the old id instead so that tests will pass future runs.
      oldIds.set(templateData.id, oldId);
    }
  }
}

export function setup() {
  const ctx = autoSetupPolly();
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      setupPollyRecordingContext(ctx, [
        {
          pathToObj: [],
          identifier: 'id',
          testObjs: allCertificationTemplates,
          oldObjIds: oldIds,
          namesWhereMultipleRequestsMade: [certificationTemplate7.name],
        },
      ]);
    }
  });
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // setup email template - delete if exists, then create
      await stageEmailTemplate(template1, true);
      // setup certificationTemplate1 - delete if exists
      await stageCertificationTemplate(certificationTemplate1);
      // setup certificationTemplate2 - delete if exists, then create
      await stageCertificationTemplate(certificationTemplate2, true);
      // setup certificationTemplate3 - delete if exists
      await stageCertificationTemplate(certificationTemplate3);
      // setup certificationTemplate4 - delete if exists
      await stageCertificationTemplate(certificationTemplate4);
      // setup certificationTemplate5 - delete if exists, then create
      await stageCertificationTemplate(certificationTemplate5, true);
      // setup certificationTemplate6 - delete if exists, then create
      await stageCertificationTemplate(certificationTemplate6, true);
      // setup certificationTemplate7 - delete if exists, then create
      await stageCertificationTemplate(certificationTemplate7, true);
    }
  });
  // in recording mode, delete test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      for (const template of allCertificationTemplates) {
        await stageCertificationTemplate(template);
      }
      await stageEmailTemplate(template1);
    }
  });
}
