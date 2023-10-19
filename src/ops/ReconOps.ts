import {
  cancelRecon as _cancelRecon,
  getRecon as _getRecon,
  getRecons as _getRecons,
  ReconStatusType,
  ReconType,
  startRecon as _startRecon,
  startReconById as _startReconById,
} from '../api/ReconApi';
import { State } from '../shared/State';

export type Recon = {
  /**
   * Read all reconciliation runs
   * @returns {Promise<ReconType[]>} a promise resolving to an array of recon objects
   */
  readRecons(): Promise<ReconType[]>;
  /**
   * Read recon
   * @param {string} reconId id of the recon
   * @returns {Promise<ReconType>} a promise resolving to a recon object
   */
  readRecon(reconId: string): Promise<ReconType>;
  /**
   * Start a reconciliation
   * @param {string} mappingName mapping to reconcile
   * @returns {Promise<ReconStatusType>} a promise resolving to a recon status object
   */
  startRecon(mappingName: string): Promise<ReconStatusType>;
  /**
   * Start a reconciliation by Id
   * @param {string} mappingName mapping to reconcile
   * @param {string} objectId id of object to reconcile
   * @returns {Promise<ReconStatusType>} a promise resolving to a recon status object
   */
  startReconById(
    mappingName: string,
    objectId: string
  ): Promise<ReconStatusType>;
  /**
   * Cancel a reconciliation
   * @param {string} reconId id of the recon to cancel
   * @returns {Promise<ReconStatusType>} a promise resolving to a recon status object
   */
  cancelRecon(reconId: string): Promise<ReconStatusType>;
};

export default (state: State): Recon => {
  return {
    async readRecons(): Promise<ReconType[]> {
      return readRecons({ state });
    },
    async readRecon(reconId: string): Promise<ReconType> {
      return readRecon({ reconId, state });
    },
    async startRecon(mappingName: string): Promise<ReconStatusType> {
      return startRecon({ mappingName, state });
    },
    async startReconById(
      mappingName: string,
      objectId: string
    ): Promise<ReconStatusType> {
      return startReconById({ mappingName, objectId, state });
    },
    async cancelRecon(reconId: string): Promise<ReconStatusType> {
      return cancelRecon({ reconId, state });
    },
  };
};

export async function readRecons({
  state,
}: {
  state: State;
}): Promise<ReconType[]> {
  return _getRecons({ state });
}

export async function readRecon({
  reconId,
  state,
}: {
  reconId: string;
  state: State;
}): Promise<ReconType> {
  return _getRecon({ reconId, state });
}

export async function startRecon({
  mappingName,
  state,
}: {
  mappingName: string;
  state: State;
}): Promise<ReconStatusType> {
  return _startRecon({ mappingName, state });
}

export async function startReconById({
  mappingName,
  objectId,
  state,
}: {
  mappingName: string;
  objectId: string;
  state: State;
}): Promise<ReconStatusType> {
  return _startReconById({ mappingName, objectId, state });
}

export async function cancelRecon({
  reconId,
  state,
}: {
  reconId: string;
  state: State;
}): Promise<ReconStatusType> {
  return _cancelRecon({ reconId, state });
}
