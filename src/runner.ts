import axios, { AxiosResponse } from "axios";
import * as fs from "fs";
import * as path from "path";
import * as qs from "querystring";
import { exec } from "child_process";
import { matchResponse } from "./utils/validator";
import { promptMultipleInputs } from "./utils/input";
import { TestContext } from "./utils/store";
import { generateReport } from "./utils/reporter";
import {
  Portal,
  TestStep,
  TestResult,
  PortalResult,
  OverallSummary,
  EnvConfig,
  RetryAttempt,
} from "./types";

// ─── Load .env ───────────────────────────────────────────────────────────────

function loadEnv(): EnvConfig {
  const envPath = path.join(__dirname, "../.env");
  const env: EnvConfig = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key) {
          env[key.trim()] = valueParts.join("=").trim();
        }
      }
    });
  }
  return env;
}

const ENV = loadEnv();

// ─── Helpers ─────────────────────────────────────────────────────────────────


function generateSessionId(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let result = "";
  for (let i = 0; i < 21; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function prepareFormData(body: Record<string, unknown>): string {
  const formData: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    formData[key] =
      typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : String(value);
  }
  return qs.stringify(formData);
}

function isIncorrectOtpError(responseData: unknown): boolean {
  if (!responseData || typeof responseData !== "object") return false;
  const data = responseData as Record<string, unknown>;
  const error = data.error as Record<string, unknown> | undefined;
  return data.status === "Failure" && error?.message === "Incorrect OTP";
}

function clearPreviousReports(): void {
  const reportsDir = path.join(__dirname, "../reports");
  if (fs.existsSync(reportsDir)) {
    const files = fs.readdirSync(reportsDir);
    files.forEach((file) => {
      if (file.endsWith(".html")) {
        fs.unlinkSync(path.join(reportsDir, file));
      }
    });
    console.log(`🗑️  Cleared ${files.length} previous report(s)\n`);
  }
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

// ─── Portal Config ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const portalArg = (args[0]?.toLowerCase()) || "all";

const PORTALS: Portal[] = [
  {
    name: "Shopify",
    id: "shopify",
    file: "./data/shopify-tests.json",
    icon: "🛍️",
  },
  {
    name: "WooCommerce",
    id: "woocommerce",
    file: "./data/woocommerce-tests.json",
    icon: "🛒",
  },
];

// ─── Run Tests for One Portal ────────────────────────────────────────────────

async function runPortalTests(
  portal: Portal,
  tests: TestStep[]
): Promise<PortalResult> {
  const testContext = new TestContext();
  const testResults: TestResult[] = [];
  let pass = 0;
  let fail = 0;
  const startTime = Date.now();

  if (portal.id === "woocommerce") {
    const sessionId = generateSessionId();
    testContext.set("sessionId", sessionId);
    console.log(`🔐 Generated sessionId: ${sessionId}`);

    if (ENV.WOO_COOKIE) {
      testContext.set("wooCookie", ENV.WOO_COOKIE);
      console.log(`🍪 Using WooCommerce cookie from .env`);
    }
    if (ENV.WOO_NONCE) {
      testContext.set("wooNonce", ENV.WOO_NONCE);
      console.log(`🔑 Using WooCommerce nonce from .env: ${ENV.WOO_NONCE}`);
    }
    if (ENV.WOO_CONSUMER_KEY && ENV.WOO_CONSUMER_SECRET) {
      const basicAuth = Buffer.from(
        `${ENV.WOO_CONSUMER_KEY}:${ENV.WOO_CONSUMER_SECRET}`
      ).toString("base64");
      testContext.set("wooBasicAuth", `Basic ${basicAuth}`);
      console.log(`🔑 Using WooCommerce API keys from .env`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`${portal.icon} Running ${portal.name} Tests (${tests.length} tests)`);
  console.log(`${"=".repeat(60)}\n`);

  for (const test of tests) {
    const testStartTime = Date.now();
    const result: TestResult = {
      name: test.name,
      method: test.method,
      url: "",
      status: "pass",
      statusCode: null,
      duration: 0,
      requestHeaders: {},
      requestBody: null,
      response: null,
      error: null,
      portal: portal.id,
      retries: [],
    };

    try {
      if (test.delayBefore && test.delayBefore > 0) {
        console.log(`\n⏳ Waiting ${test.delayBefore}ms before "${test.name}"...`);
        await new Promise((resolve) => setTimeout(resolve, test.delayBefore));
      }

      const contentType =
        (test.headers?.["content-type"]) ||
        (test.headers?.["Content-Type"]) ||
        "";
      const isFormEncoded = contentType.includes(
        "application/x-www-form-urlencoded"
      );

      let headers = testContext.replaceInObject(test.headers || {}) as Record<string, string>;
      let body = isFormEncoded
        ? testContext.replaceInObjectDirect(test.body || {})
        : (testContext.replaceInObject(test.body || {}) as Record<string, unknown>);
      let url = testContext.replacePlaceholders(test.url);

      if (test.requiresInput && test.requiresInput.length > 0) {
        console.log(`\n📝 Test "${test.name}" requires user input:`);

        const autoFilled: Record<string, string> = {};
        const remainingInputs = test.requiresInput.filter((input) => {
          const phoneEnvKey = portal.id === "shopify" ? "SHOPIFY_PHONE_NUMBER" : "WOO_PHONE_NUMBER";
          const phoneNumber = ENV[phoneEnvKey];
          if (input.field === "phoneNumber" && phoneNumber) {
            autoFilled[input.field] = phoneNumber;
            console.log(`   📱 Using phone from .env (${phoneEnvKey}): ${phoneNumber}`);
            return false;
          }
          if (input.field === "otp") {
            autoFilled[input.field] = "1234";
            console.log(`🔑 Using static OTP: 1234`);
            return false;
          }
          return true;
        });

        Object.entries(autoFilled).forEach(([key, value]) => {
          testContext.set(key, value);
        });

        if (remainingInputs.length > 0) {
          const userInputs = await promptMultipleInputs(remainingInputs);
          Object.entries(userInputs).forEach(([key, value]) => {
            testContext.set(key, value);
          });
        }

        headers = testContext.replaceInObject(test.headers || {}) as Record<string, string>;
        body = isFormEncoded
          ? testContext.replaceInObjectDirect(test.body || {})
          : (testContext.replaceInObject(test.body || {}) as Record<string, unknown>);
        url = testContext.replacePlaceholders(test.url);
      }

      result.url = url;
      result.requestHeaders = headers;
      result.requestBody = Object.keys(body).length > 0 ? body : null;

      let requestData: string | Record<string, unknown> =
        isFormEncoded && Object.keys(body).length > 0
          ? prepareFormData(body)
          : body;

      const isOtpVerifyTest =
        test.name.toLowerCase().includes("verify otp") ||
        !!test.retryOnOtpError;
      let response: AxiosResponse;
      let otpRetryCount = 0;
      const maxOtpRetries = 2;

      while (true) {
        response = await axios({
          method: test.method,
          url,
          headers,
          data: requestData,
          ...(test.noFollowRedirects ? { maxRedirects: 0, validateStatus: (s) => s < 400 } : {}),
        });

        if (
          isOtpVerifyTest &&
          isIncorrectOtpError(response.data) &&
          otpRetryCount < maxOtpRetries
        ) {
          otpRetryCount++;

          result.retries!.push({
            attempt: otpRetryCount,
            requestBody: { ...body },
            response: response.data,
            statusCode: response.status,
          } as RetryAttempt);

          console.log(
            `\n❌ Incorrect OTP. Retrying with static OTP: 1234 (attempt ${otpRetryCount}/${maxOtpRetries})`
          );

          testContext.set("otp", "1234");
          body = isFormEncoded
            ? testContext.replaceInObjectDirect(test.body || {})
            : (testContext.replaceInObject(test.body || {}) as Record<string, unknown>);
          requestData =
            isFormEncoded && Object.keys(body).length > 0
              ? prepareFormData(body)
              : body;
          result.requestBody = Object.keys(body).length > 0 ? body : null;
          continue;
        }

        break;
      }

      result.statusCode = response.status;
      result.response = response.data;

      console.log(`\n📤 ${test.method} ${url}`);
      console.log(`📥 Status: ${response.status}`);
      console.log(`📥 Response: (see report for full details)`);

      if (isOtpVerifyTest && isIncorrectOtpError(response.data)) {
        throw new Error("Incorrect OTP - max retries exceeded");
      }

      if (test.expectedStatus && response.status !== test.expectedStatus) {
        throw new Error(
          `Status mismatch: expected ${test.expectedStatus}, got ${response.status}`
        );
      }

      if (test.expectedResponse) {
        const expectedWithValues = testContext.replaceInObject(
          test.expectedResponse
        ) as Record<string, unknown>;
        const error = matchResponse(
          response.data as Record<string, unknown>,
          expectedWithValues
        );
        if (error) throw new Error(error);
      }

      if (test.validation) {
        const val = test.validation;
        if (val.type === "arrayMinLength") {
          const arr = val.path
            .split(".")
            .reduce(
              (obj: unknown, key: string) =>
                (obj as Record<string, unknown>)?.[key],
              response.data
            );
          if (!Array.isArray(arr) || arr.length < val.minLength) {
            throw new Error(
              val.message ||
                `Expected array at '${val.path}' to have at least ${val.minLength} item(s), got ${(arr as unknown[])?.length ?? 0}`
            );
          }
        }
      }

      if (test.extract && test.extract.length > 0) {
        testContext.extractAndStore(response.data, test.extract);
      }

      console.log(`✅ PASS: ${test.name}`);
      pass++;
    } catch (err) {
      result.status = "fail";
      const axiosErr = err as { response?: AxiosResponse; message: string };

      const errorResponse = axiosErr.response?.data ?? result.response;
      const errorStatusCode = axiosErr.response?.status ?? result.statusCode;

      result.error = axiosErr.response?.data
        ? JSON.stringify(axiosErr.response.data, null, 2)
        : axiosErr.message;
      result.statusCode = errorStatusCode;
      result.response = errorResponse;

      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   ${axiosErr.message}`);
      fail++;
    }

    result.duration = Date.now() - testStartTime;
    testResults.push(result);
  }

  const totalDuration = Date.now() - startTime;

  console.log(`\n📦 ${portal.name} Context:`);
  const storedValues = testContext.getAll();
  const flatKeys = Object.keys(storedValues).filter(
    (k) => typeof storedValues[k] !== "object"
  );
  flatKeys.forEach((key) => {
    const value = storedValues[key];
    const displayValue =
      typeof value === "string" && value.length > 50
        ? value.substring(0, 50) + "..."
        : value;
    console.log(`   ${key}: ${displayValue}`);
  });

  return {
    portal,
    results: testResults,
    summary: {
      total: tests.length,
      passed: pass,
      failed: fail,
      duration: totalDuration,
      storedValues,
    },
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log("\n🚀 Running Multi-Portal API Automation...\n");

  clearPreviousReports();

  let portalsToRun: Portal[] = PORTALS;
  if (portalArg === "shopify") {
    portalsToRun = PORTALS.filter((p) => p.id === "shopify");
    console.log("🎯 Running Shopify tests only\n");
  } else if (portalArg === "woocommerce" || portalArg === "woo") {
    portalsToRun = PORTALS.filter((p) => p.id === "woocommerce");
    console.log("🎯 Running WooCommerce tests only\n");
  } else if (portalArg !== "all") {
    console.log(`⚠️  Unknown portal: "${portalArg}". Running all tests.`);
    console.log("   Usage: ts-node src/runner.ts [shopify|woocommerce|all]\n");
  } else {
    console.log("🎯 Running ALL portal tests\n");
  }

  const allPortalResults: PortalResult[] = [];
  const overallStartTime = Date.now();

  for (const portal of portalsToRun) {
    const filePath = path.join(__dirname, "../", portal.file);
    if (!fs.existsSync(filePath)) {
      console.log(
        `\n⚠️ Skipping ${portal.name}: Test file not found (${portal.file})`
      );
      continue;
    }

    const tests: TestStep[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    if (tests.length === 0) {
      console.log(`\n⚠️ Skipping ${portal.name}: No tests defined`);
      continue;
    }

    const portalResult = await runPortalTests(portal, tests);
    allPortalResults.push(portalResult);
  }

  const overallDuration = Date.now() - overallStartTime;

  const overallSummary: OverallSummary = {
    totalPortals: allPortalResults.length,
    totalTests: allPortalResults.reduce((sum, pr) => sum + pr.summary.total, 0),
    totalPassed: allPortalResults.reduce((sum, pr) => sum + pr.summary.passed, 0),
    totalFailed: allPortalResults.reduce((sum, pr) => sum + pr.summary.failed, 0),
    totalDuration: formatDuration(overallDuration),
  };

  const reportPath = generateReport(allPortalResults, overallSummary);

  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 Overall Summary");
  console.log(`${"=".repeat(60)}`);
  console.log(`Portals Tested: ${overallSummary.totalPortals}`);
  console.log(`Total Tests:    ${overallSummary.totalTests}`);
  console.log(`Passed:         ${overallSummary.totalPassed}`);
  console.log(`Failed:         ${overallSummary.totalFailed}`);
  console.log(`Duration:       ${overallSummary.totalDuration}`);
  console.log(`\n📄 Report generated: ${reportPath}`);

  console.log(`\n🌐 Opening report in browser...`);
  exec(`open "${reportPath}"`, (error) => {
    if (error) {
      console.log(`   ⚠️ Could not auto-open report: ${error.message}`);
    }
  });
}

runTests();
