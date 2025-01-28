const category = require("../../Models/categoryModel");
const Product = require("../../Models/productModel");
const user = require("../../Models/userModel");
const order = require("../../Models/orderModel");
const banner = require("../../Models/bannerModel");

//load categories
const loadCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const categories = await category
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await category.countDocuments();
    const totalPages = Math.ceil(totalCategories / limit);

    res.render("admin/categories", {
      categories: categories,
      currentPage: "categories",
      page: page,
      totalPages: totalPages,
      limit: limit,
      layout: "layouts/admin/layout",
    });
  } catch (error) {
    console.log("Error while loading categories:", error);
    res.redirect("/pageError");
  }
};

//add new categories
const addNewCategories = async (req, res) => {
  const { name, description, categoryOffer } = req.body;

  try {
    const categoryExist = await category.findOne({ name });
    if (categoryExist) {
      return res.status(400).json({ error: "Category Already Exists" });
    }

    const newCategory = new category({
      name,
      description,
      categoryOffer: categoryOffer || 0,
    });

    await newCategory.save();
    // return res.json({message:"Category added successfully"})
    res.redirect("/admin/categories");
  } catch (error) {
    console.log("Error while adding new category", error);

    return res.status(500).json({ error: "Internal Server Error" });
  }
};
//edit category
const editCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const categoryData = await category.findOne({ _id: id });
    res.render("admin/editCategory", { category: categoryData });
  } catch (error) {
    console.log("error while editing the categories", error);

    res.redirect("/pageError");
  }
};
//update category
const updateCategory = async (req, res) => {
  try {
    const id = req.body.categoryId;
    const { name, description, categoryOffer } = req.body;

    const existingCategory = await category.findOne({ name, _id: { $ne: id } });
    if (existingCategory) {
      return res
        .status(400)
        .json({ error: "Category Already Exists, write another One" });
    }

    const updatedCategory = await category.findByIdAndUpdate(
      id,
      {
        name,
        description,
        categoryOffer: categoryOffer || 0,
      },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ error: "Category Not Found" });
    }

    const products = await Product.find({ category: id });
    for (let product of products) {
      const categoryOfferValue = parseFloat(categoryOffer) || 0;
      const productOfferValue = parseFloat(product.productOffer) || 0;
      const regularPrice = parseFloat(product.realPrice) || 0;

      const highestOffer = Math.max(categoryOfferValue, productOfferValue);
      const finalSalePrice = regularPrice - (regularPrice * highestOffer) / 100;

      product.salePrice = !isNaN(finalSalePrice)
        ? finalSalePrice
        : regularPrice;
      await product.save();
    }

    return res.json({ message: "Category Updated Successfully" });
  } catch (error) {
    console.log("Error while updating category", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
//list categories
const listCategories = async (req, res) => {
  try {
    const id = req.query.id;
    await category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.redirect("/admin/categories");
  } catch (error) {
    console.log(error);

    res.redirect("/pageError");
  }
};
//unlist categories
const unListCategories = async (req, res) => {
  try {
    const id = req.query.id;
    await category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.redirect("/admin/categories");
  } catch (error) {
    console.log(error);
    res.redirect("/pageError");
  }
};

module.exports = {
  loadCategories,
  addNewCategories,
  listCategories,
  unListCategories,
  editCategory,
  updateCategory,
};
