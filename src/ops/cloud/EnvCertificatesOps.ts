import {
  type CertificateResponse,
  createCertificate as _createCertificate,
  deleteCertificate as _deleteCertificate,
  getCertificate as _getCertificate,
  getCertificates as _getCertificates,
  updateCertificate as _updateCertificate,
} from '../../api/cloud/EnvCertificatesApi';
import { State } from '../../shared/State';
import { debugMessage } from '../../utils/Console';
import { FrodoError } from '../FrodoError';

const defaultInterval = 5000;
const defaultRetries = 24;

export type EnvCertificate = {
  /**
   * Read certificate by id
   * @param {string} certificateId certificate id
   * @returns {Promise<CertificateResponse>} a promise that resolves to a certificate object
   */
  readCertificate(certificateId: string): Promise<CertificateResponse>;
  /**
   * Read all certificates
   * @param {boolean} noDecode Do not decode values (default: false)
   * @returns {Promise<CertificateResponse[]>} a promise that resolves to an array of certificate objects
   */
  readCertificates(noDecode?: boolean): Promise<CertificateResponse[]>;
  /**
   * Create certificate
   * @param {boolean} active The active status of the certificate. Set this to true for the certificate to actively be served.
   * @param {string} certificate The PEM formatted certificate.
   * @param {string} privateKey The private key for the certificate. For security reasons, only insert requests include this field.
   * @param {boolean} wait Wait until certificate is live (use interval and retries to modify default behavior)
   * @param {number} interval Only applies when wait=true: Time (in milliseconds) to wait between retries (default: 5000)
   * @param {number} retries Only applies when wait=true: How many times to retry (default: 24)
   * @returns {Promise<CertificateResponse>} a promise that resolves to a certificate object
   */
  createCertificate(
    active: boolean,
    certificate: string,
    privateKey: string,
    wait?: boolean,
    interval?: number,
    retries?: number
  ): Promise<CertificateResponse>;
  /**
   * Update certificate
   * @param {string} certificateId ID of the certificate
   * @param {boolean} active The active status of the certificate. Set this to true for the certificate to actively be served.
   * @returns {Promise<CertificateResponse>} a promise that resolves to a certificate object
   */
  updateCertificate(
    certificateId: string,
    active: boolean
  ): Promise<CertificateResponse>;
  /**
   * Activate certificate
   * @param {string} certificateId ID of the certificate
   * @param {boolean} wait Wait until certificate is live (use interval and retries to modify default behavior)
   * @param {number} interval Only applies when wait=true: Time (in milliseconds) to wait between retries (default: 5000)
   * @param {number} retries Only applies when wait=true: How many times to retry (default: 24)
   * @returns {Promise<CertificateResponse>} a promise that resolves to a certificate object
   */
  activateCertificate(
    certificateId: string,
    wait?: boolean,
    interval?: number,
    retries?: number
  ): Promise<CertificateResponse>;
  /**
   * Deactivate certificate
   * @param {string} certificateId ID of the certificate
   * @param {boolean} wait Wait until certificate is live (use interval and retries to modify default behavior)
   * @param {number} interval Only applies when wait=true: Time (in milliseconds) to wait between retries (default: 5000)
   * @param {number} retries Only applies when wait=true: How many times to retry (default: 24)
   * @returns {Promise<CertificateResponse>} a promise that resolves to a certificate object
   */
  deactivateCertificate(
    certificateId: string,
    wait?: boolean,
    interval?: number,
    retries?: number
  ): Promise<CertificateResponse>;
  /**
   * Check if certificate is active
   * @param {string} certificateId ID of the certificate
   * @returns {Promise<boolean>} a promise that resolves to true or false
   */
  isCertificateActive(certificateId: string): Promise<boolean>;
  /**
   * Check if certificate is live
   * @param {string} certificateId ID of the certificate
   * @returns {Promise<boolean>} a promise that resolves to true or false
   */
  isCertificateLive(certificateId: string): Promise<boolean>;
  /**
   * Delete certificate
   * @param {string} certificateId certificate id/name
   * @param {boolean} force force deletion of active certificate by attempting to deactivate it (use interval and retries to modify default behavior)
   * @param {number} interval Only applies when force=true: Time (in milliseconds) to wait between retries (default: 5000)
   * @param {number} retries Only applies when force=true: How many times to retry (default: 24)
   * @returns {Promise<CertificateResponse>} a promise that resolves to a certificate object
   */
  deleteCertificate(
    certificateId: string,
    force?: boolean,
    interval?: number,
    retries?: number
  ): Promise<CertificateResponse>;
  /**
   * Delete all certificates
   * @param {boolean} force force deletion of active certificate by attempting to deactivate it (use interval and retries to modify default behavior)
   * @param {number} interval Only applies when force=true: Time (in milliseconds) to wait between retries (default: 5000)
   * @param {number} retries Only applies when force=true: How many times to retry (default: 24)
   * @returns {Promise<CertificateResponse>} a promise that resolves to a certificate object
   */
  deleteCertificates(
    force?: boolean,
    interval?: number,
    retries?: number
  ): Promise<CertificateResponse[]>;
};

