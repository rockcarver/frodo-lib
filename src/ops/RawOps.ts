import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import { restGetRawAm, restGetRawEnv, restGetRawIdm } from '../api/RawApi';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { FrodoError } from './FrodoError';

export type Raw = {
  exportRawIdm(url: string): Promise<IdObjectSkeletonInterface>;
  exportRawAm(url: string): Promise<IdObjectSkeletonInterface>;
  exportRawEnv(url: string): Promise<IdObjectSkeletonInterface>;
};

export default (state: State) => {
  return {
    async exportRawIdm(url: string) {
      return exportRawIdm({ state, url });
    },
    async exportRawAm(url: string) {
      return exportRawAm({ state, url });
    },
    async exportRawEnv(url: string) {
      return exportRawEnv({ state, url });
    },
  };
};

export async function exportRawIdm({
  state,
  url,
}: {
  state: State;
  url: string;
}): Promise<IdObjectSkeletonInterface> {
  try {
    debugMessage({ message: `Raw.exportRawIdm: start`, state });
    const raw = await restGetRawIdm({ state, url });
    debugMessage({ message: `Raw.exportRawIdm: end`, state });
    return raw;
  } catch (error) {
    throw new FrodoError(
      `Error in exportRawIdm with relative url: ${url}`,
      error
    );
  }
}

export async function exportRawAm({
  state,
  url,
}: {
  state: State;
  url: string;
}): Promise<IdObjectSkeletonInterface> {
  try {
    debugMessage({ message: `Raw.exportRawAm: start`, state });
    const raw = await restGetRawAm({ state, url });
    debugMessage({ message: `Raw.exportRawAm: end`, state });
    return raw;
  } catch (error) {
    throw new FrodoError(
      `Error in exportRawAm with relative url: ${url}`,
      error
    );
  }
}

export async function exportRawEnv({
  state,
  url,
}: {
  state: State;
  url: string;
}): Promise<IdObjectSkeletonInterface> {
  try {
    debugMessage({ message: `Raw.exportRawEnv: start`, state });
    const raw = await restGetRawEnv({ state, url });
    debugMessage({ message: `Raw.exportRawEnv: end`, state });
    return raw;
  } catch (error) {
    throw new FrodoError(
      `Error in exportRawEnv with relative url: ${url}`,
      error
    );
  }
}
