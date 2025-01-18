const Order = require("../../Models/orderModel");
const User = require("../../Models/userModel");
const Cart = require("../../Models/cartModel");
const Address = require("../../Models/addressModel");
const Product = require("../../Models/productModel");
const Wallet = require("../../Models/walletModel");

const dotenv = require("dotenv").config();
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Razorpay = require("razorpay");
const paypal = require("@paypal/checkout-server-sdk");

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE } = process.env;

// Set up PayPal environment
const environment =
    PAYPAL_MODE === "sandbox"
        ? new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
        : new paypal.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);

// Create PayPal client
const client = new paypal.core.PayPalHttpClient(environment);

// Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_ID_KEY,
    key_secret: process.env.RAZORPAY_SECRET_KEY,
});

// Currency conversion function
const currencyConverter = async (amountInINR) => {
    try {
        // Fetch conversion rates using axios
        const response = await axios.get(
            "https://v6.exchangerate-api.com/v6/f0eebce530bb1f3c54e78968/latest/INR"
        );

        // Get the USD conversion rate from the response
        const conversionRates = response.data.conversion_rates.USD;

        // Convert to USD
        const convertedUSD = (amountInINR * conversionRates).toFixed(2);
        return convertedUSD;
    } catch (error) {
        console.log("Error fetching conversion rates:", error.message);
        return null;
    }
};

// Create PayPal order
const createPaypalOrder = async (req, res) => {
    try {
        req.session.payment = req.body;
        const totalAmount = req.body.finalAmount;
        let total = await currencyConverter(totalAmount);

        const create_payment_json = {
            intent: "sale",
            payer: {
                payment_method: "paypal",
            },
            redirect_urls: {
                return_url: "http://localhost:3000/checkout/success",
                cancel_url: "http://localhost:3000/checkout/cancel",
            },
            transactions: [
                {
                    amount: {
                        total: total,
                        currency: "USD",
                    },
                },
            ],
        };

        client
            .execute(new paypal.orders.OrdersCreateRequest(create_payment_json))
            .then((response) => {
                // Retrieve approval URL from the PayPal response
                const approvalUrl = response.result.links.find(
                    (link) => link.rel === "approve"
                ).href;

                res.json({
                    success: true,
                    url: approvalUrl,
                });
            })
            .catch((error) => {
                console.error("Error creating PayPal payment:", error.message);
                res.json({
                    success: false,
                    message: "Failed to create PayPal payment",
                });
            });
    } catch (error) {
        console.log("PayPal payment Error:", error.message);
        res.status(500).render("404-error", { message: "Internal server error" });
    }
};

// PayPal payment success handler
const paymentSuccess = async (req, res) => {
    try {
        const { paymentMethod, finalAmount, shippingAddressId } =
            req.session.payment;
        const { paymentId, PayerID, token } = req.query;

        const userId = req.session.user;
        const cart = await Cart.findOne({ userId });
        const shippingAddress = await Address.findById(shippingAddressId);

        if (!shippingAddress) {
            return res.json({
                success: false,
                message: "Please make sure you select an address",
            });
        }

        const items = cart.items.map((item) => ({
            product: item.productId,
            quantity: item.quantity,
            price: item.price,
        }));

        // Create new order
        const newOrder = new Order({
            userId: userId,
            shippingAddress: shippingAddress,
            items: items,
            paymentMethod: paymentMethod,
            paymentId: paymentId,
            paymentStatus: "Completed",
            totalPrice: finalAmount,
            discount: cart.discount || 0,
            totalDiscount: cart.totalDiscount || 0,
            couponCode: cart.couponCode,
        });

        const savedOrder = await newOrder.save();
        if (savedOrder) {
            await Cart.findByIdAndDelete({ _id: cart._id });
            for (let item of items) {
                await Product.findByIdAndUpdate(item.product, {
                    $inc: { stock: -item.quantity },
                });
            }
        }

        res.redirect(`/order-placed?orderId=${savedOrder._id}`);
    } catch (error) {
        console.error("paymentSuccess:", error.message);
        res.status(500).render("internalError");
    }
};

