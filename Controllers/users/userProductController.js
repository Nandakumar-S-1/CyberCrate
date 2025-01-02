const Product = require('../../Models/productModel');
const Category = require('../../Models/categoryModel');
const User = require('../../Models/userModel');
const Order = require('../../Models/orderModel');
const Cart = require('../../Models/cartModel');
const Brand = require('../../Models/brandModel');


const getProoducts = async(req,res)=>{
  try {

    const {category , brand , }=req.query;

  } catch (error) {
    
  }
}

const productDetails = async (req, res) => {
    try {
      const userId = req.session.user;
      const userData = userId ? await User.findById(userId) : null;
      const productId = req.params.id;
  
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
  
// const popularProducts = async (req, res) => {
//   try {
    
//     const popularProducts = await Order.aggregate([
//       {
//         $unwind:'$orderedItems'
//       },
//       {
//         $group:{
//           _id:'$orderedItems.productId',
//           totalOrders:{$sum:1}
//         }
//       },
//       {
//         $lookup:{
//            from:'products',
//            localField:'_id',
//            foreignField:'_id',
//            as:'productDetails' 
//         }
//       },
//       {
//         $unwind:'$productDetails'
//       },
//       {
//         $sort:{totalOrders:-1}
//       },
//       {
//         $limit:5
//       },
//       {
//         $project:{
//           _id:1,
//           productName:'$productDetails.productName',
//           productImage:'$productDetails.productImage',
//           totalOrders:1
//         }
//       }
//     ])

//     res.render('users/popularProducts', {
//       popularProducts
//     })

//   } catch (error) {
//     console.error('Error loading popular products:', error);
//     res.redirect('/pageError');
//   }
// }


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



