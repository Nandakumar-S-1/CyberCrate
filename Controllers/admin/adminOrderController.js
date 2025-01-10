const Order = require("../../Models/orderModel");
const User = require("../../Models/userModel");
const Product = require('../../Models/productModel');
const Category = require('../../Models/categoryModel');
const Brand = require('../../Models/brandModel');


const getAllOrders = async (req, res) => {
    try {
        const filterStatus = req.query.status || "";

        let orders = await Order.find(filterStatus ? {status:filterStatus} : {})
            .populate("orderedItems.product")
            .populate("user", "name email")
            .sort({ createdAt: -1 });

        orders = orders.filter(order => order.user);

        const itemsPerPage = 10;
        const page = parseInt(req.query.page) || 1;
        const totalPages = Math.ceil(orders.length / itemsPerPage);
        const pageOrders = orders.slice((page - 1) * itemsPerPage, page * itemsPerPage);

        res.render("admin/orderList", { 
            orders: pageOrders, 
            totalPages: totalPages, 
            currentPage: page,
            filterStatus: filterStatus,
            itemsPerPage: itemsPerPage

        });
    } catch (error) {
        console.error("Error getting all orders:", error);
        res.status(500).send({ message: "Error getting all orders" });
    }
};

// const updateStatus = async (req, res) => {
//     try {
        
//         const {orderId,updatedStatus}=req.body;
//         const order = await Order.findById(orderId);

//         if(!order){
//             return res.status(404).send({message:"Order is Missing"});
//         }

//         if(order.status==='Cancelled'){
//             return res.status(400).send({message:"You cannot update status of cancelled order"});
//         }

//         order.status=updatedStatus;

//         await order.save();
//         return res.json({message:"Status Updated Successfully"});

//     } catch (error) {
        
//         console.log('error while updating order status',error);
//         return res.status(500).send({message:"Error while updating order status"});
        
//     }
// }

const updateStatus = async (req, res) => {
    try {
        const { orderId, updatedStatus } = req.body;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: "Order is Missing" });
        }

        if (order.status === 'Cancelled') {
            if(order.status!=='Refund Completed'){
                return res.status(400).json({ message: "You cannot update status of cancelled order" });
            }
        }

        order.status = updatedStatus;
        await order.save();
        return res.json({ message: "Status Updated Successfully" });

    } catch (error) {
        console.log('Error while updating order status', error);
        return res.status(500).json({ message: "Error while updating order status" });
    }
};


module.exports = {
    getAllOrders,
    updateStatus
};
