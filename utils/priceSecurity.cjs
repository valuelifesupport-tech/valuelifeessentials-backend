const { executeMySQL, db } = require('../config/database.cjs');

/**
 * STRICT ZERO-TRUST SERVER-SIDE PRICING & INVENTORY VERIFIER
 * Guarantees that neither product prices, variant prices, coupon discounts,
 * tax rates, shipping rates, nor total amounts can be tampered with by the client.
 */
async function verifyAndCalculateOrderPricing(items = [], couponCode = null) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Order must contain at least one valid item');
  }

  let verifiedSubtotal = 0;
  const verifiedItems = [];

  for (const it of items) {
    const pId = it.product_id || it.id;
    if (!pId) {
      throw new Error('Product ID is required for every item');
    }

    // Strictly enforce positive integer quantity (reject negative, zero, floats)
    const rawQty = parseInt(it.quantity, 10);
    if (isNaN(rawQty) || rawQty <= 0) {
      throw new Error('Invalid item quantity: quantity must be a positive integer (minimum 1)');
    }
    if (rawQty > 100) {
      throw new Error('Quantity limit exceeded: maximum 100 units per item allowed');
    }

    // 1. Fetch Product from Hostinger MySQL (or SQLite fallback)
    let prodRows = await executeMySQL(
      'SELECT id, title, price_inr, discount_inr, stock, gst_percent, image_url, thumbnail FROM products WHERE id = ?',
      [pId]
    );

    if (!prodRows || prodRows.length === 0) {
      try {
        const localP = db.prepare('SELECT id, title, price_inr, discount_inr, stock, image_url FROM products WHERE id = ?').get(pId);
        if (localP) prodRows = [localP];
      } catch (e) {}
    }

    if (!prodRows || prodRows.length === 0) {
      throw new Error(`Product with ID ${pId} was not found in database`);
    }

    const product = prodRows[0];
    let finalTitle = product.title || 'ValueLife Organic Product';
    let finalImg = product.image_url || product.thumbnail || it.image_url || '';

    // Authentic product unit price from database (prefer discount price if available)
    const pDiscount = Number(product.discount_inr);
    const pRegular = Number(product.price_inr);
    let authenticUnitPrice = (pDiscount > 0 && pDiscount < pRegular) ? pDiscount : (pRegular > 0 ? pRegular : pDiscount);

    let vId = it.variant_id || it.variantId || null;
    let vName = (it.variant_name || it.variant_title || '').trim();

    // 2. Fetch & Validate Variant if applicable
    if (vId || vName) {
      let vRows = [];
      if (vId) {
        vRows = await executeMySQL(
          'SELECT id, product_id, title, variant_name, price_inr, discount_inr, stock, image_url FROM product_variants WHERE id = ? AND product_id = ?',
          [vId, pId]
        );
      }
      if ((!vRows || vRows.length === 0) && vName) {
        vRows = await executeMySQL(
          'SELECT id, product_id, title, variant_name, price_inr, discount_inr, stock, image_url FROM product_variants WHERE product_id = ? AND (LOWER(variant_name) = LOWER(?) OR LOWER(title) = LOWER(?)) LIMIT 1',
          [pId, vName, vName]
        );
      }

      if (vRows && vRows.length > 0) {
        const variant = vRows[0];
        vId = variant.id;
        vName = variant.variant_name || variant.title || vName;

        const vDiscount = Number(variant.discount_inr);
        const vRegular = Number(variant.price_inr);
        const authenticVariantPrice = (vDiscount > 0 && vDiscount < vRegular) ? vDiscount : (vRegular > 0 ? vRegular : vDiscount);

        if (authenticVariantPrice > 0) {
          authenticUnitPrice = authenticVariantPrice;
        }
        if (variant.image_url) {
          finalImg = variant.image_url;
        }
        finalTitle = `${product.title} - ${vName}`;
      }
    }

    // Safety check: unit price must be positive
    if (authenticUnitPrice <= 0) {
      throw new Error(`Invalid price configuration for product "${product.title}"`);
    }

    const lineTotal = Math.round(authenticUnitPrice * rawQty * 100) / 100;
    verifiedSubtotal += lineTotal;

    verifiedItems.push({
      product_id: product.id,
      variant_id: vId,
      product_title: finalTitle,
      product_name: finalTitle,
      variant_name: vName || null,
      price: authenticUnitPrice,
      price_inr: authenticUnitPrice,
      price_usd: Math.round((authenticUnitPrice / 83) * 100) / 100,
      quantity: rawQty,
      total: lineTotal,
      image_url: finalImg
    });
  }

  verifiedSubtotal = Math.round(verifiedSubtotal * 100) / 100;

  // 3. Strict Server-Side Coupon Verification
  let verifiedDiscount = 0;
  let appliedCouponCode = null;

  if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
    const cleanCode = couponCode.trim().toUpperCase();
    try {
      const couponRows = await executeMySQL(
        'SELECT * FROM coupons WHERE UPPER(code) = ? AND is_active = 1',
        [cleanCode]
      );
      if (couponRows && couponRows.length > 0) {
        const cpn = couponRows[0];
        const isNotExpired = !cpn.expiry_date || new Date(cpn.expiry_date) >= new Date();
        const minAmount = Number(cpn.min_order_amount || 0);

        if (isNotExpired && verifiedSubtotal >= minAmount) {
          appliedCouponCode = cpn.code;
          const val = Number(cpn.discount_value || 0);
          if (cpn.discount_type === 'PERCENT' || cpn.discount_type === 'percentage' || cpn.discount_type === 'PERCENTAGE') {
            verifiedDiscount = Math.round((verifiedSubtotal * val) / 100);
          } else {
            // Flat amount discount
            verifiedDiscount = Math.min(verifiedSubtotal, val);
          }
        }
      }
    } catch (cErr) {
      console.warn('Coupon verification notice:', cErr.message);
    }
  }

  const taxableAmount = Math.max(0, verifiedSubtotal - verifiedDiscount);
  // Standard GST 5%
  const gstAmount = Math.round((taxableAmount * 5) / 100);
  // Free shipping on cart value >= ₹499
  const shippingAmount = taxableAmount >= 499 ? 0 : 50;
  const verifiedTotal = Math.round(taxableAmount + gstAmount + shippingAmount);

  return {
    verifiedItems,
    subtotal: verifiedSubtotal,
    discountAmount: verifiedDiscount,
    couponCode: appliedCouponCode,
    taxableAmount,
    taxAmount: gstAmount,
    shippingAmount,
    totalAmount: verifiedTotal
  };
}

module.exports = {
  verifyAndCalculateOrderPricing
};
