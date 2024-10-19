const usermodel = require('../../models/userdetails');
let bcrypt=require('bcrypt')
const {check,validationResult } = require('express-validator');
let otpmodel=require('../../models/otpmodel')
const otpController = require('./otpcontroller')
let product=require('../../models/productdetails')

 module.exports = {
  verifyUser:[check('email').notEmpty().withMessage('email address required')
    .isEmail().withMessage('invalid email address'),
    check('password').notEmpty().withMessage('password required'),
   async (req, res) => {
    const errors=validationResult(req)
    if (!errors.isEmpty()) {
      const errorMessage = errors.array()[0].msg;
      req.session.message={message:errorMessage}
      return res.redirect('/login');
    }
    try {
      const user = await usermodel.findOne({ email: req.body.email, role: 'user' });
      
      if (user) {
        const isMatch =await bcrypt.compare(req.body.password, user.password);
        if(user.status===false){
          req.session.message={message:"Your Account Is Blocked"}
          return res.redirect('/login')
        }else if (isMatch) {
          req.session.userId = user._id;
          req.session.message={message:"User Logged Successfully"}
          return res.redirect('/');
        } else {
          req.session.message = { message: 'Password Is Incorrect' };
          return res.redirect('/login');
        }
      } else {
        req.session.message = { message: 'User Not Found' };
        return res.redirect('/login');
      }
    } catch (error) {
      res.send('error occured')
    }
  }],

  addUser: [check('username')
    .notEmpty().withMessage('Username required')
    .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
    check('email')
    .notEmpty().withMessage('Email required')
    .isEmail().withMessage('Invalid email address'),
    check('phoneno').notEmpty().withMessage('Name is required'),
    check('password')
    .notEmpty().withMessage('Password required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
    async (req, res) => {
      const {email,username,password,confirmpassword,phoneno } = req.body;
  
      if(password!==confirmpassword){
        req.session.message={message:"password is not matching"}
        return res.redirect('/signup');
      } 
      const errors = validationResult(req);
  
      if (!errors.isEmpty()) {
        const errorMessage = errors.array()[0].msg;
        req.session.message={message:errorMessage}
        return res.redirect('/signup');
      }
      try{
        const isExists = await usermodel.findOne({email:email,role:'user'});
        if(isExists){
          req.session.message={message:'This email has already had an account'}
          return res.redirect('/signup')
        }else{
          let sendotp=await otpController.sendOTP(email)
          req.session.signupDetails = { username, email, phoneno, password };
          return res.redirect('/verify-otp')
        }
      }catch(error){
        res.send('Internal server error')
      }
    }
  ],
  getLogin:async (req,res)=>{
    try{
      if(req.session.userId){
        return res.redirect('/')
      }
      let {search=''}=req.query
      let {userId}=req.session
      var users=await usermodel.findById(userId)
      res.render('users/login',{users,search})
    }
    catch(error){
      console.log(error)
    }
  },
  getSignup:async (req,res)=>{
    let {search=''}=req.query
    let {userId}=req.session
    var users=await usermodel.findById(userId)
    res.render('users/signup',{users,search})
  },

  getVerifyOTP:async (req,res)=>{
    let {search=''}=req.query
    let {userId}=req.session
    var users=await usermodel.findById(userId)
    res.render('users/verifyOTP',{users,search})
  },
  postVerifyOTP:async(req,res)=>{
    try{
      if(req.session.forgotpassword){
        let {email}=req.session.forgotpassword
        const otpValid=await otpmodel.findOne({email:email,otp:req.body.otp})
        if(otpValid){
          return res.redirect('/forgotpassword')
        }else{
          req.session.message={message:'otp is invalid'}
          return res.redirect('/verify-otp')
        }
      }
    let { username, email, phoneno, password } = req.session.signupDetails;
    const otpValid=await otpmodel.findOne({email:email,otp:req.body.otp})
    if(otpValid){
      let hashedpassword = await bcrypt.hash(password, 10);
      let newUser = {
        username,
        email,
        phoneno,
        password: hashedpassword
      };
      let user = new usermodel(newUser);
      await user.save();

      delete req.session.signupDetails;
      return res.redirect('/login')
    }else{
      req.session.message={message:'OTP is Invalid'}
      return res.redirect('/verify-otp')
    }
    }catch(error){
      req.session.message={
        message:error.message
      }
      return res.redirect('/verify-otp')
    }
  },
  resendOTP:async(req,res)=>{
    try{
      if(req.session.forgotpassword){
        let {email}=req.session.forgotpassword
        let resendotp=await otpController.sendOTP(email)
        return res.redirect('/forgotpassword')
      }
    let {email}=req.session.signupDetails
    let resendotp=await otpController.sendOTP(email)
    res.redirect('/verify-otp')
    }catch(error){
      res.send('Internal server error')
    }
  },
  getVerifyEmail:async(req,res)=>{
    let {search=''}=req.query
    let users;
    if(req.session.userId)
      users=await usermodel.findById(req.session.userId)
    res.render('users/verifyEmail',{users,search})
  },
  postVerifyEmail:async (req,res)=>{
    let {email}=req.body
    let emailExist=await usermodel.findOne({email:email})
    if(!emailExist){
      req.session.message={message:'Email Not Found'}
      return res.redirect('/verify-email')
    }
    let sendotp=await otpController.sendOTP(email)
    req.session.forgotpassword={email}
    res.redirect('/verify-otp')
  },
  getForgotPassword:async (req,res)=>{
    let {search=''}=req.query
    let users;
    if(req.session.userId)
      users=await usermodel.findById(req.session.userId)
    res.render('users/forgotPassword',{users,search})
  },
  postForgotPassword:async (req,res)=>{
    let {email}=req.session.forgotpassword
    let {newpassword,confirmpassword}=req.body
    if(newpassword!==confirmpassword){
      req.session.message={message:"password is not match"}
      return res.redirect('/forgotpassword')
    }
    let hashedpassword = await bcrypt.hash(confirmpassword, 10);
    let user=await usermodel.findOne({email:email})
    if(user){
      user.password=hashedpassword
      await user.save()
      delete req.session.forgotpassword
      return res.redirect('/login')
    }else{
      req.session.message={message:'user not found'}
      return res.redirect('/forgotpassword')
    }
  }
  
}


