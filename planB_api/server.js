const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const { errorHandler } = require('./src/utils/errorResponse');
const { sanitizeUserInput } = require('./src/middleware/validator');
const { protect } = require('./src/middleware/auth');
const connectDB = require('./src/config/db');
const routes = require('./src/config/routes');
const { verifyFirebaseToken } = require('./src/middleware/firebaseAuth');
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const { initializeSocket } = require('./src/services/socketService');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Constants
const {
    NODE_ENV = 'development',
    MONGODB_URI = 'mongodb://localhost:27017/planb_cafe',
    CLIENT_URL = 'http://localhost:3000'
} = process.env;

const PORT = process.env.PORT || 5000;
const app = express();
const server = require('http').createServer(app);

// Trust proxy
app.set('trust proxy', 1);

// Initialize Socket.IO
const io = initializeSocket(server);

// Security middleware (allow cross-origin images from /public)
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false
}));
app.use(cors({
    origin: NODE_ENV === 'development' 
        ? true  // Allow all origins in development
        : [CLIENT_URL, 'http://localhost:5173', 'https://walrus-app-at4vl.ondigitalocean.app',"http://localhost:3000", "https://plan-b-inky.vercel.app" ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.get("/", (req, res) => {
    res.send("API is running");
  });
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Rate limiting
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Compression
app.use(compression());

// Sanitize user input
app.use(sanitizeUserInput);

// Logging
if (NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Static files (serve uploaded images)
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/room-bookings', require('./src/routes/roomBooking'));
app.use('/api/rooms', require('./src/routes/rooms'));
app.use('/api/menu', require('./src/routes/menu'));
app.use('/api/categorey', require('./src/routes/categorey'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/catering-orders', require('./src/routes/cateringOrders'));
app.use('/api/payment', require('./src/routes/payment'));

// Error handling
app.use(errorHandler);

// Start server
server.listen(PORT, () => {
    console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
}); 