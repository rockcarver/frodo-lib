import net, { AddressInfo } from 'net';

/**
 * A port on which nothing listens, and a `listen` that never hands that port to
 * a server, for the tests that start servers on the loopback interface and also
 * need an address that refuses a connection (a proxy or a target that is down).
 *
 * The system gives `listen(0)` a free port, and a port that was just closed is
 * free again. Two things went wrong with a plain `listen(0)` followed by a
 * `close()`:
 *
 * - the second call got the port of the first, so two addresses that the test
 *   took for different ones were the same;
 * - a server that a test started later got the closed port, and answered where
 *   the test expected a refusal.
 *
 * So a port is handed out as a closed port once per process, the test checks that
 * it refuses a connection before it returns it, and `listen` asks again when the
 * system gives it a port that was handed out. A port that the system refuses to
 * hand out stays open until the next one is chosen, so that the system cannot
 * hand out the same one again.
 */

/** The ports that `closedPort` handed out in this process. */
const handedOut = new Set<number>();

/** How often the system is asked for a port before the helper gives up. */
const ATTEMPTS = 25;

/** How long a connection to a closed port may take to be refused, in milliseconds. */
const PROBE_LIMIT_MS = 5000;

/** Starts `server` on the loopback interface; port 0 is the port that the system chooses. */
function listenOn(server: net.Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve((server.address() as AddressInfo).port);
    });
  });
}

/** Stops `server` and waits until it is closed. */
function close(server: net.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

/** Whether a connection to the port is refused (and not accepted, and not left waiting). */
function refuses(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.setTimeout(PROBE_LIMIT_MS, () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', (error: NodeJS.ErrnoException) => {
      socket.destroy();
      resolve(error.code === 'ECONNREFUSED');
    });
  });
}

/**
 * Asks the system for a port that was not handed out, and keeps the server that
 * holds it open. The servers that held a port that was handed out are pushed
 * onto `held`: they stay open, so that the system cannot give the same port again.
 */
async function freePort(held: net.Server[]): Promise<net.Server> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const server = net.createServer();
    const port = await listenOn(server, 0);
    if (!handedOut.has(port)) return server;
    held.push(server);
  }
  throw new Error('the system keeps giving ports that were handed out');
}

/**
 * A port on which nothing listens: it is not one that was handed out before in
 * this process, and a connection to it was refused when it was handed out.
 * @returns {Promise<number>} the port
 */
export async function closedPort(): Promise<number> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const held: net.Server[] = [];
    try {
      const server = await freePort(held);
      const port = (server.address() as AddressInfo).port;
      handedOut.add(port);
      await close(server);
      // another process may have taken the port since: it has to refuse
      if (await refuses(port)) return port;
    } finally {
      await Promise.all(held.map(close));
    }
  }
  throw new Error('no port that refuses a connection was found');
}

/**
 * Starts a server on a loopback port that the system chooses, and never on a
 * port that `closedPort` handed out.
 * @param {net.Server} server the server to start
 * @returns {Promise<number>} the port the server listens on
 */
export async function listen(server: net.Server): Promise<number> {
  let port: number | undefined = await listenOn(server, 0);
  for (let attempt = 0; port === undefined || handedOut.has(port); attempt++) {
    if (attempt === ATTEMPTS) {
      throw new Error('no port that was not handed out was found');
    }
    // `server` keeps the port that was handed out, so that the system cannot give it again
    const held: net.Server[] = [];
    let chosen: net.Server;
    try {
      chosen = await freePort(held);
    } finally {
      await Promise.all(held.map(close));
    }
    const next = (chosen.address() as AddressInfo).port;
    await close(chosen);
    await close(server);
    // undefined: another process took the port in between, and the system is asked again
    port = await listenOn(server, next).catch(() => undefined);
  }
  return port;
}
