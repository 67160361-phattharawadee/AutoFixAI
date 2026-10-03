let PRODUCTS = [
  { id: 1, brand: 'Bosch', name: 'Bosch QuietCast Premium Brake Pad BP1290', partNumber: 'BP1290', image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=900&q=85', category: 'ระบบเบรก', price: 1290, rating: 4.8, reviews: 128, icon: '▣', stock: true, fit: [{ brand: 'Toyota', model: 'Yaris', min: 2019, max: 2022, engine: '1.2L' }], reason: 'ตรงรุ่น คะแนนรีวิวสูง และมีสินค้าในสต็อก' },
  { id: 2, brand: 'Brembo', name: 'Brembo Prime Brake Disc', partNumber: '09.A921.11', image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=85', category: 'ระบบเบรก', price: 2450, rating: 4.7, reviews: 86, icon: '◉', stock: true, fit: [{ brand: 'Toyota', model: 'Yaris', min: 2019, max: 2022 }], reason: 'ประสิทธิภาพการระบายความร้อนดี' },
  { id: 3, brand: 'TRW', name: 'TRW COTEC Brake Pad', partNumber: 'GDB3382', image: 'https://images.unsplash.com/photo-1487754180451-c456f719a167?auto=format&fit=crop&w=900&q=85', category: 'ระบบเบรก', price: 3180, rating: 4.5, reviews: 42, icon: '◌', stock: false, fit: [{ brand: 'Honda', model: 'Civic', min: 2019, max: 2022, engine: '1.5 Turbo' }], reason: 'อะไหล่คุณภาพสูงสำหรับรถ Honda Civic' },
  { id: 4, brand: 'NGK', name: 'NGK Laser Iridium Spark Plug', partNumber: 'IFR6T11', image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=900&q=85', category: 'ระบบเครื่องยนต์', price: 890, rating: 4.9, reviews: 214, icon: '✦', stock: true, fit: [{ brand: 'Toyota', model: 'Yaris', min: 2018, max: 2022, engine: '1.2L' }, { brand: 'Honda', model: 'Civic', min: 2019, max: 2022, engine: '1.5 Turbo' }], reason: 'รีวิวสูงและช่วยการจุดระเบิดสม่ำเสมอ' },
  { id: 5, brand: 'DENSO', name: 'DENSO Cabin Air Filter', partNumber: 'DCC1009', image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=85', category: 'ระบบแอร์', price: 540, rating: 4.6, reviews: 97, icon: '▤', stock: true, fit: [{ brand: 'Toyota', model: 'Yaris', min: 2018, max: 2023 }], reason: 'กรองฝุ่นละเอียด เปลี่ยนง่าย คุ้มค่า' },
  { id: 6, brand: 'Bosch', name: 'Bosch Air Filter', partNumber: 'F 026 400 123', image: 'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=900&q=85', category: 'ระบบเครื่องยนต์', price: 620, rating: 4.4, reviews: 61, icon: '▥', stock: true, fit: [{ brand: 'Toyota', model: 'Yaris', min: 2019, max: 2022 }], reason: 'ช่วยให้อากาศเข้าสู่เครื่องยนต์สะอาดขึ้น' }
];

const state = {
  vehicle: JSON.parse(localStorage.getItem('autofix-vehicle') || 'null'),
  cart: JSON.parse(localStorage.getItem('autofix-cart') || '[]'),
  wishlist: JSON.parse(localStorage.getItem('autofix-wishlist') || '[]'),
  user: JSON.parse(localStorage.getItem('autofix-user') || 'null'),
  orders: JSON.parse(localStorage.getItem('autofix-orders') || '[]'),
  maintenance: [],
  adminProducts: [],
  adminOrders: null,
  adminStoreSettings: null,
  adminLoading: false,
  paymentsEnabled: null,
  storeConfig: null,
  symptoms: ''
};

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = (value) => `฿${Number(value).toLocaleString('th-TH')}`;
const vehicleText = (vehicle = state.vehicle) => vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year} ${vehicle.engine}` : 'ยังไม่ได้เลือกรถ';

function save() {
  localStorage.setItem('autofix-vehicle', JSON.stringify(state.vehicle));
  localStorage.setItem('autofix-cart', JSON.stringify(state.cart));
  localStorage.setItem('autofix-wishlist', JSON.stringify(state.wishlist));
  localStorage.setItem('autofix-user', JSON.stringify(state.user));
  localStorage.setItem('autofix-orders', JSON.stringify(state.orders));
}

async function loadProducts() {
  try {
    const [products, health, storeConfig] = await Promise.all([AutoFixAI.listProducts(), AutoFixAI.health(), AutoFixAI.storeConfig()]);
    PRODUCTS = products;
    state.paymentsEnabled = Boolean(health.paymentsEnabled);
    state.storeConfig = storeConfig;
    PRODUCTS = PRODUCTS.map((product) => ({
      ...product,
      icon: product.category === 'ระบบเบรก' ? '◉' : product.category === 'ระบบแอร์' ? '▤' : '⚙',
      reason: product.fit.length ? 'ตรวจสอบความเข้ากันได้กับข้อมูลรถของคุณ' : 'ยังไม่มีข้อมูลรุ่นรถที่รองรับ'
    }));
    render();
  } catch (error) {
    document.getElementById('app').innerHTML = `<div class="page empty">โหลดรายการอะไหล่ไม่สำเร็จ: ${esc(error.message)}<br><button class="button" data-action="retry-products">ลองอีกครั้ง</button></div>`;
    bind();
  }
}

function storeStatusNotice() {
  const availableProducts = PRODUCTS.filter((product) => Number(product.stockQuantity || 0) > 0).length;
  if (!availableProducts) {
    return '<div class="store-notice" role="status"><strong>ยังสั่งซื้อไม่ได้: สินค้าทุกชิ้นหมดสต็อก</strong><span>ผู้ดูแลร้านต้องใส่จำนวนสินค้าคงเหลือจริงในหน้า “จัดการร้าน” ก่อน ระบบจะเปิดปุ่มใส่รถเข็นให้</span></div>';
  }
  if (state.paymentsEnabled === false) {
    return '<div class="store-notice" role="status"><strong>ยังไม่ได้เปิดระบบชำระเงิน</strong><span>ต้องตั้งค่า Stripe secret key และ webhook secret ในไฟล์ .env แล้วเริ่มระบบใหม่</span></div>';
  }
  if (state.storeConfig?.configured !== true) {
    return '<div class="store-notice" role="status"><strong>ร้านยังตั้งค่าการจัดส่งไม่ครบ</strong><span>ผู้ดูแลร้านต้องกำหนดค่าส่งและยืนยันนโยบายภาษีในหน้า “จัดการร้าน” ก่อนรับคำสั่งซื้อ</span></div>';
  }
  return '';
}

function toast(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}

function fitFor(product) {
  if (!state.vehicle) return { cls: 'warn', label: 'เพิ่มรถเพื่อเช็กความเข้ากันได้', score: null };
  const exact = product.fit.find((fit) => fit.brand === state.vehicle.brand && fit.model === state.vehicle.model && state.vehicle.year >= fit.min && state.vehicle.year <= fit.max && (!fit.engine || fit.engine === state.vehicle.engine));
  if (exact) return { cls: 'good', label: '✓ ตรงกับรถคุณ 98%', score: 98 };
  const partial = product.fit.some((fit) => fit.brand === state.vehicle.brand && fit.model === state.vehicle.model);
  return partial ? { cls: 'warn', label: '⚠ ควรตรวจสอบเพิ่มเติม', score: 67 } : { cls: 'bad', label: '✕ ไม่รองรับรถของคุณ', score: 12 };
}

function productCard(product) {
  const fit = fitFor(product);
  const saved = state.wishlist.includes(product.id);
  const available = Number(product.stockQuantity || 0) > 0;

  return `<article class="product-card">
    <div class="product-image">
      <img src="${product.image}" alt="${esc(product.name)}" loading="lazy" />
      <span>${product.icon || '⚙'}</span>
      <button class="save-button" data-save="${product.id}">${saved ? '♥' : '♡'}</button>
    </div>
    <div class="product-body">
      <span class="product-type">${esc(product.brand)} · ${esc(product.category)}</span>
      <h3>${esc(product.name)}</h3>
      <span class="muted">ร้าน ${esc(state.storeConfig?.storeName || 'AutoFix')}</span><br>
      <span class="muted" style="font-size:11px">Part Number: ${esc(product.partNumber)}</span><br>
      <span class="rating">★ ${product.rating} <i class="muted">(${product.reviews})</i></span>
      <div class="price">${money(product.price)}</div>
      <span class="fit ${fit.cls}" title="${esc(product.reason)}">${fit.label}</span>
      <div class="product-actions">
        <button class="button secondary" data-detail="${product.id}">รายละเอียด</button>
        <button class="button" data-add="${product.id}" ${available ? '' : 'disabled'}>${available ? 'ใส่รถเข็น' : 'หมดสต็อก'}</button>
      </div>
    </div>
  </article>`;
}

function vehicleBar() {
  if (state.vehicle) {
    return `<div class="vehicle-bar"><div class="vehicle-data"><span class="vehicle-icon">🚗</span><div><span>รถหลักของคุณ</span><strong>${esc(vehicleText())}</strong></div></div><button class="button secondary" data-action="garage">จัดการรถ</button></div>`;
  }
  return `<div class="vehicle-bar"><div class="vehicle-data"><span class="vehicle-icon">🚗</span><div><span>SmartFit จะแม่นยำขึ้นเมื่อรู้จักรถคุณ</span><strong>เพิ่มรถคันแรกของคุณ</strong></div></div><button class="button" data-action="garage">+ เพิ่มรถ</button></div>`;
}

function home() {
  const picks = state.vehicle ? PRODUCTS.filter((p) => fitFor(p).cls === 'good').slice(0, 3) : PRODUCTS.slice(0, 3);
  return `<section class="hero">
    <div>
      <span class="eyebrow">AUTOFIX / SMARTFIT AI</span>
      <h1>ซื้ออะไหล่ให้ตรงรุ่น<br /><em>ให้ AI ช่วยคุณ</em></h1>
      <p>ไม่ต้องรู้ชื่ออะไหล่ ไม่ต้องกลัวซื้อผิดรุ่น บอกอาการรถหรือค้นหาสินค้า แล้วให้ SmartFit AI ช่วยเลือกให้</p>
      <form class="search-box" id="searchForm">
        <input id="mainSearch" placeholder="ค้นหาอะไหล่ หรือบอกอาการรถ..." />
        <button class="button">ค้นหา</button>
      </form>
      <div class="hero-actions">
        <button class="button" data-action="finder">✦ ให้ AI ช่วยหาอะไหล่</button>
        <button class="button secondary" data-action="image">▧ วิเคราะห์รูปอะไหล่</button>
      </div>
    </div>
    <div class="hero-visual">
      <div class="scan-frame">
        <div class="scan-art">⚙</div>
        <div class="scan-label"><span>SMARTFIT SCAN</span><strong>เข้าใจรถของคุณ</strong><span>AI confidence engine / ready</span></div>
      </div>
    </div>
  </section>

  <div class="page">
    ${vehicleBar()}
    ${storeStatusNotice()}
    <div class="ai-banner">
      <div>
        <span class="eyebrow">PERSONALIZED FOR YOU</span>
        <h2>${state.vehicle ? `อะไหล่ที่เหมาะกับ ${esc(state.vehicle.brand)} ${esc(state.vehicle.model)} ของคุณ` : 'เริ่มจากรถของคุณ'}</h2>
        <p>${state.vehicle ? 'AI Picks จากความเข้ากันได้ รีวิว และความคุ้มค่า' : 'บันทึกรถไว้ครั้งเดียว แล้ว AutoFix จะช่วยเช็กให้ทุกครั้ง'}</p>
      </div>
      <button class="button secondary" data-action="finder">เปิด SmartFit AI →</button>
    </div>

    <div class="section-head">
      <div>
        <span class="eyebrow">AI PICKS</span>
        <h2>✨ สินค้าที่ AI แนะนำ</h2>
        <p class="muted">คัดจากรุ่นรถ ความเข้ากันได้ คะแนนรีวิว และสต็อก</p>
      </div>
      <a class="muted" href="#shop">ดูทั้งหมด →</a>
    </div>
    <div class="grid">${picks.map(productCard).join('')}</div>
  </div>`;
}

function shop(query = '') {
  const list = PRODUCTS.filter((p) => !query || `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase()));
  return `<div class="page"><div class="section-head"><div><span class="eyebrow">PARTS CATALOG</span><h1>อะไหล่ทั้งหมด</h1><p class="muted">${list.length} รายการในแค็ตตาล็อก</p></div><form class="search-box" id="shopSearch"><input value="${esc(query)}" placeholder="ค้นหาสินค้า..." /><button class="button">ค้นหา</button></form></div>${storeStatusNotice()}<div class="grid">${list.length ? list.map(productCard).join('') : '<div class="empty" style="grid-column:1/-1">ไม่พบสินค้า ลองบอกอาการรถกับ AI Mechanic</div>'}</div></div>`;
}

