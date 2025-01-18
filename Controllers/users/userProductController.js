const Product = require('../../Models/productModel');
const Category = require('../../Models/categoryModel');
const User = require('../../Models/userModel');
const Order = require('../../Models/orderModel');
const Cart = require('../../Models/cartModel');
const Brand = require('../../Models/brandModel');
const mongoose=require('mongoose')

//function to load product details
const productDetails = async (req, res) => {
    try {
      const userId = req.session.user;
      const userData = userId ? await User.findById(userId) : null;
      const productId = req.params.id;

      // Check if productId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        // If not, redirect to the 404 error page
        return res.render('users/404-error', { errorMessage: 'Product not found', errorCode: 404 });
    }
  
      // const brandName = await Brand.findById(productId);
      const product = await Product.findById(productId).populate('category  brand');
      if (!product) {
        return res.status(404).render('404-error', { message: 'Product not found' });
      }
      // console.log(product.brand);

      const relatedProducts = await Product.find({
        category: product.category,
        _id: { $ne: productId }
      }).limit(3);
  
      res.render('users/productDetails', {
        user: userData,
        product: product,
        category: product.category,
        quantity: product.quantity,
        relatedProducts,
        brandName :product.brand
      });
    } catch (error) {
      console.error('Error fetching product details:', error);
      res.status(500).send('Server error');
    }
  };

  //function to search products
const searchProducts = async (req, res) => {
  try {
    const searchWord = req.query.searchWord || '';
    // console.log('Search Word:', searchWord);

    const result = await Product.find({
      name: { $regex: searchWord, $options: 'i' }
    });

    // console.log('Search Results:', result);
    res.render('users/searchProducts', { result, searchWord });
  } catch (error) {
    console.error('Error loading search products:', error);
    res.status(500).json({ error: 'Internal server error', success: false });
  }
};


module.exports = {
    productDetails,
    // popularProducts,
    searchProducts
};



