import { State } from '../shared/State';

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
