const axios = require("axios");
const fs = require("fs");
const path = require("path");
const qs = require("querystring");
const { exec } = require("child_process");
const { matchResponse } = require("./utils/validator");
const { promptMultipleInputs } = require("./utils/input");
const { testContext } = require("./utils/store");
const { generateReport } = require("./utils/reporter");

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

const tests = JSON.parse(
  fs.readFileSync("./data/api-tests.json", "utf-8")
);

let pass = 0;
let fail = 0;
const testResults = [];
const startTime = Date.now();

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

async function runTests() {
  console.log("\n🚀 Running API Automation...\n");
  
  // Clear previous reports
  clearPreviousReports();

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
      error: null
    };

    try {
      // Check if content-type is form-urlencoded
      const contentType = (test.headers || {})['content-type'] || (test.headers || {})['Content-Type'] || '';
      const isFormEncoded = contentType.includes('application/x-www-form-urlencoded');

      // Replace placeholders with stored values from previous responses
      // Use direct replacement for form-encoded to avoid JSON escaping issues
      let headers = testContext.replaceInObject(test.headers || {});
      let body = isFormEncoded 
        ? testContext.replaceInObjectDirect(test.body || {})
        : testContext.replaceInObject(test.body || {});
      let url = testContext.replacePlaceholders(test.url);

      // Handle user input if required (e.g., OTP verification)
      if (test.requiresInput && test.requiresInput.length > 0) {
        console.log(`\n📝 Test "${test.name}" requires user input:`);
        const userInputs = await promptMultipleInputs(test.requiresInput);
        
        // Store user inputs in context for use in this request
        Object.entries(userInputs).forEach(([key, value]) => {
          testContext.set(key, value);
        });
        
        // Re-apply placeholders with user inputs included
        headers = testContext.replaceInObject(test.headers || {});
        body = isFormEncoded 
          ? testContext.replaceInObjectDirect(test.body || {})
          : testContext.replaceInObject(test.body || {});
        url = testContext.replacePlaceholders(test.url);
      }

      // Store request details for report
      result.url = url;
      result.requestHeaders = headers;
      result.requestBody = Object.keys(body).length > 0 ? body : null;
      result.retries = []; // Track retry attempts

      let requestData = isFormEncoded && Object.keys(body).length > 0 
        ? prepareFormData(body) 
        : body;

      // Check if this is an OTP verification test (for retry logic)
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

        // Check if OTP was incorrect and we should retry
        if (isOtpVerifyTest && isIncorrectOtpError(response.data) && otpRetryCount < maxOtpRetries) {
          otpRetryCount++;
          
          // Store this failed attempt
          result.retries.push({
            attempt: otpRetryCount,
            requestBody: { ...body },
            response: response.data,
            statusCode: response.status
          });
          
          console.log(`\n❌ Incorrect OTP. Please try again (attempt ${otpRetryCount}/${maxOtpRetries}):`);
          
          // Ask for OTP again
          const otpInput = await promptMultipleInputs([
            { field: "otp", prompt: "Enter OTP received on phone: " }
          ]);
          
          // Update the OTP in context and body
          testContext.set('otp', otpInput.otp);
          body = isFormEncoded 
            ? testContext.replaceInObjectDirect(test.body || {})
            : testContext.replaceInObject(test.body || {});
          requestData = isFormEncoded && Object.keys(body).length > 0 
            ? prepareFormData(body) 
            : body;
          
          // Update result with latest body
          result.requestBody = Object.keys(body).length > 0 ? body : null;
          continue;
        }
        
        // Exit loop - either success or non-OTP error
        break;
      }

      // Store response details
      result.statusCode = response.status;
      result.response = response.data;

      // Log request and response details (limited for terminal)
      console.log(`\n📤 ${test.method} ${url}`);
      console.log(`📥 Status: ${response.status}`);
      console.log(`📥 Response: (see report for full details)`);

      // Check for OTP error even after retries (max retries exceeded)
      if (isOtpVerifyTest && isIncorrectOtpError(response.data)) {
        throw new Error('Incorrect OTP - max retries exceeded');
      }

      // Status validation
      if (test.expectedStatus && response.status !== test.expectedStatus) {
        throw new Error(
          `Status mismatch: expected ${test.expectedStatus}, got ${response.status}`
        );
      }

      // Response validation
      if (test.expectedResponse) {
        const expectedWithValues = testContext.replaceInObject(test.expectedResponse);
        const error = matchResponse(response.data, expectedWithValues);
        if (error) throw new Error(error);
      }

      // Custom validation
      if (test.validation) {
        const val = test.validation;
        if (val.type === 'arrayMinLength') {
          const arr = val.path.split('.').reduce((obj, key) => obj?.[key], response.data);
          if (!Array.isArray(arr) || arr.length < val.minLength) {
            throw new Error(val.message || `Expected array at '${val.path}' to have at least ${val.minLength} item(s), got ${arr?.length || 0}`);
          }
        }
      }

      // Extract values from response for use in future tests
      if (test.extract && test.extract.length > 0) {
        testContext.extractAndStore(response.data, test.extract);
      }

      console.log(`✅ PASS: ${test.name}`);
      pass++;

    } catch (err) {
      result.status = 'fail';
      
      // Capture response from either axios error or the successful response before validation failed
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

  // Calculate total duration
  const totalDuration = Date.now() - startTime;
  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Generate HTML report
  const summary = {
    total: tests.length,
    passed: pass,
    failed: fail,
    totalDuration: formatDuration(totalDuration),
    storedValues: testContext.getAll()
  };

  const reportPath = generateReport(testResults, summary);

  // Print final context state
  testContext.printStore();
  
  console.log("\n📊 Summary");
  console.log(`Total: ${tests.length}`);
  console.log(`Passed: ${pass}`);
  console.log(`Failed: ${fail}`);
  console.log(`Duration: ${formatDuration(totalDuration)}`);
  console.log(`\n📄 Report generated: ${reportPath}`);
  
  // Auto-open the report in default browser
  console.log(`\n🌐 Opening report in browser...`);
  exec(`open "${reportPath}"`, (error) => {
    if (error) {
      console.log(`   ⚠️ Could not auto-open report: ${error.message}`);
    }
  });
}

runTests();