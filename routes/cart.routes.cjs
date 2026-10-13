const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller.cjs');
const asyncHandler = require('../middleware/asyncHandler.cjs');

// Cart Endpoints
router.get('/api/cart', asyncHandler(cartController.getCart));
router.post('/api/cart', asyncHandler(cartController.syncCart));
router.delete('/api/cart', asyncHandler(cartController.deleteCartItem));

// Wishlist Endpoints
router.get('/api/wishlist', asyncHandler(cartController.getWishlist));
router.post('/api/wishlist', asyncHandler(cartController.addWishlistItem));
router.delete('/api/wishlist', asyncHandler(cartController.removeWishlistItem));

module.exports = router;
