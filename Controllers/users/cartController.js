const Cart = require('../../Models/cartModel');
const Product = require('../../Models/productModel');
const User=require('../../Models/userModel')
const Coupon=require('../../Models/couponModel')

// const loadCart = async (req, res) => {
//     try {
//         const userId = req.session.user;
//         const user = await User.findById(userId);
//         const cart = await Cart.findOne({ userId }).populate('items.productId');

//         if (!cart || cart.items.length === 0) {
//             return res.render('users/cart', {
//                 items: [],
//                 cartTotal: 0,
//                 discount: 0,
//                 couponReduction: 0,
//                 message: 'Your cart is empty.'
//             });
//         }

//         let cartTotal = 0;
//         let totalDiscount = 0;
//         let couponReduction = 0;

//         const items = cart.items.map(item => {
//             if (!item.productId) return null;

//             const regularPrice = item.productId.realPrice || 0;
//             const salePrice = item.productId.salePrice || regularPrice;
//             const discount = regularPrice - salePrice;

//             if (!item.productId.isBlocked) {
//                 cartTotal += item.totalPrice;
//                 totalDiscount += discount * item.quantity;
//             }

//             return {
//                 ...item.toObject(),
//                 discount: discount.toFixed(2),
//                 isBlocked: item.productId.isBlocked,
//                 unavailableMessage: item.productId.isBlocked ? "This product is unavailable." : null,
//             };
//         }).filter(Boolean);

//         const appliedCoupon = req.query.coupon || null;
//         if (appliedCoupon) {
//             const coupon = await Coupon.findOne({
//                 code: appliedCoupon,
//                 isActive: true,
//                 isListed: true,
//                 expireOn: { $gt: new Date() }
//             });

//             if (coupon) {
//                 if (cartTotal >= coupon.minimumPrice) {
//                     couponReduction = Math.min(cartTotal * (coupon.offerPrice / 100), coupon.maximumPrice);
//                 }
//             }
//         }

//         res.render('users/cart', {
//             items,
//             cartTotal: cartTotal.toFixed(2),
//             discount: totalDiscount.toFixed(2),
//             couponReduction: couponReduction.toFixed(2),
//             message: ''
//         });
//     } catch (error) {
//         console.error("Error loading cart:", error);
//         res.status(500).send("Internal server error");
//     }
// };

// const applyCoupon = async (req, res) => {

//     try {
//         const { couponCode, cartTotal } = req.body;
//         let couponReduction = 0;    

//         const coupon = await Coupon.findOne({
//             code: couponCode,
//             isActive: true,
//             isListed: true,
//             expireOn: { $gt: new Date() }
//         });

//         if (!coupon) {
//             return res.status(400).json({ success: false, message: 'Invalid coupon code' });
//         }

//         if (cartTotal >= coupon.minimumPrice) {
//             couponReduction = Math.min(cartTotal * (coupon.offerPrice / 100), coupon.maximumPrice);
//         } else {
//             return res.status(400).json({ success: false, message: 'Cart total is less than the coupon minimum price' });
//         }

//         res.status(200).json({
//             success: true,
//             message: 'Coupon applied successfully',
//             discount: couponReduction.toFixed(2),
//             couponReduction: couponReduction.toFixed(2)
//         });
//     } catch (error) {
//         console.error("Error applying coupon:", error);
//         res.status(500).json({ success: false, message: 'Internal server error' });
//     }
// };


const validateCoupon = async (couponCode, cartTotal) => {
    let couponReduction = 0;
    
    const coupon = await Coupon.findOne({
        code: couponCode,
        isActive: true,
        isListed: true,
        expireOn: { $gt: new Date() }
    });

    if (!coupon) {
        return { valid: false, message: 'Invalid coupon code' };
    }

    if (cartTotal >= coupon.minimumPrice) {
        couponReduction = Math.min(cartTotal * (coupon.offerPrice / 100), coupon.maximumPrice);
        return { valid: true, couponReduction };
    }

    return { valid: false, message: 'Cart total is less than the coupon minimum price' };
};

