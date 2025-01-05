const User = require('../../Models/userModel');
const Product = require('../../Models/productModel');
const Order = require('../../Models/orderModel');
const mongoose = require('mongoose');
const Category = require('../../Models/categoryModel');
const Brand = require('../../Models/brandModel');
const Coupon=require('../../Models/couponModel')    
const bcrypt = require('bcrypt');
const { create } = require('connect-mongo');


const pageError = async (req, res) => {
    res.render('admin/adminError')
}

const securePassword = async (password) => {

    try {

        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash;

    } catch (error) {

        console.log('error while Securing password', error);
    }
}

const loadAdminLogin = async (req, res) => {
    try {
        if (req.session.admin) {
            res.redirect('/admin/dashboard');
        } else {
            res.render('admin/adminLogin', { error: null });
        }
    } catch (error) {
        console.error('Error loading admin login:', error);
        res.status(500).render('admin/adminLogin', { error: 'Internal server error' });
    }
}

const verifyLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email: email, isAdmin: true });

        if (admin && await bcrypt.compare(password, admin.password)) {
            req.session.admin = {
                id: admin._id, email: admin.email
            };
            res.redirect('/admin/dashboard');
        } else {
            res.render('admin/adminLogin', { error: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Error in admin login:', error);
        res.status(500).render('admin/adminLogin', { error: 'Internal server error' });
    }
}

const logout = async (req, res) => {
    try {

        req.session.destroy(err => {
            if (err) {
                console.log('Error while destroying session ', err);
                return res.redirect('/pageError')
            } else {
                res.redirect('/admin/login')
            }
        })

    } catch (error) {
        console.log('Error while logging out ', error);
        res.redirect('/pageError')
    }
}

const loadDashboard = async (req, res) => {
    try {

        const bestSellingProducts = await Product.find()
            .sort({ quantity: 1 })
            .limit(5);

        const newCustomers = await User.find({ isAdmin: false })
            .sort({ createdOn: -1 })
            .limit(5);

        const recentOrders = await Order.find()
            .populate('user address', 'name email')
            .populate('orderedItems.product','productName productImage')
            .sort({ createdAt: -1 })
            .limit(5);

            // console.log(recentOrders);            

        const {orderId,updatedStatus}=req.body;
        const order = await Order.findById(orderId);

        console.log(orderId);
        
        // if(updatedStatus==='pending'){

        // }
    
            
        const totalOrders = await Order.countDocuments()
        const activeOrders = await Order.countDocuments({status:{$in:['Pending','Processing']}});
        const cancelledOrders = await Order.countDocuments({status:'Cancelled'})
        const completedOrders = await Order.countDocuments({status:'Delivered'})
        const returnedOrders = await Order.countDocuments({status:'Returned'})

        // const orders=await Order.find({status:'delivered'})
        // const totalRevenue=orders.reduce((sum,order)=>{
        //     sum+order.finalAmount
        // },0)

        // const totalDiscount=orders.reduce((sum,order)=>{
        //     sum+order.discount ||0
        // },0)

        const totalRevenueResult=await Order.aggregate([
            {$group:{_id:null,totalRevenue:{$sum:'$finalAmount'}}}
        ])
        const totalDiscountResult=await Order.aggregate([
            {$group:{_id:null,totalDiscount:{$sum:'$discount'}}}
        ])
        const couponsApplied=await Order.countDocuments({
            couponsUsed:{$exists:true,$ne:null}
        })
        const couponDiscountResult=await Order.aggregate([
            {$group:{_id:null,couponDiscount:{$sum:'$couponDiscount'}}}
        ])

        const numberOfCustomers=await User.countDocuments()

        totalRevenue=totalRevenueResult[0]?.totalRevenue || 0;
        totalDiscount=totalDiscountResult[0]?.totalDiscount || 0
        const couponDiscount=couponDiscountResult[0]?.couponDiscount || 0

        // console.log('Total Revenue Result:', totalRevenueResult);
        // console.log('Total Discount Result:', totalDiscountResult);
        // console.log('Coupon Discount Result:', couponDiscountResult);
        // console.log('Coupon Discount:', couponDiscount);
        // console.log('Coupons Applied:', couponsApplied);
        // console.log('Total Revenue:', totalRevenue);
        // console.log('Total Discount:', totalDiscount);
        // console.log('Active Orders:', activeOrders);
        // console.log('Cancelled Orders:', cancelledOrders);
        // console.log('Completed Orders:', completedOrders);
        // console.log('Returned Orders:', returnedOrders);       
        

        res.render('admin/adminDashboard', {
            currentPage: 'dashboard',
            bestSellingProducts,
            newCustomers,
            recentOrders,
            totalOrders,
            activeOrders,
            cancelledOrders,
            completedOrders,
            returnedOrders,
            totalRevenue,
            totalDiscount,
            couponsApplied,
            numberOfCustomers,
            couponDiscount
        });
    } catch (error) {
        res.redirect('/pageError')
    }
}


module.exports = {
    pageError,
    loadAdminLogin,
    verifyLogin,
    securePassword,
    logout,
    loadDashboard,

}