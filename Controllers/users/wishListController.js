const Wishlist = require('../../Models/wishlistModel');
const Product = require('../../Models/productModel');
const Category = require('../../Models/categoryModel');
const Brand = require('../../Models/brandModel');


const loadWishlist = async (req, res) => {

    try {

        const userId = req.session.user;
        const wishList = await Wishlist.findOne({ userId }).populate({
            path:'products.productId',
            populate:{path: 'category brand'},
            options:{sort:{createdAt:-1}},
        })

        if (!wishList || wishList.products.length === 0) {

            return res.render('users/wishlist', {
                wishlist: {
                products: []
                },
                totalPages: 0,
                currentPage: 1
            })
        }
        const itemsPerPage = 6;
        const page = parseInt(req.query.page) || 1;
        const totalPages = Math.ceil(wishList.products.length / itemsPerPage);
        const pageProducts = wishList.products.slice((page - 1) * itemsPerPage, page * itemsPerPage);

        res.render('users/wishlist', { wishlist: { products: pageProducts }, totalPages: totalPages, currentPage: page });

    } catch (error) {

        console.error('Error loading wishlist:', error);
        res.status(500).send({ message: 'Error loading wishlist' });

    }

}

const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const { productId } = req.body;

        let wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
        }

        const isProductExist = wishlist.products.some(item => item.productId.toString() === productId);
        if (!isProductExist) {
            wishlist.products.push({ productId, addedOn: Date.now() });
            await wishlist.save();
        }

        res.status(200).json({ success: true, wishlist });
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};



const removeFromWishlist = async (req, res) => {

    try {

        const userId = req.session.user;
        const { productId } = req.body;

        let wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }

        wishlist.products = wishlist.products.filter(item => item.productId.toString() !== productId);
        await wishlist.save();

        res.status(200).json({ success: true, wishlist });

    } catch (error) {

        console.error('Error removing item from wishlist:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });

    }

}

module.exports = {
    loadWishlist,
    addToWishlist,
    removeFromWishlist
}