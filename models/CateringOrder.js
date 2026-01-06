const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
    line1: {
        type: String,
        required: true
    },
    line2: String,
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: false
    },
    postalCode: {
        type: String,
        required: false
    },
    country: {
        type: String,
        required: true
    }
});

const PaymentDetailsSchema = new mongoose.Schema({
    paymentMethod: {
        type: String,
        enum: ['online', 'cash'],
        required: true
    },
    transactionId: String,
    amountPaid: {
        type: Number,
        required: true
    },
    paymentDate: Date,
    skipCashPaymentId: String,
    status: {
        type: String,
        enum: ['new', 'pending', 'paid', 'failed', 'refunded'],
        default: 'new'
    },
    payUrl: String
});

const CateringItemSchema = new mongoose.Schema({
    foodSlug: {
        type: String,
        required: true
    },
    foodName: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    foodPrice: {
        type: Number,
        required: true
    },
    totalPrice: {
        type: Number,
        required: true
    }
});

const CateringOrderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    customerName: {
        type: String,
        required: true
    },
    customerPhone: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    address: {
        type: AddressSchema,
        required: true
    },
    policyAccepted: {
        type: Boolean,
        required: true,
        default: false
    },
    items: [{
        type: CateringItemSchema,
        required: true
    }],
    numberOfPeople: {
        type: Number,
        required: true,
        min: 1
    },
    selectedOptional: [{
        type: String,
        required: false
    }],
    deliveryCharge: {
        type: Number,
        required: true,
        default: 0
    },
    subtotal: {
        type: Number,
        required: true
    },
    total: {
        type: Number,
        required: true
    },
    user: {
        userId: {
            type: String,
            required: false
        },
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: false
        },
        phone: {
            type: String,
            required: true
        }
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'],
        default: 'pending'
    },
    paymentDetails: {
        type: PaymentDetailsSchema,
        required: true
    },
    specialInstructions: {
        type: String,
        default: ''
    },
    deliveryDate: {
        type: Date,
        required: true
    },
    deliveryTime: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field before saving
CateringOrderSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('CateringOrder', CateringOrderSchema); 
