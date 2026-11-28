/**
 * Run tests
 *
 *        npm run test:only ClosedPort.unit
 *
 * `closedPort` hands out a port on which nothing listens, and `listen` starts a
 * server on a port that was not handed out. The system decides which port a
 * `listen(0)` gets, so the tests that need it to give the same port twice make
 * it do so: they bind the port that they name where the code asks for port 0.
 */
import http from 'http';
import net, { AddressInfo } from 'net';
import { jest } from '@jest/globals';
import { closedPort, listen } from './ClosedPort';

/** How a connection to a port ended: `ECONNREFUSED` for a port nobody listens on, `connected` for one that is served. */
function connectOutcome(port: number): Promise<string> {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => {
      socket.destroy();
      resolve('connected');
    });
    socket.once('error', (error: NodeJS.ErrnoException) =>
      resolve(error.code ?? 'error')
    );
  });
}

const realListen = net.Server.prototype.listen;

/**
 * Makes the next calls of `listen(0)` bind the ports that are named (0 is the system's
 * choice), and returns the ports that the calls of `listen(0)` were given.
 */
function scriptListen(...ports: number[]): number[] {
  const queue = [...ports];
  const given: number[] = [];
  jest.spyOn(net.Server.prototype, 'listen').mockImplementation(function (
    this: net.Server,
    ...args: unknown[]
  ) {
    if (args[0] === 0) {
      if (queue.length > 0) args[0] = queue.shift();
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        args[args.length - 1] = () => {
          given.push((this.address() as AddressInfo).port);
          callback();
        };
      }
    }
    return (realListen as (...a: unknown[]) => net.Server).apply(this, args);
  });
  return given;
}

const servers: net.Server[] = [];
const serve = async (server: net.Server): Promise<number> => {
  servers.push(server);
  return listen(server);
};

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((done) => server.close(() => done())))
  );
});

describe('closedPort', () => {
  test('1: a connection to the port is refused', async () => {
    expect(await connectOutcome(await closedPort())).toBe('ECONNREFUSED');
  });

  test('2: ports that are handed out one after the other are all different', async () => {
    const ports: number[] = [];
    for (let count = 0; count < 20; count++) ports.push(await closedPort());
    expect(new Set(ports).size).toBe(20);
  });

  test('3: the port that the system gives a second time is not handed out again', async () => {
    const first = await closedPort();
    const given = scriptListen(first, 0);

    const second = await closedPort();

    // the system gave the first port again, and the helper asked again
    expect(given[0]).toBe(first);
    expect(second).not.toBe(first);
    expect(await connectOutcome(second)).toBe('ECONNREFUSED');
  });

  test('4: a port that a connection reaches when it is checked is not handed out', async () => {
    // the check of the first port that the system gives reaches a server: it is taken, not closed
    const live = net.createServer();
    const livePort = await serve(live);
    const given = scriptListen();
    const realConnect = net.connect;
    jest
      .spyOn(net, 'connect')
      .mockImplementationOnce(((_port: number, host: string) =>
        realConnect(livePort, host)) as typeof net.connect);

    const port = await closedPort();

    expect(given).toHaveLength(2);
    expect(port).toBe(given[1]);
    expect(port).not.toBe(given[0]);
    expect(await connectOutcome(port)).toBe('ECONNREFUSED');
  });
});

describe('listen', () => {
  test('1: starts a server that answers', async () => {
    const server = http.createServer((_req, res) => res.end('ok'));
    const port = await serve(server);
    expect(port).toBe((server.address() as AddressInfo).port);
    expect(await connectOutcome(port)).toBe('connected');
  });

  test('2: never starts a server on a port that was handed out as a closed one', async () => {
    const closed = await closedPort();
    const given = scriptListen(closed);
    const server = net.createServer();

    const port = await serve(server);

    // the system gave the closed port, and the helper took the server off it
    expect(given[0]).toBe(closed);
    expect(port).not.toBe(closed);
    expect(await connectOutcome(closed)).toBe('ECONNREFUSED');
    expect(await connectOutcome(port)).toBe('connected');
  });
});
