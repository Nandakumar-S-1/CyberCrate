const Order = require("../../Models/orderModel");
const User = require("../../Models/userModel");
const Cart = require("../../Models/cartModel");
const Address = require("../../Models/addressModel");
const Product = require("../../Models/productModel");
const Wallet=require("../../Models/walletModel");
const Razorpay = require("razorpay");
const dotenv = require("dotenv").config();
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const {walletPayment,walletRefund}=require("./walletController")


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_ID_KEY,
  key_secret: process.env.RAZORPAY_SECRET_KEY,
});

const verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
      req.body;
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET_KEY);
    // // hmac.update(razorpay_order_id+'|'+razorpay_payment_id);
    // hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);

    const generated_signature = hmac.digest("hex");

    if (generated_signature === razorpay_signature) {
      const order = await Order.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        { status: "Success" },
        { paymentId: razorpay_payment_id },
        { new: true }
      );

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      return res.json({
        status: "success",
        message: "Payment verified successfully",
        order,
      });
    } else {
      return res.status(400).json({ error: "Payment verification failed" });
    }
  } catch (error) {
    console.log("Error in verifying payment", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const calculateDiscount = (items) => {
  return items.reduce((discount, item) => {
    const productDiscount = item.productId.discount?.discount || 0;
    return discount + productDiscount * item.quantity;
  }, 0);
};

const placeOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { paymentMethod, selectedAddressId } = req.body;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const user = await User.findById(userId).populate("addresses");
    const addressData = await Address.findOne(
      {
        userId,
        "address._id": selectedAddressId,
      },
      { "address.$": 1 }
    );

    if (
      !addressData ||
      !addressData.address ||
      addressData.address.length === 0
    ) {
      return res.status(400).send({ message: "Selected address not found" });
    }

    const selectedAddress = addressData.address[0];
    const availableItems = cart.items.filter(
      (item) => !item.productId.isBlocked
    );
    cart.items = availableItems;

    if (availableItems.length === 0) {
      return res
        .status(400)
        .send({
          message: "Your Cart is currently empty due to blocked products",
        });
    }

    const totalAmount = cart.items.reduce(
      (total, item) => total + item.totalPrice,
      0
    );
    const discount = calculateDiscount(cart.items); // Calculate the discount
    const finalAmount = totalAmount - discount;

    for (let item of availableItems) {
      if (item.productId.quantity < item.quantity) {
        return res
          .status(400)
          .send({
            message: `Product ${item.productId.productName} is out of stock`,
          });
      }
    }

    if (paymentMethod === "COD") {
      const newOrder = new Order({
        user: userId,
        orderedItems: availableItems.map((item) => ({
          product: item.productId._id,
          quantity: item.quantity,
          price: item.totalPrice,
        })),
        totalPrice: totalAmount,
        finalAmount: finalAmount,
        discount: discount,
        subTotal: totalAmount,
        deliveryCharge: 0,
        address: selectedAddress,
        status: "Pending",
        paymentMethod,
      });

      let savedOrder = await newOrder.save();
      if (savedOrder) {
        await Cart.findByIdAndDelete(cart._id);
        for (let item of availableItems) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { quantity: -item.quantity },
          });
        }
      }
      return res
        .status(200)
        .json({
          success: true,
          message: "Order placed successfully",
          order: newOrder,
        });
    }else if(paymentMethod === "Wallet"){
      try{
        const wallet=await walletPayment(userId,finalAmount,"Order Placed");

        const newOrder = new Order({
          user: userId,
          orderedItems:availableItems.map((item) => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.totalPrice,
          })),
          totalPrice:totalAmount,
          finalAmount:finalAmount,
          discount:discount,
          subTotal:totalAmount,
          deliveryCharge:0,
          address:selectedAddress,
          status:"Pending",
          paymentMethod,
        })

        let savedOrder = await newOrder.save();
        if (savedOrder) {
            await Cart.findByIdAndDelete(cart._id);
            for (let item of availableItems) {
                await Product.findByIdAndUpdate(item.productId, {
                    $inc: { quantity: -item.quantity },
                });
            }
        }

        return res.status(200).json({
          success: true,
          message: "Order placed successfully using wallet",
          order: newOrder,
          walletBalance: wallet.balance
      });

      }catch(err){
        return res.status(400).json({
          success:false,
          message: error.message || "Error processing wallet payment"
        })
    }
      // const wallet=await Wallet.findOneAndReplace({userId})
      // if(!wallet||wallet.balance<finalAmount){
      //   return res.status(400).json({
      //     success:false,
      //     message:"Insufficient balance in your wallet"
      //   })
      // }

      // wallet.balance-=finalAmount;
      // wallet.walletHistory.nonAtomicPush({
      //   transactionType:"debit",
      //   amount:finalAmount,
      //   description:"Order Placed"
      // })
      // await wallet.save();



      // let savedOrder=await newOrder.save();
      // if(savedOrder){
      //   await Cart.findByIdAndDelete(cart._id)
      //   for(let oneItem of availableItems){
      //     await Product.findByIdAndUpdate(oneItem.productId,{
      //       $inc:{
      //         quantity:-oneItem.quantity
      //       }
      //     })
      //   }
      // }

      // return res.status(200).json({
      //   success:true,
      //   message:"Order placed successfully",
      //   order:newOrder,
      //   wallet,
      // })

    }else {
      const options = {
        amount: Math.round(finalAmount * 100),
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      };

      const razorpayOrder = await razorpay.orders.create(options);
      const newOrder = new Order({
        user: userId,
        orderedItems: availableItems.map((item) => ({
          product: item.productId._id,
          quantity: item.quantity,
          price: item.totalPrice,
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
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { quantity: -item.quantity },
          });
        }
      }
      console.log(
        "-----------------------iiiiiiiiiiii",
        razorpayOrder,
        "------",
        newOrder,
        "id--",
        razorpayOrder.id
      );

      return res
        .status(200)
        .json({
          success: true,
          order: newOrder,
          razorpayOrderId: razorpayOrder.id,
        });
    }
  } catch (error) {
    console.error("Error placing order:", error);
    return res.status(500).json({ message: "Error placing order" });
  }
};

