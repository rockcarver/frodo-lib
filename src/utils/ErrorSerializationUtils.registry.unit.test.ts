/**
 * Run tests
 *
 *        npm run test:only ErrorSerializationUtils.registry
 *
 * The header names that an instance of the library tells the view of its errors
 * (the header overrides of the state, the name of the session cookie) are kept
 * with the error, and in a registry that the view of an error of another origin
 * reads. The registry is bounded: when it is full, the names of an error are
 * still known to that error. This test file fills the registry, so it is a file
 * of its own: the registry belongs to the module, and so to the test file.
 */
import { failure, MARKER_D } from '../test/utils/SerializationForms';
import {
  attachSafeSerialization,
  describeError,
} from './ErrorSerializationUtils';

describe('the registry of header names is bounded', () => {
  test('1: once it is full, an error still knows its own names, and no other error learns them', () => {
    // far more names than the registry keeps
    for (let index = 0; index < 600; index++) {
      attachSafeSerialization(failure(), [`x-filler-name-${index}`]);
    }
    const own = failure({
      headers: { 'X-Late-Name': MARKER_D },
      responseHeaders: { 'X-Late-Name': MARKER_D },
    });
    attachSafeSerialization(own, ['X-Late-Name']);
    expect(JSON.stringify(own)).not.toContain(MARKER_D);
    // an error of another origin does not know a name that did not fit
    const foreign = failure({ headers: { 'X-Late-Name': MARKER_D } });
    expect(JSON.stringify(describeError(foreign))).toContain(MARKER_D);
    // while a name that fitted is known to it
    const early = failure({ headers: { 'X-Filler-Name-3': MARKER_D } });
    expect(JSON.stringify(describeError(early))).not.toContain(MARKER_D);
  });
});
