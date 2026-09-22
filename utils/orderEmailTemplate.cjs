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

module.exports = {
  buildOrderConfirmationEmailHtml,
  resolveImageUrl
};
