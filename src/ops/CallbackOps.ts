import { AuthenticateStep } from '../api/AuthenticateApi';
import { cloneDeep } from '../utils/JsonUtils';

export type CallbackType =
  | 'NameCallback'
  | 'PasswordCallback'
  | 'TextInputCallback'
  | 'HiddenValueCallback'
  | 'SelectIdPCallback';
export type CallbackKeyValuePair = {
  name: string;
  value: any;
};
export type Callback = {
  type: CallbackType;
  output: CallbackKeyValuePair[];
  input: CallbackKeyValuePair[];
};
/**
 * Collect a response by filling the callback's input in place.
 * Synchronous handlers work unchanged; a returned promise is awaited.
 * The returned or resolved value is ignored. The library sets no timeout.
 * A throw or rejection ends login with "Error authenticating user" wrapping;
 * privilege escalation instead returns false, as for a synchronous throw.
 * The three-step authentication limit still applies.
 * @param {Callback} callback callback whose input must be filled in place
 * @returns {Callback | Promise<Callback>} ignored value, or a promise whose completion is awaited
 */
export type CallbackHandler = (
  callback: Callback
) => Callback | Promise<Callback>;

/**
 * Fill callbacks from a map
 * @param {AuthenticateStep} step authenticate step json response from a call to /authenticate
 * @param {{ [k: string]: string | number | boolean | string[] }} map name/value map
 * @returns filled authenticate step body so it can be used as input to another call to /authenticate
 */
export function fillCallbacks({
  step,
  map,
}: {
  step: AuthenticateStep;
  map: { [k: string]: string | number | boolean | string[] };
}): AuthenticateStep {
  const stepCopy = cloneDeep(step) as AuthenticateStep;
  for (const callback of stepCopy.callbacks) {
    for (const [n, v] of Object.entries(map)) {
      setCallbackValue(n, v, callback.input);
    }
  }
  return stepCopy;
}

export function getCallbackValue(
  name: string,
  pairs: CallbackKeyValuePair[]
): any | undefined {
  const pair = pairs.find((p) => p.name === name);
  return pair && pair.value;
}

export function setCallbackValue(
  name: string,
  value: any,
  pairs: CallbackKeyValuePair[]
): boolean {
  const pair = pairs.find((p) => p.name === name);
  if (!pair) return false;
  pair.value = value;
  return true;
}
