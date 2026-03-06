const fs = require("fs");
const path = require("path");

function generateCurl(method, url, headers, body) {
  let curl = `curl '${url}'`;
  
  if (method !== 'GET') {
    curl += ` \\\n  -X '${method}'`;
  }
  
  // Add headers
  if (headers && typeof headers === 'object') {
    for (const [key, value] of Object.entries(headers)) {
      curl += ` \\\n  -H '${key}: ${value}'`;
    }
  }
  
  // Add body for non-GET requests
  if (body && Object.keys(body).length > 0 && method !== 'GET') {
    curl += ` \\\n  --data-raw '${JSON.stringify(body)}'`;
  }
  
  return curl;
}

function generateReport(results, summary) {
  const reportDir = path.join(__dirname, "..", "reports");
  
  // Create reports directory if it doesn't exist
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, `test-report.html`);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Test Report - ${new Date().toLocaleString()}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #e4e4e4;
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    header {
      text-align: center;
      padding: 30px 0;
      margin-bottom: 30px;
      border-bottom: 2px solid #0f3460;
    }
    
    header h1 {
      font-size: 2.5rem;
      background: linear-gradient(90deg, #00d9ff, #00ff88);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    
    header .timestamp {
      color: #888;
      font-size: 0.9rem;
    }
    
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    
    .card {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 25px;
      text-align: center;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: transform 0.3s ease;
    }
    
    .card:hover {
      transform: translateY(-5px);
    }
    
    .card h3 {
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #888;
      margin-bottom: 10px;
    }
    
    .card .value {
      font-size: 3rem;
      font-weight: bold;
    }
    
    .card.total .value { color: #00d9ff; }
    .card.passed .value { color: #00ff88; }
    .card.failed .value { color: #ff6b6b; }
    .card.flaky .value { color: #ffc107; }
    .card.duration .value { color: #ffd93d; font-size: 2rem; }
    
    .progress-bar {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 15px;
    }
    
    .progress-bar .fill {
      height: 100%;
      background: linear-gradient(90deg, #00ff88, #00d9ff);
      border-radius: 4px;
      transition: width 0.5s ease;
    }
    
    .test-results {
      margin-top: 40px;
    }
    
    .test-results h2 {
      font-size: 1.5rem;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #0f3460;
    }
    
    .test-item {
      background: rgba(255, 255, 255, 0.03);
      border-radius: 12px;
      margin-bottom: 15px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .test-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px;
      cursor: pointer;
      transition: background 0.3s ease;
    }
    
    .test-header:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    
    .test-info {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .status-badge {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .status-badge.pass {
      background: rgba(0, 255, 136, 0.2);
      color: #00ff88;
      border: 1px solid rgba(0, 255, 136, 0.3);
    }
    
    .status-badge.fail {
      background: rgba(255, 107, 107, 0.2);
      color: #ff6b6b;
      border: 1px solid rgba(255, 107, 107, 0.3);
    }
    
    .status-badge.flaky {
      background: rgba(255, 193, 7, 0.2);
      color: #ffc107;
      border: 1px solid rgba(255, 193, 7, 0.3);
    }
    
    .retry-count-badge {
      background: rgba(255, 165, 0, 0.15);
      color: #ffa500;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      border: 1px solid rgba(255, 165, 0, 0.3);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    
    .test-item.has-retries {
      border-color: rgba(255, 193, 7, 0.3);
      box-shadow: 0 0 10px rgba(255, 193, 7, 0.1);
    }
    
    .test-item.has-retries .test-header {
      background: rgba(255, 193, 7, 0.05);
    }
    
    .test-name {
      font-weight: 600;
      font-size: 1.1rem;
    }
    
    .test-meta {
      display: flex;
      align-items: center;
      gap: 20px;
      color: #888;
      font-size: 0.85rem;
    }
    
    .method-badge {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: bold;
    }
    
    .method-badge.GET { background: #2d6a4f; color: #95d5b2; }
    .method-badge.POST { background: #1d3557; color: #a8dadc; }
    .method-badge.PUT { background: #7f4f24; color: #dda15e; }
    .method-badge.PATCH { background: #5c4d7d; color: #b8b8d1; }
    .method-badge.DELETE { background: #6b2737; color: #ff8fa3; }
    
    .test-details {
      display: none;
      padding: 0 20px 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .test-item.expanded .test-details {
      display: block;
    }
    
    .detail-section {
      margin-top: 20px;
    }
    
    .detail-section h4 {
      color: #00d9ff;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    
    .code-block {
      background: #0d1117;
      border-radius: 8px;
      padding: 15px;
      overflow-x: auto;
      font-family: 'Fira Code', 'Monaco', monospace;
      font-size: 0.85rem;
      line-height: 1.6;
      max-height: 400px;
      overflow-y: auto;
    }
    
    .code-block pre {
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    .curl-section {
      position: relative;
    }
    
    .curl-section .copy-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0, 217, 255, 0.2);
      border: 1px solid rgba(0, 217, 255, 0.3);
      color: #00d9ff;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: bold;
      transition: all 0.3s ease;
    }
    
    .curl-section .copy-btn:hover {
      background: rgba(0, 217, 255, 0.4);
    }
    
    .curl-section .copy-btn.copied {
      background: rgba(0, 255, 136, 0.3);
      border-color: rgba(0, 255, 136, 0.5);
      color: #00ff88;
    }
    
    .error-message {
      background: rgba(255, 107, 107, 0.1);
      border-left: 4px solid #ff6b6b;
      padding: 15px;
      border-radius: 0 8px 8px 0;
      color: #ff8fa3;
    }
    
    .retries-section {
      border: 1px solid rgba(255, 165, 0, 0.3);
      border-radius: 8px;
      padding: 15px;
      background: rgba(255, 165, 0, 0.05);
    }
    
    .retries-section h4 {
      color: #ffa500;
      margin-bottom: 15px;
    }
    
    .retry-item {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
      border-left: 3px solid #ff6b6b;
    }
    
    .retry-item:last-child {
      margin-bottom: 0;
    }
    
    .retry-header {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .retry-badge {
      background: rgba(255, 165, 0, 0.2);
      color: #ffa500;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    
    .retry-status {
      color: #ff6b6b;
      font-size: 0.85rem;
    }
    
    .retry-body, .retry-response {
      margin-top: 10px;
    }
    
    .retry-body strong, .retry-response strong {
      display: block;
      margin-bottom: 5px;
      color: #888;
      font-size: 0.85rem;
    }
    
    .retry-body .code-block, .retry-response .code-block {
      max-height: 150px;
    }
    
    .url-display {
      background: rgba(0, 217, 255, 0.1);
      padding: 10px 15px;
      border-radius: 8px;
      font-family: monospace;
      word-break: break-all;
      color: #00d9ff;
    }
    
    .expand-icon {
      font-size: 1.5rem;
      color: #888;
      transition: transform 0.3s ease;
    }
    
    .test-item.expanded .expand-icon {
      transform: rotate(180deg);
    }
    
    .stored-values {
      margin-top: 40px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 12px;
      padding: 25px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .stored-values h2 {
      margin-bottom: 20px;
      font-size: 1.3rem;
    }
    
    .values-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 15px;
    }
    
    .value-item {
      background: rgba(0, 0, 0, 0.2);
      padding: 12px 15px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .value-item .key {
      color: #00ff88;
      font-size: 0.85rem;
      font-weight: 600;
    }
    
    .value-item .val {
      color: #888;
      font-family: monospace;
      font-size: 0.8rem;
      word-break: break-all;
    }
    
    footer {
      text-align: center;
      padding: 30px 0;
      color: #666;
      font-size: 0.85rem;
      margin-top: 40px;
    }
    
    @media (max-width: 768px) {
      .test-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
      }
      
      .test-meta {
        flex-wrap: wrap;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚀 Vayu Pre API Test Report</h1>
      <p class="timestamp">Generated on ${new Date().toLocaleString()}</p>
    </header>
    
    <div class="summary-cards">
      <div class="card total">
        <h3>Total Tests</h3>
        <div class="value">${summary.total}</div>
      </div>
      <div class="card passed">
        <h3>Passed</h3>
        <div class="value">${summary.passed}</div>
        <div class="progress-bar">
          <div class="fill" style="width: ${(summary.passed / summary.total * 100) || 0}%"></div>
        </div>
      </div>
      <div class="card failed">
        <h3>Failed</h3>
        <div class="value">${summary.failed}</div>
      </div>
      <div class="card flaky">
        <h3>Flaky</h3>
        <div class="value">${results.filter(r => r.retries && r.retries.length > 0 && r.status === 'pass').length}</div>
      </div>
      <div class="card duration">
        <h3>Total Duration</h3>
        <div class="value">${summary.totalDuration}</div>
      </div>
    </div>
    
    <div class="test-results">
      <h2>📋 Test Results</h2>
      ${results.map((result, index) => {
        const hasRetries = result.retries && result.retries.length > 0;
        const isFlaky = hasRetries && result.status === 'pass';
        const totalAttempts = hasRetries ? result.retries.length + 1 : 1;
        return `
        <div class="test-item ${hasRetries ? 'has-retries' : ''}">
          <div class="test-header" onclick="this.parentElement.classList.toggle('expanded')">
            <div class="test-info">
              <span class="status-badge ${isFlaky ? 'flaky' : result.status}">${isFlaky ? 'FLAKY' : result.status}</span>
              <span class="test-name">${result.name}</span>
              ${hasRetries ? `<span class="retry-count-badge">🔄 ${totalAttempts} attempts</span>` : ''}
            </div>
            <div class="test-meta">
              <span class="method-badge ${result.method}">${result.method}</span>
              <span>⏱️ ${result.duration}ms</span>
              <span>📶 ${result.statusCode || 'N/A'}</span>
              <span class="expand-icon">▼</span>
            </div>
          </div>
          <div class="test-details">
            <div class="detail-section">
              <h4>🔗 URL</h4>
              <div class="url-display">${result.url}</div>
            </div>
            
            <div class="detail-section curl-section">
              <h4>📋 cURL Command</h4>
              <button class="copy-btn" onclick="event.stopPropagation(); copyCurl(this, ${index})">Copy</button>
              <div class="code-block"><pre id="curl-${index}">${escapeHtml(generateCurl(result.method, result.url, result.requestHeaders, result.requestBody))}</pre></div>
            </div>
            
            ${result.error ? `
            <div class="detail-section">
              <h4>❌ Error</h4>
              <div class="error-message">${escapeHtml(result.error)}</div>
            </div>
            ` : ''}
            
            <div class="detail-section">
              <h4>📤 Request Headers</h4>
              <div class="code-block"><pre>${escapeHtml(JSON.stringify(result.requestHeaders, null, 2))}</pre></div>
            </div>
            
            ${result.requestBody ? `
            <div class="detail-section">
              <h4>📤 Request Body</h4>
              <div class="code-block"><pre>${escapeHtml(JSON.stringify(result.requestBody, null, 2))}</pre></div>
            </div>
            ` : ''}
            
            ${result.retries && result.retries.length > 0 ? `
            <div class="detail-section retries-section">
              <h4>🔄 OTP Retry Attempts (${result.retries.length})</h4>
              ${result.retries.map((retry, retryIdx) => `
                <div class="retry-item">
                  <div class="retry-header">
                    <span class="retry-badge">Attempt ${retry.attempt}</span>
                    <span class="retry-status">❌ Incorrect OTP</span>
                  </div>
                  <div class="retry-body">
                    <strong>Request Body:</strong>
                    <div class="code-block"><pre>${escapeHtml(JSON.stringify(retry.requestBody, null, 2))}</pre></div>
                  </div>
                  <div class="retry-response">
                    <strong>Response:</strong>
                    <div class="code-block"><pre>${escapeHtml(JSON.stringify(retry.response, null, 2))}</pre></div>
                  </div>
                </div>
              `).join('')}
            </div>
            ` : ''}
            
            <div class="detail-section">
              <h4>📥 Response</h4>
              <div class="code-block"><pre>${escapeHtml(JSON.stringify(result.response, null, 2))}</pre></div>
            </div>
          </div>
        </div>
      `;
      }).join('')}
    </div>
    
    <div class="stored-values">
      <h2>💾 Stored Values (Test Context)</h2>
      <div class="values-grid">
        ${Object.entries(summary.storedValues || {}).map(([key, value]) => `
          <div class="value-item">
            <span class="key">${key}</span>
            <span class="val">${typeof value === 'object' ? JSON.stringify(value) : value}</span>
          </div>
        `).join('')}
      </div>
    </div>
    
    <footer>
      <p>Generated by Vayu Pre API Automation Framework</p>
    </footer>
  </div>
  
  <script>
    // Auto-expand failed tests
    document.querySelectorAll('.test-item').forEach(item => {
      if (item.querySelector('.status-badge.fail')) {
        item.classList.add('expanded');
      }
    });
    
    // Copy curl command to clipboard
    function copyCurl(btn, index) {
      const curlElement = document.getElementById('curl-' + index);
      const curlText = curlElement.textContent;
      
      navigator.clipboard.writeText(curlText).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    }
  </script>
</body>
</html>
  `;

  fs.writeFileSync(reportPath, html);
  return reportPath;
}

function escapeHtml(text) {
  if (typeof text !== 'string') {
    text = String(text || '');
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = { generateReport };