function garage() {
  return `<div class="page"><div class="section-head"><div><span class="eyebrow">MY GARAGE</span><h1>🚗 รถของฉัน</h1><p class="muted">ข้อมูลนี้เป็นของคุณเท่านั้น และใช้เพื่อเช็กอะไหล่ให้แม่นยำขึ้น</p></div><button class="button" data-action="add-vehicle">+ เพิ่มรถ</button></div>${state.vehicle ? `<div class="panel"><div class="vehicle-data"><span class="vehicle-icon">🚘</span><div><span>รถหลัก</span><strong>${esc(vehicleText())}</strong><span>เลขไมล์ ${state.vehicle.mileage ? `${Number(state.vehicle.mileage).toLocaleString()} กม.` : 'ยังไม่ได้ระบุ'}</span></div></div><div class="product-actions"><button class="button secondary" data-action="add-vehicle">แก้ไขข้อมูล</button><button class="button secondary" data-action="remove-vehicle">ลบรถ</button></div></div>` : '<div class="empty">ยังไม่มีรถใน Garage<br /><button class="button" data-action="add-vehicle" style="margin-top:16px">เพิ่มรถเพื่อเริ่มต้น</button></div>'}</div>`;
}

function orderHistory() {
  if (!state.user) return `<div class="page"><h1>คำสั่งซื้อของฉัน</h1><div class="empty">เข้าสู่ระบบเพื่อดูประวัติคำสั่งซื้อ <button class="button" data-action="auth">เข้าสู่ระบบ</button></div></div>`;
  const statusText = { pending_payment: 'รอชำระเงิน', paid: 'ชำระเงินแล้ว', processing: 'กำลังเตรียมสินค้า', shipped: 'จัดส่งแล้ว', completed: 'สำเร็จ', cancelled: 'ยกเลิก', expired: 'หมดเวลาชำระ', payment_failed: 'ชำระไม่สำเร็จ', legacy_unverified: 'รายการเดิมที่ยังไม่ยืนยัน' };
  return `<div class="page"><div class="section-head"><div><span class="eyebrow">ORDER HISTORY</span><h1>คำสั่งซื้อของฉัน</h1></div><button class="button secondary" data-action="refresh-orders">รีเฟรชสถานะ</button></div>${state.orders.length ? `<div class="result-list">${state.orders.map((order) => `<article class="result-row"><div><strong>คำสั่งซื้อ #${esc(order.id)}</strong><small class="muted">${esc(order.createdAt || order.date || 'บันทึกแล้ว')} · ${esc(statusText[order.status] || 'ไม่ทราบสถานะ')}</small><div class="muted">${order.items.map((item) => `${esc(item.name)} × ${item.quantity}`).join(', ')}</div></div><strong>${money(order.total)}</strong></article>`).join('')}</div>` : '<div class="empty">ยังไม่มีคำสั่งซื้อ</div>'}</div>`;
}

