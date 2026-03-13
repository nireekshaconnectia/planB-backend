const express = require('express');
const {
    getCateringOrders,
    getCateringOrder,
    createCateringOrder,
    updateCateringOrderStatus,
    getCateringOrdersByPhone,
    getCateringOrderStatus,
    deleteCateringOrder
} = require('../controllers/cateringOrder');
const { cateringOrderRules, validate } = require('../middleware/validator');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');

const router = express.Router();

// Catering order creation - no auth required for guest checkout
router.post('/', cateringOrderRules.create, validate, createCateringOrder);

// Get catering orders by phone number - no auth required for guest users
router.get('/phone/:phoneNumber', getCateringOrdersByPhone);

// Get catering order status by order ID - no auth required for guest users
router.get('/status/:orderId', getCateringOrderStatus);

// Other routes require authentication
router.get('/', verifyFirebaseToken, getCateringOrders);
router.get('/:id', verifyFirebaseToken, getCateringOrder);
router.put('/:id/status', verifyFirebaseToken, updateCateringOrderStatus);
router.delete('/:id', verifyFirebaseToken, deleteCateringOrder);

module.exports = router; 