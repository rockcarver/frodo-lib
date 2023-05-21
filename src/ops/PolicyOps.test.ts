/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record non-conflicting tests
 *    Phase 2: Record conflicting tests - Deletes
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record PolicyOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record PolicyOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update PolicyOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only PolicyOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as PolicySetApi from '../api/PolicySetApi';
import * as PoliciesApi from '../api/PoliciesApi';
import * as ScriptOps from './ScriptOps';
import * as PolicyOps from './PolicyOps';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import {
  PolicyCondition,
  PolicySetSkeleton,
  PolicySkeleton,
  ScriptSkeleton,
} from '../api/ApiTypes';
import { cloneDeep } from './utils/OpsUtils';
import { PolicyExportInterface } from '../../types/ops/PolicyOps';

autoSetupPolly();

async function stagePolicySet(policySet: PolicySetSkeleton, create = true) {
  // delete if exists, then create
  try {
    await PolicySetApi.getPolicySet(policySet.name);
    await PolicySetApi.deletePolicySet(policySet.name);
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await PolicySetApi.createPolicySet(policySet);
    }
  }
}

async function stageScript(script: ScriptSkeleton, create = true) {
  // delete if exists, then create
  try {
    await ScriptOps.getScript(script._id);
    await ScriptOps.deleteScript(script._id);
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await ScriptOps.putScript(script._id, script);
    }
  }
}

async function stagePolicy(policy: PolicySkeleton, create = true) {
  // delete if exists, then create
  try {
    await PoliciesApi.getPolicy(policy._id);
    await PoliciesApi.deletePolicy(policy._id);
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await PoliciesApi.putPolicy(policy._id, policy);
    }
  }
}

function applyPolicyTemplate(
  template: PolicySkeleton,
  policyId: string
): PolicySkeleton {
  const configured: PolicySkeleton = cloneDeep(template);
  configured._id = policyId;
  configured.name = policyId;
  return configured;
}

