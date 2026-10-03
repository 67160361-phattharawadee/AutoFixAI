require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');
const {
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
  createUser,
  verifyUser,
  bootstrapAdmin
} = require('./database');

const app = express();
const PORT = Number(process.env.PORT || 8123);
const sessionSecretPath = process.env.SESSION_SECRET_FILE || path.join(__dirname, 'data', 'session-secret');

function loadSessionSecret() {
  const configuredSecret = String(process.env.SESSION_SECRET || '');
  if (configuredSecret && configuredSecret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters');
  }
  if (configuredSecret) return configuredSecret;

  fs.mkdirSync(path.dirname(sessionSecretPath), { recursive: true });
  try {
    const savedSecret = fs.readFileSync(sessionSecretPath, 'utf8').trim();
    if (savedSecret.length >= 64) return savedSecret;
    throw new Error('Saved session secret is invalid');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const generatedSecret = crypto.randomBytes(48).toString('base64url');
  let descriptor;
  try {
    descriptor = fs.openSync(sessionSecretPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, generatedSecret, 'utf8');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    return fs.readFileSync(sessionSecretPath, 'utf8').trim();
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  return generatedSecret;
}

const SESSION_SECRET = loadSessionSecret();

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function issueToken(user) {
  const payload = `${user.id}.${Date.now() + 7 * 24 * 60 * 60 * 1000}`;
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function requireAuth(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const [userId, expiry, signature, extra] = token.split('.');
  if (!userId || !expiry || !signature || extra || Number(expiry) <= Date.now()) {
    return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' });
  }

  const payload = `${userId}.${expiry}`;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return res.status(401).json({ message: 'Session ไม่ถูกต้อง' });
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return res.status(401).json({ message: 'Session ไม่ถูกต้อง' });
  }

  req.user = { id: userId };
  return next();
}

function requireAdmin(req, res, next) {
  getUserRole(req.user.id).then((role) => {
    if (role !== 'admin') return res.status(403).json({ message: 'ต้องใช้บัญชีผู้ดูแลร้าน' });
    req.user.role = role;
    return next();
  }).catch(next);
}

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const error = new Error('ยังไม่ได้ตั้งค่า STRIPE_SECRET_KEY ใน .env');
    error.status = 503;
    throw error;
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    const error = new Error('ยังไม่ได้ตั้งค่า STRIPE_WEBHOOK_SECRET ใน .env');
    error.status = 503;
    throw error;
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), asyncRoute(async (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ message: 'ยังไม่ได้ตั้งค่า STRIPE_WEBHOOK_SECRET' });
  }
  const stripe = getStripeClient();
  const signature = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);

  if (event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;
    await markOrderPaid(session.id, session.payment_intent);
  } else if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') await markOrderPaid(session.id, session.payment_intent);
  } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object;
    await releaseOrderBySession(session.id, event.type === 'checkout.session.expired' ? 'expired' : 'payment_failed');
  }

  return res.json({ received: true });
}));

app.use(express.json({ limit: '7mb' }));

for (const file of ['style.css', 'app.js', 'ai-service.js']) {
  app.get(`/${file}`, (req, res) => res.sendFile(path.join(__dirname, file)));
}

const partMap = {
  brake: [
    { name: 'Brake Pad', type: 'ผ้าเบรก', confidence: 85 },
    { name: 'Brake Disc', type: 'จานเบรก', confidence: 65 },
    { name: 'Brake Caliper', type: 'คาลิปเปอร์เบรก', confidence: 40 }
  ],
  start: [
    { name: 'Spark Plug', type: 'หัวเทียน', confidence: 85 },
    { name: 'Ignition Coil', type: 'คอยล์จุดระเบิด', confidence: 72 },
    { name: 'Air Filter', type: 'กรองอากาศ', confidence: 41 }
  ],
  air: [
    { name: 'Cabin Air Filter', type: 'กรองแอร์', confidence: 88 },
    { name: 'AC Compressor', type: 'คอมเพรสเซอร์แอร์', confidence: 61 }
  ],
  default: [
    { name: 'Air Filter', type: 'กรองอากาศ', confidence: 78 },
    { name: 'Spark Plug', type: 'หัวเทียน', confidence: 55 }
  ]
};

function intentFromText(query = '') {
  const text = query.toLowerCase();
  if (/เบรก|เสียง|ผ้าเบรก|จานเบรก/.test(text)) return 'brake';
  if (/สตาร์ท|สั่น|กินน้ำมัน|เครื่องยนต์|ติด|ดับ/.test(text)) return 'start';
  if (/แอร์|เย็น/.test(text)) return 'air';
  return 'default';
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'autofix-api',
    database: 'sqlite',
    paymentsEnabled: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
  });
});

