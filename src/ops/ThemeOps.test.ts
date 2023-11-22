/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses
 *
 *    This step breaks down into 4 phases:
 *
 *    Phase 1: Get/export individual and all and put/import individuals only
 *    Phase 2: Import all
 *    Phase 3: Deletes individuals by id
 *    Phase 4: Deletes individuals by name
 *    Phase 5: Delete all
 *
 *    Because tests interfere with each other, they have to be run in groups of
 *    non-interfering tests.
 *
 *    To record API responses, you must call the test:record script and
 *    override all the connection state variables required to connect to the
 *    env to record from and also indicate the phase:
 *
 *    SOME OF THESE TESTS ARE DESTRUCTIVE!!!
 *    DO NOT RUN AGAINST AN ENV WITH ACTIVE CONFIGURATION!!!
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record ThemeOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record ThemeOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=3 FRODO_HOST=frodo-dev npm run test:record ThemeOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=4 FRODO_HOST=frodo-dev npm run test:record ThemeOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=5 FRODO_HOST=frodo-dev npm run test:record ThemeOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update ThemeOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only ThemeOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../index';
import * as IdmConfigApi from '../api/IdmConfigApi';
import * as ThemeOps from './ThemeOps';
import { getConfigEntity } from '../test/mocks/ForgeRockApiMockEngine';
import { autoSetupPolly, filterRecording } from '../utils/AutoSetupPolly';

const ctx = autoSetupPolly();

