import util from 'util';

import { State } from '../../shared/State';
import { getHostOnlyUrl } from '../../utils/ForgeRockUtils';
import { NoIdObjectSkeletonInterface } from '../ApiTypes';
import { generateEnvApi } from '../BaseApi';

const csrsURLTemplate = '%s/environment/csrs';
const csrByIdURLTemplate = '%s/environment/csrs/%s';

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * CSR object
 */
export type CSR = {
  /**
   * The algorithm for the private key. The encryption algorithm will either be
   * RSA-2048 or ECDSA P-256 depending on the algorithm choice. The default is RSA-2048.
   */
  algorithm: 'rsa' | 'ecdsa';
  /**
   * Category of business, such as "Private Organization", “Government Entity”,
   * “Business Entity”, or “Non-Commercial Entity”. Relevant for EV certificates.
   */
  businessCategory: string;
  /**
   * City
   */
  city: string;
  /**
   * Domain name that the SSL certificate is securing
   */
  commonName: string;
  /**
   * Two-letter ISO-3166 country code: string[A-Z]{2}
   */
  country: string;
  /**
   * Email: string^\S+@\S+$
   */
  email: string;
  /**
   * This field contains only information relevant to the Jurisdiction
   * of Incorporation or Registration. Relevant for EV certificates.
   */
  jurisdictionCity: string;
  /**
   * This field contains only information relevant to the Jurisdiction
   * of Incorporation or Registration. Relevant for EV certificates.
   */
  jurisdictionCountry: string;
  /**
   * This field contains only information relevant to the Jurisdiction
   * of Incorporation or Registration. Relevant for EV certificates.
   */
  jurisdictionState: string;
  /**
   * Full name of company
   */
  organization: string;
  /**
   * Company section or department
   */
  organizationalUnit: string;
  /**
   * Zip code
   */
  postalCode: string;
  /**
   * The Registration (or similar) Number assigned to the Subject by the Incorporating
   * or Registration Agency in its Jurisdiction of Incorporation or Registration.
   * Relevant for EV certificates.
   */
  serialNumber: string;
  /**
   * State
   */
  state: string;
  /**
   * Address
   */
  streetAddress: string;
  /**
   * Additional domain or domains that the SSL certificate is securing
   */
  subjectAlternativeNames: string[];
};

/**
 * CSR response object skeleton
 */
export type CSRResponse = NoIdObjectSkeletonInterface & {
  /**
   * The algorithm for the private key. The encryption algorithm will either be RSA-2048 or ECDSA P-256 depending on the algorithm choice. The default is RSA-2048.
   */
  algorithm: string;
  /**
   * The ID of the certificate created from this CSR if the CSR has been completed.
   */
  certificateID: string;
  /**
   * Creation timestamp: eg '2006-01-02T15:04:05Z07:00'
   */
  createdDate: string;
  /**
   * The unique identifier for the CSR
   */
  id: string;
  /**
   * PEM formatted CSR.
   */
  request: string;
  /**
   * the CSR subject
   */
  subject: string;
  /**
   * Additional domain or domains that the SSL certificate is securing
   */
  subjectAlternativeNames: string[];
};

/**
 * Get all CSRs
 * @returns {Promise<CSRResponse[]>} a promise that resolves to an array of CSRResponse objects
 */
export async function getCSRs({
  state,
}: {
  state: State;
}): Promise<CSRResponse[]> {
  const urlString = util.format(
    csrsURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Create CSR
 * @param {Object} params Parameters object.
 * @param {CSR} params.csr CSR object
 * @param {State} params.state State object.
 * @returns {Promise<CSRResponse>} a promise that resolves to a CSRResponse object.
 */
export async function createCSR({
  csr,
  state,
}: {
  csr: CSR;
  state: State;
}): Promise<CSRResponse> {
  const urlString = util.format(
    csrsURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, csr, { withCredentials: true });
  return data;
}

/**
 * Delete CSR by id
 * @param {Object} params Parameters object.
 * @param {string} params.csrId The unique identifier for the CSR
 * @param {State} params.state State object.
 * @returns {Promise<CSRResponse>} a promise that resolves to a CSRResponse object
 */
export async function deleteCSR({
  csrId,
  state,
}: {
  csrId: string;
  state: State;
}): Promise<CSRResponse> {
  const urlString = util.format(
    csrByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    csrId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get CSR by id
 * @param {Object} params Parameters object.
 * @param {string} params.csrId ID of the CSR.
 * @param {State} params.state State object.
 * @returns {Promise<CSRResponse>} a promise that resolves to a CSRResponse object
 */
export async function getCSR({
  csrId,
  state,
}: {
  csrId: string;
  state: State;
}): Promise<CSRResponse> {
  const urlString = util.format(
    csrByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    csrId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Update CSR
 * @param {Object} params Parameters object.
 * @param {string} params.csrId ID of the CSR
 * @param {string} params.certificate The matching signed certificate for the request. This should only be set on update requests to upload the certificate.
 * @param {State} params.state State object.
 * @returns {Promise<CSRResponse>} a promise that resolves to a CSRResponse object.
 */
export async function updateCSR({
  csrId,
  certificate,
  state,
}: {
  csrId: string;
  certificate: string;
  state: State;
}): Promise<CSRResponse> {
  const urlString = util.format(
    csrByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    csrId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).patch(urlString, { certificate }, { withCredentials: true });
  return data;
}
