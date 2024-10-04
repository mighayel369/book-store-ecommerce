const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const usermodel = require('../models/userdetails');
const dotenv = require('dotenv');

dotenv.config();

passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_CLIENT_ID,
  clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  callbackURL: '/auth/facebook/callback',
  profileFields: ['id', 'emails', 'name'] 
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await usermodel.findOne({ facebookId: profile.id });
    if (!user) {
      user = new usermodel({
        facebookId: profile.id,
        username: profile.name.givenName,
        email: profile.emails[0].value
      });
      await user.save();
    }
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await usermodel.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports=passport