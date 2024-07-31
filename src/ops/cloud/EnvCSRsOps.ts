import {
  createCSR as _createCSR,
  type CSR,
  type CSRResponse,
  deleteCSR as _deleteCSR,
  getCSR as _getCSR,
  getCSRs as _getCSRs,
  updateCSR as _updateCSR,
} from '../../api/cloud/EnvCSRsApi';
import { State } from '../../shared/State';
import { debugMessage } from '../../utils/Console';
import { FrodoError } from '../FrodoError';

export type EnvCSR = {
  /**
   * Read CSR by id
   * @param {string} csrId ID of the CSR
   * @returns {Promise<CSRResponse>} a promise that resolves to a CSRResponse object
   */
  readCSR(csrId: string): Promise<CSRResponse>;
  /**
   * Read all CSRs
   * @returns {Promise<CSRResponse[]>} a promise that resolves to an array of CSRResponse objects
   */
  readCSRs(): Promise<CSRResponse[]>;
  /**
   * Create CSR
   * @param {CSR} csr CSR object
   * @returns {Promise<CSRResponse>} a promise that resolves to a CSRResponse object
   */
  createCSR(csr: CSR): Promise<CSRResponse>;
  /**
   * Create CSR
   * @param {'rsa' | 'ecdsa'} algorithm The algorithm for the private key. The encryption algorithm will either be RSA-2048 or ECDSA P-256 depending on the algorithm choice. The default is RSA-2048.
   * @param {string} businessCategory Category of business, such as "Private Organization", “Government Entity”, “Business Entity”, or “Non-Commercial Entity”. Relevant for EV certificates.
   * @param {string} city City
   * @param {string} commonName Domain name that the SSL certificate is securing
   * @param {string} country Two-letter ISO-3166 country code: string[A-Z]{2}
   * @param {string} email Email: string^\S+@\S+$
   * @param {string} jurisdictionCity This field contains only information relevant to the Jurisdiction of Incorporation or Registration. Relevant for EV certificates.
   * @param {string} jurisdictionCountry This field contains only information relevant to the Jurisdiction of Incorporation or Registration. Relevant for EV certificates.
   * @param {string} jurisdictionState This field contains only information relevant to the Jurisdiction of Incorporation or Registration. Relevant for EV certificates.
   * @param {string} organization Full name of company
   * @param {string} organizationalUnit Company section or department
   * @param {string} postalCode Zip code
   * @param {string} serialNumber The Registration (or similar) Number assigned to the Subject by the Incorporating or Registration Agency in its Jurisdiction of Incorporation or Registration. Relevant for EV certificates.
   * @param {string} state State
   * @param {string} streetAddress Address
   * @param {string[]} subjectAlternativeNames Additional domain or domains that the SSL certificate is securing
   * @returns {Promise<CSRResponse>} a promise that resolves to a CSRResponse object
   */
  createCSR2(
    algorithm: 'rsa' | 'ecdsa',
    businessCategory: string,
    city: string,
    commonName: string,
    country: string,
    email: string,
    jurisdictionCity: string,
    jurisdictionCountry: string,
    jurisdictionState: string,
    organization: string,
    organizationalUnit: string,
    postalCode: string,
    serialNumber: string,
    state: string,
    streetAddress: string,
    subjectAlternativeNames: string[]
  ): Promise<CSRResponse>;
  /**
   * Update CSR
   * @param {string} csrId ID of the CSR
   * @param {string} certificate The matching signed certificate for the request. This should only be set on update requests to upload the certificate.
   * @returns {Promise<CSRResponse>} a promise that resolves to a CSRResponse object
   */
  updateCSR(csrId: string, certificate: string): Promise<CSRResponse>;
  /**
   * Delete CSR
   * @param {string} csrId ID of the CSR
   * @returns {Promise<CSRResponse>} a promise that resolves to a CSRResponse object
   */
  deleteCSR(csrId: string): Promise<CSRResponse>;
  /**
   * Delete all CSRs
   * @returns {Promise<CSRResponse[]>} a promise that resolves to an array of CSRResponse objects
   */
  deleteCSRs(): Promise<CSRResponse[]>;
};

