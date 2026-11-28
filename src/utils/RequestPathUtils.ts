/**
 * Whether a value is one segment of the path of a request: the test for an id that a push reads from the content of a file and
 * puts into a URL, where a library does not build the path from a name that it controls. A request layer, and the server behind
 * it, read more than one segment in a value that holds a slash or a backslash, a query in one that holds `?`, a fragment in one
 * that holds `#`, and an escape in one that holds `%` (`a%2fb` is read as `a/b` by a server that decodes the path), so none of
 * them is an id of an object: the value is a name, and a name is one segment.
 *
 * It is not the test for the name of a file (`isOneSafeSegment` in `FileSetPathUtils`): that one refuses `C:` anywhere,
 * because the library removes it from the path of a file after it is checked, and an id such as `ABC:x` is a good id, and it lets
 * `?`, `#`, `%` and a lone surrogate through, which a file name may hold and a request path must not (`encodeURIComponent`
 * throws for a lone surrogate).
 *
 * A value is one segment of a request path when it is text that
 * - is not empty, and is not `.` or `..` (a request layer resolves them, so the request goes to another object), and is not `.`
 *   or `..` followed by `;` and anything (a server may cut the path parameters off a segment before it resolves the dots),
 * - holds no `/`, no `\`, no `?`, no `#` and no `%`,
 * - holds no control character (the C0 and C1 blocks and DEL), and no lone surrogate (it is well formed text),
 * - does not start or end with a blank: a space or another separator of the Unicode categories Zs, Zl and Zp (the no-break
 *   space, the spaces of U+2000 to U+200A, U+3000 and the others). The URL parser of the request layer removes the spaces at the
 *   end of a whole URL, so the request for `fr ` is the request for `fr`, and the request for `.. ` is the request for `..`;
 *   the other blanks are refused for the same reason, because a server or a proxy may cut them too. A blank inside a name is
 *   part of the name (`My Schedule`).
 *
 * Every other character is part of a name, a colon, a dot inside the name (`..foo`, `a..b`) and a `;` that does not follow a
 * dot or two dots included.
 * @param {string} value the id, or the part of the id that is to be one segment
 * @returns {boolean} true if the value is one segment of the path of a request
 */
export function isRequestSegment(value: string): boolean {
  return (
    typeof value === 'string' &&
    value !== '' &&
    value !== '.' &&
    value !== '..' &&
    !/^\.\.?;/.test(value) &&
    !/[/\\?#%\p{Cc}]/u.test(value) &&
    !/^\p{Z}|\p{Z}$/u.test(value) &&
    value.isWellFormed()
  );
}
