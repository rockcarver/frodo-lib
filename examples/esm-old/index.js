import { state, Authenticate, ConnectionProfile } from '@rockcarver/frodo-lib';

const { getTokens } = Authenticate;
const { getConnectionProfile } = ConnectionProfile;
console.log('start');

const outputHandler = (message) => {
  console.log(message);
};

async function login() {
  console.log('started');
  state.setDebug(true);
  state.setDebugHandler(outputHandler);
  state.setPrintHandler(outputHandler);
  state.setHost('volker-dev');
  let conn;
  try {
    conn = await getConnectionProfile();
    console.log(conn);
    if (await getTokens()) {
      console.log(state);
    }
  } catch (error) {
    console.log(error);
  }
}

login();
