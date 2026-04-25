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
   # Phone number for OTP verification — set separately per platform (10 digits, no country code)
   SHOPIFY_PHONE_NUMBER=9876543210
   WOO_PHONE_NUMBER=9876543210

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

### WooCommerce COD Flow
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WooCommerce COD Test Flow                             │
├──────┬──────────────────────────────────────┬──────────────────────────────┤
│ Step │ API Call                             │ Details                      │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  1   │ POST /wp-json/wc/v3/orders           │ Create WooCommerce order     │
│      │                                      │ ▶ orderId, orderKey, total   │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  2   │ POST /test/cart                      │ Create Breeze cart           │
│      │                                      │ ▶ cartId, checkoutUrl        │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  3   │ GET  /test/cart/{{cartId}}           │ Verify cart (currency=INR)   │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  4   │ POST /test/session/start             │ Send OTP to WOO_PHONE_NUMBER │
│      │                                      │ ▶ otpSessionToken            │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  5   │ POST /test/otp/verify                │ Verify OTP (auto: 1234)      │
│      │                                      │ ▶ sessionToken, customerId   │
│      │                                      │ ▶ breezeOrderId, addressId   │
│      │                                      │ ▶ instrumentSignature        │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  6   │ GET  /test/analytics/trackers        │ Track InitiateCheckout event │
│  7   │ GET  /test/analytics/trackers        │ Track AddPaymentInfo event   │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  8   │ POST /test/session/start-payment     │ Start payment session        │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  9   │ GET  /test/location/203412           │ Get location by pincode      │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 10   │ PATCH /test/user                     │ Update user name (+X suffix) │
│      │                                      │ ▶ updatedToken, gstDetailsId │
│ 11   │ PATCH /test/user                     │ Revert user name (remove X)  │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 12   │ PATCH /test/order                    │ Set shipping address         │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 13   │ POST /test/payments/instruments/     │ Get custom payment methods   │
│      │      custom                          │                              │
│ 14   │ GET  /test/payments/instruments      │ Get saved payment methods    │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 15   │ POST /test/offer/list                │ Get available offers         │
│ 16   │ PUT  /test/offer/{{cartId}}          │ Apply invalid offer (assert  │
│      │                                      │   error: BZ-02)              │
│ 17   │ PUT  /test/offer/{{cartId}}          │ Apply valid offer (testing10)│
│      │                                      │ ▶ appliedOfferId             │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 18   │ PATCH /test/address/gst              │ Add GST details              │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 19   │ PUT  /test/user/address              │ Update user address          │
│      │                                      │ ▶ newAddressId               │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 20   │ POST /test/payments/attempt          │ COD payment attempt          │
│      │                                      │ ▶ juspaySessionId, signature │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 21   │ POST /txns  (Juspay)                 │ Process COD via Juspay       │
│      │ noFollowRedirects: true              │ ▶ txnUuid, txnId             │
│      │                                      │   Assert: resp_code=TXN_     │
│      │                                      │           SUCCESS            │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 22   │ GET  /test/order/{{breezeOrderId}}   │ Verify order details         │
│ 23   │ GET  /test/cart/{{cartId}}           │ Verify cart after payment    │
│ 24   │ GET  /test/analytics/trackers        │ Track Purchase event         │
└──────┴──────────────────────────────────────┴──────────────────────────────┘
```

### WooCommerce Prepaid NB_DUMMY Flow
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  WooCommerce [Prepaid NB_DUMMY] Test Flow                    │
├──────┬──────────────────────────────────────┬──────────────────────────────┤
│ Step │ API Call                             │ Details                      │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  1   │ POST /wp-json/wc/v3/orders           │ Create WooCommerce order     │
│      │                                      │ ▶ nb_wooOrderId, nb_orderKey │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  2   │ POST /test/cart                      │ Create Breeze cart           │
│      │                                      │ ▶ nb_cartId, nb_checkoutUrl  │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  3   │ GET  /test/cart/{{nb_cartId}}        │ Verify cart (type=NORMAL)    │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  4   │ POST /test/session/start             │ Send OTP to WOO_PHONE_NUMBER │
│      │                                      │ ▶ nb_otpSessionToken         │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  5   │ POST /test/otp/verify                │ Verify OTP (auto: 1234)      │
│      │                                      │ ▶ nb_sessionToken            │
│      │                                      │ ▶ nb_customerId              │
│      │                                      │ ▶ nb_breezeOrderId           │
│      │                                      │ ▶ nb_selectedAddressId       │
│      │                                      │ ▶ instrumentSignature        │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  6   │ GET  /test/analytics/trackers        │ Track InitiateCheckout event │
│  7   │ GET  /test/analytics/trackers        │ Track AddPaymentInfo event   │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  8   │ POST /test/session/start-payment     │ Start payment session        │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  9   │ GET  /test/location/203412           │ Get location by pincode      │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 10   │ PATCH /test/user                     │ Update user name (+X suffix) │
│      │                                      │ ▶ nb_updatedToken            │
│ 11   │ PATCH /test/user                     │ Revert user name (remove X)  │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 12   │ PATCH /test/order                    │ Set shipping address         │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 13   │ POST /test/payments/instruments/     │ Get custom payment methods   │
│      │      custom                          │                              │
│ 14   │ GET  /test/payments/instruments      │ Get saved payment methods    │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 15   │ POST /test/offer/list                │ Get available offers         │
│ 16   │ PUT  /test/offer/{{nb_cartId}}       │ Apply invalid offer (assert  │
│      │                                      │   error: BZ-02)              │
│ 17   │ PUT  /test/offer/{{nb_cartId}}       │ Apply valid offer (testing10)│
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 18   │ PATCH /test/address/gst              │ Add GST details              │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 19   │ PUT  /test/user/address              │ Update user address          │
│      │                                      │ ▶ nb_newAddressId            │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 20   │ POST /test/payments/attempt          │ NB_DUMMY payment attempt     │
│      │                                      │ ▶ nb_signature               │
│      │                                      │ ▶ nb_orderDetails            │
│      │                                      │ ▶ nb_juspaySessionId         │
│      │                                      │ ▶ nb_paymentOrderId          │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 21   │ POST /txns  (Juspay)                 │ Place NB txn on Juspay       │
│      │ bodyType: form-urlencoded            │ ▶ nb_merchantTxnId           │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 22   │ POST /v2/pay/response/d2cstore/      │ Dummy PG: submit CHARGED     │
│      │      {{nb_merchantTxnId}}            │   status to simulate success │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 23   │ GET  /order/finish?order_id=...      │ Trigger order finish webhook │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 24   │ GET  /test/order/{{nb_breezeOrderId}}│ Verify order (3s delay)      │
│      │ delayBefore: 3000ms                  │   Assert: paymentInstrument  │
│      │                                      │           = NB_DUMMY         │
│      │                                      │ ▶ nb_platformOrderId, txnId  │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 25   │ GET  /test/cart/{{nb_cartId}}        │ Verify cart after payment    │
│      │                                      │   Assert: status=processing  │
│      │                                      │   Assert: payment_method=NB  │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 26   │ GET  /test/analytics/trackers        │ Track Purchase event         │
└──────┴──────────────────────────────────────┴──────────────────────────────┘
```

