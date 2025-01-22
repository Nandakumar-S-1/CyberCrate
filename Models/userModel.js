const mongoose = require('mongoose');
const { ref } = require('pdfkit');
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: false,
        sparse: true,
        default: null
    },
    googleId: {
        type: String,
        unique: true
    },
    password: {
        type: String,
        required: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    
    addresses: [{
        type: Schema.Types.ObjectId,
        ref: 'Address'
    }],
    cart: [{
        type: Schema.Types.ObjectId,
        ref: 'Cart'
    }],
    wallet: {
        type: Schema.Types.ObjectId,
        ref: 'Wallet'  
    },
    wishList: [{
        type: Schema.Types.ObjectId,
        ref: 'Wishlist'
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: 'Order'
    }],
    isVerified: {
        type: Boolean,
        default: false
    },
    referalCode:{
        type:String,
        unique:true,
        required:false
    },
    referedBy:{
        type:Schema.Types.ObjectId,
        ref:'User',
        required:false
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
