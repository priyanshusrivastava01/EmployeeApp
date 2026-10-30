/**
 * Verification test for Stage 1A: Health Check Endpoint
 */
process.env.NODE_ENV = 'test';
const EventEmitter = require('events');
const { app } = require('./src/index');

function simulate(method, url) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method.toUpperCase();
    req.url = url;
    req.headers = { 'content-type': 'application/json', accept: 'application/json' };
    req.body = {};
    req.socket = { remoteAddress: '127.0.0.1' };
    req.ip = '127.0.0.1';
    req.connection = req.socket;

    const res = {
      statusCode: 200,
      headers: {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        resolve({ status: this.statusCode, body: data });
      },
      send(data) {
        let parsed = data;
        if (typeof data === 'string') {
          try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        }
        resolve({ status: this.statusCode, body: parsed });
      },
      end(data) {
        resolve({ status: this.statusCode, body: data });
      },
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      getHeader(k) { return this.headers[k.toLowerCase()]; }
    };

    app.handle(req, res);
  });
}

async function runHealthCheck() {
  console.log('[Test] Sending GET request to /api/health ...');
  try {
    const res = await simulate('GET', '/api/health');
    console.log(`[Test] HTTP Status Code: ${res.status}`);
    console.log(`[Test] Response Body:`, JSON.stringify(res.body));

    if (res.status === 200 && res.body.status === 'ok') {
      console.log('[Test] PASSED: Health check returned status 200 and status: "ok"');
      process.exit(0);
    } else {
      console.error('[Test] FAILED: Unexpected response format.');
      process.exit(1);
    }
  } catch (err) {
    console.error('[Test] FAILED:', err);
    process.exit(1);
  }
}

runHealthCheck();
