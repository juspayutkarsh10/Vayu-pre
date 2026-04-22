// Portal configuration
export interface Portal {
  name: string;
  id: string;
  file: string;
  icon: string;
}

// Extract config for pulling values from API responses
export interface ExtractConfig {
  field: string;
  path: string;
  parseJson?: boolean;
  jsonPath?: string;
}

// Input prompt config for tests requiring user input
export interface RequiresInput {
  field: string;
  prompt: string;
}

// Validation config for array checks etc.
export interface ValidationConfig {
  type: "arrayMinLength";
  path: string;
  minLength: number;
  message?: string;
}

// A single test step definition (from JSON files)
export interface TestStep {
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  bodyType?: "json" | "form-urlencoded";
  expectedStatus?: number;
  expectedResponse?: Record<string, unknown>;
  extract?: ExtractConfig[];
  requiresInput?: RequiresInput[];
  validation?: ValidationConfig;
  retryOnOtpError?: boolean;
}

// A single retry attempt record
export interface RetryAttempt {
  attempt: number;
  requestBody: Record<string, unknown>;
  response: unknown;
  statusCode: number;
}

// Result collected for one test step
export interface TestResult {
  name: string;
  method: string;
  url: string;
  status: "pass" | "fail";
  statusCode: number | null;
  duration: number;
  requestHeaders: Record<string, string>;
  requestBody: Record<string, unknown> | null;
  response: unknown;
  error: string | null;
  portal: string;
  retries?: RetryAttempt[];
}

// Summary for one portal run
export interface PortalSummary {
  total: number;
  passed: number;
  failed: number;
  duration: number;
  storedValues: Record<string, unknown>;
}

// Full result for one portal
export interface PortalResult {
  portal: Portal;
  results: TestResult[];
  summary: PortalSummary;
}

// Overall summary across all portals
export interface OverallSummary {
  totalPortals: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalDuration: string;
}

// Env variable map loaded from .env
export interface EnvConfig {
  PHONE_NUMBER?: string;
  WOO_COOKIE?: string;
  WOO_NONCE?: string;
  WOO_CONSUMER_KEY?: string;
  WOO_CONSUMER_SECRET?: string;
  [key: string]: string | undefined;
}
