import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { NodeRaw, state } from '../index';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mock = new MockAdapter(axios);

state.default.session.setTenant('');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');

describe('NodeApi - getNodeTypes()', () => {
  test('getNodeTypes() 0: Method is implemented', async () => {
    expect(NodeRaw.getNodeTypes).toBeDefined();
  });

  test('getNodeTypes() 1: Get all node types', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/NodeApi/getNodeTypes/types.json'
        ),
        'utf8'
      )
    );
    mock
      .onPost(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes?_action=getAllTypes'
      )
      .reply(200, response);
    const types = await NodeRaw.getNodeTypes();
    expect(types).toBeTruthy();
    expect(types.result.length).toBe(99);
  });
});

describe('NodeApi - getNodes()', () => {
  test('getNodes() 0: Method is implemented', async () => {
    expect(NodeRaw.getNodes).toBeDefined();
  });

  test('getNodes() 1: Get all nodes', async () => {
    const response = {
      result: [
        {
          usernameAttribute: 'userName',
          validateInput: true,
          _id: '7fcaf48e-a754-4959-858b-05b2933b825f',
          _type: {
            _id: 'ValidatedUsernameNode',
            name: 'Platform Username',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          usernameAttribute: 'userName',
          validateInput: false,
          _id: '7354982f-57b6-4b04-9ddc-f1dd1e1e07d0',
          _type: {
            _id: 'ValidatedUsernameNode',
            name: 'Platform Username',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          interval: 'AT',
          identityAttribute: 'userName',
          amount: 3,
          _id: '8afdaec3-275e-4301-bb53-34f03e6a4b29',
          _type: {
            _id: 'LoginCountDecisionNode',
            name: 'Login Count Decision',
            collection: true,
          },
          _outcomes: [
            {
              id: 'true',
              displayName: 'True',
            },
            {
              id: 'false',
              displayName: 'False',
            },
          ],
        },
        {
          identityAttribute: 'mail',
          identifier: 'userName',
          _id: '21b8ddf3-0203-4ae1-ab05-51cf3a3a707a',
          _type: {
            _id: 'IdentifyExistingUserNode',
            name: 'Identify Existing User',
            collection: true,
          },
          _outcomes: [
            {
              id: 'true',
              displayName: 'True',
            },
            {
              id: 'false',
              displayName: 'False',
            },
          ],
        },
        {
          identityAttribute: 'mail',
          identifier: 'userName',
          _id: 'bf9ea8d5-9802-4f26-9664-a21840faac23',
          _type: {
            _id: 'IdentifyExistingUserNode',
            name: 'Identify Existing User',
            collection: true,
          },
          _outcomes: [
            {
              id: 'true',
              displayName: 'True',
            },
            {
              id: 'false',
              displayName: 'False',
            },
          ],
        },
        {
          _id: '59952413-9bc2-47e5-a9b2-b04c1d729e24',
          _type: {
            _id: 'UsernameCollectorNode',
            name: 'Username Collector',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          identityResource: 'managed/alpha_user',
          _id: 'ad5dcbb3-7335-49b7-b3e7-7d850bb88237',
          _type: {
            _id: 'CreateObjectNode',
            name: 'Create Object',
            collection: true,
          },
          _outcomes: [
            {
              id: 'CREATED',
              displayName: 'Created',
            },
            {
              id: 'FAILURE',
              displayName: 'Failed',
            },
          ],
        },
        {
          nodes: [
            {
              _id: '7354982f-57b6-4b04-9ddc-f1dd1e1e07d0',
              nodeType: 'ValidatedUsernameNode',
              displayName: 'Platform Username',
            },
            {
              _id: '0c80c39b-4813-4e67-b4fb-5a0bba85f994',
              nodeType: 'ValidatedPasswordNode',
              displayName: 'Platform Password',
            },
          ],
          pageDescription: {
            en: 'New here? <a href="#/service/Registration">Create an account</a><br><a href="#/service/ForgottenUsername">Forgot username?</a><a href="#/service/ResetPassword"> Forgot password?</a>',
          },
          pageHeader: {
            en: 'Sign In',
          },
          _id: 'a12bc72f-ad97-4f1e-a789-a1fa3dd566c8',
          _type: {
            _id: 'PageNode',
            name: 'Page Node',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          nodes: [
            {
              _id: '7fcaf48e-a754-4959-858b-05b2933b825f',
              nodeType: 'ValidatedUsernameNode',
              displayName: 'Platform Username',
            },
            {
              _id: 'd3ce2036-1523-4ce8-b1a2-895a2a036667',
              nodeType: 'AttributeCollectorNode',
              displayName: 'Attribute Collector',
            },
            {
              _id: '3d8709a1-f09f-4d1f-8094-2850e472c1db',
              nodeType: 'ValidatedPasswordNode',
              displayName: 'Platform Password',
            },
            {
              _id: '120c69d3-90b4-4ad4-b7af-380e8b119340',
              nodeType: 'KbaCreateNode',
              displayName: 'KBA Definition',
            },
            {
              _id: 'b4a0e915-c15d-4b83-9c9d-18347d645976',
              nodeType: 'AcceptTermsAndConditionsNode',
              displayName: 'Accept Terms and Conditions',
            },
          ],
          pageDescription: {
            en: "Signing up is fast and easy.<br>Already have an account? <a href='#/service/Login'>Sign In</a>",
          },
          pageHeader: {
            en: 'Sign Up',
          },
          _id: '0c091c49-f3af-48fb-ac6f-07fba0499dd6',
          _type: {
            _id: 'PageNode',
            name: 'Page Node',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          nodes: [
            {
              _id: '21a99653-a7a7-47ee-b650-f493a84bba09',
              nodeType: 'ValidatedPasswordNode',
              displayName: 'Platform Password',
            },
          ],
          pageDescription: {
            en: 'Enter new password',
          },
          pageHeader: {
            en: 'Update Password',
          },
          _id: 'd018fcd1-4e22-4160-8c41-63bee51c9cb3',
          _type: {
            _id: 'PageNode',
            name: 'Page Node',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          nodes: [
            {
              _id: '0a042e10-b22e-4e02-86c4-65e26e775f7a',
              nodeType: 'AttributeCollectorNode',
              displayName: 'Attribute Collector',
            },
          ],
          pageDescription: {},
          pageHeader: {
            en: 'Please select your preferences',
          },
          _id: 'a5aecad8-854a-4ed5-b719-ff6c90e858c0',
          _type: {
            _id: 'PageNode',
            name: 'Page Node',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          nodes: [
            {
              _id: 'fe2962fc-4db3-4066-8624-553649afc438',
              nodeType: 'ValidatedPasswordNode',
              displayName: 'Platform Password',
            },
          ],
          pageDescription: {
            en: 'Enter current password',
          },
          pageHeader: {
            en: 'Verify Existing Password',
          },
          _id: '20237b34-26cb-4a0b-958f-abb422290d42',
          _type: {
            _id: 'PageNode',
            name: 'Page Node',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          nodes: [
            {
              _id: '59952413-9bc2-47e5-a9b2-b04c1d729e24',
              nodeType: 'UsernameCollectorNode',
              displayName: 'Username Collector',
            },
            {
              _id: '8c217417-11dd-4a0f-a9e4-59c2390085be',
              nodeType: 'PasswordCollectorNode',
              displayName: 'Password Collector',
            },
          ],
          pageDescription: {},
          pageHeader: {},
          _id: '6b9a715d-ea23-4eae-9a59-69797c147157',
          _type: {
            _id: 'PageNode',
            name: 'Page Node',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          nodes: [
            {
              _id: '009c19c8-9572-47bb-adb2-1f092c559a43',
              nodeType: 'ValidatedPasswordNode',
              displayName: 'Platform Password',
            },
          ],
          pageDescription: {
            en: 'Change password',
          },
          pageHeader: {
            en: 'Reset Password',
          },
          _id: 'e4c752f9-c625-48c9-9644-a58802fa9e9c',
          _type: {
            _id: 'PageNode',
            name: 'Page Node',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          nodes: [
            {
              _id: 'a3f63691-1a79-4b11-be47-26f40403292d',
              nodeType: 'ScriptedDecisionNode',
              displayName: 'Remove Button',
            },
          ],
          pageDescription: {},
          stage: '{"themeId":"63e19668-909f-479e-83d7-be7a01cd8187"}',
          pageHeader: {
            en: 'No Access',
          },
          _id: 'bdda3e99-3a7f-45ec-b39d-17d1056af3c9',
          _type: {
            _id: 'PageNode',
            name: 'Page Node',
            collection: true,
          },
          _outcomes: [
            {
              id: 'true',
              displayName: 'true',
            },
          ],
        },
        {
          nodes: [
            {
              _id: '9f1e8d94-4922-481b-9e14-212b66548900',
              nodeType: 'AttributeCollectorNode',
              displayName: 'Attribute Collector',
            },
          ],
          pageDescription: {
            en: 'Enter your email address or <a href="#/service/Login">Sign in</a>',
          },
          pageHeader: {
            en: 'Forgotten Username',
          },
          _id: '5e2a7c95-94af-4b23-8724-deb13853726a',
          _type: {
            _id: 'PageNode',
            name: 'Page Node',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          nodes: [
            {
              _id: '276afa7c-a680-4cf4-a5f6-d6c78191f5c9',
              nodeType: 'AttributeCollectorNode',
              displayName: 'Attribute Collector',
            },
          ],
          pageDescription: {
            en: 'Enter your email address or <a href="#/service/Login">Sign in</a>',
          },
          pageHeader: {
            en: 'Reset Password',
          },
          _id: 'cc3e1ed2-25f1-47bf-83c6-17084f8b2b2b',
          _type: {
            _id: 'PageNode',
            name: 'Page Node',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          identityAttribute: 'userName',
          queryFilter:
            '!(/preferences pr) or /preferences/marketing eq false or /preferences/updates eq false',
          _id: 'a1f45b44-5bf7-4c57-aa3f-75c619c7db8e',
          _type: {
            _id: 'QueryFilterDecisionNode',
            name: 'Query Filter Decision',
            collection: true,
          },
          _outcomes: [
            {
              id: 'true',
              displayName: 'True',
            },
            {
              id: 'false',
              displayName: 'False',
            },
          ],
        },
        {
          _id: 'b4a0e915-c15d-4b83-9c9d-18347d645976',
          _type: {
            _id: 'AcceptTermsAndConditionsNode',
            name: 'Accept Terms and Conditions',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          sessionDataKey: 'UserToken',
          sharedStateKey: 'userName',
          _id: 'd1b79744-493a-44fe-bc26-7d324a8caa4e',
          _type: {
            _id: 'SessionDataNode',
            name: 'Get Session Data',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          emailSuspendMessage: {
            en: 'An email has been sent to the address you entered. Click the link in that email to proceed.',
          },
          emailTemplateName: 'forgottenUsername',
          identityAttribute: 'mail',
          emailAttribute: 'mail',
          objectLookup: true,
          _id: 'd9a79f01-2ce3-4be2-a28a-975f35c3c8ca',
          _type: {
            _id: 'EmailSuspendNode',
            name: 'Email Suspend Node',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          emailSuspendMessage: {
            en: 'An email has been sent to the address you entered. Click the link in that email to proceed.',
          },
          emailTemplateName: 'resetPassword',
          identityAttribute: 'mail',
          emailAttribute: 'mail',
          objectLookup: true,
          _id: '06c97be5-7fdd-4739-aea1-ecc7fe082865',
          _type: {
            _id: 'EmailSuspendNode',
            name: 'Email Suspend Node',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          emailSuspendMessage: {
            en: 'An email has been sent to your address, please verify your email address to update your password. Click the link in that email to proceed.',
          },
          emailTemplateName: 'updatePassword',
          identityAttribute: 'userName',
          emailAttribute: 'mail',
          objectLookup: true,
          _id: 'a3d97b53-e38a-4b24-aed0-a021050eb744',
          _type: {
            _id: 'EmailSuspendNode',
            name: 'Email Suspend Node',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          attributesToCollect: ['mail'],
          identityAttribute: 'mail',
          validateInputs: false,
          required: true,
          _id: '9f1e8d94-4922-481b-9e14-212b66548900',
          _type: {
            _id: 'AttributeCollectorNode',
            name: 'Attribute Collector',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          attributesToCollect: ['mail'],
          identityAttribute: 'mail',
          validateInputs: false,
          required: true,
          _id: '276afa7c-a680-4cf4-a5f6-d6c78191f5c9',
          _type: {
            _id: 'AttributeCollectorNode',
            name: 'Attribute Collector',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          attributesToCollect: ['preferences/updates', 'preferences/marketing'],
          identityAttribute: 'userName',
          validateInputs: false,
          required: false,
          _id: '0a042e10-b22e-4e02-86c4-65e26e775f7a',
          _type: {
            _id: 'AttributeCollectorNode',
            name: 'Attribute Collector',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          attributesToCollect: [
            'givenName',
            'sn',
            'mail',
            'preferences/marketing',
            'preferences/updates',
          ],
          identityAttribute: 'userName',
          validateInputs: true,
          required: true,
          _id: 'd3ce2036-1523-4ce8-b1a2-895a2a036667',
          _type: {
            _id: 'AttributeCollectorNode',
            name: 'Attribute Collector',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          _id: '8c217417-11dd-4a0f-a9e4-59c2390085be',
          _type: {
            _id: 'PasswordCollectorNode',
            name: 'Password Collector',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          passwordAttribute: 'password',
          validateInput: true,
          _id: '009c19c8-9572-47bb-adb2-1f092c559a43',
          _type: {
            _id: 'ValidatedPasswordNode',
            name: 'Platform Password',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          passwordAttribute: 'password',
          validateInput: true,
          _id: '3d8709a1-f09f-4d1f-8094-2850e472c1db',
          _type: {
            _id: 'ValidatedPasswordNode',
            name: 'Platform Password',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          passwordAttribute: 'password',
          validateInput: false,
          _id: '0c80c39b-4813-4e67-b4fb-5a0bba85f994',
          _type: {
            _id: 'ValidatedPasswordNode',
            name: 'Platform Password',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          passwordAttribute: 'password',
          validateInput: true,
          _id: '21a99653-a7a7-47ee-b650-f493a84bba09',
          _type: {
            _id: 'ValidatedPasswordNode',
            name: 'Platform Password',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          passwordAttribute: 'password',
          validateInput: false,
          _id: 'fe2962fc-4db3-4066-8624-553649afc438',
          _type: {
            _id: 'ValidatedPasswordNode',
            name: 'Platform Password',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          presentAttribute: 'password',
          identityAttribute: 'userName',
          _id: '0f0904e6-1da3-4cdb-9abf-0d2545016fab',
          _type: {
            _id: 'AttributePresentDecisionNode',
            name: 'Attribute Present Decision',
            collection: true,
          },
          _outcomes: [
            {
              id: 'true',
              displayName: 'True',
            },
            {
              id: 'false',
              displayName: 'False',
            },
          ],
        },
        {
          _id: '2998c1c9-f4c8-4a00-b2c6-3426783ee49d',
          _type: {
            _id: 'DataStoreDecisionNode',
            name: 'Data Store Decision',
            collection: true,
          },
          _outcomes: [
            {
              id: 'true',
              displayName: 'True',
            },
            {
              id: 'false',
              displayName: 'False',
            },
          ],
        },
        {
          _id: 'e2988546-a459-4c9a-b0e2-fa65ae136b34',
          _type: {
            _id: 'DataStoreDecisionNode',
            name: 'Data Store Decision',
            collection: true,
          },
          _outcomes: [
            {
              id: 'true',
              displayName: 'True',
            },
            {
              id: 'false',
              displayName: 'False',
            },
          ],
        },
        {
          _id: '7d1deabe-cd98-49c8-943f-ca12305775f3',
          _type: {
            _id: 'DataStoreDecisionNode',
            name: 'Data Store Decision',
            collection: true,
          },
          _outcomes: [
            {
              id: 'true',
              displayName: 'True',
            },
            {
              id: 'false',
              displayName: 'False',
            },
          ],
        },
        {
          identityAttribute: 'userName',
          _id: '97a15eb2-a015-4b6d-81a0-be78c3aa1a3b',
          _type: {
            _id: 'IncrementLoginCountNode',
            name: 'Increment Login Count',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          identityAttribute: 'userName',
          _id: 'bba3e0d8-8525-4e82-bf48-ac17f7988917',
          _type: {
            _id: 'IncrementLoginCountNode',
            name: 'Increment Login Count',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
        {
          tree: 'ProgressiveProfile',
          _id: '33b24514-3e50-4180-8f08-ab6f4e51b07e',
          _type: {
            _id: 'InnerTreeEvaluatorNode',
            name: 'Inner Tree Evaluator',
            collection: true,
          },
          _outcomes: [
            {
              id: 'true',
              displayName: 'True',
            },
            {
              id: 'false',
              displayName: 'False',
            },
          ],
        },
        {
          tree: 'iAccessRestrictions',
          _id: '2da98485-ee0e-4305-826c-b6fcc842a7b8',
          _type: {
            _id: 'InnerTreeEvaluatorNode',
            name: 'Inner Tree Evaluator',
            collection: true,
          },
          _outcomes: [
            {
              id: 'true',
              displayName: 'True',
            },
            {
              id: 'false',
              displayName: 'False',
            },
          ],
        },
        {
          tree: 'Login',
          _id: 'b93ce36e-1976-4610-b24f-8d6760b5463b',
          _type: {
            _id: 'InnerTreeEvaluatorNode',
            name: 'Inner Tree Evaluator',
            collection: true,
          },
          _outcomes: [
            {
              id: 'true',
              displayName: 'True',
            },
            {
              id: 'false',
              displayName: 'False',
            },
          ],
        },
        {
          identityResource: 'managed/alpha_user',
          patchAsObject: false,
          ignoredFields: [],
          identityAttribute: 'mail',
          _id: '989f0bf8-a328-4217-b82b-5275d79ca8bd',
          _type: {
            _id: 'PatchObjectNode',
            name: 'Patch Object',
            collection: true,
          },
          _outcomes: [
            {
              id: 'PATCHED',
              displayName: 'Patched',
            },
            {
              id: 'FAILURE',
              displayName: 'Failed',
            },
          ],
        },
        {
          identityResource: 'managed/alpha_user',
          patchAsObject: false,
          ignoredFields: [],
          identityAttribute: 'userName',
          _id: '423a959a-a1b9-498a-b0f7-596b6b6e775a',
          _type: {
            _id: 'PatchObjectNode',
            name: 'Patch Object',
            collection: true,
          },
          _outcomes: [
            {
              id: 'PATCHED',
              displayName: 'Patched',
            },
            {
              id: 'FAILURE',
              displayName: 'Failed',
            },
          ],
        },
        {
          identityResource: 'managed/alpha_user',
          patchAsObject: false,
          ignoredFields: ['userName'],
          identityAttribute: 'userName',
          _id: '3990ce1f-cce6-435b-ae1c-f138e89411c1',
          _type: {
            _id: 'PatchObjectNode',
            name: 'Patch Object',
            collection: true,
          },
          _outcomes: [
            {
              id: 'PATCHED',
              displayName: 'Patched',
            },
            {
              id: 'FAILURE',
              displayName: 'Failed',
            },
          ],
        },
        {
          script: '7fb962a5-9f20-41d3-a077-b424a29c1198',
          outcomes: ['allow', 'deny'],
          outputs: ['*'],
          inputs: ['*'],
          _id: 'f4e9be5d-25d7-44cc-b15e-989b99724b4d',
          _type: {
            _id: 'ScriptedDecisionNode',
            name: 'Scripted Decision',
            collection: true,
          },
          _outcomes: [
            {
              id: 'allow',
              displayName: 'allow',
            },
            {
              id: 'deny',
              displayName: 'deny',
            },
          ],
        },
        {
          script: '9535446c-0ff6-4a76-8576-616599119d64',
          outcomes: ['true'],
          outputs: ['*'],
          inputs: ['*'],
          _id: 'a3f63691-1a79-4b11-be47-26f40403292d',
          _type: {
            _id: 'ScriptedDecisionNode',
            name: 'Scripted Decision',
            collection: true,
          },
          _outcomes: [
            {
              id: 'true',
              displayName: 'true',
            },
          ],
        },
        {
          message: {
            en: 'Select a security question',
          },
          allowUserDefinedQuestions: true,
          _id: '120c69d3-90b4-4ad4-b7af-380e8b119340',
          _type: {
            _id: 'KbaCreateNode',
            name: 'KBA Definition',
            collection: true,
          },
          _outcomes: [
            {
              id: 'outcome',
              displayName: 'Outcome',
            },
          ],
        },
      ],
    };
    mock
      .onPost(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes?_action=nextdescendents'
      )
      .reply(200, response);
    const nodes = await NodeRaw.getNodes();
    expect(nodes).toBeTruthy();
    expect(nodes.result.length).toBe(48);
  });
});

describe('NodeApi - getNodesByType()', () => {
  test('getNodesByType() 0: Method is implemented', async () => {
    expect(NodeRaw.getNodesByType).toBeDefined();
  });

  test('getNodesByType() 1: Get all page nodes', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/NodeApi/getNodesByType/PageNode.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode?_queryFilter=true'
      )
      .reply(200, response);
    const nodes = await NodeRaw.getNodesByType('PageNode');
    expect(nodes).toBeTruthy();
    expect(nodes.result.length).toBe(161);
  });
});

describe('NodeApi - getNode()', () => {
  test('getNode() 0: Method is implemented', async () => {
    expect(NodeRaw.getNode).toBeDefined();
  });

  test('getNode() 1: Get existing page node [1aea363f-d8d2-4711-b88d-d58fff92dbae]', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/NodeApi/getNode/PageNode_1aea363f-d8d2-4711-b88d-d58fff92dbae.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/1aea363f-d8d2-4711-b88d-d58fff92dbae'
      )
      .reply(200, response);
    const node = await NodeRaw.getNode(
      '1aea363f-d8d2-4711-b88d-d58fff92dbae',
      'PageNode'
    );
    expect(node).toBeTruthy();
    expect(node).toMatchObject(response);
  });

  test('getNode() 2: Get non-existing page node [00000000-0000-0000-0000-000000000000]', async () => {
    mock
      .onGet(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/00000000-0000-0000-0000-000000000000'
      )
      .reply(404, {
        code: 404,
        reason: 'Not Found',
        message: 'Not Found',
      });
    expect.assertions(2);
    try {
      await NodeRaw.getNode('00000000-0000-0000-0000-000000000000', 'PageNode');
    } catch (error) {
      expect(error.response).toBeTruthy();
      expect(error.response.data).toMatchObject({
        code: 404,
        reason: 'Not Found',
        message: 'Not Found',
      });
    }
  });
});

describe('NodeApi - putNode()', () => {
  test('putNode() 0: Method is implemented', async () => {
    expect(NodeRaw.putNode).toBeDefined();
  });

  test('putNode() 1: Create page node [0ad90971-d08a-4af3-86f3-01729572dc8f]', async () => {
    const nodeData = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/NodeApi/putNode/PageNode_0ad90971-d08a-4af3-86f3-01729572dc8f.json'
        ),
        'utf8'
      )
    );
    mock
      .onPut(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/0ad90971-d08a-4af3-86f3-01729572dc8f'
      )
      .reply(201, nodeData);
    const node = await NodeRaw.putNode(
      '0ad90971-d08a-4af3-86f3-01729572dc8f',
      'PageNode',
      nodeData
    );
    expect(node).toBeTruthy();
    expect(node).toMatchObject(nodeData);
  });

  test('putNode() 1: Update existing page node [1aea363f-d8d2-4711-b88d-d58fff92dbae]', async () => {
    const nodeData = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/NodeApi/putNode/PageNode_1aea363f-d8d2-4711-b88d-d58fff92dbae.json'
        ),
        'utf8'
      )
    );
    mock
      .onPut(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/1aea363f-d8d2-4711-b88d-d58fff92dbae'
      )
      .reply(200, nodeData);
    const node = await NodeRaw.putNode(
      '1aea363f-d8d2-4711-b88d-d58fff92dbae',
      'PageNode',
      nodeData
    );
    expect(node).toBeTruthy();
    expect(node).toMatchObject(nodeData);
  });
});

describe('NodeApi - deleteNode()', () => {
  test('deleteNode() 0: Method is implemented', async () => {
    expect(NodeRaw.deleteNode).toBeDefined();
  });

  test('deleteNode() 1: Delete existing node [1aea363f-d8d2-4711-b88d-d58fff92dbae]', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/NodeApi/deleteNode/PageNode_1aea363f-d8d2-4711-b88d-d58fff92dbae.json'
        ),
        'utf8'
      )
    );
    mock
      .onDelete(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/1aea363f-d8d2-4711-b88d-d58fff92dbae'
      )
      .reply(200, response);
    const node = await NodeRaw.deleteNode(
      '1aea363f-d8d2-4711-b88d-d58fff92dbae',
      'PageNode'
    );
    expect(node).toBeTruthy();
    expect(node._id).toEqual('1aea363f-d8d2-4711-b88d-d58fff92dbae');
  });

  test('deleteNode() 2: Delete non-existing node [00000000-0000-0000-0000-000000000000]', async () => {
    mock
      .onDelete(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/00000000-0000-0000-0000-000000000000'
      )
      .reply(404, {
        code: 404,
        reason: 'Not Found',
        message: 'Not Found',
      });
    expect.assertions(2);
    try {
      await NodeRaw.deleteNode(
        '00000000-0000-0000-0000-000000000000',
        'PageNode'
      );
    } catch (error) {
      expect(error.response).toBeTruthy();
      expect(error.response.data).toMatchObject({
        code: 404,
        reason: 'Not Found',
        message: 'Not Found',
      });
    }
  });
});
