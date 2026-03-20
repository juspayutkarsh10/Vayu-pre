const axios = require("axios");
const fs = require("fs");
const path = require("path");
const qs = require("querystring");
const { exec } = require("child_process");
const { matchResponse } = require("./utils/validator");
const { promptMultipleInputs } = require("./utils/input");
const { TestContext } = require("./utils/store");
const { generateReport } = require("./utils/reporter");

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const env = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }
  return env;
}

const ENV = loadEnv();

// Generate random 3-digit order ID for WooCommerce
function generateOrderId() {
  return Math.floor(100 + Math.random() * 900).toString();
}

// Generate unique session ID (nanoid-like)
function generateSessionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let result = '';
  for (let i = 0; i < 21; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Get command line argument for portal selection
const args = process.argv.slice(2);
const portalArg = args[0]?.toLowerCase() || 'all';

// Portal configurations
const PORTALS = [
  { 
    name: 'Shopify', 
    id: 'shopify',
    file: './data/shopify-tests.json',
    icon: '🛍️'
  },
  { 
    name: 'WooCommerce', 
    id: 'woocommerce',
    file: './data/woocommerce-tests.json',
    icon: '🛒'
  }
];

// Helper to convert body to form-urlencoded format
function prepareFormData(body) {
  const formData = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'object' && value !== null) {
      formData[key] = JSON.stringify(value);
    } else {
      formData[key] = value;
    }
  }
  return qs.stringify(formData);
}

// Check if response indicates incorrect OTP
function isIncorrectOtpError(responseData) {
  if (!responseData) return false;
  return responseData.status === 'Failure' && 
         responseData.error?.message === 'Incorrect OTP';
}

function clearPreviousReports() {
  const reportsDir = path.join(__dirname, "reports");
  if (fs.existsSync(reportsDir)) {
    const files = fs.readdirSync(reportsDir);
    files.forEach(file => {
      if (file.endsWith('.html')) {
        fs.unlinkSync(path.join(reportsDir, file));
      }
    });
    console.log(`🗑️  Cleared ${files.length} previous report(s)\n`);
  }
}

