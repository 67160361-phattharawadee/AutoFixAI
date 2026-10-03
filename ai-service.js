const AutoFixAI = (() => {
  async function request(url, options = {}) {
    const token = localStorage.getItem('autofix-token');
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || `Request failed (${response.status})`);
    return result;
  }

  const post = (url, data) => request(url, { method: 'POST', body: JSON.stringify(data) });

  return {
    health: () => request('/api/health'),
    storeConfig: () => request('/api/storefront/config'),
    listProducts: (query = '') => request(`/api/products${query ? `?q=${encodeURIComponent(query)}` : ''}`),
    listVehicles: () => request('/api/vehicles'),
    saveVehicle: (vehicle) => post('/api/vehicles', vehicle),
    updateVehicle: (id, vehicle) => request(`/api/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(vehicle) }),
    deleteVehicle: (id) => request(`/api/vehicles/${id}`, { method: 'DELETE' }),
    listOrders: () => request('/api/orders'),
    getOrder: (id) => request(`/api/orders/${id}`),
    createCheckout: (items, shipping) => post('/api/orders/checkout', { items, shipping }),
    cancelCheckout: (id) => post(`/api/orders/${id}/cancel-payment`, {}),
    listAdminProducts: () => request('/api/admin/products'),
    createProduct: (product) => post('/api/admin/products', product),
    updateProduct: (id, product) => request(`/api/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(product) }),
    updateStock: (id, stockQuantity) => request(`/api/admin/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ stockQuantity }) }),
    getStoreSettings: () => request('/api/admin/store-settings'),
    saveStoreSettings: (settings) => request('/api/admin/store-settings', { method: 'PUT', body: JSON.stringify(settings) }),
    listAdminOrders: () => request('/api/admin/orders'),
    updateOrderStatus: (id, status) => request(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    listMaintenance: () => request('/api/maintenance'),
    createMaintenance: (record) => post('/api/maintenance', record),
    analyzeSymptoms: (query, vehicle) => post('/api/ai/symptoms', { query, vehicle }),
    identifyImage: async (file, vehicle) => {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('อ่านไฟล์ภาพไม่สำเร็จ'));
        reader.readAsDataURL(file);
      });
      return post('/api/ai/identify', { image, vehicle });
    },
    checkCompatibility: (product, vehicle) => post('/api/ai/check', { productId: product.id, vehicle }),
    chat: async (message, vehicle) => (await post('/api/ai/chat', { message, vehicle })).answer
  };
})();
