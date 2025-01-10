const Coupon=require('../../Models/couponModel')
const Order=require('../../Models/orderModel');

const loadCoupons=async(req,res)=>{
    try {
        const coupons=await Coupon.find()
        res.render('admin/coupons',{coupons:coupons})
    } catch (error) {
        console.log(error);
    }
}

const loadAddCoupon=async(req,res)=>{
    try {
        res.render('admin/addCoupon')
    } catch (error) {
        console.log(error);
    }
}

const createCoupon = async (req,res) => {
    try {
        const {code,offerPrice,minimumPrice,maximumPrice,expireOn,usageLimit,isListed}=req.body;
        const newCoupon=new Coupon({
            code,offerPrice,minimumPrice,maximumPrice,expireOn,usageLimit,isListed
        })

        await newCoupon.save();
        res.redirect('/admin/coupons')
    } catch (error) {
        console.error('Error occured whilr creating the coupon',error);
        res.status(500).send('something went wrong')
    }
}

const loadUpdateCoupon=async(req,res)=>{
    try {
        const {id}=req.params;
        const coupon=await Coupon.findById(id)

        if(!coupon){
            res.status(404).send('Coupon not found')
        }
        res.render('admin/updateCoupon',{coupon})
    } catch (error) {
        console.log('Error loading coupon for update:', error);
        res.status(500).send('Error loading coupon for update');
    }
}

const updateCoupon = async (req,res) => {
    try {
        const {id}=req.params;
        const {code,offerPrice,minimumPrice,maximumPrice,expireOn,usageLimit,isListed}=req.body;
        const coupon= await Coupon.findById(id);
        if(coupon){
            coupon.code=code;
            coupon.offerPrice=offerPrice;
            coupon.minimumPrice=minimumPrice;
            coupon.maximumPrice=maximumPrice;
            coupon.expireOn=expireOn;
            coupon.usageLimit=usageLimit;
            coupon.isListed=isListed;
            await coupon.save();
        }else{
            res.status(404).send('Coupon not found')
        }
        res.redirect('/admin/coupons')
    } catch (error) {
        console.error('Error updating coupon:', error); 
        res.status(500).send('Server Error');
    }
}

const deleteCoupon = async (req,res) => {
    
    try {
        
        const {couponId}=req.query;
        await Coupon.findByIdAndDelete(couponId);
        res.redirect('/admin/coupons')
    } catch (error) {
        console.error('Error whilee deleting coupon:', error);
        res.status(500).send('Server Error');
    }
}

module.exports={
    loadCoupons,
    loadAddCoupon,
    createCoupon,
    loadUpdateCoupon,
    updateCoupon,
    deleteCoupon
}