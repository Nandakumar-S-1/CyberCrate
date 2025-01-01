const User=require('../../Models/userModel')
const env=require('dotenv').config();
const nodeMailer=require('nodemailer')
const bcrypt = require('bcrypt')
const Category = require('../../Models/categoryModel');
const Product  = require('../../Models/productModel');
const Brand = require('../../Models/brandModel');

const loadHome = async (req, res) => {
    try {
        const userId = req.session.user;

        const categories = await Category.find({ isListed: true });
        let recentProducts = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 }
        });

        recentProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        recentProducts = recentProducts.slice(0, 8);

        const productName = 'Predator Galea 310 Gaming Headset'; 
        const product = await Product.findOne({ productName: productName });

        const topSellingProducts = await Product.find({
            isBlocked: false,
            quantity: { $gt: 0 }
        }).sort({ quantity: 1 }).limit(3);
        const brands = await Brand.find().limit(30);
        if (userId) {
            const userData = await User.findById(userId);
            if (userData) {
                return res.render('users/homePage', { 
                    user: userData, 
                    products: recentProducts, 
                    topSellingProducts,
                    product,
                    brands
                });
            }
        }
    
        return res.render('users/homePage', { 
            user: null, 
            products: recentProducts, 
            topSellingProducts,
            product,
            brands
        });
    } catch (error) {
        console.error('An error occurred while loading the home page:', error);
        return res.render('users/homePage', { user: null, products: [], topSellingProducts: [] });
    }
};

const loadAuth = async (req, res) => {
    try {

        if (req.session.user) {
            return res.redirect('/');
        }

        return res.render('users/authPage', { message: req.query.message || '' });
    } catch (error) {
        console.error('Error loading auth page:', error);
        res.redirect('/PageNotFound')
    }
};

function generateOtp() {
    return Math.floor(100000 + Math.random()*900000).toString();
}