app.get('/api/storefront/config', asyncRoute(async (req, res) => {
  const storeSettings = await getStoreSettings();
  res.json({ ...storeSettings, paymentsEnabled: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) });
}));

app.get('/api/products', asyncRoute(async (req, res) => {
  const query = req.query.q || '';
  const products = await listProducts(query);
  res.json(products);
}));

app.get('/api/products/:id', asyncRoute(async (req, res) => {
  const product = await getProductById(Number(req.params.id));
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  return res.json(product);
}));

app.get('/api/vehicles', requireAuth, asyncRoute(async (req, res) => {
  const vehicles = await listVehicles(req.user.id);
  res.json(vehicles);
}));

app.post('/api/vehicles', requireAuth, asyncRoute(async (req, res) => {
  const vehicle = await createVehicle(req.body || {}, req.user.id);
  res.status(201).json(vehicle);
}));

app.put('/api/vehicles/:id', requireAuth, asyncRoute(async (req, res) => {
  const vehicle = await updateVehicle(req.params.id, req.body || {}, req.user.id);
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
  return res.json(vehicle);
}));

app.delete('/api/vehicles/:id', requireAuth, asyncRoute(async (req, res) => {
  const deleted = await deleteVehicle(req.params.id, req.user.id);
  if (!deleted) return res.status(404).json({ message: 'Vehicle not found' });
  return res.json({ message: 'Vehicle deleted' });
}));

app.post('/api/ai/symptoms', (req, res) => {
  const query = (req.body && req.body.query) || 'รถเบรกมีเสียง';
  const vehicle = req.body && req.body.vehicle ? req.body.vehicle : null;
  const results = partMap[intentFromText(query)] || partMap.default;
  res.json({
    mode: 'demo',
    summary: `จากอาการ “${query}” ข้อมูลเบื้องต้นชี้ไปที่ชิ้นส่วนเหล่านี้`,
    vehicle,
    results
  });
});

app.post('/api/ai/check', asyncRoute(async (req, res) => {
  const { productId, vehicle } = req.body || {};
  const product = await getProductById(Number(productId));
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  const result = evaluateCompatibility(product, vehicle);
  return res.json({ product, ...result });
}));

app.post('/api/ai/chat', (req, res) => {
  const message = (req.body && req.body.message) || '';
  const vehicle = req.body && req.body.vehicle ? req.body.vehicle : null;
  const brake = /เบรก|เสียง/.test(message);
  const answer = brake
    ? `อาการเบรกมีเสียงอาจเกี่ยวข้องกับผ้าเบรก จานเบรก หรือสิ่งสกปรกในระบบเบรก${vehicle ? ` สำหรับ ${vehicle.brand} ${vehicle.model} ${vehicle.year} ของคุณ` : ''} แนะนำให้ตรวจสอบ Brake Pad, Brake Disc และ Brake Caliper ก่อนซื้อครับ`
    : 'ผมช่วยค้นหาอะไหล่ ตรวจสอบความเข้ากันได้ และแนะนำการบำรุงรักษาเบื้องต้นได้ครับ ลองบอกอาการหรือรุ่นรถได้เลย';
  res.json({ answer, guidance: 'ข้อมูลนี้ไม่ใช่การวินิจฉัยจากช่างจริง หากอาการรุนแรงควรให้ช่างตรวจสอบ' });
});

app.post('/api/ai/identify', asyncRoute(async (req, res) => {
  const image = String((req.body && req.body.image) || '');
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 6_800_000) {
    return res.status(400).json({ message: 'Invalid image. Use JPEG, PNG, or WebP up to 5MB.' });
  }
  const matches = await listProducts('brake');
  return res.json({
    mode: 'demo',
    part: 'Brake Pad',
    category: 'ระบบเบรก',
    confidence: 92,
    matches: matches.slice(0, 5)
  });
}));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body || {};
    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (adminEmail && String(email || '').trim().toLowerCase() === adminEmail) {
      return res.status(403).json({ message: 'อีเมลนี้สงวนไว้สำหรับบัญชีผู้ดูแลร้าน' });
    }
    if (String(password || '').length < 8) {
      return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
    }
    const user = await createUser({ name, email, password, phone });
    res.status(201).json({
      message: 'Registration successful',
      token: issueToken(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role || 'customer'
      }
    });
  } catch (error) {
    const message = /already registered|Email already/i.test(error.message)
      ? 'Email already registered'
      : 'Registration failed';
    res.status(400).json({ message, error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await verifyUser(email, password);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    return res.json({
      message: 'Login successful',
      token: issueToken(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role || 'customer'
      }
    });
  } catch (error) {
    return res.status(400).json({ message: 'Login failed', error: error.message });
  }
});

