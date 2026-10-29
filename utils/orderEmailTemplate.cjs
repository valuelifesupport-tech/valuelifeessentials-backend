/**
 * ValueLife Essentials — High-End Order Confirmation Email Template
 * 
 * Generates an email client compatible HTML template that displays:
 * - Brand header & personalized greeting
 * - Order number, date, and status badges
 * - Visual Product items list with Name, Variant, Thumbnail Image, Qty, and Price
 * - Financial summary (Subtotal, Discount, Shipping, Taxes, Total)
 * - Payment breakdown (COD cash due or Online payment confirmation)
 * - Formatted delivery address
 * - Live order tracking button & customer support links
 */

function resolveImageUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return '';
  }
  const clean = url.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }
  if (clean.startsWith('/uploads/')) {
    return `${process.env.BACKEND_URL || 'http://localhost:5000'}${clean}`;
  }
  if (clean.startsWith('uploads/')) {
    return `${process.env.BACKEND_URL || 'http://localhost:5000'}/${clean}`;
  }
  if (clean.startsWith('/')) {
    return `${process.env.FRONTEND_URL || 'http://localhost:5173'}${clean}`;
  }
  return `${process.env.BACKEND_URL || 'http://localhost:5000'}/uploads/${clean}`;
}

function buildOrderConfirmationEmailHtml({
  orderNumber,
  customerName = 'Valued Customer',
  paymentMode = 'COD',
  paymentStatus = 'PENDING',
  totalAmount = 0,
  paidAmount = 0,
  remainingAmount = 0,
  subtotal = 0,
  discountAmount = 0,
  shippingAmount = 0,
  taxAmount = 0,
  isTaxInclusive = true,
  shippingAddress = '',
  items = []
}) {
  const isCOD = paymentMode === 'COD';
  const isPartial = paymentMode === 'PARTIAL' || paymentMode === 'PARTIAL_COD';
  const effectiveItems = Array.isArray(items) ? items : [];

  const itemsHtml = effectiveItems.map((it) => {
    const title = it.product_title || it.product_name || it.title || it.name || 'Organic Product';
    const variant = (it.variant_name || it.variant_title || '').trim();
    const qty = parseInt(it.quantity || it.qty || 1, 10);
    const unitPrice = Number(it.price || it.price_inr || it.unit_price || 0);
    const lineTotal = Number(it.total || (unitPrice * qty));
    const rawImg = it.image_url || it.thumbnail || it.image || '';
    const imgUrl = resolveImageUrl(rawImg);

    return `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; vertical-align: top; width: 64px;">
          ${imgUrl ? `
            <img 
              src="${imgUrl}" 
              alt="${title.replace(/"/g, '&quot;')}" 
              width="60" 
              height="60" 
              style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #cbd5e1; display: block;" 
            />
          ` : `
            <div style="width: 60px; height: 60px; background: #ecfdf5; border-radius: 8px; border: 1px solid #a7f3d0; text-align: center; line-height: 60px; font-size: 24px; color: #047857;">
              🌿
            </div>
          `}
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
          <div style="font-weight: 700; color: #1e293b; font-size: 13.5px; line-height: 1.35; margin-bottom: 3px;">
            ${title}
          </div>
          ${variant ? `
            <div style="display: inline-block; font-size: 11px; background: #ecfdf5; color: #065f46; padding: 2px 6px; border-radius: 4px; font-weight: 600; margin-bottom: 4px;">
              ${variant}
            </div>
          ` : ''}
          <div style="font-size: 12px; color: #64748b;">
            Unit Price: <span style="color: #334155; font-weight: 600;">₹${unitPrice.toLocaleString('en-IN')}</span> &nbsp;•&nbsp; Qty: <span style="color: #0f172a; font-weight: 700;">${qty}</span>
          </div>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; vertical-align: top; text-align: right; width: 85px;">
          <div style="font-size: 14px; font-weight: 700; color: #047857;">
            ₹${lineTotal.toLocaleString('en-IN')}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed #${orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 20px 10px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          
          <!-- BRAND HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%); padding: 24px 28px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; font-family: 'Outfit', -apple-system, sans-serif;">
                      🌱 ValueLife Essentials
                    </span>
                    <div style="font-size: 11px; color: #bbf7d0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">
                      100% Certified Organic Living
                    </div>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3); color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                      #${orderNumber}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HERO GREETING -->
          <tr>
            <td style="padding: 28px 28px 20px 28px;">
              <h1 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 800; color: #164e3f; line-height: 1.3;">
                Thank you for your order, ${customerName}!
              </h1>
              <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.55;">
                ${isCOD 
                  ? `Your Cash on Delivery (COD) order <strong style="color: #1e293b;">#${orderNumber}</strong> has been confirmed and is now being packaged with certified organic care.`
                  : `Your online payment has been successfully received via Razorpay. Order <strong style="color: #1e293b;">#${orderNumber}</strong> is confirmed and being prepared for shipment.`}
              </p>
            </td>
          </tr>

          <!-- ORDER KEY INFORMATION CARD -->
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size: 13px; color: #475569; padding-bottom: 6px;">Order Number:</td>
                    <td align="right" style="font-size: 13.5px; font-weight: 800; color: #164e3f; padding-bottom: 6px;">#${orderNumber}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 13px; color: #475569; padding-bottom: 6px;">Payment Method:</td>
                    <td align="right" style="font-size: 13px; font-weight: 700; color: #1e293b; padding-bottom: 6px;">
                      ${isCOD ? '💵 Cash on Delivery (COD)' : isPartial ? '⚡ Partial Deposit (Balance on COD)' : '💳 100% Online Prepaid (Razorpay)'}
                    </td>
                  </tr>
                  ${isCOD ? `
                    <tr>
                      <td style="font-size: 13.5px; font-weight: 700; color: #b45309; padding-bottom: 6px;">Cash to Pay on Delivery:</td>
                      <td align="right" style="font-size: 15px; font-weight: 800; color: #b45309; padding-bottom: 6px;">₹${Number(totalAmount).toLocaleString('en-IN')}</td>
                    </tr>
                  ` : ''}
                  ${isPartial ? `
                    <tr>
                      <td style="font-size: 13px; color: #16a34a; font-weight: 700; padding-bottom: 6px;">Paid Online:</td>
                      <td align="right" style="font-size: 13.5px; font-weight: 800; color: #16a34a; padding-bottom: 6px;">₹${Number(paidAmount).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td style="font-size: 13px; color: #b45309; font-weight: 700; padding-bottom: 6px;">COD Balance on Delivery:</td>
                      <td align="right" style="font-size: 14px; font-weight: 800; color: #b45309; padding-bottom: 6px;">₹${Number(remainingAmount).toLocaleString('en-IN')}</td>
                    </tr>
                  ` : ''}
                  ${!isCOD && !isPartial ? `
                    <tr>
                      <td style="font-size: 13px; color: #16a34a; font-weight: 700; padding-bottom: 6px;">Payment Status:</td>
                      <td align="right" style="font-size: 13px; font-weight: 800; color: #16a34a; padding-bottom: 6px;">✓ Paid in Full</td>
                    </tr>
                  ` : ''}
                  <tr>
                    <td style="font-size: 13px; color: #475569; padding-top: 6px; border-top: 1px dashed #bbf7d0;">Total Order Value:</td>
                    <td align="right" style="font-size: 16px; font-weight: 900; color: #164e3f; padding-top: 6px; border-top: 1px dashed #bbf7d0;">₹${Number(totalAmount).toLocaleString('en-IN')}</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- ORDER ITEMS SECTION -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-bottom: 12px;">
                <span style="font-size: 14px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">
                  📦 Items in Your Order (${effectiveItems.length})
                </span>
              </div>
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                ${itemsHtml}
              </table>
            </td>
          </tr>

          <!-- FINANCIAL SUMMARY -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px;">
                ${subtotal > 0 ? `
                  <tr>
                    <td style="font-size: 13px; color: #64748b; padding-bottom: 6px;">Items Subtotal:</td>
                    <td align="right" style="font-size: 13px; font-weight: 700; color: #334155; padding-bottom: 6px;">₹${Number(subtotal).toLocaleString('en-IN')}</td>
                  </tr>
                ` : ''}
                ${discountAmount > 0 ? `
                  <tr>
                    <td style="font-size: 13px; color: #16a34a; font-weight: 600; padding-bottom: 6px;">Coupon Discount:</td>
                    <td align="right" style="font-size: 13px; font-weight: 700; color: #16a34a; padding-bottom: 6px;">-₹${Number(discountAmount).toLocaleString('en-IN')}</td>
                  </tr>
                ` : ''}
                <tr>
                  <td style="font-size: 13px; color: #64748b; padding-bottom: 6px;">Delivery / Shipping:</td>
                  <td align="right" style="font-size: 13px; font-weight: 700; color: #334155; padding-bottom: 6px;">
                    ${shippingAmount === 0 
                      ? '<span style="color: #16a34a; font-weight: 800;">FREE 🚚</span>' 
                      : `₹${Number(shippingAmount).toLocaleString('en-IN')}`}
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; padding-bottom: 6px;">Goods & Services Tax (GST):</td>
                  <td align="right" style="font-size: 13px; color: #64748b; padding-bottom: 6px;">
                    ${isTaxInclusive 
                      ? '<span style="color: #64748b; font-size: 12px;">(All Prices Tax Inclusive)</span>' 
                      : `+₹${Number(taxAmount).toLocaleString('en-IN')}`}
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 14px; font-weight: 800; color: #0f172a; padding-top: 8px; border-top: 1px solid #cbd5e1;">Grand Total:</td>
                  <td align="right" style="font-size: 17px; font-weight: 900; color: #164e3f; padding-top: 8px; border-top: 1px solid #cbd5e1;">
                    ₹${Number(totalAmount).toLocaleString('en-IN')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- DELIVERY ADDRESS -->
          ${shippingAddress ? `
            <tr>
              <td style="padding: 0 28px 24px 28px;">
                <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; background: #ffffff;">
                  <div style="font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                    📍 Delivery Address
                  </div>
                  <div style="font-size: 13.5px; color: #1e293b; line-height: 1.45;">
                    ${shippingAddress}
                  </div>
                </div>
              </td>
            </tr>
          ` : ''}

          <!-- TRACK ORDER BUTTON & SUPPORT -->
          <tr>
            <td style="padding: 0 28px 28px 28px; text-align: center;">
              <a 
                href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?tab=orders" 
                style="display: inline-block; background-color: #1b4332; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 800; padding: 14px 32px; border-radius: 10px; letter-spacing: 0.3px; box-shadow: 0 2px 6px rgba(27,67,50,0.3);"
              >
                Track Your Order Live →
              </a>
              <div style="margin-top: 18px; font-size: 12px; color: #64748b; line-height: 1.5;">
                Need help with your order? Reply directly to this email or reach us at <a href="mailto:${process.env.SUPPORT_EMAIL || ''}" style="color: #1b4332; font-weight: 600; text-decoration: underline;">${process.env.SUPPORT_EMAIL || ''}</a>.
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 16px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                © ${new Date().getFullYear()} ValueLife Essentials. All rights reserved.<br />
                Certified 100% Organic Fertilizers, Natural Minerals & Herbal Extracts.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * ValueLife Essentials — High-End Admin New Order Alert Email Template (English)
 *
 * Professional English email dispatched to the store owner / administrator whenever
 * an order is placed (COD) or verified (Online/Prepaid).
 */
function buildAdminOrderAlertEmailHtml({
  orderNumber,
  customerName = 'Customer',
  customerEmail = '',
  customerPhone = '',
  paymentMode = 'COD',
  paymentStatus = 'PENDING',
  orderStatus = 'NEW',
  totalAmount = 0,
  paidAmount = 0,
  remainingAmount = 0,
  subtotal = 0,
  discountAmount = 0,
  couponCode = '',
  shippingAmount = 0,
  taxAmount = 0,
  cgstAmount = 0,
  sgstAmount = 0,
  igstAmount = 0,
  shippingAddress = '',
  shippingCity = '',
  shippingState = '',
  shippingPincode = '',
  orderNotes = '',
  items = [],
  createdAt = new Date()
}) {
  const isCOD = paymentMode === 'COD' || String(paymentMode).toUpperCase().includes('COD');
  const isPaid = paymentStatus === 'PAID' || paymentStatus === 'COMPLETED';
  const effectiveItems = Array.isArray(items) ? items : [];

  let dateStr = '';
  try {
    dateStr = new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata'
    }).format(new Date(createdAt));
  } catch (e) {
    dateStr = new Date().toLocaleString('en-IN');
  }

  // Build clean delivery address string
  const addressParts = [];
  if (shippingAddress) addressParts.push(shippingAddress.trim());
  if (shippingCity && !shippingAddress.toLowerCase().includes(shippingCity.toLowerCase())) {
    addressParts.push(shippingCity.trim());
  }
  if (shippingState && !shippingAddress.toLowerCase().includes(shippingState.toLowerCase())) {
    const statePin = shippingPincode ? `${shippingState.trim()} - ${shippingPincode.trim()}` : shippingState.trim();
    addressParts.push(statePin);
  } else if (shippingPincode && !shippingAddress.includes(shippingPincode)) {
    addressParts.push(`PIN: ${shippingPincode.trim()}`);
  }
  const cleanDeliveryAddress = addressParts.join(', ') || 'No address specified';

  // Clean customer phone
  const cleanDigits = String(customerPhone || '').replace(/\D/g, '');
  const displayPhone = cleanDigits.length === 10 ? `+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)}` : (customerPhone || 'Not provided');
  const telLink = cleanDigits.length >= 10 ? `tel:+91${cleanDigits.slice(-10)}` : '';

  // Admin portal order URL
  const adminBaseUrl = (process.env.ADMIN_URL || 'https://admin.valuelifeessentials.com').replace(/\/+$/, '');
  const adminOrderUrl = `${adminBaseUrl}/orders`;

  // Item rows
  const itemsHtml = effectiveItems.map((it, idx) => {
    const title = it.product_title || it.product_name || it.title || it.name || `Item #${idx + 1}`;
    const variant = (it.variant_name || it.variant_title || '').trim();
    const qty = parseInt(it.quantity || it.qty || 1, 10);
    const unitPrice = Number(it.price || it.price_inr || it.unit_price || 0);
    const lineTotal = Number(it.total || (unitPrice * qty));
    const rawImg = it.image_url || it.thumbnail || it.image || '';
    const imgUrl = resolveImageUrl(rawImg);

    return `
      <tr>
        <td style="padding: 14px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; width: 64px;">
          ${imgUrl ? `
            <img 
              src="${imgUrl}" 
              alt="${title.replace(/"/g, '&quot;')}" 
              width="58" 
              height="58" 
              style="width: 58px; height: 58px; object-fit: cover; border-radius: 8px; border: 1px solid #cbd5e1; display: block;" 
            />
          ` : `
            <div style="width: 58px; height: 58px; background: #ecfdf5; border-radius: 8px; border: 1px solid #a7f3d0; text-align: center; line-height: 58px; font-size: 22px; color: #047857;">
              🌿
            </div>
          `}
        </td>
        <td style="padding: 14px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
          <div style="font-weight: 700; color: #0f172a; font-size: 14px; line-height: 1.35; margin-bottom: 4px;">
            ${title}
          </div>
          ${variant ? `
            <div style="display: inline-block; font-size: 11px; background: #f1f5f9; color: #334155; padding: 2px 7px; border-radius: 4px; font-weight: 600; margin-bottom: 4px;">
              Pack / Variant: ${variant}
            </div>
          ` : ''}
          <div style="font-size: 12px; color: #64748b;">
            Unit Price: <strong style="color: #1e293b;">₹${unitPrice.toLocaleString('en-IN')}</strong> &nbsp;|&nbsp; Quantity: <strong style="color: #0f172a; font-size: 13px;">${qty}</strong>
          </div>
        </td>
        <td style="padding: 14px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; text-align: right; width: 100px;">
          <div style="font-size: 15px; font-weight: 800; color: #0f172a;">
            ₹${lineTotal.toLocaleString('en-IN')}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Order Alert #${orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- PREHEADER (Visible in inbox preview) -->
  <div style="display: none; font-size: 1px; color: #f1f5f9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    🔔 New order #${orderNumber} received from ${customerName} for ₹${Number(totalAmount).toLocaleString('en-IN')} (${paymentMode}). Check details and dispatch instructions.
  </div>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 640px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);">
          
          <!-- TOP BRAND & ALERT HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%); padding: 26px 30px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display: inline-block; background: #fef08a; color: #854d0e; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">
                      ⚡ New Order Alert
                    </div>
                    <div style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; font-family: -apple-system, sans-serif;">
                      🌱 ValueLife Essentials
                    </div>
                    <div style="font-size: 12px; color: #a7f3d0; margin-top: 2px;">
                      Order Received at ${dateStr}
                    </div>
                  </td>
                  <td align="right" style="vertical-align: top;">
                    <div style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 10px; padding: 8px 14px; text-align: right; display: inline-block;">
                      <div style="font-size: 10px; color: #bbf7d0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">
                        Order Number
                      </div>
                      <div style="font-size: 15px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">
                        #${orderNumber}
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FINANCIAL HIGHLIGHT STRIP -->
          <tr>
            <td style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 18px 30px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width: 33.33%; border-right: 1px solid #e2e8f0; padding-right: 12px;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                      Total Order Value
                    </div>
                    <div style="font-size: 20px; font-weight: 800; color: #047857; margin-top: 2px;">
                      ₹${Number(totalAmount).toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td style="width: 33.33%; padding: 0 16px; border-right: 1px solid #e2e8f0;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                      Payment Mode
                    </div>
                    <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 4px;">
                      ${isCOD ? 'Cash on Delivery' : 'Online / Prepaid'}
                    </div>
                  </td>
                  <td style="width: 33.33%; padding-left: 16px;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                      Payment Status
                    </div>
                    <div style="margin-top: 4px;">
                      ${isPaid ? `
                        <span style="display: inline-block; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
                          ✓ Paid Online
                        </span>
                      ` : (isCOD ? `
                        <span style="display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
                          Collect ₹${Number(remainingAmount || totalAmount).toLocaleString('en-IN')}
                        </span>
                      ` : `
                        <span style="display: inline-block; background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
                          ${paymentStatus}
                        </span>
                      `)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CUSTOMER DETAILS & SHIPPING INFO SECTION -->
          <tr>
            <td style="padding: 24px 30px 10px 30px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- CUSTOMER INFO CARD -->
                  <td style="width: 48%; vertical-align: top; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px;">
                    <div style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">
                      👤 Customer Information
                    </div>
                    <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
                      ${customerName}
                    </div>
                    <div style="font-size: 13px; color: #334155; margin-bottom: 4px;">
                      📞 <strong>Phone:</strong> ${telLink ? `<a href="${telLink}" style="color: #047857; font-weight: 700; text-decoration: none;">${displayPhone}</a>` : displayPhone}
                    </div>
                    <div style="font-size: 13px; color: #334155; margin-bottom: 6px; word-break: break-all;">
                      ✉️ <strong>Email:</strong> ${customerEmail ? `<a href="mailto:${customerEmail}" style="color: #047857; text-decoration: underline;">${customerEmail}</a>` : '<span style="color: #94a3b8; font-style: italic;">Not provided</span>'}
                    </div>
                    ${telLink ? `
                      <div style="margin-top: 10px;">
                        <a href="${telLink}" style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; font-size: 11.5px; font-weight: 700; padding: 5px 12px; border-radius: 6px; text-decoration: none;">
                          📞 Call Customer
                        </a>
                      </div>
                    ` : ''}
                  </td>
                  
                  <td style="width: 4%;"></td>

                  <!-- SHIPPING ADDRESS CARD -->
                  <td style="width: 48%; vertical-align: top; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px;">
                    <div style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">
                      📍 Delivery Address
                    </div>
                    <div style="font-size: 13px; color: #1e293b; line-height: 1.5; font-weight: 500;">
                      ${cleanDeliveryAddress}
                    </div>
                    ${orderNotes ? `
                      <div style="margin-top: 10px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 6px 10px;">
                        <span style="font-size: 10.5px; font-weight: 800; color: #92400e; text-transform: uppercase;">Note:</span>
                        <span style="font-size: 12px; color: #78350f;">${orderNotes}</span>
                      </div>
                    ` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ORDERED ITEMS SECTION -->
          <tr>
            <td style="padding: 16px 30px 10px 30px;">
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                📦 Ordered Items (${effectiveItems.length})
              </div>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
                <thead>
                  <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <th align="left" colspan="2" style="padding: 10px 14px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
                      Product
                    </th>
                    <th align="right" style="padding: 10px 14px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- FINANCIAL BREAKDOWN SECTION -->
          <tr>
            <td style="padding: 10px 30px 24px 30px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width: 50%; vertical-align: top; padding-right: 14px;">
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px;">
                      <div style="font-size: 12px; font-weight: 800; color: #334155; text-transform: uppercase; margin-bottom: 6px;">
                        Quick Fulfillment Checklist
                      </div>
                      <div style="font-size: 12px; color: #64748b; line-height: 1.55;">
                        1. Verify item availability in warehouse<br />
                        2. Pack items securely with organic seal<br />
                        3. Generate Shiprocket / courier label<br />
                        4. Mark order as &quot;DISPATCHED&quot; in admin
                      </div>
                    </div>
                  </td>
                  <td style="width: 50%; vertical-align: top;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px;">
                      <tr>
                        <td style="padding: 4px 0; font-size: 12.5px; color: #64748b;">Subtotal</td>
                        <td align="right" style="padding: 4px 0; font-size: 12.5px; color: #1e293b; font-weight: 600;">₹${Number(subtotal || 0).toLocaleString('en-IN')}</td>
                      </tr>
                      ${discountAmount > 0 ? `
                        <tr>
                          <td style="padding: 4px 0; font-size: 12.5px; color: #16a34a;">Discount ${couponCode ? `(${couponCode})` : ''}</td>
                          <td align="right" style="padding: 4px 0; font-size: 12.5px; color: #16a34a; font-weight: 700;">-₹${Number(discountAmount).toLocaleString('en-IN')}</td>
                        </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 4px 0; font-size: 12.5px; color: #64748b;">Shipping Fee</td>
                        <td align="right" style="padding: 4px 0; font-size: 12.5px; color: #1e293b; font-weight: 600;">
                          ${shippingAmount > 0 ? `₹${Number(shippingAmount).toLocaleString('en-IN')}` : '<span style="color: #047857; font-weight: 700;">FREE</span>'}
                        </td>
                      </tr>
                      ${taxAmount > 0 ? `
                        <tr>
                          <td style="padding: 4px 0; font-size: 12.5px; color: #64748b;">Taxes (GST)</td>
                          <td align="right" style="padding: 4px 0; font-size: 12.5px; color: #1e293b; font-weight: 600;">₹${Number(taxAmount).toLocaleString('en-IN')}</td>
                        </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 10px 0 4px 0; border-top: 1px solid #e2e8f0; font-size: 14px; font-weight: 800; color: #0f172a;">Total Payable</td>
                        <td align="right" style="padding: 10px 0 4px 0; border-top: 1px solid #e2e8f0; font-size: 17px; font-weight: 800; color: #047857;">₹${Number(totalAmount).toLocaleString('en-IN')}</td>
                      </tr>
                      ${isCOD ? `
                        <tr>
                          <td style="padding: 4px 0; font-size: 12px; color: #92400e; font-weight: 700;">Amount to Collect (COD)</td>
                          <td align="right" style="padding: 4px 0; font-size: 13px; color: #92400e; font-weight: 800;">₹${Number(remainingAmount || totalAmount).toLocaleString('en-IN')}</td>
                        </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- PRIMARY CALL TO ACTION BUTTON -->
          <tr>
            <td style="padding: 0 30px 28px 30px; text-align: center;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a 
                      href="${adminOrderUrl}" 
                      style="display: inline-block; background-color: #047857; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 800; padding: 14px 34px; border-radius: 10px; letter-spacing: 0.3px; box-shadow: 0 3px 8px rgba(4, 120, 87, 0.3);"
                    >
                      Open Order in Admin Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
              <div style="margin-top: 14px; font-size: 12px; color: #64748b;">
                Admin URL: <a href="${adminOrderUrl}" style="color: #047857; text-decoration: underline;">${adminOrderUrl}</a>
              </div>
            </td>
          </tr>

          <!-- CORPORATE FOOTER -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 11.5px; color: #64748b; line-height: 1.5;">
                This is an automated notification from <strong>ValueLife Essentials Store Engine</strong>.<br />
                ValueLife Essentials • 100% Certified Organic Living • Hyderabad, Telangana, India.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

module.exports = {
  buildOrderConfirmationEmailHtml,
  buildAdminOrderAlertEmailHtml,
  resolveImageUrl
};
