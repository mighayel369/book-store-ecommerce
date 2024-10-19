let usercontroller=require('../controllers/usercontrollers/userAuthcontroller')
let productcontroller=require('../controllers/usercontrollers/productController')
let authMiddleware=require('../authMiddleware/adminAuthmiddleware')
const otpController = require('../controllers/usercontrollers/otpcontroller')
let cartController=require('../controllers/usercontrollers/cartController')
let accountController=require('../controllers/usercontrollers/accountController')
let checkoutController=require('../controllers/usercontrollers/checkoutController')
let orderController=require('../controllers/usercontrollers/orderController')
const express=require('express')
let session=require('express-session')
const router=express.Router()
const passport=require('passport')
let googlepassport=require('../config/passport'); 
let facebook_passport=require('../config/facebookPassport')
let multer=require('multer')


router.use(express.static('public/profilepictures'))

let storage=multer.diskStorage({
  destination:(req,file,callback)=>{
    callback(null,'public/profilepictures')
  },
  filename:(req,file,callback)=>{
    callback(null,file.fieldname+ "_" +Date.now() +"_"+ file.originalname)
  }
})

var upload=multer({
  storage:storage
}).single('photo')

router.use(session({
  name:"sid2",
  secret: "my secret key",
  saveUninitialized: true,
  resave: false,
  cookie: { secure: false } 
}));


router.use(googlepassport.initialize());
router.use(googlepassport.session());

router.use(facebook_passport.initialize());
router.use(facebook_passport.session());

router.use((req,res,next)=>{
  res.locals.message=req.session.message
  delete req.session.message
  next()
})




router.get('/login',usercontroller.getLogin)


router.post('/login',usercontroller.verifyUser)


router.get('/signup',usercontroller.getSignup)

router.post('/signup',usercontroller.addUser);

router.get('/verify-otp',usercontroller.getVerifyOTP)
router.post('/verify-otp',usercontroller.postVerifyOTP)

router.get('/resend-otp',usercontroller.resendOTP)

router.get('/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/google/callback',passport.authenticate('google', { failureRedirect: '/signup' }),productcontroller.getHome);

router.get('/forgotpassword',usercontroller.getForgotPassword)
router.post('/forgotpassword',usercontroller.postForgotPassword)
router.get('/verify-email',usercontroller.getVerifyEmail)

router.post('/verify-email',usercontroller.postVerifyEmail)


router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/auth/facebook/callback',passport.authenticate('facebook', { failureRedirect: '/signup' }),productcontroller.getHome);
//---------------------------------------Home----------------------------------//
router.get('/',productcontroller.getHome)
//---------------------------------------Home----------------------------------//
//---------------------------------------products----------------------------------//



router.get('/products',productcontroller.getProducts)
router.get('/singlepage/:id',productcontroller.getSingleProduct)


//---------------------------------------products----------------------------------//
router.get('/logout',(req,res)=>{
  req.session.destroy((err)=>{
    if(!err){
      return res.redirect('/login')
    }else{
      return res.send('unable to logout')
    }
  })
})

//---------------------------------------cart----------------------------------//

router.get('/cart',authMiddleware.isUserBlocked,cartController.getCart)
router.post('/add-to-cart',authMiddleware.isUserBlockedclient,cartController.addToCart)
router.post('/update-quantity',cartController.changeQuantity)

router.get('/cart/delete-product/:id',cartController.deleteProduct)

router.get('/updated-total-price',cartController.getCartTotal)
//---------------------------------------cart----------------------------------//

//---------------------------------------account----------------------------------//
router.get('/account',authMiddleware.isUserBlocked,accountController.getAccount)
router.get('/accountaddress',authMiddleware.isUserBlocked,accountController.getAddress)
router.post('/addAddress',accountController.addAddress)
router.get('/delete-address/:id',accountController.deleteAddress)
router.post('/edit-address/:id',accountController.editAddress)
router.get('/account/:id',accountController.getSingleOrder)
router.get('/profile',accountController.getProfile)
router.post('/edit-profile',upload,accountController.editProfile)
router.post('/change-password',accountController.postChangePassword)
router.get('/change-password',accountController.changePassword)

router.post('/paynow',accountController.paynow)
router.post('/verifypay',accountController.verifypayment)
//---------------------------------------account----------------------------------//

//---------------------------------------checkout----------------------------------//
router.get('/checkout',authMiddleware.isUserBlocked,checkoutController.getCheckout)
router.post('/updateDefaultaddress',checkoutController.updateDefaultAddress)

router.post('/place-order',checkoutController.placeOrder)

router.get('/checkout/applycoupon/:id',checkoutController.applyCoupon)
router.get('/checkout/removeCoupon',checkoutController.removeCoupon)
//---------------------------------------checkout----------------------------------//
 router.get('/orders/:id/product/:productId/cancel-reason',orderController.cancelOrderReason)
 router.post('/order/cancel',orderController.cancelOrder)
 router.get('/ordersuccess',orderController.showSuccesPage)
 router.post('/verify-payment',orderController.verifyPayment)
 router.get('/downloadinvoice/:id',orderController.downloadInvoice)


 router.get('/orderReturn/:id/product/:productId',orderController.returnOrderReason)
 router.post('/order/return',orderController.returnOrder)
//---------------------------------------order--------------------------------------//

//-------------------------------------wallet-------------------------------------//
router.get('/wallet',accountController.getWallet)
router.get('/wallet/clearhistory/:id',accountController.clearHistory)
//------------------------------------wishlist----------------------------------//
router.get('/wishlist',accountController.getWishlist)
router.post('/add-to-wishlist',accountController.postWishlist)
//------------------------------------others----------------------------------------//
router.get('/brands',productcontroller.getBrand)
router.get('/about',productcontroller.getAbout)
router.get('/contact',productcontroller.getContact)

module.exports=router
