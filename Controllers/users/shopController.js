const Product = require('../../Models/productModel');
const Category = require('../../Models/categoryModel');
const Brand = require('../../Models/brandModel');
const User=require('../../Models/userModel');
const Order=require('../../Models/orderModel');
const Cart=require('../../Models/cartModel');
const Wallet=require('../../Models/walletModel');
const Address=require('../../Models/addressModel');
const Wishlist=require('../../Models/wishlistModel');
const mongoose=require('mongoose');


// const loadShop = async (req, res) => {
//     try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = 9;
//         const skip = (page - 1) * limit;
//         const sortBy = req.query.sortBy || 'default';
//         const minPrice = parseInt(req.query.minPrice) || 5000; 
//         const maxPrice = parseInt(req.query.maxPrice) || 500000; 

//         const selectedCategories = req.query.categories ? req.query.categories.split(',') : [];
//         const selectedBrands = req.query.brands ? req.query.brands.split(',') : [];
//         let query = { salePrice: { $gte: minPrice, $lte: maxPrice } , isBlocked: false}; 
//         let sortCriteria = {};

//         if (selectedCategories.length > 0){
//             query.category = { $in: selectedCategories };
//         }
//         if (selectedBrands.length > 0){
//             query.brand = { $in: selectedBrands };
//         }

//         if (sortBy === 'priceLowHigh') {
//             sortCriteria = { salePrice: 1 };
//         } else if (sortBy === 'priceHighLow') {
//             sortCriteria = { salePrice: -1 };
//         } else if(sortBy==='featured'){
//             sortCriteria={quantity:-1}
//         } else if(sortBy==='newArrivals'){
//             sortCriteria={createdAt:-1}
//         }else if(sortBy==='aToZ'){
//             sortCriteria={productName:1}
//         }else if(sortBy==='zToA'){
//             sortCriteria={productName:-1}
//         }


//         const products = await Product.find({ isBlocked: false, ...query })
//             .sort(sortCriteria)
//             .skip(skip)
//             .limit(limit);

//         const totalProducts = await Product.countDocuments({ isBlocked: false, ...query });
//         const totalPages = Math.ceil(totalProducts / limit);
//         const categories = await Category.find({ isListed: true });
//         const brands = await Brand.find({ isBlocked: false });

//         res.render('users/shop', {
//             products: products,
//             categories: categories,
//             brands: brands,
//             currentPage: 'shop',
//             totalPages: totalPages,
//             limit: limit,
//             selectedCategories: selectedCategories,
//             selectedBrands: selectedBrands,
//             sortWays: sortBy,
//             minPrice: minPrice,
//             maxPrice: maxPrice
//         });


//     } catch (error) {
//         console.log('Error while loading shop:', error);
//         res.redirect('/pageError');
//     }
// };


function calculateDiscount(realPrice, salePrice) {
    if (realPrice <= 0) return 0;
    return Math.round((realPrice - salePrice) / realPrice * 100);
}


const loadShop = async (req, res) => {
    try {

        const userId = req.session.user;

        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;
        const sortBy = req.query.sortBy || 'default';
        const minPrice = parseInt(req.query.minPrice) || 5000; 
        const maxPrice = parseInt(req.query.maxPrice) || 500000; 

        const selectedCategories = req.query.categories ? req.query.categories.split(',') : [];
        const selectedBrands = req.query.brands ? req.query.brands.split(',') : [];
        let query = { salePrice: { $gte: minPrice, $lte: maxPrice }, isBlocked: false }; 
        let sortCriteria = {};


        if (selectedCategories.length > 0) {
            query.category = { $in: selectedCategories };
        }
        if (selectedBrands.length > 0) {
            query.brand = { $in: selectedBrands };
        }

        if (req.query.searchWord) {
            query.$or = [
                { name: { $regex: req.query.searchWord, $options: 'i' } },
                { description: { $regex: req.query.searchWord, $options: 'i' } }
            ];
        }

        if (sortBy === 'priceLowHigh') {
            sortCriteria = { salePrice: 1 };
        } else if (sortBy === 'priceHighLow') {
            sortCriteria = { salePrice: -1 };
        } else if (sortBy === 'featured') {
            sortCriteria = { quantity: -1 };
        } else if (sortBy === 'newArrivals') {
            sortCriteria = { createdAt: -1 };
        } else if (sortBy === 'aToZ') {
            sortCriteria = { productName: 1 };
        } else if (sortBy === 'zToA') {
            sortCriteria = { productName: -1 };
        }

        const products = await Product.find(query)
            .sort(sortCriteria)
            .skip(skip)
            .limit(limit);

            products.forEach(product => { 
                product.discountPercentage = calculateDiscount(product.realPrice, product.salePrice);
                // product.discountAmount = (product.realPrice - product.salePrice).toFixed(2);
            });

        const discountAmount = (products.realPrice - products.salePrice).toFixed(2);
            

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isBlocked: false });


        const bestSellers = await Order.aggregate([
            { 
                $unwind: "$products"  // Flatten the products array
            },
            {
                $group: {
                    _id: "$products.productId",  // Group by product ID
                    totalSold: { $sum: "$products.quantity" }  // Sum the quantities
                }
            },
            {
                $sort: { totalSold: -1 }
            },
            {
                $limit: 6  // Limit to the top 5 most sold products
            }
        ]);

        // Fetch the product details for the best sellers
        const bestSellerProducts = await Product.find({
            '_id': { $in: bestSellers.map(product => product._id) }
        });

        //fetch users wishlist
        const userWishlist=userId? await Wishlist.findOne({userId:userId}): null;
        // const wishListProducts=userWishlist? userWishlist.products:[];
        const wishListProducts=userWishlist? userWishlist.products.map(item=>item.productId):[];

        res.render('users/shop', {
            user: userId,
            products: products,
            categories: categories,
            brands: brands,
            currentPage: 'shop',
            totalPages: totalPages,
            limit: limit,
            selectedCategories: selectedCategories,
            selectedBrands: selectedBrands,
            sortWays: sortBy,
            minPrice: minPrice,
            maxPrice: maxPrice,
            searchWord: req.query.searchWord || ''  ,
            discountAmount,
            bestSellers:bestSellerProducts,
            wishListProducts
        });

    } catch (error) {
        console.log('Error while loading shop:', error);
        res.redirect('/pageError');
    }
};


module.exports = {
    loadShop
}