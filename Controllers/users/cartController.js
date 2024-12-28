const Cart = require('../../Models/cartModel');
const Product = require('../../Models/productModel');

const loadCart = async (req, res) => {
    const userId = req.session.user;
    try {
        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return res.render('users/cart', { items: [], cartTotal: 0, discount: 0, message: 'Your cart is empty.' });
        }
        // cart.items = cart.items.filter(item => !item.productId.isBlocked);
        // await cart.save();
        // const cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
         // res.render('users/cart', { items: cart.items, cartTotal, discount: 0 });

        const cartTotal = cart.items.reduce((total, item) => !item.productId.isBlocked ? total + item.totalPrice : total, 0); 
        res.render('users/cart', { items: cart.items, cartTotal, discount: 0, message: '' });
        
    } catch (error) {
        console.error("Error loading cart:", error);
        res.status(500).send("Internal server error");
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
    updateQuantity
}