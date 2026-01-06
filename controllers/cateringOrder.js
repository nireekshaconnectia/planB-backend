const CateringOrder = require('../models/CateringOrder');
const User = require('../models/User');
const AppError = require('../utils/appError');
const { emitNewOrder, emitOrderUpdate, emitOrderStatusChange } = require('../services/socketService');
const catchAsync = require('../utils/catchAsync');

// @desc    Get all catering orders
// @route   GET /api/catering-orders
// @access  Private (Firebase token for users, JWT for superadmin)
exports.getCateringOrders = async (req, res, next) => {
    try {
        let query;
        
        // If user is superadmin (JWT token), show all orders
        if (req.user && req.user.role === 'superadmin') {
            query = CateringOrder.find();
        } else if (req.user && req.firebaseUser) {
            // For regular users (Firebase token), show orders by userId OR phone number
            const userPhoneNumber = req.user.phoneNumber;
            query = CateringOrder.find({
                $or: [
                    { 'user.userId': req.firebaseUser.uid },
                    { 'user.phone': userPhoneNumber }
                ]
            });
        } else {
            // For guest users or no auth, return empty array
            return res.status(200).json({
                success: true,
                count: 0,
                data: []
            });
        }

        const orders = await query.sort('-createdAt');
        res.status(200).json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Create catering order
// @route   POST /api/catering-orders
// @access  Public (Guest checkout allowed)
exports.createCateringOrder = async (req, res, next) => {
    try {
        console.log('Received catering order creation request:', req.body);
        
        // Check if order already exists
        let order = await CateringOrder.findOne({ orderId: req.body.orderId });
        
        if (order) {
            // Update existing order
            console.log('Updating existing catering order:', order.orderId);
            order = await CateringOrder.findOneAndUpdate(
                { orderId: req.body.orderId },
                {
                    $set: {
                        customerName: req.body.customerName,
                        customerPhone: req.body.customerPhone,
                        location: req.body.location,
                        address: req.body.address,
                        policyAccepted: req.body.policyAccepted,
                        items: req.body.items.map(item => ({
                            foodSlug: item.foodSlug,
                            foodName: item.foodName,
                            quantity: item.quantity,
                            foodPrice: item.foodPrice,
                            totalPrice: item.totalPrice,
                        })),
                        numberOfPeople: req.body.numberOfPeople,
                        deliveryCharge: req.body.deliveryCharge,
                        subtotal: req.body.subtotal,
                        total: req.body.total,
                        specialInstructions: req.body.specialInstructions || "",
                        deliveryDate: req.body.deliveryDate,
                        deliveryTime: req.body.deliveryTime,
                        paymentDetails: {
                            paymentMethod: req.body.paymentMethod,
                            amountPaid: req.body.total,
                            status: 'pending'
                        }
                    }
                },
                { new: true, runValidators: true }
            );
        } else {
            // Create new order
            const orderData = {
                orderId: req.body.orderId,
                customerName: req.body.customerName,
                customerPhone: req.body.customerPhone,
                location: req.body.location,
                address: req.body.address,
                policyAccepted: req.body.policyAccepted,
                items: req.body.items,
                numberOfPeople: req.body.numberOfPeople,
                selectedOptional: req.body.selectedOptional,
                deliveryCharge: req.body.deliveryCharge,
                subtotal: req.body.subtotal,
                total: req.body.total,
                user: {
                    userId: req.firebaseUser?.uid || null, // Handle guest users
                    name: req.body.customerName,
                    email: req.body.user?.email || req.body.customerEmail || null,
                    phone: req.body.customerPhone
                },
                specialInstructions: req.body.specialInstructions || '',
                deliveryDate: req.body.deliveryDate,
                deliveryTime: req.body.deliveryTime,
                paymentDetails: {
                    paymentMethod: req.body.paymentMethod,
                    amountPaid: req.body.total,
                    status: 'pending'
                }
            };

            order = await CateringOrder.create(orderData);
        }

        // Emit socket event for new order
        emitNewOrder(order);

        // If payment method is online, create payment info for frontend
        let paymentInfo = null;
        if (req.body.paymentMethod === 'online') {
            paymentInfo = {
                orderId: order.orderId,
                amount: order.total,
                firstName: order.user.name.split(' ')[0],
                lastName: order.user.name.split(' ').slice(1).join(' ') || '',
                phone: order.user.phone,
                email: order.user.email || '',
                type: 'catering'
            };
        }

        res.status(201).json({
            success: true,
            data: order,
            paymentInfo
        });
    } catch (err) {
        console.error('Error creating catering order:', err);
        next(err);
    }
};

// @desc    Get single catering order
// @route   GET /api/catering-orders/:id
// @access  Private
exports.getCateringOrder = async (req, res, next) => {
    try {
        const order = await CateringOrder.findById(req.params.id);

        if (!order) {
            return next(new AppError('Catering order not found', 404));
        }

        // Check if user has access to this order
        if (req.user && req.user.role === 'superadmin') {
            // Superadmin can access all orders
        } else if (req.firebaseUser) {
            // Regular users can only access their own orders
            if (order.user.userId !== req.firebaseUser.uid && 
                order.user.phone !== req.user.phoneNumber) {
                return next(new AppError('Not authorized to access this order', 403));
            }
        } else {
            return next(new AppError('Authentication required', 401));
        }

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update catering order status
// @route   PUT /api/catering-orders/:id/status
// @access  Private (Admin only)
exports.updateCateringOrderStatus = async (req, res, next) => {
    try {
        const { status } = req.body;

        if (!status) {
            return next(new AppError('Status is required', 400));
        }

        const validStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return next(new AppError('Invalid status', 400));
        }

        const order = await CateringOrder.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        );

        if (!order) {
            return next(new AppError('Catering order not found', 404));
        }

        // Emit socket event for order status change
        emitOrderStatusChange(order);

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get catering orders by phone number
// @route   GET /api/catering-orders/phone/:phoneNumber
// @access  Public
exports.getCateringOrdersByPhone = async (req, res, next) => {
    try {
        const { phoneNumber } = req.params;

        const orders = await CateringOrder.find({
            $or: [
                { 'user.phone': phoneNumber },
                { customerPhone: phoneNumber }
            ]
        }).sort('-createdAt');

        res.status(200).json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get catering order status
// @route   GET /api/catering-orders/status/:orderId
// @access  Public
exports.getCateringOrderStatus = async (req, res, next) => {
    try {
        const { orderId } = req.params;

        const order = await CateringOrder.findOne({ orderId });

        if (!order) {
            return next(new AppError('Catering order not found', 404));
        }

        res.status(200).json({
            success: true,
            data: {
                orderId: order.orderId,
                status: order.status,
                customerName: order.customerName,
                total: order.total,
                deliveryDate: order.deliveryDate,
                deliveryTime: order.deliveryTime
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete catering order
// @route   DELETE /api/catering-orders/:id
// @access  Private
exports.deleteCateringOrder = async (req, res, next) => {
    try {
        const order = await CateringOrder.findById(req.params.id);

        if (!order) {
            return next(new AppError('Catering order not found', 404));
        }

        // Check if user has permission to delete this order
        if (req.user && req.user.role === 'superadmin') {
            // Superadmin can delete any order
        } else if (req.firebaseUser) {
            // Regular users can only delete their own orders
            if (order.user.userId !== req.firebaseUser.uid) {
                return next(new AppError('Not authorized to delete this order', 403));
            }
        } else {
            return next(new AppError('Authentication required', 401));
        }

        await CateringOrder.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Catering order deleted successfully'
        });
    } catch (err) {
        next(err);
    }
}; 
