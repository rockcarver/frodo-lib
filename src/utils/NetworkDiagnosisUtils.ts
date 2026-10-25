import dns from 'dns';
import net from 'net';

/**
 * Why a host name could not be resolved, found out with local checks after the
 * system resolver (`getaddrinfo`) has already failed.
 *
 * The failing code, `ENOTFOUND` (or `EAI_AGAIN`), says only that the lookup did
 * not produce an address. A mistyped host, a machine without DNS, and a process
 * that the operating system does not let use the network at all (a sandbox, for
 * example the one a coding agent runs commands in) all look the same, and Frodo
 * can do nothing about the last two. Saying which one it is saves the user the
 * search.
 */
export type NameResolutionDiagnosisKind =
  /** The process may not open sockets: a sandbox that blocks network access. */
  | 'no-network-permission'
  /** DNS answered that the name has no address: a typo. */
  | 'name-does-not-exist'
  /** No DNS server could be reached: offline, firewalled, VPN down. */
  | 'dns-unreachable'
  /** A DNS server was reached and answered with an error. */
  | 'dns-error'
  /** DNS knows the name, the system resolver does not: hosts file, split DNS. */
  | 'resolver-disagrees';

export type NameResolutionDiagnosis = {
  kind: NameResolutionDiagnosisKind;
  /** A sentence for a person, naming the host and what to check. */
  message: string;
};

/** `code` is the error code of a failed check. */
type ProbeResult = { ok: boolean; code?: string };

/**
 * The two local checks the diagnosis is made of. A parameter so that a test can
 * answer them without a sandbox or a network.
 */
export type NameResolutionProbes = {
  /** Can the process open a socket on the loopback interface? No traffic leaves the machine. */
  canBindLoopback: () => Promise<ProbeResult>;
  /** Does DNS itself (not the system resolver) have an address for the name? */
  resolveAddress: (host: string) => Promise<ProbeResult>;
};

/** One DNS query is given this long, and the whole probe never takes more than twice it. */
const DNS_QUERY_TIMEOUT_MS = 1500;
/** How long an answer for a host is kept, so a burst of failing requests runs one diagnosis. */
const CACHE_TTL_MS = 30000;

const NO_PERMISSION_CODES = ['EPERM', 'EACCES'];
const NO_ADDRESS_CODES = ['ENOTFOUND', 'ENODATA'];
const UNREACHABLE_CODES = [
  'ECONNREFUSED',
  'ETIMEOUT',
  'ETIMEDOUT',
  'ECONNRESET',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ENOTINITIALIZED',
  'ECANCELLED',
  'EOF',
];

/**
 * Make the two checks. `dnsServers` replaces the DNS servers of the system, as
 * `host:port` or address, for a test that runs a DNS server of its own.
 * @param {object} options options
 * @param {string[]} options.dnsServers the DNS servers to ask instead of the system's
 * @returns {NameResolutionProbes} the probes
 */
export function createNameResolutionProbes(
  options: { dnsServers?: string[] } = {}
): NameResolutionProbes {
  return {
    canBindLoopback: () =>
      new Promise<ProbeResult>((resolve) => {
        const server = net.createServer();
        server.once('error', (error: NodeJS.ErrnoException) =>
          resolve({ ok: false, code: error.code ?? 'UNKNOWN' })
        );
        server.listen(0, '127.0.0.1', () =>
          server.close(() => resolve({ ok: true }))
        );
      }),
    resolveAddress: (host: string) =>
      new Promise<ProbeResult>((resolve) => {
        const timer = setTimeout(
          () => resolve({ ok: false, code: 'ETIMEOUT' }),
          2 * DNS_QUERY_TIMEOUT_MS
        );
        timer.unref();
        const resolver = new dns.Resolver({
          timeout: DNS_QUERY_TIMEOUT_MS,
          tries: 1,
        });
        if (options.dnsServers) resolver.setServers(options.dnsServers);
        resolver.resolve4(host, (error) => {
          clearTimeout(timer);
          resolve(
            error ? { ok: false, code: error.code ?? 'UNKNOWN' } : { ok: true }
          );
        });
      }),
  };
}

export const defaultNameResolutionProbes = createNameResolutionProbes();

/**
 * Tell whether an error is the failure of the system resolver to find a host:
 * `getaddrinfo` with code `ENOTFOUND` or `EAI_AGAIN`.
 * @param {unknown} error the error to look at
 * @returns {boolean} true if the lookup failed
 */
export function isNameResolutionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, syscall, message } = error as {
    code?: unknown;
    syscall?: unknown;
    message?: unknown;
  };
  return (
    (code === 'ENOTFOUND' || code === 'EAI_AGAIN') &&
    (syscall === 'getaddrinfo' ||
      (typeof message === 'string' && message.includes('getaddrinfo')))
  );
}

/**
 * The host name that could not be resolved. With a proxy this is the proxy's
 * name, not the tenant's, so the error is asked before the request URL.
 * @param {unknown} error a name resolution error
 * @returns {string | undefined} the host name, if the error names one
 */