function adminPage() {
  if (state.user?.role !== 'admin') return `<div class="page"><h1>จัดการร้าน</h1><div class="empty">หน้านี้สำหรับบัญชีผู้ดูแลร้านเท่านั้น</div></div>`;
  if (state.adminOrders === null || !state.adminStoreSettings) return '<div class="page empty">กำลังโหลดข้อมูลร้าน...</div>';
  const nextStatus = { paid: 'processing', processing: 'shipped', shipped: 'completed' };
  const statusText = { pending_payment: 'รอชำระเงิน', paid: 'ชำระเงินแล้ว', processing: 'กำลังเตรียมสินค้า', shipped: 'จัดส่งแล้ว', completed: 'สำเร็จ', cancelled: 'ยกเลิก', expired: 'หมดเวลาชำระ', payment_failed: 'ชำระไม่สำเร็จ', legacy_unverified: 'รายการเดิมที่ยังไม่ยืนยัน' };
  const settings = state.adminStoreSettings;
  return `<div class="page">
    <div class="section-head"><div><span class="eyebrow">STORE ADMIN</span><h1>จัดการร้าน</h1></div><button class="button secondary" data-action="refresh-admin">รีเฟรช</button></div>
    <section class="admin-section"><h2>นโยบายการขาย</h2><p class="muted">กำหนดค่าส่งและยืนยันนโยบายภาษีของร้านก่อนเปิดรับคำสั่งซื้อ</p><form id="storeSettingsForm" class="form-grid admin-settings">
      <div class="field"><label>ค่าส่ง (บาท)</label><input name="shippingFeeThb" type="number" min="0" max="200000" step="1" value="${settings.shippingFeeThb ?? ''}" required /></div>
      <div class="field"><label>นโยบายภาษี</label><select name="taxPolicy" required><option value="">เลือกนโยบาย</option><option value="included" ${settings.taxPolicy === 'included' ? 'selected' : ''}>รวมภาษีไว้ในราคาสินค้าแล้ว</option><option value="not_applicable" ${settings.taxPolicy === 'not_applicable' ? 'selected' : ''}>ร้านยืนยันว่าไม่ต้องคิดภาษีเพิ่ม</option></select></div>
      <label class="field full admin-confirm"><input name="taxPolicyConfirmed" type="checkbox" required /><span>ยืนยันว่าตรวจสอบนโยบายภาษีและค่าส่งของร้านแล้ว</span></label>
      <div class="field full"><button class="button">บันทึกนโยบายร้าน</button><span class="muted">ภาษีไม่ได้คำนวณแยกโดยระบบ; ให้ตรวจสอบกับผู้ทำบัญชี/ข้อกำหนดที่เกี่ยวข้อง</span></div>
    </form><p class="fit ${settings.configured ? 'good' : 'warn'}">${settings.configured ? `ตั้งค่าแล้ว · ค่าส่ง ${money(settings.shippingFeeThb)} · ${settings.taxPolicy === 'included' ? 'ภาษีรวมในราคาสินค้า' : 'ไม่มีภาษีที่ต้องคิดเพิ่มตามที่ร้านยืนยัน'}` : 'ยังไม่พร้อมรับคำสั่งซื้อ'}</p></section>
    <section class="admin-section"><div class="section-head"><div><h2>สินค้าและสต็อก</h2><p class="muted">จำนวนนี้คือสินค้าพร้อมขาย หลังหักรายการที่กำลังรอชำระ</p></div><button class="button" data-action="product-add">+ เพิ่มสินค้า</button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>สินค้า</th><th>ราคา (บาท)</th><th>พร้อมขาย</th><th></th></tr></thead><tbody>${state.adminProducts.map((product) => `<tr><td><strong>${esc(product.name)}</strong><small>${esc(product.brand)} · ${esc(product.partNumber || '')} · ${esc(product.category || '')}</small></td><td><input type="number" min="0.01" step="0.01" value="${product.price}" data-product-price="${product.id}" aria-label="ราคา ${esc(product.name)}" /></td><td><input type="number" min="0" max="1000000" value="${product.stockQuantity}" data-stock-value="${product.id}" aria-label="จำนวนพร้อมขาย ${esc(product.name)}" /></td><td><button class="button secondary" data-product-save="${product.id}">บันทึก</button></td></tr>`).join('')}</tbody></table></div></section>
    <section class="admin-section"><h2>คำสั่งซื้อและการจัดส่ง</h2>${state.adminOrders.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Order</th><th>ผู้รับ/ที่อยู่</th><th>รายการ</th><th>ยอด</th><th>สถานะ</th><th></th></tr></thead><tbody>${state.adminOrders.map((order) => `<tr><td>#${esc(order.id)}<small>${esc(order.createdAt)}</small></td><td>${esc(order.shipping?.name || order.userName)}<small>${esc(order.shipping?.phone || '')}</small><small>${esc(order.shipping?.address || '')} ${esc(order.shipping?.city || '')} ${esc(order.shipping?.province || '')} ${esc(order.shipping?.postalCode || '')}</small></td><td>${order.items.map((item) => `${esc(item.name)} × ${item.quantity}`).join('<br>')}<small>ค่าส่ง ${money(order.shippingFeeThb || 0)}</small></td><td>${money(order.total)}</td><td>${esc(statusText[order.status] || order.status)}</td><td>${nextStatus[order.status] ? `<button class="button secondary" data-order-id="${order.id}" data-order-status="${nextStatus[order.status]}">${nextStatus[order.status] === 'processing' ? 'เริ่มเตรียม' : nextStatus[order.status] === 'shipped' ? 'ทำเครื่องหมายจัดส่ง' : 'ปิดคำสั่งซื้อ'}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่มีคำสั่งซื้อ</div>'}</section>
  </div>`;
}

function productCreateModal() {
  return `<div class="modal-backdrop" data-close-modal><div class="modal" onclick="event.stopPropagation()"><div class="modal-head"><div><span class="eyebrow">PRODUCT CATALOG</span><h2>เพิ่มสินค้า</h2><p class="muted">สินค้าใหม่เริ่มด้วยสต็อก 0 และยังขายไม่ได้จนกว่าจะกรอกจำนวนจริง</p></div><button class="close" data-action="close-modal">×</button></div><form id="productForm" class="form-grid"><div class="field"><label>ยี่ห้อ</label><input name="brand" maxlength="80" required /></div><div class="field"><label>ชื่อสินค้า</label><input name="name" maxlength="180" required /></div><div class="field"><label>Part Number</label><input name="partNumber" maxlength="80" required /></div><div class="field"><label>หมวดหมู่</label><input name="category" maxlength="80" required /></div><div class="field"><label>ราคา (บาท)</label><input name="price" type="number" min="0.01" max="99999999" step="0.01" required /></div><div class="field"><label>URL รูปสินค้า</label><input name="image" type="url" placeholder="https://..." required /></div><div class="field full"><label>ข้อมูลรถที่รองรับ (JSON, ถ้ามี)</label><textarea name="fitJson" rows="3" placeholder='[{"brand":"Toyota","model":"Yaris","min":2019,"max":2023,"engine":"1.2L"}]'></textarea></div><div class="field full"><button class="button">เพิ่มสินค้า</button></div></form></div></div>`;
}

function loadAdminData() {
  if (state.adminLoading || state.user?.role !== 'admin') return;
  state.adminLoading = true;
  Promise.all([AutoFixAI.listAdminProducts(), AutoFixAI.listAdminOrders(), AutoFixAI.getStoreSettings()]).then(([products, orders, settings]) => {
    state.adminProducts = products;
    state.adminOrders = orders;
    state.adminStoreSettings = settings;
    state.adminLoading = false;
    render();
  }).catch((error) => {
    state.adminOrders = [];
    state.adminStoreSettings = { configured: false };
    state.adminLoading = false;
    toast(error.message || 'โหลดข้อมูลผู้ดูแลไม่สำเร็จ');
    render();
  });
}

function healthPage() {
  const mileage = state.vehicle?.mileage ? `${Number(state.vehicle.mileage).toLocaleString()} กม.` : 'ยังไม่มีข้อมูล';
  const entries = state.maintenance || [];
  return `<div class="page"><span class="eyebrow">MAINTENANCE HISTORY</span><h1>สุขภาพรถของฉัน</h1><p class="muted">บันทึกงานบำรุงรักษาจริงเพื่อใช้ติดตามประวัติรถ</p>${vehicleBar()}<div class="grid" style="margin-top:25px"><div class="panel"><span class="eyebrow">เลขไมล์ปัจจุบัน</span><h2>${mileage}</h2><p class="muted">อ้างอิงจากข้อมูลรถใน Garage</p></div><div class="panel"><span class="eyebrow">รายการบำรุงรักษา</span><h2>${entries.length} รายการ</h2><p class="muted">บันทึกภายใต้บัญชีของคุณ</p></div></div><div class="section-head"><h2>ประวัติการบำรุงรักษา</h2><button class="button" data-action="maintenance-add">+ บันทึกรายการ</button></div>${entries.length ? `<div class="result-list">${entries.map((entry) => `<article class="result-row"><div><strong>${esc(entry.title)}</strong><small class="muted">${esc(entry.serviceDate)}${entry.mileage != null ? ` · ${Number(entry.mileage).toLocaleString()} กม.` : ''}</small>${entry.notes ? `<div class="muted">${esc(entry.notes)}</div>` : ''}</div></article>`).join('')}</div>` : '<div class="empty">ยังไม่มีประวัติการบำรุงรักษา</div>'}</div>`;
}

function health() {
  return `<div class="page"><span class="eyebrow">MAINTENANCE AI</span><h1>สุขภาพรถของฉัน</h1><p class="muted">บันทึกประวัติ เพื่อให้ AI ช่วยเตือนสิ่งที่ควรตรวจสอบ</p>${vehicleBar()}<div class="grid" style="margin-top:25px"><div class="panel"><span class="eyebrow">CURRENT MILEAGE</span><h2>42,800 กม.</h2><p class="muted">อัปเดตล่าสุดวันนี้</p></div><div class="panel"><span class="eyebrow">NEXT CHECK</span><h2 style="color:var(--yellow)">อีก 1,000 กม.</h2><p class="muted">ควรตรวจสอบน้ำมันเครื่อง</p></div><div class="panel"><span class="eyebrow">AI NOTE</span><h2>แบตเตอรี่</h2><p class="muted">ใช้งานมานาน ควรตรวจสอบสภาพก่อนเดินทางไกล</p></div></div><div class="panel" style="margin-top:18px"><h2>ประวัติการบำรุงรักษา</h2><p>🟢 เปลี่ยนน้ำมันเครื่อง <span class="muted">12 มี.ค. 2026 · 41,800 กม.</span></p><p>🟡 เปลี่ยนผ้าเบรก <span class="muted">ยังไม่มีข้อมูล</span></p><button class="button secondary">+ บันทึกประวัติ</button></div></div>`;
}

function detail(id) {
  const product = PRODUCTS.find((p) => p.id === Number(id)) || PRODUCTS[0];
  if (!product) return '<div class="page empty">กำลังโหลดข้อมูลสินค้า...</div>';
  const fit = fitFor(product);
  const available = Number(product.stockQuantity || 0) > 0;
  return `<div class="page"><button class="button secondary" data-action="back">← กลับไปเลือกอะไหล่</button><div class="detail-layout" style="margin-top:24px"><div class="detail-image"><img src="${product.image}" alt="${esc(product.name)}" /><span>${product.icon}</span></div><div><span class="eyebrow">${esc(product.brand)} · ${esc(product.category)}</span><h1>${esc(product.name)}</h1><p class="muted">Part Number: ${esc(product.partNumber)}</p><span class="rating">★ ${product.rating} · ${product.reviews} รีวิว</span><div class="price">${money(product.price)}</div><div class="score-card"><span class="eyebrow">SMARTFIT RESULT</span><div class="score">${fit.score || '--'}<small>%</small></div><strong class="fit ${fit.cls}">${fit.label}</strong><p class="muted">เหมาะกับ: ${esc(vehicleText())}</p><button class="button" data-action="check" data-product="${product.id}">🤖 ตรวจสอบว่าใส่รถฉันได้ไหม</button></div><h3>🤖 AI วิเคราะห์สินค้า</h3><ul class="reason-list"><li>คัดจากข้อมูลรุ่นรถและปีที่รองรับ</li><li>คะแนนรีวิวสูงเมื่อเทียบกับหมวดเดียวกัน</li><li>กรุณาตรวจสอบ Part Number ก่อนสั่งซื้อ</li></ul><button class="button" data-add="${product.id}" ${available ? '' : 'disabled'}>${available ? `ใส่รถเข็น · ${money(product.price)}` : 'หมดสต็อก'}</button></div></div></div>`;
}

function cartModal() {
  const items = state.cart.map((item) => ({ ...item, product: PRODUCTS.find((p) => p.id === item.id) })).filter((item) => item.product);
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingFee = Number(state.storeConfig?.shippingFeeThb || 0);
  const total = subtotal + shippingFee;
  const checkoutReady = state.storeConfig?.configured && state.storeConfig?.paymentsEnabled;

  return `<div class="modal-backdrop" data-close-modal><div class="modal" onclick="event.stopPropagation()"><div class="modal-head"><div><span class="eyebrow">YOUR CART</span><h2>รถเข็นของคุณ</h2></div><button class="close" data-action="close-modal">×</button></div>${items.length ? `<div class="result-list">${items.map((item) => `<div class="result-row"><span>${esc(item.product.name)} × ${item.quantity}</span><strong>${money(item.product.price * item.quantity)}</strong></div>`).join('')}<div class="result-row"><span>ค่าจัดส่ง</span><strong>${state.storeConfig?.configured ? money(shippingFee) : 'ยังไม่ได้ตั้งค่า'}</strong></div></div><div class="section-head"><strong>ยอดรวม</strong><strong class="price">${money(total)}</strong></div>${checkoutReady ? '<button class="button" data-action="checkout">ดำเนินการสั่งซื้อ</button>' : storeStatusNotice()}` : '<div class="empty">รถเข็นยังว่าง</div>'}</div></div>`;
}

function checkoutModal() {
  const subtotal = state.cart.reduce((sum, item) => sum + (PRODUCTS.find((product) => product.id === item.id)?.price || 0) * item.quantity, 0);
  const shippingFee = Number(state.storeConfig?.shippingFeeThb || 0);
  return `<div class="modal-backdrop" data-close-modal><div class="modal" onclick="event.stopPropagation()"><div class="modal-head"><div><span class="eyebrow">SECURE CHECKOUT</span><h2>ที่อยู่จัดส่ง</h2><p class="muted">การชำระเงินดำเนินการบนหน้า Stripe ที่ปลอดภัย</p></div><button class="close" data-action="close-modal">×</button></div><div class="result-list"><div class="result-row"><span>สินค้า</span><strong>${money(subtotal)}</strong></div><div class="result-row"><span>ค่าจัดส่ง</span><strong>${money(shippingFee)}</strong></div><div class="result-row"><strong>ยอดรวม</strong><strong>${money(subtotal + shippingFee)}</strong></div><p class="muted">${state.storeConfig.taxPolicy === 'included' ? 'ร้านยืนยันว่าภาษีรวมในราคาสินค้าแล้ว' : 'ร้านยืนยันว่าไม่มีภาษีที่ต้องคิดเพิ่ม'}</p></div><form id="checkoutForm" class="form-grid"><div class="field"><label>ชื่อผู้รับ</label><input name="name" value="${esc(state.user?.name || '')}" autocomplete="name" required /></div><div class="field"><label>อีเมล</label><input name="email" type="email" value="${esc(state.user?.email || '')}" autocomplete="email" required /></div><div class="field full"><label>เบอร์โทรศัพท์</label><input name="phone" type="tel" autocomplete="tel" required /></div><div class="field full"><label>ที่อยู่</label><textarea name="address" rows="3" autocomplete="street-address" required></textarea></div><div class="field"><label>เขต/อำเภอ</label><input name="city" autocomplete="address-level2" required /></div><div class="field"><label>จังหวัด</label><input name="province" autocomplete="address-level1" required /></div><div class="field"><label>รหัสไปรษณีย์</label><input name="postalCode" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" autocomplete="postal-code" required /></div><div class="field full"><button class="button" type="submit">ไปชำระเงิน</button></div></form></div></div>`;
}

