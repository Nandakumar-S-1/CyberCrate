const User = require('../Models/userModel');

const isAdminAuthenticated = async (req, res, next) => {
    try {
        // console.log("-------------------------------------",req.session);
        
        if (!req.session.admin) {
            return res.redirect('/admin/login');
        }
        
        const admin = await User.findOne({ 
            _id: req.session.admin.id,
            isAdmin: true 
        });

        if (!admin) {
            req.session.destroy();
            return res.redirect('/admin/login');
        }

        next();
        
    } catch (error) {
        console.log('Error in adminAuth middleware:', error);
        res.redirect('/admin/login');
    }
};

module.exports = {
    isAdminAuthenticated
};