// A namespace import.
import * as lib from '@rockcarver/frodo-lib';

export const facade = lib.frodo;
export const state = lib.state;
export const error = new lib.FrodoError('x');
