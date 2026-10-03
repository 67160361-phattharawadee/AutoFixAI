const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

const dbDir = process.env.AUTOFIX_DB_DIR || path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'autofix.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);
db.configure('busyTimeout', 5000);

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onRun(err) {
    if (err) return reject(err);
    resolve({ id: this.lastID, changes: this.changes });
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows);
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) return reject(err);
    resolve(row || null);
  });
});

function withTransaction(work) {
  return new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(dbPath);
    connection.configure('busyTimeout', 5000);

    const runTx = (sql, params = []) => new Promise((runResolve, runReject) => {
      connection.run(sql, params, function onRun(error) {
        if (error) return runReject(error);
        return runResolve({ id: this.lastID, changes: this.changes });
      });
    });
    const getTx = (sql, params = []) => new Promise((getResolve, getReject) => {
      connection.get(sql, params, (error, row) => {
        if (error) return getReject(error);
        return getResolve(row || null);
      });
    });
    const close = (callback) => connection.close(() => callback());

    connection.run('BEGIN IMMEDIATE', async (beginError) => {
      if (beginError) return close(() => reject(beginError));
      try {
        const result = await work({ run: runTx, get: getTx });
        await runTx('COMMIT');
        return close(() => resolve(result));
      } catch (error) {
        try {
          await runTx('ROLLBACK');
        } catch {
          // Preserve the original transaction error.
        }
        return close(() => reject(error));
      }
    });
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

async function findUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  return get('SELECT * FROM users WHERE lower(email) = ?', [normalized]);
}

async function createUser(user) {
  const name = String(user.name || '').trim();
  const email = String(user.email || '').trim().toLowerCase();
  const password = String(user.password || '');
  const phone = String(user.phone || '').trim();

  if (!name || !email || !password) {
    throw new Error('Name, email, and password are required');
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error('Email already registered');
  }

  const result = await run(
    'INSERT INTO users (name, email, password_hash, phone) VALUES (?, ?, ?, ?)',
    [name, email, hashPassword(password), phone]
  );

  return {
    id: result.id,
    name,
    email,
    phone,
    role: 'customer',
    created_at: new Date().toISOString()
  };
}

async function verifyUser(email, password) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const storedHash = String(user.password_hash || '');
  let valid = false;

  if (storedHash.startsWith('scrypt$')) {
    const [, salt, hash] = storedHash.split('$');
    const actual = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hash, 'hex');
    valid = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } else {
    const legacyHash = crypto.createHash('sha256').update(String(password)).digest('hex');
    valid = storedHash === legacyHash;
    if (valid) await run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(password), user.id]);
  }

  if (!valid) return null;

  const { password_hash, ...safeUser } = user;
  return safeUser;
}

