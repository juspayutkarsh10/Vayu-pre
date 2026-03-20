# Vayu Pre - Breeze Checkout API Test Runner

A comprehensive E2E test runner for validating Breeze Checkout integration across multiple e-commerce platforms.

## Overview

Vayu Pre automates the complete checkout flow testing for:
- **Shopify** stores
- **WooCommerce** stores

Each test run executes the full checkout journey—from cart creation to payment initiation—and generates detailed HTML reports with request/response data.

## Features

- Sequential API test execution with variable extraction
- Support for both Shopify and WooCommerce platforms
- Interactive OTP input during test execution
- Automatic session and authentication handling
- HTML report generation with:
  - Test pass/fail status
  - Request/response details
  - Copy-ready cURL commands
  - Execution timing metrics
- Environment-based configuration

## Project Structure

```
vayu-pre/
├── runner.js              # Main test runner
├── package.json           # Dependencies and scripts
├── .env                   # Environment configuration (create from .env.example)
├── .env.example           # Template for environment variables
├── data/
│   ├── shopify-tests.json      # Shopify test definitions
│   └── woocommerce-tests.json  # WooCommerce test definitions
├── utils/
│   ├── input.js           # User input handling (OTP prompts)
│   ├── reporter.js        # HTML report generation
│   ├── store.js           # Test context and variable storage
│   └── validator.js       # Response validation utilities
└── reports/               # Generated test reports (auto-created)
```

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd vayu-pre

# Install dependencies
npm install
```

## Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Configure your `.env` file:

   ```env
   # Phone number for OTP verification (10 digits, no country code)
   PHONE_NUMBER=9876543210

   # WooCommerce API Keys (from WooCommerce > Settings > Advanced > REST API)
   WOO_CONSUMER_KEY=ck_your_consumer_key
   WOO_CONSUMER_SECRET=cs_your_consumer_secret
   ```

### Getting WooCommerce API Keys

1. Go to **WooCommerce > Settings > Advanced > REST API**
2. Click **Add Key**
3. Set permissions to **Read/Write**
4. Copy the Consumer Key and Consumer Secret

## Usage

### Run All Tests
```bash
npm test
# or
node runner.js
```

### Run Platform-Specific Tests

**Shopify only:**
```bash
npm run shopify
# or
node runner.js shopify
```

**WooCommerce only:**
```bash
npm run woocommerce
# or
npm run woo
# or
node runner.js woocommerce
```

## Test Flow

### WooCommerce Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                    WooCommerce Test Flow                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Create WooCommerce Order (REST API)                          │
│     └─▶ Extract: orderId, orderKey, orderTotal                   │
│                                                                  │
│  2. Create Breeze Cart                                           │
│     └─▶ Extract: cartId, checkoutUrl                             │
│                                                                  │
│  3. Get Cart Details                                             │
│                                                                  │
│  4. Send OTP                                                     │
│     └─▶ Extract: otpSessionToken                                 │
│                                                                  │
│  5. Verify OTP (requires manual input)                           │
│     └─▶ Extract: sessionToken, customerId                        │
│                                                                  │
│  6. Start Payment                                                │
│     └─▶ Extract: paymentDetails, addressId                       │
│                                                                  │
│  7. Get Payment Instruments                                      │
│                                                                  │
│  8. Additional validation tests...                               │
└─────────────────────────────────────────────────────────────────┘
```

### Shopify Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                      Shopify Test Flow                           │
├─────────────────────────────────────────────────────────────────┤
│  1. Get Shopify Cart (cart.js)                                   │
│     └─▶ Extract: cartToken                                       │
│                                                                  │
│  2. Create Breeze Cart                                           │
│     └─▶ Extract: cartId, checkoutUrl                             │
│                                                                  │
│  3. Send OTP                                                     │
│     └─▶ Extract: otpSessionToken                                 │
│                                                                  │
│  4. Verify OTP (requires manual input)                           │
│     └─▶ Extract: sessionToken, customerId                        │
│                                                                  │
│  5. Start Payment                                                │
│     └─▶ Extract: paymentDetails, breezeOrderId                   │
│                                                                  │
│  6. Additional validation and analytics tests...                 │
└─────────────────────────────────────────────────────────────────┘
```

## Test Definition Format

Tests are defined in JSON files under `data/`. Each test object supports:

```json
{
  "name": "Test Name",
  "method": "POST",
  "url": "https://api.example.com/endpoint",
  "headers": {
    "content-type": "application/json",
    "authorization": "Bearer {{sessionToken}}"
  },
  "body": {
    "cartId": "{{cartId}}"
  },
  "expectedStatus": 200,
  "expectedResponse": {
    "status": "success"
  },
  "extract": [
    { "field": "sessionToken", "path": "token" },
    { "field": "customerId", "path": "data.customer.id" }
  ],
  "requiresInput": [
    { "field": "otp", "prompt": "Enter OTP: " }
  ]
}
```

### Variable Placeholders

Use `{{variableName}}` syntax to reference extracted values:
- `{{cartId}}` - Cart identifier
- `{{sessionToken}}` - Auth token
- `{{customerId}}` - Customer identifier
- `{{orderId}}` - Platform order ID

## Reports

After test execution, an HTML report is generated in the `reports/` directory:

```
reports/
└── test-report.html
```

> **Note**: The report file is overwritten on each test run. Save/rename the file if you need to preserve previous results.

### Report Features
- **Summary**: Total tests, pass/fail counts, duration
- **Test Details**: Expandable sections for each test
- **Request Info**: Headers, body, cURL command
- **Response Data**: Status code, response body
- **Timestamps**: Execution time per test

## Console Output

```
============================================================
🛒 Running WooCommerce Tests (25 tests)
============================================================

🔐 Generated sessionId: aBcDeFgHiJkLmNoPqRsTu
🔑 Using WooCommerce API keys from .env

✅ PASS: Create WooCommerce Order
📤 POST https://breeze1cco.in/wp-json/wc/v3/orders
📥 Status: 201

✅ PASS: Create Cart
📤 POST https://api.breeze.in/test/cart
📥 Status: 200

📝 Test "Verify OTP" requires user input:
   Enter OTP received on phone: ******

...

============================================================
📊 WooCommerce Results: 24/25 passed (96.0%)
⏱️  Duration: 45.2s
📄 Report: reports/test-report.html
============================================================
```

## Troubleshooting

### Common Issues

**1. WooCommerce 401 Unauthorized**
- Verify `WOO_CONSUMER_KEY` and `WOO_CONSUMER_SECRET` are correct
- Ensure API keys have Read/Write permissions

**2. OTP Verification Failed**
- Check phone number format (10 digits, no country code)
- Ensure you're entering the OTP within the timeout window

**3. Test Context Variables Missing**
- Previous test in the chain may have failed
- Check the HTML report for the failing test's response

## Contributing

1. Add new tests to the appropriate JSON file in `data/`
2. Use placeholders for dynamic values
3. Define `extract` rules for values needed by subsequent tests
4. Test locally before committing

## License

ISC