function authModal(mode = 'login') {
  const isRegister = mode === 'register';
  return `<div class="modal-backdrop" data-close-modal><div class="modal" onclick="event.stopPropagation()"><div class="modal-head"><div><span class="eyebrow">AUTOFIX ACCOUNT</span><h2>${isRegister ? 'สมัครสมาชิก AutoFix' : 'เข้าสู่ระบบ AutoFix'}</h2><p class="muted">ให้ AI รู้จักรถของคุณมากขึ้น</p></div><button class="close" data-action="close-modal">×</button></div><form id="authForm" data-mode="${mode}" class="form-grid">${isRegister ? '<div class="field full"><label>ชื่อ-นามสกุล</label><input name="name" type="text" placeholder="กรอกชื่อของคุณ" required /></div>' : ''}<div class="field full"><label>อีเมล</label><input name="email" type="email" value="${isRegister ? '' : 'demo@autofix.com'}" ${isRegister ? 'placeholder="you@example.com"' : ''} required /></div><div class="field full"><label>รหัสผ่าน</label><input name="password" type="password" value="${isRegister ? '' : 'AutoFix123!'}" required /></div>${isRegister ? '<div class="field full"><label>เบอร์โทรศัพท์</label><input name="phone" type="tel" placeholder="08xxxxxxxx" /></div>' : ''}<div class="field full"><button class="button" type="submit">${isRegister ? 'สร้างบัญชี' : 'เข้าสู่ระบบ'}</button></div><div class="field full"><button class="button secondary" type="button" id="toggleAuthMode">${isRegister ? 'มีบัญชีแล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครสมาชิก'}</button></div></form></div></div>`;
}

