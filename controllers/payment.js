const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const PaymentService = require('../services/payment.service');
const Order = require('../models/Order');
const RoomBooking = require('../models/RoomBooking');
const CateringOrder = require('../models/CateringOrder');

// Payment detail structures for different types
const orderPaymentDetails = (result, amount) => ({
    paymentMethod: 'online',
    amountPaid: amount,
    status: 'pending',
    transactionId: result.id,
    skipCashPaymentId: result.id,
    payUrl: result.payUrl,
    paymentDate: new Date()
});

const bookingPaymentDetails = (result, amount) => ({
    transactionId: result.id,
    status: 'pending',
    amount: amount,
    paymentMethod: 'online',
    paymentDate: new Date()
});

// @desc    Create payment
// @route   POST /api/payment/create
// @access  Public (Guest checkout allowed)
exports.initiatePayment = catchAsync(async (req, res, next) => {
    console.log('Payment request headers:', req.headers);
    console.log('Payment request body:', req.body);
    console.log('Firebase user:', req.firebaseUser);

    const { amount, firstName, lastName, phone, email, orderId, user } = req.body;

    // Extract name from user object if firstName/lastName not provided
    let finalFirstName = firstName;
    let finalLastName = lastName;
    
    if (!firstName && user?.name) {
        const nameParts = user.name.split(' ');
        finalFirstName = nameParts[0] || '';
        finalLastName = nameParts.slice(1).join(' ') || '';
    }

    // Validate required fields
    if (!amount || !finalFirstName || !phone || !email || !orderId) {
        console.log('Missing required fields:', { amount, firstName: finalFirstName, lastName: finalLastName, phone, email, orderId });
        return next(new AppError('Please provide all required fields', 400));
    }

    let order;
    let booking;
    let cateringOrder;
    let type;

    // Determine type based on orderId format
    if (orderId.startsWith('ORD-')) {
        type = 'order';
        // Try to find existing order
        order = await Order.findOne({ orderId });
        
        // If order doesn't exist, create it
        if (!order) {
            order = await Order.create({
                orderId,
                orderType: 'online',
                user: {
                    userId: req.firebaseUser?.uid || null, // Handle guest users
                    name: `${finalFirstName} ${finalLastName}`,
                    email,
                    phone
                },
                orderTotal: amount,
                items: [],
                paymentStatus: 'pending',
                paymentDetails: orderPaymentDetails({ id: 'pending' }, amount)
            });
            console.log('Created new order:', order.orderId);
        }
    } else if (orderId.startsWith('CAT-') || orderId.startsWith('CTR-')) {
        type = 'catering';
        // Try to find existing catering order
        cateringOrder = await CateringOrder.findOne({ orderId });
        
        if (!cateringOrder) {
            // Create catering order if it doesn't exist
            console.log('Creating new catering order for payment:', orderId);
            const orderData = {
                orderId: req.body.orderId,
                customerName: req.body.customerName || finalFirstName,
                customerPhone: req.body.phone,
                location: req.body.location || '',
                address: {
                    line1: req.body.address?.line1 || '',
                    line2: req.body.address?.line2 || '',
                    city: req.body.address?.city || '',
                    state: req.body.address?.state || '',
                    postalCode: req.body.address?.postalCode || '',
                    country: req.body.address?.country || ''
                },
                policyAccepted: req.body.policyAccepted || false,
                items: req.body.items || [],
                numberOfPeople: req.body.numberOfPeople || 1,
                selectedOptional: req.body.selectedOptional || [],
                deliveryCharge: req.body.deliveryCharge || 0,
                subtotal: req.body.subtotal || amount,
                total: req.body.total || amount,
                user: {
                    userId: req.firebaseUser?.uid || null,
                    name: `${finalFirstName} ${finalLastName}`,
                    email: req.body.email,
                    phone: req.body.phone
                },
                specialInstructions: req.body.specialInstructions || '',
                deliveryDate: req.body.deliveryDate || new Date(),
                deliveryTime: req.body.deliveryTime || '',
                paymentDetails: {
                    paymentMethod: 'online',
                    amountPaid: amount,
                    status: 'pending'
                }
            };
            
            cateringOrder = await CateringOrder.create(orderData);
            console.log('Created new catering order:', cateringOrder.orderId);
        }
    } else {
        type = 'booking';
        booking = await RoomBooking.findById(orderId);
        if (!booking) {
            return next(new AppError('Booking not found', 404));
        }
    }

    // Create payment using PaymentService
    // Create payment using PaymentService
    const result = await PaymentService.createPayment({
        amount,
        firstName: finalFirstName,
        lastName: 'Guest', // Static lastName for catering orders
        phone,
        email,
        orderId,
        type
    });

    console.log('Payment creation response:', result);

    if (type === 'order') {
        // Update regular order with Order model payment details
        order.paymentStatus = 'pending';
        order.paymentDetails = orderPaymentDetails(result, amount);
        await order.save();
    } else if (type === 'catering') {
        // Update catering order with payment details
        cateringOrder.paymentDetails = {
            paymentMethod: 'online',
            amountPaid: amount,
            status: 'pending',
            transactionId: result.id,
            skipCashPaymentId: result.id,
            payUrl: result.payUrl,
            paymentDate: new Date()
        };
        await cateringOrder.save();
    } else {
        // Update room booking with RoomBooking model payment details
        booking.paymentStatus = 'pending';
        booking.paymentDetails = bookingPaymentDetails(result, amount);
        await booking.save();
    }

    res.status(200).json({
        success: true,
        data: result
    });
});

