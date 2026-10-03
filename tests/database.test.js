const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const testDatabaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autofix-db-test-'));
process.env.AUTOFIX_DB_DIR = testDatabaseDir;

const database = require('../database');

before(async () => {
  await database.initializeDatabase();
});

after(async () => {
  await new Promise((resolve, reject) => database.db.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(testDatabaseDir, { recursive: true, force: true });
});

test('stock is reserved atomically, overselling rolls back, and cancellation restores it', async () => {
  const product = (await database.listProducts())[0];
  const user = await database.findUserByEmail('demo@autofix.com');
  await database.saveStoreSettings({ shippingFeeThb: 60, taxPolicy: 'included', taxPolicyConfirmed: true });
  const shipping = {
    name: 'Test Buyer',
    email: 'buyer@example.com',
    phone: '0812345678',
    address: '123 Test Road',
    city: 'Bangkok',
    province: 'Bangkok',
    postalCode: '10100'
  };
  let orderId;

  try {
    assert.equal(product.stockQuantity, 0);
    await assert.rejects(database.reserveOrder({ items: [{ id: product.id, quantity: 1 }], shipping }, user.id, shipping.name), /สต็อกไม่พอ/);

    await database.updateProductStock(product.id, 3);
    const order = await database.reserveOrder({ items: [{ id: product.id, quantity: 2 }], shipping }, user.id, shipping.name);
    orderId = order.id;
    assert.equal(order.shippingFeeThb, 60);
    assert.equal(order.total, product.price * 2 + 60);
    assert.equal((await database.getProductById(product.id)).stockQuantity, 1);

    await assert.rejects(database.reserveOrder({ items: [{ id: product.id, quantity: 2 }], shipping }, user.id, shipping.name), /สต็อกไม่พอ/);
    assert.equal((await database.getProductById(product.id)).stockQuantity, 1);

    assert.equal(await database.markOrderCancelled(order.id, user.id), true);
    assert.equal((await database.getProductById(product.id)).stockQuantity, 3);
    assert.equal(await database.markOrderCancelled(order.id, user.id), false);
  } finally {
    if (orderId) {
      await new Promise((resolve, reject) => database.db.run('DELETE FROM orders WHERE id = ?', [orderId], (error) => error ? reject(error) : resolve()));
    }
  }
});

test('admin bootstrap owns the configured account and protects public-role assignment', async () => {
  const admin = await database.bootstrapAdmin('owner@example.com', 'A-long-private-password-934!');
  assert.equal(admin.role, 'admin');
  assert.equal(await database.getUserRole(admin.id), 'admin');

  const customer = await database.createUser({
    name: 'Regular Customer',
    email: 'customer@example.com',
    password: 'Customer-password-934!'
  });
  assert.equal(await database.getUserRole(customer.id), 'customer');
});