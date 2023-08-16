import {
  deleteVariable as _deleteVariable,
  getVariable as _getVariable,
  getVariables as _getVariables,
  putVariable as _putVariable,
  setVariableDescription as _setVariableDescription,
  VariableExpressionType,
  VariableSkeleton,
} from '../../api/cloud/VariablesApi';
import { State } from '../../shared/State';
import { debugMessage } from '../../utils/Console';

export type Variable = {
  /**
   * Read variable by id/name
   * @param {string} variableId variable id/name
   * @returns {Promise<VariableSkeleton>} a promise that resolves to a variable object
   */
  readVariable(variableId: string): Promise<VariableSkeleton>;
  /**
   * Read all variables
   * @returns {Promise<VariableSkeleton[]>} a promise that resolves to an array of variable objects
   */
  readVariables(): Promise<VariableSkeleton[]>;
  /**
   * Create variable
   * @param {string} variableId variable id/name
   * @param {string} value variable value
   * @param {string} description variable description
   * @param {VariableExpressionType} expressionType type of the value
   * @returns {Promise<VariableSkeleton>} a promise that resolves to a variable object
   */
  createVariable(
    variableId: string,
    value: string,
    description: string,
    expressionType?: VariableExpressionType
  ): Promise<VariableSkeleton>;
  /**
   * Update or create variable
   * @param {string} variableId variable id/name
   * @param {string} value variable value
   * @param {string} description variable description
   * @param {VariableExpressionType} expressionType type of the value
   * @returns {Promise<VariableSkeleton>} a promise that resolves to a variable object
   */
  updateVariable(
    variableId: string,
    value: string,
    description: string,
    expressionType?: VariableExpressionType
  ): Promise<VariableSkeleton>;
  /**
   * Update variable description
   * @param {string} variableId variable id/name
   * @param {string} description variable description
   * @returns {Promise<VariableSkeleton>} a promise that resolves to a status object
   */
  updateVariableDescription(
    variableId: string,
    description: string
  ): Promise<VariableSkeleton>;
  /**
   * Delete variable by id/name
   * @param {string} variableId variable id/name
   * @returns {Promise<VariableSkeleton>} a promise that resolves to a variable object
   */
  deleteVariable(variableId: string): Promise<VariableSkeleton>;

  // Deprecated

  /**
   * Get variable by id/name
   * @param {string} variableId variable id/name
   * @returns {Promise<VariableSkeleton>} a promise that resolves to a variable object
   * @deprecated since v2.0.0 use {@link Variable.readVariable | readVariable} instead
   * ```javascript
   * readVariable(variableId: string): Promise<VariableSkeleton>
   * ```
   * @group Deprecated
   */
  getVariable(variableId: string): Promise<VariableSkeleton>;
  /**
   * Get all variables
   * @returns {Promise<VariableSkeleton[]>} a promise that resolves to an array of variable objects
   * @deprecated since v2.0.0 use {@link Variable.readVariables | readVariables} instead
   * ```javascript
   * readVariables(): Promise<VariableSkeleton[]>
   * ```
   * @group Deprecated
   */
  getVariables(): Promise<VariableSkeleton[]>;
  /**
   * Create variable
   * @param {string} variableId variable id/name
   * @param {string} value variable value
   * @param {string} description variable description
   * @param {VariableExpressionType} expressionType type of the value
   * @returns {Promise<VariableSkeleton>} a promise that resolves to a variable object
   * @deprecated since v2.0.0 use {@link Variable.createVariable | createVariable} instead
   * ```javascript
   * createVariable(variableId: string, value: string, description: string, expressionType?: VariableExpressionType): Promise<VariableSkeleton>
   * ```
   * @group Deprecated
   */
  putVariable(
    variableId: string,
    value: string,
    description: string,
    expressionType?: VariableExpressionType
  ): Promise<VariableSkeleton>;
  /**
   * Set variable description
   * @param {string} variableId variable id/name
   * @param {string} description variable description
   * @returns {Promise<any>} a promise that resolves to an empty string
   * @deprecated since v2.0.0 use {@link Variable.updateVariableDescription | updateVariableDescription} instead
   * ```javascript
   * updateVariableDescription(variableId: string, description: string): Promise<any>
   * ```
   * @group Deprecated
   */
  setVariableDescription(variableId: string, description: string): Promise<any>;
};

