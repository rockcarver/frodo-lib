import { EventSkeleton, EventType } from '../../api/cloud/iga/IgaEventApi';
import { state } from '../../index';
import * as IgaEventOps from '../../ops/cloud/iga/IgaEventOps';
import {
  EMAIL_TEMPLATE_TYPE,
  EmailTemplateSkeleton,
} from '../../ops/EmailTemplateOps';
import {
  autoSetupPolly,
  setupPollyRecordingContext,
} from '../../utils/AutoSetupPolly';
import { stageEmailTemplate, template1 } from './EmailTemplateSetup';
import { getTestCertificationTemplate } from './IgaCertificationTemplateSetup';

function getTestEvent({
  id,
  name,
  type,
  workflowId,
  certificateId,
  certificateName,
  emailTemplate,
}: {
  id: string;
  name: string;
  type: EventType;
  workflowId?: string;
  certificateId?: string;
  certificateName?: string;
  emailTemplate?: EmailTemplateSkeleton;
}): EventSkeleton {
  return {
    action: {
      type,
      ...(type === 'certification' && {
        template: getTestCertificationTemplate(
          certificateId,
          certificateName,
          'identity',
          emailTemplate ? `${EMAIL_TEMPLATE_TYPE}/${emailTemplate._id}` : '',
          true
        ),
      }),
      ...(type === 'orchestration' && {
        name: workflowId,
        parameters: {
          var1: 'val1',
          var2: 'val2',
          var3: 'val3',
        },
      }),
    },
    name,
    condition: {
      version: 'v2',
      filter: {
        or: [
          {
            contains: {
              search_string: {
                literal: 'a',
              },
              in_string: 'user.before.city',
            },
          },
          {
            not_contains: {
              search_string: {
                literal: 'b',
              },
              in_string: 'user.after.city',
            },
          },
          {
            equals: {
              right: {
                literal: 'c',
              },
              left: 'user.before.city',
            },
          },
          {
            not_equals: {
              right: {
                literal: 'd',
              },
              left: 'user.after.city',
            },
          },
          {
            starts_with: {
              prefix: {
                literal: 'e',
              },
              value: 'user.before.city',
            },
          },
          {
            ends_with: {
              suffix: {
                literal: 'f',
              },
              value: 'user.after.city',
            },
          },
          {
            not_equals: {
              left: 'user.before.city',
              right: 'user.after.city',
            },
          },
          {
            equals: {
              left: 'user.before.city',
              right: 'user.after.city',
            },
          },
          {
            and: [
              {
                gte: {
                  right: {
                    literal: 1,
                  },
                  left: 'user.before.frIndexedInteger1',
                },
              },
              {
                gt: {
                  right: {
                    literal: 2,
                  },
                  left: 'user.after.frIndexedInteger1',
                },
              },
              {
                lte: {
                  right: {
                    literal: 3,
                  },
                  left: 'user.before.frIndexedInteger1',
                },
              },
              {
                lt: {
                  right: {
                    literal: 4,
                  },
                  left: 'user.after.frIndexedInteger1',
                },
              },
            ],
          },
        ],
      },
    },
    description: 'Test event description',
    entityType: 'user',
    mutationType: 'create',
    owners: [
      {
        id: 'managed/user/0f325c99-6965-4f45-b1e4-f9db1fa4dcf6',
        givenName: 'Preston',
        mail: 'test@test.com',
        sn: 'Test',
        userName: 'PrestonIGATestUser',
      },
    ],
    status: 'active',
    id,
  };
}

// certification
export const event1: EventSkeleton = getTestEvent({
  id: 'aa9fe33a-8de1-4cbb-b915-49bc953c6281',
  name: 'test_event_1',
  type: 'certification',
  certificateId: '89c7fc85-2aa4-4e3a-acc2-a133c3c2be01',
  certificateName: 'test_event_certification_1',
});

// certification w/ email templates
export const event2: EventSkeleton = getTestEvent({
  id: '8dd57f38-99ee-4fd6-9cd0-183239ea0aec',
  name: 'test_event_2',
  type: 'certification',
  certificateId: '10946b5a-8b29-4b02-ac96-dbe5f1687884',
  certificateName: 'test_event_certification_2',
  emailTemplate: template1,
});

