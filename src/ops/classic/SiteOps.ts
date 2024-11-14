import {
  getSite,
  getSites,
  putSite,
  SiteSkeleton,
} from '../../api/classic/SiteApi';
import { State } from '../../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../../utils/Console';
import { getMetadata } from '../../utils/ExportImportUtils';
import { FrodoError } from '../FrodoError';
import { ExportMetaData } from '../OpsTypes';

export type Site = {
  /**
   * Create an empty site export template
   * @returns {SiteExportInterface} an empty site export template
   */
  createSiteExportTemplate(): SiteExportInterface;
  /**
   * Read site by id
   * @param {string} siteId Site id
   * @returns {Promise<SiteSkeleton>} a promise that resolves to a site object
   */
  readSite(siteId: string): Promise<SiteSkeleton>;
  /**
   * Read all sites.
   * @returns {Promise<SiteSkeleton[]>} a promise that resolves to an array of site objects
   */
  readSites(): Promise<SiteSkeleton[]>;
  /**
   * Export a single site by id. The response can be saved to file as is.
   * @param {string} siteId Site id
   * @returns {Promise<SiteExportInterface>} Promise resolving to a SiteExportInterface object.
   */
  exportSite(siteId: string): Promise<SiteExportInterface>;
  /**
   * Export all sites. The response can be saved to file as is.
   * @returns {Promise<SiteExportInterface>} Promise resolving to a SiteExportInterface object.
   */
  exportSites(): Promise<SiteExportInterface>;
  /**
   * Update site
   * @param {string} siteId site id
   * @param {SiteSkeleton} siteData site data
   * @returns {Promise<SiteSkeleton>} a promise resolving to a site object
   */
  updateSite(siteId: string, siteData: SiteSkeleton): Promise<SiteSkeleton>;
  /**
   * Import sites
   * @param {SiteExportInterface} importData site import data
   * @param {string} siteId Optional site id. If supplied, only the site of that id is imported. Takes priority over siteUrl if both are provided.
   * @param {string} siteUrl Optional site url. If supplied, only the site of that url is imported.
   * @returns {Promise<SiteSkeleton[]>} the imported sites
   */
  importSites(
    importData: SiteExportInterface,
    siteId?: string,
    siteUrl?: string
  ): Promise<SiteSkeleton[]>;
};

export default (state: State): Site => {
  return {
    createSiteExportTemplate(): SiteExportInterface {
      return createSiteExportTemplate({ state });
    },
    async readSite(siteId: string): Promise<SiteSkeleton> {
      return readSite({ siteId, state });
    },
    async readSites(): Promise<SiteSkeleton[]> {
      return readSites({ state });
    },
    async exportSite(siteId: string): Promise<SiteExportInterface> {
      return exportSite({ siteId, state });
    },
    async exportSites(): Promise<SiteExportInterface> {
      return exportSites({ state });
    },
    async updateSite(
      siteId: string,
      siteData: SiteSkeleton
    ): Promise<SiteSkeleton> {
      return updateSite({ siteId, siteData, state });
    },
    async importSites(
      importData: SiteExportInterface,
      siteId?: string,
      siteUrl?: string
    ): Promise<SiteSkeleton[]> {
      return importSites({
        siteId,
        siteUrl,
        importData,
        state,
      });
    },
  };
};

export interface SiteExportInterface {
  meta?: ExportMetaData;
  site: Record<string, SiteSkeleton>;
}

/**
 * Create an empty site export template
 * @returns {SiteExportInterface} an empty site export template
 */
export function createSiteExportTemplate({
  state,
}: {
  state: State;
}): SiteExportInterface {
  return {
    meta: getMetadata({ state }),
    site: {},
  };
}

/**
 * Read site by id
 * @param {string} siteId Site id
 * @returns {Promise<SiteSkeleton>} a promise that resolves to a site object
 */
export async function readSite({
  siteId,
  state,
}: {
  siteId: string;
  state: State;
}): Promise<SiteSkeleton> {
  try {
    return getSite({ siteId, state });
  } catch (error) {
    throw new FrodoError(`Error reading site ${siteId}`, error);
  }
}

/**
 * Read all sites.
 * @returns {Promise<SiteSkeleton[]>} a promise that resolves to an array of site objects
 */
export async function readSites({
  state,
}: {
  state: State;
}): Promise<SiteSkeleton[]> {
  try {
    debugMessage({
      message: `SiteOps.readSites: start`,
      state,
    });
    const { result } = await getSites({ state });
    debugMessage({ message: `SiteOps.readSites: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading sites`, error);
  }
}

/**
 * Export a single site by id. The response can be saved to file as is.
 * @param {string} siteId Site id
 * @returns {Promise<SiteExportInterface>} Promise resolving to a SiteExportInterface object.
 */
export async function exportSite({
  siteId,
  state,
}: {
  siteId: string;
  state: State;
}): Promise<SiteExportInterface> {
  try {
    const site = await readSite({
      siteId,
      state,
    });
    // Don't include id in export (no need to since it's not the actual id)
    delete site.id;
    const exportData = createSiteExportTemplate({ state });
    exportData.site[siteId] = site;
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting site ${siteId}`, error);
  }
}

/**
 * Export all sites. The response can be saved to file as is.
 * @returns {Promise<SiteExportInterface>} Promise resolving to a SiteExportInterface object.
 */
export async function exportSites({
  state,
}: {
  state: State;
}): Promise<SiteExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({ message: `SiteOps.exportSites: start`, state });
    const exportData = createSiteExportTemplate({ state });
    const sites = await readSites({ state });
    indicatorId = createProgressIndicator({
      total: sites.length,
      message: 'Exporting sites...',
      state,
    });
    for (const site of sites) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting site ${site.url}`,
        state,
      });
      // Don't include id in export (no need to since it's not the actual id)
      delete site.id;
      exportData.site[site._id] = site;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${sites.length} sites.`,
      state,
    });
    debugMessage({ message: `SiteOps.exportSites: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting sites.`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error reading sites`, error);
  }
}

/**
 * Update site
 * @param {string} siteId site id
 * @param {SiteSkeleton} siteData site config object
 * @returns {Promise<SiteSkeleton>} a promise that resolves to a site object
 */
export async function updateSite({
  siteId,
  siteData,
  state,
}: {
  siteId: string;
  siteData: SiteSkeleton;
  state: State;
}): Promise<SiteSkeleton> {
  return putSite({ siteId, siteData, state });
}

/**
 * Import sites
 * @param {string} siteId Optional site id. If supplied, only the site of that id is imported. Takes priority over siteUrl if both are provided.
 * @param {string} siteUrl Optional site url. If supplied, only the site of that url is imported.
 * @param {SiteExportInterface} importData site import data
 * @returns {Promise<SiteSkeleton[]>} the imported sites
 */
export async function importSites({
  siteId,
  siteUrl,
  importData,
  state,
}: {
  siteId?: string;
  siteUrl?: string;
  importData: SiteExportInterface;
  state: State;
}): Promise<SiteSkeleton[]> {
  const errors = [];
  try {
    debugMessage({ message: `SiteOps.importSites: start`, state });
    const response = [];
    for (const site of Object.values(importData.site)) {
      try {
        if (
          (siteId && site._id !== siteId) ||
          (siteUrl && site.url !== siteUrl)
        ) {
          continue;
        }
        const result = await updateSite({
          siteId: site._id,
          siteData: site,
          state,
        });
        response.push(result);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing sites`, errors);
    }
    debugMessage({ message: `SiteOps.importSites: end`, state });
    return response;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error importing sites`, error);
  }
}
