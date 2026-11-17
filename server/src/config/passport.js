const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const Admin = require('../models/Admin');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value?.toLowerCase();
      if (!email || email !== process.env.ADMIN_EMAIL?.toLowerCase()) return done(null, false);
      const admin = await Admin.findOneAndUpdate(
        { email },
        {
          $set: {
            googleId: profile.id,
            email,
            name: profile.displayName,
            lastLogin: new Date(),
            loginAttempts: 0,
            lockUntil: null
          },
          $setOnInsert: { avatar: profile.photos?.[0]?.value || '' }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return done(null, admin);
    } catch (error) {
      return done(error);
    }
  }));
}

module.exports = passport;