app.get('/api/admin/products', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  res.json(await listProducts());
}));

app.post('/api/admin/products', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const product = await saveProduct(req.body || {});
  res.status(201).json(product);
}));

app.patch('/api/admin/products/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const existing = await getProductById(Number(req.params.id));
  if (!existing) return res.status(404).json({ message: 'Product not found' });
  const product = await saveProduct({ ...existing, ...(req.body || {}) }, req.params.id);
  return res.json(product);
}));

app.patch('/api/admin/products/:id/stock', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const product = await updateProductStock(req.params.id, req.body?.stockQuantity);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  return res.json(product);
}));

app.get('/api/admin/store-settings', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  res.json(await getStoreSettings());
}));

app.put('/api/admin/store-settings', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  res.json(await saveStoreSettings(req.body || {}));
}));

app.get('/api/admin/orders', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  res.json(await listAdminOrders());
}));

app.patch('/api/admin/orders/:id/status', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const order = await updateOrderStatus(req.params.id, String(req.body?.status || ''));
  if (!order) return res.status(404).json({ message: 'Order not found' });
  return res.json(order);
}));

app.get('/api/orders', requireAuth, asyncRoute(async (req, res) => {
  res.json(await listOrders(req.user.id));
}));

app.get('/api/orders/:id', requireAuth, asyncRoute(async (req, res) => {
  const order = await getOrderForUser(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  return res.json(order);
}));

app.post('/api/orders/checkout', requireAuth, asyncRoute(async (req, res) => {
  const stripe = getStripeClient();
  const shipping = req.body?.shipping || {};
  const order = await reserveOrder(req.body || {}, req.user.id, shipping.name);
  let session;
  try {
    const baseUrl = String(process.env.PUBLIC_BASE_URL || 'http://localhost:8123').replace(/\/+$/, '');
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: String(order.id),
      customer_email: order.shipping.email,
      metadata: { orderId: String(order.id), userId: String(req.user.id) },
      payment_intent_data: { metadata: { orderId: String(order.id), userId: String(req.user.id) } },
      line_items: order.items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: 'thb',
          unit_amount: Math.round(item.price * 100),
          product_data: { name: item.name }
        }
      })).concat(order.shippingFeeThb > 0 ? [{
        quantity: 1,
        price_data: {
          currency: 'thb',
          unit_amount: order.shippingFeeThb * 100,
          product_data: { name: 'ค่าจัดส่ง' }
        }
      }] : []),
      success_url: `${baseUrl}/?payment=success&order_id=${order.id}`,
      cancel_url: `${baseUrl}/?payment=cancelled&order_id=${order.id}`,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60
    });

    if (!session.url || !await attachStripeSession(order.id, req.user.id, session.id)) {
      throw new Error('ไม่สามารถผูก Stripe Checkout กับคำสั่งซื้อได้');
    }
    return res.status(201).json({ id: order.id, status: order.status, checkoutUrl: session.url });
  } catch (error) {
    if (session?.id) {
      try { await stripe.checkout.sessions.expire(session.id); } catch { /* Stripe may already have expired or completed it. */ }
    }
    await markOrderCancelled(order.id, req.user.id);
    throw error;
  }
}));

app.post('/api/orders/:id/cancel-payment', requireAuth, asyncRoute(async (req, res) => {
  const order = await getOrderForUser(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.status !== 'pending_payment' || !order.stripeSessionId) {
    return res.status(409).json({ message: 'คำสั่งซื้อนี้ไม่สามารถยกเลิกการชำระเงินได้' });
  }
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
  if (session.payment_status === 'paid') return res.status(409).json({ message: 'ชำระเงินแล้ว ไม่สามารถยกเลิกได้' });
  if (session.status === 'complete') return res.status(409).json({ message: 'กำลังรอยืนยันการชำระเงิน ไม่สามารถยกเลิกรายการนี้ได้' });
  if (session.status === 'open') await stripe.checkout.sessions.expire(session.id);
  await markOrderCancelled(order.id, req.user.id);
  return res.json({ status: 'cancelled' });
}));

app.get('/api/maintenance', requireAuth, asyncRoute(async (req, res) => {
  res.json(await listMaintenance(req.user.id));
}));

app.post('/api/maintenance', requireAuth, asyncRoute(async (req, res) => {
  const record = await createMaintenance(req.body || {}, req.user.id);
  res.status(201).json(record);
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.type === 'entity.too.large' ? 413 : error.status || 400;
  return res.status(status).json({ message: error.message || 'Request failed' });
});

async function start() {
  await initializeDatabase();
  if (process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD) {
    await bootstrapAdmin(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  }
  app.listen(PORT, () => {
    console.log(`AutoFix API running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
