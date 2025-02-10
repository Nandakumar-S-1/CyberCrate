const Order = require("../../Models/orderModel");
const Wallet = require("../../Models/walletModel");
const User = require("../../Models/userModel");
const { v4: uuidv4 } = require("uuid");
const Razorpay = require("razorpay");
const dotenv = require("dotenv").config();
const crypto = require("crypto");


//function to load wallet
const getWalletPage = async (req, res) => {
  try {
    // const userId = req.session.user._id;
    const userId = req.session.user;
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: 0,
        walletHistory: [
          {
            transactionId: uuidv4(),
            transactionType: "credit",
            amount: 0,
            description: "Add to Wallet",
          },
        ],
      });

      await wallet.save();
    }

    res.render("users/wallet", { wallet, user: userId });
  } catch (error) {
    console.error("Error loading wallet page:", error);
    res.status(500).send({ message: "Error loading wallet page" });
  }
};

//function to add money
// const addMoneyToWallet = async (req, res) => {
//   try {
//     const { amount } = req.body;
//     const userId = req.session.user._id;

//     let wallet = await Wallet.findOne({ userId });
//     if (!wallet) {
//       wallet = new Wallet({ userId, balance: 0 });
//     }

//     let transaction = {
//       transactionId: uuidv4(),
//       transactionType: "credit",
//       amount: Number(amount),
//       date: new Date(),
//       description: "Add to Wallet",
//     };
//     console.log("Transaction:", transaction);

//     wallet.balance += Number(amount);
//     wallet.walletHistory.push(transaction);

//     console.log("Wallet-------------:", wallet);

//     await wallet.save();
//     res.status(200).json({ success: true, balance: wallet.balance });
//   } catch (error) {
//     console.error("Error adding money to wallet:", error);
//     res.status(500).json({ success: false, message: "Error adding money" });
//   }
// };

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_ID_KEY,
  key_secret: process.env.RAZORPAY_SECRET_KEY,
});

// Function to initiate wallet recharge
const initiateWalletRecharge = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.session.user._id;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid amount"
      });
    }

    const options = {
      amount: Math.round(amount * 100), 
      currency: "INR",
      receipt: `wallet_${Date.now()}`
    };

    // Use the razorpay instance to create order
    const razorpayOrder = await razorpay.orders.create(options);

    req.session.pendingWalletRecharge = {
      amount: Number(amount),
      userId,
      razorpayOrderId: razorpayOrder.id
    };

    return res.status(200).json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount,
      key_id: process.env.RAZORPAY_ID_KEY
    });

  } catch (error) {
    console.error("Error initiating wallet recharge:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error processing recharge request" 
    });
  }
};

const verifyWalletRecharge = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      payment_status,
      error_code,
      error_description
    } = req.body;

    const pendingRecharge = req.session.pendingWalletRecharge;
    if (!pendingRecharge) {
      return res.status(404).json({ 
        success: false, 
        message: "No pending recharge found" 
      });
    }

    if (payment_status === 'Failed') {
      delete req.session.pendingWalletRecharge;
      return res.json({
        status: "failed",
        message: "Recharge Failed",
        error: { code: error_code, description: error_description }
      });
    }

    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET_KEY);
    const data = `${razorpay_order_id}|${razorpay_payment_id}`;
    hmac.update(data);
    const generated_signature = hmac.digest("hex");

    if (generated_signature !== razorpay_signature) {
      delete req.session.pendingWalletRecharge;
      return res.status(400).json({
        status: "failed",
        message: "Payment verification failed"
      });
    }

    let wallet = await Wallet.findOne({ userId: pendingRecharge.userId });
    if (!wallet) {
      wallet = new Wallet({ userId: pendingRecharge.userId, balance: 0 });
    }

    const transaction = {
      transactionId: razorpay_payment_id,
      transactionType: "credit",
      amount: pendingRecharge.amount,
      date: new Date(),
      description: "Wallet Recharge",
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id
    };

    wallet.balance += pendingRecharge.amount;
    wallet.walletHistory.push(transaction);
    await wallet.save();

    delete req.session.pendingWalletRecharge;

    return res.json({
      status: "success",
      message: "Recharge successful",
      balance: wallet.balance
    });

  } catch (error) {
    console.error("Error verifying wallet recharge:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error processing recharge" 
    });
  }
};

//function to get balance
const getWalletBalance = async (userId) => {
  const wallet = await Wallet.findOne({ userId });
  return wallet ? wallet.balance : 0;
};

//function to check balance
const checkWalletBalance = async (userId, amount) => {
  const wallet = await Wallet.findOne({ userId });
  return wallet && wallet.balance >= amount;
};

//function to make payment
const walletPayment = async (userId, amount, description) => {
  const wallet = await Wallet.findOne({ userId });
  if (!wallet || wallet.balance < amount) {
    throw new Error("Insufficient wallet balance");
  }

  wallet.balance -= amount;
  wallet.walletHistory.push({
    transactionId: uuidv4(),
    transactionType: "debit",
    amount: amount,
    description: description,
  });

  await wallet.save();
  return wallet;
};

//function to make refund
const walletRefund = async (userId, amount, description) => {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = new Wallet({ userId, balance: 0 });
  }

  wallet.balance += amount;
  wallet.walletHistory.push({
    transactionId: uuidv4(),
    transactionType: "credit",
    amount: amount,
    description: description,
  });

  await wallet.save();
  return wallet;
};

module.exports = {
  getWalletPage,
  // addMoneyToWallet,
  initiateWalletRecharge,
  verifyWalletRecharge,
  walletPayment,
  walletRefund,
  checkWalletBalance,
  getWalletBalance,
};