function vehicleModal() {
  const vehicle = state.vehicle || {};
  const brandOption = (brand) => `<option ${vehicle.brand === brand ? 'selected' : ''}>${brand}</option>`;
  return `<div class="modal-backdrop" data-close-modal><div class="modal" onclick="event.stopPropagation()"><div class="modal-head"><div><span class="eyebrow">MY GARAGE</span><h2>${vehicle.id ? 'แก้ไขรถของคุณ' : 'เพิ่มรถของคุณ'}</h2></div><button class="close" data-action="close-modal">×</button></div><form id="vehicleForm" class="form-grid"><div class="field"><label>ยี่ห้อ</label><select name="brand">${brandOption('Toyota')}${brandOption('Honda')}${brandOption('Mazda')}</select></div><div class="field"><label>รุ่น</label><input name="model" value="${esc(vehicle.model || 'Yaris')}" required /></div><div class="field"><label>ปี</label><input name="year" type="number" min="1980" max="${new Date().getFullYear() + 1}" value="${vehicle.year || 2020}" required /></div><div class="field"><label>เครื่องยนต์</label><input name="engine" value="${esc(vehicle.engine || '1.2L')}" required /></div><div class="field full"><label>เลขไมล์ปัจจุบัน (ถ้ามี)</label><input name="mileage" type="number" min="0" value="${vehicle.mileage || 0}" /></div><div class="field full"><button class="button">บันทึกรถหลัก</button></div></form></div></div>`;
}

function maintenanceModal() {
  return `<div class="modal-backdrop" data-close-modal><div class="modal" onclick="event.stopPropagation()"><div class="modal-head"><div><span class="eyebrow">MAINTENANCE HISTORY</span><h2>บันทึกงานซ่อมบำรุง</h2></div><button class="close" data-action="close-modal">×</button></div><form id="maintenanceForm" class="form-grid"><div class="field full"><label>รายการที่ทำ</label><input name="title" placeholder="เช่น เปลี่ยนน้ำมันเครื่อง" maxlength="120" required /></div><div class="field"><label>วันที่</label><input name="serviceDate" type="date" value="${new Date().toISOString().slice(0, 10)}" required /></div><div class="field"><label>เลขไมล์ (กม.)</label><input name="mileage" type="number" min="0" value="${state.vehicle?.mileage || ''}" /></div><div class="field full"><label>หมายเหตุ</label><textarea name="notes" rows="3" maxlength="1000" placeholder="รายละเอียดเพิ่มเติม"></textarea></div><div class="field full"><button class="button">บันทึกประวัติ</button></div></form></div></div>`;
}

