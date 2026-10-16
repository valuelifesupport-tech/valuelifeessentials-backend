const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller.cjs');
const asyncHandler = require('../middleware/asyncHandler.cjs');
const { requireCustomerAuth } = require('../middleware/customerAuth.cjs');

// Cart Endpoints — Protected against IDOR
router.get('/api/cart', requireCustomerAuth, asyncHandler(cartController.getCart));
router.post('/api/cart', requireCustomerAuth, asyncHandler(cartController.syncCart));
router.delete('/api/cart', requireCustomerAuth, asyncHandler(cartController.deleteCartItem));

// Wishlist Endpoints — Protected against IDOR
router.get('/api/wishlist', requireCustomerAuth, asyncHandler(cartController.getWishlist));
router.post('/api/wishlist', requireCustomerAuth, asyncHandler(cartController.addWishlistItem));
router.delete('/api/wishlist', requireCustomerAuth, asyncHandler(cartController.removeWishlistItem));

module.exports = router;
