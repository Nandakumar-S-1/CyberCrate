const Order = require("../../Models/orderModel");
const User = require("../../Models/userModel");
const Cart = require("../../Models/cartModel");
const Address = require("../../Models/addressModel");
const Product = require("../../Models/productModel");
const Wallet = require("../../Models/walletModel");

const dotenv = require("dotenv").config();
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { walletPayment, walletRefund } = require("./walletController")
const Razorpay = require("razorpay");
const PDFDocument = require('pdfkit');
const { default: mongoose } = require("mongoose");

//function to get checkout page
const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId).populate("addresses");
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      select:
        "productName productImage realPrice salePrice quantity discount isBlocked",
    });

    const userCart = await Cart.findOne({ userId: userId });
    cartCount = userCart ? userCart.items.length : 0;
    

    if (!userId) {
      return res.status(400).send({ message: "User is not logged in" });
    }

    if (!cart || !Array.isArray(cart.items)) {
      return res.render("users/checkout", {
        user,
        addresses,
        defaultAddress: defaultAddress || null,
        cart: { items: [], totalAmount: 0, discount: 0, finalAmount: 0 },
        cartCount
      });
    }

    const addressData = await Address.findOne({ userId });
    const addresses = addressData ? addressData.address : [];

    let defaultAddress = addresses.find(
      (adrs) => adrs._id.toString() === user.defaultAddressId
    );

    if (!defaultAddress && addresses.length > 0) {
      defaultAddress = addresses[0];
    }

    let cartTotal = 0;
    let totalDiscount = 0;

    const items = cart.items.map((item) => {
      if (!item.productId) return null;

      const regularPrice = item.productId.realPrice || 0;
      const salePrice = item.productId.salePrice || regularPrice;
      const discount = regularPrice - salePrice;

      if (!item.productId.isBlocked) {
        const totalPrice = salePrice * item.quantity;
        cartTotal += totalPrice;
        totalDiscount += discount * item.quantity;

        return {
          ...item.toObject(),
          totalPrice: totalPrice.toFixed(2),
          discount: discount.toFixed(2),
          isBlocked: item.productId.isBlocked,
        };
      }
      return null;
    })
      .filter(Boolean);
    const deliveryCharge = 100;
    // const finalAmount = Math.max(cartTotal - totalDiscount, 0);
    const couponReduction = req.session.couponReduction || 0

    const finalAmount = Math.max(cartTotal + deliveryCharge - couponReduction, 0);

    res.render("users/checkout", {
      user,
      addresses,
      defaultAddress: defaultAddress || null,
      cart: {
        items,
        totalAmount: cartTotal.toFixed(2),
        discount: totalDiscount.toFixed(2),
        couponReduction: parseFloat(req.session.couponReduction || 0).toFixed(2),
        finalAmount: finalAmount.toFixed(2),
        deliveryCharge,
        cartCount
      },
    });
  } catch (error) {
    res.status(500).send({ message: "Error loading checkout page" });
  }
};

//function to calculate discount
const calculateDiscount = (items) => {
  return items.reduce((discount, item) => {
    const productDiscount = item.productId.discount?.discount || 0;
    return discount + productDiscount * item.quantity;
  }, 0);
};

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_ID_KEY,
  key_secret: process.env.RAZORPAY_SECRET_KEY,
});

const placeOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { paymentMethod, selectedAddressId } = req.body;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const addressData = await Address.findOne(
      { userId, "address._id": selectedAddressId },
      { "address.$": 1 }
    );

    if (!addressData || !addressData.address || addressData.address.length === 0) {
      return res.status(400).send({ message: "Selected address not found" });
    }

    const selectedAddress = addressData.address[0];
    const availableItems = cart.items.filter((item) => !item.productId.isBlocked);

    if (availableItems.length === 0) {
      return res.status(400).send({
        message: "Your Cart is currently empty due to blocked products",
      });
    }

    const totalAmount = cart.items.reduce(
      (total, item) => total + item.totalPrice,
      0
    );
    const deliveryCharge = 100;
    const discount = calculateDiscount(cart.items);
    const couponReduction = req.session.couponReduction || 0;
    const finalAmount = totalAmount + deliveryCharge - discount - couponReduction;

    const newOrderData = {
      user: userId,
      orderedItems: availableItems.map((item) => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.totalPrice,
      })),
      totalPrice: totalAmount,
      finalAmount,
      discount,
      subTotal: totalAmount,
      deliveryCharge,
      address: selectedAddress,
      paymentMethod,
      couponApplied: !!req.session.coupon,
      couponDiscount: couponReduction,
      couponCode: req.session.coupon || null,
    };


    if (paymentMethod === "COD") {
      if (finalAmount > 10000) {
        return res.status(400).json({
          success: false,
          message: "Cash on Delivery is not allowed for orders above ₹10,000",
        });
      }
      const newOrder = new Order({
        ...newOrderData,
        paymentStatus: "Pending",
        status: "Processing",
      });
      const savedOrder = await newOrder.save();
      await updateInventoryAndCart(cart, availableItems);
      return res.status(200).json({
        success: true,
        message: "Order placed successfully",
        order: savedOrder,
      });
    } else if (paymentMethod === "Wallet") {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet || wallet.balance < finalAmount) {
        return res.status(400).json({
          success: false,
          message: "Insufficient wallet balance",
        });
      }
      wallet.balance -= finalAmount;
      wallet.walletHistory.push({
        transactionType: "debit",
        amount: finalAmount,
        description: "Purchase",
      });
      await wallet.save();
      const newOrder = new Order({
        ...newOrderData,
        paymentStatus: "Paid",
        status: "Processing",
      });
      const savedOrder = await newOrder.save();
      await updateInventoryAndCart(cart, availableItems);
      return res.status(200).json({
        success: true,
        message: "Order placed successfully",
        order: savedOrder,
      });
    } else if (paymentMethod === "Razorpay") {
      const options = {
        amount: Math.round(finalAmount * 100),
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      };
      const razorpayOrder = await razorpay.orders.create(options);
      req.session.pendingOrder = {
        orderData: newOrderData,
        razorpayOrderId: razorpayOrder.id,
      };
      return res.status(200).json({
        success: true,
        razorpayOrderId: razorpayOrder.id,
        finalAmount,
        key_id: process.env.RAZORPAY_ID_KEY,
      });
    }
  } catch (error) {
    return res.status(500).json({ message: "Error placing order" });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      payment_status,
      error_code,
      error_description
    } = req.body;

    const pendingOrder = req.session.pendingOrder;
    if (!pendingOrder) {
      return res.status(404).json({ error: "No pending order found" });
    }

    // Handle failed payment first, before signature verification
    if (payment_status === 'Failed') {
      const orderData = {
        ...pendingOrder.orderData,
        razorpayOrderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        status: "Pending",
        paymentStatus: "Failed",
        error: {
          code: error_code,
          description: error_description
        }
      };

      const newOrder = new Order(orderData);
      const savedOrder = await newOrder.save();

      delete req.session.pendingOrder;

      return res.json({
        status: "failed",
        message: "Payment Failed",
        order: savedOrder,
      });
    }

    // Only verify signature for successful payments
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET_KEY);
    const data = `${razorpay_order_id}|${razorpay_payment_id}`;
    hmac.update(data);
    const generated_signature = hmac.digest("hex");

    if (generated_signature !== razorpay_signature) {
      console.error("Signature verification failed");

      // Create order with failed status if signature verification fails
      const orderData = {
        ...pendingOrder.orderData,
        razorpayOrderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        status: "Pending",
        paymentStatus: "Failed",
        error: {
          code: "SIGNATURE_VERIFICATION_FAILED",
          description: "Payment signature verification failed"
        }
      };

      const newOrder = new Order(orderData);
      const savedOrder = await newOrder.save();

      delete req.session.pendingOrder;

      return res.status(400).json({
        status: "failed",
        message: "Payment verification failed",
        order: savedOrder
      });
    }

    // Handle successful payment
    const orderData = {
      ...pendingOrder.orderData,
      razorpayOrderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      status: "Processing",
      paymentStatus: "Paid",
    };

    const newOrder = new Order(orderData);
    const savedOrder = await newOrder.save();

    const cart = await Cart.findOne({ userId: orderData.user });
    if (cart && cart.items && cart.items.length > 0) {
      for (let item of cart.items) {
        if (item.productId) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { quantity: -item.quantity },
          });
        }
      }
      await Cart.findByIdAndDelete(cart._id);
    }

    delete req.session.pendingOrder;

    return res.json({
      status: "success",
      message: "Payment verified successfully",
      order: savedOrder,
    });

  } catch (error) {
    console.error("Error in verifying payment:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const updateInventoryAndCart = async (cart, availableItems) => {
  for (let item of availableItems) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { quantity: -item.quantity },
    });
  }
  await Cart.findByIdAndDelete(cart._id);
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }
    if (["Delivered", "Failed", "Shipped", "Return Request", "Returned"].includes(order.status) || 
        order.paymentStatus === "Failed") {
      return res.status(400).json({ message: "You cannot cancel this order" });
    }

    // Process refund only if the payment was successful
    if (["Completed", "Paid"].includes(order.paymentStatus)) {
      if (["Wallet", "COD", "Razorpay"].includes(order.paymentMethod)) {
        try {
          await walletRefund(order.user, order.finalAmount, "Cancelled");
        } catch (error) {
          console.error("Refund error:", error);
          return res.status(500).json({ message: "Error processing wallet refund" });
        }
      }
    }

    order.status = "Cancelled";
    await order.save();

    for (let item of order.orderedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: item.quantity },
      });
    }

    return res.status(200).json({
      message: "Order cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return res.status(500).json({ message: "Error cancelling order" });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    const orders = await Order.find({ user: userId })
      .populate("orderedItems.product")
      .sort({ createdAt: -1 });

    res.render("users/orders", { orders, user: user });
  } catch (error) {
    console.error("Error getting user orders:", error);
    res.status(500).send({ message: "Error getting user orders" });
  }
};

