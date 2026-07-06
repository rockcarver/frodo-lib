export type SemverUtils = {
  /**
   * Compare two semantic version strings (e.g., "1.2.3" and "1.2.4").
   * @param {string} v1 - The first semantic version string.
   * @param {string} v2 - The second semantic version string.
   * @returns {number} - Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if they are equal.
   */
  compare(v1: string, v2: string): number;
  /**
   * Greater Than (v1 > v2)
   * @param v1 - The first semantic version string.
   * @param v2 - The second semantic version string.
   * @returns {boolean} - Returns true if v1 > v2, false otherwise.
   */
  gt(v1: string, v2: string): boolean;
  /**
   * Less Than (v1 < v2)
   * @param v1 - The first semantic version string.
   * @param v2 - The second semantic version string.
   * @returns {boolean} - Returns true if v1 < v2, false otherwise.
   */
  lt(v1: string, v2: string): boolean;
  /**
   * Equal (v1 === v2)
   * @param v1 - The first semantic version string.
   * @param v2 - The second semantic version string.
   * @returns {boolean} - Returns true if v1 === v2, false otherwise.
   */
  eq(v1: string, v2: string): boolean;
};

export default (): SemverUtils => {
  return {
    compare(v1: string, v2: string): number {
      return compare(v1, v2);
    },
    gt(v1: string, v2: string): boolean {
      return gt(v1, v2);
    },
    lt(v1: string, v2: string): boolean {
      return lt(v1, v2);
    },
    eq(v1: string, v2: string): boolean {
      return eq(v1, v2);
    },
  };
};

/**
 * Compare two semantic version strings (e.g., "1.2.3" and "1.2.4").
 * @param {string} v1 - The first semantic version string.
 * @param {string} v2 - The second semantic version string.
 * @returns {number} - Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if they are equal.
 */
export function compare(v1: string, v2: string): number {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

/**
 * Greater Than (v1 > v2)
 * @param v1 - The first semantic version string.
 * @param v2 - The second semantic version string.
 * @returns {boolean} - Returns true if v1 > v2, false otherwise.
 */
export function gt(v1: string, v2: string): boolean {
  return compare(v1, v2) === 1;
}

/**
 * Less Than (v1 < v2)
 * @param v1 - The first semantic version string.
 * @param v2 - The second semantic version string.
 * @returns {boolean} - Returns true if v1 < v2, false otherwise.
 */
export function lt(v1: string, v2: string): boolean {
  return compare(v1, v2) === -1;
}

/**
 * Equal (v1 === v2)
 * @param v1 - The first semantic version string.
 * @param v2 - The second semantic version string.
 * @returns {boolean} - Returns true if v1 === v2, false otherwise.
 */
export function eq(v1: string, v2: string): boolean {
  return compare(v1, v2) === 0;
}
