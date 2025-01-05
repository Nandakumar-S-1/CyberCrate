const Order = require("../../Models/orderModel");
const User = require("../../Models/userModel");
const Cart = require("../../Models/cartModel");
const Address = require("../../Models/addressModel");
const Product = require("../../Models/productModel");
const Razorpay = require("razorpay");
const dotenv = require("dotenv").config();
const crypto = require("crypto");
const {v4:uuidv4} = require('uuid');


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_ID_KEY,
  key_secret: process.env.RAZORPAY_SECRET_KEY,
});

const verifyPayment = async (req, res) => {
  try {

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET_KEY);
    // // hmac.update(razorpay_order_id+'|'+razorpay_payment_id);
    // hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);

    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
      const order = await Order.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { status: 'Success' },
        { paymentId: razorpay_payment_id },
        { new: true }
      );

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      return res.json({ status: 'success', message: 'Payment verified successfully', order });

    } else {
      return res.status(400).json({ error: "Payment verification failed" });
    }
  } catch (error) {

    console.log('Error in verifying payment', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const calculateDiscount = (items) => {
  return items.reduce((discount, item) => {
    const productDiscount = item.productId.discount?.discount || 0
    return discount + (productDiscount * item.quantity);
  }, 0);
};

// const placeOrders = async (req, res) => {
//   try {
//     const userId = req.session.user._id;
//     const { paymentMethod, selectedAddressId } = req.body;

//     const cart = await Cart.findOne({ userId }).populate("items.productId");
//     const user = await User.findById(userId).populate("addresses");
//     const addressData = await Address.findOne({
//       userId,
//       "address._id": selectedAddressId
//     }, { "address.$": 1 });

//     if (!addressData || !addressData.address || addressData.address.length === 0) {
//       return res.status(400).send({ message: "Selected address not found" });
//     }

//     const selectedAddress = addressData.address[0];
//     const availableItems = cart.items.filter(item => !item.productId.isBlocked);
//     cart.items = availableItems;

//     if (availableItems.length === 0) {
//       return res.status(400).send({ message: "Your Cart is currently empty due to blocked products" });
//     }

//     const totalAmount = cart.items.reduce((total, item) => total + item.totalPrice, 0);
//     // const discount = calculateDiscount(cart.items);
//     const discount=0
//     const finalAmount = totalAmount - discount;

//     for (let item of availableItems) {
//       if (item.productId.quantity < item.quantity) {
//         return res.status(400).send({ message: `Product ${item.productId.productName} is out of stock` });
//       }
//     }

//     if (paymentMethod === 'COD') {
//       // Handle COD Orders
//       const newOrder = new Order({
//         user: userId,
//         orderedItems: availableItems.map(item => ({
//           product: item.productId._id,
//           quantity: item.quantity,
//           price: item.totalPrice
//         })),
//         totalPrice: totalAmount,
//         finalAmount: finalAmount,
//         discount: discount,
//         subTotal: totalAmount,
//         deliveryCharge: 0,
//         address: selectedAddress,
//         status: "Pending",
//         paymentMethod
//       });

//       let savedOrder = await newOrder.save();
//       if (savedOrder) {
//         await Cart.findByIdAndDelete(cart._id);
//         for (let item of availableItems) {
//           await Product.findByIdAndUpdate(item.productId, { $inc: { quantity: -item.quantity } });
//         }
//       }
//       return res.status(200).json({ success: true, message: "Order placed successfully", order: newOrder });
//     } else {
//       // Handle Razorpay Orders
//       const options = {
//         amount: Math.round(finalAmount * 100), 
//         currency: "INR",
//         receipt: `receipt_${Date.now()}`
//       };

//       const razorpayOrder = await razorpay.orders.create(options);
//       const newOrder = new Order({
//         user: userId,
//         orderedItems: availableItems.map((item) => ({
//           product: item.productId._id,
//           quantity: item.quantity,
//           price: item.totalPrice
//         })),
//         totalPrice: totalAmount,
//         finalAmount: finalAmount,
//         discount: discount,
//         subTotal: totalAmount,
//         deliveryCharge: 0,
//         address: selectedAddress,
//         status: "Pending",
//         paymentMethod,
//         razorpayOrderId: razorpayOrder.id,
//       });

//       let savedOrder = await newOrder.save();
//       if (savedOrder) {
//         await Cart.findByIdAndDelete(cart._id);
//         for (let item of availableItems) {
//           await Product.findByIdAndUpdate(item.productId, { $inc: { quantity: -item.quantity } });
//         }
//       }
//       return res.status(200).json({ success: true, order: newOrder , razorpayOrderId: razorpayOrder.id });
//     }
//   } catch (error) {
//     console.error("Error placing order:", error);
//     return res.status(500).json({ message: "Error placing order" });
//   }
// };

const placeOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { paymentMethod, selectedAddressId } = req.body;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const user = await User.findById(userId).populate("addresses");
    const addressData = await Address.findOne({
      userId,
      "address._id": selectedAddressId
    }, { "address.$": 1 });

    if (!addressData || !addressData.address || addressData.address.length === 0) {
      return res.status(400).send({ message: "Selected address not found" });
    }

    const selectedAddress = addressData.address[0];
    const availableItems = cart.items.filter(item => !item.productId.isBlocked);
    cart.items = availableItems;

    if (availableItems.length === 0) {
      return res.status(400).send({ message: "Your Cart is currently empty due to blocked products" });
    }

    const totalAmount = cart.items.reduce((total, item) => total + item.totalPrice, 0);
    const discount = calculateDiscount(cart.items); // Calculate the discount
    const finalAmount = totalAmount - discount;

    for (let item of availableItems) {
      if (item.productId.quantity < item.quantity) {
        return res.status(400).send({ message: `Product ${item.productId.productName} is out of stock` });
      }
    }

    if (paymentMethod === 'COD') {
      const newOrder = new Order({
        user: userId,
        orderedItems: availableItems.map(item => ({
          product: item.productId._id,
          quantity: item.quantity,
          price: item.totalPrice
        })),
        totalPrice: totalAmount,
        finalAmount: finalAmount,
        discount: discount,
        subTotal: totalAmount,
        deliveryCharge: 0,
        address: selectedAddress,
        status: "Pending",
        paymentMethod
      });

      let savedOrder = await newOrder.save();
      if (savedOrder) {
        await Cart.findByIdAndDelete(cart._id);
        for (let item of availableItems) {
          await Product.findByIdAndUpdate(item.productId, { $inc: { quantity: -item.quantity } });
        }
      }
      return res.status(200).json({ success: true, message: "Order placed successfully", order: newOrder });
    } else {
      const options = {
        amount: Math.round(finalAmount * 100),
        currency: "INR",
        receipt: `receipt_${Date.now()}`
      };

      const razorpayOrder = await razorpay.orders.create(options);
      const newOrder = new Order({
        user: userId,
        orderedItems: availableItems.map((item) => ({
          product: item.productId._id,
          quantity: item.quantity,
          price: item.totalPrice
        })),
        totalPrice: totalAmount,
        finalAmount: finalAmount,
        discount: discount,
        subTotal: totalAmount,
        deliveryCharge: 0,
        address: selectedAddress,
        status: "Pending",
        paymentMethod,
        razorpayOrderId: razorpayOrder.id,
      });

      let savedOrder = await newOrder.save();
      if (savedOrder) {
        await Cart.findByIdAndDelete(cart._id);
        for (let item of availableItems) {
          await Product.findByIdAndUpdate(item.productId, { $inc: { quantity: -item.quantity } });
        }
      }
      console.log('-----------------------iiiiiiiiiiii', razorpayOrder,'------',newOrder,'id--',razorpayOrder.id);
      
      return res.status(200).json({ success: true, order: newOrder, razorpayOrderId: razorpayOrder.id });
    }
  } catch (error) {
    console.error("Error placing order:", error);
    return res.status(500).json({ message: "Error placing order" });
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

    res.render("users/orders", { orders });
  } catch (error) {
    console.error("Error getting user orders:", error);
    res.status(500).send({ message: "Error getting user orders" });
  }
};

