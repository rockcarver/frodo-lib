import {
  // default instance
  frodo,
  // default state
  state,
  // factory function to create new instances
  FrodoLib,
  // factory helper function to create new instances ready to login with a service account
  createInstanceWithAdminAccount,
  // factory helper function to create new instances ready to login with an admin user account
  createInstanceWithServiceAccount,
} from '@rockcarver/frodo-lib';

const host0 = 'https://openam-matrix.id.forgerock.io/am',
  user0 = 'thomas.anderson@metacortex.com',
  pass0 = 'Blu3P!ll3d',
  host1 = 'https://openam-matrix.id.forgerock.io/am',
  user1 = 'thomas.anderson@metacortex.com',
  pass1 = 'Blu3P!ll3d',
  host2 = 'https://openam-matrix.id.forgerock.io/am',
  user2 = 'thomas.anderson@metacortex.com',
  pass2 = 'Blu3P!ll3d';

/**
 * create a new instance using factory helper function and login as admin user
 */
async function newFactoryHelperAdminLogin() {
  const myFrodo1 = createInstanceWithAdminAccount(host1, user1, pass1);

  // destructure default instance for easier use of library functions
  const { getTokens } = myFrodo1.login;
  const { getInfo } = myFrodo1.info;

  // login and obtain tokens
  if (await getTokens()) {
    // obtain and print information about the instance you are connected to
    const info = await getInfo();
    console.log(`newFactoryHelperAdminLogin: Logged in to: ${info.host}`);
    console.log(`newFactoryHelperAdminLogin: Logged in as: ${info.authenticatedSubject}`);
    console.log(`newFactoryHelperAdminLogin: Using bearer token: \n${info.bearerToken}`);
  } else {
    console.log('error getting tokens');
  }
}
newFactoryHelperAdminLogin();

/**
 * create a new instance using factory function and login as admin user
 */
async function newFactoryAdminLogin() {
  const myFrodo2 = FrodoLib({
    host: host2,
    username: user2,
    password: pass2,
  });

  // destructure default instance for easier use of library functions
  const { getTokens } = myFrodo2.login;
  const { getInfo } = myFrodo2.info;

  // login and obtain tokens
  if (await getTokens()) {
    // obtain and print information about the instance you are connected to
    const info = await getInfo();
    console.log(`newFactoryAdminLogin: Logged in to: ${info.host}`);
    console.log(`newFactoryAdminLogin: Logged in as: ${info.authenticatedSubject}`);
    console.log(`newFactoryAdminLogin: Using bearer token: \n${info.bearerToken}`);
  } else {
    console.log('error getting tokens');
  }
}
newFactoryAdminLogin();

/**
 * use default instance and state
 */

// destructure default instance for easier use of library functions
const { getTokens } = frodo.login;
const { getInfo } = frodo.info;

async function defaultAdminLogin() {
  // this has to be the base URL of your AM service, not just the host hame
  state.setHost(host0);
  // username of an admin user
  state.setUsername(user0);
  // password of the admin user
  state.setPassword(pass0);

  // login and obtain tokens
  if (await getTokens()) {
    // obtain and print information about the instance you are connected to
    const info = await getInfo();
    console.log(`defaultAdminLogin: Logged in to: ${info.host}`);
    console.log(`defaultAdminLogin: Logged in as: ${info.authenticatedSubject}`);
    console.log(`defaultAdminLogin: Using bearer token: \n${info.bearerToken}`);
  } else {
    console.log('error getting tokens');
  }
}
defaultAdminLogin();
