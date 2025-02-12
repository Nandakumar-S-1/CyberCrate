const Product = require("../../Models/productModel");
const Category = require("../../Models/categoryModel");
const Brand = require("../../Models/brandModel");
const User = require("../../Models/userModel");
const Cart = require("../../Models/cartModel");
const Wishlist = require("../../Models/wishlistModel");

// Function to calculate discount
function calculateDiscount(realPrice, salePrice) {
  if (realPrice <= 0) return 0;
  return Math.round(((realPrice - salePrice) / realPrice) * 100);
}

const loadShop = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    const userCart = await Cart.findOne({ userId: userId });
    const cartCount = userCart ? userCart.items.length : 0;

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const skip = (page - 1) * limit;

    // Filter parameters
    const sortBy = req.query.sortBy || "default";
    const minPrice = parseInt(req.query.minPrice) || 5000;
    const maxPrice = parseInt(req.query.maxPrice) || 500000;
    const searchWord = req.query.searchWord || "";

    // Handle categories and brands
    const selectedCategories = req.query.categories
      ? Array.isArray(req.query.categories)
        ? req.query.categories
        : [req.query.categories]
      : [];
    const selectedBrands = req.query.brands
      ? Array.isArray(req.query.brands)
        ? req.query.brands
        : [req.query.brands]
      : [];

    // Build base query
    let query = {
      salePrice: { $gte: minPrice, $lte: maxPrice },
      isBlocked: false,
    };

    // Apply category filter
    if (selectedCategories.length > 0) {
      query.category = { $in: selectedCategories };
    }

    // Apply brand filter
    if (selectedBrands.length > 0) {
      query.brand = { $in: selectedBrands };
    }

    // Apply search filter
    if (searchWord) {
      query.$or = [
        { productName: { $regex: searchWord, $options: "i" } },
        { description: { $regex: searchWord, $options: "i" } },
      ];
    }

    const listedCategories = await Category.find({ isListed: true }).select("_id").lean();
const listedCategoryIds = listedCategories.map(cat => cat._id);

query.category = { $in: listedCategoryIds }; 

    // Determine sort criteria
    let sortWays = {};
    switch (sortBy) {
      case "priceLowHigh":
        sortWays = { salePrice: 1 };
        break;
      case "priceHighLow":
        sortWays = { salePrice: -1 };
        break;
      case "featured":
        sortWays = { quantity: -1 };
        break;
      case "newArrivals":
        sortWays = { createdAt: -1 };
        break;
      case "aToZ":
        sortWays = { productName: 1 };
        break;
      case "zToA":
        sortWays = { productName: -1 };
        break;
      case "topSellingProducts":
        const topSellingIds = await Product.aggregate([
          {
            $lookup: {
              from: "orders",
              localField: "_id",
              foreignField: "orderedItems.product",
              as: "orders",
            },
          },
          { $unwind: "$orders" },
          { $unwind: "$orders.orderedItems" },
          {
            $match: {
              $expr: { $eq: ["$_id", "$orders.orderedItems.product"] },
              "orders.status": {
                $nin: ["Cancelled", "Returned", "Return Request", "Failed"],
              },
              isBlocked: false,
              quantity: { $gt: 0 },
            },
          },
          {
            $group: {
              _id: "$_id",
              totalQuantitySold: {
                $sum: { $toInt: "$orders.orderedItems.quantity" },
              },
            },
          },
          { $sort: { totalQuantitySold: -1 } },
          { $project: { _id: 1 } },
        ]);

        query._id = { $in: topSellingIds.map((item) => item._id) };
        break;
      default:
        sortWays = { createdAt: -1 };
    }

    // Fetch products with pagination
    const products = await Product.find(query)
      .sort(sortWays)
      .skip(skip)
      .limit(limit)
      .lean(); 

    // Calculate total for pagination
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Calculate discount for each product
    products.forEach((product) => {
      product.discountPercentage = calculateDiscount(
        product.realPrice,
        product.salePrice
      );
    });

    // Build filter query string for pagination links
    const filterParams = new URLSearchParams({
      minPrice: minPrice,
      maxPrice: maxPrice,
      sortBy: sortBy,
      limit: limit,
    });

    if (selectedCategories.length)
      filterParams.append("categories", selectedCategories.join(","));
    if (selectedBrands.length)
      filterParams.append("brands", selectedBrands.join(","));
    if (searchWord) filterParams.append("searchWord", searchWord);

    const filterQuery = filterParams.toString();

    const hasActiveFilters =
      selectedCategories.length > 0 ||
      selectedBrands.length > 0 ||
      searchWord ||
      minPrice !== 5000 ||
      maxPrice !== 500000 ||
      sortBy !== "default";

    // Handle AJAX requests
    if (req.xhr || req.headers["x-requested-with"] === "XMLHttpRequest") {
      return res.json({
        success: true,
        products: products,
        currentPage: page,
        totalPages: totalPages,
        filterQuery: filterQuery,
      });
    }

    // Regular page render
    const categories = await Category.find({ isListed: true }).lean();
    const brands = await Brand.find({ isBlocked: false }).lean();
    const userWishlist = userId
      ? await Wishlist.findOne({ userId: userId })
      : null;
    const wishListProducts = userWishlist
      ? userWishlist.products.map((item) => item.productId.toString())
      : [];

    // const topSellingProducts = await Product.aggregate([
    //   {
    //     $lookup: {
    //       from: "orders",
    //       localField: "_id",
    //       foreignField: "orderedItems.product",
    //       as: "orders",
    //     },
    //   },
    //   {
    //     $unwind: "$orders",
    //   },
    //   {
    //     $unwind: "$orders.orderedItems",
    //   },
    //   {
    //     $match: {
    //       $expr: {
    //         $eq: ["$_id", "$orders.orderedItems.product"],
    //       },
    //       "orders.status": {
    //         $nin: ["Cancelled", "Returned", "Return Request", "Failed"],
    //       },
    //       isBlocked: false,
    //       quantity: { $gt: 0 },
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: "$_id",
    //       productName: { $first: "$productName" },
    //       productImage: { $first: "$productImage" },
    //       quantity: { $first: "$quantity" },
    //       price: { $first: "$price" },
    //       totalQuantitySold: {
    //         $sum: { $toInt: "$orders.orderedItems.quantity" },
    //       },
    //     },
    //   },
    //   {
    //     $sort: {
    //       totalQuantitySold: -1,
    //     },
    //   },
    // ]);

    return res.render("users/shop", {
      user: userData,
      products,
      categories,
      brands,
      currentPage: page,
      totalPages,
      limit,
      selectedCategories,
      // topSellingProducts,
      selectedBrands,
      sortBy,
      minPrice,
      maxPrice,
      searchWord,
      wishListProducts,
      cartCount,
      filterQuery,
      sortWays,
      hasActiveFilters,
    });
  } catch (error) {
    console.error("Error in loadShop:", error);
    if (!res.headersSent) {
      res.status(500).render("error", {
        message: "An error occurred while loading the shop",
        error: error,
      });
    }
  }
};

module.exports = {
  loadShop,
};