const THEME_OBJ: ThemeOps.ThemeSkeleton = {
  _id: 'a5420670-bae8-4ad6-9595-8477f6bca2c7',
  accountCardBackgroundColor: '#ffffff',
  accountCardHeaderColor: '#23282e',
  accountCardInnerBorderColor: '#e7eef4',
  accountCardInputBackgroundColor: '#ffffff',
  accountCardInputBorderColor: '#c0c9d5',
  accountCardInputLabelColor: '#5e6d82',
  accountCardInputSelectColor: '#e4f4fd',
  accountCardInputTextColor: '#23282e',
  accountCardOuterBorderColor: '#e7eef4',
  accountCardShadow: 3,
  accountCardTabActiveBorderColor: '#109cf1',
  accountCardTabActiveColor: '#e4f4fd',
  accountCardTextColor: '#5e6d82',
  accountFooter:
    '<div class="d-flex justify-content-center py-4 w-100"><span class="pr-1">© 2021</span>\n<a href="#"target="_blank"class="text-body">My Company, Inc</a><a href="#"target="_blank"style="color:#0000ee"class="pl-3 text-body">Privacy Policy</a><a href="#"target="_blank"style="color:#0000ee"class="pl-3 text-body">Terms & Conditions</a></div>',
  accountFooterEnabled: false,
  accountNavigationBackgroundColor: '#ffffff',
  accountNavigationTextColor: '#455469',
  accountNavigationToggleBorderColor: '#e7eef4',
  accountPageSections: {
    accountControls: {
      enabled: true,
    },
    accountSecurity: {
      enabled: true,
      subsections: {
        password: {
          enabled: true,
        },
        securityQuestions: {
          enabled: true,
        },
        twoStepVerification: {
          enabled: true,
        },
        username: {
          enabled: true,
        },
      },
    },
    consent: {
      enabled: true,
    },
    oauthApplications: {
      enabled: true,
    },
    personalInformation: {
      enabled: true,
    },
    preferences: {
      enabled: true,
    },
    social: {
      enabled: true,
    },
    trustedDevices: {
      enabled: true,
    },
  },
  accountTableRowHoverColor: '#f6f8fa',
  backgroundColor: '#324054',
  backgroundImage: 'https://pbs.twimg.com/media/EX_c_ZiVcAABUz9.jpg',
  bodyText: '#23282e',
  boldLinks: false,
  buttonRounded: '4',
  dangerColor: '#f7685b',
  favicon:
    'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/c04a0286-ea69-445d-9d2b-a05a67af92b9/d9skivx-86eab94e-a3b9-49fa-b1d1-da73642fe550.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiJcL2ZcL2MwNGEwMjg2LWVhNjktNDQ1ZC05ZDJiLWEwNWE2N2FmOTJiOVwvZDlza2l2eC04NmVhYjk0ZS1hM2I5LTQ5ZmEtYjFkMS1kYTczNjQyZmU1NTAucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.y2v-qONWeg4d4dY28BjLxknae_xnCh6vA2LkE96rdlY',
  fontFamily: 'Open Sans',
  isDefault: true,
  journeyCardBackgroundColor: '#ffffff',
  journeyCardShadow: 3,
  journeyCardTextColor: '#5e6d82',
  journeyCardTitleColor: '#23282e',
  journeyFooter:
    '<div class="d-flex justify-content-center py-4 w-100"><span class="pr-1">© 2021</span>\n<a href="#"target="_blank"class="text-body">My Company, Inc</a><a href="#"target="_blank"style="color:#0000ee"class="pl-3 text-body">Privacy Policy</a><a href="#"target="_blank"style="color:#0000ee"class="pl-3 text-body">Terms & Conditions</a></div>',
  journeyFooterEnabled: false,
  journeyHeader:
    '<div class="d-flex justify-content-center py-4 flex-grow-1">Header Content</div>',
  journeyHeaderEnabled: false,
  journeyInputBackgroundColor: '#ffffff',
  journeyInputBorderColor: '#c0c9d5',
  journeyInputLabelColor: '#5e6d82',
  journeyInputSelectColor: '#e4f4fd',
  journeyInputTextColor: '#23282e',
  journeyJustifiedContent: '',
  journeyJustifiedContentEnabled: false,
  journeyLayout: 'card',
  journeyTheaterMode: false,
  linkActiveColor: '#0A6EAB',
  linkColor: '#109CF1',
  linkedTrees: [],
  logo: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/The_Expanse_logo.png',
  logoAltText: 'TransUnion',
  logoEnabled: true,
  logoHeight: '40',
  logoProfile:
    'https://upload.wikimedia.org/wikipedia/commons/b/bd/The_Expanse_logo.png',
  logoProfileAltText: 'TransUnion',
  logoProfileCollapsed: '',
  logoProfileCollapsedAltText: '',
  logoProfileCollapsedHeight: '24',
  logoProfileHeight: '40',
  name: 'Expanse',
  pageTitle: '#23282e',
  primaryColor: '#324054',
  primaryOffColor: '#242E3C',
  profileBackgroundColor: '#FFFFFF',
  profileMenuHighlightColor: '#f3f5f8',
  profileMenuHoverColor: '#109cf1',
  profileMenuHoverTextColor: '#ffffff',
  profileMenuTextHighlightColor: '#D81B1B',
  secondaryColor: '#69788b',
  switchBackgroundColor: '#c0c9d5',
  textColor: '#FFFFFF',
  topBarBackgroundColor: '#ffffff',
  topBarBorderColor: '#e7eef4',
  topBarHeaderColor: '#23282e',
  topBarTextColor: '#69788b',
};
const THEME_MAP_RAW = {
  '84bbd22e-6def-459f-91c9-4c9aa4e0bec0': {
    accountFooter:
      '<div class="d-flex justify-content-center py-4 w-100"><span class="pr-1">© 2021</span>\n<a href="#" target="_blank" class="text-body">My Company, Inc</a><a href="#" target="_blank" style="color: #0000ee" class="pl-3 text-body">Privacy Policy</a><a href="#" target="_blank" style="color: #0000ee" class="pl-3 text-body">Terms & Conditions</a></div>',
    accountFooterEnabled: false,
    accountPageSections: {
      accountControls: {
        enabled: false,
      },
      accountSecurity: {
        enabled: true,
        subsections: {
          password: {
            enabled: true,
          },
          securityQuestions: {
            enabled: false,
          },
          twoStepVerification: {
            enabled: true,
          },
          username: {
            enabled: true,
          },
        },
      },
      consent: {
        enabled: false,
      },
      oauthApplications: {
        enabled: false,
      },
      personalInformation: {
        enabled: true,
      },
      preferences: {
        enabled: false,
      },
      social: {
        enabled: false,
      },
      trustedDevices: {
        enabled: true,
      },
    },
    backgroundColor: '#FFFFFF',
    backgroundImage: '',
    bodyText: '#000000',
    buttonRounded: '0',
    dangerColor: '#f7685b',
    favicon: '',
    isDefault: false,
    journeyFooter:
      '<div class="d-flex justify-content-center py-4 w-100"><span class="pr-1">© 2021</span>\n<a href="#" target="_blank" class="text-body">My Company, Inc</a><a href="#" target="_blank" style="color: #0000ee" class="pl-3 text-body">Privacy Policy</a><a href="#" target="_blank" style="color: #0000ee" class="pl-3 text-body">Terms & Conditions</a></div>',
    journeyFooterEnabled: false,
    journeyHeader:
      '<div class="d-flex justify-content-center py-4 flex-grow-1">Header Content</div>',
    journeyHeaderEnabled: false,
    journeyJustifiedContent: '',
    journeyJustifiedContentEnabled: false,
    journeyLayout: 'card',
    journeyTheaterMode: false,
    linkActiveColor: '#000000',
    linkColor: '#000000',
    linkedTrees: [],
    logo: 'https://cdn.forgerock.com/platform/themes/contrast/logo-contrast.svg',
    logoAltText: 'Contrast',
    logoEnabled: true,
    logoHeight: '72',
    logoProfile:
      "data:image/svg+xml,%0A%3Csvg width='46' height='46' viewBox='0 0 46 46' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M24.3477 13.5664H43.9438C43.5192 12.6317 43.0319 11.734 42.4905 10.8711H24.3477V13.5664Z' fill='black'/%3E%3Cpath d='M24.3477 8.17578H40.5261C39.6996 7.2052 38.7974 6.30182 37.8224 5.48047H24.3477V8.17578Z' fill='black'/%3E%3Cpath d='M24.3477 40.5195H37.8224C38.7975 39.6982 39.6996 38.7948 40.5261 37.8242H24.3477V40.5195Z' fill='black'/%3E%3Cpath d='M24.3477 2.78516H33.8482C31.0136 1.27039 27.7313 0.198195 24.3477 0V2.78516Z' fill='black'/%3E%3Cpath d='M24.3477 18.957H45.6208C45.4566 18.0405 45.2557 17.1372 44.9856 16.2617H24.3477V18.957Z' fill='black'/%3E%3Cpath d='M24.3477 21.6523V24.3477H45.9317C45.958 23.8992 46 23.4549 46 23C46 22.5451 45.958 22.1008 45.9317 21.6523H24.3477Z' fill='black'/%3E%3Cpath d='M0 23C0 35.1781 9.64778 45.2964 21.6523 46V0C9.64778 0.703566 0 10.8219 0 23Z' fill='black'/%3E%3Cpath d='M24.3477 46C27.7313 45.8018 31.0136 44.7296 33.8482 43.2148H24.3477V46Z' fill='black'/%3E%3Cpath d='M45.6208 27.043H24.3477V29.7383H44.9857C45.2557 28.8628 45.4566 27.9595 45.6208 27.043V27.043Z' fill='black'/%3E%3Cpath d='M24.3477 35.1289H42.4905C43.0319 34.266 43.5192 33.3683 43.9438 32.4336H24.3477V35.1289Z' fill='black'/%3E%3C/svg%3E%0A",
    logoProfileAltText: 'Contrast',
    logoProfileCollapsed:
      "data:image/svg+xml,%0A%3Csvg width='46' height='46' viewBox='0 0 46 46' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M24.3477 13.5664H43.9438C43.5192 12.6317 43.0319 11.734 42.4905 10.8711H24.3477V13.5664Z' fill='black'/%3E%3Cpath d='M24.3477 8.17578H40.5261C39.6996 7.2052 38.7974 6.30182 37.8224 5.48047H24.3477V8.17578Z' fill='black'/%3E%3Cpath d='M24.3477 40.5195H37.8224C38.7975 39.6982 39.6996 38.7948 40.5261 37.8242H24.3477V40.5195Z' fill='black'/%3E%3Cpath d='M24.3477 2.78516H33.8482C31.0136 1.27039 27.7313 0.198195 24.3477 0V2.78516Z' fill='black'/%3E%3Cpath d='M24.3477 18.957H45.6208C45.4566 18.0405 45.2557 17.1372 44.9856 16.2617H24.3477V18.957Z' fill='black'/%3E%3Cpath d='M24.3477 21.6523V24.3477H45.9317C45.958 23.8992 46 23.4549 46 23C46 22.5451 45.958 22.1008 45.9317 21.6523H24.3477Z' fill='black'/%3E%3Cpath d='M0 23C0 35.1781 9.64778 45.2964 21.6523 46V0C9.64778 0.703566 0 10.8219 0 23Z' fill='black'/%3E%3Cpath d='M24.3477 46C27.7313 45.8018 31.0136 44.7296 33.8482 43.2148H24.3477V46Z' fill='black'/%3E%3Cpath d='M45.6208 27.043H24.3477V29.7383H44.9857C45.2557 28.8628 45.4566 27.9595 45.6208 27.043V27.043Z' fill='black'/%3E%3Cpath d='M24.3477 35.1289H42.4905C43.0319 34.266 43.5192 33.3683 43.9438 32.4336H24.3477V35.1289Z' fill='black'/%3E%3C/svg%3E%0A",
    logoProfileCollapsedAltText: '',
    logoProfileCollapsedHeight: '22',
    logoProfileHeight: '22',
    name: 'Contrast',
    pageTitle: '#23282e',
    primaryColor: '#000000',
    primaryOffColor: '#000000',
    profileBackgroundColor: '#FFFFFF',
    profileMenuHighlightColor: '#FFFFFF',
    profileMenuHoverColor: '#FFFFFF',
    profileMenuHoverTextColor: '#000000',
    profileMenuTextHighlightColor: '#455469',
    secondaryColor: '#69788b',
    textColor: '#ffffff',
    _id: '84bbd22e-6def-459f-91c9-4c9aa4e0bec0',
  },
  'a5420670-bae8-4ad6-9595-8477f6bca2c7': THEME_OBJ,
};
const THEME_MAP: Map<string, ThemeOps.ThemeSkeleton> = new Map<string, ThemeOps.ThemeSkeleton>();
for (const theme of Object.values(THEME_MAP_RAW)) {
  THEME_MAP[theme._id as string] = theme;
}