### Shopify COD Flow
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Shopify COD Test Flow                               │
├──────┬──────────────────────────────────────┬──────────────────────────────┤
│ Step │ API Call                             │ Details                      │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  1   │ POST /test/cart                      │ Create Breeze cart           │
│      │                                      │ ▶ cartId, checkoutUrl        │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  2   │ GET  /test/cart/{{cartId}}           │ Verify cart (type=NORMAL)    │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  3   │ POST /test/session/start             │ Send OTP to                  │
│      │                                      │ SHOPIFY_PHONE_NUMBER         │
│      │                                      │ ▶ otpSessionToken            │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  4   │ POST /test/otp/verify                │ Verify OTP (auto: 1234)      │
│      │                                      │ ▶ sessionToken, customerId   │
│      │                                      │ ▶ orderId, selectedAddressId │
│      │                                      │ ▶ instrumentSignature        │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  5   │ GET  /test/analytics/trackers        │ Track InitiateCheckout event │
│  6   │ GET  /test/analytics/trackers        │ Track AddPaymentInfo event   │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  7   │ POST /test/session/start-payment     │ Start payment session        │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  8   │ GET  /test/location/203412           │ Get location by pincode      │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  9   │ PATCH /test/user                     │ Update user name (+X suffix) │
│      │                                      │ ▶ updatedToken, gstDetailsId │
│ 10   │ PATCH /test/user                     │ Revert user name (remove X)  │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 11   │ PATCH /test/order                    │ Set shipping address         │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 12   │ POST /test/payments/instruments/     │ Get custom payment methods   │
│      │      custom                          │                              │
│ 13   │ GET  /test/payments/instruments      │ Get saved payment methods    │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 14   │ POST /test/offer/list                │ Get available offers         │
│ 15   │ PUT  /test/offer/{{cartId}}          │ Apply offer (attempt 1)      │
│ 16   │ PUT  /test/offer/{{cartId}}          │ Apply offer (attempt 2)      │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 17   │ PATCH /test/address/gst              │ Add GST details              │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 18   │ PUT  /test/user/address              │ Update user address          │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 19   │ POST /test/payments/attempt          │ COD payment attempt          │
│      │                                      │   Assert: approve=true       │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 20   │ POST /txns  (Juspay)                 │ Place order on Juspay        │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 21   │ GET  /test/order/{{orderId}}         │ Verify order details         │
│      │                                      │   Assert: paymentMethod=CASH │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 22   │ GET  /test/analytics/trackers        │ Track Purchase event         │
└──────┴──────────────────────────────────────┴──────────────────────────────┘
```

### Shopify Prepaid NB_DUMMY Flow
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Shopify [Prepaid NB_DUMMY] Test Flow                      │
├──────┬──────────────────────────────────────┬──────────────────────────────┤
│ Step │ API Call                             │ Details                      │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  1   │ POST /test/cart                      │ Create Breeze cart           │
│      │                                      │ ▶ nb_cartId, nb_checkoutUrl  │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  2   │ GET  /test/cart/{{nb_cartId}}        │ Verify cart (type=NORMAL)    │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  3   │ POST /test/session/start             │ Send OTP to                  │
│      │                                      │ SHOPIFY_PHONE_NUMBER         │
│      │                                      │ ▶ nb_otpSessionToken         │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  4   │ POST /test/otp/verify                │ Verify OTP (auto: 1234)      │
│      │                                      │ ▶ nb_sessionToken            │
│      │                                      │ ▶ nb_customerId, nb_orderId  │
│      │                                      │ ▶ nb_selectedAddressId       │
│      │                                      │ ▶ instrumentSignature        │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  5   │ GET  /test/analytics/trackers        │ Track InitiateCheckout event │
│  6   │ GET  /test/analytics/trackers        │ Track AddPaymentInfo event   │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  7   │ POST /test/session/start-payment     │ Start payment session        │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  8   │ GET  /test/location/203412           │ Get location by pincode      │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│  9   │ PATCH /test/user                     │ Update user name (+X suffix) │
│      │                                      │ ▶ nb_updatedToken            │
│ 10   │ PATCH /test/user                     │ Revert user name (remove X)  │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 11   │ PATCH /test/order                    │ Set shipping address         │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 12   │ POST /test/payments/instruments/     │ Get custom payment methods   │
│      │      custom                          │                              │
│ 13   │ GET  /test/payments/instruments      │ Get saved payment methods    │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 14   │ POST /test/offer/list                │ Get available offers         │
│ 15   │ PUT  /test/offer/{{nb_cartId}}       │ Apply offer                  │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 16   │ PATCH /test/address/gst              │ Add GST details              │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 17   │ PUT  /test/user/address              │ Update user address          │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 18   │ POST /test/payments/attempt          │ NB_DUMMY payment attempt     │
│      │                                      │   Assert: approve=true       │
│      │                                      │ ▶ nb_signature               │
│      │                                      │ ▶ nb_orderDetails            │
│      │                                      │ ▶ nb_paymentOrderId          │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 19   │ POST /txns  (Juspay)                 │ Place NB txn on Juspay       │
│      │ bodyType: form-urlencoded            │ ▶ nb_merchantTxnId           │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 20   │ POST /v2/pay/response/               │ Dummy PG: submit CHARGED     │
│      │      utkarshprodstore/               │   status to simulate success │
│      │      {{nb_merchantTxnId}}            │                              │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 21   │ GET  /test/order/{{nb_orderId}}      │ Verify order (3s delay)      │
│      │ delayBefore: 3000ms                  │   Assert: paymentInstrument  │
│      │                                      │           = NB_DUMMY         │
│      │                                      │ ▶ nb_platformOrderId, txnId  │
├──────┼──────────────────────────────────────┼──────────────────────────────┤
│ 22   │ GET  /test/analytics/trackers        │ Track Purchase event         │
└──────┴──────────────────────────────────────┴──────────────────────────────┘
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
  "bodyType": "form-urlencoded",
  "expectedStatus": 200,
  "expectedResponse": {
    "status": "success"
  },
  "extract": [
    { "field": "sessionToken", "path": "token" },
    { "field": "customerId", "path": "data.customer.id" },
    { "field": "orderId", "path": "order.details", "parseJson": true, "jsonPath": "order_id" }
  ],
  "requiresInput": [
    { "field": "otp", "prompt": "Enter OTP: " }
  ],
  "delayBefore": 3000,
  "noFollowRedirects": true
}
```

