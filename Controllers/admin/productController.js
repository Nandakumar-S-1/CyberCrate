const Product = require("../../Models/productModel");
const Category = require("../../Models/categoryModel");
const Brand = require("../../Models/brandModel");
const User = require("../../Models/userModel");
const Cart = require("../../Models/cartModel");

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

//function to load products
const loadProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const selectedDate = req.query.date || "";
    const selectedCategory = req.query.category || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    const categories = await Category.find({
      name: { $regex: new RegExp(".*" + search + ".*", "i") },
    });
    const brands = await Brand.find({
      brandName: { $regex: new RegExp(".*" + search + ".*", "i") },
    });

    const categoryIds = categories.map((category) => category._id);
    const brandIds = brands.map((brand) => brand._id);

    let filter = {
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $in: brandIds } },
        { category: { $in: categoryIds } },
      ],
    };

    if (selectedDate) {
      filter.$or.push({ createdAt: new Date(selectedDate) });
    }
    if (selectedCategory) {
      filter.$or.push({ category: selectedCategory });
    }

    const productData = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("category", "name")
      .populate("brand", "brandName")
      .exec();

    const count = await Product.countDocuments(filter);

    const dates = await Product.distinct("createdAt");
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    if (category.length > 0 && brand.length > 0) {
      res.render("admin/products", {
        products: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalProducts: count,
        dates: dates.map((date) => date.toISOString().split("T")[0]),
        category: category,
        brand: brand,
        search: search,
        selectedDate: selectedDate,
        selectedCategory: selectedCategory,
      });
    } else {
      res.render("404-error");
    }
  } catch (error) {
    
    res.redirect("/pageError");
  }
};

//function to add new product
const loadAddProduct = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });
    const product = await Product.find({});
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;
    res.render("admin/addProducts", {
      category: categories,
      brand: brands,
      product: product,
      currentPage: page,
    });
  } catch (error) {
    
    res.redirect("/pageError");
  }
};

//function to add new product
const addNewProduct = async (req, res) => {
  try {
    const {
      productName,
      description,
      brand: brandName,
      category: categoryName,
      quantity,
      regularPrice,
      productOffer,
      status,
    } = req.body;

    const productExist = await Product.findOne({ productName });
    if (productExist) {
      return res
        .status(400)
        .json({ error: "Product already exists, try another one" });
    }

    const images = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const originalImagePath = req.files[i].path;
        const resizedImagePath = path.join(
          "public",
          "img",
          "products",
          req.files[i].filename
        );
        await sharp(originalImagePath)
          .resize({ width: 450, height: 450, fit: "contain" })
          .toFile(resizedImagePath);
        images.push(req.files[i].filename);
      }
    }

    const category = await Category.findOne({ name: categoryName });
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const brand = await Brand.findOne({ brandName });
    if (!brand) {
      return res.status(404).json({ error: "Brand not found" });
    }

    const productOfferValue = parseInt(productOffer) || 0;
    const categoryOfferValue = parseInt(category.categoryOffer) || 0;
    const regularPriceValue = parseInt(regularPrice) || 0;

    const highestOffer = Math.max(productOfferValue, categoryOfferValue);
    const finalSalePrice =
      regularPriceValue - (regularPriceValue * highestOffer) / 100;

    const newProduct = new Product({
      productName,
      description,
      brand: brand._id,
      category: category._id,
      realPrice: regularPriceValue,
      salePrice: !isNaN(finalSalePrice) ? finalSalePrice : regularPriceValue,
      productOffer: productOfferValue,
      quantity,
      productImage: images,
      status,
      isOfferActive: highestOffer > 0,
      offerStartDate: highestOffer > 0 ? new Date() : null,
      offerEndDate: null,
    });

    const savedProduct = await newProduct.save();
    if (savedProduct) {
      res.redirect("/admin/products");
    } else {
      res.status(500).json({ error: "Failed to save product" });
    }
  } catch (error) {
    
    res.redirect("/pageError");
  }
};

