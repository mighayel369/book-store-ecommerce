const express=require('express')
const router=express.Router()
let session=require('express-session')
let adminAuthController=require('../controllers/admincontrollers/adminAuthcontroller')
let categoryController=require('../controllers/admincontrollers/adminCategorycontroller')
let productController=require('../controllers/admincontrollers/Productcontroller')
let orderController=require('../controllers/usercontrollers/orderController')
let couponController=require('../controllers/admincontrollers/couponController')
let offerController=require('../controllers/admincontrollers/offerController')
let salesController=require('../controllers/admincontrollers/salesController')
let authMiddleware=require('../authMiddleware/adminAuthmiddleware')
let multer=require('multer')


router.use(express.static('public/category_images'))
router.use(express.static('public/product_images'))
router.use(express.static('public/offerBannerImages'))
var storage=multer.diskStorage({
  destination:(req,file,callback)=>{
    callback(null,'public/category_images')
  },
  filename:(req,file,callback)=>{
    callback(null,file.fieldname+ "_" +Date.now() +"_"+ file.originalname)
  }
})
var upload=multer({
  storage:storage
}).single('image')

const bannerStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, 'public/offerBannerImages'); 
  },
  filename: (req, file, callback) => {
    callback(null, file.fieldname + "_" + Date.now() + "_" + file.originalname);
  }
});

let bannerUpload=multer({
  storage:bannerStorage
}).single('image')

var productstorage=multer.diskStorage({
  destination:(req,file,callback)=>{
    callback(null,'public/product_images')
  },
  filename:(req,file,callback)=>{
    callback(null,file.fieldname+ "_" +Date.now() +"_"+ file.originalname)
  }
})
const productupload = multer({
  storage: productstorage,
  limits: { fileSize: 5 * 1024 * 1024 } 
}).fields([
  { name: 'cover_image', maxCount: 1 },
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 }
]);



//------------------------------------------------------------------------------------//
router.use(session({
  name:"sid1",
  secret: "my secret key",
  saveUninitialized: false,
  resave: false,
  cookie: { secure: false } 
}));

router.use((req,res,next)=>{
  res.locals.adminmessage=req.session.adminmessage
  delete req.session.adminmessage
  next()
})
router.use('/admin/*', authMiddleware.isAdmin)
//------------------------------------------login----------------------------------------------//
router.get('/login',authMiddleware.isAlreadylogged,(req,res)=>{
  res.render('admin/login')
})


router.post('/login',adminAuthController.postLogin)


router.get('/logout',adminAuthController.logout)



//------------------------------------------login----------------------------------------------//
//---------------------------users--------------------------------------------------------//
router.get('/users',adminAuthController.getAdminUser)

router.get('/adduser',(req,res)=>{
  res.render('admin/addUser')
})

router.post('/adduser',adminAuthController.postAddUser)


router.get('/block/:id',adminAuthController.blockuser)

router.get('/unblock/:id',adminAuthController.unblockuser)





//---------------------------users--------------------------------------------------------//
//------------------------------------category-------------------------------------------//
router.get('/category',categoryController.getAllcategory)

router.get('/addcategory',(req,res)=>{
  res.render('admin/addCategory')
})

router.post('/addcategory',upload,categoryController.addCategory)

router.get('/editcategory/:id',categoryController.getEditCategory)

router.post('/editcategory/:id',upload,categoryController.postEditCategory)


router.get('/deletecategory/:id',categoryController.deleteCategory)
//------------------------------------category-------------------------------------------//
//------------------------------------product------------------------------------------//
router.get('/products',productController.getProducts)

router.get('/addproduct',productController.getAddProduct)


router.post('/addproduct',productupload,productController.addProduct)

router.get('/editproduct/:id',productController.getEditProduct)

router.post('/editproduct/:id',productupload,productController.postEditProduct)
router.get('/deleteproduct/:id',productController.deleteProduct)
//------------------------------------product------------------------------------------//
//------------------------------------order------------------------------------------//

router.get('/orders',orderController.getOrder)

router.post('/update-order-status',orderController.updateStatus)

router.get('/orderdetails/:id',orderController.orderDetails)

router.get('/orders/details/:id',orderController.getSingleOrder)

//------------------------------------order------------------------------------------//
router.get('/coupon',couponController.getCoupon)
router.get('/addcoupon',couponController.addCoupon)
router.post('/addcoupon',couponController.postAddCoupon)
router.get('/editcoupon/:id',couponController.getEditCoupon)
router.post('/editcoupon/:id',couponController.postEditCoupon)
router.get('/deletecoupon/:id',couponController.deleteCoupon)
//------------------------------------coupon------------------------------------------//

router.get('/offer/category',offerController.getCategoryOffer)
router.get('/offers/addoffer/:id',offerController.addOffer)
router.post('/offers/addoffer',bannerUpload,offerController.postAddOffer)



router.get('/offer/product',offerController.getProductOffer)
router.get('/productoffers/addoffer/:id',offerController.addProductOffer)
router.post('/offers/addproductoffer',bannerUpload,offerController.postProductOffer)
//---------------------------------------offer----------------------------------------//

router.get('/sales',salesController.getSales)
router.get('/download-report',salesController.downloadReport)

router.get('/approve/:id/product/:productid',salesController.approveReturn)
router.get('/reject/:id/product/:productid',salesController.rejectReturn)
//--------------------------------------sales-----------------------------------------//

router.get('/dashboard',salesController.getDashboard)

router.get('/sales-data',salesController.getSalesData)

router.get('/index',(req,res)=>{
  res.render('admin/index')
})
module.exports=router