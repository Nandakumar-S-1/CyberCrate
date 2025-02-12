const Brand = require("../../Models/brandModel");
const Product = require("../../Models/productModel");

//function for loading brands
const loadBrands = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const brandData = await Brand.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const mappedBrandData = brandData.map((brand) => ({
      _id: brand._id,
      brandName: brand.brandName,
      image: brand.image,
      isBlocked: brand.isBlocked 
    }));
    const totalBrands = await Brand.countDocuments({ isDeleted: false });
    const totalPages = Math.ceil(totalBrands / limit);

    res.render("admin/brands", {
      data: mappedBrandData,
      currentPage: page,
      totalPages: totalPages,
      totalBrands: totalBrands,
    });
  } catch (error) {
    
    res.redirect("/pageError");
  }
};
//function for adding new brand
const addNewBrand = async (req, res) => {
  try {
    // console.log(req.file);

    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Brand image not found, Please upload an image" });
    }
    const { brandName } = req.body;
    const image = req.file ? req.file.filename : null;

    if (!brandName || !image) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const findBrand = await Brand.findOne({ brandName });
    if (findBrand) {
      return res
        .status(400)
        .json({ error: "Brand already exists in the database" });
    }

    const newBrand = new Brand({ brandName, image });
    await newBrand.save();

    res.redirect("/admin/brands");
  } catch (error) {
    
    res.redirect("/pageError");
  }
};
//function for blocking and unblocking brand
const blockBrand = async (req, res) => {
  try {
    const brandId = req.query.id;
    await Brand.findByIdAndUpdate(brandId, { isBlocked: true });
    res.json({ success: true });
  } catch (error) {
    
    res.json({ success: false });
  }
};
//function for blocking and unblocking brand
const unBlockBrand = async (req, res) => {
  try {
    const brandId = req.query.id;
    await Brand.findByIdAndUpdate(brandId, { isBlocked: false });
    res.json({ success: true });
  } catch (error) {
    
    res.json({ success: false });
  }
};

//function for deleting and restoring brand
const deleteBrand = async (req, res) => {
  try {
    const id = req.query.id;

    if (!id) {
      console.log("Invalid or missing ID");
      return res.redirect("/pageError");
    }
    await Brand.findByIdAndUpdate(id, { isDeleted: true });

    res.redirect("/admin/brands");
  } catch (error) {
    
    res.status(500).redirect("/pageError");
  }
};
//function for deleting and restoring brand
const restoreBrand = async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) {
      
      return res.redirect("/pageError");
    }
    await Brand.findByIdAndUpdate(id, { isDeleted: false });

    res.redirect("/admin/brands");
  } catch (error) {
    
    res.status(500).redirect("/pageError");
  }
};

module.exports = {
  loadBrands,
  addNewBrand,
  blockBrand,
  unBlockBrand,
  deleteBrand,
  restoreBrand,
};

