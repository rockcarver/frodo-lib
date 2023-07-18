import {
  VariableExpressionType,
  VariableSkeleton,
  deleteVariable,
  getVariable,
  getVariables,
  putVariable,
  setVariableDescription,
} from '../../api/cloud/VariablesApi';
import { State } from '../../shared/State';

export type Variable = {
  /**
   * Delete variable by id/name
   * @param {string} variableId variable id/name
   * @returns {Promise<unknown>} a promise that resolves to a variable object
   */
  deleteVariable(variableId: string): Promise<any>;
  /**
   * Get variable by id/name
   * @param {string} variableId variable id/name
   * @returns {Promise<unknown>} a promise that resolves to a variable object
   */
  getVariable(variableId: string): Promise<any>;
  /**
   * Get all variables
   * @returns {Promise<unknown[]>} a promise that resolves to an array of variable objects
   */
  getVariables(): Promise<any>;
  /**
   * Put variable by id/name
   * @param {string} variableId variable id/name
   * @param {string} value variable value
   * @param {string} description variable description
   * @param {VariableExpressionType} expressionType type of the value
   * @returns {Promise<VariableSkeleton>} a promise that resolves to a variable object
   */
  putVariable(
    variableId: string,
    value: string,
    description: string,
    expressionType: VariableExpressionType
  ): Promise<VariableSkeleton>;
  /**
   * Set variable description
   * @param {string} variableId variable id/name
   * @param {string} description variable description
   * @returns {Promise<unknown>} a promise that resolves to a status object
   */
  setVariableDescription(variableId: string, description: string): Promise<any>;
};

export default (state: State): Variable => {
  return {
    deleteVariable(variableId: string) {
      return deleteVariable({ variableId, state });
    },
    getVariable(variableId: string) {
      return getVariable({ variableId, state });
    },
    getVariables() {
      return getVariables({ state });
    },
    putVariable(
      variableId: string,
      value: string,
      description: string,
      expressionType: VariableExpressionType
    ) {
      return putVariable({
        variableId,
        value,
        description,
        expressionType,
        state,
      });
    },
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
