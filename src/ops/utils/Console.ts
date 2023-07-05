import Table from 'cli-table3';
import State from '../../shared/State';

/**
 * Handles data / messages output. The caller decides and implements how
 * the data and messages are handled, by implementing the handler function
 * on its side. `handler` is optional, and if not included by the caller,
 * the data and messages will be lost.
 *
 * @param {string | unknown} message The string message to return
 * @param {string} [type=text] "text", "info", "warn", "error" or "data". All but
 * type="data" will be written to stderr.
 * @param {boolean} [newline=true] Whether to add a newline at the end of message
 * messages returned
 */
export function printMessage({
  message,
  type = 'text',
  newline = true,
  state,
}: {
  message: string | object;
  type?: string;
  newline?: boolean;
  state: State;
}) {
  const handler = state.getPrintHandler();
  if (handler) {
    handler(message, type, newline);
  }
}

/**
 * Handles verbose output. The caller decides and implements how
 * the messages are handled, by implementing the handler function
 * on its side. Implementing and registering a `handler` is optional.
 *
 * @param {string | unknown} message The verbose output message
 */
export function verboseMessage({
  message,
  state,
}: {
  message: string | object;
  state: State;
}) {
  const handler = state.getVerboseHandler();
  if (handler) {
    handler(message);
  }
}

/**
 * Handles debug output. The caller decides and implements how
 * the messages are handled, by implementing the handler function
 * on its side. Implementing and registering a `handler` is optional.
 *
 * @param {string | object} message The debug output message
 */
export function debugMessage({
  message,
  state,
}: {
  message: string | object;
  state: State;
}) {
  const handler = state.getDebugHandler();
  if (handler) {
    handler(message);
  }
}

/**
 * Helper function to mask password header in curl command
 * @param curlCommand curl command to mask
 * @param {State} state library state
 * @returns masked curl command
 */
function maskPasswordHeader(curlCommand: string) {
  const header = 'X-OpenAM-Password:';
  const mask = '<suppressed>';
  const regex = new RegExp('"' + header + '.+?"', 'g');
  return curlCommand.replace(regex, '"' + header + mask + '"');
}

/**
 * Handles curlirize output. The caller decides and implements how
 * the messages are handled, by implementing the handler function
 * on its side. Implementing and registering a `handler` is optional.
 *
 * @param {string} message The curlirize output message
 */
export function curlirizeMessage({
  message,
  state,
}: {
  message: string;
  state: State;
}) {
  const handler = state.getCurlirizeHandler();
  if (handler) {
    handler(maskPasswordHeader(message));
  }
}

/**
 * Calls a callback on client to create a progress indicator.
 * The actual implementation of the indicator is left to the client
 * Two types of indicators are supported:
 * - determinate: should be used when the process completion rate
 * can be detected (example: progress bar showing percentage or count)
 * - indeterminate: used when progress isn’t detectable, or if
 * it’s not necessary to indicate how long an activity will take.
 * (example: spinner showing progress, but not quantifying the progress)
 *
 * Example:
 * [========================================] 100% | 49/49 | Analyzing journey - transactional_auth
 *
 * @param {Number} total The total number of entries to track progress for
 * @param {String} message optional progress bar message
 * @param {String} type optional type of progress indicator. default is 'determinate'
 *
 */
export function createProgressIndicator({
  total,
  message = undefined,
  type = 'determinate',
  state,
}: {
  total: number;
  message?: string;
  type?: string;
  state: State;
}) {
  const handler = state.getCreateProgressHandler();
  if (handler) {
    handler(type, total, message);
  }
}

/**
 * Updates the progress indicator with new data/updated status.
 * @param {string} message optional message to show with the indicator
 *
 */
export function updateProgressIndicator({
  message = undefined,
  state,
}: {
  message?: string;
  state: State;
}) {
  const handler = state.getUpdateProgressHandler();
  if (handler) {
    handler(message);
  }
}

/**
 * Stop and hide the progress indicator
 * @param {string} message optional message to show with the indicator
 * @param {string} status one of 'none', 'success', 'warn', 'fail'
 */
export function stopProgressIndicator({
  message = null,
  status = 'none',
  state,
}: {
  message?: string;
  status?: string;
  state: State;
}) {
  const handler = state.getStopProgressHandler();
  if (handler) {
    handler(message, status);
  }
}

