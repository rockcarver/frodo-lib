import {
  createKeyValueTable,
  createTable,
  printMessage,
} from './utils/Console';
import { getRealmByName, getRealms, putRealm } from '../api/RealmApi';
import State from '../shared/State';

/**
 * List realms
 * @param {boolean} long Long list format with details
 */
export async function listRealms({
  long = false,
  state,
}: {
  long: boolean;
  state: State;
}) {
  try {
    const realms = (await getRealms({ state })).data.result;
    if (long) {
      const table = createTable([
        'Name'['brightCyan'],
        'Status'['brightCyan'],
        'Custom Domains'['brightCyan'],
        'Parent'['brightCyan'],
      ]);
      realms.forEach((realmConfig) => {
        table.push([
          realmConfig.name,
          realmConfig.active
            ? 'active'['brightGreen']
            : 'inactive'['brightRed'],
          realmConfig.aliases.join('\n'),
          realmConfig.parentPath,
        ]);
      });
      printMessage(table.toString());
    } else {
      realms.forEach((realmConfig) => {
        printMessage(realmConfig.name, 'info');
      });
    }
  } catch (error) {
    printMessage(`Error listing realms: ${error.rmessage}`, 'error');
    printMessage(error.response.data, 'error');
  }
}

/**
 * Describe realm
 * @param {String} realm realm name
 */
export async function describe({
  realm,
  state,
}: {
  realm: string;
  state: State;
}) {
  try {
    const realmConfig = await getRealmByName({ name: realm, state });
    const table = createKeyValueTable();
    table.push(['Name'['brightCyan'], realmConfig.name]);
    table.push([
      'Status'['brightCyan'],
      realmConfig.active ? 'active'['brightGreen'] : 'inactive'['brightRed'],
    ]);
    table.push([
      'Custom Domains'['brightCyan'],
      realmConfig.aliases.join('\n'),
    ]);
    table.push(['Parent'['brightCyan'], realmConfig.parentPath]);
    table.push(['Id'['brightCyan'], realmConfig._id]);
    printMessage(table.toString());
  } catch (error) {
    printMessage(`Realm ${realm} not found!`, 'error');
  }
}

/**
 * Add custom DNS domain name (realm DNS alias)
 * @param {String} realm realm name
 * @param {String} domain domain name
 */
export async function addCustomDomain({
  realm,
  domain,
  state,
}: {
  realm: string;
  domain: string;
  state: State;
}) {
  try {
    let realmConfig = await getRealmByName({ name: realm, state });
    let exists = false;
    realmConfig.aliases.forEach((alias) => {
      if (domain.toLowerCase() === alias.toLowerCase()) {
        exists = true;
      }
    });
    if (!exists) {
      try {
        realmConfig.aliases.push(domain.toLowerCase());
        realmConfig = (
          await putRealm({ id: realmConfig._id, data: realmConfig, state })
        ).data;
        const table = createKeyValueTable();
        table.push(['Name'['brightCyan'], realmConfig.name]);
        table.push([
          'Status'['brightCyan'],
          realmConfig.active
            ? 'active'['brightGreen']
            : 'inactive'['brightRed'],
        ]);
        table.push([
          'Custom Domains'['brightCyan'],
          realmConfig.aliases.join('\n'),
        ]);
        table.push(['Parent'['brightCyan'], realmConfig.parentPath]);
        table.push(['Id'['brightCyan'], realmConfig._id]);
        printMessage(table.toString());
      } catch (error) {
        printMessage(`Error adding custom domain: ${error.message}`, 'error');
      }
    }
  } catch (error) {
    printMessage(`${error.message}`, 'error');
  }
}

/**
 * Remove custom DNS domain name (realm DNS alias)
 * @param {String} realm realm name
 * @param {String} domain domain name
 */
export async function removeCustomDomain({
  realm,
  domain,
  state,
}: {
  realm: string;
  domain: string;
  state: State;
}) {
  try {
    let realmConfig = await getRealmByName({ name: realm, state });
    const aliases = realmConfig.aliases.filter(
      (alias) => domain.toLowerCase() !== alias.toLowerCase()
    );
    if (aliases.length < realmConfig.aliases.length) {
      try {
        realmConfig.aliases = aliases;
        realmConfig = (
          await putRealm({ id: realmConfig._id, data: realmConfig, state })
        ).data;
        const table = createKeyValueTable();
        table.push(['Name'['brightCyan'], realmConfig.name]);
        table.push([
          'Status'['brightCyan'],
          realmConfig.active
            ? 'active'['brightGreen']
            : 'inactive'['brightRed'],
        ]);
        table.push([
          'Custom Domains'['brightCyan'],
          realmConfig.aliases.join('\n'),
        ]);
        table.push(['Parent'['brightCyan'], realmConfig.parentPath]);
        table.push(['Id'['brightCyan'], realmConfig._id]);
        printMessage(table.toString());
      } catch (error) {
        printMessage(`Error removing custom domain: ${error.message}`, 'error');
      }
    }
  } catch (error) {
    printMessage(`${error.message}`, 'error');
  }
}