async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      engine TEXT,
      mileage INTEGER DEFAULT 0,
      user_id TEXT DEFAULT 'demo-user'
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      name TEXT NOT NULL,
      part_number TEXT,
      category TEXT,
      price REAL NOT NULL,
      rating REAL DEFAULT 0,
      reviews INTEGER DEFAULT 0,
      image TEXT,
      stock INTEGER DEFAULT 1,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      fit_json TEXT DEFAULT '[]'
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS compatibilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      brand TEXT,
      model TEXT,
      year_min INTEGER,
      year_max INTEGER,
      engine TEXT,
      UNIQUE(product_id, brand, model, year_min, year_max, engine)
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total REAL NOT NULL,
      user_name TEXT DEFAULT 'demo',
      items_json TEXT NOT NULL,
      user_id TEXT DEFAULT 'demo-user',
      status TEXT NOT NULL DEFAULT 'pending_payment',
      shipping_json TEXT NOT NULL DEFAULT '{}',
      shipping_fee_thb INTEGER NOT NULL DEFAULT 0,
      tax_policy TEXT NOT NULL DEFAULT 'legacy_unverified',
      stripe_session_id TEXT,
      payment_intent_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const orderColumns = await all('PRAGMA table_info(orders)');
  if (!orderColumns.some((column) => column.name === 'user_id')) await run("ALTER TABLE orders ADD COLUMN user_id TEXT DEFAULT 'demo-user'");
  if (!orderColumns.some((column) => column.name === 'status')) await run("ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'legacy_unverified'");
  if (!orderColumns.some((column) => column.name === 'shipping_json')) await run("ALTER TABLE orders ADD COLUMN shipping_json TEXT NOT NULL DEFAULT '{}'");
  if (!orderColumns.some((column) => column.name === 'shipping_fee_thb')) await run('ALTER TABLE orders ADD COLUMN shipping_fee_thb INTEGER NOT NULL DEFAULT 0');
  if (!orderColumns.some((column) => column.name === 'tax_policy')) await run("ALTER TABLE orders ADD COLUMN tax_policy TEXT NOT NULL DEFAULT 'legacy_unverified'");
  if (!orderColumns.some((column) => column.name === 'stripe_session_id')) await run('ALTER TABLE orders ADD COLUMN stripe_session_id TEXT');
  if (!orderColumns.some((column) => column.name === 'payment_intent_id')) await run('ALTER TABLE orders ADD COLUMN payment_intent_id TEXT');

  const userColumns = await all('PRAGMA table_info(users)');
  if (!userColumns.some((column) => column.name === 'role')) await run("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'customer'");

  const productColumns = await all('PRAGMA table_info(products)');
  if (!productColumns.some((column) => column.name === 'stock_quantity')) {
    await run('ALTER TABLE products ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0');
  }
  await run('CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC)');
  await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id) WHERE stripe_session_id IS NOT NULL');

  await run(`
    CREATE TABLE IF NOT EXISTS maintenance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      vehicle_id INTEGER,
      title TEXT NOT NULL,
      service_date TEXT NOT NULL,
      mileage INTEGER,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS store_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (process.env.NODE_ENV !== 'production') {
    const demoUser = await findUserByEmail('demo@autofix.com');
    if (!demoUser) {
      await createUser({
        name: 'AutoFix Demo',
        email: 'demo@autofix.com',
        password: 'AutoFix123!',
        phone: '0999999999'
      });
    }
  }

  const products = await all('SELECT id FROM products');
  if (!products.length) {
    const seedProducts = [
      {
        brand: 'Bosch',
        name: 'Bosch QuietCast Premium Brake Pad BP1290',
        part_number: 'BP1290',
        category: 'ระบบเบรก',
        price: 1290,
        rating: 4.8,
        reviews: 128,
        image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=900&q=85',
        stock: 1,
        fit_json: JSON.stringify([{ brand: 'Toyota', model: 'Yaris', min: 2019, max: 2022, engine: '1.2L' }])
      },
      {
        brand: 'Brembo',
        name: 'Brembo Prime Brake Disc',
        part_number: '09.A921.11',
        category: 'ระบบเบรก',
        price: 2450,
        rating: 4.7,
        reviews: 86,
        image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=85',
        stock: 1,
        fit_json: JSON.stringify([{ brand: 'Toyota', model: 'Yaris', min: 2019, max: 2022 }])
      },
      {
        brand: 'NGK',
        name: 'NGK Laser Iridium Spark Plug',
        part_number: 'IFR6T11',
        category: 'ระบบเครื่องยนต์',
        price: 890,
        rating: 4.9,
        reviews: 214,
        image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=900&q=85',
        stock: 1,
        fit_json: JSON.stringify([{ brand: 'Toyota', model: 'Yaris', min: 2018, max: 2022, engine: '1.2L' }, { brand: 'Honda', model: 'Civic', min: 2019, max: 2022, engine: '1.5 Turbo' }])
      },
      {
        brand: 'DENSO',
        name: 'DENSO Cabin Air Filter',
        part_number: 'DCC1009',
        category: 'ระบบแอร์',
        price: 540,
        rating: 4.6,
        reviews: 97,
        image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=85',
        stock: 1,
        fit_json: JSON.stringify([{ brand: 'Toyota', model: 'Yaris', min: 2018, max: 2023 }])
      }
    ];

    for (const product of seedProducts) {
      await run(
        `INSERT INTO products (brand, name, part_number, category, price, rating, reviews, image, stock, fit_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [product.brand, product.name, product.part_number, product.category, product.price, product.rating, product.reviews, product.image, product.stock, product.fit_json]
      );
    }
  }
}