export default (frodoState: State): EnvCSR => {
  return {
    async readCSR(csrId: string): Promise<CSRResponse> {
      return readCSR({ csrId, state: frodoState });
    },
    async readCSRs(): Promise<CSRResponse[]> {
      return readCSRs({ state: frodoState });
    },
    async createCSR(csr: CSR): Promise<CSRResponse> {
      return createCSR({
        csr,
        state: frodoState,
      });
    },
    async createCSR2(
      algorithm: 'rsa' | 'ecdsa',
      businessCategory: string,
      city: string,
      commonName: string,
      country: string,
      email: string,
      jurisdictionCity: string,
      jurisdictionCountry: string,
      jurisdictionState: string,
      organization: string,
      organizationalUnit: string,
      postalCode: string,
      serialNumber: string,
      state: string,
      streetAddress: string,
      subjectAlternativeNames: string[]
    ): Promise<CSRResponse> {
      return createCSR({
        csr: {
          algorithm,
          businessCategory,
          city,
          commonName,
          country,
          email,
          jurisdictionCity,
          jurisdictionCountry,
          jurisdictionState,
          organization,
          organizationalUnit,
          postalCode,
          serialNumber,
          state,
          streetAddress,
          subjectAlternativeNames,
        },
        state: frodoState,
      });
    },
    async updateCSR(csrId: string, certificate: string): Promise<CSRResponse> {
      return updateCSR({
        csrId,
        certificate,
        state: frodoState,
      });
    },
    async deleteCSR(csrId: string): Promise<CSRResponse> {
      return deleteCSR({ csrId, state: frodoState });
    },
    async deleteCSRs(): Promise<CSRResponse[]> {
      return deleteCSRs({ state: frodoState });
    },
  };
};

export async function readCSR({
  csrId,
  state,
}: {
  csrId: string;
  state: State;
}): Promise<CSRResponse> {
  try {
    const csr = await _getCSR({ csrId, state });
    return csr;
  } catch (error) {
    throw new FrodoError(`Error reading CSR ${csrId}`, error);
  }
}

export async function readCSRs({
  state,
}: {
  state: State;
}): Promise<CSRResponse[]> {
  try {
    const result = await _getCSRs({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading CSRs`, error);
  }
}

export async function createCSR({
  csr,
  state,
}: {
  csr: CSR;
  state: State;
}): Promise<CSRResponse> {
  debugMessage({
    message: `EnvCSRsOps.createCSR: start`,
    state,
  });
  try {
    const result = await _createCSR({
      csr,
      state,
    });
    debugMessage({
      message: `EnvCSRsOps.createCSR: end`,
      state,
    });
    return result;
  } catch (error) {
    throw new FrodoError(`Error creating CSR`, error);
  }
}

export async function updateCSR({
  csrId,
  certificate,
  state,
}: {
  csrId: string;
  certificate: string;
  state: State;
}): Promise<CSRResponse> {
  try {
    const result = await _updateCSR({
      csrId,
      certificate,
      state,
    });
    return result;
  } catch (error) {
    throw new FrodoError(`Error updating CSR ${csrId}`, error);
  }
}

export async function deleteCSR({
  csrId,
  state,
}: {
  csrId: string;
  state: State;
}): Promise<CSRResponse> {
  try {
    const result = await _deleteCSR({ csrId, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error deleting CSR ${csrId}`, error);
  }
}

export async function deleteCSRs({
  state,
}: {
  state: State;
}): Promise<CSRResponse[]> {
  const errors = [];
  try {
    const deleted: CSRResponse[] = [];
    const csrs = await _getCSRs({ state });
    for (const csr of csrs) {
      try {
        await _deleteCSR({ csrId: csr.id, state });
        deleted.push(csr);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error deleting CSRs`, errors);
    }
    return deleted;
  } catch (error) {
    // re-throw previously caught error
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error deleting CSRs`, error);
  }
}
