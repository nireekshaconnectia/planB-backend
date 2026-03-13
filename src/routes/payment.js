const express = require('express');
const {
    initiatePayment,
    verifyPayment,
    handleWebhook
} = require('../controllers/payment');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');

const router = express.Router();

// Payment creation - no auth required for guest checkout
router.post('/create', (req, res, next) => {
    console.log('POST /api/payment/create route hit');
    next();
}, initiatePayment);

// Payment verification no longer requires authentication
router.get('/verify/:paymentId', verifyPayment);

// Webhook route - no authentication needed
router.post('/webhook', (req, res, next) => {
    console.log('Webhook received at /api/payment/webhook');
    console.log('Webhook headers:', req.headers);
    console.log('Webhook body:', req.body);
    next();
}, handleWebhook);

// Export router
module.exports = router;