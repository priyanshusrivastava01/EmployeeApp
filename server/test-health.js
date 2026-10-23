/**
 * Verification test for Stage 1A: Health Check Endpoint
 */
const http = require('http');
const { server } = require('./src/index');

const PORT = process.env.PORT || 5000;

function runHealthCheck() {
  console.log('[Test] Sending GET request to http://localhost:' + PORT + '/api/health ...');

  http.get(`http://localhost:${PORT}/api/health`, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`[Test] HTTP Status Code: ${res.statusCode}`);
      console.log(`[Test] Response Body: ${data}`);

      try {
        const json = JSON.parse(data);
        if (res.statusCode === 200 && json.status === 'ok') {
          console.log('[Test] PASSED: Health check returned status 200 and status: "ok"');
          server.close(() => {
            console.log('[Test] Server closed successfully.');
            process.exit(0);
          });
        } else {
          console.error('[Test] FAILED: Unexpected response format.');
          server.close(() => process.exit(1));
        }
      } catch (err) {
        console.error('[Test] FAILED: Response was not valid JSON.', err);
        server.close(() => process.exit(1));
      }
    });
  }).on('error', (err) => {
    console.error('[Test] FAILED: Could not connect to server:', err.message);
    server.close(() => process.exit(1));
  });
}

// Give server 500ms to bind, then run check
setTimeout(runHealthCheck, 500);