/**
 * Create an empty table
 * @param {[String]} head header row as an array of strings
 * @returns {CliTable3} an empty table
 */
export function createTable(head) {
  return new Table({
    head,
    chars: {
      top: '',
      'top-mid': '',
      'top-left': '',
      'top-right': '',
      bottom: '',
      'bottom-mid': '',
      'bottom-left': '',
      'bottom-right': '',
      left: '',
      'left-mid': '',
      mid: '',
      'mid-mid': '',
      right: '',
      'right-mid': '',
    },
    style: { 'padding-left': 0, 'padding-right': 0, head: ['brightCyan'] },
  });
}

/**
 * Create a new key/value table
 * @returns {CliTable3} an empty key/value table
 */
export function createKeyValueTable() {
  return new Table({
    chars: {
      top: '',
      'top-mid': '',
      'top-left': '',
      'top-right': '',
      bottom: '',
      'bottom-mid': '',
      'bottom-left': '',
      'bottom-right': '',
      left: '',
      'left-mid': '',
      mid: '',
      'mid-mid': '',
      right: '',
      'right-mid': '',
    },
    style: { 'padding-left': 0, 'padding-right': 0 },
    wordWrap: true,
  });
}

/**
 * Helper function to determine the total depth of an object
 * @param {Object} object input object
 * @returns {Number} total depth of the input object
 */
function getObjectDepth(object) {
  return Object(object) === object
    ? 1 + Math.max(-1, ...Object.values(object).map(getObjectDepth))
    : 0;
}

/**
 * Helper function to determine if an object has values
 * @param {Object} object input object
 * @returns {boolean} true of the object or any of its sub-objects contain values, false otherwise
 */
function hasValues(object) {
  let has = false;
  const keys = Object.keys(object);
  for (const key of keys) {
    if (Object(object[key]) !== object[key]) {
      return true;
    }
    has = has || hasValues(object[key]);
  }
  return has;
}

/**
 * Helper function (recursive) to add rows to an object table
 * @param {Object} object object to render
 * @param {Number} depth total depth of initial object
 * @param {Number} level current level
 * @param {CliTable3} table the object table to add the rows to
 * @returns the updated object table
 */
function addRows(object, depth, level, table, keyMap) {
  const space = '  ';
  const keys = Object.keys(object);
  for (const key of keys) {
    if (Object(object[key]) !== object[key]) {
      if (level === 1) {
        table.push([
          keyMap[key] ? keyMap[key]['brightCyan'] : key['brightCyan'],
          object[key],
        ]);
      } else {
        table.push([
          {
            hAlign: 'right',
            content: keyMap[key] ? keyMap[key]['gray'] : key['gray'],
          },
          object[key],
        ]);
      }
    }
  }
  for (const key of keys) {
    if (Object(object[key]) === object[key]) {
      // only print header if there are any values below
      if (hasValues(object[key])) {
        let indention = new Array(level).fill(space).join('');
        if (level < 3) indention = `\n${indention}`;
        table.push([
          indention.concat(
            keyMap[key] ? keyMap[key]['brightCyan'] : key['brightCyan']
          ),
          '',
        ]);
      }
      // eslint-disable-next-line no-param-reassign
      table = addRows(object[key], depth, level + 1, table, keyMap);
    }
  }
  return table;
}

/**
 * Create and populate an object table from any JSON object. Use for describe commands.
 * @param {Object} object JSON object to create
 * @returns {CliTable3} a table that can be printed to the console
 */
export function createObjectTable(object, keyMap = {}) {
  // eslint-disable-next-line no-param-reassign
  const depth = getObjectDepth(object);
  // eslint-disable-next-line no-param-reassign
  const level = 0;
  // eslint-disable-next-line no-param-reassign
  const table = new Table({
    chars: {
      top: '',
      'top-mid': '',
      'top-left': '',
      'top-right': '',
      bottom: '',
      'bottom-mid': '',
      'bottom-left': '',
      'bottom-right': '',
      left: '',
      'left-mid': '',
      mid: '',
      'mid-mid': '',
      right: '',
      'right-mid': '',
    },
    style: { 'padding-left': 0, 'padding-right': 0, head: ['brightCyan'] },
  });
  addRows(object, depth, level + 1, table, keyMap);
  return table;
}
