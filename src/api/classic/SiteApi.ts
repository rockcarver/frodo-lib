import util from 'util';

import { State } from '../../shared/State';
import { IdObjectSkeletonInterface, PagedResult } from '../ApiTypes';
import { generateAmApi } from '../BaseApi';

const siteURLTemplate = '%s/json/global-config/sites/%s';
const sitesURLTemplate = '%s/json/global-config/sites?_queryFilter=true';

const apiVersion = 'protocol=2.0,resource=1.0';

function getApiConfig() {
  return {
    apiVersion,
  };
}

export type SiteSkeleton = IdObjectSkeletonInterface & {
  id: string;
  url: string;
  secondaryURLs: string[];
  servers: {
    id: string;
    url: string;
  }[];
};

/**
 * Get site
 * @param {string} siteId Site id
 * @returns {Promise<SiteSkeleton>} a promise that resolves to a site object
 */
export async function getSite({
  siteId,
  state,
}: {
  siteId: string;
  state: State;
}): Promise<SiteSkeleton> {
  const urlString = util.format(siteURLTemplate, state.getHost(), siteId);
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Get all sites
 * @returns {Promise<PagedResult<SiteSkeleton[]>>} a promise that resolves to an array of site objects
 */
export async function getSites({
  state,
}: {
  state: State;
}): Promise<PagedResult<SiteSkeleton>> {
  const urlString = util.format(sitesURLTemplate, state.getHost());
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put site
 * @param {string} siteId site id
 * @param {SiteSkeleton} siteData site config object
 * @returns {Promise<SiteSkeleton>} a promise that resolves to a site object
 */
export async function putSite({
  siteId,
  siteData,
  state,
}: {
  siteId: string;
  siteData: SiteSkeleton;
  state: State;
}): Promise<SiteSkeleton> {
  const urlString = util.format(siteURLTemplate, state.getHost(), siteId);
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    siteData,
    {
      withCredentials: true,
    }
  );
  return data;
}