async function bootstrapAdmin(emailValue, passwordValue) {
  const email = String(emailValue || '').trim().toLowerCase();
  const password = String(passwordValue || '');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
    throw new Error('ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters are required');
  }

  const user = await findUserByEmail(email);
  if (user) {
    await run("UPDATE users SET role = 'customer' WHERE role = 'admin' AND lower(email) <> ?", [email]);
    await run("UPDATE users SET name = 'Store Administrator', password_hash = ?, role = 'admin' WHERE id = ?", [hashPassword(password), user.id]);
    return { id: user.id, name: 'Store Administrator', email, role: 'admin' };
  }

  await run("UPDATE users SET role = 'customer' WHERE role = 'admin'");
  const result = await run(
    "INSERT INTO users (name, email, password_hash, phone, role) VALUES (?, ?, ?, '', 'admin')",
    ['Store Administrator', email, hashPassword(password)]
  );
  return { id: result.id, name: 'Store Administrator', email, role: 'admin' };
}

async function listProducts(filterText = '') {
  const query = filterText ? `%${String(filterText).trim()}%` : '%';
  const rows = await all(
    `SELECT * FROM products WHERE lower(name) LIKE lower(?) OR lower(category) LIKE lower(?) ORDER BY rating DESC, id ASC`,
    [query, query]
  );
  return rows.map((row) => ({
    id: row.id,
    brand: row.brand,
    name: row.name,
    partNumber: row.part_number,
    category: row.category,
    price: row.price,
    rating: row.rating,
    reviews: row.reviews,
    image: row.image,
    stock: Number(row.stock_quantity) > 0,
    stockQuantity: Number(row.stock_quantity || 0),
    fit: JSON.parse(row.fit_json || '[]')
  }));
}

async function getProductById(id) {
  const row = await get('SELECT * FROM products WHERE id = ?', [id]);
  if (!row) return null;
  return {
    id: row.id,
    brand: row.brand,
    name: row.name,
    partNumber: row.part_number,
    category: row.category,
    price: row.price,
    rating: row.rating,
    reviews: row.reviews,
    image: row.image,
    stock: Number(row.stock_quantity) > 0,
    stockQuantity: Number(row.stock_quantity || 0),
    fit: JSON.parse(row.fit_json || '[]')
  };
}

async function listVehicles(userId = 'demo-user') {
  return all('SELECT * FROM vehicles WHERE user_id = ? ORDER BY id DESC', [String(userId)]);
}

async function createVehicle(vehicle, userId = 'demo-user') {
  const record = {
    brand: vehicle.brand || 'Toyota',
    model: vehicle.model || 'Yaris',
    year: Number(vehicle.year || 2020),
    engine: vehicle.engine || '1.2L',
    mileage: Number(vehicle.mileage || 0),
    user_id: String(userId)
  };

  if (!record.brand || !record.model || !Number.isInteger(record.year) || record.year < 1980 || record.year > new Date().getFullYear() + 1) {
    throw new Error('Brand, model, and a valid year are required');
  }

  const result = await run(
    'INSERT INTO vehicles (brand, model, year, engine, mileage, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    [record.brand, record.model, record.year, record.engine, record.mileage, record.user_id]
  );

  return { id: result.id, ...record };
}

