const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { test } = require('node:test');

test('HTTP API protects admin inventory and fails closed when Stripe is not configured', async () => {
  const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autofix-api-test-'));
  const portProbe = net.createServer();
  portProbe.listen(0, '127.0.0.1');
  await once(portProbe, 'listening');
  const { port } = portProbe.address();
  await new Promise((resolve, reject) => portProbe.close((error) => error ? reject(error) : resolve()));

  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      AUTOFIX_DB_DIR: databaseDir,
      PORT: String(port),
      SESSION_SECRET: 'integration-test-session-secret-at-least-32-chars',
      ADMIN_EMAIL: 'owner@example.com',
      ADMIN_PASSWORD: 'A-private-integration-password-829!',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      STORE_SHIPPING_FEE_THB: '',
      STORE_TAX_POLICY: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  server.stdout.on('data', (chunk) => { logs = `${logs}${chunk}`.slice(-4000); });
  server.stderr.on('data', (chunk) => { logs = `${logs}${chunk}`.slice(-4000); });
  const baseUrl = `http://127.0.0.1:${port}`;
  let startupError;

  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (server.exitCode !== null) throw new Error(`Test server exited early: ${logs}`);
      try {
        const response = await fetch(`${baseUrl}/api/health`);
        if (response.ok) { ready = true; break; }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    assert.equal(ready, true, `Test server failed to start: ${logs}`);

    const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', password: 'A-private-integration-password-829!' })
    });
    assert.equal(adminLogin.status, 200);
    const admin = await adminLogin.json();
    assert.equal(admin.user.role, 'admin');
    const demoLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@autofix.com', password: 'AutoFix123!' })
    });
    assert.equal(demoLogin.status, 401);
    assert.equal((await fetch(baseUrl)).status, 200);
    assert.equal((await fetch(`${baseUrl}/app.js`)).status, 200);
    const adminHeaders = { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' };

    const initialStoreConfig = await (await fetch(`${baseUrl}/api/storefront/config`)).json();
    assert.equal(initialStoreConfig.configured, false);
    assert.equal(typeof initialStoreConfig.storeName, 'string');
    assert.ok(initialStoreConfig.storeName.length > 0);
    const storeSettingsResponse = await fetch(`${baseUrl}/api/admin/store-settings`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ shippingFeeThb: 50, taxPolicy: 'included', taxPolicyConfirmed: true })
    });
    assert.equal(storeSettingsResponse.status, 200);
    assert.equal((await storeSettingsResponse.json()).shippingFeeThb, 50);
    assert.equal((await (await fetch(`${baseUrl}/api/storefront/config`)).json()).configured, true);

    const productsResponse = await fetch(`${baseUrl}/api/admin/products`, { headers: adminHeaders });
    assert.equal(productsResponse.status, 200);
    const products = await productsResponse.json();
    assert.ok(products.length > 0);
    assert.equal(products.every((product) => product.stockQuantity === 0), true);

    const product = products[0];
    const stockResponse = await fetch(`${baseUrl}/api/admin/products/${product.id}/stock`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ stockQuantity: 3 })
    });
    assert.equal(stockResponse.status, 200);
    assert.equal((await stockResponse.json()).stockQuantity, 3);

    const newProductResponse = await fetch(`${baseUrl}/api/admin/products`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        brand: 'Test Brand',
        name: 'Test Shop Product',
        partNumber: 'TEST-100',
        category: 'Test Parts',
        image: 'https://example.com/test-product.jpg',
        price: 350,
        fit: []
      })
    });
    assert.equal(newProductResponse.status, 201);
    assert.equal((await newProductResponse.json()).stockQuantity, 0);

    const protectedSignup = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Impersonator', email: 'owner@example.com', password: 'Long-password-123!' })
    });
    assert.equal(protectedSignup.status, 403);

    const customerSignup = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Customer', email: 'customer@example.com', password: 'Customer-password-123!' })
    });
    assert.equal(customerSignup.status, 201);
    const customer = await customerSignup.json();
    const forbiddenAdmin = await fetch(`${baseUrl}/api/admin/products`, {
      headers: { Authorization: `Bearer ${customer.token}` }
    });
    assert.equal(forbiddenAdmin.status, 403);

    const checkoutResponse = await fetch(`${baseUrl}/api/orders/checkout`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        items: [{ id: product.id, quantity: 2 }],
        shipping: { name: 'Test Buyer', email: 'buyer@example.com', phone: '0812345678', address: '123 Test Road', city: 'Bangkok', province: 'Bangkok', postalCode: '10100' }
      })
    });
    assert.equal(checkoutResponse.status, 503);
    assert.match((await checkoutResponse.json()).message, /STRIPE_SECRET_KEY/);

    const orders = await (await fetch(`${baseUrl}/api/admin/orders`, { headers: adminHeaders })).json();
    assert.equal(orders.length, 0);
    assert.equal((await (await fetch(`${baseUrl}/api/products/${product.id}`)).json()).stockQuantity, 3);
  } catch (error) {
    startupError = error;
    throw error;
  } finally {
    server.kill('SIGTERM');
    await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))]);
    fs.rmSync(databaseDir, { recursive: true, force: true });
    if (startupError) console.error(logs);
  }
});