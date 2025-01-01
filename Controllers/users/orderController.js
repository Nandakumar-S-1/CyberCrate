const Order = require("../../Models/orderModel");
const User = require("../../Models/userModel");
const Cart = require("../../Models/cartModel");
const Address = require("../../Models/addressModel");
const Product = require("../../Models/productModel");

// const placeOrders = async (req, res) => {
//   try {
//     const userId = req.session.user;
//     const { paymentMethod, selectedAddressId } = req.body;

//     const cart = await Cart.findOne({ userId }).populate("items.productId");
//     const user = await User.findById(userId).populate("addresses");
//     const addressData=await Address.findOne({userId,"address._id":selectedAddressId});

//     if(!addressData|| addressData.address.length===0 ||!addressData.address){
//       return res.status(400).send({ message: "No address has found" });
//     }
//     const selectedAddress = addressData.address[0];

//     const availableItems = cart.items.filter(
//       (item) => !item.productId.isBlocked
//     );
//     cart.items = availableItems;

//     if (availableItems.length === 0) {
//       return res
//         .status(400)
//         .send({
//           message: "Your Cart is currently empty due to blocked products",
//         });
//     }

//     const totalAmount = cart.items.reduce(
//       (total, item) => total + item.totalPrice,0
//     );
//     const discount = 0;
//     const finalAmount = totalAmount - discount;

//     // let defaultAddress = user.addresses.find(
//     //   (addr) => addr._id.toString() === user.defaultAddressId
//     // );

//     // if (!defaultAddress && user.addresses.length > 0) {
//     //   defaultAddress = user.addresses[0];
//     // }

//     // if (!defaultAddress) {
//     //   return res.status(400).send({ message: "No address found" });
//     // }

//     for (let item of availableItems) {
//       if (item.productId.quantity < item.quantity) {
//         return res.status(400).send({
//           message: `Product ${item.productId.productName} is out of stock`,
//         });
//       }
//     }

//     const newOrder = new Order({
//       user: userId,
//       orderedItems: availableItems.map((item) => ({
//         product: item.productId._id,
//         quantity: item.quantity,
//         price: item.totalPrice,
//       })),
//       totalPrice: totalAmount,
//       finalAmount: finalAmount,
//       discount: discount,
//       status: "Pending",
//       paymentMethod,
//       address: {
//         addressType: selectedAddress.addressType,
//         name: selectedAddress.name,
//         city: selectedAddress.city,
//         landMark: selectedAddress.landMark,
//         state: selectedAddress.state,
//         pincode: selectedAddress.pincode,
//         phone: selectedAddress.phone,
//         alterPhone: selectedAddress.alterPhone
//       }
//     });

//     let savedOrder = await newOrder.save();

//     // for (let item of cart.items) {
//     //   item.productId.quantity -= item.quantity;
//     //   if (item.productId.quantity === 0) {
//     //     item.productId.status = "Out of Stock";
//     //   }
//     //   await item.productId.save();
//     // }

//     if (savedOrder) {
//       await Cart.findByIdAndDelete(cart._id);

//       for (let item of availableItems) {
//         await Product.findByIdAndUpdate(item.productId, {
//           $inc: { quantity: -item.quantity },
//         });
//       }
//     }

//     res
//       .status(200)
//       .send({ message: "Order placed successfully", order: newOrder });
//   } catch (error) {
//     console.error("Error placing order:", error);
//     res.status(500).send({ message: "Error placing order" });
//   }
// };

const calculateDiscount=(items)=>{
  let discount=0;
  items.forEach(item=>{
    discount+=item.productId.discount
  })
}

const placeOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { paymentMethod, selectedAddressId } = req.body;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const user = await User.findById(userId).populate("addresses");
    const addressData = await Address.findOne({ 
      userId, 
      "address._id": selectedAddressId
    },
    { "address.$": 1 }
  );

    if (!addressData || !addressData.address || addressData.address.length === 0) {
      return res.status(400).send({ message: "Selected address not found" });
    }

    const selectedAddress = addressData.address[0];

    const availableItems = cart.items.filter(
      (item) => !item.productId.isBlocked
    );
    cart.items = availableItems;

    if (availableItems.length === 0) {
      return res.status(400).send({
        message: "Your Cart is currently empty due to blocked products",
      });
    }

    const totalAmount = cart.items.reduce(
      (total, item) => total + item.totalPrice,
      0
    );
    const discount = calculateDiscount(cart.items);
    const finalAmount = totalAmount - discount;

    for (let item of availableItems) {
      if (item.productId.quantity < item.quantity) {
        return res.status(400).send({
          message: `Product ${item.productId.productName} is out of stock`,
        });
      }
    }

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
      address: {
        addressType: selectedAddress.addressType,
        name: selectedAddress.name,
        city: selectedAddress.city,
        landMark: selectedAddress.landMark,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        phone: selectedAddress.phone,
        altPhone: selectedAddress.altPhone,
      },
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

    res.status(200).send({ message: "Order placed successfully", order: newOrder });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).send({ message: "Error placing order" });
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
    console.log("The current user is", userId);

    if (!userId) {
      return res.status(400).send({ message: "User is not logged in" });
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    console.log("The cart is", cart);

    const addressData = await Address.findOne({ userId });
    const addresses = addressData ? addressData.address : [];

    const user = await User.findById(userId).populate("addresses");
    let defaultAddress = addresses.find(
      (adrs) => adrs._id.toString() === user.defaultAddressId
    );

    if (!defaultAddress && addresses.length > 0) {
      defaultAddress = addresses[0];
    }

    if (!cart) {
      return res.render("users/checkout", {
        user,
        addresses,
        defaultAddress: defaultAddress || null,
        cart: { items: [], totalAmount: 0, discount: 0, finalAmount: 0 },
      });
    }

    const availableItems = cart.items.filter(
      (item) => !item.productId.isBlocked
    );
    cart.items = availableItems;

    const totalAmount = cart.items.reduce(
      (total, item) => total + item.totalPrice,
      0
    );
    const discount = 0;
    const finalAmount = totalAmount - discount;

    if (cart.items.length === 0) {
      return res.render("users/checkout", {
        user,
        addresses,
        defaultAddress: defaultAddress || null,
        cart: { items: [], totalAmount: 0, discount, finalAmount },
      });
    }

    res.render("users/checkout", {
      user,
      addresses,
      defaultAddress: defaultAddress || null,
      cart: { items: cart.items, totalAmount, discount, finalAmount },
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
  getCheckoutPage,
  cancelOrder,
  selectAddress,
};
