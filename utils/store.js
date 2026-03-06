/**
 * TestContext - Centralized store for values extracted from API responses
 * Supports namespaced storage (e.g., cart.id, user.token)
 */
class TestContext {
  constructor() {
    this.store = {};
  }

  /**
   * Set a value in the store
   * @param {string} key - Key with optional namespace (e.g., "cart.id" or "cartId")
   * @param {*} value - Value to store
   */
  set(key, value) {
    this.store[key] = value;
    
    // Also support dot notation access by creating nested structure
    if (key.includes('.')) {
      const parts = key.split('.');
      let current = this.store;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    }
  }

  /**
   * Get a value from the store
   * @param {string} key - Key with optional namespace
   * @returns {*} - The stored value or undefined
   */
  get(key) {
    // First try direct key
    if (this.store[key] !== undefined) {
      return this.store[key];
    }
    
    // Then try nested access
    const parts = key.split('.');
    let current = this.store;
    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }

  /**
   * Get all stored values (flat)
   * @returns {Object} - All stored key-value pairs
   */
  getAll() {
    return { ...this.store };
  }

  /**
   * Clear all stored values
   */
  clear() {
    this.store = {};
  }

  /**
   * Check if a key exists
   * @param {string} key 
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Print all stored values (for debugging)
   */
  printStore() {
    console.log('\n📦 Current Test Context:');
    const flatKeys = Object.keys(this.store).filter(k => typeof this.store[k] !== 'object');
    if (flatKeys.length === 0) {
      console.log('   (empty)');
    } else {
      flatKeys.forEach(key => {
        const value = this.store[key];
        const displayValue = typeof value === 'string' && value.length > 50 
          ? value.substring(0, 50) + '...' 
          : value;
        console.log(`   ${key}: ${displayValue}`);
      });
    }
  }

  /**
   * Extract multiple values from response and store them
   * @param {Object} responseData - API response data
   * @param {Array} extractConfig - Array of {field, path, parseJson?, jsonPath?} objects
   */
  extractAndStore(responseData, extractConfig) {
    for (const config of extractConfig) {
      let value = this._getNestedValue(responseData, config.path);
      
      // If parseJson is true and value is a JSON string, parse it and extract jsonPath
      if (value !== undefined && config.parseJson && typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (config.jsonPath) {
            value = this._getNestedValue(parsed, config.jsonPath);
          } else {
            value = parsed;
          }
        } catch (e) {
          console.log(`   ⚠️ Could not parse JSON for ${config.field}: ${e.message}`);
          continue;
        }
      }
      
      if (value !== undefined) {
        this.set(config.field, value);
        console.log(`   📦 Stored ${config.field}: ${this._truncate(value)}`);
        
        // Auto-create URL-encoded versions for specific fields used in query params
        if (config.field === 'instrumentSignature' || config.field === 'instrumentOrderDetails') {
          const encodedField = config.field + 'Encoded';
          const encodedValue = encodeURIComponent(value);
          this.set(encodedField, encodedValue);
          console.log(`   📦 Stored ${encodedField}: ${this._truncate(encodedValue)}`);
        }
      } else {
        console.log(`   ⚠️ Could not extract ${config.field} from path: ${config.path}`);
      }
    }
  }

  /**
   * Replace all {{placeholder}} in a string with stored values
   * @param {string} str - String with placeholders
   * @returns {string} - String with replaced values
   */
  replacePlaceholders(str) {
    if (typeof str !== 'string') return str;
    
    return str.replace(/\{\{([\w.]+)\}\}/g, (match, key) => {
      const value = this.get(key);
      return value !== undefined ? value : match;
    });
  }

  /**
   * Replace placeholders in string, escaping for JSON context
   * @param {string} str - String with placeholders (in JSON format)
   * @returns {string} - String with replaced and properly escaped values
   */
  replacePlaceholdersForJson(str) {
    if (typeof str !== 'string') return str;
    
    return str.replace(/\{\{([\w.]+)\}\}/g, (match, key) => {
      const value = this.get(key);
      if (value === undefined) return match;
      
      // If value is a string that would break JSON (contains quotes, newlines, etc.)
      // we need to escape it properly for JSON context
      if (typeof value === 'string') {
        // Use JSON.stringify to properly escape, then remove outer quotes
        return JSON.stringify(value).slice(1, -1);
      }
      return value;
    });
  }

  /**
   * Replace placeholders in an object (deep) - using JSON stringify/parse
   * @param {Object} obj - Object with placeholders
   * @returns {Object} - Object with replaced values
   */
  replaceInObject(obj) {
    if (!obj) return obj;
    
    const str = JSON.stringify(obj);
    const replaced = this.replacePlaceholdersForJson(str);
    return JSON.parse(replaced);
  }

  /**
   * Replace placeholders directly in object values (no JSON stringify/parse)
   * Better for form-urlencoded data with nested JSON strings
   * @param {Object} obj - Object with placeholders
   * @returns {Object} - Object with replaced values
   */
  replaceInObjectDirect(obj) {
    if (!obj) return obj;
    
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.replacePlaceholders(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.replaceInObjectDirect(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Get nested value from object using dot notation
   * @private
   */
  _getNestedValue(obj, path) {
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

  /**
   * Truncate value for display
   * @private
   */
  _truncate(value, maxLength = 60) {
    const str = String(value);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  }
}

// Singleton instance for global access
const testContext = new TestContext();

module.exports = { TestContext, testContext };
