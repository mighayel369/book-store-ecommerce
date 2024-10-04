let usermodel=require('../../models/userdetails')
let coupon=require('../../models/coupon')
const {check,validationResult,body } = require('express-validator');

module.exports={
    getCoupon:async(req,res)=>{
        try{
            let Coupons=await coupon.find()
            res.render('admin/couponPage',{Coupons})
        }
        catch(error){
            console.log(error)
        }
    },
    addCoupon:async (req,res)=>{
        try{
            res.render('admin/addCoupon')
        }
        catch(error){
            console.log(error)
        }
    },
    postAddCoupon:[check('coupontype').notEmpty().withMessage('Please fill out all fields')
        ,check('discountvalue').notEmpty().withMessage('Please fill out all fields'),
        check('minamount').notEmpty().withMessage('Please fill out all fields'),
        check('description').notEmpty().withMessage('Please fill out all fields'),
        check('startdate').notEmpty().withMessage('Please fill out all fields'),
        check('enddate').notEmpty().withMessage('Please fill out all fields'),
        body('enddate').custom((value, { req }) => {
            if (new Date(value) < new Date(req.body.startdate)) {
                throw new Error('End date cannot be earlier than start date');
            }
            return true;
        })
         ,async(req,res)=>{
        try{
            let {coupontype,minamount,description,startdate,enddate,discountvalue}=req.body
            const errors = validationResult(req);
  
            if (!errors.isEmpty()) {
              const errorMessage = errors.array()[0].msg;
              req.session.adminmessage={message:errorMessage}
              return res.redirect('/admin/addcoupon');
            }
            let newCoupon={
                code:generatecouponcode(),
                discountType:coupontype,
                description:description,
                discountValue:discountvalue,
                startDate:startdate,
                endDate:enddate,
                minimumPurchaseAmount:minamount,
            }
            let Coupon=await coupon(newCoupon)
            await Coupon.save()
            res.redirect('/admin/coupon')
        }
        catch(error){
            console.log(error)
        }
    }],
    getEditCoupon:async(req,res)=>{
        try{
            let couponId=req.params.id
            let Coupon=await coupon.findById(couponId)
            res.render('admin/editCoupon',{Coupon})
        }
        catch(error){
            console.log(error)
        }
    },
    postEditCoupon:[ body('enddate').custom((value, { req }) => {
        if (new Date(value) < new Date(req.body.startdate)) {
            throw new Error('End date cannot be earlier than start date');
        }
        return true;
    }) ,async(req,res)=>{
        try{
            let couponId=req.params.id
            let {couponcode,coupontype,minamount,description,startdate,enddate,discountvalue}=req.body
            const errors = validationResult(req);
  
            if (!errors.isEmpty()) {
              const errorMessage = errors.array()[0].msg;
              req.session.adminmessage={message:errorMessage}
              return res.redirect('/admin/addcoupon');
            }
            let couponData={
                code:couponcode,
                discountType:coupontype,
                description:description,
                discountValue:discountvalue,
                startDate:startdate,
                endDate:enddate,
                minimumPurchaseAmount:minamount,
            }
            await coupon.findByIdAndUpdate(couponId,couponData,{new:true})
            req.session.adminmessage={
                type:"success",
                message:"Coupon Updated Successfully"
              }
            res.redirect('/admin/coupon')
        }
        catch(error){
            console.log(error)
        }
    }],
    deleteCoupon:async(req,res)=>{
        try{
            let couponId=req.params.id
            await coupon.findByIdAndDelete(couponId)
            res.redirect('/admin/coupon')
        }
        catch(error){
            console.log(error)
        }
    }

}

function generatecouponcode(){
    let char="QWERTYUIOPASDFGHJKLZXCVBNM"
    let result = ''
    let number=Math.floor(Math.random()*1000)
    for(let i=0;i<=3;i++){
        const randomIndex = Math.floor(Math.random()*char.length)
        result += char[randomIndex]
    }
    let couponcode=result+number
    return couponcode
}