describe('PolicyOps', () => {
  const urlResourceType = {
    uuid: '76656a38-5f8e-401b-83aa-4ccb74ce88d2',
    name: 'URL',
    description: 'The built-in URL Resource Type available to OpenAMPolicies.',
    patterns: ['*://*:*/*', '*://*:*/*?*'],
    actions: {
      HEAD: true,
      DELETE: true,
      POST: true,
      GET: true,
      OPTIONS: true,
      PUT: true,
      PATCH: true,
    },
    createdBy: 'id=dsameuser,ou=user,ou=am-config',
    creationDate: 1595479030487,
    lastModifiedBy:
      'id=8d9723a9-a439-4cbf-beb4-30e52811789d,ou=user,ou=am-config',
    lastModifiedDate: 1682866321984,
  };
  const set1: PolicySetSkeleton = {
    name: 'FrodoTestPolicySet1',
    displayName: 'Frodo Test Policy Set',
    description: null,
    attributeNames: [],
    conditions: [
      'Script',
      'AMIdentityMembership',
      'IPv6',
      'IPv4',
      'SimpleTime',
      'LEAuthLevel',
      'LDAPFilter',
      'AuthScheme',
      'Session',
      'AND',
      'AuthenticateToRealm',
      'ResourceEnvIP',
      'Policy',
      'OAuth2Scope',
      'SessionProperty',
      'OR',
      'Transaction',
      'NOT',
      'AuthLevel',
      'AuthenticateToService',
    ],
    resourceTypeUuids: ['76656a38-5f8e-401b-83aa-4ccb74ce88d2'],
    resourceComparator: null,
    editable: true,
    saveIndex: null,
    searchIndex: null,
    applicationType: 'iPlanetAMWebAgentService',
    entitlementCombiner: 'DenyOverride',
    subjects: [
      'AuthenticatedUsers',
      'NOT',
      'Identity',
      'OR',
      'AND',
      'NONE',
      'Policy',
      'JwtClaim',
    ],
  };
  const script1: ScriptSkeleton = {
    _id: '62f18ede-e5e7-4a7b-8b73-1b02fcbd241a',
    name: 'Scripted Policy',
    description: 'Policy Sample Script',
    script: [
      '/*',
      ' * Copyright 2015-2017 ForgeRock AS. All Rights Reserved',
      ' *',
      ' * Use of this code requires a commercial software license with ForgeRock AS.',
      ' * or with one of its affiliates. All use shall be exclusively subject',
      ' * to such license between the licensee and ForgeRock AS.',
      ' */',
      '/**',
      " * This is a Policy Condition example script. It demonstrates how to access a user's information,",
      ' * use that information in external HTTP calls and make a policy decision based on the outcome.',
      ' */',
      '',
      'var userAddress, userIP, resourceHost;',
      '',
      'if (validateAndInitializeParameters()) {',
      '',
      '    var countryFromUserAddress = getCountryFromUserAddress();',
      '    logger.message("Country retrieved from user\'s address: " + countryFromUserAddress);',
      '    var countryFromUserIP = getCountryFromUserIP();',
      '    logger.message("Country retrieved from user\'s IP: " + countryFromUserIP);',
      '    var countryFromResourceURI = getCountryFromResourceURI();',
      '    logger.message("Country retrieved from resource URI: " + countryFromResourceURI);',
      '',
      '    if (countryFromUserAddress === countryFromUserIP && countryFromUserAddress === countryFromResourceURI) {',
      '        logger.message("Authorization Succeeded");',
      '        responseAttributes.put("countryOfOrigin", [countryFromUserAddress]);',
      '        authorized = true;',
      '    } else {',
      '        logger.message("Authorization Failed");',
      '        authorized = false;',
      '    }',
      '',
      '} else {',
      '    logger.message("Required parameters not found. Authorization Failed.");',
      '    authorized = false;',
      '}',
      '',
      '/**',
      " * Use the user's address to lookup their country of residence.",
      ' *',
      " * @returns {*} The user's country of residence.",
      ' */',
      'function getCountryFromUserAddress() {',
      '',
      '    var request = new org.forgerock.http.protocol.Request();',
      '    request.setUri("http://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(userAddress));',
      '      request.setMethod("GET");',
      '',
      '    var response = httpClient.send(request).get();',
      '    logResponse(response);',
      '',
      '    var geocode = JSON.parse(response.getEntity().getString());',
      '    var i;',
      '    for (i = 0; i < geocode.results.length; i++) {',
      '        var result = geocode.results[i];',
      '        var j;',
      '        for (j = 0; j < result.address_components.length; i++) {',
      '            if (result.address_components[i].types[0] == "country") {',
      '                return result.address_components[i].long_name;',
      '            }',
      '        }',
      '    }',
      '}',
      '',
      '/**',
      " * Use the user's IP to lookup the country from which the request originated.",
      ' *',
      ' * @returns {*} The country from which the request originated.',
      ' */',
      'function getCountryFromUserIP() {',
      '    var request = new org.forgerock.http.protocol.Request();',
      '    request.setUri("http://ip-api.com/json/" + userIP);',
      '      request.setMethod("GET");',
      '',
      '    var response = httpClient.send(request).get();',
      '    logResponse(response);',
      '',
      '    var result = JSON.parse(response.getEntity().getString());',
      '    if (result) {',
      '        return result.country;',
      '    }',
      '}',
      '',
      '/**',
      " * Use the requested resource's host name to lookup the country where the resource is hosted.",
      ' *',
      ' * @returns {*} The country in which the resource is hosted.',
      ' */',
      'function getCountryFromResourceURI() {',
      '    var request = new org.forgerock.http.protocol.Request();',
      '    request.setUri("http://ip-api.com/json/" + encodeURIComponent(resourceHost));',
      '      request.setMethod("GET");',
      '',
      '    var response = httpClient.send(request).get();',
      '    logResponse(response);',
      '',
      '    var result = JSON.parse(response.getEntity().getString());',
      '    if (result) {',
      '        return result.country;',
      '    }',
      '}',
      '',
      '/**',
      ' * Retrieve and validate the variables required to make the external HTTP calls.',
      ' *',
      ' * @returns {boolean} Will be true if validation was successful.',
      ' */',
      'function validateAndInitializeParameters() {',
      '    var userAddressSet = identity.getAttribute("postalAddress");',
      '    if (userAddressSet == null || userAddressSet.isEmpty()) {',
      '        logger.warning("No address specified for user: " + username);',
      '        return false;',
      '    }',
      '    userAddress = userAddressSet.iterator().next();',
      '    logger.message("User address: " + userAddress);',
      '',
      '    if (!environment) {',
      '        logger.warning("No environment parameters specified in the evaluation request.");',
      '        return false;',
      '    }',
      '',
      '    var ipSet = environment.get("IP");',
      '    if (ipSet == null || ipSet.isEmpty()) {',
      '        logger.warning("No IP specified in the evaluation request environment parameters.");',
      '        return false;',
      '    }',
      '    userIP = ipSet.iterator().next();',
      '    logger.message("User IP: " + userIP);',
      '',
      '    if (!resourceURI) {',
      '        logger.warning("No resource URI specified.");',
      '        return false;',
      '    }',
      '    resourceHost = resourceURI.match(/^(.*:\\/\\/)(www\\.)?([A-Za-z0-9\\-\\.]+)(:[0-9]+)?(.*)$/)[3];',
      '    logger.message("Resource host: " + resourceHost);',
      '',
      '    return true;',
      '}',
      '',
      'function logResponse(response) {',
      '    logger.message("User REST Call. Status: " + response.getStatus() + ", Body: " + response.getEntity().getString());',
      '}',
    ],
    default: false,
    language: 'JAVASCRIPT',
    context: 'POLICY_CONDITION',
    createdBy: 'null',
    creationDate: 0,
    lastModifiedBy: 'null',
    lastModifiedDate: 0,
  };
  const script2: ScriptSkeleton = {
    _id: '729ee140-a4e9-43af-b358-d60eeda13cc3',
    name: 'Scripted Policy 2',
    description: 'Scripted Sample Policy 2',
    script: [
      '/*',
      ' * Copyright 2015-2017 ForgeRock AS. All Rights Reserved',
      ' *',
      ' * Use of this code requires a commercial software license with ForgeRock AS.',
      ' * or with one of its affiliates. All use shall be exclusively subject',
      ' * to such license between the licensee and ForgeRock AS.',
      ' */',
      '/**',
      " * This is a Policy Condition example script. It demonstrates how to access a user's information,",
      ' * use that information in external HTTP calls and make a policy decision based on the outcome.',
      ' */',
      '',
      'var userAddress, userIP, resourceHost;',
      '',
      'if (validateAndInitializeParameters()) {',
      '',
      '    var countryFromUserAddress = getCountryFromUserAddress();',
      '    logger.message("Country retrieved from user\'s address: " + countryFromUserAddress);',
      '    var countryFromUserIP = getCountryFromUserIP();',
      '    logger.message("Country retrieved from user\'s IP: " + countryFromUserIP);',
      '    var countryFromResourceURI = getCountryFromResourceURI();',
      '    logger.message("Country retrieved from resource URI: " + countryFromResourceURI);',
      '',
      '    if (countryFromUserAddress === countryFromUserIP && countryFromUserAddress === countryFromResourceURI) {',
      '        logger.message("Authorization Succeeded");',
      '        responseAttributes.put("countryOfOrigin", [countryFromUserAddress]);',
      '        authorized = true;',
      '    } else {',
      '        logger.message("Authorization Failed");',
      '        authorized = false;',
      '    }',
      '',
      '} else {',
      '    logger.message("Required parameters not found. Authorization Failed.");',
      '    authorized = false;',
      '}',
      '',
      '/**',
      " * Use the user's address to lookup their country of residence.",
      ' *',
      " * @returns {*} The user's country of residence.",
      ' */',
      'function getCountryFromUserAddress() {',
      '',
      '    var request = new org.forgerock.http.protocol.Request();',
      '    request.setUri("http://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(userAddress));',
      '      request.setMethod("GET");',
      '',
      '    var response = httpClient.send(request).get();',
      '    logResponse(response);',
      '',
      '    var geocode = JSON.parse(response.getEntity().getString());',
      '    var i;',
      '    for (i = 0; i < geocode.results.length; i++) {',
      '        var result = geocode.results[i];',
      '        var j;',
      '        for (j = 0; j < result.address_components.length; i++) {',
      '            if (result.address_components[i].types[0] == "country") {',
      '                return result.address_components[i].long_name;',
      '            }',
      '        }',
      '    }',
      '}',
      '',
      '/**',
      " * Use the user's IP to lookup the country from which the request originated.",
      ' *',
      ' * @returns {*} The country from which the request originated.',
      ' */',
      'function getCountryFromUserIP() {',
      '    var request = new org.forgerock.http.protocol.Request();',
      '    request.setUri("http://ip-api.com/json/" + userIP);',
      '      request.setMethod("GET");',
      '',
      '    var response = httpClient.send(request).get();',
      '    logResponse(response);',
      '',
      '    var result = JSON.parse(response.getEntity().getString());',
      '    if (result) {',
      '        return result.country;',
      '    }',
      '}',
      '',
      '/**',
      " * Use the requested resource's host name to lookup the country where the resource is hosted.",
      ' *',
      ' * @returns {*} The country in which the resource is hosted.',
      ' */',
      'function getCountryFromResourceURI() {',
      '    var request = new org.forgerock.http.protocol.Request();',
      '    request.setUri("http://ip-api.com/json/" + encodeURIComponent(resourceHost));',
      '      request.setMethod("GET");',
      '',
      '    var response = httpClient.send(request).get();',
      '    logResponse(response);',
      '',
      '    var result = JSON.parse(response.getEntity().getString());',
      '    if (result) {',
      '        return result.country;',
      '    }',
      '}',
      '',
      '/**',
      ' * Retrieve and validate the variables required to make the external HTTP calls.',
      ' *',
      ' * @returns {boolean} Will be true if validation was successful.',
      ' */',
      'function validateAndInitializeParameters() {',
      '    var userAddressSet = identity.getAttribute("postalAddress");',
      '    if (userAddressSet == null || userAddressSet.isEmpty()) {',
      '        logger.warning("No address specified for user: " + username);',
      '        return false;',
      '    }',
      '    userAddress = userAddressSet.iterator().next();',
      '    logger.message("User address: " + userAddress);',
      '',
      '    if (!environment) {',
      '        logger.warning("No environment parameters specified in the evaluation request.");',
      '        return false;',
      '    }',
      '',
      '    var ipSet = environment.get("IP");',
      '    if (ipSet == null || ipSet.isEmpty()) {',
      '        logger.warning("No IP specified in the evaluation request environment parameters.");',
      '        return false;',
      '    }',
      '    userIP = ipSet.iterator().next();',
      '    logger.message("User IP: " + userIP);',
      '',
      '    if (!resourceURI) {',
      '        logger.warning("No resource URI specified.");',
      '        return false;',
      '    }',
      '    resourceHost = resourceURI.match(/^(.*:\\/\\/)(www\\.)?([A-Za-z0-9\\-\\.]+)(:[0-9]+)?(.*)$/)[3];',
      '    logger.message("Resource host: " + resourceHost);',
      '',
      '    return true;',
      '}',
      '',
      'function logResponse(response) {',
      '    logger.message("User REST Call. Status: " + response.getStatus() + ", Body: " + response.getEntity().getString());',
      '}',
    ],
    default: false,
    language: 'JAVASCRIPT',
    context: 'POLICY_CONDITION',
    createdBy: 'null',
    creationDate: 0,
    lastModifiedBy: 'null',
    lastModifiedDate: 0,
  };
  const policyTemplate: PolicySkeleton = {
    _id: 'FrodoTestPolicyTemplate',
    name: 'FrodoTestPolicyTemplate',
    active: true,
    description: 'Frodo Test Policy',
    resources: ['*://*:*/forgerock/app2/*', '*://*:*/app2/*'],
    applicationName: set1.name,
    actionValues: {
      GET: true,
    },
    subject: {
      type: 'AuthenticatedUsers',
    },
    resourceTypeUuid: '76656a38-5f8e-401b-83aa-4ccb74ce88d2',
    condition: {
      type: 'AND',
      conditions: [
        {
          type: 'Script',
          scriptId: '62f18ede-e5e7-4a7b-8b73-1b02fcbd241a',
        },
        {
          type: 'AuthenticateToService',
          authenticateToService: 'TxAuthz',
        },
        {
          type: 'OR',
          conditions: [
            {
              type: 'Session',
              maxSessionTime: 5,
              terminateSession: false,
            },
            {
              type: 'OAuth2Scope',
              requiredScopes: ['openid'],
            },
            {
              type: 'Script',
              scriptId: '729ee140-a4e9-43af-b358-d60eeda13cc3',
            },
            {
              type: 'NOT',
              condition: {
                type: 'Script',
                scriptId: '729ee140-a4e9-43af-b358-d60eeda13cc3',
              },
            },
          ],
        },
      ],
    },
  };
  const policy1 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy1');
  const policy3 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy3');
  const policy4 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy4');
  const policy5 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy5');
  const policy6 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy6');
  const policy7 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy7');
  const policy9 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy9');
  const policy11 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy11');
  const policy12 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy12');
  const policy13 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy13');
  const policy14 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy14');
  const policy15 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy15');
  const policy16 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy16');
  const policy17 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy17');
  const policy18 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy18');
  const policy19 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy19');
  const policy20 = applyPolicyTemplate(policyTemplate, 'FrodoTestPolicy20');
  const import1: PolicyExportInterface = {
    meta: {
      origin: 'https://openam-volker-dev.forgeblocks.com/am',
      originAmVersion: '7.3.0',
      exportedBy: 'volker.scheuber@forgerock.com',
      exportDate: '2023-05-18T18:09:05.247Z',
      exportTool: 'frodo',
      exportToolVersion: 'v0.18.9-6 [v19.4.0]',
    },
    script: {
      [script1._id]: script1,
      [script2._id]: script2,
    },
    policy: {
      [policy11._id]: policy11,
    },
    policyset: {
      [set1.name]: set1,
    },
    resourcetype: {
      '76656a38-5f8e-401b-83aa-4ccb74ce88d2': urlResourceType,
    },
  };
  const import2: PolicyExportInterface = {
    meta: {
      origin: 'https://openam-volker-dev.forgeblocks.com/am',
      originAmVersion: '7.3.0',
      exportedBy: 'volker.scheuber@forgerock.com',
      exportDate: '2023-05-18T18:09:05.247Z',
      exportTool: 'frodo',
      exportToolVersion: 'v0.18.9-6 [v19.4.0]',
    },
    script: {
      [script1._id]: script1,
      [script2._id]: script2,
    },
    policy: {
      [policy12._id]: policy12,
    },
    policyset: {
      [set1.name]: set1,
    },
    resourcetype: {
      '76656a38-5f8e-401b-83aa-4ccb74ce88d2': urlResourceType,
    },
  };
  const import3: PolicyExportInterface = {
    meta: {
      origin: 'https://openam-volker-dev.forgeblocks.com/am',
      originAmVersion: '7.3.0',
      exportedBy: 'volker.scheuber@forgerock.com',
      exportDate: '2023-05-18T18:09:05.247Z',
      exportTool: 'frodo',
      exportToolVersion: 'v0.18.9-6 [v19.4.0]',
    },
    script: {
      [script1._id]: script1,
      [script2._id]: script2,
    },
    policy: {
      [policy13._id]: policy13,
      [policy14._id]: policy14,
    },
    policyset: {
      [set1.name]: set1,
    },
    resourcetype: {
      '76656a38-5f8e-401b-83aa-4ccb74ce88d2': urlResourceType,
    },
  };
  const import4: PolicyExportInterface = {
    meta: {
      origin: 'https://openam-volker-dev.forgeblocks.com/am',
      originAmVersion: '7.3.0',
      exportedBy: 'volker.scheuber@forgerock.com',
      exportDate: '2023-05-18T18:09:05.247Z',
      exportTool: 'frodo',
      exportToolVersion: 'v0.18.9-6 [v19.4.0]',
    },
    script: {
      [script1._id]: script1,
      [script2._id]: script2,
    },
    policy: {
      [policy15._id]: policy15,
      [policy16._id]: policy16,
    },
    policyset: {
      [set1.name]: set1,
    },
    resourcetype: {
      '76656a38-5f8e-401b-83aa-4ccb74ce88d2': urlResourceType,
    },
  };
  const import5: PolicyExportInterface = {
    meta: {
      origin: 'https://openam-volker-dev.forgeblocks.com/am',
      originAmVersion: '7.3.0',
      exportedBy: 'volker.scheuber@forgerock.com',
      exportDate: '2023-05-18T18:09:05.247Z',
      exportTool: 'frodo',
      exportToolVersion: 'v0.18.9-6 [v19.4.0]',
    },
    script: {
      [script1._id]: script1,
      [script2._id]: script2,
    },
    policy: {
      [policy17._id]: policy17,
      [policy18._id]: policy18,
    },
    policyset: {
      [set1.name]: set1,
    },
    resourcetype: {
      '76656a38-5f8e-401b-83aa-4ccb74ce88d2': urlResourceType,
    },
  };
  const import6: PolicyExportInterface = {
    meta: {
      origin: 'https://openam-volker-dev.forgeblocks.com/am',
      originAmVersion: '7.3.0',
      exportedBy: 'volker.scheuber@forgerock.com',
      exportDate: '2023-05-18T18:09:05.247Z',
      exportTool: 'frodo',
      exportToolVersion: 'v0.18.9-6 [v19.4.0]',
    },
    script: {
      [script1._id]: script1,
      [script2._id]: script2,
    },
    policy: {
      [policy19._id]: policy19,
      [policy20._id]: policy20,
    },
    policyset: {
      [set1.name]: set1,
    },
    resourcetype: {
      '76656a38-5f8e-401b-83aa-4ccb74ce88d2': urlResourceType,
    },
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stagePolicySet(set1);
      await stageScript(script1);
      await stageScript(script2);
      await stagePolicy(policy1);
      await stagePolicy(policy3, false);
      await stagePolicy(policy4);
      await stagePolicy(policy5);
      await stagePolicy(policy6, false);
      await stagePolicy(policy7);
      await stagePolicy(policy9);
      await stagePolicy(policy11, false);
      await stagePolicy(policy12, false);
      await stagePolicy(policy13, false);
      await stagePolicy(policy14, false);
      await stagePolicy(policy15, false);
      await stagePolicy(policy16, false);
      await stagePolicy(policy17, false);
      await stagePolicy(policy18, false);
      await stagePolicy(policy19, false);
      await stagePolicy(policy20, false);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stagePolicy(policy1, false);
      await stagePolicy(policy3, false);
      await stagePolicy(policy4, false);
      await stagePolicy(policy5, false);
      await stagePolicy(policy6, false);
      await stagePolicy(policy7, false);
      await stagePolicy(policy9, false);
      await stagePolicy(policy11, false);
      await stagePolicy(policy12, false);
      await stagePolicy(policy13, false);
      await stagePolicy(policy14, false);
      await stagePolicy(policy15, false);
      await stagePolicy(policy16, false);
      await stagePolicy(policy17, false);
      await stagePolicy(policy18, false);
      await stagePolicy(policy19, false);
      await stagePolicy(policy20, false);
      await stageScript(script1, false);
      await stageScript(script2, false);
      await stagePolicySet(set1, false);
    }
  });

  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('getPolicies()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicyOps.getPolicies).toBeDefined();
      });

      test('1: Get all policies', async () => {
        const response = await PolicyOps.getPolicies();
        expect(response).toMatchSnapshot();
      });
    });

    describe('getPoliciesByPolicySet()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicyOps.getPoliciesByPolicySet).toBeDefined();
      });

      test(`1: Get all policies in policy set [${set1.name}]`, async () => {
        const response = await PolicyOps.getPoliciesByPolicySet(set1.name);
        expect(response).toMatchSnapshot();
      });
    });

    describe('getPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicyOps.getPolicy).toBeDefined();
      });

      test(`1: Get existing policy [${policy1._id}]`, async () => {
        const response = await PolicyOps.getPolicy(policy1._id);
        expect(response).toMatchSnapshot();
      });

      test('2: Get non-existing policy [DoesNotExist]', async () => {
        expect.assertions(1);
        try {
          await PolicyOps.getPolicy('DoesNotExist');
        } catch (error) {
          expect(error.response.data).toMatchSnapshot();
        }
      });
    });

    describe('putPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicyOps.putPolicy).toBeDefined();
      });

      test(`1: Create non-existing policy [${policy3.name}]`, async () => {
        const response = await PolicyOps.putPolicy(policy3._id, policy3);
        expect(response).toMatchSnapshot();
      });

      test(`2: Update existing policy [${policy4.name}]`, async () => {
        const response = await PolicyOps.putPolicy(policy4._id, policy4);
        expect(response).toMatchSnapshot();
      });
    });

    describe('findScriptUuids()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicyOps.findScriptUuids).toBeDefined();
      });

      test(`1: Find script uuids for policy [${policy5.name}]`, async () => {
        const response = await PolicyOps.findScriptUuids(
          policy5.condition as PolicyCondition
        );
        expect(response).toMatchSnapshot();
      });
    });

    describe('getScripts()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicyOps.getScripts).toBeDefined();
      });

      test(`1: Find scripts for policy [${policy6.name}]`, async () => {
        const response = await PolicyOps.getScripts(policy6);
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicyOps.exportPolicy).toBeDefined();
      });

      test(`1: Export existing policy w/o deps [${policy9._id}]`, async () => {
        const response = await PolicyOps.exportPolicy(policy9._id, {
          deps: false,
          prereqs: false,
          useStringArrays: true,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test(`2: Export existing policy w/ deps [${policy9._id}]`, async () => {
        const response = await PolicyOps.exportPolicy(policy9._id, {
          deps: true,
          prereqs: false,
          useStringArrays: true,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test('3: Export non-existing policy [DoesNotExist]', async () => {
        expect.assertions(1);
        try {
          await PolicyOps.exportPolicy('DoesNotExist', {
            deps: false,
            prereqs: false,
            useStringArrays: true,
          });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('exportPolicies()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicyOps.exportPolicies).toBeDefined();
      });

      test('1: Export all policies w/o deps', async () => {
        const response = await PolicyOps.exportPolicies({
          deps: false,
          prereqs: false,
          useStringArrays: true,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test('2: Export all policies w/ deps', async () => {
        const response = await PolicyOps.exportPolicies({
          deps: true,
          prereqs: false,
          useStringArrays: true,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('exportPoliciesByPolicySet()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicyOps.exportPoliciesByPolicySet).toBeDefined();
      });

      test(`1: Export all policies in policy set ${set1.name} w/o deps`, async () => {
        const response = await PolicyOps.exportPoliciesByPolicySet(set1.name, {
          deps: false,
          prereqs: false,
          useStringArrays: true,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test(`2: Export all policies in policy set ${set1.name} w/ deps`, async () => {
        const response = await PolicyOps.exportPoliciesByPolicySet(set1.name, {
          deps: true,
          prereqs: false,
          useStringArrays: true,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('importPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicyOps.importPolicy).toBeDefined();
      });

      test(`1: Import policy [${policy11._id}] w/o deps`, async () => {
        const response = await PolicyOps.importPolicy(policy11._id, import1, {
          deps: false,
          prereqs: false,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Import policy [${policy12._id}] w/ deps`, async () => {
        const response = await PolicyOps.importPolicy(policy12._id, import2, {
          deps: true,
          prereqs: false,
        });
        expect(response).toMatchSnapshot();
      });

      test('3: Import non-existing policy [DoesNotExist]', async () => {
        expect.assertions(1);
        try {
          await PolicyOps.importPolicy('DoesNotExist', import1, {
            deps: false,
            prereqs: false,
          });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('importFirstPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicyOps.importFirstPolicy).toBeDefined();
      });

      test('1: Import first policy w/o deps', async () => {
        const response = await PolicyOps.importFirstPolicy(import3, {
          deps: false,
          prereqs: false,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Import first policy w/ deps', async () => {
        const response = await PolicyOps.importFirstPolicy(import4, {
          deps: true,
          prereqs: false,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('importPolicies()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicyOps.importPolicies).toBeDefined();
      });

      test('1: Import all policies w/o deps', async () => {
        const response = await PolicyOps.importPolicies(import5, {
          deps: false,
          prereqs: false,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Import all policies w/ deps', async () => {
        const response = await PolicyOps.importPolicies(import6, {
          deps: true,
          prereqs: false,
        });
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('deletePolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(PolicyOps.deletePolicy).toBeDefined();
      });

      test(`1: Delete existing policy [${policy7._id}]`, async () => {
        const response = await PolicyOps.deletePolicy(policy7._id);
        expect(response).toMatchSnapshot();
      });

      test('2: Delete non-existing policy [DoesNotExist]', async () => {
        expect.assertions(1);
        try {
          await PolicyOps.deletePolicy('DoesNotExist');
        } catch (error) {
          expect(error.response.data).toMatchSnapshot();
        }
      });
    });
  }
});
