const express = require('express')
const router = express.Router()
let session = require('express-session')
let adminAuthController = require('../controllers/admincontrollers/adminAuthcontroller')
let categoryController = require('../controllers/admincontrollers/adminCategorycontroller')
let productController = require('../controllers/admincontrollers/Productcontroller')
let couponController = require('../controllers/admincontrollers/couponController')
let offerController = require('../controllers/admincontrollers/offerController')
let salesController = require('../controllers/admincontrollers/salesController')
let authMiddleware = require('../authMiddleware/adminAuthmiddleware')

const {
  productStorage,
  categoryStorage,
  offerStorage,
  carouselStorage
} = require('../config/cloudinary');
let multer = require('multer')
const adminOrderController = require('../controllers/admincontrollers/adminOrderController')
const adminAccountController = require('../controllers/admincontrollers/adminAccountController')





const bannerUpload = multer({
  storage: offerStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('image');


const productupload = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
}).fields([
  { name: 'cover_image', maxCount: 1 },
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 }
]);

const categoryUpload = multer({
  storage: categoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('image');

const uploadCarousel = multer({ storage: carouselStorage });

//------------------------------------------------------------------------------------//
router.use(session({
  name: "sid1",
  secret: "my secret key",
  saveUninitialized: false,
  resave: false,
  cookie: { secure: false }
}));

router.use((req, res, next) => {
  res.locals.adminmessage = req.session.adminmessage
  delete req.session.adminmessage
  next()
})

//------------------------------------------login----------------------------------------------//
router.get('/login', authMiddleware.isAlreadylogged, (req, res) => {
  res.render('admin/login')
})

router.post('/login', adminAuthController.postLogin)

router.use(authMiddleware.isAdmin);

router.get('/logout', adminAuthController.logout)

//------------------------------------------login----------------------------------------------//
//---------------------------users--------------------------------------------------------//
router.get('/users', adminAuthController.getAdminUser)

router.get('/adduser', (req, res) => {
  res.render('admin/addUser')
})

router.post('/adduser', adminAuthController.postAddUser)


router.get('/block/:id', adminAuthController.blockuser)

router.get('/unblock/:id', adminAuthController.unblockuser)





//---------------------------users--------------------------------------------------------//
//------------------------------------category-------------------------------------------//
router.get('/category', categoryController.getAllcategory)

router.get('/addcategory', (req, res) => {
  res.render('admin/addCategory')
})

router.post('/addcategory', categoryUpload, categoryController.addCategory)

router.get('/editcategory/:id', categoryController.getEditCategory)

router.post('/editcategory/:id', categoryUpload, categoryController.postEditCategory)


router.get('/deletecategory/:id', categoryController.deleteCategory)
//------------------------------------category-------------------------------------------//
//------------------------------------product------------------------------------------//
router.get('/products', productController.getProducts)

router.get('/addproduct', productController.getAddProduct)


router.post('/addproduct', productupload, productController.addProduct)

router.get('/editproduct/:id', productController.getEditProduct)

router.post('/editproduct/:id', productupload, productController.postEditProduct)
router.get('/deleteproduct/:id', productController.deleteProduct)
//------------------------------------product------------------------------------------//
//------------------------------------order------------------------------------------//

router.get('/orders', adminOrderController.getOrder)

router.post('/update-order-status', adminOrderController.updateStatus)

router.get('/orderdetails/:id', adminOrderController.orderDetails)

//------------------------------------order------------------------------------------//
router.get('/coupon', couponController.getCoupon)
router.get('/addcoupon', couponController.addCoupon)
router.post('/addcoupon', couponController.postAddCoupon)
router.get('/editcoupon/:id', couponController.getEditCoupon)
router.post('/editcoupon/:id', couponController.postEditCoupon)
router.get('/deletecoupon/:id', couponController.deleteCoupon)
//------------------------------------coupon------------------------------------------//

router.get('/offer/category', offerController.getCategoryOffer)
router.get('/offers/addoffer/:id', offerController.addOffer)
router.post('/offers/addoffer', bannerUpload, offerController.postAddOffer)



router.get('/offer/product', offerController.getProductOffer)
router.get('/productoffers/addoffer/:id', offerController.addProductOffer)
router.post('/offers/addproductoffer', bannerUpload, offerController.postProductOffer)
//---------------------------------------offer----------------------------------------//

router.get('/sales', salesController.getSales)
router.get('/download-report', salesController.downloadReport)

router.get('/approve/:id/product/:productid', salesController.approveReturn)
router.get('/reject/:id/product/:productid', salesController.rejectReturn)
//--------------------------------------sales-----------------------------------------//

router.get('/dashboard', salesController.getDashboard)

router.get('/sales-data', salesController.getSalesData)

//--------------------------------------------------------------------------------//



router.get('/carousal', adminAccountController.getCourosal);

router.post('/carousal/add', uploadCarousel.single('image'), adminAccountController.addCourosal);

router.post('/carousal/:id/replace', uploadCarousel.single('image'), adminAccountController.replaceCourosal);

router.post('/carousal/:id/delete', adminAccountController.deleteCourosal);

router.get('/index', (req, res) => {
  res.render('admin/index')
})
module.exports = router