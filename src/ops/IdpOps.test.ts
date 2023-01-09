/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record IdpOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update IdpOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only IdpOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { Idp } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';

autoSetupPolly();

async function stageIdp(
  idp: { id: string; type: string; data: object },
  create = true
) {
  // delete if exists, then create
  try {
    await Idp.getSocialProvider(idp.id);
    await Idp.deleteSocialProvider(idp.id);
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await Idp.putProviderByTypeAndId(idp.type, idp.id, idp.data);
    }
  }
}

describe('IdpOps', () => {
  const idp1 = {
    id: 'FrodoTestIdp1',
    type: 'oauth2Config',
    data: {
      clientId: '123741718342521',
      pkceMethod: 'S256',
      jwtEncryptionMethod: 'NONE',
      authorizationEndpoint: 'https://www.facebook.com/dialog/oauth',
      jwtEncryptionAlgorithm: 'NONE',
      clientSecret: '5up3r53cr3t!',
      issuerComparisonCheckType: 'EXACT',
      scopeDelimiter: ' ',
      scopes: ['email'],
      enabled: true,
      authenticationIdKey: 'id',
      uiConfig: {
        buttonClass: 'fa-facebook-official',
        buttonCustomStyle:
          'background-color: #3b5998; border-color: #3b5998; color: white;',
        buttonCustomStyleHover:
          'background-color: #334b7d; border-color: #334b7d; color: white;',
        buttonDisplayName: 'Facebook',
        buttonImage: '',
        iconBackground: '#3b5998',
        iconClass: 'fa-facebook',
        iconFontColor: 'white',
      },
      privateKeyJwtExpTime: 3600,
      revocationCheckOptions: [],
      transform: 'bae1d54a-e97d-4997-aa5d-c027f21af82c',
      userInfoEndpoint:
        'https://graph.facebook.com/me?fields=id,name,picture,email,first_name,last_name,locale',
      jwtSigningAlgorithm: 'NONE',
      redirectURI: 'https://idc.scheuber.io/am/XUI/?realm=%2Falpha',
      clientAuthenticationMethod: 'CLIENT_SECRET_POST',
      responseMode: 'DEFAULT',
      useCustomTrustStore: false,
      tokenEndpoint: 'https://graph.facebook.com/v2.7/oauth/access_token',
      _id: 'FrodoTestIdp1',
      _type: {
        _id: 'oauth2Config',
        name: 'Client configuration for providers that implement the OAuth2 specification.',
        collection: true,
      },
    },
  };
  const idp2 = {
    id: 'FrodoTestIdp2',
    type: 'googleConfig',
    data: {
      clientId:
        '297318173925-mho17cgnm550s2gre7h27feb6sbs2msd.apps.googleusercontent.com',
      pkceMethod: 'S256',
      wellKnownEndpoint:
        'https://accounts.google.com/.well-known/openid-configuration',
      jwtEncryptionMethod: 'NONE',
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      jwtEncryptionAlgorithm: 'NONE',
      clientSecret: null,
      issuerComparisonCheckType: 'EXACT',
      encryptJwtRequestParameter: false,
      scopeDelimiter: ' ',
      scopes: ['openid', 'profile', 'email'],
      issuer: 'https://accounts.google.com',
      userInfoResponseType: 'JSON',
      acrValues: [],
      encryptedIdTokens: false,
      enabled: true,
      jwtRequestParameterOption: 'NONE',
      authenticationIdKey: 'sub',
      uiConfig: {
        buttonClass: '',
        buttonCustomStyle:
          'background-color: #fff; color: #757575; border-color: #ddd;',
        buttonCustomStyleHover:
          'color: #6d6d6d; background-color: #eee; border-color: #ccc;',
        buttonDisplayName: 'Google',
        buttonImage: 'images/g-logo.png',
        iconBackground: '#4184f3',
        iconClass: 'fa-google',
        iconFontColor: 'white',
      },
      privateKeyJwtExpTime: 600,
      revocationCheckOptions: [],
      enableNativeNonce: true,
      transform: '58d29080-4563-480b-89bb-1e7719776a21',
      userInfoEndpoint: 'https://www.googleapis.com/oauth2/v3/userinfo',
      jwtSigningAlgorithm: 'NONE',
      redirectURI: 'https://idc.scheuber.io/login',
      clientAuthenticationMethod: 'CLIENT_SECRET_POST',
      responseMode: 'DEFAULT',
      useCustomTrustStore: false,
      tokenEndpoint: 'https://www.googleapis.com/oauth2/v4/token',
      _id: 'FrodoTestIdp2',
      _type: {
        _id: 'googleConfig',
        name: 'Client configuration for Google.',
        collection: true,
      },
    },
  };
  const idp3 = {
    id: 'FrodoTestIdp3',
    type: 'oidcConfig',
    data: {
      clientId: '0oa13r2cp29Rynmyw697',
      pkceMethod: 'S256',
      wellKnownEndpoint:
        'https://trial-1234567.okta.com/.well-known/openid-configuration',
      jwtEncryptionMethod: 'NONE',
      authorizationEndpoint:
        'https://trial-1234567.okta.com/oauth2/v1/authorize',
      jwtEncryptionAlgorithm: 'NONE',
      clientSecret: null,
      issuerComparisonCheckType: 'EXACT',
      encryptJwtRequestParameter: false,
      scopeDelimiter: ' ',
      scopes: ['openid', 'profile', 'email'],
      issuer: 'https://trial-1234567.okta.com',
      userInfoResponseType: 'JSON',
      acrValues: [],
      encryptedIdTokens: false,
      enabled: true,
      jwtRequestParameterOption: 'NONE',
      authenticationIdKey: 'id',
      uiConfig: {
        buttonDisplayName: 'Okta',
      },
      privateKeyJwtExpTime: 600,
      revocationCheckOptions: [],
      enableNativeNonce: true,
      transform: '6325cf19-a49b-471e-8d26-7e4df76df0e2',
      userInfoEndpoint: 'https://trial-1234567.okta.com/oauth2/v1/userinfo',
      jwtSigningAlgorithm: 'NONE',
      redirectURI: 'https://idc.scheuber.io/login',
      clientAuthenticationMethod: 'CLIENT_SECRET_POST',
      responseMode: 'DEFAULT',
      useCustomTrustStore: false,
      tokenEndpoint: 'https://trial-1234567.okta.com/oauth2/v1/token',
      _id: 'FrodoTestIdp3',
      _type: {
        _id: 'oidcConfig',
        name: 'Client configuration for providers that implement the OpenID Connect specification.',
        collection: true,
      },
    },
  };
  const idp4 = {
    id: 'FrodoTestIdp4',
    type: 'none',
    data: {},
  };
  const idp5 = {
    id: 'FrodoTestIdp5',
    type: 'none',
    data: {},
  };
  const idp6 = {
    id: 'FrodoTestIdp6',
    type: 'none',
    data: {},
  };
  const idp7 = {
    id: 'FrodoTestIdp7',
    type: 'none',
    data: {},
  };
  const idp8 = {
    id: 'FrodoTestIdp8',
    type: 'none',
    data: {},
  };
  const import1: { id: string; data: Idp.SocialProviderExportInterface } = {
    id: 'FrodoTestIdp4',
    data: {
      meta: {
        origin: 'https://openam-volker-dev.forgeblocks.com/am',
        originAmVersion: '7.3.0',
        exportedBy: 'volker.scheuber@forgerock.com',
        exportDate: '2022-12-28T19:02:10.599Z',
        exportTool: 'frodo',
        exportToolVersion: 'v0.17.2-0 [v18.7.0]',
      },
      script: {
        'dbe0bf9a-72aa-49d5-8483-9db147985a47': {
          _id: 'dbe0bf9a-72aa-49d5-8483-9db147985a47',
          name: 'ADFS Profile Normalization (JS)',
          description: 'Normalizes raw profile data from ADFS',
          script: [
            '/*',
            ' * Copyright 2022 ForgeRock AS. All Rights Reserved',
            ' *',
            ' * Use of this code requires a commercial software license with ForgeRock AS',
            ' * or with one of its affiliates. All use shall be exclusively subject',
            ' * to such license between the licensee and ForgeRock AS.',
            ' */',
            '',
            '/*',
            ' * This script returns the social identity profile information for the authenticating user',
            ' * in a standard form expected by the Social Provider Handler Node.',
            ' *',
            ' * Defined variables:',
            ' * rawProfile - The social identity provider profile information for the authenticating user.',
            ' *              JsonValue (1).',
            ' * logger - The debug logger instance:',
            ' *          https://backstage.forgerock.com/docs/am/7/scripting-guide/scripting-api-global-logger.html#scripting-api-global-logger.',
            ' * realm - String (primitive).',
            ' *         The name of the realm the user is authenticating to.',
            ' * requestHeaders - TreeMap (2).',
            ' *                  The object that provides methods for accessing headers in the login request:',
            ' *                  https://backstage.forgerock.com/docs/am/7/authentication-guide/scripting-api-node.html#scripting-api-node-requestHeaders.',
            ' * requestParameters - TreeMap (2).',
            ' *                     The object that contains the authentication request parameters.',
            ' * selectedIdp - String (primitive).',
            ' *               The social identity provider name. For example: google.',
            ' * sharedState - LinkedHashMap (3).',
            ' *               The object that holds the state of the authentication tree and allows data exchange between the stateless nodes:',
            ' *               https://backstage.forgerock.com/docs/am/7/auth-nodes/core-action.html#accessing-tree-state.',
            ' * transientState - LinkedHashMap (3).',
            ' *                  The object for storing sensitive information that must not leave the server unencrypted,',
            ' *                  and that may not need to persist between authentication requests during the authentication session:',
            ' *                  https://backstage.forgerock.com/docs/am/7/auth-nodes/core-action.html#accessing-tree-state.',
            ' *',
            ' * Return - a JsonValue (1).',
            ' *          The result of the last statement in the script is returned to the server.',
            ' *          Currently, the Immediately Invoked Function Expression (also known as Self-Executing Anonymous Function)',
            ' *          is the last (and only) statement in this script, and its return value will become the script result.',
            ' *          Do not use "return variable" statement outside of a function definition.',
            ' *',
            " *          This script's last statement should result in a JsonValue (1) with the following keys:",
            ' *          {',
            ' *              {"displayName": "corresponding-social-identity-provider-value"},',
            ' *              {"email": "corresponding-social-identity-provider-value"},',
            ' *              {"familyName": "corresponding-social-identity-provider-value"},',
            ' *              {"givenName": "corresponding-social-identity-provider-value"},',
            ' *              {"id": "corresponding-social-identity-provider-value"},',
            ' *              {"locale": "corresponding-social-identity-provider-value"},',
            ' *              {"photoUrl": "corresponding-social-identity-provider-value"},',
            ' *              {"username": "corresponding-social-identity-provider-value"}',
            ' *          }',
            ' *',
            ' *          The consumer of this data defines which keys are required and which are optional.',
            ' *          For example, the script associated with the Social Provider Handler Node and,',
            ' *          ultimately, the managed object created/updated with this data',
            ' *          will expect certain keys to be populated.',
            ' *          In some common default configurations, the following keys are required to be not empty:',
            ' *          username, givenName, familyName, email.',
            ' *',
            ' *          From RFC4517: A value of the Directory String syntax is a string of one or more',
            ' *          arbitrary characters from the Universal Character Set (UCS).',
            ' *          A zero-length character string is not permitted.',
            ' *',
            ' * (1) JsonValue - https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/json/JsonValue.html.',
            ' * (2) TreeMap - https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/TreeMap.html.',
            ' * (3) LinkedHashMap - https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/LinkedHashMap.html.',
            ' */',
            '',
            '(function () {',
            '    var frJava = JavaImporter(',
            '        org.forgerock.json.JsonValue',
            '    );',
            '',
            '    var normalizedProfileData = frJava.JsonValue.json(frJava.JsonValue.object());',
            '  ',
            "      //logger.message('Seguin rawProfile: '+rawProfile);",
            '',
            "    normalizedProfileData.put('id', rawProfile.get('sub').asString());",
            "    normalizedProfileData.put('displayName', rawProfile.get('givenName').asString() + ' ' + rawProfile.get('sn').asString());",
            "    normalizedProfileData.put('email', rawProfile.get('mail').asString());",
            "    normalizedProfileData.put('givenName', rawProfile.get('givenName').asString());",
            "    normalizedProfileData.put('familyName', rawProfile.get('sn').asString());",
            "    normalizedProfileData.put('username', rawProfile.get('upn').asString());",
            "    normalizedProfileData.put('roles', rawProfile.get('roles').asString());",
            '  ',
            "      //logger.message('Seguin normalizedProfileData: '+normalizedProfileData);",
            '',
            '    return normalizedProfileData;',
            '}());',
          ],
          default: false,
          language: 'JAVASCRIPT',
          context: 'SOCIAL_IDP_PROFILE_TRANSFORMATION',
          createdBy: 'null',
          creationDate: 0,
          lastModifiedBy: 'null',
          lastModifiedDate: 0,
        },
      },
      idp: {
        FrodoTestIdp4: {
          clientId: 'aa9a179e-cdba-4db8-8477-3d1069d5ec04',
          pkceMethod: 'S256',
          wellKnownEndpoint:
            'https://adfs.mytestrun.com/adfs/.well-known/openid-configuration',
          jwtEncryptionMethod: 'NONE',
          authorizationEndpoint:
            'https://adfs.mytestrun.com/adfs/oauth2/authorize',
          jwtEncryptionAlgorithm: 'NONE',
          clientSecret: null,
          issuerComparisonCheckType: 'EXACT',
          encryptJwtRequestParameter: false,
          scopeDelimiter: ' ',
          scopes: ['openid', 'profile', 'email'],
          issuer: 'https://adfs.mytestrun.com/adfs',
          userInfoResponseType: 'JSON',
          acrValues: [],
          jwksUriEndpoint: 'https://adfs.mytestrun.com/adfs/discovery/keys',
          encryptedIdTokens: false,
          enabled: true,
          jwtRequestParameterOption: 'NONE',
          authenticationIdKey: 'sub',
          uiConfig: {
            buttonClass: '',
            buttonCustomStyle:
              'background-color: #fff; border-color: #8b8b8b; color: #8b8b8b;',
            buttonCustomStyleHover:
              'background-color: #fff; border-color: #8b8b8b; color: #8b8b8b;',
            buttonDisplayName: 'Microsoft ADFS',
            buttonImage: '/login/images/microsoft-logo.png',
            iconBackground: '#0078d7',
            iconClass: 'fa-windows',
            iconFontColor: 'white',
          },
          privateKeyJwtExpTime: 600,
          revocationCheckOptions: [],
          enableNativeNonce: true,
          transform: 'dbe0bf9a-72aa-49d5-8483-9db147985a47',
          jwtSigningAlgorithm: 'RS256',
          redirectURI: 'https://idc.scheuber.io/login',
          clientAuthenticationMethod: 'CLIENT_SECRET_POST',
          responseMode: 'DEFAULT',
          useCustomTrustStore: false,
          tokenEndpoint: 'https://adfs.mytestrun.com/adfs/oauth2/token',
          _id: 'FrodoTestIdp4',
          _type: {
            _id: 'oidcConfig',
            name: 'Client configuration for providers that implement the OpenID Connect specification.',
            collection: true,
          },
        },
      },
    },
  };
  const importData1: Idp.SocialProviderExportInterface = {
    meta: {
      origin: 'https://openam-volker-dev.forgeblocks.com/am',
      originAmVersion: '7.3.0',
      exportedBy: 'volker.scheuber@forgerock.com',
      exportDate: '2022-12-28T19:02:10.599Z',
      exportTool: 'frodo',
      exportToolVersion: 'v0.17.2-0 [v18.7.0]',
    },
    script: {
      'dbe0bf9a-72aa-49d5-8483-9db147985a47': {
        _id: 'dbe0bf9a-72aa-49d5-8483-9db147985a47',
        name: 'ADFS Profile Normalization (JS)',
        description: 'Normalizes raw profile data from ADFS',
        script: [
          '/*',
          ' * Copyright 2022 ForgeRock AS. All Rights Reserved',
          ' *',
          ' * Use of this code requires a commercial software license with ForgeRock AS',
          ' * or with one of its affiliates. All use shall be exclusively subject',
          ' * to such license between the licensee and ForgeRock AS.',
          ' */',
          '',
          '/*',
          ' * This script returns the social identity profile information for the authenticating user',
          ' * in a standard form expected by the Social Provider Handler Node.',
          ' *',
          ' * Defined variables:',
          ' * rawProfile - The social identity provider profile information for the authenticating user.',
          ' *              JsonValue (1).',
          ' * logger - The debug logger instance:',
          ' *          https://backstage.forgerock.com/docs/am/7/scripting-guide/scripting-api-global-logger.html#scripting-api-global-logger.',
          ' * realm - String (primitive).',
          ' *         The name of the realm the user is authenticating to.',
          ' * requestHeaders - TreeMap (2).',
          ' *                  The object that provides methods for accessing headers in the login request:',
          ' *                  https://backstage.forgerock.com/docs/am/7/authentication-guide/scripting-api-node.html#scripting-api-node-requestHeaders.',
          ' * requestParameters - TreeMap (2).',
          ' *                     The object that contains the authentication request parameters.',
          ' * selectedIdp - String (primitive).',
          ' *               The social identity provider name. For example: google.',
          ' * sharedState - LinkedHashMap (3).',
          ' *               The object that holds the state of the authentication tree and allows data exchange between the stateless nodes:',
          ' *               https://backstage.forgerock.com/docs/am/7/auth-nodes/core-action.html#accessing-tree-state.',
          ' * transientState - LinkedHashMap (3).',
          ' *                  The object for storing sensitive information that must not leave the server unencrypted,',
          ' *                  and that may not need to persist between authentication requests during the authentication session:',
          ' *                  https://backstage.forgerock.com/docs/am/7/auth-nodes/core-action.html#accessing-tree-state.',
          ' *',
          ' * Return - a JsonValue (1).',
          ' *          The result of the last statement in the script is returned to the server.',
          ' *          Currently, the Immediately Invoked Function Expression (also known as Self-Executing Anonymous Function)',
          ' *          is the last (and only) statement in this script, and its return value will become the script result.',
          ' *          Do not use "return variable" statement outside of a function definition.',
          ' *',
          " *          This script's last statement should result in a JsonValue (1) with the following keys:",
          ' *          {',
          ' *              {"displayName": "corresponding-social-identity-provider-value"},',
          ' *              {"email": "corresponding-social-identity-provider-value"},',
          ' *              {"familyName": "corresponding-social-identity-provider-value"},',
          ' *              {"givenName": "corresponding-social-identity-provider-value"},',
          ' *              {"id": "corresponding-social-identity-provider-value"},',
          ' *              {"locale": "corresponding-social-identity-provider-value"},',
          ' *              {"photoUrl": "corresponding-social-identity-provider-value"},',
          ' *              {"username": "corresponding-social-identity-provider-value"}',
          ' *          }',
          ' *',
          ' *          The consumer of this data defines which keys are required and which are optional.',
          ' *          For example, the script associated with the Social Provider Handler Node and,',
          ' *          ultimately, the managed object created/updated with this data',
          ' *          will expect certain keys to be populated.',
          ' *          In some common default configurations, the following keys are required to be not empty:',
          ' *          username, givenName, familyName, email.',
          ' *',
          ' *          From RFC4517: A value of the Directory String syntax is a string of one or more',
          ' *          arbitrary characters from the Universal Character Set (UCS).',
          ' *          A zero-length character string is not permitted.',
          ' *',
          ' * (1) JsonValue - https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/json/JsonValue.html.',
          ' * (2) TreeMap - https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/TreeMap.html.',
          ' * (3) LinkedHashMap - https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/LinkedHashMap.html.',
          ' */',
          '',
          '(function () {',
          '    var frJava = JavaImporter(',
          '        org.forgerock.json.JsonValue',
          '    );',
          '',
          '    var normalizedProfileData = frJava.JsonValue.json(frJava.JsonValue.object());',
          '  ',
          "      //logger.message('Seguin rawProfile: '+rawProfile);",
          '',
          "    normalizedProfileData.put('id', rawProfile.get('sub').asString());",
          "    normalizedProfileData.put('displayName', rawProfile.get('givenName').asString() + ' ' + rawProfile.get('sn').asString());",
          "    normalizedProfileData.put('email', rawProfile.get('mail').asString());",
          "    normalizedProfileData.put('givenName', rawProfile.get('givenName').asString());",
          "    normalizedProfileData.put('familyName', rawProfile.get('sn').asString());",
          "    normalizedProfileData.put('username', rawProfile.get('upn').asString());",
          "    normalizedProfileData.put('roles', rawProfile.get('roles').asString());",
          '  ',
          "      //logger.message('Seguin normalizedProfileData: '+normalizedProfileData);",
          '',
          '    return normalizedProfileData;',
          '}());',
        ],
        default: false,
        language: 'JAVASCRIPT',
        context: 'SOCIAL_IDP_PROFILE_TRANSFORMATION',
        createdBy: 'null',
        creationDate: 0,
        lastModifiedBy: 'null',
        lastModifiedDate: 0,
      },
      '484e6246-dbc6-4288-97e6-54e55431402e': {
        _id: '484e6246-dbc6-4288-97e6-54e55431402e',
        name: 'Apple Profile Normalization',
        description: 'Normalizes raw profile data from Apple',
        script: [
          '/*',
          ' * Copyright 2021-2022 ForgeRock AS. All Rights Reserved',
          ' *',
          ' * Use of this code requires a commercial software license with ForgeRock AS.',
          ' * or with one of its affiliates. All use shall be exclusively subject',
          ' * to such license between the licensee and ForgeRock AS.',
          ' *',
          ' * In some common default configurations, the following keys are required to be not empty:',
          ' * username, givenName, familyName, email.',
          ' *',
          ' * From RFC4517: A value of the Directory String syntax is a string of one or more',
          ' * arbitrary characters from the Universal Character Set (UCS).',
          ' * A zero-length character string is not permitted.',
          ' */',
          '',
          'import static org.forgerock.json.JsonValue.field',
          'import static org.forgerock.json.JsonValue.json',
          'import static org.forgerock.json.JsonValue.object',
          '',
          'String email = "change@me.com"',
          'String subjectId = rawProfile.sub',
          'String firstName = " "',
          'String lastName = " "',
          'String username = subjectId',
          'String name',
          '',
          'if (rawProfile.isDefined("email") && rawProfile.email.isNotNull()){ // User can elect to not share their email',
          '    email = rawProfile.email.asString()',
          '    username = email',
          '}',
          'if (rawProfile.isDefined("name") && rawProfile.name.isNotNull()) {',
          '    if (rawProfile.name.isDefined("firstName") && rawProfile.name.firstName.isNotNull()) {',
          '        firstName = rawProfile.name.firstName.asString()',
          '    }',
          '    if (rawProfile.name.isDefined("lastName") && rawProfile.name.lastName.isNotNull()) {',
          '        lastName = rawProfile.name.lastName.asString()',
          '    }',
          '}',
          '',
          'name = (firstName?.trim() ? firstName : "") + (lastName?.trim() ? ((firstName?.trim() ? " " : "") + lastName) : "")',
          'name =  (!name?.trim()) ? " " : name',
          '',
          'return json(object(',
          '        field("id", subjectId),',
          '        field("displayName", name),',
          '        field("email", email),',
          '        field("givenName", firstName),',
          '        field("familyName", lastName),',
          '        field("username", username)))',
        ],
        default: true,
        language: 'GROOVY',
        context: 'SOCIAL_IDP_PROFILE_TRANSFORMATION',
        createdBy: 'null',
        creationDate: 0,
        lastModifiedBy: 'null',
        lastModifiedDate: 0,
      },
    },
    idp: {
      FrodoTestIdp5: {
        clientId: 'aa9a179e-cdba-4db8-8477-3d1069d5ec04',
        pkceMethod: 'S256',
        wellKnownEndpoint:
          'https://adfs.mytestrun.com/adfs/.well-known/openid-configuration',
        jwtEncryptionMethod: 'NONE',
        authorizationEndpoint:
          'https://adfs.mytestrun.com/adfs/oauth2/authorize',
        jwtEncryptionAlgorithm: 'NONE',
        clientSecret: null,
        issuerComparisonCheckType: 'EXACT',
        encryptJwtRequestParameter: false,
        scopeDelimiter: ' ',
        scopes: ['openid', 'profile', 'email'],
        issuer: 'https://adfs.mytestrun.com/adfs',
        userInfoResponseType: 'JSON',
        acrValues: [],
        jwksUriEndpoint: 'https://adfs.mytestrun.com/adfs/discovery/keys',
        encryptedIdTokens: false,
        enabled: true,
        jwtRequestParameterOption: 'NONE',
        authenticationIdKey: 'sub',
        uiConfig: {
          buttonClass: '',
          buttonCustomStyle:
            'background-color: #fff; border-color: #8b8b8b; color: #8b8b8b;',
          buttonCustomStyleHover:
            'background-color: #fff; border-color: #8b8b8b; color: #8b8b8b;',
          buttonDisplayName: 'Microsoft ADFS',
          buttonImage: '/login/images/microsoft-logo.png',
          iconBackground: '#0078d7',
          iconClass: 'fa-windows',
          iconFontColor: 'white',
        },
        privateKeyJwtExpTime: 600,
        revocationCheckOptions: [],
        enableNativeNonce: true,
        transform: 'dbe0bf9a-72aa-49d5-8483-9db147985a47',
        jwtSigningAlgorithm: 'RS256',
        redirectURI: 'https://idc.scheuber.io/login',
        clientAuthenticationMethod: 'CLIENT_SECRET_POST',
        responseMode: 'DEFAULT',
        useCustomTrustStore: false,
        tokenEndpoint: 'https://adfs.mytestrun.com/adfs/oauth2/token',
        _id: 'FrodoTestIdp5',
        _type: {
          _id: 'oidcConfig',
          name: 'Client configuration for providers that implement the OpenID Connect specification.',
          collection: true,
        },
      },
      FrodoTestIdp6: {
        clientId: 'io.scheuber.idc.signinWithApple.service',
        pkceMethod: 'S256',
        wellKnownEndpoint:
          'https://appleid.apple.com/.well-known/openid-configuration',
        jwtEncryptionMethod: 'NONE',
        authorizationEndpoint: 'https://appleid.apple.com/auth/authorize',
        jwtEncryptionAlgorithm: 'NONE',
        clientSecret: null,
        issuerComparisonCheckType: 'EXACT',
        encryptJwtRequestParameter: false,
        scopeDelimiter: ' ',
        scopes: ['name', 'email'],
        issuer: 'https://appleid.apple.com',
        redirectAfterFormPostURI: 'https://idc.scheuber.io/login',
        userInfoResponseType: 'JSON',
        acrValues: [],
        jwksUriEndpoint: 'https://appleid.apple.com/auth/keys',
        encryptedIdTokens: false,
        requestNativeAppForUserInfo: false,
        enabled: true,
        jwtRequestParameterOption: 'NONE',
        authenticationIdKey: 'sub',
        uiConfig: {
          buttonClass: '',
          buttonCustomStyle:
            'background-color: #000000; color: #ffffff; border-color: #000000;',
          buttonCustomStyleHover:
            'background-color: #000000; color: #ffffff; border-color: #000000;',
          buttonDisplayName: 'Apple',
          buttonImage: '/login/images/apple-logo.png',
          iconBackground: '#000000',
          iconClass: 'fa-apple',
          iconFontColor: 'white',
        },
        privateKeyJwtExpTime: 600,
        revocationCheckOptions: [],
        enableNativeNonce: true,
        transform: '484e6246-dbc6-4288-97e6-54e55431402e',
        jwtSigningAlgorithm: 'NONE',
        redirectURI:
          'https://idc.scheuber.io/am/oauth2/client/form_post/apple_web',
        clientAuthenticationMethod: 'CLIENT_SECRET_POST',
        responseMode: 'FORM_POST',
        useCustomTrustStore: false,
        tokenEndpoint: 'https://appleid.apple.com/auth/token',
        _id: 'FrodoTestIdp6',
        _type: {
          _id: 'appleConfig',
          name: 'Client configuration for Apple.',
          collection: true,
        },
      },
    },
  };
  const importData2: Idp.SocialProviderExportInterface = {
    meta: {
      origin: 'https://openam-volker-dev.forgeblocks.com/am',
      originAmVersion: '7.3.0',
      exportedBy: 'volker.scheuber@forgerock.com',
      exportDate: '2022-12-28T19:02:10.599Z',
      exportTool: 'frodo',
      exportToolVersion: 'v0.17.2-0 [v18.7.0]',
    },
    script: {
      'dbe0bf9a-72aa-49d5-8483-9db147985a47': {
        _id: 'dbe0bf9a-72aa-49d5-8483-9db147985a47',
        name: 'ADFS Profile Normalization (JS)',
        description: 'Normalizes raw profile data from ADFS',
        script: [
          '/*',
          ' * Copyright 2022 ForgeRock AS. All Rights Reserved',
          ' *',
          ' * Use of this code requires a commercial software license with ForgeRock AS',
          ' * or with one of its affiliates. All use shall be exclusively subject',
          ' * to such license between the licensee and ForgeRock AS.',
          ' */',
          '',
          '/*',
          ' * This script returns the social identity profile information for the authenticating user',
          ' * in a standard form expected by the Social Provider Handler Node.',
          ' *',
          ' * Defined variables:',
          ' * rawProfile - The social identity provider profile information for the authenticating user.',
          ' *              JsonValue (1).',
          ' * logger - The debug logger instance:',
          ' *          https://backstage.forgerock.com/docs/am/7/scripting-guide/scripting-api-global-logger.html#scripting-api-global-logger.',
          ' * realm - String (primitive).',
          ' *         The name of the realm the user is authenticating to.',
          ' * requestHeaders - TreeMap (2).',
          ' *                  The object that provides methods for accessing headers in the login request:',
          ' *                  https://backstage.forgerock.com/docs/am/7/authentication-guide/scripting-api-node.html#scripting-api-node-requestHeaders.',
          ' * requestParameters - TreeMap (2).',
          ' *                     The object that contains the authentication request parameters.',
          ' * selectedIdp - String (primitive).',
          ' *               The social identity provider name. For example: google.',
          ' * sharedState - LinkedHashMap (3).',
          ' *               The object that holds the state of the authentication tree and allows data exchange between the stateless nodes:',
          ' *               https://backstage.forgerock.com/docs/am/7/auth-nodes/core-action.html#accessing-tree-state.',
          ' * transientState - LinkedHashMap (3).',
          ' *                  The object for storing sensitive information that must not leave the server unencrypted,',
          ' *                  and that may not need to persist between authentication requests during the authentication session:',
          ' *                  https://backstage.forgerock.com/docs/am/7/auth-nodes/core-action.html#accessing-tree-state.',
          ' *',
          ' * Return - a JsonValue (1).',
          ' *          The result of the last statement in the script is returned to the server.',
          ' *          Currently, the Immediately Invoked Function Expression (also known as Self-Executing Anonymous Function)',
          ' *          is the last (and only) statement in this script, and its return value will become the script result.',
          ' *          Do not use "return variable" statement outside of a function definition.',
          ' *',
          " *          This script's last statement should result in a JsonValue (1) with the following keys:",
          ' *          {',
          ' *              {"displayName": "corresponding-social-identity-provider-value"},',
          ' *              {"email": "corresponding-social-identity-provider-value"},',
          ' *              {"familyName": "corresponding-social-identity-provider-value"},',
          ' *              {"givenName": "corresponding-social-identity-provider-value"},',
          ' *              {"id": "corresponding-social-identity-provider-value"},',
          ' *              {"locale": "corresponding-social-identity-provider-value"},',
          ' *              {"photoUrl": "corresponding-social-identity-provider-value"},',
          ' *              {"username": "corresponding-social-identity-provider-value"}',
          ' *          }',
          ' *',
          ' *          The consumer of this data defines which keys are required and which are optional.',
          ' *          For example, the script associated with the Social Provider Handler Node and,',
          ' *          ultimately, the managed object created/updated with this data',
          ' *          will expect certain keys to be populated.',
          ' *          In some common default configurations, the following keys are required to be not empty:',
          ' *          username, givenName, familyName, email.',
          ' *',
          ' *          From RFC4517: A value of the Directory String syntax is a string of one or more',
          ' *          arbitrary characters from the Universal Character Set (UCS).',
          ' *          A zero-length character string is not permitted.',
          ' *',
          ' * (1) JsonValue - https://backstage.forgerock.com/docs/am/7/apidocs/org/forgerock/json/JsonValue.html.',
          ' * (2) TreeMap - https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/TreeMap.html.',
          ' * (3) LinkedHashMap - https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/LinkedHashMap.html.',
          ' */',
          '',
          '(function () {',
          '    var frJava = JavaImporter(',
          '        org.forgerock.json.JsonValue',
          '    );',
          '',
          '    var normalizedProfileData = frJava.JsonValue.json(frJava.JsonValue.object());',
          '  ',
          "      //logger.message('Seguin rawProfile: '+rawProfile);",
          '',
          "    normalizedProfileData.put('id', rawProfile.get('sub').asString());",
          "    normalizedProfileData.put('displayName', rawProfile.get('givenName').asString() + ' ' + rawProfile.get('sn').asString());",
          "    normalizedProfileData.put('email', rawProfile.get('mail').asString());",
          "    normalizedProfileData.put('givenName', rawProfile.get('givenName').asString());",
          "    normalizedProfileData.put('familyName', rawProfile.get('sn').asString());",
          "    normalizedProfileData.put('username', rawProfile.get('upn').asString());",
          "    normalizedProfileData.put('roles', rawProfile.get('roles').asString());",
          '  ',
          "      //logger.message('Seguin normalizedProfileData: '+normalizedProfileData);",
          '',
          '    return normalizedProfileData;',
          '}());',
        ],
        default: false,
        language: 'JAVASCRIPT',
        context: 'SOCIAL_IDP_PROFILE_TRANSFORMATION',
        createdBy: 'null',
        creationDate: 0,
        lastModifiedBy: 'null',
        lastModifiedDate: 0,
      },
      '484e6246-dbc6-4288-97e6-54e55431402e': {
        _id: '484e6246-dbc6-4288-97e6-54e55431402e',
        name: 'Apple Profile Normalization',
        description: 'Normalizes raw profile data from Apple',
        script: [
          '/*',
          ' * Copyright 2021-2022 ForgeRock AS. All Rights Reserved',
          ' *',
          ' * Use of this code requires a commercial software license with ForgeRock AS.',
          ' * or with one of its affiliates. All use shall be exclusively subject',
          ' * to such license between the licensee and ForgeRock AS.',
          ' *',
          ' * In some common default configurations, the following keys are required to be not empty:',
          ' * username, givenName, familyName, email.',
          ' *',
          ' * From RFC4517: A value of the Directory String syntax is a string of one or more',
          ' * arbitrary characters from the Universal Character Set (UCS).',
          ' * A zero-length character string is not permitted.',
          ' */',
          '',
          'import static org.forgerock.json.JsonValue.field',
          'import static org.forgerock.json.JsonValue.json',
          'import static org.forgerock.json.JsonValue.object',
          '',
          'String email = "change@me.com"',
          'String subjectId = rawProfile.sub',
          'String firstName = " "',
          'String lastName = " "',
          'String username = subjectId',
          'String name',
          '',
          'if (rawProfile.isDefined("email") && rawProfile.email.isNotNull()){ // User can elect to not share their email',
          '    email = rawProfile.email.asString()',
          '    username = email',
          '}',
          'if (rawProfile.isDefined("name") && rawProfile.name.isNotNull()) {',
          '    if (rawProfile.name.isDefined("firstName") && rawProfile.name.firstName.isNotNull()) {',
          '        firstName = rawProfile.name.firstName.asString()',
          '    }',
          '    if (rawProfile.name.isDefined("lastName") && rawProfile.name.lastName.isNotNull()) {',
          '        lastName = rawProfile.name.lastName.asString()',
          '    }',
          '}',
          '',
          'name = (firstName?.trim() ? firstName : "") + (lastName?.trim() ? ((firstName?.trim() ? " " : "") + lastName) : "")',
          'name =  (!name?.trim()) ? " " : name',
          '',
          'return json(object(',
          '        field("id", subjectId),',
          '        field("displayName", name),',
          '        field("email", email),',
          '        field("givenName", firstName),',
          '        field("familyName", lastName),',
          '        field("username", username)))',
        ],
        default: true,
        language: 'GROOVY',
        context: 'SOCIAL_IDP_PROFILE_TRANSFORMATION',
        createdBy: 'null',
        creationDate: 0,
        lastModifiedBy: 'null',
        lastModifiedDate: 0,
      },
    },
    idp: {
      FrodoTestIdp7: {
        clientId: 'aa9a179e-cdba-4db8-8477-3d1069d5ec04',
        pkceMethod: 'S256',
        wellKnownEndpoint:
          'https://adfs.mytestrun.com/adfs/.well-known/openid-configuration',
        jwtEncryptionMethod: 'NONE',
        authorizationEndpoint:
          'https://adfs.mytestrun.com/adfs/oauth2/authorize',
        jwtEncryptionAlgorithm: 'NONE',
        clientSecret: null,
        issuerComparisonCheckType: 'EXACT',
        encryptJwtRequestParameter: false,
        scopeDelimiter: ' ',
        scopes: ['openid', 'profile', 'email'],
        issuer: 'https://adfs.mytestrun.com/adfs',
        userInfoResponseType: 'JSON',
        acrValues: [],
        jwksUriEndpoint: 'https://adfs.mytestrun.com/adfs/discovery/keys',
        encryptedIdTokens: false,
        enabled: true,
        jwtRequestParameterOption: 'NONE',
        authenticationIdKey: 'sub',
        uiConfig: {
          buttonClass: '',
          buttonCustomStyle:
            'background-color: #fff; border-color: #8b8b8b; color: #8b8b8b;',
          buttonCustomStyleHover:
            'background-color: #fff; border-color: #8b8b8b; color: #8b8b8b;',
          buttonDisplayName: 'Microsoft ADFS',
          buttonImage: '/login/images/microsoft-logo.png',
          iconBackground: '#0078d7',
          iconClass: 'fa-windows',
          iconFontColor: 'white',
        },
        privateKeyJwtExpTime: 600,
        revocationCheckOptions: [],
        enableNativeNonce: true,
        transform: 'dbe0bf9a-72aa-49d5-8483-9db147985a47',
        jwtSigningAlgorithm: 'RS256',
        redirectURI: 'https://idc.scheuber.io/login',
        clientAuthenticationMethod: 'CLIENT_SECRET_POST',
        responseMode: 'DEFAULT',
        useCustomTrustStore: false,
        tokenEndpoint: 'https://adfs.mytestrun.com/adfs/oauth2/token',
        _id: 'FrodoTestIdp7',
        _type: {
          _id: 'oidcConfig',
          name: 'Client configuration for providers that implement the OpenID Connect specification.',
          collection: true,
        },
      },
      FrodoTestIdp8: {
        clientId: 'io.scheuber.idc.signinWithApple.service',
        pkceMethod: 'S256',
        wellKnownEndpoint:
          'https://appleid.apple.com/.well-known/openid-configuration',
        jwtEncryptionMethod: 'NONE',
        authorizationEndpoint: 'https://appleid.apple.com/auth/authorize',
        jwtEncryptionAlgorithm: 'NONE',
        clientSecret: null,
        issuerComparisonCheckType: 'EXACT',
        encryptJwtRequestParameter: false,
        scopeDelimiter: ' ',
        scopes: ['name', 'email'],
        issuer: 'https://appleid.apple.com',
        redirectAfterFormPostURI: 'https://idc.scheuber.io/login',
        userInfoResponseType: 'JSON',
        acrValues: [],
        jwksUriEndpoint: 'https://appleid.apple.com/auth/keys',
        encryptedIdTokens: false,
        requestNativeAppForUserInfo: false,
        enabled: true,
        jwtRequestParameterOption: 'NONE',
        authenticationIdKey: 'sub',
        uiConfig: {
          buttonClass: '',
          buttonCustomStyle:
            'background-color: #000000; color: #ffffff; border-color: #000000;',
          buttonCustomStyleHover:
            'background-color: #000000; color: #ffffff; border-color: #000000;',
          buttonDisplayName: 'Apple',
          buttonImage: '/login/images/apple-logo.png',
          iconBackground: '#000000',
          iconClass: 'fa-apple',
          iconFontColor: 'white',
        },
        privateKeyJwtExpTime: 600,
        revocationCheckOptions: [],
        enableNativeNonce: true,
        transform: '484e6246-dbc6-4288-97e6-54e55431402e',
        jwtSigningAlgorithm: 'NONE',
        redirectURI:
          'https://idc.scheuber.io/am/oauth2/client/form_post/apple_web',
        clientAuthenticationMethod: 'CLIENT_SECRET_POST',
        responseMode: 'FORM_POST',
        useCustomTrustStore: false,
        tokenEndpoint: 'https://appleid.apple.com/auth/token',
        _id: 'FrodoTestIdp8',
        _type: {
          _id: 'appleConfig',
          name: 'Client configuration for Apple.',
          collection: true,
        },
      },
    },
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageIdp(idp1);
      await stageIdp(idp2);
      await stageIdp(idp3, false);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageIdp(idp1, false);
      await stageIdp(idp2, false);
      await stageIdp(idp3, false);
      await stageIdp(idp4, false);
      await stageIdp(idp5, false);
      await stageIdp(idp6, false);
      await stageIdp(idp7, false);
      await stageIdp(idp8, false);
    }
  });

  describe('exportSocialProvider()', () => {
    test('0: Method is implemented', async () => {
      expect(Idp.exportSocialProvider).toBeDefined();
    });

    test(`1: Export social provider ${idp1.id}`, async () => {
      const response = await Idp.exportSocialProvider(idp1.id);
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('exportSocialProviders()', () => {
    test('0: Method is implemented', async () => {
      expect(Idp.exportSocialProviders).toBeDefined();
    });

    test('1: Export all social providers', async () => {
      const response = await Idp.exportSocialProviders();
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('getSocialProviders()', () => {
    test('0: Method is implemented', async () => {
      expect(Idp.getSocialIdentityProviders).toBeDefined();
    });

    test(`1: Get social providers`, async () => {
      const response = await Idp.getSocialIdentityProviders();
      expect(response).toMatchSnapshot();
    });
  });

  describe('getSocialProvider()', () => {
    test('0: Method is implemented', async () => {
      expect(Idp.getSocialProvider).toBeDefined();
    });

    test(`1: Get social provider ${idp1.id}`, async () => {
      const response = await Idp.getSocialProvider(idp1.id);
      expect(response).toMatchSnapshot();
    });
  });

  describe('putProviderByTypeAndId()', () => {
    test('0: Method is implemented', async () => {
      expect(Idp.putProviderByTypeAndId).toBeDefined();
    });

    test(`1: Put social provider ${idp3.id}`, async () => {
      const response = await Idp.putProviderByTypeAndId(
        idp3.type,
        idp3.id,
        idp3.data
      );
      expect(response).toMatchSnapshot();
    });
  });

  describe('importSocialProvider()', () => {
    test('0: Method is implemented', async () => {
      expect(Idp.importSocialProvider).toBeDefined();
    });

    test(`1: Import social provider ${import1.id}`, async () => {
      expect.assertions(1);
      const outcome = await Idp.importSocialProvider(import1.id, import1.data);
      expect(outcome).toBeTruthy();
    });
  });

  describe('importFirstSocialProvider()', () => {
    test('0: Method is implemented', async () => {
      expect(Idp.importFirstSocialProvider).toBeDefined();
    });

    test(`1: Import first social provider`, async () => {
      expect.assertions(1);
      const outcome = await Idp.importFirstSocialProvider(importData1);
      expect(outcome).toBeTruthy();
    });
  });

  describe('importSocialProviders()', () => {
    test('0: Method is implemented', async () => {
      expect(Idp.importSocialProviders).toBeDefined();
    });
  });

  test(`1: Import all social providers`, async () => {
    expect.assertions(1);
    const outcome = await Idp.importSocialProviders(importData2);
    expect(outcome).toBeTruthy();
  });
});
