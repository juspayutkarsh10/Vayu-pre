const fs = require("fs");
const path = require("path");
const qs = require("querystring");

function generateCurl(method, url, headers, body) {
  let curl = `curl '${url}'`;
  
  if (method !== 'GET') {
    curl += ` \\\n  -X '${method}'`;
  }
  
  const contentType = headers?.['content-type'] || headers?.['Content-Type'] || '';
  const isFormEncoded = contentType.includes('application/x-www-form-urlencoded');
  
  if (headers && typeof headers === 'object') {
    for (const [key, value] of Object.entries(headers)) {
      curl += ` \\\n  -H '${key}: ${value}'`;
    }
  }
  
  if (body && Object.keys(body).length > 0 && method !== 'GET') {
    if (isFormEncoded) {
      // Convert to URL-encoded format
      const formData = {};
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'object' && value !== null) {
          formData[key] = JSON.stringify(value);
        } else {
          formData[key] = value;
        }
      }
      curl += ` \\\n  --data-raw '${qs.stringify(formData)}'`;
    } else {
      curl += ` \\\n  --data-raw '${JSON.stringify(body)}'`;
    }
  }
  
  return curl;
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

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function generateReport(portalResults, overallSummary) {
  const reportDir = path.join(__dirname, "..", "reports");
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, `test-report.html`);

  const portalTabs = portalResults.map((pr, idx) => `
    <button class="portal-tab ${idx === 0 ? 'active' : ''}" onclick="switchPortal('${pr.portal.id}', this)">
      <span class="portal-icon">${pr.portal.icon}</span>
      <span class="portal-name">${pr.portal.name}</span>
      <span class="portal-stats">
        <span class="stat-pass">${pr.summary.passed}</span>
        <span class="stat-sep">/</span>
        <span class="stat-total">${pr.summary.total}</span>
      </span>
    </button>
  `).join('');

  let globalIndex = 0;
  const portalContents = portalResults.map((pr, portalIdx) => {
    const results = pr.results;
    const summary = pr.summary;
    const portal = pr.portal;
    const flakyCount = results.filter(r => r.retries && r.retries.length > 0 && r.status === 'pass').length;
    
    const content = `
    <div class="portal-content ${portalIdx === 0 ? 'active' : ''}" id="portal-${portal.id}">
      <div class="portal-summary">
        <h2>${portal.icon} ${portal.name} Results</h2>
        <div class="summary-cards">
          <div class="card total clickable" onclick="filterTests('${portal.id}', 'all', this)">
            <h3>Total Tests</h3>
            <div class="value">${summary.total}</div>
          </div>
          <div class="card passed clickable" onclick="filterTests('${portal.id}', 'pass', this)">
            <h3>Passed</h3>
            <div class="value">${summary.passed}</div>
            <div class="progress-bar">
              <div class="fill" style="width: ${(summary.passed / summary.total * 100) || 0}%"></div>
            </div>
          </div>
          <div class="card failed clickable" onclick="filterTests('${portal.id}', 'fail', this)">
            <h3>Failed</h3>
            <div class="value">${summary.failed}</div>
          </div>
          <div class="card flaky clickable" onclick="filterTests('${portal.id}', 'flaky', this)">
            <h3>Flaky</h3>
            <div class="value">${flakyCount}</div>
          </div>
          <div class="card duration">
            <h3>Duration</h3>
            <div class="value">${formatDuration(summary.duration)}</div>
          </div>
        </div>
      </div>
      
      <div class="test-results">
        <h3>📋 Test Results</h3>
        ${results.map((result) => {
          const currentIndex = globalIndex++;
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
                <button class="copy-btn" onclick="event.stopPropagation(); copyCurl(this, ${currentIndex})">Copy</button>
                <div class="code-block"><pre id="curl-${currentIndex}">${escapeHtml(generateCurl(result.method, result.url, result.requestHeaders, result.requestBody))}</pre></div>
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
                ${result.retries.map((retry) => `
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
        <h3>💾 Stored Values (${portal.name} Context)</h3>
        <div class="values-grid">
          ${Object.entries(summary.storedValues || {}).map(([key, value]) => `
            <div class="value-item">
              <span class="key">${key}</span>
              <span class="val">${typeof value === 'object' ? JSON.stringify(value) : value}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
    `;
    
    return content;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Test Report - ${new Date().toLocaleString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #e4e4e4;
      padding: 20px;
    }
    
    .container { max-width: 1400px; margin: 0 auto; }
    
    header {
      text-align: center;
      padding: 30px 0;
      margin-bottom: 20px;
      border-bottom: 2px solid #0f3460;
    }
    
    header h1 {
      font-size: 2.5rem;
      background: linear-gradient(90deg, #00d9ff, #00ff88);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    
    header .timestamp { color: #888; font-size: 0.9rem; }
    
    .overall-summary {
      display: flex;
      justify-content: center;
      gap: 30px;
      padding: 20px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 12px;
      margin-bottom: 25px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .overall-stat { text-align: center; }
    .overall-stat .label { font-size: 0.8rem; color: #888; text-transform: uppercase; letter-spacing: 1px; }
    .overall-stat .value { font-size: 1.5rem; font-weight: bold; margin-top: 5px; }
    .overall-stat.portals .value { color: #00d9ff; }
    .overall-stat.total .value { color: #a8dadc; }
    .overall-stat.passed .value { color: #00ff88; }
    .overall-stat.failed .value { color: #ff6b6b; }
    .overall-stat.duration .value { color: #ffd93d; }
    
    .portal-tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 30px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .portal-tab {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 15px 25px;
      background: transparent;
      border: 2px solid transparent;
      border-radius: 10px;
      color: #888;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 1rem;
    }
    
    .portal-tab:hover { background: rgba(255, 255, 255, 0.05); color: #e4e4e4; }
    .portal-tab.active { background: rgba(0, 217, 255, 0.1); border-color: #00d9ff; color: #00d9ff; }
    .portal-icon { font-size: 1.5rem; }
    .portal-name { font-weight: 600; }
    .portal-stats { display: flex; gap: 4px; font-size: 0.9rem; padding: 4px 10px; background: rgba(0, 0, 0, 0.2); border-radius: 15px; }
    .stat-pass { color: #00ff88; font-weight: bold; }
    .stat-sep { color: #666; }
    .stat-total { color: #888; }
    
    .portal-content { display: none; }
    .portal-content.active { display: block; }
    
    .portal-summary h2 { font-size: 1.5rem; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #0f3460; }
    
    .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 30px; }
    
    .card {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: transform 0.3s ease;
    }
    
    .card:hover { transform: translateY(-3px); }
    .card.clickable { cursor: pointer; }
    .card.clickable:hover { border-color: rgba(255, 255, 255, 0.3); }
    .card.active-filter { border-color: #00d9ff; box-shadow: 0 0 15px rgba(0, 217, 255, 0.3); transform: translateY(-3px); }
    .card h3 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; }
    .card .value { font-size: 2.5rem; font-weight: bold; }
    .card.total .value { color: #00d9ff; }
    .card.passed .value { color: #00ff88; }
    .card.failed .value { color: #ff6b6b; }
    .card.flaky .value { color: #ffc107; }
    .card.duration .value { color: #ffd93d; font-size: 1.8rem; }
    
    .progress-bar { width: 100%; height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; overflow: hidden; margin-top: 10px; }
    .progress-bar .fill { height: 100%; background: linear-gradient(90deg, #00ff88, #00d9ff); border-radius: 3px; transition: width 0.5s ease; }
    
    .test-results { margin-top: 30px; }
    .test-results h3 { font-size: 1.3rem; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
    
    .test-item {
      background: rgba(255, 255, 255, 0.03);
      border-radius: 12px;
      margin-bottom: 12px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .test-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px;
      cursor: pointer;
      transition: background 0.3s ease;
    }
    
    .test-header:hover { background: rgba(255, 255, 255, 0.05); }
    .test-info { display: flex; align-items: center; gap: 12px; }
    
    .status-badge { padding: 5px 12px; border-radius: 15px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
    .status-badge.pass { background: rgba(0, 255, 136, 0.2); color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.3); }
    .status-badge.fail { background: rgba(255, 107, 107, 0.2); color: #ff6b6b; border: 1px solid rgba(255, 107, 107, 0.3); }
    .status-badge.flaky { background: rgba(255, 193, 7, 0.2); color: #ffc107; border: 1px solid rgba(255, 193, 7, 0.3); }
    
    .retry-count-badge { background: rgba(255, 165, 0, 0.15); color: #ffa500; padding: 3px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 600; border: 1px solid rgba(255, 165, 0, 0.3); }
    .test-item.has-retries { border-color: rgba(255, 193, 7, 0.3); }
    .test-item.has-retries .test-header { background: rgba(255, 193, 7, 0.05); }
    .test-name { font-weight: 600; font-size: 1rem; }
    .test-meta { display: flex; align-items: center; gap: 15px; color: #888; font-size: 0.8rem; }
    
    .method-badge { padding: 3px 8px; border-radius: 5px; font-size: 0.7rem; font-weight: bold; }
    .method-badge.GET { background: #2d6a4f; color: #95d5b2; }
    .method-badge.POST { background: #1d3557; color: #a8dadc; }
    .method-badge.PUT { background: #7f4f24; color: #dda15e; }
    .method-badge.PATCH { background: #5c4d7d; color: #b8b8d1; }
    .method-badge.DELETE { background: #6b2737; color: #ff8fa3; }
    
    .test-details { display: none; padding: 0 18px 18px; border-top: 1px solid rgba(255, 255, 255, 0.05); }
    .test-item.expanded .test-details { display: block; }
    .detail-section { margin-top: 18px; }
    .detail-section h4 { color: #00d9ff; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    
    .code-block {
      background: #0d1117;
      border-radius: 8px;
      padding: 12px;
      overflow-x: auto;
      font-family: 'Fira Code', 'Monaco', monospace;
      font-size: 0.8rem;
      line-height: 1.5;
      max-height: 350px;
      overflow-y: auto;
    }
    
    .code-block pre { white-space: pre-wrap; word-wrap: break-word; }
    .curl-section { position: relative; }
    
    .curl-section .copy-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0, 217, 255, 0.2);
      border: 1px solid rgba(0, 217, 255, 0.3);
      color: #00d9ff;
      padding: 5px 10px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 0.7rem;
      font-weight: bold;
      transition: all 0.3s ease;
    }
    
    .curl-section .copy-btn:hover { background: rgba(0, 217, 255, 0.4); }
    .curl-section .copy-btn.copied { background: rgba(0, 255, 136, 0.3); border-color: rgba(0, 255, 136, 0.5); color: #00ff88; }
    
    .error-message { background: rgba(255, 107, 107, 0.1); border-left: 4px solid #ff6b6b; padding: 12px; border-radius: 0 8px 8px 0; color: #ff8fa3; }
    
    .retries-section { border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 8px; padding: 12px; background: rgba(255, 165, 0, 0.05); }
    .retries-section h4 { color: #ffa500; margin-bottom: 12px; }
    .retry-item { background: rgba(0, 0, 0, 0.2); border-radius: 8px; padding: 12px; margin-bottom: 12px; border-left: 3px solid #ff6b6b; }
    .retry-item:last-child { margin-bottom: 0; }
    .retry-header { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .retry-badge { background: rgba(255, 165, 0, 0.2); color: #ffa500; padding: 3px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600; }
    .retry-status { color: #ff6b6b; font-size: 0.8rem; }
    .retry-body, .retry-response { margin-top: 8px; }
    .retry-body strong, .retry-response strong { display: block; margin-bottom: 4px; color: #888; font-size: 0.8rem; }
    .retry-body .code-block, .retry-response .code-block { max-height: 120px; }
    
    .url-display { background: rgba(0, 217, 255, 0.1); padding: 10px 12px; border-radius: 8px; font-family: monospace; word-break: break-all; color: #00d9ff; font-size: 0.85rem; }
    .expand-icon { font-size: 1.2rem; color: #888; transition: transform 0.3s ease; }
    .test-item.expanded .expand-icon { transform: rotate(180deg); }
    
    .stored-values { margin-top: 30px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; padding: 20px; border: 1px solid rgba(255, 255, 255, 0.05); }
    .stored-values h3 { margin-bottom: 15px; font-size: 1.2rem; }
    .values-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
    .value-item { background: rgba(0, 0, 0, 0.2); padding: 10px 12px; border-radius: 8px; display: flex; flex-direction: column; gap: 4px; }
    .value-item .key { color: #00ff88; font-size: 0.8rem; font-weight: 600; }
    .value-item .val { color: #888; font-family: monospace; font-size: 0.75rem; word-break: break-all; }
    
    footer { text-align: center; padding: 25px 0; color: #666; font-size: 0.8rem; margin-top: 30px; }
    
    @media (max-width: 768px) {
      .portal-tabs { flex-direction: column; }
      .test-header { flex-direction: column; align-items: flex-start; gap: 12px; }
      .test-meta { flex-wrap: wrap; }
      .overall-summary { flex-wrap: wrap; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚀 Vayu Pre API Test Report</h1>
      <p class="timestamp">Generated on ${new Date().toLocaleString()}</p>
    </header>
    
    <div class="overall-summary">
      <div class="overall-stat portals">
        <div class="label">Portals</div>
        <div class="value">${overallSummary.totalPortals}</div>
      </div>
      <div class="overall-stat total">
        <div class="label">Total Tests</div>
        <div class="value">${overallSummary.totalTests}</div>
      </div>
      <div class="overall-stat passed">
        <div class="label">Passed</div>
        <div class="value">${overallSummary.totalPassed}</div>
      </div>
      <div class="overall-stat failed">
        <div class="label">Failed</div>
        <div class="value">${overallSummary.totalFailed}</div>
      </div>
      <div class="overall-stat duration">
        <div class="label">Duration</div>
        <div class="value">${overallSummary.totalDuration}</div>
      </div>
    </div>
    
    <div class="portal-tabs">
      ${portalTabs}
    </div>
    
    ${portalContents}
    
    <footer>
      <p>Generated by Vayu Pre API Automation Framework</p>
    </footer>
  </div>
  
  <script>
    function switchPortal(portalId, btn) {
      document.querySelectorAll('.portal-tab').forEach(tab => tab.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.portal-content').forEach(content => content.classList.remove('active'));
      document.getElementById('portal-' + portalId).classList.add('active');
    }
    
    document.querySelectorAll('.test-item').forEach(item => {
      if (item.querySelector('.status-badge.fail')) {
        item.classList.add('expanded');
      }
    });
    
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
    
    function filterTests(portalId, filter, clickedCard) {
      const portalContent = document.getElementById('portal-' + portalId);
      const testItems = portalContent.querySelectorAll('.test-item');
      const cards = portalContent.querySelectorAll('.card.clickable');
      
      // Update active card styling
      cards.forEach(card => card.classList.remove('active-filter'));
      clickedCard.classList.add('active-filter');
      
      testItems.forEach(item => {
        const statusBadge = item.querySelector('.status-badge');
        const isPass = statusBadge.classList.contains('pass');
        const isFlaky = statusBadge.classList.contains('flaky');
        const isFail = statusBadge.classList.contains('fail');
        
        if (filter === 'all') {
          item.style.display = '';
        } else if (filter === 'pass' && (isPass || isFlaky)) {
          item.style.display = '';
        } else if (filter === 'fail' && isFail) {
          item.style.display = '';
        } else if (filter === 'flaky' && isFlaky) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(reportPath, html);
  return reportPath;
}

module.exports = { generateReport };
