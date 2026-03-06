function matchResponse(actual, expected) {
  for (let key in expected) {
    if (typeof expected[key] === "object" && expected[key] !== null) {
      const nested = matchResponse(actual[key], expected[key]);
      if (nested) return nested;
    } else {
      if (actual[key] !== expected[key]) {
        return `Mismatch at '${key}': expected ${expected[key]}, got ${actual[key]}`;
      }
    }
  }
  return null;
}

module.exports = { matchResponse };