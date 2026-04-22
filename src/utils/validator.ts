/**
 * Recursively matches actual response against expected shape.
 * Returns an error string on mismatch, or null if everything matches.
 */
export function matchResponse(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>
): string | null {
  for (const key in expected) {
    if (
      typeof expected[key] === "object" &&
      expected[key] !== null
    ) {
      const nested = matchResponse(
        actual[key] as Record<string, unknown>,
        expected[key] as Record<string, unknown>
      );
      if (nested) return nested;
    } else {
      if (actual[key] !== expected[key]) {
        return `Mismatch at '${key}': expected ${expected[key]}, got ${actual[key]}`;
      }
    }
  }
  return null;
}