exports.verifyPayment = catchAsync(async (req, res, next) => {
    const { paymentId } = req.params;

    if (!paymentId) {
        return next(new AppError('Payment ID is required', 400));
    }

    const result = await PaymentService.verifyPayment(paymentId);

    res.status(200).json({
        status: 'success',
        data: result
    });
});

exports.handleWebhook = catchAsync(async (req, res, next) => {
    console.log('=== Webhook Handler Started ===');
    console.log('Webhook request body:', JSON.stringify(req.body, null, 2));
    console.log('Webhook request headers:', JSON.stringify(req.headers, null, 2));

    const payload = req.body;
    if (!payload) {
        console.log('No payload received in webhook');
        return res.status(200).json({ received: true, message: 'No payload received' });
    }

    // Extract paymentId and status from payload
    const { PaymentId, StatusId, TransactionId } = payload;
    console.log('Webhook details:', { PaymentId, StatusId, TransactionId });

    if (!TransactionId) {
        console.log('No TransactionId in webhook payload');
        return res.status(200).json({ received: true, message: 'No TransactionId in payload' });
    }

    // Map StatusId to status (ensure lowercase)
    let status;
    switch(StatusId) {
        case 0:
            status = 'pending';
            break;
        case 1:
            status = 'pending';
            break;
        case 2:
            status = 'paid';
            break;
        case 3:
            status = 'failed';
            break;
        case 4:
            status = 'failed';
            break;
        case 5:
            status = 'failed';
            break;
        case 6:
            status = 'refunded';
            break;
        case 7:
            status = 'pending';
            break;
        case 8:
            status = 'failed';
            break;
        default:
            status = 'pending';
    }

    // Ensure status is lowercase
    status = status.toLowerCase();
    console.log('Mapped status:', status);

    try {
        // First check if it's a regular order (ORD-*)
        if (TransactionId.startsWith('ORD-')) {
            let order = await Order.findOne({ orderId: TransactionId });
            if (order) {
                console.log('Found order by orderId:', order._id);
                console.log('Current order status:', order.paymentStatus);
                console.log('Current payment details:', order.paymentDetails);

                // Preserve the existing user ID and other fields
                const existingUser = order.user;
                order.paymentDetails = {
                    ...order.paymentDetails,
                    status: status,
                    transactionId: TransactionId,
                    skipCashPaymentId: PaymentId,
                    paymentDate: new Date()
                };
                order.paymentStatus = status;
                // Ensure user field is preserved
                order.user = existingUser;
                
                // Save and verify the update
                const savedOrder = await order.save();
                console.log('Order saved successfully:', savedOrder._id);
                console.log('Updated payment status:', savedOrder.paymentStatus);
                console.log('Updated payment details:', savedOrder.paymentDetails);

                return res.status(200).json({ received: true });
            }
        }

        // Check if it's a catering order (CAT-* or CTR-*)
        if (TransactionId.startsWith('CAT-') || TransactionId.startsWith('CTR-')) {
            let cateringOrder = await CateringOrder.findOne({ orderId: TransactionId });
            if (cateringOrder) {
                console.log('Found catering order by orderId:', cateringOrder._id);
                console.log('Current payment details:', cateringOrder.paymentDetails);

                // Update payment details
                cateringOrder.paymentDetails = {
                    ...cateringOrder.paymentDetails,
                    status: status,
                    transactionId: TransactionId,
                    skipCashPaymentId: PaymentId,
                    paymentDate: new Date()
                };
                
                // Save and verify the update
                const savedCateringOrder = await cateringOrder.save();
                console.log('Catering order saved successfully:', savedCateringOrder._id);
                console.log('Updated payment details:', savedCateringOrder.paymentDetails);

                return res.status(200).json({ received: true });
            }
        }

        // If not a regular order, try RoomBooking collection
        let booking = await RoomBooking.findOne({
            $or: [
                { 'paymentDetails.transactionId': TransactionId },
                { 'paymentDetails.transactionId': PaymentId }
            ]
        });

        if (booking) {
            console.log('Found in RoomBooking collection:', booking._id);
            console.log('Current booking status:', booking.paymentStatus);
            console.log('Current payment details:', booking.paymentDetails);

            // Update payment details while preserving existing fields
            const updatedPaymentDetails = {
                ...booking.paymentDetails,
                transactionId: TransactionId,
                status: status,
                paymentMethod: 'online',
                paymentDate: new Date(),
                amount: booking.amount // Preserve the original amount
            };

            // Update the booking
            booking.paymentDetails = updatedPaymentDetails;
            booking.paymentStatus = status;
            
            // Save and verify the update
            const savedBooking = await booking.save();
            console.log('Booking saved successfully:', savedBooking._id);
            console.log('Updated payment status:', savedBooking.paymentStatus);
            console.log('Updated payment details:', savedBooking.paymentDetails);

            return res.status(200).json({ received: true });
        }

        // If not found in RoomBooking, try Order collection by other fields
        let order = await Order.findOne({
            $or: [
                { 'paymentDetails.transactionId': TransactionId },
                { 'paymentDetails.skipCashPaymentId': PaymentId }
            ]
        });

        if (order) {
            console.log('Found in Order collection:', order._id);
            console.log('Current order status:', order.paymentStatus);
            console.log('Current payment details:', order.paymentDetails);

            // Preserve the existing user ID and other fields
            const existingUser = order.user;
            order.paymentDetails = {
                ...order.paymentDetails,
                status: status,
                transactionId: TransactionId,
                skipCashPaymentId: PaymentId,
                paymentDate: new Date()
            };
            order.paymentStatus = status;
            // Ensure user field is preserved
            order.user = existingUser;
            
            // Save and verify the update
            const savedOrder = await order.save();
            console.log('Order saved successfully:', savedOrder._id);
            console.log('Updated payment status:', savedOrder.paymentStatus);
            console.log('Updated payment details:', savedOrder.paymentDetails);

            return res.status(200).json({ received: true });
        }

        // If not found in either collection, log available transactions for debugging
        console.log('Transaction not found in any collection');
        const allBookings = await RoomBooking.find({}, { 'paymentDetails.transactionId': 1, _id: 1 });
        const allOrders = await Order.find({}, { 'paymentDetails.transactionId': 1, 'paymentDetails.skipCashPaymentId': 1, orderId: 1, _id: 1 });
        const allCateringOrders = await CateringOrder.find({}, { 'paymentDetails.transactionId': 1, 'paymentDetails.skipCashPaymentId': 1, orderId: 1, _id: 1 });
        
        console.log('Available RoomBookings:', allBookings.map(b => ({
            bookingId: b._id,
            transactionId: b.paymentDetails?.transactionId
        })));
        console.log('Available Orders:', allOrders.map(o => ({
            orderId: o._id,
            transactionId: o.paymentDetails?.transactionId,
            skipCashPaymentId: o.paymentDetails?.skipCashPaymentId,
            orderIdString: o.orderId
        })));
        console.log('Available CateringOrders:', allCateringOrders.map(co => ({
            cateringOrderId: co._id,
            transactionId: co.paymentDetails?.transactionId,
            skipCashPaymentId: co.paymentDetails?.skipCashPaymentId,
            orderIdString: co.orderId
        })));

        // Return 200 even if not found to prevent webhook retries
        return res.status(200).json({ 
            received: true,
            message: 'Transaction not found in any collection'
        });
    } catch (error) {
        console.error('Error in webhook handler:', error);
        return res.status(200).json({ 
            received: true,
            error: error.message
        });
    }
});
// exports.handleWebhook = catchAsync(async (req, res, next) => {
//     const payload = req.body;
    
//     // Verify webhook signature if provided by SkipCash
//     // Process the webhook payload

//     // Update order status based on payment status
    
//     res.status(200).json({ received: true });
// });
