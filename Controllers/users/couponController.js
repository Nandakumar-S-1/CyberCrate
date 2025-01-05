const Coupon=require('../../Models/couponModel');
const Order=require('../../Models/orderModel');
const User=require('../../Models/userModel');


const verifyCoupon = async (req, res) => {
    try {
        const { couponCode, cartTotal } = req.body;
        const userId = req.session.user;

        const coupon = await Coupon.findOne({ code: couponCode });

        if (!coupon) {
            return res.status(404).json({ error: 'Coupon not found' });
        }

        if (coupon.expireOn < new Date()) {
            return res.status(400).json({ error: 'The Coupon you have entered is expired' });
        }

        if (cartTotal < coupon.minimumPrice) {
            return res.status(400).json({ success: false, message: 'The Coupon you have entered is not applicable for this order' });
        }

        const couponReduction = Math.min(cartTotal * (coupon.offerPrice / 100), coupon.maximumPrice);

        return res.status(200).json({ message: 'Coupon applied successfully', couponReduction });

    } catch (error) {
        console.log('Error while applying coupon', error);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Server error' });
        }
    }
};


// const verifyCoupon = async (req, res) => {
//     try {
//         const { couponCode, cartTotal } = req.body;
//         const userId = req.session.user;

//         const coupon = await Coupon.findOne({ code: couponCode });

//         if (!coupon) {
//             return res.status(404).json({ error: 'Coupon not found' });
//         }

//         if (coupon.expireOn < new Date()) {
//             return res.status(404).send('The Coupon you have entered is Expired');
//         }

//         if (cartTotal < coupon.minimumPrice) {
//             return res.status(404).json({ success: false, message: 'The Coupon you have entered is not applicable for this order' });
//         }

//         const couponReduction = Math.min(cartTotal * (coupon.offerPrice / 100), coupon.maximumPrice);
//         if (couponReduction > coupon.maximumPrice) {
//             return res.status(404).json({ success: false, message: 'The Coupon you have entered is not applicable for this order' });
//         }

//         return res.status(200).json({ message: 'Coupon applied successfully', couponReduction });

//     } catch (error) {
//         console.log('Error while applying coupon', error);
//         if (!res.headersSent) {
//             return res.status(500).json({ error: 'Server error' });
//         }
//     }
// };

module.exports = {
    verifyCoupon
};
