const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "User",
        required: true,
    },
    balance: {
        type: Number,
        default: 0,
    },
    walletHistory: [
        {
            transactionId: {
                type: String,
                required: true,
                default:()=>uuidv4()
            },
            transactionType: {
                type: String,
                enum: ["credit", "debit"],
                required: true,
            },
            amount: {
                type: Number,
                required: true,
            },
            date: {
                type: Date,
                default: Date.now,
            },
            description: {
                type: String,
                enum: ["Refund", "Add to Wallet", "Purchase",'Initial balance','Cancelled'],
            },
        },
    ],
},
    { timestamps: true }
);

walletSchema.index({ userId: 1 });
walletSchema.index({ "walletHistory.transactionId": 1 });

// walletSchema.index({ userId: 1 ,'walletHistory.transactionId': 1 }, { unique: true });

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;















// const mongoose=require('mongoose');
// const { Schema } = mongoose;

// const transactionSchema = new Schema({
//     transactionId: {
//         type: String,
//         required: true,
//         unique: true,
//         trim: true
//     },
//     transactionType: {
//         type: String,
//         required: true
//     },
//     amount: {
//         type: Number,
//         required: true
//     },
//     date: {
//         type: Date,
//         required: true
//     }
// })

// const onlinePaymentSchema = new Schema({
//     paymentId: {
//         type: String,
//         required: true,
//         unique: true,
//         trim: true
//     },
//     amount: {
//         type: Number,
//         required: true
//     },
//     date: {
//         type: Date,
//         required: true
//     }
// })

// const refundHistory=new Schema({
//     refundId: {
//         type: String,
//         required: true,
//         unique: true,
//         trim: true
//     },
//     orderId: {
//         type: String,
//         required: true,
//         unique: true,
//         trim: true
//     },
//     amount: {
//         type: Number,
//         required: true
//     },
//     date: {
//         type: Date,
//         required: true
//     }
// })

// const walletSchema = new Schema({
//     userId: {
//         type: Schema.Types.ObjectId,
//         ref: 'User',  
//         required: true
//     },
//     amount: {
//         type: Number,
//         required: true
//     },
//     transactions: [transactionSchema],
//     onlinePayments: [onlinePaymentSchema],
//     refundHistory: [refundHistory]
// }, { timestamps: true });