### Field Reference

| Field | Type | Description |
|---|---|---|
| `name` | string | Display name for the test step |
| `method` | string | HTTP method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE` |
| `url` | string | Request URL, supports `{{placeholder}}` syntax |
| `headers` | object | Request headers, supports `{{placeholder}}` syntax |
| `body` | object | Request body, supports `{{placeholder}}` syntax |
| `bodyType` | string | Set to `"form-urlencoded"` to send as `application/x-www-form-urlencoded` |
| `expectedStatus` | number | Assert the response HTTP status code |
| `expectedResponse` | object | Assert response body contains these key/value pairs (deep partial match) |
| `extract` | array | Extract values from response and store for use in later steps |
| `extract[].field` | string | Variable name to store the value as |
| `extract[].path` | string | Dot-notation path into the response (supports array indexing e.g. `items[0].id`) |
| `extract[].parseJson` | boolean | Parse the extracted string as JSON before further extraction |
| `extract[].jsonPath` | string | Dot-notation path applied after `parseJson` |
| `requiresInput` | array | Prompt for user input (phone/OTP — auto-filled from `.env`) |
| `delayBefore` | number | Milliseconds to wait before executing this step |
| `noFollowRedirects` | boolean | Stop axios from following 3xx redirects — captures JSON in redirect response body |

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
- Ensure `SHOPIFY_PHONE_NUMBER` or `WOO_PHONE_NUMBER` is set correctly for the platform you're testing
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
