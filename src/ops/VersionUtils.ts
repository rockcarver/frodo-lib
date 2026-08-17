import { generateReleaseApi } from '../api/BaseApi';
import { State } from '../shared/State';
import { getLibBuildTimestamp, getVersionFromPackage } from '../shared/Version';

export type Version = {
  getVersion(): string;
  getBuildTimestamp(): string;
  getAllVersions(
    endpoints: {
      base: string;
      path: string;
    }[]
  ): Promise<PromiseSettledResult<any>[]>;
};

export default (state: State): Version => {
  return {
    getVersion() {
      return getVersion({ state });
    },

    getBuildTimestamp() {
      return getBuildTimestamp({ state });
    },

    async getAllVersions(endpoints: { base: string; path: string }[]) {
      return getAllVersions({ endpoints, state });
    },
  };
};

export function getVersion({ state }: { state: State }) {
  // must initialize state to avoid library initialization issues
  if (state) return getVersionFromPackage();
}

/**
 * ISO 8601 timestamp of when this frodo-lib build was produced. See
 * getLibBuildTimestamp in shared/Version.ts for how it's captured.
 */
export function getBuildTimestamp({ state }: { state: State }) {
  // must initialize state to avoid library initialization issues
  if (state) return getLibBuildTimestamp();
}

export async function getAllVersions({
  endpoints,
  state,
}: {
  endpoints: { base: string; path: string }[];
  state: State;
}) {
  const reqPromises = [];
  for (const item of endpoints) {
    reqPromises.push(
      generateReleaseApi({ baseUrl: item.base, state }).get(item.path)
    );
  }
  const result = await Promise.allSettled(reqPromises);
  return result;
}
