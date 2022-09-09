import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { VariablesRaw, state } from '../index';

const mock = new MockAdapter(axios);

state.default.session.setTenant('https://openam-frodo-dev.forgeblocks.com/am');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');

describe('VariablesApi - getVariables()', () => {
  test('getVariables() 0: Method is implemented', async () => {
    expect(VariablesRaw.getVariables).toBeDefined();
  });

  test('getVariables() 1: Get all variables - success', async () => {
    const mockResponse = {
      pagedResultsCookie: null,
      remainingPagedResults: -1,
      result: [
        {
          _id: 'esv-twilio-phone-number',
          description:
            'Twilio phone number. Get your own at: https://twilio.com',
          expressionType: '',
          lastChangeDate: '2022-08-12T21:27:18.560Z',
          lastChangedBy: 'c5f3cf35-4cc1-42f9-80b3-59e1ca842510',
          loaded: true,
          valueBase64: 'KzEzMTc2NDQzMTA3',
        },
        {
          _id: 'esv-461016d8d2-configurationpropertiescredentials',
          description:
            'Configuration parameter /configurationProperties/credentials in file idm/conf/provisioner.openicf-OUD.json',
          expressionType: '',
          lastChangeDate: '2021-12-09T16:48:18.482Z',
          lastChangedBy: 'forgerock-automation',
          loaded: true,
          valueBase64: 'RnJkcC0yMDEw',
        },
        {
          _id: 'esv-twilio-account-sid',
          description:
            'Twilio account SID. Get your own at: https://twilio.com',
          expressionType: '',
          lastChangeDate: '2022-08-12T21:26:32.688Z',
          lastChangedBy: 'c5f3cf35-4cc1-42f9-80b3-59e1ca842510',
          loaded: true,
          valueBase64: 'QUM3NTA0MTVlMzE2M2EyZTU3YjdhZWVhN2VlZDgyZDk0NA==',
        },
        {
          _id: 'esv-ipv4-cidr-access-rules',
          description:
            'IPv4 CIDR access rules: { "allow": [ "address/mask" ] }',
          expressionType: '',
          lastChangeDate: '2022-08-25T20:16:54.243Z',
          lastChangedBy: 'c5f3cf35-4cc1-42f9-80b3-59e1ca842510',
          loaded: true,
          valueBase64:
            'eyAiYWxsb3ciOiBbICIxNDUuMTE4LjAuMC8xNiIsICIxMzIuMzUuMC4wLzE2IiwgIjEwMS4yMjYuMC4wLzE2IiwgIjk5LjcyLjI4LjE4Mi8zMiIgXSB9',
        },
        {
          _id: 'esv-volkerstestvariable1',
          description: "Volker's Updated Test Variable Description",
          expressionType: '',
          lastChangeDate: '2022-04-10T20:55:39.746Z',
          lastChangedBy: 'c5f3cf35-4cc1-42f9-80b3-59e1ca842510',
          loaded: true,
          valueBase64: 'Vm9sa2VyJ3MgVGVzdCBWYXJpYWJsZSBWYWx1ZQo=',
        },
      ],
      resultCount: 5,
      totalPagedResults: -1,
      totalPagedResultsPolicy: 'NONE',
    };
    mock
      .onGet('https://openam-frodo-dev.forgeblocks.com/environment/variables')
      .reply(200, mockResponse);
    const response = await VariablesRaw.getVariables();
    expect(response).toBeTruthy();
    expect(response).toMatchObject(mockResponse);
  });

  test('getVariables() 2: Get all variables - error', async () => {
    const mockResponse = {
      message: 'Server Error',
      code: 500,
    };
    mock
      .onGet('https://openam-frodo-dev.forgeblocks.com/environment/variables')
      .reply(500, mockResponse);
    expect.assertions(4);
    try {
      await VariablesRaw.getVariables();
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(500);
      expect(error.response.data.code).toBe(500);
      expect(error.response.data.message).toBe('Server Error');
    }
  });
});

describe('VariablesApi - getVariable()', () => {
  test('getVariable() 0: Method is implemented', async () => {
    expect(VariablesRaw.getVariable).toBeDefined();
  });

  test('getVariable() 1: Get existing variable: esv-volkerstestvariable1', async () => {
    const mockResponse = {
      _id: 'esv-volkerstestvariable1',
      description: "Volker's Updated Test Variable Description",
      expressionType: '',
      lastChangeDate: '2022-04-10T20:55:39.746Z',
      lastChangedBy: 'c5f3cf35-4cc1-42f9-80b3-59e1ca842510',
      loaded: true,
      valueBase64: 'Vm9sa2VyJ3MgVGVzdCBWYXJpYWJsZSBWYWx1ZQo=',
    };
    mock
      .onGet(
        'https://openam-frodo-dev.forgeblocks.com/environment/variables/esv-volkerstestvariable1'
      )
      .reply(200, mockResponse);
    const response = await VariablesRaw.getVariable('esv-volkerstestvariable1');
    expect(response).toBeTruthy();
    expect(response).toMatchObject(mockResponse);
  });

  test('getVariable() 2: Get non-existing variable: esv-does-not-exist', async () => {
    const mockResponse = {
      code: 404,
      message: 'The variable does not exist',
    };
    mock
      .onGet(
        'https://openam-frodo-dev.forgeblocks.com/environment/variables/esv-does-not-exist'
      )
      .reply(404, mockResponse);
    expect.assertions(4);
    try {
      await VariablesRaw.getVariable('esv-does-not-exist');
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(404);
      expect(error.response.data.code).toBe(404);
      expect(error.response.data.message).toBe('The variable does not exist');
    }
  });
});

