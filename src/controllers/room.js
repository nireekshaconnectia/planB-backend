const Room = require('../models/Room');
const ErrorResponse = require('../utils/errorResponse');
const RoomBooking = require('../models/RoomBooking');
const path = require('path');
const AppError = require('../utils/appError');

// @desc    Get all rooms
// @route   GET /api/rooms
// @access  Public
exports.getRooms = async (req, res, next) => {
    try {
        const rooms = await Room.find();
        res.status(200).json({
            success: true,
            count: rooms.length,
            data: rooms
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get single room
// @route   GET /api/rooms/:id
// @access  Public
exports.getRoom = async (req, res, next) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) {
            return next(new ErrorResponse(`Room not found with id of ${req.params.id}`, 404));
        }
        res.status(200).json({
            success: true,
            data: room
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get available rooms
// @route   GET /api/rooms/available
// @access  Public
exports.getAvailableRooms = async (req, res, next) => {
    try {
        const rooms = await Room.find({ isAvailable: true });
        res.status(200).json({
            success: true,
            count: rooms.length,
            data: rooms
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get room day availability (unavailable intervals)
// @route   GET /api/rooms/:id/availability?date=YYYY-MM-DD
// @access  Public
exports.getRoomDayAvailability = async (req, res, next) => {
    try {
        const roomId = req.params.id;
        const dateStr = req.query.date;

        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return next(new ErrorResponse('Query param "date" must be in YYYY-MM-DD format', 400));
        }

        // Ensure room exists
        const room = await Room.findById(roomId);
        if (!room) {
            return next(new ErrorResponse('Room not found', 404));
        }

        // Gulf timezone (Saudi/Qatar)
        const TIMEZONE = 'Asia/Riyadh';
        const OFFSET = '+03:00';

        const [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10));
        // UTC boundaries for the day to query bookings
        const dayStartUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        const dayEndUtc = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));

        // Find bookings for this room that fall on the given bookingDate
        const blockingStatuses = ['pending', 'approved', 'completed'];
        
        const bookings = await RoomBooking.find({
            room: roomId,
            bookingDate: { $gte: dayStartUtc, $lt: dayEndUtc },
            status: { $in: blockingStatuses }
        }).sort({ startTime: 1 });

        // Map to blocked time ranges for date-time picker
        const blockedRanges = bookings.map(b => ({
            startTime: b.startTime,  // "14:00" format
            endTime: b.endTime,      // "16:00" format
            bookingId: String(b._id)
        }));

        return res.status(200).json({
            timezone: TIMEZONE,
            openHours: { start: '08:00', end: '22:00' },
            blockedRanges,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Create room
// @route   POST /api/rooms
// @access  Private/Admin
exports.createRoom = async (req, res, next) => {
    try {
        console.log('POST /api/rooms - body:', req.body);
        console.log('POST /api/rooms - files:', (req.files || []).map(f => ({ fieldname: f.fieldname, filename: f.filename })));

        // Normalize fields from multipart/form-data
        const imagesFromFiles = (req.files || []).map(f => path.join('uploads', 'rooms', f.filename).replace(/\\/g, '/'));

        // amenities can come as 'amenities' or 'amenities[]'
        let amenitiesRaw = req.body.amenities ?? req.body['amenities[]'];
        if (typeof amenitiesRaw === 'string') {
            amenitiesRaw = [amenitiesRaw];
        }
        const amenities = Array.isArray(amenitiesRaw)
            ? amenitiesRaw.map(a => String(a).trim()).filter(Boolean)
            : [];

        const payload = {
            name: req.body.name,
            description: req.body.description,
            capacity: req.body.capacity !== undefined ? Number(req.body.capacity) : undefined,
            price: req.body.price !== undefined ? Number(req.body.price) : undefined,
            amenities,
            images: imagesFromFiles,
            isAvailable: typeof req.body.isAvailable === 'string'
                ? req.body.isAvailable === 'true' || req.body.isAvailable === '1' || req.body.isAvailable === 'on'
                : Boolean(req.body.isAvailable)
        };

        const room = await Room.create(payload);
        res.status(201).json({
            success: true,
            data: room
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update room
// @route   PUT /api/rooms/:id
// @access  Private/Admin
exports.updateRoom = async (req, res, next) => {
    try {
        console.log('PUT /api/rooms/:id - params:', req.params, 'body:', req.body);
        console.log('PUT /api/rooms/:id - files:', (req.files || []).map(f => ({ fieldname: f.fieldname, filename: f.filename })));

        const existing = await Room.findById(req.params.id);
        if (!existing) {
            return next(new ErrorResponse(`Room not found with id of ${req.params.id}`, 404));
        }

        const imagesFromFiles = (req.files || []).map(f => path.join('uploads', 'rooms', f.filename).replace(/\\/g, '/'));

        // existingImages may arrive as JSON string or array; represents images to keep from existing
        let existingImagesFromBody = req.body.existingImages ?? req.body['existingImages[]'] ?? undefined;
        if (typeof existingImagesFromBody === 'string') {
            try {
                const parsed = JSON.parse(existingImagesFromBody);
                if (Array.isArray(parsed)) {
                    existingImagesFromBody = parsed;
                } else if (parsed) {
                    existingImagesFromBody = [String(parsed)];
                }
            } catch (e) {
                // Not JSON, treat as single value
                existingImagesFromBody = [existingImagesFromBody];
            }
        }
        if (Array.isArray(existingImagesFromBody)) {
            existingImagesFromBody = existingImagesFromBody.map(v => String(v)).filter(Boolean);
        }

        let amenitiesRaw = req.body.amenities ?? req.body['amenities[]'];
        if (typeof amenitiesRaw === 'string') {
            amenitiesRaw = [amenitiesRaw];
        }
        const amenities = Array.isArray(amenitiesRaw)
            ? amenitiesRaw.map(a => String(a).trim()).filter(Boolean)
            : undefined; // undefined means do not modify if not sent

        const updateData = {
            name: req.body.name,
            description: req.body.description,
            capacity: req.body.capacity !== undefined ? Number(req.body.capacity) : undefined,
            price: req.body.price !== undefined ? Number(req.body.price) : undefined,
            isAvailable: typeof req.body.isAvailable === 'string'
                ? (req.body.isAvailable === 'true' || req.body.isAvailable === '1' || req.body.isAvailable === 'on')
                : (req.body.isAvailable !== undefined ? Boolean(req.body.isAvailable) : undefined)
        };

        if (amenities !== undefined) {
            updateData.amenities = amenities;
        }

        // Decide final images:
        // - If client sent existingImages list, use that as the base (images to keep)
        // - Then append any newly uploaded files
        // - If neither provided, leave images unchanged
        if (Array.isArray(existingImagesFromBody) || imagesFromFiles.length > 0) {
            const kept = Array.isArray(existingImagesFromBody) ? existingImagesFromBody : existing.images;
            updateData.images = [...kept, ...imagesFromFiles];
        }

        const room = await Room.findByIdAndUpdate(
            req.params.id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        );
        if (!room) {
            return next(new ErrorResponse(`Room not found with id of ${req.params.id}`, 404));
        }
        res.status(200).json({
            success: true,
            data: room
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete room
// @route   DELETE /api/rooms/:id
// @access  Private/Admin
exports.deleteRoom = async (req, res, next) => {
    try {
        const room = await Room.findByIdAndDelete(req.params.id);
        if (!room) {
            return next(new ErrorResponse(`Room not found with id of ${req.params.id}`, 404));
        }
        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update room availability
// @route   PUT /api/rooms/:id/availability
// @access  Private/Admin
exports.updateRoomAvailability = async (req, res, next) => {
    try {
        const room = await Room.findByIdAndUpdate(
            req.params.id,
            { isAvailable: req.body.isAvailable },
            { new: true, runValidators: true }
        );
        if (!room) {
            return next(new ErrorResponse(`Room not found with id of ${req.params.id}`, 404));
        }
        res.status(200).json({
            success: true,
            data: room
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Upload room photo
// @route   PUT /api/rooms/:id/photo
// @access  Private/Admin
exports.uploadRoomPhoto = async (req, res, next) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) {
            return next(new ErrorResponse(`Room not found with id of ${req.params.id}`, 404));
        }
        
        if (!req.body.images || !Array.isArray(req.body.images)) {
            return next(new ErrorResponse('Please provide an array of image URLs', 400));
        }

        room.images = [...room.images, ...req.body.images];
        await room.save();

        res.status(200).json({
            success: true,
            data: room
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete room photo
// @route   DELETE /api/rooms/:id/photo
// @access  Private/Admin
exports.deleteRoomPhoto = async (req, res, next) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) {
            return next(new ErrorResponse(`Room not found with id of ${req.params.id}`, 404));
        }

        if (!req.body.imageUrl) {
            return next(new ErrorResponse('Please provide the image URL to delete', 400));
        }

        room.images = room.images.filter(img => img !== req.body.imageUrl);
        await room.save();

        res.status(200).json({
            success: true,
            data: room
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get all bookings (Admin only)
// @route   GET /api/rooms/admin/bookings/active
// @access  Private/Admin
exports.getAllActiveBookings = async (req, res, next) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
            return next(new AppError('Not authorized to access this route', 403));
        }

        const bookings = await RoomBooking.find()
            .populate('userId', 'name email phone')
            .populate('roomId', 'name capacity')
            .sort('-startTime');

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get booking statistics (Admin only)
// @route   GET /api/rooms/admin/bookings/statistics
// @access  Private/Admin
exports.getBookingStatistics = async (req, res, next) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
            return next(new AppError('Not authorized to access this route', 403));
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get today's bookings
        const todayBookings = await RoomBooking.countDocuments({
            startTime: { $gte: today }
        });

        // Get total rooms
        const totalRooms = await Room.countDocuments();

        // Get occupied rooms
        const occupiedRooms = await Room.countDocuments({
            status: 'occupied'
        });

        // Get available rooms
        const availableRooms = await Room.countDocuments({
            status: 'available'
        });

        // Get monthly statistics
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthlyBookings = await RoomBooking.countDocuments({
            startTime: { $gte: firstDayOfMonth }
        });

        // Calculate total revenue for the month
        const monthlyRevenue = await RoomBooking.aggregate([
            {
                $match: {
                    startTime: { $gte: firstDayOfMonth },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                todayBookings,
                totalRooms,
                occupiedRooms,
                availableRooms,
                monthlyBookings,
                monthlyRevenue: monthlyRevenue[0]?.total || 0
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get bookings for a specific room (Admin only)
// @route   GET /api/rooms/admin/rooms/:id/bookings
// @access  Private/Admin
exports.getRoomBookings = async (req, res, next) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
            return next(new AppError('Not authorized to access this route', 403));
        }

        const roomId = req.params.id;

        // Verify room exists
        const room = await Room.findById(roomId);
        if (!room) {
            return next(new AppError('Room not found', 404));
        }

        // Get all bookings for this room
        const bookings = await RoomBooking.find({ roomId })
            .populate('userId', 'name email phone')
            .sort('-startTime');

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get all bookings with complete data (Admin only)
// @route   GET /api/rooms/admin/bookings
// @access  Private/Admin
exports.getAllBookings = async (req, res, next) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
            return next(new AppError('Not authorized to access this route', 403));
        }

        const bookings = await RoomBooking.find()
            .populate('user', 'name email phone')
            .populate('room', 'name capacity amenities')
            .sort('-createdAt');

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings
        });
    } catch (err) {
        next(err);
    }
}; 