// certification w/ email templates
export const event3: EventSkeleton = getTestEvent({
  id: '8197509d-65f0-4b0a-925d-f164372e39a5',
  name: 'test_event_3',
  type: 'certification',
  certificateId: 'ff4a0641-427c-451d-9bb7-42112bd222a0',
  certificateName: 'test_event_certification_3',
  emailTemplate: template1,
});

// certification w/ email templates
export const event4: EventSkeleton = getTestEvent({
  id: '808ab5eb-1547-4764-b23f-bc67862dedda',
  name: 'test_event_4',
  type: 'certification',
  certificateId: '8c7f2653-77df-48a1-828c-2053adcefee0',
  certificateName: 'test_event_certification_4',
  emailTemplate: template1,
});

// workflow
export const event5: EventSkeleton = getTestEvent({
  id: 'e0bdb7c1-1d73-4b6a-ab79-9e97930bc122',
  name: 'test_event_5',
  type: 'orchestration',
  // Workflow doesn't need to exist, so we can use anything here
  workflowId: 'workflowId1',
});

// certification
export const event6: EventSkeleton = getTestEvent({
  id: '5519f5d0-1131-46a4-bac6-636a44a84576',
  name: 'test_event_6',
  type: 'certification',
  certificateId: '4f6fb592-184f-415b-bd88-1281e51907af',
  certificateName: 'test_event_certification_5',
});

// workflow
export const event7: EventSkeleton = getTestEvent({
  id: '96fbbf9c-dd1c-47a8-86b6-b2981dc9d41f',
  name: 'test_event_7',
  type: 'orchestration',
  // Workflow doesn't need to exist, so we can use anything here
  workflowId: 'workflowId2',
});

const allEvents = [event1, event2, event3, event4, event5, event6, event7];

const allCertificationTemplates = [
  event1.action.template,
  event2.action.template,
  event3.action.template,
  event4.action.template,
  event6.action.template,
];

const oldEventIds = new Map<string, string>();
const oldCertificationTemplateIds = new Map<string, string>();

export async function stageEvent(event: EventSkeleton, createNew = false) {
  try {
    await IgaEventOps.deleteEventByName({
      eventName: event.name,
      state,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  } finally {
    if (createNew) {
      // Since it's not possible to create an event (or certification template) with a specified ID, we must use the new id for recording the tests.
      const oldEventId = event.id;
      const oldTemplateId = event.action.template?.id;
      const createdEvent = await IgaEventOps.createEvent({
        eventData: event,
        state,
      });
      event.id = createdEvent.id;
      // We store the old ids for after the tests are finished running to update the recordings to use the old id instead so that tests will pass future runs.
      oldEventIds.set(event.id, oldEventId);
      if (oldTemplateId) {
        event.action.template.id = createdEvent.action.template.id;
        oldCertificationTemplateIds.set(
          event.action.template.id,
          oldTemplateId
        );
      }
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
          testObjs: allEvents,
          oldObjIds: oldEventIds,
          namesWhereMultipleRequestsMade: [event7.name],
        },
        {
          pathToObj: ['action', 'template'],
          identifier: 'id',
          testObjs: allCertificationTemplates,
          oldObjIds: oldCertificationTemplateIds,
          namesWhereMultipleRequestsMade: [event7.name],
        },
      ]);
    }
  });
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // setup email template - delete if exists, then create
      await stageEmailTemplate(template1, true);
      // setup event1 - delete if exists
      await stageEvent(event1);
      // setup event2 - delete if exists, then create
      await stageEvent(event2, true);
      // setup event3 - delete if exists
      await stageEvent(event3);
      // setup event4 - delete if exists
      await stageEvent(event4);
      // setup event5 - delete if exists, then create
      await stageEvent(event5, true);
      // setup event6 - delete if exists, then create
      await stageEvent(event6, true);
      // setup event6 - delete if exists, then create
      await stageEvent(event7, true);
    }
  });
  // in recording mode, delete test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      for (const event of allEvents) {
        await stageEvent(event);
      }
      await stageEmailTemplate(template1);
    }
  });
}
