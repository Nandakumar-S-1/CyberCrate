const Product = require("../../Models/productModel");
const Category = require("../../Models/categoryModel");
const Brand = require("../../Models/brandModel");
const User = require("../../Models/userModel");
const Order = require("../../Models/orderModel");
const Cart = require("../../Models/cartModel");
const Wallet = require("../../Models/walletModel");
const Address = require("../../Models/addressModel");
const Wishlist = require("../../Models/wishlistModel");
const mongoose = require("mongoose");

//function to calculate discount
function calculateDiscount(realPrice, salePrice) {
  if (realPrice <= 0) return 0;
  return Math.round(((realPrice - salePrice) / realPrice) * 100);
}

//function to load shop
const loadShop = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);

    const userCart = await Cart.findOne({ userId: userId });
    cartCount = userCart ? userCart.items.length : 0;

    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || "default";
    const minPrice = parseInt(req.query.minPrice) || 5000;
    const maxPrice = parseInt(req.query.maxPrice) || 500000;

    const selectedCategories = Array.isArray(req.query.categories)
      ? req.query.categories
      : req.query.categories
      ? [req.query.categories]
      : [];
    const selectedBrands = Array.isArray(req.query.brands)
      ? req.query.brands
      : req.query.brands
      ? [req.query.brands]
      : [];

    const listedCategories = await Category.find({ isListed: true });
    const listedCategoryIds = listedCategories.map((category) =>
      category._id.toString()
    );

    const activeBrands = await Brand.find({
      isBlocked: false,
      isDeleted: false,
    }).select("_id");
    const activeBrandIds = activeBrands.map((brand) => brand._id.toString());

    let query = {
      salePrice: { $gte: minPrice, $lte: maxPrice },
      isBlocked: false,
      brand: { $in: activeBrandIds }, 
    };
    let sortCriteria = {};

    query.category = { $in: listedCategoryIds };

    if (selectedCategories.length > 0) {
      query.category = {
        $in: selectedCategories.filter((id) => listedCategoryIds.includes(id)),
      };
    }
    if (selectedBrands.length > 0) {
      query.brand = { $in: selectedBrands };
    }

    if (req.query.searchWord) {
      query.$or = [
        { name: { $regex: req.query.searchWord, $options: "i" } },
        { description: { $regex: req.query.searchWord, $options: "i" } },
      ];
    }

    if (sortBy === "priceLowHigh") {
      sortCriteria = { salePrice: 1 };
    } else if (sortBy === "priceHighLow") {
      sortCriteria = { salePrice: -1 };
    } else if (sortBy === "featured") {
      sortCriteria = { quantity: -1 };
    } else if (sortBy === "newArrivals") {
      sortCriteria = { createdAt: -1 };
    } else if (sortBy === "aToZ") {
      sortCriteria = { productName: 1 };
    } else if (sortBy === "zToA") {
      sortCriteria = { productName: -1 };
    }

    const products = await Product.find(query)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit);

    products.forEach((product) => {
      product.discountPercentage = calculateDiscount(
        product.realPrice,
        product.salePrice
      );
      // product.discountAmount = (product.realPrice - product.salePrice).toFixed(2);
    });

    const discountAmount = parseInt(products.realPrice - products.salePrice);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);
    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });

    const bestSellers = await Order.aggregate([
      {
        $unwind: "$products", // Flatten the products array
      },
      {
        $group: {
          _id: "$products.productId", // Group by product ID
          totalSold: { $sum: "$products.quantity" }, // Sum the quantities
        },
      },
      {
        $sort: { totalSold: -1 },
      },
      {
        $limit: 6, // Limit to the top 5 most sold products
      },
    ]);

    // Fetch the product details for the best sellers
    const bestSellerProducts = await Product.find({
      _id: { $in: bestSellers.map((product) => product._id) },
    });

    // In your loadShop controller function
    const userWishlist = userId
      ? await Wishlist.findOne({ userId: userId })
      : null;
    const wishListProducts = userWishlist
      ? userWishlist.products.map((item) => item.productId.toString()) // Convert ObjectId to string
      : [];

    res.render("users/shop", {
      user: userData,
      products: products,
      categories: categories,
      brands: brands,
      currentPage: "shop",
      totalPages: totalPages,
      limit: limit,
      selectedCategories: selectedCategories,
      selectedBrands: selectedBrands,
      sortWays: sortBy,
      minPrice: minPrice,
      maxPrice: maxPrice,
      searchWord: req.query.searchWord || "",
      discountAmount,
      bestSellers: bestSellerProducts,
      wishListProducts,
      cartCount,
      // wishlistCount
    });
  } catch (error) {
    console.log("Error while loading shop:", error);
    res.redirect("/pageError");
  }
};

module.exports = {
  loadShop,
};
