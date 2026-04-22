import { ExtractConfig } from "../types";

/**
 * TestContext - Centralized store for values extracted from API responses.
 * Supports namespaced storage (e.g., cart.id, user.token).
 */
export class TestContext {
  private store: Record<string, unknown> = {};

  /**
   * Set a value in the store.
   * Also supports dot notation by creating nested structure.
   */
  set(key: string, value: unknown): void {
    this.store[key] = value;

    if (key.includes(".")) {
      const parts = key.split(".");
      let current = this.store as Record<string, unknown>;
      for (let i = 0; i < parts.length - 1; i++) {
        if (
          !current[parts[i]] ||
          typeof current[parts[i]] !== "object"
        ) {
          current[parts[i]] = {};
        }
        current = current[parts[i]] as Record<string, unknown>;
      }
      current[parts[parts.length - 1]] = value;
    }
  }

  /**
   * Get a value from the store (direct key or dot-notation).
   */
  get(key: string): unknown {
    if (this.store[key] !== undefined) {
      return this.store[key];
    }

    const parts = key.split(".");
    let current: unknown = this.store;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /**
   * Return a shallow copy of all stored values.
   */
  getAll(): Record<string, unknown> {
    return { ...this.store };
  }

  /**
   * Clear all stored values.
   */
  clear(): void {
    this.store = {};
  }

  /**
   * Check if a key exists in the store.
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Print all stored values to console (for debugging).
   */
  printStore(): void {
    console.log("\n📦 Current Test Context:");
    const flatKeys = Object.keys(this.store).filter(
      (k) => typeof this.store[k] !== "object"
    );
    if (flatKeys.length === 0) {
      console.log("   (empty)");
    } else {
      flatKeys.forEach((key) => {
        const value = this.store[key];
        const displayValue =
          typeof value === "string" && value.length > 50
            ? value.substring(0, 50) + "..."
            : value;
        console.log(`   ${key}: ${displayValue}`);
      });
    }
  }

  /**
   * Extract multiple values from a response and store them.
   */
  extractAndStore(
    responseData: unknown,
    extractConfig: ExtractConfig[]
  ): void {
    for (const config of extractConfig) {
      let value = this._getNestedValue(responseData, config.path);

      if (
        value !== undefined &&
        config.parseJson &&
        typeof value === "string"
      ) {
        try {
          const parsed: unknown = JSON.parse(value);
          if (config.jsonPath) {
            value = this._getNestedValue(parsed, config.jsonPath);
          } else {
            value = parsed;
          }
        } catch (e) {
          console.log(
            `   ⚠️ Could not parse JSON for ${config.field}: ${(e as Error).message}`
          );
          continue;
        }
      }

      if (value !== undefined) {
        this.set(config.field, value);
        console.log(
          `   📦 Stored ${config.field}: ${this._truncate(value)}`
        );

        // Auto-create URL-encoded versions for fields used in query params
        if (
          config.field === "instrumentSignature" ||
          config.field === "instrumentOrderDetails"
        ) {
          const encodedField = config.field + "Encoded";
          const encodedValue = encodeURIComponent(String(value));
          this.set(encodedField, encodedValue);
          console.log(
            `   📦 Stored ${encodedField}: ${this._truncate(encodedValue)}`
          );
        }
      } else {
        console.log(
          `   ⚠️ Could not extract ${config.field} from path: ${config.path}`
        );
      }
    }
  }

  /**
   * Replace all {{placeholder}} in a string with stored values.
   */
  replacePlaceholders(str: string): string {
    if (typeof str !== "string") return str;
    return str.replace(/\{\{([\w.]+)\}\}/g, (_match, key: string) => {
      const value = this.get(key);
      return value !== undefined ? String(value) : _match;
    });
  }

  /**
   * Replace placeholders in a string, escaping values for JSON context.
   */
  replacePlaceholdersForJson(str: string): string {
    if (typeof str !== "string") return str;
    return str.replace(/\{\{([\w.]+)\}\}/g, (_match, key: string) => {
      const value = this.get(key);
      if (value === undefined) return _match;
      if (typeof value === "string") {
        return JSON.stringify(value).slice(1, -1);
      }
      return String(value);
    });
  }

  /**
   * Replace placeholders in an object deeply (via JSON stringify/parse).
   */
  replaceInObject(obj: unknown): unknown {
    if (!obj) return obj;

    const stringOnlyFields = [
      "phoneNumber",
      "otp",
      "phone",
      "mobile",
      "pincode",
      "postalCode",
      "gstIn",
    ];

    let replaced = JSON.stringify(obj);

    // Handle placeholders that are entire string values (could be numeric)
    replaced = replaced.replace(
      /"(\w+)"\s*:\s*"{{([\w.]+)}}"/g,
      (_match, jsonKey: string, placeholderKey: string) => {
        const value = this.get(placeholderKey);
        if (value === undefined) return _match;

        const shouldBeString = stringOnlyFields.some(
          (f) =>
            jsonKey.toLowerCase().includes(f.toLowerCase()) ||
            placeholderKey.toLowerCase().includes(f.toLowerCase())
        );

        if (shouldBeString) {
          return `"${jsonKey}":${JSON.stringify(String(value))}`;
        }
        if (typeof value === "number") {
          return `"${jsonKey}":${value}`;
        }
        if (typeof value === "string" && /^\d+$/.test(value)) {
          return `"${jsonKey}":${value}`;
        }
        return `"${jsonKey}":${JSON.stringify(value)}`;
      }
    );

    // Handle placeholders that are part of larger strings
    replaced = this.replacePlaceholdersForJson(replaced);

    return JSON.parse(replaced) as unknown;
  }

  /**
   * Replace placeholders directly in object values (no JSON round-trip).
   * Better for form-urlencoded data with nested JSON strings.
   */
  replaceInObjectDirect(obj: unknown): Record<string, unknown> {
    if (!obj) return {};

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      obj as Record<string, unknown>
    )) {
      if (typeof value === "string") {
        result[key] = this.replacePlaceholders(value);
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.replaceInObjectDirect(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /** @private Get nested value using dot notation with array index support */
  private _getNestedValue(obj: unknown, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) return undefined;

      const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        current = (current as Record<string, unknown>)[arrayMatch[1]];
        if (Array.isArray(current)) {
          current = current[parseInt(arrayMatch[2])];
        } else {
          return undefined;
        }
      } else {
        current = (current as Record<string, unknown>)[key];
      }
    }

    return current;
  }

  /** @private Truncate a value for display */
  private _truncate(value: unknown, maxLength = 60): string {
    const str = String(value);
    return str.length > maxLength
      ? str.substring(0, maxLength) + "..."
      : str;
  }
}

// Singleton instance for global access
export const testContext = new TestContext();
