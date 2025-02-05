const User = require("../../Models/userModel");
const env = require("dotenv").config();
const nodeMailer = require("nodemailer");
const bcrypt = require("bcrypt");
const Category = require("../../Models/categoryModel");
const Product = require("../../Models/productModel");
const Brand = require("../../Models/brandModel");
const Cart = require("../../Models/cartModel");
const Wallet = require("../../Models/walletModel");
const referalBonus = process.env.REFERRAL_BONUS || 500;
const signupBonus = process.env.SIGNUP_BONUS || 1000;

// Controller for loading the home page
const loadHome = async (req, res) => {
  try {
    const userId = req.session.user;
    const selectedBrand = req.query.brand; 

    const categories = await Category.find({ isListed: true });
    let recentProducts = await Product.find({
      isBlocked: false,
      category: { $in: categories.map((category) => category._id) },
      quantity: { $gt: 0 },
    });

    const userCart = await Cart.findOne({ userId: userId });
    cartCount = userCart ? userCart.items.length : 0;
    // console.log(cartCount);

    recentProducts.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    recentProducts = recentProducts.slice(0, 8);

    const productName = "Predator Galea 310 Gaming Headset";
    const product = await Product.findOne({ productName: productName });

    const topSellingProducts = await Product.find({
      isBlocked: false,
      quantity: { $gt: 0 },
    })
      .sort({ quantity: 1 })
      .limit(3);

    const featured = await Product.find({ isBlocked: false })
      .sort({ productOffer: -1 })
      .limit(3);

    const brands = await Brand.find().limit(30);

    if (selectedBrand) {
      recentProducts = recentProducts.filter(
        (product) => product.brand.toString() === selectedBrand
      );
    }

    
    if (userId) {
      const userData = await User.findById(userId);
      if (userData) {
        return res.render("users/homePage", {
          user: userData,
          products: recentProducts,
          topSellingProducts,
          product,
          brands,
          cartCount,
          featured,
        });
      }
    }

    return res.render("users/homePage", {
      user: null,
      products: recentProducts,
      topSellingProducts,
      product,
      brands,
      cartCount,
      featured,
    });
  } catch (error) {
    console.error("An error occurred while loading the home page:", error);
    return res.render("users/homePage", {
      user: null,
      products: [],
      topSellingProducts: [],
    });
  }
};
//function for loading auth page
const loadAuth = async (req, res) => {
  try {
    if (req.session.user) {
      return res.redirect("/");
    }

    return res.render("users/authPage", { message: req.query.message || "" });
  } catch (error) {
    console.error("Error loading auth page:", error);
    res.redirect("/PageNotFound");
  }
};
//function for generating otp
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
//function for sending email
async function sendVerificationEmail(email, otp) {
  try {
    console.log("Starting email verification process...");
    console.log("Email configuration:", {
      user: process.env.NODEMAILER_EMAIL,
      pass: process.env.NODEMAILER_PASSWORD ? "****" : "not set",
    });

    const transporter = nodeMailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    await transporter.verify();
    console.log("Transporter verified successfully");

    console.log("Sending email to:", email);
    console.log("OTP:", otp);

    const info = await transporter.sendMail({
      from: `"CyberCrate" <${process.env.NODEMAILER_EMAIL}>`,
      to: email,
      subject: "CyberCrate - Verify Your Email",
      text: `your otp is ${otp}`,
      html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Email Verification</h2>
                    <p>Your verification code is:</p>
                    <h1 style="color: #6c63ff; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
                    <p>This code will expire in 5 minutes.</p>
                    <p>If you didn't request this code, please ignore this email.</p>
                </div>
            `,
    });

    console.log("Email sent successfully:", {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("Detailed email error:", {
      name: error.name,
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });
    return false;
  }
}

// Utility function to create a referral code
const createReferalCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// const signup = async (req, res) => {
//   try {
//     const { name, email, phone, password, cPassword, referalCode } = req.body;

//     // Validate passwords match
//     if (password !== cPassword) {
//       return res.render("users/authPage", {
//         message: "Passwords do not match",
//         activeForm: "signup",
//       });
//     }

//     // Check if user already exists
//     const findUser = await User.findOne({ email });
//     if (findUser) {
//       return res.render("users/authPage", {
//         message: "User with this email already exists",
//         activeForm: "signup",
//       });
//     }

//     // Generate a new referral code for the user
//     const userReferalCode = createReferalCode();

//     // Validate referral code, if provided
//     let referedByAUser = null;
//     if (referalCode) {
//       referedByAUser = await User.findOne({ referalCode });
//       if (!referedByAUser) {
//         console.log("The referral code you entered is invalid");

//         return res.render("users/authPage", {
//           message: "The referral code you entered is invalid",
//           activeForm: "signup",
//         });
//       }
//     }
//     // Generate OTP and send email
//     const otp = generateOtp();
//     console.log("Generated OTP:", otp);
//     console.log("referal code", referalCode);

//     const emailSent = await sendVerificationEmail(email, otp);
//     if (!emailSent) {
//       return res.render("users/authPage", {
//         message: "Failed to send verification email",
//         activeForm: "signup",
//       });
//     }

//     // Store data in session for verification
//     req.session.userOtp = otp;
//     req.session.userData = {
//       name,
//       email,
//       phone,
//       password:password, 
//       referalCode,
//       userReferalCode,
//       referedBy: referedByAUser ? referedByAUser._id : null,
//     };
//     req.session.otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

//     // Redirect to OTP verification page
//     res.render("users/verifyOtp");
//     console.log("Session Data after OTP generation:", {
//       userOtp: req.session.userOtp,
//       userData: req.session.userData,
//       otpExpiry: req.session.otpExpiry,
//     });
//   } catch (error) {
//     console.error("Signup error:", error);
//     res.redirect("/PageNotFound");
//   }
// };

// const signin = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     const findUser = await User.findOne({ email });

//     if (!findUser) {
//       return res.render("users/authPage", {
//         message: "User not found",
//         activeForm: "signin",
//       });
//     }

//     if (findUser.isAdmin) {
//       return res.render("users/authPage", {
//         message: "Please use admin login",
//         activeForm: "signin",
//       });
//     }

//     if (findUser.isBlocked) {
//       return res.render("users/authPage", {
//         message:
//           "Your account has been blocked by the admin. Please contact support.",
//         activeForm: "signin",
//       });
//     }

//     const passwordMatch = await bcrypt.compare(password, findUser.password);
//     if (!passwordMatch) {
//       return res.render("users/authPage", {
//         message: "Invalid password",
//         activeForm: "signin",
//       });
//     }

//     req.session.user = {
//       _id: findUser._id,
//     };
//     await req.session.save();

//     // console.log('User Session Data:', req.session.user);

//     return res.redirect("/");
//   } catch (error) {
//     console.error("Signin error:", error);
//     res.render("users/authPage", {
//       message: "Login failed, please try again",
//       activeForm: "signin",
//     });
//   }
// };

//function for secure password


// const signin = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     console.log(' login with email:', email);
    
//     const findUser = await User.findOne({ email });
//     if (!findUser) {
//       return res.render("users/authPage", {
//         message: "User not found",
//         activeForm: "signin",
//       });
//     }

//     // Extra validation to ensure password exists in DB
//     if (!findUser.password) {
//       console.log('No password hash found in database!');
//       return res.render("users/authPage", {
//         message: "Invalid password",
//         activeForm: "signin",
//       });
//     }

//     console.log('Attempting password comparison:');
//     console.log('Input password:', password);
//     console.log('Stored hash:', findUser.password);
    
//     try {
//       const passwordMatch = await bcrypt.compare(password, findUser.password);
//       console.log('Password match result:', passwordMatch);
      
//       if (!passwordMatch) {
//         return res.render("users/authPage", {
//           message: "Invalid password",
//           activeForm: "signin",
//         });
//       }
//     } catch (bcryptError) {
//       console.error('bcrypt.compare error:', bcryptError);
//       return res.render("users/authPage", {
//         message: "Error verifying password",
//         activeForm: "signin",
//       });
//     }

//     req.session.user = {
//       _id: findUser._id,
//     };
//     await req.session.save();

//     return res.redirect("/");
//   } catch (error) {
//     console.error("Signin error:", error);
//     res.render("users/authPage", {
//       message: "Login failed, please try again",
//       activeForm: "signin",
//     });
//   }
// };

// const securePassword = async (password) => {
//   try {
//     const passwordHash = await bcrypt.hash(password, 10);
//     return passwordHash;
//   } catch (error) {
//     console.log("error while Securing password", error);
//   }
// };



//function for verify otp
// const verifyOtp = async (req, res) => {
//   try {
//     const { otp } = req.body;
//     console.log("Received OTP:", otp, "Type:", typeof otp);
//     console.log(
//       "Stored OTP:",
//       req.session.userOtp,
//       "Type:",
//       typeof req.session.userOtp
//     );

//     // Check  session exists or mot
//     if (
//       !req.session.userOtp ||
//       !req.session.userData ||
//       !req.session.otpExpiry
//     ) {
//       console.log("Session missing required data:", {
//         hasOtp: !!req.session.userOtp,
//         hasUserData: !!req.session.userData,
//         hasExpiry: !!req.session.otpExpiry,
//       });
//       return res.status(400).json({
//         success: false,
//         message: "Session expired. Please try signing up again.",
//       });
//     }

//     const now = Date.now();
//     const expiryTime = req.session.otpExpiry;
//     console.log("Time check:", {
//       now,
//       expiryTime,
//       difference: now - expiryTime,
//       hasExpired: now > expiryTime,
//     });

//     if (now > expiryTime) {
//       delete req.session.userOtp;
//       delete req.session.userData;
//       delete req.session.otpExpiry;

//       return res.status(400).json({
//         success: false,
//         message: "OTP has expired. Please try signing up again.",
//       });
//     }

//     const receivedOtp = String(otp).trim();
//     const storedOtp = String(req.session.userOtp).trim();

//     if (receivedOtp !== storedOtp) {
//       console.log("OTP mismatch:", {
//         received: receivedOtp,
//         stored: storedOtp,
//         receivedLength: receivedOtp.length,
//         storedLength: storedOtp.length,
//       });
//       return res.status(400).json({
//         success: false,
//         message: "Invalid OTP. Please try again.",
//       });
//     }

//     const user = req.session.userData;
//     const passwordHash = await securePassword(user.password,10);

//     const saveUserData = new User({
//       name: user.name,
//       email: user.email,
//       phone: user.phone,
//       password: passwordHash,
//       referalCode: user.userReferalCode,
//       referedBy: user.referedBy || null,
//     });

//     await saveUserData.save();
//     console.log("User saved successfully:", saveUserData._id);

//     if (user.referedBy) {
//       const reffererWallet = await Wallet.findOne({ userId: user.referedBy });

//       if (reffererWallet) {
//         reffererWallet.balance = Number(reffererWallet.balance) + +referalBonus;
//         reffererWallet.walletHistory.push({
//           transactionType: "credit",
//           amount: referalBonus,
//           description: "Initial balance",
//         });
//         await reffererWallet.save();
//       } else {
//         const newWallet = new Wallet({
//           userId: user.referedBy,
//           balance: referalBonus,
//           walletHistory: [
//             {
//               transactionType: "credit",
//               amount: referalBonus,
//               description: "Initial balance",
//             },
//           ],
//         });
//         await newWallet.save();
//       }
//       console.log(
//         "Referral bonus credited to referrer wallet:",
//         user.referedBy
//       );
//     }

//     // Initialize a wallet for the new user and credit the signup bonus
//     const userWallet = new Wallet({
//       userId: saveUserData._id,
//       balance: signupBonus,
//       walletHistory: [
//         {
//           transactionType: "credit",
//           amount: signupBonus,
//           description: "Signup bonus",
//         },
//       ],
//     });
//     await userWallet.save();

//     console.log("Wallet initialized for new user:", saveUserData._id);

//     delete req.session.userOtp;
//     delete req.session.userData;
//     delete req.session.otpExpiry;

//     req.session.user = saveUserData._id;
//     await req.session.save();

//     return res.json({
//       success: true,
//       message: "Email verified successfully!",
//       redirect: "/",
//     });
//   } catch (error) {
//     console.error("OTP verification error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "An error occurred during verification",
//     });
//   }
// };

//function for resend otp


const signup = async (req, res) => {
  try {
    const { name, email, phone, password, cPassword, referalCode } = req.body;

    // Validate passwords match
    if (password !== cPassword) {
      return res.render("users/authPage", {
        message: "Passwords do not match",
        activeForm: "signup",
      });
    }

    // Check if user already exists
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("users/authPage", {
        message: "User with this email already exists",
        activeForm: "signup",
      });
    }

    // Generate a new referral code for the user
    const userReferalCode = createReferalCode();

    // Validate referral code, if provided
    let referedByAUser = null;
    if (referalCode) {
      referedByAUser = await User.findOne({ referalCode });
      if (!referedByAUser) {
        console.log("The referral code you entered is invalid");

        return res.render("users/authPage", {
          message: "The referral code you entered is invalid",
          activeForm: "signup",
        });
      }
    }

    // Generate OTP and send email
    const otp = generateOtp();
    console.log("Generated OTP:", otp);
    console.log("referal code", referalCode);

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render("users/authPage", {
        message: "Failed to send verification email",
        activeForm: "signup",
      });
    }

    // Store data in session for verification
    req.session.userOtp = otp;
    req.session.userData = {
      name,
      email,
      phone,
      password: password, // Store plain password - this is the main fix
      referalCode,
      userReferalCode,
      referedBy: referedByAUser ? referedByAUser._id : null,
    };
    req.session.otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

    console.log("Session Data after OTP generation:", {
      userOtp: req.session.userOtp,
      userData: req.session.userData,
      otpExpiry: req.session.otpExpiry,
    });

    // Redirect to OTP verification page
    res.render("users/verifyOtp");
    
  } catch (error) {
    console.error("Signup error:", error);
    res.redirect("/PageNotFound");
  }
};

const signin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Attempting login with email:', email);
    
    const findUser = await User.findOne({ email });
    if (!findUser) {
      return res.render("users/authPage", {
        message: "User not found",
        activeForm: "signin",
      });
    }

    if (findUser.isAdmin) {
            return res.render("users/authPage", {
              message: "Please use admin login",
              activeForm: "signin",
            });
          }

    // Extra validation to ensure password exists in DB
    if (!findUser.password) {
      console.log('No password hash found in database!');
      return res.render("users/authPage", {
        message: "Invalid password",
        activeForm: "signin",
      });
    }

    // Try direct comparison using bcrypt
    console.log('Attempting password comparison:');
    console.log('Input password:', password);
    console.log('Stored hash:', findUser.password);
    
    const passwordMatch = await bcrypt.compare(password, findUser.password);
    console.log('Password match result:', passwordMatch);
    
    if (!passwordMatch) {
      return res.render("users/authPage", {
        message: "Invalid password",
        activeForm: "signin",
      });
    }

    req.session.user = {
      _id: findUser._id,
    };
    await req.session.save();

    return res.redirect("/");
  } catch (error) {
    console.error("Signin error:", error);
    res.render("users/authPage", {
      message: "Login failed, please try again",
      activeForm: "signin",
    });
  }
};


const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("Received OTP:", otp, "Type:", typeof otp);
    console.log(
      "Stored OTP:",
      req.session.userOtp,
      "Type:",
      typeof req.session.userOtp
    );

    // Check session exists or not
    if (
      !req.session.userOtp ||
      !req.session.userData ||
      !req.session.otpExpiry
    ) {
      console.log("Session missing required data:", {
        hasOtp: !!req.session.userOtp,
        hasUserData: !!req.session.userData,
        hasExpiry: !!req.session.otpExpiry,
      });
      return res.status(400).json({
        success: false,
        message: "Session expired. Please try signing up again.",
      });
    }

    const now = Date.now();
    const expiryTime = req.session.otpExpiry;
    console.log("Time check:", {
      now,
      expiryTime,
      difference: now - expiryTime,
      hasExpired: now > expiryTime,
    });

    if (now > expiryTime) {
      delete req.session.userOtp;
      delete req.session.userData;
      delete req.session.otpExpiry;

      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please try signing up again.",
      });
    }

    const receivedOtp = String(otp).trim();
    const storedOtp = String(req.session.userOtp).trim();

    if (receivedOtp !== storedOtp) {
      console.log("OTP mismatch:", {
        received: receivedOtp,
        stored: storedOtp,
        receivedLength: receivedOtp.length,
        storedLength: storedOtp.length,
      });
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please try again.",
      });
    }

    const user = req.session.userData;
    // Hash the password here - this is the main fix
    const passwordHash = await bcrypt.hash(user.password, 10);

    const saveUserData = new User({
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: passwordHash,
      referalCode: user.userReferalCode,
      referedBy: user.referedBy || null,
    });

    await saveUserData.save();
    console.log("User saved successfully:", saveUserData._id);

    if (user.referedBy) {
      const reffererWallet = await Wallet.findOne({ userId: user.referedBy });

      if (reffererWallet) {
        reffererWallet.balance = Number(reffererWallet.balance) + +referalBonus;
        reffererWallet.walletHistory.push({
          transactionType: "credit",
          amount: referalBonus,
          description: "Initial balance",
        });
        await reffererWallet.save();
      } else {
        const newWallet = new Wallet({
          userId: user.referedBy,
          balance: referalBonus,
          walletHistory: [
            {
              transactionType: "credit",
              amount: referalBonus,
              description: "Initial balance",
            },
          ],
        });
        await newWallet.save();
      }
      console.log(
        "Referral bonus credited to referrer wallet:",
        user.referedBy
      );
    }

    // Initialize a wallet for the new user and credit the signup bonus
    const userWallet = new Wallet({
      userId: saveUserData._id,
      balance: signupBonus,
      walletHistory: [
        {
          transactionType: "credit",
          amount: signupBonus,
          description: "Signup bonus",
        },
      ],
    });
    await userWallet.save();

    // console.log("Wallet initialized for new user:", saveUserData._id);

    delete req.session.userOtp;
    delete req.session.userData;
    delete req.session.otpExpiry;

    req.session.user = saveUserData._id;
    await req.session.save();

    return res.json({
      success: true,
      message: "Email verified successfully!",
      redirect: "/",
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred during verification",
    });
  }
};


const resendOtp = async (req, res) => {
  try {
    const email = req.session.userData?.email;
    if (!email) {
      return res
        .status(400)
        .json({
          success: false,
          message: "The previous session has expired, Try again",
        });
    }
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to send OTP, Please try again later.",
        });
    }

    req.session.userOtp = otp;
    req.session.otpExpiry = Date.now() + 5 * 60 * 1000;

    console.log(`New OTP has been sent to ${email}: ${otp}`);
    res.status(200).json({ success: true, message: "OTP sent successfully." });
  } catch (error) {
    console.log("Error in resending otp ", error);
    res
      .status(500)
      .json({ success: false, message: "Internal Server error,try again" });
  }
};

//function for logout
const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout/destroy error:", err);
        res.redirect("/pageNotFound");
      } else {
        res.redirect("/auth");
      }
    });
  } catch (error) {
    console.error("Logout error occured:", error);
    res.redirect("/pageNotFound");
  }
};

// Function for page not found
const PageNotFound = async (req, res) => {
  try {
    const errorMessage = "Oops! The page you are looking for cannot be found.";
    const errorCode = 404; // You can change this based on the error
    res.render("users/404-error", { errorMessage, errorCode });
  } catch (error) {
    console.error("PageNotFound error:", error);
    res.redirect("/pageNotFound");
  }
};

const getAbout = async (req, res) => {
  try {
    res.render("users/about");
  } catch (error) {
    console.error("error loading about page:", error);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  loadAuth,
  loadHome,
  signup,
  verifyOtp,
  resendOtp,
  signin,
  PageNotFound,
  logout,
  getAbout,
};
