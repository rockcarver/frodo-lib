/**
 * Run tests
 *
 *        npm run test:only State
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../index';
import { JwkRsa } from '../ops/JoseOps';
import Constants from './Constants';
import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('State', () => {
  const host = 'https://openam-frodo-dev.forgeblocks.com/am';
  const hostEnv = 'https://openam-host-env.forgeblocks.com/am';

  describe('getHost()/setHost()/getTenant()/setTenant()', () => {
    test('0: Method getHost is implemented', () => {
      expect(state.getHost).toBeDefined();
    });

    test('1: Method setHost is implemented', () => {
      expect(state.setHost).toBeDefined();
    });

    test('2: Method getTenant is implemented', () => {
      expect(state.getTenant).toBeDefined();
    });

    test('3: Method setTenant is implemented', () => {
      expect(state.setTenant).toBeDefined();
    });

    test("4: Host value should be undefined if it hasn't been set before or defined if FRODO_HOST env variable has been set or if set explicitly", () => {
      delete process.env.FRODO_HOST;
      expect(state.getHost()).toBeUndefined();
      expect(state.getTenant()).toBeUndefined();
      process.env.FRODO_HOST = hostEnv;
      expect(state.getHost()).toEqual(hostEnv);
      expect(state.getTenant()).toEqual(hostEnv);
      state.setHost(host);
      expect(state.getHost()).toEqual(host);
      state.setTenant(host);
      expect(state.getTenant()).toEqual(host);
    });
  });

  describe('getUsername()/setUsername()', () => {
    const username = 'userA';
    const usernameEnv = 'userB';

    test('0: Method getUsername is implemented', () => {
      expect(state.getUsername).toBeDefined();
    });

    test('1: Method setUsername is implemented', () => {
      expect(state.setUsername).toBeDefined();
    });

    test("2: Username value should be undefined if it hasn't been set before or defined if FRODO_USERNAME env variable has been set or if set explicitly", () => {
      delete process.env.FRODO_USERNAME;
      expect(state.getUsername()).toBeUndefined();
      process.env.FRODO_USERNAME = usernameEnv;
      expect(state.getUsername()).toEqual(usernameEnv);
      state.setUsername(username);
      expect(state.getUsername()).toEqual(username);
    });
  });

  describe('getPassword()/setPassword()', () => {
    const password = 'userA';
    const passwordEnv = 'userB';

    test('0: Method getPassword is implemented', () => {
      expect(state.getPassword).toBeDefined();
    });

    test('1: Method setPassword is implemented', () => {
      expect(state.setPassword).toBeDefined();
    });

    test("2: Password value should be undefined if it hasn't been set before or defined if FRODO_PASSWORD env variable has been set or if set explicitly", () => {
      delete process.env.FRODO_PASSWORD;
      expect(state.getPassword()).toBeUndefined();
      process.env.FRODO_PASSWORD = passwordEnv;
      expect(state.getPassword()).toEqual(passwordEnv);
      state.setPassword(password);
      expect(state.getPassword()).toEqual(password);
    });
  });

  describe('getRealm()/setRealm()', () => {
    const realm = 'alpha';
    const realmEnv = 'bravo';

    test('0: Method getRealm is implemented', () => {
      expect(state.getRealm).toBeDefined();
    });

    test('1: Method setRealm is implemented', () => {
      expect(state.setRealm).toBeDefined();
    });

    test("2: Realm value should be undefined if it hasn't been set before or defined if FRODO_REALM env variable has been set or if set explicitly", () => {
      delete process.env.FRODO_REALM;
      expect(state.getRealm()).toBeUndefined();
      process.env.FRODO_REALM = realmEnv;
      expect(state.getRealm()).toEqual(realmEnv);
      state.setRealm(realm);
      expect(state.getRealm()).toEqual(realm);
    });
  });

  describe('getAxiosRetryConfig()/setAxiosRetryConfig()', () => {
    test('0: Method getAxiosRetryConfig is implemented', () => {
      expect(state.getAxiosRetryConfig).toBeDefined();
    });

    test('1: Method setAxiosRetryConfig is implemented', () => {
      expect(state.setAxiosRetryConfig).toBeDefined();
    });

    test("2: axiosRetryConfig value should be undefined if it hasn't been set before or defined if set explicitly", () => {
      const retryConfig = {
        retries: 3
      };

      expect(state.getAxiosRetryConfig()).toBeUndefined();
      state.setAxiosRetryConfig(retryConfig);
      expect(state.getAxiosRetryConfig()).toEqual(retryConfig);
    });
  });

  // setDeploymentType,
  // getDeploymentType,

  // setAllowInsecureConnection,
  // getAllowInsecureConnection,

  // setCookieName,
  // getCookieName,
  // setCookieValue,
  // getCookieValue,

  describe('getAuthenticationHeaderOverrides()/setAuthenticationHeaderOverrides()', () => {
    const override: Record<string, string> = {
      host: hostEnv,
      ["User-Agent"]: 'frodoTestAgent',
      Connection: 'keep-alive'
    };

    test('0: Method getAuthenticationHeaderOverrides is implemented', () => {
      expect(state.getAuthenticationHeaderOverrides).toBeDefined();
    });

    test('1: Method setAuthenticationHeaderOverrides is implemented', () => {
      expect(state.setAuthenticationHeaderOverrides).toBeDefined();
    });

    test("2: Authentication service value should be empty if it hasn't been set before or defined if set explicitly", () => {
      expect(state.getAuthenticationHeaderOverrides()).toMatchObject({});
      state.setAuthenticationHeaderOverrides(override);
      expect(state.getAuthenticationHeaderOverrides()).toMatchObject(override);
    });
  });
  describe('getAuthenticationService()/setAuthenticationService()', () => {
    const loginService = 'Login';

    test('0: Method getAuthenticationService is implemented', () => {
      expect(state.getAuthenticationService).toBeDefined();
    });

    test('1: Method setAuthenticationService is implemented', () => {
      expect(state.setAuthenticationService).toBeDefined();
    });

    test("2: Authentication service value should be undefined if it hasn't been set before or defined if FRODO_AUTHENTICATION_SERVICE env variable has been set or if set explicitly", () => {
      delete process.env.FRODO_AUTHENTICATION_SERVICE;
      expect(state.getAuthenticationService()).toBeUndefined();
      process.env.FRODO_AUTHENTICATION_SERVICE = Constants.DEFAULT_AMSTER_SERVICE;
      expect(state.getAuthenticationService()).toEqual(Constants.DEFAULT_AMSTER_SERVICE);
      state.setAuthenticationService(loginService);
      expect(state.getAuthenticationService()).toEqual(loginService);
    });
  });

  describe('getServiceAccountId()/setServiceAccountId()', () => {
    const saId = '0de8d0d8-e423-41e8-9034-73883af90917';
    const saIdEnv = '4a23bc03-581a-403e-b157-809e0c4f696b';

    test('0: Method getServiceAccountId is implemented', () => {
      expect(state.getServiceAccountId).toBeDefined();
    });

    test('1: Method setServiceAccountId is implemented', () => {
      expect(state.setServiceAccountId).toBeDefined();
    });

    test("2: Id value should be undefined if it hasn't been set before or defined if FRODO_SA_ID env variable has been set or if set explicitly", () => {
      delete process.env.FRODO_SA_ID;
      expect(state.getServiceAccountId()).toBeUndefined();
      process.env.FRODO_SA_ID = saIdEnv;
      expect(state.getServiceAccountId()).toEqual(saIdEnv);
      state.setServiceAccountId(saId);
      expect(state.getServiceAccountId()).toEqual(saId);
    });
  });

  describe('getServiceAccountJwk()/setServiceAccountJwk()', () => {
    const saJwk: JwkRsa = {
      kty: 'RSA',
      kid: 'iG0Xag0qyi7J7AHNkIVLAFQfqzN0cmEH0Upq9M-tZKo',
      alg: 'RS256',
      e: 'AQAB',
      n: 'nptX-N0vC1tgtCyaqjLQSmBQh0n6lQL_r6k0xIdAQR3OP6vTMEC-qAQnVYbRihfDLFrVd3EKY4FGuQEWSQTfz6-a1XmBTnMlVmRBPVUgwVSeYh7VUDLpA7pP2pETq4fPiz8lDOAGaBuTFN26OJDyNdtzuf5tuildnqmgI-VJhR2EtD0MoHoMGJpFWW8rvwgluThObMYgaSzR2-bF5F4f9yUmjw2R3huWKn3YVwkf-i7XymTP4p_JRqbYcWYlcbf7i0K1ichPmy-nkAAUeCp5XOcAU33JouuzTlhcyMyLVguxTpQW-7_O_yzrS6sfTx1TYX6Ovl475Y6HMJxHjIVFdPt-AYAYH_lA2cumRjmQ3K4lPs-yTKXuDeacukb24AryU2eCFHyso9ePWRzjXaOXTbLTzVqsE3DLLe9hhecMdrvNrACqPwLFK9IQV-EjZc29EUNq7YxeuGSFESet0i957ZYFSBjXYn9ynhFgR1i98oH2uZXtSsMSA4CV2QBhg779iSbRdmjzb-ZJQNlfxaOokBF2YBg4EDhVf8kBf9WX9tPEM45_iD-9Ev7xVA3R8sHYgcRnmt-pauhuthqWD70lbX1ssvoY_NQnoSwh8sgg_T0cPSIFRzoljnTwUJQdRFwktRzW5KKaN1s-714CB5-0vn3W0OEj5bsGGrsSxf-vUBs',
      d: 'JoBlQZdHxUUAW5x8Sxacs4Ff6weNWcDpmpXDpnWCpov6tkAauxrsbVLczYk1soUELu855I2_TNpj9aMK6tzRC9SADJQ7THTtOmSJ5b6VffjxnbYIaDiDkhEXM2KGWNxWCGJitxZm17zh3m3Yt8SP130XQa4-qrNB87MPmcceKr84qJwtRYN7Djnc3dH715q9tZGyj_skgQONSgliPoaO0erlylIr97PQpy33Z2FirtPSNGJ2iHfrX0g_QH_gVROpb2vZL8I9eNl_npg2X9lHrsKwtJPTb8Yxt7IBjAkDRfb-qqmOTryIHi-kSrEWn5jp1b_oHNQ5TAdmT-mQAM-VRWezt8vo4VRd8Lf816H5EpbWFiVDiJuE9OwHmbm1AZetp1mn9Qy1pAk5Espaas6aZ5nvIKgXlETCez3C7sa43yStfm_E9lUqXGPgQSAto0mA4dhv-keCGC9FXfoLQO4hGc9b1onK5znVldVsfMxfbOqiudf_0YXB0dQSyXwlD_hUHHh2JHG4D0m3qni7vIuOn2skAYjo_t0gOkNQkR1gBntjMwINhefyVJm5Vyf_dlRGQk8RLc0ntR55xxQ8DM59IhAmVGF5t8R5JovraS1VjN6sUSaRb7p6ug7gVUSbnLu2N_tvkGudyI2EJXsnb1djTzI_J8kAKjvfvRyH1kJWsvE',
      p: 'xlPXcz7fkrqFflIwR3QcJI9PcGlGHhszwUUIfXYEcx_wAtHd6uXR4lhdUh4AMh4Kz4Im2s4hqGpDcAjobgUUhwbBFi7qd7izDTtAKXLQT19p1nWA3wD8VYR48_JcbAL6eD9R2qiGBmIuw50JERRiRIZDcHPL-69Fl33jWFCo_GAhWUOk-KhL4PVTeamcsLwA_crNJKk1H0k3qFKstFhCZ4mBRFQ9KmCSAP48rbCDUSoVZWNu0BIF7li0A6K27akXEAPwO3mV5pmObeZFuUXjGerHQb99H5kPSVAktrYzI22p56VEzBvOiHBMHM4_b2rgxv3n1FcyvTlMmP0RwAQlWQ',
      q: 'zLqPwSzoU97Mkj1KR0HdvrmgV1M6x2RkkLqc7XTEqu9BiCIMn8weTFk-AHcLhWAff0xlIdcl5dBhx6y7okLP0BDnlKzj9v7dj_Ycx4cTkYMTx-DtsPLT1gNsM4T1XPYOvPCvwHwuQRW32BzF3oyHmQ3YTx_4PpYQelNkhzbYQn4s0XyNrfK3unym3tjpxNXSbHTV_XIeuoJCLmEo_sMw3jHOvEgZCABnPqNwsbBGRCWKGmDMCZTAQtp-J7MkHkExQFzcTRRNlKqvAbi83S-MD9UEeyDCE0zg2jI_cv3GZAi-z5EtmewJzFfdwjWXpLNBkbwOyDflqbjmdY1lbfsOkw',
      dp: 'NqD5g6EZ7Ey8YKM68TOmXNuswgX9bmWHyAC_6e8MIrn1XpF4Uy-itHoqmmfxHdzwlWAAW9zToJREpyONAmEb2mWd4gJiSz_w8gAUGFar0nExsgUDzmlzGAs5Vdi4ZHgdjenDHju1TyTURMWIrc-zkbR59wuucFFDFgtzB-yP35SLGw9q7aNN41Uv_R8fLf9bNo0aHLMPEuMUFaVQNQzqnaJenPenMXkQPn3JMP6h7UVuR1MwPtf4EkMUsrurL6OX2q17CqbfB3ncpaD8K6B4gbcN06pvSLjcYRFWS428YFHgrxHy9VXjeemUzYpyJrqF18owhWjPbRfPZYSv0vhRYQ',
      dq: 'Vb854IXnlOE3O3TyPGAo-O4Uax7P-p1gxYFzor0KdjGZd-QS94btlbq3DkjOCYHWD2I25XKQS-34VkJRoEdtdM7vv8SeAmCC-f3x1dwMZSDKUygxRbCe6v8p_XYNsm7Yg2gnpG4ejWIESz7Z3Tlsvb0fwRw5xDTkF-f_reZZs5fXO7J4QMftDe2Rkrq1Rpzr8kMJMYrvtdxCzdwh6HpmaFniJdforAJHO-QGmlWjSH2UlzG9o7GqyRVsS0JruURC1ZtPJfV__Ol0PTtb1yRH_IWSx-NThfPoJVtwWcBSrKlBCfzbZaGIBQ80MVhy-CegKeLjKhbHWUu5MrkTJ3pEgw',
      qi: 'VzTvL7AxXnxuHvPq626uUjSu5dHIt-mJgcggQbAdUPPz49XwZfm12_goY1g0wquP1yf4Cknd_veSdvOW6itjkH_uIKeJOtgW_wnzYaVsglvxXwO7k2Q3rh7cFCYoR_LgI_O-dKCWYHILXdE9L8DDpUFxmXb4o6IR7EXCPKwPeiUZAPIQpXLWoUmPWori_FO3DWzT5EsKu1jkEjRY2IPtc90GRaWKVfQfKo4XscnmgTOjgZey6I3aY7u2qQuoAqszm174OBIKADqMxa_00960VAkKhuYDW-ju7rqdZ1SEa4dT3GmOWXedS9aRLAkvgSiU6BNYwlE7yxcameTBbXWcHA',
    };
    const saJwkEnv = JSON.stringify({
      d: 'A8QC91Nvq8uy4lSak4mYuuc6lNzGkC7figZbZTYBPMOT1TThls9SINFcC3Zpm_ezjIlBePVDa3ppW7MuR9zEqeiXAsy_8a_gpE_6ZGOGLwPzjFbB2cn6MGBn7iMoqdG9CIncyBJ-aXphBr1FsfkYD2Z30W0U1OOAnNKrHSvB-GlRxlvtKd9GTes9L9RWmQWWFPDMxtLxq1odCJ892po0Bsho2V2N5yJsIWfbuubaSKsA_jINvPszyP52MuQfa7nul2ljpKYWMZrNDrzD7BNRxEDuJ0WZPduaMyVbMWFnoTdPvACnmWkbrCeSUi2V7K0DC5HR-7TwIwWMs970mG4U8DShVZAyMU5yMWoh93tGEnm67wMafNDyT_dybRYTIiD4XTZf76eQ8CsR093HKa8akFsHGnCDuJRoB1DCEtHQNkYbBK_l56scVVNbxNcsAflZtGxQELkBQhSI7OK7VK12jGPfurw4qWzXBqqzQEkxOeOZLFu8L68qv1EoraCsX4weje5iVRiF-yYJO_5DLmc_XmDRN4zvBRsnH0MpHSUien4TM5WlhA3NqeBd9s3dirSa5jgZO6eUYD1xfI3Tu5sq4YmuMOUz2wUuKiXP6gWyjBQUra46CN29Z3AWkViGUXzFD3VNqDZzIUhuZu54isOND8SCuUeVtVfOydVPy7qU4cU',
      dp: 'G8gIPKj7jDUD0zRRMGrarud2DRFG6-DPDcN5xj6UoW26uB7bAazwHhDmFUhYOCloAyRPxqjPq-bgGNd90oC7z8kUz-TRkp_ui9mxGf1iZPAgDXOvhXkqq3x3_YU9vZUhJKXV9tWRqou0LGGMvsHvQ96z-yYEv0L1nDt4bh2dYxkP6RKxGU1YFJRAm7cl4cXnA3ZFolq4Jpw-2TCzusJp0jWXM7kZk0bGfShXRQHOEoAvDid_krkKcUhjU5PtqymBu77dnSTNQF4ry6Rl6WJA124fBSqoXBCHvCrVokZZm3S4fna6E7pwgbjRaTP344kzZuRfh-DyHyuL3M2Nxqg8cQ',
      dq: 'A_1pJ1F9U-PyE-WYwJ8zHk2VIez78F4NHPzkzB0pTzzY43nl5Fx1tGjyQRtBmz0XX7VC8EESUZjEF1njoi_ygu32r1oRehnQDtca48MK05jZc1gLmNatgugO-LS2Rf1x5JbKXE6cx4J9TOVyWTkn74uLcyn390VEMnBdrPKOKJDhaxdEhwAM7gateHmDOfMxMUeXQRsyFS934XC4Uwr05VZ_PvxgySIe_yCG0idPejmeFaXLj_O8sSDZ4w76PfO5Z1QzAKNIN3q0rBbmdfYNcw_l0QvZzzHy5vQbOydVepOWJ9cGU0cAj6M1FndFmudJ6jwD01QsElO6u8QjSKQgdw',
      e: 'AQAB',
      kty: 'RSA',
      n: '19ILt44MJCBj2rjmLJbzdog5VQpIFAXCMBwUDUxUWUjH3wbITFIl3aHxLzpV1DCyQcZ3X2xT5Rjs4jvFIXrppvRz1IPN8zMBRhl0m8wwekP1xEtDnszW_5LRcaLS4m03sdg42XGAKV6zIDFZfhsYn_beuyLev3yyuW4-bMYpAb5yU-LKHPpUqvAERNjORMVBmeMOlF2wl0pM9BWZNPWBu15H0C5m6ZLPC4bqHlp8ly3uInyu2nzekyP5li32yZDOQ9RbWWCRAFWrDGKm-XMl2d-hH2YW7_VEVlDk9tfRIBzeYJOq8UVOwCN6g9dHI3hFFVmPu7NmadJ96U_qXtmwJgLFluoFF4lTau8U7M-4A-0ufo5BR-FBd_GF9G9fwipt-pI5Q8_AGFTrHyJVxzyiPByYW3m680PQS9Aajtk9xpPswQ5Bx5yhrDExMyqAyCM2G0NdkkhEiRtwh6D3kucs_KaBP4AA7trwU0YIK1RchOylN9k0F631HrLJU14ADqNq14msv8KS9ziSgL4VOTUKgKSGWQv8yd6d1-jk1xPN2zQDstujKfyL_FxMr1PibXtkVmGl3WDE0HdxqtWjYzlTzA1Mu9iyUocSnKIjuv-Uqco2-47ZnJ9xvyX_BUrVwOtlPZwxJSeVpWSFGSxwMwUp0buuDyDDDqpDzbQRaQOAP48',
      p: '-fW893ekhdqbNdkSlSi8uRTW9_aUosjashDahmixsjNRUku-Oer5x4WO6HewKstJry06uia985Pkb5uT0maQ0VuuNypd46fBbu16A5oXaxJPe_v1E0ivnCgMKPPiS7vp2bnM_gP0MfRtYDf9wvDjYnoFIEN5ygGTuS9CRRkBkkqdPu6A6d-29wOyZcXa6y-vWpR-Q8XjFjnUnE--DE5TGxyWeBFWVKSLCIjNKBqJo_9-CzIbodTh20RYJM5rF3K_GFd9Zkm_y4rmnk1f8IqxMU7P5VkuxNihRa2upFcEI-4k8cYZZBzT3OaqLOTn8WryFexDWQFV5lUEpse3m430zQ',
      q: '3Qkeq4b01Fi3eOWF_46M_ApD18ZomMaKuF-aE-ZXFCi12FpRbA8phTnsGkt2C2da2BqKY_p_YyEKoP8hjvLzbBX9QUyRdOsLLXqjyQUawWP8lFcyLe-hIJVJ9RyPaHWyGoxumdqU6K_kKwI3iwmOU2rmZuFMqDE5SC7EV3mjn7X89tfiMeWVjFuk7dGgPD_eWAcKUlQ4WKBdrlTHCSZKEnqbsgPYgnfpw7znsbEmoolDkuisobb_GvNzwP-h2egOgp55zCA2Q7dSnr6M2IKT00fRdkxbi_Uze1lpqLJzGtj9ftlM4xLKsBlCXSEf2T3Zz4LvMfzXNWhRQcHnf8Olyw',
      qi: 'GxXl9HmYVK3ZqnHBmgeeHDl0V0o0KZtFqLA9SW0gVE34XaDnXql_LFmNauh34dCa9Z0Kt3NruDe8ctR5-W95mELMFrEPx0gt-abO9zN1IB5koLDxPjJsAANjX68k3CncfGJa0AeERxcFLUwWG9GEFrTZ7vs57ApGVogEGwv-tSY1RC_7HM922I29mMfQRH2Ukmrs6TOnNPfHNfeaEMyCIw-WEYGCy7r9QZJYOeaFmJzzDlrXu0cQ1TMG3xUukso4JQsXAjn35xd-bTHqqsKEKZxinfZfwg25Z6qCpR0kDR5U8dbOapIFYHqL1VMYl0L1FziCLJK12gZBMdUFVhfIHg',
    });

    test('0: Method setServiceAccountJwk is implemented', () => {
      expect(state.setServiceAccountJwk).toBeDefined();
    });

    test('1: Method getServiceAccountJwk is implemented', () => {
      expect(state.getServiceAccountJwk).toBeDefined();
    });

    test("2: JWK value should be undefined if it hasn't been set before or defined if FRODO_SA_JWK env variable has been set or if set explicitly", () => {
      delete process.env.FRODO_SA_JWK;
      expect(state.getServiceAccountJwk()).toBeUndefined();
      process.env.FRODO_SA_JWK = saJwkEnv;
      expect(state.getServiceAccountJwk()).toMatchObject(JSON.parse(saJwkEnv));
      state.setServiceAccountJwk(saJwk);
      expect(state.getServiceAccountJwk()).toMatchObject(saJwk);
    });
  });

  describe('getAmsterPrivateKey()/setAmsterPrivateKey()', () => {
    const privateKey1 = fs.readFileSync(
      path.resolve(
        __dirname,
        '../test/mocks/CryptoUtils/pkcs8Rsa.pem'
      ),
      'utf8'
    );
    const privateKey2 = fs.readFileSync(
      path.resolve(
        __dirname,
        '../test/mocks/CryptoUtils/pkcs1Rsa.pem'
      ),
      'utf8'
    );
    const privateKey3 = fs.readFileSync(
      path.resolve(
        __dirname,
        '../test/mocks/CryptoUtils/pkcs8Ed25519Enc.pem'
      ),
      'utf8'
    );
    test('0: Method setAmsterPrivateKey is implemented', () => {
      expect(state.setAmsterPrivateKey).toBeDefined();
    });

    test('1: Method getAmsterPrivateKey is implemented', () => {
      expect(state.getAmsterPrivateKey).toBeDefined();
    });

    test("2: Amster private key value should be undefined if it hasn't been set before or defined if FRODO_AMSTER_PRIVATE_KEY env variable has been set or if set explicitly", () => {
      delete process.env.FRODO_AMSTER_PRIVATE_KEY;
      expect(state.getAmsterPrivateKey()).toBeUndefined();
      process.env.FRODO_AMSTER_PRIVATE_KEY = privateKey1;
      // Tests that privateKey1, in PKCS#8 format, is still in PKCS#8 format after being parsed
      expect(state.getAmsterPrivateKey()).toEqual(privateKey1);
      state.setAmsterPrivateKey(privateKey2);
      // Tests that privateKey2, in PKCS#1 format, is still in PKCS#1 format since we set it directly
      expect(state.getAmsterPrivateKey()).toEqual(privateKey2);
    });

    test("3: Amster private key value should be undefined and throw error if FRODO_AMSTER_PRIVATE_KEY is encrypted and FRODO_AMSTER_PASSPHRASE is not provided, or defined if FRODO_AMSTER_PASSPHRASE is provided.", () => {
      delete process.env.FRODO_AMSTER_PRIVATE_KEY;
      delete process.env.FRODO_AMSTER_PASSPHRASE;
      state.setAmsterPrivateKey(undefined);
      process.env.FRODO_AMSTER_PRIVATE_KEY = privateKey3;
      expect(state.getAmsterPrivateKey).toThrow("The PEM format key (unnamed) is encrypted (password-protected), and no passphrase was provided in `options`");
      process.env.FRODO_AMSTER_PASSPHRASE = 'test';
      // Should be in PKCS#8 format now instead of OpenSSH
      expect(state.getAmsterPrivateKey()).not.toEqual(privateKey3);
    });
  });

  // setUseBearerTokenForAmApis,
  // getUseBearerTokenForAmApis,
  // setBearerToken,
  // getBearerToken,

  describe('getLogApiKey()/setLogApiKey()', () => {
    const logApiKey = '97c2eb0632263a8098de10050884a7ba';
    const logApiKeyEnv = '519f0de7ce94986d02cb0ab456c7e11f';

    test('0: Method getLogApiKey is implemented', () => {
      expect(state.getLogApiKey).toBeDefined();
    });

    test('1: Method setLogApiKey is implemented', () => {
      expect(state.setLogApiKey).toBeDefined();
    });

    test("2: Log API Key value should be undefined if it hasn't been set before or defined if FRODO_LOG_KEY env variable has been set or if set explicitly", () => {
      delete process.env.FRODO_LOG_KEY;
      expect(state.getLogApiKey()).toBeUndefined();
      process.env.FRODO_LOG_KEY = logApiKeyEnv;
      expect(state.getLogApiKey()).toEqual(logApiKeyEnv);
      state.setLogApiKey(logApiKey);
      expect(state.getLogApiKey()).toEqual(logApiKey);
    });
  });

  // setLogApiSecret,
  // getLogApiSecret,
  describe('getLogApiSecret()/setLogApiSecret()', () => {
    const logApiSecret =
      'e95751e1a5aba30d2b49ea475adecc2450aefadf475f30860b2efa7c28fe15f0';
    const logApiSecretEnv =
      '6d3a5241b982fc1da62251c7cd8078b6b62a0e6e84c1f81ce25e76c4b5258b29';

    test('0: Method getLogApiSecret is implemented', () => {
      expect(state.getLogApiSecret).toBeDefined();
    });

    test('1: Method setLogApiSecret is implemented', () => {
      expect(state.setLogApiSecret).toBeDefined();
    });

    test("2: Log API Secret value should be undefined if it hasn't been set before or defined if FRODO_LOG_SECRET env variable has been set or if set explicitly", () => {
      delete process.env.FRODO_LOG_SECRET;
      expect(state.getLogApiSecret()).toBeUndefined();
      process.env.FRODO_LOG_SECRET = logApiSecretEnv;
      expect(state.getLogApiSecret()).toEqual(logApiSecretEnv);
      state.setLogApiSecret(logApiSecret);
      expect(state.getLogApiSecret()).toEqual(logApiSecret);
    });
  });

  // setAmVersion,
  // getAmVersion,

  // setFrodoVersion,
  // getFrodoVersion,

  // setConnectionProfilesPath,
  // getConnectionProfilesPath,

  // setMasterKeyPath,
  // getMasterKeyPath,

  // setOutputFile,
  // getOutputFile,

  // setDirectory,
  // getDirectory,

  // setPrintHandler,
  // getPrintHandler,

  // setVerboseHandler,
  // getVerboseHandler,
  // setVerbose,
  // getVerbose,

  // setDebugHandler,
  // getDebugHandler,
  // setDebug,
  // getDebug,

  // setCurlirizeHandler,
  // getCurlirizeHandler,
  // setCurlirize,
  // getCurlirize,

  // setCreateProgressHandler,
  // getCreateProgressHandler,
  // setUpdateProgressHandler,
  // getUpdateProgressHandler,
  // setStopProgressHandler,
  // getStopProgressHandler,
});