//function to select address
const selectAddress = async (req, res) => {
  const userId = req.session.user;
  try {
    const { selectedAddressId } = req.body;
    if (!userId || !selectedAddressId) {
      return res.status(400).send({
        message: "UserId or addressId is not specified",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({
        message: "User not found",
      });
    }

    user.defaultAddressId = selectedAddressId;
    await user.save();
    res.redirect("/checkout");
  } catch (error) {
    console.error("Error selecting address:", error);
    res.status(500).send({ message: "Error selecting address" });
  }
};

//function to get order details
const orderDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;

    // const order=await Order.findById(orderId).populate("orderedItems.product");
    const order = await Order.findOne({ orderId }).populate({
      path: "orderedItems.product",
      populate: {
        path: "category brand",
        select: "categoryName brandName"
      },
      select: "productName productImage description ",
    });

    if (!order) {
      return res.status(404).send({ message: "Order not found" });
    }

    res.render("users/orderDetails", { order, userId });
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
  }
}

const generateInvoice = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findOne({ orderId }).populate({
      path: "orderedItems.product",
      populate: {
        path: "category brand",
        select: "categoryName brandName"
      },
      select: "productName productImage description realPrice salePrice"
    });

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text('CyberCrate', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('Tax Invoice/Bill of Supply', { align: 'center' });
    doc.moveDown();

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(12);
    doc.text(`Invoice Date: ${new Date(order.createdAt).toLocaleDateString()}`);
    doc.text(`Order ID: ${order.orderId}`);
    doc.moveDown();

    doc.fontSize(14).text('Billing Address:', { underline: true });
    doc.fontSize(12);
    doc.text(order.address.name);
    doc.text(`${order.address.addressType}`);
    doc.text(`${order.address.landMark}, ${order.address.city}`);
    doc.text(`${order.address.state} - ${order.address.pincode}`);
    doc.text(`Phone: ${order.address.phone}`);
    doc.moveDown();

    doc.fontSize(14).text('Order Items:', { underline: true });
    doc.moveDown();

    const tableTop = doc.y;
    doc.fontSize(12);
    doc.text('Item', 50, tableTop);
    doc.text('Qty', 300, tableTop);
    doc.text('Price', 400, tableTop);
    doc.text('Total', 500, tableTop);

    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();

    let yPosition = doc.y + 15;
    order.orderedItems.forEach(item => {
      doc.text(item.product.productName, 50, yPosition);
      doc.text(item.quantity.toString(), 300, yPosition);
      doc.text(`₹${parseInt(item.price / item.quantity)}`, 400, yPosition);
      doc.text(`₹${parseInt(item.price)}`, 500, yPosition);
      yPosition += 20;
    });

    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 20;

    doc.fontSize(12);
    doc.text('Subtotal:', 400, yPosition);
    doc.text(`₹${parseInt(order.totalPrice)}`, 500, yPosition);
    yPosition += 20;

    if (order.deliveryCharge) {
      doc.text('Shipping:', 400, yPosition);
      doc.text(`₹${parseInt(order.deliveryCharge)}`, 500, yPosition);
      yPosition += 20;
    }

    if (order.discount) {
      doc.text('Discount:', 400, yPosition);
      doc.text(`-₹${parseInt(order.discount)}`, 500, yPosition);
      yPosition += 20;
    }

    if (order.couponDiscount) {
      doc.text('Coupon Discount:', 400, yPosition);
      doc.text(`-₹${parseInt(order.couponDiscount)}`, 500, yPosition);
      yPosition += 20;
    }

    doc.fontSize(14);
    doc.text('Total Amount:', 400, yPosition);
    doc.text(`₹${parseInt(order.finalAmount)}`, 500, yPosition);

    doc.fontSize(10);
    const bottomPosition = doc.page.height - 50;
    doc.text('Thank you for shopping with CyberCrate!', 50, bottomPosition, { align: 'center' });

    doc.end();
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.status(500).send("Error generating invoice");
  }
};

