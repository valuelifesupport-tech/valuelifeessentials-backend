// SHIPROCKET LOGISTICS & SHIPPING SERVICE
// Deep integration with Shiprocket API v2 (https://apiv2.shiprocket.in/v1/external/)

let cachedToken = null;
let tokenExpiresAt = 0;

const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

class ShiprocketService {
  constructor() {
    this.email = process.env.SHIPROCKET_EMAIL || 'valuelifesupport@gmail.com';
    this.apiKey = process.env.SHIPROCKET_API_KEY || 'CqMn1w8MOq5s%%u$&y2JBuiJqqn$Wb3j';
    this.defaultPickupPincode = process.env.SHIPROCKET_DEFAULT_PICKUP_PINCODE || '400001';
  }

  // 1. AUTHENTICATE AND OBTAIN 10-DAY JWT TOKEN
  async getAuthToken(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedToken && now < tokenExpiresAt) {
      return cachedToken;
    }

    try {
      const res = await fetch(`${SHIPROCKET_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.email,
          password: this.apiKey
        })
      });

      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.message || `Shiprocket authentication failed with status ${res.status}`);
      }

      cachedToken = data.token;
      // Tokens are valid for 240 hours (10 days); we cache for 9 days
      tokenExpiresAt = now + (9 * 24 * 60 * 60 * 1000);
      console.log('✅ Shiprocket JWT Token refreshed successfully');
      return cachedToken;
    } catch (err) {
      console.error('❌ Shiprocket Auth Error:', err.message);
      throw err;
    }
  }

  // Helper for authenticated API calls with auto-retry on token expiration
  async makeRequest(endpoint, options = {}) {
    let token = await this.getAuthToken();
    const url = endpoint.startsWith('http') ? endpoint : `${SHIPROCKET_BASE_URL}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    };

    let res = await fetch(url, { ...options, headers });

    // Auto-refresh token if expired (401) and retry once
    if (res.status === 401) {
      console.warn('⚠️ Shiprocket token rejected (401), refreshing token...');
      token = await this.getAuthToken(true);
      headers['Authorization'] = `Bearer ${token}`;
      res = await fetch(url, { ...options, headers });
    }

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  // 2. CHECK COURIER SERVICEABILITY & RATES FOR A PINCODE
  async checkServiceability({ pickupPincode, deliveryPincode, weight = 0.5, cod = 0 }) {
    const pickup = pickupPincode || this.defaultPickupPincode;
    const delivery = deliveryPincode;
    if (!delivery || String(delivery).length !== 6) {
      throw new Error('Valid 6-digit delivery pincode is required');
    }

    const isCodParam = cod ? 1 : 0;
    const query = new URLSearchParams({
      pickup_postcode: String(pickup),
      delivery_postcode: String(delivery),
      weight: String(weight || 0.5),
      cod: String(isCodParam)
    });

    const { ok, status, data } = await this.makeRequest(`/courier/serviceability/?${query.toString()}`);
    if (!ok) {
      throw new Error(data.message || `Serviceability check failed (Status ${status})`);
    }

    const couriers = data?.data?.available_courier_companies || [];
    const isServiceable = couriers.length > 0;

    return {
      success: true,
      serviceable: isServiceable,
      pickup_postcode: pickup,
      delivery_postcode: delivery,
      couriers_count: couriers.length,
      couriers: couriers.map(c => ({
        id: c.courier_company_id,
        name: c.courier_name,
        rate: Number(c.rate || 0),
        etd: c.etd || `${c.estimated_delivery_days || 3} Days`,
        estimated_delivery_days: c.estimated_delivery_days || 3,
        rating: c.rating || 4.0,
        cod_available: Boolean(c.cod === 1 || !isCodParam),
        is_surface: Boolean(c.is_surface)
      })),
      recommended_courier: couriers[0] ? {
        id: couriers[0].courier_company_id,
        name: couriers[0].courier_name,
        rate: Number(couriers[0].rate || 0),
        estimated_days: couriers[0].estimated_delivery_days || 3
      } : null
    };
  }

  // 3. CREATE ORDER / SHIPMENT IN SHIPROCKET
  async createOrder({ order, items, pickupLocation = 'Primary' }) {
    if (!order) throw new Error('Order data is required to create Shiprocket shipment');

    const orderNumber = order.order_number || `VL-${order.id || Date.now()}`;
    const orderDate = order.created_at ? new Date(order.created_at).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');

    const rawAddress = order.shipping_address || 'Customer Home Address';
    const cleanPhone = String(order.customer_phone || '').replace(/\D/g, '').slice(-10) || '9876543210';
    
    const pincodeMatch = rawAddress.match(/\b\d{6}\b/);
    const billingPincode = pincodeMatch ? pincodeMatch[0] : (order.pincode || '400001');

    const nameParts = (order.customer_name || 'Valued Customer').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Valued';
    const lastName = nameParts.slice(1).join(' ') || 'Customer';

    const orderItems = (items && items.length > 0) ? items : [{
      product_name: 'Organic Essentials Pack',
      price: order.total_amount || 100,
      quantity: 1
    }];

    const formattedItems = orderItems.map((item, idx) => ({
      name: item.product_name || item.product_title || 'ValueLife Organic Product',
      sku: item.sku || `VL-SKU-${item.product_id || idx + 1}-${item.variant_id || 0}`,
      units: Number(item.quantity) || 1,
      selling_price: Number(item.price || item.price_inr || 100),
      discount: 0,
      tax: 0,
      hsn: 2106
    }));

    const isCod = order.payment_mode === 'COD';
    const subtotal = Number(order.total_amount || 0);

    const payload = {
      order_id: String(order.id || orderNumber),
      order_date: orderDate,
      pickup_location: pickupLocation || 'Primary',
      channel_id: '',
      comment: order.order_notes || order.remark || 'ValueLife Organic Superstore Order',
      billing_customer_name: firstName,
      billing_last_name: lastName,
      billing_address: rawAddress.slice(0, 120),
      billing_address_2: rawAddress.length > 120 ? rawAddress.slice(120, 240) : '',
      billing_city: order.state_name || 'Mumbai',
      billing_pincode: String(billingPincode),
      billing_state: order.state_name || 'Maharashtra',
      billing_country: order.country || 'India',
      billing_email: order.customer_email || 'valuelifesupport@gmail.com',
      billing_phone: cleanPhone,
      shipping_is_billing: true,
      order_items: formattedItems,
      payment_method: isCod ? 'COD' : 'Prepaid',
      shipping_charges: 0,
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: 0,
      sub_total: subtotal,
      length: 12,
      breadth: 12,
      height: 10,
      weight: 0.5
    };

    const { ok, status, data } = await this.makeRequest('/orders/create/adhoc', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!ok || !data?.order_id) {
      throw new Error(data?.message || JSON.stringify(data?.errors) || `Failed to create order in Shiprocket (Status ${status})`);
    }

    return {
      success: true,
      shiprocket_order_id: data.order_id,
      shipment_id: data.shipment_id,
      status: data.status,
      status_code: data.status_code,
      awb_code: data.awb_code || null,
      courier_company_id: data.courier_company_id || null,
      courier_name: data.courier_name || null
    };
  }

  // 4. GENERATE AWB & ASSIGN COURIER PARTNER
  async assignAwb({ shipmentId, courierId }) {
    if (!shipmentId) throw new Error('shipment_id is required to assign AWB');

    const payload = {
      shipment_id: String(shipmentId)
    };
    if (courierId) {
      payload.courier_id = String(courierId);
    }

    const { ok, status, data } = await this.makeRequest('/courier/assign/awb', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!ok || !data?.response?.data?.awb_code) {
      const errorMsg = data?.message || data?.response?.data?.awb_assign_error || 'Failed to assign AWB';
      throw new Error(`Shiprocket AWB Assignment Error: ${errorMsg}`);
    }

    const awbData = data.response.data;
    return {
      success: true,
      awb_code: awbData.awb_code,
      courier_company_id: awbData.courier_company_id,
      courier_name: awbData.courier_name,
      shipment_id: shipmentId,
      assigned_date_time: awbData.assigned_date_time
    };
  }

  // 5. SCHEDULE COURIER PICKUP
  async requestPickup({ shipmentIds, pickupDate = null }) {
    const ids = Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds];
    if (ids.length === 0) throw new Error('At least one shipment_id is required for pickup request');

    const payload = {
      shipment_id: ids.map(String)
    };
    if (pickupDate) {
      payload.pickup_date = [pickupDate];
    }

    const { ok, status, data } = await this.makeRequest('/courier/generate/pickup', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!ok) {
      throw new Error(data?.message || `Failed to schedule pickup (Status ${status})`);
    }

    return {
      success: true,
      pickup_status: data.response?.pickup_status || 1,
      pickup_scheduled_date: data.response?.pickup_scheduled_date || new Date().toISOString().slice(0, 10),
      pickup_token_number: data.response?.pickup_token_number || null,
      data: data.response
    };
  }

