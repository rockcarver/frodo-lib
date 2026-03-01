import * as IgaGlossaryApi from '../../api/cloud/iga/IgaGlossaryApi';
import { state } from '../../index';
import * as IgaGlossaryOps from '../../ops/cloud/iga/IgaGlossaryOps';
import Constants from '../../shared/Constants';
import {
  autoSetupPolly,
  setupPollyRecordingContext,
} from '../../utils/AutoSetupPolly';

export const glossary1: IgaGlossaryApi.GlossarySchemaItemSkeleton<any> = {
  name: 'testBoolean',
  description: 'Test Boolean Description',
  displayName: 'Test Boolean Display Name',
  type: 'boolean',
  objectType: Constants.GLOSSARY_ROLE_OBJECT_TYPE,
  isMultiValue: false,
  enumeratedValues: [],
  searchable: true,
  allowedValues: [],
  id: '4332b18f-ad0a-4b16-abd5-af13bede31ae',
};

export const glossary2: IgaGlossaryApi.GlossarySchemaItemSkeleton<any> = {
  name: 'testInteger',
  description: 'Test Integer Description',
  displayName: 'Test Integer Display Name',
  type: 'integer',
  objectType: Constants.GLOSSARY_ENTITLEMENT_OBJECT_TYPE,
  isMultiValue: true,
  enumeratedValues: [
    {
      text: 1,
      value: 0,
    },
    {
      text: 2,
      value: 1,
    },
    {
      text: 3,
      value: 2,
    },
  ],
  searchable: false,
  allowedValues: [0, 1, 2],
  id: '16c42f91-43a0-4b89-8ece-0221df554aa4',
};

export const glossary3: IgaGlossaryApi.GlossarySchemaItemSkeleton<any> = {
  name: 'testString',
  description: 'Test String Description',
  displayName: 'Test String Display Name',
  type: 'string',
  objectType: Constants.GLOSSARY_APPLICATION_OBJECT_TYPE,
  isMultiValue: true,
  enumeratedValues: [
    {
      text: 'text1',
      value: 'Text One',
    },
    {
      text: 'text2',
      value: 'Text Two',
    },
    {
      text: 'text3',
      value: 'Text Three',
    },
  ],
  searchable: true,
  allowedValues: ['Text One', 'Text Two', 'Text Three'],
  id: 'd27a22e1-8118-441f-b480-48c6b2e204d1',
};

export const glossary4: IgaGlossaryApi.GlossarySchemaItemSkeleton<any> = {
  name: 'testDate',
  description: 'Test Date Description',
  displayName: 'Test Date Display Name',
  type: 'date',
  objectType: Constants.GLOSSARY_ENTITLEMENT_OBJECT_TYPE,
  isMultiValue: false,
  enumeratedValues: [],
  searchable: false,
  allowedValues: [],
  id: '9408f88d-7a98-41ba-b7f3-e47d4d408340',
};

export const glossary5: IgaGlossaryApi.GlossarySchemaItemSkeleton<any> = {
  name: 'testOrg',
  description: 'Test Organization Description',
  displayName: 'Test Organization Display Name',
  type: 'managedObject',
  objectType: Constants.GLOSSARY_ENTITLEMENT_OBJECT_TYPE,
  isMultiValue: false,
  enumeratedValues: [],
  searchable: false,
  allowedValues: [],
  managedObjectType: '/openidm/managed/organization',
  id: '2133dfb9-7af2-4543-bcc5-74a884053b18',
};

export const glossary6: IgaGlossaryApi.GlossarySchemaItemSkeleton<any> = {
  name: 'testUser',
  description: 'Test User Description',
  displayName: 'Test User Display Name',
  type: 'managedObject',
  objectType: Constants.GLOSSARY_ENTITLEMENT_OBJECT_TYPE,
  isMultiValue: false,
  enumeratedValues: [],
  searchable: false,
  allowedValues: [],
  managedObjectType: '/openidm/managed/user',
  id: 'dd2f3e74-2509-4d4c-b7f6-c812f2bb4ad2',
};

export const glossary7: IgaGlossaryApi.GlossarySchemaItemSkeleton<any> = {
  name: 'testRole',
  description: 'Test Role Description',
  displayName: 'Test Role Display Name',
  type: 'managedObject',
  objectType: Constants.GLOSSARY_ENTITLEMENT_OBJECT_TYPE,
  isMultiValue: false,
  enumeratedValues: [],
  searchable: false,
  allowedValues: [],
  managedObjectType: '/openidm/managed/role',
  id: '346431eb-fbdf-409d-8b7a-650dd02b0e7e',
};

const allGlossaries = [
  glossary1,
  glossary2,
  glossary3,
  glossary4,
  glossary5,
  glossary6,
  glossary7,
];

const oldGlossaryIds = new Map<string, string>();

export async function stageGlossary(
  glossary: IgaGlossaryApi.GlossarySchemaItemSkeleton<any>,
  createNew = false
) {
  try {
    await IgaGlossaryOps.deleteGlossarySchemaByNameAndObjectType({
      glossaryName: glossary.name,
      objectType: glossary.objectType,
      state,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  } finally {
    if (createNew) {
      const oldId = glossary.id;
      // Since it's not possible to create a glossary schema with a specified ID, we must use the new id for recording the tests.
      glossary.id = (
        await IgaGlossaryApi.createGlossarySchema({
          glossarySchemaData: glossary,
          state,
        })
      ).id;
      // We store the old id for after the tests are finished running to update the recordings to use the old id instead so that tests will pass future runs.
      oldGlossaryIds.set(glossary.id, oldId);
    }
  }
}

export function setup() {
  const ctx = autoSetupPolly();
  // For some reason, polly is not set up before beforeAll is ran, but it is set up before beforeEach, so we must set up this configuration in beforeEach
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      setupPollyRecordingContext(ctx, [
        {
          pathToObj: [],
          identifier: 'id',
          testObjs: allGlossaries,
          oldObjIds: oldGlossaryIds,
          namesWhereMultipleRequestsMade: [glossary6.name],
        },
      ]);
    }
  });
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // setup glossary1 - delete if exists, then create
      await stageGlossary(glossary1, true);
      // setup glossary2 - delete if exists, then create
      await stageGlossary(glossary2, true);
      // setup glossary3 - delete if exists, then create
      await stageGlossary(glossary3, true);
      // setup glossary4 - delete if exists
      await stageGlossary(glossary4);
      // setup glossary5 - delete if exists, then create
      await stageGlossary(glossary5, true);
      // setup glossary6 - delete if exists, then create
      await stageGlossary(glossary6, true);
      // setup glossary7 - delete if exists
      await stageGlossary(glossary7);
    }
  });
  // in recording mode, delete test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageGlossary(glossary1);
      await stageGlossary(glossary2);
      await stageGlossary(glossary3);
      await stageGlossary(glossary4);
      await stageGlossary(glossary5);
      await stageGlossary(glossary6);
      await stageGlossary(glossary7);
    }
  });
}