// PayPal payment cancel handler
const paymentCancel = async (req, res) => {
    try {
        const { paymentMethod, finalAmount, shippingAddressId } =
            req.session.payment;

        const userId = req.session.user;
        const cart = await Cart.findOne({ userId });
        const shippingAddress = await Address.findById(shippingAddressId);

        if (!shippingAddress) {
            return res.json({
                success: false,
                message: "Please make sure you select an address",
            });
        }

        const items = cart.items.map((item) => ({
            product: item.productId,
            quantity: item.quantity,
            price: item.price,
        }));

        // Create new order with failed status
        const newOrder = new Order({
            userId: userId,
            shippingAddress: shippingAddress,
            items: items,
            paymentMethod: paymentMethod,
            orderStatus: "Failed",
            paymentStatus: "Pending",
            totalPrice: finalAmount,
            discount: cart.discount || 0,
            totalDiscount: cart.totalDiscount || 0,
            couponCode: cart.couponCode,
        });

        const savedOrder = await newOrder.save();
        if (savedOrder) {
            await Cart.findByIdAndDelete({ _id: cart._id });
            for (let item of items) {
                await Product.findByIdAndUpdate(item.product, {
                    $inc: { stock: -item.quantity },
                });
            }
        }

        res.redirect(`/order-placed?orderId=${savedOrder._id}`);
    } catch (error) {
        console.error("paymentCancel:", error.message);
        res.status(500).render("internalError");
    }
};

// PayPal payment from an existing order
const payFromOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { finalAmount } = await Order.findById(orderId);
        req.session.orderId = orderId;
        let total = await currencyConverter(finalAmount);

        const create_payment_json = {
            intent: "sale",
            payer: {
                payment_method: "paypal",
            },
            redirect_urls: {
                return_url: "http://localhost:3000/profile/payment-success",
                cancel_url: "http://localhost:3000/profile/payment-failed",
            },
            transactions: [
                {
                    amount: {
                        currency: "USD",
                        total: total,
                    },
                },
            ],
        };

        client
            .execute(new paypal.orders.OrdersCreateRequest(create_payment_json))
            .then((response) => {
                const approvalUrl = response.result.links.find(
                    (link) => link.rel === "approve"
                ).href;

                res.json({
                    success: true,
                    redirectUrl: approvalUrl,
                });
            })
            .catch((error) => {
                console.error("Error creating PayPal payment:", error.message);
                res.json({ success: false, message: "Payment creation failed" });
            });
    } catch (error) {
        console.error("payFromOrder:", error.message);
        res.status(500).render("internalError");
    }
};

// PayPal payment success handler from profile
const payNowSuccess = async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(req.session.orderId, {
            orderStatus: "Processing",
            paymentStatus: "Completed",
        });

        res.redirect("/profile#orders");
    } catch (error) {
        console.error(error.message);
        res.status(500).render("internalError");
    }
};

// PayPal payment cancel handler from profile
const payNowCancel = async (req, res) => {
    try {
        res.redirect("/profile#orders");
    } catch (error) {
        console.error(error.message);
        res.status(500).render("internalError");
    }
};

// Razorpay order creation
const createRazorpayOrder = async (finalAmount) => {
    const options = {
        amount: Math.round(finalAmount * 100), // Convert to paise
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
    };

    try {
        const razorpayOrder = await razorpay.orders.create(options);
        if (!razorpayOrder) {
            throw new Error("Failed to create Razorpay order");
        }
        return razorpayOrder;
    } catch (error) {
        throw new Error("Error creating Razorpay order: " + error.message);
    }
};

// Verify payment
const verifyPayment = async (
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature
) => {
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET_KEY);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generated_signature = hmac.digest("hex");

    if (generated_signature === razorpay_signature) {
        const order = await Order.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            {
                status: "Success",
                paymentId: razorpay_payment_id,
            },
            { new: true }
        );

        if (!order) {
            throw new Error("Order not found");
        }

        return order;
    } else {
        throw new Error("Payment verification failed");
    }
};

module.exports = {
    currencyConverter,
    createRazorpayOrder,
    verifyPayment,
    createPaypalOrder,
    paymentSuccess,
    paymentCancel,
    payFromOrder,
    payNowSuccess,
    payNowCancel,
};