async function sendVerificationEmail(email, otp) {
    try {
        console.log('Starting email verification process...');
        console.log('Email configuration:', {
            user: process.env.NODEMAILER_EMAIL,
            pass: process.env.NODEMAILER_PASSWORD ? '****' : 'not set'
        });

        const transporter = nodeMailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS:true,
            auth: {
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            },
        });


        await transporter.verify();
        console.log('Transporter verified successfully');

        console.log('Sending email to:', email);
        console.log('OTP:', otp);

        const info = await transporter.sendMail({
            from: `"CyberCrate" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: 'CyberCrate - Verify Your Email',
            text:`your otp is ${otp}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Email Verification</h2>
                    <p>Your verification code is:</p>
                    <h1 style="color: #6c63ff; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
                    <p>This code will expire in 5 minutes.</p>
                    <p>If you didn't request this code, please ignore this email.</p>
                </div>
            `
        });
        
        console.log('Email sent successfully:', {
            messageId: info.messageId,
            response: info.response,
            accepted: info.accepted,
            rejected: info.rejected
        });
        
        return info.accepted.length > 0;
    } catch (error) {
        console.error('Detailed email error:', {
            name: error.name,
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response
        });
        return false;
    }
}

const signup = async (req, res) => {
    try {
        const { name, email, phone, password, cPassword } = req.body;

        if (password !== cPassword) {
            return res.render('users/authPage', { 
                message: 'Passwords do not match',
                activeForm: 'signup' 
            });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render('users/authPage', { 
                message: 'User with this email already exists',
                activeForm: 'signup'
            });
        }

        const otp = generateOtp();
        console.log('Generated OTP:', otp);
        
        const emailSent = await sendVerificationEmail(email, otp);
        console.log('Email sent status:', emailSent);

        if (!emailSent) {
            return res.render('users/authPage', {
                message: 'Failed to send verification email',
                activeForm: 'signup'
            });
        }

        console.log('Session Data before OTP generation:', {
            userOtp: req.session.userOtp,
            userData: req.session.userData,
            otpExpiry: req.session.otpExpiry
        });

        // Store in session 
        req.session.userOtp = otp;
        req.session.userData = { name, email, phone, password };
        req.session.otpExpiry = Date.now() + (5 * 60 * 1000); 

        res.render('users/verifyOtp');
        console.log('Session Data after OTP generation:', {
            userOtp: req.session.userOtp,
            userData: req.session.userData,
            otpExpiry: req.session.otpExpiry
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.redirect('/PageNotFound');
    }
}

const signin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const findUser = await User.findOne({ email });

        if (!findUser) {
            return res.render('users/authPage', { 
                message: 'User not found',
                activeForm: 'signin'
            });
        }

        if (findUser.isAdmin) {
            return res.render('users/authPage', {
                message: 'Please use admin login',
                activeForm: 'signin'
            });
        }

        if (findUser.isBlocked) {
            return res.render('users/authPage', {
                message: 'Your account has been blocked by the admin. Please contact support.',
                activeForm: 'signin'
            });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);
        if (!passwordMatch) {
            return res.render('users/authPage', {
                message: 'Invalid password',
                activeForm: 'signin'
            });
        }

        req.session.user = {
            _id: findUser._id
        };
        await req.session.save();

        console.log('User Session Data:', req.session.user);

        return res.redirect('/');
    } catch (error) {
        console.error('Signin error:', error);
        res.render('users/authPage', {
            message: 'Login failed, please try again',
            activeForm: 'signin'
        });
    }
};


// const signin = async (req, res) => {
//     try {
//         const { email, password } = req.body;
//         const findUser = await User.findOne({ email });

//         if (!findUser) {
//             return res.render('users/authPage', { 
//                 message: 'User not found',
//                 activeForm: 'signin'
//             });
//         }

//         if (findUser.isAdmin) {
//             return res.render('users/authPage', {
//                 message: 'Please use admin login',
//                 activeForm: 'signin'
//             });
//         }


//         if (findUser.isBlocked) {
//             return res.render('users/authPage', {
//                 message: 'Your account has been blocked by the admin. Please contact support.',
//                 activeForm: 'signin'
//             });
//         }

//         const passwordMatch = await bcrypt.compare(password, findUser.password);
//         if (!passwordMatch) {
//             return res.render('users/authPage', {
//                 message: 'Invalid password',
//                 activeForm: 'signin'
//             });
//         }


//         req.session.user ={ _id: findUser._id}
//         await req.session.save();

//         console.log("----------------------------------------",req.session.user);
        

//         return res.redirect('/');
//     } catch (error) {
//         console.error('Signin error:', error);
//         res.render('users/authPage', {
//             message: 'Login failed, please try again',
//             activeForm: 'signin'
//         });
//     }
// };

const securePassword = async (password) => {
    
    try {
        
        const passwordHash = await bcrypt.hash(password,10)
        return passwordHash;

    } catch (error) {
        
        console.log('error while Securing password', error);
        
    }

}

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log('Received OTP:', otp, 'Type:', typeof otp);
        console.log('Stored OTP:', req.session.userOtp, 'Type:', typeof req.session.userOtp);

        // Check  session exists or mot
        if (!req.session.userOtp || !req.session.userData || !req.session.otpExpiry) {
            console.log('Session missing required data:', {
                hasOtp: !!req.session.userOtp,
                hasUserData: !!req.session.userData,
                hasExpiry: !!req.session.otpExpiry
            });
            return res.status(400).json({
                success: false,
                message: 'Session expired. Please try signing up again.'
            });
        }

        // Check OTP has expired
        const now = Date.now();
        const expiryTime = req.session.otpExpiry;
        console.log('Time check:', {
            now,
            expiryTime,
            difference: now - expiryTime,
            hasExpired: now > expiryTime
        });

        if (now > expiryTime) {
            // Clear session data
            delete req.session.userOtp;
            delete req.session.userData;
            delete req.session.otpExpiry;
            
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please try signing up again.'
            });
        }

        const receivedOtp = String(otp).trim();
        const storedOtp = String(req.session.userOtp).trim();

        if (receivedOtp !== storedOtp) {
            console.log('OTP mismatch:', {
                received: receivedOtp,
                stored: storedOtp,
                receivedLength: receivedOtp.length,
                storedLength: storedOtp.length
            });
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP. Please try again.'
            });
        }

        const user = req.session.userData;
        const passwordHash = await securePassword(user.password);

        const saveUserData = new User({
            name: user.name,
            email: user.email,
            phone: user.phone,
            password: passwordHash
        });

        await saveUserData.save();
        console.log('User saved successfully:', saveUserData._id);

        delete req.session.userOtp;
        delete req.session.userData;
        delete req.session.otpExpiry;


        req.session.user = saveUserData._id;
        await req.session.save();  

        return res.json({
            success: true,
            message: 'Email verified successfully!',
            redirect: '/'
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during verification'
        });
    }
}

const resendOtp = async(req,res)=>{
    try {
        
        const email = req.session.userData?.email;
        if(!email){
            return res.status(400).json({success:false,message:'The previous session has expired, Try again'})
        }
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email,otp);

        if(!emailSent){
            return res.status(500).json({success:false,message:'Failed to send OTP, Please try again later.'})
        }

        req.session.userOtp = otp;
        req.session.otpExpiry = Date.now() + 5 * 60 * 1000;  

        console.log(`New OTP has been sent to ${email}: ${otp}`);
        res.status(200).json({success:true,message:'OTP sent successfully.'})

    } catch (error) {
        

        console.log('Error in resending otp ',error);
        res.status(500).json({success:false,message:'Internal Server error,try again'})        

    }
}

const logout = async (req, res) => {
    try {
        req.session.destroy((err)=>{
            if(err){
                console.error('Logout/destroy error:', err);
                res.redirect('/pageNotFound');
            }else{
                res.redirect('/auth');
            }
        });
        
    } catch (error) {
        console.error('Logout error occured:', error);
        res.redirect('/pageNotFound');
    }
};

const PageNotFound = async (req, res) => {
    try {
        res.render('404-error');
    } catch (error) {
        console.error('PageNotFound error:', error);
        res.redirect('/PageNotFound')
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

}