function finderModal() {
  return `<div class="modal-backdrop" data-close-modal><div class="modal" onclick="event.stopPropagation()"><div class="modal-head"><div><span class="eyebrow">SMARTFIT AI / DEMO MODE</span><h2>ให้ AI ช่วยหาอะไหล่</h2><p class="muted">บอกอาการรถ แล้ว AI จะจัดลำดับชิ้นส่วนที่เกี่ยวข้อง</p></div><button class="close" data-action="close-modal">×</button></div><form id="finderForm"><div class="field"><label>รถที่ต้องการตรวจสอบ</label><select id="finderVehicle"><option>${esc(vehicleText())}</option></select></div><div class="field" style="margin-top:14px"><label>อาการหรือสิ่งที่กำลังหา</label><textarea id="symptomInput" rows="3" placeholder="เช่น รถเบรกมีเสียง หรือไม่รู้ว่าอะไหล่เรียกว่าอะไร...">${esc(state.symptoms)}</textarea></div><button class="button" style="margin-top:15px">✦ วิเคราะห์ด้วย SmartFit AI</button></form><div id="finderResult"></div></div></div>`;
}

function imageModal() {
  return `<div class="modal-backdrop" data-close-modal><div class="modal" onclick="event.stopPropagation()"><div class="modal-head"><div><span class="eyebrow">VISION AI / DEMO MODE</span><h2>📷 วิเคราะห์รูปอะไหล่</h2><p class="muted">อัปโหลดภาพอะไหล่เพื่อค้นหาสินค้าที่ใกล้เคียง</p></div><button class="close" data-action="close-modal">×</button></div><div class="field"><label>ไฟล์รูปภาพ (สูงสุด 5MB)</label><input id="imageInput" type="file" accept="image/jpeg,image/png,image/webp" /></div><div id="imageResult"></div></div></div>`;
}

function render() {
  const root = document.getElementById('app');
  const hash = location.hash || '#home';
  if (hash.startsWith('#product/')) root.innerHTML = detail(hash.split('/')[1]);
  else if (hash === '#shop') root.innerHTML = shop();
  else if (hash === '#garage') root.innerHTML = garage();
  else if (hash === '#health') root.innerHTML = healthPage();
  else if (hash === '#orders') root.innerHTML = orderHistory();
  else if (hash === '#admin') root.innerHTML = adminPage();
  else root.innerHTML = home();

  if (hash === '#admin' && state.user?.role === 'admin' && state.adminOrders === null) loadAdminData();

  document.getElementById('cartCount').textContent = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  bind();
}

function openModal(content) {
  document.body.insertAdjacentHTML('beforeend', content);
  bind();
}

function bind() {
  document.querySelectorAll('[data-action]').forEach((el) => {
    el.onclick = () => actions(el.dataset.action, el);
  });

  document.querySelectorAll('[data-detail]').forEach((el) => {
    el.onclick = () => { location.hash = `#product/${el.dataset.detail}`; };
  });

  document.querySelectorAll('[data-add]').forEach((el) => {
    el.onclick = () => {
      const id = Number(el.dataset.add);
      const item = state.cart.find((x) => x.id === id);
      if (item) item.quantity += 1;
      else state.cart.push({ id, quantity: 1 });
      save();
      render();
      toast('เพิ่มสินค้าในรถเข็นแล้ว');
    };
  });

  document.querySelectorAll('[data-save]').forEach((el) => {
    el.onclick = () => {
      const id = Number(el.dataset.save);
      state.wishlist = state.wishlist.includes(id) ? state.wishlist.filter((x) => x !== id) : [...state.wishlist, id];
      save();
      render();
    };
  });

  document.getElementById('searchForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = document.getElementById('mainSearch')?.value || '';
    location.hash = '#shop';
    setTimeout(() => {
      document.getElementById('app').innerHTML = shop(query);
      bind();
    }, 0);
  });

  document.getElementById('shopSearch')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = e.target.querySelector('input')?.value || '';
    document.getElementById('app').innerHTML = shop(value);
    bind();
  });

  document.querySelector('[data-close-modal]')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.remove();
  });

  document.getElementById('authForm')?.addEventListener('submit', login);
  document.getElementById('toggleAuthMode')?.addEventListener('click', () => {
    const form = document.getElementById('authForm');
    const nextMode = form?.dataset.mode === 'register' ? 'login' : 'register';
    document.querySelector('.modal-backdrop')?.remove();
    openModal(authModal(nextMode));
  });
  document.getElementById('vehicleForm')?.addEventListener('submit', saveVehicle);
  document.getElementById('maintenanceForm')?.addEventListener('submit', saveMaintenance);
  document.getElementById('checkoutForm')?.addEventListener('submit', startCheckout);
  document.getElementById('storeSettingsForm')?.addEventListener('submit', saveStoreSettings);
  document.getElementById('productForm')?.addEventListener('submit', createProduct);
  document.getElementById('finderForm')?.addEventListener('submit', analyzeSymptoms);
  document.getElementById('imageInput')?.addEventListener('change', analyzeImage);
  document.getElementById('chatForm')?.addEventListener('submit', sendChat);

  document.querySelectorAll('[data-chat]').forEach((btn) => {
    btn.onclick = () => {
      const input = document.getElementById('chatInput');
      input.value = btn.dataset.chat;
      sendChat({ preventDefault: () => {} });
    };
  });

  document.querySelectorAll('[data-stock-save]').forEach((button) => {
    button.onclick = () => saveStock(Number(button.dataset.stockSave));
  });
  document.querySelectorAll('[data-product-save]').forEach((button) => {
    button.onclick = () => saveProduct(Number(button.dataset.productSave));
  });
  document.querySelectorAll('[data-product-save]').forEach((button) => {
    button.onclick = () => saveProduct(Number(button.dataset.productSave));
  });
  document.querySelectorAll('[data-order-id]').forEach((button) => {
    button.onclick = () => advanceOrder(Number(button.dataset.orderId), button.dataset.orderStatus);
  });
}

