const Coupon=require('../../Models/couponModel');
const Order=require('../../Models/orderModel');
const User=require('../../Models/userModel');

//function to verify coupon
const verifyCoupon = async (req, res) => {
    try {
        const { couponCode, cartTotal } = req.body;

        
        const coupon = await Coupon.findOne({ code: couponCode });
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        // Check coupon validity
        if (new Date(coupon.expireOn) < new Date()) {
            return res.status(400).json({ success: false, message: 'Coupon expired.' });
        }

        // Check if coupon is applicable or not
        if (cartTotal < coupon.minimumPrice || cartTotal > coupon.maximumPrice) {
            return res.status(400).json({ success: false, message: 'Coupon not applicable for this order.' });
        }

        // Check if coupon usage limit reached
        if (coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ success: false, message: 'Coupon usage limit reached.' });
        }

        // Check if coupon is active and listed
        if (!coupon.isListed) {
            return res.status(400).json({ success: false, message: 'Coupon is not valid.' });
        }

        // Calculate coupon reduction
        const couponReduction = Math.min(coupon.offerPrice, cartTotal);

        // Store in session
        req.session.coupon = couponCode;
        req.session.couponReduction = couponReduction;

        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res.status(500).json({ success: false, message: 'Error saving session data.' });
            }

            // Respond with success
            return res.status(200).json({
                success: true,
                message: 'Coupon applied successfully!',
                couponReduction: couponReduction,
            });
        });
        
    } catch (error) {
        console.error('Error while verifying coupon:', error);
        return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
};


module.exports = {
    verifyCoupon,
};