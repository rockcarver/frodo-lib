import {
  RequestFormForm,
  RequestFormSkeleton,
} from '../../api/cloud/iga/IgaRequestFormApi';
import { state } from '../../index';
import * as IgaRequestFormOps from '../../ops/cloud/iga/IgaRequestFormOps';
import {
  autoSetupPolly,
  setupPollyRecordingContext,
} from '../../utils/AutoSetupPolly';
import * as RequestTypeTestData from './IgaRequestTypeSetup';

const EXAMPLE_FORM: RequestFormForm = {
  fields: [
    {
      id: '6d75f47e-3c06-4d62-bc3e-4952499937b7',
      fields: [
        {
          id: '9c4ef3b4-2edd-4027-ae1a-1959a0b2d9b5',
          model: 'text',
          type: 'string',
          label: 'This is my test form',
          description: 'This is text',
          validation: {
            required: true,
            regex: {
              pattern: '[a-zA-Z]+',
              message: 'Needs to include text',
            },
          },
          layout: {
            columns: 12,
            offset: 0,
          },
          defaultValue: 'Awesome',
          readOnly: true,
          customSlot: false,
          onChangeEvent: {
            type: 'script',
            script: '// My\n// onChange\n// script',
          },
        },
      ],
    },
    {
      id: '159d9344-4e0a-484b-b4fc-92bcfd306631',
      fields: [
        {
          id: 'a8ccff5e-f49c-42df-9d62-8a167b5366cd',
          model: 'utilities',
          type: 'section',
          validation: {},
          layout: {
            columns: 12,
            offset: 0,
          },
          customSlot: false,
          header: 'Utilities Header',
          footer: 'Utilities Footer',
          fields: [
            {
              id: 'f9d9bebf-f607-4d8d-aa42-b1aaa9f7fbdc',
              fields: [
                {
                  id: '1db49b25-5280-4da9-9e0a-ed61d3df7332',
                  type: 'formText',
                  validation: {},
                  layout: {
                    columns: 8,
                    offset: 2,
                  },
                  formText: 'Form Text',
                  customSlot: 'formText',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: '14c257ee-030f-454e-8c73-71eccf2e2a39',
      fields: [
        {
          id: 'bded6069-4b45-434d-be07-93a6882a5847',
          model: 'customFields',
          type: 'section',
          validation: {},
          layout: {
            columns: 12,
            offset: 0,
          },
          customSlot: false,
          header: 'Custom Fields Header',
          footer: 'Custom Fields Footer',
          fields: [
            {
              id: 'eafc0754-2941-4af4-96e7-872b3bd7e88c',
              fields: [
                {
                  id: 'fffd5f49-241e-4985-a15c-448fe1a97bdf',
                  model: 'textArea',
                  type: 'textarea',
                  label: 'Text Area',
                  description: 'This is a text area',
                  validation: {
                    required: false,
                    regex: {},
                  },
                  layout: {
                    columns: 6,
                    offset: 3,
                  },
                  defaultValue: 'My default',
                  readOnly: false,
                  customSlot: false,
                  onChangeEvent: {},
                },
              ],
            },
            {
              id: 'f54c92a0-fe7b-49f9-98a1-7605be563b1f',
              fields: [
                {
                  id: 'fe61e2fa-5c7b-4266-b080-ce8e0cee1fe9',
                  model: 'checkbox',
                  type: 'checkbox',
                  label: 'Checkbox',
                  description: '',
                  validation: {},
                  layout: {
                    columns: 12,
                    offset: 0,
                  },
                  defaultValue: false,
                  readOnly: false,
                  customSlot: false,
                  onChangeEvent: {
                    type: 'script',
                    script: ['// My', '// onChange', '// script'],
                  },
                },
              ],
            },
            {
              id: '2d44b1dd-35b4-44aa-b581-e1fa635a38e1',
              fields: [
                {
                  id: '420780c7-3e10-4d65-a349-a6eeaebb36ad',
                  model: 'selectEnumerated',
                  type: 'select',
                  label: 'SelectEnumerated',
                  validation: {
                    required: true,
                  },
                  layout: {
                    columns: 12,
                    offset: 0,
                  },
                  options: [
                    {
                      value: 'val2',
                      label: 'Val2',
                      selectedByDefault: true,
                    },
                    {
                      value: 'v1',
                      label: 'V1',
                    },
                    {
                      value: 'v3',
                      label: 'V3',
                    },
                  ],
                  readOnly: false,
                  customSlot: false,
                  onChangeEvent: {
                    type: 'script',
                    script: [],
                  },
                },
              ],
            },
            {
              id: '857fd82b-b0b4-48a4-b60f-be795be33827',
              fields: [
                {
                  id: 'a8b64346-e39f-4244-b0dd-b2ae3bcd3a5e',
                  model: 'selectObject',
                  type: 'select',
                  label: 'Select Object',
                  validation: {
                    required: false,
                  },
                  layout: {
                    columns: 12,
                    offset: 0,
                  },
                  options: {
                    object: 'user',
                    queryFilter: 'userName eq "test"',
                  },
                  readOnly: true,
                  customSlot: false,
                  onChangeEvent: {
                    type: 'script',
                    script: '',
                  },
                },
              ],
            },
            {
              id: 'e8b2c74f-78d0-4c6c-8836-1fb64bb7ad32',
              fields: [
                {
                  id: 'bb21a952-f986-4d36-87ee-fb0608bd9218',
                  model: 'multiSelectEnumerated',
                  type: 'multiselect',
                  label: 'Multi Select Enumerated',
                  description: 'My description',
                  validation: {
                    required: true,
                  },
                  layout: {
                    columns: 12,
                    offset: 0,
                  },
                  options: [],
                  readOnly: false,
                  customSlot: false,
                  onChangeEvent: {},
                },
              ],
            },
            {
              id: '863f42bd-7892-4649-a8b9-f2e112872656',
              fields: [
                {
                  id: 'edaceb2f-c112-4c7b-8f2f-d636393de062',
                  model: 'multiSelectObject',
                  type: 'multiselect',
                  label: 'Multi Select Object',
                  validation: {
                    required: false,
                  },
                  layout: {
                    columns: 12,
                    offset: 0,
                  },
                  options: {
                    object: 'entitlement',
                    queryFilter: 'id eq "id"',
                  },
                  readOnly: true,
                  customSlot: false,
                  onChangeEvent: {},
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: '119bb47f-440a-453d-a9bb-92295ab71e64',
      fields: [
        {
          id: '21371507-f385-4e16-9689-634302577a78',
          model: 'date',
          type: 'date',
          label: 'Date',
          description: "Today's date",
          validation: {
            required: false,
          },
          layout: {
            columns: 12,
            offset: 0,
          },
          readOnly: false,
          customSlot: false,
          onChangeEvent: {
            type: 'script',
            script: 'console.log("hello")',
          },
        },
      ],
    },
  ],
  events: {
    onLoad: {
      type: 'script',
      script: ['// This', '// is', '// my', '// onLoad', '// script'],
    },
  },
};

export const requestForm1: RequestFormSkeleton = {
  id: '13e5f8d3-0275-48b0-be3f-ec544da78b3b',
  name: 'test_request_form_1',
  type: 'request',
  description: 'This is a test request form',
  categories: {
    applicationType: null,
    objectType: null,
    operation: 'create',
  },
  form: EXAMPLE_FORM,
  assignments: [
    {
      formId: '13e5f8d3-0275-48b0-be3f-ec544da78b3b',
      objectId: 'requestType/' + RequestTypeTestData.requestType2.id,
    },
  ],
};

export const requestForm2: RequestFormSkeleton = {
  id: '9bf59529-5a61-4a37-9053-fda20df22e26',
  name: 'test_request_form_2',
  type: 'request',
  description: 'This is a test request form',
  categories: {
    applicationType: null,
    objectType: null,
    operation: 'create',
  },
  form: EXAMPLE_FORM,
  assignments: [
    {
      formId: '9bf59529-5a61-4a37-9053-fda20df22e26',
      objectId: 'requestType/' + RequestTypeTestData.requestType1.id,
    },
  ],
};

export const requestForm3: RequestFormSkeleton = {
  id: '099c4fd6-ec45-4024-9cee-a9980ca012e3',
  name: 'test_request_form_3',
  type: 'lcmRequest',
  description: 'This is a test lcm request form',
  categories: {
    applicationType: null,
    objectType: null,
    operation: 'create',
    lcmType: 'user',
  },
  form: {},
  assignments: [
    {
      formId: '099c4fd6-ec45-4024-9cee-a9980ca012e3',
      objectId: 'lcm/user/delete',
    },
  ],
};

export const requestForm4: RequestFormSkeleton = {
  id: '78a3f767-d4e6-4014-9c38-ad6f3b81cb4c',
  name: 'test_request_form_4',
  type: 'applicationRequest',
  description: 'This is a test application request form',
  categories: {
    applicationType: null,
    objectType: 'Group',
    operation: 'create',
  },
  form: {},
  assignments: [],
};

export const requestForm5: RequestFormSkeleton = {
  id: '668de16f-bfc7-4a78-a038-4d23ff99738a',
  name: 'test_request_form_5',
  type: 'request',
  description: 'This is a test request form',
  categories: {
    applicationType: null,
    objectType: null,
    operation: 'create',
  },
  form: EXAMPLE_FORM,
  assignments: [
    {
      formId: '668de16f-bfc7-4a78-a038-4d23ff99738a',
      objectId: 'requestType/' + RequestTypeTestData.requestType5.id,
    },
  ],
};

export const requestForm6: RequestFormSkeleton = {
  id: '1707266d-fd8d-4794-bce1-3cfde2016bca',
  name: 'test_request_form_6',
  type: 'lcmRequest',
  description: 'This is a test lcm request form',
  categories: {
    applicationType: null,
    objectType: null,
    operation: 'create',
    lcmType: 'user',
  },
  form: {},
  assignments: [
    {
      formId: '1707266d-fd8d-4794-bce1-3cfde2016bca',
      objectId: 'lcm/user/update',
    },
    {
      formId: '1707266d-fd8d-4794-bce1-3cfde2016bca',
      objectId: 'lcm/user/create',
    },
  ],
};

export async function stageRequestForm(
  form: RequestFormSkeleton,
  createNew = false
) {
  try {
    await IgaRequestFormOps.deleteRequestForm({
      formId: form.id,
      state,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  } finally {
    if (createNew) {
      await IgaRequestFormOps.importRequestForms({
        importData: {
          requestForm: {
            [form.id]: form,
          },
        },
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
      // setup requestForm1 - delete if exists, then create
      await RequestTypeTestData.stageRequestType(
        RequestTypeTestData.requestType2,
        true
      );
      await stageRequestForm(requestForm1, true);
      // setup requestForm2 - delete if exists
      await RequestTypeTestData.stageRequestType(
        RequestTypeTestData.requestType1
      );
      await stageRequestForm(requestForm2);
      // setup requestForm3 - delete if exists
      await stageRequestForm(requestForm3);
      // setup requestForm4 - delete if exists, then create
      await stageRequestForm(requestForm4, true);
      // setup requestForm5 - delete if exists, then create
      await RequestTypeTestData.stageRequestType(
        RequestTypeTestData.requestType5,
        true
      );
      await stageRequestForm(requestForm5, true);
      // setup requestForm6 - delete if exists, then create
      await stageRequestForm(requestForm6, true);
    }
  });
  // in recording mode, delete test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageRequestForm(requestForm1);
      await RequestTypeTestData.stageRequestType(
        RequestTypeTestData.requestType2
      );
      await stageRequestForm(requestForm2);
      await RequestTypeTestData.stageRequestType(
        RequestTypeTestData.requestType1
      );
      await stageRequestForm(requestForm3);
      await stageRequestForm(requestForm4);
      await stageRequestForm(requestForm5);
      await RequestTypeTestData.stageRequestType(
        RequestTypeTestData.requestType5
      );
      await stageRequestForm(requestForm6);
    }
  });
}