const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.status(400).send({ message: "User is not logged in" });
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      select: "productName productImage realPrice salePrice quantity discount isBlocked",
    });

    const addressData = await Address.findOne({ userId });
    const addresses = addressData ? addressData.address : [];

    const user = await User.findById(userId).populate("addresses");
    let defaultAddress = addresses.find(
      (adrs) => adrs._id.toString() === user.defaultAddressId
    );

    if (!defaultAddress && addresses.length > 0) {
      defaultAddress = addresses[0];
    }

    if (!cart || !Array.isArray(cart.items)) {
      return res.render("users/checkout", {
        user,
        addresses,
        defaultAddress: defaultAddress || null,
        cart: { items: [], totalAmount: 0, discount: 0, finalAmount: 0 },
      });
    }

    let cartTotal = 0;
    let totalDiscount = 0;

    const items = cart.items.map(item => {
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
    }).filter(Boolean);

    const finalAmount = Math.max(cartTotal - totalDiscount, 0);

    res.render("users/checkout", {
      user,
      addresses,
      defaultAddress: defaultAddress || null,
      cart: {
        items,
        totalAmount: cartTotal.toFixed(2),
        discount: totalDiscount.toFixed(2),
        finalAmount: finalAmount.toFixed(2),
      },
    });
  } catch (error) {
    console.error("Error loading checkout page:", error);
    res.status(500).send({ message: "Error loading checkout page" });
  }
};

