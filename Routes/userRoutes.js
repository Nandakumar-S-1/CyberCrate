const express = require("express");
const router = express.Router();
const userController = require("../Controllers/users/userController");
const profileController = require("../Controllers/users/profileController");
const userProductController = require("../Controllers/users/userProductController");
const cartController = require("../Controllers/users/cartController");
const shopController = require("../Controllers/users/shopController");
const wishlistController = require("../Controllers/users/wishListController");
const orderController = require("../Controllers/users/orderController");
const walletController = require("../Controllers/users/walletController");
const couponController = require("../Controllers/users/couponController");
const paymentController = require("../Controllers/users/paymentController");
const passport = require("passport");
const {
  isLogAuth,
  checkBlockedStatus,
  checkUserStatus,
} = require("../Middleware/auth");

router.use(checkBlockedStatus);
router.get("/", userController.loadHome);

// Authentication routes
router.get("/auth", isLogAuth, userController.loadAuth);
router.post("/signup", isLogAuth, userController.signup);
router.post("/signin", checkUserStatus, userController.signin);
router.get("/logout", userController.logout);

// OTP  routes
router.get("/check-session", (req, res) => {
  if (!req.session.userOtp || !req.session.userData || !req.session.otpExpiry) {
    return res.status(401).json({ message: "Session expired" });
  }
  if (Date.now() > req.session.otpExpiry) {
    return res.status(401).json({ message: "Session expired" });
  }
  res.status(200).json({ message: "Session valid" });
});

router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get("/forgotPassword", profileController.forgotPassword);

router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth" }),
  (req, res) => {
    // Set user session after successfull authenticate
    req.session.user = req.user;
    res.redirect("/");
  }
);

// product routes
router.get("/productDetails/:id", userProductController.productDetails);
router.get("/users/shop", shopController.loadShop);
router.get("/users/shop/:category", shopController.loadShop);
router.get("/users/shop/:category/:brand", shopController.loadShop);

//search routes
router.get("/search", userProductController.searchProducts);

// Profile route
router.get("/users/forgotPassword", profileController.forgotPassword);
router.post(
  "/users/forgotEmailValidation",
  profileController.forgotEmailValidation
);
router.post('/resend-changepassword-otp', profileController.resendChangePasswordOtp);

router.get("/users/forgotPasswordOtp", profileController.renderOtpPage);
router.post("/users/forgotPasswordOtp", profileController.forgotPasswordOtp);
router.get("/users/resetPassword", profileController.resetPassword);
router.post(
  "/users/resetPasswordValidation",
  profileController.resetPasswordValidation
);
router.get("/profile", isLogAuth, profileController.loadProfile);
router.get("/editProfile", isLogAuth, profileController.editProfile);
router.post("/editProfile", isLogAuth, profileController.updateProfile);

// profile address routes
router.get("/profile/addresses", isLogAuth, profileController.loadAddresses);
router.get(
  "/profile/addresses/addNewAddress",
  isLogAuth,
  profileController.loadAddAddress
);
router.post("/profile/addresses/addNewAddress", profileController.addAddress);
router.get(
  "/profile/addresses/editAddress/:id",
  isLogAuth,
  profileController.loadEditAddressPage
);
router.post("/profile/addresses/editAddress", profileController.editAddress);
router.post(
  "/profile/addresses/deleteAddress",
  isLogAuth,
  profileController.deleteAddress
);
router.get("/profile/selectAddress", isLogAuth, profileController.getAddresses);
router.post("/profile/selectAddress", isLogAuth, orderController.selectAddress);
router.post(
  "/profile/addresses/setDefaultAddress/:id",
  isLogAuth,
  profileController.setDefaultAddress
);

router.get(
  "/profile/changePassword",
  isLogAuth,
  profileController.changePassword
);
router.post(
  "/profile/changePassword",
  isLogAuth,
  profileController.changePasswordValidation
);

// cart routes
router.get("/cart", isLogAuth, cartController.loadCart);
router.post("/cart/addItem", isLogAuth, cartController.addItemToCart);
router.post("/cart/removeItem", isLogAuth, cartController.removeItemFromCart);
router.post("/cart/updateQuantity", isLogAuth, cartController.updateQuantity);

//order routes
router.post("/placeOrders", isLogAuth, orderController.placeOrders);
router.get("/profile/orders", isLogAuth, orderController.getUserOrders);
router.get("/checkout", isLogAuth, orderController.getCheckoutPage);
router.post("/cancelOrder", isLogAuth, orderController.cancelOrder);
router.post("/verifyPayment", isLogAuth, orderController.verifyPayment);
// router.get('/orderDetails/:id', isLogAuth, orderController.orderDetails);
router.get(
  "/profile/orderDetails/:id",
  isLogAuth,
  orderController.orderDetails
);
router.get("/orders/:id/invoice", isLogAuth, orderController.generateInvoice);
// router.get("/orders/retry/:id", isLogAuth, orderController.retryPayment);
router.post(
  "/createRetryPaymentOrder",
  isLogAuth,
  orderController.createRetryPaymentOrder
);
router.post('/retryPayment',isLogAuth,orderController.retryPayment)

router.patch("/orders/:orderId/return", isLogAuth, orderController.returnOrder);

// Wishlist routes
router.get("/wishlist", isLogAuth, wishlistController.loadWishlist);
router.post("/wishlist/addItem", isLogAuth, wishlistController.addToWishlist);
router.post(
  "/wishlist/removeItem",
  isLogAuth,
  wishlistController.removeFromWishlist
);

// //Wallet routes
router.use("/wallet", (err, req, res, next) => {
  console.error("Wallet Error:", err);
  res.status(500).json({
    success: false,
    message: "Something went wrong with the wallet operation",
  });
});
router.get("/wallet", isLogAuth, walletController.getWalletPage);
// router.post("/wallet/add-money", isLogAuth, walletController.addMoneyToWallet);
router.post('/wallet/recharge', isLogAuth, walletController.initiateWalletRecharge);
router.post('/wallet/verify-recharge', isLogAuth, walletController.verifyWalletRecharge);

router.post("/verifyCoupon", isLogAuth, couponController.verifyCoupon);
router.post("/applyCoupon", isLogAuth, cartController.applyCoupon);

router.get("/about", userController.getAbout);
// Define the route for /pageNotFound
router.get("/pageNotFound", userController.PageNotFound);

// Catch-all route for undefined user routes
router.all("*", (req, res) => {
  const errorMessage = "The page you are looking for doesn't exist.";
  const errorCode = 404; // You can change this if needed
  res.render("users/404-error", { errorMessage, errorCode });
});

module.exports = router;