describe('VariablesApi - putVariable()', () => {
  test('putVariable() 0: Method is implemented', async () => {
    expect(VariablesRaw.putVariable).toBeDefined();
  });

  test('putVariable() 1: Create variable: esv-volkerstestvariable1 - success', async () => {
    const mockResponse = {
      _id: 'esv-volkerstestvariable1',
      description: "Volker's Updated Test Variable Description",
      expressionType: '',
      lastChangeDate: '2022-04-10T20:55:39.746Z',
      lastChangedBy: 'c5f3cf35-4cc1-42f9-80b3-59e1ca842510',
      loaded: true,
      valueBase64: 'Vm9sa2VyJ3MgVGVzdCBWYXJpYWJsZSBWYWx1ZQo=',
    };
    mock
      .onPut(
        'https://openam-frodo-dev.forgeblocks.com/environment/variables/esv-volkerstestvariable1'
      )
      .reply(200, mockResponse);
    const response = await VariablesRaw.putVariable(
      'esv-volkerstestvariable1',
      "Volker's Test Variable Value",
      "Volker's Test Variable Description"
    );
    expect(response).toBeTruthy();
    expect(response).toMatchObject(mockResponse);
  });

  test('putVariable() 2: Create variable: esv-volkerstestvariable1 - error', async () => {
    const mockResponse = {
      code: 500,
      message: 'Server Error',
    };
    mock
      .onPut(
        'https://openam-frodo-dev.forgeblocks.com/environment/variables/esv-volkerstestvariable1'
      )
      .reply(500, mockResponse);
    expect.assertions(4);
    try {
      await VariablesRaw.putVariable(
        'esv-volkerstestvariable1',
        "Volker's Test Variable Value",
        "Volker's Test Variable Description"
      );
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(500);
      expect(error.response.data.code).toBe(500);
      expect(error.response.data.message).toBe('Server Error');
    }
  });
});

describe('VariablesApi - setVariableDescription()', () => {
  test('setVariableDescription() 0: Method is implemented', async () => {
    expect(VariablesRaw.setVariableDescription).toBeDefined();
  });

  test('setVariableDescription() 1: Set variable description: esv-volkerstestvariable1 - success', async () => {
    const mockResponse = '';
    mock
      .onPost(
        'https://openam-frodo-dev.forgeblocks.com/environment/variables/esv-volkerstestvariable1?_action=setDescription'
      )
      .reply(200, mockResponse);
    const response = await VariablesRaw.setVariableDescription(
      'esv-volkerstestvariable1',
      "Volker's Updated Test Secret Description"
    );
    expect(response).toBe('');
  });

  test('setVariableDescription() 2: Set variable description: esv-volkerstestvariable1 - error', async () => {
    const mockResponse = {
      code: 500,
      message: 'Server Error',
    };
    mock
      .onPost(
        'https://openam-frodo-dev.forgeblocks.com/environment/variables/esv-volkerstestvariable1?_action=setDescription'
      )
      .reply(500, mockResponse);
    expect.assertions(4);
    try {
      await VariablesRaw.setVariableDescription(
        'esv-volkerstestvariable1',
        "Volker's Updated Test Secret Description"
      );
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(500);
      expect(error.response.data.code).toBe(500);
      expect(error.response.data.message).toBe('Server Error');
    }
  });
});

describe('VariablesApi - deleteVariable()', () => {
  test('deleteVariable() 0: Method is implemented', async () => {
    expect(VariablesRaw.deleteVariable).toBeDefined();
  });

  test('deleteVariable() 1: Delete variable: esv-volkerstestvariable1 - success', async () => {
    const mockResponse = {
      _id: 'esv-volkerstestvariable1',
      description: "Volker's Updated Test Variable Description",
      expressionType: '',
      lastChangeDate: '2022-04-10T20:55:39.746Z',
      lastChangedBy: 'c5f3cf35-4cc1-42f9-80b3-59e1ca842510',
      loaded: true,
      valueBase64: 'Vm9sa2VyJ3MgVGVzdCBWYXJpYWJsZSBWYWx1ZQo=',
    };
    mock
      .onDelete(
        'https://openam-frodo-dev.forgeblocks.com/environment/variables/esv-volkerstestvariable1'
      )
      .reply(200, mockResponse);
    const response = await VariablesRaw.deleteVariable(
      'esv-volkerstestvariable1'
    );
    expect(response).toBeTruthy();
    expect(response).toMatchObject(mockResponse);
  });

  test('deleteVariable() 2: Delete variable: esv-volkerstestvariable1 - error', async () => {
    const mockResponse = {
      code: 500,
      message:
        'Cannot delete a variable that has an existing config placeholder',
    };
    mock
      .onDelete(
        'https://openam-frodo-dev.forgeblocks.com/environment/variables/esv-volkerstestvariable1'
      )
      .reply(500, mockResponse);
    expect.assertions(4);
    try {
      await VariablesRaw.deleteVariable('esv-volkerstestvariable1');
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(500);
      expect(error.response.data.code).toBe(500);
      expect(error.response.data.message).toBe(
        'Cannot delete a variable that has an existing config placeholder'
      );
    }
  });
});