// Run tests for a specific portal
async function runPortalTests(portal, tests) {
  const testContext = new TestContext(); // Fresh context for each portal
  const testResults = [];
  let pass = 0;
  let fail = 0;
  const startTime = Date.now();

  // Pre-generate WooCommerce-specific values
  if (portal.id === 'woocommerce') {
    const sessionId = generateSessionId();
    testContext.set('sessionId', sessionId);
    console.log(`🔐 Generated sessionId: ${sessionId}`);
    
    // Pre-fill WooCommerce cookie and nonce from env
    if (ENV.WOO_COOKIE) {
      testContext.set('wooCookie', ENV.WOO_COOKIE);
      console.log(`🍪 Using WooCommerce cookie from .env`);
    }
    if (ENV.WOO_NONCE) {
      testContext.set('wooNonce', ENV.WOO_NONCE);
      console.log(`🔑 Using WooCommerce nonce from .env: ${ENV.WOO_NONCE}`);
    }
    // Generate Basic Auth for WooCommerce API
    if (ENV.WOO_CONSUMER_KEY && ENV.WOO_CONSUMER_SECRET) {
      const basicAuth = Buffer.from(`${ENV.WOO_CONSUMER_KEY}:${ENV.WOO_CONSUMER_SECRET}`).toString('base64');
      testContext.set('wooBasicAuth', `Basic ${basicAuth}`);
      console.log(`🔑 Using WooCommerce API keys from .env`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${portal.icon} Running ${portal.name} Tests (${tests.length} tests)`);
  console.log(`${'='.repeat(60)}\n`);

  for (const test of tests) {
    const testStartTime = Date.now();
    const result = {
      name: test.name,
      method: test.method,
      url: '',
      status: 'pass',
      statusCode: null,
      duration: 0,
      requestHeaders: {},
      requestBody: null,
      response: null,
      error: null,
      portal: portal.id
    };

    try {
      const contentType = (test.headers || {})['content-type'] || (test.headers || {})['Content-Type'] || '';
      const isFormEncoded = contentType.includes('application/x-www-form-urlencoded');

      let headers = testContext.replaceInObject(test.headers || {});
      let body = isFormEncoded 
        ? testContext.replaceInObjectDirect(test.body || {})
        : testContext.replaceInObject(test.body || {});
      let url = testContext.replacePlaceholders(test.url);

      if (test.requiresInput && test.requiresInput.length > 0) {
        console.log(`\n📝 Test "${test.name}" requires user input:`);
        
        // Filter out inputs that can be auto-filled
        const autoFilled = {};
        const remainingInputs = test.requiresInput.filter(input => {
          // Auto-fill phone number from env
          if (input.field === 'phoneNumber' && ENV.PHONE_NUMBER) {
            autoFilled[input.field] = ENV.PHONE_NUMBER;
            console.log(`   📱 Using phone from .env: ${ENV.PHONE_NUMBER}`);
            return false;
          }
          // Note: orderId must be a REAL WooCommerce order ID with items
          return true;
        });
        
        // Store auto-filled values
        Object.entries(autoFilled).forEach(([key, value]) => {
          testContext.set(key, value);
        });
        
        // Prompt for remaining inputs
        if (remainingInputs.length > 0) {
          const userInputs = await promptMultipleInputs(remainingInputs);
          Object.entries(userInputs).forEach(([key, value]) => {
            testContext.set(key, value);
          });
        }
        
        headers = testContext.replaceInObject(test.headers || {});
        body = isFormEncoded 
          ? testContext.replaceInObjectDirect(test.body || {})
          : testContext.replaceInObject(test.body || {});
        url = testContext.replacePlaceholders(test.url);
      }

      result.url = url;
      result.requestHeaders = headers;
      result.requestBody = Object.keys(body).length > 0 ? body : null;
      result.retries = [];

      let requestData = isFormEncoded && Object.keys(body).length > 0 
        ? prepareFormData(body) 
        : body;

      const isOtpVerifyTest = test.name.toLowerCase().includes('verify otp') || test.retryOnOtpError;
      let response;
      let otpRetryCount = 0;
      const maxOtpRetries = 2;

      while (true) {
        response = await axios({
          method: test.method,
          url: url,
          headers: headers,
          data: requestData
        });

        if (isOtpVerifyTest && isIncorrectOtpError(response.data) && otpRetryCount < maxOtpRetries) {
          otpRetryCount++;
          
          result.retries.push({
            attempt: otpRetryCount,
            requestBody: { ...body },
            response: response.data,
            statusCode: response.status
          });
          
          console.log(`\n❌ Incorrect OTP. Please try again (attempt ${otpRetryCount}/${maxOtpRetries}):`);
          
          const otpInput = await promptMultipleInputs([
            { field: "otp", prompt: "Enter OTP received on phone: " }
          ]);
          
          testContext.set('otp', otpInput.otp);
          body = isFormEncoded 
            ? testContext.replaceInObjectDirect(test.body || {})
            : testContext.replaceInObject(test.body || {});
          requestData = isFormEncoded && Object.keys(body).length > 0 
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
        throw new Error('Incorrect OTP - max retries exceeded');
      }

      if (test.expectedStatus && response.status !== test.expectedStatus) {
        throw new Error(
          `Status mismatch: expected ${test.expectedStatus}, got ${response.status}`
        );
      }

      if (test.expectedResponse) {
        const expectedWithValues = testContext.replaceInObject(test.expectedResponse);
        const error = matchResponse(response.data, expectedWithValues);
        if (error) throw new Error(error);
      }

      if (test.validation) {
        const val = test.validation;
        if (val.type === 'arrayMinLength') {
          const arr = val.path.split('.').reduce((obj, key) => obj?.[key], response.data);
          if (!Array.isArray(arr) || arr.length < val.minLength) {
            throw new Error(val.message || `Expected array at '${val.path}' to have at least ${val.minLength} item(s), got ${arr?.length || 0}`);
          }
        }
      }

      if (test.extract && test.extract.length > 0) {
        testContext.extractAndStore(response.data, test.extract);
      }

      console.log(`✅ PASS: ${test.name}`);
      pass++;

    } catch (err) {
      result.status = 'fail';
      
      const errorResponse = err.response?.data || result.response;
      const errorStatusCode = err.response?.status || result.statusCode;
      
      result.error = err.response?.data 
        ? JSON.stringify(err.response.data, null, 2) 
        : err.message;
      result.statusCode = errorStatusCode;
      result.response = errorResponse;

      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   ${err.message}`);
      fail++;
    }

    result.duration = Date.now() - testStartTime;
    testResults.push(result);
  }

  const totalDuration = Date.now() - startTime;
  
  console.log(`\n📦 ${portal.name} Context:`);
  const storedValues = testContext.getAll();
  const flatKeys = Object.keys(storedValues).filter(k => typeof storedValues[k] !== 'object');
  flatKeys.forEach(key => {
    const value = storedValues[key];
    const displayValue = typeof value === 'string' && value.length > 50 
      ? value.substring(0, 50) + '...' 
      : value;
    console.log(`   ${key}: ${displayValue}`);
  });

  return {
    portal: portal,
    results: testResults,
    summary: {
      total: tests.length,
      passed: pass,
      failed: fail,
      duration: totalDuration,
      storedValues: storedValues
    }
  };
}

