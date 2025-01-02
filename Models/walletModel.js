const mongoose=require('mongoose');
const { Schema } = mongoose;

const transactionSchema = new Schema({
    transactionId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    transactionType: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        required: true
    }
})

const onlinePaymentSchema = new Schema({
    paymentId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        required: true
    }
})

const refundHistory=new Schema({
    refundId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    orderId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        required: true
    }
})

const walletSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',  
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    transactions: [transactionSchema],
    onlinePayments: [onlinePaymentSchema],
    refundHistory: [refundHistory]
}, { timestamps: true });

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;