  // 6. GENERATE SHIPPING LABEL (PDF)
  async generateLabel(shipmentIds) {
    const ids = Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds];
    const payload = { shipment_id: ids.map(String) };

    const { ok, status, data } = await this.makeRequest('/courier/generate/label', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!ok || !data?.label_url) {
      throw new Error(data?.message || 'Failed to generate shipping label PDF');
    }

    return {
      success: true,
      label_created: data.label_created,
      label_url: data.label_url
    };
  }

  // 7. GENERATE TAX INVOICE (PDF)
  async generateInvoice(orderIds) {
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    const payload = { ids: ids.map(String) };

    const { ok, status, data } = await this.makeRequest('/orders/print/invoice', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!ok || !data?.invoice_url) {
      throw new Error(data?.message || 'Failed to generate invoice PDF');
    }

    return {
      success: true,
      is_invoice_created: data.is_invoice_created,
      invoice_url: data.invoice_url
    };
  }

  // 8. GENERATE MANIFEST (PDF)
  async generateManifest(shipmentIds) {
    const ids = Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds];
    const payload = { shipment_id: ids.map(String) };

    const { ok, status, data } = await this.makeRequest('/manifests/generate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!ok || !data?.manifest_url) {
      throw new Error(data?.message || 'Failed to generate manifest PDF');
    }

    return {
      success: true,
      manifest_url: data.manifest_url
    };
  }

  // 9. REAL-TIME TRACKING BY AWB CODE OR ORDER ID
  async trackShipment(awbOrOrderId) {
    if (!awbOrOrderId) throw new Error('AWB code or Order ID required for tracking');

    const { ok, status, data } = await this.makeRequest(`/courier/track/awb/${encodeURIComponent(awbOrOrderId)}`);
    if (ok && data?.tracking_data?.track_status) {
      const td = data.tracking_data;
      const shipmentTrack = td.shipment_track?.[0] || {};
      const activities = td.shipment_track_activities || [];

      return {
        success: true,
        awb: awbOrOrderId,
        current_status: shipmentTrack.current_status || 'In Transit',
        status_code: shipmentTrack.status_code || '',
        courier_name: shipmentTrack.courier_name || '',
        expected_date: shipmentTrack.expected_date || '',
        destination: shipmentTrack.destination || '',
        origin: shipmentTrack.origin || '',
        scans: activities.map(a => ({
          date: a.date,
          status: a.activity,
          location: a.location,
          sr_status_label: a['sr-status-label']
        }))
      };
    }

    const ordRes = await this.makeRequest(`/courier/track?order_id=${encodeURIComponent(awbOrOrderId)}`);
    if (ordRes.ok && ordRes.data) {
      return {
        success: true,
        data: ordRes.data
      };
    }

    return {
      success: false,
      message: 'Tracking information not yet updated by courier'
    };
  }

  // 10. CANCEL SHIPMENT / ORDER IN SHIPROCKET
  async cancelOrder(shiprocketOrderIds) {
    const ids = Array.isArray(shiprocketOrderIds) ? shiprocketOrderIds : [shiprocketOrderIds];
    const payload = { ids: ids.map(String) };

    const { ok, status, data } = await this.makeRequest('/orders/cancel', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return {
      success: ok,
      message: data?.message || (ok ? 'Shipment cancelled in Shiprocket' : 'Failed to cancel shipment'),
      data
    };
  }

  // 11. FETCH ACCOUNT OVERVIEW (FOR ADMIN DASHBOARD & SETTINGS)
  async getAccountOverview() {
    try {
      const [pickupsRes, walletRes] = await Promise.all([
        this.makeRequest('/settings/company/pickup'),
        this.makeRequest('/wallet/data')
      ]);

      return {
        success: true,
        connected: true,
        email: this.email,
        company_name: pickupsRes?.data?.data?.company_name || 'ValueLife Essentials',
        pickup_addresses: pickupsRes?.data?.data?.shipping_address || [],
        wallet_balance: walletRes?.data?.data?.balance || 0
      };
    } catch (err) {
      return {
        success: false,
        connected: false,
        error: err.message
      };
    }
  }
}

const shiprocketService = new ShiprocketService();

module.exports = {
  shiprocketService,
  ShiprocketService
};
