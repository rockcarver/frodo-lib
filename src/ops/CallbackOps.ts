export type CallbackType =
  | 'NameCallback'
  | 'PasswordCallback'
  | 'TextInputCallback';
export type CallbackKeyValuePair = {
  name: string;
  value: any;
};
export type Callback = {
  type: CallbackType;
  output: CallbackKeyValuePair[];
  input: CallbackKeyValuePair[];
};
export type CallbackHandler = (callback: Callback) => Callback;