// const cancelOrder = async (req, res) => {
//   try {
//     const { orderId } = req.body;
//     const order = await Order.findOne({ orderId });
//     if (!order) {
//       return res.status(404).send({ message: "Order has not found" });
//     }

//     // Check if the order can be cancelled
//     if (order.status === "Delivered" || order.status === "Refund Completed") {
//       return res.status(400).json({ message: "You cannot cancel this order" });
//     }

//     // Process refund for wallet or online payments
//     if(['Wallet','COD','Bank'].includes(order.paymentMethod)){
//       try {
//         await walletRefund(order.user,order.finalAmount,"Order Cancelled");
//       } catch (error) {
//           console.error("Refund error:", refundError);
//           return res.status(500).send({ 
//               message: "Error processing wallet refund" 
//           });
//       }
//     }

    
//     //   const wallet=await Wallet.findOneAndReplace({
//     //     userId:order.user
//     //   })
//     //   if(wallet){
//     //     wallet.balance+=order.finalAmount;
//     //     wallet.walletHistory.nonAtomicPush({
//     //       transactionType:"credit",
//     //       amount:order.finalAmount,
//     //       description:"Refund"
//     //     });
//     //     await wallet.save();
//     //   }
//     //   else{
//     //     const newWallet=new Wallet({
//     //       userId:order.user,
//     //       balance:order.finalAmount,
//     //       walletHistory:[{
//     //         transactionType:"credit",
//     //         amount:order.finalAmount,
//     //         description:"Refund"
//     //       }]
//     //     })
//     //     await newWallet.save();
//     //   }
//     // }

//     order.status = "Cancelled";
//         await order.save();

//         // Update product quantities
//         for (let item of order.orderedItems) {
//             await Product.findByIdAndUpdate(item.product, {
//                 $inc: { quantity: item.quantity },
//             });
//         }