function actions(action, el) {
  if (action === 'finder') openModal(finderModal());
  if (action === 'retry-products') loadProducts();
  if (action === 'image') openModal(imageModal());
  if (action === 'garage' || action === 'add-vehicle') openModal(vehicleModal());
  if (action === 'maintenance-add') {
    if (state.user && localStorage.getItem('autofix-token')) openModal(maintenanceModal());
    else openModal(authModal());
  }
  if (action === 'auth') openModal(authModal());
  if (action === 'refresh-admin') {
    state.adminOrders = null;
    state.adminStoreSettings = null;
    loadAdminData();
  }
  if (action === 'product-add') openModal(productCreateModal());
  if (action === 'product-add') openModal(productCreateModal());
  if (action === 'refresh-orders') {
    AutoFixAI.listOrders().then((orders) => {
      state.orders = orders;
      save();
      render();
    }).catch((error) => toast(error.message || 'รีเฟรชคำสั่งซื้อไม่สำเร็จ'));
  }
  if (action === 'logout') {
    localStorage.removeItem('autofix-token');
    state.user = null;
    state.vehicle = null;
    state.adminOrders = null;
    state.adminStoreSettings = null;
    state.adminProducts = [];
    save();
    render();
    const userButton = document.querySelector('.user-button');
    userButton.textContent = 'เข้าสู่ระบบ';
    userButton.dataset.action = 'auth';
    document.querySelectorAll('[data-admin-nav]').forEach((link) => { link.hidden = true; });
  }
  if (action === 'close-modal') document.querySelector('.modal-backdrop')?.remove();
  if (action === 'remove-vehicle') {
    const clearVehicle = () => { state.vehicle = null; save(); render(); toast('ลบรถออกจาก Garage แล้ว'); };
    if (state.vehicle?.id && localStorage.getItem('autofix-token')) {
      AutoFixAI.deleteVehicle(state.vehicle.id).then(clearVehicle).catch((error) => toast(error.message || 'ลบรถไม่สำเร็จ'));
    } else {
      clearVehicle();
    }
  }
  if (action === 'back') history.back();
  if (action === 'cart') openModal(cartModal());
  if (action === 'checkout') {
    if (!state.user || !localStorage.getItem('autofix-token')) {
      document.querySelector('.modal-backdrop')?.remove();
      openModal(authModal());
      toast('เข้าสู่ระบบเพื่อดำเนินการสั่งซื้อ');
      return;
    }
    if (!state.cart.length) return toast('รถเข็นยังว่าง');
    openModal(checkoutModal());
  }
  if (action === 'check') checkProduct(Number(el.dataset.product));
  if (action === 'chat') document.getElementById('chatPanel').hidden = false;
  if (action === 'chat-close') document.getElementById('chatPanel').hidden = true;
  if (action === 'menu') {
    const menu = document.getElementById('mobileNav');
    menu.hidden = !menu.hidden;
  }
}

async function analyzeSymptoms(e) {
  e.preventDefault();
  const result = document.getElementById('finderResult');
  state.symptoms = document.getElementById('symptomInput').value.trim();
  result.innerHTML = '<div class="empty">กำลังวิเคราะห์<span class="loading-dots">...</span></div>';

  try {
    const response = await AutoFixAI.analyzeSymptoms(state.symptoms, state.vehicle);
    result.innerHTML = `<div class="result-list"><p>${esc(response.summary)}</p>${response.results.map((r) => `<div class="result-row"><div><strong>${esc(r.name)}</strong><small class="muted">${esc(r.type)}</small></div><span class="confidence">${r.confidence}%</span></div>`).join('')}</div><button class="button" data-action="show-results">ดูอะไหล่ที่แนะนำ →</button>`;
  } catch (error) {
    result.innerHTML = `<p class="fit bad">${esc(error.message)}</p>`;
  }

  document.querySelector('[data-action="show-results"]')?.addEventListener('click', () => {
    document.querySelector('.modal-backdrop')?.remove();
    location.hash = '#shop';
  });
}

async function analyzeImage(e) {
  const file = e.target.files[0];
  const result = document.getElementById('imageResult');
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    result.innerHTML = '<p style="color:var(--red)">ไฟล์ใหญ่เกิน 5MB</p>';
    return;
  }

  result.innerHTML = '<div class="empty">กำลังวิเคราะห์ภาพ...</div>';
  try {
    const response = await AutoFixAI.identifyImage(file, state.vehicle);
    result.innerHTML = `<div class="score-card"><span class="eyebrow">DEMO VISION RESULT</span><h2>${esc(response.part)}</h2><p class="muted">${esc(response.category)}</p><div class="score">${response.confidence}%</div><p>เราพบอะไหล่ที่คล้ายกัน ${response.matches.length} รายการ</p><small class="muted">ผลลัพธ์ตัวอย่าง ยังไม่ได้ใช้โมเดลจำแนกภาพจริง</small></div><div class="grid">${response.matches.map(productCard).join('')}</div>`;
    bind();
  } catch (error) {
    result.innerHTML = `<p class="fit bad">${esc(error.message)}</p>`;
  }
}

async function checkProduct(id) {
  const product = PRODUCTS.find((p) => p.id === id);
  try {
    const response = await AutoFixAI.checkCompatibility(product, state.vehicle);
    openModal(`<div class="modal-backdrop" data-close-modal><div class="modal" onclick="event.stopPropagation()"><div class="modal-head"><div><span class="eyebrow">SMARTFIT EXPLANATION</span><h2>${response.status === 'compatible' ? '🟢 เหมาะกับรถของคุณ' : response.status === 'check' ? '🟡 ควรตรวจสอบเพิ่มเติม' : '🔴 ไม่รองรับรถของคุณ'}</h2></div><button class="close" data-action="close-modal">×</button></div><div class="score-card"><div class="score">${response.score}%</div><p>รถ: ${esc(vehicleText())}</p><p>สินค้า: ${esc(product.name)}</p></div><ul class="reason-list">${response.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul><p class="muted">⚠ กรุณาตรวจสอบ Part Number ก่อนสั่งซื้อ</p></div></div>`);
  } catch (error) {
    toast(error.message || 'ตรวจสอบอะไหล่ไม่สำเร็จ');
  }
}

async function saveVehicle(e) {
  e.preventDefault();
  if (!state.user || !localStorage.getItem('autofix-token')) {
    document.querySelector('.modal-backdrop')?.remove();
    openModal(authModal());
    toast('เข้าสู่ระบบก่อนบันทึกรถ');
    return;
  }
  const data = Object.fromEntries(new FormData(e.target));
  try {
    const record = { ...data, year: Number(data.year), mileage: Number(data.mileage || 0) };
    state.vehicle = state.vehicle?.id
      ? await AutoFixAI.updateVehicle(state.vehicle.id, record)
      : await AutoFixAI.saveVehicle(record);
    save();
    document.querySelector('.modal-backdrop')?.remove();
    render();
    toast(`บันทึก ${data.brand} ${data.model} แล้ว`);
  } catch (error) {
    toast(error.message || 'บันทึกรถไม่สำเร็จ');
  }
}

async function saveMaintenance(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget));
  try {
    const record = await AutoFixAI.createMaintenance({
      ...data,
      mileage: data.mileage ? Number(data.mileage) : null,
      vehicleId: state.vehicle?.id || null
    });
    state.maintenance.unshift(record);
    document.querySelector('.modal-backdrop')?.remove();
    render();
    toast('บันทึกประวัติการบำรุงรักษาแล้ว');
  } catch (error) {
    toast(error.message || 'บันทึกประวัติไม่สำเร็จ');
  }
}

async function startCheckout(e) {
  e.preventDefault();
  const shipping = Object.fromEntries(new FormData(e.currentTarget));
  const submitButton = e.currentTarget.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'กำลังเตรียมการชำระเงิน...';
  try {
    const checkout = await AutoFixAI.createCheckout(state.cart, shipping);
    window.location.assign(checkout.checkoutUrl);
  } catch (error) {
    submitButton.disabled = false;
    submitButton.textContent = 'ไปชำระเงิน';
    toast(error.message || 'เริ่มชำระเงินไม่สำเร็จ');
  }
}

async function saveStock(productId) {
  const input = document.querySelector(`[data-stock-value="${productId}"]`);
  try {
    const product = await AutoFixAI.updateStock(productId, Number(input?.value));
    state.adminProducts = state.adminProducts.map((item) => item.id === product.id ? product : item);
    PRODUCTS = PRODUCTS.map((item) => item.id === product.id ? { ...item, ...product } : item);
    render();
    toast(`อัปเดตสต็อก ${product.name} แล้ว`);
  } catch (error) {
    toast(error.message || 'บันทึกสต็อกไม่สำเร็จ');
  }
}

