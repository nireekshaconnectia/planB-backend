const express = require('express');
const {
    getRooms,
    getRoom,
    createRoom,
    updateRoom,
    deleteRoom,
    getAvailableRooms,
    updateRoomAvailability,
    uploadRoomPhoto,
    deleteRoomPhoto,
    getAllActiveBookings,
    getBookingStatistics,
    getRoomBookings,
    getAllBookings,
    getRoomDayAvailability
} = require('../controllers/room');

const router = express.Router();
const uploadRoom = require('../middleware/uploadRoom');

const { protect, authorize, protectWithBoth } = require('../middleware/auth');

// Public routes
router.get('/', getRooms);
router.get('/available', getAvailableRooms);
router.get('/:id/availability', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('ETag', '');
    res.set('Last-Modified', '');
    next();
}, getRoomDayAvailability);
router.get('/:id', getRoom);

// Admin routes (multipart for images)
router.post('/', protect, authorize('superadmin', 'admin'), uploadRoom.array('images'), createRoom);
router.put('/:id', protect, authorize('superadmin', 'admin'), uploadRoom.array('images'), updateRoom);
router.delete('/:id', protect, authorize('superadmin', 'admin'), deleteRoom);
router.put('/:id/availability', protect, authorize('superadmin', 'admin'), updateRoomAvailability);
router.put('/:id/photo', protect, authorize('superadmin', 'admin'), uploadRoomPhoto);
router.delete('/:id/photo', protect, authorize('superadmin', 'admin'), deleteRoomPhoto);

// Admin monitoring routes
router.get('/admin/bookings/active', protectWithBoth, getAllActiveBookings);
router.get('/admin/bookings/statistics', protectWithBoth, getBookingStatistics);
router.get('/admin/rooms/:id/bookings', protectWithBoth, getRoomBookings);
router.get('/admin/bookings', protectWithBoth, getAllBookings);

module.exports = router; 