const createRetryPaymentOrder = async (req, res) => {
  try {
      const { orderId, finalAmount } = req.body;

      console.log('Received retry payment order request:', req.body);

      const order = await Order.findOne({ orderId });
      if (!order) {
          return res.status(404).json({ 
              success: false, 
              message: "Order not found" 
          });
      }

      if (!finalAmount || finalAmount <= 0) {
        return res.status(400).json({ 
            success: false, 
            message: "Invalid amount" 
        });
    }

      // Create new Razorpay order
      const options = {
          amount: Math.round(finalAmount * 100),
          currency: "INR",
          receipt: orderId,
          payment_capture: 1,
      };

      const razorpayOrder = await razorpay.orders.create(options);

      // Save the new Razorpay order ID to the order
      order.razorpayOrderId = razorpayOrder.id;
      await order.save();

      return res.status(200).json({
          success: true,
          razorpayOrderId: razorpayOrder.id
      });

  } catch (error) {
      console.error("Error creating retry payment order:", error);
      return res.status(500).json({ 
          success: false, 
          message: "Error creating payment order" ,
          error: error.message 
      });
  }
};

const retryPayment = async (req, res) => {
  console.log('ssssssssssssssssssssssssss');
  
  try {
      const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing some of the payment details' 
        });
    }

      const order = await Order.findOne({ orderId });
      if (!order) {
          return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET_KEY);
      hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
      const generatedSignature = hmac.digest('hex');

      if (generatedSignature !== razorpay_signature) {
          return res.status(400).json({ success: false, message: 'Payment verification failed' });
      }

      order.paymentId = razorpay_payment_id;
      order.razorpayOrderId = razorpay_order_id;
      order.status = 'Processing';
      order.paymentStatus = 'Paid';
      await order.save();

      res.status(200).json({ status: 'success', message: 'Payment retried successfully', order });
  } catch (error) {
      console.error('Error retrying payment:', error.message,error.stack);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const returnOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if order can be returned
    if (order.status !== "Delivered") {
      return res.status(400).json({ message: "Order Cannot be Returned" });
    }

    // Process refund only if the payment was successful
    if (["Completed", "Paid"].includes(order.paymentStatus)) {
      if (["Wallet", "COD", "Razorpay"].includes(order.paymentMethod)) {
        try {
          await walletRefund(order.user, order.finalAmount, "Returned");
        } catch (error) {
          console.error("Refund error:", error);
          return res.status(500).json({ message: "Error processing wallet refund" });
        }
      }
    }

    // Update the order status
    order.status = "Return Request";
    await order.save();

    // Restore product quantities
    for (let item of order.orderedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: item.quantity },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Return request submitted successfully",
    });

  } catch (error) {
    console.error("Error while returning order:", error);
    return res.status(500).json({ message: "Error processing return request" });
  }
};

// const returnOrder = async (req, res) => {
//   try {
//     const { orderId } = req.params;

//     const order = await Order.findOne({ orderId });

//     if (!order) {
//       return res.status(404).json({ success: false, message: "Order not Found" });
//     }

//     if (order.status !== "Delivered") {
//       return res.status(400).json({ success: false, message: "Order Cannot be Returned" });
//     }

//     order.status = "Return Request";
//     await order.save();

//     res.json({ success: true, message: "Return request submitted" });

//   } catch (error) {
//     console.error("Error while returning order", error);
//     res.status(500).json({ success: false, message: "Server Error" });
//   }
// };


module.exports = {
  getUserOrders,
  placeOrders,
  verifyPayment,
  getCheckoutPage,
  cancelOrder,
  selectAddress,
  orderDetails,
  generateInvoice,
  retryPayment,
  createRetryPaymentOrder,
  returnOrder
};