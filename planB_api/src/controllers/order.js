const Order = require('../models/Order');
const User = require('../models/User');
const AppError = require('../utils/appError');
const { emitNewOrder, emitOrderUpdate, emitOrderStatusChange } = require('../services/socketService');
const catchAsync = require('../utils/catchAsync');
const RoomBooking = require('../models/RoomBooking');

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private (Firebase token for users, JWT for superadmin)
exports.getOrders = async (req, res, next) => {
    try {
        let query;
        
        // If user is superadmin (JWT token), show all orders
        if (req.user && req.user.role === 'superadmin') {
            query = Order.find();
        } else if (req.user && req.firebaseUser) {
            // For regular users (Firebase token), show orders by userId OR phone number
            const userPhoneNumber = req.user.phoneNumber;
            query = Order.find({
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

// @desc    Create order
// @route   POST /api/orders
// @access  Public (Guest checkout allowed)
exports.createOrder = async (req, res, next) => {
    try {
        console.log('Received order creation request:', req.body);
        
        // Check if order already exists
        let order = await Order.findOne({ orderId: req.body.orderId });
        
        if (order) {
            // Update existing order
            console.log('Updating existing order:', order.orderId);
            order = await Order.findOneAndUpdate(
                { orderId: req.body.orderId },
                {
                    $set: {
                        items: req.body.items.map(item => ({
                            foodSlug: item.foodSlug,
                            foodName: item.foodName,
                            quantity: item.quantity,
                            foodPrice: item.foodPrice,
                            totalPrice: item.totalPrice,
                        })),
                        orderTotal: req.body.orderTotal,
                        orderType: req.body.orderType,
                        tableNumber: req.body.tableNumber,
                        notes: req.body.specialInstructions || "",
                        paymentDetails: {
                            paymentMethod: req.body.paymentMethod,
                            amountPaid: req.body.orderTotal,
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
                orderType: req.body.orderType,
                tableNumber: req.body.tableNumber,
                user: {
                    userId: req.firebaseUser?.uid || null, // Handle guest users
                    name: req.body.user.name || '',
                    email: req.body.user.email || '',
                    phone: req.body.user.phone || '',
                    address: req.body.deliveryAddress ? {
                        line1: req.body.deliveryAddress,
                        city: '',
                        state: '',
                        postalCode: '',
                        country: ''
                    } : undefined
                },
                orderStatus: 'pending',
                cookingStatus: 'not_started',
                paymentStatus: 'pending',
                orderTotal: req.body.orderTotal,
                items: req.body.items.map(item => ({
                    foodSlug: item.foodSlug,
                    foodName: item.foodName,
                    quantity: item.quantity,
                    foodPrice: item.foodPrice,
                    totalPrice: item.totalPrice,
                })),
                notes: req.body.specialInstructions || "",
                paymentDetails: {
                    paymentMethod: req.body.paymentMethod,
                    amountPaid: req.body.orderTotal,
                    status: 'pending'
                }
            };

            console.log('Creating order with data:', JSON.stringify(orderData, null, 2));
            order = await Order.create(orderData);
        }

        // Emit new order event
        emitNewOrder('restaurant', order);

        res.status(201).json({
            success: true,
            data: order
        });
    } catch (err) {
        console.error('Error creating order:', err);
        next(err);
    }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res, next) => {
    try {
        console.log('Getting order with ID:', req.params.id);
        console.log('Current user:', {
            id: req.user.id,
            role: req.user.role,
            firebaseUid: req.firebaseUser.uid
        });

        // Try to find order by orderId first
        let order = await Order.findOne({ orderId: req.params.id });

        // If not found by orderId, try MongoDB _id
        if (!order) {
            order = await Order.findById(req.params.id);
        }

        if (!order) {
            // If not found in Order collection, try RoomBooking
            const booking = await RoomBooking.findById(req.params.id);
            if (booking) {
                // If it's a room booking, return it in the order format
                const orderFormat = {
                    orderId: booking._id.toString(),
                    orderType: 'room_booking',
                    user: {
                        userId: booking.user,
                        name: booking.customerName,
                        email: booking.customerEmail,
                        phone: booking.customerPhone
                    },
                    orderTotal: booking.amount,
                    paymentStatus: booking.paymentStatus,
                    paymentDetails: booking.paymentDetails,
                    status: booking.status,
                    createdAt: booking.createdAt,
                    updatedAt: booking.updatedAt
                };

                return res.status(200).json({
                    success: true,
                    data: orderFormat
                });
            }
            return next(new AppError('Order not found', 404));
        }

        console.log('Found order:', {
            orderId: order.orderId,
            userId: order.user.userId,
            user: order.user
        });

        // Check if user is authorized to view this order
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            // For regular users, check if they own the order by userId OR phone number
            const userPhoneNumber = req.user.phoneNumber;
            const isOwnerByUserId = order.user.userId === req.firebaseUser.uid;
            const isOwnerByPhone = order.user.phone === userPhoneNumber;
            
            console.log('Checking order ownership:', {
                orderUserId: order.user.userId,
                orderPhone: order.user.phone,
                currentUserId: req.firebaseUser.uid,
                currentPhone: userPhoneNumber,
                isOwnerByUserId,
                isOwnerByPhone
            });
            
            if (!isOwnerByUserId && !isOwnerByPhone) {
                return next(new AppError('Not authorized to access this order', 401));
            }
        }

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (err) {
        console.error('Error in getOrder:', err);
        next(err);
    }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Firebase token for users, JWT for superadmin)
exports.updateOrderStatus = catchAsync(async (req, res, next) => {
    try {
        // Try to find in Order collection first
        let order = await Order.findOne({ orderId: req.params.id });
        let isRoomBooking = false;

        // If not found in Order, try RoomBooking
        if (!order) {
            const RoomBooking = require('../models/RoomBooking');
            const booking = await RoomBooking.findById(req.params.id);
            if (booking) {
                isRoomBooking = true;
                // Update booking status
                if (req.body.paymentStatus) {
                    booking.paymentStatus = req.body.paymentStatus.toLowerCase();
                }
                if (req.body.paymentDetails) {
                    booking.paymentDetails = {
                        ...booking.paymentDetails,
                        ...req.body.paymentDetails,
                        status: req.body.paymentDetails.status?.toLowerCase()
                    };
                }
                await booking.save();
                
                return res.status(200).json({
                    success: true,
                    data: booking,
                    type: 'roomBooking'
                });
            }
        }

        // If we get here, it's an order
        if (!order) {
            return next(new AppError(`Order/Booking not found with id of ${req.params.id}`, 404));
        }

        // Check if user is admin or superadmin
        if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
            return next(new AppError(`Not authorized to update order status`, 401));
        }

        // Update order status
        if (req.body.orderStatus) {
            order.orderStatus = req.body.orderStatus;
        }
        if (req.body.cookingStatus) {
            order.cookingStatus = req.body.cookingStatus;
        }
        if (req.body.paymentStatus) {
            order.paymentStatus = req.body.paymentStatus.toLowerCase();
        }
        if (req.body.paymentDetails) {
            order.paymentDetails = {
                ...order.paymentDetails,
                ...req.body.paymentDetails,
                status: req.body.paymentDetails.status?.toLowerCase()
            };
        }
        await order.save();

        // Emit order status change event
        emitOrderStatusChange('restaurant', order);

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (err) {
        next(err);
    }
});

// @desc    Get orders by phone number (for guest users)
// @route   GET /api/orders/phone/:phoneNumber
// @access  Public
exports.getOrdersByPhone = async (req, res, next) => {
    try {
        const { phoneNumber } = req.params;
        
        if (!phoneNumber) {
            return next(new AppError('Phone number is required', 400));
        }

        // Find orders by phone number
        const orders = await Order.find({ 'user.phone': phoneNumber })
            .sort('-createdAt')
            .select('-user.userId'); // Don't expose userId for guest orders

        res.status(200).json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get order status by order ID (public - no auth required)
// @route   GET /api/orders/status/:orderId
// @access  Public
exports.getOrderStatus = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        
        if (!orderId) {
            return next(new AppError('Order ID is required', 400));
        }

        // Try to find order by orderId first
        let order = await Order.findOne({ orderId: orderId });

        // If not found by orderId, try MongoDB _id
        if (!order) {
            order = await Order.findById(orderId);
        }

        if (!order) {
            // If not found in Order collection, try RoomBooking
            const booking = await RoomBooking.findById(orderId);
            if (booking) {
                // If it's a room booking, return it in the order format
                const orderFormat = {
                    orderId: booking._id.toString(),
                    orderType: 'room_booking',
                    user: {
                        name: booking.customerName,
                        email: booking.customerEmail,
                        phone: booking.customerPhone
                    },
                    orderTotal: booking.amount,
                    paymentStatus: booking.paymentStatus,
                    paymentDetails: booking.paymentDetails,
                    status: booking.status,
                    createdAt: booking.createdAt,
                    updatedAt: booking.updatedAt
                };

                return res.status(200).json({
                    success: true,
                    data: orderFormat
                });
            }
            return next(new AppError('Order not found', 404));
        }

        // Return only essential order status information (no sensitive data)
        const orderStatus = {
            orderId: order.orderId,
            orderStatus: order.orderStatus,
            cookingStatus: order.cookingStatus,
            paymentStatus: order.paymentStatus,
            orderTotal: order.orderTotal,
            items: order.items,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            user: {
                name: order.user.name,
                phone: order.user.phone
            }
        };

        res.status(200).json({
            success: true,
            data: orderStatus
        });
    } catch (err) {
        console.error('Error in getOrderStatus:', err);
        next(err);
    }
}; 