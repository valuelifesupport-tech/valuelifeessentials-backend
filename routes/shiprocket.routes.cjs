const express = require('express');
const router = express.Router();
const { shiprocketService } = require('../utils/shiprocket.service.cjs');
const { executeMySQL, db } = require('../config/database.cjs');
const { sendEmailNotification } = require('../config/email.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// 1. PUBLIC: CHECK PINCODE SERVICEABILITY & ESTIMATED DELIVERY SPEED
router.post('/api/shipping/shiprocket/check-serviceability', async (req, res) => {
  try {
    const { delivery_pincode, pickup_pincode, weight, cod } = req.body;
    if (!delivery_pincode || String(delivery_pincode).trim().length !== 6) {
      return res.status(400).json({ error: 'Valid 6-digit delivery pincode is required' });
    }

    const result = await shiprocketService.checkServiceability({
      deliveryPincode: String(delivery_pincode).trim(),
      pickupPincode: pickup_pincode,
      weight,
      cod
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. ADMIN/INTERNAL: CREATE SHIPMENT IN SHIPROCKET FOR AN ORDER
router.post('/api/shipping/shiprocket/create-shipment', async (req, res) => {
  try {
    const { order_id, pickup_location = 'Primary' } = req.body;
    if (!order_id) {
      return res.status(400).json({ error: 'order_id is required' });
    }

    // Fetch order record
    const ordRows = await executeMySQL('SELECT * FROM orders WHERE id = ? OR order_number = ?', [order_id, order_id]);
    if (!ordRows || ordRows.length === 0) {
      return res.status(404).json({ error: 'Order not found in database' });
    }
    const order = ordRows[0];

    // Fetch order items
    let items = await executeMySQL('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    if (!items || items.length === 0) {
      try {
        items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      } catch (e) {}
    }

    // Push to Shiprocket
    const srResult = await shiprocketService.createOrder({
      order,
      items: items || [],
      pickupLocation: pickup_location
    });

    // Update orders table with Shiprocket identifiers
    await executeMySQL(
      `UPDATE orders SET 
        shiprocket_order_id = ?, 
        shiprocket_shipment_id = ?, 
        shiprocket_status = 'CREATED' 
      WHERE id = ?`,
      [srResult.shiprocket_order_id, srResult.shipment_id, order.id]
    );

    try {
      db.prepare(`UPDATE orders SET shiprocket_order_id = ?, shiprocket_shipment_id = ?, shiprocket_status = 'CREATED' WHERE id = ?`)
        .run(srResult.shiprocket_order_id, srResult.shipment_id, order.id);
    } catch (e) {}

    res.json({
      success: true,
      message: 'Shipment created successfully in Shiprocket',
      ...srResult
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. ADMIN: ASSIGN COURIER & GENERATE AWB NUMBER
router.post('/api/shipping/shiprocket/assign-awb', async (req, res) => {
  try {
    const { order_id, shipment_id, courier_id } = req.body;
    let targetShipmentId = shipment_id;
    let orderRecord = null;

    if (!targetShipmentId && order_id) {
      const ordRows = await executeMySQL('SELECT * FROM orders WHERE id = ? OR order_number = ?', [order_id, order_id]);
      if (ordRows && ordRows.length > 0) {
        orderRecord = ordRows[0];
        targetShipmentId = orderRecord.shiprocket_shipment_id;
      }
    }

    if (!targetShipmentId) {
      return res.status(400).json({ error: 'shipment_id or valid order_id with existing shipment is required' });
    }

    const awbResult = await shiprocketService.assignAwb({
      shipmentId: targetShipmentId,
      courierId: courier_id
    });

    // Update database with AWB and mark order as SHIPPED
    if (orderRecord || order_id) {
      const targetId = orderRecord ? orderRecord.id : order_id;
      await executeMySQL(
        `UPDATE orders SET 
          shiprocket_awb = ?, 
          tracking_number = ?, 
          courier_name = ?, 
          shiprocket_courier_id = ?, 
          shiprocket_courier_name = ?, 
          order_status = 'SHIPPED', 
          shiprocket_status = 'AWB_ASSIGNED' 
        WHERE id = ? OR order_number = ?`,
        [
          awbResult.awb_code,
          awbResult.awb_code,
          awbResult.courier_name,
          awbResult.courier_company_id || null,
          awbResult.courier_name,
          targetId,
          targetId
        ]
      );

      try {
        db.prepare(`
          UPDATE orders SET 
            shiprocket_awb = ?, 
            tracking_number = ?, 
            courier_name = ?, 
            order_status = 'SHIPPED', 
            shiprocket_status = 'AWB_ASSIGNED' 
          WHERE id = ? OR order_number = ?
        `).run(awbResult.awb_code, awbResult.awb_code, awbResult.courier_name, targetId, targetId);
      } catch (e) {}

      // Dispatch Order Dispatched / Shipped Email with Tracking Link
      const customerEmail = orderRecord?.customer_email;
      if (customerEmail) {
        const orderNum = orderRecord.order_number;
        sendEmailNotification(
          customerEmail,
          `Your Order #${orderNum} Has Shipped! | ValueLife Essentials`,
          `<div style="font-family: Arial, sans-serif; padding: 25px; color: #164e3f; max-width: 600px; margin: 0 auto; border: 1px solid #bbf7d0; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #164e3f; margin-bottom: 8px;">Great news, your order is on the way! 🚚</h2>
            <p style="color: #475569; font-size: 14px;">Your order <b>#${orderNum}</b> has been packed and handed over to our courier partner <b>${awbResult.courier_name}</b>.</p>
            <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 4px 0; font-size: 14px;"><b>Order Number:</b> #${orderNum}</p>
              <p style="margin: 4px 0; font-size: 14px;"><b>Courier Partner:</b> ${awbResult.courier_name}</p>
              <p style="margin: 4px 0; font-size: 14px;"><b>AWB / Tracking Number:</b> <span style="font-family: monospace; font-weight: bold; color: #047857;">${awbResult.awb_code}</span></p>
              <p style="margin: 4px 0; font-size: 14px;"><b>Delivery Address:</b> ${orderRecord.shipping_address}</p>
            </div>
            <p style="color: #475569; font-size: 14px;">You can track real-time delivery milestones anytime on <a href="${process.env.FRONTEND_URL || ''}" style="color: #164e3f; font-weight: bold;">valuelifeessentials.com</a> under your account profile.</p>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">Thank you for choosing pure, certified organic wellness!</p>
          </div>`
        ).catch(e => console.warn('Shipping email warning:', e.message));
      }
    }

    res.json({
      success: true,
      message: 'AWB generated and courier assigned successfully',
      ...awbResult
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. ADMIN: SCHEDULE COURIER PICKUP
router.post('/api/shipping/shiprocket/request-pickup', async (req, res) => {
  try {
    const { shipment_ids, order_id, pickup_date } = req.body;
    let targetIds = shipment_ids;

    if (!targetIds && order_id) {
      const ordRows = await executeMySQL('SELECT shiprocket_shipment_id FROM orders WHERE id = ? OR order_number = ?', [order_id, order_id]);
      if (ordRows && ordRows[0]?.shiprocket_shipment_id) {
        targetIds = [ordRows[0].shiprocket_shipment_id];
      }
    }

    if (!targetIds || (Array.isArray(targetIds) && targetIds.length === 0)) {
      return res.status(400).json({ error: 'shipment_ids or valid order_id required' });
    }

    const result = await shiprocketService.requestPickup({
      shipmentIds: targetIds,
      pickupDate: pickup_date
    });

    if (order_id) {
      await executeMySQL(
        `UPDATE orders SET 
          pickup_scheduled_date = ?, 
          shiprocket_status = 'PICKUP_SCHEDULED' 
        WHERE id = ? OR order_number = ?`,
        [result.pickup_scheduled_date, order_id, order_id]
      );
    }

    res.json({
      success: true,
      message: 'Courier pickup scheduled successfully',
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. ADMIN: GENERATE SHIPPING LABEL (PDF)
router.post('/api/shipping/shiprocket/generate-label', async (req, res) => {
  try {
    const { shipment_id, order_id } = req.body;
    let targetId = shipment_id;

    if (!targetId && order_id) {
      const ordRows = await executeMySQL('SELECT shiprocket_shipment_id FROM orders WHERE id = ? OR order_number = ?', [order_id, order_id]);
      if (ordRows && ordRows[0]?.shiprocket_shipment_id) {
        targetId = ordRows[0].shiprocket_shipment_id;
      }
    }

    if (!targetId) {
      return res.status(400).json({ error: 'shipment_id or order_id with shipment required' });
    }

    const result = await shiprocketService.generateLabel(targetId);

    if (order_id) {
      await executeMySQL('UPDATE orders SET shiprocket_label_url = ? WHERE id = ? OR order_number = ?', [result.label_url, order_id, order_id]);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. ADMIN: GENERATE TAX INVOICE (PDF)
router.post('/api/shipping/shiprocket/generate-invoice', async (req, res) => {
  try {
    const { shiprocket_order_id, order_id } = req.body;
    let targetId = shiprocket_order_id;

    if (!targetId && order_id) {
      const ordRows = await executeMySQL('SELECT shiprocket_order_id FROM orders WHERE id = ? OR order_number = ?', [order_id, order_id]);
      if (ordRows && ordRows[0]?.shiprocket_order_id) {
        targetId = ordRows[0].shiprocket_order_id;
      }
    }

    if (!targetId) {
      return res.status(400).json({ error: 'shiprocket_order_id or order_id required' });
    }

    const result = await shiprocketService.generateInvoice(targetId);

    if (order_id) {
      await executeMySQL('UPDATE orders SET shiprocket_invoice_url = ? WHERE id = ? OR order_number = ?', [result.invoice_url, order_id, order_id]);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. PUBLIC & CUSTOMER: REAL-TIME TRACKING TIMELINE
router.get('/api/shipping/shiprocket/track/:query', async (req, res) => {
  try {
    const query = req.params.query;
    if (!query) {
      return res.status(400).json({ error: 'AWB code or Order Number is required' });
    }

    // Check if query is an order number or ID in database
    let awbCode = query;
    const ordRows = await executeMySQL(
      'SELECT id, order_number, courier_name, tracking_number, shiprocket_awb, order_status FROM orders WHERE id = ? OR order_number = ? OR tracking_number = ? OR shiprocket_awb = ?',
      [query, query, query, query]
    );

    if (ordRows && ordRows.length > 0) {
      awbCode = ordRows[0].shiprocket_awb || ordRows[0].tracking_number || query;
    }

    const tracking = await shiprocketService.trackShipment(awbCode);
    res.json({
      success: true,
      order: ordRows ? ordRows[0] : null,
      tracking
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. ADMIN: CANCEL SHIPMENT IN SHIPROCKET
router.post('/api/shipping/shiprocket/cancel', async (req, res) => {
  try {
    const { shiprocket_order_id, order_id } = req.body;
    let targetId = shiprocket_order_id;

    if (!targetId && order_id) {
      const ordRows = await executeMySQL('SELECT shiprocket_order_id FROM orders WHERE id = ? OR order_number = ?', [order_id, order_id]);
      if (ordRows && ordRows[0]?.shiprocket_order_id) {
        targetId = ordRows[0].shiprocket_order_id;
      }
    }

    if (!targetId) {
      return res.status(400).json({ error: 'shiprocket_order_id or order_id required' });
    }

    const result = await shiprocketService.cancelOrder(targetId);

    if (order_id) {
      await executeMySQL('UPDATE orders SET shiprocket_status = "CANCELLED" WHERE id = ? OR order_number = ?', [order_id, order_id]);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. SHIPROCKET REAL-TIME TRACKING WEBHOOK
router.post('/api/shipping/shiprocket/webhook', async (req, res) => {
  try {
    const payload = req.body || {};
    const {
      awb,
      current_status,
      current_status_id,
      shipment_status,
      order_id,
      courier_name,
      scans
    } = payload;

    console.log(`📡 [Shiprocket Webhook] AWB: ${awb} | Status: ${current_status || shipment_status}`);

    if (awb || order_id) {
      let mappedOrderStatus = null;
      const statusUpper = (current_status || shipment_status || '').toUpperCase();

      if (statusUpper.includes('DELIVERED')) {
        mappedOrderStatus = 'DELIVERED';
      } else if (statusUpper.includes('OUT FOR DELIVERY')) {
        mappedOrderStatus = 'OUT_FOR_DELIVERY';
      } else if (statusUpper.includes('IN TRANSIT') || statusUpper.includes('PICKED UP') || statusUpper.includes('SHIPPED')) {
        mappedOrderStatus = 'SHIPPED';
      } else if (statusUpper.includes('RTO')) {
        mappedOrderStatus = 'RETURNED';
      } else if (statusUpper.includes('CANCEL')) {
        mappedOrderStatus = 'CANCELLED';
      }

      const updateParams = [statusUpper];
      let sql = 'UPDATE orders SET shiprocket_status = ?';

      if (mappedOrderStatus) {
        sql += ', order_status = ?';
        updateParams.push(mappedOrderStatus);
      }
      if (courier_name) {
        sql += ', courier_name = COALESCE(courier_name, ?)';
        updateParams.push(courier_name);
      }

      sql += ' WHERE shiprocket_awb = ? OR tracking_number = ? OR shiprocket_order_id = ?';
      updateParams.push(awb, awb, order_id);

      await executeMySQL(sql, updateParams);

      // If Delivered, dispatch delivery celebration email
      if (mappedOrderStatus === 'DELIVERED' && (awb || order_id)) {
        const ordRows = await executeMySQL('SELECT customer_email, customer_name, order_number FROM orders WHERE shiprocket_awb = ? OR tracking_number = ?', [awb, awb]);
        if (ordRows && ordRows[0]?.customer_email) {
          sendEmailNotification(
            ordRows[0].customer_email,
            `Order Delivered #${ordRows[0].order_number} | ValueLife Essentials`,
            `<div style="font-family: Arial, sans-serif; padding: 25px; color: #164e3f; max-width: 600px; margin: 0 auto; border: 1px solid #bbf7d0; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #164e3f; margin-bottom: 8px;">Your order has been delivered! 🎉</h2>
              <p style="color: #475569; font-size: 14px;">Hi ${ordRows[0].customer_name}, your package for Order <b>#${ordRows[0].order_number}</b> was safely delivered.</p>
              <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 4px 0; font-size: 14px;"><b>Status:</b> <span style="color: #16a34a; font-weight: bold;">DELIVERED</span></p>
                <p style="margin: 4px 0; font-size: 14px;"><b>AWB Number:</b> ${awb}</p>
              </div>
              <p style="color: #475569; font-size: 14px;">We hope you enjoy your pure organic wellness products. If you loved your purchase, leave us a review!</p>
            </div>`
          ).catch(() => {});
        }
      }
    }

    res.json({ success: true, message: 'Webhook processed' });
  } catch (err) {
    console.error('Shiprocket webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 10. ADMIN: GET SHIPROCKET ACCOUNT OVERVIEW & WALLET BALANCE
router.get('/api/shipping/shiprocket/account-overview', async (req, res) => {
  try {
    const overview = await shiprocketService.getAccountOverview();
    res.json(overview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. ADMIN: GET CONNECTED CHANNELS
router.get('/api/shipping/shiprocket/channels', async (req, res) => {
  try {
    const channels = await shiprocketService.getChannels();
    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. ADMIN: GET REGISTERED PICKUP ADDRESSES
router.get('/api/shipping/shiprocket/pickup-addresses', async (req, res) => {
  try {
    const pickups = await shiprocketService.getPickupAddresses();
    res.json(pickups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. ADMIN: ADD WAREHOUSE PICKUP ADDRESS
router.post('/api/shipping/shiprocket/add-pickup-address', async (req, res) => {
  try {
    const result = await shiprocketService.addPickupAddress(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
