const Banner = require("../../Models/bannerModel");
const path = require("path");
const fs = require("fs");

//  for loading banners
const loadBanners = async (req, res) => {
  try {
    const banners = await Banner.find({});
    res.render("admin/banners", {
      banners: banners,
      currentPage: "banners",
    });
  } catch (error) {
    
    res.redirect("/pageError");
  }
};
// for adding new banner
const addNewBanner = async (req, res) => {
  try {
    const banner = new Banner({
      image: req.file.filename,
      title: req.body.title,
      description: req.body.description,
      link: req.body.link,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      isActive: false, 
    });
    await banner.save();
    res.redirect("/admin/banners");
  } catch (error) {
    
    res.redirect("/pageError");
  }
};

module.exports = {
  loadBanners,
  addNewBanner,
};
