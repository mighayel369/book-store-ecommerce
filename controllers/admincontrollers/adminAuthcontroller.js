const usermodel = require('../../models/userdetails');
let multer=require('multer')
let bcrypt=require('bcrypt')
const {check,validationResult } = require('express-validator');
module.exports = {
 
  postLogin:[check('email').notEmpty().withMessage('email address required')

    .isEmail().withMessage('invalid email address'),
    check('password').notEmpty().withMessage('password required'),
    async(req,res)=>{
    let {email,password}=req.body
    const errors= validationResult(req)
    if (!errors.isEmpty()) {
      const errorMessage = errors.array()[0].msg;
      req.session.adminmessage={message:errorMessage}
      return res.redirect('/admin/login');
    }
    try{
      let {email,password}=req.body
      let emailExist=await usermodel.findOne({email:{$regex:email,$options:'i'},role:'admin'})
      if(emailExist){
        let passwordCheck=bcrypt.compare(password,emailExist.password)
        if(passwordCheck){
          req.session.adminId=emailExist._id
          return res.redirect('/admin/dashboard')
        }else{
          req.session.adminmessage={message:"password is wrong"}
          return res.redirect('/admin/login')
        }
      }else{
        req.session.adminmessage={message:'email address is not exists'}
        return res.redirect('/admin/login')
      }
    }catch(error){
      console.log('internal server error')
    }

  }],

    getAdminUser:async (req,res)=>{
      try{
      let usersdata=await usermodel.find({role:'user'})
      res.render('admin/adminUsers',{usersdata})
      }catch(error){
        console.log(error)
      }
    },

  postAddUser:[check('username')
  .notEmpty().withMessage('Please fill out all fields')
  .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
  check('email')
  .notEmpty().withMessage('Email required')
  .isEmail().withMessage('Invalid email address'),
  check('phoneno').notEmpty().withMessage('Please fill out all fields'),
  check('password')
  .notEmpty().withMessage('Please fill out all fields')
  .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
  .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
   async(req,res)=>{
    let errors=validationResult(req)
      if (!errors.isEmpty()) {
        const errorMessage = errors.array()[0].msg;
        req.session.adminmessage={message:errorMessage}
        return res.redirect('/admin/adduser');
      }
    try{
    let {username,email,phoneno,password}=req.body
    let hashedpassword=await bcrypt.hash(password,10)
    let newUser={
      username,
      email,
      password:hashedpassword,
      phoneno
    }
    let user=await usermodel(newUser)
    await user.save()
    req.session.adminmessage={
      type:"success",
      message:"User Added Successfully"
    }
    res.redirect('/admin/users')
    }catch(error){
      req.session.adminmessage={
        type:"danger",
        message:"Something went wrong try again.."
      }
      res.redirect('/admin/users')
    }
  }],
 
  blockuser:async (req,res)=>{
    try{
    let id=req.params.id
    let user=await usermodel.findByIdAndUpdate(id,{status:false},{new:true})
    req.session.adminmessage={
      type:"success",
      message:"User Blocked Successfully"
    }
    res.redirect('/admin/users')
    }catch(error){
      res.send('Internal server error')
    }
  },  
  unblockuser:async (req,res)=>{
    try{
      let id=req.params.id
      let user=await usermodel.findByIdAndUpdate(id,{status:true},{new:true})
      req.session.adminmessage={
        type:"dark",
        message:"User Unblocked Successfully"
      }
      res.redirect('/admin/users')
      }catch(error){
        res.send('Internal server error')
      }
  },

  logout:async(req,res)=>{
    req.session.destroy(err=>{
      if(!err){
        res.clearCookie('sid1')
        res.redirect('/admin/login')
      }else{
        return res.redirect('/admin/dashboard')
      }
    })
  }
}
