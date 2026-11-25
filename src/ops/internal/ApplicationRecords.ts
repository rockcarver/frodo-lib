import Constants from '../../shared/Constants';
import { State } from '../../shared/State';
import { isNotFoundError } from '../FrodoError';
import { readManagedObjects } from '../ManagedObjectOps';
import { getRealms } from '../RealmOps';
import { getManagedApplicationTypeOfRealm } from './ManagedApplicationType';

/**
 * The application records of every realm, each with the realm it belongs to
 * (when the type says so). What a record holds is what the caller asked for
 * with `fields`, so a caller checks every field it uses.
 */
export type ApplicationRecords = { realm?: string; application: unknown }[];

/**
 * Reads the application records of every realm without switching the active
 * realm, so the reference lookups can ask which application names an object.
 * Every distinct application type is read once, and only the fields that are
 * asked for come back (the id always does). On Cloud the root realm has no
 * applications. A type that does not exist has no applications.
 * @param {string[]} params.fields the fields of the application records to read
 * @param {State} params.state the state
 * @returns {Promise<ApplicationRecords>} a promise that resolves to the records of every realm
 */
export async function readApplicationsOfAllRealms({
  fields,
  state,
}: {
  fields: string[];
  state: State;
}): Promise<ApplicationRecords> {
  const realms = await getRealms({ state });
  const realmsByType = new Map<string, string[]>();
  for (const realm of Array.isArray(realms) ? realms : []) {
    if (typeof realm?.name !== 'string') continue;
    if (
      state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY &&
      realm.name === '/'
    ) {
      continue;
    }
    const type = getManagedApplicationTypeOfRealm({
      realmName: realm.name,
      state,
    });
    realmsByType.set(type, [...(realmsByType.get(type) ?? []), realm.name]);
  }
  const perType = await Promise.all(
    [...realmsByType].map(async ([type, realmNames]) => {
      try {
        const applications = await readManagedObjects({
          type,
          fields,
          state,
        });
        // a type that several realms share does not say which realm an application is in
        return applications.map((application) => ({
          ...(realmNames.length === 1 && { realm: realmNames[0] }),
          application,
        }));
      } catch (error) {
        if (isNotFoundError(error)) {
          return [];
        }
        throw error;
      }
    })
  );
  return perType.flat();
}
