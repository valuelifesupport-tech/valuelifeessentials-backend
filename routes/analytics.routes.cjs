const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// GET Admin Dashboard Analytics
router.get('/api/admin/analytics', requireAdminAuth, async (req, res) => {
  try {
    // 1. Orders stats
    let totalRevenue = 0;
    let totalOrders = 0;
    let pendingOrders = 0;

    const myOrders = await executeMySQL('SELECT total_amount, order_status, payment_status, created_at FROM orders') || [];
    totalOrders = myOrders.length;
    myOrders.forEach(o => {
      totalRevenue += Number(o.total_amount || 0);
      if (o.order_status === 'PENDING') pendingOrders++;
    });

    // 2. Products stats
    const myProds = await executeMySQL('SELECT id, stock_quantity FROM products') || [];
    let lowStockCount = myProds.filter(p => Number(p.stock_quantity || 0) <= 5).length;

    // 3. Reviews stats
    const myRevs = await executeMySQL('SELECT id FROM product_reviews') || [];

    // 4. 7-Day sales chart data
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTotal = myOrders
        .filter(o => o.created_at && o.created_at.toString().startsWith(dateStr))
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      last7Days.push({ date: dateStr, sales: dayTotal });
    }

    res.json({
      revenue: totalRevenue,
      total_orders: totalOrders,
      pending_orders: pendingOrders,
      products_count: myProds.length,
      low_stock_count: lowStockCount,
      reviews_count: myRevs.length,
      sales_chart: last7Days
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET GST Report Summary
router.get('/api/admin/gst-report/summary', requireAdminAuth, async (req, res) => {
  try {
    const orders = await executeMySQL('SELECT subtotal, tax_amount, total_amount, created_at FROM orders') || [];
    let totalTax = 0;
    orders.forEach(o => totalTax += Number(o.tax_amount || 0));

    res.json({
      total_invoices: orders.length,
      total_tax_collected: totalTax,
      cgst_collected: totalTax / 2,
      sgst_collected: totalTax / 2,
      igst_collected: 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Track Analytics Event
router.post('/api/analytics/track', (req, res) => {
  const { event_name, event_data } = req.body || {};
  // Non-blocking log
  res.json({ success: true });
});

module.exports = router;
