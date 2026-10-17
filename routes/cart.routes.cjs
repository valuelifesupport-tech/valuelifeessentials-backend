const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller.cjs');
const asyncHandler = require('../middleware/asyncHandler.cjs');
const { optionalCustomerAuth } = require('../middleware/customerAuth.cjs');

// Cart Endpoints — Protected against IDOR
router.get('/api/cart', optionalCustomerAuth, asyncHandler(cartController.getCart));
router.post('/api/cart', optionalCustomerAuth, asyncHandler(cartController.syncCart));
router.delete('/api/cart', optionalCustomerAuth, asyncHandler(cartController.deleteCartItem));

// Wishlist Endpoints — Protected against IDOR
router.get('/api/wishlist', optionalCustomerAuth, asyncHandler(cartController.getWishlist));
router.post('/api/wishlist', optionalCustomerAuth, asyncHandler(cartController.addWishlistItem));
router.delete('/api/wishlist', optionalCustomerAuth, asyncHandler(cartController.removeWishlistItem));

module.exports = router;