async function stageThemes(configEntity: { id: string; data: object }) {
  // delete if exists, then create
  try {
    await IdmConfigApi.putConfigEntity({
      entityId: 'ui/themerealm',
      entityData: configEntity,
      state,
    });
  } catch (error) {
    // ignore
  }
}

describe('ThemeOps', () => {
  const rootTheme = {
    id: 'd6636b33-111b-40f2-870d-f4dcb7281e43',
    name: 'Starter Theme',
  };
  const alphaTheme = {
    id: '84bbd22e-6def-459f-91c9-4c9aa4e0bec0',
    name: 'Contrast',
  };
  const bravoTheme = {
    id: '05ef90a8-10f2-47fd-a481-c8c52f49e48f',
    name: 'Highlander',
  };
  const theme1 = {
    id: 'a5420670-bae8-4ad6-9595-8477f6bca2c7',
    name: 'Expanse',
    data: THEME_OBJ,
  };
  const allThemes = getConfigEntity('ui/themerealm', 'all');
  const noThemes = getConfigEntity('ui/themerealm', 'empty');
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    // Phase 1: Get/export individual and all and put/import individuals only
    // Phase 3: Deletes individuals by id
    // Phase 4: Deletes individuals by name
    // Phase 5: Delete multiple or all
    if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      (process.env.FRODO_RECORD_PHASE === '1' ||
        process.env.FRODO_RECORD_PHASE === '3' ||
        process.env.FRODO_RECORD_PHASE === '4' ||
        process.env.FRODO_RECORD_PHASE === '5')
    ) {
      await stageThemes(allThemes);
    }
    // Phase 2: Import multiple or all
    else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2'
    ) {
      await stageThemes(noThemes);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageThemes(allThemes);
    }
  });
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  // Phase 1: Get/export individual and all and put/import individuals only
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('readThemes()', () => {
      test('0: Method is implemented', async () => {
        expect(ThemeOps.readThemes).toBeDefined();
      });

      test('1: Read all alpha themes (cloud)', async () => {
        const response = await ThemeOps.readThemes({ realm: 'alpha', state });
        expect(response).toMatchSnapshot();
      });

      test('2: Read all bravo themes (cloud)', async () => {
        const response = await ThemeOps.readThemes({ realm: 'bravo', state });
        expect(response).toMatchSnapshot();
      });

      test('3: Read all root themes (encore)', async () => {
        const response = await ThemeOps.readThemes({ realm: '/', state });
        expect(response).toMatchSnapshot();
      });

      test('4: Read all themes from non-existent realm', async () => {
        const response = await ThemeOps.readThemes({
          realm: 'doesnotexist',
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportThemes()', () => {
      test('0: Method is implemented', async () => {
        expect(ThemeOps.exportThemes).toBeDefined();
      });

      test('1: Export themes', async () => {
        const response = await ThemeOps.exportThemes({ state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object)
        });
      });
    });

    describe('readTheme()', () => {
      test('0: Method is implemented', async () => {
        expect(ThemeOps.readTheme).toBeDefined();
      });

      test(`1: Read alpha theme '${alphaTheme.id}' (cloud)`, async () => {
        const response = await ThemeOps.readTheme({
          themeId: alphaTheme.id,
          realm: 'alpha',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Read bravo theme '${bravoTheme.id}' (cloud)`, async () => {
        const response = await ThemeOps.readTheme({
          themeId: bravoTheme.id,
          realm: 'bravo',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`3: Read root theme '${rootTheme.id}' (encore)`, async () => {
        const response = await ThemeOps.readTheme({
          themeId: rootTheme.id,
          realm: '/',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`4: Read theme '${rootTheme.id}' from non-existent realm`, async () => {
        expect.assertions(1);
        try {
          await ThemeOps.readTheme({
            themeId: rootTheme.id,
            realm: 'doesnotexist',
            state,
          });
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });

    describe('readThemeByName()', () => {
      test('0: Method is implemented', async () => {
        expect(ThemeOps.readThemeByName).toBeDefined();
      });

      test(`1: Read alpha theme '${alphaTheme.name}' (cloud)`, async () => {
        const response = await ThemeOps.readThemeByName({
          themeName: alphaTheme.name,
          realm: 'alpha',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Read bravo theme '${bravoTheme.name}' (cloud)`, async () => {
        const response = await ThemeOps.readThemeByName({
          themeName: bravoTheme.name,
          realm: 'bravo',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`3: Read root theme '${rootTheme.name}' (encore)`, async () => {
        const response = await ThemeOps.readThemeByName({
          themeName: rootTheme.name,
          realm: '/',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`4: Read theme '${rootTheme.name}' from non-existent realm`, async () => {
        expect.assertions(1);
        try {
          await ThemeOps.readThemeByName({
            themeName: rootTheme.name,
            realm: 'doesnotexist',
            state,
          });
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });

    describe('updateTheme()', () => {
      test('0: Method is implemented', async () => {
        expect(ThemeOps.updateTheme).toBeDefined();
      });

      test(`1: Update alpha theme '${theme1.id}' (cloud)`, async () => {
        const response = await ThemeOps.updateTheme({
          themeId: theme1.id,
          themeData: theme1.data,
          realm: 'alpha',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Update bravo theme (cloud)', async () => {
        const response = await ThemeOps.updateTheme({
          themeId: theme1.id,
          themeData: theme1.data,
          realm: 'bravo',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('3: Update root theme (encore)', async () => {
        const response = await ThemeOps.updateTheme({
          themeId: theme1.id,
          themeData: theme1.data,
          realm: '/',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('4: Update theme from non-existent realm (encore)', async () => {
        const response = await ThemeOps.updateTheme({
          themeId: theme1.id,
          themeData: theme1.data,
          realm: 'doesnotexist',
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('updateThemeByName()', () => {
      test('0: Method is implemented', async () => {
        expect(ThemeOps.updateThemeByName).toBeDefined();
      });

      test('1: Update alpha theme (cloud)', async () => {
        const response = await ThemeOps.updateThemeByName({
          themeName: theme1.name,
          themeData: theme1.data,
          realm: 'alpha',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Update bravo theme (cloud)', async () => {
        const response = await ThemeOps.updateThemeByName({
          themeName: theme1.name,
          themeData: theme1.data,
          realm: 'bravo',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('3: Update root theme (encore)', async () => {
        const response = await ThemeOps.updateThemeByName({
          themeName: theme1.name,
          themeData: theme1.data,
          realm: '/',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('4: Update theme from non-existent realm (encore)', async () => {
        const response = await ThemeOps.updateThemeByName({
          themeName: theme1.name,
          themeData: theme1.data,
          realm: 'doesnotexist',
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 2: Import multiple or all
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('updateThemes()', () => {
      test('0: Method is implemented', async () => {
        expect(ThemeOps.updateThemes).toBeDefined();
      });

      test('1: Update 1 and add 1 alpha themes', async () => {
        const response = await ThemeOps.updateThemes({
          themeMap: THEME_MAP,
          realm: 'alpha',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Update 1 and add 1 bravo themes', async () => {
        const response = await ThemeOps.updateThemes({
          themeMap: THEME_MAP,
          realm: 'bravo',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('3: Add 2 root themes', async () => {
        const response = await ThemeOps.updateThemes({
          themeMap: THEME_MAP,
          realm: '/',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('4: Add 2 themes to non-existent realm', async () => {
        const response = await ThemeOps.updateThemes({
          themeMap: THEME_MAP,
          realm: 'doesnotexist',
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 3: Deletes individuals by id
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '3')
  ) {
    describe('deleteTheme()', () => {
      test('0: Method is implemented', async () => {
        expect(ThemeOps.deleteTheme).toBeDefined();
      });

      test(`1: Delete alpha theme '${alphaTheme.id}' (cloud)`, async () => {
        const response = await ThemeOps.deleteTheme({
          themeId: alphaTheme.id,
          realm: 'alpha',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Delete bravo theme '${bravoTheme.id}' (cloud)`, async () => {
        const response = await ThemeOps.deleteTheme({
          themeId: bravoTheme.id,
          realm: 'bravo',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`3: Delete root theme '${rootTheme.id}' (encore)`, async () => {
        const response = await ThemeOps.deleteTheme({
          themeId: rootTheme.id,
          realm: '/',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`4: Delete theme '${rootTheme.id}' from non-existent realm`, async () => {
        expect.assertions(1);
        try {
          await ThemeOps.deleteTheme({
            themeId: rootTheme.id,
            realm: 'doesnotexist',
            state,
          });
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });
  }

  // Phase 4: Deletes individuals by name
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '4')
  ) {
    describe('deleteThemeByName()', () => {
      test('0: Method is implemented', async () => {
        expect(ThemeOps.deleteThemeByName).toBeDefined();
      });

      test(`1: Delete alpha theme '${alphaTheme.name}' by name (cloud)`, async () => {
        const response = await ThemeOps.deleteThemeByName({
          themeName: alphaTheme.name,
          realm: 'alpha',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Delete bravo theme '${bravoTheme.name}' by name (cloud)`, async () => {
        const response = await ThemeOps.deleteThemeByName({
          themeName: bravoTheme.name,
          realm: 'bravo',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`3: Delete root theme '${rootTheme.name}' by name (encore)`, async () => {
        const response = await ThemeOps.deleteThemeByName({
          themeName: rootTheme.name,
          realm: '/',
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`4: Delete theme '${rootTheme.name}' by name from non-existent realm (encore)`, async () => {
        expect.assertions(1);
        try {
          await ThemeOps.deleteThemeByName({
            themeName: rootTheme.name,
            realm: 'doesnotexist',
            state,
          });
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });
  }

  // Phase 5: Delete multiple or all
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '5')
  ) {
    describe('deleteThemes()', () => {
      test('0: Method is implemented', async () => {
        expect(ThemeOps.deleteThemes).toBeDefined();
      });

      test('1: Delete all alpha themes', async () => {
        const response = await ThemeOps.deleteThemes({ realm: 'alpha', state });
        expect(response).toMatchSnapshot();
      });

      test('2: Delete all bravo themes', async () => {
        const response = await ThemeOps.deleteThemes({ realm: 'bravo', state });
        expect(response).toMatchSnapshot();
      });

      test('3: Delete all root themes (encore)', async () => {
        const response = await ThemeOps.deleteThemes({ realm: '/', state });
        expect(response).toMatchSnapshot();
      });

      test('4: Delete all themes in non-existent realm', async () => {
        expect.assertions(1);
        try {
          await ThemeOps.deleteThemes({ realm: 'doesnotexist', state });
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });
  }
});