//function to edit product
const editProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const productData = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check for duplicate product name
    const existingProduct = await Product.findOne({
      productName: productData.productName,
      _id: { $ne: productId },
    });
    if (existingProduct) {
      return res.status(400).json({ error: "Product already exists" });
    }

    // Check if brand exists
    const brand = await Brand.findOne({ brandName: productData.brand });
    if (!brand) {
      return res.status(404).json({ error: "Brand not found" });
    }

    const images = [];
    if (req.files && req.files.length > 0) {
      // Delete old images from the server if new images are provided
      product.productImage.forEach((image) => {
        const filePath = path.join("public", "img", "products", image);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); // Delete file
        }
      });

      // Resize and save new images
      for (let i = 0; i < req.files.length; i++) {
        const originalImagePath = req.files[i].path;
        const resizedImagePath = path.join(
          "public",
          "img",
          "products",
          req.files[i].filename
        );
        await sharp(originalImagePath)
          .resize({ width: 450, height: 450, fit: "contain" })
          .toFile(resizedImagePath);
        images.push(req.files[i].filename);
      }
    }

    // Calculate pricing logic
    const category = await Category.findOne({ _id: productData.category });
    const categoryOfferValue = category ? parseInt(category.categoryOffer) : 0;
    const productOfferValue = parseInt(productData.productOffer) || 0;
    const regularPriceValue = parseInt(productData.regularPrice) || 0;
    const highestOffer = Math.max(productOfferValue, categoryOfferValue);
    const finalSalePrice =
      regularPriceValue - (regularPriceValue * highestOffer) / 100;

    const updateFields = {
      productName: productData.productName,
      description: productData.description,
      brand: brand._id,
      category: productData.category,
      realPrice: regularPriceValue,
      salePrice: !isNaN(finalSalePrice) ? finalSalePrice : regularPriceValue,
      productOffer: productOfferValue,
      quantity: productData.quantity,
      status: productData.status,
      isOfferActive: highestOffer > 0,
      offerStartDate: highestOffer > 0 ? new Date() : null,
      offerEndDate: null,
    };

    if (images.length > 0) {
      updateFields.productImage = images; // Update images if new ones are provided
    }

    await Product.findByIdAndUpdate(
      productId,
      { $set: updateFields },
      { new: true }
    );
    res.redirect("/admin/products");
  } catch (error) {
   
    res.redirect("/pageError");
  }
};

//function to block product
const blockProduct = async (req, res) => {
  try {
    const productId = req.params.id;

  await Product.findByIdAndUpdate(productId, { isBlocked: true });
    
    res.status(200).send({ message: "Product blocked successfully" });
  } catch (error) {
    
    res.status(500).send("Error while blocking product");
  }
};

//function to unblock product
const unBlockProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    await Product.updateOne({ _id: productId }, { $set: { isBlocked: false } });
    res.status(200).send({ message: "Product unblocked successfully" });
  } catch (error) {
    res.status(500).send("Error while unblocking product");
  }
};

//function to load edit product
const loadEditProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    if (product && !product.images) {
      product.images = [];
    }

    res.render("admin/editProduct", {
      product: product,
      category: category,
      brand: brand,
    });
  } catch (error) {
    
    res.redirect("/pageError");
  }
};

//function to delete single image
const deleteSingleImage = async (req, res) => {
  try {
    const { imageName, productId } = req.body;

    await Product.findByIdAndUpdate(productId, {
      $pull: { productImage: imageName },
    });

    const imagePath = path.join("public", "img", "products", imageName);
    if (fs.existsSync(imagePath)) {
      await fs.unlinkSync(imagePath);
      console.log(`image ${imageName} has beendeleted successfully`);
    } else {
      console.log(`image ${imageName} not found`);
    }

    res.send({ status: true });
  } catch (error) {
    console.log("error while deleting image", error);
    res.redirect("/pageError");
  }
};

//function to update product
const updateProduct = async (req, res) => {
  try {
    const productId = req.query.id;
    const product = await Product.findById(productId);
    const productData = req.body;
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    const images = [];
    if (product) {
      product.productImage = [];
      await product.save();
    }

    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        images.push(req.files[i].filename);
      }
    }

    const updateFields = {
      productName: productData.productName,
      description: productData.description,
      brand: productData.brand,
      category: productData.category,
      realPrice: productData.regularPrice,
      salePrice: productData.salePrice,
      quantity: productData.quantity,
      status: productData.status,
    };
    if (req.files && req.files.length > 0) {
      updateFields.$push = {
        productImage: { $each: images },
      };
    }
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $set: updateFields },
      { new: true }
    );

    res.render("admin/editProduct");
  } catch (error) {
    res.redirect("/pageError");
  }
};

//function to delete offer
const deleteOffer = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);

    if (product) {
      product.isOfferActive = false;
      product.productOffer = 0;
      product.salePrice = product.realPrice;
      product.offerStartDate = null;
      product.offerEndDate = null;
      await product.save();
      res.redirect(`/admin/editProduct/'${productId}`);
    } else {
      res.status(404).send("Product not found");
    }
  } catch (error) {
    
    res.status(500).send("Error while deleting offer");
  }
};

module.exports = {
  loadAddProduct,
  loadProducts,
  addNewProduct,
  blockProduct,
  unBlockProduct,
  loadEditProduct,
  editProduct,
  deleteSingleImage,
  updateProduct,
  deleteOffer,
};