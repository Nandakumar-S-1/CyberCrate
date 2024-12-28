const express = require('express');
const router = express.Router();
const userController = require('../Controllers/users/userController');
const profileController = require('../Controllers/users/profileController')
const userProductController = require('../Controllers/users/userProductController')
const cartController = require('../Controllers/users/cartController')
const shopController = require('../Controllers/users/shopController')
const wishlistController = require('../Controllers/users/wishListController')
const orderController = require('../Controllers/users/orderController')
const passport = require('passport');
const {isLogAuth, checkBlockedStatus, checkUserStatus} = require('../Middleware/auth');


router.use(checkBlockedStatus);
router.get('/', userController.loadHome);

// Authentication routes
router.get('/auth', isLogAuth, userController.loadAuth);  
router.post('/signup', isLogAuth, userController.signup);  
router.post('/signin', checkUserStatus, userController.signin);  
router.get('/logout', userController.logout);

// OTP  routes
router.get('/check-session', (req, res) => {
    if (!req.session.userOtp || !req.session.userData || !req.session.otpExpiry) {
        return res.status(401).json({ message: 'Session expired' });
    }
    if (Date.now() > req.session.otpExpiry) {
        return res.status(401).json({ message: 'Session expired' });
    }
    res.status(200).json({ message: 'Session valid' });
});

router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);
router.get('/forgotPassword',profileController.forgotPassword)


router.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));
router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/auth' }),
    (req, res) => {
        // Set user session after successfull authenticate
        req.session.user = req.user;
        res.redirect('/');
    }
);

// product routes
router.get('/productDetails/:id', userProductController.productDetails);

router.get('/users/shop', shopController.loadShop);
router.get('/users/shop/:category', shopController.loadShop);
router.get('/users/shop/:category/:brand', shopController.loadShop);

//search routes
router.get('/search', userProductController.searchProducts)


// Profile route
router.get('/users/forgotPassword', profileController.forgotPassword);
router.post('/users/forgotEmailValidation', profileController.forgotEmailValidation);
router.get('/users/forgotPasswordOtp', profileController.renderOtpPage);
router.post('/users/forgotPasswordOtp', profileController.forgotPasswordOtp);
router.get('/users/resetPassword', profileController.resetPassword);
router.post('/users/resetPasswordValidation', profileController.resetPasswordValidation);
router.get('/profile', isLogAuth, profileController.loadProfile);
router.get('/editProfile', isLogAuth, profileController.editProfile);
router.post('/editProfile', isLogAuth, profileController.updateProfile);

// profile address routes
router.get('/profile/addresses',isLogAuth, profileController.loadAddresses);
router.get('/profile/addresses/addNewAddress',isLogAuth, profileController.loadAddAddress);
router.post('/profile/addresses/addNewAddress', profileController.addAddress);
router.get('/profile/addresses/editAddress/:id',isLogAuth, profileController.loadEditAddressPage);
router.post('/profile/addresses/editAddress', profileController.editAddress);
router.post('/profile/addresses/deleteAddress',isLogAuth, profileController.deleteAddress);
router.get('/profile/selectAddress',isLogAuth, profileController.getAddresses);
router.post('/profile/selectAddress',isLogAuth, orderController.selectAddress);
router.post('/profile/addresses/setDefaultAddress/:id',isLogAuth, profileController.setDefaultAddress);

router.get('/profile/changePassword',isLogAuth, profileController.changePassword);
router.post('/profile/changePassword',isLogAuth, profileController.changePasswordValidation);


// cart routes
router.get('/cart', isLogAuth, cartController.loadCart);
router.post('/cart/addItem', isLogAuth, cartController.addItemToCart);
router.post('/cart/removeItem', isLogAuth, cartController.removeItemFromCart);  
router.post('/cart/updateQuantity', isLogAuth, cartController.updateQuantity);


//order routes
router.post('/placeOrders', isLogAuth, orderController.placeOrders);
router.get('/profile/orders', isLogAuth, orderController.getUserOrders);
router.get('/checkout', isLogAuth, orderController.getCheckoutPage);
router.post('/cancelOrder', isLogAuth, orderController.cancelOrder);


// Wishlist routes
router.get('/wishlist', isLogAuth, wishlistController.loadWishlist);
router.post('/wishlist/addItem', isLogAuth, wishlistController.addToWishlist);
router.post('/wishlist/removeItem', isLogAuth, wishlistController.removeFromWishlist);


router.get('/PageNotFound', userController.PageNotFound);
module.exports = router;