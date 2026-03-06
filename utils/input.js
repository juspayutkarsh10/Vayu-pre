const readline = require("readline");

/**
 * Prompts the user for input in the terminal
 * @param {string} prompt - The prompt message to display
 * @returns {Promise<string>} - The user's input
 */
function promptUser(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompts for multiple inputs based on config
 * @param {Array} inputs - Array of {field, prompt, target} objects
 * @returns {Promise<Object>} - Object with field names and their values
 */
async function promptMultipleInputs(inputs) {
  const result = {};
  for (const input of inputs) {
    result[input.field] = await promptUser(input.prompt);
  }
  return result;
}

/**
 * Replaces placeholders like {{fieldName}} in an object with actual values
 * @param {Object} obj - Object containing placeholders
 * @param {Object} values - Values to replace placeholders with
 * @returns {Object} - Object with replaced values
 */
function replacePlaceholders(obj, values) {
  if (!obj) return obj;
  
  const str = JSON.stringify(obj);
  const replaced = str.replace(/\{\{(\w+)\}\}/g, (match, field) => {
    return values[field] !== undefined ? values[field] : match;
  });
  
  return JSON.parse(replaced);
}

/**
 * Replaces placeholders in a URL string
 * @param {string} url - URL with placeholders
 * @param {Object} values - Values to replace placeholders with
 * @returns {string} - URL with replaced values
 */
function replaceUrlPlaceholders(url, values) {
  return url.replace(/\{\{(\w+)\}\}/g, (match, field) => {
    return values[field] !== undefined ? values[field] : match;
  });
}

/**
 * Extracts values from response data based on extract config
 * @param {Object} responseData - The API response data
 * @param {Array} extractConfig - Array of {field, path} objects
 *   - field: name to store the value as
 *   - path: dot-notation path to extract (e.g., "data.cart.id" or "id")
 * @returns {Object} - Object with extracted field names and values
 */
function extractFromResponse(responseData, extractConfig) {
  const extracted = {};
  
  for (const config of extractConfig) {
    const value = getNestedValue(responseData, config.path);
    if (value !== undefined) {
      extracted[config.field] = value;
      console.log(`   📦 Extracted ${config.field}: ${value}`);
    } else {
      console.log(`   ⚠️ Could not extract ${config.field} from path: ${config.path}`);
    }
  }
  
  return extracted;
}

/**
 * Gets a nested value from an object using dot notation
 * @param {Object} obj - The object to extract from
 * @param {string} path - Dot-notation path (e.g., "data.user.id")
 * @returns {*} - The extracted value or undefined
 */
function getNestedValue(obj, path) {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    // Handle array index notation like "items[0]"
    const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      current = current[arrayMatch[1]];
      if (Array.isArray(current)) {
        current = current[parseInt(arrayMatch[2])];
      } else {
        return undefined;
      }
    } else {
      current = current[key];
    }
  }
  
  return current;
}

module.exports = { 
  promptUser, 
  promptMultipleInputs, 
  replacePlaceholders, 
  replaceUrlPlaceholders,
  extractFromResponse 
};
