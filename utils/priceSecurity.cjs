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

  // 1. Fetch Store Tax & Shipping Settings
  let isTaxInclusive = true;
  let defaultStoreGstRate = 5;
  let storeShippingFee = 50;
  let storeFreeShippingThreshold = 499;
  let enableFreeShipping = 1;

  try {
    const setRows = await executeMySQL('SELECT all_prices_include_tax, default_gst_percent, federal_tax_rate, shipping_fee, free_shipping_threshold, enable_free_shipping FROM store_settings WHERE id = 1');
    if (setRows && setRows.length > 0) {
      const s = setRows[0];
      if (s.all_prices_include_tax !== undefined && s.all_prices_include_tax !== null) {
        isTaxInclusive = Number(s.all_prices_include_tax) === 1;
      }
      if (s.default_gst_percent !== undefined && s.default_gst_percent !== null && s.default_gst_percent !== '') {
        const parsedRate = Number(s.default_gst_percent);
        if (!isNaN(parsedRate) && parsedRate >= 0) defaultStoreGstRate = parsedRate;
      } else if (s.federal_tax_rate && Number(s.federal_tax_rate) > 0) {
        defaultStoreGstRate = Number(s.federal_tax_rate);
      }
      if (s.shipping_fee !== undefined && s.shipping_fee !== null && s.shipping_fee !== '') {
        const fee = Number(s.shipping_fee);
        if (!isNaN(fee) && fee >= 0) storeShippingFee = fee;
      }
      if (s.free_shipping_threshold !== undefined && s.free_shipping_threshold !== null && s.free_shipping_threshold !== '') {
        const thresh = Number(s.free_shipping_threshold);
        if (!isNaN(thresh) && thresh >= 0) storeFreeShippingThreshold = thresh;
      }
      if (s.enable_free_shipping !== undefined && s.enable_free_shipping !== null) {
        enableFreeShipping = Number(s.enable_free_shipping);
      }
    } else {
      const locSet = db.prepare('SELECT all_prices_include_tax, default_gst_percent, federal_tax_rate, shipping_fee, free_shipping_threshold, enable_free_shipping FROM store_settings WHERE id = 1').get();
      if (locSet) {
        if (locSet.all_prices_include_tax !== undefined && locSet.all_prices_include_tax !== null) {
          isTaxInclusive = Number(locSet.all_prices_include_tax) === 1;
        }
        if (locSet.default_gst_percent !== undefined && locSet.default_gst_percent !== null && locSet.default_gst_percent !== '') {
          const p = Number(locSet.default_gst_percent);
          if (!isNaN(p) && p >= 0) defaultStoreGstRate = p;
        }
        if (locSet.shipping_fee !== undefined && locSet.shipping_fee !== null) {
          const fee = Number(locSet.shipping_fee);
          if (!isNaN(fee) && fee >= 0) storeShippingFee = fee;
        }
        if (locSet.free_shipping_threshold !== undefined && locSet.free_shipping_threshold !== null) {
          const thresh = Number(locSet.free_shipping_threshold);
          if (!isNaN(thresh) && thresh >= 0) storeFreeShippingThreshold = thresh;
        }
        if (locSet.enable_free_shipping !== undefined && locSet.enable_free_shipping !== null) {
          enableFreeShipping = Number(locSet.enable_free_shipping);
        }
      }
    }
  } catch (e) {
    isTaxInclusive = true;
    defaultStoreGstRate = 5;
    storeShippingFee = 50;
    storeFreeShippingThreshold = 499;
    enableFreeShipping = 1;
  }

  let verifiedSubtotal = 0;
  let totalCalculatedTax = 0;
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

    // 2. Fetch Product from Hostinger MySQL (or SQLite fallback)
    let prodRows = await executeMySQL(
      'SELECT id, title, sku, price_inr, discount_inr, stock, gst_percent, gst_rate, image_url, thumbnail FROM products WHERE id = ?',
      [pId]
    );

    if (!prodRows || prodRows.length === 0) {
      try {
        const localP = db.prepare('SELECT id, title, sku, price_inr, discount_inr, stock, gst_percent, gst_rate, image_url FROM products WHERE id = ?').get(pId);
        if (localP) prodRows = [localP];
      } catch (e) {}
    }

    if (!prodRows || prodRows.length === 0) {
      throw new Error(`Product with ID ${pId} was not found in database`);
    }

    const product = prodRows[0];
    let finalTitle = product.title || 'ValueLife Organic Product';
    let finalImg = product.image_url || product.thumbnail || it.image_url || '';
    const prodSku = (product.sku || '').trim() || `VL-${product.id}`;
    let varSku = null;

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
          'SELECT id, product_id, title, variant_name, sku, price_inr, discount_inr, stock, image_url FROM product_variants WHERE id = ? AND product_id = ?',
          [vId, pId]
        );
      }
      if ((!vRows || vRows.length === 0) && vName) {
        vRows = await executeMySQL(
          'SELECT id, product_id, title, variant_name, sku, price_inr, discount_inr, stock, image_url FROM product_variants WHERE product_id = ? AND (LOWER(variant_name) = LOWER(?) OR LOWER(title) = LOWER(?)) LIMIT 1',
          [pId, vName, vName]
        );
      }
      if ((!vRows || vRows.length === 0)) {
        try {
          if (vId) {
            const locV = db.prepare('SELECT id, product_id, title, variant_name, sku, price_inr, discount_inr, stock, image_url FROM product_variants WHERE id = ?').get(vId);
            if (locV) vRows = [locV];
          }
        } catch (e) {}
      }

      if (vRows && vRows.length > 0) {
        const variant = vRows[0];
        vId = variant.id;
        vName = variant.variant_name || variant.title || vName;
        varSku = (variant.sku || '').trim() || (vId ? `${prodSku}-VAR-${vId}` : null);

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

    // Determine dynamic GST rate for this specific product (from Admin Panel or fallback)
    let itemGstRate = defaultStoreGstRate;
    if (product.gst_percent !== null && product.gst_percent !== undefined && product.gst_percent !== '') {
      const parsedGst = Number(product.gst_percent);
      if (!isNaN(parsedGst) && parsedGst >= 0) itemGstRate = parsedGst;
    } else if (product.gst_rate !== null && product.gst_rate !== undefined && product.gst_rate !== '') {
      const parsedRate = Number(product.gst_rate);
      if (!isNaN(parsedRate) && parsedRate >= 0) itemGstRate = parsedRate;
    }

    let itemGst = 0;
    if (isTaxInclusive) {
      // TAX INCLUSIVE: lineTotal already includes itemGstRate %
      itemGst = itemGstRate > 0 ? (lineTotal * (itemGstRate / (100 + itemGstRate))) : 0;
    } else {
      // TAX EXCLUSIVE: lineTotal is net, itemGstRate % added on top
      itemGst = itemGstRate > 0 ? ((lineTotal * itemGstRate) / 100) : 0;
    }
    totalCalculatedTax += itemGst;

    const itemFinalSku = varSku || prodSku;

    verifiedItems.push({
      product_id: product.id,
      variant_id: vId,
      product_title: finalTitle,
      product_name: finalTitle,
      variant_name: vName || null,
      sku: itemFinalSku,
      product_sku: prodSku,
      variant_sku: varSku,
      price: authenticUnitPrice,
      price_inr: authenticUnitPrice,
      price_usd: Math.round((authenticUnitPrice / 83) * 100) / 100,
      quantity: rawQty,
      total: lineTotal,
      gst_percent: itemGstRate,
      gst_rate: itemGstRate,
      gst_amount: Math.round(itemGst * 100) / 100,
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
  // Dynamic Shipping Charge calculation based on Admin settings & limitation threshold
  const isFreeShippingApplicable = enableFreeShipping === 1 && taxableAmount >= storeFreeShippingThreshold;
  const shippingAmount = isFreeShippingApplicable ? 0 : storeShippingFee;

  // Scale tax proportionally if coupon discount is applied
  const discountRatio = verifiedSubtotal > 0 ? Math.max(0, 1 - (verifiedDiscount / verifiedSubtotal)) : 1;
  const finalTaxAmount = Math.round(totalCalculatedTax * discountRatio * 100) / 100;

  let verifiedTotal = 0;
  if (isTaxInclusive) {
    // TAX INCLUSIVE: Product price already contains all taxes (extracted for invoice/compliance).
    // Tax is NEVER added on top of the customer's total amount.
    verifiedTotal = Math.round(taxableAmount + shippingAmount);
  } else {
    // TAX EXCLUSIVE: Product price is net. GST is added on top at checkout.
    verifiedTotal = Math.round(taxableAmount + finalTaxAmount + shippingAmount);
  }

  return {
    verifiedItems,
    subtotal: verifiedSubtotal,
    discountAmount: verifiedDiscount,
    couponCode: appliedCouponCode,
    taxableAmount,
    taxAmount: finalTaxAmount,
    shippingAmount,
    totalAmount: verifiedTotal,
    isTaxInclusive,
    defaultStoreGstRate,
    shippingFee: storeShippingFee,
    freeShippingThreshold: storeFreeShippingThreshold,
    isFreeShipping: isFreeShippingApplicable
  };
}

module.exports = {
  verifyAndCalculateOrderPricing
};
