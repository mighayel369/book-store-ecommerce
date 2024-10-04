const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const usermodel = require('../models/userdetails');
const dotenv = require('dotenv');


dotenv.config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/google/callback'
},

async (accessTocken,refreshToken,profile,done)=>{
    try{
        let user=await usermodel.findOne({googleId:profile.id})
        if(user){
            return done(null,user)
        }else{
            let checkEmailExist=await usermodel.findOne({email:profile.emails[0].value})
            if(checkEmailExist){
                return done(null, false, { message: 'Email already registered. Please log in with the original method.' });
            }
            user=new usermodel({
                username:profile.displayName,
                email:profile.emails[0].value,
                googleId:profile.id
            })
            await user.save()
            return done(null,user)
        }
    }catch(error){
        return done(error,null)
    }
}
))


passport.serializeUser((user,done)=>{
    done(null,user.id)
})

passport.deserializeUser((id,done)=>{
    usermodel.findById(id)
    .then(user=>{
        done(null,user)
    })
    .catch(err=>{
        done(err,null)
    })
})

module.exports=passport