/**
 * Unit tests for the diagnosis of a host name that cannot be resolved.
 *
 * Run with:
 *
 *        npm run test:only NetworkDiagnosisUtils
 *
 * Origin: frodo-cli#922 and frodo-lib#806. `getaddrinfo ENOTFOUND <host>` was
 * the whole message when a coding agent's sandbox denied the process the
 * network, and it is the same message for a mistyped host or a machine without
 * DNS. A sandbox cannot run in CI, so the decision is tested with fake probes,
 * and the two real probes are tested against a DNS server that runs on the
 * loopback interface of the test itself: no network, no recording.
 *
 * What these tests cannot show is the operating system refusing a socket. That
 * was checked by hand on macOS, with `sandbox-exec` and a profile that denies
 * `network*` (see the pull request).
 */
import dgram from 'dgram';
import { AddressInfo } from 'net';
import { jest } from '@jest/globals';
import {
  attachNameResolutionDiagnosis,
  createNameResolutionProbes,
  diagnoseNameResolution,
  diagnoseNameResolutionOnce,
  isNameResolutionError,
  nameResolutionHost,
  NameResolutionProbes,
  resetNameResolutionDiagnoses,
} from './NetworkDiagnosisUtils';

function lookupError(code = 'ENOTFOUND', host = 'tenant.example.com') {
  const error: NodeJS.ErrnoException = new Error(`getaddrinfo ${code} ${host}`);
  error.code = code;
  return error;
}

function probes(
  bind: { ok: true } | { ok: false; code: string },
  resolve: { ok: true } | { ok: false; code: string }
): NameResolutionProbes & {
  calls: { bind: number; resolve: string[] };
} {
  const calls = { bind: 0, resolve: [] as string[] };
  return {
    calls,
    canBindLoopback: async () => {
      calls.bind++;
      return bind;
    },
    resolveAddress: async (host: string) => {
      calls.resolve.push(host);
      return resolve;
    },
  };
}

beforeEach(() => resetNameResolutionDiagnoses());

describe('isNameResolutionError', () => {
  test('1: ENOTFOUND and EAI_AGAIN of getaddrinfo are name resolution errors', () => {
    expect(isNameResolutionError(lookupError('ENOTFOUND'))).toBe(true);
    expect(isNameResolutionError(lookupError('EAI_AGAIN'))).toBe(true);
  });

  test('2: The syscall counts as well as the message', () => {
    const error: NodeJS.ErrnoException = new Error('lookup failed');
    error.code = 'ENOTFOUND';
    error.syscall = 'getaddrinfo';
    expect(isNameResolutionError(error)).toBe(true);
  });

  test('3: Other failures are not', () => {
    expect(isNameResolutionError(lookupError('ECONNREFUSED'))).toBe(false);
    // a DNS query that failed (c-ares), not the system resolver
    const query: NodeJS.ErrnoException = new Error('queryA ENOTFOUND host');
    query.code = 'ENOTFOUND';
    expect(isNameResolutionError(query)).toBe(false);
    expect(isNameResolutionError(new Error('getaddrinfo is mentioned'))).toBe(
      false
    );
    expect(isNameResolutionError(undefined)).toBe(false);
    expect(isNameResolutionError('ENOTFOUND')).toBe(false);
  });
});

describe('nameResolutionHost', () => {
  test('1: The host is read from the message', () => {
    expect(nameResolutionHost(lookupError('ENOTFOUND', 'a.example.com'))).toBe(
      'a.example.com'
    );
    expect(nameResolutionHost(lookupError('EAI_AGAIN', 'b.example.com'))).toBe(
      'b.example.com'
    );
  });

  test('2: The hostname of the error wins, and the request URL is the fallback', () => {
    const named = Object.assign(lookupError('ENOTFOUND', 'from-message'), {
      hostname: 'from-field',
    });
    expect(nameResolutionHost(named)).toBe('from-field');
    const bare: NodeJS.ErrnoException & { config?: object } = new Error(
      'getaddrinfo ENOTFOUND'
    );
    bare.code = 'ENOTFOUND';
    bare.config = { url: 'https://tenant.example.com/am/json/serverinfo/*' };
    expect(nameResolutionHost(bare)).toBe('tenant.example.com');
  });

  test('3: An error that names no host gives none', () => {
    expect(nameResolutionHost(new Error('nope'))).toBeUndefined();
    expect(nameResolutionHost(undefined)).toBeUndefined();
  });
});