async function updateVehicle(id, vehicle, userId = 'demo-user') {
  const record = {
    brand: String(vehicle.brand || '').trim(),
    model: String(vehicle.model || '').trim(),
    year: Number(vehicle.year),
    engine: String(vehicle.engine || '').trim(),
    mileage: Number(vehicle.mileage || 0)
  };
  if (!record.brand || !record.model || !Number.isInteger(record.year) || record.year < 1980 || record.year > new Date().getFullYear() + 1 || !Number.isFinite(record.mileage) || record.mileage < 0) {
    throw new Error('Brand, model, year, and mileage must be valid');
  }

  const result = await run(
    'UPDATE vehicles SET brand = ?, model = ?, year = ?, engine = ?, mileage = ? WHERE id = ? AND user_id = ?',
    [record.brand, record.model, record.year, record.engine, record.mileage, Number(id), String(userId)]
  );
  return result.changes ? { id: Number(id), ...record, user_id: String(userId) } : null;
}

async function deleteVehicle(id, userId = 'demo-user') {
  const result = await run('DELETE FROM vehicles WHERE id = ? AND user_id = ?', [Number(id), String(userId)]);
  return result.changes > 0;
}

async function updateProductStock(id, quantity) {
  const stockQuantity = Number(quantity);
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1000000) {
    throw new Error('Stock quantity must be an integer between 0 and 1,000,000');
  }
  const result = await run('UPDATE products SET stock_quantity = ? WHERE id = ?', [stockQuantity, Number(id)]);
  return result.changes ? getProductById(Number(id)) : null;
}

async function saveProduct(product, id = null) {
  const brand = String(product.brand || '').trim();
  const name = String(product.name || '').trim();
  const partNumber = String(product.partNumber || '').trim();
  const category = String(product.category || '').trim();
  const image = String(product.image || '').trim();
  const price = Number(product.price);
  const stockQuantity = Number(product.stockQuantity || 0);
  const fit = Array.isArray(product.fit) ? product.fit : [];
  let parsedImage;
  try { parsedImage = new URL(image); } catch { throw new Error('กรุณาใส่ URL รูปสินค้าที่ถูกต้อง'); }

  if (!brand || brand.length > 80 || !name || name.length > 180 || !partNumber || partNumber.length > 80 || !category || category.length > 80) {
    throw new Error('กรุณากรอกยี่ห้อ ชื่อสินค้า Part Number และหมวดหมู่ให้ครบ');
  }
  if (!['http:', 'https:'].includes(parsedImage.protocol) || !Number.isFinite(price) || price <= 0 || price > 99999999 || Math.round(price * 100) !== price * 100) {
    throw new Error('ราคา หรือ URL รูปสินค้าไม่ถูกต้อง');
  }
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1000000) {
    throw new Error('จำนวนสต็อกต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 1,000,000');
  }

  const fitJson = JSON.stringify(fit);
  if (id == null) {
    const result = await run(
      'INSERT INTO products (brand, name, part_number, category, price, image, stock, stock_quantity, fit_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [brand, name, partNumber, category, price, image, stockQuantity > 0 ? 1 : 0, stockQuantity, fitJson]
    );
    return getProductById(result.id);
  }

  const result = await run(
    'UPDATE products SET brand = ?, name = ?, part_number = ?, category = ?, price = ?, image = ?, stock = ?, stock_quantity = ?, fit_json = ? WHERE id = ?',
    [brand, name, partNumber, category, price, image, stockQuantity > 0 ? 1 : 0, stockQuantity, fitJson, Number(id)]
  );
  return result.changes ? getProductById(Number(id)) : null;
}

async function getStoreSettings() {
  const rows = await all('SELECT setting_key, setting_value FROM store_settings');
  const values = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
  const configuredShipping = values.shipping_fee_thb ?? process.env.STORE_SHIPPING_FEE_THB;
  const configuredTaxPolicy = values.tax_policy ?? process.env.STORE_TAX_POLICY;
  const shippingFeeThb = configuredShipping == null || configuredShipping === '' ? null : Number(configuredShipping);
  const taxPolicy = configuredTaxPolicy || null;
  return {
    storeName: String(process.env.STORE_NAME || '').trim() || 'AutoFix',
    shippingFeeThb,
    taxPolicy,
    configured: Number.isInteger(shippingFeeThb) && ['included', 'not_applicable'].includes(taxPolicy)
  };
}

