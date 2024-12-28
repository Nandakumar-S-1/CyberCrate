const Coupon=require('../../Models/couponModel')
const Order=require('../../Models/orderModel');

const loadCoupons=async(req,res)=>{
    try {
        const coupon=await Coupon.find()
        res.render('admin/coupons',{coupon})
    } catch (error) {
        console.log(error);
    }
}

const createCoupon = async (req,res) => {
    try {
        
    } catch (error) {
        
    }
}

const updateCoupon = async (req,res) => {
    try {
        
    } catch (error) {
        
    }
}

const deleteCoupon = async (req,res) => {
    try {
        
    } catch (error) {
        
    }
}

module.exports={
    loadCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon
}