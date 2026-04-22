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
- Automated OTP flow during test execution
- Automatic session and authentication handling
- HTML report generation with:
  - Test pass/fail/flaky status
  - Request/response details
  - Copy-ready cURL commands
  - Execution timing metrics
- Environment-based configuration
- Strict TypeScript types throughout

## Project Structure

```
vayu-pre/
├── src/
│   ├── runner.ts              # Main test runner
│   ├── types/
│   │   └── index.ts           # Shared TypeScript interfaces
│   └── utils/
│       ├── input.ts           # User input handling (OTP prompts)
│       ├── reporter.ts        # HTML report generation
│       ├── store.ts           # Test context and variable storage
│       └── validator.ts       # Response validation utilities
├── data/
│   ├── shopify-tests.json     # Shopify test definitions
│   └── woocommerce-tests.json # WooCommerce test definitions
├── reports/                   # Generated HTML reports (auto-created)
├── tsconfig.json              # TypeScript configuration
├── package.json
├── .env                       # Environment config (create from .env.example)
├── .env.example               # Template for environment variables
└── .gitignore
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

3. Add the same mobile number in the env `MOBILE_NUMBER_FOR_CONSTANT_OTP` in breeze-api-pre production tracker.

### Getting WooCommerce API Keys

1. Go to **WooCommerce > Settings > Advanced > REST API**
2. Click **Add Key**
3. Set permissions to **Read/Write**
4. Copy the Consumer Key and Consumer Secret

## Usage

### Run All Tests
```bash
npm test
```

### Run Platform-Specific Tests

**Shopify only:**
```bash
npm run shopify
```

**WooCommerce only:**
```bash
npm run woocommerce
# or
npm run woo
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
│  5. Verify OTP (auto-filled via .env)                            │
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
│  4. Verify OTP (auto-filled via .env)                            │
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

Use `{{variableName}}` syntax to reference extracted values across tests:
- `{{cartId}}` — Cart identifier
- `{{sessionToken}}` — Auth token
- `{{customerId}}` — Customer identifier
- `{{orderId}}` — Platform order ID

## Reports

After test execution, an HTML report is generated in `reports/test-report.html` and automatically opened in the browser.

> **Note**: The report is overwritten on each run. Rename or save it elsewhere if you need to preserve previous results.

### Report Features
- **Overall summary**: portals tested, total/passed/failed, duration
- **Per-portal tabs**: switch between Shopify and WooCommerce results
- **Filterable test list**: filter by pass / fail / flaky
- **Expandable test rows**: headers, body, cURL command, response
- **Flaky test tracking**: OTP retry attempts shown inline
- **Stored values panel**: all extracted context variables

## Troubleshooting

### Common Issues

**1. WooCommerce 401 Unauthorized**
- Verify `WOO_CONSUMER_KEY` and `WOO_CONSUMER_SECRET` are correct
- Ensure API keys have Read/Write permissions

**2. OTP Verification Failed**
- Check phone number format (10 digits, no country code)
- Ensure you're entering the OTP within the timeout window

**3. Test Context Variables Missing**
- A previous test in the chain may have failed
- Check the HTML report for the failing test's response

## Contributing

1. Add new tests to the appropriate JSON file in `data/`
2. Use `{{placeholder}}` syntax for dynamic values
3. Define `extract` rules for values needed by subsequent tests
4. Test locally before committing

## License

ISC