async function saveStoreSettings(settings) {
  const shippingFeeThb = Number(settings.shippingFeeThb);
  const taxPolicy = String(settings.taxPolicy || '');
  if (!Number.isInteger(shippingFeeThb) || shippingFeeThb < 0 || shippingFeeThb > 200000) {
    throw new Error('ค่าส่งต้องเป็นจำนวนเงินบาทเต็ม ตั้งแต่ 0 ถึง 200,000 บาท');
  }
  if (!['included', 'not_applicable'].includes(taxPolicy)) {
    throw new Error('กรุณายืนยันนโยบายภาษีของร้าน');
  }
  if (settings.taxPolicyConfirmed !== true) throw new Error('กรุณายืนยันว่าตรวจสอบนโยบายภาษีของร้านแล้ว');
  await run("INSERT INTO store_settings (setting_key, setting_value) VALUES ('shipping_fee_thb', ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP", [String(shippingFeeThb)]);
  await run("INSERT INTO store_settings (setting_key, setting_value) VALUES ('tax_policy', ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP", [taxPolicy]);
  return getStoreSettings();
}

async function getUserRole(userId) {
  const user = await get('SELECT role FROM users WHERE id = ?', [Number(userId)]);
  return user?.role || null;
}

function orderFromRow(row) {
  return {
    id: row.id,
    total: row.total,
    userName: row.user_name,
    userId: row.user_id,
    items: JSON.parse(row.items_json || '[]'),
    shipping: JSON.parse(row.shipping_json || '{}'),
    shippingFeeThb: Number(row.shipping_fee_thb || 0),
    taxPolicy: row.tax_policy || 'legacy_unverified',
    status: row.status,
    createdAt: row.created_at,
    paymentIntentId: row.payment_intent_id || null
  };
}

async function reserveOrder(order, userId, userName) {
  if (!Array.isArray(order.items) || !order.items.length) throw new Error('รถเข็นยังว่าง');
  const storeSettings = await getStoreSettings();
  if (!storeSettings.configured) throw new Error('ร้านยังไม่ได้ตั้งค่านโยบายค่าส่งและภาษี');
  const shipping = {
    name: String(order.shipping?.name || '').trim(),
    email: String(order.shipping?.email || '').trim().toLowerCase(),
    phone: String(order.shipping?.phone || '').trim(),
    address: String(order.shipping?.address || '').trim(),
    province: String(order.shipping?.province || '').trim(),
    city: String(order.shipping?.city || '').trim(),
    postalCode: String(order.shipping?.postalCode || '').trim()
  };
  const phoneDigits = shipping.phone.replace(/\D/g, '');
  if (!shipping.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipping.email) || phoneDigits.length < 9 || phoneDigits.length > 15 || shipping.address.length < 5 || !shipping.province || !shipping.city || !/^\d{5}$/.test(shipping.postalCode)) {
    throw new Error('กรุณากรอกชื่อ อีเมล เบอร์โทร และที่อยู่จัดส่งให้ครบถ้วน');
  }

  const quantities = new Map();
  for (const item of order.items) {
    const productId = Number(item.id);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      throw new Error('รายการสินค้าในรถเข็นไม่ถูกต้อง');
    }
    const combinedQuantity = (quantities.get(productId) || 0) + quantity;
    if (combinedQuantity > 50) throw new Error('สั่งสินค้าแต่ละรายการได้ไม่เกิน 50 ชิ้น');
    quantities.set(productId, combinedQuantity);
  }

  return withTransaction(async ({ run: runTx, get: getTx }) => {
    const items = [];
    for (const [productId, quantity] of quantities) {
      const product = await getTx('SELECT id, name, price, stock_quantity FROM products WHERE id = ?', [productId]);
      if (!product || Number(product.stock_quantity) < quantity) {
        throw new Error(`${product?.name || 'สินค้า'} มีสต็อกไม่พอ`);
      }
      const changed = await runTx('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?', [quantity, productId, quantity]);
      if (!changed.changes) throw new Error(`${product.name} มีสต็อกไม่พอ`);
      items.push({ id: product.id, name: product.name, price: Number(product.price), quantity });
    }

    const shippingFeeThb = storeSettings.shippingFeeThb;
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0) + shippingFeeThb;
    const result = await runTx(
      'INSERT INTO orders (total, user_name, items_json, user_id, status, shipping_json, shipping_fee_thb, tax_policy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [total, String(userName), JSON.stringify(items), String(userId), 'pending_payment', JSON.stringify(shipping), shippingFeeThb, storeSettings.taxPolicy]
    );
    return { id: result.id, total, userName, userId: String(userId), items, shipping, shippingFeeThb, taxPolicy: storeSettings.taxPolicy, status: 'pending_payment' };
  });
}

