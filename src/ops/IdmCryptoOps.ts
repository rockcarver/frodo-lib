import { State } from '../shared/State';
import { FrodoError } from './FrodoError';
import { evaluateScript } from './IdmScriptOps';

export type IdmCrypto = {
  /**
   * Test if a value is encrypted
   * @param {any} value value to test
   * @returns {boolean} true if the value is encrypted, false otherwise
   */
  isEncrypted(value: any): boolean;
  /**
   * Encrypt a value
   * @param {any} value value to encrypt
   * @returns {Promise<any>} a promise resolving to the encrypted value
   */
  encrypt(value: any): Promise<any>;
  /**
   * Encrypt a map of values
   * @param {{ [key: string]: any }} map map of values to encrypt
   * @returns {Promise<{ [key: string]: any }>} a promise resolving to a map of encrypted values
   */
  encryptMap(map: { [key: string]: any }): Promise<{ [key: string]: any }>;
  /**
   * Decrypt a value
   * @returns {Promise<SystemStatusInterface[]>} a promise resolving to the decrypted value
   */
  decrypt(script: string): Promise<any>;
  /**
   * Decrypt a map of values
   * @param {{ [key: string]: any }} map map of values to decrypt
   * @returns {Promise<{ [key: string]: any }>} a promise resolving to a map of decrypted values
   */
  decryptMap(map: { [key: string]: any }): Promise<{ [key: string]: any }>;
};

export default (state: State): IdmCrypto => {
  return {
    isEncrypted(value: any): boolean {
      return isEncrypted(value);
    },
    async encrypt(value: string): Promise<string | object> {
      return encrypt({ value, state });
    },
    async encryptMap(map: {
      [key: string]: any;
    }): Promise<{ [key: string]: any }> {
      return encryptMap({ map, state });
    },
    async decrypt(value: any): Promise<any> {
      return decrypt({ value, state });
    },
    async decryptMap(map: {
      [key: string]: any;
    }): Promise<{ [key: string]: any }> {
      return decryptMap({ map, state });
    },
  };
};

export function isEncrypted(value: any): boolean {
  if (typeof value !== 'object') return false;
  if (value['$crypto']) return true;
  return false;
}

export async function encrypt({
  value,
  state,
}: {
  value: any;
  state: State;
}): Promise<any> {
  try {
    if (typeof value === 'object') {
      value = JSON.stringify(value);
    }
    const script = `openidm.encrypt(value,null,"idm.password.encryption");`;
    const globals = {
      value,
    };
    const response = evaluateScript({ script, globals, state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error encrypting value`, error);
  }
}

export async function encryptMap({
  map,
  state,
}: {
  map: { [key: string]: any };
  state: State;
}): Promise<{ [key: string]: any }> {
  try {
    const script =
      'Object.keys(map).forEach(function(key) { \
         map[key] = openidm.encrypt(map[key],null,"idm.password.encryption"); \
       }); \
       map';
    const globals = {
      map,
    };
    const response = evaluateScript({ script, globals, state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error encrypting map`, error);
  }
}

export async function decrypt({
  value,
  state,
}: {
  value: any;
  state: State;
}): Promise<any> {
  try {
    const script = `openidm.decrypt(value);`;
    const globals = {
      value,
    };
    const response = await evaluateScript({ script, globals, state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error decrypting value`, error);
  }
}

export async function decryptMap({
  map,
  state,
}: {
  map: { [key: string]: any };
  state: State;
}): Promise<{ [key: string]: any }> {
  try {
    const script =
      'Object.keys(map).forEach(function(key) { \
         map[key] = openidm.decrypt(map[key]); \
       }); \
       map';
    const globals = {
      map,
    };
    const response = evaluateScript({ script, globals, state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error decrypting map`, error);
  }
}