async function saveProduct(productId) {
  const product = state.adminProducts.find((item) => item.id === productId);
  const price = document.querySelector(`[data-product-price="${productId}"]`);
  const stock = document.querySelector(`[data-stock-value="${productId}"]`);
  if (!product || !price || !stock) return;
  try {
    await AutoFixAI.updateProduct(productId, { price: Number(price.value), stockQuantity: Number(stock.value) });
    await Promise.all([loadProducts(), AutoFixAI.listAdminProducts().then((products) => { state.adminProducts = products; })]);
    render();
    toast(`บันทึกสินค้า ${product.name} แล้ว`);
  } catch (error) {
    toast(error.message || 'บันทึกสินค้าไม่สำเร็จ');
  }
}

async function createProduct(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget));
  let fit;
  try {
    fit = data.fitJson.trim() ? JSON.parse(data.fitJson) : [];
    if (!Array.isArray(fit)) throw new Error('ข้อมูลรถที่รองรับต้องเป็น JSON array');
  } catch (error) {
    toast(error.message || 'ข้อมูลรถที่รองรับต้องเป็น JSON ที่ถูกต้อง');
    return;
  }
  try {
    await AutoFixAI.createProduct({ ...data, price: Number(data.price), stockQuantity: 0, fit });
    state.adminOrders = null;
    state.adminStoreSettings = null;
    state.adminLoading = false;
    document.querySelector('.modal-backdrop')?.remove();
    loadAdminData();
    await loadProducts();
    toast('เพิ่มสินค้าแล้ว กรุณาบันทึกสต็อกจริงก่อนเปิดขาย');
  } catch (error) {
    toast(error.message || 'เพิ่มสินค้าไม่สำเร็จ');
  }
}

async function saveStoreSettings(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget));
  try {
    state.adminStoreSettings = await AutoFixAI.saveStoreSettings({
      shippingFeeThb: Number(data.shippingFeeThb),
      taxPolicy: data.taxPolicy,
      taxPolicyConfirmed: data.taxPolicyConfirmed === 'on'
    });
    state.storeConfig = await AutoFixAI.storeConfig();
    render();
    toast('บันทึกนโยบายค่าส่งและภาษีแล้ว');
  } catch (error) {
    toast(error.message || 'บันทึกนโยบายร้านไม่สำเร็จ');
  }
}

async function advanceOrder(orderId, status) {
  try {
    const updated = await AutoFixAI.updateOrderStatus(orderId, status);
    state.adminOrders = state.adminOrders.map((order) => order.id === updated.id ? updated : order);
    render();
    toast(`อัปเดตคำสั่งซื้อ #${orderId} แล้ว`);
  } catch (error) {
    toast(error.message || 'อัปเดตสถานะไม่สำเร็จ');
  }
}

async function handlePaymentReturn() {
  const params = new URLSearchParams(location.search);
  const payment = params.get('payment');
  const orderId = params.get('order_id');
  if (!payment || !orderId) return;

  try {
    if (payment === 'cancelled') {
      const currentOrder = await AutoFixAI.getOrder(orderId);
      if (currentOrder.status === 'pending_payment') await AutoFixAI.cancelCheckout(orderId);
      toast('ยกเลิกการชำระเงินแล้ว สต็อกถูกคืนเรียบร้อย');
    } else if (payment === 'success') {
      let order;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        order = await AutoFixAI.getOrder(orderId);
        if (order.status !== 'pending_payment') break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (order?.status === 'paid') {
        state.cart = [];
        toast('ชำระเงินสำเร็จ');
      } else {
        toast('รับข้อมูลการชำระเงินแล้ว กำลังยืนยันกับ Stripe');
      }
    }
    state.orders = await AutoFixAI.listOrders();
    save();
    history.replaceState({}, '', '/#orders');
    render();
  } catch (error) {
    toast(error.message || 'ตรวจสอบสถานะการชำระเงินไม่สำเร็จ');
  }
}

async function login(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const mode = form.dataset.mode || 'login';
  const data = Object.fromEntries(new FormData(form));

  try {
    const response = await fetch(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!response.ok) {
      toast(result.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      return;
    }

    const user = result.user || { name: data.name || 'AutoFix User', email: data.email };
    localStorage.setItem('autofix-token', result.token);
    state.user = { id: user.id, name: user.name, email: user.email, phone: user.phone || '', role: user.role || 'customer' };
    const vehicles = await AutoFixAI.listVehicles();
    state.vehicle = vehicles[0] || null;
    state.orders = await AutoFixAI.listOrders();
    state.maintenance = await AutoFixAI.listMaintenance();
    save();
    document.querySelector('.modal-backdrop')?.remove();
    const userButton = document.querySelector('.user-button');
    if (userButton) userButton.textContent = `สวัสดี ${state.user.name} · ออกจากระบบ`;
    if (userButton) userButton.dataset.action = 'logout';
    document.querySelectorAll('[data-admin-nav]').forEach((link) => { link.hidden = state.user.role !== 'admin'; });
    render();
    toast(mode === 'register' ? 'สมัครสมาชิกสำเร็จ เข้าสู่ระบบเรียบร้อย' : 'เข้าสู่ระบบสำเร็จ ยินดีต้อนรับกลับครับ');
  } catch (error) {
    toast('ไม่สามารถติดต่อ API ได้ กรุณาลองใหม่อีกครั้ง');
  }
}

async function sendChat(e) {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  const messages = document.getElementById('chatMessages');
  messages.insertAdjacentHTML('beforeend', `<div class="message user">${esc(text)}</div><div class="message ai">กำลังคิด...</div>`);
  input.value = '';

  try {
    const answer = await AutoFixAI.chat(text, state.vehicle);
    messages.lastElementChild.innerHTML = esc(answer);
  } catch (error) {
    messages.lastElementChild.innerHTML = esc(error.message || 'ติดต่อผู้ช่วยไม่สำเร็จ');
  }
  messages.scrollTop = messages.scrollHeight;
}

window.addEventListener('hashchange', render);
document.addEventListener('DOMContentLoaded', () => {
  render();
  const userButton = document.querySelector('.user-button');
  userButton.textContent = state.user ? `สวัสดี ${state.user.name} · ออกจากระบบ` : 'เข้าสู่ระบบ';
  document.querySelectorAll('[data-admin-nav]').forEach((link) => { link.hidden = state.user?.role !== 'admin'; });
  if (state.user && localStorage.getItem('autofix-token')) {
    userButton.dataset.action = 'logout';
    Promise.all([AutoFixAI.listVehicles(), AutoFixAI.listOrders(), AutoFixAI.listMaintenance()]).then(([vehicles, orders, maintenance]) => {
      state.vehicle = vehicles[0] || null;
      state.orders = orders;
      state.maintenance = maintenance;
      save();
      render();
    }).catch(() => {
      localStorage.removeItem('autofix-token');
      state.user = null;
      state.vehicle = null;
      save();
      userButton.textContent = 'เข้าสู่ระบบ';
      userButton.dataset.action = 'auth';
    });
  }
  loadProducts();
  handlePaymentReturn();
});
