const Order = require("../../Models/orderModel");
const User = require("../../Models/userModel");
const Product = require("../../Models/productModel");
const Category = require("../../Models/categoryModel");
const Brand = require("../../Models/brandModel");
const Wallet=require("../../Models/walletModel")



const getAllOrders = async (req, res) => {
  try {
    const filterStatus = req.query.status || "";
    const searchOrderId = req.query.orderId || "";

    const filterQuery = {};
    
    // Apply status filter
    if (filterStatus) {
      filterQuery.status = filterStatus;
    }
    
    // Apply Order ID search (ensure it's a valid ObjectId format)
    if (searchOrderId) {
      filterQuery._id = searchOrderId;
    }

    let orders = await Order.find(filterQuery)
      .populate("orderedItems.product")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    orders = orders.filter((order) => order.user); // Ensure user exists

    const itemsPerPage = 10;
    const page = parseInt(req.query.page) || 1;
    const totalPages = Math.ceil(orders.length / itemsPerPage);
    const pageOrders = orders.slice(
      (page - 1) * itemsPerPage,
      page * itemsPerPage
    );

    res.render("admin/orderList", {
      orders: pageOrders,
      totalPages: totalPages,
      currentPage: "orderList",
      filterStatus: filterStatus,
      itemsPerPage: itemsPerPage,
      searchOrderId: searchOrderId,
      page: page,
    });
  } catch (error) {
    res.status(500).send({ message: "Error getting all orders" });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { orderId, updatedStatus } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Enforce status transition rules
    const currentStatus = order.status;

    const allowedTransitions = {
      Pending: ["Processing", "Shipped", "Delivered", "Cancelled"],
      Processing: ["Shipped", "Delivered", "Cancelled"],
      Shipped: ["Delivered"],
      Delivered: [],
      Cancelled: [],
      "Return Request": ["Returned"], 
      Returned: [] 
    };

    if (!allowedTransitions[currentStatus].includes(updatedStatus)) {
      return res.status(400).json({
        message: `Invalid status update from ${currentStatus} to ${updatedStatus}`
      });
    }

    order.status = updatedStatus;
    await order.save();
    return res.json({ message: "Status Updated Successfully", updatedStatus });
  } catch (error) {
    return res.status(500).json({ message: "Error updating order status" });
  }
};


// const updateStatus = async (req, res) => {
//   try {
//     const { orderId, updatedStatus } = req.body;
//     const order = await Order.findById(orderId);

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     if (order.status === "Cancelled" && updatedStatus !== "Refund Completed") {
//       return res.status(400).json({ message: "Cannot update a cancelled order" });
//     }

//     order.status = updatedStatus;
//     await order.save();
//     return res.json({ message: "Status Updated Successfully", updatedStatus });
//   } catch (error) {
//     return res.status(500).json({ message: "Error updating order status" });
//   }
// };

const viewOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).populate(
      "orderedItems.product"
    );
    if (!order) {
      return res.status(404).send({ message: "Order not found" });
    }
    res.render("admin/viewOrder", { order });
  } catch (error) {
    
    res.status(500).send({ message: "Internal Server Error" });
  }
};

const approveReturnOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "Return Request") {
      return res.status(400).json({ message: "Invalid return request" });
    }
    order.status = "Returned";
    await order.save();

    return res.status(200).json({
      message: "Return request approved successfully",
    });

  } catch (error) {
    console.error("Error approving return:", error);
    return res.status(500).json({ message: "Error approving return request" });
  }
};


module.exports = {
  getAllOrders,
  updateStatus,
  viewOrder,
  approveReturnOrder
};