export default (state: State): Variable => {
  return {
    readVariable(variableId: string): Promise<VariableSkeleton> {
      return readVariable({ variableId, state });
    },
    readVariables(): Promise<VariableSkeleton[]> {
      return readVariables({ state });
    },
    createVariable(
      variableId: string,
      value: string,
      description: string,
      expressionType: VariableExpressionType = 'string'
    ): Promise<VariableSkeleton> {
      return createVariable({
        variableId,
        value,
        description,
        expressionType,
        state,
      });
    },
    updateVariable(
      variableId: string,
      value: string,
      description: string,
      expressionType: VariableExpressionType = 'string'
    ): Promise<VariableSkeleton> {
      return updateVariable({
        variableId,
        value,
        description,
        expressionType,
        state,
      });
    },
    updateVariableDescription(
      variableId: string,
      description: string
    ): Promise<any> {
      return updateVariableDescription({
        variableId,
        description,
        state,
      });
    },
    deleteVariable(variableId: string): Promise<VariableSkeleton> {
      return deleteVariable({ variableId, state });
    },

    // Deprecated

    getVariable(variableId: string): Promise<VariableSkeleton> {
      return readVariable({ variableId, state });
    },
    getVariables(): Promise<VariableSkeleton[]> {
      return readVariables({ state });
    },
    putVariable(
      variableId: string,
      value: string,
      description: string,
      expressionType: VariableExpressionType = 'string'
    ): Promise<VariableSkeleton> {
      return updateVariable({
        variableId,
        value,
        description,
        expressionType,
        state,
      });
    },
    setVariableDescription(
      variableId: string,
      description: string
    ): Promise<any> {
      return updateVariableDescription({
        variableId,
        description,
        state,
      });
    },
  };
};

export async function readVariable({
  variableId,
  state,
}: {
  variableId: string;
  state: State;
}): Promise<VariableSkeleton> {
  return _getVariable({ variableId, state });
}

export async function readVariables({
  state,
}: {
  state: State;
}): Promise<VariableSkeleton[]> {
  return (await _getVariables({ state })).result;
}

export async function createVariable({
  variableId,
  value,
  description,
  expressionType,
  state,
}: {
  variableId: string;
  value: string;
  description?: string;
  expressionType?: VariableExpressionType;
  state: State;
}): Promise<VariableSkeleton> {
  debugMessage({
    message: `VariablesOps.createVariable: start`,
    state,
  });
  try {
    await _getVariable({ variableId, state });
  } catch (error) {
    const result = await _putVariable({
      variableId,
      value,
      description,
      expressionType,
      state,
    });
    debugMessage({
      message: `VariablesOps.createVariable: end`,
      state,
    });
    return result;
  }
  throw new Error(`Variable ${variableId} already exists!`);
}

export async function updateVariable({
  variableId,
  value,
  description,
  expressionType,
  state,
}: {
  variableId: string;
  value: string;
  description?: string;
  expressionType?: VariableExpressionType;
  state: State;
}): Promise<VariableSkeleton> {
  return _putVariable({
    variableId,
    value,
    description,
    expressionType,
    state,
  });
}

export async function updateVariableDescription({
  variableId,
  description,
  state,
}: {
  variableId: string;
  description: string;
  state: State;
}): Promise<any> {
  return _setVariableDescription({
    variableId,
    description,
    state,
  });
}

export async function deleteVariable({
  variableId,
  state,
}: {
  variableId: string;
  state: State;
}): Promise<VariableSkeleton> {
  return _deleteVariable({ variableId, state });
}

export {
  _getVariable as getVariable,
  _getVariables as getVariables,
  _putVariable as putVariable,
  _setVariableDescription as setVariableDescription,
};
