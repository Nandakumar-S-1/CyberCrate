const passport = require("passport");
const googleMethod = require("passport-google-oauth20").Strategy;
const User = require("../Models/userModel");
const env = require("dotenv").config();

passport.use(
  new googleMethod(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // callbackURL: "http://localhost:5051/auth/google/callback",
      callbackURL: process.env.NODE_ENV === "production"
      ? "https://cybercrate.store/auth/google/callback"
      : "http://localhost:5051/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google Auth Started - Profile:", profile);

        // Get email from profile
        const email =
          profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        if (!email) {
          console.error("No email found in Google profile");
          return done(new Error("No email found in Google profile"), null);
        }

        let user = await User.findOne({ googleId: profile.id });
        if (user) {
          console.log("Existing user found:", user.email);
          return done(null, user);
        } else {
          console.log("Creating new user with email:", email);
          user = new User({
            name: profile.displayName,
            email: email,
            googleId: profile.id,
            isVerified: true,
          });
          await user.save();
          console.log("New user created successfully");
          return done(null, user);
        }
      } catch (error) {
        console.error("Google Auth Error:", error);
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  // console.log('Serializing user:', user.id);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  
  User.findById(id)
    .then((user) => {
      // console.log('User found in deserialize:', user ? user.email : 'not found');
      done(null, user);
    })
    .catch((err) => {
      console.error("Deserialize error:", err);
      done(err, null);
    });
});

module.exports = passport;