export function nameResolutionHost(error: unknown): string | undefined {
  const { hostname, message, config } = (error ?? {}) as {
    hostname?: unknown;
    message?: unknown;
    config?: { url?: unknown; baseURL?: unknown };
  };
  if (typeof hostname === 'string' && hostname) return hostname;
  if (typeof message === 'string') {
    const found = message.match(/getaddrinfo (?:ENOTFOUND|EAI_AGAIN) (\S+)/);
    if (found) return found[1];
  }
  for (const url of [config?.url, config?.baseURL]) {
    if (typeof url !== 'string') continue;
    try {
      return new URL(url).hostname || undefined;
    } catch {
      // a relative URL names no host
    }
  }
  return undefined;
}

/**
 * Find out why a host name could not be resolved. Only local checks are made
 * (a socket on the loopback interface, one DNS query for the host), and only
 * after the lookup has already failed.
 * @param {string} host the host name that could not be resolved
 * @param {NameResolutionProbes} probes the checks to make, for tests
 * @returns {Promise<NameResolutionDiagnosis>} what is wrong, for a person to read
 */
export async function diagnoseNameResolution(
  host: string,
  probes: NameResolutionProbes = defaultNameResolutionProbes
): Promise<NameResolutionDiagnosis> {
  const bind = await probes.canBindLoopback();
  if (!bind.ok && NO_PERMISSION_CODES.includes(bind.code)) {
    return {
      kind: 'no-network-permission',
      message: `Cannot resolve '${host}': the operating system does not let this process use the network (opening a local socket failed with ${bind.code}). Frodo is probably running in a sandbox that blocks network access, for example one a coding agent runs commands in. Allow network access for the command, or run it outside the sandbox.`,
    };
  }
  const answer = await probes.resolveAddress(host);
  if (answer.ok) {
    return {
      kind: 'resolver-disagrees',
      message: `Cannot resolve '${host}' with the system resolver, although DNS knows the name. Check the hosts file, VPN or split-DNS settings, and IPv4 and IPv6 settings.`,
    };
  }
  if (NO_ADDRESS_CODES.includes(answer.code)) {
    return {
      kind: 'name-does-not-exist',
      message: `Cannot resolve '${host}': DNS has no address for this name. Check the host name for typos.`,
    };
  }
  if (UNREACHABLE_CODES.includes(answer.code)) {
    return {
      kind: 'dns-unreachable',
      message: `Cannot resolve '${host}': no DNS server could be reached (${answer.code}). Check your network connection, VPN and DNS settings.`,
    };
  }
  return {
    kind: 'dns-error',
    message: `Cannot resolve '${host}': the DNS server answered with an error (${answer.code}). Try again later or check your DNS settings.`,
  };
}

const diagnoses = new Map<
  string,
  { at: number; diagnosis: Promise<NameResolutionDiagnosis> }
>();

/**
 * Diagnose a failed lookup once per host: calls for the same host within a
 * short time, such as the parallel requests of an export, share one diagnosis.
 * @param {string} host the host name that could not be resolved
 * @param {NameResolutionProbes} probes the checks to make, for tests
 * @returns {Promise<NameResolutionDiagnosis>} what is wrong, for a person to read
 */
export function diagnoseNameResolutionOnce(
  host: string,
  probes: NameResolutionProbes = defaultNameResolutionProbes
): Promise<NameResolutionDiagnosis> {
  const key = host.toLowerCase();
  const known = diagnoses.get(key);
  if (known && Date.now() - known.at < CACHE_TTL_MS) return known.diagnosis;
  const diagnosis = diagnoseNameResolution(host, probes);
  diagnoses.set(key, { at: Date.now(), diagnosis });
  return diagnosis;
}

/** Forget the kept diagnoses. For tests. */
export function resetNameResolutionDiagnoses(): void {
  diagnoses.clear();
}

/**
 * Add the diagnosis to an error that is a failed host name lookup, as
 * `nameResolutionDiagnosis`, which `FrodoError.getCombinedMessage()` prints
 * under the error's own message. The error's message and code stay as they
 * were. Any other error is left alone, and so is an error whose host is not
 * known. Never throws.
 * @param {unknown} error the error a request failed with
 * @param {NameResolutionProbes} probes the checks to make, for tests
 * @returns {Promise<void>} resolves when the error has been looked at
 */
export async function attachNameResolutionDiagnosis(
  error: unknown,
  probes: NameResolutionProbes = defaultNameResolutionProbes
): Promise<void> {
  try {
    if (!isNameResolutionError(error)) return;
    const host = nameResolutionHost(error);
    if (!host) return;
    (error as { nameResolutionDiagnosis?: NameResolutionDiagnosis })[
      'nameResolutionDiagnosis'
    ] = await diagnoseNameResolutionOnce(host, probes);
  } catch {
    // the diagnosis is a courtesy, the original error is what counts
  }
}