describe('diagnoseNameResolution (fake probes)', () => {
  const cases: [
    string,
    { ok: true } | { ok: false; code: string },
    { ok: true } | { ok: false; code: string },
    string,
    RegExp,
  ][] = [
    [
      'a sandbox that denies sockets (EPERM)',
      { ok: false, code: 'EPERM' },
      { ok: false, code: 'ECONNREFUSED' },
      'no-network-permission',
      /does not let this process use the network .*EPERM.*sandbox/,
    ],
    [
      'a process that may not bind (EACCES)',
      { ok: false, code: 'EACCES' },
      { ok: false, code: 'ETIMEOUT' },
      'no-network-permission',
      /EACCES/,
    ],
    [
      'a mistyped host (NXDOMAIN)',
      { ok: true },
      { ok: false, code: 'ENOTFOUND' },
      'name-does-not-exist',
      /DNS has no address for this name\. Check the host name for typos\./,
    ],
    [
      'a name without an address record',
      { ok: true },
      { ok: false, code: 'ENODATA' },
      'name-does-not-exist',
      /DNS has no address/,
    ],
    [
      'no DNS server reachable (refused)',
      { ok: true },
      { ok: false, code: 'ECONNREFUSED' },
      'dns-unreachable',
      /no DNS server could be reached \(ECONNREFUSED\)/,
    ],
    [
      'no DNS server reachable (timeout)',
      { ok: true },
      { ok: false, code: 'ETIMEOUT' },
      'dns-unreachable',
      /ETIMEOUT.*VPN/,
    ],
    [
      'a DNS server that fails',
      { ok: true },
      { ok: false, code: 'ESERVFAIL' },
      'dns-error',
      /answered with an error \(ESERVFAIL\)/,
    ],
    [
      'DNS that knows a name the system resolver does not',
      { ok: true },
      { ok: true },
      'resolver-disagrees',
      /system resolver, although DNS knows the name.*hosts file/,
    ],
    [
      'a loopback bind that fails for another reason',
      { ok: false, code: 'EADDRNOTAVAIL' },
      { ok: false, code: 'ENOTFOUND' },
      'name-does-not-exist',
      /typos/,
    ],
  ];

  test.each(cases)('%s', async (_name, bind, resolve, kind, message) => {
    const result = await diagnoseNameResolution(
      'tenant.example.com',
      probes(bind, resolve)
    );
    expect(result.kind).toBe(kind);
    expect(result.message).toMatch(message);
    expect(result.message).toContain("'tenant.example.com'");
  });

  test('a sandbox is decided before DNS is asked', async () => {
    const fake = probes({ ok: false, code: 'EPERM' }, { ok: true });
    await diagnoseNameResolution('tenant.example.com', fake);
    expect(fake.calls.resolve).toEqual([]);
  });
});

describe('diagnoseNameResolutionOnce', () => {
  test('1: Parallel failures for one host share a single diagnosis', async () => {
    const fake = probes({ ok: true }, { ok: false, code: 'ENOTFOUND' });
    const all = await Promise.all(
      Array.from({ length: 50 }, () =>
        diagnoseNameResolutionOnce('Tenant.example.com', fake)
      )
    );
    expect(fake.calls.bind).toBe(1);
    expect(fake.calls.resolve).toEqual(['Tenant.example.com']);
    expect(new Set(all.map((d) => d.message)).size).toBe(1);
  });

  test('2: Another host is diagnosed on its own', async () => {
    const fake = probes({ ok: true }, { ok: false, code: 'ENOTFOUND' });
    await diagnoseNameResolutionOnce('a.example.com', fake);
    await diagnoseNameResolutionOnce('b.example.com', fake);
    expect(fake.calls.resolve).toEqual(['a.example.com', 'b.example.com']);
  });

  test('3: The answer is not kept for long', async () => {
    const fake = probes({ ok: true }, { ok: false, code: 'ENOTFOUND' });
    const now = jest.spyOn(Date, 'now');
    try {
      now.mockReturnValue(1_000_000);
      await diagnoseNameResolutionOnce('a.example.com', fake);
      now.mockReturnValue(1_000_000 + 10_000);
      await diagnoseNameResolutionOnce('a.example.com', fake);
      expect(fake.calls.resolve.length).toBe(1);
      now.mockReturnValue(1_000_000 + 60_000);
      await diagnoseNameResolutionOnce('a.example.com', fake);
      expect(fake.calls.resolve.length).toBe(2);
    } finally {
      now.mockRestore();
    }
  });
});

describe('attachNameResolutionDiagnosis', () => {
  test('1: A failed lookup gets the diagnosis, and keeps its message and code', async () => {
    const error = lookupError();
    await attachNameResolutionDiagnosis(
      error,
      probes({ ok: false, code: 'EPERM' }, { ok: false, code: 'ENOTFOUND' })
    );
    expect(error['nameResolutionDiagnosis']).toEqual({
      kind: 'no-network-permission',
      message: expect.stringContaining("Cannot resolve 'tenant.example.com'"),
    });
    expect(error.message).toBe('getaddrinfo ENOTFOUND tenant.example.com');
    expect(error.code).toBe('ENOTFOUND');
  });

  test('2: Any other error is left alone and asks nothing', async () => {
    const fake = probes({ ok: true }, { ok: true });
    const refused = lookupError('ECONNREFUSED');
    await attachNameResolutionDiagnosis(refused, fake);
    await attachNameResolutionDiagnosis(new Error('boom'), fake);
    await attachNameResolutionDiagnosis(undefined, fake);
    expect(refused['nameResolutionDiagnosis']).toBeUndefined();
    expect(fake.calls.bind).toBe(0);
  });

  test('3: A probe that throws never turns into a different error', async () => {
    const error = lookupError();
    await expect(
      attachNameResolutionDiagnosis(error, {
        canBindLoopback: async () => {
          throw new Error('probe broke');
        },
        resolveAddress: async () => ({ ok: true }),
      })
    ).resolves.toBeUndefined();
    expect(error['nameResolutionDiagnosis']).toBeUndefined();
    expect(error.message).toBe('getaddrinfo ENOTFOUND tenant.example.com');
  });
});

