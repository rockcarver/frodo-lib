import util from 'util';

import { State } from '../shared/State';
import { verboseMessage } from '../utils/Console';
import { getIdmBaseUrl } from '../utils/ForgeRockUtils';
import { IdObjectSkeletonInterface } from './ApiTypes';
import { generateIdmApi } from './BaseApi';

export interface ServiceObjectTypeSkeleton {
  [objectType: string]: ServiceObjectEntry[];
}

export interface ServiceObjectEntry {
  searchField: string;
  searchValue: string;
  fields: string[];
  overrides?: Record<string, string>;
}

export type ServiceObjectSkeleton = IdObjectSkeletonInterface & {
  username?: string;
  mail?: string[];
  name?: string;
  givenName?: string[];
  description?: string;
  status?: string;
  [key: string]: unknown;
};

export async function getServiceObject({
  objectType,
  objectEntry,
  state,
}: {
  objectType: string;
  objectEntry: ServiceObjectEntry;
  state: State;
}): Promise<ServiceObjectSkeleton> {
  verboseMessage({
    message: 'FrConfigServiceObjectApi getServiceObject start',
    state: state,
  });
  const baseUrl = getIdmBaseUrl(state);
  const queryFilter = encodeURIComponent(
    `${objectEntry.searchField} eq "${objectEntry.searchValue}"`
  );
  const fields = objectEntry.fields.join(',');

  const urlString = util.format(
    '%s/managed/%s?_queryFilter=%s&_fields=%s',
    baseUrl,
    objectType,
    queryFilter,
    fields
  );

  const { data } = await generateIdmApi({
    requestOverride: {},
    state,
  }).get(urlString);

  if (data.resultCount != 1) {
    throw new Error(
      `Unexpected result from search: ${data.resultCount} entries found for ${objectType} - ${objectEntry.searchValue}`
    );
  }

  return data.result[0] as ServiceObjectSkeleton;
}