export default (state: State): EnvCertificate => {
  return {
    async readCertificate(certificateId: string): Promise<CertificateResponse> {
      return readCertificate({ certificateId, state });
    },
    async readCertificates(): Promise<CertificateResponse[]> {
      return readCertificates({ state });
    },
    async createCertificate(
      active: boolean,
      certificate: string,
      privateKey: string,
      wait: boolean = false,
      interval: number = defaultInterval,
      retries: number = defaultRetries
    ): Promise<CertificateResponse> {
      return createCertificate({
        active,
        certificate,
        privateKey,
        wait,
        interval,
        retries,
        state,
      });
    },
    async updateCertificate(
      certificateId: string,
      active: boolean
    ): Promise<CertificateResponse> {
      return updateCertificate({
        certificateId,
        active,
        state,
      });
    },
    async activateCertificate(
      certificateId: string,
      wait: boolean = false,
      interval: number = defaultInterval,
      retries: number = defaultRetries
    ): Promise<CertificateResponse> {
      return activateCertificate({
        certificateId,
        wait,
        interval,
        retries,
        state,
      });
    },
    async deactivateCertificate(
      certificateId: string,
      wait: boolean = false,
      interval: number = defaultInterval,
      retries: number = defaultRetries
    ): Promise<CertificateResponse> {
      return deactivateCertificate({
        certificateId,
        wait,
        interval,
        retries,
        state,
      });
    },
    async isCertificateActive(certificateId: string): Promise<boolean> {
      return isCertificateActive({ certificateId, state });
    },
    async isCertificateLive(certificateId: string): Promise<boolean> {
      return isCertificateLive({ certificateId, state });
    },
    async deleteCertificate(
      certificateId: string,
      force: boolean = false,
      interval: number = defaultInterval,
      retries: number = defaultRetries
    ): Promise<CertificateResponse> {
      return deleteCertificate({
        certificateId,
        force,
        interval,
        retries,
        state,
      });
    },
    async deleteCertificates(
      force = false,
      interval: number = defaultInterval,
      retries: number = defaultRetries
    ): Promise<CertificateResponse[]> {
      return deleteCertificates({ force, interval, retries, state });
    },
  };
};

export async function readCertificate({
  certificateId,
  state,
}: {
  certificateId: string;
  state: State;
}): Promise<CertificateResponse> {
  try {
    const certificate = await _getCertificate({ certificateId, state });
    return certificate;
  } catch (error) {
    throw new FrodoError(`Error reading certificate ${certificateId}`, error);
  }
}