//         return res.status(200).send({ 
//             message: "Order cancelled and refunded successfully" 
//         });
//     } catch (error) {
//         console.error("Error cancelling order:", error);
//         return res.status(500).send({ message: "Error cancelling order" });
//     }
// };

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    // Fetch the order by ID
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Ensure the order can be cancelled
    if (["Delivered", "Refund Completed"].includes(order.status)) {
      return res.status(400).json({ message: "You cannot cancel this order" });
    }

    // Process refund if applicable
    if (["Wallet", "COD", "Bank"].includes(order.paymentMethod)) {
      try {
        await walletRefund(order.user, order.finalAmount, "Cancelled");
      } catch (error) {
        console.error("Refund error:", error);
        return res.status(500).json({ message: "Error processing wallet refund" });
      }
    }

    // Update the order status
    order.status = "Cancelled";
    await order.save();

    // Restore product quantities
    for (let item of order.orderedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: item.quantity },
      });
    }

    return res.status(200).json({
      message: "Order cancelled and refunded successfully",
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return res.status(500).json({ message: "Error cancelling order" });
  }
};

// const placeOrders = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//       const userId = req.session.user._id;
//       const { paymentMethod, selectedAddressId } = req.body;

//       const cart = await Cart.findOne({ userId }).populate("items.productId").session(session);
//       const addressData = await Address.findOne(
//           { userId, "address._id": selectedAddressId },
//           { "address.$": 1 }
//       ).session(session);

//       if (!addressData?.address?.[0]) {
//           await session.abortTransaction();
//           return res.status(400).json({ success: false, message: "Selected address not found" });
//       }

//       const selectedAddress = addressData.address[0];
//       const availableItems = cart.items.filter(item => !item.productId.isBlocked);

//       if (availableItems.length === 0) {
//           await session.abortTransaction();
//           return res.status(400).json({
//               success: false,
//               message: "Your Cart is empty due to blocked products"
//           });
//       }

//       // Check stock availability
//       for (const item of availableItems) {
//           if (item.productId.quantity < item.quantity) {
//               await session.abortTransaction();
//               return res.status(400).json({
//                   success: false,
//                   message: `Product ${item.productId.productName} is out of stock`
//               });
//           }
//       }

//       const totalAmount = availableItems.reduce((total, item) => total + item.totalPrice, 0);
//       const discount = calculateDiscount(availableItems);
//       const finalAmount = totalAmount - discount;

//       const orderData = {
//           user: userId,
//           orderedItems: availableItems.map(item => ({
//               product: item.productId._id,
//               quantity: item.quantity,
//               price: item.totalPrice
//           })),
//           totalPrice: totalAmount,
//           finalAmount,
//           discount,
//           subTotal: totalAmount,
//           deliveryCharge: 0,
//           address: selectedAddress,
//           status: "Pending",
//           paymentMethod
//       };

//       if (paymentMethod === "Wallet") {
//           try {
//               const wallet = await walletPayment(userId, finalAmount, "Purchase", session);
//               orderData.walletTransactionId = wallet.walletHistory[wallet.walletHistory.length - 1].transactionId;
//           } catch (error) {
//               await session.abortTransaction();
//               return res.status(400).json({
//                   success: false,
//                   message: error.message || "Insufficient wallet balance"
//               });
//           }
//       } else if (paymentMethod === "Bank") {
//           const razorpayOrder = await razorpay.orders.create({
//               amount: Math.round(finalAmount * 100),
//               currency: "INR",
//               receipt: `receipt_${Date.now()}`
//           });
//           orderData.razorpayOrderId = razorpayOrder.id;
//       }

//       const newOrder = new Order(orderData);
//       await newOrder.save({ session });

//       // Update product quantities and remove cart
//       for (const item of availableItems) {
//           await Product.findByIdAndUpdate(
//               item.productId._id,
//               { $inc: { quantity: -item.quantity } },
//               { session }
//           );
//       }
//       await Cart.findByIdAndDelete(cart._id, { session });

//       await session.commitTransaction();

//       const response = {
//           success: true,
//           message: "Order placed successfully",
//           order: newOrder
//       };

