const express = require('express');
const {
    getOrders,
    getOrder,
    createOrder,
    updateOrderStatus,
    getOrdersByPhone,
    getOrderStatus
} = require('../controllers/order');
const { orderRules, validate } = require('../middleware/validator');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');

// Guest-friendly middleware
function allowGuestOrVerifyFirebaseToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        // No token, treat as guest
        return next();
    }
    // If token exists, verify as usual
    return verifyFirebaseToken(req, res, next);
}

const router = express.Router();

// Order creation - no auth required for guest checkout
router.post('/', orderRules.create, validate, createOrder);

// Get orders by phone number - no auth required for guest users
router.get('/phone/:phoneNumber', getOrdersByPhone);

// Get order status by order ID - no auth required for guest users
router.get('/status/:orderId', getOrderStatus);

// Other routes still require authentication
router.get('/', verifyFirebaseToken, getOrders);
router.get('/:id', allowGuestOrVerifyFirebaseToken, getOrder);
router.put('/:id/status', verifyFirebaseToken, updateOrderStatus);

module.exports = router; 