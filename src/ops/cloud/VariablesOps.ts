import {
  deleteVariable,
  getVariable,
  getVariables,
  putVariable,
  setVariableDescription,
} from '../../api/cloud/VariablesApi';
import State from '../../shared/State';

export default (state: State) => {
  return {
    /**
     * Delete variable by id/name
     * @param {string} variableId variable id/name
     * @returns {Promise<unknown>} a promise that resolves to a variable object
     */
    deleteVariable(variableId: string) {
      return deleteVariable({ variableId, state });
    },

    /**
     * Get variable by id/name
     * @param {string} variableId variable id/name
     * @returns {Promise<unknown>} a promise that resolves to a variable object
     */
    getVariable(variableId: string) {
      return getVariable({ variableId, state });
    },

    /**
     * Get all variables
     * @returns {Promise<unknown[]>} a promise that resolves to an array of variable objects
     */
    getVariables() {
      return getVariables({ state });
    },

    /**
     * Put variable by id/name
     * @param {string} variableId variable id/name
     * @param {string} value variable value
     * @param {string} description variable description
     * @returns {Promise<unknown>} a promise that resolves to a variable object
     */
    putVariable(variableId: string, value: string, description: string) {
      return putVariable({ variableId, value, description, state });
    },

    /**
     * Set variable description
     * @param {string} variableId variable id/name
     * @param {string} description variable description
     * @returns {Promise<unknown>} a promise that resolves to a status object
     */
    setVariableDescription(variableId: string, description: string) {
      return setVariableDescription({
        variableId,
        description,
        state,
      });
    },
  };
};

export {
  deleteVariable,
  getVariable,
  getVariables,
  putVariable,
  setVariableDescription,
};