const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

async function runTests() {
  console.log("\n🚀 Running Multi-Portal API Automation...\n");
  
  clearPreviousReports();

  // Filter portals based on command line argument
  let portalsToRun = PORTALS;
  if (portalArg === 'shopify') {
    portalsToRun = PORTALS.filter(p => p.id === 'shopify');
    console.log('🎯 Running Shopify tests only\n');
  } else if (portalArg === 'woocommerce' || portalArg === 'woo') {
    portalsToRun = PORTALS.filter(p => p.id === 'woocommerce');
    console.log('🎯 Running WooCommerce tests only\n');
  } else if (portalArg !== 'all') {
    console.log(`⚠️  Unknown portal: "${portalArg}". Running all tests.`);
    console.log('   Usage: node runner.js [shopify|woocommerce|all]\n');
  } else {
    console.log('🎯 Running ALL portal tests\n');
  }

  const allPortalResults = [];
  const overallStartTime = Date.now();

  for (const portal of portalsToRun) {
    if (!fs.existsSync(portal.file)) {
      console.log(`\n⚠️ Skipping ${portal.name}: Test file not found (${portal.file})`);
      continue;
    }

    const tests = JSON.parse(fs.readFileSync(portal.file, "utf-8"));
    
    if (tests.length === 0) {
      console.log(`\n⚠️ Skipping ${portal.name}: No tests defined`);
      continue;
    }

    const portalResult = await runPortalTests(portal, tests);
    allPortalResults.push(portalResult);
  }

  const overallDuration = Date.now() - overallStartTime;

  const overallSummary = {
    totalPortals: allPortalResults.length,
    totalTests: allPortalResults.reduce((sum, pr) => sum + pr.summary.total, 0),
    totalPassed: allPortalResults.reduce((sum, pr) => sum + pr.summary.passed, 0),
    totalFailed: allPortalResults.reduce((sum, pr) => sum + pr.summary.failed, 0),
    totalDuration: formatDuration(overallDuration)
  };

  const reportPath = generateReport(allPortalResults, overallSummary);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Overall Summary');
  console.log(`${'='.repeat(60)}`);
  console.log(`Portals Tested: ${overallSummary.totalPortals}`);
  console.log(`Total Tests: ${overallSummary.totalTests}`);
  console.log(`Passed: ${overallSummary.totalPassed}`);
  console.log(`Failed: ${overallSummary.totalFailed}`);
  console.log(`Duration: ${overallSummary.totalDuration}`);
  console.log(`\n📄 Report generated: ${reportPath}`);
  
  console.log(`\n🌐 Opening report in browser...`);
  exec(`open "${reportPath}"`, (error) => {
    if (error) {
      console.log(`   ⚠️ Could not auto-open report: ${error.message}`);
    }
  });
}

runTests();