// const getCheckoutPage = async (req, res) => {
//   try {
//     const userId = req.session.user;

//     if (!userId) {
//       return res.status(400).send({ message: "User is not logged in" });
//     }

//     // const cart = await Cart.findOne({ userId }).populate("items.productId");
//     const cart= await Cart.findOne({ userId }).getPopulatedPaths({
//       paths: ["items.productId"],
//       select: "productName realPrice salePrice quantity discount isBlocked",
//     })
//     const addressData = await Address.findOne({ userId });
//     const addresses = addressData ? addressData.address : [];

//     const user = await User.findById(userId).populate("addresses");
//     let defaultAddress = addresses.find(
//       (adrs) => adrs._id.toString() === user.defaultAddressId
//     );

//     if (!defaultAddress && addresses.length > 0) {
//       defaultAddress = addresses[0];
//     }

//     if (!cart ||Array.isArray(cart.items) && cart.items.length === 0) {
//       return res.render("users/checkout", {
//         user,
//         addresses,
//         defaultAddress: defaultAddress || null,
//         cart: { items: [], totalAmount: 0, discount: 0, finalAmount: 0 },
//       });
//     }
//     console.log('cart.items are:---------------------------------',cart.items);


//     const availableItems = cart.items.filter(item => !item.productId.isBlocked);
//     cart.items = availableItems;

//     const totalAmount = cart.items.reduce(
//       (total, item) => total + item.totalPrice,0);

//     const discount = calculateDiscount(cart.items);
//     const finalAmount = totalAmount - discount;

//       console.log('cart.items are:',cart.items);


//     if (cart.items.length === 0) {
//       return res.render("users/checkout", {
//         user,
//         addresses,
//         defaultAddress: defaultAddress || null,
//         cart: { items: cart.items, totalAmount, discount, finalAmount },
//       });
//     }

//     res.render("users/checkout", {
//       user,
//       addresses,
//       defaultAddress: defaultAddress || null,
//       cart: { items: cart.items, totalAmount, discount, finalAmount },
//     });
//   } catch (error) {
//     console.error("Error loading checkout page:", error);
//     res.status(500).send({ message: "Error loading checkout page" });
//   }
// };

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

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).send({ message: "Order has not found" });
    }

    if (order.status === "Delivered" || order.status === "Refund Completed") {
      return res.status(400).send({ message: "You cannot cancel this order" });
    }

    order.status = "Cancelled";
    await order.save();

    return res
      .status(200)
      .send({ message: "Your Order has been cancelled Successfully" });
  } catch (error) {
    console.log("error while canceling order", error);
    return res.status(500).send({ message: "Error while canceling order" });
  }
};

module.exports = {
  getUserOrders,
  placeOrders,
  verifyPayment,
  getCheckoutPage,
  cancelOrder,
  selectAddress,
};