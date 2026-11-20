/**
 * Run tests
 *
 *        npm run test:only ErrorSerialization.requests.unit
 *
 * A function of the facade that makes several requests and returns an object
 * that holds the errors of the requests that failed, instead of throwing them,
 * and the way those errors are written when the object is serialized or printed:
 * as a view, and not as the configuration of the requests.
 *
 * The requests go to a server on the loopback interface in this process, with
 * made-up values in the state.
 */
import http from 'http';
import { AddressInfo } from 'net';
import StateImpl, { State } from '../shared/State';
import { allForms, MARKER_A, MARKER_B } from '../test/utils/SerializationForms';
import { FrodoError } from './FrodoError';
import { deleteJourney, deleteJourneys } from './JourneyOps';

type Answer = { status: number; body: unknown };
type Seen = { method: string; url: string; headers: http.IncomingHttpHeaders };

let server: http.Server;
let origin: string;
/** What each route answers; the tests set it. */
let routes: (method: string, url: string) => Answer;
const seen: Seen[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      seen.push({
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
      });
      const answer = routes(req.method ?? '', req.url ?? '');
      res.writeHead(answer.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(answer.body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  seen.length = 0;
});

const NODES = {
  n1: { nodeType: 'ScriptedDecisionNode', displayName: 'one' },
  n2: { nodeType: 'ScriptedDecisionNode', displayName: 'two' },
};

/** A tenant where the tree can be deleted and read back as gone, and the nodes answer `nodeStatus`. */
function tenant(nodeStatus: number, treeStatus = 200) {
  routes = (method, url) => {
    if (/\/trees\/j1$/.test(url)) {
      if (method === 'DELETE') {
        return treeStatus === 200
          ? { status: 200, body: { _id: 'j1', nodes: NODES } }
          : {
              status: treeStatus,
              body: { code: treeStatus, message: 'tree refused' },
            };
      }
      return { status: 404, body: { code: 404, message: 'Not Found' } };
    }
    if (/\/nodes\//.test(url) && method === 'DELETE') {
      return nodeStatus === 200
        ? { status: 200, body: {} }
        : {
            status: nodeStatus,
            body: { code: nodeStatus, message: 'node refused' },
          };
    }
    return {
      status: 404,
      body: { code: 404, message: `unexpected ${method} ${url}` },
    };
  };
}

function authorizedState(): State {
  const state = StateImpl({});
  state.setHost(`${origin}/am`);
  state.setRealm('alpha');
  state.setDeploymentType('cloud');
  state.setUseBearerTokenForAmApis(true);
  state.setBearerTokenMeta({
    access_token: MARKER_A,
    token_type: 'Bearer',
    expires: Date.now() + 3600e3,
    scope: 'fr:am:* fr:idm:*',
  } as never);
  return state;
}

function cookieState(): State {
  const state = StateImpl({});
  state.setHost(`${origin}/am`);
  state.setRealm('alpha');
  state.setDeploymentType('classic');
  state.setCookieName('iPlanetDirectoryPro');
  state.setUserSessionTokenMeta({
    tokenId: MARKER_B,
    realm: '/',
    successUrl: '/',
    expires: Date.now() + 3600e3,
  });
  return state;
}

function expectNoMarker(value: unknown, markers: string[]) {
  for (const [form, text] of Object.entries(allForms(value))) {
    for (const marker of markers) {
      if (text.includes(marker)) {
        throw new Error(`${marker} is in the form '${form}':\n${text}`);
      }
    }
  }
}

const OPTIONS = { deep: true, verbose: false, progress: false };

describe('an object that holds the errors of requests that failed', () => {
  test('1: the error of a request (409) held at a key is written as a view', async () => {
    tenant(409);
    const status = await deleteJourney({
      journeyId: 'j1',
      options: OPTIONS,
      state: authorizedState(),
    });
    expect(Object.keys(status.nodes)).toEqual(['n1', 'n2']);
    expect(status.nodes['n1'].status).toBe('error');
    expectNoMarker(status, [MARKER_A]);
    const written = JSON.parse(JSON.stringify(status));
    expect(written.nodes.n1.error).toMatchObject({
      name: 'FrodoError',
      httpStatus: 409,
      originalErrors: [
        {
          name: 'AxiosError',
          status: 409,
          method: 'DELETE',
          headers: { Authorization: 'Bearer <redacted>' },
          response: { data: { message: 'node refused' } },
        },
      ],
    });
    expect(written.nodes.n1.error.originalErrors[0].url).toBe(
      `${origin}/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/ScriptedDecisionNode/n1`
    );
  });

  test('2: the error held at the top level of the object is a FrodoError that wraps the error of the request, written as a view', async () => {
    tenant(200, 500);
    const status = await deleteJourney({
      journeyId: 'j1',
      options: OPTIONS,
      state: authorizedState(),
    });
    expect(status.status).toBe('error');
    const held = (status as unknown as { error: FrodoError }).error;
    expect(held).toBeInstanceOf(FrodoError);
    expect(held.message).toBe('Error deleting alpha realm journey j1');
    expect(held.originalErrors).toHaveLength(1);
    expect(held.originalErrors[0].name).toBe('AxiosError');
    expect(held.httpStatus).toBe(500);
    expectNoMarker(status, [MARKER_A]);
    const written = JSON.parse(JSON.stringify(status));
    expect(written.error).toMatchObject({
      name: 'FrodoError',
      httpStatus: 500,
      originalErrors: [
        {
          name: 'AxiosError',
          status: 500,
          headers: { Authorization: 'Bearer <redacted>' },
        },
      ],
    });
  });

  test('2b: a failure that is a FrodoError already is wrapped the same way', async () => {
    // the tree is still there after the delete answered: the function raises its own error
    routes = (method, url) =>
      /\/trees\/j1$/.test(url)
        ? { status: 200, body: { _id: 'j1', nodes: NODES } }
        : { status: 404, body: { code: 404, message: 'unexpected' } };
    const status = await deleteJourney({
      journeyId: 'j1',
      options: OPTIONS,
      state: authorizedState(),
    });
    const held = (status as unknown as { error: FrodoError }).error;
    expect(held).toBeInstanceOf(FrodoError);
    expect(held.message).toBe('Error deleting alpha realm journey j1');
    expect(held.originalErrors[0]).toBeInstanceOf(FrodoError);
    expect(held.getCombinedMessage()).toContain('still exists');
  });

  test('3: with a session cookie the value is not written, its name is', async () => {
    tenant(500);
    const status = await deleteJourney({
      journeyId: 'j1',
      options: OPTIONS,
      state: cookieState(),
    });
    expectNoMarker(status, [MARKER_B]);
    expect(
      JSON.parse(JSON.stringify(status)).nodes.n1.error.originalErrors[0]
        .headers.Cookie
    ).toBe('iPlanetDirectoryPro=<redacted>');
  });

  test('4: every entry of an object that holds many is written the same way', async () => {
    const tenantAnswer = (method: string, url: string): Answer => {
      if (/\/trees\/j1$/.test(url)) {
        return method === 'DELETE'
          ? { status: 200, body: { _id: 'j1', nodes: NODES } }
          : { status: 404, body: { code: 404, message: 'Not Found' } };
      }
      return { status: 409, body: { code: 409, message: 'node refused' } };
    };
    routes = (method, url) => {
      if (/\/trees\?_queryFilter=true$/.test(url)) {
        return {
          status: 200,
          body: { result: [{ _id: 'j1' }], resultCount: 1 },
        };
      }
      return tenantAnswer(method, url);
    };
    const statuses = await deleteJourneys({
      options: { deep: true, verbose: false },
      resultCallback: undefined,
      state: authorizedState(),
    });
    expect(statuses['j1'].nodes['n1'].status).toBe('error');
    expectNoMarker(statuses, [MARKER_A]);
  });

  test('5: the requests of the functions carry the header that the state holds', async () => {
    tenant(409);
    await deleteJourney({
      journeyId: 'j1',
      options: OPTIONS,
      state: authorizedState(),
    });
    const nodeRequests = seen.filter((request) =>
      /\/nodes\//.test(request.url)
    );
    expect(nodeRequests).toHaveLength(2);
    for (const request of nodeRequests) {
      expect(request.headers.authorization).toBe(`Bearer ${MARKER_A}`);
    }
    seen.length = 0;
    await deleteJourney({
      journeyId: 'j1',
      options: OPTIONS,
      state: cookieState(),
    });
    expect(
      seen
        .filter((request) => /\/nodes\//.test(request.url))
        .map((request) => request.headers.cookie)
    ).toEqual([
      `iPlanetDirectoryPro=${MARKER_B}`,
      `iPlanetDirectoryPro=${MARKER_B}`,
    ]);
  });

  test('6: an object that holds no error has nothing to write', async () => {
    tenant(200);
    const status = await deleteJourney({
      journeyId: 'j1',
      options: OPTIONS,
      state: authorizedState(),
    });
    expect(JSON.parse(JSON.stringify(status))).toEqual({
      status: 'success',
      nodes: { n1: { status: 'success' }, n2: { status: 'success' } },
    });
  });
});
