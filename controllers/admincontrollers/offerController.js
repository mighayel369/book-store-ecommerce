let categorymodel=require('../../models/categorydetails')
let productmodel=require('../../models/productdetails')
const cron = require('node-cron');
let fs=require('fs')
let coupon=require('../../models/coupon')
const {check,validationResult,body } = require('express-validator')
cron.schedule('* * * * *', async () => {
  try {
    const currentDate = new Date();
    let expiredProducts = await productmodel.find({
      'offer.isOfferActive': true,
      'offer.endDate': { $lt: currentDate },
      discountSource: 'product'  
    });

    for (let product of expiredProducts) {
      await productmodel.updateOne(
        { _id: product._id },
        {$set: {  discountPrice: null, 'offer.isOfferActive': false}});
    }

    let expiredCategories = await categorymodel.find({
      'offer.isOfferActive': true,
      'offer.endDate': { $lt: currentDate }
    });

    for (let category of expiredCategories) {
      await categorymodel.updateOne(
        { _id: category._id },
        { $set: { 'offer.isOfferActive': false } }
      );

      await productmodel.updateMany(
        { productcategory: category._id, discountSource: 'category' },
        { $set: { discountPrice: null }}
      );
    }
    let upcomingCategories = await categorymodel.find({
      'offer.isOfferActive': false,
      'offer.startDate': { $lte: currentDate },
      'offer.endDate': { $gte: currentDate } 
    });

    for (let category of upcomingCategories) {
      await categorymodel.updateOne(
        { _id: category._id },
        { $set: { 'offer.isOfferActive': true } }
      );
      const { discountType, discountValue } = category.offer;
      let products = await productmodel.find({ productcategory: category._id });

      for (let product of products) {
        let discountPrice = 0;

        if (discountType === 'percentage') {
          discountPrice = product.productprice - (product.productprice * (discountValue / 100));
        } else if (discountType === 'fixed') {
          discountPrice = product.productprice - discountValue;
        }
        discountPrice = Math.max(discountPrice, 0);
        await productmodel.updateOne(
          { _id: product._id },
          {
            $set: {
              discountPrice: discountPrice,
              discountSource: 'category'
            }
          }
        );
      }
    }

    let upcomingProducts = await productmodel.find({
      'offer.isOfferActive': false,
      'offer.startDate': { $lte: currentDate },
      'offer.endDate': { $gte: currentDate },
    });

    for (let product of upcomingProducts) {
      const { discountType, discountValue } = product.offer;
      let discountPrice = 0;

      if (discountType === 'percentage') {
        discountPrice = product.productprice - (product.productprice * (discountValue / 100));
      } else if (discountType === 'fixed') {
        discountPrice = product.productprice - discountValue;
      }
      discountPrice = Math.max(discountPrice, 0);
      await productmodel.updateOne(
        { _id: product._id },
        {
          $set: {
            discountPrice: discountPrice,
            discountSource: 'product',
            'offer.isOfferActive':true
          }
        }
      );
    }



    let expiredCoupons=await coupon.find({isActive:true,endDate:{$lt:currentDate}})

    for(let coupons of expiredCoupons){
      await coupon.updateOne({_id: coupons._id},{
        $set:{isActive:false}
      })
    }

    let upcomingCoupons=await coupon.find({isActive:false,startDate:{$lte:currentDate},endDate:{$gte:currentDate}})

    for(let coupons of upcomingCoupons){
      await coupon.updateOne({_id:coupons._id},{
        $set:{isActive:true}
      })
    }

    console.log("Offers and coupons have been updated successfully.");
  } catch (error) {
    console.error("Error updating offers:", error);
  }
})