export async function readCertificates({
  state,
}: {
  state: State;
}): Promise<CertificateResponse[]> {
  try {
    const result = await _getCertificates({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading certificates`, error);
  }
}

export async function createCertificate({
  active,
  certificate,
  privateKey,
  wait = false,
  interval = defaultInterval,
  retries = defaultRetries,
  state,
}: {
  active: boolean;
  certificate: string;
  privateKey: string;
  wait?: boolean;
  interval?: number;
  retries?: number;
  state: State;
}): Promise<CertificateResponse> {
  debugMessage({
    message: `EnvCertificatesOps.createCertificate: start`,
    state,
  });
  try {
    const cert = await _createCertificate({
      active,
      certificate,
      privateKey,
      state,
    });
    if (active && wait) {
      if (cert.live) return cert;
      do {
        await sleep(interval);
        cert.live = await isCertificateLive({ certificateId: cert.id, state });
        debugMessage({
          message: `EnvCertificatesOps.createCertificate: live=${cert.live}`,
          state,
        });
        retries--;
      } while (!cert.live && retries > 0);
      if (!cert.live) {
        throw new FrodoError(
          `Timeout waiting for new cert ${cert.id} to go live`
        );
      }
    }
    debugMessage({
      message: `EnvCertificatesOps.createCertificate: end`,
      state,
    });
    return cert;
  } catch (error) {
    throw new FrodoError(`Error creating certificate`, error);
  }
}

export async function updateCertificate({
  certificateId,
  active,
  state,
}: {
  certificateId: string;
  active: boolean;
  state: State;
}): Promise<CertificateResponse> {
  try {
    const result = await _updateCertificate({
      certificateId,
      active,
      state,
    });
    return result;
  } catch (error) {
    throw new FrodoError(`Error updating certificate ${certificateId}`, error);
  }
}

export async function activateCertificate({
  certificateId,
  wait = false,
  interval = defaultInterval,
  retries = defaultRetries,
  state,
}: {
  certificateId: string;
  wait?: boolean;
  interval?: number;
  retries?: number;
  state: State;
}): Promise<CertificateResponse> {
  debugMessage({
    message: `EnvCertificatesOps.activateCertificate: start`,
    state,
  });
  const cert = await updateCertificate({ certificateId, active: true, state });
  if (wait) {
    debugMessage({
      message: `EnvCertificatesOps.activateCertificate: live=${cert.live}`,
      state,
    });
    if (cert.live) return cert;
    do {
      await sleep(interval);
      cert.live = await isCertificateLive({ certificateId, state });
      debugMessage({
        message: `EnvCertificatesOps.activateCertificate: live=${cert.live}`,
        state,
      });
      retries--;
    } while (!cert.live && retries > 0);
    if (!cert.live) {
      throw new FrodoError(
        `Timeout waiting for activated cert ${cert.id} to go live`
      );
    }
  }
  debugMessage({
    message: `EnvCertificatesOps.activateCertificate: end`,
    state,
  });
  return cert;
}

export async function deactivateCertificate({
  certificateId,
  wait = false,
  interval = defaultInterval,
  retries = defaultRetries,
  state,
}: {
  certificateId: string;
  wait?: boolean;
  interval?: number;
  retries?: number;
  state: State;
}): Promise<CertificateResponse> {
  debugMessage({
    message: `EnvCertificatesOps.deactivateCertificate: start`,
    state,
  });
  const cert = await updateCertificate({ certificateId, active: false, state });
  if (wait) {
    debugMessage({
      message: `EnvCertificatesOps.deactivateCertificate: live=${cert.live}`,
      state,
    });
    if (!cert.live) return cert;
    do {
      await sleep(interval);
      cert.live = await isCertificateLive({ certificateId, state });
      debugMessage({
        message: `EnvCertificatesOps.deactivateCertificate: live=${cert.live}`,
        state,
      });
      retries--;
    } while (cert.live && retries > 0);
    if (cert.live) {
      throw new FrodoError(
        `Timeout waiting for deactivated cert ${cert.id} to go offline`
      );
    }
  }
  debugMessage({
    message: `EnvCertificatesOps.deactivateCertificate: end`,
    state,
  });
  return cert;
}

export async function isCertificateActive({
  certificateId,
  state,
}: {
  certificateId: string;
  state: State;
}): Promise<boolean> {
  try {
    const certificate = await _getCertificate({ certificateId, state });
    return certificate.active;
  } catch (error) {
    throw new FrodoError(`Error reading certificate ${certificateId}`, error);
  }
}

export async function isCertificateLive({
  certificateId,
  state,
}: {
  certificateId: string;
  state: State;
}): Promise<boolean> {
  try {
    const certificate = await _getCertificate({ certificateId, state });
    return certificate.live;
  } catch (error) {
    throw new FrodoError(`Error reading certificate ${certificateId}`, error);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function deleteCertificate({
  certificateId,
  force = false,
  interval = defaultInterval,
  retries = defaultRetries,
  state,
}: {
  certificateId: string;
  force?: boolean;
  interval?: number;
  retries?: number;
  state: State;
}): Promise<CertificateResponse> {
  debugMessage({
    message: `EnvCertificatesOps.deleteCertificate: start`,
    state,
  });
  try {
    let cert = await _getCertificate({ certificateId, state });
    // delete and report any errors
    if (!force) {
      await _deleteCertificate({ certificateId, state });
      return cert;
    }
    // force delete
    if (force && cert.active) {
      cert = await deactivateCertificate({
        certificateId,
        wait: true,
        interval,
        state,
      });
    }
    let fe: FrodoError;
    let isError = false;
    do {
      retries--;
      await sleep(interval);
      try {
        debugMessage({
          message: `EnvCertificatesOps.deleteCertificate: ${fe}, retrying...`,
          state,
        });
        await _deleteCertificate({ certificateId, state });
        isError = false;
      } catch (error) {
        fe = new FrodoError(error.message, error);
        if (fe.httpStatus === 500 && fe.httpCode === 'ERR_BAD_RESPONSE') {
          isError = true;
        }
      }
    } while (isError && retries > 0);
    if (isError) {
      debugMessage({
        message: `EnvCertificatesOps.deleteCertificate: ${fe}, aborting`,
        state,
      });
      throw fe;
    }
    debugMessage({
      message: `EnvCertificatesOps.deleteCertificate: end`,
      state,
    });
    return cert;
  } catch (error) {
    throw new FrodoError(`Error deleting certificate ${certificateId}`, error);
  }
}

function inactiveAndOffline(certs: CertificateResponse[]): boolean {
  return certs.every((item) => !item.active && !item.live);
}

export async function deleteCertificates({
  force = false,
  interval = defaultInterval,
  retries = defaultRetries,
  state,
}: {
  force?: boolean;
  interval?: number;
  retries?: number;
  state: State;
}): Promise<CertificateResponse[]> {
  debugMessage({
    message: `EnvCertificatesOps.deleteCertificates: start`,
    state,
  });
  let errors = [];
  try {
    let certs = await readCertificates({ state });

    // no force
    if (!force) {
      debugMessage({
        message: `EnvCertificatesOps.deleteCertificates: force: ${force}, inactiveAndOffline: ${inactiveAndOffline(certs)}`,
        state,
      });
      const deletes: Promise<CertificateResponse>[] = [];
      for (const cert of certs) {
        deletes.push(deleteCertificate({ certificateId: cert.id, state }));
      }
      const results = await Promise.allSettled(deletes);
      errors = results
        .filter((result) => result.status === 'rejected')
        .map((result) => (result as PromiseRejectedResult).reason);
      const deleted = results
        .filter((result) => result.status === 'fulfilled')
        .map(
          (result) =>
            (result as PromiseFulfilledResult<CertificateResponse>).value
        );
      if (errors.length > 0) {
        throw new FrodoError(`Error deleting certificates`, errors);
      }
      debugMessage({
        message: `EnvCertificatesOps.deleteCertificates: end`,
        state,
      });
      return deleted;
    }

    // force
    if (force) {
      debugMessage({
        message: `EnvCertificatesOps.deleteCertificates: force: ${force}, inactiveAndOffline: ${inactiveAndOffline(certs)}`,
        state,
      });
      if (!inactiveAndOffline(certs)) {
        const deactivate: Promise<CertificateResponse>[] = [];
        // deactivate active certs
        for (const cert of certs.filter((cert) => cert.active)) {
          deactivate.push(
            deactivateCertificate({
              certificateId: cert.id,
              wait: true,
              interval,
              state,
            })
          );
        }
        debugMessage({
          message: `EnvCertificatesOps.deleteCertificates: deactivation of ${certs.length} certs initiated`,
          state,
        });
        await Promise.allSettled(deactivate);
        debugMessage({
          message: `EnvCertificatesOps.deleteCertificates: deactivation of ${certs.length} certs completed`,
          state,
        });
        // poll until all certs are offline
        do {
          await sleep(interval);
          certs = await readCertificates({ state });
          debugMessage({
            message: `EnvCertificatesOps.deleteCertificates: inactiveAndOffline: ${inactiveAndOffline(certs)}`,
            state,
          });
          retries--;
        } while (certs.every((cert) => cert.live) && retries > 0);
        if (certs.every((cert) => cert.live)) {
          errors.push(
            new FrodoError(
              `Timeout waiting for deactivated certs to go offline`
            )
          );
        }
      }
      // by now all certs should be inactive and offline
      const deletes: Promise<CertificateResponse>[] = [];
      for (const cert of certs) {
        deletes.push(
          deleteCertificate({
            certificateId: cert.id,
            force,
            interval,
            retries,
            state,
          })
        );
      }
      debugMessage({
        message: `EnvCertificatesOps.deleteCertificates: deletion of ${certs.length} certs initiated`,
        state,
      });
      const results = await Promise.allSettled(deletes);
      debugMessage({
        message: `EnvCertificatesOps.deleteCertificates: deletion of ${certs.length} certs completed`,
        state,
      });
      errors = results
        .filter((result) => result.status === 'rejected')
        .map((result) => (result as PromiseRejectedResult).reason);
      const deleted = results
        .filter((result) => result.status === 'fulfilled')
        .map(
          (result) =>
            (result as PromiseFulfilledResult<CertificateResponse>).value
        );
      if (errors.length > 0) {
        throw new FrodoError(`Error deleting certificates`, errors);
      }
      debugMessage({
        message: `EnvCertificatesOps.deleteCertificates: end`,
        state,
      });
      return deleted;
    }
  } catch (error) {
    // re-throw previously caught error
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error deleting certificates`, error);
  }
}