// The real probes, against a DNS server of the test on the loopback interface.

/** A DNS server that answers every query with the given rcode, and an A record for NOERROR. */
async function fakeDnsServer(rcode: number, answer: boolean) {
  const socket = dgram.createSocket('udp4');
  socket.on('message', (query, remote) => {
    // header (12 bytes) and the one question: labels, a zero byte, type and class
    let end = 12;
    while (query[end] !== 0) end += query[end] + 1;
    end += 5;
    const response = Buffer.alloc(end + (answer ? 16 : 0));
    query.copy(response, 0, 0, end);
    response.writeUInt16BE(0x8180 | rcode, 2); // QR, RD, RA, rcode
    response.writeUInt16BE(answer ? 1 : 0, 6); // answer count
    response.writeUInt16BE(0, 8); // no authority records
    response.writeUInt16BE(0, 10); // no additional records
    if (answer) {
      Buffer.from([
        0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 60, 0, 4, 127, 0, 0, 1,
      ]).copy(response, end);
    }
    socket.send(response, remote.port, remote.address);
  });
  await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve));
  const { port } = socket.address() as AddressInfo;
  return {
    server: `127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => socket.close(() => resolve())),
  };
}

describe('the real probes', () => {
  test('1: A loopback socket can be opened where the process may use sockets', async () => {
    await expect(
      createNameResolutionProbes().canBindLoopback()
    ).resolves.toEqual({ ok: true });
  });

  test('2: DNS that answers NXDOMAIN is a name that does not exist', async () => {
    const dnsServer = await fakeDnsServer(3, false);
    try {
      const real = createNameResolutionProbes({
        dnsServers: [dnsServer.server],
      });
      await expect(real.resolveAddress('typo.example.com')).resolves.toEqual({
        ok: false,
        code: 'ENOTFOUND',
      });
      const result = await diagnoseNameResolution('typo.example.com', real);
      expect(result.kind).toBe('name-does-not-exist');
    } finally {
      await dnsServer.close();
    }
  });

  test('3: DNS that has an address is a resolver that disagrees', async () => {
    const dnsServer = await fakeDnsServer(0, true);
    try {
      const real = createNameResolutionProbes({
        dnsServers: [dnsServer.server],
      });
      await expect(real.resolveAddress('known.example.com')).resolves.toEqual({
        ok: true,
      });
      const result = await diagnoseNameResolution('known.example.com', real);
      expect(result.kind).toBe('resolver-disagrees');
    } finally {
      await dnsServer.close();
    }
  });

  test('4: DNS that fails is a DNS error', async () => {
    const dnsServer = await fakeDnsServer(2, false);
    try {
      const real = createNameResolutionProbes({
        dnsServers: [dnsServer.server],
      });
      const result = await diagnoseNameResolution('broken.example.com', real);
      expect(result.kind).toBe('dns-error');
      expect(result.message).toContain('ESERVFAIL');
    } finally {
      await dnsServer.close();
    }
  });

  test('5: A DNS server that never answers is given up on after a few seconds', async () => {
    const socket = dgram.createSocket('udp4');
    socket.on('message', () => undefined); // reads the query, never answers
    await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve));
    const { port } = socket.address() as AddressInfo;
    try {
      const real = createNameResolutionProbes({
        dnsServers: [`127.0.0.1:${port}`],
      });
      const started = Date.now();
      await expect(real.resolveAddress('silent.example.com')).resolves.toEqual({
        ok: false,
        code: 'ETIMEOUT',
      });
      expect(Date.now() - started).toBeLessThan(4000);
    } finally {
      await new Promise<void>((resolve) => socket.close(() => resolve()));
    }
  }, 10000);

  test('6: No DNS server at the address is an unreachable DNS server', async () => {
    // a port that nothing listens on: bind a UDP socket, note its port, close it
    const socket = dgram.createSocket('udp4');
    await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve));
    const { port } = socket.address() as AddressInfo;
    await new Promise<void>((resolve) => socket.close(() => resolve()));
    const real = createNameResolutionProbes({
      dnsServers: [`127.0.0.1:${port}`],
    });
    const result = await diagnoseNameResolution('any.example.com', real);
    expect(result.kind).toBe('dns-unreachable');
  }, 10000);
});