//       if (paymentMethod === "Wallet") {
//           const wallet = await Wallet.findOne({ userId });
//           response.walletBalance = wallet.balance;
//       } else if (paymentMethod === "Bank") {
//           response.razorpayOrderId = orderData.razorpayOrderId;
//       }

//       return res.status(200).json(response);

//   } catch (error) {
//       await session.abortTransaction();
//       console.error("Error placing order:", error);
//       return res.status(500).json({
//           success: false,
//           message: "Error placing order"
//       });
//   } finally {
//       session.endSession();
//   }
// };

// const cancelOrder = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//       const { orderId } = req.body;
//       const order = await Order.findById(orderId).session(session);

//       if (!order) {
//           await session.abortTransaction();
//           return res.status(404).json({
//               success: false,
//               message: "Order not found"
//           });
//       }

//       if (["Delivered", "Refund Completed"].includes(order.status)) {
//           await session.abortTransaction();
//           return res.status(400).json({
//               success: false,
//               message: "You cannot cancel this order"
//           });
//       }

//       // Process refund
//       if (["Wallet", "Bank"].includes(order.paymentMethod)) {
//           try {
//               const wallet = await walletRefund(
//                   order.user,
//                   order.finalAmount,
//                   "Order Cancelled",
//                   session
//               );
//           } catch (error) {
//               await session.abortTransaction();
//               console.error("Refund error:", error);
//               return res.status(500).json({
//                   success: false,
//                   message: "Error processing refund"
//               });
//           }
//       }

//       // Update order status
//       order.status = "Cancelled";
//       await order.save({ session });

//       // Restore product quantities
//       for (const item of order.orderedItems) {
//           await Product.findByIdAndUpdate(
//               item.product,
//               { $inc: { quantity: item.quantity } },
//               { session }
//           );
//       }

//       await session.commitTransaction();
//       return res.status(200).json({
//           success: true,
//           message: "Order cancelled and refunded successfully"
//       });

//   } catch (error) {
//       await session.abortTransaction();
//       console.error("Error cancelling order:", error);
//       return res.status(500).json({
//           success: false,
//           message: "Error cancelling order"
//       });
//   } finally {
//       session.endSession();
//   }
// };


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
    const userId = req.session.user._id;
    const user = await User.findById(userId).populate("addresses");
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      select:
        "productName productImage realPrice salePrice quantity discount isBlocked",
    });

    if (!userId) {
      return res.status(400).send({ message: "User is not logged in" });
    }

    if (!cart || !Array.isArray(cart.items)) {
      return res.render("users/checkout", {
        user,
        addresses,
        defaultAddress: defaultAddress || null,
        cart: { items: [], totalAmount: 0, discount: 0, finalAmount: 0 },
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

    // const finalAmount = Math.max(cartTotal - totalDiscount, 0);
    const couponReduction = req.session.couponReduction || 0

    console.log("Session in Checkout:", req.session);
    console.log("Coupon Reduction in Checkout:", couponReduction);

    const finalAmount = Math.max(cartTotal - couponReduction, 0);

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
      },
    });
  } catch (error) {
    console.error("Error loading checkout page:", error);
    res.status(500).send({ message: "Error loading checkout page" });
  }
};

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

const orderDetails=async(req,res)=>{
  try {
    const userId=req.session.user;
    const orderId=req.params.id;

    // const order=await Order.findById(orderId).populate("orderedItems.product");
    const order = await Order.findOne({orderId}).populate({
      path: "orderedItems.product",
      populate:{
        path:"category brand",
        select:"categoryName brandName"
      },
      select: "productName productImage description ",
  });
  

    if(!order){
      return res.status(404).send({message:"Order not found"});
    }

    res.render("users/orderDetails",{order,userId});
  } catch (error) {
    console.error("Error fetching order details:", error.message);
    res.status(500).send({ message: "Internal Server Error" });
  }
}

module.exports = {
  getUserOrders,
  placeOrders,
  verifyPayment,
  getCheckoutPage,
  cancelOrder,
  selectAddress,
  orderDetails
};
