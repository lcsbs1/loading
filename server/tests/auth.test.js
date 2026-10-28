'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spa-auth-'));
const usersFile = path.join(tmpDir, 'users.json');
process.env.JWT_SECRET = 'test-secret-spa-auth';
process.env.TOKEN_EXPIRES_IN = '3600';
process.env.USERS_FILE = usersFile;
process.env.DATA_DIR = tmpDir;

const { handleApi } = require('../index');

function request(method, urlPath, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      handleApi(req, res).catch(reject);
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: urlPath,
          method,
          headers: {
            ...(payload
              ? {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(payload),
                }
              : {}),
            ...headers,
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            server.close();
            const text = Buffer.concat(chunks).toString('utf8');
            let json = null;
            try {
              json = text ? JSON.parse(text) : null;
            } catch {
              json = text;
            }
            resolve({ status: res.statusCode, body: json });
          });
        }
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

async function run() {
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✔ ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`✖ ${name}`);
      console.error(err);
    }
  }

  const email = `user_${Date.now()}@example.com`;

  await test('POST /api/auth/register → 201', async () => {
    const res = await request('POST', '/api/auth/register', {
      body: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email,
        password: 'secret123',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.user.id);
    assert.strictEqual(res.body.user.email, email);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.token, res.body.accessToken);
  });

  await test('POST /api/auth/register email duplicado → 409', async () => {
    const res = await request('POST', '/api/auth/register', {
      body: {
        firstName: 'Ada',
        lastName: 'Two',
        email: email.toUpperCase(),
        password: 'secret123',
      },
    });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.error.code, 'EMAIL_TAKEN');
  });

  await test('POST /api/auth/login → 200', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: { email, password: 'secret123' },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    global.__authToken = res.body.token;
  });

  await test('POST /api/auth/login → 401', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: { email, password: 'wrong-password' },
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  await test('GET /api/auth/me → 200', async () => {
    const res = await request('GET', '/api/auth/me', {
      headers: { Authorization: `Bearer ${global.__authToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.email, email);
  });

  await test('GET /api/auth/me → 401', async () => {
    const res = await request('GET', '/api/auth/me');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  if (failed > 0) {
    console.error(`\n${failed} auth test(s) failed`);
    process.exit(1);
  }
  console.log('\n✨ Auth API tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