const loadCart = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return res.render('users/cart', {
                items: [],
                cartTotal: 0,
                discount: 0,
                couponReduction: 0,
                message: 'Your cart is empty.'
            });
        }

        let cartTotal = 0;
        let totalDiscount = 0;
        let couponReduction = 0;

        const items = cart.items.map(item => {
            if (!item.productId) return null;

            const regularPrice = item.productId.realPrice || 0;
            const salePrice = item.productId.salePrice || regularPrice;
            const discount = regularPrice - salePrice;

            if (!item.productId.isBlocked) {
                cartTotal += item.totalPrice;
                totalDiscount += discount * item.quantity;
            }

            return {
                ...item.toObject(),
                discount: discount.toFixed(2),
                isBlocked: item.productId.isBlocked,
                unavailableMessage: item.productId.isBlocked ? "This product is unavailable." : null,
            };
        }).filter(Boolean);

        const appliedCoupon = req.query.coupon || null;
        if (appliedCoupon) {
            const couponResult = await validateCoupon(appliedCoupon, cartTotal);

            if (couponResult.valid) {
                couponReduction = couponResult.couponReduction;
            } else {
                console.log(couponResult.message);
            }
        }
        res.render('users/cart', {
            items,
            cartTotal: cartTotal.toFixed(2),
            discount: totalDiscount.toFixed(2),
            couponReduction: couponReduction.toFixed(2),
            message: ''
        });
    } catch (error) {
        console.error("Error loading cart:", error);
        res.status(500).send("Internal server error");
    }
};

const applyCoupon = async (req, res) => {
    try {
        const { couponCode, cartTotal } = req.body;

        const couponResult = await validateCoupon(couponCode, cartTotal);

        if (couponResult.valid) {
            res.status(200).json({
                success: true,
                message: 'Coupon have been applied successfully',
                discount: couponResult.couponReduction.toFixed(2),
                couponReduction: couponResult.couponReduction.toFixed(2)
            });
        } else {
            res.status(400).json({ success: false, message: couponResult.message });
        }
    } catch (error) {
        console.error("Error applying coupon:", error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const addItemToCart = async (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.session.user;

    try {
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User not logged in' });
        }

        if (!productId || !quantity) {
            return res.status(400).json({ success: false, message: 'Product ID and quantity are required' });
        }

        let cart = await Cart.findOne({ userId: userId });
        if (!cart) {
            cart = new Cart({ userId: userId, items: [] });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const productIndex = cart.items.findIndex(item => item.productId.toString() === productId);
        let newQuantity = quantity;

        if (productIndex !== -1) {
            newQuantity += cart.items[productIndex].quantity;
            cart.items[productIndex].quantity = newQuantity;
            cart.items[productIndex].totalPrice = product.salePrice * newQuantity;
        } else {
            cart.items.push({
                productId,
                quantity: newQuantity,
                price: product.salePrice,
                totalPrice: product.salePrice * newQuantity
            });
        }

        await cart.save();
        res.status(200).json({ success: true, message: 'Item added to cart', cart });
    } catch (error) {
        console.error("Error adding item to cart:", error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const removeItemFromCart = async (req, res) => {
    const { productId } = req.body;
    const userId = req.session.user;
    try {
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }
        cart.items = cart.items.filter(item => item.productId.toString() !== productId);
        await cart.save();
        res.status(200).json({ success: true, message: 'Item has been removed from cart' });
    }
    catch (error) {
        console.error("Error removing the item from cart:", error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

const updateQuantity = async (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.session.user;
    try {
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(400).json({ success: false, message: 'Cart not found' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const item = cart.items.find(item => item.productId.toString() === productId);
        if (item) {
            if (quantity > 3) {
                return res.status(400).json({ success: false, message: 'You can only purchase a maximum of 3 units per product' });
            }
            item.quantity = quantity;
            item.totalPrice = item.price * quantity;
            await cart.save();
            res.status(200).json({ success: true, message: 'Item quantity updated', cart });
        } else {
            res.status(404).json({ success: false, message: 'Item not found in cart' });
        }
    } catch (error) {
        console.error("Error updating item quantity:", error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};



module.exports = {
    loadCart,
    addItemToCart,
    removeItemFromCart,
    updateQuantity,
    applyCoupon
}