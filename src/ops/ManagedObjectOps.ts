import { getManagedObject } from '../api/ManagedObjectApi';
import { getTenantURL } from '../api/utils/ApiUtils';
import State from '../shared/State';

export default (state: State) => {
  return {
    /**
     * Resolve a managed object's uuid to a human readable username
     * @param {string} type managed object type, e.g. teammember or alpha_user
     * @param {string} id managed object _id
     * @returns {string} resolved username or uuid if any error occurs during reslution
     */
    async resolveUserName(type: string, id: string) {
      return resolveUserName({ type, id, state });
    },

    /**
     * Resolve a managed object's uuid to a human readable full name
     * @param {string} type managed object type, e.g. teammember or alpha_user
     * @param {string} id managed object _id
     * @returns {string} resolved full name or uuid if any error occurs during reslution
     */
    async resolveFullName(type: string, id: string) {
      return resolveFullName({ type, id, state });
    },
  };
};

/**
 * Resolve a managed object's uuid to a human readable username
 * @param {string} type managed object type, e.g. teammember or alpha_user
 * @param {string} id managed object _id
 * @param {State} state library state
 * @returns {string} resolved username or uuid if any error occurs during reslution
 */
export async function resolveUserName({
  type,
  id,
  state,
}: {
  type: string;
  id: string;
  state: State;
}) {
  try {
    return (
      await getManagedObject({
        baseUrl: getTenantURL(state.getHost()),
        type,
        id,
        fields: ['userName'],
        state,
      })
    ).userName;
  } catch (error) {
    // eslint-disable-next-line no-empty
  }
  return id;
}

/**
 * Resolve a managed object's uuid to a human readable full name
 * @param {string} type managed object type, e.g. teammember or alpha_user
 * @param {string} id managed object _id
 * @param {State} state library state
 * @returns {string} resolved full name or uuid if any error occurs during reslution
 */
export async function resolveFullName({
  type,
  id,
  state,
}: {
  type: string;
  id: string;
  state: State;
}) {
  try {
    const managedObject = await getManagedObject({
      baseUrl: getTenantURL(state.getHost()),
      type,
      id,
      fields: ['givenName', 'sn'],
      state,
    });
    return `${managedObject.givenName} ${managedObject.sn}`;
  } catch (error) {
    // eslint-disable-next-line no-empty
  }
  return id;
}
