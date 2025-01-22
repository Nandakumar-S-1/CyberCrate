const Banner = require('../../Models/bannerModel');
const path = require('path');
const fs = require('fs');

//  for loading banners
const loadBanners = async (req, res) => {
    try {
        const banners = await Banner.find({});
        res.render('admin/banners', {
            banners: banners,
            currentPage: 'banners'  // Pass the current page
        });
    } catch (error) {
        console.error('Error while loading banners', error);
        res.redirect('/pageError');
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
            isActive: false // Default to inactive
        });
        await banner.save();
        res.redirect('/admin/banners');
    } catch (error) {
        console.error('Error while adding new banner', error);
        res.redirect('/pageError');
    }
};



module.exports = {
    loadBanners,
    addNewBanner,
};



































// const Banner = require('../../Models/bannerModel');
// const path = require('path');
// const fs = require('fs');


// const loadBanners = async (req, res) => {
//     try {

//         const banners = await Banner.find({});
//         res.render('admin/banners', { banners: banners })

//     } catch (error) {

//         console.log('error while loading banner', error);

//         res.redirect('/pageError')
//     }
// }

// const addNewBanner = async (req, res) => {
//     try {

//     } catch (error) {

//     }
// }

// const deleteBanner = async (req, res) => {
//     try { 
//         const bannerId = req.params.id; 
//         const banner = await Banner.findById(bannerId); 
//         if (banner) { 
//             fs.unlinkSync(banner.path); 
//             await banner.remove(); 
//         } 
//         res.redirect('/admin/banners'); 
//     } catch (error) { 
//         console.error('Error while deleting banner', error); 
//         res.redirect('/pageError'); 
//     } 
// };

// module.exports = {
//     loadBanners,
//     addNewBanner,
//     deleteBanner
// }