import util from 'util';

import { State } from '../../shared/State';
import { getHostBaseUrl } from '../../utils/ForgeRockUtils';
import { NoIdObjectSkeletonInterface } from '../ApiTypes';
import { generateEnvApi } from '../BaseApi';

const certificatesURLTemplate = '%s/environment/certificates';
const certificateByIdURLTemplate = '%s/environment/certificates/%s';

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * Certificate object skeleton
 */
export type CertificateResponse = NoIdObjectSkeletonInterface & {
  active: boolean;
  certificate: string;
  expireTime: string;
  id: string;
  issuer: string;
  live: boolean;
  subject: string;
  subjectAlternativeNames: string[];
  validFromTime: string;
};

/**
 * Get all certificates
 * @returns {Promise<CertificateResponse[]>} a promise that resolves to an array of certificate reponse objects
 */
export async function getCertificates({
  state,
}: {
  state: State;
}): Promise<CertificateResponse[]> {
  const urlString = util.format(
    certificatesURLTemplate,
    getHostBaseUrl(state.getHost())
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
 * Create certificate
 * @param {Object} params Parameters object.
 * @param {boolean} params.active The active status of the certificate. Set this to true for the certificate to actively be served.
 * @param {string} params.certificate The PEM formatted certificate.
 * @param {string} params.privateKey The private key for the certificate. For security reasons, only insert requests include this field.
 * @param {State} params.state State object.
 * @returns {Promise<CertificateResponse>} a promise that resolves to a certificate response object.
 */
export async function createCertificate({
  active,
  certificate,
  privateKey,
  state,
}: {
  active: boolean;
  certificate: string;
  privateKey: string;
  state: State;
}): Promise<CertificateResponse> {
  const urlString = util.format(
    certificatesURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).post(
    urlString,
    { active, certificate, privateKey },
    { withCredentials: true }
  );
  return data;
}

/**
 * Delete certificate by id
 * @param {Object} params Parameters object.
 * @param {string} params.certificateId ID of the certificate resource.
 * @param {State} params.state State object.
 * @returns {Promise<CertificateResponse>} a promise that resolves to a certificate object
 */
export async function deleteCertificate({
  certificateId,
  state,
}: {
  certificateId: string;
  state: State;
}): Promise<CertificateResponse> {
  const urlString = util.format(
    certificateByIdURLTemplate,
    getHostBaseUrl(state.getHost()),
    certificateId
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
 * Get certificate by id
 * @param {Object} params Parameters object.
 * @param {string} params.certificateId ID of the certificate resource.
 * @param {State} params.state State object.
 * @returns {Promise<CertificateResponse>} a promise that resolves to a certificate object
 */
export async function getCertificate({
  certificateId,
  state,
}: {
  certificateId: string;
  state: State;
}): Promise<CertificateResponse> {
  const urlString = util.format(
    certificateByIdURLTemplate,
    getHostBaseUrl(state.getHost()),
    certificateId
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
 * Update certificate
 * @param {Object} params Parameters object.
 * @param {string} params.certificateId ID of the certificate resource.
 * @param {boolean} params.active The active status of the certificate. Set this to true for the certificate to actively be served.
 * @param {State} params.state State object.
 * @returns {Promise<CertificateResponse>} a promise that resolves to a certificate response object.
 */
export async function updateCertificate({
  certificateId,
  active,
  state,
}: {
  certificateId: string;
  active: boolean;
  state: State;
}): Promise<CertificateResponse> {
  const urlString = util.format(
    certificateByIdURLTemplate,
    getHostBaseUrl(state.getHost()),
    certificateId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).patch(urlString, { active }, { withCredentials: true });
  return data;
}
