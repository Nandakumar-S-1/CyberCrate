const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true,
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',  
        required: true
    },
    address: {
        addressType: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        landMark: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true
        },
        pincode: {
            type: Number,
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        alterPhone: {
            type: String,
            required: true
        }
    },
    orderedItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',  
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            default: 0
        }
    }],
    categoryId: {
        type: Schema.Types.ObjectId,
        ref: 'Category'
    },
    paymentMethod: {
        type: String,
        enum: ['COD','Bank','Online']
    },
    subTotal: {
        type: Number,
        required: true
    },
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true
    },
    deliveryCharge: {
        type: Number,
        required: false
    },
    deliveryMethod: {
        type: String,
        required: false
    },
    invoiceDate: {
        type: Date
    },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned']
    },
    couponApplied: {
        type: Boolean,
        default: false
    },
    couponDiscount: {
        type: Number,
        default: null
    },
    couponCode: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