module.exports={
    getCategoryOffer:async(req,res)=>{
        try{
            let category=await categorymodel.find()
            res.render('admin/categoryOffer',{category})
        }
        catch(error){
            console.log(error)
        }
    },
    addOffer:async(req,res)=>{
        try{
            let id=req.params.id
            let category=await categorymodel.findById(id)
            res.render('admin/addCategoryOffer',{category})
        }
        catch(error){
            console.log(error)
        }
    },
    postAddOffer:[check('offerType').notEmpty().withMessage('Please fill out all fields')
      ,check('offerValue').notEmpty().withMessage('Please fill out all fields'),
      check('startDate').notEmpty().withMessage('Please fill out all fields'),
      check('endDate').notEmpty().withMessage('Please fill out all fields'),
      check('offerDescription').notEmpty().withMessage('Please fill out all fields'),
      body('endDate').custom((value, { req }) => {
        if (new Date(value) < new Date(req.body.startDate)) {
            throw new Error('End date cannot be earlier than start date');
        }
        return true;
    })
      ,async(req,res)=>{
        try{
           let {offerType,offerValue,startDate,endDate,offerDescription,categoryId}=req.body
           const errors = validationResult(req);
  
           if (!errors.isEmpty()) {
             const errorMessage = errors.array()[0].msg;
             req.session.adminmessage={message:errorMessage}
             return res.redirect(`/admin/offers/addoffer/${categoryId}`);
           }
           let filename=req.file.filename
           let category=await categorymodel.findById(categoryId)
           let offerExist = category.offer;
           if(offerExist && category.offer.bannerImage){
            fs.unlinkSync('public/offerBannerImages/'+offerExist.bannerImage)
          }
           isOfferActive=false
           let offerDetails = {
            isOfferActive,
            discountType: offerType,
            discountValue: offerValue,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            bannerImage: filename,
            offerDescription: offerDescription
          }
          category.offer=offerDetails
          category.save()

          res.redirect(`/admin/offers/addoffer/${categoryId}`);
        }
        catch(error){
            console.log(error)
        }
    }],

    getProductOffer:async(req,res)=>{
        try{
          let products=await productmodel.find()
            res.render('admin/productOffer',{products})
        }
        catch(error){
            console.log(error)
        }
    },
    addProductOffer:async(req,res)=>{
      try{
        let id=req.params.id
        let product=await productmodel.findById(id)
        res.render('admin/addProductOffer',{product})
      }
      catch(error){
        console.log(error)
      }
    },
    postProductOffer:[check('offerType').notEmpty().withMessage('Please fill out all fields')
      ,check('offerValue').notEmpty().withMessage('Please fill out all fields'),
      check('startDate').notEmpty().withMessage('Please fill out all fields'),
      check('endDate').notEmpty().withMessage('Please fill out all fields'),
      check('offerDescription').notEmpty().withMessage('Please fill out all fields'),
      body('endDate').custom((value, { req }) => {
        if (new Date(value) < new Date(req.body.startDate)) {
            throw new Error('End date cannot be earlier than start date');
        }
        return true;
    }),async(req,res)=>{
      try{
        let {offerType,offerValue,startDate,endDate,offerDescription,productId}=req.body
        const errors = validationResult(req);
  
           if (!errors.isEmpty()) {
             const errorMessage = errors.array()[0].msg;
             req.session.adminmessage={message:errorMessage}
             return res.redirect(`/admin/productoffers/addoffer/${productId}`);
           }
        let filename=req.file.filename
        let product=await productmodel.findById(productId)
       let offerExist = product.offer;
       if(offerExist && product.offer.bannerImage){
         fs.unlinkSync('public/offerBannerImages/'+offerExist.bannerImage)
       }
        isOfferActive=false
        let offerDetails = {
         isOfferActive,
         discountType: offerType,
         discountValue: offerValue,
         startDate: new Date(startDate),
         endDate: new Date(endDate),
         bannerImage: filename,
         offerDescription: offerDescription
       }
       product.offer = offerDetails
       await product.save();
        res.redirect(`/admin/productoffers/addoffer/${productId}`);
      }
      catch(error){
        console.log(error)
      }
    }]
}