async function attachStripeSession(orderId, userId, sessionId) {
  const result = await run(
    "UPDATE orders SET stripe_session_id = ? WHERE id = ? AND user_id = ? AND status = 'pending_payment'",
    [sessionId, Number(orderId), String(userId)]
  );
  return result.changes > 0;
}

async function getOrderForUser(orderId, userId) {
  const row = await get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [Number(orderId), String(userId)]);
  return row ? { ...orderFromRow(row), stripeSessionId: row.stripe_session_id || null } : null;
}

async function listOrders(userId) {
  const rows = await all('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', [String(userId)]);
  return rows.map(orderFromRow);
}

async function listAdminOrders() {
  const rows = await all('SELECT * FROM orders ORDER BY id DESC LIMIT 500');
  return rows.map(orderFromRow);
}

async function markOrderPaid(sessionId, paymentIntentId) {
  const result = await run(
    "UPDATE orders SET status = 'paid', payment_intent_id = ? WHERE stripe_session_id = ? AND status = 'pending_payment'",
    [paymentIntentId || null, String(sessionId)]
  );
  return result.changes > 0;
}

async function releaseOrderBySession(sessionId, finalStatus = 'expired') {
  return withTransaction(async ({ run: runTx, get: getTx }) => {
    const row = await getTx("SELECT id, items_json FROM orders WHERE stripe_session_id = ? AND status = 'pending_payment'", [String(sessionId)]);
    if (!row) return false;
    for (const item of JSON.parse(row.items_json || '[]')) {
      await runTx('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [Number(item.quantity), Number(item.id)]);
    }
    await runTx('UPDATE orders SET status = ? WHERE id = ?', [finalStatus, row.id]);
    return true;
  });
}

async function markOrderCancelled(orderId, userId) {
  return withTransaction(async ({ run: runTx, get: getTx }) => {
    const row = await getTx("SELECT id, items_json FROM orders WHERE id = ? AND user_id = ? AND status = 'pending_payment'", [Number(orderId), String(userId)]);
    if (!row) return false;
    for (const item of JSON.parse(row.items_json || '[]')) {
      await runTx('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [Number(item.quantity), Number(item.id)]);
    }
    await runTx("UPDATE orders SET status = 'cancelled' WHERE id = ?", [row.id]);
    return true;
  });
}

async function updateOrderStatus(orderId, status) {
  const transitions = { paid: 'processing', processing: 'shipped', shipped: 'completed' };
  const row = await get('SELECT status FROM orders WHERE id = ?', [Number(orderId)]);
  if (!row) return null;
  if (transitions[row.status] !== status) throw new Error('Invalid order status transition');
  const result = await run('UPDATE orders SET status = ? WHERE id = ? AND status = ?', [status, Number(orderId), row.status]);
  return result.changes > 0 ? getOrderForAdmin(orderId) : null;
}

async function getOrderForAdmin(orderId) {
  const row = await get('SELECT * FROM orders WHERE id = ?', [Number(orderId)]);
  return row ? orderFromRow(row) : null;
}

async function listMaintenance(userId) {
  return all(
    'SELECT id, vehicle_id AS vehicleId, title, service_date AS serviceDate, mileage, notes, created_at AS createdAt FROM maintenance_records WHERE user_id = ? ORDER BY service_date DESC, id DESC',
    [String(userId)]
  );
}

async function createMaintenance(record, userId) {
  const title = String(record.title || '').trim();
  const serviceDate = String(record.serviceDate || new Date().toISOString().slice(0, 10));
  const mileage = record.mileage === '' || record.mileage == null ? null : Number(record.mileage);
  const vehicleId = record.vehicleId == null ? null : Number(record.vehicleId);
  if (!title || title.length > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) || (mileage != null && (!Number.isInteger(mileage) || mileage < 0))) {
    throw new Error('Title, service date, or mileage is invalid');
  }
  if (vehicleId != null && !await get('SELECT id FROM vehicles WHERE id = ? AND user_id = ?', [vehicleId, String(userId)])) {
    throw new Error('Vehicle not found');
  }

  const notes = String(record.notes || '').trim().slice(0, 1000);
  const result = await run(
    'INSERT INTO maintenance_records (user_id, vehicle_id, title, service_date, mileage, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [String(userId), vehicleId, title, serviceDate, mileage, notes]
  );
  return { id: result.id, vehicleId, title, serviceDate, mileage, notes, createdAt: new Date().toISOString() };
}

function evaluateCompatibility(product, vehicle) {
  if (!vehicle) {
    return { status: 'check', score: 58, reasons: ['กรุณาเพิ่มรถของคุณก่อนตรวจสอบ', 'AI จะแนะนำให้ตรวจสอบ Part Number ก่อนซื้อ'] };
  }

  const same = Array.isArray(product.fit) && product.fit.some((fit) =>
    fit.brand === vehicle.brand &&
    fit.model === vehicle.model &&
    Number(vehicle.year) >= fit.min &&
    Number(vehicle.year) <= fit.max &&
    (!fit.engine || fit.engine === vehicle.engine)
  );

  const partial = Array.isArray(product.fit) && product.fit.some((fit) =>
    fit.brand === vehicle.brand && fit.model === vehicle.model
  );

  return {
    status: same ? 'compatible' : partial ? 'check' : 'incompatible',
    score: same ? 98 : partial ? 67 : 12,
    reasons: same
      ? ['รุ่นรถตรงกัน', 'ปีรถอยู่ในช่วงที่รองรับ', 'ประเภทเครื่องยนต์ตรงกัน', 'ตำแหน่งอะไหล่ตรงกัน']
      : partial
        ? ['รุ่นรถตรงกัน แต่ควรตรวจสอบรหัสเครื่องยนต์', 'ปีรถอาจอยู่ในช่วงที่แนะนำแต่ควรเช็ก part number']
        : ['ไม่พบข้อมูลรองรับรถรุ่นนี้', 'กรุณาตรวจสอบ Part Number กับผู้จำหน่าย']
  };
}

module.exports = {
  db,
  initializeDatabase,
  listProducts,
  getProductById,
  updateProductStock,
  saveProduct,
  getStoreSettings,
  saveStoreSettings,
  getUserRole,
  listVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  reserveOrder,
  attachStripeSession,
  getOrderForUser,
  listOrders,
  listAdminOrders,
  markOrderPaid,
  releaseOrderBySession,
  markOrderCancelled,
  updateOrderStatus,
  listMaintenance,
  createMaintenance,
  evaluateCompatibility,
  findUserByEmail,
  createUser,
  verifyUser,
  bootstrapAdmin
};
